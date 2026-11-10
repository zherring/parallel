/** The green "ll" of the wordmark: its two parallel strokes, and the mark on its own where there is no room for the name (see `WordmarkMark`). */
function GreenLl() {
  return <span className="text-accent-green">ll</span>;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-strong ${className ?? ""}`}>
      Para<GreenLl />el
    </span>
  );
}

/** The wordmark's mark alone, the green "ll", sized by `className` (the page bar's home circle). Decorative: whatever holds it is named. */
export function WordmarkMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`font-semibold leading-none tracking-tight ${className ?? ""}`}>
      <GreenLl />
    </span>
  );
}
