/**
 * Named pastel palette for time slots.
 * Soft fills with readable borders — quiet enough as defaults, still
 * distinguishable when someone picks a color by hand.
 */
export const SLOT_COLOR_OPTIONS = [
  { key: "teal", label: "Teal", bg: "#c8ebe0", border: "#1f6f5b", text: "#0f3d32" },
  { key: "blue", label: "Blue", bg: "#cfe0f7", border: "#2f5f9e", text: "#1a3358" },
  { key: "violet", label: "Violet", bg: "#e4d4f5", border: "#6b3fa0", text: "#3a2060" },
  { key: "magenta", label: "Magenta", bg: "#f5d6e8", border: "#a83278", text: "#5c1844" },
  { key: "red", label: "Red", bg: "#f8d4dc", border: "#b03d5c", text: "#6b1f35" },
  { key: "orange", label: "Orange", bg: "#fde2c8", border: "#c45e12", text: "#6b3208" },
  { key: "yellow", label: "Yellow", bg: "#f6e8d0", border: "#b0892d", text: "#5c4a14" },
  { key: "green", label: "Green", bg: "#d4edc9", border: "#3f7a2e", text: "#234818" },
  { key: "cyan", label: "Cyan", bg: "#d2eaf2", border: "#1f7a8c", text: "#124a54" },
  { key: "navy", label: "Navy", bg: "#dce4f5", border: "#4558a0", text: "#252f58" },
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
  bg: "#e4e8e2",
  border: "#7a8474",
  text: "#3a4038",
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
