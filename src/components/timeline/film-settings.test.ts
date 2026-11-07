import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MINOR_TOGGLE_LABEL } from "@/lib/roles";
import { FilmSettings, FilmSettingsOptions } from "./film-settings";

const props = {
  showAll: false,
  includeMinor: false,
  onShowAllChange: () => {},
  onIncludeMinorChange: () => {},
  message: "Showing 43 films together",
  posterHintId: "poster-hint",
};

describe("FilmSettings", () => {
  it("starts as a muted gear with a closed, accessible pop-up", () => {
    const html = renderToStaticMarkup(createElement(FilmSettings, props));
    expect(html).toContain("lucide-settings");
    expect(html).toContain('aria-label="Film settings"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    // Nothing to control while the pop-up is not in the DOM.
    expect(html).not.toContain("aria-controls");
    expect(html).not.toContain('type="checkbox"');
  });

  it("contains exactly the two requested checkbox preferences", () => {
    const html = renderToStaticMarkup(createElement(FilmSettingsOptions, props));
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).toContain("Show all films");
    expect(html).toContain(MINOR_TOGGLE_LABEL);
    expect(html).toContain('aria-describedby="poster-hint"');
  });

  it.each([
    [false, false, 0],
    [true, false, 1],
    [false, true, 1],
    [true, true, 2],
  ] as const)("reflects independent preferences showAll=%s, includeMinor=%s", (showAll, includeMinor, checked) => {
    const html = renderToStaticMarkup(createElement(FilmSettingsOptions, { ...props, showAll, includeMinor }));
    expect(html.match(/checked=""/g) ?? []).toHaveLength(checked);
    expect(html).not.toContain('disabled=""');
  });

  it("keeps an empty polite status region ready for the credits toggle's result", () => {
    const html = renderToStaticMarkup(createElement(FilmSettingsOptions, props));
    expect(html).toMatch(/<p role="status" aria-live="polite"[^>]*><\/p>/);
    // Nothing is said until the minor-credits checkbox changes.
    expect(html).not.toContain(props.message);
  });

  it("leaves the status region out of the closed gear", () => {
    expect(renderToStaticMarkup(createElement(FilmSettings, props))).not.toContain('role="status"');
  });
});
