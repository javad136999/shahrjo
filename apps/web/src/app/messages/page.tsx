'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DM_CHANGED_EVENT,
  getDmMessages,
  getTokens,
  listDmConversations,
  sendDmMessage,
  startDm,
  uploadImage,
} from '@/lib/api';
import { UserProfileModal } from '@/components/user-profile-modal';
import { timeAgo } from '@/lib/format';
import type { DmConversation, DmMessage } from '@/lib/types';

/** Chat cadence: light polling keeps the thread live without a WS stack. */
const POLL_MS = 5_000;

/** Peer avatar block (photo, emoji avatar, or the first letter). */
function DmAvatar({ user }: { user: { fullName: string | null; avatarUrl: string | null } }) {
  return (
    <span className="dm-list__avatar" aria-hidden>
      {user.avatarUrl && !user.avatarUrl.startsWith('emoji:') ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote media
        <img src={user.avatarUrl} alt="" />
      ) : (
        (user.fullName ?? 'ک').slice(0, 1)
      )}
    </span>
  );
}

function MessagesBody() {
  const router = useRouter();
  const params = useSearchParams();
  const peer = params.get('peer');

  /** null = auth still being checked */
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [convos, setConvos] = useState<DmConversation[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<{ id: number; url: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // tapped peer avatar/name → public profile card
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const active = convos?.find((c) => c.id === activeId) ?? null;

  // auth gate (wall-style): no tokens → login prompt
  useEffect(() => {
    setAuthed(Boolean(getTokens()));
  }, []);

  const loadConvos = useCallback(async () => {
    try {
      const list = await listDmConversations();
      setConvos(list);
    } catch {
      setConvos((prev) => prev ?? []);
    }
  }, []);

  // inbox refresh: on load, every poll tick, and on window focus
  useEffect(() => {
    if (!authed) return;
    void loadConvos();
    const timer = setInterval(() => void loadConvos(), POLL_MS);
    const onFocus = () => void loadConvos();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [authed, loadConvos]);

  // deep link `/messages?peer=<id>` (from a wall username tap) → open the chat
  useEffect(() => {
    if (!authed || !peer) return;
    const userId = Number(peer);
    if (!Number.isFinite(userId) || userId <= 0) {
      router.replace('/messages');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const convo = await startDm(userId);
        if (!alive) return;
        setActiveId(convo.id);
        void loadConvos();
      } catch {
        if (alive) setError('باز کردن گفتگو ناموفق بود');
      } finally {
        if (alive) router.replace('/messages');
      }
    })();
    return () => {
      alive = false;
    };
  }, [authed, peer, router, loadConvos]);

  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      const page = await getDmMessages(conversationId);
      setMessages(page.messages);
      setNextBefore(page.nextBefore);
      // opening the thread marks it read server-side → refresh the nav badge now
      window.dispatchEvent(new Event(DM_CHANGED_EVENT));
    } catch {
      // keep the previous page on transient errors
    }
  }, []);

  // thread refresh while open (the GET also marks the conversation read)
  useEffect(() => {
    if (activeId === null) return;
    void loadMessages(activeId);
    const timer = setInterval(() => void loadMessages(activeId), POLL_MS);
    return () => clearInterval(timer);
  }, [activeId, loadMessages]);

  // keep the newest message in view
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const loadOlder = async () => {
    if (activeId === null || !nextBefore) return;
    try {
      const page = await getDmMessages(activeId, nextBefore);
      setMessages((prev) => [...page.messages, ...prev]);
      setNextBefore(page.nextBefore);
    } catch {
      // ignore transient pagination errors
    }
  };

  const pickImage = async (file: File) => {
    try {
      const uploaded = await uploadImage(file);
      setPendingImage({ id: uploaded.id, url: uploaded.url });
    } catch {
      setError('آپلود تصویر ناموفق بود');
    }
  };

  const send = async () => {
    if (activeId === null) return;
    const body = text.trim();
    if (!body && !pendingImage) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendDmMessage(activeId, {
        ...(body ? { body } : {}),
        ...(pendingImage ? { imageId: pendingImage.id } : {}),
      });
      setMessages((prev) => [...prev, msg]);
      setText('');
      setPendingImage(null);
      void loadConvos();
      window.dispatchEvent(new Event(DM_CHANGED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال پیام ناموفق بود');
    } finally {
      setSending(false);
    }
  };

  if (authed === null) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری…
      </p>
    );
  }

  if (!authed) {
    return (
      <div className="dm-gate" data-testid="dm-gate">
        <span className="dm-gate__icon" aria-hidden>
          🔒
        </span>
        <h1>پیام‌های خصوصی</h1>
        <p className="muted">برای دیدن و ارسال پیام خصوصی، وارد حساب خود شوید.</p>
        <Link href="/login?next=/messages" className="btn btn-primary">
          ورود با موبایل
        </Link>
      </div>
    );
  }

  return (
    <div className={`dm-page${active ? ' dm-page--chat' : ''}`} data-testid="dm-page">
      <aside className="dm-list" aria-label="مکالمات">
        <header className="dm-list__head">
          <h1>پیام‌ها</h1>
        </header>
        {convos === null && (
          <p className="muted loading" aria-busy>
            در حال بارگذاری…
          </p>
        )}
        {convos?.length === 0 && (
          <p className="dm-list__empty" data-testid="dm-empty">
            هنوز مکالمه‌ای ندارید. روی نام یا تصویر کاربران در دیوار شهر بزنید تا گفتگوی خصوصی شروع شود.
          </p>
        )}
        {convos?.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`dm-list__item${c.id === activeId ? ' is-active' : ''}`}
            onClick={() => setActiveId(c.id)}
            data-testid={`dm-item-${c.id}`}
          >
            <DmAvatar user={c.peer} />
            <span className="dm-list__copy">
              <strong>{c.peer.fullName ?? 'کاربر شهر'}</strong>
              <small className="dm-list__preview">
                {c.lastMessage?.imageUrl && !c.lastMessage.body
                  ? '📷 تصویر'
                  : (c.lastMessage?.body ?? 'هنوز پیامی نیست')}
              </small>
            </span>
            <span className="dm-list__side">
              {c.lastMessageAt && <time>{timeAgo(c.lastMessageAt)}</time>}
              {c.unreadCount > 0 && (
                <span className="dm-badge" data-testid={`dm-item-badge-${c.id}`}>
                  {c.unreadCount}
                </span>
              )}
            </span>
          </button>
        ))}
      </aside>

      <section className="dm-thread" aria-label="مکالمه">
        {!active ? (
          <p className="dm-thread__placeholder muted" data-testid="dm-placeholder">
            یک مکالمه را انتخاب کنید.
          </p>
        ) : (
          <>
            <header className="dm-thread__head">
              <button
                type="button"
                className="dm-back"
                aria-label="بازگشت به لیست مکالمات"
                onClick={() => setActiveId(null)}
              >
                →
              </button>
              <button
                type="button"
                className="dm-thread__peer"
                onClick={() => setProfileUserId(active.peer.id)}
                data-testid="dm-thread-peer"
                aria-label="نمایش پروفایل طرف مقابل"
              >
                <DmAvatar user={active.peer} />
                <strong className="dm-thread__name" data-testid="dm-thread-name">
                  {active.peer.fullName ?? 'کاربر شهر'}
                </strong>
              </button>
            </header>

            <div className="dm-thread__messages" ref={threadRef} data-testid="dm-messages">
              {nextBefore && (
                <button type="button" className="dm-more" onClick={loadOlder}>
                  بارگذاری پیام‌های قبل‌تر
                </button>
              )}
              {messages.length === 0 && (
                <p className="muted dm-thread__empty">هنوز پیامی نیست؛ اولین پیام را بنویسید.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`dm-bubble${m.senderId === active.peer.id ? '' : ' dm-bubble--mine'}`}
                  data-testid={`dm-bubble-${m.id}`}
                >
                  {m.body && <p>{m.body}</p>}
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- remote media
                    <img className="dm-bubble__img" src={m.imageUrl} alt="" loading="lazy" />
                  )}
                  <time>{timeAgo(m.createdAt)}</time>
                </div>
              ))}
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="dm-composer">
              {pendingImage && (
                <div className="dm-composer__chip" data-testid="dm-image-chip">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded preview */}
                  <img src={pendingImage.url} alt="" />
                  <button type="button" aria-label="حذف تصویر" onClick={() => setPendingImage(null)}>
                    ✕
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                hidden
                ref={fileRef}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void pickImage(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="dm-iconbtn"
                aria-label="افزودن تصویر"
                onClick={() => fileRef.current?.click()}
              >
                📷
              </button>
              <input
                className="dm-composer__input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send();
                }}
                placeholder="پیام خصوصی…"
                aria-label="متن پیام"
                data-testid="dm-input"
              />
              <button
                type="button"
                className="btn btn-primary dm-send"
                disabled={sending || (!text.trim() && !pendingImage)}
                onClick={() => void send()}
                data-testid="dm-send"
              >
                ارسال
              </button>
            </div>
          </>
        )}
      </section>

      {profileUserId !== null && (
        <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </div>
  );
}

/** پیام‌های خصوصی (Phase 11): inbox + 1:1 thread, started from the city wall. */
export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesBody />
    </Suspense>
  );
}
