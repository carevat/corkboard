import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/special-elite/400.css";
import "@fontsource/kalam/400.css";
import "@fontsource/kalam/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE BLACK ARCHIVE — Every clue has a story",
  description: "A local-first cinematic corkboard for assembling evidence, connecting clues, and following the story behind a mystery.",
  applicationName: "The Black Archive",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
