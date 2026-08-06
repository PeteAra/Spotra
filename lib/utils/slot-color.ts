/**
 * Named palette for time slots.
 * Hues are spaced farther apart, with stronger borders, so chips stay
 * distinct on the cream app background.
 */
export const SLOT_COLOR_OPTIONS = [
  { key: "teal", label: "Teal", bg: "#9fdfc9", border: "#0f5c48", text: "#0a3328" },
  { key: "blue", label: "Blue", bg: "#9ec5f5", border: "#1a4f96", text: "#122c54" },
  { key: "violet", label: "Violet", bg: "#c9b0f0", border: "#5b2d9e", text: "#2f1658" },
  { key: "magenta", label: "Magenta", bg: "#f0a8d0", border: "#a01f6c", text: "#5a103c" },
  { key: "red", label: "Red", bg: "#f5a8a0", border: "#b02820", text: "#641410" },
  { key: "orange", label: "Orange", bg: "#ffc089", border: "#c24a00", text: "#6b2800" },
  { key: "yellow", label: "Yellow", bg: "#f5e08a", border: "#a07800", text: "#534000" },
  { key: "green", label: "Green", bg: "#a8e090", border: "#2f7a18", text: "#184010" },
  { key: "cyan", label: "Cyan", bg: "#8fdeef", border: "#0f6f84", text: "#0a3d4a" },
  { key: "navy", label: "Navy", bg: "#a8b8e0", border: "#2a3f7a", text: "#182244" },
] as const;

export type SlotColorKey = (typeof SLOT_COLOR_OPTIONS)[number]["key"];

export type SlotColor = {
  key?: SlotColorKey;
  bg: string;
  border: string;
  text: string;
};

/** Untitled / unset — cooler gray-green so it doesn’t match cream chrome. */
export const SLOT_COLOR_NEUTRAL: SlotColor = {
  bg: "#dce2dc",
  border: "#5c665c",
  text: "#2c322c",
};

const COLOR_BY_KEY = Object.fromEntries(
  SLOT_COLOR_OPTIONS.map((c) => [c.key, c]),
) as Record<SlotColorKey, (typeof SLOT_COLOR_OPTIONS)[number]>;

export function isSlotColorKey(value: string | null | undefined): value is SlotColorKey {
  return Boolean(value && value in COLOR_BY_KEY);
}

function hashTitle(title: string): number {
  const normalized = title.trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Resolve display color: manual key wins, otherwise hash the title. */
export function resolveSlotColor(
  title?: string | null,
  colorKey?: string | null,
): SlotColor {
  if (isSlotColorKey(colorKey)) {
    const c = COLOR_BY_KEY[colorKey];
    return { key: c.key, bg: c.bg, border: c.border, text: c.text };
  }

  const trimmed = title?.trim() ?? "";
  if (!trimmed) return SLOT_COLOR_NEUTRAL;

  const c = SLOT_COLOR_OPTIONS[hashTitle(trimmed) % SLOT_COLOR_OPTIONS.length];
  return { key: c.key, bg: c.bg, border: c.border, text: c.text };
}

/** @deprecated Prefer resolveSlotColor */
export function slotColorFromTitle(title: string | null | undefined) {
  return resolveSlotColor(title, null);
}
