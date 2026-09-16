import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import { startEmailConversation } from './newConversationActions';

/**
 * Chatwoot v4.17.1 does not use one error envelope, so all three real shapes are
 * read here (see `concerns/request_exception_handler.rb`):
 *
 *   { error: "..." }                      Pundit 401, RecordNotFound 404,
 *                                         ParameterMissing 422, and the
 *                                         controller's own 'source_id should be
 *                                         unique' 422
 *   { message: "...", attributes: [...] } RecordInvalid 422, e.g. a duplicate
 *                                         contact email
 *   { errors: ["..."] }                   the older envelope this app's
 *                                         ApiErrorResponse type describes
 *
 * Falling through to a generic string would hide the one thing the agent needs:
 * why the send was refused.
 */
const serverErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as { error?: unknown; message?: unknown; errors?: unknown };

  if (typeof body.error === 'string' && body.error.trim()) return body.error;
  if (typeof body.message === 'string' && body.message.trim()) return body.message;
  if (Array.isArray(body.errors)) {
    const first = body.errors.find(entry => typeof entry === 'string' && entry.trim());
    if (typeof first === 'string') return first;
  }
  return null;
};

export interface NewConversationState {
  isSubmitting: boolean;
  /** Server-reported failure for the last attempt, shown next to the send button. */
  error: string | null;
  /** Conversation id the server created, so the screen knows where to navigate. */
  createdConversationId: number | null;
}

const initialState: NewConversationState = {
  isSubmitting: false,
  error: null,
  createdConversationId: null,
};

const newConversationSlice = createSlice({
  name: 'newConversation',
  initialState,
  reducers: {
    resetNewConversation: () => initialState,
    clearNewConversationError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(startEmailConversation.pending, state => {
        state.isSubmitting = true;
        state.error = null;
        state.createdConversationId = null;
      })
      .addCase(startEmailConversation.fulfilled, (state, { payload }) => {
        state.isSubmitting = false;
        state.createdConversationId = payload.conversationId;
      })
      .addCase(startEmailConversation.rejected, (state, action) => {
        state.isSubmitting = false;
        // No conversation id is recorded on failure, so nothing fake is ever
        // navigated to or stored.
        state.createdConversationId = null;
        // A double tap is aborted by the thunk's `condition`, and RTK does not
        // dispatch that rejection, so this only ever runs for a real failure.
        state.error = serverErrorMessage(action.payload) ?? 'NEW_EMAIL.ERRORS.SEND_FAILED';
      });
  },
});

export const { resetNewConversation, clearNewConversationError } = newConversationSlice.actions;

export const selectIsSendingNewEmail = (state: RootState) => state.newConversation.isSubmitting;
export const selectNewConversationError = (state: RootState) => state.newConversation.error;
export const selectCreatedConversationId = (state: RootState) =>
  state.newConversation.createdConversationId;

export default newConversationSlice.reducer;
