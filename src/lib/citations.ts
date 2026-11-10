/**
 * Footnotes in a text, as Wikipedia has them: an inline marker `[n]` points at the nth of a list of sources (the pair descriptions in `pair-descriptions.ts` are written
 * this way). Pure, and apart from the data, so that the pair hero in the browser can use it without carrying the descriptions of every pair.
 */

/** One piece of a description's text: words, or the citation `[n]` of a source (`n` counts from 1). */
export type CitationSegment = { kind: "text"; text: string } | { kind: "citation"; n: number };

/**
 * A description's text cut at its citations, in order, for the hero to set each as a superscript link: "…on his shoulder.[1] Dunkirk…" is text, citation 1,
 * text. Adjacent markers (`[1][2]`) are two citations with nothing between them. A marker that points at no source (`[0]`, or beyond `sourceCount`) is not a
 * citation but words, and stays in the text as it was written, so nothing is lost and nothing is reported. Text with no marker is one text segment; empty text
 * is none.
 */
export function splitCitations(text: string, sourceCount: number): CitationSegment[] {
  const segments: CitationSegment[] = [];
  const push = (piece: string) => {
    if (!piece) return;
    const last = segments[segments.length - 1];
    if (last?.kind === "text") last.text += piece;
    else segments.push({ kind: "text", text: piece });
  };
  let from = 0;
  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    if (n < 1 || n > sourceCount) continue;
    push(text.slice(from, match.index));
    segments.push({ kind: "citation", n });
    from = match.index + match[0].length;
  }
  push(text.slice(from));
  return segments;
}
