/**
 * Public contact details provided by the site owner — the single source of
 * truth for every page that shows contact/support information («تماس با ما»).
 * Update values here only; pages must never restate them inline.
 *
 * These are contact details for display and support only. They are not
 * presented anywhere as identity/verification credentials (e.g. اینماد).
 */
const phone = '09174057031';

export const SITE_CONTACT = {
  /** Displayed number (Latin digits, LTR inside RTL layout). */
  phone,
  /** Clickable link so mobile visitors can call directly. */
  phoneHref: `tel:${phone}`,
  address: 'استان فارس، شهر جم، خیابان فرهنگ ۱۲',
  postalCode: '7511764181',
} as const;
