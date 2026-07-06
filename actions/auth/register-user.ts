"use server";
import { headers } from "next/headers";
import { prismadb } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { newUserNotify } from "@/lib/new-user-notify";
import { Language } from "@prisma/client";
import {
  buildPhoneAccountEmail,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from "@/lib/phone";
import { boundedText, MAX_NAME_LEN } from "@/lib/mektek/sanitize";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Public registration writes a users row (+ bcrypt hash) per call. Throttle by IP
// to blunt scripted account-creation floods.
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;

export const registerUser = async (data: {
  name: string;
  username: string;
  email: string;
  language: string;
  password: string;
  confirmPassword: string;
}) => {
  const { name, username, email, language, password, confirmPassword } = data;

  if (!name || !email || !language || !password || !confirmPassword) {
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!email) missingFields.push("email");
    if (!language) missingFields.push("language");
    if (!password) missingFields.push("password");
    if (!confirmPassword) missingFields.push("confirmPassword");
    return { error: `Missing required fields: ${missingFields.join(", ")}` };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const ip = getClientIp(await headers());
  if (!checkRateLimit(`register-user:${ip}`, REGISTER_LIMIT, REGISTER_WINDOW_MS).ok) {
    return { error: "Too many requests. Please try again later." };
  }

  const checkexisting = await prismadb.users.findFirst({
    where: { email },
  });

  if (checkexisting) {
    return { error: "User already exists" };
  }

  try {
    const user = await prismadb.users.create({
      data: {
        name,
        username,
        avatar: "",
        account_name: "",
        is_account_admin: false,
        is_admin: false,
        email,
        userLanguage: language as Language,
        userStatus:
          process.env.NEXT_PUBLIC_APP_URL === "https://demo.nextcrm.io"
            ? "ACTIVE"
            : "PENDING",
        password: await hash(password, 12),
      },
    });

    // Notify admins about the new pending user. Admins are bootstrapped
    // through the backend script, never through public registration.
    newUserNotify(user);

    return { data: user };
  } catch (error) {
    console.error("[REGISTER_USER]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { error: `Registration failed: ${errorMessage}` };
  }
};

export const registerCustomerUser = async (data: {
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
}) => {
  const name = boundedText(data?.name, MAX_NAME_LEN);
  const phone = String(data?.phone ?? "").trim();
  const password = String(data?.password ?? "");
  const confirmPassword = String(data?.confirmPassword ?? "");
  const phoneNormalized = normalizePhoneNumber(phone);

  if (!name || !phone || !password || !confirmPassword) {
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!phone) missingFields.push("phone");
    if (!password) missingFields.push("password");
    if (!confirmPassword) missingFields.push("confirmPassword");
    return { error: `Missing required fields: ${missingFields.join(", ")}` };
  }

  if (!isValidPhoneNumber(phone)) {
    return { error: "Phone number is invalid" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const ip = getClientIp(await headers());
  const ipLimit = checkRateLimit(
    `register-customer:ip:${ip}`,
    REGISTER_LIMIT,
    REGISTER_WINDOW_MS
  );
  const phoneLimit = checkRateLimit(
    `register-customer:phone:${phoneNormalized}`,
    REGISTER_LIMIT,
    REGISTER_WINDOW_MS
  );
  if (!ipLimit.ok || !phoneLimit.ok) {
    return { error: "Too many requests. Please try again later." };
  }

  const email = buildPhoneAccountEmail(phoneNormalized);

  try {
    const existingUser = await prismadb.users.findFirst({
      where: {
        OR: [{ phoneNormalized }, { email }],
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return { error: "Phone number already has an account" };
    }

    const user = await prismadb.$transaction(async (tx) => {
      const createdUser = await tx.users.create({
        data: {
          name,
          username: name,
          avatar: "",
          account_name: "Mektek Customer",
          is_account_admin: false,
          is_admin: false,
          email,
          phone,
          phoneNormalized,
          userLanguage: "en",
          userStatus: "ACTIVE",
          password: await hash(password, 12),
        },
      });

      await tx.catalogCustomer.upsert({
        where: {
          phoneNormalized,
        },
        update: {
          username: name,
          phone,
          customerType: "STANDARD",
          userId: createdUser.id,
        },
        create: {
          username: name,
          phone,
          phoneNormalized,
          customerType: "STANDARD",
          userId: createdUser.id,
        },
      });

      return createdUser;
    });

    return { data: user };
  } catch (error) {
    console.error("[REGISTER_CUSTOMER_USER]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { error: `Customer registration failed: ${errorMessage}` };
  }
};
