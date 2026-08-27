# Mythical Void search visibility check

**Checked:** 27 August 2026  
**Result:** the website is open to search engines and its 14 public pages have
been sent to IndexNow, but search visibility is not yet proven

## What we found

A small current search check did not show Mythical Void for:

- `Mythical Void game`;
- `site:mythicalvoid.com Mythical Void`;
- `free browser alien creature game`;
- `family friendly browser creature adventure game`.

This is a warning, not proof that every Mythical Void page is absent from every
search engine. Search results vary by place, device, language and time, and the
public discovery pages are very new.

## What is working

The live website returned a successful response for:

- `https://mythicalvoid.com/`;
- `https://mythicalvoid.com/playable-now/`;
- `https://mythicalvoid.com/robots.txt`;
- `https://mythicalvoid.com/sitemap.xml`.

The robots file allows crawling and points to the sitemap. The sitemap lists
the main game, story, creature, family, studio, NASA and STEM pages. The
homepage explicitly allows indexing and has a canonical address.

There is no obvious public technical block. The unknown is whether Google has
found, crawled and accepted each page. Only a verified Search Console property
can answer that reliably.

## What we did immediately

At 05:23 Irish time, the 14 canonical public URLs in the sitemap were sent to
the official IndexNow endpoint. It accepted the submission with HTTP status
200. This gives participating search engines a direct notice that the pages
exist. It does not guarantee crawling, indexing, placement or traffic, and it
does not replace Google Search Console.

## The right next move

Do not make lots of near-identical “free game” pages. The useful page already
exists at `https://mythicalvoid.com/playable-now/` and takes a visitor straight
to Play.

The next move is to connect the website to Google Search Console, submit the
existing sitemap once, and inspect the homepage and Playable Now page. The
exact handoff is in
[Search Console activation](SEARCH_CONSOLE_ACTIVATION.md).

## What has not happened

- No Search Console property has been connected or inspected.
- No sitemap or URL has been submitted from an authenticated Google account.
- No ranking is claimed.
- No paid search, link request or outside publication was started. The only
  outside action was the one-time IndexNow notification of already-public URLs.

## Sources

- [Google: verify site ownership](https://support.google.com/webmasters/answer/9008080?hl=en)
- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=en)
- [Google: ask for a recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
