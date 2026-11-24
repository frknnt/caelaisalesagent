"use client";

interface GlobalErrorProps {
  error: unknown;
  retry: () => void;
}

/** Replaces the root layout, so it brings its own document and styles. */
export default function GlobalError({ retry }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: "5rem 1.125rem",
          color: "#0b0c0f",
          background: "#ffffff",
          font: "1rem/1.6 system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <title>Something went wrong</title>
        <main role="alert">
          <h1 style={{ fontSize: "2.125rem", fontWeight: 400, margin: 0 }}>
            Something went wrong
          </h1>
          <p>The page could not be loaded. Try again in a moment.</p>
          <button
            type="button"
            onClick={retry}
            style={{
              minHeight: "3.5rem",
              padding: "0 2rem",
              border: 0,
              borderRadius: "999px",
              color: "#ffffff",
              background: "#0b0c0f",
              font: "inherit",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  );
}
