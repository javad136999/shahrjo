'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ApiError,
  createWallPost,
  deleteAd,
  deleteWallPost,
  editWallPost,
  getAdCategories,
  getWall,
  likeWallPost,
  pinWallPost,
  updateAd,
  uploadImage,
  uploadVoice,
} from '@/lib/api';
import { UserProfileModal } from '@/components/user-profile-modal';
import { formatPrice, thumbFallback, thumbUrlFor, timeAgo } from '@/lib/format';
import { asWallSticker, WALL_STICKER_PACKS } from '@/lib/stickers';
import type { AdCategoryOption, WallAdRef, WallFeed, WallPost } from '@/lib/types';

export interface WallViewProps {
  city: { id: number; slug: string; name: string };
}

/** Chat cadence: a light poll keeps the room lively without a WS stack. */
const POLL_MS = 5_000;

/**
 * Send chevron as inline SVG rather than the «➤» character: dingbat glyphs are
 * missing from some Android system fonts, which left the round send button (and
 * the stop button of the recorder) looking completely empty.
 */
function SendGlyph() {
  return (
    <svg className="wall-sendglyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M21 3 2.6 10.4a.7.7 0 0 0 .04 1.32L9 14l2.3 6.3a.7.7 0 0 0 1.3.05L21 3Z" />
    </svg>
  );
}

/** Microphone for the round record action (same reason as SendGlyph). */
function MicGlyph() {
  return (
    <svg className="wall-micglyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </svg>
  );
}

/** Small ✕ for the composer chips / sticker tray — an SVG, because the site
 *  font has no U+2715 and the fallback often leaves the button blank. */
