import { ClippingCard } from "@/components/landing/clipping-card";
import { newsreader } from "@/components/newsreader";
import type { ClippingCardData } from "@/lib/clipping-cards";

/**
 * The landing page's Clippings tab: every pair with clippings, alphabetical (see `buildClippingCards`), each linking
 * to its Clippings tab. Rendered on the server like the genre tabs; the quotes never reach the client as data. The
 * serif is only requested once the tab is shown (its panel is hidden until then).
 */
export function ClippingsList({ cards }: { cards: ClippingCardData[] }) {
  return (
    <div className={newsreader.variable}>
      <p className="mb-4 text-sm text-muted">Artists on each other, in their own words.</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <ClippingCard card={card} />
          </li>
        ))}
      </ul>
    </div>
  );
}
