# Put Mythical Void on Google's radar

**State:** ready when Kevin wants to do the account step  
**Cost:** free  
**Time needed:** about ten minutes if verification works first time

## Why this matters

The website is ready to be crawled, but Mythical Void did not appear in the
small search check on 27 August. Google Search Console is the reliable place to
see whether Google has discovered each page, what stopped it and which searches
eventually bring visitors.

This does not require another Google Workspace subscription. Use the Google
account that already manages Mythical Void's Google Analytics property.

## Kevin's short task

1. Open [Google Search Console](https://search.google.com/search-console/).
2. Choose **Add property**.
3. Add the URL-prefix property `https://mythicalvoid.com/`.
4. Try the Google Analytics verification option using the same Google account
   that has edit access to the Mythical Void Analytics property.
5. If that succeeds, stop and tell Codex: **Search Console is verified.**
6. If it fails, choose the HTML file option, download Google's verification
   file and attach that exact file here. Codex can place it on the owned
   website without changing its contents.

Do not paste passwords, recovery codes, Analytics exports or private account
screens into the repository.

## What happens after verification

After Kevin explicitly approves the submission, submit:

`https://mythicalvoid.com/sitemap.xml`

Then inspect only these two addresses first:

- `https://mythicalvoid.com/`
- `https://mythicalvoid.com/playable-now/`

If Google says either page is not indexed, record Google's exact reason before
requesting indexing. Do not keep pressing Request indexing; Google says repeat
requests do not make crawling faster.

## What we will measure

Check once after seven days and again after fourteen days:

- how many canonical pages Google has indexed;
- whether the Mythical Void name produces impressions;
- which plain game searches produce impressions;
- clicks to the website;
- whether people who reach the website choose Play, using only consented
  aggregate website events.

Search impressions are not players, and Play selections are not proof that
somebody enjoyed the game. The First Five test and later returning-play evidence
answer those different questions.

## Boundaries

Connecting Search Console does not authorize paid adverts, automated link
requests, social posting, bulk content, repeated indexing requests or changes
to privacy settings. It does not guarantee a ranking.

