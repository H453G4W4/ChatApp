// Conversation Filter Slice is used to manage the filters for the conversations screen

import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ConversationFilterOptions } from '@/types';
import type { RootState } from '@/store';

export type FilterState = Record<ConversationFilterOptions, string>;

export const defaultFilterState: FilterState = {
  // One global queue: assignment never controls visibility, and ordering is
  // always latest activity first. Status keeps Chatwoot's default 'open' scope.
  assignee_type: 'all',
  status: 'open',
  sort_by: 'last_activity_at_desc',
  inbox_id: '0',
};

interface ConversationFilterState {
  filters: FilterState;
}

const initialState: ConversationFilterState = {
  filters: defaultFilterState,
};

// Existing installations persisted a "Mine" assignee filter and a sort choice.
// Those two keys no longer exist in the queue, so they are pinned to the global
// values here. The agent's status and inbox choices are left untouched, and an
// already-migrated state is returned by reference so selectors stay memoized.
const globalQueueFilters = (filters: FilterState): FilterState =>
  filters.assignee_type === defaultFilterState.assignee_type &&
  filters.sort_by === defaultFilterState.sort_by
    ? filters
    : {
        ...filters,
        assignee_type: defaultFilterState.assignee_type,
        sort_by: defaultFilterState.sort_by,
      };

const conversationFilterSlice = createSlice({
  name: 'conversationFilter',
  initialState,
  reducers: {
    setFilters: (
      state,
      action: PayloadAction<{ key: ConversationFilterOptions; value: string }>,
    ) => {
      const { key, value } = action.payload;
      state.filters = globalQueueFilters(state.filters);
      if (key === 'status' || key === 'inbox_id') {
        state.filters[key] = value;
      }
    },
    resetFilters: state => {
      state.filters = defaultFilterState;
    },
  },
});

export const { setFilters, resetFilters } = conversationFilterSlice.actions;

export const selectFilters = createSelector(
  [(state: RootState) => state.conversationFilter.filters],
  globalQueueFilters,
);

export default conversationFilterSlice.reducer;
