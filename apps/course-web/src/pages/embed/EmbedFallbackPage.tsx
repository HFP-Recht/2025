import { Link, useSearchParams } from "react-router-dom";

interface EmbedFallbackPageProps {
  moduleId?: string;
  reason?: string;
}

export function EmbedFallbackPage({ moduleId, reason }: EmbedFallbackPageProps): JSX.Element {
  const [searchParams] = useSearchParams();
  const effectiveModuleId = moduleId ?? searchParams.get("moduleId") ?? "";
  const effectiveReason = reason ?? searchParams.get("reason") ?? "unknown";

  const moduleRoute = effectiveModuleId ? `/module/${effectiveModuleId}` : "/";

  return (
    <main className="embed-fallback-page">
      <section className="embed-fallback-card">
        <h1>Embed fallback</h1>
        <p>
          The embedded module could not be rendered in this context. You can open the same module in
          direct mode and continue from there.
        </p>
        <p className="embed-fallback-meta">
          Module: <strong>{effectiveModuleId || "unknown"}</strong> - Reason: <strong>{effectiveReason}</strong>
        </p>

        <div className="embed-fallback-actions">
          <Link className="primary-btn" to={moduleRoute}>
            Open module directly
          </Link>
          <Link className="secondary-btn" to="/login">
            Go to login
          </Link>
        </div>
      </section>
    </main>
  );
}
