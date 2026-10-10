'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- client-side reporting only, no user data
    console.error('[shahrjo] page error', error.digest);
  }, [error]);

  return (
    <section className="auth-card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 44 }} aria-hidden>
        ⚠️
      </div>
      <h1 style={{ margin: '12px 0 4px' }}>خطایی رخ داد</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        مشکلی پیش آمد. دوباره تلاش کنید؛ اگر ادامه داشت کمی بعد مراجعه کنید.
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        تلاش دوباره
      </button>
    </section>
  );
}
