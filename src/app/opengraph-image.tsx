import { ImageResponse } from "next/og";
import { OG, OG_SIZE, ogFonts, ogGlow, ogWordmark } from "@/lib/og-theme";

export const alt = "Parallel: follow the careers behind the movies";
export const size = OG_SIZE;
export const contentType = "image/png";

/** x positions (px) of the film nodes on each of the two lanes; the shared ones are lit. */
const LANE_A = [0, 120, 250, 380, 540, 690, 830, 1000, 1080];
const LANE_B = [60, 190, 250, 460, 540, 760, 830, 940, 1080];
const LIT = [250, 540, 830, 1080];
const LANE_GAP = 44;
const NODE = 16;

function lane(xs: number[], top: number) {
  return (
    <div style={{ position: "absolute", left: 0, top, width: "100%", height: NODE, display: "flex" }}>
      <div style={{ position: "absolute", left: 0, top: NODE / 2 - 1, width: "100%", height: 2, backgroundColor: OG.border }} />
      {xs.map((x) => {
        const lit = LIT.includes(x);
        return (
          <div
            key={x}
            style={{
              position: "absolute",
              left: x,
              top: 0,
              width: NODE,
              height: NODE,
              borderRadius: NODE,
              backgroundColor: lit ? OG.green : OG.bg,
              border: `2px solid ${lit ? OG.green : OG.muted}`,
              boxShadow: lit ? `0 0 18px ${OG.greenGlow}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

/** The brand card for the home page. Text only, so it is drawn once at build time and needs no TMDB token. */
export default async function Image() {
  const fonts = await ogFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "52px 64px",
          backgroundColor: OG.bg,
          backgroundImage: ogGlow(50, 0),
          fontFamily: "Inter",
          color: OG.strong,
        }}
      >
        {ogWordmark(48)}

        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 92, lineHeight: 1.06, letterSpacing: -2.5 }}>
            <span>Follow the careers</span>
            <span>behind the movies.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 30, fontSize: 32, lineHeight: 1.35, color: OG.body }}>
            <span>Search any actor, director, writer or cinematographer.</span>
            <span>Line their timelines up. See every film they made together.</span>
          </div>
        </div>

        <div style={{ position: "absolute", left: 64, bottom: 52, width: 1100, height: NODE + LANE_GAP, display: "flex" }}>
          {lane(LANE_A, 0)}
          {lane(LANE_B, LANE_GAP)}
          {LIT.map((x) => (
            <div
              key={x}
              style={{
                position: "absolute",
                left: x + NODE / 2 - 1,
                top: NODE,
                width: 2,
                height: LANE_GAP - NODE,
                backgroundColor: OG.green,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
