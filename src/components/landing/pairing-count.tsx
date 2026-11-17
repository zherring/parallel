interface Props {
  count: number;
}

/** A landing card's "N films together": white, as the films made together are on a pair's page. */
export function PairingCount({ count }: Props) {
  return (
    <p className="text-sm font-medium text-white">
      <span className="tabular-nums">{count}</span> {count === 1 ? "film" : "films"} together
    </p>
  );
}
