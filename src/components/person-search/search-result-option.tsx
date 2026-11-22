import { PersonAvatar } from "@/components/person-avatar";
import { BACON_MODE_LABEL, BACON_MODE_PITCH } from "@/lib/bacon-mode";
import { filmCountLabel } from "@/lib/format";
import type { AddState } from "@/lib/people-nav";
import { departmentLabel } from "@/lib/person-labels";
import type { SearchResultOption as Result } from "@/lib/search-sections";

interface Props {
  option: Result;
  id: string;
  active: boolean;
  disabled: boolean;
  state: AddState;
  chipsMode: boolean;
  keyHint: boolean;
  /** In a mode: the muted line of a person's row, in place of their known-for titles ("3 films with Kevin Bacon"). */
  note?: string;
  onHighlight: () => void;
  onSelect: () => void;
}

/** One row shared by the flat keyboard list and its visible, labelled sections. */
export function SearchResultOption({ option, id, active, disabled, state, chipsMode, keyHint, note, onHighlight, onSelect }: Props) {
  const pairing = "href" in option;
  const mode = "mode" in option;
  // A person who cannot be added: already there, no room left, or (in a mode) not someone the mode lets in.
  const dimmed = !pairing && !mode && disabled && (state !== "can-add" || note !== undefined);
  const department = !pairing && !mode ? departmentLabel(option.knownFor) : null;

  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      aria-disabled={disabled || undefined}
      onMouseMove={() => {
        if (!disabled && !active) onHighlight();
      }}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={`flex items-start gap-3 px-3 py-2.5 ${disabled ? "cursor-default" : "cursor-pointer"} ${active ? "bg-border shadow-[inset_3px_0_0_0_var(--green)]" : ""}`}
    >
      {mode ? (
        <>
          <span aria-hidden="true" className="shrink-0 rounded-full ring-2 ring-accent-orange">
            <PersonAvatar name={option.person.name} profilePath={option.person.profilePath} size={40} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-accent-orange">{BACON_MODE_LABEL}</span>
            <span className="line-clamp-2 text-xs leading-snug text-muted">{BACON_MODE_PITCH}</span>
          </span>
        </>
      ) : pairing ? (
        <>
          <span aria-hidden="true" className="relative size-10 shrink-0">
            {option.people.slice(0, 2).map((person, portrait) => (
              <span key={person.id} className={`absolute ${portrait === 0 ? "left-0 top-0" : "bottom-0 right-0"} rounded-full ring-2 ring-surface`}>
                <PersonAvatar name={person.name} profilePath={person.profilePath} size={28} />
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-strong">{option.people.map((person) => person.name).join(" × ")}</span>
            <span className="block text-xs text-body">{filmCountLabel(option.sharedCount)} together</span>
            <span className="line-clamp-2 text-xs leading-snug text-muted">{option.blurb}</span>
          </span>
        </>
      ) : (
        <>
          <PersonAvatar name={option.name} profilePath={option.profilePath} size={40} className={dimmed ? "opacity-60" : undefined} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={`truncate font-medium ${dimmed ? "text-strong/60" : "text-strong"}`}>{option.name}</span>
              {state === "in-view" && (
                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-xs text-body">
                  {chipsMode ? "Added" : "In timeline"}
                </span>
              )}
            </span>
            {/* Keep the role and Added badge readable even when the photo/name are dimmed. */}
            <span className="line-clamp-2 text-xs leading-snug text-muted">
              {department && <span className="text-body">{department}</span>}
              {department && (note !== undefined || option.knownForTitles.length > 0) && " · "}
              {note ?? option.knownForTitles.join(", ")}
            </span>
          </span>
        </>
      )}
      {keyHint && (
        <kbd aria-hidden="true" className="mt-0.5 hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted pointer-fine:inline-block">
          Enter
        </kbd>
      )}
    </li>
  );
}
