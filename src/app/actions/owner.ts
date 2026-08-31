"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { computeOwnerToken, OWNER_COOKIE_NAME, verifySecret } from "@/lib/ownerAuth";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type LoginState = { error: boolean };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const candidate = formData.get("secret");
  if (typeof candidate !== "string" || !verifySecret(candidate)) {
    return { error: true };
  }

  const token = computeOwnerToken();
  if (!token) return { error: true }; // OWNER_SECRET unset — fail closed

  const cookieStore = await cookies();
  cookieStore.set(OWNER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OWNER_COOKIE_NAME);
  redirect("/");
}
