import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import NewEmailScreen from '../NewEmailScreen';
import conversationReducer from '@/store/conversation/conversationSlice';
import newConversationReducer from '@/store/new-conversation/newConversationSlice';
import inboxReducer, { inboxAdapter } from '@/store/inbox/inboxSlice';
import { ContactService } from '@/store/contact/contactService';
import { ConversationService } from '@/store/conversation/conversationService';
import { conversation } from '@/store/conversation/specs/conversationMockData';
import { CONTACT_SEARCH_DEBOUNCE_MS } from '../useContactSearch';
import type { Contact } from '@/types';
import type { Inbox } from '@/types/Inbox';

const mockDispatch = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: mockDispatch, goBack: mockGoBack }),
  StackActions: {
    replace: (name: string, params: unknown) => ({ type: 'REPLACE', name, params }),
    push: (name: string, params: unknown) => ({ type: 'PUSH', name, params }),
  },
}));

jest.mock('@/store/contact/contactService', () => ({
  ContactService: { searchContacts: jest.fn(), createContact: jest.fn() },
}));
jest.mock('@/store/conversation/conversationService', () => ({
  ConversationService: { createConversation: jest.fn(), fetchConversation: jest.fn() },
}));

const searchContacts = jest.mocked(ContactService.searchContacts);
const createContact = jest.mocked(ContactService.createContact);
const createConversation = jest.mocked(ConversationService.createConversation);
const fetchConversation = jest.mocked(ConversationService.fetchConversation);

const makeInbox = (overrides: Record<string, unknown>): Inbox =>
  ({ name: 'Inbox', channelType: 'Channel::Email', medium: '', ...overrides }) as unknown as Inbox;

const emailInbox = makeInbox({ id: 7, name: 'Support Mailbox' });
const otherEmailInbox = makeInbox({ id: 8, name: 'Billing Mailbox' });
const whatsappInbox = makeInbox({ id: 9, name: 'WhatsApp', channelType: 'Channel::Whatsapp' });

const ada = { id: 42, name: 'Ada Lovelace', email: 'ada@example.com', thumbnail: '' } as Contact;

const makeStore = (inboxes: Inbox[]) =>
  configureStore({
    reducer: {
      conversations: conversationReducer,
      newConversation: newConversationReducer,
      inboxes: inboxReducer,
    },
    preloadedState: {
      inboxes: inboxAdapter.setAll(inboxAdapter.getInitialState({ isLoading: false }), inboxes),
    },
    middleware: getDefault => getDefault({ serializableCheck: false }),
  });

const mount = (inboxes: Inbox[] = [emailInbox]) => {
  const store = makeStore(inboxes);
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <NewEmailScreen />
      </Provider>,
    );
  });
  return { tree, store };
};

