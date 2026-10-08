// Syntaxe ESM native : voir le commentaire dans dashboard/[guildId]/index.js pour la raison
// (getServerSideProps doit etre un export nomme reel du module en production sur Vercel).
import { getServerSession } from "next-auth/next";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { authOptions } from "../../../../lib/authOptions";
import { fetchManageableGuilds } from "../../../../lib/discord";
import { prisma } from "../../../../lib/prisma";
import EmbedPreview from "../../../../components/EmbedPreview";

const EMPTY_EMBED = {
  name: "",
  content: "",
  title: "",
  titleUrl: "",
  description: "",
  color: "#9B6FBF",
  authorName: "",
  authorIconUrl: "",
  authorUrl: "",
  imageUrl: "",
  thumbnailUrl: "",
  footerText: "",
  footerIconUrl: "",
  useTimestamp: false,
  fields: [],
  lastSentChannelId: null,
  lastSentMessageId: null,
};

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: "/", permanent: false } };

  const { guildId, embedId } = context.params;
  const manageable = await fetchManageableGuilds(session.accessToken);
  if (!manageable.some((g) => g.id === guildId)) return { notFound: true };

  if (embedId === "new") {
    return { props: { guildId, embedId: null, initialEmbed: null } };
  }

  const embed = await prisma.customEmbed.findFirst({
    where: { id: embedId, guildId },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!embed) return { notFound: true };

  return { props: { guildId, embedId, initialEmbed: JSON.parse(JSON.stringify(embed)) } };
}

