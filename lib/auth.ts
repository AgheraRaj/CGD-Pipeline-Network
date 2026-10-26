import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: (request) => {
    if (process.env.NODE_ENV !== "development") return [];

    const origin = request?.headers.get("origin");
    if (!origin) return [];

    try {
      const url = new URL(origin);
      const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
        url.hostname
      );

      return url.protocol === "http:" && isLoopback ? [url.origin] : [];
    } catch {
      return [];
    }
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // accounts are created by an administrator only
    minPasswordLength: 8,
  },
  plugins: [nextCookies()], // keep last
});