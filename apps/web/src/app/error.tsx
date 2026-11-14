"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="public-message">
      <h1>Something interrupted this page.</h1>
      <p>
        Please try again. If the problem continues, return to your workspace.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}