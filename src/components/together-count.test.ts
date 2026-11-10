import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TogetherCount } from "@/components/together-count";

const render = (props: { several: boolean; count: number }) => renderToStaticMarkup(createElement(TogetherCount, props));

describe("TogetherCount", () => {
  it("is a green dot and the words for a pair with films together; the full words are its accessible name", () => {
    const html = render({ several: true, count: 30 });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="30 films made together"');
    expect(html).toContain("bg-lit");
    expect(html).toContain("--lit-glow");
    expect(html).toContain(">30<");
    expect(html).toContain("made together</span>");
    // Under the small breakpoint the words go and the number stays.
    expect(html).toContain('class="max-sm:hidden"');
    expect(html).not.toContain("bg-muted/60");
  });

  it("is singular for one film", () => {
    const html = render({ several: true, count: 1 });
    expect(html).toContain('aria-label="1 film made together"');
    expect(html).toContain("> film made together");
    expect(html).not.toContain("1 films");
  });

  it("has a muted grey dot, and says so, when they made none together", () => {
    const html = render({ several: true, count: 0 });
    expect(html).toContain('aria-label="No films made together"');
    expect(html).toContain("No films made together</span>");
    expect(html).toContain("bg-muted/60");
    expect(html).not.toContain("bg-lit");
  });

  it("is plain muted text, not a pill, for one person", () => {
    const html = render({ several: false, count: 12 });
    expect(html).toContain(">12 films</p>");
    expect(html).toContain("text-muted");
    expect(html).not.toContain("data-together-pill");
    expect(html).not.toContain("bg-lit");
    expect(html).not.toContain('role="img"');
    expect(render({ several: false, count: 1 })).toContain(">1 film</p>");
  });

  it("is not interactive: no link, no button, no tab stop", () => {
    for (const props of [{ several: true, count: 5 }, { several: true, count: 0 }, { several: false, count: 5 }]) {
      const html = render(props);
      expect(html).not.toMatch(/<(a|button)\b/);
      expect(html).not.toContain("tabindex");
    }
  });
});
