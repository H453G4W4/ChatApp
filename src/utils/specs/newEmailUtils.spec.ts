import {
  defaultEmailInboxId,
  findContactByEmail,
  hasErrors,
  isValidEmail,
  normalizeEmail,
  selectableEmailInboxes,
  validateNewEmailDraft,
  type NewEmailDraft,
} from '../newEmailUtils';
import type { Inbox } from '@/types/Inbox';
import type { Contact } from '@/types';

const inbox = (id: number, channelType: string, name = `Inbox ${id}`) =>
  ({ id, name, channelType, medium: '' }) as Inbox;

const emailInbox = inbox(1, 'Channel::Email', 'Support Mailbox');
const secondEmailInbox = inbox(2, 'Channel::Email', 'Billing Mailbox');
const whatsappInbox = inbox(3, 'Channel::Whatsapp', 'WhatsApp');

const draft = (overrides: Partial<NewEmailDraft> = {}): NewEmailDraft => ({
  inboxId: emailInbox.id,
  email: 'ada@example.com',
  subject: 'Invoice question',
  content: 'Hello there',
  ...overrides,
});

describe('selectableEmailInboxes', () => {
  it('offers only email channels from the authenticated inbox list', () => {
    expect(selectableEmailInboxes([emailInbox, whatsappInbox, secondEmailInbox])).toEqual([
      emailInbox,
      secondEmailInbox,
    ]);
  });
});

describe('defaultEmailInboxId', () => {
  it('preselects the inbox when the agent has exactly one email inbox', () => {
    expect(defaultEmailInboxId([emailInbox, whatsappInbox])).toBe(emailInbox.id);
  });

  it('leaves the choice to the agent when several email inboxes exist', () => {
    expect(defaultEmailInboxId([emailInbox, secondEmailInbox])).toBeNull();
  });

  it('preselects nothing when no email inbox is available', () => {
    expect(defaultEmailInboxId([whatsappInbox])).toBeNull();
  });
});

describe('isValidEmail', () => {
  it.each(['ada@example.com', ' ada@example.com ', 'a.b+tag@sub.example.co.uk'])(
    'accepts %s',
    value => expect(isValidEmail(value)).toBe(true),
  );

  it.each(['', 'ada', 'ada@', '@example.com', 'ada example.com'])('rejects %s', value =>
    expect(isValidEmail(value)).toBe(false),
  );
});

describe('validateNewEmailDraft', () => {
  const inboxes = [emailInbox, secondEmailInbox, whatsappInbox];

  it('accepts a complete draft', () => {
    expect(validateNewEmailDraft(draft(), inboxes)).toEqual({});
    expect(hasErrors({})).toBe(false);
  });

  it('rejects an invalid recipient address', () => {
    const errors = validateNewEmailDraft(draft({ email: 'not-an-address' }), inboxes);
    expect(errors.email).toBe('NEW_EMAIL.ERRORS.EMAIL_INVALID');
    expect(hasErrors(errors)).toBe(true);
  });

  it('rejects a missing recipient', () => {
    expect(validateNewEmailDraft(draft({ email: '   ' }), inboxes).email).toBe(
      'NEW_EMAIL.ERRORS.EMAIL_REQUIRED',
    );
  });

  it('rejects a new email thread without a subject', () => {
    expect(validateNewEmailDraft(draft({ subject: '   ' }), inboxes).subject).toBe(
      'NEW_EMAIL.ERRORS.SUBJECT_REQUIRED',
    );
  });

  it('rejects an empty message body', () => {
    expect(validateNewEmailDraft(draft({ content: '  \n ' }), inboxes).content).toBe(
      'NEW_EMAIL.ERRORS.CONTENT_REQUIRED',
    );
  });

  it('rejects sending before an inbox is chosen', () => {
    expect(validateNewEmailDraft(draft({ inboxId: null }), inboxes).inboxId).toBe(
      'NEW_EMAIL.ERRORS.INBOX_REQUIRED',
    );
  });

  it('rejects an inbox the agent was not given', () => {
    // 99 is not in the account's authenticated inbox list at all.
    expect(validateNewEmailDraft(draft({ inboxId: 99 }), inboxes).inboxId).toBe(
      'NEW_EMAIL.ERRORS.INBOX_NOT_ALLOWED',
    );
  });

  it('rejects a non-email inbox even though the agent can access it', () => {
    expect(validateNewEmailDraft(draft({ inboxId: whatsappInbox.id }), inboxes).inboxId).toBe(
      'NEW_EMAIL.ERRORS.INBOX_NOT_ALLOWED',
    );
  });

  it('reports every problem at once rather than one at a time', () => {
    const errors = validateNewEmailDraft(
      { inboxId: null, email: '', subject: '', content: '' },
      inboxes,
    );
    expect(Object.keys(errors).sort()).toEqual(['content', 'email', 'inboxId', 'subject']);
  });
});

describe('findContactByEmail', () => {
  const ada = { id: 7, name: 'Ada', email: 'Ada@Example.com' } as Contact;
  const grace = { id: 8, name: 'Grace', email: 'grace@example.com' } as Contact;

  it('matches on the address regardless of casing or padding', () => {
    expect(findContactByEmail([grace, ada], '  ada@example.com ')).toBe(ada);
  });

  it('ignores hits that matched on name or phone rather than the address', () => {
    // Chatwoot's search also matches names, so the first hit is not trustworthy.
    expect(findContactByEmail([grace], 'ada@example.com')).toBeUndefined();
  });

  it('ignores contacts with no email at all', () => {
    expect(
      findContactByEmail([{ id: 9, email: null } as Contact], 'ada@example.com'),
    ).toBeUndefined();
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases so the source id is stable', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });
});
