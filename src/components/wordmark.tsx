export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-strong ${className ?? ""}`}>
      Para<span className="text-accent-green">ll</span>el
    </span>
  );
}
