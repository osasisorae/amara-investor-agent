import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-futurex-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-futurex-line bg-futurex-surface">
        <div className="mx-auto w-full max-w-4xl px-6 py-4">
          <Image
            src="/amara-wordmark-cropped.jpeg"
            alt="Amara"
            width={154}
            height={48}
            className="h-auto w-[132px] sm:w-[154px]"
          />
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          {/* Amara Badge */}
          <div className="inline-block bg-futurex-gold-soft border border-futurex-gold-border text-futurex-gold text-xs font-semibold tracking-wider uppercase px-4 py-2 rounded-full mb-6">
            Meet Amara
          </div>

          {/* Main Heading */}
          <h1 className="font-serif text-5xl md:text-6xl text-futurex-ink mb-6 leading-tight">
            The investor onboarding agent for{" "}
            <span className="text-futurex-gold">FutureX</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg text-futurex-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            Amara guides Nigerian diaspora investors through the full journey — from first conversation to signed agreement — while keeping humans in control at every critical decision point.
          </p>

          {/* CTA Button */}
          <div className="flex justify-center">
            <Link
              href="/chat"
              className="bg-futurex-gold text-futurex-bg font-semibold px-8 py-3 rounded-lg hover:opacity-90 transition"
            >
              Start as Investor →
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-futurex-line">
        <div className="max-w-7xl mx-auto px-6 py-5 text-center text-sm text-futurex-muted">
          <div className="mb-2">
            <strong className="text-futurex-ink">Built on Qwen Cloud</strong> · FutureX Nexus Development Limited
          </div>
          <div>Qwen Cloud Hackathon 2026 · Built by Osas Isorae</div>
        </div>
      </footer>
    </div>
  );
}
