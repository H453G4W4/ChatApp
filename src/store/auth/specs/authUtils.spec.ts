import { handleApiError } from '../authUtils';
import { showToast } from '@/utils/toastUtils';

jest.mock('@/utils/toastUtils', () => ({ showToast: jest.fn() }));

const axiosError = (status: number, data: unknown) => ({ response: { status, data } });

describe('login failure messages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the server’s own reason for rejected credentials', () => {
    const result = handleApiError(
      axiosError(401, { errors: ['Invalid login credentials. Please try again.'] }),
    );

    expect(result).toEqual({
      success: false,
      errors: ['Invalid login credentials. Please try again.'],
    });
    expect(showToast).toHaveBeenCalledWith({
      message: 'Invalid login credentials. Please try again.',
    });
  });

  it('reads the singular error field some endpoints return instead', () => {
    expect(handleApiError(axiosError(401, { error: 'Account is suspended' })).errors).toEqual([
      'Account is suspended',
    ]);
  });

  it('reports a forbidden response rather than falling through to a generic message', () => {
    expect(handleApiError(axiosError(403, { errors: ['Not authorized'] })).errors).toEqual([
      'Not authorized',
    ]);
  });

  it.each([
    ['a wrong address or DNS failure', { message: 'Network Error' }],
    ['a timeout', { code: 'ECONNABORTED', message: 'timeout of 0ms exceeded' }],
    ['a TLS failure', { message: 'unable to verify the first certificate' }],
  ])('tells the agent the server was never reached on %s', (_label, error) => {
    const result = handleApiError(error);

    // Distinguishing "could not reach" from "wrong password" is the difference
    // between fixing the address and retyping a correct password.
    expect(result.errors[0]).toBe(
      'Could not reach the server. Check the address and your connection.',
    );
  });

  it('blames the server, not the credentials, on a 5xx', () => {
    expect(handleApiError(axiosError(502, '<html>Bad Gateway</html>')).errors[0]).toBe(
      'The server could not complete the request. Please try again later.',
    );
  });

  it('survives a malformed body without a usable error', () => {
    const result = handleApiError(axiosError(400, null), 'Username / Password Incorrect');

    expect(result.success).toBe(false);
    expect(result.errors[0]).toBe('Username / Password Incorrect');
  });

  it('never echoes submitted credentials into the message or the toast', () => {
    const result = handleApiError(
      axiosError(401, { errors: ['Invalid login credentials. Please try again.'] }),
    );

    const surfaced = JSON.stringify([result, jest.mocked(showToast).mock.calls]);
    expect(surfaced).not.toContain('hunter2');
    expect(surfaced).not.toContain('password');
  });
});
