import { describe, expect, it } from 'vitest';

import { buildAudiobookPodcastRss } from './audiobook-feed-rss';

describe('buildAudiobookPodcastRss', () => {
  it('emits one item per audio file with enclosure and itunes tags', () => {
    const xml = buildAudiobookPodcastRss({
      title: 'Harbor Cycle',
      description: 'A coastal adventure',
      author: 'Ada Example',
      link: 'https://books.example/api/v1/feeds/11111111-1111-1111-1111-111111111111',
      imageUrl: 'https://books.example/api/v1/feeds/11111111-1111-1111-1111-111111111111/cover',
      items: [
        {
          title: 'Harbor Cycle — part1.mp3',
          description: 'A coastal adventure',
          guid: '22222222-2222-2222-2222-222222222222',
          pubDate: new Date('2026-01-02T00:00:00.000Z'),
          durationSeconds: 3661,
          enclosureUrl: 'https://books.example/api/v1/feeds/11111111-1111-1111-1111-111111111111/items/22222222-2222-2222-2222-222222222222',
          enclosureType: 'audio/mpeg',
          enclosureLength: 12345,
        },
        {
          title: 'Harbor Cycle — part2.mp3',
          description: 'A coastal adventure',
          guid: '33333333-3333-3333-3333-333333333333',
          pubDate: new Date('2026-01-03T00:00:00.000Z'),
          durationSeconds: 120,
          enclosureUrl: 'https://books.example/api/v1/feeds/11111111-1111-1111-1111-111111111111/items/33333333-3333-3333-3333-333333333333',
          enclosureType: 'audio/mpeg',
          enclosureLength: 6789,
        },
      ],
    });

    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<itunes:author>Ada Example</itunes:author>');
    expect(xml).toContain('href="https://books.example/api/v1/feeds/11111111-1111-1111-1111-111111111111/cover"');
    expect(xml).toContain('<item>');
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain('type="audio/mpeg"');
    expect(xml).toContain('<itunes:duration>1:01:01</itunes:duration>');
    expect(xml).toContain('<guid isPermaLink="false">22222222-2222-2222-2222-222222222222</guid>');
  });

  it('escapes XML special characters in titles', () => {
    const xml = buildAudiobookPodcastRss({
      title: 'Tom & Jerry <Live>',
      description: 'Quotes "ok"',
      author: "O'Brien",
      link: 'https://example/feed',
      imageUrl: null,
      items: [
        {
          title: 'Ep 1',
          description: 'Quotes "ok"',
          guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          pubDate: new Date('2026-01-01T00:00:00.000Z'),
          durationSeconds: null,
          enclosureUrl: 'https://example/a.mp3',
          enclosureType: 'audio/mpeg',
          enclosureLength: 1,
        },
      ],
    });
    expect(xml).toContain('Tom &amp; Jerry &lt;Live&gt;');
    expect(xml).toContain('Quotes &quot;ok&quot;');
    expect(xml).toContain('O&apos;Brien');
  });
});
