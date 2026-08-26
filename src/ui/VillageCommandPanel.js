import {
    VILLAGE_BUILDING_ARTWORK,
    VILLAGE_RESOURCE_DEFINITIONS,
    getVillageResidentProposal,
    getVillageSupportSummary
} from '../systems/VillageSettlement.js';
import { CINEMATIC_MEDIA, shouldPlayCinematicMedia } from '../config/cinematic-media.js';

function createElement(tagName, className, text = null) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== null) element.textContent = text;
    return element;
}

function createBuildingArtwork(definitionId, {
    compact = false,
    status = 'ready'
} = {}) {
    const artwork = createElement(
        'span',
        `village-building-artwork${compact ? ' is-compact' : ''}`
    );
    artwork.dataset.building = definitionId;
    artwork.dataset.status = status;
    artwork.style.setProperty(
        '--village-building-image',
        `url('${(
            VILLAGE_BUILDING_ARTWORK[definitionId] ||
            VILLAGE_BUILDING_ARTWORK.habitat
        ).url}')`
    );
    artwork.setAttribute('aria-hidden', 'true');
    artwork.append(
        createElement('span', 'village-building-artwork-image'),
        createElement('span', 'village-building-artwork-current'),
        createElement('span', 'village-building-artwork-stars'),
        createElement('span', 'village-building-artwork-scan')
    );
    return artwork;
}

function createCreatureAvatar(creature, portraitRecord = null) {
    const avatar = createElement('span', 'village-creature-avatar');
    const name = creature?.name || 'Creature';
    avatar.dataset.communityType = creature?.communityType || 'companion';
    if (creature?.isPlayerCompanion && portraitRecord?.imageUrl) {
        avatar.classList.add('is-living-portrait');
        const image = createElement('img', 'village-creature-living-portrait');
        image.src = portraitRecord.imageUrl;
        image.alt = '';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        avatar.append(image);
        avatar.setAttribute('aria-hidden', 'true');
        return avatar;
    }
    if (
        creature?.communityType === 'rescued_resident' &&
        typeof creature?.artwork === 'string' &&
        creature.artwork.startsWith('/')
    ) {
        avatar.classList.add('is-authored-resident');
        avatar.style.setProperty(
            '--village-avatar-image',
            `url('${creature.artwork}')`
        );
        avatar.append(createElement('span', 'village-creature-portrait'));
        avatar.setAttribute('aria-hidden', 'true');
        return avatar;
    }
    const palette = ['#8fe3cf', '#f2c14e', '#f4f4f4', '#df5d5d'];
    const colorIndex = [...name].reduce((total, character) => (
        total + character.charCodeAt(0)
    ), 0) % palette.length;
    avatar.style.setProperty('--village-avatar-color', palette[colorIndex]);
    avatar.append(
        createElement('span', 'village-creature-antenna'),
        createElement('span', 'village-creature-face', name.slice(0, 1).toUpperCase())
    );
    avatar.setAttribute('aria-hidden', 'true');
    return avatar;
}

function formatCommunityMemberOption(creature) {
    if (creature?.communityType === 'rescued_resident') {
        return `${creature.name} - rescued resident${
            creature.role ? ` · ${creature.role}` : ''
        }`;
    }
    if (creature?.isPlayerCompanion) {
        return `${creature.name} - your companion`;
    }
    return `${creature?.name || 'Companion'} - companion`;
}

function createVillageViewTabs(snapshot, { activeView, onSelect } = {}) {
    const tabs = createElement('nav', 'village-view-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Village Heart views');
    const residentCount = (snapshot?.community?.companions?.length || 0) +
        (snapshot?.community?.residents?.length || 0);
    [
        ['plan', 'BUILD PLAN'],
        ['community', `COMMUNITY ${residentCount}`]
    ].forEach(([id, label]) => {
        const button = createElement(
            'button',
            `village-view-tab${activeView === id ? ' is-active' : ''}`,
            label
        );
        button.type = 'button';
        button.dataset.view = id;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(activeView === id));
        button.setAttribute('data-testid', `village-view-${id}`);
        button.addEventListener('click', () => onSelect?.(id));
        tabs.append(button);
    });
    return tabs;
}

function createCommunityShortcut(snapshot, { onSelect, portraitRecord = null } = {}) {
    const community = snapshot?.community || {};
    const members = [
        ...(community.companions || []),
        ...(community.residents || [])
    ].filter((member, index, roster) => (
        member?.id && roster.findIndex(entry => entry?.id === member.id) === index
    ));
    const guardians = (community.guardianAllies || []).filter(
        guardian => guardian.resolved
    );
    const heartLink = guardians.find(
        guardian => guardian.sanctuaryPresence === 'heart_projection'
    ) || null;
    const shortcut = createElement('button', 'village-community-shortcut');
    shortcut.type = 'button';
    shortcut.setAttribute('data-testid', 'village-community-shortcut');
    shortcut.setAttribute(
        'aria-label',
        `Open Sanctuary community and roles. ${members.length} creatures live here. ` +
            `${guardians.length} Guardians protect their regions.`
    );

    const portraits = createElement('span', 'village-community-shortcut-portraits');
    members.slice(0, 3).forEach(member => portraits.append(
        createCreatureAvatar(member, portraitRecord)
    ));
    if (members.length > 3) {
        portraits.append(createElement(
            'span',
            'village-community-shortcut-more',
            `+${members.length - 3}`
        ));
    }

    const copy = createElement('span', 'village-community-shortcut-copy');
    copy.append(
        createElement('span', 'village-community-shortcut-kicker', 'WHO LIVES HERE'),
        createElement(
            'strong',
            'village-community-shortcut-title',
            `${members.length} ${members.length === 1 ? 'CREATURE' : 'CREATURES'} CALL THIS HOME`
        ),
        createElement(
            'span',
            'village-community-shortcut-detail',
            heartLink
                ? `${heartLink.name} answers through the Heart. Other Guardians stay in their regions.`
                : guardians.length > 0
                    ? `${guardians.length} Guardians protect their regions; they do not live here.`
                    : 'Rescued creatures join this community. Guardians protect their own regions.'
        )
    );
    shortcut.append(
        portraits,
        copy,
        createElement('span', 'village-community-shortcut-action', 'VIEW COMMUNITY & ROLES')
    );
    shortcut.addEventListener('click', () => onSelect?.());
    return shortcut;
}

function getCommunityMemberStatus(member, snapshot) {
    const assignment = (snapshot?.buildings || []).find(building => (
        building.status === 'complete' && building.creature?.id === member.id
    ));
    if (assignment) return `HELPING AT ${assignment.definition?.shortLabel || 'A STRUCTURE'}`;
    if (member.isPlayerCompanion) return 'TRAVELS WITH YOU';
    if (snapshot?.home?.unlocked) return 'HOME · SHARED HABITAT';
    return 'HOME · SIGNAL GARDEN';
}

