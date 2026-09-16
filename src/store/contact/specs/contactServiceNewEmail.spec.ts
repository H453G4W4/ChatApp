import { ContactService } from '../contactService';
import { apiService } from '@/services/APIService';

jest.mock('@/services/APIService', () => ({
  apiService: { get: jest.fn(), post: jest.fn() },
}));

const get = jest.mocked(apiService.get);
const post = jest.mocked(apiService.post);

const rawContact = {
  id: 42,
  name: 'Ada',
  email: 'ada@example.com',
  phone_number: null,
  additional_attributes: {},
  custom_attributes: {},
  created_at: 1,
  last_activity_at: 2,
  thumbnail: '',
  identifier: null,
};

describe('ContactService.searchContacts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the account-scoped contact search endpoint', async () => {
    get.mockResolvedValue({ data: { payload: [rawContact] } } as never);

    const contacts = await ContactService.searchContacts({ q: 'ada@example.com' });

    expect(get).toHaveBeenCalledWith(
      'contacts/search',
      expect.objectContaining({ params: { q: 'ada@example.com' } }),
    );
    // Response is camel-cased on the way in, like every other list in the app.
    expect(contacts[0]).toMatchObject({ id: 42, email: 'ada@example.com', phoneNumber: null });
  });

  it('forwards the abort signal so a superseded keystroke cancels its request', async () => {
    get.mockResolvedValue({ data: { payload: [] } } as never);
    const controller = new AbortController();

    await ContactService.searchContacts({ q: 'ada' }, controller.signal);

    expect(get).toHaveBeenCalledWith(
      'contacts/search',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('returns an empty list when the server sends no payload', async () => {
    get.mockResolvedValue({ data: {} } as never);
    await expect(ContactService.searchContacts({ q: 'ada' })).resolves.toEqual([]);
  });
});

describe('ContactService.createContact', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts the address and inbox to the documented contacts endpoint', async () => {
    post.mockResolvedValue({ data: { payload: { contact: rawContact } } } as never);

    const contact = await ContactService.createContact({
      inboxId: 7,
      email: 'ada@example.com',
      name: 'Ada',
    });

    expect(post).toHaveBeenCalledWith('contacts', {
      inbox_id: 7,
      email: 'ada@example.com',
      name: 'Ada',
    });
    expect(contact.id).toBe(42);
  });

  it('omits the name entirely when the agent left it blank', async () => {
    post.mockResolvedValue({ data: { payload: { contact: rawContact } } } as never);

    await ContactService.createContact({ inboxId: 7, email: 'ada@example.com' });

    expect(post).toHaveBeenCalledWith('contacts', { inbox_id: 7, email: 'ada@example.com' });
  });

  it('unwraps a response that returns the contact directly under payload', async () => {
    post.mockResolvedValue({ data: { payload: rawContact } } as never);

    await expect(
      ContactService.createContact({ inboxId: 7, email: 'ada@example.com' }),
    ).resolves.toMatchObject({ id: 42 });
  });
});
