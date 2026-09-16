import React from 'react';
import { Pressable } from 'react-native';
import { useNavigation, StackActions } from '@react-navigation/native';

import { Icon } from '@/components-next/common/icon';
import { AddIcon } from '@/svg-icons';
import { chatTokens, tailwind } from '@/theme';
import { useTabBarHeight } from '@/utils/common';
import i18n from '@/i18n';

/**
 * Bottom-right "start a conversation" button over the queue.
 *
 * It clears the tab bar and the gesture inset so it never sits under either,
 * and it only routes - the New Chat screen owns every channel decision.
 */
export const NewConversationFab = () => {
  const navigation = useNavigation();
  // Same measurement the list uses for its bottom padding, so the button always
  // clears the tab bar on both platforms.
  const tabBarHeight = useTabBarHeight();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={i18n.t('CONVERSATION.NEW_CONVERSATION')}
      testID="new-conversation-fab"
      onPress={() => navigation.dispatch(StackActions.push('NewChatScreen'))}
      style={({ pressed }) =>
        tailwind.style(
          chatTokens.fab.container,
          `bottom-[${tabBarHeight + 16}px]`,
          pressed && 'opacity-80',
        )
      }>
      <Icon size={24} icon={<AddIcon stroke={tailwind.color('text-white')} />} />
    </Pressable>
  );
};
