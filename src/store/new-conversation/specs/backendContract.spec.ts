/**
 * Regression tests pinned to the ACTUAL Chatwoot v4.17.1 source, not to docs.
 *
 * Traced files:
 *   app/controllers/api/v1/accounts/conversations_controller.rb
 *   app/controllers/api/v1/accounts/contacts_controller.rb
 *   app/builders/conversation_builder.rb
 *   app/builders/contact_inbox_builder.rb
 *   app/builders/messages/message_builder.rb
 *   app/views/api/v1/conversations/partials/_conversation.json.jbuilder
 *   app/views/api/v1/accounts/contacts/{search,create}.json.jbuilder
 *   app/services/base/send_on_channel_service.rb
 *   app/services/email/send_on_email_service.rb
 *   app/controllers/concerns/request_exception_handler.rb
 */
import { configureStore } from '@reduxjs/toolkit';

import { ConversationService } from '@/store/conversation/conversationService';
import { ContactService } from '@/store/contact/contactService';
import { apiService } from '@/services/APIService';
import conversationReducer from '@/store/conversation/conversationSlice';
import newConversationReducer from '../newConversationSlice';
import { newConversationActions } from '../newConversationActions';

jest.mock('@/services/APIService', () => ({
  apiService: { get: jest.fn(), post: jest.fn() },
}));

const get = jest.mocked(apiService.get);
const post = jest.mocked(apiService.post);

const DISPLAY_ID = 42;

/** The exact contact shape from `api/v1/models/_contact.json.jbuilder`. */
const rawContact = {
  id: 907,
  name: 'Ada Lovelace',
  // Chatwoot downcases contact.email in `prepare_email_attribute`.
  email: 'ada@example.com',
  phone_number: null,
  identifier: null,
  thumbnail: '',
  additional_attributes: {},
  custom_attributes: {},
  created_at: 1700000000,
  last_activity_at: 1700000000,
};

/**
 * `conversations/create.json.jbuilder` renders the SAME partial as `show`, so a
 * create returns a complete conversation. `json.id` is the display_id.
 */
const rawCreatedConversation = {
  meta: {
    sender: rawContact,
    channel: 'Channel::Email',
    hmac_verified: false,
  },
  id: DISPLAY_ID,
  messages: [
    {
      id: 5001,
      content: 'Hello there',
      message_type: 1,
      private: false,
      created_at: 1700000000,
      conversation_id: DISPLAY_ID,
      inbox_id: 7,
      source_id: null,
      status: 'sent',
      attachments: [],
      content_attributes: {},
    },
  ],
  account_id: 1,
  uuid: 'a-uuid',
  additional_attributes: { mail_subject: 'Invoice question' },
  agent_last_seen_at: 0,
  assignee_last_seen_at: 0,
  can_reply: true,
  contact_last_seen_at: 0,
  custom_attributes: {},
  inbox_id: 7,
  labels: [],
  muted: false,
  snoozed_until: null,
  status: 'open',
  created_at: 1700000000,
  updated_at: 1700000000.0,
  timestamp: 1700000000.0,
  first_reply_created_at: 0,
  unread_count: 0,
  last_non_activity_message: null,
  last_activity_at: 1700000000.0,
  priority: null,
  waiting_since: 0,
  sla_policy_id: null,
};

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

const lastPostBody = () =>
  (post.mock.calls.at(-1) as unknown as [string, Record<string, unknown>])[1];

