'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ApiError,
  getConversationMessages,
  getConversations,
  getTokens,
  sendDirectMessage,
  startConversation,
} from '@/lib/api';
import type { DirectConversationSummary, DirectMessageItem } from '@/lib/types';
import { notifyPrivateMessagesRead } from '@/lib/message-read-state';

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

export function MessagesView() {
  const router = useRouter();
  const search = useSearchParams();
  const targetId = search.get('to');
  const requestedId = search.get('conversation');
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DirectMessageItem[] | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startingRef = useRef<string | null>(null);

  const active = useMemo(() => conversations.find((row) => row.id === activeId) ?? null, [conversations, activeId]);

  const loadInbox = useCallback(async () => {
    const rows = await getConversations();
    setConversations(rows);
    return rows;
  }, []);

  useEffect(() => {
    if (!getTokens()) {
      const next = `/messages${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    let alive = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await loadInbox();
        if (!alive) return;
        if (requestedId) {
          const id = Number(requestedId);
          if (Number.isInteger(id) && id > 0) setActiveId(id);
          else setError('شناسهٔ گفت‌وگو معتبر نیست.');
        } else if (targetId) {
          if (!/^\d+$/.test(targetId) || Number(targetId) < 1) {
            setError('کاربر مقصد معتبر نیست.');
          } else if (startingRef.current !== targetId) {
            startingRef.current = targetId;
            const conversation = await startConversation(Number(targetId));
            if (!alive) return;
            setActiveId(conversation.id);
            await loadInbox();
            router.replace(`/messages?conversation=${conversation.id}`, { scroll: false });
          }
        } else {
          setActiveId((current) => current ?? rows[0]?.id ?? null);
        }
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) {
          const next = `/messages${window.location.search}`;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
        } else {
          setError(err instanceof Error ? err.message : 'دریافت پیام‌ها ناموفق بود.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [loadInbox, requestedId, router, targetId]);

  useEffect(() => {
    if (!getTokens()) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadInbox().catch(() => {});
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [loadInbox]);

  useEffect(() => {
    if (!activeId || !getTokens()) {
      setMessages(null);
      return;
    }
    let alive = true;
    let running = false;
    let notifiedRead = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const rows = await getConversationMessages(activeId);
        if (alive) {
          setMessages(rows);
          setConversations((current) => current.map((row) => row.id === activeId ? { ...row, unreadCount: 0 } : row));
          if (!notifiedRead) {
            notifyPrivateMessagesRead();
            notifiedRead = true;
          }
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'دریافت گفت‌وگو ناموفق بود.');
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const choose = (id: number) => {
    setActiveId(id);
    setError(null);
    router.replace(`/messages?conversation=${id}`, { scroll: false });
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!activeId || !body || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await sendDirectMessage(activeId, body);
      setDraft('');
      setMessages((current) => [...(current ?? []), created]);
      await loadInbox();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ارسال پیام ناموفق بود.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="messages-page">
      <header className="messages-page__head">
        <div>
          <h1>پیام‌های خصوصی</h1>
          <p className="muted small">گفت‌وگوهای یک‌به‌یک شما با کاربران شهرجو</p>
        </div>
        <Link className="btn btn-ghost" href="/">خانه</Link>
      </header>

      {error && <div className="banner banner--error" role="alert">{error}</div>}

      <div className={`messages-inbox${activeId ? ' has-active' : ''}`}>
        <aside className="messages-list" aria-label="فهرست گفت‌وگوها">
          <div className="messages-list__head"><strong>گفت‌وگوها</strong><span>{conversations.length.toLocaleString('fa-IR')}</span></div>
          {loading && conversations.length === 0 ? (
            <p className="muted loading" aria-busy>در حال بارگذاری…</p>
          ) : conversations.length === 0 ? (
            <div className="messages-empty-list">
              <span aria-hidden>💬</span>
              <p>هنوز گفت‌وگوی خصوصی ندارید.</p>
              <small>از صفحهٔ یک کسب‌وکار، «پیام خصوصی» را بزنید تا گفت‌وگو را شروع کنید.</small>
            </div>
          ) : (
            <div className="messages-list__items">
              {conversations.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`messages-list-item${activeId === row.id ? ' is-active' : ''}`}
                  onClick={() => choose(row.id)}
                  aria-current={activeId === row.id ? 'true' : undefined}
                >
                  <span className="messages-avatar" aria-hidden>{row.person.name.trim().slice(0, 1) || 'ش'}</span>
                  <span className="messages-list-item__body">
                    <strong>{row.person.name}</strong>
                    <small>{row.lastMessage?.body ?? 'گفت‌وگو را شروع کنید'}</small>
                  </span>
                  <span className="messages-list-item__meta">
                    {row.lastMessage && <time>{timeLabel(row.lastMessage.createdAt)}</time>}
                    {row.unreadCount > 0 && <b className="messages-unread">{row.unreadCount > 99 ? '۹۹+' : row.unreadCount.toLocaleString('fa-IR')}</b>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="messages-thread" aria-label="گفت‌وگو">
          {activeId ? (
            <>
              <header className="messages-thread__head">
                <button type="button" className="messages-back" onClick={() => setActiveId(null)} aria-label="بازگشت به فهرست">←</button>
                <span className="messages-avatar" aria-hidden>{active?.person.name.trim().slice(0, 1) || 'ش'}</span>
                <div><strong>{active?.person.name ?? 'گفت‌وگوی خصوصی'}</strong><small>پیام‌ها فقط برای اعضای این گفت‌وگو نمایش داده می‌شوند</small></div>
              </header>
              <div className="messages-thread__body" aria-live="polite">
                {messages === null ? (
                  <p className="muted loading" aria-busy>در حال دریافت پیام‌ها…</p>
                ) : messages.length === 0 ? (
                  <div className="messages-thread__welcome"><span aria-hidden>👋</span><p>گفت‌وگو را با یک پیام کوتاه شروع کنید.</p></div>
                ) : messages.map((message) => (
                  <article key={message.id} className={`private-bubble${message.senderId === active?.person.id ? ' is-theirs' : ' is-mine'}`}>
                    <p>{message.body}</p>
                    <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
                  </article>
                ))}
                <div ref={bottomRef} />
              </div>
              <form className="messages-composer" onSubmit={(event) => void send(event)}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  aria-label="متن پیام خصوصی"
                  placeholder="پیامت را بنویس…"
                  disabled={sending}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button className="btn btn-primary" type="submit" disabled={sending || !draft.trim()}>{sending ? '…' : 'ارسال'}</button>
              </form>
            </>
          ) : (
            <div className="messages-thread__placeholder">
              <span aria-hidden>✉️</span>
              <h2>یک گفت‌وگو انتخاب کنید</h2>
              <p className="muted">پیام‌های خصوصی شما در این بخش نگهداری می‌شوند.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
