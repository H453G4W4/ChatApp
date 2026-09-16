import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { chatTokens, tailwind } from '@/theme';
import { NativeView } from '@/components-next/native-components';
import { formatTimeToShortForm, formatRelativeTime } from '@/utils/dateTimeUtils';

const MINUTE_IN_MS = 60000;

type LastActivityTimeProps = {
  timestamp: number;
  /** Unread rows tint the time, the way a chat app highlights waiting threads. */
  isUnread?: boolean;
};

export const LastActivityTime = ({ timestamp, isUnread = false }: LastActivityTimeProps) => {
  const [, setRefreshTime] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setRefreshTime(Date.now()), MINUTE_IN_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <NativeView style={tailwind.style('flex-shrink-0')}>
      <Text
        style={tailwind.style(
          chatTokens.list.timestamp,
          isUnread && chatTokens.list.timestampUnread,
        )}>
        {formatTimeToShortForm(formatRelativeTime(timestamp))}
      </Text>
    </NativeView>
  );
};
