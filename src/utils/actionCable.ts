import {
  updateConversation,
  addOrUpdateMessage,
  receiveMessageCreated,
  hydrateConversationMessages,
} from '@/store/conversation/conversationSlice';
import { ConversationService } from '@/store/conversation/conversationService';
import { addContact, updateContact, updateContactsPresence } from '@/store/contact/contactSlice';
import { setTypingUsers, removeTypingUser } from '@/store/conversation/conversationTypingSlice';
import BaseActionCableConnector from './baseActionCableConnector';
import { store } from '@/store';
import { Contact, Conversation, Message, PresenceUpdateData, TypingData } from '@/types';
import {
  transformMessage,
  transformConversation,
  transformTypingData,
  transformContact,
  transformNotificationCreatedResponse,
  transformNotificationRemovedResponse,
} from './camelCaseKeys';
import { addNotification } from '@/store/notification/notificationSlice';
import { setCurrentUserAvailability } from '@/store/auth/authSlice';
import { removeNotification } from '@/store/notification/notificationSlice';
import {
  NotificationCreatedResponse,
  NotificationRemovedResponse,
} from '@/store/notification/notificationTypes';

interface ActionCableConfig {
  pubSubToken: string;
  webSocketUrl: string;
  accountId: number;
  userId: number;
}

class ActionCableConnector extends BaseActionCableConnector {
  private CancelTyping: { [key: number]: NodeJS.Timeout | null };
  private pendingConversations = new Map<number, Message[]>();
  private readonly userId: number;
  private readonly pubSubToken: string;
  private readonly authClient: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected events: { [key: string]: (data: any) => void };

  constructor(pubSubToken: string, webSocketUrl: string, accountId: number, userId: number) {
    super(pubSubToken, webSocketUrl, accountId, userId);
    this.userId = userId;
    this.pubSubToken = pubSubToken;
    this.authClient = store.getState().auth.headers?.client;
    this.CancelTyping = {};
    this.events = {
      'message.created': this.onMessageCreated,
      'message.updated': this.onMessageUpdated,
      'conversation.created': this.onConversationCreated,
      'conversation.status_changed': this.onStatusChange,
      'conversation.read': this.onConversationRead,
      'assignee.changed': this.onAssigneeChanged,
      'conversation.updated': this.onConversationUpdated,
      'conversation.typing_on': this.onTypingOn,
      'conversation.typing_off': this.onTypingOff,
      'contact.updated': this.onContactUpdate,
      'notification.created': this.onNotificationCreated,
      'notification.deleted': this.onNotificationRemoved,
      'presence.update': this.onPresenceUpdate,

      // TODO: Handle all these events later
      // 'conversation.contact_changed': this.onConversationContactChange,
      // 'contact.deleted': this.onContactDelete,
      // 'conversation.mentioned': this.onConversationMentioned,
      // 'first.reply.created': this.onFirstReplyCreated,
    };
  }

  /**
   * Confirms the event belongs to the session this connector was opened for.
   *
   * This is not a permission check: Chatwoot decides which inboxes an agent may
   * see, and the socket only pushes events for inboxes the agent is subscribed
   * to. It exists so events that are still in flight during a logout, account
   * switch or reconnect are not applied to the next session's store. Locally
   * cached inbox records are never consulted, because an inbox list that has not
   * loaded yet must not drop realtime updates.
   */
  private isCurrentSession = (accountId?: number) => {
    const { auth } = store.getState();
    return (
      currentConnector === this &&
      auth.user?.id === this.userId &&
      auth.user?.account_id === this.accountId &&
      auth.user?.pubsub_token === this.pubSubToken &&
      auth.headers?.client === this.authClient &&
      Boolean(auth.headers?.['access-token'] || auth.accessToken) &&
      accountId === this.accountId
    );
  };

  private hydrateConversation = async (
    conversationId: number,
    inboxId: number | undefined,
    message?: Message,
  ) => {
    const queued = this.pendingConversations.get(conversationId);
    if (queued) {
      if (message) queued.push(message);
      return;
    }

    const messages = message ? [message] : [];
    this.pendingConversations.set(conversationId, messages);
    try {
      // The nested socket conversation is only a summary. The authenticated
      // show endpoint supplies contact metadata and enforces server permissions.
      const { conversation } = await ConversationService.fetchConversation(conversationId);
      if (
        !this.isCurrentSession(this.accountId) ||
        conversation.id !== conversationId ||
        (inboxId !== undefined && conversation.inboxId !== inboxId) ||
        (conversation.accountId != null && conversation.accountId !== this.accountId)
      ) {
        return;
      }
      store.dispatch(hydrateConversationMessages({ conversation, messages }));
      store.dispatch(addContact(conversation));
    } catch {
      // Forbidden/deleted conversations and failed requests never create rows.
      // A later event or the existing refresh flow can retry transient failures.
    } finally {
      this.pendingConversations.delete(conversationId);
    }
  };