export default function EmbedBuilderPage({ guildId, embedId, initialEmbed }) {
  const router = useRouter();
  const [embed, setEmbed] = useState(initialEmbed || EMPTY_EMBED);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const [channels, setChannels] = useState([]);
  const [channelsError, setChannelsError] = useState(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState(initialEmbed?.lastSentChannelId || "");
  const [updateInPlace, setUpdateInPlace] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  const isNew = !embedId;

  useEffect(() => {
    let cancelled = false;
    setLoadingChannels(true);
    fetch(`/api/guilds/${guildId}/channels`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Erreur inconnue");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setChannels(data.channels || []);
      })
      .catch((err) => {
        if (!cancelled) setChannelsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingChannels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  function set(field, value) {
    setEmbed((e) => ({ ...e, [field]: value }));
  }

  function setField(index, key, value) {
    setEmbed((e) => {
      const fields = e.fields.slice();
      fields[index] = { ...fields[index], [key]: value };
      return { ...e, fields };
    });
  }

  function addField() {
    setEmbed((e) => ({ ...e, fields: [...e.fields, { name: "", value: "", inline: false }] }));
  }

  function removeField(index) {
    setEmbed((e) => ({ ...e, fields: e.fields.filter((_, i) => i !== index) }));
  }

  function moveField(index, direction) {
    setEmbed((e) => {
      const fields = e.fields.slice();
      const target = index + direction;
      if (target < 0 || target >= fields.length) return e;
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...e, fields };
    });
  }

  const save = useCallback(async () => {
    setError(null);
    if (!embed.name || !embed.name.trim()) {
      setError("Donne un nom a cet embed (usage interne, pour le retrouver).");
      return null;
    }
    setSaving(true);
    try {
      const url = isNew ? `/api/guilds/${guildId}/embeds` : `/api/guilds/${guildId}/embeds/${embedId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(embed),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la sauvegarde.");
        return null;
      }
      setSavedAt(new Date().toLocaleTimeString());
      setEmbed(data.embed);
      if (isNew) {
        router.replace(`/dashboard/${guildId}/embeds/${data.embed.id}`);
      }
      return data.embed;
    } finally {
      setSaving(false);
    }
  }, [embed, isNew, guildId, embedId, router]);

  async function handlePublish() {
    setPublishResult(null);
    setError(null);
    if (!selectedChannel) {
      setError("Choisis un salon de destination.");
      return;
    }
    const saved = await save();
    // save() renvoie null si la sauvegarde a echoue (erreur de validation ou de reseau) - on doit
    // s'arreter ici dans ce cas, sinon on publierait l'ancienne version non modifiee depuis la base
    // au lieu des changements que l'utilisateur vient de faire dans le formulaire.
    if (!saved) return;
    const targetId = saved.id;

    setPublishing(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/embeds/${targetId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannel, updateLastMessage: updateInPlace }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la publication.");
        return;
      }
      setPublishResult(`Publie dans #${channels.find((c) => c.id === selectedChannel)?.name || selectedChannel}.`);
      setEmbed((e) => ({ ...e, lastSentChannelId: selectedChannel, lastSentMessageId: data.messageId }));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h1 className="text-3xl font-bold">{isNew ? "Nouvel embed" : `Editer : ${initialEmbed.name}`}</h1>
        <Link href={`/dashboard/${guildId}/embeds`} className="text-sm text-gray-400 hover:text-white">
          ← Retour a la liste
        </Link>
      </div>

      {error && <div className="card p-4 mb-6 border-[#ED4245] text-[#ff9aa0]">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* ------------------------- FORMULAIRE ------------------------- */}
        <div className="grid gap-6">
          <section className="card p-5">
            <h2 className="text-xl font-semibold mb-4">General</h2>
            <label className="block mb-1 text-sm text-gray-400">Nom interne (pour le retrouver, non visible sur Discord)</label>
            <input type="text" value={embed.name} onChange={(e) => set("name", e.target.value)} placeholder="ex: reglement-serveur" className="mb-3" />

            <label className="block mb-1 text-sm text-gray-400">Texte du message (au-dessus de l'embed, optionnel)</label>
            <textarea rows={2} value={embed.content || ""} onChange={(e) => set("content", e.target.value)} className="mb-3" />

            <label className="block mb-1 text-sm text-gray-400">Couleur</label>
            <div className="flex items-center gap-3">
              <input type="color" value={embed.color || "#9B6FBF"} onChange={(e) => set("color", e.target.value)} className="w-12 h-10 rounded" />
              <input type="text" value={embed.color || ""} onChange={(e) => set("color", e.target.value)} />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-xl font-semibold mb-4">Titre &amp; description</h2>
            <label className="block mb-1 text-sm text-gray-400">Titre</label>
            <input type="text" value={embed.title || ""} onChange={(e) => set("title", e.target.value)} className="mb-3" />
            <label className="block mb-1 text-sm text-gray-400">Lien du titre (optionnel)</label>
            <input type="text" value={embed.titleUrl || ""} onChange={(e) => set("titleUrl", e.target.value)} placeholder="https://..." className="mb-3" />
            <label className="block mb-1 text-sm text-gray-400">Description</label>
            <textarea rows={4} value={embed.description || ""} onChange={(e) => set("description", e.target.value)} />
          </section>

          <section className="card p-5">
            <h2 className="text-xl font-semibold mb-4">Auteur</h2>
            <label className="block mb-1 text-sm text-gray-400">Nom</label>
            <input type="text" value={embed.authorName || ""} onChange={(e) => set("authorName", e.target.value)} className="mb-3" />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-sm text-gray-400">URL de l'icone</label>
                <input type="text" value={embed.authorIconUrl || ""} onChange={(e) => set("authorIconUrl", e.target.value)} />
              </div>
              <div>
                <label className="block mb-1 text-sm text-gray-400">Lien (clic sur le nom)</label>
                <input type="text" value={embed.authorUrl || ""} onChange={(e) => set("authorUrl", e.target.value)} />
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-xl font-semibold mb-4">Images</h2>
            <label className="block mb-1 text-sm text-gray-400">Image principale (URL)</label>
            <input type="text" value={embed.imageUrl || ""} onChange={(e) => set("imageUrl", e.target.value)} className="mb-3" />
            <label className="block mb-1 text-sm text-gray-400">Miniature, en haut a droite (URL)</label>
            <input type="text" value={embed.thumbnailUrl || ""} onChange={(e) => set("thumbnailUrl", e.target.value)} />
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Champs</h2>
              <button onClick={addField} className="text-sm text-accent hover:underline">
                + Ajouter un champ
              </button>
            </div>

            {!embed.fields.length && <p className="text-sm text-gray-500">Aucun champ. Les champs s'affichent sous forme de grille dans l'embed.</p>}

            <div className="grid gap-3">
              {embed.fields.map((f, i) => (
                <div key={i} className="border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">Champ {i + 1}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => moveField(i, -1)} disabled={i === 0} className="text-xs text-gray-400 hover:text-white disabled:opacity-30">
                        ↑
                      </button>
                      <button
                        onClick={() => moveField(i, 1)}
                        disabled={i === embed.fields.length - 1}
                        className="text-xs text-gray-400 hover:text-white disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button onClick={() => removeField(i)} className="text-xs text-[#f2acc1] hover:underline">
                        Supprimer
                      </button>
                    </div>
                  </div>
                  <input type="text" placeholder="Nom du champ" value={f.name} onChange={(e) => setField(i, "name", e.target.value)} className="mb-2" />
                  <textarea rows={2} placeholder="Valeur" value={f.value} onChange={(e) => setField(i, "value", e.target.value)} className="mb-2" />
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={!!f.inline} onChange={(e) => setField(i, "inline", e.target.checked)} className="w-4 h-4 accent-accent" />
                    Afficher en ligne (cote a cote avec le champ suivant)
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-xl font-semibold mb-4">Footer</h2>
            <label className="block mb-1 text-sm text-gray-400">Texte</label>
            <input type="text" value={embed.footerText || ""} onChange={(e) => set("footerText", e.target.value)} className="mb-3" />
            <label className="block mb-1 text-sm text-gray-400">URL de l'icone</label>
            <input type="text" value={embed.footerIconUrl || ""} onChange={(e) => set("footerIconUrl", e.target.value)} className="mb-3" />
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input type="checkbox" checked={!!embed.useTimestamp} onChange={(e) => set("useTimestamp", e.target.checked)} className="w-4 h-4 accent-accent" />
              Afficher la date/heure actuelle
            </label>
          </section>
        </div>

        {/* ------------------------- APERCU + PUBLICATION ------------------------- */}
        <div>
          <div className="sticky top-6 grid gap-6">
            <section className="card p-5">
              <h2 className="text-xl font-semibold mb-4">Apercu</h2>
              <EmbedPreview embed={embed} content={embed.content} />
            </section>

            <section className="card p-5">
              <h2 className="text-xl font-semibold mb-4">Publier sur Discord</h2>

              {channelsError && (
                <p className="text-sm text-[#ff9aa0] mb-3">
                  Impossible de charger les salons : {channelsError}. Verifie que le bot est bien present sur ce serveur et que <code>DISCORD_TOKEN</code>{" "}
                  est configure sur le panel web.
                </p>
              )}

              <label className="block mb-1 text-sm text-gray-400">Salon de destination</label>
              <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} disabled={loadingChannels || !!channelsError} className="mb-3">
                <option value="">{loadingChannels ? "Chargement..." : "Choisir un salon"}</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>

              {embed.lastSentChannelId === selectedChannel && embed.lastSentMessageId && (
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer mb-3">
                  <input type="checkbox" checked={updateInPlace} onChange={(e) => setUpdateInPlace(e.target.checked)} className="w-4 h-4 accent-accent" />
                  Modifier le message deja publie plutot que d'en renvoyer un nouveau
                </label>
              )}

              <div className="flex items-center gap-3">
                <button onClick={save} disabled={saving} className="btn-primary">
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing || saving || !selectedChannel}
                  className="px-4 py-2 rounded-xl bg-[#57F287] text-[#0f2418] font-semibold hover:opacity-85 transition disabled:opacity-40"
                >
                  {publishing ? "Publication..." : "Publier"}
                </button>
              </div>

              {savedAt && <p className="text-sm text-gray-400 mt-3">Sauvegarde a {savedAt}</p>}
              {publishResult && <p className="text-sm text-[#57F287] mt-3">{publishResult}</p>}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}


