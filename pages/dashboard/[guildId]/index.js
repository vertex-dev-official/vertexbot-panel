// Syntaxe ESM native : getServerSideProps doit etre un export nomme reel du module, pas une
// propriete accrochee apres coup sur la fonction du composant, sous peine de voir Next.js
// refuser la page en production avec "getServerSideProps can not be attached to a page's
// component and must be exported from the page".
import { getServerSession } from "next-auth/next";
import { useState } from "react";
import Link from "next/link";
import { authOptions } from "../../../lib/authOptions";
import { fetchManageableGuilds } from "../../../lib/discord";
import { prisma } from "../../../lib/prisma";

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: "/", permanent: false } };

  const { guildId } = context.params;
  const manageable = await fetchManageableGuilds(session.accessToken);
  if (!manageable.some((g) => g.id === guildId)) return { notFound: true };

  const guild = await prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });

  return { props: { guild: JSON.parse(JSON.stringify(guild)) } };
}

const MODULES = [
  { key: "economyEnabled", label: "Economie" },
  { key: "levelingEnabled", label: "Niveaux / XP" },
  { key: "moderationEnabled", label: "Moderation" },
  { key: "ticketsEnabled", label: "Tickets" },
  { key: "musicEnabled", label: "Musique" },
  { key: "gamesEnabled", label: "Mini-jeux" },
  { key: "captchaEnabled", label: "Captcha a l'arrivee" },
  { key: "confessionsEnabled", label: "Confessions anonymes" },
  { key: "aiEnabled", label: "IA (/ask)" },
];

