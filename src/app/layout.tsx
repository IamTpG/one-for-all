import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Be_Vietnam_Pro, Noto_Sans, IBM_Plex_Mono } from "next/font/google";
import { LANGUAGE_COOKIE, parseLanguageCookie } from "@/lib/language";
import { LanguageProvider } from "./LanguageProvider";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
});

const notoSans = Noto_Sans({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Wire",
  description: "Personal aggregator for dev/AI blogs, Hacker News, and GitHub activity",
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
      lang="en"
      className={`${beVietnamPro.variable} ${notoSans.variable} ${ibmPlexMono.variable}`}
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
