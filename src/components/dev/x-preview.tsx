"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/components/timeline/cn";
import {
  DESKTOP_WIDTHS,
  PANEL_HEIGHTS,
  PHONE_SCREEN,
  STRICT_SANDBOX,
  X_PREVIEW_PRESETS,
  onOrigin,
  previewProblems,
  withMotion,
  type PreviewMeta,
} from "@/lib/x-preview";

interface XPreviewProps {
  /** The origin the page is served from: what the tags' URLs are moved to, so that the frames are this server's. */
  origin: string;
  /** The path previewed (empty when the input was none), and the input as it was typed. */
  target: string;
  input: string;
  meta: PreviewMeta | null;
  error: string | null;
}

/** How long the card shows its picture before the frame takes its place: the time X's own frame takes to show up is not known, this is only a beat to see both. */
const SWAP_MS = 1200;

const BUTTON = "rounded-md border border-border bg-surface px-2.5 py-1 text-sm text-strong hover:border-muted disabled:opacity-40";
const ON = "border-strong bg-strong/10";

function Choice<T extends string | number>({ value, current, onPick, children }: { value: T; current: T; onPick: (value: T) => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={value === current} onClick={() => onPick(value)} className={cn(BUTTON, value === current && ON)}>
      {children}
    </button>
  );
}

/** A generic post (an avatar, a name and handle, the text), not X's own look or marks: the card goes where a post's card goes, with the line X puts under it. */
function PostShell({ children, wide }: { children: React.ReactNode; wide: number }) {
  return (
    <article className="rounded-2xl border border-border bg-canvas p-4" style={{ width: wide }} aria-label="A post">
      <div className="flex gap-3">
        <span aria-hidden="true" className="size-10 shrink-0 rounded-full bg-surface" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-5">
            <span className="font-semibold text-strong">Display Name</span> <span className="text-muted">@handle &middot; 2h</span>
          </p>
          <p className="mt-1 text-[15px] leading-5 text-body">Two people, every film they made together, on one timeline.</p>
          {children}
        </div>
      </div>
    </article>
  );
}

