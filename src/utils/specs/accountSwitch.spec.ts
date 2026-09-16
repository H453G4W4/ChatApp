import { switchAccount, resolveAccountSwitch } from '../accountUtils';
import { appReducer } from '@/store/reducers';
import { addConversation } from '@/store/conversation/conversationSlice';
import { setMessageContent } from '@/store/conversation/sendMessageSlice';
import { getFilteredConversations } from '@/store/conversation/conversationSelectors';
import { defaultFilterState } from '@/store/conversation/conversationFilterSlice';
import { conversation } from '@/store/conversation/specs/conversationMockData';
import { getStore } from '@/store/storeAccessor';
import type { RootState } from '@/store';

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
jest.mock('@/store/storeAccessor', () => ({ getStore: jest.fn() }));

const SCOPE = 'chat.example.com|1';

/** A signed-in session on account 1; switching is only possible while logged in. */
const signedIn = () => {
  const state = appReducer(undefined, { type: 'INIT' });
  return {
    ...state,
    auth: {
      ...state.auth,
      user: { id: 11, account_id: 1, accounts: [{ id: 1 }, { id: 2 }] },
    },
  } as ReturnType<typeof appReducer>;
};

/** Applies the actions switchAccount dispatches to a real reducer. */
const runSwitch = (state: ReturnType<typeof appReducer>, accountId: number) => {
  let next = state;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatch = ((action: any) => {
    next = appReducer(next, action);
    return action;
  }) as never;

  switchAccount(dispatch, accountId);
  return next;
};

describe('switching account', () => {
  it('clears the previous account’s queue, contacts and drafts', () => {
    let state = signedIn();
    state = appReducer(state, addConversation(conversation));
    state = appReducer(
      state,
      setMessageContent({ scope: SCOPE, conversationId: conversation.id, content: 'Unsent' }),
    );

    expect(
      getFilteredConversations(
        { conversations: state.conversations } as RootState,
        defaultFilterState,
      ),
    ).toHaveLength(1);

    const after = runSwitch(state, 2);

    // Conversation display ids repeat across accounts, so leaving any of this
    // behind would show account 1's data inside account 2.
    expect(after.conversations.ids).toEqual([]);
    expect(after.contacts.ids).toEqual([]);
    expect(after.sendMessage.drafts).toEqual({});
    expect(
      getFilteredConversations(
        { conversations: after.conversations } as RootState,
        defaultFilterState,
      ),
    ).toEqual([]);
  });

  it('resets the queue filters to the global defaults', () => {
    const after = runSwitch(signedIn(), 2);

    // Still the Phase 1 global queue: every assignee, latest activity first.
    expect(after.conversationFilter.filters.assignee_type).toBe('all');
    expect(after.conversationFilter.filters.sort_by).toBe('last_activity_at_desc');
    expect(after.conversationFilter.filters.status).toBe('open');
  });

  it('points the API scope at the newly selected account', () => {
    const after = runSwitch(signedIn(), 2);

    expect(after.auth.user?.account_id).toBe(2);
  });
});

describe('resolveAccountSwitch', () => {
  const withUser = (user: unknown) =>
    jest.mocked(getStore).mockReturnValue({ getState: () => ({ auth: { user } }) } as never);

  it('ignores a switch to the account already active', () => {
    withUser({ account_id: 1, accounts: [{ id: 1 }, { id: 2 }] });
    expect(resolveAccountSwitch(1)).toBeNull();
  });

  it('refuses an account the signed-in user does not belong to', () => {
    withUser({ account_id: 1, accounts: [{ id: 1 }] });
    expect(resolveAccountSwitch(99)).toBeNull();
  });

  it('allows a switch to another account the user belongs to', () => {
    withUser({ account_id: 1, accounts: [{ id: 1 }, { id: 2 }] });
    expect(resolveAccountSwitch(2)).toBe(2);
  });

  it('refuses any switch when nobody is signed in', () => {
    withUser(undefined);
    expect(resolveAccountSwitch(2)).toBeNull();
  });
});
