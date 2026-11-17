"use client";

import { Suspense } from "react";
import { usePortraitMode } from "@/components/use-portrait-mode";

interface Props {
  count: number;
}

function Count({ count, className }: Props & { className: string }) {
  return (
    <p className={className}>
      <span className="tabular-nums">{count}</span> {count === 1 ? "film" : "films"} together
    </p>
  );
}

const GREEN = "text-sm font-medium text-accent-green";

/**
 * A landing card's "N films together": green, as it has always been. Spike (zherring/spike-portraits): white behind `?portrait=on|color`, as the films made
 * together are with the pair's palette. The flag is read from the address, so the line sits in its own Suspense boundary, whose fallback is the green one:
 * the landing page renders as it did on the server and, without the flag, in the browser too (as `PairingFace`).
 */
export function PairingCount({ count }: Props) {
  return (
    <Suspense fallback={<Count count={count} className={GREEN} />}>
      <FlaggedCount count={count} />
    </Suspense>
  );
}

function FlaggedCount({ count }: Props) {
  const portrait = usePortraitMode() !== null;
  return <Count count={count} className={portrait ? "text-sm font-medium text-white" : GREEN} />;
}