describe('POST conversations — real v4.17.1 contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the conversation id out of the full conversation the server returns', async () => {
    post.mockResolvedValue({ data: rawCreatedConversation } as never);

    const result = await ConversationService.createConversation({
      inboxId: 7,
      contactId: rawContact.id,
      sourceId: 'ada@example.com',
      subject: 'Invoice question',
      content: 'Hello there',
    });

    // `json.id` is display_id, which is what GET conversations/:id looks up
    // (`find_by!(display_id:)`) and what the Phase 1 store is keyed on.
    expect(result).toEqual({ conversationId: DISPLAY_ID, inboxId: 7 });
  });

  it('never sends a message source_id, which would stop the email being dispatched', async () => {
    post.mockResolvedValue({ data: rawCreatedConversation } as never);

    await ConversationService.createConversation({
      inboxId: 7,
      contactId: rawContact.id,
      sourceId: 'ada@example.com',
      subject: 'Invoice question',
      content: 'Hello there',
    });

    // Base::SendOnChannelService#invalid_message? returns true when
    // message.source_id is present, which would skip Email::SendOnEmailService.
    const message = lastPostBody().message as Record<string, unknown>;
    expect(message).toEqual({ content: 'Hello there' });
    expect(message).not.toHaveProperty('source_id');
    expect(message).not.toHaveProperty('private');
    // message_type is omitted so MessageBuilder's 'outgoing' default applies.
    expect(message).not.toHaveProperty('message_type');
  });

  it('stores the subject where ConversationReplyMailer#mail_subject reads it', async () => {
    post.mockResolvedValue({ data: rawCreatedConversation } as never);

    await ConversationService.createConversation({
      inboxId: 7,
      contactId: rawContact.id,
      sourceId: 'ada@example.com',
      subject: 'Invoice question',
      content: 'Hello there',
    });

    // ConversationBuilder passes additional_attributes straight onto the record.
    expect(lastPostBody().additional_attributes).toEqual({ mail_subject: 'Invoice question' });
  });
});

describe('contacts endpoints — real v4.17.1 envelopes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('parses the search envelope, which carries meta alongside payload', async () => {
    get.mockResolvedValue({
      data: {
        meta: { count: 1, current_page: 1, has_more: false },
        payload: [rawContact],
      },
    } as never);

    const contacts = await ContactService.searchContacts({ q: 'ada@example.com' });

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ id: 907, email: 'ada@example.com' });
  });

  it('parses the create envelope, which nests the contact beside contact_inbox', async () => {
    post.mockResolvedValue({
      data: {
        payload: {
          contact: rawContact,
          contact_inbox: { inbox: { id: 7 }, source_id: 'ada@example.com' },
        },
      },
    } as never);

    const contact = await ContactService.createContact({
      inboxId: 7,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });

    expect(contact).toMatchObject({ id: 907, email: 'ada@example.com' });
  });
});

