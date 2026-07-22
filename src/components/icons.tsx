// Small stroke-based icon set. Inherits color from the parent (currentColor)
// and sizes with the `size` prop. Kept inline so there is no icon-font or
// external dependency — same approach as the theme toggle.

type IconProps = {
  size?: number;
  className?: string;
};

const paths: Record<string, string> = {
  // nav
  study: "M3 5h13a2 2 0 0 1 2 2v11M3 5v12a2 2 0 0 0 2 2h13M3 5l4-2 4 2 4-2 4 2",
  sentences: "M4 5h16v10H9l-4 3v-3H4z",
  stats: "M4 20V10M10 20V4M16 20v-7M4 20h16",
  community:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M15 14a6 6 0 0 1 6 6",
  decks: "M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  credit: "M3 7h18v10H3zM3 11h18M7 15h4",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4.5 12l-1.3-.8.9-2.2 1.5.3M19.5 12l1.3-.8-.9-2.2-1.5.3M12 4.5l-.8-1.3-2.2.9.3 1.5M12 19.5l.8 1.3 2.2-.9-.3-1.5",
  // actions
  play: "M6 4l14 8-14 8V4z",
  plus: "M12 5v14M5 12h14",
  share: "M8 12a3 3 0 1 0 0-.1M16 6a3 3 0 1 0 0 .1M16 18a3 3 0 1 0 0-.1M10.5 10.5l3-2M10.5 13.5l3 2",
  edit: "M4 20h4L18 10l-4-4L4 16v4zM13 5l4 4",
  logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 12h10M17 9l3 3-3 3",
};

export function Icon({ name, size = 18, className }: IconProps & { name: string }) {
  const d = paths[name];

  if (!d) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d={d} />
    </svg>
  );
}
