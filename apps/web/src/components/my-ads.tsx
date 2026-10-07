import Link from 'next/link';
import { formatDate, formatPrice, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { MyAdItem } from '@/lib/types';

/** Persian labels for the moderation lifecycle. */
export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING: 'در انتظار تأیید',
  APPROVED: 'تأیید شده',
  REJECTED: 'رد شده',
  EXPIRED: 'منقضی',
  SOLD: 'فروخته شده',
  DELETED: 'حذف شده',
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={`status-chip status-chip--${status.toLowerCase()}`}>{STATUS_LABEL[status] ?? status}</span>
  );
}

/**
 * Owner's ad list with moderation status — shared by the submission form and
 * the profile page (Phase 6). Each row links to the ad detail page.
 */
export function MyAdsList({
  items,
  emptyText = 'هنوز آگهی ثبت نکرده‌اید.',
}: {
  items: MyAdItem[];
  emptyText?: string;
}) {
  if (items.length === 0) return <p className="empty-state">{emptyText}</p>;

  return (
    <ul className="my-ads__list">
      {items.map((ad) => (
        <li key={ad.id} data-testid={`my-ad-${ad.id}`}>
          <Link href={`/ad/${ad.id}`} className="my-ads__item">
            {ad.coverUrl && (
              // lists load the 400px thumbnail; detail pages fetch the full copy
              // eslint-disable-next-line @next/next/no-img-element -- remote media
              <img
                className="my-ads__cover"
                src={thumbUrlFor(ad.coverUrl) ?? ad.coverUrl}
                alt=""
                loading="lazy"
                onError={thumbFallback(ad.coverUrl)}
              />
            )}
            <div className="my-ads__body">
              <h3>{ad.title}</h3>
              <p className="price">{formatPrice(ad.price)}</p>
              <p className="muted small">
                <StatusChip status={ad.status} /> {formatDate(ad.createdAt)}
                {ad.imageCount > 0 && ` · ${ad.imageCount.toLocaleString('fa-IR')} تصویر`}
              </p>
              {ad.status === 'REJECTED' && ad.rejectedReason && (
                <p className="error small">علت رد: {ad.rejectedReason}</p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
