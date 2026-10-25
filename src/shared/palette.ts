/** PRD 8.2 的 12 色分类色板。分类颜色只能从这里选。 */
export const CATEGORY_PALETTE = [
  '#4C8DFF',
  '#5AC8FA',
  '#34C759',
  '#FFD60A',
  '#FF9F0A',
  '#FF6B4A',
  '#FF4D4F',
  '#FF5CA8',
  '#BF5AF2',
  '#7D7AFF',
  '#8E8E93',
  '#30D158',
] as const;

export type PaletteColor = (typeof CATEGORY_PALETTE)[number];

export function isPaletteColor(color: string): color is PaletteColor {
  return (CATEGORY_PALETTE as readonly string[]).includes(color.toUpperCase());
}