export interface PersonSearchProps {
  /** People already on the timeline. Picking a result appends to them (max 4 total). */
  peopleInView?: { id: number; name: string }[];
  size?: "hero" | "compact";
  autoFocus?: boolean;
}

// Contract stub: the real combobox replaces this file and keeps the same props.
export function PersonSearch({ size = "compact" }: PersonSearchProps) {
  return <div data-size={size}>Search people</div>;
}