function CloseGlyph() {
  return (
    <svg className="wall-closeglyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function WallAdCardContent({ ad }: { ad: WallAdRef }) {
  return (
    <>
      {ad.image && (
        // eslint-disable-next-line @next/next/no-img-element -- remote media
        <img
          className="wall-adcard__img"
          src={thumbUrlFor(ad.image) ?? ad.image}
          alt=""
          loading="lazy"
          onError={thumbFallback(ad.image)}
        />
      )}
      <span className="wall-adcard__body">
        <strong>{ad.title}</strong>
        <span className="wall-adcard__details">{ad.description}</span>
        <b className="wall-adcard__price">{formatPrice(ad.price)}</b>
        <small>{ad.status === 'PENDING' ? 'پیش‌نمایش تا پایان بررسی ناظر' : 'مشاهدهٔ کامل آگهی ↗'}</small>
      </span>
      <span className={`wall-adcard__badge${ad.status === 'PENDING' ? ' wall-adcard__badge--pending' : ''}`}>
        {ad.status === 'PENDING' ? '⏳ در انتظار تأیید' : '📝 آگهی'}
      </span>
    </>
  );
}

/** mm:ss for the recording timer / voice chips. */
function clock(seconds: number): string {
  const m = Math.floor(Math.floor(seconds) / 60);
  const s = Math.floor(seconds) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Persian/Arabic digits → Latin so «۱٬۲۰۰» parses as a number. */
function toLatinDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Hold-to-edit cadence (ms) — the mobile gesture for editing your own post. */
const LONG_PRESS_MS = 500;

/** Inline editor state for the caller's own ad card. */
interface AdEditState {
  postId: number;
  adId: number;
  title: string;
  description: string;
  price: string;
  phone: string;
  address: string;
}

/**
 * دیوار شهر (Phase 8b + Phase 10) — Telegram-style chat room of one city:
 * a room header (wall name + member count), chat bubbles with avatar/time,
 * one-level replies, photo + voice notes, own-message editing, a pinned
 * banner and promoted ad cards (daily republication). The bottom composer
 * carries text, photo, voice recording — and the «ثبت آگهی» entry, which
 * used to live in the header and the bottom nav. The feed auto-refreshes by
 * polling; a 401 renders the login gate instead of the room.
 */
export function WallView({ city }: WallViewProps) {
  const [feed, setFeed] = useState<WallFeed | null>(null);
  // tapped username/avatar → public profile card → private chat entry
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [gate, setGate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<WallPost | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // sticker tray: which pack is open in the composer
  const [stickerOpen, setStickerOpen] = useState(false);
  const [stickerPack, setStickerPack] = useState(WALL_STICKER_PACKS[0].id);
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  // hold-to-edit on your own ad card → inline ad editor
  const [adEdit, setAdEdit] = useState<AdEditState | null>(null);
  const [adEditError, setAdEditError] = useState<string | null>(null);
  const [adEditSaving, setAdEditSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Category shortcuts in the room header: املاک، خودرو + ۴ دسته مهم (server order).
  const [cats, setCats] = useState<AdCategoryOption[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pagingRef = useRef(false);
  const restoreRef = useRef<number | null>(null);
  const pressTimerRef = useRef<number | null>(null);

  // voice recording (Phase 10)
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [voice, setVoice] = useState<{ file: File; url: string; seconds: number } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recStartRef = useRef(0);
  const recTimerRef = useRef<number | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const newestRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getWall(city.slug);
      setFeed(next);
      setGate(false);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setGate(true);
      else setError(err instanceof Error ? err.message : 'دریافت دیوار شهر ناموفق بود');
    }
  }, [city.slug]);

  useEffect(() => {
    setFeed(null);
    setGate(false);
    void load();
  }, [load]);

  // category shortcuts (first six by server sortOrder — real data, not code)
  useEffect(() => {
    let alive = true;
    getAdCategories()
      .then((all) => {
        if (alive) setCats(all.slice(0, 6));
      })
      .catch(() => {
        if (alive) setCats([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // keep the reading position when older pages are prepended above
  useLayoutEffect(() => {
    const keep = restoreRef.current;
    const el = feedRef.current;
    if (keep !== null && el) {
      el.scrollTop = el.scrollHeight - keep;
      restoreRef.current = null;
    }
  }, [feed]);

  // object URL for the picked photo — revoked as soon as it changes/unmounts
  useEffect(() => {
    if (!image) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  // the composer grows with the message (up to ~5 lines) instead of scrolling
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(46, Math.min(el.scrollHeight, 150))}px`;
  }, [text]);

  // polling — cheap live delivery for the chat room (no WebSocket needed)
  useEffect(() => {
    if (gate) return;
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load, gate]);

  // keep the newest message in view (but never yank the user while paging back)
  useEffect(() => {
    const newest = feed?.posts[0]?.id ?? null;
    if (newest !== null && newest !== newestRef.current) {
      requestAnimationFrame(() => {
        const el = feedRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
    newestRef.current = newest;
  }, [feed]);

  // stop mic + timers when the room unmounts
  useEffect(() => {
    return () => {
      if (recTimerRef.current !== null) window.clearInterval(recTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const stopRecorder = (keep: boolean) => {
    const recorder = recorderRef.current;
    if (recTimerRef.current !== null) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    setRecording(false);
    if (!recorder) return;
    recorder.onstop = () => {
      if (keep) {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const seconds = Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000));
        if (blob.size > 0) {
          const mime = recorder.mimeType || 'audio/webm';
          const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
          const file = new File([blob], `voice.${ext}`, { type: mime });
          setVoice((prev) => {
            if (prev) URL.revokeObjectURL(prev.url);
            return { file, url: URL.createObjectURL(file), seconds };
          });
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
    };
    try {
      recorder.stop();
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
    }
  };

  const startRecording = async () => {
    setError(null);
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('ضبط ویس در این مرورگر پشتیبانی نمی‌شود.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      streamRef.current = stream;
      recStartRef.current = Date.now();
      setRecSeconds(0);
      setRecording(true);
      recTimerRef.current = window.setInterval(
        () => setRecSeconds(Math.max(0, Math.round((Date.now() - recStartRef.current) / 1000))),
        500,
      );
      recorder.start();
    } catch {
      setError('دسترسی به میکروفون ممکن نشد؛ اجازهٔ ضبط صدا را در مرورگر بدهید.');
    }
  };

  const discardVoice = () => {
    setVoice((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const send = async () => {
    const content = text.trim();
    if (sending) return;
    if (!content && !image && !voice) return;
    setSending(true);
    setError(null);
    try {
      let imageIds: number[] | undefined;
      if (image) {
        const up = await uploadImage(image);
        imageIds = [up.id];
      }
      let voiceMediaId: number | undefined;
      if (voice) {
        const up = await uploadVoice(voice.file);
        voiceMediaId = up.id;
      }
      await createWallPost({ cityId: city.id, content, replyToId: replyTo?.id, imageIds, voiceMediaId });
      setText('');
      setImage(null);
      setReplyTo(null);
      discardVoice();
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setGate(true);
      else setError(err instanceof Error ? err.message : 'ارسال پیام ناموفق بود');
    } finally {
      setSending(false);
    }
  };

  /**
   * A sticker is a one-tap message: it is sent immediately (like WhatsApp),
   * as a normal wall post whose whole content is the sticker emoji.
   */
  const sendSticker = async (emoji: string) => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await createWallPost({ cityId: city.id, content: emoji, replyToId: replyTo?.id });
      setStickerOpen(false);
      setReplyTo(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setGate(true);
      else setError(err instanceof Error ? err.message : 'ارسال استیکر ناموفق بود');
    } finally {
      setSending(false);
    }
  };

  const patchPost = (id: number, patch: Partial<WallPost>) => {
    setFeed((f) =>
      f
        ? {
            ...f,
            posts: f.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
            pinned: f.pinned && f.pinned.id === id ? { ...f.pinned, ...patch } : f.pinned,
          }
        : f,
    );
  };

  const like = async (post: WallPost) => {
    const liked = post.likedByMe;
    patchPost(post.id, { likedByMe: !liked, likeCount: post.likeCount + (liked ? -1 : 1) });
    try {
      const res = await likeWallPost(post.id);
      patchPost(post.id, { likedByMe: res.liked, likeCount: res.likeCount });
    } catch {
      void load(); // resync on failure
    }
  };

  /**
   * Removes the AD itself (owner or moderator), not just this repost: the ad
   * leaves the feeds and every wall card at once, its pictures are freed and
   * the daily republication stops mentioning it.
   */
  const removeAd = async (ad: NonNullable<WallPost['ad']>) => {
    if (!window.confirm('این آگهی کاملاً پاک شود؟ از دیوار و همهٔ صفحات سایت حذف می‌شود و قابل بازگشت نیست.'))
      return;
    try {
      await deleteAd(ad.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'پاک کردن آگهی ناموفق بود');
    }
  };

  const remove = async (post: WallPost) => {
    if (!window.confirm('این پیام پاک شود؟')) return;
    try {
      await deleteWallPost(post.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'پاک کردن پیام ناموفق بود');
    }
  };

  const saveEdit = async (post: WallPost) => {
    if (!editing) return;
    const content = editing.text.trim();
    if (!content) return;
    try {
      const updated = await editWallPost(post.id, content);
      patchPost(post.id, { content: updated.content, editedAt: updated.editedAt });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ویرایش پیام ناموفق بود');
    }
  };

  const pin = async (post: WallPost) => {
    try {
      await pinWallPost(post.id, !post.isPinned);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'سنجاق کردن ناموفق بود');
    }
  };

  /** Hold-to-edit: press your own post to open its editor (the ✏️ button
   *  stays for mouse users, but long-press is the natural mobile gesture). */
  const startPress = (post: WallPost) => {
    if (!post.isMine) return;
    cancelPress();
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null;
      if (post.ad) openAdEdit(post);
      else if (post.canEdit && !post.business) setEditing({ id: post.id, text: post.content });
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const openAdEdit = (post: WallPost) => {
    if (!post.ad) return;
    setEditing(null);
    setAdEditError(null);
    setAdEdit({
      postId: post.id,
      adId: post.ad.id,
      title: post.ad.title,
      description: post.ad.description,
      price: post.ad.price === null ? '' : String(post.ad.price),
      phone: '',
      address: '',
    });
  };

  const saveAdEdit = async () => {
    if (!adEdit || adEditSaving) return;
    const title = adEdit.title.trim();
    const description = adEdit.description.trim();
    if (title.length < 4) return setAdEditError('عنوان باید حداقل ۴ حرف باشد');
    if (description.length < 10) return setAdEditError('توضیحات باید حداقل ۱۰ حرف باشد');
    const raw = toLatinDigits(adEdit.price).replace(/[,\s٬]/g, '');
    if (raw && !/^\d{1,16}$/.test(raw)) return setAdEditError('قیمت باید عدد صحیح باشد (ریال) یا خالی بماند');

    setAdEditSaving(true);
    setAdEditError(null);
    try {
      const updated = await updateAd(adEdit.adId, {
        title,
        description,
        price: raw ? Number(raw) : null,
        ...(adEdit.phone.trim() ? { phone: adEdit.phone.trim() } : {}),
        ...(adEdit.address.trim() ? { address: adEdit.address.trim() } : {}),
      });
      // refresh the card's snapshot fields (price may have been cleared)
      const current =
        feed?.posts.find((p) => p.id === adEdit.postId)?.ad ??
        (feed?.pinned?.id === adEdit.postId ? feed.pinned.ad : null);
      if (current) {
        patchPost(adEdit.postId, {
          ad: { ...current, title: updated.title, description, price: updated.price },
        });
      }
      setAdEdit(null);
    } catch (err) {
      setAdEditError(err instanceof Error ? err.message : 'ویرایش آگهی ناموفق بود');
    } finally {
      setAdEditSaving(false);
    }
  };

  const loadOlder = async () => {
    if (!feed?.nextBefore || pagingRef.current) return;
    pagingRef.current = true;
    setLoadingOlder(true);
    try {
      const older = await getWall(city.slug, feed.nextBefore);
      // distance-from-bottom stays constant while the page grows upward
      const el = feedRef.current;
      restoreRef.current = el ? el.scrollHeight - el.scrollTop : null;
      setFeed({
        ...feed,
        posts: [...feed.posts, ...older.posts],
        nextBefore: older.nextBefore,
      });
    } catch {
      restoreRef.current = null;
      setError('دریافت پیام‌های قدیمی‌تر ناموفق بود');
    } finally {
      setLoadingOlder(false);
      pagingRef.current = false;
    }
  };

  /** Scrolling to the top of the room loads the previous page (infinite chat history). */
  const onFeedScroll = () => {
    const el = feedRef.current;
    if (!el || !feed?.nextBefore || pagingRef.current) return;
    if (el.scrollTop < 80) void loadOlder();
  };

  // WhatsApp flip: the round action is a mic while the composer is empty and
  // turns into the send button as soon as there is text/photo/voice.
  const hasContent = Boolean(text.trim() || image || voice);
  const activeStickerPack =
    WALL_STICKER_PACKS.find((pack) => pack.id === stickerPack) ?? WALL_STICKER_PACKS[0];

  if (gate) {
    return (
      <div className="wall-gate" data-testid="wall-gate">
        <span className="wall-gate__icon" aria-hidden>
          🔒
        </span>
        <h2>دیوار شهر {city.name}</h2>
        <p className="muted">برای دیدن و نوشتن در دیوار شهر، وارد حساب خود شوید.</p>
        <Link href="/login?next=/wall" className="btn btn-primary">
          ورود با موبایل
        </Link>
        <Link
          href={`/city/${city.slug}`}
          className="btn btn-ghost"
          data-testid="wall-home-gate"
        >
          🏠 صفحه اصلی شهر
        </Link>
      </div>
    );
  }

  if (!feed) {
    // A failed load must surface the error + a retry — not an endless
    // «در حال بارگذاری» (that hid real server errors, e.g. a missing migration).
    if (error) {
      return (
        <div className="wall-error" data-testid="wall-error">
          <span className="wall-error__icon" aria-hidden>
            ⚠️
          </span>
          <p role="alert">{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => void load()}>
            تلاش دوباره
          </button>
          <Link
            href={`/city/${city.slug}`}
            className="btn btn-ghost"
            data-testid="wall-home-error"
          >
            🏠 صفحه اصلی شهر
          </Link>
        </div>
      );
    }
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری دیوار…
      </p>
    );
  }

  const renderPost = (post: WallPost, pinnedBanner = false) => {
    const isEditing = editing?.id === post.id;
    const isAdEditing = adEdit?.postId === post.id;
    // a message that is just one catalogue sticker renders big, like WhatsApp
    const sticker = asWallSticker(post.content);
    return (
      <article
        key={post.id}
        className={`wall-post${post.isMine ? ' wall-post--own' : ''}${post.isPinned ? ' wall-post--pinned' : ''}${post.ad ? ' wall-post--ad' : ''}`}
        data-testid={`wall-post-${post.id}`}
        onPointerDown={() => startPress(post)}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(e) => {
          // the long-press menu would otherwise steal the hold-to-edit gesture
          if (post.isMine) e.preventDefault();
        }}
      >
        <span
          className="wall-post__avatar wall-post__tappable"
          role="button"
          tabIndex={0}
          aria-label={`پروفایل ${post.user.name}`}
          onClick={() => setProfileUserId(post.user.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setProfileUserId(post.user.id);
            }
          }}
        >
          {post.user.avatarUrl && !post.user.avatarUrl.startsWith('emoji:') ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote media
            <img src={post.user.avatarUrl} alt="" />
          ) : (
            post.user.name.slice(0, 1)
          )}
        </span>
        <div className="wall-post__body">
          <div className="wall-post__head">
            <strong
              className="wall-post__name wall-post__tappable"
              role="button"
              tabIndex={0}
              onClick={() => setProfileUserId(post.user.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setProfileUserId(post.user.id);
                }
              }}
            >
              {post.user.name}
            </strong>
            <time className="wall-post__time">{timeAgo(post.createdAt)}</time>
            {post.editedAt && (
              <span className="wall-post__edited" data-testid={`wall-edited-${post.id}`}>
                ویرایش شد
              </span>
            )}
            <span className="wall-post__actions">
              {post.canPin && (
                <button
                  type="button"
                  className="wall-iconbtn"
                  aria-label={post.isPinned ? 'برداشتن سنجاق' : 'سنجاق به بالای دیوار'}
                  data-testid={`wall-pin-${post.id}`}
                  onClick={() => void pin(post)}
                >
                  📌
                </button>
              )}
              {post.canDelete && (
                <button
                  type="button"
                  className="wall-iconbtn"
                  aria-label="پاک کردن پیام"
                  data-testid={`wall-delete-${post.id}`}
                  onClick={() => void remove(post)}
                >
                  🗑
                </button>
              )}
            </span>
          </div>

          {post.replyTo && (
            <blockquote className="wall-reply" data-testid={`wall-reply-${post.id}`}>
              <b>{post.replyTo.userName}:</b> {post.replyTo.content}
            </blockquote>
          )}

          {isEditing ? (
            <div className="wall-edit" data-testid={`wall-editbox-${post.id}`}>
              <textarea
                className="wall-composer__input"
                rows={2}
                maxLength={1000}
                aria-label="ویرایش پیام"
                data-testid="wall-edit-input"
                value={editing?.text ?? ''}
                onChange={(e) => setEditing({ id: post.id, text: e.target.value })}
              />
              <div className="wall-edit__actions">
                <button
                  type="button"
                  className="pill pill--accent"
                  data-testid="wall-edit-save"
                  onClick={() => void saveEdit(post)}
                >
                  ذخیره
                </button>
                <button type="button" className="pill" onClick={() => setEditing(null)}>
                  انصراف
                </button>
              </div>
            </div>
          ) : isAdEditing ? (
            <div className="wall-adedit" data-testid={`wall-adeditbox-${post.id}`}>
              <label htmlFor={`adedit-title-${post.id}`}>عنوان آگهی</label>
              <input
                id={`adedit-title-${post.id}`}
                type="text"
                maxLength={160}
                data-testid="wall-adedit-title"
                value={adEdit?.title ?? ''}
                onChange={(e) => setAdEdit((s) => (s ? { ...s, title: e.target.value } : s))}
              />
              <label htmlFor={`adedit-desc-${post.id}`}>توضیحات</label>
              <textarea
                id={`adedit-desc-${post.id}`}
                rows={3}
                maxLength={4000}
                data-testid="wall-adedit-desc"
                value={adEdit?.description ?? ''}
                onChange={(e) => setAdEdit((s) => (s ? { ...s, description: e.target.value } : s))}
              />
              <div className="wall-adedit__row">
                <span>
                  <label htmlFor={`adedit-price-${post.id}`}>قیمت (ریال)</label>
                  <input
                    id={`adedit-price-${post.id}`}
                    type="text"
                    inputMode="numeric"
                    placeholder="خالی = توافقی"
                    data-testid="wall-adedit-price"
                    value={adEdit?.price ?? ''}
                    onChange={(e) => setAdEdit((s) => (s ? { ...s, price: e.target.value } : s))}
                  />
                </span>
                <span>
                  <label htmlFor={`adedit-phone-${post.id}`}>شماره تماس</label>
                  <input
                    id={`adedit-phone-${post.id}`}
                    type="tel"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="اختیاری"
                    data-testid="wall-adedit-phone"
                    value={adEdit?.phone ?? ''}
                    onChange={(e) => setAdEdit((s) => (s ? { ...s, phone: e.target.value } : s))}
                  />
                </span>
              </div>
              <label htmlFor={`adedit-address-${post.id}`}>آدرس</label>
              <input
                id={`adedit-address-${post.id}`}
                type="text"
                maxLength={300}
                placeholder="اختیاری"
                data-testid="wall-adedit-address"
                value={adEdit?.address ?? ''}
                onChange={(e) => setAdEdit((s) => (s ? { ...s, address: e.target.value } : s))}
              />
              {adEditError && (
                <p className="error" role="alert" data-testid="wall-adedit-error">
                  {adEditError}
                </p>
              )}
              <div className="wall-edit__actions">
                <button
                  type="button"
                  className="pill pill--accent"
                  data-testid="wall-adedit-save"
                  disabled={adEditSaving}
                  onClick={() => void saveAdEdit()}
                >
                  {adEditSaving ? 'در حال ذخیره…' : 'ذخیره'}
                </button>
                <button type="button" className="pill" onClick={() => setAdEdit(null)}>
                  انصراف
                </button>
              </div>
            </div>
          ) : (
            <>
              {sticker ? (
                <p className="wall-sticker" data-testid={`wall-sticker-post-${post.id}`}>
                  <span role="img" aria-label={`استیکر ${sticker}`}>
                    {sticker}
                  </span>
                </p>
              ) : (
                post.content && <p className="wall-post__text">{post.content}</p>
              )}

              {post.imageUrl && (
                // feed shows the 400px thumbnail; the full copy lives in storage
                // eslint-disable-next-line @next/next/no-img-element -- remote media
                <img
                  className="wall-post__image"
                  src={thumbUrlFor(post.imageUrl) ?? post.imageUrl}
                  alt=""
                  loading="lazy"
                  onError={thumbFallback(post.imageUrl)}
                />
              )}

              {post.voiceUrl && (
                <audio
                  className="wall-post__voice"
                  controls
                  preload="none"
                  src={post.voiceUrl}
                  data-testid={`wall-voice-${post.id}`}
                  aria-label="پیام صوتی"
                />
              )}

              {post.business && (
                <Link
                  href={`/business/${post.business.id}`}
                  className="wall-promocard"
                  data-testid={`wall-promocard-${post.id}`}
                >
                  <span className="wall-promocard__thumb" aria-hidden>
                    {post.business.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- owner photo
                      <img
                        src={thumbUrlFor(post.business.logoUrl) ?? post.business.logoUrl}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          // photo removed later → the emoji tile takes over
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      (post.business.category.icon ?? '🏪')
                    )}
                  </span>
                  <span className="wall-promocard__body">
                    <b>{post.business.name}</b>
                    <small>
                      {post.business.category.icon ?? '◆'} {post.business.category.name}
                      {post.business.address ? ` · 📍 ${post.business.address}` : ''}
                    </small>
                    <span className="wall-promocard__cta">مشاهدهٔ صفحه و منوی کسب‌وکار ↗</span>
                  </span>
                  <span className="wall-promocard__badge">👑 طلایی</span>
                </Link>
              )}

              {post.ad && (
                post.ad.status === 'PENDING' ? (
                  <div
                    className="wall-adcard wall-adcard--pending"
                    data-testid={`wall-adcard-${post.id}`}
                    role="status"
                  >
                    <WallAdCardContent ad={post.ad} />
                  </div>
                ) : (
                  <Link
                    href={`/ad/${post.ad.id}`}
                    className="wall-adcard"
                    data-testid={`wall-adcard-${post.id}`}
                  >
                    <WallAdCardContent ad={post.ad} />
                  </Link>
                )
              )}
            </>
          )}

          {!isEditing && !isAdEditing && (
            <div className="wall-post__foot">
              <button
                type="button"
                className={`wall-likebtn${post.likedByMe ? ' wall-likebtn--on' : ''}`}
                aria-pressed={post.likedByMe}
                data-testid={`wall-like-${post.id}`}
                onClick={() => void like(post)}
              >
                ❤ {post.likeCount.toLocaleString('fa-IR')}
              </button>
              <button
                type="button"
                className="wall-iconbtn"
                aria-label="پاسخ دادن"
                data-testid={`wall-reply-btn-${post.id}`}
                onClick={() => {
                  setReplyTo(post);
                  setError(null);
                }}
              >
                ↩ پاسخ
              </button>
              {post.canEdit && !post.ad && (
                <button
                  type="button"
                  className="wall-iconbtn"
                  aria-label="ویرایش پیام"
                  data-testid={`wall-edit-${post.id}`}
                  onClick={() => setEditing({ id: post.id, text: post.content })}
                >
                  ✏️
                </button>
              )}
              {post.canEdit && post.ad && (
                <button
                  type="button"
                  className="wall-iconbtn"
                  aria-label="ویرایش آگهی"
                  data-testid={`wall-adedit-${post.id}`}
                  onClick={() => openAdEdit(post)}
                >
                  ✏️
                </button>
              )}
              {post.ad?.canRemove && (
                <button
                  type="button"
                  className="wall-iconbtn wall-iconbtn--danger"
                  aria-label="حذف کامل آگهی"
                  data-testid={`wall-addelete-${post.id}`}
                  onClick={() => void removeAd(post.ad!)}
                >
                  🗑 آگهی
                </button>
              )}
              {pinnedBanner && <span className="wall-post__pinbadge">📌 سنجاق‌شده</span>}
            </div>
          )}
        </div>
      </article>
    );
  };

  // newest at the bottom, like any chat room (server keeps a desc cursor)
  const ordered = [...feed.posts].reverse();

  return (
    <div className="wall wall--jam-theme" data-testid="wall">
      <header className="wall-room" data-testid="wall-room">
        {/* The site header/nav are hidden in the room — the city home lives here. */}
        <Link
          href={`/city/${city.slug}`}
          className="wall-homebtn"
          data-testid="wall-home-top"
          aria-label={`صفحه اصلی شهر ${city.name}`}
          title={`صفحه اصلی شهر ${city.name}`}
        >
          🏠
        </Link>
        <span className="wall-room__avatar" aria-hidden>
          💬
        </span>
        <div className="wall-room__copy">
          <small className="wall-room__eyebrow">گفت‌وگوی زندهٔ شهر</small>
          <strong className="wall-room__name" data-testid="wall-room-name">
            {feed.room.name}
          </strong>
          <small className="wall-room__meta" data-testid="wall-room-members">
            {feed.room.memberCount.toLocaleString('fa-IR')} عضو ·{' '}
            {feed.room.messageCount.toLocaleString('fa-IR')} پیام
          </small>
        </div>
        <nav className="wall-cats" aria-label="دسته‌بندی آگهی‌ها" data-testid="wall-cats">
          {cats.map((c) => (
            <Link
              key={c.slug}
              href={`/ads?category=${encodeURIComponent(c.slug)}`}
              className="wall-cat"
              aria-label={`آگهی‌های ${c.name}`}
              data-testid={`wall-cat-${c.slug}`}
              title={`آگهی‌های ${c.name}`}
            >
              <span aria-hidden>{c.icon ?? '◆'}</span>
              <small>{c.name}</small>
            </Link>
          ))}
        </nav>
      </header>

      {feed.pinned?.ad && (
        <a
          href={`/ad/${feed.pinned.ad.id}`}
          className="wall-pinnedbar"
          data-testid="wall-pinnedbar"
          title={feed.pinned.ad.title}
        >
          <span className="wall-pinnedbar__icon" aria-hidden>
            📌
          </span>
          <span className="wall-pinnedbar__copy">
            <b>دیوار شهر</b>
            <small>{feed.pinned.ad.title}</small>
          </span>
          <span className="wall-pinnedbar__cta" aria-hidden>
            ↗
          </span>
        </a>
      )}

      {error && (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {feed.pinned && !feed.pinned.ad && (
        <section className="wall-pinned" data-testid="wall-pinned" aria-label="پیام سنجاق‌شده">
          <span className="wall-pinned__tag" aria-hidden>
            📌 سنجاق‌شده
          </span>
          {renderPost(feed.pinned, true)}
        </section>
      )}

      {feed.nextBefore && (
        <button
          type="button"
          className="btn btn-ghost wall-more"
          onClick={() => void loadOlder()}
          disabled={loadingOlder}
        >
          {loadingOlder ? 'در حال بارگذاری…' : 'پیام‌های قدیمی‌تر'}
        </button>
      )}

      <div className="wall-feed" ref={feedRef} role="log" aria-live="polite" onScroll={onFeedScroll}>
        {ordered.length === 0 ? (
          <div className="wall-empty" data-testid="wall-empty">
            <span aria-hidden>💬</span>
            <p>هنوز پیامی در دیوار شهر نیست — اولین نفر باشید.</p>
          </div>
        ) : (
          ordered.map((post) => renderPost(post))
        )}
      </div>

      <div className="wall-composer" data-testid="wall-composer">
        {replyTo && (
          <div className="wall-composer__reply">
            <span>
              پاسخ به <b>{replyTo.user.name}</b>: {replyTo.content.slice(0, 60)}
            </span>
            <button type="button" className="wall-iconbtn" aria-label="لغو پاسخ" onClick={() => setReplyTo(null)}>
              <CloseGlyph />
            </button>
          </div>
        )}

        {image && (
          <div className="wall-composer__chip wall-composer__chip--photo" data-testid="wall-image-chip">
            {imagePreview && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img className="wall-composer__preview" src={imagePreview} alt="" />
            )}
            <span className="wall-composer__chipcopy">
              <b>عکس آمادهٔ ارسال</b>
              <small>{image.name}</small>
            </span>
            <button
              type="button"
              className="wall-iconbtn"
              aria-label="حذف تصویر"
              data-testid="wall-image-remove"
              onClick={() => {
                setImage(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              <CloseGlyph />
            </button>
          </div>
        )}

        {voice && (
          <div className="wall-composer__chip" data-testid="wall-voice-chip">
            <span>🎤 ویس {clock(voice.seconds)}</span>
            <button type="button" className="wall-iconbtn" aria-label="حذف ویس" onClick={discardVoice}>
              <CloseGlyph />
            </button>
          </div>
        )}

        {stickerOpen && (
          <div className="wall-stickers" data-testid="wall-sticker-panel" role="dialog" aria-label="استیکرها">
            <div className="wall-stickers__head">
              <b>استیکرها</b>
              <span className="wall-stickers__hint">با یک لمس ارسال می‌شود</span>
              <button
                type="button"
                className="wall-stickers__close"
                aria-label="بستن استیکرها"
                data-testid="wall-sticker-close"
                onClick={() => setStickerOpen(false)}
              >
                <CloseGlyph />
              </button>
            </div>
            <div className="wall-stickers__packs" role="tablist" aria-label="بسته‌های استیکر">
              {WALL_STICKER_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  role="tab"
                  aria-selected={pack.id === activeStickerPack.id}
                  className={`wall-stickers__pack${pack.id === activeStickerPack.id ? ' is-active' : ''}`}
                  data-testid={`wall-sticker-pack-${pack.id}`}
                  onClick={() => setStickerPack(pack.id)}
                >
                  {pack.name}
                </button>
              ))}
            </div>
            <div className="wall-stickers__grid" data-testid="wall-sticker-grid">
              {activeStickerPack.stickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  className="wall-stickers__item"
                  aria-label={`ارسال استیکر ${sticker.emoji}`}
                  data-testid={`wall-sticker-${sticker.id}`}
                  disabled={sending}
                  onClick={() => void sendSticker(sticker.emoji)}
                >
                  <span aria-hidden>{sticker.emoji}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {recording ? (
          <div className="wall-rec" data-testid="wall-recording">
            <button type="button" className="wall-rec__trash" aria-label="لغو ضبط" onClick={() => stopRecorder(false)}>
              <span aria-hidden>🗑</span>
            </button>
            <span className="wall-rec__pulse" aria-hidden />
            <span className="wall-rec__time">{clock(recSeconds)}</span>
            <span className="wall-rec__hint">در حال ضبط…</span>
            <button
              type="button"
              className="wall-rec__stop"
              data-testid="wall-rec-stop"
              aria-label="پایان ضبط و ارسال"
              title="ارسال ویس"
              onClick={() => stopRecorder(true)}
            >
              <SendGlyph />
            </button>
          </div>
        ) : (
          /* WhatsApp bar: attach 📎 · [sticker 🙂 + input] · mic/send flip. The
             «ثبت آگهی فروش» action sits under the bar (not inside it). */
          <div className="wall-bar">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              aria-label="انتخاب تصویر"
              data-testid="wall-image"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className={`wall-tool wall-tool--inline wall-tool--attach${image ? ' wall-tool--on' : ''}`}
              data-testid="wall-photo-btn"
              aria-label={image ? 'تغییر عکس پیام' : 'افزودن عکس به پیام'}
              title="پیوست عکس"
              onClick={() => {
                setStickerOpen(false);
                fileRef.current?.click();
              }}
            >
              <span aria-hidden>📎</span>
            </button>

            <div className="wall-bar__field">
              <button
                type="button"
                className={`wall-bar__emoji${stickerOpen ? ' is-open' : ''}`}
                data-testid="wall-sticker-btn"
                aria-label="استیکرها"
                aria-expanded={stickerOpen}
                title="استیکرها"
                onClick={() => setStickerOpen((open) => !open)}
              >
                <span aria-hidden>🙂</span>
              </button>

              <textarea
                ref={inputRef}
                className="wall-bar__input"
                rows={1}
                maxLength={1000}
                placeholder={`پیام به شهر ${city.name}…`}
                aria-label="متن پیام"
                data-testid="wall-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
            </div>

            <button
              type="button"
              className={`wall-bar__mic${hasContent ? ' wall-bar__mic--hidden' : ''}`}
              data-testid="wall-voice-btn"
              aria-label="ضبط پیام صوتی"
              title="ضبط ویس"
              disabled={sending}
              onClick={() => void startRecording()}
            >
              <MicGlyph />
            </button>

            <button
              type="button"
              className={`wall-sendbtn${hasContent ? ' wall-sendbtn--ready' : ''}`}
              data-testid="wall-send"
              aria-label="ارسال پیام"
              title="ارسال پیام"
              disabled={sending || (!text.trim() && !image && !voice)}
              onClick={() => void send()}
            >
              <span aria-hidden className="wall-sendbtn__arrow">
                {sending ? '⏳' : <SendGlyph />}
              </span>
            </button>

          </div>
        )}

        <Link
          href="/ads/new"
          className="wall-adbtn"
          data-testid="wall-ad-btn"
          title="ثبت آگهی در دیوار شهر"
          aria-label="ثبت آگهی در دیوار شهر؛ برای شروع اینجا بزن"
        >
          <span className="wall-adbtn__icon" aria-hidden="true">＋</span>
          <span className="wall-adbtn__copy">
            <strong>ثبت آگهی در دیوار شهر</strong>
            <small>برای شروع ثبت آگهی، اینجا بزن</small>
          </span>
          <span className="wall-adbtn__arrow" aria-hidden="true">←</span>
        </Link>
      </div>

      {profileUserId !== null && (
        <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </div>
  );
}
