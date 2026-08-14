#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const defaultPaths = {
    evidence: path.join(root, 'docs/company/growth/live-launch-evidence-2026-08-14.json'),
    outreach: path.join(root, 'docs/company/content/channel-launch/FIRST_CREATOR_OUTREACH_WAVE.json'),
    activation: path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json'),
    itch: path.join(root, 'docs/company/distribution/itch-launch-pack-2026-08-14.json'),
    launch: path.join(root, 'docs/company/growth/launch-readiness.json'),
    trailer: path.join(root, 'docs/company/content/channel-launch/TRAILER_PAGE_RELEASE.json'),
    analytics: path.join(root, 'docs/company/automation/website-analytics-tag.json'),
    calendar: path.join(root, 'docs/company/content/channel-launch/FOUR_WEEK_LAUNCH_CALENDAR.json'),
    discovery: path.join(root, 'docs/company/search/organic-discovery-release-2026-08-14.json'),
    hatchReview: path.join(root, 'docs/company/content/HATCH_REVEAL_PROOF_REVIEW.json'),
    restorationReview: path.join(root, 'docs/company/content/RESTORATION_PROOF_REVIEW.json'),
    choiceReview: path.join(root, 'docs/company/content/PROJECT_BEACON_CHOICE_PROOF_REVIEW.json'),
    adultStemOutreach: path.join(root, 'docs/company/content/channel-launch/ADULT_STEM_OUTREACH_WAVE.json'),
    liveSearch: path.join(root, 'docs/company/search/LIVE_SEARCH_FINDABILITY_EVIDENCE_2026-08-14.json'),
    founderStory: path.join(root, 'docs/company/content/channel-launch/IRISH_FOUNDER_STORY_RELEASE.json'),
    scienceWeek: path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_WATER_CONCEPT_2026.json'),
    registry: path.join(root, 'docs/company/content/channel-launch/OFFICIAL_CHANNEL_REGISTRY.json'),
    searchConsole: path.join(root, 'docs/company/search/SEARCH_CONSOLE_CONNECTION.json'),
    familyPlay: path.join(root, 'docs/company/customer/family-play-observations.json'),
    playShare: path.join(root, 'docs/company/content/PRINTABLE_PLAY_SHARE_CARD.json'),
    signalLog: path.join(root, 'docs/company/content/SIGNAL_LOG_RELEASE_2026-08-14.json')
};

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildDashboard({ evidence, outreach, activation, itch, launch, trailer, analytics, calendar, discovery, hatchReview, restorationReview, choiceReview, adultStemOutreach, liveSearch, founderStory, scienceWeek, registry, searchConsole, familyPlay, playShare, signalLog }) {
    const checkedDate = evidence.checkedAt.slice(0, 10).split('-').reverse().join('/');
    const livePageCount = evidence.routes.filter(route => route.route !== '/play/' && route.verified).length;
    const firstWaveCount = outreach.messages.length;
    const laterOpportunityCount = outreach.nextWave.length;
    const youtube = activation.channels.find(channel => channel.channelRef === 'CH-002');
    const linkedin = activation.channels.find(channel => channel.channelRef === 'CH-004');
    const preparedYouTubeCount = youtube.firstUploads.length;
    const preparedLinkedInCount = linkedin.firstPosts.length;
    const calendarReleases = calendar.weeks.flatMap(week => week.releases);
    const publicCalendarCount = calendarReleases.filter(release => release.channel !== 'Internal review').length;
    const engagementTrack = launch.tracks.find(track => track.id === 'LT-007');
    const analyticsRouteCount = analytics.tag.includedRoutes.length;
    const analyticsActionCount = analytics.publicActions.eventNames.length;
    const recordedChannels = registry.channels.filter(channel => channel.accountState === 'created_owner_confirmed_not_published');
    const recordedPlatforms = new Set(recordedChannels.map(channel => channel.platform));
    const channelCreationSummary = recordedChannels.length === 0
        ? 'No account, Page, upload or post exists.'
        : recordedChannels.length === registry.channels.length
            ? 'YouTube and LinkedIn are owner-confirmed and recorded, but neither has an approved first release, open engagement or paid activity.'
            : `${recordedChannels[0].platform === 'youtube' ? 'YouTube' : 'LinkedIn'} is owner-confirmed and recorded; the other planned channel remains unopened, and no first release, open engagement or paid activity is approved.`;
    const verifiedChannelLine = recordedChannels.length
        ? `\n- ${recordedChannels.map(channel => `${channel.platform === 'youtube' ? 'YouTube' : 'LinkedIn'}: ${channel.officialUrl}`).join(' · ')} — owner-confirmed locally; public reachability and website linking are still unverified.`
        : '';
    const nextChannelDecision = !recordedPlatforms.has('youtube')
        ? '**Create the first official channel when convenient.** YouTube is first because the finished trailer gives it a real purpose. Review the prepared profile image and banner, use the short account handoff, switch on multi-factor authentication, and return the exact channel link before anything is uploaded.'
        : !recordedPlatforms.has('linkedin')
            ? '**Create the LinkedIn Company Page when convenient.** Use the prepared logo, cover and Page handoff, then return the exact Page link before any post or message is opened.'
            : '**Review the first social release.** Both official channel links are recorded. Kevin now reviews one exact video or post, its artwork, audience choice, timing and engagement setting before anything is published.';
    const remainingChannels = registry.channels.filter(channel => channel.accountState === 'not_created_owner_confirmed');
    const closedChannelLine = recordedChannels.length === 0
        ? 'No official Mythical Void YouTube or LinkedIn account is recorded as created.'
        : remainingChannels.length
            ? `${remainingChannels.map(channel => channel.platform === 'youtube' ? 'YouTube' : 'LinkedIn').join(' and ')} remains uncreated; every recorded channel remains closed to first publication, public engagement and paid activity.`
            : 'Both planned channels are recorded, but first publication, public engagement and paid activity remain closed.';
    const searchConsoleConnected = searchConsole.property.googleSearchConsoleConnected === true;
    const searchFindabilitySummary = !searchConsoleConnected
        ? `the homepage, public robots file and ${liveSearch.ownedCrawlFoundation.sitemapRouteCount}-route live sitemap are reachable, but the public samples found no owned Mythical Void result. A related TechEvolveAI result is visible, but its source contains an unsupported uniqueness promise; an exact correction is prepared. Search Console has not been connected, so indexing, rankings and search traffic remain unknown.`
        : searchConsole.sitemap.submittedByStudio !== true
            ? `the Domain property is owner-verified in Search Console, but sitemap submission is not yet recorded. Public search samples still do not prove owned discovery, indexing, rankings or search traffic.`
            : `the Domain property is owner-verified and the sitemap submission is recorded as ${searchConsole.sitemap.searchConsoleStatus}. This still does not prove index coverage, rankings or search traffic; those reports remain untrusted until separately recorded.`;
    const searchConsoleDecision = !searchConsoleConnected
        ? '**Verify the existing Google account in Search Console when convenient.** Add the `mythicalvoid.com` Domain property, submit the live sitemap and return the exact status. A new Mythical Void email address is not required.'
        : searchConsole.sitemap.submittedByStudio !== true
            ? '**Submit the live sitemap in Search Console.** Use `https://mythicalvoid.com/sitemap.xml` and return the exact status, last-read value and discovered-URL count without estimating.'
            : '**Bring back the first Page indexing report after Google has had time to process the sitemap.** Record the exact indexed and not-indexed totals and report date; do not treat submission alone as an indexing result.';

    return `# Mythical Void — founder launch command centre

**Last verified production check:** ${checkedDate}

**Public game:** https://mythicalvoid.com/

**Best single next move:** Kevin watches and approves the finished 64-second trailer. That unlocks the new trailer page, the strongest website arrival, and the first useful YouTube release without inventing more content.

## Verified live

- The public homepage and game entry worked during the last production check.
- ${livePageCount} public information pages were verified: the homepage, creature genetics, NASA and STEM, parents, studio, press room, Project Beacon story, and Signal Log.
- The Project Beacon story is live with six real gameplay realm images and no link to the unapproved trailer.
- The Signal Log is live with ${signalLog.liveEntries.length} checked release notes. Its merged draft builder has already turned them into ${signalLog.draftAutomation.reviewDraftCount} internal review drafts for later social, press, and creator use without publishing anything.
- The homepage now offers ${signalLog.homepageSharingRelease.shareActionCount} user-controlled ways to share the clean game link, including one beside Play on the first screen. The control does not collect a recipient or add tracking code.
- ${signalLog.socialPreviewRelease.routeSpecificPageCount} important public pages now carry checked, route-specific social preview images and accessible image text. The Project Beacon story uses its purpose-built wide artwork.
- The first Project Beacon social release is live in the press room with ${signalLog.firstSocialRelease.assets.length} finished, downloadable images. Posting still waits for an official channel and Kevin's approval.
- The NASA/STEM sharing release is live with ${signalLog.nasaStemSocialRelease.assets.length} downloadable images built around a real Apollo 11 game screen. The NASA source, non-endorsement and science-versus-fiction boundary are explicit; posting still waits for an official channel and Kevin's approval.
- The father-and-son studio story now has ${signalLog.fatherSonStorySocialRelease.assets.length} downloadable sharing images and a purpose-built link preview. The marketing-art and real-game boundaries are labelled, and no photograph, name, quote, contact detail or identifying detail of the child is used.
- The game created its playable canvas during that check.
- Real gameplay screenshots and a short real gameplay video are available for truthful promotion.${verifiedChannelLine}

This is a dated production snapshot. It does not claim continuous uptime, search visibility, traffic, or a complete playthrough.

## Prepared, but not yet live

- **The trailer:** the film and dedicated watch page are prepared. The page remains unpublished and hidden from search until Kevin approves the film, wording, and poster together.
- **Safer measurement:** the current Google tag is live, while the tighter ${analyticsRouteCount}-route, ${analyticsActionCount}-action consent upgrade is prepared on this feature branch. Its numbers are not trusted for company decisions yet.
- **Social launch:** ${preparedYouTubeCount} YouTube upload items and ${preparedLinkedInCount} LinkedIn posts are prepared, alongside a four-week plan containing ${publicCalendarCount} outward releases and one internal review. YouTube now has its profile image, 2560 × 1440 banner and account handoff; LinkedIn has its 400 × 400 logo, 4200 × 700 cover and Page handoff. ${channelCreationSummary}
- **Honest game proof:** the real hatch reached a visible creature and Confirm contact, but the captured frame was rejected for public promotion after ${hatchReview.qualityIssues.length} visible quality problems were recorded for Game Development.
- **Restoration proof:** the real Void Empress before-and-after pair supports the word restored, but it was rejected as the lead proof of visible world change after ${restorationReview.qualityIssues.length} quality limits were recorded.
- **Project Beacon choice:** ${choiceReview.captureIds.length} real responsive frames show the three preparation priorities without selecting or saving an outcome. They are spoiler-safe supporting proof ready for Kevin to review, with ${choiceReview.qualityIssues.length} visible limitations recorded.
- **Adult STEM discovery:** ${adultStemOutreach.messages.length} one-to-one introductions are prepared for the Blackrock Castle Observatory and ESERO Ireland education teams. Nothing has been sent, and both messages still require Kevin to approve the sender, recipient and final wording.
- **Search findability:** ${searchFindabilitySummary}
- **Irish founder story:** a ${founderStory.article.format.toLowerCase()} and tailored Irish Tech News contribution pitch are prepared. Nothing has been sent or promised, and any paid feature, rights request or child-participation request stops for a separate Kevin decision.
- **Science Week 2026:** the visually checked ${scienceWeek.artifact.pages}-page printable “${scienceWeek.title}” joins ${scienceWeek.realScience.length} sourced ocean-world facts to the real Stellar Reef game realm. A 12-check adult review system and one adult-only invitation are ready, but nothing has been sent and no review has been completed; no event, submission, partnership, logo use or public release exists.
- **Family play observations:** a one-minute adult-only note route is ready with ${(familyPlay.observations || []).length} observations recorded. It accepts an adult's own play or a parent's de-identified account of family play, and it rejects names, contact details, exact ages, direct quotes, media, public use and any claim that these notes are independent customer research.
- **In-person sharing:** a visually checked one-page A4 card is live in the public press room for adults to print or share. Its QR code resolves to the clean homepage with no tracking parameters; the artwork/gameplay distinction and NASA non-endorsement are printed on the card. Autonomous distribution, paid printing and direct child contact remain closed.
- **First outreach:** ${firstWaveCount} personal messages are written for Imirt, Alpha Beta Gamer, and Phaser. Nothing has been sent. ${laterOpportunityCount} later opportunities are ranked.
- **Browser-game distribution:** the itch.io package, cover, page wording, screenshots, and private-test checklist are prepared. Nothing has been uploaded or published.

## Kevin decisions that unlock the most value

1. **Approve or reject the trailer.** Watch all 64 seconds with sound, including the beginning, middle, and end. Check the pace for children, teenagers, and families; the gameplay statements; and the poster image.
2. ${nextChannelDecision}
3. **Name an adult safeguarding owner and backup before opening feedback, comments, direct messages, or community activity.** The current engagement track is ${engagementTrack.status.replace('_', ' ')} because those roles and response routes are not assigned.
4. ${searchConsoleDecision}

Email and itch.io remain useful later, but they no longer sit ahead of the trailer and the first official channel.

## Work the studio can continue without Kevin

- Improve and recapture the real creature reveal, then complete the hatch-to-first-response proof without pretending the current frame is launch quality.
- Strengthen and recapture the stable realm aftermath so the difference is visible without relying on the words, then complete the continuous restoration proof.
- Prepare the day-of-send route and link recheck for the Science Week invitation without contacting the proposed adult reviewer.
- Record adult-written, de-identified family play observations and turn each one into a small product check without treating it as customer evidence.
- Research suitable adult creators, press, browser-game platforms, educators, and STEM opportunities.
- Prepare one truthful release at a time and keep the four-week calendar aligned with what is actually playable.
- Add a Signal Log note only after a change is live, checked, and linked; reuse that note for later social and press drafts instead of rewriting claims from memory.
- Check every claim against the game and label generated artwork separately from gameplay.
- Prepare tests, review notes, release records, and a short founder summary whenever the live state changes.

## Deliberately kept closed

- ${closedChannelLine}
- No outreach message has been approved or sent.
- No itch.io page has been uploaded or published.
- Public feedback, comments, direct messages, and child-facing contact stay closed until adult safeguarding and response ownership exist.
- Analytics figures stay out of company reporting until the Google property, settings, receipt, retention, and access are checked.
- No paid promotion or autonomous public posting is approved.

## Non-negotiable rules

- Call the beings creatures.
- Never make an absolute uniqueness promise.
- Never present generated artwork as gameplay.
- Never imply that NASA endorses Mythical Void.
- Never privately contact children or expose the son's identifying information.
- Stop and ask Kevin before sending, publishing, spending, opening public conversation, or making a sensitive promise.
`;
}

if (require.main === module) {
    const values = Object.fromEntries(Object.entries(defaultPaths).map(([key, file]) => [key, readJson(file)]));
    process.stdout.write(buildDashboard(values));
}

module.exports = { buildDashboard, defaultPaths, readJson };
