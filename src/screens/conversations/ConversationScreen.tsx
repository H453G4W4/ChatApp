import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, StatusBar } from 'react-native';
import Animated, { LinearTransition, SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';

import {
  ConversationItemContainer,
  ConversationHeader,
  StatusFilters,
  InboxFilters,
  NewConversationFab,
} from './components';

import { ActionTabs } from '@/components-next';
import { Sheet } from '@/components-next/common/sheet/Sheet';

import { EmptyStateIcon } from '@/svg-icons';
import { SCREENS, LAST_ACTIVE_TIMESTAMP_KEY, LAST_ACTIVE_TIMESTAMP_THRESHOLD } from '@/constants';
import {
  ConversationListStateProvider,
  useConversationListStateContext,
  useRefsContext,
} from '@/context';

import { chatTokens, tailwind } from '@/theme';
import { Conversation } from '@/types';
import { useAppDispatch, useAppSelector } from '@/hooks';
import {
  selectBottomSheetState,
  setBottomSheetState,
} from '@/store/conversation/conversationHeaderSlice';
import { resetActionState } from '@/store/conversation/conversationActionSlice';
import { conversationActions } from '@/store/conversation/conversationActions';
import {
  selectConversationsLoading,
  selectConversationError,
  selectIsAllConversationsFetched,
  getFilteredConversations,
} from '@/store/conversation/conversationSelectors';
import { selectFilters, FilterState } from '@/store/conversation/conversationFilterSlice';
import { ConversationPayload } from '@/store/conversation/conversationTypes';
import { clearAllConversations } from '@/store/conversation/conversationSlice';
import { selectCurrentUserAccountId } from '@/store/auth/authSelectors';
import { inboxActions } from '@/store/inbox/inboxActions';
import { clearAllContacts } from '@/store/contact/contactSlice';
import { clearAssignableAgents } from '@/store/assignable-agent/assignableAgentSlice';

import i18n from '@/i18n';
import ActionBottomSheet from '@/navigation/tabs/ActionBottomSheet';
import { getCurrentRouteName } from '@/utils/navigationUtils';
import { useTabBarHeight } from '@/utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The screen list thats need to be checked for refreshing the conversations list
const REFRESH_SCREEN_LIST = [SCREENS.CONVERSATION, SCREENS.INBOX, SCREENS.SETTINGS];

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

type FlashListRenderItemType = {
  item: Conversation;
};

const ConversationList = () => {
  const dispatch = useAppDispatch();
  const tabBarHeight = useTabBarHeight();
  const [appState, setAppState] = useState(AppState.currentState);

  // This is used to prevent the infinite scrolling before the list is ready
  const [isFlashListReady, setFlashListReady] = useState(false);
  // This is used for pull to refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  // This is used for pagination
  const [pageNumber, setPageNumber] = useState(1);
  const queueGeneration = useRef(0);
  const isPageRequestInFlight = useRef(false);
  const accountId = useAppSelector(selectCurrentUserAccountId);

  // This is used to store the index of the item that is currently selected
  const { openedRowIndex } = useConversationListStateContext();

  // This is used to check if the conversations are still loading
  const isConversationsLoading = useAppSelector(selectConversationsLoading);
  const conversationsError = useAppSelector(selectConversationError);
  // This is used to check if all the conversations are fetched
  const isAllConversationsFetched = useAppSelector(selectIsAllConversationsFetched);

  const handleRender = useCallback(
    ({ item }: FlashListRenderItemType) => (
      <ConversationItemContainer
        index={item.id}
        conversationItem={item}
        openedRowIndex={openedRowIndex as SharedValue<number | null>}
      />
    ),
    [openedRowIndex],
  );

  const filters = useAppSelector(selectFilters);

  // Reset last active timestamp when the conversation screen is opened
  useEffect(() => {
    AsyncStorage.removeItem(LAST_ACTIVE_TIMESTAMP_KEY);
  }, []);

  // Fetch on mount and whenever the account or filters change (single effect so a
  // switch that also resets filters doesn't fire two fetches).
  useEffect(() => {
    clearAndFetchConversations(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, filters]);

  const clearAndFetchConversations = useCallback(async (filters: FilterState) => {
    queueGeneration.current += 1;
    isPageRequestInFlight.current = false;
    setPageNumber(1);
    await dispatch(clearAllConversations());
    await dispatch(clearAllContacts());
    await dispatch(clearAssignableAgents());
    await fetchConversations(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ListFooterComponent = () => {
    if (isAllConversationsFetched || !isFlashListReady) return null;
    return (
      <Animated.View
        style={tailwind.style('flex-1 items-center justify-center pt-8', `pb-[${tabBarHeight}px]`)}>
        <ActivityIndicator size="small" />
      </Animated.View>
    );
  };

  const handleRefresh = useCallback(() => {
    setFlashListReady(false);
    setIsRefreshing(true);
    // Inbox records only decorate the rows with a name and channel icon, so they
    // refresh alongside the queue instead of gating it.
    dispatch(inboxActions.fetchInboxes());
    clearAndFetchConversations(filters).finally(() => {
      setIsRefreshing(false);
    });
  }, [dispatch, clearAndFetchConversations, filters]);

  const checkAppStateAndFetchConversations = useCallback(async () => {
    const generation = queueGeneration.current;
    const lastActiveTimestamp = await AsyncStorage.getItem(LAST_ACTIVE_TIMESTAMP_KEY);
    if (lastActiveTimestamp) {
      const currentTimestamp = Date.now();
      const difference = currentTimestamp - parseInt(lastActiveTimestamp);
      if (difference > LAST_ACTIVE_TIMESTAMP_THRESHOLD && generation === queueGeneration.current) {
        dispatch(inboxActions.fetchInboxes());
        await clearAndFetchConversations(filters);
      }
    }
  }, [dispatch, clearAndFetchConversations, filters]);

  // Update conversations when app comes to foreground from background
  useEffect(() => {
    const appStateListener = AppState.addEventListener('change', nextAppState => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        const routeName = getCurrentRouteName();
        if (routeName && REFRESH_SCREEN_LIST.includes(routeName)) {
          checkAppStateAndFetchConversations();
        }
      }

      if (appState === 'active' && nextAppState.match(/inactive|background/)) {
        // App is going to background
        const currentTimestamp = Date.now();
        AsyncStorage.setItem(LAST_ACTIVE_TIMESTAMP_KEY, currentTimestamp.toString());
      }

      setAppState(nextAppState);
    });
    return () => {
      appStateListener?.remove();
    };
  }, [appState, checkAppStateAndFetchConversations, clearAndFetchConversations, filters]);

  const fetchConversations = useCallback(
    async (filters: FilterState, page: number = 1) => {
      const conversationFilters = {
        status: filters.status,
        assigneeType: 'all',
        page: page,
        sortBy: 'last_activity_at_desc',
        inboxId: parseInt(filters.inbox_id),
      } as ConversationPayload;

      return dispatch(conversationActions.fetchConversations(conversationFilters));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onChangePageNumber = async () => {
    if (isPageRequestInFlight.current) return;
    isPageRequestInFlight.current = true;
    const generation = queueGeneration.current;
    const nextPageNumber = pageNumber + 1;
    const result = await fetchConversations(filters, nextPageNumber);
    if (generation === queueGeneration.current) {
      isPageRequestInFlight.current = false;
      if (conversationActions.fetchConversations.fulfilled.match(result)) {
        setPageNumber(nextPageNumber);
      }
    }
  };

  const handleOnEndReached = () => {
    const shouldLoadMoreConversations =
      isFlashListReady && !isAllConversationsFetched && !isConversationsLoading;
    if (shouldLoadMoreConversations) {
      onChangePageNumber();
    }
  };

  const handleScrollBeginDrag = useCallback(() => {
    openedRowIndex.value = -1;
    if (!isFlashListReady) {
      setFlashListReady(true);
    }
  }, [isFlashListReady, openedRowIndex]);

  const allConversations = useAppSelector(state => getFilteredConversations(state, filters));

  const shouldShowEmptyLoader = isConversationsLoading && allConversations.length === 0;
  // An empty queue means something different when the request itself failed.
  const hasLoadError = Boolean(conversationsError) && allConversations.length === 0;

  return shouldShowEmptyLoader ? (
    <Animated.View style={tailwind.style(chatTokens.state.container, `pb-[${tabBarHeight}px]`)}>
      <ActivityIndicator />
    </Animated.View>
  ) : allConversations.length === 0 ? (
    <Animated.ScrollView
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      contentContainerStyle={tailwind.style(chatTokens.state.container, `pb-[${tabBarHeight}px]`)}>
      <EmptyStateIcon />
      <Animated.Text
        testID="conversation-list-state-title"
        style={tailwind.style(chatTokens.state.title)}>
        {hasLoadError ? i18n.t('CONVERSATION.ERROR_TITLE') : i18n.t('CONVERSATION.EMPTY_TITLE')}
      </Animated.Text>
      <Animated.Text style={tailwind.style(chatTokens.state.body)}>
        {hasLoadError ? i18n.t('CONVERSATION.ERROR_BODY') : i18n.t('CONVERSATION.EMPTY')}
      </Animated.Text>
      {hasLoadError ? (
        <Pressable
          accessibilityRole="button"
          testID="conversation-list-retry"
          onPress={handleRefresh}
          style={({ pressed }) => tailwind.style(chatTokens.state.retry, pressed && 'opacity-80')}>
          <Animated.Text style={tailwind.style(chatTokens.state.retryText)}>
            {i18n.t('CONVERSATION.RETRY')}
          </Animated.Text>
        </Pressable>
      ) : null}
    </Animated.ScrollView>
  ) : (
    <AnimatedFlashList
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
      data={allConversations}
      keyExtractor={item => String((item as Conversation).id)}
      maintainVisibleContentPosition={{ disabled: true }}
      onScrollBeginDrag={handleScrollBeginDrag}
      onEndReached={handleOnEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={ListFooterComponent}
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      renderItem={handleRender}
      contentContainerStyle={tailwind.style(`pb-[${tabBarHeight - 1}px]`)}
    />
  );
};

const ConversationScreen = () => {
  const currentBottomSheet = useAppSelector(selectBottomSheetState);
  const dispatch = useAppDispatch();

  const { filtersModalSheetRef } = useRefsContext();

  const handleOnDismiss = () => {
    /**
     * Resetting the bottoms sheet state to none with a timeout
     * to avoid flickering of bottom sheet
     */
    dispatch(setBottomSheetState('none'));
    dispatch(resetActionState());
  };

  const isInbox = currentBottomSheet === 'inbox_id';

  const filterHeight = (() => {
    switch (currentBottomSheet) {
      case 'status':
        return 290;
      default:
        return 250;
    }
  })();

  return (
    <SafeAreaView edges={['top']} style={tailwind.style('flex-1 bg-white')}>
      <StatusBar
        translucent
        backgroundColor={tailwind.color('bg-white')}
        barStyle={'dark-content'}
      />
      <ConversationListStateProvider>
        <ConversationHeader />
        <Animated.View
          style={tailwind.style('flex-1')}
          layout={LinearTransition.springify().damping(22).stiffness(180)}>
          <ConversationList />
        </Animated.View>
        <NewConversationFab />
        <Sheet
          ref={filtersModalSheetRef}
          height={isInbox ? undefined : filterHeight}
          detents={isInbox ? [0.7] : undefined}
          scrollable={isInbox}
          onDismiss={handleOnDismiss}>
          {isInbox ? (
            <InboxFilters />
          ) : (
            <>{currentBottomSheet === 'status' ? <StatusFilters /> : null}</>
          )}
        </Sheet>
        <ActionBottomSheet />
        <ActionTabs />
      </ConversationListStateProvider>
    </SafeAreaView>
  );
};

export default ConversationScreen;
