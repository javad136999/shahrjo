'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPublicProfile } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { PublicProfile } from '@/lib/types';

export interface UserProfileModalProps {
  userId: number;
  onClose: () => void;
}

/**
 * Public profile card (tap a username/avatar on the city wall): avatar,
 * display name, city and «شروع چت خصوصی», which opens the private chat
 * page for that user. Own account shows a note instead of the chat action.
 */
export function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const router = useRouter();
  /** undefined = loading, null = not found */
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setProfile(undefined);
    (async () => {
      try {
        const data = await getPublicProfile(userId);
        if (alive) setProfile(data);
      } catch {
        if (alive) setProfile(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startChat = () => {
    onClose();
    router.push(`/messages?peer=${userId}`);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- overlay dismiss
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="پروفایل کاربر"
      data-testid="user-profile-modal"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- keep click inside */}
      <div className="modal-card" data-testid="user-profile-card" onClick={(e) => e.stopPropagation()}>
        {profile === undefined && <p className="modal-card__loading">در حال بارگذاری…</p>}

        {profile === null && (
          <>
            <p className="modal-card__error">کاربر یافت نشد.</p>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              بستن
            </button>
          </>
        )}

        {profile && (
          <div className="profile-card">
            <span className="profile-card__avatar" aria-hidden>
              {profile.avatarUrl && !profile.avatarUrl.startsWith('emoji:') ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote media
                <img src={profile.avatarUrl} alt="" />
              ) : (
                (profile.fullName ?? 'ک').slice(0, 1)
              )}
            </span>
            <h3 className="profile-card__name" data-testid="profile-card-name">
              {profile.fullName ?? 'کاربر شهر'}
            </h3>
            <p className="profile-card__meta">
              {[
                profile.cityName,
                profile.memberSince ? `عضو از ${timeAgo(profile.memberSince)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {profile.isSelf ? (
              <p className="profile-card__self">این حساب، حساب خود شماست.</p>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                data-testid="profile-start-chat"
                onClick={startChat}
              >
                💬 شروع چت خصوصی
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              بستن
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
