import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="status-page">
      <div className="status-card">
        <span className="status-card__icon" aria-hidden="true">
          <Compass />
        </span>
        <p className="eyebrow">404 · Off the map</p>
        <h1>This page does not exist.</h1>
        <p>
          The address may be mistyped, or the page may have moved. Nothing was changed in your workspace.
        </p>
        <div className="status-card__actions">
          <Link href="/" className="btn btn--primary">
            <ArrowLeft aria-hidden="true" />
            Go to overview
          </Link>
          <Link href="/sales" className="btn btn--secondary">
            Open register
          </Link>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          Velora · Point of sale
        </p>
      </div>
    </main>
  );
}
