# Mythical Void’s weekly awareness-to-play review

This is the short weekly check for one question: **what helped someone choose Play?**

It uses only the public website measurement that a visitor has actively allowed. It does not measure the game, identify a child, follow a creature, or prove that a person played.

## One-time Google Analytics setup for Kevin

When you return to the Google Analytics task:

1. Confirm that the property receiving `G-FTM4W73EQC` belongs to Mythical Void and record the owner and backup owner.
2. Use the shortest practical data-retention setting for this early stage and record the choice.
3. In **Admin → Data display → Custom definitions**, create one event-level custom dimension:
   - Name: `Public page group`
   - Event parameter: `page_group`
4. In **Admin → Data display → Events**, mark only `public_play_selected` as a key event. It means a Play link was chosen; it is not proof of a completed game start.
5. In the web data stream, switch **Enhanced measurement** off. Mythical deliberately supplies the few actions it needs rather than accepting automatic scroll, search, video, outbound-link or download tracking.
6. Do not connect Google Ads, audiences or personalised advertising.
7. Test one public page with analytics off, then allowed, then turned off again from `/privacy/`.
8. Confirm that these are the only `public_…` action names created by Mythical:
   - `public_play_selected`
   - `public_share_selected`
   - `public_trailer_started`
   - `public_stem_resource_selected`
   - `public_press_asset_selected`
9. Confirm that their only Mythical-added detail is a broad `page_group`, that the referrer is blank, and that `/play/` sends nothing.

Google notes that a new custom dimension can take 24–48 hours to become available in reports. Until the checks above pass, analytics numbers are untrusted observations rather than studio results.

## The 15-minute weekly review

Copy the aggregate totals from the previous complete Monday-to-Sunday period. Never add names, account details, locations, search terms, individual journeys or screenshots containing visitor details.

| Signal | This week | Previous week | What it actually means |
|---|---:|---:|---|
| Public page views | — | — | Consented views of the public website, not people |
| Play selections | — | — | A public Play link was chosen |
| Share selections | — | — | The Share button was chosen; completion is unknown |
| Trailer starts | — | — | The official trailer began; watch completion is unknown |
| STEM resource selections | — | — | The free activity was chosen; download and use are unknown |
| Press asset selections | — | — | A press download was chosen; recipient and use are unknown |

Then answer only these five questions:

1. Which broad page group produced the most Play selections?
2. Did the trailer receive starts, and did the press page also produce Play selections?
3. Did the NASA/STEM page produce both resource interest and Play selections?
4. Did any press interest justify one carefully chosen adult creator or journalist outreach candidate?
5. What is the single smallest website or message change worth testing next week?

## Decision rules

- **Views but few Play selections:** make the playable promise and real-game proof clearer before adding more promotion.
- **Trailer starts but few press-page Play selections:** improve the trailer’s ending or the Play button beside it; do not assume the film failed.
- **STEM interest but little movement to Play:** strengthen the bridge between the real-space activity and the in-game discovery moment.
- **Press downloads:** prepare a small, relevant, adult-reviewed outreach wave; never bulk-send.
- **No useful signal:** check that the property is receiving the five events before changing the website.
- **Unexpected event, field, game-route activity or pre-consent Google request:** turn analytics off and investigate.

## Record one decision

End every review with exactly one of:

- **Keep:** no change; collect another complete week.
- **Improve:** name one page, one message and one expected effect.
- **Stop:** remove or pause something that creates confusion, risk or work without evidence.

Do not optimise for page views alone. The studio’s useful signal is a clearer path from truthful discovery to someone choosing to play.

## Primary guidance used

- Google: https://developers.google.com/tag-platform/security/guides/consent
- Google Analytics event parameters: https://support.google.com/analytics/answer/13675006
- Google Analytics custom dimensions: https://support.google.com/analytics/answer/14240153
- Google Analytics key events: https://support.google.com/analytics/answer/13128484
- Irish Data Protection Commission analytics-cookie guidance: https://www.dataprotection.ie/en/faqs/cookies/do-i-need-consent-analytics-cookies
- Irish Data Protection Commission withdrawal guidance: https://www.dataprotection.ie/en/faqs/cookies/my-website-or-app-uses-cookies-and-other-tracking-do-i-have-get-consent-users
