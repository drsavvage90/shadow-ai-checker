import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shadow AI Checker by Vault Systems",
  description:
    "A free 10-minute self-assessment that helps small regulated businesses see which AI tools staff use and where the risk is. Answers stay in the browser.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        {children}
        <noscript>
          <p className="noscript">
            Shadow AI Checker runs in this browser. Enable JavaScript to take the assessment. Answers are not uploaded.
          </p>
        </noscript>
      </body>
    </html>
  );
}
