// Syntaxe ESM native, pour la meme raison que [...nextauth].js : evite toute ambiguite
// d'interop CommonJS/ESM sur l'import de next-auth/providers/discord. Le export nomme
// `authOptions` reste importable tel quel via require() depuis les fichiers CommonJS du
// projet (getServerSession dans guildAuth.js, les pages dashboard, etc.) - Next.js gere
// cette interop automatiquement, aucun autre fichier n'a besoin d'etre modifie.
import DiscordProvider from "next-auth/providers/discord";

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      // Forme objet { url, params } plutot qu'une chaine brute : certaines versions de next-auth
      // confondent sinon le provider avec un provider OIDC et cherchent des metadonnees "issuer"
      // qui n'existent pas pour Discord (OAuth2 classique) -> erreur "issuer must be configured".
	  issuer: "https://discord.com",
      authorization: {
        url: "https://discord.com/api/oauth2/authorize",
        params: { scope: "identify guilds" },
      },
    }),
  ],
  callbacks: {
    // On garde l'access_token Discord pour recuperer la liste des serveurs de l'utilisateur
    async jwt({ token, account }) {
      if (account) token.accessToken = account.access_token;
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
