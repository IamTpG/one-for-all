"use client";

import { createContext, useContext, useState } from "react";
import type { Language } from "@/lib/language";

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
} | null>(null);

export function LanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: Language;
  children: React.ReactNode;
}) {
  // Seeded once from the server-read cookie (see layout.tsx) so server and
  // client HTML agree from the first paint — no mount-effect correction,
  // unlike ThemeToggle's localStorage read, since swapping displayed text
  // (unlike theme) can't be done with CSS alone and would otherwise flash.
  // Stays in sync afterward only because LanguageToggle updates this state
  // and the cookie together on click, not because of any re-sync from the
  // server on a later render.
  const [language, setLanguage] = useState<Language>(initialLanguage);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
