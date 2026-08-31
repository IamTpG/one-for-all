export type Language = "en" | "vi";

export const LANGUAGE_COOKIE = "wire-lang";

export const NO_SUMMARY_MESSAGE = "No summary for this one yet.";
export const VI_NOT_READY_MESSAGE = "Vietnamese translation not ready yet.";

export type LocalizedText = { text: string | undefined; note: string | null };

// The single place that decides what to show for a piece of bilingual
// text: the Vietnamese version if it's selected and available, the
// English version with an explanatory note if Vietnamese is selected but
// not ready yet, or a "nothing yet" note if neither exists.
export function resolveLocalized(
  en: string | undefined,
  vi: string | undefined,
  language: Language
): LocalizedText {
  if (language === "vi") {
    if (vi) return { text: vi, note: null };
    if (en) return { text: en, note: VI_NOT_READY_MESSAGE };
    return { text: undefined, note: NO_SUMMARY_MESSAGE };
  }
  if (en) return { text: en, note: null };
  return { text: undefined, note: NO_SUMMARY_MESSAGE };
}

export function parseLanguageCookie(value: string | undefined): Language {
  return value === "vi" ? "vi" : "en";
}
