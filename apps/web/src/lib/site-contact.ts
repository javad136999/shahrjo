/**
 * Public contact details provided by the site owner — the single source of
 * truth for every page that shows contact/support information («تماس با ما»).
 * Update values here only; pages must never restate them inline.
 *
 * These are contact details for display and support only. They are not
 * presented anywhere as identity/verification credentials (e.g. اینماد).
 */
const phone = '۰۹۰۲۵۴۳۳۶۶۵';

export const SITE_CONTACT = {
  /** Displayed number (Persian digits, LTR inside RTL layout). */
  phone,
  /** Clickable link so mobile visitors can call directly. */
  phoneHref: 'tel:09025433665',
  address: 'شهر جم',
} as const;
