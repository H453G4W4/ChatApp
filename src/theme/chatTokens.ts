/**
 * ChatApp Phase 2 design tokens.
 *
 * These are twrnc class strings rather than raw colour literals, so every new
 * surface keeps resolving through the existing Radix palette in
 * `tailwind.config.ts`. Components import from here instead of repeating class
 * lists, which is what makes a later dark-mode pass a change in one file.
 *
 * Note: this branch has no runtime colour-scheme switch yet - the dark Radix
 * ramps exist in the palette but nothing toggles them - so these resolve to the
 * light scheme today.
 */

export const chatTokens = {
  screen: {
    background: 'bg-white',
    /** Subtle separator; avoids card borders in favour of hairlines. */
    divider: 'border-b-[1px] border-b-blackA-A3',
  },

  list: {
    /** Compact WhatsApp-like row: avatar gutter + a single hairline under the text. */
    row: 'px-3 flex-row items-center gap-3',
    rowInner: 'flex-1 min-w-0 flex-row items-center gap-3 py-2.5',
    name: 'text-base font-inter-medium-24 leading-5 text-gray-950',
    nameUnread: 'font-inter-semibold-20',
    preview: 'text-md font-inter-420-20 leading-[20px] text-gray-800',
    previewUnread: 'text-gray-900',
    /** "You: " / private-note prefix ahead of the preview text. */
    previewPrefix: 'text-md font-inter-420-20 leading-[20px] text-gray-700',
    timestamp: 'text-xs font-inter-420-20 leading-4 text-gray-800',
    timestampUnread: 'text-blue-800 font-inter-medium-24',
    /** Right-hand column holding the time above the unread badge. */
    meta: 'items-end justify-center gap-1 pl-1',
  },

  badge: {
    unread: 'h-5 min-w-[20px] px-1.5 justify-center items-center rounded-full bg-blue-700',
    unreadText: 'text-xs font-inter-semibold-20 leading-[15px] text-center text-white',
  },

  fab: {
    container:
      'absolute right-4 h-14 w-14 rounded-2xl items-center justify-center bg-blue-800 shadow-lg',
    icon: 'text-white',
  },

  form: {
    label: 'text-xs font-inter-medium-24 leading-4 text-gray-800',
    /** Flat rows separated by hairlines rather than boxed inputs. */
    field: 'px-4 py-3 border-b-[1px] border-b-blackA-A3',
    input: 'text-base font-inter-420-20 leading-5 text-gray-950 p-0',
    inputMultiline: 'text-base font-inter-420-20 leading-[22px] text-gray-950 p-0 min-h-[120px]',
    placeholder: 'text-gray-700',
    error: 'text-xs font-inter-420-20 leading-4 text-ruby-800',
    hint: 'text-xs font-inter-420-20 leading-4 text-gray-700',
    /** Suggestion row under the recipient field. */
    suggestion: 'px-4 py-2.5 flex-row items-center gap-3',
  },

  action: {
    primary: 'h-11 px-5 rounded-full items-center justify-center bg-blue-800',
    primaryDisabled: 'bg-gray-400',
    primaryText: 'text-base font-inter-medium-24 leading-5 text-white',
  },
} as const;
