import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LayoutToggle, type Layout } from "./layout-toggle";

const render = (props: Partial<Parameters<typeof LayoutToggle>[0]> = {}) =>
  renderToStaticMarkup(createElement(LayoutToggle, { layout: "combined", several: true, onChange: () => {}, ...props }));

describe("LayoutToggle", () => {
  it("is one group of three icon buttons for several people: Focus, Combined and Lanes, in that order", () => {
    const html = render();
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Timeline layout"');
    expect(html.match(/<button\b/g)).toHaveLength(3);
    const labels = [...html.matchAll(/aria-label="([^"]+)" aria-pressed/g)].map((match) => match[1]);
    expect(labels).toEqual(["Focus view", "Combined timeline", "Separate lanes"]);
    for (const icon of ["lucide-focus", "lucide-layers", "lucide-rows-2"]) expect(html).toContain(icon);
  });

  it("gives every button a title and presses the current layout only", () => {
    for (const [layout, pressed] of [
      ["focus", [true, false, false]],
      ["combined", [false, true, false]],
      ["separate", [false, false, true]],
    ] as const) {
      const html = render({ layout });
      expect([...html.matchAll(/aria-pressed="(true|false)"/g)].map((match) => match[1] === "true")).toEqual(pressed);
      expect(html.match(/\btitle="/g)).toHaveLength(3);
    }
  });

  it("offers one person Focus and the flat Timeline: there is no choice of lanes", () => {
    const html = render({ several: false, layout: "combined" });
    expect(html.match(/<button\b/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Timeline"');
    expect(html).not.toContain("Separate lanes");
  });

  it("writes the words beside the icons only when asked to", () => {
    expect(render()).not.toMatch(/>Focus</);
    const labelled = render({ labelled: true });
    for (const word of ["Focus", "Combined", "Lanes"]) expect(labelled).toContain(`>${word}<`);
    expect(render({ labelled: true, several: false })).toContain(">Timeline<");
  });

  it("reports the layout whose button is pressed", () => {
    const onChange = vi.fn();
    const group = LayoutToggle({ layout: "combined", several: true, onChange }) as { props: { children: { props: { onClick: () => void } }[] } };
    const [focus, combined, lanes] = group.props.children;
    lanes.props.onClick();
    focus.props.onClick();
    combined.props.onClick();
    expect(onChange.mock.calls.map(([layout]) => layout satisfies Layout)).toEqual(["separate", "focus", "combined"]);
  });
});
