import { ImageResponse } from "next/og";

export const alt = "Cael AI Sales Agent. Turn Every Conversation Into Revenue.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "linear-gradient(180deg, #ffffff 0%, #eceef1 100%)",
        color: "#0b0c0f",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="84" height="84" viewBox="0 0 40 40">
          <rect width="40" height="40" rx="12" fill="#fba00b" />
          <path
            d="M27.4 13.2A10 10 0 1 0 27.4 26.8"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <circle cx="28" cy="20" r="3.1" fill="#0b0c0f" />
        </svg>
        <div style={{ fontSize: 40 }}>Cael AI Sales Agent</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 92 }}>
        <div>Turn Every Conversation</div>
        <div style={{ display: "flex" }}>
          Into<span style={{ color: "#a6500a", marginLeft: 24 }}>Revenue</span>
        </div>
      </div>
    </div>,
    size,
  );
}
