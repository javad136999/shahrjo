'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ApiError,
  createWallPost,
  deleteWallPost,
  editWallPost,
  getWall,
  likeWallPost,
  pinWallPost,
  uploadImage,
  uploadVoice,
} from '@/lib/api';
import { formatPrice, thumbFallback, thumbUrlFor, timeAgo } from '@/lib/format';
import type { WallAdRef, WallFeed, WallPost } from '@/lib/types';

export interface WallViewProps {
  city: { id: number; slug: string; name: string };
}

/** Chat cadence: a light poll keeps the room lively without a WS stack. */
const POLL_MS = 5_000;

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
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
  const [gate, setGate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // JamCity-style in-wall search: filters the loaded feed by text/author.
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<WallPost | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const loadOlder = async () => {
    if (!feed?.nextBefore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const older = await getWall(city.slug, feed.nextBefore);
      setFeed({
        ...feed,
        posts: [...feed.posts, ...older.posts],
        nextBefore: older.nextBefore,
      });
    } catch {
      setError('دریافت پیام‌های قدیمی‌تر ناموفق بود');
    } finally {
      setLoadingOlder(false);
    }
  };

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
      </div>
    );
  }

  if (!feed) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری دیوار…
      </p>
    );
  }

  const renderPost = (post: WallPost, pinnedBanner = false) => {
    const isEditing = editing?.id === post.id;
    return (
      <article
        key={post.id}
        className={`wall-post${post.isPinned ? ' wall-post--pinned' : ''}${post.ad ? ' wall-post--ad' : ''}`}
        data-testid={`wall-post-${post.id}`}
      >
        <span className="wall-post__avatar" aria-hidden>
          {post.user.avatarUrl && !post.user.avatarUrl.startsWith('emoji:') ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote media
            <img src={post.user.avatarUrl} alt="" />
          ) : (
            post.user.name.slice(0, 1)
          )}
        </span>
        <div className="wall-post__body">
          <div className="wall-post__head">
            <strong className="wall-post__name">{post.user.name}</strong>
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
          ) : (
            <>
              {post.content && <p className="wall-post__text">{post.content}</p>}

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

          {!isEditing && (
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
              {pinnedBanner && <span className="wall-post__pinbadge">📌 سنجاق‌شده</span>}
            </div>
          )}
        </div>
      </article>
    );
  };

  // newest at the bottom, like any chat room (server keeps a desc cursor)
  const ordered = [...feed.posts].reverse();
  const q = query.trim();
  const visible = q
    ? ordered.filter((post) => (post.content ?? '').toLowerCase().includes(q.toLowerCase()) || post.user.name.includes(q))
    : ordered;

  return (
    <div className="wall" data-testid="wall">
      <header className="wall-room" data-testid="wall-room">
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
        <div className="wall-room__actions">
          <Link href={`/city/${city.slug}`} className="pill" data-testid="wall-back-city">
            🏙 شهر
          </Link>
          <Link href="/" className="pill" data-testid="wall-change-city">
            🔄 تغییر شهر
          </Link>
        </div>
      </header>

      <div className="wall-search" role="search">
        <input
          type="search"
          className="wall-search__input"
          placeholder="جستجو در دیوار شهر…"
          aria-label="جستجو در دیوار شهر"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="wall-search"
        />
        {q && (
          <button
            type="button"
            className="wall-iconbtn wall-search__close"
            aria-label="بستن جستجو"
            data-testid="wall-search-close"
            onClick={() => setQuery('')}
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {feed.pinned && (
        <section className="wall-pinned" data-testid="wall-pinned" aria-label="پیام سنجاق‌شده">
          {renderPost(feed.pinned, true)}
        </section>
      )}

      {feed.nextBefore && !q && (
        <button
          type="button"
          className="btn btn-ghost wall-more"
          onClick={() => void loadOlder()}
          disabled={loadingOlder}
        >
          {loadingOlder ? 'در حال بارگذاری…' : 'پیام‌های قدیمی‌تر'}
        </button>
      )}

      <div className="wall-feed" ref={feedRef} role="log" aria-live="polite">
        {ordered.length === 0 ? (
          <p className="empty-state">هنوز پیامی در دیوار شهر نیست — اولین نفر باشید.</p>
        ) : q && visible.length === 0 ? (
          <p className="empty-state" data-testid="wall-search-empty">
            🔎 پیامی با این جستجو پیدا نشد.
          </p>
        ) : (
          visible.map((post) => renderPost(post))
        )}
      </div>

      <div className="wall-composer">
        {replyTo && (
          <div className="wall-composer__reply">
            <span>
              پاسخ به <b>{replyTo.user.name}</b>: {replyTo.content.slice(0, 60)}
            </span>
            <button type="button" className="wall-iconbtn" aria-label="لغو پاسخ" onClick={() => setReplyTo(null)}>
              ✕
            </button>
          </div>
        )}

        {image && (
          <div className="wall-composer__chip" data-testid="wall-image-chip">
            <span>📷 {image.name}</span>
            <button
              type="button"
              className="wall-iconbtn"
              aria-label="حذف تصویر"
              onClick={() => {
                setImage(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              ✕
            </button>
          </div>
        )}

        {voice && (
          <div className="wall-composer__chip" data-testid="wall-voice-chip">
            <span>🎤 ویس {clock(voice.seconds)}</span>
            <button type="button" className="wall-iconbtn" aria-label="حذف ویس" onClick={discardVoice}>
              ✕
            </button>
          </div>
        )}

        <textarea
          className="wall-composer__input"
          rows={2}
          maxLength={1000}
          placeholder={`چیزی بنویسید برای شهر ${city.name}…`}
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

        {recording ? (
          <div className="wall-rec" data-testid="wall-recording">
            <span className="wall-rec__pulse" aria-hidden />
            <span className="wall-rec__time">در حال ضبط… {clock(recSeconds)}</span>
            <button type="button" className="wall-iconbtn" onClick={() => stopRecorder(false)}>
              انصراف
            </button>
            <button
              type="button"
              className="pill pill--accent"
              data-testid="wall-rec-stop"
              onClick={() => stopRecorder(true)}
            >
              پایان ضبط
            </button>
          </div>
        ) : (
          <div className="wall-composer__bar">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              aria-label="انتخاب تصویر"
              data-testid="wall-image"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
            {/* RIGHT side of the composer: the ad-post entry (moved out of the header + bottom nav) */}
            <Link
              href="/ads/new"
              className="wall-adbtn"
              data-testid="wall-ad-btn"
              title="ثبت آگهی در دیوار شهر"
            >
              <span aria-hidden>📝</span>
              <span className="wall-adbtn__label">ثبت آگهی</span>
            </Link>
            <div className="wall-composer__tools">
              <button type="button" className="pill" data-testid="wall-photo-btn" onClick={() => fileRef.current?.click()}>
                📷 {image ? 'عکس انتخاب شد' : 'عکس'}
              </button>
              <button type="button" className="pill" data-testid="wall-voice-btn" onClick={() => void startRecording()}>
                🎤 ویس
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="wall-send"
                disabled={sending || (!text.trim() && !image && !voice)}
                onClick={() => void send()}
              >
                {sending ? 'در حال ارسال…' : 'ارسال'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
