// Syntaxe ESM native : voir le commentaire dans dashboard/[guildId]/index.js pour la raison
// (getServerSideProps doit etre un export nomme reel du module en production sur Vercel).
import { getServerSession } from "next-auth/next";
import { useState } from "react";
import Link from "next/link";
import { authOptions } from "../../../../lib/authOptions";
import { fetchManageableGuilds } from "../../../../lib/discord";
import { prisma } from "../../../../lib/prisma";
import EmbedPreview from "../../../../components/EmbedPreview";

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: "/", permanent: false } };

  const { guildId } = context.params;
  const manageable = await fetchManageableGuilds(session.accessToken);
  if (!manageable.some((g) => g.id === guildId)) return { notFound: true };

  const embeds = await prisma.customEmbed.findMany({
    where: { guildId },
    orderBy: { updatedAt: "desc" },
    include: { fields: { orderBy: { order: "asc" } } },
  });

  return { props: { guildId, embeds: JSON.parse(JSON.stringify(embeds)) } };
}

export default function EmbedsListPage({ guildId, embeds: initialEmbeds }) {
  const [embeds, setEmbeds] = useState(initialEmbeds);
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(embed) {
    if (!confirm(`Supprimer l'embed "${embed.name}" ? Cette action est irreversible.`)) return;
    setDeletingId(embed.id);
    try {
      const res = await fetch(`/api/guilds/${guildId}/embeds/${embed.id}`, { method: "DELETE" });
      if (res.ok) setEmbeds((list) => list.filter((e) => e.id !== embed.id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">Editeur d'embeds</h1>
        <Link href={`/dashboard/${guildId}`} className="text-sm text-gray-400 hover:text-white">
          ← Retour a la config
        </Link>
      </div>
      <p className="text-gray-400 mb-8 text-sm">
        Cree, modifie et publie des embeds directement dans un salon de ton serveur, sans passer par une commande.
      </p>

      <Link href={`/dashboard/${guildId}/embeds/new`} className="btn-primary inline-block mb-8">
        + Nouvel embed
      </Link>

      {!embeds.length && (
        <div className="card p-8 text-center text-gray-400">
          Aucun embed sauvegarde pour l'instant. Cree ton premier embed, ou utilise <code>/embed sauvegarder</code> depuis Discord.
        </div>
      )}

      <div className="grid gap-6">
        {embeds.map((embed) => (
          <div key={embed.id} className="card p-5">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">{embed.name}</h2>
                <p className="text-xs text-gray-500">
                  Mis a jour le {new Date(embed.updatedAt).toLocaleString("fr-FR")}
                  {embed.lastSentChannelId && " • deja publie"}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link href={`/dashboard/${guildId}/embeds/${embed.id}`} className="btn-primary">
                  Modifier / Publier
                </Link>
                <button
                  onClick={() => handleDelete(embed)}
                  disabled={deletingId === embed.id}
                  className="px-4 py-2 rounded-xl bg-[#3a2130] text-[#f2acc1] font-semibold hover:opacity-80 transition"
                >
                  {deletingId === embed.id ? "..." : "Supprimer"}
                </button>
              </div>
            </div>
            <EmbedPreview embed={embed} content={embed.content} />
          </div>
        ))}
      </div>
    </main>
  );
}
