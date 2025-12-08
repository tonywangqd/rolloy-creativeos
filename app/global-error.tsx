"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: '4rem', margin: 0, color: '#666' }}>500</h1>
          <h2 style={{ marginTop: '1rem' }}>Something went wrong</h2>
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
