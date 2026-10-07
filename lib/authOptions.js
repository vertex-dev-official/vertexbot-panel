// Meme precaution que dans [...nextauth].js : gerer les deux formes d'export possibles.
const discordProviderModule = require("next-auth/providers/discord");
const DiscordProvider = discordProviderModule.default || discordProviderModule;

const scopes = ["identify", "guilds"].join(" ");

const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: `https://discord.com/api/oauth2/authorize?scope=${scopes}`,
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

module.exports = { authOptions };
