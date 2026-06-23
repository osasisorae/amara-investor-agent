import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-futurex-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-futurex-line">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Image
            src="/futurex-wordmark-v3a.png"
            alt="FutureX"
            width={120}
            height={28}
            className="brightness-0 invert opacity-90"
          />
          <Link
            href="/admin"
            className="text-sm text-futurex-muted hover:text-futurex-gold transition"
          >
            Admin Login
          </Link>
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
            Your AI-Powered
            <br />
            <span className="text-futurex-gold">Investor Onboarding</span>
            <br />
            Agent
          </h1>

          {/* Subheading */}
          <p className="text-lg text-futurex-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            Amara qualifies investors, serves deal room materials, triages KYC,
            and captures a complete audit trail — all while enforcing
            human-in-the-loop compliance checkpoints required by Nigerian law.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/chat"
              className="bg-futurex-gold text-futurex-bg font-semibold px-8 py-3 rounded-lg hover:opacity-90 transition"
            >
              Start as Investor →
            </Link>
            <Link
              href="/admin"
              className="border border-futurex-line text-futurex-muted font-semibold px-8 py-3 rounded-lg hover:border-futurex-gold hover:text-futurex-gold transition"
            >
              Admin Dashboard
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-1 bg-futurex-line border border-futurex-line mt-16 max-w-2xl mx-auto">
            <div className="bg-futurex-surface2 p-6">
              <div className="font-mono text-3xl text-futurex-ink">8</div>
              <div className="text-xs text-futurex-muted uppercase tracking-wider mt-1">
                Stage Pipeline
              </div>
            </div>
            <div className="bg-futurex-surface2 p-6">
              <div className="font-mono text-3xl text-futurex-ink">2</div>
              <div className="text-xs text-futurex-muted uppercase tracking-wider mt-1">
                Human Checkpoints
              </div>
            </div>
            <div className="bg-futurex-surface2 p-6">
              <div className="font-mono text-3xl text-futurex-gold">100%</div>
              <div className="text-xs text-futurex-muted uppercase tracking-wider mt-1">
                Audit Trail
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-futurex-line">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between text-sm text-futurex-muted">
          <div>
            <strong className="text-futurex-ink">FutureX</strong> · Qwen Cloud
            Hackathon 2026
          </div>
          <div>Built by Osas Isorae</div>
        </div>
      </footer>
    </div>
  );
}
