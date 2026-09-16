import conversationFilterReducer, {
  setFilters,
  resetFilters,
  selectFilters,
  defaultFilterState,
} from '../conversationFilterSlice';
import { RootState } from '@/store';

describe('conversationFilter reducer', () => {
  it('starts with a global activity-sorted queue on the default status scope', () => {
    expect(defaultFilterState).toEqual({
      assignee_type: 'all',
      status: 'open',
      sort_by: 'last_activity_at_desc',
      inbox_id: '0',
    });
  });

  it('migrates a persisted Mine filter while keeping the status and inbox choices', () => {
    const state = {
      conversationFilter: {
        filters: {
          assignee_type: 'me',
          status: 'resolved',
          sort_by: 'sort_on_priority',
          inbox_id: '9',
        },
      },
    } as RootState;

    expect(selectFilters(state)).toEqual({
      assignee_type: 'all',
      status: 'resolved',
      sort_by: 'last_activity_at_desc',
      inbox_id: '9',
    });
    // Reading filters never mutates the persisted state.
    expect(state.conversationFilter.filters.assignee_type).toBe('me');
  });

  it('returns an already-migrated filter set by reference so selectors stay memoized', () => {
    const state = {
      conversationFilter: { filters: { ...defaultFilterState, status: 'resolved' } },
    } as RootState;

    expect(selectFilters(state)).toBe(state.conversationFilter.filters);
  });

  it.each([
    { key: 'assignee_type' as const, value: 'me' },
    { key: 'sort_by' as const, value: 'sort_on_priority' },
  ])('prevents hidden $key controls from changing the queue', payload => {
    const state = conversationFilterReducer(undefined, setFilters(payload));
    expect(state.filters).toEqual(defaultFilterState);
  });

  it('applies the first user filter after migrating frozen legacy preferences', () => {
    const state = {
      filters: Object.freeze({
        assignee_type: 'me',
        status: 'open',
        sort_by: 'latest',
        inbox_id: '0',
      }),
    };
    expect(
      conversationFilterReducer(state, setFilters({ key: 'status', value: 'resolved' })).filters,
    ).toEqual({ ...defaultFilterState, status: 'resolved' });
  });

  it("keeps Chatwoot's default open status scope rather than forcing all statuses", () => {
    expect(defaultFilterState.status).toBe('open');
  });

  it('should return initial state', () => {
    expect(conversationFilterReducer(undefined, { type: '' })).toEqual({
      filters: defaultFilterState,
    });
  });

  describe('setFilters', () => {
    it('should update filter value for given key', () => {
      const initialState = {
        filters: defaultFilterState,
      };

      const nextState = conversationFilterReducer(
        initialState,
        setFilters({ key: 'status', value: 'resolved' }),
      );

      expect(nextState.filters.status).toBe('resolved');
      expect(nextState.filters.assignee_type).toBe(defaultFilterState.assignee_type);
      expect(nextState.filters.sort_by).toBe(defaultFilterState.sort_by);
      expect(nextState.filters.inbox_id).toBe(defaultFilterState.inbox_id);
    });
  });

  describe('resetFilters', () => {
    it('should reset filters to default state', () => {
      const modifiedState = {
        filters: {
          ...defaultFilterState,
          status: 'resolved',
          assignee_type: 'all',
        },
      };

      const nextState = conversationFilterReducer(modifiedState, resetFilters());

      expect(nextState.filters).toEqual(defaultFilterState);
    });
  });

  describe('selectFilters', () => {
    it('should return filters from state', () => {
      const mockState = {
        conversationFilter: {
          filters: defaultFilterState,
        },
      } as RootState;

      expect(selectFilters(mockState)).toEqual(defaultFilterState);
    });
  });
});
