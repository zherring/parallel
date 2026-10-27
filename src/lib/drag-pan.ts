/**
 * Pure decisions for click-and-drag panning of the timeline's scroller: may a press start a
 * pan, has the pointer moved far enough for it to count as a drag, and where the scroller goes
 * for a given pointer movement. Nothing here touches the DOM; `use-drag-pan.ts` reads the
 * events and the scroller and applies the answers.
 */

/** Pointer travel (px) before a press on empty space turns into a drag; a click that wobbles less stays a click. */
export const DRAG_THRESHOLD = 4;

/** What the pointer went down on, as seen from the scroller. */
export interface PanTarget {
  /** An element with a job of its own: a poster card or node, a button, a link, an input, the "Show all" control, a legend chip. */
  interactive: boolean;
  /** Inside a sticky lane header, where text selection and the buttons must keep working. */
  inHeader: boolean;
  /** On the scroller's own scrollbar, which keeps dragging natively. */
  onScrollbar: boolean;
}

export interface PanPress {
  /** "mouse", "pen" or "touch". */
  pointerType: string;
  /** `PointerEvent.button`: 0 is the primary button (or pen contact). */
  button: number;
  /** The first pointer of its type; a second finger or device never pans. */
  isPrimary: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: PanTarget;
}

/**
 * Whether a pointer-down may start a pan: a mouse or pen, its primary button without Ctrl, Meta or Alt (so
 * context menus and shortcuts behave), on the empty surface: not on an interactive element, a lane header
 * or the scrollbar. Touch is never ours: the browser's own scrolling stays in charge of it.
 */
export function canStartPan(press: PanPress): boolean {
  if (press.pointerType === "touch") return false;
  if (!press.isPrimary || press.button !== 0) return false;
  if (press.ctrlKey || press.metaKey || press.altKey) return false;
  const { interactive, inHeader, onScrollbar } = press.target;
  return !interactive && !inHeader && !onScrollbar;
}

/** Whether the pointer has travelled `threshold` px or more, in any direction, from where it went down. */
export function movedPastThreshold(dx: number, dy: number, threshold: number = DRAG_THRESHOLD): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

export interface ScrollPoint {
  left: number;
  top: number;
}

export interface ScrollBounds {
  /** The furthest the scroller goes sideways (never negative). */
  maxLeft: number;
  /** The furthest it goes down (never negative); 0 when its content is not taller than the scroller. */
  maxTop: number;
}

/** The measurements of a scroll container that decide how far it scrolls. */
export interface ScrollMetrics {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

export function scrollBounds({ scrollWidth, clientWidth, scrollHeight, clientHeight }: ScrollMetrics): ScrollBounds {
  return {
    maxLeft: Math.max(0, scrollWidth - clientWidth),
    maxTop: Math.max(0, scrollHeight - clientHeight),
  };
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, max), Math.max(0, value));
}

/**
 * Where the scroller goes when the pointer has moved by (`dx`, `dy`) since a drag began at `start`.
 * Grab semantics: the content follows the pointer, so moving the pointer right scrolls left. It is
 * always worked out from where the drag began, never added up step by step, so that dragging past an end and
 * coming back moves the content as soon as the pointer is back where it was. Each axis is clamped to the scroll
 * bounds; one that cannot scroll stays put.
 */
export function nextPanScroll(start: ScrollPoint, dx: number, dy: number, bounds: ScrollBounds): ScrollPoint {
  return {
    left: clamp(start.left - dx, bounds.maxLeft),
    top: clamp(start.top - dy, bounds.maxTop),
  };
}

/** The box of the scroller, in the same coordinates as the pointer: its border box and the size of its padding box. */
export interface ScrollerBox {
  left: number;
  top: number;
  /** Width of the left border (or the scrollbar when it sits on the left). */
  clientLeft: number;
  clientTop: number;
  /** Width and height of the padding box without the scrollbars. */
  clientWidth: number;
  clientHeight: number;
}

/**
 * Whether a press at (`x`, `y`) is on the scroller's scrollbars: right of or below its client area.
 * An overlay scrollbar (no layout width) never reports true.
 */
export function pressOnScrollbar(x: number, y: number, box: ScrollerBox): boolean {
  return x - box.left - box.clientLeft >= box.clientWidth || y - box.top - box.clientTop >= box.clientHeight;
}
