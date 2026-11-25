const paths = {
  eye: "M2 13s4-8 11-8 11 8 11 8-4 8-11 8S2 13 2 13zM17 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  play: "m9 6 11 7-11 7z",
  pause: "M9 6v14M17 6v14",
  pencil: "m5 17 12-12 4 4-12 12-5 1zM15 7l4 4",
  forward: "M5 13h15m-6-6 6 6-6 6",
  back: "M20 13H5m6-6-6 6 6 6",
  grid: "M4 4h7v7H4zm11 0h7v7h-7zM4 15h7v7H4zm11 0h7v7h-7z",
  list: "M5 6h2m4 0h11M5 13h2m4 0h11M5 20h2m4 0h11",
  export: "M13 17V3m-5 5 5-5 5 5M4 15v7h18v-7",
  close: "m7 7 12 12M19 7 7 19",
  plus: "M6 13h14M13 6v14",
  chevron: "m7 10 6 6 6-6",
  check: "m6 13 4 4L20 7",
  home: "M3 10 12 3l9 7v10H5V10m4 10v-7h6v7",
  library: "M4 4h5v16H4zm7 0h4v16h-4zm6 1 4-1 3 15-4 1z",
  mistakes: "M5 3h14v18H5zm4 5h6m-6 4h6m-6 4h3",
  records: "M4 6v5h5M4 11a8 8 0 1 1 2 7m6-11v6l4 2",
  trash: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  folder: "M3 6h7l2 3h10v11H3z",
  paper: "M5 3h10l5 5v13H5zm10 0v6h5M9 13h7m-7 4h7",
  panel: "M3 4h18v16H3zM9 4v16m7-12-4 4 4 4",
  search: "M17 17l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
};

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 26 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
