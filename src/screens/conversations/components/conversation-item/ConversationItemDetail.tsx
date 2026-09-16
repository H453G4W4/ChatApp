import React, { memo } from 'react';
import { Text } from 'react-native';
import { LinearTransition } from 'react-native-reanimated';

import { AnimatedNativeView, NativeView } from '@/components-next/native-components';
import { chatTokens, tailwind } from '@/theme';
import { ConversationAdditionalAttributes, Message } from '@/types';
import { Inbox } from '@/types/Inbox';
import { ChannelIndicator } from '@/components-next/list-components/ChannelIndicator';

import { ConversationLastMessage } from './ConversationLastMessage';
import { UnreadIndicator } from './UnreadIndicator';
import { LastActivityTime } from './LastActivityTime';
import { TypingMessage } from './TypingMessage';
import i18n from '@/i18n';

type ConversationItemDetailProps = {
  unreadCount: number;
  senderName: string | null;
  timestamp: number;
  lastMessage?: Message | null;
  inbox: Inbox | null;
  additionalAttributes?: ConversationAdditionalAttributes;
  typingText?: string;
};

/**
 * Two-line WhatsApp-style row body.
 *
 *   name  [channel]            time
 *   You: last message         (3)
 *
 * The channel indicator rides next to the name as a single small glyph so the
 * inbox stays identifiable without adding a third line of metadata.
 */
export const ConversationItemDetail = memo(function ConversationItemDetail({
  unreadCount,
  senderName,
  timestamp,
  lastMessage,
  inbox,
  additionalAttributes,
  typingText,
}: ConversationItemDetailProps) {
  const isUnread = unreadCount > 0;

  return (
    <AnimatedNativeView
      layout={LinearTransition.springify().mass(1).damping(21).stiffness(115)}
      style={tailwind.style(
        'flex-1 min-w-0 flex-row items-center gap-2 py-2',
        chatTokens.screen.divider,
      )}>
      <NativeView style={tailwind.style('flex-1 min-w-0 gap-0.5')}>
        <NativeView style={tailwind.style('flex-row items-center gap-1')}>
          <Text
            numberOfLines={1}
            style={tailwind.style(
              chatTokens.list.name,
              'flex-shrink',
              // Unread rows lead with a heavier name, the strongest cue in the row.
              isUnread && chatTokens.list.nameUnread,
            )}>
            {senderName}
          </Text>
          {inbox && <ChannelIndicator inbox={inbox} additionalAttributes={additionalAttributes} />}
        </NativeView>

        <NativeView style={tailwind.style('flex-row items-center min-h-[20px]')}>
          {typingText ? (
            <TypingMessage typingText={typingText} />
          ) : lastMessage ? (
            <ConversationLastMessage
              numberOfLines={1}
              lastMessage={lastMessage}
              isUnread={isUnread}
            />
          ) : (
            <Text numberOfLines={1} style={tailwind.style(chatTokens.list.preview, 'flex-1')}>
              {i18n.t('CONVERSATION.NO_CONTENT')}
            </Text>
          )}
        </NativeView>
      </NativeView>

      <NativeView style={tailwind.style(chatTokens.list.meta)}>
        <LastActivityTime timestamp={timestamp} isUnread={isUnread} />
        {isUnread ? (
          <UnreadIndicator count={unreadCount} />
        ) : (
          // Reserves the badge's height so rows keep one uniform height whether
          // or not they are unread, which keeps the reorder animation smooth.
          <NativeView style={tailwind.style('h-5')} />
        )}
      </NativeView>
    </AnimatedNativeView>
  );
});
