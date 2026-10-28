export const CARD_COLOR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const

export const colorVar = (key: string | null): string | undefined =>
  key ? `var(--card-color-${key})` : undefined
