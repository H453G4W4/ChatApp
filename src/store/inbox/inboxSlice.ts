import { createSlice, createEntityAdapter } from '@reduxjs/toolkit';
import type { Inbox } from '@/types/Inbox';
import { inboxActions } from './inboxActions';

export const inboxAdapter = createEntityAdapter<Inbox>();

export interface InboxState {
  isLoading: boolean;
  currentRequestId?: string;
}

const initialState = inboxAdapter.getInitialState<InboxState>({
  isLoading: false,
});

const inboxSlice = createSlice({
  name: 'inbox',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(inboxActions.fetchInboxes.pending, (state, action) => {
        state.isLoading = true;
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(inboxActions.fetchInboxes.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        const { payload: inboxes } = action.payload;
        inboxAdapter.setAll(state, inboxes);
        state.isLoading = false;
        state.currentRequestId = undefined;
      })
      .addCase(inboxActions.fetchInboxes.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        // Inboxes are display metadata (name, channel icon), not a permission
        // gate, so a failed refresh keeps the last known records rather than
        // blanking the queue rows.
        state.isLoading = false;
        state.currentRequestId = undefined;
      });
  },
});

export default inboxSlice.reducer;
