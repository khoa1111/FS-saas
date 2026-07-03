// Hand-drawn 16px stroke icon set (feather-style, currentColor).

const PATHS: Record<string, JSX.Element> = {
  finance: (
    <>
      <path d="M2 13.5h12" />
      <path d="M3.5 13.5V9m3 4.5V6.5m3 7V8m3 5.5V4.5" />
      <path d="M3 6l3.5-2.5L9 5l4-3" />
    </>
  ),
  vault: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <circle cx="8" cy="8" r="2.6" />
      <path d="M8 6.2V8l1.2 1.2" />
    </>
  ),
  hr: (
    <>
      <rect x="2.5" y="2" width="11" height="12" rx="2" />
      <circle cx="8" cy="6.4" r="1.8" />
      <path d="M4.8 12c.6-1.7 1.8-2.5 3.2-2.5s2.6.8 3.2 2.5" />
    </>
  ),
  projects: (
    <>
      <path d="M3.5 14V2.5" />
      <path d="M3.5 3h8.5l-1.8 2.8L12 8.5H3.5" />
    </>
  ),
  workflow: (
    <>
      <circle cx="3.5" cy="4" r="1.8" />
      <circle cx="12.5" cy="8" r="1.8" />
      <circle cx="3.5" cy="12" r="1.8" />
      <path d="M5.3 4h4.2a2 2 0 0 1 2 2v0M10.7 8H7.5a2 2 0 0 0-2 2v0.2" />
    </>
  ),
  crm: (
    <>
      <circle cx="5.7" cy="6" r="2.1" />
      <path d="M2 13.2c.7-2.1 2-3.1 3.7-3.1s3 1 3.7 3.1" />
      <circle cx="11.3" cy="5.2" r="1.7" />
      <path d="M10.6 9.8c1.9-.2 3 .7 3.6 2.5" />
    </>
  ),
  games: (
    <>
      <path d="M5.5 4.5h5a4 4 0 0 1 4 4c0 2-1.2 3.2-2.6 3.2-1 0-1.7-.6-2.2-1.4l-.4-.6H6.7l-.4.6c-.5.8-1.2 1.4-2.2 1.4C2.7 11.7 1.5 10.5 1.5 8.5a4 4 0 0 1 4-4Z" />
      <path d="M5.2 7.2v2m-1-1h2" />
      <circle cx="11" cy="7.4" r="0.4" fill="currentColor" />
      <circle cx="12.4" cy="8.8" r="0.4" fill="currentColor" />
    </>
  ),
  admin: (
    <>
      <path d="M8 1.8 13.5 4v4c0 3.2-2.2 5.4-5.5 6.4C4.7 13.4 2.5 11.2 2.5 8V4L8 1.8Z" />
      <path d="M5.8 8l1.6 1.6L10.5 6.4" />
    </>
  ),
  logout: (
    <>
      <path d="M6.5 2.5H4a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 4 13.5h2.5" />
      <path d="M10.5 5l3 3-3 3M13.2 8H6" />
    </>
  ),
  sheet: (
    <>
      <rect x="2.5" y="2" width="11" height="12" rx="1.5" />
      <path d="M2.5 6h11M6.5 6v8M2.5 10h11" />
    </>
  ),
  spark: (
    <>
      <path d="M8 1.5 9.6 6l4.4 1.5L9.6 9 8 13.5 6.4 9 2 7.5 6.4 6 8 1.5Z" />
    </>
  ),
  plus: <path d="M8 3v10M3 8h10" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const glyph = PATHS[name];
  if (!glyph) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flex: "0 0 auto" }}
    >
      {glyph}
    </svg>
  );
}

export const ROOM_ICON: Record<string, string> = {
  finance: "finance",
  documents: "vault",
  hr: "hr",
  projects: "projects",
  workflow: "workflow",
  crm: "crm",
  games: "games",
  admin: "admin"
};
