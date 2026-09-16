import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Animated, StatusBar, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import * as Application from 'expo-application';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '@/components-next';
import { URL_WITHOUT_HTTP_REGEX } from '@/constants';
import { LinkIcon } from '@/svg-icons';
import { chatTokens, tailwind } from '@/theme';
import i18n from '@/i18n';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { selectBaseUrl, selectIsSettingUrl } from '@/store/settings/settingsSelectors';
import { resetSettings } from '@/store/settings/settingsSlice';
import { settingsActions } from '@/store/settings/settingsActions';

type FormData = {
  url: string;
};

const appName = Application.applicationName;

const ConfigURLScreen = () => {
  const baseUrl = useAppSelector(selectBaseUrl);
  // The thunk verifies the address against the server, so the button has to
  // stay in a waiting state for the length of that round trip.
  const isConnecting = useAppSelector(selectIsSettingUrl);

  const dispatch = useAppDispatch();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      // Prefills the last server the agent connected to; the Chatwoot-branded
      // build keeps its cloud default, ChatApp starts empty.
      url: baseUrl || (appName === 'Chatwoot' ? 'app.chatwoot.com' : ''),
    },
  });

  useEffect(() => {
    dispatch(resetSettings());
  }, [dispatch]);

  const onSubmit = async (data: FormData) => {
    const { url } = data;
    if (url && !isConnecting) {
      dispatch(settingsActions.setInstallationUrl(url));
    }
  };

  return (
    <SafeAreaView style={tailwind.style('flex-1 bg-white')}>
      <StatusBar
        translucent
        backgroundColor={tailwind.color('bg-white')}
        barStyle={'dark-content'}
      />
      <View style={tailwind.style('flex-1 bg-white')}>
        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          bottomOffset={24}
          contentContainerStyle={tailwind.style('px-6 pt-16 pb-10')}>
          <Icon icon={<LinkIcon />} size={40} />
          <View style={tailwind.style('pt-6 gap-4')}>
            <Animated.Text style={tailwind.style('text-2xl text-gray-950 font-inter-semibold-20')}>
              {i18n.t('CONFIGURE_URL.ENTER_URL')}
            </Animated.Text>
            <Animated.Text
              style={tailwind.style(
                'font-inter-normal-20 leading-[18px] tracking-[0.32px] text-gray-900',
              )}>
              {i18n.t('CONFIGURE_URL.DESCRIPTION')}
            </Animated.Text>
          </View>

          <Controller
            control={control}
            rules={{
              required: i18n.t('CONFIGURE_URL.URL_REQUIRED'),
              pattern: {
                value: URL_WITHOUT_HTTP_REGEX,
                message: i18n.t('CONFIGURE_URL.URL_ERROR'),
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={tailwind.style('pt-8 mb-8 gap-2')}>
                <TextInput
                  style={[
                    tailwind.style(
                      'text-base font-inter-normal-20 tracking-[0.24px] leading-[20px] android:leading-[18px]',
                      'py-2 px-3 rounded-xl text-gray-950 bg-blackA-A4',
                      'h-10',
                    ),
                  ]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  placeholder={i18n.t('CONFIGURE_URL.PLACEHOLDER')}
                  placeholderTextColor={tailwind.color('text-gray-700')}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isConnecting}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  testID="server-url-input"
                />
                {errors.url && (
                  <Animated.Text
                    testID="server-url-error"
                    style={tailwind.style(chatTokens.form.error)}>
                    {errors.url.message}
                  </Animated.Text>
                )}
              </View>
            )}
            name="url"
          />

          {isConnecting ? (
            <View
              testID="server-url-connecting"
              style={tailwind.style(
                'py-[11px] flex-row items-center justify-center gap-2 rounded-[13px] bg-blue-800',
              )}>
              <ActivityIndicator size="small" color={tailwind.color('text-white')} />
              <Animated.Text style={tailwind.style(chatTokens.action.primaryText)}>
                {i18n.t('CONFIGURE_URL.CONNECTING')}
              </Animated.Text>
            </View>
          ) : (
            <Button text={i18n.t('CONFIGURE_URL.CONNECT')} handlePress={handleSubmit(onSubmit)} />
          )}
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
};

export default ConfigURLScreen;
