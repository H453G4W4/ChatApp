import type { RootState } from '@/store';
import reducer, {
  resetAttachments,
  resetSentMessage,
  selectHasDraft,
  selectMessageContent,
  setMessageContent,
  setQuoteMessage,
  updateAttachments,
} from '../sendMessageSlice';
import type { Message } from '@/types';
import type { Asset } from 'react-native-image-picker';

const asState = (sendMessage: ReturnType<typeof reducer>) => ({ sendMessage }) as RootState;

const CHAT_A = 101;
const CHAT_B = 202;

describe('per-conversation composer drafts', () => {
  it('starts every conversation with an empty composer', () => {
    const state = reducer(undefined, { type: 'INIT' });
    expect(selectMessageContent(CHAT_A)(asState(state))).toBe('');
    expect(selectHasDraft(CHAT_A)(asState(state))).toBe(false);
  });

  it('keeps each conversation’s draft separate', () => {
    let state = reducer(
      undefined,
      setMessageContent({ conversationId: CHAT_A, content: 'Half-written reply' }),
    );
    state = reducer(state, setMessageContent({ conversationId: CHAT_B, content: 'Other thread' }));

    // The bug this fixes: one global string leaked typed text between threads.
    expect(selectMessageContent(CHAT_A)(asState(state))).toBe('Half-written reply');
    expect(selectMessageContent(CHAT_B)(asState(state))).toBe('Other thread');
  });

  it('restores the draft when the agent returns to a conversation', () => {
    let state = reducer(
      undefined,
      setMessageContent({ conversationId: CHAT_A, content: 'Be right back' }),
    );

    // Leaving the thread clears the attachments and the quoted reply only.
    state = reducer(state, resetAttachments());
    state = reducer(state, setQuoteMessage(null));

    expect(selectMessageContent(CHAT_A)(asState(state))).toBe('Be right back');
  });

  it('clears only the sent conversation’s draft after a successful send', () => {
    let state = reducer(undefined, setMessageContent({ conversationId: CHAT_A, content: 'Sent' }));
    state = reducer(state, setMessageContent({ conversationId: CHAT_B, content: 'Still typing' }));
    state = reducer(state, updateAttachments([{ uri: 'file://a.png' } as Asset]));
    state = reducer(state, setQuoteMessage({ id: 5 } as Message));

    state = reducer(state, resetSentMessage({ conversationId: CHAT_A }));

    expect(selectMessageContent(CHAT_A)(asState(state))).toBe('');
    expect(selectMessageContent(CHAT_B)(asState(state))).toBe('Still typing');
    expect(state.attachments).toEqual([]);
    expect(state.quoteMessage).toBeNull();
  });

  it('drops every draft when no conversation is named, as on an account switch', () => {
    let state = reducer(undefined, setMessageContent({ conversationId: CHAT_A, content: 'A' }));
    state = reducer(state, setMessageContent({ conversationId: CHAT_B, content: 'B' }));

    state = reducer(state, resetSentMessage());

    // Drafts belong to conversations the agent can no longer see.
    expect(selectMessageContent(CHAT_A)(asState(state))).toBe('');
    expect(selectMessageContent(CHAT_B)(asState(state))).toBe('');
    expect(state.drafts).toEqual({});
  });

  it('forgets a draft that was cleared back to empty', () => {
    let state = reducer(undefined, setMessageContent({ conversationId: CHAT_A, content: 'Typed' }));
    expect(selectHasDraft(CHAT_A)(asState(state))).toBe(true);

    state = reducer(state, setMessageContent({ conversationId: CHAT_A, content: '' }));

    expect(selectHasDraft(CHAT_A)(asState(state))).toBe(false);
    expect(state.drafts).toEqual({});
  });
});
