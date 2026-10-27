const STEPS = [
  {
    title: "Search",
    text: "Find any actor, director, writer, cinematographer or composer.",
  },
  {
    title: "Add a collaborator",
    text: "Put up to four people side by side, one lane each.",
  },
  {
    title: "See what they made together",
    text: "Shared films light up across the timelines.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="mx-auto w-full max-w-6xl border-t border-border px-4 py-12"
    >
      <h2 id="how-heading" className="text-2xl font-semibold tracking-tight text-strong">
        How it works
      </h2>
      <ol className="mt-6 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-accent-green"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="font-semibold text-strong">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-body">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