export default function ConfigPage({ guild: initialGuild }) {
  const [guild, setGuild] = useState(initialGuild);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  function set(field, value) {
    setGuild((g) => ({ ...g, [field]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/guilds/${guild.id}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guild),
      });
      if (res.ok) setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto pb-24">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-2">
        <h1 className="text-3xl font-bold">Configuration du serveur</h1>
        <Link href={`/dashboard/${guild.id}/embeds`} className="btn-primary">
          🧩 Editeur d'embeds
        </Link>
      </div>
      <p className="text-gray-400 mb-8 text-sm">ID: {guild.id}</p>

      <section className="card p-5 mb-6">
        <h2 className="text-xl font-semibold mb-4">Modules</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {MODULES.map((m) => (
            <label key={m.key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={!!guild[m.key]} onChange={(e) => set(m.key, e.target.checked)} className="w-5 h-5 accent-accent" />
              {m.label}
            </label>
          ))}
        </div>
      </section>

      <section className="card p-5 mb-6">
        <h2 className="text-xl font-semibold mb-4">Apparence</h2>
        <label className="block mb-2 text-sm text-gray-400">Couleur des embeds</label>
        <div className="flex items-center gap-3">
          <input type="color" value={guild.embedColor} onChange={(e) => set("embedColor", e.target.value)} className="w-12 h-10 rounded" />
          <input type="text" value={guild.embedColor} onChange={(e) => set("embedColor", e.target.value)} />
        </div>
      </section>

      <section className="card p-5 mb-6">
        <h2 className="text-xl font-semibold mb-4">Arrivees / departs</h2>
        <label className="block mb-1 text-sm text-gray-400">ID du salon de bienvenue</label>
        <input type="text" value={guild.welcomeChannelId || ""} onChange={(e) => set("welcomeChannelId", e.target.value)} className="mb-3" />
        <label className="block mb-1 text-sm text-gray-400">Message de bienvenue ({"{user} {guild} {memberCount}"})</label>
        <textarea rows={2} value={guild.welcomeMessage || ""} onChange={(e) => set("welcomeMessage", e.target.value)} className="mb-3" />
        <label className="block mb-1 text-sm text-gray-400">ID du salon de depart</label>
        <input type="text" value={guild.leaveChannelId || ""} onChange={(e) => set("leaveChannelId", e.target.value)} className="mb-3" />
        <label className="block mb-1 text-sm text-gray-400">Message de depart</label>
        <textarea rows={2} value={guild.leaveMessage || ""} onChange={(e) => set("leaveMessage", e.target.value)} />
      </section>

      <section className="card p-5 mb-6">
        <h2 className="text-xl font-semibold mb-4">Niveaux / XP</h2>
        <label className="block mb-1 text-sm text-gray-400">XP gagne par message</label>
        <input type="number" value={guild.xpPerMessage} onChange={(e) => set("xpPerMessage", Number(e.target.value))} className="mb-3" />
        <label className="block mb-1 text-sm text-gray-400">Cooldown entre deux gains d'XP (secondes)</label>
        <input type="number" value={guild.xpCooldown} onChange={(e) => set("xpCooldown", Number(e.target.value))} className="mb-3" />
        <label className="block mb-1 text-sm text-gray-400">Message de passage de niveau ({"{user} {level}"})</label>
        <textarea rows={2} value={guild.levelUpMessage || ""} onChange={(e) => set("levelUpMessage", e.target.value)} />
      </section>

      <section className="card p-5 mb-6">
        <h2 className="text-xl font-semibold mb-4">Economie</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1 text-sm text-gray-400">Nom de la monnaie</label>
            <input type="text" value={guild.currencyName} onChange={(e) => set("currencyName", e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-400">Symbole (emoji)</label>
            <input type="text" value={guild.currencySymbol} onChange={(e) => set("currencySymbol", e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-400">Montant /daily</label>
            <input type="number" value={guild.dailyAmount} onChange={(e) => set("dailyAmount", Number(e.target.value))} />
          </div>
        </div>
      </section>

      <section className="card p-5 mb-6">
        <h2 className="text-xl font-semibold mb-4">Moderation</h2>
        <label className="block mb-1 text-sm text-gray-400">ID du salon de logs</label>
        <input type="text" value={guild.logsChannelId || ""} onChange={(e) => set("logsChannelId", e.target.value)} className="mb-3" />
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!guild.automodConfig?.antiInvite}
            onChange={(e) => set("automodConfig", { ...(guild.automodConfig || {}), antiInvite: e.target.checked })}
            className="w-5 h-5 accent-accent"
          />
          Bloquer automatiquement les liens d'invitation Discord
        </label>
      </section>

      <section className="card p-5 mb-6">
        <h2 className="text-xl font-semibold mb-4">Confessions</h2>
        <label className="block mb-1 text-sm text-gray-400">ID du salon de confessions</label>
        <input type="text" value={guild.confessionChannelId || ""} onChange={(e) => set("confessionChannelId", e.target.value)} />
      </section>

      <AiSection guildId={guild.id} guild={guild} set={set} />

      <BotProfileSection guildId={guild.id} guild={guild} set={set} />

      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/10 p-4 flex items-center justify-center gap-4">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
        {savedAt && <span className="text-sm text-gray-400">Sauvegarde a {savedAt}</span>}
      </div>
    </main>
  );
}

function AiSection({ guildId, guild, set }) {
  const [provider, setProvider] = useState(guild.aiProvider || "anthropic");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  async function saveKey() {
    if (!apiKey.trim()) {
      setResult({ ok: false, message: "Colle ta cle API avant d'enregistrer." });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(`/api/guilds/${guildId}/ai-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error || "Erreur inconnue." });
      } else {
        setApiKey("");
        set("hasAiKey", true);
        set("aiProvider", provider);
        setResult({ ok: true, message: "Cle enregistree pour ce serveur." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeKey() {
    if (!confirm("Retirer la cle IA de ce serveur ?")) return;
    setSaving(true);
    try {
      await fetch(`/api/guilds/${guildId}/ai-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remove: true }),
      });
      set("hasAiKey", false);
      setResult({ ok: true, message: "Cle retiree." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5 mb-6">
      <h2 className="text-xl font-semibold mb-4">IA</h2>
      <p className="text-sm text-gray-500 mb-3">
        Coche "IA" dans les modules ci-dessus pour activer <code>/ask</code>. Chaque serveur utilise sa propre cle : ce bot
        peut donc etre invite sur n'importe quel serveur Discord sans configuration cote hebergeur. Claude, GPT et Groq
        proposent tous un acces gratuit pour commencer.
      </p>

      <label className="block mb-1 text-sm text-gray-400">ID du salon de reponse automatique (optionnel, sans commande)</label>
      <input type="text" value={guild.aiChannelId || ""} onChange={(e) => set("aiChannelId", e.target.value)} className="mb-4" />

      <div className="border border-white/10 rounded-lg p-4">
        <p className="text-sm font-semibold mb-3">
          {guild.hasAiKey ? `✅ Cle configuree (${guild.aiProvider})` : "❌ Aucune cle configuree pour ce serveur"}
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block mb-1 text-sm text-gray-400">Fournisseur</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="anthropic">Claude (Anthropic)</option>
              <option value="openai">GPT (OpenAI)</option>
              <option value="groq">Llama (Groq)</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-400">Cle API</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveKey} disabled={saving} className="btn-primary">
            {saving ? "..." : "Enregistrer la cle"}
          </button>
          {guild.hasAiKey && (
            <button onClick={removeKey} disabled={saving} className="px-4 py-2 rounded-xl bg-[#3a2130] text-[#f2acc1] font-semibold hover:opacity-80 transition">
              Retirer
            </button>
          )}
        </div>

        {result && <p className={`text-sm mt-3 ${result.ok ? "text-[#57F287]" : "text-[#ff9aa0]"}`}>{result.message}</p>}
        <p className="text-xs text-gray-500 mt-3">
          La cle n'est jamais renvoyee au navigateur une fois enregistree - seul le statut "configuree / non configuree"
          est affiche.
        </p>
      </div>
    </section>
  );
}

function BotProfileSection({ guildId, guild, set }) {
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  async function apply() {
    setApplying(true);
    setResult(null);
    try {
      const res = await fetch(`/api/guilds/${guildId}/bot-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: guild.botNickname, avatarUrl: guild.botAvatarUrl, bannerUrl: guild.botBannerUrl, bio: guild.botBio }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error || "Erreur inconnue." });
      } else if (data.applied) {
        setResult({ ok: true, message: "Profil applique sur Discord." });
      } else {
        setResult({ ok: false, message: `Sauvegarde, mais Discord a refuse la mise a jour : ${data.warning}` });
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="card p-5 mb-6">
      <h2 className="text-xl font-semibold mb-4">Profil du bot sur ce serveur</h2>
      <p className="text-sm text-gray-500 mb-3">
        Le pseudo et l'avatar sont appliques directement sur le compte Discord du bot pour ce serveur. La bio et la banniere
        n'ont pas d'equivalent natif cote Discord pour un bot : elles sont affichees par le bot lui-meme via{" "}
        <code>/profil-bot voir</code>.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block mb-1 text-sm text-gray-400">Pseudo sur ce serveur</label>
          <input type="text" value={guild.botNickname || ""} onChange={(e) => set("botNickname", e.target.value)} />
        </div>
        <div>
          <label className="block mb-1 text-sm text-gray-400">Avatar (URL, specifique a ce serveur)</label>
          <input type="text" value={guild.botAvatarUrl || ""} onChange={(e) => set("botAvatarUrl", e.target.value)} />
        </div>
        <div>
          <label className="block mb-1 text-sm text-gray-400">Banniere (URL, vitrine)</label>
          <input type="text" value={guild.botBannerUrl || ""} onChange={(e) => set("botBannerUrl", e.target.value)} />
        </div>
        <div>
          <label className="block mb-1 text-sm text-gray-400">Bio (vitrine)</label>
          <input type="text" value={guild.botBio || ""} onChange={(e) => set("botBio", e.target.value)} />
        </div>
      </div>
      <button
        onClick={apply}
        disabled={applying}
        className="px-4 py-2 rounded-xl bg-[#57F287] text-[#0f2418] font-semibold hover:opacity-85 transition disabled:opacity-40"
      >
        {applying ? "Application..." : "Appliquer sur Discord"}
      </button>
      {result && <p className={`text-sm mt-3 ${result.ok ? "text-[#57F287]" : "text-[#ff9aa0]"}`}>{result.message}</p>}
    </section>
  );
}


