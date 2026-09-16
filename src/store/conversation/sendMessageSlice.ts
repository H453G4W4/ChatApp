import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Asset } from 'react-native-image-picker';
import { Message } from '@/types';
import { RootState } from '@/store';

interface SendMessageState {
  /**
   * Unsent text, so switching threads or stepping back to the queue does not
   * lose what the agent was typing.
   *
   * The whole root reducer is persisted through redux-persist, so these survive
   * an app restart. That makes the key matter: conversation display ids restart
   * per account, so a bare id would show account A's draft inside account B's
   * conversation of the same number. Keys are therefore scoped by server and
   * account - see `draftKey`. Nothing here is ever sent to the server.
   */
  drafts: Record<string, string>;
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

/**
 * Identifies which installation and account a draft belongs to. Drafts outlive
 * the app process, so the key has to survive a restart into a different
 * account or a different Chatwoot server.
 */
export const selectDraftScope = (state: RootState) =>
  `${state.settings?.baseUrl ?? ''}|${state.auth?.user?.account_id ?? ''}`;

export const draftKey = (scope: string, conversationId: number) => `${scope}|${conversationId}`;

const sendMessageSlice = createSlice({
  name: 'sendMessage',
  initialState,
  reducers: {
    setMessageContent: (
      state,
      action: PayloadAction<{ scope: string; conversationId: number; content: string }>,
    ) => {
      const { scope, conversationId, content } = action.payload;
      const key = draftKey(scope, conversationId);
      if (content) {
        state.drafts[key] = content;
      } else {
        // Keep the map free of empty strings so "has a draft" stays truthful.
        delete state.drafts[key];
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
    resetSentMessage: (
      state,
      action: PayloadAction<{ scope?: string; conversationId?: number } | undefined>,
    ) => {
      state.attachments = [];
      state.quoteMessage = null;
      const { scope, conversationId } = action.payload ?? {};
      if (scope === undefined || conversationId === undefined) {
        state.drafts = {};
      } else {
        delete state.drafts[draftKey(scope, conversationId)];
      }
    },
  },
});

/** The draft for one conversation; empty string when nothing is typed. */
export const selectMessageContent = (scope: string, conversationId: number) => (state: RootState) =>
  state.sendMessage.drafts[draftKey(scope, conversationId)] ?? '';

export const selectHasDraft = (scope: string, conversationId: number) => (state: RootState) =>
  Boolean(state.sendMessage.drafts[draftKey(scope, conversationId)]);
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
