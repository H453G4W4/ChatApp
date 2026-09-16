import React from 'react';
import { Text } from 'react-native';

import { chatTokens, tailwind } from '@/theme';
import { NativeView } from '@/components-next/native-components';

type UnreadIndicatorProps = {
  count: number;
};

export const UnreadIndicator = (props: UnreadIndicatorProps) => {
  const { count } = props;
  return (
    <NativeView style={tailwind.style(chatTokens.badge.unread, 'flex-shrink-0')}>
      <Text style={tailwind.style(chatTokens.badge.unreadText)}>{count > 99 ? '99+' : count}</Text>
    </NativeView>
  );
};
