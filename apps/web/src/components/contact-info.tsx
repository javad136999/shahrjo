import { SITE_CONTACT } from '@/lib/site-contact';

/**
 * Public contact block used by «تماس با ما»: tap-to-call phone and
 * selectable (copyable) address / postal code — Persian, RTL, mobile-first.
 */
export function ContactInfo() {
  return (
    <div className="contact-cards" data-testid="contact-info">
      <section className="contact-card">
        <h2>
          <span aria-hidden>📞</span> تماس تلفنی
        </h2>
        <a
          className="contact-card__phone"
          href={SITE_CONTACT.phoneHref}
          dir="ltr"
          data-testid="contact-phone"
        >
          {SITE_CONTACT.phone}
        </a>
        <p className="contact-card__hint">در موبایل کافی است روی شماره بزنید تا تماس برقرار شود.</p>
      </section>

      <section className="contact-card">
        <h2>
          <span aria-hidden>📍</span> نشانی
        </h2>
        <p className="contact-card__value" data-testid="contact-address">
          {SITE_CONTACT.address}
        </p>
        <p className="contact-card__hint">برای کپی، روی متن نگه دارید و «کپی» را انتخاب کنید.</p>
      </section>

      <section className="contact-card">
        <h2>
          <span aria-hidden>✉️</span> کد پستی
        </h2>
        <p className="contact-card__value contact-card__value--ltr" dir="ltr" data-testid="contact-postal">
          {SITE_CONTACT.postalCode}
        </p>
      </section>
    </div>
  );
}
