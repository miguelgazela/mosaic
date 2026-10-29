import {
  Archive, Bookmark, Calendar, Camera, Film, Flag, Folder, Globe, Heart, House, Image, Leaf, LayoutDashboard,
  Lightbulb, Music, Palette, Pencil, Rocket, Star, BookOpen, type LucideIcon,
} from 'lucide-react'
import { colorVar } from '../../canvas/colors'

/** What the picker offers (00-foundations, Board icons). Keys are stored in boards.icon. */
export const BOARD_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'star', label: 'Star', Icon: Star },
  { key: 'camera', label: 'Camera', Icon: Camera },
  { key: 'image', label: 'Image', Icon: Image },
  { key: 'folder', label: 'Folder', Icon: Folder },
  { key: 'lightbulb', label: 'Idea', Icon: Lightbulb },
  { key: 'heart', label: 'Heart', Icon: Heart },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'flag', label: 'Flag', Icon: Flag },
  { key: 'rocket', label: 'Rocket', Icon: Rocket },
  { key: 'palette', label: 'Palette', Icon: Palette },
  { key: 'book', label: 'Book', Icon: BookOpen },
  { key: 'music', label: 'Music', Icon: Music },
]

/** Keys saved by earlier versions: no longer in the picker, but boards that have them keep rendering. */
const LEGACY_ICONS: Record<string, LucideIcon> = {
  layout: LayoutDashboard, pencil: Pencil, bookmark: Bookmark, globe: Globe, home: House, leaf: Leaf, archive: Archive, film: Film,
}

export const BOARD_EMOJI: { char: string; label: string }[] = [
  { char: '🎬', label: 'film' }, { char: '📸', label: 'photo' }, { char: '💡', label: 'idea' }, { char: '🎨', label: 'art' },
  { char: '📝', label: 'notes' }, { char: '📌', label: 'pin' }, { char: '⭐', label: 'star' }, { char: '🔥', label: 'fire' },
  { char: '🌿', label: 'plant' }, { char: '🏠', label: 'home' }, { char: '🎵', label: 'music' }, { char: '🎯', label: 'goal' },
  { char: '🚀', label: 'launch' }, { char: '📚', label: 'books' }, { char: '🧪', label: 'test' }, { char: '🗂️', label: 'files' },
  { char: '💬', label: 'chat' }, { char: '🛒', label: 'shop' }, { char: '✈️', label: 'travel' }, { char: '🍳', label: 'food' },
  { char: '🎁', label: 'gift' }, { char: '🧵', label: 'craft' }, { char: '🌍', label: 'world' }, { char: '✅', label: 'done' },
]

/** Glyph only, in `--board-icon`. Unknown keys are treated as emoji. */
export function BoardIcon({ icon, size = 28 }: { icon: string | null; size?: number }) {
  const key = icon ?? 'layout'
  const Icon = BOARD_ICONS.find((i) => i.key === key)?.Icon ?? LEGACY_ICONS[key]
  if (Icon) return <Icon size={size} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden />
  return <span style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden>{icon}</span>
}

/** Rounded tile with the glyph: `--board-icon` on `--board-tile`; a custom board colour replaces the grey tile. `onCard`: the tile sits on a card of that colour, so the tile is a saturated version of that hue with a white glyph. */
export function BoardTile({
  icon, color, size, glyph, radius = 'var(--radius-tile)', onCard = false,
}: { icon: string | null; color?: string | null; size: number; glyph: number; radius?: string; onCard?: boolean }) {
  const tint = color ? colorVar(color) : null
  return (
    <span
      data-testid="board-tile"
      className={`flex shrink-0 items-center justify-center ${tint && onCard ? 'board-tile-hue' : ''}`}
      style={{
        width: size, height: size, borderRadius: radius,
        ['--tile-tint' as string]: tint,
        background: tint ? (onCard ? undefined : tint) : 'var(--board-tile)',
        color: tint && onCard ? '#fff' : 'var(--board-icon)',
      }}
      aria-hidden
    >
      <BoardIcon icon={icon} size={glyph} />
    </span>
  )
}
