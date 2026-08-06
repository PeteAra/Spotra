/**
 * Stable spot-title palette — same title → same color.
 * Avoids warm beige/tan pastels that disappear on the cream app background.
 * Hues are spaced around the wheel so neighboring titles stay distinguishable.
 */
const SLOT_COLORS = [
  { bg: "#c8ebe0", border: "#1f6f5b", text: "#0f3d32" }, // teal
  { bg: "#cfe0f7", border: "#2f5f9e", text: "#1a3358" }, // blue
  { bg: "#e4d4f5", border: "#6b3fa0", text: "#3a2060" }, // plum
  { bg: "#f8d4dc", border: "#b03d5c", text: "#6b1f35" }, // rose
  { bg: "#d4edc9", border: "#3f7a2e", text: "#234818" }, // green
  { bg: "#fde2c8", border: "#c45e12", text: "#6b3208" }, // orange (clear, not tan)
  { bg: "#d2eaf2", border: "#1f7a8c", text: "#124a54" }, // cyan
  { bg: "#e8d9f0", border: "#8b4d9e", text: "#4a2858" }, // orchid
  { bg: "#dce4f5", border: "#4558a0", text: "#252f58" }, // indigo
  { bg: "#f5d6e8", border: "#a83278", text: "#5c1844" }, // magenta
  { bg: "#dde8d4", border: "#5a7a38", text: "#2f401c" }, // olive
  { bg: "#d8e0ea", border: "#4a6280", text: "#243548" }, // steel
] as const;

/** Untitled spots — slightly cooler than the cream chrome so they still read as a chip. */
const NEUTRAL = {
  bg: "#e4e8e2",
  border: "#7a8474",
  text: "#3a4038",
} as const;

function hashTitle(title: string): number {
  const normalized = title.trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function slotColorFromTitle(title: string | null | undefined) {
  const trimmed = title?.trim() ?? "";
  if (!trimmed) return NEUTRAL;
  return SLOT_COLORS[hashTitle(trimmed) % SLOT_COLORS.length];
}
