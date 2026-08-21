import {
    VILLAGE_BUILDING_ARTWORK,
    VILLAGE_RESOURCE_DEFINITIONS
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

function createCreatureAvatar(creature) {
    const avatar = createElement('span', 'village-creature-avatar');
    const name = creature?.name || 'Creature';
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

function createCommunityPulse(snapshot) {
    const section = createElement('section', 'village-community-pulse');
    const home = snapshot?.home || {};
    const moment = snapshot?.communityMoments?.[0] || null;
    const identity = createElement('div', 'village-community-identities');

    if (moment) {
        moment.participants.forEach(participant => {
            const person = createElement('span', 'village-community-person');
            person.append(
                createCreatureAvatar(participant),
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
            moment ? moment.title : 'INVITE TWO COMPANIONS'
        ),
        createElement(
            'span',
            'village-community-line',
            moment
                ? moment.line
                : 'When companions help at different structures, their knowledge meets at the Heart.'
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
    const messages = {
        construction_started: 'Construction started. The foundation is now active.',
        creature_assigned: 'Contribution accepted. Production begins now.',
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

export default class VillageCommandPanel {
    constructor(scene) {
        this.scene = scene;
        this.domElement = null;
        this.root = null;
        this.getSnapshot = null;
        this.onPlace = null;
        this.onAssign = null;
        this.onDecision = null;
        this.onTick = null;
        this.onClose = null;
        this.selectedDefinitionId = null;
        this.selectedPlotId = null;
        this.contextual = false;
        this.statusMessage = '';
        this.lastDecisionResult = null;
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
        getSnapshot,
        onPlace,
        onAssign,
        onDecision,
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
        this.onTick = onTick;
        this.onClose = onClose;
        this.statusMessage = '';
        this.lastDecisionResult = null;
        const requestedPlot = snapshot.plots.find(plot => plot.id === plotId);
        this.selectedPlotId = requestedPlot?.id || null;
        this.contextual = Boolean(this.selectedPlotId);
        this.selectedDefinitionId = requestedPlot?.building?.definitionId ||
            snapshot.definitions.find(
                definition => definition.placement.available
            )?.id || snapshot.definitions.find(
                definition => !definition.placement.alreadyBuilt
            )?.id || snapshot.definitions[0]?.id || null;

        const root = createElement('div', 'village-command-modal');
        if (this.contextual) root.classList.add('is-contextual');
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

    render() {
        if (!this.root || !this.getSnapshot) return;
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
        const visibleDefinitions = [...snapshot.definitions].sort((left, right) => {
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
                        ? 'CREATURE HELP'
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
            contextualBuilding ? 'INVITE A COMPANION' : 'CREATURE HELP'
        ));
        const assignable = snapshot.buildings.filter(
            building => building.status === 'complete' && building.definition.production
        ).filter(building => !contextualBuilding || building.id === contextualBuilding.id);
        if (assignable.length === 0) {
            assignments.append(createElement(
                'p',
                'village-empty-state',
                'Complete a producer structure to invite a creature contribution.'
            ));
        } else if (snapshot.roster.length === 0) {
            assignments.append(createElement(
                'p',
                'village-empty-state',
                'No creature record is available for settlement work.'
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
                    createCreatureAvatar(building.creature || snapshot.roster[0]),
                    summaryCopy
                );
                const controls = createElement('div', 'village-assignment-controls');
                const select = createElement('select', 'village-creature-select');
                select.setAttribute('aria-label', `Creature for ${building.definition.label}`);
                snapshot.roster.forEach(creature => {
                    const option = createElement('option', '', creature.name);
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
            shell.append(phase, createCommunityPulse(snapshot));
            if (heartDecision) shell.append(heartDecision);
            shell.append(createVillageVision());
        } else if (contextualBuilding?.definitionId === 'habitat') {
            shell.append(createCommunityPulse(snapshot));
        }
        shell.append(body);
        this.root.append(shell);
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
        this.statusMessage = '';
        this.lastDecisionResult = null;
        const closeHandler = this.onClose;
        this.getSnapshot = null;
        this.onPlace = null;
        this.onAssign = null;
        this.onDecision = null;
        this.onTick = null;
        this.onClose = null;
        closeHandler?.();
    }
}