describe('end-to-end New Email against the real contract', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    store = makeStore();
  });

  const searchReturns = (contacts: unknown[]) =>
    get.mockImplementation((url: string) => {
      if (url === 'contacts/search') {
        return Promise.resolve({
          data: {
            meta: { count: contacts.length, current_page: 1, has_more: false },
            payload: contacts,
          },
        }) as never;
      }
      // GET conversations/:id — the Phase 1 hydration read.
      return Promise.resolve({ data: rawCreatedConversation }) as never;
    });

  it('reuses an existing contact and sends the address as source_id', async () => {
    searchReturns([rawContact]);
    post.mockResolvedValue({ data: rawCreatedConversation } as never);

    const result = await store.dispatch(newConversationActions.startEmailConversation(payload));

    expect(newConversationActions.startEmailConversation.fulfilled.match(result)).toBe(true);
    // Only one POST: the conversation. No contact was created.
    expect(post).toHaveBeenCalledTimes(1);
    expect(lastPostBody()).toMatchObject({
      inbox_id: 7,
      contact_id: rawContact.id,
      // ContactInboxBuilder#email_source_id uses contact.email, which Chatwoot
      // stores downcased — so the lowercased address hits the same ContactInbox
      // and `first_or_create!` reuses it instead of creating a duplicate.
      source_id: 'ada@example.com',
    });
  });

  it('creates a contact for a brand-new address, then the conversation', async () => {
    searchReturns([]);
    post.mockImplementation((url: string) => {
      if (url === 'contacts') {
        return Promise.resolve({
          data: {
            payload: {
              contact: rawContact,
              contact_inbox: { inbox: { id: 7 }, source_id: 'ada@example.com' },
            },
          },
        }) as never;
      }
      return Promise.resolve({ data: rawCreatedConversation }) as never;
    });

    await store.dispatch(newConversationActions.startEmailConversation(payload));

    const [contactCall, conversationCall] = post.mock.calls as unknown as [
      string,
      Record<string, unknown>,
    ][][];
    expect(contactCall[0]).toBe('contacts');
    // inbox_id makes the controller build the ContactInbox up front; the
    // conversation create would find-or-create the same one anyway.
    expect(contactCall[1]).toEqual({ inbox_id: 7, email: 'ada@example.com', name: undefined });
    expect(conversationCall[0]).toBe('conversations');
  });

  it('hydrates the real server conversation through the Phase 1 entity path', async () => {
    searchReturns([rawContact]);
    post.mockResolvedValue({ data: rawCreatedConversation } as never);

    await store.dispatch(newConversationActions.startEmailConversation(payload));

    const stored = store.getState().conversations.entities[DISPLAY_ID];
    expect(stored?.id).toBe(DISPLAY_ID);
    expect(stored?.inboxId).toBe(7);
    expect(stored?.additionalAttributes).toMatchObject({ mailSubject: 'Invoice question' });
    expect(stored?.meta?.sender?.email).toBe('ada@example.com');
  });

  it.each([
    [
      'Pundit 401',
      401,
      { error: 'You are not authorized to do this action' },
      'You are not authorized to do this action',
    ],
    [
      'RecordNotFound 404',
      404,
      { error: 'Resource could not be found' },
      'Resource could not be found',
    ],
    [
      'RecordInvalid 422',
      422,
      { message: 'Email has already been taken', attributes: ['email'] },
      'Email has already been taken',
    ],
    [
      'source_id clash 422',
      422,
      { error: 'source_id should be unique' },
      'source_id should be unique',
    ],
  ])(
    'surfaces the real %s error body and creates nothing locally',
    async (_label, status, body, expected) => {
      searchReturns([rawContact]);
      post.mockRejectedValue({ response: { status, data: body } });

      const result = await store.dispatch(newConversationActions.startEmailConversation(payload));

      expect(newConversationActions.startEmailConversation.rejected.match(result)).toBe(true);
      // The agent sees Chatwoot's own reason, not a generic fallback.
      expect(store.getState().newConversation.error).toBe(expected);
      expect(store.getState().conversations.ids).toEqual([]);
      expect(store.getState().newConversation.createdConversationId).toBeNull();
    },
  );

  it('falls back to a translatable message when the body carries no reason', async () => {
    searchReturns([rawContact]);
    post.mockRejectedValue({ response: { status: 500, data: {} } });

    await store.dispatch(newConversationActions.startEmailConversation(payload));

    expect(store.getState().newConversation.error).toBe('NEW_EMAIL.ERRORS.SEND_FAILED');
  });

  it('keeps the send locked while one attempt is still in flight', async () => {
    searchReturns([rawContact]);
    let release!: () => void;
    post.mockReturnValue(
      new Promise(resolve => {
        release = () => resolve({ data: rawCreatedConversation } as never);
      }) as never,
    );

    const first = store.dispatch(newConversationActions.startEmailConversation(payload));
    await store.dispatch(newConversationActions.startEmailConversation(payload));

    // RTK does not dispatch a condition rejection, so the in-flight state holds.
    expect(store.getState().newConversation.isSubmitting).toBe(true);
    expect(store.getState().newConversation.error).toBeNull();

    release();
    await first;
    // Exactly one conversation POST — no duplicate conversation or contact.
    expect(post.mock.calls.filter(([url]) => url === 'conversations')).toHaveLength(1);
  });
});
