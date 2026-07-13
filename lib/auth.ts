import { prismadb } from "@/lib/prisma";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { newUserNotify } from "./new-user-notify";
import { normalizePhoneNumber } from "./phone";
import { canAuthenticateOnStaffPortal } from "./mektek/staff-auth";
import { checkRateLimit } from "./rate-limit";

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
          throw new Error("Email or password is missing");
        }

        const identifier = credentials.email.trim();
        const forwardedFor = request.headers?.["x-forwarded-for"];
        const clientIp =
          forwardedFor?.split(",")[0]?.trim() ||
          request.headers?.["x-real-ip"] ||
          "unknown";
        const loginLimit = checkRateLimit(
          `credentials:${clientIp}:${identifier.toLowerCase()}`,
          10,
          60_000,
        );
        if (!loginLimit.ok) {
          throw new Error("Too many login attempts. Please try again shortly.");
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

        //clear white space from password
        const trimmedPassword = credentials.password.trim();

        if (!user || !user?.password) {
          throw new Error("Invalid email/phone or password");
        }

        const isCorrectPassword = await bcrypt.compare(
          trimmedPassword,
          user.password
        );

        if (!isCorrectPassword) {
          throw new Error("Invalid email/phone or password");
        }

        if (
          credentials.staffOnly === "true" &&
          !canAuthenticateOnStaffPortal(user)
        ) {
          throw new Error("This account is not authorized for staff access");
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
      }
      return token;
    },
    //TODO: fix this any
    async session({ token, session }: any) {
      const user = await prismadb.users.findFirst({
        where: {
          email: token.email,
        },
      });

      if (!user) {
        try {
          const newUser = await prismadb.users.create({
            data: {
              email: token.email,
              name: token.name,
              avatar: token.picture,
              is_admin: false,
              is_account_admin: false,
              lastLoginAt: new Date(),
              userStatus:
                process.env.NEXT_PUBLIC_APP_URL === "https://demo.nextcrm.io"
                  ? "ACTIVE"
                  : "PENDING",
            },
          });

          await newUserNotify(newUser);

          //Put new created user data in session
          session.user.id = newUser.id;
          session.user._id = newUser.id;
          session.user.name = newUser.name;
          session.user.email = newUser.email;
          session.user.avatar = newUser.avatar;
          session.user.image = newUser.avatar;
          session.user.isAdmin = false;
          session.user.mektekRole = null;
          session.user.phone = newUser.phone;
          session.user.phoneNormalized = newUser.phoneNormalized;
          session.user.userLanguage = newUser.userLanguage;
          session.user.userStatus = newUser.userStatus;
          session.user.lastLoginAt = newUser.lastLoginAt;
          return session;
        } catch (error) {
          return console.log(error);
        }
      } else {
        await prismadb.users.update({
          where: {
            id: user.id,
          },
          data: {
            lastLoginAt: new Date(),
          },
        });
        //User allready exist in localDB, put user data in session
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
      }

      //console.log(session, "session");
      return session;
    },
  },
};
