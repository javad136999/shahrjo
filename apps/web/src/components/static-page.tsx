/** Shared shell for static content pages (about/privacy/terms/contact). */
import type { ReactNode } from 'react';

export function StaticPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <article className="content-card" style={{ padding: 20 }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '1.4rem' }}>{title}</h1>
      {lead ? (
        <p className="muted" style={{ marginTop: 0 }}>
          {lead}
        </p>
      ) : null}
      <div style={{ display: 'grid', gap: 12, lineHeight: 1.9, fontSize: '0.95rem' }}>
        {children}
      </div>
    </article>
  );
}
