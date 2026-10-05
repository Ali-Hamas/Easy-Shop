import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page">
      <h1>That page isn’t here</h1>
      <p className="muted">Return to your workspace to continue.</p>
      <Link
        href="/dashboard"
        className="button button-primary"
        style={{ marginTop: 24 }}
      >
        Back to dashboard
      </Link>
    </main>
  );
}
