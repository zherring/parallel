import { Newsreader } from "next/font/google";

/**
 * The serif of the quotes, and of nothing else: the Clippings tab of a /p/ page and the quote teasers of the landing
 * page's Clippings tab (`font-serif`, once an ancestor has `newsreader.variable`). One weight, regular only (nothing
 * set in the serif is italic: the film title in a quote's source line is Inter), loaded when a quote is first shown rather
 * than preloaded for every page (most /p/ pages have no Clippings, and neither tab is the default). The card of a quote
 * (`og-quote-render.tsx`) draws the same face from a file of its own.
 */
export const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: "normal",
  display: "swap",
  preload: false,
});
