export const PRIVATE_MESSAGES_READ_EVENT = 'shahrjo:private-messages-read';

export function notifyPrivateMessagesRead(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PRIVATE_MESSAGES_READ_EVENT));
}
