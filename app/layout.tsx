import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Newsreader } from "next/font/google";
import { InlineScript } from "./inline-script";
import { Nav } from "./nav";
import "./globals.css";

// Inter for text, Newsreader (serif) for headlines — same as OutNYC and its admin
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OutNYC Prompt Chains",
  description: "Build and run the prompt chains that write OutNYC plans",
};

// Runs before the first paint: applies the saved theme (or the device's) so a dark page
// never flashes light. Same logic as apply() in theme-switch.tsx.
const themeScript = `(function(){try{var c=localStorage.getItem("theme");var d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script above changes data-theme before React loads
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${newsreader.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* The menu reads the login cookie, so it fills in when the visitor arrives */}
        <Suspense fallback={null}>
          <Nav />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
