import React from 'react';

import Animated, { interpolate, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useAppKeyboardAnimation } from '@/utils';
import { chatTokens, tailwind } from '@/theme';
import { Message } from '@/types';
import { MessageComponent } from '../message-item/Message';
import { useRefsContext } from '@/context';

export type FlashListRenderProps = {
  item: { date: string } | Message;
  index: number;
};

const AnimatedFlashlist = Animated.createAnimatedComponent(FlashList<Message | { date: string }>);

type DateSectionProps = { item: { date: string } };

/** Centered Today / Yesterday / date pill between day groups. */
const DateSection = ({ item }: DateSectionProps) => {
  return (
    <Animated.View style={tailwind.style('flex-row justify-center items-center py-3')}>
      <Animated.View style={tailwind.style(chatTokens.chat.datePill)}>
        <Animated.Text style={tailwind.style(chatTokens.chat.datePillText)}>
          {item.date}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
};

type MessagesListPresentationProps = {
  messages: (Message | { date: string })[];
  isFlashListReady: boolean;
  setFlashListReady: (ready: boolean) => void;
  onEndReached: () => void;
  onStartReached: () => void;
  isEmailInbox: boolean;
  currentUserId: number;
  isSearchNavigation?: boolean;
  highlightedMessageId?: number;
};

export const MessagesList = ({
  messages,
  isFlashListReady,
  setFlashListReady,
  onEndReached,
  onStartReached,
  isEmailInbox,
  currentUserId,
  isSearchNavigation = false,
  highlightedMessageId,
}: MessagesListPresentationProps) => {
  const { progress, height } = useAppKeyboardAnimation();
  const { messageListRef } = useRefsContext();
  const typedMessageListRef = messageListRef as React.RefObject<
    FlashListRef<Message | { date: string }>
  >;

  const handleRender = ({ item, index }: { item: Message | { date: string }; index: number }) => {
    if ('date' in item) {
      return <DateSection item={item} />;
    }

    const isTarget = highlightedMessageId !== undefined && highlightedMessageId === item.id;

    return (
      <MessageComponent
        item={item}
        index={index}
        isEmailInbox={isEmailInbox}
        currentUserId={currentUserId}
        isTargetMessage={isTarget}
      />
    );
  };

  const animatedFlashlistStyle = useAnimatedStyle(() => {
    return {
      marginBottom: withSpring(interpolate(progress.value, [0, 1], [0, height.value]), {
        stiffness: 240,
        damping: 38,
      }),
    };
  });

  return (
    <Animated.View
      style={[
        tailwind.style('flex-1 min-h-10', chatTokens.chat.background),
        animatedFlashlistStyle,
      ]}>
      <AnimatedFlashlist
        onLoad={() => {
          // Search navigation positions once items are drawn (measured), so
          // scroll-to-target lands accurately.
          if (isSearchNavigation && !isFlashListReady) {
            setFlashListReady(true);
          }
        }}
        onScrollBeginDrag={() => {
          // Normal chat becomes ready on the first user drag, which gates pagination.
          if (!isSearchNavigation && !isFlashListReady) {
            setFlashListReady(true);
          }
        }}
        ref={typedMessageListRef}
        // Data is newest-first, so inverted renders index 0 at the visual bottom.
        // Older history loads via onEndReached, newer via onStartReached.
        inverted
        getItemType={item => ('date' in item ? 'date' : 'message')}
        drawDistance={500}
        showsVerticalScrollIndicator={false}
        renderItem={handleRender}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.2}
        onStartReached={onStartReached}
        onStartReachedThreshold={0.1}
        data={messages}
        contentContainerStyle={tailwind.style('px-3')}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item: { date: string } | Message) => {
          if ('date' in item) {
            return item.date.toString();
          }
          return item.id.toString();
        }}
      />
    </Animated.View>
  );
};
