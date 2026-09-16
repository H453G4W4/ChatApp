import { useEffect, useRef, useState } from 'react';

import { ContactService } from '@/store/contact/contactService';
import type { Contact } from '@/types';

export const CONTACT_SEARCH_DEBOUNCE_MS = 350;
export const CONTACT_SEARCH_MIN_LENGTH = 2;

type ContactSearchState = {
  results: Contact[];
  isSearching: boolean;
  /** True once a query ran and came back with nothing. */
  isEmpty: boolean;
};

/**
 * Debounced lookup for the recipient field.
 *
 * Every keystroke cancels the previous request, and a late response is dropped
 * unless it belongs to the query currently on screen. A failure resolves to no
 * suggestions rather than an error: the agent must always be able to type a
 * brand-new address that no contact owns yet.
 */
export const useContactSearch = (query: string): ContactSearchState => {
  const [state, setState] = useState<ContactSearchState>({
    results: [],
    isSearching: false,
    isEmpty: false,
  });
  const latestQuery = useRef(query);

  useEffect(() => {
    latestQuery.current = query;
    const trimmed = query.trim();

    if (trimmed.length < CONTACT_SEARCH_MIN_LENGTH) {
      setState({ results: [], isSearching: false, isEmpty: false });
      return;
    }

    const controller = new AbortController();
    setState(previous => ({ ...previous, isSearching: true }));

    const timer = setTimeout(async () => {
      try {
        const results = await ContactService.searchContacts({ q: trimmed }, controller.signal);
        if (latestQuery.current !== query) return;
        setState({ results, isSearching: false, isEmpty: results.length === 0 });
      } catch {
        if (latestQuery.current !== query) return;
        setState({ results: [], isSearching: false, isEmpty: false });
      }
    }, CONTACT_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return state;
};
