export const TIER_NAMES = [
  undefined,
  "Bronze V",
  "Bronze IV",
  "Bronze III",
  "Bronze II",
  "Bronze I",
  "Silver V",
  "Silver IV",
  "Silver III",
  "Silver II",
  "Silver I",
  "Gold V",
  "Gold IV",
  "Gold III",
  "Gold II",
  "Gold I",
  "Platinum V",
  "Platinum IV",
  "Platinum III",
  "Platinum II",
  "Platinum I",
  "Diamond V",
  "Diamond IV",
  "Diamond III",
  "Diamond II",
  "Diamond I",
  "Ruby V",
  "Ruby IV",
  "Ruby III",
  "Ruby II",
  "Ruby I",
  "Master",
] as const;

export const TIER_COLORS = [
  undefined,
  "#9d4900",
  "#a54f00",
  "#ad5600",
  "#b55d0a",
  "#c67739",
  "#38546e",
  "#3d5a74",
  "#435f7a",
  "#496580",
  "#4e6a86",
  "#d28500",
  "#df8f00",
  "#ec9a00",
  "#f9a518",
  "#ffb028",
  "#00c78b",
  "#00d497",
  "#27e2a4",
  "#3ef0b1",
  "#51fdbd",
  "#009ee5",
  "#00a9f0",
  "#00b4fc",
  "#2bbfff",
  "#41caff",
  "#e0004c",
  "#ea0053",
  "#f5005a",
  "#ff0062",
  "#ff3071",
  "#b300e0",
] as const;

const TIER_IMAGE_BASE_URL = "https://d2gd6pc034wcta.cloudfront.net/tier";

export function getTierName(level: number): string {
  if (level === 0) return "Unrated";
  if (level >= 1 && level < TIER_NAMES.length) {
    return TIER_NAMES[level] || "Unrated";
  }
  return "Unrated";
}

export function getTierColor(level: number): string {
  if (level === 0) return "#2d2d2d";
  if (level >= 1 && level < TIER_COLORS.length) {
    return TIER_COLORS[level] || "#2d2d2d";
  }
  return "#2d2d2d";
}

export function getTierImageUrl(level: number): string {
  // level 0은 no rating이므로 0.svg 사용
  return `${TIER_IMAGE_BASE_URL}/${level}.svg`;
}
