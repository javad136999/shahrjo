import type { Metadata } from 'next';
import { ContactInfo } from '@/components/contact-info';

export const metadata: Metadata = {
  title: 'تماس با ما',
  description: 'راه‌های تماس با پشتیبانی شهرجو؛ شماره تماس، نشانی و کد پستی',
};

/** «تماس با ما» — راه‌های ارتباطی پشتیبانی (منبع واحد: lib/site-contact). */
export default function ContactPage() {
  return (
    <div className="contact-page">
      <header className="contact-page__head">
        <h1>تماس با ما</h1>
        <p className="muted">برای هرگونه پرسش، پیشنهاد یا پیگیری، از راه‌های زیر با پشتیبانی شهرجو در تماس باشید.</p>
      </header>

      <ContactInfo />

      <p className="contact-page__note muted">
        این اطلاعات برای تماس و پشتیبانی کاربران درج شده است.
      </p>
    </div>
  );
}
