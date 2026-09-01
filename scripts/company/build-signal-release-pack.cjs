#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const defaultSourcePath = path.join(root, 'public/updates/releases.json');
const defaultOutputPath = path.join(root, 'docs/company/content/generated/signal-log-release-pack.json');

function ownedUrl(route) {
    return new URL(route, 'https://mythicalvoid.com/').href;
}

function sourceFingerprint(source) {
    return crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
}

function professionalBody(entry, destination) {
    return `${entry.title}\n\n${entry.summary}\n\n${entry.details.map(detail => `• ${detail}`).join('\n')}\n\nSee what changed: ${destination}\n\n${entry.disclosure}`;
}

function communityBody(entry, destination) {
    return `New from the Void: ${entry.title}\n\n${entry.summary}\n\n${destination}\n\n${entry.disclosure}`;
}

function pressBody(entry, destination) {
    return `Mythical Void has a new live update: ${entry.title}.\n\n${entry.summary}\n\n${entry.details.join(' ')}\n\nThe checked public destination is ${destination}\n\nMedia note: ${entry.disclosure}\n\nThis is source material for a personal, reviewed note—not a bulk message.`;
}

function buildReleasePack(source) {
    const liveEntries = (source.entries || []).filter(entry => entry.status === 'live');
    const latestDate = [...liveEntries].map(entry => entry.publishedOn).sort().at(-1);
    return {
        schemaVersion: 1,
        id: `SIGNAL-DRAFT-PACK-${latestDate}`,
        state: 'draft_only_missing_verified_social_channels_and_approval',
        generatedFrom: {
            sourcePath: 'public/updates/releases.json',
            publicSourceUrl: source.page.canonicalUrl,
            sourceFingerprint: sourceFingerprint(source),
            liveEntryCount: liveEntries.length,
            latestSourceDate: latestDate
        },
        purpose: 'Turn each checked Latest News note into consistent review drafts without posting, messaging, scheduling or inventing claims.',
        audienceBoundary: {
            intendedReaders: ['general players', 'parents and guardians', 'adult creators', 'press', 'industry and partners'],
            childTargetedAdvertising: false,
            directMinorContact: false,
            behaviouralTargeting: false
        },
        authority: {
            socialAccountsVerified: false,
            publishingAuthorized: false,
            schedulingAuthorized: false,
            messagingAuthorized: false,
            replyingAuthorized: false,
            paidPromotionAuthorized: false,
            externalActionPerformed: false
        },
        items: liveEntries.map(entry => {
            const destination = ownedUrl(entry.destination);
            const professional = professionalBody(entry, destination);
            const community = communityBody(entry, destination);
            const press = pressBody(entry, destination);
            return {
                id: `DRAFT-${entry.id}`,
                sourceEntryId: entry.id,
                sourcePublishedOn: entry.publishedOn,
                destination,
                trackingParameters: false,
                media: {
                    sourcePath: entry.image,
                    alt: entry.imageAlt,
                    class: entry.imageClass,
                    disclosure: entry.disclosure
                },
                drafts: {
                    professionalNetwork: {
                        channelRef: 'CH-004',
                        format: 'text_post_with_one_link',
                        body: professional,
                        characterCount: professional.length
                    },
                    videoCommunity: {
                        channelRef: 'CH-002',
                        format: 'text_community_post_with_one_link',
                        body: community,
                        characterCount: community.length
                    },
                    pressCreatorSourceNote: {
                        channelRef: 'manual_personal_review_only',
                        format: 'source_note_not_bulk_email',
                        subject: `Mythical Void update: ${entry.title}`,
                        body: press,
                        characterCount: press.length,
                        recipient: null
                    }
                },
                approval: {
                    state: 'blocked_missing_verified_channel_and_kevin_approval',
                    kevinApprovalRequired: true,
                    verifiedChannelRequired: true,
                    adultReplyCoverageRequiredBeforeComments: true,
                    copyMediaLinkOrAudienceChangeInvalidatesApproval: true,
                    approvedAt: null,
                    scheduledAt: null,
                    publishedAt: null
                }
            };
        })
    };
}

if (require.main === module) {
    const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourcePath;
    const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultOutputPath;
    const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const pack = buildReleasePack(source);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
    console.log(`Built ${outputPath} from ${pack.items.length} verified Latest News entries.`);
}

module.exports = { buildReleasePack, defaultOutputPath, defaultSourcePath, sourceFingerprint };
