'use client';

import { useEffect, useState } from 'react';
import { ApiError, getAdminRewardUsers, giveAdminReward } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { AdminRewardUser } from '@/lib/types';

interface AdminRewardUsersProps {
  canManage: boolean;
}

const PAGE_SIZE = 25;

function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 && code <= 0x06f9 ? code - 0x06f0 : code - 0x0660);
  });
}

function normalizeText(value: string): string {
  return normalizeDigits(value)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLocaleLowerCase('fa-IR')
    .trim();
}

export function AdminRewardUsers({ canManage }: AdminRewardUsersProps) {
  const [users, setUsers] = useState<AdminRewardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    getAdminRewardUsers()
      .then((rows) => alive && setUsers(rows))
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : 'دریافت کاربران ممکن نشد'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const normalizedQuery = normalizeText(query);
  const queryDigits = normalizedQuery.replace(/\D/g, '');
  const visible = users.filter((user) => {
    if (!normalizedQuery) return true;
    const name = normalizeText(user.fullName ?? '');
    const phone = normalizeDigits(user.phone).replace(/\D/g, '');
    return name.includes(normalizedQuery) || (queryDigits.length > 0 && phone.includes(queryDigits));
  });
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageUsers = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const deliveredCount = users.filter((user) => user.rewardGiven).length;
  const rangeStart = visible.length ? currentPage * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min((currentPage + 1) * PAGE_SIZE, visible.length);

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
    <details id="admin-reward-users" className="admin-reward-users" data-testid="admin-reward-users">
      <summary className="admin-reward-users__summary" data-testid="admin-reward-users-toggle">
        <span className="admin-reward-users__icon" aria-hidden="true">☎</span>
        <span className="admin-reward-users__summary-copy">
          <strong>شماره کاربران و پیگیری جایزه</strong>
          <small>
            {loading ? 'در حال دریافت آمار…' : `${users.length.toLocaleString('fa-IR')} کاربر · ${deliveredCount.toLocaleString('fa-IR')} جایزه تحویل‌شده`}
          </small>
        </span>
        <span className="admin-reward-users__chevron" aria-hidden="true">⌄</span>
      </summary>

      <div className="admin-reward-users__content">
        <div className="admin-reward-users__toolbar">
          <p className="muted small">
            {canManage ? 'پس از تحویل جایزه، همان ردیف را ثبت کنید.' : 'ثبت تحویل جایزه فقط برای مدیر کل و مدیر استان فعال است.'}
          </p>
          <input
            className="admin-reward-users__search"
            aria-label="جستجوی شماره کاربر"
            data-testid="admin-reward-users-search"
            placeholder="جستجوی شماره یا نام"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            inputMode="tel"
          />
        </div>

        {error && <p className="banner banner--error" role="alert">{error}</p>}
        {loading ? <p className="muted admin-reward-users__loading" aria-busy="true">در حال دریافت شماره‌ها…</p> : (
          <>
            <div className="admin-reward-users__table-wrap">
              <table className="admin-reward-users__table">
                <thead>
                  <tr><th>کاربر</th><th>شماره موبایل</th><th>شهر</th><th>عضویت</th><th>جایزه</th></tr>
                </thead>
                <tbody>
                  {pageUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.fullName || `کاربر ${user.id.toLocaleString('fa-IR')}`}</td>
                      <td dir="ltr" className="admin-reward-users__phone">{user.phone}</td>
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
                          <span>{user.rewardGiven ? 'تحویل شد' : busyId === user.id ? 'در حال ثبت…' : 'ثبت تحویل'}</span>
                        </label>
                        {user.rewardGivenAt && <small className="admin-reward-users__date">{formatDate(user.rewardGivenAt)}</small>}
                      </td>
                    </tr>
                  ))}
                  {!visible.length && <tr><td colSpan={5} className="muted">کاربری پیدا نشد.</td></tr>}
                </tbody>
              </table>
            </div>

            {visible.length > PAGE_SIZE && (
              <div className="admin-reward-users__pagination" aria-label="صفحه‌بندی کاربران">
                <span data-testid="admin-reward-users-range">
                  {rangeStart.toLocaleString('fa-IR')} تا {rangeEnd.toLocaleString('fa-IR')} از {visible.length.toLocaleString('fa-IR')}
                </span>
                <div>
                  <button
                    type="button"
                    className="admin-reward-users__page-button"
                    data-testid="admin-reward-users-prev"
                    disabled={currentPage === 0}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                  >قبلی</button>
                  <span>{(currentPage + 1).toLocaleString('fa-IR')} / {pageCount.toLocaleString('fa-IR')}</span>
                  <button
                    type="button"
                    className="admin-reward-users__page-button"
                    data-testid="admin-reward-users-next"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  >بعدی</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
