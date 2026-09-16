/**
 * Multi-instance safety: nothing from one Chatwoot installation or account may
 * survive into the next session.
 */
import { appReducer } from '@/store/reducers';
import { addConversation } from '@/store/conversation/conversationSlice';
import { setMessageContent } from '@/store/conversation/sendMessageSlice';
import { conversation } from '@/store/conversation/specs/conversationMockData';
import { conversationActions } from '@/store/conversation/conversationActions';
import actionCableConnector from '@/utils/actionCable';
import { sessionListenerMiddleware } from '../sessionListener';

// settingsSlice pulls in native permission/device/messaging modules via its
// actions; the store itself needs none of them.
jest.mock('react-native-permissions', () => jest.requireActual('react-native-permissions/mock'));
jest.mock('@react-native-firebase/messaging', () => jest.fn());
jest.mock('react-native-device-info', () => ({
  getSystemName: jest.fn(),
  getManufacturer: jest.fn(),
  getModel: jest.fn(),
  getApiLevel: jest.fn(),
  getBrand: jest.fn(),
  getBuildNumber: jest.fn(),
  getUniqueId: jest.fn(),
}));

jest.mock('@/utils/actionCable', () => ({
  __esModule: true,
  default: { init: jest.fn(), close: jest.fn(), isConnected: jest.fn() },
}));

/** Mirrors the root reducer in `store/index.ts`, which owns logout teardown. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rootReducer = (state: any, action: any) => {
  if (action.type === 'auth/logout') {
    const initialState = appReducer(undefined, { type: 'INIT' });
    return { ...initialState, settings: state.settings };
  }
  return appReducer(state, action);
};

const SCOPE = 'chat.example.com|1';

const loggedInState = () => {
  let state = appReducer(undefined, { type: 'INIT' });
  state = appReducer(state, addConversation(conversation));
  state = appReducer(
    state,
    setMessageContent({ scope: SCOPE, conversationId: conversation.id, content: 'Unsent' }),
  );
  return {
    ...state,
    settings: { ...state.settings, baseUrl: 'chat.example.com' },
    auth: {
      ...state.auth,
      user: { id: 11, account_id: 1, pubsub_token: 'token-a' },
      headers: { client: 'session-a', 'access-token': 'access-a', uid: 'a@example.com' },
    },
  };
};

describe('logout teardown', () => {
  it('clears every server-scoped slice while keeping the server address', () => {
    const before = loggedInState();
    expect(before.conversations.ids).toHaveLength(1);

    const after = rootReducer(before, { type: 'auth/logout' });

    // Conversations, contacts and drafts all belong to the session that ended.
    expect(after.conversations.ids).toEqual([]);
    expect(after.contacts.ids).toEqual([]);
    expect(after.sendMessage.drafts).toEqual({});
    expect(after.conversationFilter.filters).toEqual(
      appReducer(undefined, { type: 'INIT' }).conversationFilter.filters,
    );
    // The server address is deliberately kept so the next login prefills it.
    expect(after.settings.baseUrl).toBe('chat.example.com');
  });

  it('closes the realtime connection', () => {
    const close = jest.mocked(actionCableConnector.close);
    close.mockClear();

    // The listener is what guarantees this, whichever call site logs out.
    sessionListenerMiddleware.middleware({
      getState: () => loggedInState(),
      dispatch: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)(action => action)({ type: 'auth/logout' });

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('leaves no credentials behind for the next server', () => {
    const after = rootReducer(loggedInState(), { type: 'auth/logout' });

    expect(after.auth.user).toBeFalsy();
    expect(after.auth.headers).toBeFalsy();
  });
});

describe('requests still in flight when the session ends', () => {
  const listParams = {
    page: 1,
    status: 'open',
    assigneeType: 'all',
    sortBy: 'last_activity_at_desc',
  } as const;

  it('ignores a list response that arrives from the old server after logout', () => {
    // A pagination request is in flight when the agent logs out.
    let state = rootReducer(
      loggedInState(),
      conversationActions.fetchConversations.pending('in-flight', listParams),
    );
    state = rootReducer(state, { type: 'auth/logout' });

    // ...and its response lands against the fresh, logged-out store.
    state = rootReducer(
      state,
      conversationActions.fetchConversations.fulfilled(
        { conversations: [conversation], meta: { mineCount: 0, allCount: 1, unassignedCount: 0 } },
        'in-flight',
        listParams,
      ),
    );

    // The old installation's conversations must not repopulate the queue.
    expect(state.conversations.ids).toEqual([]);
  });

  // The single-conversation endpoint has no per-request marker in the reducer;
  // it is guarded at the API layer instead - see apiServiceSession.spec.ts.
});

describe('a fresh install assumes no server', () => {
  it('starts with empty server fields rather than a vendor default', () => {
    const { settings } = appReducer(undefined, { type: 'INIT' });

    expect(settings.baseUrl).toBe('');
    expect(settings.installationUrl).toBe('');
    expect(settings.webSocketUrl).toBe('');
  });
});
