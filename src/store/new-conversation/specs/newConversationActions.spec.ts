import { configureStore } from '@reduxjs/toolkit';

import { ContactService } from '@/store/contact/contactService';
import { ConversationService } from '@/store/conversation/conversationService';
import conversationReducer from '@/store/conversation/conversationSlice';
import newConversationReducer from '../newConversationSlice';
import { newConversationActions } from '../newConversationActions';
import { conversation } from '@/store/conversation/specs/conversationMockData';
import type { Contact } from '@/types';

jest.mock('@/store/contact/contactService', () => ({
  ContactService: { searchContacts: jest.fn(), createContact: jest.fn() },
}));
jest.mock('@/store/conversation/conversationService', () => ({
  ConversationService: { createConversation: jest.fn(), fetchConversation: jest.fn() },
}));

const searchContacts = jest.mocked(ContactService.searchContacts);
const createContact = jest.mocked(ContactService.createContact);
const createConversation = jest.mocked(ConversationService.createConversation);
const fetchConversation = jest.mocked(ConversationService.fetchConversation);

const existingContact = { id: 42, name: 'Ada', email: 'ada@example.com' } as Contact;

const makeStore = () =>
  configureStore({
    reducer: { conversations: conversationReducer, newConversation: newConversationReducer },
    middleware: getDefault => getDefault({ serializableCheck: false }),
  });

const payload = {
  inboxId: 7,
  email: 'Ada@Example.com',
  subject: 'Invoice question',
  content: 'Hello there',
};

describe('startEmailConversation', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    store = makeStore();
    createConversation.mockResolvedValue({ conversationId: conversation.id, inboxId: 7 });
    fetchConversation.mockResolvedValue({ conversation });
  });

  it('reuses an existing contact whose address matches the recipient', async () => {
    searchContacts.mockResolvedValue([existingContact]);

    const result = await store.dispatch(newConversationActions.startEmailConversation(payload));

    expect(searchContacts).toHaveBeenCalledWith({ q: 'ada@example.com' });
    expect(createContact).not.toHaveBeenCalled();
    expect(newConversationActions.startEmailConversation.fulfilled.match(result)).toBe(true);
    expect(result.payload).toMatchObject({ contactId: 42, createdContact: false });
  });

  it('creates a contact for an address that has never contacted us', async () => {
    searchContacts.mockResolvedValue([]);
    createContact.mockResolvedValue({ ...existingContact, id: 99 });

    const result = await store.dispatch(
      newConversationActions.startEmailConversation({ ...payload, name: 'Ada Lovelace' }),
    );

    expect(createContact).toHaveBeenCalledWith({
      inboxId: 7,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });
    expect(result.payload).toMatchObject({ contactId: 99, createdContact: true });
  });

  it('does not reuse a search hit that matched on something other than the address', async () => {
    // Chatwoot search also matches names, so a near-miss must still create.
    searchContacts.mockResolvedValue([
      { id: 5, name: 'Ada Other', email: 'different@example.com' } as Contact,
    ]);
    createContact.mockResolvedValue({ ...existingContact, id: 99 });

    await store.dispatch(newConversationActions.startEmailConversation(payload));

    expect(createContact).toHaveBeenCalled();
  });

  it('sends from the chosen inbox with the subject as the mail subject', async () => {
    searchContacts.mockResolvedValue([existingContact]);

    await store.dispatch(newConversationActions.startEmailConversation(payload));

    expect(createConversation).toHaveBeenCalledWith({
      inboxId: 7,
      contactId: 42,
      sourceId: 'ada@example.com',
      subject: 'Invoice question',
      content: 'Hello there',
    });
  });

  it('re-reads the conversation through the authenticated show endpoint', async () => {
    searchContacts.mockResolvedValue([existingContact]);

    await store.dispatch(newConversationActions.startEmailConversation(payload));

    // The store only ever holds a server-owned conversation, with real ids.
    expect(fetchConversation).toHaveBeenCalledWith(conversation.id);
    expect(store.getState().conversations.entities[conversation.id]?.id).toBe(conversation.id);
    expect(store.getState().newConversation.createdConversationId).toBe(conversation.id);
  });

  it('prevents a double send while one attempt is in flight', async () => {
    searchContacts.mockResolvedValue([existingContact]);
    let release!: () => void;
    createConversation.mockReturnValue(
      new Promise(resolve => {
        release = () => resolve({ conversationId: conversation.id, inboxId: 7 });
      }),
    );

    const first = store.dispatch(newConversationActions.startEmailConversation(payload));
    const second = await store.dispatch(newConversationActions.startEmailConversation(payload));

    // The second dispatch is refused by the thunk's `condition`, not queued.
    expect(newConversationActions.startEmailConversation.rejected.match(second)).toBe(true);
    expect(second.meta).toMatchObject({ condition: true });

    release();
    await first;
    expect(createConversation).toHaveBeenCalledTimes(1);
    expect(createContact).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 422])('does not create a local conversation on a %s', async status => {
    searchContacts.mockResolvedValue([existingContact]);
    createConversation.mockRejectedValue({
      response: { status, data: { success: false, errors: ['Denied'] } },
    });

    const result = await store.dispatch(newConversationActions.startEmailConversation(payload));

    expect(newConversationActions.startEmailConversation.rejected.match(result)).toBe(true);
    expect(store.getState().conversations.ids).toEqual([]);
    expect(store.getState().newConversation.createdConversationId).toBeNull();
    expect(store.getState().newConversation.error).toBe('Denied');
    expect(fetchConversation).not.toHaveBeenCalled();
  });

  it('never creates a conversation when contact creation is denied', async () => {
    searchContacts.mockResolvedValue([]);
    createContact.mockRejectedValue({
      response: { status: 422, data: { success: false, errors: ['Email is invalid'] } },
    });

    const result = await store.dispatch(newConversationActions.startEmailConversation(payload));

    expect(newConversationActions.startEmailConversation.rejected.match(result)).toBe(true);
    expect(createConversation).not.toHaveBeenCalled();
    expect(store.getState().conversations.ids).toEqual([]);
  });

  it('refuses to report success when the server returns no conversation id', async () => {
    searchContacts.mockResolvedValue([existingContact]);
    createConversation.mockResolvedValue({ conversationId: undefined as unknown as number });

    const result = await store.dispatch(newConversationActions.startEmailConversation(payload));

    expect(newConversationActions.startEmailConversation.rejected.match(result)).toBe(true);
    expect(fetchConversation).not.toHaveBeenCalled();
    expect(store.getState().conversations.ids).toEqual([]);
  });

  it('clears the submitting flag so the agent can retry after a failure', async () => {
    searchContacts.mockResolvedValue([existingContact]);
    createConversation.mockRejectedValueOnce({
      response: { status: 500, data: { success: false, errors: ['Boom'] } },
    });

    await store.dispatch(newConversationActions.startEmailConversation(payload));
    expect(store.getState().newConversation.isSubmitting).toBe(false);

    createConversation.mockResolvedValue({ conversationId: conversation.id, inboxId: 7 });
    const retry = await store.dispatch(newConversationActions.startEmailConversation(payload));

    expect(newConversationActions.startEmailConversation.fulfilled.match(retry)).toBe(true);
  });
});