const byId = (tree: renderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll(node => node.props?.testID === testID && typeof node.type !== 'string')[0];

const type = (tree: renderer.ReactTestRenderer, testID: string, value: string) => {
  const input = tree.root.findAll(
    node => node.props?.testID === testID && typeof node.props?.onChangeText === 'function',
  )[0];
  if (!input) throw new Error(`No text input with testID "${testID}"`);
  act(() => input.props.onChangeText(value));
};

const press = (tree: renderer.ReactTestRenderer, testID: string) => {
  // Pressable is a forwardRef wrapper, so match on the handler rather than type.
  const target = tree.root.findAll(
    node => node.props?.testID === testID && typeof node.props?.onPress === 'function',
  )[0];
  if (!target) throw new Error(`No pressable with testID "${testID}"`);
  act(() => target.props.onPress());
};

const allText = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .filter(child => typeof child === 'string')
    .join(' | ');

const fillValidDraft = (tree: renderer.ReactTestRenderer) => {
  type(tree, 'new-email-to', 'ada@example.com');
  type(tree, 'new-email-subject', 'Invoice question');
  type(tree, 'new-email-content', 'Hello there');
};

describe('NewEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    searchContacts.mockResolvedValue([]);
    createContact.mockResolvedValue(ada);
    createConversation.mockResolvedValue({ conversationId: conversation.id, inboxId: 7 });
    fetchConversation.mockResolvedValue({ conversation });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('preselects the only email inbox the agent has', () => {
    const { tree } = mount([emailInbox, whatsappInbox]);

    expect(byId(tree, `new-email-inbox-${emailInbox.id}`).props.accessibilityState.selected).toBe(
      true,
    );
    act(() => tree.unmount());
  });

  it('never offers a non-email inbox as a sender', () => {
    const { tree } = mount([emailInbox, whatsappInbox]);

    expect(tree.root.findAll(node => node.props?.testID === `new-email-inbox-9`)).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('leaves the choice open when several email inboxes exist and sends from the chosen one', async () => {
    const { tree } = mount([emailInbox, otherEmailInbox]);

    // Nothing is preselected, so the agent must pick.
    expect(byId(tree, `new-email-inbox-${emailInbox.id}`).props.accessibilityState.selected).toBe(
      false,
    );

    press(tree, `new-email-inbox-${otherEmailInbox.id}`);
    fillValidDraft(tree);
    await act(async () => press(tree, 'new-email-send'));

    expect(createConversation).toHaveBeenCalledWith(
      expect.objectContaining({ inboxId: otherEmailInbox.id }),
    );
    act(() => tree.unmount());
  });

  it('refuses to send an invalid recipient and never reaches the API', async () => {
    const { tree } = mount();
    type(tree, 'new-email-to', 'not-an-address');
    type(tree, 'new-email-subject', 'Invoice question');
    type(tree, 'new-email-content', 'Hello there');

    await act(async () => press(tree, 'new-email-send'));

    expect(allText(tree)).toContain('Enter a valid email address.');
    expect(createConversation).not.toHaveBeenCalled();
    expect(createContact).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('refuses to send without a subject', async () => {
    const { tree } = mount();
    type(tree, 'new-email-to', 'ada@example.com');
    type(tree, 'new-email-content', 'Hello there');

    await act(async () => press(tree, 'new-email-send'));

    expect(allText(tree)).toContain('Enter a subject for the new email.');
    expect(createConversation).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('refuses to send without a message', async () => {
    const { tree } = mount();
    type(tree, 'new-email-to', 'ada@example.com');
    type(tree, 'new-email-subject', 'Invoice question');

    await act(async () => press(tree, 'new-email-send'));

    expect(allText(tree)).toContain('Enter a message.');
    expect(createConversation).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('lets the agent pick an existing contact from the debounced search', async () => {
    searchContacts.mockResolvedValue([ada]);
    const { tree } = mount();

    type(tree, 'new-email-to', 'ada');
    await act(async () => {
      jest.advanceTimersByTime(CONTACT_SEARCH_DEBOUNCE_MS);
    });

    expect(searchContacts).toHaveBeenCalledWith({ q: 'ada' }, expect.anything());
    press(tree, `new-email-contact-${ada.id}`);

    type(tree, 'new-email-subject', 'Invoice question');
    type(tree, 'new-email-content', 'Hello there');
    await act(async () => press(tree, 'new-email-send'));

    // The picked contact is reused; no new contact is created.
    expect(createContact).not.toHaveBeenCalled();
    expect(createConversation).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: ada.id, sourceId: 'ada@example.com' }),
    );
    act(() => tree.unmount());
  });

  it('creates a contact for a brand-new address nobody owns', async () => {
    searchContacts.mockResolvedValue([]);
    const { tree } = mount();

    type(tree, 'new-email-to', 'brand-new@example.com');
    await act(async () => {
      jest.advanceTimersByTime(CONTACT_SEARCH_DEBOUNCE_MS);
    });

    // The optional name field appears only for an address with no contact.
    expect(allText(tree)).toContain('This address is new, so a contact will be created.');
    type(tree, 'new-email-name', 'Brand New');
    type(tree, 'new-email-subject', 'Invoice question');
    type(tree, 'new-email-content', 'Hello there');
    await act(async () => press(tree, 'new-email-send'));

    expect(createContact).toHaveBeenCalledWith({
      inboxId: emailInbox.id,
      email: 'brand-new@example.com',
      name: 'Brand New',
    });
    act(() => tree.unmount());
  });

  it('navigates to the server-created conversation on success', async () => {
    searchContacts.mockResolvedValue([ada]);
    const { tree, store } = mount();
    fillValidDraft(tree);

    await act(async () => press(tree, 'new-email-send'));

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REPLACE',
      name: 'ChatScreen',
      params: { conversationId: conversation.id, isConversationOpenedExternally: false },
    });
    expect(store.getState().conversations.entities[conversation.id]?.id).toBe(conversation.id);
    act(() => tree.unmount());
  });

  it('prevents a double send from a fast double tap', async () => {
    searchContacts.mockResolvedValue([ada]);
    let release!: () => void;
    createConversation.mockReturnValue(
      new Promise(resolve => {
        release = () => resolve({ conversationId: conversation.id, inboxId: 7 });
      }),
    );

    const { tree } = mount();
    fillValidDraft(tree);

    await act(async () => {
      press(tree, 'new-email-send');
      press(tree, 'new-email-send');
    });

    expect(createConversation).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
    act(() => tree.unmount());
  });

  it('shows the server error and does not navigate when the API rejects', async () => {
    searchContacts.mockResolvedValue([ada]);
    // Chatwoot's real Pundit body, verified against request_exception_handler.rb.
    createConversation.mockRejectedValue({
      response: { status: 401, data: { error: 'You are not authorized to do this action' } },
    });

    const { tree, store } = mount();
    fillValidDraft(tree);
    await act(async () => press(tree, 'new-email-send'));

    expect(allText(tree)).toContain('You are not authorized to do this action');
    expect(mockDispatch).not.toHaveBeenCalled();
    // Nothing fake is left behind in the conversation store.
    expect(store.getState().conversations.ids).toEqual([]);
    act(() => tree.unmount());
  });

  it('sends exactly the verified Phase 2 payload after the UI polish', async () => {
    searchContacts.mockResolvedValue([ada]);
    const { tree } = mount();
    fillValidDraft(tree);

    await act(async () => press(tree, 'new-email-send'));

    // Visual changes must not shift the API contract verified against the
    // Chatwoot v4.17.1 source in the previous phase.
    expect(createConversation).toHaveBeenCalledWith({
      inboxId: emailInbox.id,
      contactId: ada.id,
      sourceId: 'ada@example.com',
      subject: 'Invoice question',
      content: 'Hello there',
    });
    expect(createConversation).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('tells the agent when the account has no email inbox to send from', () => {
    const { tree } = mount([whatsappInbox]);

    expect(allText(tree)).toContain('No email inbox is available on your account.');
    act(() => tree.unmount());
  });
});
