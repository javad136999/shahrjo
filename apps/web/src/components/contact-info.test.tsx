import { render, screen } from '@testing-library/react';
import { ContactInfo } from '@/components/contact-info';
import { SITE_CONTACT } from '@/lib/site-contact';

/**
 * Contact block (تماس با ما). Assertions read the central source instead of
 * restating the phone/address/postal values, so the values exist in exactly
 * one place (lib/site-contact.ts).
 */
describe('ContactInfo', () => {
  it('renders a tappable tel: link from the central source', () => {
    render(<ContactInfo />);
    const link = screen.getByTestId('contact-phone');
    expect(link).toHaveAttribute('href', SITE_CONTACT.phoneHref);
    expect(link).toHaveAttribute('href', `tel:${SITE_CONTACT.phone}`);
    expect(link).toHaveTextContent(SITE_CONTACT.phone);
    // comfortable touch target for mobile (48px guideline)
    expect(link.className).toContain('contact-card__phone');
  });

  it('shows the address and postal code as selectable (copyable) text', () => {
    render(<ContactInfo />);
    expect(screen.getByTestId('contact-address')).toHaveTextContent(SITE_CONTACT.address);
    const postal = screen.getByTestId('contact-postal');
    expect(postal).toHaveTextContent(SITE_CONTACT.postalCode);
    expect(postal).toHaveAttribute('dir', 'ltr');
  });

  it('never presents the details as identity/verification credentials', () => {
    const { container } = render(<ContactInfo />);
    expect(container.textContent).not.toMatch(/اینماد|تأیید هویت|مجوز رسمی/);
  });
});
