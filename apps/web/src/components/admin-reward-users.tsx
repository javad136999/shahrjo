'use client';

import { useEffect, useState } from 'react';
import { ApiError, getAdminRewardUsers, giveAdminReward } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { AdminRewardUser } from '@/lib/types';

interface AdminRewardUsersProps {
  canManage: boolean;
}

export function AdminRewardUsers({ canManage }: AdminRewardUsersProps) {
  const [users, setUsers] = useState<AdminRewardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    getAdminRewardUsers()
      .then((rows) => alive && setUsers(rows))
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : 'دریافت کاربران ممکن نشد'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const visible = users.filter((user) => {
    const q = query.trim();
    return !q || user.phone.includes(q) || (user.fullName ?? '').includes(q);
  });

  async function give(user: AdminRewardUser) {
    if (!canManage || user.rewardGiven || busyId !== null) return;
    setBusyId(user.id);
    setError(null);
    try {
      const result = await giveAdminReward(user.id);
      setUsers((rows) => rows.map((row) => row.id === user.id
        ? { ...row, rewardGiven: result.rewardGiven, rewardGivenAt: result.rewardGivenAt }
        : row));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت تحویل جایزه انجام نشد');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section id="admin-reward-users" className="admin-reward-users" data-testid="admin-reward-users">
      <div className="admin-reward-users__head">
        <div>
          <h2>شماره کاربران و پیگیری جایزه</h2>
          <p className="muted small">
            {users.length.toLocaleString('fa-IR')} شماره ثبت‌شده؛ شماره‌ها با وضعیت‌های مختلف حساب نمایش داده می‌شوند.
            {canManage ? ' بعد از تحویل جایزه، checkbox همان ردیف را بزنید.' : ' ثبت تحویل فقط برای مدیر کل و مدیر استان فعال است.'}
          </p>
        </div>
        <input
          className="admin-reward-users__search"
          aria-label="جستجوی شماره کاربر"
          placeholder="جستجوی شماره یا نام"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          inputMode="tel"
        />
      </div>
      {error && <p className="banner banner--error" role="alert">{error}</p>}
      {loading ? <p className="muted" aria-busy="true">در حال دریافت شماره‌ها…</p> : (
        <div className="admin-reward-users__table-wrap">
          <table className="admin-reward-users__table">
            <thead><tr><th>کاربر</th><th>شماره موبایل</th><th>شهر</th><th>تاریخ ثبت‌نام</th><th>جایزه تحویل شد</th></tr></thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.id}>
                  <td>{user.fullName || `کاربر ${user.id.toLocaleString('fa-IR')}`}</td>
                  <td dir="ltr">{user.phone}</td>
                  <td>{user.city?.name ?? '—'}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <label className={`admin-reward-users__check${user.rewardGiven ? ' is-given' : ''}`}>
                      <input
                        type="checkbox"
                        checked={user.rewardGiven}
                        disabled={user.rewardGiven || busyId !== null || !canManage}
                        aria-label={user.rewardGiven
                          ? `جایزه تحویل‌شده برای ${user.phone}`
                          : `ثبت تحویل جایزه برای ${user.phone}`}
                        onChange={() => void give(user)}
                        title={!canManage && !user.rewardGiven ? 'ثبت تحویل فقط برای مدیر کل و مدیر استان مجاز است' : undefined}
                      />
                      <span>{user.rewardGiven ? '✓ تحویل شد' : busyId === user.id ? 'در حال ثبت…' : 'ثبت تحویل'}</span>
                    </label>
                    {user.rewardGivenAt && <small className="admin-reward-users__date">{formatDate(user.rewardGivenAt)}</small>}
                  </td>
                </tr>
              ))}
              {!visible.length && <tr><td colSpan={5} className="muted">کاربری پیدا نشد.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
