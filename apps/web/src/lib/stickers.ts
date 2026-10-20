/**
 * Wall stickers (WhatsApp-style).
 *
 * Stickers are emoji-based on purpose: they need no external asset, no extra
 * storage row and no new API field, so they render identically in the feed, in
 * the pinned banner and on every device. A message whose whole content is one
 * of these emoji is styled as a big sticker (see `asWallSticker`) instead of a
 * bubble of text.
 */
export interface WallSticker {
  /** Stable key for DOM/test ids (emoji are not safe ids). */
  id: string;
  emoji: string;
}

export interface WallStickerPack {
  id: string;
  name: string;
  stickers: WallSticker[];
}

export const WALL_STICKER_PACKS: WallStickerPack[] = [
  {
    id: 'shahrjo',
    name: 'شهرجو',
    stickers: [
      { id: 'grin', emoji: '😀' },
      { id: 'laugh', emoji: '😂' },
      { id: 'love', emoji: '🥰' },
      { id: 'cool', emoji: '😎' },
      { id: 'handshake', emoji: '🤝' },
      { id: 'clap', emoji: '👏' },
      { id: 'fire', emoji: '🔥' },
      { id: 'heart', emoji: '❤️' },
      { id: 'party', emoji: '🎉' },
      { id: 'thumbsup', emoji: '👍' },
      { id: 'thanks', emoji: '🙏' },
      { id: 'greenheart', emoji: '💚' },
    ],
  },
  {
    id: 'moods',
    name: 'احساسات',
    stickers: [
      { id: 'hearteyes', emoji: '😍' },
      { id: 'celebrate', emoji: '🥳' },
      { id: 'cry', emoji: '😭' },
      { id: 'angry', emoji: '😡' },
      { id: 'think', emoji: '🤔' },
      { id: 'sleep', emoji: '😴' },
      { id: 'plead', emoji: '🥺' },
      { id: 'scream', emoji: '😱' },
      { id: 'hug', emoji: '🤗' },
      { id: 'angel', emoji: '😇' },
      { id: 'starstruck', emoji: '🤩' },
      { id: 'sweat', emoji: '😅' },
    ],
  },
  {
    id: 'animals',
    name: 'حیوانات',
    stickers: [
      { id: 'cat', emoji: '🐱' },
      { id: 'dog', emoji: '🐶' },
      { id: 'panda', emoji: '🐼' },
      { id: 'fox', emoji: '🦊' },
      { id: 'frog', emoji: '🐸' },
      { id: 'monkey', emoji: '🐵' },
      { id: 'lion', emoji: '🦁' },
      { id: 'tiger', emoji: '🐯' },
      { id: 'koala', emoji: '🐨' },
      { id: 'pig', emoji: '🐷' },
      { id: 'chicken', emoji: '🐔' },
      { id: 'unicorn', emoji: '🦄' },
    ],
  },
  {
    id: 'citylife',
    name: 'شهر',
    stickers: [
      { id: 'city', emoji: '🏙️' },
      { id: 'car', emoji: '🚗' },
      { id: 'home', emoji: '🏠' },
      { id: 'tea', emoji: '☕' },
      { id: 'pizza', emoji: '🍕' },
      { id: 'tree', emoji: '🌳' },
      { id: 'balloon', emoji: '🎈' },
      { id: 'books', emoji: '📚' },
      { id: 'football', emoji: '⚽' },
      { id: 'guitar', emoji: '🎸' },
      { id: 'moon', emoji: '🌙' },
      { id: 'star', emoji: '⭐' },
    ],
  },
];

const STICKER_EMOJI = new Set(
  WALL_STICKER_PACKS.flatMap((pack) => pack.stickers.map((sticker) => sticker.emoji)),
);

/**
 * The sticker a message consists of, or null for ordinary text. Only the
 * exact catalogue emoji counts, so a normal message that happens to contain
 * an emoji still renders as text.
 */
export function asWallSticker(content: string | null | undefined): string | null {
  const value = content?.trim();
  if (!value) return null;
  return STICKER_EMOJI.has(value) ? value : null;
}
