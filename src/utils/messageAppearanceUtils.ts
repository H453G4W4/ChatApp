import {
  CONTENT_TYPES,
  MESSAGE_STATUS,
  MESSAGE_TYPES,
  MESSAGE_VARIANTS,
  ORIENTATION,
  SENDER_TYPES,
} from '@/constants';
import type { Message } from '@/types';

const BOT_SENDER_TYPES: string[] = [SENDER_TYPES.AGENT_BOT, SENDER_TYPES.CAPTAIN_ASSISTANT];

export const isBotSender = (senderType?: string) =>
  !!senderType && BOT_SENDER_TYPES.includes(senderType);

/**
 * True when the signed-in agent sent this message, which is what puts a bubble
 * on the right. An outgoing message still in flight counts immediately so an
 * optimistic bubble does not jump sides once the server echoes it back.
 */
export const isOwnMessage = (message: Message, currentUserId: number): boolean => {
  const { status, messageType, senderId, senderType, sender } = message;

  if (status === MESSAGE_STATUS.PROGRESS && messageType === MESSAGE_TYPES.OUTGOING) {
    return true;
  }

  const senderIdentifier = senderId ?? sender?.id;
  const senderTypeValue = senderType ?? sender?.type;

  if (!senderTypeValue || !senderIdentifier) {
    return false;
  }

  return (
    senderTypeValue.toLowerCase() === SENDER_TYPES.USER.toLowerCase() &&
    currentUserId === senderIdentifier
  );
};

/**
 * Which side of the thread a message sits on.
 *
 * Own messages go right, activity events run down the centre, and everything
 * else - the contact, other agents, bots - stays left.
 */
export const getMessageOrientation = (message: Message, currentUserId: number): string => {
  if (isOwnMessage(message, currentUserId)) return ORIENTATION.RIGHT;
  if (message.messageType === MESSAGE_TYPES.ACTIVITY) return ORIENTATION.CENTER;
  return ORIENTATION.LEFT;
};

/**
 * Which bubble treatment a message gets. Private notes win over every other
 * rule so an internal note can never be styled as a message the contact saw.
 */
export const getMessageVariant = (message: Message, isEmailInbox: boolean): string => {
  const { messageType, contentType, status, sender } = message;

  if (message.private) return MESSAGE_VARIANTS.PRIVATE;

  if (isEmailInbox) {
    const emailInboxTypes: number[] = [MESSAGE_TYPES.INCOMING, MESSAGE_TYPES.OUTGOING];
    if (emailInboxTypes.includes(messageType)) {
      return MESSAGE_VARIANTS.EMAIL;
    }
  }
  if (contentType === CONTENT_TYPES.INCOMING_EMAIL) {
    return MESSAGE_VARIANTS.EMAIL;
  }
  if (status === MESSAGE_STATUS.FAILED) return MESSAGE_VARIANTS.ERROR;
  if (message.contentAttributes?.isUnsupported) return MESSAGE_VARIANTS.UNSUPPORTED;

  const isBot = !sender || isBotSender(sender.type);
  if (isBot && messageType === MESSAGE_TYPES.OUTGOING) {
    return MESSAGE_VARIANTS.BOT;
  }

  const variants: Record<number, string> = {
    [MESSAGE_TYPES.INCOMING]: MESSAGE_VARIANTS.USER,
    [MESSAGE_TYPES.ACTIVITY]: MESSAGE_VARIANTS.ACTIVITY,
    [MESSAGE_TYPES.OUTGOING]: MESSAGE_VARIANTS.AGENT,
    [MESSAGE_TYPES.TEMPLATE]: MESSAGE_VARIANTS.TEMPLATE,
  };

  return variants[messageType] || MESSAGE_VARIANTS.USER;
};
