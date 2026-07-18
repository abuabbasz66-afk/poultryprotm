import { WHATSAPP_URL } from "./whatsapp-widget";

const BULLETS = [
  "Creating a Farm Account",
  "Choosing the right subscription plan",
  "Booking a Live Demo",
  "Technical Support",
  "Partnership Opportunities",
  "Investment Enquiries",
];

export default function WhatsAppPanel({ onClose, onCtaClick }: { onClose: () => void; onCtaClick: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Chat with PoultryPro"
      className="w-[min(92vw,340px)] overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="relative bg-[color:var(--forest,#0F5132)] px-4 py-4 text-white">
        <button
          onClick={onClose}
          aria-label="Minimize"
          className="absolute right-2 top-2 h-7 w-7 rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
        <div className="flex items-center gap-2 text-base font-semibold !text-white">
          <span>💬</span> Chat with PoultryPro
        </div>
        <div className="mt-0.5 text-xs text-white/80">We typically reply within a few minutes.</div>
      </div>
      <div className="px-4 py-4 text-sm text-[color:var(--ink,#0b1b13)]">
        <p className="font-medium">👋 Hello!</p>
        <p className="mt-1 text-[color:var(--ink,#0b1b13)]/80">
          Thank you for visiting <span className="font-semibold">PoultryPro™</span>. Need help with:
        </p>
        <ul className="mt-2 space-y-1.5">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--gold,#c9a24b)]" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[color:var(--ink,#0b1b13)]/70">Our team is ready to assist you.</p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCtaClick}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow hover:brightness-105 transition"
        >
          Start Chat on WhatsApp
        </a>
        <p className="mt-2 text-center text-[11px] text-[color:var(--ink,#0b1b13)]/50">+234 806 530 1413</p>
      </div>
    </div>
  );
}
