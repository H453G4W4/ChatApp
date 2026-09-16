import React, { useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, StackActions } from '@react-navigation/native';

import { Icon } from '@/components-next/common';
import { NativeView } from '@/components-next/native-components';
import { CaretRight, MailIcon } from '@/svg-icons';
import { useAppSelector } from '@/hooks';
import { selectAllInboxes } from '@/store/inbox/inboxSelectors';
import { selectableEmailInboxes } from '@/utils/newEmailUtils';
import { chatTokens, tailwind } from '@/theme';
import i18n from '@/i18n';

import { ScreenHeader } from './components/ScreenHeader';

/**
 * Channel picker for starting a conversation.
 *
 * Email is the only channel Phase 2 can start; the list is shaped so further
 * channels drop in as extra rows without changing the screen.
 */
const NewChatScreen = () => {
  const navigation = useNavigation();
  const inboxes = useAppSelector(selectAllInboxes);

  // Only email inboxes the authenticated inbox endpoint returned can start a
  // mail thread, so the row disables itself when the account has none.
  const emailInboxes = useMemo(() => selectableEmailInboxes(inboxes), [inboxes]);
  const canSendEmail = emailInboxes.length > 0;

  return (
    <SafeAreaView edges={['top']} style={tailwind.style('flex-1', chatTokens.screen.background)}>
      <ScreenHeader title={i18n.t('NEW_CHAT.TITLE')} subtitle={i18n.t('NEW_CHAT.SUBTITLE')} />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSendEmail }}
        testID="new-chat-email-option"
        disabled={!canSendEmail}
        onPress={() => navigation.dispatch(StackActions.push('NewEmailScreen'))}
        style={({ pressed }) =>
          tailwind.style(
            'flex-row items-center gap-3 px-4 py-3.5',
            chatTokens.screen.divider,
            pressed && 'bg-blackA-A2',
            !canSendEmail && 'opacity-50',
          )
        }>
        <NativeView
          style={tailwind.style('h-10 w-10 rounded-full items-center justify-center bg-blue-100')}>
          <Icon size={20} icon={<MailIcon stroke={tailwind.color('text-blue-800')} />} />
        </NativeView>

        <NativeView style={tailwind.style('flex-1 min-w-0')}>
          <Text style={tailwind.style('text-base font-inter-medium-24 leading-5 text-gray-950')}>
            {i18n.t('NEW_CHAT.EMAIL')}
          </Text>
          <Text numberOfLines={2} style={tailwind.style(chatTokens.form.hint)}>
            {canSendEmail
              ? i18n.t('NEW_CHAT.EMAIL_DESCRIPTION')
              : i18n.t('NEW_CHAT.NO_EMAIL_INBOX')}
          </Text>
        </NativeView>

        {canSendEmail ? (
          <Icon size={16} icon={<CaretRight stroke={tailwind.color('text-gray-700')} />} />
        ) : null}
      </Pressable>
    </SafeAreaView>
  );
};

export default NewChatScreen;
