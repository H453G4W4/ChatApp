import connector from '../actionCable';
import { store } from '@/store';
import { ConversationService } from '@/store/conversation/conversationService';
import reducer, { addConversation } from '@/store/conversation/conversationSlice';
import { getFilteredConversations } from '@/store/conversation/conversationSelectors';
import { defaultFilterState } from '@/store/conversation/conversationFilterSlice';
import { conversation } from '@/store/conversation/specs/conversationMockData';
import type { Conversation, Message } from '@/types';
import type { RootState } from '@/store';
import type { AnyAction } from '@reduxjs/toolkit';

jest.mock('@/store', () => ({ store: { getState: jest.fn(), dispatch: jest.fn() } }));
jest.mock('@/store/conversation/conversationService', () => ({
  ConversationService: { fetchConversation: jest.fn() },
}));
jest.mock('../baseActionCableConnector', () => ({
  __esModule: true,
  default: class {
    protected accountId: number;
    constructor(_token: string, _url: string, accountId: number) {
      this.accountId = accountId;
    }
    disconnect = jest.fn();
  },
}));

const event = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 20,
    account_id: 1,
    conversation_id: conversation.id,
    inbox_id: 1,
    created_at: 300,
    message_type: 0,
    content: 'Incoming from another agent’s conversation',
    conversation: { last_activity_at: 300, unread_count: 3, assignee_id: 42 },
    ...overrides,
  }) as unknown as Message;

const init = () =>
  connector.init({
    pubSubToken: 'socket-token',
    webSocketUrl: 'wss://example.test/cable',
    accountId: 1,
    userId: 11,
  });

const initialState = () => ({
  auth: {
    user: { id: 11, account_id: 1, pubsub_token: 'socket-token' },
    headers: { client: 'session-one', 'access-token': 'token' },
    accessToken: 'token',
  },
  inboxes: { ids: [1], entities: { 1: { id: 1 } } as Record<number, { id: number }> },
  conversations: reducer(undefined, { type: 'INIT' }),
});

