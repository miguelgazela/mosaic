export const CARD_COLOR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const

export const colorVar = (key: string | null): string | undefined =>
  key ? `var(--card-color-${key})` : undefined

export const COLOR_NAMES: Record<string, string> = {
  '1': 'Butter', '2': 'Peach', '3': 'Rose', '4': 'Lilac', '5': 'Sky',
  '6': 'Mint', '7': 'Sage', '8': 'Sand', '9': 'Stone', '10': 'White',
}

/** Picker order (00-pickers): none, then light to warm to cool. Key 10 (white) is the same as none. */
export const PICKER_ORDER: (string | null)[] = [null, '9', '8', '1', '2', '3', '4', '5', '6', '7']
