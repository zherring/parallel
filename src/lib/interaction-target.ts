/** Controls keep their native activation; pointer panning and Space navigation share this boundary. */
export const INTERACTIVE_SELECTOR = [
  "a[href]", "button", "input", "select", "textarea", "summary", "label",
  "[role='button']", "[role='link']", "[role='scrollbar']", "[role='tab']", "[role='slider']",
  "[contenteditable]:not([contenteditable='false'])", "[data-film]",
].join(",");

const OVERLAY_ROLES = ["dialog", "alertdialog"];
export const OVERLAY_SELECTOR = [
  "dialog", ...OVERLAY_ROLES.map((role) => `[role='${role}']`), "[aria-modal='true']", "[popover]",
].join(",");

/** Attribute-only so the landing hero's pure target reader can use the same overlay definition. */
export function isOverlayElement(element: {
  tagName: string;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
}): boolean {
  const role = element.getAttribute("role")?.trim().toLowerCase().split(/\s+/)[0] ?? "";
  return element.tagName.toLowerCase() === "dialog" || OVERLAY_ROLES.includes(role)
    || element.getAttribute("aria-modal") === "true" || element.hasAttribute("popover");
}
