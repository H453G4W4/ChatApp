import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useNavigation, StackActions } from '@react-navigation/native';

import { Avatar } from '@/components-next/common';
import { NativeView } from '@/components-next/native-components';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { selectAllInboxes } from '@/store/inbox/inboxSelectors';
import { newConversationActions } from '@/store/new-conversation/newConversationActions';
import {
  resetNewConversation,
  selectIsSendingNewEmail,
  selectNewConversationError,
} from '@/store/new-conversation/newConversationSlice';
import {
  defaultEmailInboxId,
  findContactByEmail,
  hasErrors,
  selectableEmailInboxes,
  validateNewEmailDraft,
  type NewEmailErrors,
} from '@/utils/newEmailUtils';
import type { Contact } from '@/types';
import { chatTokens, tailwind } from '@/theme';
import i18n from '@/i18n';

import { ScreenHeader } from './components/ScreenHeader';
import { useContactSearch } from './useContactSearch';

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

const Field = ({ label, error, hint, children }: FieldProps) => (
  <NativeView style={tailwind.style(chatTokens.form.field)}>
    <Text style={tailwind.style(chatTokens.form.label)}>{label}</Text>
    <NativeView style={tailwind.style('pt-1.5')}>{children}</NativeView>
    {error ? <Text style={tailwind.style(chatTokens.form.error, 'pt-1')}>{error}</Text> : null}
    {!error && hint ? (
      <Text style={tailwind.style(chatTokens.form.hint, 'pt-1')}>{hint}</Text>
    ) : null}
  </NativeView>
);

const NewEmailScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  const inboxes = useAppSelector(selectAllInboxes);
  const isSending = useAppSelector(selectIsSendingNewEmail);
  const submitError = useAppSelector(selectNewConversationError);

  const emailInboxes = useMemo(() => selectableEmailInboxes(inboxes), [inboxes]);

  const [inboxId, setInboxId] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<NewEmailErrors>({});
  // Set once the agent taps a suggestion, so the name field can stop asking for
  // a name we already have on the server.
  const [pickedContact, setPickedContact] = useState<Contact | null>(null);

  const { results, isSearching, isEmpty } = useContactSearch(pickedContact ? '' : email);

  useEffect(() => {
    dispatch(resetNewConversation());
    return () => {
      dispatch(resetNewConversation());
    };
  }, [dispatch]);

  // Preselect when there is exactly one email inbox; re-runs if inboxes arrive late.
  useEffect(() => {
    setInboxId(previous => previous ?? defaultEmailInboxId(inboxes));
  }, [inboxes]);

  const matchedContact = useMemo(
    () => pickedContact ?? findContactByEmail(results, email),
    [pickedContact, results, email],
  );
  const isNewContact = Boolean(email.trim()) && !matchedContact;

  const onChangeEmail = useCallback((value: string) => {
    setEmail(value);
    setPickedContact(null);
    setErrors(previous => ({ ...previous, email: undefined }));
  }, []);

  const onPickContact = useCallback((contact: Contact) => {
    setPickedContact(contact);
    setEmail(contact.email ?? '');
    setName(contact.name ?? '');
    setErrors(previous => ({ ...previous, email: undefined }));
  }, []);

  const handleSend = useCallback(async () => {
    // Redux already refuses a second dispatch while one is in flight; this stops
    // the validation pass and keyboard work from running twice too.
    if (isSending) return;

    const draft = { inboxId, email, name, subject, content };
    const validation = validateNewEmailDraft(draft, inboxes);
    setErrors(validation);
    if (hasErrors(validation) || !inboxId) return;

    const result = await dispatch(
      newConversationActions.startEmailConversation({
        inboxId,
        email,
        name: name.trim() || undefined,
        subject: subject.trim(),
        content: content.trim(),
      }),
    );

    // Only a server-created conversation is ever navigated to.
    if (newConversationActions.startEmailConversation.fulfilled.match(result)) {
      navigation.dispatch(
        StackActions.replace('ChatScreen', {
          conversationId: result.payload.conversationId,
          isConversationOpenedExternally: false,
        }),
      );
    }
  }, [dispatch, navigation, isSending, inboxId, email, name, subject, content, inboxes]);

  const sendButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isSending }}
      testID="new-email-send"
      disabled={isSending}
      onPress={handleSend}
      style={tailwind.style(
        chatTokens.action.primary,
        'h-9 px-4',
        isSending && chatTokens.action.primaryDisabled,
      )}>
      {isSending ? (
        <ActivityIndicator size="small" color={tailwind.color('text-white')} />
      ) : (
        <Text style={tailwind.style(chatTokens.action.primaryText, 'text-md')}>
          {i18n.t('NEW_EMAIL.SEND')}
        </Text>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={tailwind.style('flex-1', chatTokens.screen.background)}>
      <ScreenHeader title={i18n.t('NEW_EMAIL.TITLE')} right={sendButton} />

      <KeyboardAvoidingView behavior="padding" style={tailwind.style('flex-1')}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={tailwind.style('pb-8')}
          style={tailwind.style('flex-1')}>
          <Field label={i18n.t('NEW_EMAIL.FROM')} error={errors.inboxId && i18n.t(errors.inboxId)}>
            {emailInboxes.length === 0 ? (
              <Text style={tailwind.style(chatTokens.form.hint)}>
                {i18n.t('NEW_CHAT.NO_EMAIL_INBOX')}
              </Text>
            ) : (
              <NativeView style={tailwind.style('flex-row flex-wrap gap-2')}>
                {emailInboxes.map(inbox => {
                  const isSelected = inbox.id === inboxId;
                  return (
                    <Pressable
                      key={inbox.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      testID={`new-email-inbox-${inbox.id}`}
                      onPress={() => {
                        setInboxId(inbox.id);
                        setErrors(previous => ({ ...previous, inboxId: undefined }));
                      }}
                      style={tailwind.style(
                        'px-3 py-1.5 rounded-full border-[1px]',
                        isSelected ? 'bg-blue-100 border-blue-700' : 'bg-white border-blackA-A5',
                      )}>
                      <Text
                        style={tailwind.style(
                          'text-md font-inter-420-20 leading-5',
                          isSelected ? 'text-blue-900' : 'text-gray-900',
                        )}>
                        {inbox.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </NativeView>
            )}
          </Field>

          <Field label={i18n.t('NEW_EMAIL.TO')} error={errors.email && i18n.t(errors.email)}>
            <TextInput
              testID="new-email-to"
              value={email}
              onChangeText={onChangeEmail}
              placeholder={i18n.t('NEW_EMAIL.TO_PLACEHOLDER')}
              placeholderTextColor={tailwind.color('text-gray-700')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={tailwind.style(chatTokens.form.input)}
            />
          </Field>

          {isSearching ? (
            <Text style={tailwind.style(chatTokens.form.hint, 'px-4 pt-3 pb-1')}>
              {i18n.t('NEW_EMAIL.SEARCHING')}
            </Text>
          ) : null}

          {!pickedContact && results.length > 0 ? (
            <Text style={tailwind.style(chatTokens.form.label, 'px-4 pt-3 pb-1')}>
              {i18n.t('NEW_EMAIL.EXISTING_CONTACT')}
            </Text>
          ) : null}

          {/* Suggestions never gate sending; they only save typing. */}
          {!pickedContact &&
            results.slice(0, 5).map(contact => (
              <Pressable
                key={contact.id}
                testID={`new-email-contact-${contact.id}`}
                onPress={() => onPickContact(contact)}
                style={({ pressed }) =>
                  tailwind.style(chatTokens.form.suggestion, pressed && 'bg-blackA-A2')
                }>
                <Avatar
                  size="md"
                  name={contact.name ?? contact.email ?? ''}
                  src={contact.thumbnail ? { uri: contact.thumbnail } : undefined}
                />
                <NativeView style={tailwind.style('flex-1 min-w-0')}>
                  <Text
                    numberOfLines={1}
                    style={tailwind.style('text-md font-inter-medium-24 text-gray-950')}>
                    {contact.name || contact.email}
                  </Text>
                  {contact.email ? (
                    <Text numberOfLines={1} style={tailwind.style(chatTokens.form.hint)}>
                      {contact.email}
                    </Text>
                  ) : null}
                </NativeView>
              </Pressable>
            ))}

          {isEmpty && !pickedContact ? (
            <Text style={tailwind.style(chatTokens.form.hint, 'px-4 py-2')}>
              {i18n.t('NEW_EMAIL.NO_CONTACTS')}
            </Text>
          ) : null}

          {isNewContact ? (
            <Field
              label={i18n.t('NEW_EMAIL.CONTACT_NAME')}
              hint={i18n.t('NEW_EMAIL.CONTACT_NAME_HINT')}>
              <TextInput
                testID="new-email-name"
                value={name}
                onChangeText={setName}
                placeholder={i18n.t('NEW_EMAIL.CONTACT_NAME_PLACEHOLDER')}
                placeholderTextColor={tailwind.color('text-gray-700')}
                style={tailwind.style(chatTokens.form.input)}
              />
            </Field>
          ) : null}

          <Field
            label={i18n.t('NEW_EMAIL.SUBJECT')}
            error={errors.subject && i18n.t(errors.subject)}>
            <TextInput
              testID="new-email-subject"
              value={subject}
              onChangeText={value => {
                setSubject(value);
                setErrors(previous => ({ ...previous, subject: undefined }));
              }}
              placeholder={i18n.t('NEW_EMAIL.SUBJECT_PLACEHOLDER')}
              placeholderTextColor={tailwind.color('text-gray-700')}
              style={tailwind.style(chatTokens.form.input)}
            />
          </Field>

          <Field
            label={i18n.t('NEW_EMAIL.MESSAGE')}
            error={errors.content && i18n.t(errors.content)}>
            <TextInput
              testID="new-email-content"
              value={content}
              onChangeText={value => {
                setContent(value);
                setErrors(previous => ({ ...previous, content: undefined }));
              }}
              placeholder={i18n.t('NEW_EMAIL.MESSAGE_PLACEHOLDER')}
              placeholderTextColor={tailwind.color('text-gray-700')}
              multiline
              textAlignVertical="top"
              style={tailwind.style(chatTokens.form.inputMultiline)}
              scrollEnabled={false}
            />
          </Field>

          {submitError ? (
            <Text
              testID="new-email-error"
              style={tailwind.style(chatTokens.form.error, 'px-4 py-3')}>
              {i18n.t(submitError, { defaultValue: submitError })}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default NewEmailScreen;
