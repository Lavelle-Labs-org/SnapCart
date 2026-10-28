
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/env";
import "./globals.css";
import { LanguageProvider } from "../lib/i18n";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Snapcart | Order in a Snap",
  description: "Snapcart — Order in a snap. Lightning-fast, SMS-powered commerce and micro-merchants in Ethiopia.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.svg",
    apple: "/snapcart-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (!theme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                var cookies = document.cookie.split(';');
                for (var i = 0; i < cookies.length; i++) {
                  var parts = cookies[i].trim().split('=');
                  if (parts[0] === 'obs_locale' && (parts[1] === 'en' || parts[1] === 'am')) {
                    document.documentElement.lang = parts[1];
                  }
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
