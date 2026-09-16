import {
  getMessageOrientation,
  getMessageVariant,
  isBotSender,
  isOwnMessage,
} from '../messageAppearanceUtils';
import {
  CONTENT_TYPES,
  MESSAGE_STATUS,
  MESSAGE_TYPES,
  MESSAGE_VARIANTS,
  ORIENTATION,
  SENDER_TYPES,
} from '@/constants';
import type { Message } from '@/types';

const AGENT_ID = 11;

const message = (overrides: Partial<Message> = {}): Message =>
  ({
    id: 1,
    content: 'Hello',
    messageType: MESSAGE_TYPES.INCOMING,
    private: false,
    status: MESSAGE_STATUS.SENT as Message['status'],
    createdAt: 100,
    attachments: [],
    contentAttributes: null,
    ...overrides,
  }) as unknown as Message;

const fromAgent = (id = AGENT_ID, overrides: Partial<Message> = {}) =>
  message({
    messageType: MESSAGE_TYPES.OUTGOING,
    senderId: id,
    senderType: SENDER_TYPES.USER,
    // A real agent message carries a serialized sender; without one the
    // existing logic treats an outgoing message as a bot reply.
    sender: { id, type: SENDER_TYPES.USER, name: 'Agent' },
    ...overrides,
  } as Partial<Message>);

const fromContact = (overrides: Partial<Message> = {}) =>
  message({
    messageType: MESSAGE_TYPES.INCOMING,
    senderId: 500,
    senderType: SENDER_TYPES.CONTACT,
    ...overrides,
  });

describe('message alignment', () => {
  it('puts an incoming customer message on the left', () => {
    expect(getMessageOrientation(fromContact(), AGENT_ID)).toBe(ORIENTATION.LEFT);
  });

  it("puts the signed-in agent's own outgoing message on the right", () => {
    expect(getMessageOrientation(fromAgent(), AGENT_ID)).toBe(ORIENTATION.RIGHT);
  });

  it("keeps another agent's outgoing message on the left", () => {
    // The global queue shows everyone's conversations, so "outgoing" alone is
    // not enough to claim a bubble as mine.
    expect(getMessageOrientation(fromAgent(99), AGENT_ID)).toBe(ORIENTATION.LEFT);
  });

  it('puts an optimistic outgoing message on the right before the server replies', () => {
    const inFlight = message({
      messageType: MESSAGE_TYPES.OUTGOING,
      status: MESSAGE_STATUS.PROGRESS as Message['status'],
    });
    expect(getMessageOrientation(inFlight, AGENT_ID)).toBe(ORIENTATION.RIGHT);
  });

  it('centres activity events', () => {
    expect(getMessageOrientation(message({ messageType: MESSAGE_TYPES.ACTIVITY }), AGENT_ID)).toBe(
      ORIENTATION.CENTER,
    );
  });

  it('falls back to the left when the sender cannot be identified', () => {
    expect(isOwnMessage(message({ senderId: undefined, sender: undefined }), AGENT_ID)).toBe(false);
    expect(getMessageOrientation(message({ senderId: undefined }), AGENT_ID)).toBe(
      ORIENTATION.LEFT,
    );
  });

  it('aligns a private note the agent wrote on the right, like any message they sent', () => {
    expect(getMessageOrientation(fromAgent(AGENT_ID, { private: true }), AGENT_ID)).toBe(
      ORIENTATION.RIGHT,
    );
  });
});

describe('message variant', () => {
  it('marks a private note distinctly, whatever else is true of it', () => {
    expect(getMessageVariant(fromAgent(AGENT_ID, { private: true }), false)).toBe(
      MESSAGE_VARIANTS.PRIVATE,
    );
  });

  it('keeps the private variant even inside an email inbox', () => {
    // Otherwise an internal note would be styled as a mail the contact received.
    expect(getMessageVariant(fromAgent(AGENT_ID, { private: true }), true)).toBe(
      MESSAGE_VARIANTS.PRIVATE,
    );
  });

  it('keeps the private variant even when the message failed to send', () => {
    expect(
      getMessageVariant(
        fromAgent(AGENT_ID, { private: true, status: MESSAGE_STATUS.FAILED as Message['status'] }),
        false,
      ),
    ).toBe(MESSAGE_VARIANTS.PRIVATE);
  });

  it('distinguishes a customer message from an agent reply', () => {
    expect(getMessageVariant(fromContact(), false)).toBe(MESSAGE_VARIANTS.USER);
    expect(getMessageVariant(fromAgent(), false)).toBe(MESSAGE_VARIANTS.AGENT);
  });

  it('uses the email treatment for both directions inside an email inbox', () => {
    expect(getMessageVariant(fromContact(), true)).toBe(MESSAGE_VARIANTS.EMAIL);
    expect(getMessageVariant(fromAgent(), true)).toBe(MESSAGE_VARIANTS.EMAIL);
  });

  it('uses the email treatment for an incoming email in a non-email inbox', () => {
    expect(
      getMessageVariant(
        fromContact({ contentType: CONTENT_TYPES.INCOMING_EMAIL as Message['contentType'] }),
        false,
      ),
    ).toBe(MESSAGE_VARIANTS.EMAIL);
  });

  it('marks a failed send as an error', () => {
    expect(
      getMessageVariant(
        fromAgent(AGENT_ID, { status: MESSAGE_STATUS.FAILED as Message['status'] }),
        false,
      ),
    ).toBe(MESSAGE_VARIANTS.ERROR);
  });

  it('marks an unsupported message', () => {
    expect(
      getMessageVariant(
        fromContact({ contentAttributes: { isUnsupported: true } } as Partial<Message>),
        false,
      ),
    ).toBe(MESSAGE_VARIANTS.UNSUPPORTED);
  });

  it('marks an outgoing message with no serialized sender as a bot message', () => {
    expect(getMessageVariant(message({ messageType: MESSAGE_TYPES.OUTGOING }), false)).toBe(
      MESSAGE_VARIANTS.BOT,
    );
  });

  it('marks an outgoing message from an agent bot as a bot message', () => {
    expect(
      getMessageVariant(
        message({
          messageType: MESSAGE_TYPES.OUTGOING,
          sender: { id: 3, type: SENDER_TYPES.AGENT_BOT, name: 'Bot' },
        } as Partial<Message>),
        false,
      ),
    ).toBe(MESSAGE_VARIANTS.BOT);
  });

  it('recognises the bot sender types', () => {
    expect(isBotSender(SENDER_TYPES.AGENT_BOT)).toBe(true);
    expect(isBotSender(SENDER_TYPES.CAPTAIN_ASSISTANT)).toBe(true);
    expect(isBotSender(SENDER_TYPES.USER)).toBe(false);
    expect(isBotSender(undefined)).toBe(false);
  });
});