function createCommunityDirectory(snapshot, portraitRecord = null) {
    const community = snapshot?.community || {};
    const members = [...(community.companions || []), ...(community.residents || [])]
        .filter((member, index, roster) => (
            member?.id && roster.findIndex(entry => entry?.id === member.id) === index
        ));
    const guardians = (community.guardianAllies || []).filter(guardian => guardian.resolved);
    const directory = createElement('section', 'village-community-directory');
    directory.setAttribute('data-testid', 'village-community-directory');

    const intro = createElement('header', 'village-community-directory-header');
    const introCopy = createElement('div', 'village-community-directory-copy');
    introCopy.append(
        createElement('span', 'village-community-directory-kicker', 'WHO BELONGS WHERE'),
        createElement('h3', 'village-community-directory-title', 'YOUR SANCTUARY COMMUNITY'),
        createElement(
            'p',
            'village-community-directory-intro',
            'Your companion and creatures you rescue live and work here by choice. Restored Guardians protect their own regions; they do not move into the Sanctuary.'
        )
    );
    const counts = createElement('div', 'village-community-directory-counts');
    [
        [String(members.length), 'LIVING HERE'],
        [String(guardians.length), 'REGIONAL ALLIES']
    ].forEach(([value, label]) => {
        const count = createElement('span', 'village-community-directory-count');
        count.append(
            createElement('strong', '', value),
            createElement('span', '', label)
        );
        counts.append(count);
    });
    intro.append(introCopy, counts);
    directory.append(intro);

    const residentSection = createElement('section', 'village-community-group');
    residentSection.append(
        createElement('h4', 'village-community-group-title', 'SANCTUARY RESIDENTS'),
        createElement(
            'p',
            'village-community-group-note',
            'These are the lives building a home with you.'
        )
    );
    const residentGrid = createElement('div', 'village-community-grid');
    if (members.length === 0) {
        residentGrid.append(createElement(
            'p',
            'village-community-directory-empty',
            'Rescue a creature during an expedition to welcome the first resident.'
        ));
    } else {
        members.forEach(member => {
            const card = createElement('article', 'village-community-member');
            card.dataset.communityType = member.communityType || 'companion';
            const identity = createElement('div', 'village-community-member-identity');
            const identityCopy = createElement('span', 'village-community-member-copy');
            const isRescuedResident = member.communityType === 'rescued_resident';
            identityCopy.append(
                createElement(
                    'span',
                    'village-community-member-type',
                    member.isPlayerCompanion
                        ? 'YOUR COMPANION'
                        : isRescuedResident
                            ? 'RESCUED RESIDENT'
                            : 'COMPANION'
                ),
                createElement('strong', 'village-community-member-name', member.name || 'Unnamed creature'),
                createElement(
                    'span',
                    'village-community-member-role',
                    member.role || (
                        member.isPlayerCompanion
                            ? 'Expedition Partner'
                            : isRescuedResident
                                ? 'Sanctuary Resident'
                                : 'Companion'
                    )
                )
            );
            identity.append(createCreatureAvatar(member, portraitRecord), identityCopy);
            card.append(
                identity,
                createElement(
                    'p',
                    'village-community-member-contribution',
                    member.contributionLine || member.supportLabel ||
                        'Shares the journey and helps the Sanctuary understand this living world.'
                ),
                createElement(
                    'span',
                    'village-community-member-status',
                    getCommunityMemberStatus(member, snapshot)
                )
            );
            residentGrid.append(card);
        });
    }
    residentSection.append(residentGrid);
    directory.append(residentSection);

    const guardianSection = createElement('section', 'village-community-group is-guardians');
    guardianSection.append(
        createElement('h4', 'village-community-group-title', 'REGIONAL GUARDIANS'),
        createElement(
            'p',
            'village-community-group-note',
            'Restored allies hold the places you helped. Their support reaches the Sanctuary without turning them into residents.'
        )
    );
    const guardianGrid = createElement('div', 'village-guardian-grid');
    if (guardians.length === 0) {
        guardianGrid.append(createElement(
            'p',
            'village-community-directory-empty',
            'Guardian outcomes will be recorded here after each region is restored.'
        ));
    } else {
        guardians.forEach(guardian => {
            const card = createElement('article', 'village-guardian-card');
            card.style.setProperty('--guardian-accent', guardian.accent || '#8FE3CF');
            card.dataset.presence = guardian.sanctuaryPresence;
            const image = document.createElement('img');
            image.className = 'village-guardian-artwork';
            image.src = guardian.artwork;
            image.alt = `${guardian.name}, ${guardian.regionRole}`;
            image.loading = 'lazy';
            image.decoding = 'async';
            const copy = createElement('div', 'village-guardian-copy');
            copy.append(
                createElement(
                    'span',
                    'village-guardian-presence',
                    guardian.sanctuaryPresence === 'heart_projection'
                        ? 'HEART LINK · NOT A RESIDENT'
                        : 'PROTECTING THEIR REGION'
                ),
                createElement('strong', 'village-guardian-name', guardian.name),
                createElement('span', 'village-guardian-role', guardian.regionRole),
                createElement('p', 'village-guardian-outcome', guardian.outcomeLine)
            );
            card.append(image, copy);
            guardianGrid.append(card);
        });
    }
    guardianSection.append(guardianGrid);
    directory.append(guardianSection);
    return directory;
}

function createVillageVision() {
    const vision = createElement('section', 'village-command-vision');
    if (shouldPlayCinematicMedia()) {
        const video = document.createElement('video');
        video.className = 'village-command-vision-video';
        video.src = CINEMATIC_MEDIA.villageHeart.url;
        video.poster = CINEMATIC_MEDIA.villageHeart.poster;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.setAttribute('aria-hidden', 'true');
        vision.append(video);
    }
    const copy = createElement('div', 'village-vision-copy');
    copy.append(
        createElement('span', 'village-vision-kicker', 'YOUR SAFE BASE'),
        createElement('strong', 'village-vision-title', 'BUILD A HOME TOGETHER'),
        createElement(
            'span',
            'village-vision-purpose',
            'Use supplies to make shelter, recover safely, and prepare for the next journey.'
        )
    );
    const impact = createElement('div', 'village-vision-impact');
    [
        ['NOW', 'Buildings give useful help in care and expeditions.'],
        ['LATER', 'A stronger base can welcome more rescued creatures.']
    ].forEach(([label, description]) => {
        const line = createElement('span', 'village-impact-line');
        line.append(createElement('b', '', label), createElement('span', '', description));
        impact.append(line);
    });
    vision.append(
        createElement('span', 'village-vision-current'),
        createElement('span', 'village-vision-stars'),
        createElement('span', 'village-vision-scan'),
        copy,
        impact
    );
    return vision;
}

function createCommunityPulse(snapshot, portraitRecord = null) {
    const section = createElement('section', 'village-community-pulse');
    const home = snapshot?.home || {};
    const moment = snapshot?.communityMoments?.[0] || null;
    const identity = createElement('div', 'village-community-identities');

    if (moment) {
        moment.participants.forEach(participant => {
            const person = createElement('span', 'village-community-person');
            person.append(
                createCreatureAvatar(participant, portraitRecord),
                createElement('strong', '', participant.name),
                createElement('span', '', participant.roleLabel)
            );
            identity.append(person);
        });
    } else {
        const empty = createElement('span', 'village-community-empty-signal', '2');
        empty.setAttribute('aria-hidden', 'true');
        identity.append(empty);
    }

    const copy = createElement('div', 'village-community-copy');
    copy.append(
        createElement('span', 'village-community-kicker', 'COMMUNITY LIFE'),
        createElement(
            'strong',
            'village-community-title',
            moment ? moment.title : 'INVITE TWO COMMUNITY MEMBERS'
        ),
        createElement(
            'span',
            'village-community-line',
            moment
                ? moment.line
                : 'When rescued residents or companions help at different structures, their knowledge meets at the Heart.'
        ),
        createElement(
            'span',
            'village-community-value',
            moment ? moment.sharedValue : 'RELATIONSHIPS UNLOCK HERE'
        )
    );

    const homeStatus = createElement('div', 'village-community-home');
    homeStatus.append(
        createElement('span', 'village-community-home-icon'),
        createElement('strong', '', home.unlocked ? 'SHARED HOME' : 'HOME NOT BUILT'),
        createElement(
            'span',
            '',
            home.unlocked
                ? `${home.residents.length}/${home.capacity} residents · ${home.helpingCount} helping now`
                : 'Build the Habitat to give rescued friends a place they choose.'
        )
    );
    section.dataset.moment = moment?.id || 'locked';
    section.append(identity, copy, homeStatus);
    return section;
}

function createVillageSupportImpactSummary(snapshot) {
    const section = createElement('section', 'village-support-impact-summary');
    const heading = createElement('div', 'village-support-impact-heading');
    heading.append(
        createElement('span', 'village-support-impact-kicker', 'ACTIVE SUPPORT'),
        createElement('strong', 'village-support-impact-title', 'WHAT YOUR SANCTUARY CHANGES')
    );
    const effects = getVillageSupportSummary(snapshot?.effects || {});
    const list = createElement('div', 'village-support-impact-list');
    if (effects.length === 0) {
        list.append(createElement(
            'p',
            'village-support-impact-empty',
            'Build the first structure to create a visible benefit here and in the wider game.'
        ));
    } else {
        effects.forEach(effect => {
            const row = createElement('div', 'village-support-impact-row');
            row.dataset.support = effect.id;
            row.append(
                createElement('span', 'village-support-context', effect.contextLabel),
                createElement('strong', 'village-support-effect', effect.effect),
                createElement('span', 'village-support-source', effect.source),
                createElement('span', 'village-support-detail', effect.detail)
            );
            list.append(row);
        });
    }
    section.append(heading, list);
    section.setAttribute(
        'aria-label',
        effects.length > 0
            ? `Active Sanctuary support. ${effects.map(effect => effect.effect).join('. ')}`
            : 'No active Sanctuary support yet.'
    );
    return section;
}

