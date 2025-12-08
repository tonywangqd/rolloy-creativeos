"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">500</h1>
      <h2 className="mt-4 text-xl font-semibold">Something went wrong</h2>
      <p className="mt-2 text-muted-foreground">
        An unexpected error occurred.
      </p>
      <button
        onClick={reset}
        className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
