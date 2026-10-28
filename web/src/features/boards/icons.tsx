import {
  Archive, Bookmark, Calendar, Camera, Film, Folder, Globe, Heart, House, Image, Leaf, LayoutDashboard,
  Lightbulb, Music, Pencil, Rocket, Star, BookOpen, type LucideIcon,
} from 'lucide-react'

/** Board icon keys (stored in boards.icon). Anything not listed here is treated as an emoji. */
export const BOARD_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'layout', label: 'Board', Icon: LayoutDashboard },
  { key: 'camera', label: 'Camera', Icon: Camera },
  { key: 'image', label: 'Image', Icon: Image },
  { key: 'pencil', label: 'Pencil', Icon: Pencil },
  { key: 'star', label: 'Star', Icon: Star },
  { key: 'bookmark', label: 'Bookmark', Icon: Bookmark },
  { key: 'globe', label: 'Globe', Icon: Globe },
  { key: 'home', label: 'Home', Icon: House },
  { key: 'leaf', label: 'Leaf', Icon: Leaf },
  { key: 'archive', label: 'Archive', Icon: Archive },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'lightbulb', label: 'Idea', Icon: Lightbulb },
  { key: 'film', label: 'Film', Icon: Film },
  { key: 'music', label: 'Music', Icon: Music },
  { key: 'heart', label: 'Heart', Icon: Heart },
  { key: 'folder', label: 'Folder', Icon: Folder },
  { key: 'rocket', label: 'Rocket', Icon: Rocket },
  { key: 'book', label: 'Book', Icon: BookOpen },
]

export const BOARD_EMOJI: { char: string; label: string }[] = [
  { char: '🎬', label: 'film' }, { char: '📸', label: 'photo' }, { char: '💡', label: 'idea' }, { char: '🎨', label: 'art' },
  { char: '📝', label: 'notes' }, { char: '📌', label: 'pin' }, { char: '⭐', label: 'star' }, { char: '🔥', label: 'fire' },
  { char: '🌿', label: 'plant' }, { char: '🏠', label: 'home' }, { char: '🎵', label: 'music' }, { char: '🎯', label: 'goal' },
  { char: '🚀', label: 'launch' }, { char: '📚', label: 'books' }, { char: '🧪', label: 'test' }, { char: '🗂️', label: 'files' },
  { char: '💬', label: 'chat' }, { char: '🛒', label: 'shop' }, { char: '✈️', label: 'travel' }, { char: '🍳', label: 'food' },
  { char: '🎁', label: 'gift' }, { char: '🧵', label: 'craft' }, { char: '🌍', label: 'world' }, { char: '✅', label: 'done' },
]

export function BoardIcon({ icon, size = 28 }: { icon: string | null; size?: number }) {
  const found = BOARD_ICONS.find((i) => i.key === (icon ?? 'layout'))
  if (found) return <found.Icon size={size} strokeWidth={1.75} aria-hidden />
  return <span style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden>{icon}</span>
}