function createResidentProposal(snapshot, definition, portraitRecord = null) {
    const proposal = getVillageResidentProposal(snapshot, {
        definitionId: definition?.id
    });
    if (!proposal) return null;

    const section = createElement('section', 'village-resident-proposal');
    const identity = createElement('div', 'village-resident-proposal-identity');
    identity.append(
        createCreatureAvatar({
            id: proposal.speakerId,
            name: proposal.speakerName,
            role: proposal.speakerRole,
            artwork: proposal.speakerArtwork,
            communityType: proposal.speakerCommunityType,
            isPlayerCompanion: proposal.speakerCommunityType === 'player_companion'
        }, portraitRecord),
        createElement(
            'span',
            'village-resident-proposal-speaker',
            `${proposal.speakerName.toUpperCase()} · ${
                proposal.speakerCommunityType === 'rescued_resident'
                    ? 'RESCUED RESIDENT'
                    : 'COMPANION'
            }`
        )
    );
    const copy = createElement('div', 'village-resident-proposal-copy');
    copy.append(
        createElement('strong', 'village-resident-proposal-title', proposal.title),
        createElement('q', 'village-resident-proposal-request', proposal.request),
        createElement('span', 'village-resident-proposal-promise', proposal.promise),
        createElement('span', 'village-resident-proposal-impact', `IN YOUR GAME · ${proposal.immediateImpact}`)
    );
    section.dataset.building = proposal.definitionId;
    section.dataset.speaker = proposal.speakerId;
    section.append(identity, copy);
    return section;
}

function createHeartDecision(snapshot, { lastResult = null, onChoose = null } = {}) {
    const decisionState = snapshot?.heartDecision;
    const active = decisionState?.active || null;
    if (!active && !lastResult && !decisionState?.completed?.length) return null;

    const section = createElement(
        'section',
        `village-heart-decision${lastResult ? ' is-resolved' : active ? ' is-active' : ' is-waiting'}`
    );
    const heading = createElement('div', 'village-decision-heading');
    const heartSignal = createElement('span', 'village-decision-heart');
    heartSignal.setAttribute('aria-hidden', 'true');
    const headingCopy = createElement('div', 'village-decision-heading-copy');
    const presentedDecision = lastResult?.decision || active;
    headingCopy.append(
        createElement(
            'span',
            'village-decision-kicker',
            lastResult ? 'THE HEART REMEMBERS' : active ? 'SHARED DECISION' : 'HEART VALUES'
        ),
        createElement(
            'strong',
            'village-decision-title',
            lastResult
                ? lastResult.option.label
                : active
                    ? active.title
                    : 'THE SETTLEMENT HAS CHOSEN'
        ),
        createElement(
            'span',
            'village-decision-situation',
            lastResult
                ? lastResult.option.consequence
                : active
                    ? active.situation
                    : 'Care and readiness now travel with every resident who leaves the Sanctuary.'
        )
    );
    heading.append(heartSignal, headingCopy);

    const values = createElement('div', 'village-decision-values');
    [
        {
            id: 'care',
            label: 'CARE',
            value: decisionState.values.care,
            effect: 'AT 2 · +2 feeding happiness'
        },
        {
            id: 'readiness',
            label: 'READY',
            value: decisionState.values.readiness,
            effect: 'AT 2 + WORKSHOP · +1 expedition energy'
        }
    ].forEach(value => {
        const item = createElement('span', `village-decision-value is-${value.id}`);
        const track = createElement('span', 'village-decision-value-track');
        for (let index = 0; index < 2; index += 1) {
            track.append(createElement(
                'i',
                index < value.value ? 'is-filled' : ''
            ));
        }
        item.append(
            createElement('strong', '', `${value.label} ${Math.min(value.value, 2)}/2`),
            track,
            createElement('span', '', value.effect)
        );
        values.append(item);
    });

    section.append(heading, values);
    if (active && !lastResult) {
        const participants = createElement(
            'p',
            'village-decision-participants',
            `${active.participantNames.join(' + ')} brought this to the Heart.`
        );
        const options = createElement('div', 'village-decision-options');
        active.options.forEach(option => {
            const button = createElement('button', 'village-decision-option');
            button.type = 'button';
            button.dataset.value = option.value;
            button.append(
                createElement(
                    'span',
                    'village-decision-option-value',
                    option.value === 'care' ? 'CARE +1' : 'READINESS +1'
                ),
                createElement('strong', '', option.label),
                createElement('span', '', option.consequence)
            );
            button.addEventListener('click', () => onChoose?.({
                decisionId: active.id,
                optionId: option.id
            }));
            options.append(button);
        });
        section.append(participants, options);
    } else if (!lastResult && decisionState.nextLocked) {
        section.append(createElement(
            'p',
            'village-decision-next',
            `NEXT · ${decisionState.nextLocked.title} · Keep building the shared base.`
        ));
    } else if (lastResult && presentedDecision) {
        const speakerName = lastResult.snapshot?.heartDecision?.completed
            ?.find(choice => choice.decisionId === lastResult.decision.id)
            ?.speakerName || lastResult.decision.participantNames?.[0] || 'A resident';
        section.append(
            createElement(
                'blockquote',
                'village-decision-resident-line',
                `"${lastResult.option.residentLine}"`
            ),
            createElement(
                'p',
                'village-decision-resident-name',
                `${speakerName.toUpperCase()} · THIS MEMORY REMAINS IN THE SANCTUARY`
            ),
            createElement(
                'p',
                'village-decision-next',
                'This choice is saved. Close the Village Heart to see its Current response.'
            )
        );
    }
    return section;
}

function formatCost(cost = {}) {
    return VILLAGE_RESOURCE_DEFINITIONS
        .filter(resource => Number(cost[resource.id]) > 0)
        .map(resource => `${cost[resource.id]} ${resource.label}`)
        .join('  /  ');
}

function formatPlacementReason(definition, definitionById) {
    const placement = definition.placement;
    if (placement.revealed === false) return placement.revealReason || 'NOT DISCOVERED YET';
    if (placement.alreadyBuilt) return 'BUILT';
    if (placement.noOpenPlot) return 'NO OPEN FOUNDATION';
    if (placement.missingPrerequisites.length > 0) {
        const labels = placement.missingPrerequisites
            .map(id => definitionById.get(id)?.shortLabel || id)
            .join(' + ');
        return `REQUIRES ${labels}`;
    }
    if (placement.missingResources.length > 0) return 'MORE SUPPLIES REQUIRED';
    return placement.available ? 'READY TO PLACE' : 'LOCKED';
}

function getConstructionStepCopy(selectedDefinition, firstOpenPlot, definitionById) {
    if (!selectedDefinition) {
        return '1. Choose a structure.';
    }
    if (!selectedDefinition.placement.available) {
        return `1. ${formatPlacementReason(selectedDefinition, definitionById)}.`;
    }
    if (!firstOpenPlot) {
        return '1. No open building sites remain.';
    }
    return `${selectedDefinition.label} will grow at ${firstOpenPlot.label}. Review the benefit and cost, then confirm below.`;
}

function formatResult(result) {
    if (result?.firstDelivery) {
        return `First safe harvest delivered: +${result.firstDelivery.amount} ` +
            `${result.firstDelivery.resource.toUpperCase()}. Wood and stone routes are now available.`;
    }
    const messages = {
        construction_started: 'Construction started. The foundation is now active.',
        creature_assigned: 'Helper invited. This structure now returns supplies while you explore.',
        heart_decision_resolved: 'Choice remembered. Its effect now travels through the Village Heart.',
        decision_unavailable: 'That Heart Decision is not available yet.',
        unknown_decision_option: 'That response is not part of this decision.',
        village_locked: 'The Village Heart has not been activated yet.',
        plot_occupied: 'That foundation is already occupied.',
        resources_missing: 'The settlement does not have enough supplies.',
        prerequisites_missing: 'Build the required producer structures first.',
        already_built: 'Phase one supports one of each structure.',
        building_not_assignable: 'Finish construction before inviting a contribution.',
        unknown_creature: 'That creature record is not available.'
    };
    return messages[result?.reason] || 'The Village Heart could not complete that request.';
}

function createResourceLesson(snapshot) {
    const lesson = createElement('section', 'village-resource-lesson');
    lesson.setAttribute('data-testid', 'village-resource-lesson');
    lesson.append(
        createElement('strong', 'village-resource-lesson-title', 'WHERE SUPPLIES COME FROM'),
        createElement(
            'p',
            'village-resource-lesson-intro',
            'Your first supplies survived the Wanderer-77 landing. Staffed structures make the supply loop renewable.'
        )
    );
    (snapshot.onboarding?.resourceSources || []).forEach(resource => {
        const row = createElement('span', 'village-resource-lesson-row');
        row.dataset.resource = resource.id;
        row.append(
            createElement('b', '', resource.label),
            createElement('span', '', `${resource.currentSource} → ${resource.renewableSource}`),
            createElement('small', '', resource.lesson)
        );
        lesson.append(row);
    });
    return lesson;
}

