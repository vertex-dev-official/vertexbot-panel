// Syntaxe ESM native (import/export) plutot que require()/module.exports : Next.js gere
// l'interop CommonJS/ESM automatiquement et sans ambiguite pour ce style, ce qui evite les
// echecs ("Page /api/auth/[...nextauth] does not export a default function") observes avec
// require("next-auth").default selon la forme exacte du package embarquee par le bundler.
import NextAuth from "next-auth";
import { authOptions } from "../../../lib/authOptions";

export default NextAuth(authOptions);
