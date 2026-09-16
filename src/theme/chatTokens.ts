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
    /** Row tint while held, so taps feel acknowledged before navigation. */
    rowPressed: 'bg-blackA-A3',
    name: 'text-base font-inter-medium-24 leading-5 text-gray-950',
    nameUnread: 'font-inter-semibold-20 text-gray-950',
    preview: 'text-md font-inter-420-20 leading-[19px] text-gray-800',
    /** Unread previews darken rather than bolden, keeping the row calm. */
    previewUnread: 'text-gray-900',
    /** "You: " / private-note prefix ahead of the preview text. */
    previewPrefix: 'text-md font-inter-420-20 leading-[19px] text-gray-700',
    timestamp: 'text-xs font-inter-420-20 leading-4 text-gray-800',
    timestampUnread: 'text-blue-800 font-inter-medium-24',
    /** Right-hand column holding the time above the unread badge. */
    meta: 'items-end justify-center gap-1 pl-1',
    /** Divider starts past the avatar, the way chat lists inset their rules. */
    dividerInset: 'ml-[74px]',
  },

  badge: {
    unread: 'h-[18px] min-w-[18px] px-1.5 justify-center items-center rounded-full bg-blue-700',
    unreadText: 'text-xs font-inter-semibold-20 leading-[14px] text-center text-white',
  },

  /** Empty, loading and error placeholders for the queue. */
  state: {
    container: 'flex-1 items-center justify-center px-10',
    title: 'pt-5 text-base font-inter-medium-24 leading-5 text-gray-950 text-center',
    body: 'pt-1.5 text-md font-inter-420-20 leading-[20px] text-gray-800 text-center',
    retry: 'mt-5 px-5 h-10 rounded-full items-center justify-center bg-blue-800',
    retryText: 'text-md font-inter-medium-24 leading-5 text-white',
  },

  /** Message thread surfaces. Own messages carry the tint, as in a chat app. */
  chat: {
    /** Neutral ground behind the bubbles - our own tone, no imported wallpaper. */
    background: 'bg-gray-50',
    bubbleBase: 'relative px-2.5 py-1.5 rounded-2xl overflow-hidden',
    /** Outgoing/own. */
    surfaceOwn: 'bg-blue-100',
    surfaceOwnText: 'text-gray-800',
    /** Incoming/other. */
    surfaceOther: 'bg-white',
    surfaceOtherText: 'text-gray-700',
    /** Internal note - amber, never mistakable for a delivered reply. */
    surfacePrivate: 'bg-amber-100',
    surfacePrivateText: 'text-amber-900',
    surfaceError: 'bg-ruby-700',
    surfaceErrorText: 'text-white',
    surfaceUnsupported: 'bg-amber-100 border border-dashed border-amber-700',
    /** Hairline keeps a white incoming bubble legible on a light ground. */
    bubbleBorder: 'border-[1px] border-blackA-A3',
    /** Timestamp + delivery ticks pinned to the bubble's bottom-right. */
    footer: 'pt-[3px] flex-row items-center justify-end gap-1',
    footerText: 'text-xs font-inter-420-20 leading-[14px]',
    /** Centered date pill between day groups. */
    datePill: 'rounded-full py-1 px-2.5 bg-blackA-A3',
    datePillText: 'text-cxs font-inter-420-20 leading-[15px] text-blackA-A11',
  },

  /** Rounded composer bar pinned above the keyboard. */
  composer: {
    bar: 'flex-row items-end px-2 pb-1.5 gap-1.5',
    input:
      'flex-1 min-h-[40px] justify-center rounded-3xl bg-white border-[1px] border-blackA-A4 px-3.5 py-2',
    /** Reply/private-note banner sitting directly above the input. */
    banner: 'mx-2 mb-1.5 px-3 py-2 rounded-xl bg-blackA-A2 border-l-[3px] border-l-blue-700',
    bannerPrivate: 'border-l-amber-700 bg-amber-100',
    bannerLabel: 'text-xs font-inter-medium-24 leading-4 text-blue-800',
    bannerBody: 'text-md font-inter-420-20 leading-[19px] text-gray-800',
  },

  /** Passive connectivity hint under the queue header. */
  connection: {
    bar: 'flex-row items-center justify-center gap-2 py-1.5 bg-amber-100',
    text: 'text-xs font-inter-420-20 leading-4 text-amber-900',
  },

  /** Chat screen top bar. */
  header: {
    bar: 'flex-row items-center gap-2 px-2 py-1.5',
    title: 'text-base font-inter-medium-24 leading-5 text-gray-950',
    subtitle: 'text-xs font-inter-420-20 leading-4 text-gray-700',
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
