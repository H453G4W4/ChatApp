import type { RootState } from '@/store';
import reducer, {
  realtimeConnected,
  realtimeDisconnected,
  realtimeReset,
  selectIsReconnecting,
  selectIsRealtimeConnected,
} from '../connectionSlice';

const asState = (connection: ReturnType<typeof reducer>) => ({ connection }) as RootState;

describe('realtime connection state', () => {
  it('starts disconnected and shows no banner on a cold start', () => {
    const state = reducer(undefined, { type: 'INIT' });

    expect(selectIsRealtimeConnected(asState(state))).toBe(false);
    // A slow first connect is not a lost connection.
    expect(selectIsReconnecting(asState(state))).toBe(false);
  });

  it('records a connection', () => {
    const state = reducer(undefined, realtimeConnected());

    expect(selectIsRealtimeConnected(asState(state))).toBe(true);
    expect(selectIsReconnecting(asState(state))).toBe(false);
  });

  it('surfaces the banner only after a connection has been lost', () => {
    let state = reducer(undefined, realtimeConnected());
    state = reducer(state, realtimeDisconnected());

    expect(selectIsReconnecting(asState(state))).toBe(true);
  });

  it('hides the banner again once the socket comes back', () => {
    let state = reducer(undefined, realtimeConnected());
    state = reducer(state, realtimeDisconnected());
    state = reducer(state, realtimeConnected());

    expect(selectIsReconnecting(asState(state))).toBe(false);
  });

  it('shows nothing after a deliberate close, which is not an outage', () => {
    let state = reducer(undefined, realtimeConnected());
    state = reducer(state, realtimeReset());

    expect(selectIsRealtimeConnected(asState(state))).toBe(false);
    expect(selectIsReconnecting(asState(state))).toBe(false);
  });
});
