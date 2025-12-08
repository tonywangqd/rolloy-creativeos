import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <h2 className="mt-4 text-xl font-semibold">Page Not Found</h2>
      <p className="mt-2 text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
