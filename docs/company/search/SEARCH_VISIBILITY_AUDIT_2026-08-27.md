# Mythical Void search visibility check

**Latest check:** 8 September 2026
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

The first scheduled follow-up ran on 8 September, eight days after that
baseline. The same four branded and broad-intent searches again showed no
official Mythical Void result in this sample. The dated evidence is in
[`SEARCH_VISIBILITY_FOLLOW_UP_2026-09-08.md`](SEARCH_VISIBILITY_FOLLOW_UP_2026-09-08.md).
The second check must not run before 15 September.

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

The public GitHub project now has an accurate description, a direct Play
homepage, seven relevant discovery topics and a live Play-first README. The
official website now prepares a visible Public project link and names the same
repository in its structured studio information, so the two real properties
confirm each other.

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

On 8 September, the search workflow was extended to read both the main sitemap
and the separate Latest News sitemap. It now refuses a live notice unless every
changed URL is named. The homepage, Latest News index and new permanent
UPDATE-027 page were the only pages named; IndexNow returned `200` at 17:52
UTC. No unchanged sitemap page was included. Acceptance still does not prove
crawling, indexing, ranking, visits, sharing, play or growth.

Later that day, the Hatch Challenge first screen changed materially: Start now
comes before the invitation choices, the opening explanation is simpler and the
phone spacing is tighter. Only `https://mythicalvoid.com/hatch-challenge/` was
notified. IndexNow returned `200` at 22:48 UTC. No unchanged page was included,
and acceptance still does not prove crawling, indexing, ranking, visits,
sharing, play or growth.

On 9 September the homepage's phone welcome changed materially: the creature
universe artwork moved into the first screen, Play stayed clear, and the artwork
kept its honest “not gameplay” label. Only the homepage was named in the next
notice. IndexNow returned `200`; the exact response time was not retained. No
unchanged page was included, and acceptance still does not prove crawling,
indexing, ranking, visits, play or growth.

Later on 9 September, Latest News gained a permanent page explaining the new
welcome that appears while the direct Play experience prepares. Only the
changed Latest News index and UPDATE-029 page were named. The safeguarded
workflow refused to add `/play/` because that address is not in either canonical
sitemap. IndexNow returned `200`; the exact response time was not retained.
Acceptance still does not prove crawling, indexing, ranking, visits, play or
growth.

Also on 9 September, the homepage, Playable Now page and press room were brought
into agreement about the game: each now points to the clean Play address and
describes Mythical Void as a free single-player creature adventure for modern
web browsers. Only those three changed canonical pages were named in the next
notice. The safeguarded workflow again omitted `/play/` because it is not in
either canonical sitemap. IndexNow returned `200`; the exact response time was
not retained. Acceptance still does not prove crawling, indexing, ranking,
visits, play or growth.

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
