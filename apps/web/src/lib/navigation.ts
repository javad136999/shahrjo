/** Full-page navigation helper (mockable in tests — jsdom's window.location is unforgeable). */
export function redirectTo(url: string): void {
  window.location.assign(url);
}
