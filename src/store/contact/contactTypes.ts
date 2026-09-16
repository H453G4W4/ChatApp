import { Conversation } from '@/types';
export interface ContactLabelsAPIResponse {
  payload: string[];
}

export interface ContactLabelsPayload {
  contactId: number;
}

export interface UpdateContactLabelsPayload {
  contactId: number;
  labels: string[];
}

export interface ContactConversationPayload {
  contactId: number;
}

export interface ContactConversationAPIResponse {
  payload: Conversation[];
}

export interface SearchContactsPayload {
  q: string;
}

/** `GET contacts/search` — Chatwoot returns `{ meta, payload: [contact] }`. */
export interface SearchContactsAPIResponse {
  payload: unknown[];
}

export interface CreateContactPayload {
  inboxId: number;
  email: string;
  name?: string;
}

/**
 * `POST contacts` — Chatwoot wraps the record in `payload.contact`. Older and
 * patched installs have been seen returning `payload` directly, so the service
 * unwraps defensively rather than assuming one shape.
 */
export interface CreateContactAPIResponse {
  payload: { contact?: unknown } | unknown;
}
