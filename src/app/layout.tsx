import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppToaster } from "@/components/AppToaster";
import { AuthGate } from "@/components/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Emp Track",
  description: "Emp Track workspace for employees and admins",
  icons: {
    icon: "/logo3.png",
    apple: "/logo3.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <AppToaster />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
