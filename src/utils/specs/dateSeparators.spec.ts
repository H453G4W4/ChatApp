import { getGroupedMessages } from '../conversationUtils';
import { formatDate } from '../dateTimeUtils';
import type { Message } from '@/types';

const atSecondsAgo = (seconds: number) => Math.floor(Date.now() / 1000) - seconds;

const DAY = 24 * 60 * 60;

const message = (id: number, createdAt: number): Message =>
  ({
    id,
    createdAt,
    content: `Message ${id}`,
    messageType: 0,
    private: false,
    attachments: [],
    contentAttributes: null,
    sender: { id: 1, name: 'Ada', type: 'contact' },
  }) as unknown as Message;

describe('chat date separators', () => {
  it('labels today as Today', () => {
    expect(formatDate(atSecondsAgo(60))).toBe('Today');
  });

  it('labels yesterday as Yesterday', () => {
    expect(formatDate(atSecondsAgo(DAY))).toBe('Yesterday');
  });

  it('falls back to a written date for anything older', () => {
    const label = formatDate(atSecondsAgo(DAY * 5));

    expect(label).not.toBe('Today');
    expect(label).not.toBe('Yesterday');
    // e.g. "Sep 11, 2026" - a real date rather than a relative word.
    expect(label).toMatch(/^[A-Z][a-z]{2} \d{2}, \d{4}$/);
  });

  it('groups a day’s messages under one separator', () => {
    const groups = getGroupedMessages([
      message(1, atSecondsAgo(DAY * 5)),
      message(2, atSecondsAgo(DAY)),
      message(3, atSecondsAgo(DAY) + 60),
      message(4, atSecondsAgo(120)),
    ]);

    expect(groups.map(group => group.date)).toEqual([
      formatDate(atSecondsAgo(DAY * 5)),
      'Yesterday',
      'Today',
    ]);
    // Yesterday holds both of its messages under a single heading.
    expect(groups[1].data.map(item => item.id)).toEqual([2, 3]);
  });

  it('emits no separator when there are no messages', () => {
    expect(getGroupedMessages([])).toEqual([]);
  });
});