  onMessageCreated = (data: Message) => {
    const message = transformMessage(data);
    if (!this.isCurrentSession(message.accountId)) return;
    const existing = store.getState().conversations.entities[message.conversationId];
    // An unloaded conversation is never ignored. The authenticated show endpoint
    // decides whether this agent may have it; a denial simply never inserts a row.
    if (!existing) {
      return this.hydrateConversation(message.conversationId, message.inboxId, message);
    }
    store.dispatch(receiveMessageCreated(message));
  };

  onConversationCreated = (data: Conversation) => {
    return this.onConversationUpdated(data);
  };

  onMessageUpdated = (data: Message) => {
    const message = transformMessage(data);
    if (!this.isCurrentSession(message.accountId)) return;
    // Edits/status changes only matter for history already on screen.
    if (!store.getState().conversations.entities[message.conversationId]) return;
    store.dispatch(addOrUpdateMessage(message));
  };

  onConversationUpdated = (data: Conversation) => {
    const conversation = transformConversation(data);
    if (!this.isCurrentSession(conversation.accountId)) return;
    if (!store.getState().conversations.entities[conversation.id]) {
      return this.hydrateConversation(conversation.id, conversation.inboxId);
    }
    store.dispatch(updateConversation(conversation));
    store.dispatch(addContact(conversation));
  };

  onAssigneeChanged = (data: Conversation) => {
    return this.onConversationUpdated(data);
  };

  onStatusChange = (data: Conversation) => {
    return this.onConversationUpdated(data);
  };

  onConversationRead = (data: Conversation) => {
    return this.onConversationUpdated(data);
  };

  onContactUpdate = (data: Contact) => {
    const contact = transformContact(data);
    store.dispatch(updateContact(contact));
  };

  onNotificationCreated = (data: NotificationCreatedResponse) => {
    const notification: NotificationCreatedResponse = transformNotificationCreatedResponse(data);
    store.dispatch(addNotification(notification));
  };

  onNotificationRemoved = (data: NotificationRemovedResponse) => {
    const notification: NotificationRemovedResponse = transformNotificationRemovedResponse(data);
    store.dispatch(removeNotification(notification));
  };

  onTypingOn = (data: TypingData) => {
    const typingData = transformTypingData(data);
    const { conversation, user } = typingData;
    const conversationId = conversation.id;
    store.dispatch(setTypingUsers({ conversationId, user }));
    this.initTimer(typingData);
  };

  onTypingOff = (data: TypingData) => {
    const typingData = transformTypingData(data);
    const { conversation, user } = typingData;
    const conversationId = conversation.id;
    store.dispatch(removeTypingUser({ conversationId, user }));
    this.clearTimer(conversationId);
  };

  private initTimer = (data: TypingData) => {
    const { conversation } = data;
    const conversationId = conversation.id;
    if (this.CancelTyping[conversationId]) {
      clearTimeout(this.CancelTyping[conversationId]!);
      this.CancelTyping[conversationId] = null;
    }
    this.CancelTyping[conversationId] = setTimeout(() => {
      this.onTypingOff(data);
    }, 30000);
  };

  private clearTimer = (conversationId: number) => {
    if (this.CancelTyping[conversationId]) {
      clearTimeout(this.CancelTyping[conversationId]!);
      this.CancelTyping[conversationId] = null;
    }
  };

  onPresenceUpdate = (data: PresenceUpdateData) => {
    const { contacts, users } = data;
    store.dispatch(
      updateContactsPresence({
        contacts,
      }),
    );
    store.dispatch(
      setCurrentUserAvailability({
        users,
      }),
    );
  };
}

let currentConnector: ActionCableConnector | null = null;

export default {
  init({ pubSubToken, webSocketUrl, accountId, userId }: ActionCableConfig) {
    currentConnector?.disconnect();
    currentConnector = new ActionCableConnector(pubSubToken, webSocketUrl, accountId, userId);
    return currentConnector;
  },
};
