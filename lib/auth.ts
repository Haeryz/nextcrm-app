import { prismadb } from "@/lib/prisma";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { normalizePhoneNumber } from "./phone";
import { canAuthenticateOnStaffPortal } from "./mektek/staff-auth";
import { consumeAuthRateLimit } from "./auth-rate-limit";
import { hashPassword, verifyPassword } from "./password";

const defaultAuthUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = defaultAuthUrl;
}

const authSecret =
  process.env.JWT_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV !== "production"
    ? "nextcrm-dev-secret-change-in-production"
    : undefined);
const DUMMY_PASSWORD_HASH =
  "$2b$12$yN9.V3124cVB69Brg/uOMeXaQn3Lpi1C9CdVHxnprIsbiEc9l5pXO";

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "email or phone", type: "text" },
        password: { label: "password", type: "password" },
        staffOnly: { label: "staff login", type: "text" },
      },

      async authorize(credentials, request) {
        // console.log(credentials, "credentials");
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email atau Password belum diisi");
        }

        const identifier = credentials.email.trim();
        const forwardedFor = request.headers?.["x-forwarded-for"];
        const clientIp =
          forwardedFor?.split(",")[0]?.trim() ||
          request.headers?.["x-real-ip"] ||
          "unknown";
        const [accountLimit, ipLimit] = await Promise.all([
          consumeAuthRateLimit(
            `credentials:account:${identifier.toLowerCase()}`,
            10,
            15 * 60_000,
          ),
          consumeAuthRateLimit(
            `credentials:ip:${clientIp}`,
            30,
            15 * 60_000,
          ),
        ]);
        if (!accountLimit.ok || !ipLimit.ok) {
          throw new Error("Terlalu banyak percobaan Login. Silakan coba lagi sebentar.");
        }
        const phoneNormalized = normalizePhoneNumber(identifier);
        const isEmail = identifier.includes("@");

        const user = await prismadb.users.findFirst({
          where: isEmail
            ? { email: identifier }
            : {
                OR: [
                  { phoneNormalized },
                  { phone: identifier },
                  { email: identifier },
                ],
              },
        });

        const password = credentials.password;
        const verification = await verifyPassword(
          password.slice(0, 200),
          user?.password || DUMMY_PASSWORD_HASH,
        );

        if (!user?.password || !verification.valid) {
          throw new Error("Email/nomor telepon atau Password tidak valid");
        }

        if (
          credentials.staffOnly === "true" &&
          !canAuthenticateOnStaffPortal(user)
        ) {
          throw new Error("Account ini tidak memiliki Staff Access");
        }

        if (verification.needsRehash) {
          await prismadb.users.update({
            where: { id: user.id },
            data: { password: await hashPassword(password.slice(0, 200)) },
          });
        }

        //console.log(user, "user");
        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.is_admin ?? false;
        token.mektekRole = user.mektekRole ?? null;
        token.phone = user.phone ?? null;
        token.phoneNormalized = user.phoneNormalized ?? null;
        token.authVersion = user.authVersion ?? 0;
      }
      return token;
    },
    async session({ token, session }: any) {
      const userId = typeof token.id === "string" ? token.id : "";
      const user = userId
        ? await prismadb.users.findUnique({ where: { id: userId } })
        : null;

      if (!user || Number(token.authVersion ?? 0) !== user.authVersion) {
        // Password changes increment authVersion. Old JWTs remain cryptographically
        // valid but lose every server-side authorization capability immediately.
        session.user.id = "";
        session.user._id = "";
        session.user.isAdmin = false;
        session.user.mektekRole = null;
        session.user.userStatus = "INACTIVE";
        return session;
      }

      const now = new Date();
      if (
        !user.lastLoginAt ||
        now.getTime() - user.lastLoginAt.getTime() >= 5 * 60_000
      ) {
        await prismadb.users.update({
          where: { id: user.id },
          data: { lastLoginAt: now },
        });
      }

      session.user.id = user.id;
      session.user._id = user.id;
      session.user.name = user.name;
      session.user.email = user.email;
      session.user.avatar = user.avatar;
      session.user.image = user.avatar;
      session.user.isAdmin = user.is_admin;
      session.user.mektekRole = user.mektekRole;
      session.user.phone = user.phone;
      session.user.phoneNormalized = user.phoneNormalized;
      session.user.userLanguage = user.userLanguage;
      session.user.userStatus = user.userStatus;
      session.user.lastLoginAt = user.lastLoginAt;
      return session;
    },
  },
};
