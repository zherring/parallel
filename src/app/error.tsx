"use client";

export default function Error({ retry }: { retry: () => void }) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-strong">TMDB is having a moment</h1>
      <p className="mt-3">We couldn&apos;t load film data just now. Give it another try.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 cursor-pointer rounded bg-accent-green px-4 py-2 font-semibold text-on-accent hover:bg-accent-green-hover"
      >
        Try again
      </button>
    </section>
  );
}
