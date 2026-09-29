import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "TravelMate | AI Travel Planning Made Real",
    template: "%s | TravelMate",
  },
  description: "AI-powered travel planning, mathematical budget tracking, date-aware weather context, and itinerary management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
