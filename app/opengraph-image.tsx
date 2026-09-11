import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "HiPath AI — learn_to_ship()";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px",
          background: "#050A08",
          color: "#E6F4ED",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: "#8BA494" }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: "#10B981" }} />
          HiPath AI
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 64, fontWeight: 700, marginTop: 20, lineHeight: 1.1 }}>
          <div style={{ display: "flex" }}>Stop tutorial hell.</div>
          <div style={{ display: "flex", color: "#10B981" }}>&gt; learn_to_ship()</div>
        </div>
        <div style={{ fontSize: 20, color: "#8BA494", marginTop: 20 }}>
          Tech-only learning OS: roadmaps, lessons, quiz-gated progression, Socratic tutor.
        </div>
      </div>
    ),
    { ...size }
  );
}
