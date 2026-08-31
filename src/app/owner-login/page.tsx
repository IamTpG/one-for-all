"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { loginAction, type LoginState } from "../actions/owner";
import styles from "./OwnerLogin.module.css";

const initialState: LoginState = { error: false };

export default function OwnerLoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const router = useRouter();

  function handleBack() {
    // Same reasoning as the article page's back button: reuse browser
    // history when possible so the feed's scroll/pagination state survives,
    // only falling back to a fresh navigation if there's nowhere to go back
    // to (e.g. this page was opened directly).
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <main className={styles.page}>
      <button type="button" onClick={handleBack} className={styles.backLink}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.backIcon}>
          <path d="M15 18 L9 12 L15 6" />
        </svg>
        <span className="mono">Wire</span>
      </button>
      <form className={styles.card} action={formAction}>
        <h1 className={`${styles.title} display`}>Owner sign-in</h1>
        <input
          type="password"
          name="secret"
          placeholder="Secret"
          autoFocus
          className={styles.input}
        />
        {state.error && <p className={styles.error}>Incorrect secret.</p>}
        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
