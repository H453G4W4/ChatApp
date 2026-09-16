import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AxiosError } from 'axios';

import { ContactService } from '@/store/contact/contactService';
import { ConversationService } from '@/store/conversation/conversationService';
import { conversationActions } from '@/store/conversation/conversationActions';
import type { ApiErrorResponse } from '@/store/conversation/conversationTypes';
import { findContactByEmail, normalizeEmail } from '@/utils/newEmailUtils';
import type { NewConversationState } from './newConversationSlice';

export type StartEmailConversationPayload = {
  inboxId: number;
  email: string;
  name?: string;
  subject: string;
  content: string;
};

export type StartEmailConversationResult = {
  conversationId: number;
  contactId: number;
  /** True when this run created the contact rather than reusing an existing one. */
  createdContact: boolean;
};

/**
 * Starts an email thread with an address that may never have contacted us.
 *
 * The whole flow runs against Chatwoot's authenticated application API, which
 * stays the permission authority throughout:
 *
 *   1. `GET contacts/search?q=<email>`  - reuse an existing contact if the
 *      address already belongs to one.
 *   2. `POST contacts`                  - only when no contact owns that address.
 *   3. `POST conversations`             - Chatwoot finds or creates the
 *      ContactInbox, creates the conversation, and creates the first outgoing
 *      message, which is what sends the mail.
 *   4. `GET conversations/:id`          - re-read through the existing thunk so
 *      the conversation enters the store on the normal Phase 1 entity path.
 *
 * Nothing is written to the store before the server confirms the conversation,
 * so a 401/403/404/422 anywhere leaves no local row behind.
 */
export const startEmailConversation = createAsyncThunk<
  StartEmailConversationResult,
  StartEmailConversationPayload,
  // Only the slice this thunk actually reads is required, so any store that
  // mounts it - including a focused test store - satisfies the contract.
  { state: { newConversation: NewConversationState }; rejectValue: ApiErrorResponse }
>(
  'newConversation/startEmailConversation',
  async ({ inboxId, email, name, subject, content }, { dispatch, rejectWithValue }) => {
    const address = normalizeEmail(email);
    try {
      let contact = findContactByEmail(
        await ContactService.searchContacts({ q: address }),
        address,
      );
      const createdContact = !contact;

      if (!contact) {
        contact = await ContactService.createContact({ inboxId, email: address, name });
      }

      const { conversationId } = await ConversationService.createConversation({
        inboxId,
        contactId: contact.id,
        // Email inboxes key the contact_inbox on the address itself, so Chatwoot
        // reuses the existing thread when one already matches.
        sourceId: contact.email ? normalizeEmail(contact.email) : address,
        subject,
        content,
      });

      if (!conversationId) {
        return rejectWithValue({ success: false, errors: ['NEW_EMAIL.ERRORS.NO_CONVERSATION_ID'] });
      }

      // Re-read through the authenticated show endpoint so the store only ever
      // holds a server-owned conversation, with real message ids attached.
      await dispatch(conversationActions.fetchConversation(conversationId));

      return { conversationId, contactId: contact.id, createdContact };
    } catch (error) {
      const { response } = error as AxiosError<ApiErrorResponse>;
      if (!response) {
        throw error;
      }
      return rejectWithValue(response.data);
    }
  },
  {
    // Redux Toolkit skips the thunk entirely when this returns false, which is
    // the single guard against a double-tap creating two conversations.
    condition: (_payload, { getState }) => !getState().newConversation.isSubmitting,
  },
);

export const newConversationActions = {
  startEmailConversation,
};