function createHeartIntroduction(snapshot, portraitRecord, onAcknowledge) {
    const companion = snapshot.roster?.find(creature => creature.isPlayerCompanion) ||
        snapshot.roster?.[0] || { name: 'Your companion', isPlayerCompanion: true };
    const section = createElement('section', 'village-heart-introduction');
    section.setAttribute('data-testid', 'village-heart-introduction');

    const identity = createElement('div', 'village-heart-introduction-identity');
    identity.append(
        createCreatureAvatar(companion, portraitRecord),
        createElement('span', 'village-heart-introduction-link', 'YOU ARRIVED TOGETHER')
    );

    const copy = createElement('div', 'village-heart-introduction-copy');
    copy.append(
        createElement('span', 'village-guided-kicker', 'FIRST SANCTUARY OBJECTIVE · 1/4'),
        createElement('h3', 'village-guided-title', 'MEET THE VILLAGE HEART'),
        createElement(
            'p',
            'village-guided-detail',
            'This living landmark keeps supplies for the whole Sanctuary. It will reveal only the next useful foundation.'
        )
    );

    const cache = createElement('div', 'village-heart-starter-cache');
    cache.append(createElement('strong', '', 'WANDERER-77 LANDING CACHE'));
    VILLAGE_RESOURCE_DEFINITIONS.forEach(resource => {
        const source = snapshot.onboarding?.resourceSources?.find(
            entry => entry.id === resource.id
        );
        const item = createElement('span', 'village-heart-cache-resource');
        const icon = createElement('i', 'village-resource-icon');
        icon.dataset.resource = resource.id;
        icon.setAttribute('aria-hidden', 'true');
        item.append(
            icon,
            createElement('b', '', `${snapshot.resources[resource.id]} ${resource.label}`),
            createElement('small', '', source?.currentSource || resource.starterSource)
        );
        cache.append(item);
    });
    copy.append(cache);

    const action = createElement(
        'button',
        'village-guided-primary',
        'REVEAL THE FIRST SAFE FOUNDATION'
    );
    action.type = 'button';
    action.setAttribute('data-testid', 'village-heart-begin');
    let lastTouchActivationAt = 0;
    const activate = event => {
        const now = Date.now();
        if (event?.type === 'touchend') {
            event.preventDefault();
            lastTouchActivationAt = now;
        } else if (now - lastTouchActivationAt < 500) {
            return;
        }
        onAcknowledge?.();
    };
    action.addEventListener('touchend', activate, { passive: false });
    action.addEventListener('click', activate);
    copy.append(action);
    section.append(identity, copy);
    return section;
}

export default class VillageCommandPanel {
    constructor(scene) {
        this.scene = scene;
        this.domElement = null;
        this.root = null;
        this.getSnapshot = null;
        this.onPlace = null;
        this.onAssign = null;
        this.onDecision = null;
        this.onAcknowledge = null;
        this.onTick = null;
        this.onClose = null;
        this.selectedDefinitionId = null;
        this.selectedPlotId = null;
        this.contextual = false;
        this.guided = false;
        this.guidedActionKey = null;
        this.statusMessage = '';
        this.lastDecisionResult = null;
        this.companionPortraitRecord = null;
        this.activeView = 'plan';
        this.keyboardHandler = null;
        this.refreshTimer = null;
        this.inputActivationTimer = null;
        this.physicsWasPaused = false;
        this.physicsSuspended = false;
        this.restoreMobileControls = false;
        this.domContainer = null;
        this.previousDomContainerZIndex = '';
    }

    show({
        plotId = null,
        guided = false,
        getSnapshot,
        onPlace,
        onAssign,
        onDecision,
        onAcknowledge,
        onTick,
        onClose
    } = {}) {
        if (this.domElement || typeof document === 'undefined') return false;
        const snapshot = getSnapshot?.();
        if (!snapshot) return false;

        this.getSnapshot = getSnapshot;
        this.onPlace = onPlace;
        this.onAssign = onAssign;
        this.onDecision = onDecision;
        this.onAcknowledge = onAcknowledge;
        this.onTick = onTick;
        this.onClose = onClose;
        this.statusMessage = '';
        this.lastDecisionResult = null;
        this.activeView = 'plan';
        const requestedPlot = snapshot.plots.find(plot => plot.id === plotId);
        this.selectedPlotId = requestedPlot?.id || null;
        this.contextual = Boolean(this.selectedPlotId);
        this.guided = Boolean(guided && !this.contextual);
        this.selectedDefinitionId = requestedPlot?.building?.definitionId ||
            snapshot.worldState?.nextAction?.definitionId ||
            snapshot.definitions.find(
                definition => definition.placement.available
            )?.id || snapshot.definitions.find(
                definition => !definition.placement.alreadyBuilt
            )?.id || snapshot.definitions[0]?.id || null;

        const root = createElement('div', 'village-command-modal');
        if (this.contextual) root.classList.add('is-contextual');
        if (this.guided) root.classList.add('is-guided');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Village Heart settlement planning');
        this.root = root;
        this.render();

        this.keyboardHandler = event => {
            if (event.key === 'Escape') this.destroy();
        };
        window.addEventListener('keydown', this.keyboardHandler);

        const physicsWorld = this.scene.physics?.world;
        this.physicsWasPaused = physicsWorld?.isPaused === true;
        this.physicsSuspended = Boolean(physicsWorld && !this.physicsWasPaused);
        if (this.physicsSuspended) this.scene.physics.pause();
        this.restoreMobileControls = this.scene.mobileControls?.suspend?.() === true;

        document.body.append(root);
        this.domElement = {
            node: root,
            destroy: () => root.remove()
        };
        requestAnimationFrame(() => root.classList.add('is-visible'));
        this.inputActivationTimer = window.setTimeout(() => {
            if (this.root === root) root.classList.add('accepts-input');
            this.inputActivationTimer = null;
        }, 220);
        this.refreshTimer = window.setInterval(() => {
            this.onTick?.();
            if (this.root) this.render();
        }, 1000);
        root.querySelector('.village-command-close')?.focus({ preventScroll: true });
        return true;
    }

    setCompanionPortrait(record) {
        if (!record?.imageUrl || !this.root) return false;
        this.companionPortraitRecord = record;
        this.render();
        return true;
    }

