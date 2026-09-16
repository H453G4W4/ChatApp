import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { ConversationItemDetail } from '../ConversationItemDetail';
import { ChannelIndicator } from '@/components-next/list-components/ChannelIndicator';
import { UnreadIndicator } from '../UnreadIndicator';
import type { Inbox } from '@/types/Inbox';
import type { Message } from '@/types';
import { chatTokens, tailwind } from '@/theme';
import { LastActivityTime } from '../LastActivityTime';

const emailInbox = {
  id: 1,
  name: 'Support Mailbox',
  channelType: 'Channel::Email',
  medium: '',
} as Inbox;

const message = (overrides: Partial<Message> = {}): Message =>
  ({
    id: 10,
    content: 'The latest thing that happened',
    messageType: 0,
    private: false,
    createdAt: 1700000000,
    attachments: [],
    contentAttributes: null,
    ...overrides,
  }) as unknown as Message;

const render = (props: Partial<React.ComponentProps<typeof ConversationItemDetail>> = {}) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ConversationItemDetail
        unreadCount={0}
        senderName="Ada Lovelace"
        timestamp={1700000000}
        lastMessage={message()}
        inbox={emailInbox}
        {...props}
      />,
    );
  });
  return tree;
};

const textOf = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .filter(child => typeof child === 'string' || typeof child === 'number')
    .map(String)
    .join(' ');

describe('WhatsApp-style conversation row', () => {
  let tree: renderer.ReactTestRenderer | undefined;

  afterEach(() => {
    // LastActivityTime keeps a refresh interval; unmounting stops it leaking.
    act(() => tree?.unmount());
    tree = undefined;
  });

  it('renders safely when the conversation has no sender name', () => {
    tree = render({ senderName: null, lastMessage: null });

    // No crash, and the row still shows its preview fallback rather than vanishing.
    expect(tree.root.findAllByType(Text).length).toBeGreaterThan(0);
    expect(textOf(tree)).toContain('No content available');
  });

  it('shows the unread badge with the count only when there are unread messages', () => {
    tree = render({ unreadCount: 4 });
    expect(tree.root.findAllByType(UnreadIndicator)).toHaveLength(1);
    expect(textOf(tree)).toContain('4');

    act(() => tree!.unmount());
    tree = render({ unreadCount: 0 });
    expect(tree.root.findAllByType(UnreadIndicator)).toHaveLength(0);
  });

  it('caps the unread badge at 99+', () => {
    tree = render({ unreadCount: 250 });
    expect(textOf(tree)).toContain('99+');
  });

  it('prefixes the preview with "You: " for the agent\'s own message', () => {
    tree = render({ lastMessage: message({ messageType: 1, content: 'Sent by the agent' }) });

    const preview = textOf(tree);
    expect(preview).toContain('You:');
    expect(preview).toContain('Sent by the agent');
  });

  it('does not prefix an incoming customer message', () => {
    tree = render({ lastMessage: message({ messageType: 0, content: 'From the customer' }) });

    expect(textOf(tree)).not.toContain('You:');
  });

  it('keeps a private note visually distinct instead of labelling it "You: "', () => {
    tree = render({
      lastMessage: message({ messageType: 1, private: true, content: 'Internal note' }),
    });

    // The note keeps its own glyph, so it cannot be mistaken for a sent reply.
    expect(textOf(tree)).not.toContain('You:');
    expect(textOf(tree)).toContain('Internal note');
  });

  it('renders the channel indicator for the conversation inbox', () => {
    tree = render();
    expect(tree.root.findAllByType(ChannelIndicator)).toHaveLength(1);
  });

  it('omits the channel indicator when the inbox record has not loaded', () => {
    // Phase 1 rule: missing inbox metadata degrades the row, it never hides it.
    tree = render({ inbox: null });

    expect(tree.root.findAllByType(ChannelIndicator)).toHaveLength(0);
    expect(textOf(tree)).toContain('The latest thing that happened');
  });

  it('prefers the typing indicator over the stored preview', () => {
    tree = render({ typingText: 'Ada is typing…' });
    expect(textOf(tree)).toContain('Ada is typing…');
  });

  describe('unread hierarchy', () => {
    const flatten = (style: unknown): Record<string, unknown> =>
      Array.isArray(style)
        ? style.reduce<Record<string, unknown>>((all, entry) => ({ ...all, ...flatten(entry) }), {})
        : ((style ?? {}) as Record<string, unknown>);

    const nameStyle = (t: renderer.ReactTestRenderer) =>
      flatten(t.root.findAllByType(Text)[0].props.style);

    const timeStyle = (t: renderer.ReactTestRenderer) =>
      flatten(t.root.findByType(LastActivityTime).findByType(Text).props.style);

    it('gives an unread row a heavier name than a read one', () => {
      tree = render({ unreadCount: 0 });
      const read = nameStyle(tree);
      act(() => tree!.unmount());

      tree = render({ unreadCount: 3 });
      const unread = nameStyle(tree);

      expect(unread.fontFamily).not.toBe(read.fontFamily);
      expect(unread.fontFamily).toBe(
        flatten(tailwind.style(chatTokens.list.nameUnread)).fontFamily,
      );
    });

    it('tints the timestamp on an unread row', () => {
      tree = render({ unreadCount: 0 });
      const read = timeStyle(tree);
      act(() => tree!.unmount());

      tree = render({ unreadCount: 2 });
      const unread = timeStyle(tree);

      expect(unread.color).not.toBe(read.color);
      expect(unread.color).toBe(flatten(tailwind.style(chatTokens.list.timestampUnread)).color);
    });

    it('keeps the row height stable whether or not it is unread', () => {
      // A reserved badge slot stops rows resizing as unread counts change,
      // which would otherwise jolt the list during a realtime reorder.
      tree = render({ unreadCount: 0 });
      const readTexts = tree.root.findAllByType(Text).length;
      act(() => tree!.unmount());

      tree = render({ unreadCount: 5 });
      // Exactly one extra Text: the badge count.
      expect(tree.root.findAllByType(Text).length).toBe(readTexts + 1);
    });
  });
});
