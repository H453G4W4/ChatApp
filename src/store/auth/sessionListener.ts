// Tears down the realtime connection whenever a session ends, so no socket
// outlives the session that opened it.

import { createListenerMiddleware } from '@reduxjs/toolkit';
import actionCableConnector from '@/utils/actionCable';

export const sessionListenerMiddleware = createListenerMiddleware();

/**
 * `auth/logout` is dispatched from the settings screen and from the API layer's
 * 401 handler, and could grow more callers. Closing the socket here rather than
 * at each call site means a new one cannot forget to.
 *
 * The root reducer resets everything but `settings` on this action, so the
 * connector's `isCurrentSession` guard would already reject any late event;
 * this closes the connection itself rather than leaving it open against a
 * server the agent has left.
 */
sessionListenerMiddleware.startListening({
  type: 'auth/logout',
  effect: () => {
    actionCableConnector.close();
  },
});
