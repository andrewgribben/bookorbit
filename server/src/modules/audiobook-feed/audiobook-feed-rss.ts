export interface PodcastFeedChannel {
  title: string;
  description: string;
  author: string;
  link: string;
  imageUrl: string | null;
  items: PodcastFeedItem[];
}

export interface PodcastFeedItem {
  title: string;
  description: string;
  guid: string;
  pubDate: Date;
  durationSeconds: number | null;
  enclosureUrl: string;
  enclosureType: string;
  enclosureLength: number;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function formatRfc822(date: Date): string {
  return date.toUTCString();
}

function formatItunesDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** Build a podcast-compatible RSS 2.0 document for one audiobook feed. */
export function buildAudiobookPodcastRss(channel: PodcastFeedChannel): string {
  const imageBlock = channel.imageUrl
    ? `
    <itunes:image href="${escapeXml(channel.imageUrl)}" />
    <image>
      <url>${escapeXml(channel.imageUrl)}</url>
      <title>${escapeXml(channel.title)}</title>
      <link>${escapeXml(channel.link)}</link>
    </image>`
    : '';

  const itemsXml = channel.items
    .map((item) => {
      const duration = formatItunesDuration(item.durationSeconds);
      const durationBlock = duration ? `\n      <itunes:duration>${escapeXml(duration)}</itunes:duration>` : '';
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <description>${escapeXml(item.description)}</description>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
      <pubDate>${formatRfc822(item.pubDate)}</pubDate>
      <enclosure url="${escapeXml(item.enclosureUrl)}" length="${item.enclosureLength}" type="${escapeXml(item.enclosureType)}" />${durationBlock}
      <itunes:author>${escapeXml(channel.author)}</itunes:author>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(channel.link)}" rel="self" type="application/rss+xml" />
    <itunes:author>${escapeXml(channel.author)}</itunes:author>
    <itunes:summary>${escapeXml(channel.description)}</itunes:summary>
    <itunes:explicit>false</itunes:explicit>${imageBlock}
${itemsXml}
  </channel>
</rss>
`;
}