    renderGuided(snapshot, definitionById) {
        const onboarding = snapshot.onboarding || {};
        if (onboarding.stage === 'meet_heart') {
            const shell = createElement('section', 'village-heart-sheet is-introduction');
            const header = createElement('header', 'village-command-header village-guided-header');
            const heading = createElement('div', 'village-command-heading-copy');
            heading.append(
                createElement('p', 'village-command-eyebrow', 'AWAKENED LANDMARK'),
                createElement('h2', 'village-command-title', 'VILLAGE HEART')
            );
            const close = createElement('button', 'village-command-close compact-icon-button', '\u00d7');
            close.type = 'button';
            close.title = 'Return to the Sanctuary';
            close.setAttribute('aria-label', 'Return to the Sanctuary');
            close.addEventListener('click', () => this.destroy());
            header.append(heading, close);
            shell.append(
                header,
                createHeartIntroduction(
                    snapshot,
                    this.companionPortraitRecord,
                    () => {
                        const next = this.onAcknowledge?.();
                        if (next) {
                            this.snapshot = next;
                            this.statusMessage = 'The first living root is now visible.';
                            this.render();
                        }
                    }
                )
            );
            const footer = createElement('footer', 'village-guided-footer');
            footer.append(createElement(
                'p',
                'village-guided-lock-note',
                'One objective at a time. The wider building plan stays hidden for now.'
            ));
            const returnButton = createElement(
                'button',
                'village-guided-secondary is-return',
                'RETURN TO SANCTUARY'
            );
            returnButton.type = 'button';
            returnButton.addEventListener('click', () => this.destroy());
            footer.append(returnButton);
            shell.append(footer);
            this.root.append(shell);
            return;
        }
        const nextAction = snapshot.worldState?.nextAction || {
            type: 'review',
            label: 'SETTLEMENT ONLINE',
            detail: 'Review the village or meet its residents.'
        };
        const intent = this.lastDecisionResult ? 'decision' : nextAction.type;
        const guidedActionKey = [
            intent,
            nextAction.definitionId || '',
            nextAction.buildingId || '',
            nextAction.plotId || ''
        ].join(':');
        if (this.guidedActionKey !== guidedActionKey) {
            this.guidedActionKey = guidedActionKey;
            this.selectedDefinitionId = nextAction.definitionId ||
                snapshot.definitions.find(
                    definition => definition.placement.available
                )?.id || this.selectedDefinitionId;
        }
        const selectedDefinition = definitionById.get(this.selectedDefinitionId) ||
            definitionById.get(nextAction.definitionId) ||
            snapshot.definitions.find(definition => definition.placement.available) ||
            snapshot.definitions[0] || null;
        const selectedPlot = snapshot.plots.find(
            plot => plot.id === nextAction.plotId
        ) || snapshot.plots.find(plot => plot.open) || null;
        const targetBuilding = snapshot.buildings.find(building => (
            building.id === nextAction.buildingId ||
            building.plotId === nextAction.plotId
        )) || null;

        const shell = createElement('section', 'village-heart-sheet');
        shell.dataset.intent = intent;
        const header = createElement('header', 'village-command-header village-guided-header');
        const heading = createElement('div', 'village-command-heading-copy');
        heading.append(
            createElement(
                'p',
                'village-command-eyebrow',
                snapshot.worldState?.growthLabel || 'AWAKENED ROOT'
            ),
            createElement('h2', 'village-command-title', 'VILLAGE HEART')
        );
        const close = createElement('button', 'village-command-close', '\u00d7');
        close.classList.add('compact-icon-button');
        close.type = 'button';
        close.title = 'Return to the Sanctuary';
        close.setAttribute('aria-label', 'Return to the Sanctuary');
        close.addEventListener('click', () => this.destroy());
        header.append(heading, close);
        shell.append(header);

        if (intent !== 'decision') {
            const quickResources = createElement(
                'section',
                'village-heart-quick-resources'
            );
            quickResources.setAttribute('aria-label', 'Available village supplies');
            VILLAGE_RESOURCE_DEFINITIONS.forEach(resource => {
                const item = createElement('span', 'village-heart-resource');
                item.style.setProperty('--resource-color', resource.color);
                const source = onboarding.resourceSources?.find(
                    entry => entry.id === resource.id
                );
                item.title = source
                    ? `${resource.label}: ${source.currentSource}`
                    : resource.label;
                const icon = createElement('i', 'village-resource-icon');
                icon.dataset.resource = resource.id;
                icon.setAttribute('aria-hidden', 'true');
                item.append(
                    icon,
                    createElement('span', '', resource.label),
                    createElement('strong', '', String(snapshot.resources[resource.id])),
                    createElement(
                        'small',
                        'village-heart-resource-source',
                        source?.currentSource || 'NO SOURCE YET'
                    )
                );
                quickResources.append(item);
            });
            const roots = createElement('span', 'village-heart-resource is-roots');
            roots.append(
                createElement('i', 'village-heart-root-icon'),
                createElement('span', '', 'ROOTS'),
                createElement(
                    'strong',
                    '',
                    `${snapshot.worldState?.restored || 0}/${snapshot.plots.length}`
                )
            );
            quickResources.append(roots);
            shell.append(quickResources);
        }

        if (this.statusMessage) {
            const status = createElement(
                'p',
                'village-command-status has-message village-guided-status',
                this.statusMessage
            );
            status.setAttribute('aria-live', 'polite');
            shell.append(status);
        }

        if (onboarding.showFullPlan) {
            shell.append(createCommunityShortcut(snapshot, {
                portraitRecord: this.companionPortraitRecord,
                onSelect: () => {
                    this.guided = false;
                    this.activeView = 'community';
                    this.root?.classList.remove('is-guided');
                    this.statusMessage = '';
                    this.lastDecisionResult = null;
                    this.render();
                }
            }));
        }

        const stage = createElement('section', 'village-guided-stage');
        stage.dataset.intent = intent;
        const standardActionCopy = {
            build: {
                kicker: 'THE NEXT USEFUL CHANGE',
                title: selectedDefinition ? `BUILD ${selectedDefinition.label}` : 'CHOOSE A STRUCTURE',
                detail: selectedDefinition?.purpose || nextAction.detail
            },
            assign: {
                kicker: 'A STRUCTURE NEEDS A PERSON',
                title: targetBuilding
                    ? `INVITE HELP AT ${targetBuilding.definition.label}`
                    : 'INVITE A HELPER',
                detail: targetBuilding?.definition.workerRoutine?.emotionalPurpose || nextAction.detail
            },
            construction: {
                kicker: 'THE CURRENT IS WORKING',
                title: targetBuilding
                    ? `${targetBuilding.definition.label} IS GROWING`
                    : 'CONSTRUCTION IN PROGRESS',
                detail: targetBuilding?.definition.completionCopy || nextAction.detail
            },
            supplies: {
                kicker: 'WHAT THE SANCTUARY NEEDS',
                title: selectedDefinition
                    ? `PREPARE ${selectedDefinition.label}`
                    : nextAction.label,
                detail: nextAction.detail
            },
            review: {
                kicker: 'YOUR SHARED BASE',
                title: snapshot.phase.title,
                detail: snapshot.phase.objective
            }
        }[intent];
        const actionCopy = !onboarding.firstLoopComplete
            ? {
                kicker: `FIRST SANCTUARY LESSON · ${onboarding.step || 1}/${onboarding.totalSteps || 4}`,
                title: onboarding.title || standardActionCopy?.title,
                detail: onboarding.instruction || standardActionCopy?.detail
            }
            : standardActionCopy;

        if (intent === 'decision') {
            const decision = createHeartDecision(snapshot, {
                lastResult: this.lastDecisionResult,
                onChoose: request => {
                    const result = this.onDecision?.(request);
                    this.statusMessage = formatResult(result);
                    if (result?.changed) this.lastDecisionResult = result;
                    this.render();
                }
            });
            if (decision) stage.append(decision);
            if (this.lastDecisionResult) {
                const continueButton = createElement(
                    'button',
                    'village-guided-primary',
                    'CONTINUE WITH THE SANCTUARY'
                );
                continueButton.type = 'button';
                continueButton.addEventListener('click', () => {
                    this.lastDecisionResult = null;
                    this.statusMessage = '';
                    this.render();
                });
                stage.append(continueButton);
            }
        } else {
            const visualDefinition = targetBuilding?.definition || selectedDefinition;
            if (visualDefinition) {
                const visual = createElement('div', 'village-guided-visual');
                visual.append(createBuildingArtwork(visualDefinition.id, {
                    status: targetBuilding?.status || 'ready'
                }));
                stage.append(visual);
            }

            const copy = createElement('div', 'village-guided-copy');
            copy.append(
                createElement('span', 'village-guided-kicker', actionCopy?.kicker || 'RIGHT NOW'),
                createElement('h3', 'village-guided-title', actionCopy?.title || nextAction.label),
                createElement('p', 'village-guided-detail', actionCopy?.detail || nextAction.detail)
            );

            const residentProposal = createResidentProposal(
                snapshot,
                visualDefinition,
                this.companionPortraitRecord
            );
            if (residentProposal && ['build', 'supplies'].includes(intent)) {
                copy.append(residentProposal);
            }

            if (visualDefinition) {
                const impacts = createElement('div', 'village-guided-impacts');
                [
                    ['HELPS NOW', visualDefinition.immediateImpact],
                    ['OPENS LATER', visualDefinition.extensionImpact]
                ].forEach(([label, value]) => {
                    const impact = createElement('span', 'village-guided-impact');
                    impact.append(
                        createElement('b', '', label),
                        createElement('span', '', value)
                    );
                    impacts.append(impact);
                });
                copy.append(impacts);
            }

            const resourceLesson = !onboarding.firstLoopComplete || intent === 'supplies'
                ? createResourceLesson(snapshot)
                : null;

            if (intent === 'build' && selectedDefinition) {
                const choices = createElement('div', 'village-guided-choices');
                snapshot.definitions
                    .filter(definition => (
                        definition.placement.revealed &&
                        !definition.placement.alreadyBuilt
                    ))
                    .sort((left, right) => Number(right.placement.available) - Number(left.placement.available))
                    .slice(0, 3)
                    .forEach(definition => {
                        const button = createElement(
                            'button',
                            `village-guided-choice${definition.id === selectedDefinition.id ? ' is-selected' : ''}`
                        );
                        button.type = 'button';
                        button.setAttribute(
                            'aria-pressed',
                            String(definition.id === selectedDefinition.id)
                        );
                        button.append(
                            createBuildingArtwork(definition.id, { compact: true }),
                            createElement('strong', '', definition.shortLabel),
                            createElement(
                                'span',
                                '',
                                definition.placement.available
                                    ? formatCost(definition.cost)
                                    : formatPlacementReason(definition, definitionById)
                            )
                        );
                        button.addEventListener('click', () => {
                            this.selectedDefinitionId = definition.id;
                            this.statusMessage = definition.placement.available
                                ? `${definition.label} selected.`
                                : formatPlacementReason(definition, definitionById);
                            this.render();
                        });
                        choices.append(button);
                    });
                copy.append(choices);

                const canBuild = Boolean(
                    selectedPlot?.open && selectedDefinition.placement.available
                );
                const build = createElement(
                    'button',
                    'village-guided-primary',
                    canBuild
                        ? `BUILD AT ${selectedPlot.label} · ${formatCost(selectedDefinition.cost)}`
                        : formatPlacementReason(selectedDefinition, definitionById)
                );
                build.type = 'button';
                build.disabled = !canBuild;
                if (canBuild) {
                    build.addEventListener('click', () => {
                        const result = this.onPlace?.({
                            definitionId: selectedDefinition.id,
                            plotId: selectedPlot.id
                        });
                        this.statusMessage = formatResult(result);
                        this.render();
                    });
                }
                copy.append(build);
            } else if (intent === 'assign' && targetBuilding) {
                const assignment = createElement('div', 'village-guided-assignment');
                const select = document.createElement('select');
                select.className = 'village-creature-select';
                select.setAttribute(
                    'aria-label',
                    `Choose a helper for ${targetBuilding.definition.label}`
                );
                snapshot.roster.forEach(creature => {
                    const option = document.createElement('option');
                    option.value = creature.id;
                    option.textContent = formatCommunityMemberOption(creature);
                    option.selected = creature.id === targetBuilding.assignedCreatureId;
                    select.append(option);
                });
                const invite = createElement('button', 'village-guided-primary', 'INVITE TO HELP');
                invite.type = 'button';
                invite.disabled = snapshot.roster.length === 0;
                invite.addEventListener('click', () => {
                    const result = this.onAssign?.({
                        buildingId: targetBuilding.id,
                        creatureId: select.value
                    });
                    this.statusMessage = formatResult(result);
                    this.render();
                });
                assignment.append(select, invite);
                copy.append(assignment);
            } else if (intent === 'construction' && targetBuilding) {
                const elapsed = Math.max(0, Date.now() - targetBuilding.startedAt);
                const duration = Math.max(1, targetBuilding.completesAt - targetBuilding.startedAt);
                const progress = Math.min(100, Math.round((elapsed / duration) * 100));
                const progressBlock = createElement('div', 'village-guided-progress');
                const track = createElement('span', 'village-construction-track');
                const fill = createElement('span', 'village-construction-fill');
                fill.style.width = `${progress}%`;
                track.append(fill);
                progressBlock.append(
                    createElement('strong', '', `${progress}% SHAPED`),
                    track,
                    createElement('span', '', 'You can return to the world. The Heart will signal when it is ready.')
                );
                copy.append(progressBlock);
            } else if (intent === 'supplies' && selectedDefinition) {
                const needs = createElement('div', 'village-guided-needs');
                const missing = selectedDefinition.placement.missingResources || [];
                if (missing.length > 0) {
                    missing.forEach(resource => {
                        needs.append(createElement(
                            'span',
                            '',
                            `${resource.required - resource.current} MORE ${resource.resource.toUpperCase()}`
                        ));
                    });
                } else {
                    needs.append(createElement(
                        'span',
                        '',
                        'Finish the required structures first.'
                    ));
                }
                needs.append(createElement(
                    'p',
                    '',
                    'Invite helpers to completed supply structures, then continue exploring while they work.'
                ));
                copy.append(needs);
            } else if (intent === 'review') {
                const summary = createElement('div', 'village-guided-summary');
                snapshot.phase.milestones.forEach(milestone => {
                    const row = createElement(
                        'span',
                        `village-guided-milestone${milestone.complete ? ' is-complete' : ''}`
                    );
                    row.append(
                        createElement('i', ''),
                        createElement('span', '', milestone.label),
                        createElement('strong', '', `${milestone.current}/${milestone.target}`)
                    );
                    summary.append(row);
                });
                copy.append(summary);
            }
            if (resourceLesson) copy.append(resourceLesson);
            stage.append(copy);
        }
        shell.append(stage);

        const footer = createElement('footer', 'village-guided-footer');
        if (onboarding.showFullPlan) {
            const planner = createElement('button', 'village-guided-secondary', '\u2630  OPEN FULL PLAN');
            planner.type = 'button';
            planner.addEventListener('click', () => {
                this.guided = false;
                this.root?.classList.remove('is-guided');
                this.statusMessage = '';
                this.lastDecisionResult = null;
                this.render();
            });
            footer.append(planner);
        } else {
            footer.append(createElement(
                'p',
                'village-guided-lock-note',
                'The wider plan opens after your first helper returns a safe harvest.'
            ));
        }
        const returnButton = createElement(
            'button',
            'village-guided-secondary is-return',
            'RETURN TO SANCTUARY'
        );
        returnButton.type = 'button';
        returnButton.addEventListener('click', () => this.destroy());
        footer.append(returnButton);
        shell.append(footer);
        this.root.append(shell);
    }

