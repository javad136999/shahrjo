import { render, screen } from '@testing-library/react';
import { ContactInfo } from '@/components/contact-info';
import { SITE_CONTACT } from '@/lib/site-contact';

/**
 * Contact block (تماس با ما). Assertions read the central source instead of
 * restating the phone/address values, so they exist in exactly one place.
 */
describe('ContactInfo', () => {
  it('renders a tappable tel: link from the central source', () => {
    render(<ContactInfo />);
    expect(SITE_CONTACT.phone).toBe('۰۹۰۲۵۴۳۳۶۶۵');
    expect(SITE_CONTACT.phoneHref).toBe('tel:09025433665');
    expect(SITE_CONTACT.address).toBe(String.fromCodePoint(0x62c, 0x645));
    const link = screen.getByTestId('contact-phone');
    expect(link).toHaveAttribute('href', SITE_CONTACT.phoneHref);
    expect(link).toHaveTextContent(SITE_CONTACT.phone);
    // comfortable touch target for mobile (48px guideline)
    expect(link.className).toContain('contact-card__phone');
  });

  it('shows only the requested city as the selectable address', () => {
    render(<ContactInfo />);
    expect(screen.getByTestId('contact-address')).toHaveTextContent(SITE_CONTACT.address);
    expect(screen.queryByTestId('contact-postal')).not.toBeInTheDocument();
  });

  it('never presents the details as identity/verification credentials', () => {
    const { container } = render(<ContactInfo />);
    expect(container.textContent).not.toMatch(/اینماد|تأیید هویت|مجوز رسمی/);
  });
});
