'use client';

import { useEffect, useState } from 'react';
import { ApiError, getAdminRewardUsers, giveAdminReward } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { AdminRewardUser } from '@/lib/types';

export function AdminRewardUsers() {
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
    if (user.rewardGiven || busyId !== null) return;
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
    <section className="admin-reward-users" data-testid="admin-reward-users">
      <div className="admin-reward-users__head">
        <div>
          <h2>🎁 کاربران و کارت شارژ</h2>
          <p className="muted small">فهرست کاربران فعال؛ پس از تحویل کارت، تیک همان ردیف را بزنید.</p>
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
      {loading ? <p className="muted">در حال دریافت کاربران…</p> : (
        <div className="admin-reward-users__table-wrap">
          <table className="admin-reward-users__table">
            <thead><tr><th>کاربر</th><th>شماره موبایل</th><th>شهر</th><th>تاریخ ورود</th><th>کارت شارژ</th></tr></thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.id}>
                  <td>{user.fullName || `کاربر ${user.id.toLocaleString('fa-IR')}`}</td>
                  <td dir="ltr">{user.phone}</td>
                  <td>{user.city?.name ?? '—'}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    {user.rewardGiven ? (
                      <span className="admin-reward-users__given" title={user.rewardGivenAt ? formatDate(user.rewardGivenAt) : undefined}>✓ تحویل شد</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary admin-reward-users__give"
                        disabled={busyId !== null}
                        onClick={() => void give(user)}
                      >
                        {busyId === user.id ? 'در حال ثبت…' : 'ثبت تحویل ✓'}
                      </button>
                    )}
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
