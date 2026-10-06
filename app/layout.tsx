import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Brand typefaces (OFL), served from app/fonts. See DESIGN.md.
const publicSans = localFont({
  variable: "--font-public-sans",
  display: "swap",
  src: [
    { path: "./fonts/public-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/public-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/public-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

const newsreader = localFont({
  variable: "--font-newsreader",
  display: "swap",
  src: [
    { path: "./fonts/newsreader-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/newsreader-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/newsreader-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  display: "swap",
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "TA Grader",
  description: "AI highlights rubric matches in written exam answers. The grader decides every score.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#121719" },
  ],
};

// Applies the theme saved by components/ThemeToggle.tsx before first paint, so there is no flash.
// With no saved choice, the page follows the OS setting (see globals.css).
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("ta-grader-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${newsreader.variable} ${plexMono.variable} h-full antialiased`}
      // The script below sets data-theme before React hydrates, so the attribute differs from the server HTML.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
