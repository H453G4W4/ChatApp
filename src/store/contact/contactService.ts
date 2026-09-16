import { apiService } from '@/services/APIService';
import type {
  ContactLabelsAPIResponse,
  ContactLabelsPayload,
  UpdateContactLabelsPayload,
  ContactConversationAPIResponse,
  ContactConversationPayload,
  SearchContactsPayload,
  SearchContactsAPIResponse,
  CreateContactPayload,
  CreateContactAPIResponse,
} from './contactTypes';
import { transformConversation, transformContact } from '@/utils/camelCaseKeys';
import type { Contact } from '@/types';
import type { AxiosRequestConfig } from 'axios';

export class ContactService {
  static async getContactLabels(payload: ContactLabelsPayload) {
    const { contactId } = payload;
    const response = await apiService.get<ContactLabelsAPIResponse>(`contacts/${contactId}/labels`);
    return response.data;
  }

  static async updateContactLabels(
    payload: UpdateContactLabelsPayload,
  ): Promise<ContactLabelsAPIResponse> {
    const { contactId, labels } = payload;
    const response = await apiService.post<ContactLabelsAPIResponse>(
      `contacts/${contactId}/labels`,
      { labels },
    );
    return response.data;
  }

  /**
   * `GET contacts/search?q=` (Chatwoot application API).
   *
   * Matches name, identifier, email and phone number, and is account-scoped by
   * the authenticated session, so it only ever returns contacts this agent may
   * see. Used by the New Email recipient field.
   */
  static async searchContacts(
    payload: SearchContactsPayload,
    signal?: AbortSignal,
  ): Promise<Contact[]> {
    const response = await apiService.get<SearchContactsAPIResponse>('contacts/search', {
      params: { q: payload.q },
      signal,
    } as AxiosRequestConfig);
    const contacts = response.data?.payload ?? [];
    return contacts.map(transformContact);
  }

  /**
   * `POST contacts` (Chatwoot application API).
   *
   * `inbox_id` is documented as required and makes Chatwoot build the
   * ContactInbox up front; for an email channel the source id is the address.
   */
  static async createContact(payload: CreateContactPayload): Promise<Contact> {
    const { inboxId, email, name } = payload;
    const response = await apiService.post<CreateContactAPIResponse>('contacts', {
      inbox_id: inboxId,
      email,
      // Chatwoot shows the address itself when a contact has no name.
      ...(name ? { name } : {}),
    });
    const { payload: created } = response.data ?? {};
    const contact = (created as { contact?: unknown })?.contact ?? created;
    return transformContact(contact);
  }

  static async getContactConversations(
    payload: ContactConversationPayload,
  ): Promise<ContactConversationAPIResponse> {
    const { contactId } = payload;
    const response = await apiService.get<ContactConversationAPIResponse>(
      `contacts/${contactId}/conversations`,
    );
    const transformedResponse = response.data.payload.map(transformConversation);
    return {
      payload: transformedResponse,
    };
  }
}
