import { PairingCard } from "@/components/landing/pairing-card";
import type { ExampleCardData } from "@/lib/example-cards";

export function Pairings({ cards }: { cards: ExampleCardData[] }) {
  return (
    <section aria-labelledby="pairings-heading" className="mx-auto w-full max-w-6xl px-4 py-12">
      <h2 id="pairings-heading" className="text-2xl font-semibold tracking-tight text-strong">
        Try a pairing
      </h2>
      <p className="mt-1.5 text-body">Start from a famous collaboration and keep going.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <PairingCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}
