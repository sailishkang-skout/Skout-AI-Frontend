export const size = { width: 32, height: 32 };
export const contentType = "image/svg+xml";

export default function Icon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="8" fill="#2563eb"/>
    <text x="16" y="22.5" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="white" text-anchor="middle">S</text>
  </svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
}
