/** The green "ll" of the wordmark: its two parallel strokes. */
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
