import React from 'react';
import { ImageSourcePropType, Keyboard, Platform, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

import { Avatar, Icon } from '@/components-next';
import { ChevronLeft, Overflow, ResolvedIcon, SLAIcon } from '@/svg-icons';
import { Sheet } from '@/components-next/common/sheet/Sheet';
import { chatTokens, tailwind } from '@/theme';
import { ChatDropdownMenu, DashboardList } from './DropdownMenu';
import { SLAEvent } from '@/types/common';
import { useRefsContext } from '@/context';
import { SlaEvents } from './SlaEvents';

type ChatHeaderProps = {
  name: string;
  /** Secondary line: the contact's address, then the inbox it arrived on. */
  subtitle?: string;
  imageSrc: ImageSourcePropType;
  isResolved: boolean;
  isSlaMissed?: boolean;
  hasSla?: boolean;
  slaEvents?: SLAEvent[];
  dashboardsList: DashboardList[];
  statusText?: string;
  onBackPress: () => void;
  onContactDetailsPress: () => void;
  onToggleChatStatus: () => void;
};

export const ChatHeader = ({
  name,
  subtitle,
  imageSrc,
  isResolved,
  slaEvents,
  isSlaMissed,
  hasSla,
  statusText,
  dashboardsList,
  onBackPress,
  onContactDetailsPress,
  onToggleChatStatus,
}: ChatHeaderProps) => {
  const { slaEventsSheetRef } = useRefsContext();

  const toggleSlaEventsSheet = () => {
    if (slaEvents?.length) {
      Keyboard.dismiss();
      slaEventsSheetRef.current?.present();
    }
  };

  return (
    <Animated.View style={[tailwind.style('border-b-[1px] border-b-blackA-A3')]}>
      <Animated.View style={tailwind.style(chatTokens.header.bar)}>
        <Pressable
          hitSlop={8}
          testID="chat-header-back"
          style={tailwind.style('h-9 w-8 justify-center items-start')}
          onPress={onBackPress}>
          <Icon icon={<ChevronLeft />} size={24} />
        </Pressable>
        <Pressable
          onPress={onContactDetailsPress}
          style={tailwind.style('flex-1 min-w-0 flex-row items-center gap-2')}>
          <Avatar size="2xl" src={imageSrc} name={name} />
          <Animated.View style={tailwind.style('flex-1 min-w-0')}>
            <Animated.Text numberOfLines={1} style={tailwind.style(chatTokens.header.title)}>
              {name}
            </Animated.Text>
            {subtitle ? (
              <Animated.Text
                numberOfLines={1}
                testID="chat-header-subtitle"
                style={tailwind.style(chatTokens.header.subtitle)}>
                {subtitle}
              </Animated.Text>
            ) : null}
          </Animated.View>
        </Pressable>

        <Animated.View
          style={tailwind.style(
            `flex flex-row justify-end ${Platform.OS === 'ios' ? 'gap-4' : ''}`,
          )}>
          <Animated.View style={tailwind.style('flex flex-row items-center gap-4')}>
            {hasSla && (
              <Pressable hitSlop={8} onPress={toggleSlaEventsSheet}>
                <Icon icon={<SLAIcon color={isSlaMissed ? '#E13D45' : '#BBBBBB'} />} size={24} />
              </Pressable>
            )}
            <Pressable hitSlop={8} onPress={onToggleChatStatus}>
              <Icon
                icon={
                  <ResolvedIcon
                    strokeWidth={2}
                    {...(isResolved && { stroke: tailwind.color('bg-green-700') })}
                  />
                }
                size={24}
              />
            </Pressable>
          </Animated.View>
          {dashboardsList.length > 0 && (
            <ChatDropdownMenu dropdownMenuList={dashboardsList}>
              <Icon icon={<Overflow strokeWidth={2} />} size={24} />
            </ChatDropdownMenu>
          )}
        </Animated.View>
      </Animated.View>
      <Sheet ref={slaEventsSheetRef} detents={[0.36]}>
        <SlaEvents slaEvents={slaEvents} statusText={statusText ?? ''} />
      </Sheet>
    </Animated.View>
  );
};
