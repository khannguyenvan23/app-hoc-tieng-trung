import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt =
  "Tiếng Trung Hihi - flashcard tiếng Trung với audio và SRS";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0f172a",
          color: "white",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "28px",
            width: "100%",
          }}
        >
          <div
            style={{
              color: "#5eead4",
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 0,
              textTransform: "uppercase",
            }}
          >
            Flashcard tiếng Trung cho người tự học
          </div>
          <div
            style={{
              fontSize: 86,
              fontWeight: 800,
              letterSpacing: 0,
              lineHeight: 1,
            }}
          >
            {siteConfig.name}
          </div>
          <div
            style={{
              color: "#e2e8f0",
              fontSize: 40,
              lineHeight: 1.35,
              maxWidth: 920,
            }}
          >
            Học HSK với audio, câu ví dụ và thuật toán lặp lại ngắt quãng.
          </div>
          <div style={{ display: "flex", gap: "18px", marginTop: "20px" }}>
            {["HSK1/HSK2", "Audio", "SRS", "Luyện câu"].map((label) => (
              <div
                key={label}
                style={{
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: "10px",
                  fontSize: 28,
                  fontWeight: 700,
                  padding: "16px 22px",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
