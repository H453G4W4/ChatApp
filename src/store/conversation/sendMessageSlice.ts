import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Asset } from 'react-native-image-picker';
import { Message } from '@/types';
import { RootState } from '@/store';

interface SendMessageState {
  /**
   * Unsent text per conversation, so switching threads or stepping back to the
   * queue does not lose what the agent was typing. Local and in-memory only -
   * nothing is persisted to disk and nothing reaches the server.
   */
  drafts: Record<number, string>;
  isPrivateMessage: boolean;
  attachments: Asset[];
  quoteMessage: Message | null;
}

const initialState: SendMessageState = {
  drafts: {},
  isPrivateMessage: false,
  attachments: [],
  quoteMessage: null,
};

const sendMessageSlice = createSlice({
  name: 'sendMessage',
  initialState,
  reducers: {
    setMessageContent: (
      state,
      action: PayloadAction<{ conversationId: number; content: string }>,
    ) => {
      const { conversationId, content } = action.payload;
      if (content) {
        state.drafts[conversationId] = content;
      } else {
        // Keep the map free of empty strings so "has a draft" stays truthful.
        delete state.drafts[conversationId];
      }
    },
    togglePrivateMessage: (state, action: PayloadAction<boolean>) => {
      state.isPrivateMessage = action.payload;
    },
    updateAttachments: (state, action: PayloadAction<Asset[]>) => {
      state.attachments = [...state.attachments, ...action.payload];
    },
    deleteAttachment: (state, action: PayloadAction<number>) => {
      state.attachments.splice(action.payload, 1);
    },
    resetAttachments: state => {
      state.attachments = [];
    },
    setQuoteMessage: (state, action: PayloadAction<Message | null>) => {
      state.quoteMessage = action.payload;
    },
    /**
     * Clears the composer after a send. With a conversationId only that thread's
     * draft is dropped; without one (account switch) every draft goes, since
     * they belong to conversations the agent can no longer see.
     */
    resetSentMessage: (state, action: PayloadAction<{ conversationId?: number } | undefined>) => {
      state.attachments = [];
      state.quoteMessage = null;
      const conversationId = action.payload?.conversationId;
      if (conversationId === undefined) {
        state.drafts = {};
      } else {
        delete state.drafts[conversationId];
      }
    },
  },
});

/** The draft for one conversation; empty string when nothing is typed. */
export const selectMessageContent = (conversationId: number) => (state: RootState) =>
  state.sendMessage.drafts[conversationId] ?? '';

export const selectHasDraft = (conversationId: number) => (state: RootState) =>
  Boolean(state.sendMessage.drafts[conversationId]);
export const selectIsPrivateMessage = (state: RootState) => state.sendMessage.isPrivateMessage;
export const selectAttachments = (state: RootState) => state.sendMessage.attachments;
export const selectQuoteMessage = (state: RootState) => state.sendMessage.quoteMessage;

export const {
  setMessageContent,
  togglePrivateMessage,
  updateAttachments,
  deleteAttachment,
  resetAttachments,
  setQuoteMessage,
  resetSentMessage,
} = sendMessageSlice.actions;

export default sendMessageSlice.reducer;