export function XPreview({ origin, target, input, meta, error }: XPreviewProps) {
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const [width, setWidth] = useState<number>(DESKTOP_WIDTHS[1]);
  const [panelHeight, setPanelHeight] = useState<number>(PANEL_HEIGHTS[0]);
  const [sandbox, setSandbox] = useState<"permissive" | "strict">("permissive");
  const [reduced, setReduced] = useState(false);
  const [reload, setReload] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  /** Desktop: the picture is shown first, then the frame (`swapped`), and the picture goes once the frame has loaded (`loaded`); each is the `stage` it is true for, so a reload or a change starts over. */
  const [swappedFor, setSwappedFor] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const player = useMemo(() => withMotion(onOrigin(meta?.player ?? null, origin) ?? "", reduced), [meta?.player, origin, reduced]);
  const image = onOrigin(meta?.image ?? null, origin);
  const problems = meta ? previewProblems(meta) : [];
  const sandboxAttribute = sandbox === "strict" ? STRICT_SANDBOX : undefined;
  const aspect = (meta?.playerHeight ?? 630) / (meta?.playerWidth ?? 1200);

  // The picture first, then the frame, again for each reload and each change of what the frame is.
  const stage = `${mode}-${player}-${reload}-${sandbox}-${width}`;
  const swapped = swappedFor === stage;
  const loaded = loadedFor === stage;
  useEffect(() => {
    if (mode !== "desktop" || !player) return;
    const timer = window.setTimeout(() => setSwappedFor(stage), SWAP_MS);
    return () => window.clearTimeout(timer);
  }, [mode, player, stage]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setPanelOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  const cardHeight = Math.round(width * aspect);
  const frameKey = `${reload}-${sandbox}-${width}-${panelHeight}-${player}`;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 text-body">
      <h1 className="text-lg font-semibold text-strong">X preview</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        A pair or a quote as it appears in a post, from the tags the page really sends (below). Development only: in production this page is a 404. X&rsquo;s own frame is not reproduced:
        its sandbox and its size on a given screen are not published, so both are set here.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-center gap-2" aria-label="Page to preview">
        <label className="sr-only" htmlFor="x-preview-target">
          A /p/... path or people ids
        </label>
        <input
          id="x-preview-target"
          name="target"
          defaultValue={input || target}
          placeholder="/p/488-steven-spielberg+491-john-williams, or 488+491"
          className="min-w-[22rem] flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-strong"
        />
        <button type="submit" className={BUTTON}>
          Preview
        </button>
      </form>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        Quick picks:
        {X_PREVIEW_PRESETS.map((preset) => (
          <a key={preset.target} href={`?target=${encodeURIComponent(preset.target)}`} className={cn(BUTTON, "no-underline", preset.target === target && ON)}>
            {preset.label}
          </a>
        ))}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-border bg-surface p-3 text-sm text-strong">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border p-3 text-sm" role="group" aria-label="Preview settings">
        <div className="flex items-center gap-1.5">
          <span className="text-muted">Screen</span>
          <Choice value="desktop" current={mode} onPick={setMode}>
            Desktop
          </Choice>
          <Choice value="mobile" current={mode} onPick={setMode}>
            Mobile
          </Choice>
        </div>
        {mode === "desktop" ? (
          <div className="flex items-center gap-1.5">
            <span className="text-muted">Frame width</span>
            {DESKTOP_WIDTHS.map((w) => (
              <Choice key={w} value={w} current={width} onPick={setWidth}>
                {w}
              </Choice>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-muted">Panel height</span>
            {PANEL_HEIGHTS.map((h) => (
              <Choice key={h} value={h} current={panelHeight} onPick={setPanelHeight}>
                {h === PANEL_HEIGHTS[0] ? `${h} (70%)` : h}
              </Choice>
            ))}
            <input
              type="number"
              min={120}
              max={PHONE_SCREEN.height}
              aria-label="Panel height in px"
              value={panelHeight}
              onChange={(event) => setPanelHeight(Math.min(PHONE_SCREEN.height, Math.max(120, Number(event.target.value) || PANEL_HEIGHTS[0])))}
              className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-strong"
            />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-muted">Sandbox</span>
          <Choice value="permissive" current={sandbox} onPick={setSandbox}>
            Permissive (none)
          </Choice>
          <Choice value="strict" current={sandbox} onPick={setSandbox}>
            Strict guess
          </Choice>
        </div>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />
          Reduced motion
        </label>
        <button type="button" className={BUTTON} onClick={() => setReload((n) => n + 1)}>
          Reload frame
        </button>
        {player && (
          <a href={player} target="_blank" rel="noopener" className="text-muted underline underline-offset-4 hover:text-strong">
            Open the frame alone
          </a>
        )}
        <p className="basis-full text-xs text-muted">
          X&rsquo;s exact sandbox is unknown. &ldquo;Strict guess&rdquo; is <code>sandbox=&quot;{STRICT_SANDBOX}&quot;</code>; &ldquo;permissive&rdquo; sets none. Reduced motion adds
          <code> ?motion=reduce</code> to the frame&rsquo;s address, which a development build of the embed honours.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-start gap-8">
        <section aria-label="Preview" className="min-w-0">
          {mode === "desktop" ? (
            <PostShell wide={width + 32 + 40 + 12}>
              <div
                data-testid="x-card"
                className="relative mt-3 overflow-hidden rounded-2xl border border-border bg-surface"
                style={{ width, height: cardHeight }}
              >
                {image && !loaded && (
                  <img src={image} alt="The post's card image (twitter:image)" width={width} height={cardHeight} className="absolute inset-0 size-full object-cover" />
                )}
                {swapped && player && (
                  <iframe
                    key={frameKey}
                    title="The post's frame (twitter:player)"
                    src={player}
                    sandbox={sandboxAttribute}
                    width={width}
                    height={cardHeight}
                    onLoad={() => setLoadedFor(stage)}
                    className="absolute inset-0 border-0"
                  />
                )}
              </div>
              <p className="mt-1 text-[13px] text-muted">From parallel.zachherring.com</p>
            </PostShell>
          ) : (
            <div
              data-testid="x-phone"
              className="relative overflow-hidden rounded-[2rem] border border-border bg-canvas"
              style={{ width: PHONE_SCREEN.width, height: PHONE_SCREEN.height }}
            >
              <div className="p-3 pt-10">
                <div className="flex gap-3">
                  <span aria-hidden="true" className="size-10 shrink-0 rounded-full bg-surface" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-5">
                      <span className="font-semibold text-strong">Display Name</span> <span className="text-muted">@handle</span>
                    </p>
                    <p className="mt-1 text-[15px] leading-5 text-body">Two people, every film they made together, on one timeline.</p>
                  </div>
                </div>
                {image && (
                  <button
                    type="button"
                    onClick={() => setPanelOpen(true)}
                    aria-label="Open the card (shows the frame in a panel)"
                    className="mt-3 block w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface p-0"
                  >
                    <img src={image} alt="The post's card image (twitter:image)" className="block w-full" style={{ aspectRatio: `${1 / aspect}` }} />
                  </button>
                )}
                <p className="mt-1 text-[13px] text-muted">From parallel.zachherring.com</p>
              </div>
              {panelOpen && player && (
                <div className="absolute inset-0 z-10 flex flex-col justify-end">
                  <button type="button" aria-label="Close the panel" onClick={() => setPanelOpen(false)} className="absolute inset-0 cursor-default bg-black/60" />
                  <div data-testid="x-panel" className="relative overflow-hidden rounded-t-2xl bg-canvas" style={{ height: panelHeight }}>
                    <iframe
                      key={frameKey}
                      title="The post's frame (twitter:player)"
                      src={player}
                      sandbox={sandboxAttribute}
                      width={PHONE_SCREEN.width}
                      height={panelHeight}
                      className="block border-0"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section aria-label="Tags read from the page" className="min-w-[20rem] max-w-2xl flex-1 text-sm">
          <h2 className="font-semibold text-strong">Tags the page sends</h2>
          {meta ? (
            <>
              {problems.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-strong">
                  {problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              )}
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted">Frame used</dt>
                <dd className="break-all text-strong">{player || "none"}</dd>
                <dt className="text-muted">Picture used</dt>
                <dd className="break-all text-strong">{image ?? "none"}</dd>
                <dt className="text-muted">Player size</dt>
                <dd className="text-strong">
                  {meta.playerWidth ?? "?"} x {meta.playerHeight ?? "?"}
                </dd>
                <dd className="col-span-2 text-muted">The tags name the production site; the frame and the picture above are the same paths on this server ({origin}).</dd>
              </dl>
              <table className="mt-3 w-full border-collapse text-xs">
                <tbody>
                  {meta.tags.map((tag, index) => (
                    <tr key={`${tag.name}-${index}`} className="border-t border-border align-top">
                      <th scope="row" className="py-1 pr-3 text-left font-normal text-muted">
                        {tag.name}
                      </th>
                      <td className="break-all py-1 text-strong">{tag.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="mt-2 text-muted">No page read.</p>
          )}
        </section>
      </div>
    </div>
  );
}
