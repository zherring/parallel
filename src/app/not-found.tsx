import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-strong">Page not found</h1>
      <p className="mt-3">We couldn&apos;t find that page, or one of the people in it.</p>
      <Link href="/" className="mt-6 inline-block text-accent-green underline">
        Back to Parallel
      </Link>
    </section>
  );
}
