import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

export interface ConnectionState {
  /**
   * Whether the ActionCable socket is currently up.
   *
   * Starts false and is set by the connector's own connect/disconnect
   * callbacks - there is no polling. It drives a passive indicator only; the
   * queue keeps whatever it has loaded while the socket is down.
   */
  isRealtimeConnected: boolean;
  /** False until the first connect, so a cold start shows no "reconnecting". */
  hasEverConnected: boolean;
}

const initialState: ConnectionState = {
  isRealtimeConnected: false,
  hasEverConnected: false,
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    realtimeConnected: state => {
      state.isRealtimeConnected = true;
      state.hasEverConnected = true;
    },
    realtimeDisconnected: state => {
      state.isRealtimeConnected = false;
    },
    /** Logout and account switch close the socket deliberately. */
    realtimeReset: () => initialState,
  },
});

export const { realtimeConnected, realtimeDisconnected, realtimeReset } = connectionSlice.actions;

export const selectIsRealtimeConnected = (state: RootState) => state.connection.isRealtimeConnected;

/**
 * Only surfaced after a connection has been established at least once, so the
 * banner marks a lost connection rather than a slow first connect.
 */
export const selectIsReconnecting = (state: RootState) =>
  state.connection.hasEverConnected && !state.connection.isRealtimeConnected;

export default connectionSlice.reducer;
