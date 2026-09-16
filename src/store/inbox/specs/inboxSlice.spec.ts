import reducer from '../inboxSlice';
import { inboxActions } from '../inboxActions';
import { inbox } from './inboxMockData';

describe('inbox reducer', () => {
  it('should return the initial state', () => {
    expect(reducer(undefined, { type: '' })).toEqual({
      ids: [],
      entities: {},
      isLoading: false,
    });
  });

  it('ignores stale success and failure after the current permission request completes', () => {
    let state = reducer(undefined, inboxActions.fetchInboxes.pending('old-account', undefined));
    state = reducer(state, inboxActions.fetchInboxes.pending('current-account', undefined));
    state = reducer(
      state,
      inboxActions.fetchInboxes.fulfilled({ payload: [inbox] }, 'current-account', undefined),
    );
    const confirmed = state;
    state = reducer(
      state,
      inboxActions.fetchInboxes.rejected(new Error('CanceledError'), 'old-account', undefined),
    );
    state = reducer(
      state,
      inboxActions.fetchInboxes.fulfilled({ payload: [] }, 'old-account', undefined),
    );
    expect(state).toEqual(confirmed);
    expect(state.ids).toEqual([inbox.id]);
  });

  it('keeps known inboxes when a refresh fails, since they are display metadata', () => {
    let state = reducer(undefined, inboxActions.fetchInboxes.pending('first', undefined));
    state = reducer(
      state,
      inboxActions.fetchInboxes.fulfilled({ payload: [inbox] }, 'first', undefined),
    );

    state = reducer(state, inboxActions.fetchInboxes.pending('refresh', undefined));
    state = reducer(
      state,
      inboxActions.fetchInboxes.rejected(new Error('Network error'), 'refresh', undefined),
    );

    // Blanking these would strip inbox names and channel icons off queue rows.
    // It must never be used to decide which conversations are visible.
    expect(state.ids).toEqual([inbox.id]);
    expect(state.isLoading).toBe(false);
  });
});
