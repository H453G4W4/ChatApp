import React from 'react';
import { StyleProp, Text, ViewStyle } from 'react-native';

import { chatTokens, tailwind } from '@/theme';
import { NativeView } from '@/components-next/native-components';
import {
  AudioIcon,
  ImageAttachmentIcon,
  DocumentAttachmentIcon,
  PrivateNoteIcon,
  OutgoingIcon,
} from '@/svg-icons';
import { Icon } from '@/components-next/common/icon';
import { Message } from '@/types';
import { MESSAGE_TYPES } from '@/constants';
import i18n from '@/i18n';
import { getPlainText } from '@/utils/messageFormatterUtils';

type ConversationLastMessageProps = {
  numberOfLines: number;
  lastMessage: Message;
};

export const ATTACHMENT_ICONS = {
  image: 'image',
  audio: 'headphones-sound-wave',
  video: 'video',
  file: 'document',
  location: 'location',
  fallback: 'link',
};

const getAttachmentIcon = (fileType: string) => {
  switch (fileType) {
    case 'image':
      return <ImageAttachmentIcon />;
    case 'audio':
      return <AudioIcon />;
    case 'file':
      return <DocumentAttachmentIcon />;
    default:
      return <DocumentAttachmentIcon />;
  }
};

/**
 * Marks who the preview belongs to.
 *
 * A private note keeps its existing lock glyph so notes stay distinguishable
 * from replies the contact actually received; anything else the agent sent is
 * prefixed with "You: ", the convention chat apps use for own messages.
 */
const MessageType = ({ message, style }: { message: Message; style?: StyleProp<ViewStyle> }) => {
  const { private: isPrivate } = message;
  const isOutgoing = message?.messageType === MESSAGE_TYPES.OUTGOING;

  if (isPrivate) {
    return (
      <NativeView style={[tailwind.style('flex-row items-center gap-1'), style]}>
        <Icon icon={<PrivateNoteIcon />} />
      </NativeView>
    );
  }

  if (isOutgoing) {
    return (
      <NativeView style={[tailwind.style('flex-row items-center gap-1'), style]}>
        <Icon icon={<OutgoingIcon />} />
        <Text style={tailwind.style(chatTokens.list.previewPrefix)}>
          {i18n.t('CONVERSATION.YOU_PREFIX')}
        </Text>
      </NativeView>
    );
  }

  return null;
};

const MessageContent = ({
  message,
  numberOfLines,
}: {
  message: Message;
  numberOfLines: number;
}) => {
  const { contentAttributes } = message || {};
  const { email: { subject = '' } = {} } = contentAttributes || {};

  const lastMessageContent = getPlainText(subject || message?.content);

  const lastMessageFileType = message?.attachments?.[0]?.fileType;

  const isMessageSticker = message?.contentType === ('sticker' as Message['contentType']);

  if (message.content && isMessageSticker) {
    return (
      <NativeView style={tailwind.style('flex-1 flex-row gap-1 items-center')}>
        <Icon icon={<ImageAttachmentIcon />} />
        <MessageType message={message} />
        <Text numberOfLines={1} style={tailwind.style(chatTokens.list.preview, 'flex-1')}>
          {i18n.t(`CONVERSATION.ATTACHMENTS.image.CONTENT`)}
        </Text>
      </NativeView>
    );
  } else if (lastMessageContent) {
    return (
      <NativeView style={tailwind.style('flex-1 flex-row gap-1 items-center')}>
        <MessageType message={message} />
        <Text
          numberOfLines={numberOfLines}
          style={tailwind.style(chatTokens.list.preview, 'flex-1')}>
          {lastMessageContent}
        </Text>
      </NativeView>
    );
  } else if (message.attachments) {
    return (
      <NativeView style={tailwind.style('flex-1 flex-row gap-1 items-center')}>
        <Icon icon={getAttachmentIcon(lastMessageFileType)} />
        <MessageType message={message} />
        <Text numberOfLines={1} style={tailwind.style(chatTokens.list.preview, 'flex-1')}>
          {i18n.t(`CONVERSATION.ATTACHMENTS.${lastMessageFileType}.CONTENT`)}
        </Text>
      </NativeView>
    );
  }
  return (
    <Text numberOfLines={numberOfLines} style={tailwind.style(chatTokens.list.preview, 'flex-1')}>
      {i18n.t('CONVERSATION.NO_CONTENT')}
    </Text>
  );
};

export const ConversationLastMessage = (props: ConversationLastMessageProps) => {
  const { numberOfLines, lastMessage } = props;
  return (
    <NativeView style={tailwind.style('flex-1 min-w-0 flex-row gap-1 items-center')}>
      <MessageContent message={lastMessage} numberOfLines={numberOfLines} />
    </NativeView>
  );
};