    render() {
        if (!this.root || !this.getSnapshot) return;
        const scrollState = [
            '.village-command-shell',
            '.village-command-body',
            '.village-guided-stage'
        ].map(selector => ({
            selector,
            top: this.root.querySelector(selector)?.scrollTop || 0,
            left: this.root.querySelector(selector)?.scrollLeft || 0
        }));
        const restoreScrollState = () => {
            scrollState.forEach(({ selector, top, left }) => {
                const element = this.root?.querySelector(selector);
                if (!element) return;
                element.scrollTop = top;
                element.scrollLeft = left;
            });
        };
        const snapshot = this.getSnapshot();
        const definitionById = new Map(
            snapshot.definitions.map(definition => [definition.id, definition])
        );
        if (!definitionById.has(this.selectedDefinitionId)) {
            this.selectedDefinitionId = snapshot.definitions[0]?.id || null;
        }
        const selectedDefinition = definitionById.get(this.selectedDefinitionId);
        const selectedPlot = snapshot.plots.find(
            plot => plot.id === this.selectedPlotId
        ) || null;
        const contextualBuilding = selectedPlot?.building
            ? snapshot.buildings.find(
                building => building.id === selectedPlot.building.id
            ) || null
            : null;
        const settlementComplete = snapshot.phase.complete && !this.contextual;

        this.root.replaceChildren();
        if (this.guided) {
            this.renderGuided(snapshot, definitionById);
            restoreScrollState();
            return;
        }
        const shell = createElement('section', 'village-command-shell');

        const header = createElement('header', 'village-command-header');
        const headingGroup = createElement('div', 'village-command-heading');
        const headingCopy = createElement('div', 'village-command-heading-copy');
        headingCopy.append(
            createElement(
                'p',
                'village-command-eyebrow',
                this.contextual ? selectedPlot?.label || 'OPEN GROUND' : 'YOUR SANCTUARY'
            ),
            createElement(
                'h2',
                'village-command-title',
                contextualBuilding
                    ? contextualBuilding.definition.label
                    : this.contextual
                        ? 'WHAT SHOULD GROW HERE?'
                        : 'VILLAGE HEART'
            )
        );
        headingGroup.append(headingCopy);
        const close = createElement('button', 'village-command-close', '\u00d7');
        close.classList.add('compact-icon-button');
        close.type = 'button';
        close.title = 'Close Village Heart';
        close.setAttribute('aria-label', 'Close Village Heart');
        close.addEventListener('click', () => this.destroy());
        header.append(headingGroup, close);

        const resources = createElement('section', 'village-resource-ledger');
        resources.setAttribute('aria-label', 'Settlement resources');
        VILLAGE_RESOURCE_DEFINITIONS.forEach(resource => {
            const item = createElement('div', 'village-resource');
            item.dataset.resource = resource.id;
            item.style.setProperty('--resource-color', resource.color);
            const icon = createElement('span', 'village-resource-icon');
            icon.dataset.resource = resource.id;
            icon.setAttribute('aria-hidden', 'true');
            item.append(
                icon,
                createElement('span', 'village-resource-label', resource.label),
                createElement('strong', 'village-resource-value', String(snapshot.resources[resource.id])),
                createElement(
                    'span',
                    'village-resource-rate',
                    snapshot.productionRates?.[resource.id] > 0
                        ? `+${snapshot.productionRates[resource.id]}/MIN`
                        : 'NO HELP YET'
                )
            );
            resources.append(item);
        });
        const capacity = createElement('div', 'village-resource village-resource-capacity');
        const capacityIcon = createElement(
            'span',
            'village-resource-icon village-capacity-icon'
        );
        capacityIcon.setAttribute('aria-hidden', 'true');
        capacity.append(
            capacityIcon,
            createElement('span', 'village-resource-label', 'HOME CAPACITY'),
            createElement('strong', 'village-resource-value', String(snapshot.capacity))
        );
        resources.append(capacity);

        const status = createElement(
            'p',
            `village-command-status${this.statusMessage ? ' has-message' : ''}`,
            this.statusMessage || (
                snapshot.unlock.unlocked
                    ? this.contextual
                        ? contextualBuilding
                            ? `${contextualBuilding.definition.immediateImpact} ${contextualBuilding.definition.extensionImpact}`
                            : 'Choose a structure. You will see its immediate benefit before spending supplies.'
                        : settlementComplete
                            ? 'Phase one is online. Review relationships, invite helpers, or prepare for the next expedition.'
                            : 'Choose what to restore next, or invite a companion to help at a completed building.'
                    : snapshot.unlock.reason
            )
        );
        status.setAttribute('aria-live', 'polite');

        const phase = createElement('section', 'village-phase-progress');
        const phaseCopy = createElement('div', 'village-phase-copy');
        phaseCopy.append(
            createElement('span', 'village-phase-kicker', 'SETTLEMENT GOAL'),
            createElement('strong', 'village-phase-title', snapshot.phase.title),
            createElement('span', 'village-phase-objective', snapshot.phase.objective)
        );
        const milestoneTrack = createElement('div', 'village-milestone-track');
        snapshot.phase.milestones.forEach(milestone => {
            const item = createElement(
                'span',
                `village-milestone${milestone.complete ? ' is-complete' : ''}`
            );
            item.append(
                createElement('span', 'village-milestone-signal'),
                createElement('span', 'village-milestone-label', milestone.label),
                createElement(
                    'strong',
                    'village-milestone-value',
                    `${milestone.current}/${milestone.target}`
                )
            );
            milestoneTrack.append(item);
        });
        phase.append(phaseCopy, milestoneTrack);

        const viewTabs = !this.contextual
            ? createVillageViewTabs(snapshot, {
                activeView: this.activeView,
                onSelect: view => {
                    this.activeView = view;
                    this.statusMessage = '';
                    this.render();
                }
            })
            : null;
        if (viewTabs && this.activeView === 'community') {
            shell.append(
                header,
                resources,
                status,
                viewTabs,
                createCommunityDirectory(snapshot, this.companionPortraitRecord)
            );
            this.root.append(shell);
            restoreScrollState();
            return;
        }

        const body = createElement('div', 'village-command-body');
        const catalog = createElement('section', 'village-building-catalog');
        catalog.append(createElement(
            'h3',
            'village-section-title',
            contextualBuilding
                ? 'STRUCTURE'
                : this.contextual
                    ? 'CHOOSE A BUILDING'
                    : 'STRUCTURES'
        ));
        const visibleDefinitions = snapshot.definitions
            .filter(definition => (
                definition.placement.revealed || definition.placement.alreadyBuilt
            ))
            .sort((left, right) => {
            if (left.placement.available !== right.placement.available) {
                return left.placement.available ? -1 : 1;
            }
            if (left.placement.alreadyBuilt !== right.placement.alreadyBuilt) {
                return left.placement.alreadyBuilt ? 1 : -1;
            }
            return 0;
        });
        const displayedDefinitions = contextualBuilding
            ? visibleDefinitions.filter(definition => definition.id === contextualBuilding.definitionId)
            : this.contextual
                ? visibleDefinitions.filter(definition => !definition.placement.alreadyBuilt).slice(0, 3)
            : visibleDefinitions;
        const buildingOptions = createElement('div', 'village-building-options');
        displayedDefinitions.forEach(definition => {
            const selected = definition.id === this.selectedDefinitionId;
            const card = createElement(
                'button',
                `village-building-card${selected ? ' is-selected' : ''}`
            );
            card.type = 'button';
            card.setAttribute('aria-pressed', String(selected));
            card.addEventListener('click', () => {
                this.selectedDefinitionId = definition.id;
                this.statusMessage = definition.placement.available
                    ? `${definition.label} selected. ${definition.immediateImpact}`
                    : formatPlacementReason(definition, definitionById);
                this.render();
            });
            const top = createElement('span', 'village-building-card-top');
            top.append(createElement('strong', 'village-building-name', definition.label));
            const production = definition.production
                ? `+${definition.production.amount} ${definition.production.resource.toUpperCase()} / MIN BASE`
                : `+${definition.capacityBonus || 0} HOME CAPACITY`;
            const artwork = createBuildingArtwork(definition.id, {
                status: definition.placement.alreadyBuilt ? 'complete' : 'ready'
            });
            artwork.append(createElement(
                'span',
                `village-building-artwork-state${definition.placement.available ? ' is-ready' : ''}`,
                formatPlacementReason(definition, definitionById)
            ));
            const cardCopy = createElement('span', 'village-building-copy');
            cardCopy.append(
                top,
                createElement('span', 'village-building-description', definition.purpose),
                createElement(
                    'span',
                    'village-building-impact',
                    `HELPS NOW · ${definition.immediateImpact}`
                ),
                createElement(
                    'span',
                    'village-building-extension',
                    `UNLOCKS · ${definition.extensionImpact}`
                ),
                createElement('span', 'village-building-output', production),
                createElement('span', 'village-building-cost', formatCost(definition.cost))
            );
            card.append(artwork, cardCopy);
            buildingOptions.append(card);
        });
        catalog.append(buildingOptions);

        const plan = createElement('section', 'village-site-plan');
        const planHeader = createElement('div', 'village-site-plan-header');
        planHeader.append(
            createElement(
                'h3',
                'village-section-title',
                contextualBuilding
                    ? contextualBuilding.definition.production
                        ? 'COMMUNITY HELP'
                        : 'ACTIVE BENEFIT'
                    : this.contextual
                        ? 'YOUR CHOICE'
                        : settlementComplete
                            ? 'SETTLEMENT READY'
                            : 'BUILD NEXT'
            ),
            createElement(
                'p',
                'village-site-selection',
                contextualBuilding
                    ? `${contextualBuilding.definition.shortLabel} · ${contextualBuilding.status.toUpperCase()}`
                    : this.contextual
                    ? selectedPlot?.label || 'OPEN GROUND'
                    : settlementComplete
                        ? 'PHASE ONE COMPLETE'
                    : selectedDefinition
                        ? `PLACING · ${selectedDefinition.shortLabel}`
                        : 'SELECT A STRUCTURE'
            )
        );
        const firstOpenPlot = selectedPlot?.open
            ? selectedPlot
            : contextualBuilding
                ? null
                : snapshot.plots.find(plot => plot.open) || null;
        const nextStep = createElement(
            'p',
            'village-next-step',
            contextualBuilding
                ? contextualBuilding.definition.immediateImpact
                : settlementComplete
                    ? 'All five foundations are active. Meet the residents or review a structure\'s contribution.'
                : getConstructionStepCopy(
                    selectedDefinition,
                    firstOpenPlot,
                    definitionById
                )
        );
        nextStep.setAttribute('aria-live', 'polite');
        plan.append(planHeader, nextStep);
        if (!contextualBuilding && !settlementComplete && selectedDefinition) {
            const residentProposal = createResidentProposal(
                snapshot,
                selectedDefinition,
                this.companionPortraitRecord
            );
            if (residentProposal) plan.append(residentProposal);
        }

        const constructAction = createElement(
            'button',
            'village-construct-action',
            contextualBuilding
                ? `ACTIVE · ${contextualBuilding.definition.worldEffectLabel}`
                : settlementComplete
                    ? 'PHASE ONE COMPLETE · EXPEDITIONS SUPPORTED'
                : selectedDefinition?.placement.available && firstOpenPlot
                ? `BUILD ${selectedDefinition.shortLabel} HERE · ${formatCost(selectedDefinition.cost)}`
                : selectedDefinition
                    ? formatPlacementReason(selectedDefinition, definitionById)
                    : 'SELECT A STRUCTURE'
        );
        constructAction.type = 'button';
        const canConstruct = Boolean(
            !contextualBuilding && selectedDefinition?.placement.available && firstOpenPlot
        );
        constructAction.disabled = !canConstruct;
        if (canConstruct) {
            constructAction.addEventListener('click', () => {
                const result = this.onPlace?.({
                    definitionId: selectedDefinition.id,
                    plotId: firstOpenPlot.id
                });
                this.statusMessage = formatResult(result);
                if (result?.changed) {
                    this.contextual = false;
                    this.selectedPlotId = null;
                    this.root?.classList.remove('is-contextual');
                }
                this.render();
            });
        }
        plan.append(constructAction);

        const constructionGuide = createElement(
            'p',
            'village-construction-guide',
            contextualBuilding
                ? contextualBuilding.definition.extensionImpact
                : settlementComplete
                    ? 'Each structure now changes care, capacity, or expedition support.'
                : canConstruct
                ? `${selectedDefinition.immediateImpact} This will use the supplies shown on the button.`
                : 'Choose a building marked READY. The exact cost will appear before you confirm.'
        );
        plan.append(constructionGuide);

        const plotGrid = createElement('div', 'village-plot-grid');
        snapshot.plots.forEach(plot => {
            const building = plot.building
                ? snapshot.buildings.find(entry => entry.id === plot.building.id)
                : null;
            const canPlace = plot.open && selectedDefinition?.placement.available;
            const plotButton = createElement(
                'button',
                `village-plot${plot.open ? ' is-open' : ' is-occupied'}${canPlace ? ' is-valid' : ''}`
            );
            plotButton.type = 'button';
            plotButton.disabled = !canPlace;
            if (canPlace) {
                plotButton.addEventListener('click', () => {
                    const result = this.onPlace?.({
                        definitionId: selectedDefinition.id,
                        plotId: plot.id
                    });
                    this.statusMessage = formatResult(result);
                    this.render();
                });
            }
            const stateText = building
                ? building.status === 'complete'
                    ? building.definition.shortLabel
                    : `${building.definition.shortLabel} // ${Math.max(
                        0,
                        Math.ceil((building.completesAt - Date.now()) / 1000)
                    )}S`
                : canPlace
                    ? 'PLACE HERE'
                    : 'OPEN';
            plotButton.append(
                building
                    ? createBuildingArtwork(building.definitionId, {
                        compact: true,
                        status: building.status
                    })
                    : createElement('span', 'village-foundation-visual', canPlace ? '+' : '\u00b7'),
                createElement('span', 'village-plot-id', plot.label),
                createElement('strong', 'village-plot-state', stateText)
            );
            if (building?.status === 'constructing') {
                const elapsed = Math.max(0, Date.now() - building.startedAt);
                const duration = Math.max(1, building.completesAt - building.startedAt);
                const progress = Math.min(100, Math.round((elapsed / duration) * 100));
                const progressTrack = createElement('span', 'village-construction-track');
                const progressFill = createElement('span', 'village-construction-fill');
                progressFill.style.width = `${progress}%`;
                progressTrack.append(progressFill);
                plotButton.append(progressTrack);
            }
            plotGrid.append(plotButton);
        });
        if (!this.contextual) plan.append(plotGrid);

        const assignments = createElement('section', 'village-assignments');
        assignments.append(createElement(
            'h3',
            'village-section-title',
            contextualBuilding ? 'INVITE A RESIDENT OR COMPANION' : 'COMMUNITY HELP'
        ));
        const assignable = snapshot.buildings.filter(
            building => building.status === 'complete' && building.definition.production
        ).filter(building => !contextualBuilding || building.id === contextualBuilding.id);
        if (assignable.length === 0) {
            assignments.append(createElement(
                'p',
                'village-empty-state',
                'Complete a producer structure to invite a resident or companion contribution.'
            ));
        } else if (snapshot.roster.length === 0) {
            assignments.append(createElement(
                'p',
                'village-empty-state',
                'No resident or companion is available for settlement work.'
            ));
        } else {
            assignable.forEach(building => {
                const row = createElement('div', 'village-assignment-row');
                const summary = createElement('div', 'village-assignment-summary');
                const summaryCopy = createElement('span', 'village-assignment-copy');
                summaryCopy.append(
                    createElement('strong', 'village-assignment-building', building.definition.label),
                    createElement(
                        'span',
                        'village-assignment-current',
                        building.creature
                            ? `${building.creature.name} // ${Math.round(building.workProfile.multiplier * 100)}%`
                            : 'NO CONTRIBUTION'
                    ),
                    createElement(
                        'span',
                        'village-assignment-routine',
                        building.definition.workerRoutine
                            ? `${building.definition.workerRoutine.cue} · ${building.definition.workerRoutine.emotionalPurpose}`
                            : 'COMMUNITY SUPPORT'
                    )
                );
                summary.append(
                    createCreatureAvatar(
                        building.creature || snapshot.roster[0],
                        this.companionPortraitRecord
                    ),
                    summaryCopy
                );
                const controls = createElement('div', 'village-assignment-controls');
                const select = createElement('select', 'village-creature-select');
                select.setAttribute('aria-label', `Creature for ${building.definition.label}`);
                snapshot.roster.forEach(creature => {
                    const option = createElement(
                        'option',
                        '',
                        formatCommunityMemberOption(creature)
                    );
                    option.value = creature.id;
                    option.selected = creature.id === building.assignedCreatureId;
                    select.append(option);
                });
                const invite = createElement('button', 'village-invite-button', 'INVITE');
                invite.type = 'button';
                invite.addEventListener('click', () => {
                    const result = this.onAssign?.({
                        buildingId: building.id,
                        creatureId: select.value
                    });
                    this.statusMessage = formatResult(result);
                    this.render();
                });
                controls.append(select, invite);
                row.append(summary, controls);
                assignments.append(row);
            });
        }

        if (!this.contextual || contextualBuilding?.definition.production) {
            plan.append(assignments);
        }
        body.append(catalog, plan);
        shell.append(header, resources, status);
        if (viewTabs) shell.append(viewTabs);
        if (!this.contextual) {
            const heartDecision = this.onDecision
                ? createHeartDecision(snapshot, {
                    lastResult: this.lastDecisionResult,
                    onChoose: request => {
                        const result = this.onDecision?.(request);
                        this.statusMessage = formatResult(result);
                        if (result?.changed) this.lastDecisionResult = result;
                        this.render();
                    }
                })
                : null;
            shell.append(
                phase,
                createVillageSupportImpactSummary(snapshot),
                createCommunityPulse(snapshot, this.companionPortraitRecord)
            );
            if (heartDecision) shell.append(heartDecision);
            shell.append(createVillageVision());
        } else if (contextualBuilding?.definitionId === 'habitat') {
            shell.append(createCommunityPulse(snapshot, this.companionPortraitRecord));
        }
        shell.append(body);
        this.root.append(shell);
        restoreScrollState();
    }

