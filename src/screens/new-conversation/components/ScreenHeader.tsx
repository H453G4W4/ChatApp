import React from 'react';
import { Pressable, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Icon } from '@/components-next/common';
import { NativeView } from '@/components-next/native-components';
import { ChevronLeft } from '@/svg-icons';
import { chatTokens, tailwind } from '@/theme';
import i18n from '@/i18n';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Rendered on the trailing edge, e.g. the New Email send button. */
  right?: React.ReactNode;
};

/** Compact back-title header shared by the new-conversation screens. */
export const ScreenHeader = ({ title, subtitle, right }: ScreenHeaderProps) => {
  const navigation = useNavigation();

  return (
    <NativeView
      style={tailwind.style('flex-row items-center gap-3 px-3 py-2.5', chatTokens.screen.divider)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={i18n.t('COMMON.BACK')}
        testID="screen-header-back"
        hitSlop={16}
        onPress={() => navigation.goBack()}>
        <Icon size={24} icon={<ChevronLeft stroke={tailwind.color('text-gray-800')} />} />
      </Pressable>

      <NativeView style={tailwind.style('flex-1 min-w-0')}>
        <Text
          numberOfLines={1}
          style={tailwind.style('text-base font-inter-medium-24 leading-5 text-gray-950')}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={tailwind.style(chatTokens.form.hint)}>
            {subtitle}
          </Text>
        ) : null}
      </NativeView>

      {right}
    </NativeView>
  );
};
