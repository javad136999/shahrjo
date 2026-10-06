'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ApiError,
  createWallPost,
  deleteWallPost,
  getWall,
  likeWallPost,
  pinWallPost,
  uploadImage,
} from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { WallFeed, WallPost } from '@/lib/types';

export interface WallViewProps {
  city: { id: number; slug: string; name: string };
}

const POLL_MS = 10_000;

/**
 * دیوار شهر (Phase 8b) — JamCity-style members' feed: chat-like cards with
 * avatar/time, likes, one-level replies, image posts, an operator-pinned
 * banner, and a composer. The feed auto-refreshes by polling (realtime comes
 * with the chat phase). A 401 renders the login gate instead of the feed.
 */
export function WallView({ city }: WallViewProps) {
  const [feed, setFeed] = useState<WallFeed | null>(null);
  const [gate, setGate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<WallPost | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // polling — cheap fallback until the WebSocket chat phase lands
  useEffect(() => {
    if (gate) return;
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load, gate]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      let imageIds: number[] | undefined;
      if (image) {
        const up = await uploadImage(image);
        imageIds = [up.id];
      }
      await createWallPost({ cityId: city.id, content, replyToId: replyTo?.id, imageIds });
      setText('');
      setImage(null);
      setReplyTo(null);
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

  const renderPost = (post: WallPost, pinnedBanner = false) => (
    <article
      key={post.id}
      className={`wall-post${post.isPinned ? ' wall-post--pinned' : ''}`}
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

        <p className="wall-post__text">{post.content}</p>

        {post.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- remote media
          <img className="wall-post__image" src={post.imageUrl} alt="" loading="lazy" />
        )}

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
          {pinnedBanner && <span className="wall-post__pinbadge">📌 سنجاق‌شده</span>}
        </div>
      </div>
    </article>
  );

  return (
    <div className="wall" data-testid="wall">
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

      {feed.nextBefore && (
        <button type="button" className="btn btn-ghost wall-more" onClick={() => void loadOlder()} disabled={loadingOlder}>
          {loadingOlder ? 'در حال بارگذاری…' : 'پیام‌های قدیمی‌تر'}
        </button>
      )}

      <div className="wall-feed">
        {feed.posts.length === 0 ? (
          <p className="empty-state">هنوز پیامی در دیوار شهر نیست — اولین نفر باشید.</p>
        ) : (
          feed.posts.map((post) => renderPost(post))
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
        <div className="wall-composer__bar">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            aria-label="انتخاب تصویر"
            data-testid="wall-image"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="pill" onClick={() => fileRef.current?.click()}>
            📷 {image ? 'تصویر انتخاب شد' : 'عکس'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="wall-send"
            disabled={sending || !text.trim()}
            onClick={() => void send()}
          >
            {sending ? 'در حال ارسال…' : 'ارسال پیام'}
          </button>
        </div>
      </div>
    </div>
  );
}
