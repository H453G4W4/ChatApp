import React from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { NativeView } from '@/components-next/native-components';
import { useAppSelector } from '@/hooks';
import { selectIsReconnecting } from '@/store/connection/connectionSlice';
import { chatTokens, tailwind } from '@/theme';
import i18n from '@/i18n';

/**
 * A quiet strip shown while the realtime socket is down.
 *
 * It is passive by design: no dialog, no retry button, and the queue keeps
 * showing whatever it already loaded. ActionCable reconnects on its own and the
 * strip disappears when it does - nothing here polls.
 */
export const ConnectionBanner = () => {
  const isReconnecting = useAppSelector(selectIsReconnecting);

  if (!isReconnecting) return null;

  return (
    <NativeView testID="connection-banner" style={tailwind.style(chatTokens.connection.bar)}>
      <ActivityIndicator size="small" color={tailwind.color('text-amber-900')} />
      <Text style={tailwind.style(chatTokens.connection.text)}>
        {i18n.t('CONVERSATION.RECONNECTING')}
      </Text>
    </NativeView>
  );
};
