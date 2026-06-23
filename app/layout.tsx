import type { Metadata } from "next";
import { FeedbackProvider } from '@/components/feedback-provider';
import "./globals.css";

export const metadata: Metadata = {
  title: "Amara | FutureX Investor Onboarding",
  description: "AI-powered investor onboarding for FutureX real estate syndication. Guiding Nigerian diaspora investors through qualification, due diligence, and KYC.",
  keywords: ["real estate", "investment", "nigeria", "diaspora", "futurex", "amara"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <FeedbackProvider>{children}</FeedbackProvider>
      </body>
    </html>
  );
}
