import type { RootState } from '@/store';
import type { Conversation } from '@/types';
import { getFilteredConversations, selectAllConversations } from '../conversationSelectors';
import { defaultFilterState } from '../conversationFilterSlice';
import { conversation } from './conversationMockData';
import reducer, { addConversation, receiveMessageCreated } from '../conversationSlice';
import type { Message } from '@/types';

const buildState = (entities: Record<number, Conversation | undefined>, inboxIds: number[] = [1]) =>
  ({
    conversations: {
      ids: Object.keys(entities).map(Number),
      entities,
    },
    // Present only so the rows can render an inbox name and channel icon. The
    // queue must never treat this cache as the permission authority.
    inboxes: {
      ids: inboxIds,
      entities: Object.fromEntries(inboxIds.map(id => [id, { id }])),
    },
  }) as unknown as RootState;

const ids = (state: RootState, filters = defaultFilterState) =>
  getFilteredConversations(state, filters).map(item => item.id);

describe('getFilteredConversations', () => {
  const mine = { ...conversation, id: 1 };

  it('skips ids without a record', () => {
    expect(
      getFilteredConversations(buildState({ 1: mine, 2: undefined }), defaultFilterState),
    ).toEqual([mine]);
  });

  it('keeps a conversation assigned to another agent visible', () => {
    const otherAgent = {
      ...conversation,
      id: 2,
      meta: { ...conversation.meta, assignee: { ...conversation.meta.assignee, id: 99 } },
    };

    expect(ids(buildState({ 1: mine, 2: otherAgent }))).toContain(2);
  });

  it('keeps an unassigned conversation visible', () => {
    const unassigned = {
      ...conversation,
      id: 3,
      meta: { ...conversation.meta, assignee: null },
    } as unknown as Conversation;

    expect(ids(buildState({ 1: mine, 3: unassigned }))).toContain(3);
  });

  it.each(['me', 'unassigned', 'all'])(
    'ignores a persisted %s assignee filter entirely',
    assigneeType => {
      const otherAgent = {
        ...conversation,
        id: 2,
        meta: { ...conversation.meta, assignee: { ...conversation.meta.assignee, id: 99 } },
      };
      const unassigned = {
        ...conversation,
        id: 3,
        meta: { ...conversation.meta, assignee: null },
      } as unknown as Conversation;
      const state = buildState({ 1: mine, 2: otherAgent, 3: unassigned });

      expect(ids(state, { ...defaultFilterState, assignee_type: assigneeType })).toEqual([3, 2, 1]);
    },
  );

  it('shows conversations from every inbox in one queue', () => {
    const second = { ...conversation, id: 2, inboxId: 2 };
    const third = { ...conversation, id: 3, inboxId: 7 };

    expect(ids(buildState({ 1: mine, 2: second, 3: third }, [1, 2, 7]))).toEqual([3, 2, 1]);
  });

  it('never hides a conversation because its inbox metadata has not loaded', () => {
    // fetchInboxes has not resolved yet, or the conversation's inbox is missing
    // from the local cache. The backend already authorized it, so it stays.
    const otherInbox = { ...conversation, id: 2, inboxId: 99, lastActivityAt: 100 };
    const state = buildState({ 1: mine, 2: otherInbox }, []);

    expect(ids(state)).toEqual([2, 1]);
  });

  it('still renders a conversation whose sender metadata is missing', () => {
    const withoutMeta = { ...conversation, id: 3, meta: undefined } as unknown as Conversation;

    expect(ids(buildState({ 1: mine, 3: withoutMeta }))).toEqual([3, 1]);
  });

  it('sorts by last_activity_at DESC', () => {
    const older = { ...conversation, id: 1, lastActivityAt: 10 };
    const newest = { ...conversation, id: 2, lastActivityAt: 30 };
    const middle = { ...conversation, id: 3, lastActivityAt: 20 };

    expect(ids(buildState({ 1: older, 2: newest, 3: middle }))).toEqual([2, 3, 1]);
  });

  it('breaks equal timestamps deterministically by id DESC', () => {
    const first = { ...conversation, id: 4, lastActivityAt: 10 };
    const second = { ...conversation, id: 11, lastActivityAt: 10 };
    const third = { ...conversation, id: 7, lastActivityAt: 10 };

    // Same result regardless of the order the entities were stored in.
    expect(ids(buildState({ 4: first, 11: second, 7: third }))).toEqual([11, 7, 4]);
    expect(ids(buildState({ 7: third, 4: first, 11: second }))).toEqual([11, 7, 4]);
  });

  it('never lets priority override latest activity', () => {
    const urgentButStale = { ...conversation, id: 1, lastActivityAt: 10, priority: 'urgent' };
    const lowButFresh = { ...conversation, id: 2, lastActivityAt: 30, priority: null };
    const highMiddle = { ...conversation, id: 3, lastActivityAt: 20, priority: 'high' };
    const state = buildState({
      1: urgentButStale as Conversation,
      2: lowButFresh as unknown as Conversation,
      3: highMiddle as Conversation,
    });

    // Even with the legacy priority sort persisted in the filters.
    expect(ids(state, { ...defaultFilterState, sort_by: 'sort_on_priority' })).toEqual([2, 3, 1]);
  });

  it('moves a loaded conversation to the top when a new message arrives', () => {
    const message = {
      id: 500,
      conversationId: 1,
      inboxId: 1,
      createdAt: 900,
      messageType: 0,
      content: 'Newest',
      conversation: { lastActivityAt: 900 },
    } as unknown as Message;

    let conversations = reducer(undefined, addConversation({ ...mine, lastActivityAt: 10 }));
    conversations = reducer(
      conversations,
      addConversation({ ...conversation, id: 2, lastActivityAt: 800 }),
    );
    const before = { conversations } as unknown as RootState;
    expect(ids(before)).toEqual([2, 1]);

    const after = {
      conversations: reducer(conversations, receiveMessageCreated(message)),
    } as unknown as RootState;
    expect(ids(after)).toEqual([1, 2]);
  });

  it('preserves the optional status and inbox filters', () => {
    const resolved = { ...conversation, id: 2, inboxId: 2, status: 'resolved' as const };
    const state = buildState({ 1: mine, 2: resolved }, [1, 2]);

    // The default queue keeps Chatwoot's open scope.
    expect(ids(state)).toEqual([1]);
    expect(ids(state, { ...defaultFilterState, status: 'all' })).toEqual([2, 1]);
    expect(ids(state, { ...defaultFilterState, status: 'resolved', inbox_id: '2' })).toEqual([2]);
  });

  it('leaves the memoized source array unsorted', () => {
    const older = { ...conversation, id: 1, lastActivityAt: 1 };
    const newer = { ...conversation, id: 2, lastActivityAt: 2 };
    const state = buildState({ 1: older, 2: newer });
    const source = selectAllConversations(state);

    getFilteredConversations(state, defaultFilterState);

    expect(source.map(({ id }) => id)).toEqual([1, 2]);
  });
});
