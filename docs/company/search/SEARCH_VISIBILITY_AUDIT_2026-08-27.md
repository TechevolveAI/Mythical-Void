# Mythical Void search visibility check

**Latest check:** 31 August 2026
**Result:** the website is open to search engines, but even exact-name search
visibility is not yet proven

## What we found

A fresh eight-search check did not show the official Mythical Void website for:

- `Mythical Void game`;
- `site:mythicalvoid.com Mythical Void`;
- `"Mythical Void" "alien creature"`;
- `free alien creature browser game Mythical Void`;
- `site:mythicalvoid.com`;
- `mythicalvoid.com`;
- `"Mythical Void" "Project Beacon"`;
- `site:mythicalvoid.com/creature-genetics`.

This is a warning, not proof that every Mythical Void page is absent from every
search engine. Search results vary by place, device, language and time, and the
public discovery pages are very new.

A second four-search sample on 31 August again found no official result for the
exact name, the site-specific name, a free alien-creature browser game search,
or a NASA STEM game search. This remains directional evidence, not a global
index count or ranking claim.

An unrelated or unverified profile using the same words did appear. It is not
being treated as an official Mythical Void channel. No result count or ranking
has been invented from this directional check.

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

The homepage identity markup is live. It links three things explicitly: the
preferred site name, the independent studio project and the browser game. It
also gives the domain as a backup site name and points to the preferred logo.
This follows Google's site-name guidance, but it cannot guarantee indexing or
ranking.

The public GitHub project was also missing both a description and a website
address, while its README opened with developer language rather than the game.
The public project now has an accurate description, a direct Play homepage and
seven relevant discovery topics. A reviewed README change prepares the plain
game promise, clean Play, family and press links, the father-and-son origin,
and the NASA and visual-honesty boundaries; that source still waits for its
normal protected merge.

## What IndexNow proves—and does not prove

At 05:23 Irish time, the 14 canonical public URLs in the sitemap were sent to
the official IndexNow endpoint. It accepted the submission with HTTP status
200. This gives participating search engines a direct notice that the pages
exist. It does not guarantee crawling, indexing, placement or traffic, and it
does not replace Google Search Console.

After the installable-game release, only the two pages that genuinely changed
were notified again: the homepage and Playable Now. IndexNow returned `200` at
05:44 UTC. The other sitemap pages were not repeatedly resubmitted.

After the Playable Now first screen was rewritten to state the game promise
before asking about mood, only that one changed page was notified. IndexNow
returned `200` at 06:07 UTC. No unchanged page was included.

After the Play and family guides made the current-release trust boundary clear,
only those two changed pages were notified: Playable Now and For Grown-ups.
IndexNow returned `200` at 06:47 UTC. No unchanged page was included. Acceptance
still does not prove crawling, indexing, ranking or traffic.

After the family guide gained a clean recommendation path for one grown-up to
pass to another, only that changed page was notified. IndexNow returned `200` at
07:05 UTC. The shared address contains no tracking code, and this acceptance
still does not prove crawling, indexing, ranking or traffic.

After the Playable Now promise was corrected to explain the first-time age
choice, only that changed canonical page was notified. IndexNow returned `200`
at 07:39 UTC. The game itself also gained one clear Start action and a simpler
first-contact instruction, but `/play/` was not submitted because it is not a
canonical sitemap page. Acceptance still does not prove crawling, indexing,
ranking or traffic.

## The right next move

Do not make lots of near-identical “free game” pages. The useful page already
exists at `https://mythicalvoid.com/playable-now/` and takes a visitor straight
to Play.

The next move is to connect the website to Google Search Console, submit the
existing sitemap once, and inspect the homepage and Playable Now page. The
exact handoff is in
[Search Console activation](SEARCH_CONSOLE_ACTIVATION.md).

## What has not happened

- A signed-in read-only check found no Mythical Void Search Console property;
  no property was added or changed.
- No sitemap or URL has been submitted from an authenticated Google account.
- No ranking is claimed.
- No paid search, link request or outside publication was started. The only
  outside action was the one-time IndexNow notification of already-public URLs.

## Sources

- [Google: verify site ownership](https://support.google.com/webmasters/answer/9008080?hl=en)
- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=en)
- [Google: ask for a recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
