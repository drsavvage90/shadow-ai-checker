import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shadow AI Checker by Vault Systems",
  description:
    "A free AI readiness check for small law firms, accountants, practices, and banks. It asks whether you are allowed to use AI, and whether staff will use the approved tool. Answers stay in the browser. Not legal advice.",
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
