import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/** Branded social share card (used by Open Graph + Twitter large cards). */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            H
          </div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>HiPath AI</div>
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, marginTop: 32 }}>
          Your Personal AI Learning Navigator
        </div>
        <div style={{ fontSize: 28, color: "#a1a1aa", marginTop: 20 }}>
          Personalized roadmaps • AI tutor • Adaptive quizzes
        </div>
      </div>
    ),
    { ...size }
  )
}
