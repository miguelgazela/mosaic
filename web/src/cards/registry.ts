import type { CardDefinition } from './types'
import { boardCard } from './board/boardCard'
import { columnCard } from './column/columnCard'
import { debugCard } from './debug/debugCard'
import { noteCard } from './note/noteCard'
import { swatchCard } from './swatch/swatchCard'

// One line per card type. Order = tool rail order and the order `onPaste` hooks are asked.
export const cardRegistry: Record<string, CardDefinition> = {
  note: noteCard,
  board: boardCard,
  column: columnCard,
  swatch: swatchCard,
  ...(import.meta.env.DEV ? { debug: debugCard } : {}),
}

export const getCard = (type: string): CardDefinition | undefined => cardRegistry[type]
export const listCards = (): CardDefinition[] => Object.values(cardRegistry)

export const getCardByShortcut = (key: string): CardDefinition | undefined =>
  listCards().find((c) => c.shortcut?.toLowerCase() === key.toLowerCase())
