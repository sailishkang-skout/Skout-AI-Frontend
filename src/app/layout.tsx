import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/lib/theme";

/** System stack — avoids next/font Google fetch failures in offline/restricted Docker builds. */
const bodyFontClass =
  "font-sans antialiased [font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif]";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || undefined;

export const metadata: Metadata = {
  title: "Skout AI",
  description: "Unified GTM operating system — search, activate, sequence, and close.",
  ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={bodyFontClass}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
