import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Let it out!" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, userScalable: false };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
