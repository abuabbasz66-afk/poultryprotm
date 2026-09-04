import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/poultrypro-logo.png.asset.json";

/** Slim public header for Academy pages, matching the landing brand. */
export function AcademyPublicHeader() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoAsset.url} alt="PoultryPro" className="h-8 w-8 rounded-lg object-contain" />
          <span className="font-display text-lg font-semibold">PoultryPro</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/academy" className="rounded-full px-3 py-2 font-medium hover:bg-secondary">
            Academy
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-[color:var(--forest)] px-4 py-2 font-semibold text-primary-foreground transition hover:brightness-110"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