    destroy() {
        if (!this.domElement) return;
        if (this.refreshTimer) window.clearInterval(this.refreshTimer);
        this.refreshTimer = null;
        if (this.inputActivationTimer) window.clearTimeout(this.inputActivationTimer);
        this.inputActivationTimer = null;
        if (this.keyboardHandler) window.removeEventListener('keydown', this.keyboardHandler);
        this.keyboardHandler = null;
        if (this.restoreMobileControls) this.scene.mobileControls?.resume?.();
        this.restoreMobileControls = false;
        if (this.physicsSuspended && this.scene.physics?.world) {
            this.scene.physics.resume();
        }
        this.physicsSuspended = false;
        if (this.domContainer) this.domContainer.style.zIndex = this.previousDomContainerZIndex;
        this.domContainer = null;
        this.previousDomContainerZIndex = '';
        this.domElement?.destroy?.();
        this.domElement = null;
        this.root = null;
        this.selectedPlotId = null;
        this.contextual = false;
        this.guided = false;
        this.guidedActionKey = null;
        this.statusMessage = '';
        this.lastDecisionResult = null;
        this.activeView = 'plan';
        const closeHandler = this.onClose;
        this.getSnapshot = null;
        this.onPlace = null;
        this.onAssign = null;
        this.onDecision = null;
        this.onAcknowledge = null;
        this.onTick = null;
        this.onClose = null;
        this.companionPortraitRecord = null;
        closeHandler?.();
    }
}
