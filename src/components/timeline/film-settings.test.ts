import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MINOR_TOGGLE_LABEL } from "@/lib/roles";
import { FilmSettings, FilmSettingsOptions } from "./film-settings";

const props = {
  showAll: false,
  includeMinor: false,
  onShowAllChange: () => {},
  onIncludeMinorChange: () => {},
  posterHintId: "poster-hint",
};

describe("FilmSettings", () => {
  it("starts as a muted gear with a closed, accessible pop-up", () => {
    const html = renderToStaticMarkup(createElement(FilmSettings, props));
    expect(html).toContain("lucide-settings");
    expect(html).toContain('aria-label="Film settings"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
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

  it("only updates the changed preference", () => {
    const onShowAllChange = vi.fn();
    const onIncludeMinorChange = vi.fn();
    const options = FilmSettingsOptions({ ...props, onShowAllChange, onIncludeMinorChange });
    const [posters, minor] = options.props.children;
    posters.props.children[0].props.onChange({ target: { checked: true } });
    expect(onShowAllChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(onIncludeMinorChange).not.toHaveBeenCalled();
    minor.props.children[0].props.onChange({ target: { checked: true } });
    expect(onIncludeMinorChange).toHaveBeenCalledExactlyOnceWith(true);
  });
});
