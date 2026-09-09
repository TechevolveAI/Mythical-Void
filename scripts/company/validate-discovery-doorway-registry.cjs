#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const registryFlag = process.argv.indexOf('--registry');
const registryPath = registryFlag === -1
    ? path.join(root, 'docs/company/growth/DISCOVERY_DOORWAY_REGISTRY_2026-09-08.json')
    : path.resolve(process.argv[registryFlag + 1] || '');
const copyPath = path.join(root, 'docs/company/growth/DISCOVERY_DOORWAY_REGISTRY_2026-09-08.md');
const packagePath = path.join(root, 'package.json');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const copy = fs.readFileSync(copyPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

requireValue(registry.schemaVersion === 1 && registry.id === 'DISCOVERY-DOORWAYS-2026-09-08', 'registry identity is missing');
requireValue(registry.checkedOn === '2026-09-08', 'registry check date is stale');
requireValue(registry.state === 'one_route_ready_wider_queue_mapped_no_external_action', 'registry overstates external action');
requireValue(registry.ownedSupport?.directPlayUrl === 'https://mythicalvoid.com/play/', 'clean direct Play link is missing');
requireValue(registry.ownedSupport?.pressRoomUrl === 'https://mythicalvoid.com/press/', 'Press Room support link is missing');
requireValue(registry.ownedSupport?.websiteBadgeUrl === 'https://mythicalvoid.com/press/embed/mythical-void-play-badge.svg', 'website badge support link is missing');
requireValue(/not gameplay/i.test(registry.ownedSupport?.badgeBoundary || '') && /no tracking code/i.test(registry.ownedSupport?.badgeBoundary || ''), 'badge truth boundary is missing');

const routes = registry.routes || [];
requireValue(routes.length === 13, 'all thirteen checked discovery routes must remain in the queue');
requireValue(new Set(routes.map(route => route.id)).size === routes.length, 'route ids must be unique');
requireValue(new Set(routes.map(route => route.order)).size === routes.length, 'route order values must be unique');
requireValue(routes.every((route, index) => route.order === index + 1), 'routes must remain in one explicit order');

const immediate = routes.filter(route => route.state === 'ready_waiting_for_kevin_action_time_approval');
requireValue(immediate.length === 1 && immediate[0]?.id === 'webgames', 'exactly one immediate route must be r/WebGames');
requireValue(routes[1]?.id === 'phaser-showcase' && /waiting_for_webgames_read_or_cancellation/.test(routes[1]?.state || ''), 'Phaser Showcase must wait behind the first read');
requireValue(routes.find(route => route.id === 'itch-io')?.preparedArtifact === 'docs/company/growth/ITCH_RELEASE_CANDIDATE.json', 'itch.io is detached from its prepared package');
const indieDb = routes.find(route => route.id === 'indiedb');
requireValue(indieDb?.canRouteDirectlyToOwnedWebsite === true, 'IndieDB website-link opportunity is missing');
requireValue(indieDb?.state === 'page_packet_ready_waiting_for_adult_account_terms_signed_in_form_check_and_final_preview', 'IndieDB page packet state is invalid');
requireValue(indieDb?.preparedArtifact === 'docs/company/growth/INDIEDB_PAGE_CANDIDATE_2026-09-08.json', 'IndieDB is detached from its prepared page packet');
requireValue(routes.find(route => route.id === 'html5-game-devs')?.needs?.approvedGameplayMedia === true, 'HTML5 showcase must wait for real approved media');
requireValue(routes.find(route => route.id === 'tigsource-devlog')?.needs?.ongoingParticipation === true, 'TIGSource must not become a one-off promotional drop');
const gameJolt = routes.find(route => route.id === 'game-jolt');
requireValue(gameJolt?.state === 'page_copy_ready_waiting_for_reddit_read_adult_account_terms_signed_in_form_media_and_build_review', 'Game Jolt must remain behind Reddit, account, terms, form, media and build review');
requireValue(gameJolt?.preparedArtifact === 'docs/company/growth/GAME_JOLT_PAGE_CANDIDATE_2026-09-09.json', 'Game Jolt is detached from its prepared page packet');
requireValue(gameJolt?.needs?.approvedCatalogueThumbnail === true && gameJolt?.needs?.isolatedBrowserBuild === true && gameJolt?.needs?.signedInFormReview === true, 'Game Jolt catalogue, build or form gate is missing');
requireValue(gameJolt?.needs?.approvedGameplayMedia === false, 'Game Jolt incorrectly requires gameplay media instead of an approved truthful catalogue thumbnail');
requireValue(/held_current_AI_policy_unfavourable/.test(routes.find(route => route.id === 'playmygame')?.state || ''), 'r/playmygame must remain held under the current AI and participation concerns');
requireValue(routes.find(route => route.id === 'indiegaming-reddit')?.state === 'excluded_current_no_AI_rule', 'r/IndieGaming no-AI conflict is missing');
requireValue(/held_until_current_AI/.test(routes.find(route => route.id === 'indiegames-reddit')?.state || ''), 'r/IndieGames must remain held for a fresh policy check');
requireValue(/excluded_for_now/.test(routes.find(route => route.id === 'newgrounds')?.state || ''), 'Newgrounds must remain excluded for now');
requireValue(routes.find(route => route.id === 'poki')?.state === 'option_preserved_not_submitted', 'Poki option state is invalid');
requireValue(/later_waiting/.test(routes.find(route => route.id === 'crazygames')?.state || ''), 'CrazyGames must remain a later review');

const screenedNotQueued = registry.screenedNotQueued || [];
requireValue(screenedNotQueued.length === 3, 'three additional routes must remain explicitly screened outside the queue');
requireValue(new Set(screenedNotQueued.map(route => route.id)).size === screenedNotQueued.length, 'screened route ids must be unique');
requireValue(screenedNotQueued.find(route => route.id === 'browsergames-reddit')?.state === 'not_available_community_private', 'private r/BrowserGames must not enter the public queue');
const slowDen = screenedNotQueued.find(route => route.id === 'slowden');
requireValue(slowDen?.submissionPublishesImmediately === true, 'SlowDen immediate-publication boundary is missing');
requireValue(slowDen?.currentOwnedGameAllowsThirdPartyFraming === false, 'SlowDen framing incompatibility is missing');
requireValue(/advertising|ad environment/i.test(`${slowDen?.whyNotQueued || ''} ${slowDen?.nextReviewTrigger || ''}`), 'SlowDen advertising review is missing');
const playMateGames = screenedNotQueued.find(route => route.id === 'playmategames');
requireValue(playMateGames?.submissionCollectsAdultEmail === true, 'PlayMateGames email-transmission boundary is missing');
requireValue(playMateGames?.currentOwnedGameAllowsThirdPartyFraming === false, 'PlayMateGames framing boundary is missing');
requireValue(/action-time approval/i.test(playMateGames?.nextReviewTrigger || ''), 'PlayMateGames form must remain behind action-time approval');

for (const route of routes) {
    requireValue(Boolean(route.id && route.name && route.kind && route.audienceIntent && route.state && route.nextNeed), `${route.id || 'route'} is incomplete`);
    requireValue(Array.isArray(route.sources) && route.sources.length > 0, `${route.id || 'route'} has no source evidence`);
    for (const source of route.sources || []) {
        requireValue(/^https:\/\//.test(source.url || ''), `${route.id} has a non-HTTPS source`);
        requireValue(source.observedOn === registry.checkedOn, `${route.id} source date is stale`);
        requireValue(Boolean(source.finding), `${route.id} source finding is missing`);
    }
    if (route.needs?.adultAccount || route.needs?.termsAcceptance) {
        requireValue(!/^(?:published|submitted|live)(?:_|$)/.test(route.state), `${route.id} claims publication before account or terms approval`);
    }
}

for (const route of screenedNotQueued) {
    requireValue(Boolean(route.id && route.name && route.state && route.whyNotQueued && route.nextReviewTrigger), `${route.id || 'screened route'} is incomplete`);
    requireValue(!/^ready|published|submitted/.test(route.state), `${route.id} was incorrectly admitted or activated`);
    requireValue(Array.isArray(route.sources) && route.sources.length > 0, `${route.id} has no source evidence`);
    for (const source of route.sources || []) {
        requireValue(/^https:\/\//.test(source.url || ''), `${route.id} has a non-HTTPS source`);
        requireValue(source.observedOn === registry.checkedOn, `${route.id} source date is stale`);
        requireValue(Boolean(source.finding), `${route.id} source finding is missing`);
    }
}

const rules = registry.executionRules || {};
for (const field of [
    'oneCommunityExperimentAtATime', 'humanRepliesOnly', 'currentRulesRecheckedAtActionTime',
    'accountAndTermsNeedKevin', 'noCopiedCrossPosts', 'noAutomatedReplies', 'noVoteRequests',
    'noFakeEngagement', 'noTrackingParameters', 'noDirectChildContact'
]) requireValue(rules[field] === true, `executionRules.${field} must remain true`);
requireValue(rules.generatedArtMayBeCalledGameplay === false, 'generated art must not be called gameplay');

for (const [field, value] of Object.entries(registry.authority || {})) {
    requireValue(value === false, `authority.${field} must remain false`);
}
requireValue(Object.keys(registry.authority || {}).length === 11, 'authority boundary is incomplete');
requireValue(/existing adult Reddit account/i.test(registry.nextRequiredAction || '') && /seven days of human reply coverage/i.test(registry.nextRequiredAction || ''), 'one founder action is not clear');

const allText = JSON.stringify(registry);
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(allText), 'registry contains a tracking parameter');
requireValue(!/fake (?:players|views|comments|activity)|fabricat(?:e|ed) (?:players|views|comments|activity)/i.test(allText), 'registry permits invented activity');
requireValue(!/automatically post|auto-post|bulk post/i.test(allText), 'registry permits automated posting');

for (const phrase of [
    'No account was opened, no terms were accepted', 'thirteen places recorded',
    'They are not a list to blast', 'r/WebGames', 'Phaser Showcase', 'itch.io',
    'IndieDB', 'HTML5 Game Devs', 'TIGSource DevLog', 'Game Jolt', 'r/playmygame',
    'r/IndieGaming', 'r/IndieGames', 'Newgrounds', 'Poki', 'CrazyGames',
    'One community experiment at a time', 'A post view is not a player',
    'Generated art is disclosed and never presented as gameplay',
    'Checked, but not admitted to the queue', 'r/BrowserGames', 'SlowDen',
    'PlayMateGames', 'blocks all third-party framing'
]) requireValue(copy.includes(phrase), `plain-language registry is missing: ${phrase}`);
for (const route of routes) {
    for (const source of route.sources || []) requireValue(copy.includes(source.url), `plain-language registry is missing source: ${source.url}`);
}
for (const route of screenedNotQueued) {
    for (const source of route.sources || []) requireValue(copy.includes(source.url), `plain-language registry is missing screened source: ${source.url}`);
}

requireValue(packageJson.scripts?.['validate:discovery-doorways'] === 'node scripts/company/validate-discovery-doorway-registry.cjs', 'discovery doorway validation command is missing');
requireValue(packageJson.scripts?.['test:discovery-doorways'] === 'node scripts/company/test-discovery-doorway-registry.cjs', 'discovery doorway test command is missing');
requireValue(packageJson.scripts?.build?.includes('npm run validate:discovery-doorways') && packageJson.scripts?.build?.includes('npm run test:discovery-doorways'), 'discovery doorway safeguards are not part of the production build');

if (errors.length) {
    console.error(`Discovery doorway registry validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    checkedRoutes: routes.length,
    screenedNotQueued: screenedNotQueued.length,
    immediateRoute: immediate[0].name,
    externalActionTaken: false,
    nextRequiredAction: registry.nextRequiredAction
}, null, 2));
