/**
 * The API layer refuses replies that outlived the session or account that asked
 * for them, so no installation's data can seed the next session's store.
 */
import { getStore } from '@/store/storeAccessor';

jest.mock('@/store/storeAccessor', () => ({ getStore: jest.fn() }));
jest.mock('@/utils/toastUtils', () => ({ showToast: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));
jest.mock('expo-device', () => ({ osVersion: '14', modelName: 'Pixel' }));

const withUser = (user: unknown) =>
  jest.mocked(getStore).mockReturnValue({
    getState: () => ({ auth: { user, headers: {} }, settings: { installationUrl: 'https://a/' } }),
    dispatch: jest.fn(),
  } as never);

/**
 * APIService registers its interceptors when the module first loads, so axios is
 * stubbed before requiring it and the registered pair is captured once.
 */
const responseHandlers = (() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axios = require('axios').default;
  const use = jest.fn();
  jest.spyOn(axios, 'create').mockReturnValue({
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use } },
  } as never);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/services/APIService');

  const [onFulfilled, onRejected] = use.mock.calls.at(-1) as [
    (r: unknown) => unknown,
    (e: unknown) => unknown,
  ];
  return { onFulfilled, onRejected };
})();

const { onFulfilled, onRejected } = responseHandlers;

const responseFor = (url: string) => ({ config: { url }, data: {}, status: 200 });

describe('responses that outlive their session', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an account-scoped response once the user has logged out', async () => {
    withUser(undefined);

    // A conversation request that was still on the wire when logout happened.
    await expect(
      Promise.resolve(onFulfilled(responseFor('api/v1/accounts/1/conversations/42'))),
    ).rejects.toMatchObject({ name: 'CanceledError' });
  });

  it('lets an account-scoped response through while the session is live', async () => {
    withUser({ id: 11, account_id: 1 });

    const response = responseFor('api/v1/accounts/1/conversations/42');
    expect(onFulfilled(response)).toBe(response);
  });

  it('still allows sign-in, which legitimately runs with no user yet', async () => {
    withUser(undefined);

    // Not account-scoped, so the logged-out check must not touch it.
    const response = responseFor('auth/sign_in');
    expect(onFulfilled(response)).toBe(response);

    const profile = responseFor('api/v1/profile');
    expect(onFulfilled(profile)).toBe(profile);
  });

  it('rejects a response for an account the user has switched away from', async () => {
    withUser({ id: 11, account_id: 2 });

    await expect(
      Promise.resolve(onFulfilled(responseFor('api/v1/accounts/1/conversations'))),
    ).rejects.toMatchObject({ name: 'CanceledError' });
  });

  it('swallows an error from an ended session instead of logging the agent out again', async () => {
    withUser(undefined);

    await expect(
      Promise.resolve(
        onRejected({
          config: { url: 'api/v1/accounts/1/conversations' },
          response: { status: 401 },
        }),
      ),
    ).rejects.toMatchObject({ name: 'CanceledError' });
  });
});
