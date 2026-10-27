export interface FilmPanelProps {
  /** TMDB movie id to show; null keeps the panel closed. */
  filmId: number | null;
  /** People already on the timeline, so the panel can mark them and offer "add" for everyone else. */
  peopleInView: { id: number; name: string }[];
  onClose: () => void;
}

// Contract stub: the real drawer replaces this file and keeps the same props.
export function FilmPanel({ filmId }: FilmPanelProps) {
  return filmId === null ? null : <aside aria-label="Film details">Film {filmId}</aside>;
}
