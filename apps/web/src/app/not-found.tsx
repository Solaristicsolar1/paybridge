import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="public-message">
      <h1>Page not found.</h1>
      <p>This page may have moved, or the link may be incomplete.</p>
      <Link className="button" href="/dashboard">
        Open your workspace
      </Link>
    </main>
  );
}