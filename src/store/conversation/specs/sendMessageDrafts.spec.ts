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
// Two different Chatwoot installations / accounts.
const SCOPE = 'chat.example.com|7';
const OTHER_SCOPE = 'other.example.com|7';

describe('per-conversation composer drafts', () => {
  it('starts every conversation with an empty composer', () => {
    const state = reducer(undefined, { type: 'INIT' });
    expect(selectMessageContent(SCOPE, CHAT_A)(asState(state))).toBe('');
    expect(selectHasDraft(SCOPE, CHAT_A)(asState(state))).toBe(false);
  });

  it('keeps each conversation’s draft separate', () => {
    let state = reducer(
      undefined,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_A, content: 'Half-written reply' }),
    );
    state = reducer(
      state,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_B, content: 'Other thread' }),
    );

    // The bug this fixes: one global string leaked typed text between threads.
    expect(selectMessageContent(SCOPE, CHAT_A)(asState(state))).toBe('Half-written reply');
    expect(selectMessageContent(SCOPE, CHAT_B)(asState(state))).toBe('Other thread');
  });

  it('restores the draft when the agent returns to a conversation', () => {
    let state = reducer(
      undefined,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_A, content: 'Be right back' }),
    );

    // Leaving the thread clears the attachments and the quoted reply only.
    state = reducer(state, resetAttachments());
    state = reducer(state, setQuoteMessage(null));

    expect(selectMessageContent(SCOPE, CHAT_A)(asState(state))).toBe('Be right back');
  });

  it('clears only the sent conversation’s draft after a successful send', () => {
    let state = reducer(
      undefined,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_A, content: 'Sent' }),
    );
    state = reducer(
      state,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_B, content: 'Still typing' }),
    );
    state = reducer(state, updateAttachments([{ uri: 'file://a.png' } as Asset]));
    state = reducer(state, setQuoteMessage({ id: 5 } as Message));

    state = reducer(state, resetSentMessage({ scope: SCOPE, conversationId: CHAT_A }));

    expect(selectMessageContent(SCOPE, CHAT_A)(asState(state))).toBe('');
    expect(selectMessageContent(SCOPE, CHAT_B)(asState(state))).toBe('Still typing');
    expect(state.attachments).toEqual([]);
    expect(state.quoteMessage).toBeNull();
  });

  it('drops every draft when no conversation is named, as on an account switch', () => {
    let state = reducer(
      undefined,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_A, content: 'A' }),
    );
    state = reducer(
      state,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_B, content: 'B' }),
    );

    state = reducer(state, resetSentMessage());

    // Drafts belong to conversations the agent can no longer see.
    expect(selectMessageContent(SCOPE, CHAT_A)(asState(state))).toBe('');
    expect(selectMessageContent(SCOPE, CHAT_B)(asState(state))).toBe('');
    expect(state.drafts).toEqual({});
  });

  it('keeps drafts for the same conversation id apart across servers', () => {
    // Conversation display ids restart per account, so a bare id would show one
    // installation's draft inside another's conversation of the same number.
    let state = reducer(
      undefined,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_A, content: 'Server one' }),
    );
    state = reducer(
      state,
      setMessageContent({ scope: OTHER_SCOPE, conversationId: CHAT_A, content: 'Server two' }),
    );

    expect(selectMessageContent(SCOPE, CHAT_A)(asState(state))).toBe('Server one');
    expect(selectMessageContent(OTHER_SCOPE, CHAT_A)(asState(state))).toBe('Server two');
  });

  it('clears only the sending server’s draft, leaving the other server’s intact', () => {
    let state = reducer(
      undefined,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_A, content: 'Server one' }),
    );
    state = reducer(
      state,
      setMessageContent({ scope: OTHER_SCOPE, conversationId: CHAT_A, content: 'Server two' }),
    );

    state = reducer(state, resetSentMessage({ scope: SCOPE, conversationId: CHAT_A }));

    expect(selectMessageContent(SCOPE, CHAT_A)(asState(state))).toBe('');
    expect(selectMessageContent(OTHER_SCOPE, CHAT_A)(asState(state))).toBe('Server two');
  });

  it('forgets a draft that was cleared back to empty', () => {
    let state = reducer(
      undefined,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_A, content: 'Typed' }),
    );
    expect(selectHasDraft(SCOPE, CHAT_A)(asState(state))).toBe(true);

    state = reducer(
      state,
      setMessageContent({ scope: SCOPE, conversationId: CHAT_A, content: '' }),
    );

    expect(selectHasDraft(SCOPE, CHAT_A)(asState(state))).toBe(false);
    expect(state.drafts).toEqual({});
  });
});
