import { AxiosError } from 'axios';
import { showToast } from '@/utils/toastUtils';
import I18n from '@/i18n';
import type { ApiErrorResponse } from './authTypes';

/**
 * Turns an auth failure into a message the agent can act on.
 *
 * ChatApp talks to whichever installation the agent entered, so the useful
 * distinction is *where* the failure came from: no response at all (wrong
 * address, no network, DNS or TLS failure) means the server was never reached,
 * and telling the agent that is more actionable than "wrong password". Nothing
 * here touches the submitted credentials, so no password reaches a log.
 */
export const handleApiError = (error: unknown, customErrorMsg?: string) => {
  const { response } = (error ?? {}) as AxiosError<ApiErrorResponse>;

  // No response: unreachable host, DNS/TLS failure, or a timeout. All of these
  // point the agent at the same fix - check the address and the connection.
  if (!response) {
    const message = I18n.t('ERRORS.SERVER_UNREACHABLE');
    showToast({ message });
    return { success: false, errors: [message] };
  }

  // A 5xx is the server's problem, not the credentials'.
  if (response.status >= 500) {
    const message = I18n.t('ERRORS.SERVER_ERROR');
    showToast({ message });
    return { success: false, errors: [message] };
  }

  // Handle specific error responses (401, 403, 400, etc.)
  if (response.status === 401 || response.status === 403 || response.status === 400) {
    const { errors } = response.data ?? {};
    if (errors?.[0]) {
      showToast({ message: errors[0] });
      return { success: false, errors };
    }

    // If no errors array, check for error field
    const responseData = (response.data ?? {}) as unknown as { error?: string };
    if (responseData?.error) {
      const errorMessage = responseData.error;
      showToast({ message: errorMessage });
      return { success: false, errors: [errorMessage] };
    }
  }

  const message = customErrorMsg || I18n.t('ERRORS.COMMON_ERROR');
  showToast({ message });
  return { success: false, errors: [message] };
};
