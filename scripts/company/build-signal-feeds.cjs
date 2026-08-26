#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { isWithdrawnPublicVisual, readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const defaultSourcePath = path.join(root, 'public/updates/releases.json');
const defaultRssPath = path.join(root, 'public/updates/feed.xml');
const defaultJsonPath = path.join(root, 'public/updates/feed.json');
const siteOrigin = 'https://mythicalvoid.com';
const feedTitle = 'Mythical Void — The Signal Log';

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function ownedUrl(route) {
    return new URL(route, `${siteOrigin}/`).href;
}

function publicationTime(date) {
    return `${date}T12:00:00.000Z`;
}

function mediaType(pathname) {
    if (/\.png$/i.test(pathname)) return 'image/png';
    if (/\.webp$/i.test(pathname)) return 'image/webp';
    if (/\.jpe?g$/i.test(pathname)) return 'image/jpeg';
    return 'application/octet-stream';
}

function itemUrl(entry) {
    return `${siteOrigin}/updates/#${entry.id.toLowerCase()}`;
}

function contentText(entry, register = readVisualPublicationRegister()) {
    const lines = [
        entry.summary,
        '',
        ...entry.details.map(detail => `• ${detail}`),
        '',
        `See the live change: ${ownedUrl(entry.destination)}`
    ];
    if (entry.image && !isWithdrawnPublicVisual(entry.image, register)) {
        lines.push('', `Media note: ${entry.disclosure}`);
    } else {
        lines.push('', 'Visual note: the earlier media was withheld after human review.');
    }
    return lines.join('\n');
}

function buildRssFeed(source) {
    const register = readVisualPublicationRegister();
    const entries = (source.entries || []).filter(entry => entry.status === 'live');
    const latestDate = entries.map(entry => entry.publishedOn).sort().at(-1);
    const items = entries.map(entry => `    <item>
      <guid isPermaLink="true">${escapeXml(itemUrl(entry))}</guid>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(itemUrl(entry))}</link>
      <pubDate>${escapeXml(new Date(publicationTime(entry.publishedOn)).toUTCString())}</pubDate>
      <category>${escapeXml(entry.category)}</category>
      <description>${escapeXml(contentText(entry, register))}</description>${entry.image && !isWithdrawnPublicVisual(entry.image, register) ? `
      <media:content url="${escapeXml(ownedUrl(entry.image))}" type="${escapeXml(mediaType(entry.image))}" medium="image">
        <media:description>${escapeXml(entry.imageAlt)}</media:description>
      </media:content>` : ''}
    </item>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${siteOrigin}/updates/</link>
    <description>${escapeXml(source.page.description)}</description>
    <language>en-ie</language>
    <lastBuildDate>${escapeXml(new Date(publicationTime(latestDate)).toUTCString())}</lastBuildDate>
    <atom:link href="${siteOrigin}/updates/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${siteOrigin}/marketing/mythical-void-mark-192.png</url>
      <title>${escapeXml(feedTitle)}</title>
      <link>${siteOrigin}/updates/</link>
    </image>
${items}
  </channel>
</rss>
`;
}

function buildJsonFeed(source) {
    const register = readVisualPublicationRegister();
    const entries = (source.entries || []).filter(entry => entry.status === 'live');
    return `${JSON.stringify({
        version: 'https://jsonfeed.org/version/1.1',
        title: feedTitle,
        home_page_url: `${siteOrigin}/updates/`,
        feed_url: `${siteOrigin}/updates/feed.json`,
        description: source.page.description,
        icon: `${siteOrigin}/marketing/mythical-void-mark-192.png`,
        favicon: `${siteOrigin}/marketing/mythical-void-mark-32.png`,
        language: 'en-IE',
        authors: [{ name: 'Mythical Void', url: `${siteOrigin}/studio/` }],
        items: entries.map(entry => ({
            id: itemUrl(entry),
            url: itemUrl(entry),
            external_url: ownedUrl(entry.destination),
            title: entry.title,
            content_text: contentText(entry, register),
            summary: entry.summary,
            ...(!entry.image || isWithdrawnPublicVisual(entry.image, register) ? {} : { image: ownedUrl(entry.image) }),
            date_published: publicationTime(entry.publishedOn),
            tags: [entry.category]
        }))
    }, null, 2)}\n`;
}

if (require.main === module) {
    const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourcePath;
    const rssPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultRssPath;
    const jsonPath = process.argv[4] ? path.resolve(process.argv[4]) : defaultJsonPath;
    const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    fs.mkdirSync(path.dirname(rssPath), { recursive: true });
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(rssPath, buildRssFeed(source));
    fs.writeFileSync(jsonPath, buildJsonFeed(source));
    const count = (source.entries || []).filter(entry => entry.status === 'live').length;
    console.log(`Built RSS and JSON feeds from ${count} verified Signal Log entries.`);
}

module.exports = {
    buildJsonFeed,
    buildRssFeed,
    contentText,
    defaultJsonPath,
    defaultRssPath,
    defaultSourcePath,
    itemUrl,
    ownedUrl
};
