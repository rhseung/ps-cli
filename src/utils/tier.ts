import chalk from 'chalk';
import gradient, { Gradient } from 'gradient-string';

export const TIER_NAMES = [
  undefined,
  'Bronze V',
  'Bronze IV',
  'Bronze III',
  'Bronze II',
  'Bronze I',
  'Silver V',
  'Silver IV',
  'Silver III',
  'Silver II',
  'Silver I',
  'Gold V',
  'Gold IV',
  'Gold III',
  'Gold II',
  'Gold I',
  'Platinum V',
  'Platinum IV',
  'Platinum III',
  'Platinum II',
  'Platinum I',
  'Diamond V',
  'Diamond IV',
  'Diamond III',
  'Diamond II',
  'Diamond I',
  'Ruby V',
  'Ruby IV',
  'Ruby III',
  'Ruby II',
  'Ruby I',
  'Master',
] as const;

export const TIER_COLORS = [
  undefined,
  '#9d4900',
  '#a54f00',
  '#ad5600',
  '#b55d0a',
  '#c67739',
  '#38546e',
  '#3d5a74',
  '#435f7a',
  '#496580',
  '#4e6a86',
  '#d28500',
  '#df8f00',
  '#ec9a00',
  '#f9a518',
  '#ffb028',
  '#00c78b',
  '#00d497',
  '#27e2a4',
  '#3ef0b1',
  '#51fdbd',
  '#009ee5',
  '#00a9f0',
  '#00b4fc',
  '#2bbfff',
  '#41caff',
  '#e0004c',
  '#ea0053',
  '#f5005a',
  '#ff0062',
  '#ff3071',
  '#b300e0',
] as const;

const TIER_IMAGE_BASE_URL = 'https://d2gd6pc034wcta.cloudfront.net/tier';

// Master 티어 그라디언트 색상
export const MASTER_TIER_GRADIENT = [
  { r: 255, g: 124, b: 168 },
  { r: 180, g: 145, b: 255 },
  { r: 124, g: 249, b: 255 },
];

// 각 티어의 최소 레이팅 (tier 0부터 31까지)
export const TIER_MIN_RATINGS = [
  0, // Unrated (tier 0): 0-29
  30, // Bronze V (tier 1)
  60, // Bronze IV (tier 2)
  90, // Bronze III (tier 3)
  120, // Bronze II (tier 4)
  150, // Bronze I (tier 5)
  200, // Silver V (tier 6)
  300, // Silver IV (tier 7)
  400, // Silver III (tier 8)
  500, // Silver II (tier 9)
  650, // Silver I (tier 10)
  800, // Gold V (tier 11)
  950, // Gold IV (tier 12)
  1100, // Gold III (tier 13)
  1250, // Gold II (tier 14)
  1400, // Gold I (tier 15)
  1600, // Platinum V (tier 16)
  1750, // Platinum IV (tier 17)
  1900, // Platinum III (tier 18)
  2000, // Platinum II (tier 19)
  2100, // Platinum I (tier 20)
  2200, // Diamond V (tier 21)
  2300, // Diamond IV (tier 22)
  2400, // Diamond III (tier 23)
  2500, // Diamond II (tier 24)
  2600, // Diamond I (tier 25)
  2700, // Ruby V (tier 26)
  2800, // Ruby IV (tier 27)
  2850, // Ruby III (tier 28)
  2900, // Ruby II (tier 29)
  2950, // Ruby I (tier 30)
  3000, // Master (tier 31)
] as const;

export function getTierMinRating(tier: number): number {
  if (tier >= 0 && tier < TIER_MIN_RATINGS.length) {
    return TIER_MIN_RATINGS[tier] ?? 0;
  }
  return 0;
}

export function getTierMaxRating(tier: number): number {
  if (tier === 31) {
    // Master 티어는 최대값이 없음
    return Infinity;
  }
  const nextTierMin = getNextTierMinRating(tier);
  if (nextTierMin === null) {
    return Infinity;
  }
  return nextTierMin - 1;
}

export function getNextTierMinRating(tier: number): number | null {
  if (tier === 31) {
    // Master 티어는 다음 티어가 없음
    return null;
  }
  if (tier >= 0 && tier < TIER_MIN_RATINGS.length - 1) {
    return TIER_MIN_RATINGS[tier + 1] ?? null;
  }
  return null;
}

export function calculateTierProgress(
  currentRating: number,
  tier: number,
): number {
  if (tier === 31) {
    // Master 티어는 프로그레스 계산 불가
    return 100;
  }

  const currentTierMin = getTierMinRating(tier);
  const nextTierMin = getNextTierMinRating(tier);

  if (nextTierMin === null) {
    return 100;
  }

  // 현재 레이팅이 현재 티어 최소값보다 낮으면 0%
  if (currentRating < currentTierMin) {
    return 0;
  }

  // 현재 레이팅이 다음 티어 최소값 이상이면 100%
  if (currentRating >= nextTierMin) {
    return 100;
  }

  // 프로그레스 계산: (현재 레이팅 - 현재 티어 최소값) / (다음 티어 최소값 - 현재 티어 최소값) * 100
  const progress =
    ((currentRating - currentTierMin) / (nextTierMin - currentTierMin)) * 100;

  return Math.max(0, Math.min(100, progress));
}

export function getTierName(level: number): string {
  if (level === 0) return 'Unrated';
  if (level >= 1 && level < TIER_NAMES.length) {
    return TIER_NAMES[level] || 'Unrated';
  }
  return 'Unrated';
}

export function getTierColor(level: number): string | Gradient {
  if (level === 0) return '#2d2d2d';
  if (level === 31) {
    // Master 티어는 그라디언트 배열 반환
    return gradient([...MASTER_TIER_GRADIENT]);
  }
  if (level >= 1 && level < TIER_COLORS.length) {
    return TIER_COLORS[level] || '#2d2d2d';
  }
  return '#2d2d2d';
}

export function getTierImageUrl(level: number): string {
  // level 0은 no rating이므로 0.svg 사용
  return `${TIER_IMAGE_BASE_URL}/${level}.svg`;
}
