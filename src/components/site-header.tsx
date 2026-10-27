import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center px-4">
        <Link href="/" aria-label="Parallel home" className="no-underline">
          <Wordmark className="text-xl" />
        </Link>
      </div>
    </header>
  );
}
