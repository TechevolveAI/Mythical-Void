# Connect Mythical Void to Google Search Console

This uses Kevin’s existing Google account. It does not require a new Mythical Void email address, another Google Workspace subscription or a paid Search Console plan.

Search Console will let the studio see whether Google can read the sitemap, which pages are indexed, what searches show Mythical Void and whether Google detects problems. It does not guarantee indexing or rankings.

## Part one — verify the website

1. Open [Google Search Console](https://search.google.com/search-console/) and sign in with the existing Google account Kevin wants to own the property.
2. Choose **Add property**.
3. Choose **Domain** and enter only `mythicalvoid.com`—no `https://`, `www` or path.
4. Google will provide a DNS TXT record.
5. Open the DNS settings for `mythicalvoid.com` at the current domain or DNS provider and add that TXT record exactly.
6. Return to Search Console and choose **Verify**. DNS changes can take time to appear.

Do not paste the Google account address, password, recovery details, session link or DNS verification token into the repository or this task. If DNS access is not available, stop and tell the studio who controls the domain; do not switch property type without recording why.

## Part two — submit the existing sitemap

1. Open the verified `mythicalvoid.com` property.
2. Open **Sitemaps**.
3. Submit `https://mythicalvoid.com/sitemap.xml`.
4. Record the status exactly as Google shows it: **Success**, **Has errors** or **Pending**.
5. If Google shows a last-read date or discovered-URL count, return those exact values. Do not estimate them.

The sitemap is already public and currently contains nine routes. Submitting it tells Google where it is and makes its fetch status visible in Search Console; it does not prove that every route has been indexed.

## What to send back

No screenshot is required. Send these plain facts:

- `Domain property verified: yes`
- `Verified at: <date and time>`
- `Sitemap submitted: yes`
- `Sitemap status: Success / Has errors / Pending`
- `Last read: <exact value or not shown>`
- `Discovered URLs: <exact number or not shown>`

The studio will record those facts without storing Kevin’s Google address or DNS token. Index coverage, rankings and search traffic remain “unknown” until their own reports provide evidence.

## Current official guidance

- [Google recommends a Domain property when possible](https://support.google.com/webmasters/answer/10351509?hl=en)
- [Submit and monitor a sitemap](https://support.google.com/webmasters/answer/7451001?hl=en)
- [Search Console owners and permissions](https://support.google.com/webmasters/answer/7687615?hl=en)
