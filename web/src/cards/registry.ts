import type { CardDefinition } from './types'
import { debugCard } from './debug/debugCard'

// One line per card type.
export const cardRegistry: Record<string, CardDefinition> = {
  debug: debugCard,
}

export const getCard = (type: string): CardDefinition | undefined => cardRegistry[type]
export const listCards = (): CardDefinition[] => Object.values(cardRegistry)

export const getCardByShortcut = (key: string): CardDefinition | undefined =>
  listCards().find((c) => c.shortcut?.toLowerCase() === key.toLowerCase())
