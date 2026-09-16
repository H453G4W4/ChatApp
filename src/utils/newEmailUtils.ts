import { EMAIL_REGEX } from '@/constants';
import type { Contact } from '@/types';
import type { Inbox } from '@/types/Inbox';
import { isAnEmailChannel } from '@/utils/inboxUtils';

export type NewEmailDraft = {
  inboxId: number | null;
  email: string;
  name?: string;
  subject: string;
  content: string;
};

export type NewEmailField = 'inboxId' | 'email' | 'subject' | 'content';

export type NewEmailErrors = Partial<Record<NewEmailField, string>>;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isValidEmail = (email: string) => EMAIL_REGEX.test(email.trim());

/**
 * The inboxes an agent may send a brand-new email from.
 *
 * This list comes straight from Chatwoot's authenticated inbox endpoint, so it
 * is already permission-scoped. It narrows that set to email channels because
 * only those can start a mail thread - it is a capability filter on a value the
 * agent picks, not a visibility gate on data the server returned.
 */
export const selectableEmailInboxes = (inboxes: Inbox[]) => inboxes.filter(isAnEmailChannel);

/**
 * Validates a draft before anything is sent.
 *
 * Subject is required because a brand-new thread has no mail subject to reply
 * under; Chatwoot stores it as `additional_attributes.mail_subject`.
 */
export const validateNewEmailDraft = (draft: NewEmailDraft, inboxes: Inbox[]): NewEmailErrors => {
  const errors: NewEmailErrors = {};
  const allowed = selectableEmailInboxes(inboxes);

  if (!draft.inboxId) {
    errors.inboxId = 'NEW_EMAIL.ERRORS.INBOX_REQUIRED';
  } else if (!allowed.some(inbox => inbox.id === draft.inboxId)) {
    // Either not an email channel, or not an inbox this agent was given.
    errors.inboxId = 'NEW_EMAIL.ERRORS.INBOX_NOT_ALLOWED';
  }

  if (!draft.email.trim()) {
    errors.email = 'NEW_EMAIL.ERRORS.EMAIL_REQUIRED';
  } else if (!isValidEmail(draft.email)) {
    errors.email = 'NEW_EMAIL.ERRORS.EMAIL_INVALID';
  }

  if (!draft.subject.trim()) {
    errors.subject = 'NEW_EMAIL.ERRORS.SUBJECT_REQUIRED';
  }

  if (!draft.content.trim()) {
    errors.content = 'NEW_EMAIL.ERRORS.CONTENT_REQUIRED';
  }

  return errors;
};

export const hasErrors = (errors: NewEmailErrors) => Object.keys(errors).length > 0;

/**
 * Picks the contact whose address actually matches, rather than trusting the
 * first search hit - Chatwoot's search also matches name, phone and identifier.
 */
export const findContactByEmail = (contacts: Contact[], email: string): Contact | undefined => {
  const target = normalizeEmail(email);
  return contacts.find(contact => contact.email && normalizeEmail(contact.email) === target);
};

/** Preselect when the agent has exactly one email inbox to send from. */
export const defaultEmailInboxId = (inboxes: Inbox[]): number | null => {
  const emailInboxes = selectableEmailInboxes(inboxes);
  return emailInboxes.length === 1 ? emailInboxes[0].id : null;
};
