import { Link } from "react-router-dom";

export function NotFoundPage(): JSX.Element {
  return (
    <main className="page-state">
      <h1>Page not found</h1>
      <p>The requested route does not exist.</p>
      <Link to="/module/pilot-vertragsrecht">Go to pilot module</Link>
    </main>
  );
}
