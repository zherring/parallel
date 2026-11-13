import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SiteChrome } from "@/components/site-chrome";

let pathname: string | null = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

/** What the layout wraps (the header, which holds the universal search, and the footer), which an embed has no place for. */
const rendered = (path: string | null) => {
  pathname = path;
  return renderToStaticMarkup(createElement(SiteChrome, null, createElement("header", null, "Header"), createElement("footer", null, "Footer")));
};

describe("the site's chrome (the header with the universal search, and the footer)", () => {
  it.each(["/", "/p/488-steven-spielberg+491-john-williams", "/p/488-steven-spielberg+491-john-williams/q/some-quote", "/embedded", "/api/search"])(
    "is on %s",
    (path) => {
      expect(rendered(path)).toBe("<header>Header</header><footer>Footer</footer>");
    },
  );

  it.each(["/embed/p/488-steven-spielberg+491-john-williams", "/embed/q/488-steven-spielberg+491-john-williams/some-quote", "/embed"])(
    "is left out of the HTML of %s",
    (path) => {
      expect(rendered(path)).toBe("");
    },
  );
});
