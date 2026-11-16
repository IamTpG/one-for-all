import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Lexend, Plus_Jakarta_Sans, IBM_Plex_Mono, Mona_Sans } from "next/font/google";
import { LANGUAGE_COOKIE, parseLanguageCookie } from "@/lib/language";
import { LanguageProvider } from "./LanguageProvider";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
});

// The home feed's single face (big newsroom headlines + UI). Other pages
// keep their faces until they move to the new design.
const monaSans = Mona_Sans({
  variable: "--font-news",
  subsets: ["latin", "vietnamese"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "OneForAll",
  description: "Tin AI cho dev: công cụ, cách làm việc với agent và nghề nghiệp, tóm tắt bằng tiếng Việt.",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('wire-theme');
    if (stored) document.documentElement.setAttribute('data-theme', stored);
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const initialLanguage = parseLanguageCookie(cookieStore.get(LANGUAGE_COOKIE)?.value);

  return (
    <html
      lang={initialLanguage}
      className={`${lexend.variable} ${plusJakartaSans.variable} ${ibmPlexMono.variable} ${monaSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <LanguageProvider initialLanguage={initialLanguage}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