describe('global queue socket handling', () => {
  let state = initialState();
  const fetchConversation = jest.mocked(ConversationService.fetchConversation);

  const queueIds = () =>
    getFilteredConversations(state as unknown as RootState, defaultFilterState).map(
      item => item.id,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    state = initialState();
    (store.getState as jest.Mock).mockImplementation(() => state);
    (store.dispatch as jest.Mock).mockImplementation((action: AnyAction) => {
      state.conversations = reducer(state.conversations, action);
      return action;
    });
  });

  it('updates an assigned conversation in one atomic dispatch without fetching', async () => {
    state.conversations = reducer(state.conversations, addConversation(conversation));
    await init().onMessageCreated(event());
    expect(store.dispatch).toHaveBeenCalledTimes(1);
    expect(fetchConversation).not.toHaveBeenCalled();
    expect(state.conversations.entities[conversation.id]!.unreadCount).toBe(3);
    expect(state.conversations.entities[conversation.id]!.lastActivityAt).toBe(300);
  });

  it('hydrates an unloaded conversation through the existing API and replays queued messages', async () => {
    let complete!: (value: { conversation: Conversation }) => void;
    fetchConversation.mockReturnValue(
      new Promise(resolve => {
        complete = resolve;
      }),
    );
    const cable = init();
    const loading = cable.onMessageCreated(event());
    await cable.onMessageCreated(
      event({
        id: 21,
        created_at: 400,
        content: 'Newest message during fetch',
        conversation: { last_activity_at: 400, unread_count: 4 },
      }),
    );
    expect(fetchConversation).toHaveBeenCalledTimes(1);
    expect(state.conversations.ids).toEqual([]);

    complete({ conversation });
    await loading;
    const loaded = state.conversations.entities[conversation.id]!;
    expect(loaded.meta.sender).toEqual(conversation.meta.sender);
    expect(loaded.lastNonActivityMessage?.content).toBe('Newest message during fetch');
    expect(loaded.lastActivityAt).toBe(400);
    expect(loaded.unreadCount).toBe(4);
  });

  it('places a freshly hydrated conversation at the top of the queue', async () => {
    state.conversations = reducer(
      state.conversations,
      addConversation({ ...conversation, id: 9001, lastActivityAt: 250 }),
    );
    fetchConversation.mockResolvedValue({ conversation: { ...conversation, lastActivityAt: 1 } });

    await init().onMessageCreated(event());

    expect(queueIds()).toEqual([conversation.id, 9001]);
    expect(state.conversations.entities[conversation.id]!.lastActivityAt).toBe(300);
  });

  it('never inserts an unloaded conversation when the server denies access', async () => {
    fetchConversation.mockRejectedValue({ response: { status: 403 } });
    await init().onMessageCreated(event());
    expect(fetchConversation).toHaveBeenCalledWith(conversation.id);
    expect(state.conversations.ids).toEqual([]);
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('hydrates a conversation whose inbox is not in the local inbox cache', async () => {
    // fetchInboxes has not resolved, or this inbox was added server-side after
    // the app loaded. The backend is the permission authority, so the event is
    // still resolved through the authenticated show endpoint.
    state.inboxes = { ids: [], entities: {} };
    fetchConversation.mockResolvedValue({ conversation: { ...conversation, inboxId: 9 } });

    await init().onMessageCreated(event({ inbox_id: 9 }));

    expect(fetchConversation).toHaveBeenCalledWith(conversation.id);
    expect(state.conversations.ids).toEqual([conversation.id]);
    expect(state.conversations.entities[conversation.id]!.lastActivityAt).toBe(300);
  });

  it('applies message events to a loaded conversation without any local inbox record', async () => {
    state.inboxes = { ids: [], entities: {} };
    state.conversations = reducer(state.conversations, addConversation(conversation));

    const cable = init();
    await cable.onMessageCreated(event());
    cable.onMessageUpdated(event({ content: 'Edited' }));

    expect(fetchConversation).not.toHaveBeenCalled();
    expect(state.conversations.entities[conversation.id]!.messages).toHaveLength(1);
    expect(state.conversations.entities[conversation.id]!.lastActivityAt).toBe(300);
  });

  it('never fetches a conversation that is already loaded', async () => {
    state.conversations = reducer(state.conversations, addConversation(conversation));
    const cable = init();

    await cable.onMessageCreated(event());
    await cable.onMessageCreated(event({ id: 21, created_at: 400 }));

    expect(fetchConversation).not.toHaveBeenCalled();
    expect(state.conversations.entities[conversation.id]!.messages).toHaveLength(2);
  });

  it('ignores events from another account', async () => {
    await init().onMessageCreated(event({ account_id: 2 }));
    expect(fetchConversation).not.toHaveBeenCalled();
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it.each(['account', 'session', 'connector'])(
    'discards hydration after a %s change',
    async change => {
      let complete!: (value: { conversation: Conversation }) => void;
      fetchConversation.mockReturnValue(
        new Promise(resolve => {
          complete = resolve;
        }),
      );
      const loading = init().onMessageCreated(event());
      if (change === 'account') state.auth.user.account_id = 2;
      if (change === 'session') state.auth.headers.client = 'session-two';
      if (change === 'connector') init();
      complete({ conversation });
      await loading;
      expect(state.conversations.ids).toEqual([]);
      expect(store.dispatch).not.toHaveBeenCalled();
    },
  );

  describe('session teardown', () => {
    it('rejects events from the old server once the session is cleared', async () => {
      state.conversations = reducer(state.conversations, addConversation(conversation));
      const cable = init();

      // What logout leaves behind: the root reducer has wiped auth.
      state.auth = { user: undefined, headers: undefined, accessToken: undefined } as never;

      await cable.onMessageCreated(event());
      cable.onMessageUpdated(event({ content: 'Edited after logout' }));

      expect(store.dispatch).not.toHaveBeenCalled();
      expect(fetchConversation).not.toHaveBeenCalled();
      expect(state.conversations.entities[conversation.id]!.messages).toEqual([]);
    });

    it('rejects events from a socket that was closed', async () => {
      state.conversations = reducer(state.conversations, addConversation(conversation));
      const cable = init();

      connector.close();
      (store.dispatch as jest.Mock).mockClear();

      // close() forgets the connector, so `currentConnector === this` fails and
      // a late callback from the closed socket cannot reach the store.
      await cable.onMessageCreated(event());

      expect(store.dispatch).not.toHaveBeenCalled();
      expect(state.conversations.entities[conversation.id]!.messages).toEqual([]);
      expect(connector.isConnected()).toBe(false);
    });

    it('rejects the old server’s events after reconnecting to a different one', async () => {
      state.conversations = reducer(state.conversations, addConversation(conversation));
      const oldServerCable = init();

      // A second install: new pubsub token and a new auth session.
      state.auth.user.pubsub_token = 'socket-token-two';
      state.auth.headers.client = 'session-two';
      init();

      await oldServerCable.onMessageCreated(event());

      expect(store.dispatch).not.toHaveBeenCalled();
      expect(state.conversations.entities[conversation.id]!.messages).toEqual([]);
    });

    it('opens a live connector again on the next login', () => {
      connector.close();
      expect(connector.isConnected()).toBe(false);

      init();

      expect(connector.isConnected()).toBe(true);
    });
  });

  it('does not inject a conversation the server reports as missing', async () => {
    fetchConversation.mockRejectedValue({ response: { status: 404 } });

    await init().onMessageCreated(event());

    expect(state.conversations.ids).toEqual([]);
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('does not increment unread for the agent’s own outgoing message', async () => {
    state.conversations = reducer(
      state.conversations,
      addConversation({ ...conversation, unreadCount: 0 }),
    );

    await init().onMessageCreated(
      event({
        message_type: 1,
        content: 'Reply from this agent',
        conversation: { last_activity_at: 300 },
      }),
    );

    const updated = state.conversations.entities[conversation.id]!;
    expect(updated.unreadCount).toBe(0);
    expect(updated.lastActivityAt).toBe(300);
  });

  it('rejects hydration that returns a different inbox', async () => {
    fetchConversation.mockResolvedValue({ conversation: { ...conversation, inboxId: 9 } });
    await init().onMessageCreated(event());
    expect(state.conversations.ids).toEqual([]);
  });
});
