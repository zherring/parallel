/**
 * Where the landing hero collage's pieces sit, in the stage's own coordinates: a plane 380 wide
 * that hero-collage.tsx scales to the room there is. Plain numbers, so the centring of the poster
 * row (which is the only part that changes from one scene to the next) can be tested.
 */

export const STAGE = {
  width: 380,
  height: 428,
  person: [
    { left: 6, top: 4, tilt: -7 },
    { left: 168, top: 26, tilt: 4 },
  ],
  personSize: { width: 190, height: 250 },
  posterSize: { width: 76, height: 114 },
} as const;

/** The timeline line runs through the middle of the posters. */
export const LINE_Y = 357;

/** The middle of the two portraits, top to bottom: where the Previous and Next buttons are centred. */
export const PERSON_MID_Y =
  (STAGE.person[0].top + STAGE.person[1].top + STAGE.personSize.height) / 2;

/** The most posters a scene shows (the same number as examples.ts's HERO_POSTER_COUNT). */
export const POSTER_SLOTS = 5;

/** The distance between the left edges of neighbouring posters: less than a width, so they overlap. */
const POSTER_STEP = 62;
/** How far the "+N more" label sits from the right end of the row, before its own padding. */
const MORE_GAP = 12;
/** Each poster turns a little more than the one before it; the jitter keeps the row from looking ruled. */
const TILT_STEP = 2.6;
const TILT_JITTER = [0.8, -0.6, 1.2, 0.4, -0.8];
/** How far each poster sits off the line, in stage pixels (positive is down). */
const DEAL_OFFSET = [3, -2, 1, -4, 2];

export const POSTER_TOP = LINE_Y - STAGE.posterSize.height / 2;

const rowWidth = (count: number) => (count - 1) * POSTER_STEP + STAGE.posterSize.width;
const rowLeft = (count: number) => (STAGE.width - rowWidth(count)) / 2;

/** Where the poster slots sit: the left edge of slot `slot` in a full row. */
export const posterSlotLeft = (slot: number) => rowLeft(POSTER_SLOTS) + slot * POSTER_STEP;

/** The left edge of the "+N more" label beside a full row. */
export const MORE_LEFT = rowLeft(POSTER_SLOTS) + rowWidth(POSTER_SLOTS) + MORE_GAP;

/**
 * Where the label goes on the narrowest phones, which have no room beside the row: its top centre,
 * directly under the row (the row is always centred, so this does not depend on its length).
 */
export const MORE_UNDER = { x: STAGE.width / 2, y: LINE_Y + STAGE.posterSize.height / 2 + 10 } as const;

/** How one card sits relative to its slot. A card keeps its place from arrival to departure. */
export interface Place {
  /** Stage pixels to the right of the slot. */
  dx: number;
  /** Stage pixels below the slot. */
  dy: number;
  /** Degrees, clockwise. */
  tilt: number;
}

export const NO_PLACE: Place = { dx: 0, dy: 0, tilt: 0 };

/**
 * The place of poster `slot` in a row of `count` posters. The slots are laid out for a full row;
 * a shorter one is shifted so it stays centred on the stage.
 */
export function posterPlace(slot: number, count: number): Place {
  return {
    dx: rowLeft(count) - rowLeft(POSTER_SLOTS),
    dy: DEAL_OFFSET[slot] ?? 0,
    tilt: (slot - (count - 1) / 2) * TILT_STEP + (TILT_JITTER[slot] ?? 0),
  };
}

/**
 * The place of the "+N more" label beside a row of `count` posters: it stays at the right end of
 * the row, which moves in by half a step for every poster missing. It never moves the row.
 */
export function moreLabelPlace(count: number): Place {
  return { ...NO_PLACE, dx: -(rowLeft(count) - rowLeft(POSTER_SLOTS)) };
}
