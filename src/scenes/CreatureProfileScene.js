/**
 * CreatureProfileScene - Full-screen creature profile view
 * Shows detailed information about the current creature including:
 * - Visual representation
 * - Name, species, rarity
 * - Lifecycle stage and age
 * - Stats and personality
 * - Evolution history
 * - Cosmic affinity
 *
 * Database-ready: Uses unique IDs and timestamps for all data
 */

import Phaser from 'phaser';
import evolutionConfig from '../config/evolution.json';
import { devLog } from '../utils/devLogger.js';
import SceneTransitionHelper from '../utils/SceneTransitionHelper.js';
import CompanionIdentityArchiveModal from '../ui/CompanionIdentityArchiveModal.js';
import {
    COMPANION_IDENTITY_CHAPTERS,
    getCompanionIdentityArchiveSnapshot,
    recordCompanionIdentityChapter
} from '../systems/CompanionIdentityArchive.js';
import { companionMediaService } from '../systems/CompanionMediaService.js';

export default class CreatureProfileScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CreatureProfileScene' });
        this.graphicsEngine = null;
        this.elements = [];
        this.creatureSprite = null;
        this.scrollY = 0;
        this.maxScroll = 0;
        this.isRestarting = false;
        this.identityArchiveModal = null;
        this.identityArchivePreview = null;
        this.identityArchivePreviewSize = null;
        this.identityArchivePreviewState = null;
        this.profilePortraitPreview = false;
        this.profilePortraitPreviewSize = null;
        this.profilePortraitRequest = 0;
        this.profilePortraitUnsubscribe = null;
        this.fieldMemoryReplay = null;
        this.fieldMemoryReplayRequest = 0;
    }

    init(data) {
        this.identityArchivePreview = [
            'identity',
            'living_form',
            'shared_journey',
            'inheritance',
            'shared_inheritance',
            'complete'
        ].includes(data?.identityArchivePreview)
            ? data.identityArchivePreview
            : null;
        this.identityArchivePreviewSize =
            data?.identityArchivePreviewSize === 'mobile'
                ? 'mobile'
                : null;
        this.profilePortraitPreview = data?.profilePortraitPreview === true;
        this.profilePortraitPreviewSize =
            data?.profilePortraitPreviewSize === 'mobile'
                ? 'mobile'
                : null;
        this.profilePortraitUnsubscribe?.();
        this.profilePortraitUnsubscribe = null;
    }

    create() {
        console.log('[CreatureProfileScene] Creating profile view');

        // Reset restarting flag
        this.isRestarting = false;
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

        if (this.identityArchivePreview) {
            this.createIdentityArchivePreview();
            return;
        }

        // Initialize graphics engine
        if (window.GraphicsEngine) {
            this.graphicsEngine = new window.GraphicsEngine(this);
        }

        const { width, height } = this.scale;
        this.isMobile = this.profilePortraitPreviewSize === 'mobile' ||
            ('ontouchstart' in window && window.innerWidth < 768);

        // Create background
        this.createBackground();

        // Create header with back button
        this.createHeader();

        // Create scrollable content area
        this.createProfileContent();

        // Set up input
        this.setupInput();

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        console.log('[CreatureProfileScene] Profile view created');
    }

    createBackground() {
        const { width, height } = this.scale;

        // Dark cosmic gradient background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x050510, 0x050510, 0x0D0D2B, 0x0D0D2B, 1);
        bg.fillRect(0, 0, width, height);
        this.elements.push(bg);

        // Animated DNA helix on the side (decorative)
        this.createDNAHelix(width - 40, height / 2);

        // Cosmic nebula swirls
        this.createNebulaEffect(width * 0.2, height * 0.3);
        this.createNebulaEffect(width * 0.8, height * 0.7);

        // Star field with depth layers
        for (let layer = 0; layer < 3; layer++) {
            const starCount = 15 - layer * 4;
            const sizeRange = [0.5 + layer * 0.5, 1.5 + layer];
            const alphaRange = [0.2 + layer * 0.15, 0.5 + layer * 0.2];

            for (let i = 0; i < starCount; i++) {
                const star = this.add.graphics();
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
                const alpha = alphaRange[0] + Math.random() * (alphaRange[1] - alphaRange[0]);

                // Some stars have color
                const colors = [0xFFFFFF, 0xFFE4B5, 0x87CEEB, 0xE6E6FA];
                const color = colors[Math.floor(Math.random() * colors.length)];

                star.fillStyle(color, alpha);
                star.fillCircle(x, y, size);
                star.setDepth(layer);
                this.elements.push(star);

                // Twinkle with varying speeds based on depth
                this.tweens.add({
                    targets: star,
                    alpha: alpha * 0.2,
                    duration: 1500 + layer * 500 + Math.random() * 1500,
                    yoyo: true,
                    repeat: -1,
                    delay: Math.random() * 2000
                });
            }
        }
    }

    /**
     * Create animated DNA helix decoration
     */
    createDNAHelix(x, centerY) {
        const helixHeight = 300;
        const amplitude = 15;
        const segments = 20;
        const segmentHeight = helixHeight / segments;

        // Create helix strands
        for (let strand = 0; strand < 2; strand++) {
            const phaseOffset = strand * Math.PI;

            for (let i = 0; i < segments; i++) {
                const dot = this.add.graphics();
                const baseY = centerY - helixHeight / 2 + i * segmentHeight;
                const startPhase = (i / segments) * Math.PI * 4 + phaseOffset;

                // Initial position
                const offsetX = Math.sin(startPhase) * amplitude;
                const depth = Math.cos(startPhase);
                const size = 2 + depth * 1.5;
                const alpha = 0.3 + depth * 0.3;

                const color = strand === 0 ? 0x7B68EE : 0x00FFFF;
                dot.fillStyle(color, alpha);
                dot.fillCircle(x + offsetX, baseY, Math.max(1, size));
                dot.setDepth(1);
                this.elements.push(dot);

                // Animate the helix rotation
                this.tweens.add({
                    targets: dot,
                    alpha: { from: alpha, to: alpha * 0.3 },
                    duration: 3000,
                    yoyo: true,
                    repeat: -1,
                    delay: i * 100
                });
            }
        }

        // Connecting rungs
        for (let i = 0; i < segments; i += 2) {
            const rung = this.add.graphics();
            const y = centerY - helixHeight / 2 + i * segmentHeight;
            const phase = (i / segments) * Math.PI * 4;
            const x1 = x + Math.sin(phase) * amplitude;
            const x2 = x + Math.sin(phase + Math.PI) * amplitude;

            rung.lineStyle(1, 0x4B0082, 0.3);
            rung.lineBetween(x1, y, x2, y);
            rung.setDepth(0);
            this.elements.push(rung);
        }
    }

    /**
     * Create nebula swirl effect
     */
    createNebulaEffect(x, y) {
        const nebula = this.add.graphics();
        const colors = [0x7B68EE, 0x9370DB, 0x4B0082];

        // Multiple overlapping circles with low opacity
        for (let ring = 0; ring < 4; ring++) {
            const radius = 30 + ring * 20;
            const color = colors[ring % colors.length];
            nebula.fillStyle(color, 0.05 - ring * 0.01);
            nebula.fillCircle(x, y, radius);
        }

        nebula.setDepth(0);
        this.elements.push(nebula);

        // Slow rotation effect via alpha pulse
        this.tweens.add({
            targets: nebula,
            alpha: { from: 1, to: 0.5 },
            duration: 5000,
            yoyo: true,
            repeat: -1
        });
    }

    createHeader() {
        const { width } = this.scale;
        const headerHeight = 60;

        // Header background
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x1A1A3E, 0.95);
        headerBg.fillRect(0, 0, width, headerHeight);
        headerBg.lineStyle(1, 0x7B68EE, 0.5);
        headerBg.lineBetween(0, headerHeight, width, headerHeight);
        headerBg.setDepth(100);
        this.elements.push(headerBg);

        // Back button
        const backBtn = this.add.text(20, headerHeight / 2, '← Back', {
            fontSize: this.isMobile ? '16px' : '18px',
            color: '#FFFFFF'
        }).setOrigin(0, 0.5).setDepth(101);
        backBtn.setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => this.goBack());
        backBtn.on('pointerover', () => backBtn.setColor('#FFD700'));
        backBtn.on('pointerout', () => backBtn.setColor('#FFFFFF'));
        this.elements.push(backBtn);

        // Title
        const title = this.add.text(width / 2, headerHeight / 2, 'Creature Profile', {
            fontSize: this.isMobile ? '20px' : '24px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);
        this.elements.push(title);

        // ESC to go back
        this.input.keyboard?.on('keydown-ESC', () => this.goBack());
        this.input.keyboard?.on('keydown-P', () => this.goBack());
    }

    createProfileContent() {
        const { width, height } = this.scale;
        const startY = 80;
        let currentY = startY;

        // Get creature data
        const creatureData = this.getCreatureData();
        if (!creatureData) {
            this.showNoCreatureMessage();
            return;
        }

        // Create creature display (centered, large)
        currentY = this.createCreatureDisplay(creatureData, currentY);
        currentY = this.createIdentityArchiveEntry(currentY);

        // Create info sections
        currentY = this.createBasicInfoSection(creatureData, currentY);
        currentY = this.createGeneticsSection(creatureData, currentY);
        currentY = this.createHeritageSection(creatureData, currentY);
        currentY = this.createLifecycleSection(creatureData, currentY);
        currentY = this.createStatsSection(creatureData, currentY);
        currentY = this.createBondSection(creatureData, currentY);
        currentY = this.createPersonalitySection(creatureData, currentY);
        currentY = this.createEvolutionHistorySection(creatureData, currentY);

        // Release creature section (only show if more than 1 creature in collection)
        currentY = this.createReleaseSection(creatureData, currentY);

        // Calculate max scroll
        this.maxScroll = Math.max(0, currentY - height + 100);
    }

    createIdentityArchiveEntry(startY) {
        const snapshot = getCompanionIdentityArchiveSnapshot(
            window.GameState
        );
        if (!snapshot.available) return startY;
        const { width } = this.scale;
        const margin = this.isMobile ? 16 : 24;
        const top = startY + 14;
        const height = 56;
        const band = this.add.graphics();
        band.fillStyle(0x0A1819, 0.98);
        band.fillRoundedRect(
            margin,
            top,
            width - margin * 2,
            height,
            6
        );
        band.lineStyle(2, 0x71E6B1, 0.8);
        band.strokeRoundedRect(
            margin,
            top,
            width - margin * 2,
            height,
            6
        );
        band.setDepth(11);
        this.elements.push(band);

        const title = this.add.text(
            margin + 14,
            top + 14,
            'SHARED COMPANION RECORD',
            {
                fontSize: this.isMobile ? '11px' : '13px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        ).setDepth(12);
        const status = this.add.text(
            margin + 14,
            top + 34,
            snapshot.complete
                ? 'ARCHIVE COMPLETE // PORTABLE'
                : `${snapshot.reviewedCount}/${snapshot.totalChapters} CHAPTERS REVIEWED`,
            {
                fontSize: this.isMobile ? '9px' : '10px',
                color: '#AFC3CF'
            }
        ).setDepth(12);
        const action = this.add.text(
            width - margin - 14,
            top + height / 2,
            snapshot.complete ? 'OPEN' : 'REVIEW',
            {
                fontSize: this.isMobile ? '11px' : '12px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setOrigin(1, 0.5).setDepth(12);
        const zone = this.add.zone(
            width / 2,
            top + height / 2,
            width - margin * 2,
            height
        ).setDepth(13).setInteractive({ useHandCursor: true });
        zone.on('pointerup', () => this.openIdentityArchive());
        this.elements.push(title, status, action, zone);
        return top + height + 10;
    }

    openIdentityArchive({
        gameState = window.GameState,
        chapterId = null
    } = {}) {
        if (
            this.identityArchiveModal?.isVisible ||
            !gameState
        ) {
            return;
        }
        const snapshot = getCompanionIdentityArchiveSnapshot(gameState);
        if (!snapshot.available) return;
        this.identityArchiveModal = new CompanionIdentityArchiveModal(this, {
            snapshotProvider: () => (
                getCompanionIdentityArchiveSnapshot(gameState)
            ),
            onReview: id => {
                const result = recordCompanionIdentityChapter(
                    gameState,
                    id
                );
                if (!result?.changed) {
                    window.AudioManager?.playError?.();
                    return result;
                }
                window.AchievementSystem?.recordEvent?.(
                    'story_interaction',
                    {
                        event: 'companion_identity_chapter_reviewed',
                        chapterId: id,
                        complete: result.snapshot.complete
                    }
                );
                window.AudioManager?.playButtonClick?.();
                return result;
            },
            onReplay: memory => {
                this.showCompanionFieldMemoryReplay(memory, { gameState });
            },
            onClose: () => {
                this.identityArchiveModal = null;
            }
        });
        this.identityArchiveModal.show(
            chapterId || snapshot.nextChapter?.id || 'identity'
        );
    }

    showCompanionFieldMemoryReplay(memory, {
        gameState = window.GameState
    } = {}) {
        if (!memory?.momentId || !gameState) return false;
        this.identityArchiveModal?.destroy?.();
        this.identityArchiveModal = null;
        this.destroyCompanionFieldMemoryReplay();
        const requestId = ++this.fieldMemoryReplayRequest;
        const mediaService = window.CompanionMediaService ||
            companionMediaService;
        const previewRecord = this.identityArchivePreview
            ? {
                identityKey:
                    'preview_companion_23:juvenile:portrait',
                stage: 'juvenile',
                imageUrl: '/marketing/nova.webp',
                assetRef: null,
                storage: 'preview'
            }
            : null;

        Promise.resolve(mediaService?.createCinematicStill?.(this, {
            momentId: memory.momentId,
            stage: gameState.get?.('creature.lifecycle.stage') || 'baby',
            record: previewRecord,
            depth: 18000,
            alpha: 0.94,
            veilAlpha: 0.16,
            duration: 9000,
            isCurrent: () => (
                this.fieldMemoryReplayRequest === requestId &&
                this.sys?.isActive?.() !== false
            )
        })).then(tableau => {
            if (
                !tableau ||
                this.fieldMemoryReplayRequest !== requestId ||
                this.sys?.isActive?.() === false
            ) {
                tableau?.destroy?.();
                if (this.fieldMemoryReplayRequest === requestId) {
                    this.openIdentityArchive({
                        gameState,
                        chapterId: 'shared_journey'
                    });
                }
                return;
            }
            const { width, height } = this.scale;
            const depth = 18004;
            const elements = [];
            const dismiss = () => {
                if (this.fieldMemoryReplayRequest !== requestId) return;
                this.destroyCompanionFieldMemoryReplay();
                this.openIdentityArchive({
                    gameState,
                    chapterId: 'shared_journey'
                });
            };
            const inputZone = this.add.zone(
                width / 2,
                height / 2,
                width,
                height
            ).setScrollFactor(0).setDepth(depth).setInteractive();
            inputZone.on('pointerup', dismiss);
            elements.push(inputZone);
            const eyebrow = this.add.text(
                width / 2,
                Math.max(42, height * 0.1),
                'PRIVATE FIELD MEMORY // EXACT COMPANION ART',
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: width < 620 ? '11px' : '14px',
                    fontStyle: 'bold',
                    color: '#8FE3CF',
                    stroke: '#03040A',
                    strokeThickness: 4,
                    align: 'center'
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
            const title = this.add.text(
                width / 2,
                Math.max(76, height * 0.16),
                memory.label,
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: width < 620 ? '24px' : '34px',
                    fontStyle: 'bold',
                    color: '#F4F4F4',
                    stroke: '#03040A',
                    strokeThickness: 5,
                    align: 'center',
                    wordWrap: { width: width - 36 }
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
            const recordedViews = Math.max(
                1,
                Number(memory.viewCount) || 1
            );
            const stage = this.add.text(
                width / 2,
                height * 0.78,
                `${String(memory.stage || 'baby').toUpperCase()} // ` +
                    `${recordedViews} RECORDED VIEW${recordedViews === 1 ? '' : 'S'}`,
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: width < 620 ? '11px' : '14px',
                    fontStyle: 'bold',
                    color: '#F2C14E',
                    stroke: '#03040A',
                    strokeThickness: 4
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
            const close = this.add.text(
                width / 2,
                height * 0.88,
                '[ RETURN TO ARCHIVE ]',
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: width < 620 ? '14px' : '17px',
                    fontStyle: 'bold',
                    color: '#07110F',
                    backgroundColor: '#8FE3CF',
                    padding: { x: 18, y: 12 }
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2)
                .setInteractive({ useHandCursor: true });
            close.on('pointerup', dismiss);
            elements.push(eyebrow, title, stage, close);
            const keyboardHandler = event => {
                if (event.key !== 'Escape' && event.key !== 'Enter') return;
                event.preventDefault();
                dismiss();
            };
            window.addEventListener('keydown', keyboardHandler);
            this.fieldMemoryReplay = {
                tableau,
                elements,
                keyboardHandler,
                requestId
            };
            window.AudioManager?.playAchievement?.();
        }).catch(() => {
            if (this.fieldMemoryReplayRequest !== requestId) return;
            window.AudioManager?.playError?.();
            this.openIdentityArchive({
                gameState,
                chapterId: 'shared_journey'
            });
        });
        return true;
    }

    destroyCompanionFieldMemoryReplay() {
        this.fieldMemoryReplayRequest += 1;
        const replay = this.fieldMemoryReplay;
        if (!replay) return;
        if (replay.keyboardHandler) {
            window.removeEventListener('keydown', replay.keyboardHandler);
        }
        replay.tableau?.destroy?.();
        replay.elements?.forEach(element => element?.destroy?.());
        this.fieldMemoryReplay = null;
    }

    createIdentityArchivePreview() {
        const { width, height } = this.scale;
        const sharedLineagePreview =
            this.identityArchivePreview === 'shared_inheritance';
        if (this.identityArchivePreviewSize === 'mobile') {
            const viewportWidth = Math.min(390, width);
            const viewportHeight = Math.min(720, height);
            this.cameras.main.setViewport(
                (width - viewportWidth) / 2,
                (height - viewportHeight) / 2,
                viewportWidth,
                viewportHeight
            );
        }
        this.cameras.main.setBackgroundColor('#030709');
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x030709, 1);
        backdrop.fillRect(0, 0, width, height);
        this.elements.push(backdrop);

        const reviewedByMode = {
            identity: [],
            living_form: ['identity'],
            shared_journey: ['identity', 'living_form'],
            inheritance: [
                'identity',
                'living_form',
                'shared_journey'
            ],
            shared_inheritance: [
                'identity',
                'living_form',
                'shared_journey'
            ],
            complete: COMPANION_IDENTITY_CHAPTERS.map(
                chapter => chapter.id
            )
        };
        const state = {
            stats: { levelsCompleted: 5 },
            creature: {
                id: 'preview_companion_23',
                hatched: true,
                name: 'Aster',
                level: 8,
                genes: {
                    id: 'preview_companion_23',
                    species: 'nebulaSprite',
                    rarity: 'epic',
                    cosmicAffinity: {
                        element: 'star',
                        powerLevel: 0.83
                    }
                },
                lifecycle: { stage: 'juvenile' },
                linkedSiblingId: sharedLineagePreview
                    ? 'protected_preview_sibling_77'
                    : null,
                lineage: {
                    schemaVersion: 2,
                    creatureId: 'preview_companion_23',
                    origin: sharedLineagePreview
                        ? 'shared_fusion'
                        : 'fusion',
                    generation: 2,
                    parentIds: sharedLineagePreview
                        ? [
                            'parent_23',
                            'protected-parent-v1:' +
                                'preview_remote_parent_77'
                        ]
                        : ['parent_23', 'parent_77'],
                    fusionOperationId: 'fusion:preview:23',
                    linkedSiblingId: sharedLineagePreview
                        ? 'protected_preview_sibling_77'
                        : null,
                    createdAt: '2026-07-31T00:23:00.000Z'
                },
                bond: {
                    level: 11,
                    totalInteractions: 77,
                    careActions: 23,
                    conversations: 9,
                    levelsCompleted: 5
                },
                portraits: {
                    schemaVersion: 1,
                    activeStage: null,
                    byStage: {}
                },
                powerHistory: [{
                    eventId: 'preview_worldglass',
                    powerId: 'daybreak_event',
                    context: 'fend',
                    magnitude: 'extreme',
                    outcome: 'living_network_stabilized',
                    occurredAt: '2026-07-31T00:23:00.000Z'
                }],
                agencyHistory: [{
                    type: 'autonomous_rescue'
                }, {
                    type: 'high_power_rescue'
                }],
                identityArchive: {
                    schemaVersion: 1,
                    creatureId: 'preview_companion_23',
                    reviewedChapterIds: [
                        ...reviewedByMode[this.identityArchivePreview]
                    ],
                    firstReviewedAt: null,
                    completedAt: null,
                    history: []
                }
            },
            creatures: [],
            story: {
                companionMedia: {
                    appearances: {
                        firstLivingForm: {
                            momentId: 'first_living_form',
                            identityKey:
                                'preview_companion_23:juvenile:portrait',
                            stage: 'juvenile',
                            renderMode: 'motion_still',
                            viewCount: 1,
                            lastViewedAt: 1785453000000
                        },
                        guardianRescue: {
                            momentId:
                                'guardian_rescue_elder_treant',
                            identityKey:
                                'preview_companion_23:juvenile:portrait',
                            stage: 'juvenile',
                            renderMode: 'motion_still',
                            viewCount: 1,
                            lastViewedAt: 1785454000000
                        },
                        guardianDebrief: {
                            momentId:
                                'guardian_debrief_elder_treant',
                            identityKey:
                                'preview_companion_23:juvenile:portrait',
                            stage: 'juvenile',
                            renderMode: 'motion_still',
                            viewCount: 1,
                            lastViewedAt: 1785455000000
                        }
                    }
                },
                projectBeacon: {
                    fieldKit: {
                        katana: {
                            id: 'earth_field_katana',
                            configuration: 'creature_tech_adapted',
                            installedUpgrades: [{
                                id: 'crystal_edge',
                                witnessCompanionId:
                                    'preview_companion_23'
                            }, {
                                id: 'aurora_guard',
                                witnessCompanionId:
                                    'preview_companion_23'
                            }]
                        }
                    },
                    sensei: {
                        memoryLedger: {
                            history: [{
                                type: 'memory_recalled',
                                memoryId:
                                    'begin_with_your_footing',
                                companionId:
                                    'preview_companion_23'
                            }]
                        }
                    },
                    shipArchive: {
                        history: [{
                            type: 'section_reviewed',
                            sectionId: 'evidence',
                            companionId: 'preview_companion_23'
                        }]
                    }
                }
            },
            world: {
                sanctuaryDecorations: {
                    kinshipBeacon: {
                        schemaVersion: 2,
                        unlocked: true,
                        lineageCount: sharedLineagePreview ? 2 : 1,
                        sharedLineageCount:
                            sharedLineagePreview ? 1 : 0
                    }
                },
                fendCulture: {
                    firstListening: {
                        selectedPriority: 'restoration'
                    }
                }
            }
        };
        const gameState = {
            get(path) {
                return path.split('.').reduce(
                    (value, key) => value?.[key],
                    state
                );
            },
            set(path, value) {
                const keys = path.split('.');
                const finalKey = keys.pop();
                const target = keys.reduce((current, key) => {
                    current[key] ||= {};
                    return current[key];
                }, state);
                target[finalKey] = value;
            },
            save() {},
            emit() {}
        };
        this.identityArchivePreviewState = gameState;
        this.openIdentityArchive({
            gameState,
            chapterId: [
                'complete',
                'shared_inheritance'
            ].includes(this.identityArchivePreview)
                ? 'inheritance'
                : this.identityArchivePreview
        });
    }

    getCreatureData() {
        if (this.profilePortraitPreview) {
            const genes = window.CreatureGenetics
                ?.generateCreatureGenetics?.('epic');
            const dna = window.CreatureDNA?.generateDNA?.({
                forcedRarity: 'epic'
            });
            return {
                id: genes?.id || 'preview_companion_23',
                name: 'Nova',
                species: genes?.species || 'nebulaSprite',
                rarity: 'epic',
                genes,
                dna,
                lifecycle: { stage: 'baby', evolutionHistory: [] },
                birthDate: Date.now(),
                stage: 'baby',
                evolutionHistory: [],
                stats: { health: 100, happiness: 94, energy: 88 },
                level: 3,
                experience: 230,
                personality: genes?.personality || { core: 'curious' },
                personalityState: null,
                cosmicAffinity: genes?.cosmicAffinity || {
                    element: 'nebula'
                },
                mood: 'happy',
                textureName: null,
                isOffspring: false,
                generation: 1,
                parentIds: [],
                offspringBonus: null,
                birthEvents: [],
                secretAbilities: ['current_sense'],
                isShiny: false,
                hasDualAffinity: false,
                dualAffinity: null,
                hasAncientLineage: false,
                ancientProphecy: null,
                bond: { level: 3, experience: 23 }
            };
        }

        const gs = window.GameState;
        if (!gs) return null;

        const hatched = gs.get('creature.hatched');
        if (!hatched) return null;

        return {
            // Identifiers (database-ready)
            id: gs.get('creature.genes.id') || gs.get('creature.dna.id') || 'unknown',

            // Basic info
            name: gs.get('creature.name') || 'Unnamed',
            species: gs.get('creature.genes.species') || 'Unknown Species',
            rarity: gs.get('creature.genes.rarity') || 'common',

            // Genetics
            genes: gs.get('creature.genes'),
            dna: gs.get('creature.dna'),

            // Lifecycle
            lifecycle: gs.get('creature.lifecycle') || {},
            birthDate: gs.get('creature.lifecycle.birthDate') || gs.get('creature.hatchTime'),
            stage: gs.get('creature.lifecycle.stage') || 'baby',
            evolutionHistory: gs.get('creature.lifecycle.evolutionHistory') || [],

            // Stats
            stats: gs.get('creature.stats') || { health: 100, happiness: 100, energy: 100 },
            level: gs.get('creature.level') || 1,
            experience: gs.get('creature.experience') || 0,

            // Personality
            personality: gs.get('creature.personality'),
            personalityState: gs.get('creature.personalityState'),

            // Cosmic affinity
            cosmicAffinity: gs.get('creature.genes.cosmicAffinity'),

            // Mood
            mood: gs.get('creature.mood.current') || 'happy',

            // Texture
            textureName: gs.get('creature.textureName'),

            // Heritage/Lineage (for bred creatures)
            isOffspring: gs.get('creature.isOffspring') || false,
            generation: gs.get('creature.generation') || 1,
            parentIds: gs.get('creature.parentIds') || [],
            offspringBonus: gs.get('creature.offspringBonus'),

            // Birth events and secret abilities
            birthEvents: gs.get('creature.birthEvents') || [],
            secretAbilities: gs.get('creature.secretAbilities') || [],
            isShiny: gs.get('creature.isShiny') || false,
            hasDualAffinity: gs.get('creature.hasDualAffinity') || false,
            dualAffinity: gs.get('creature.dualAffinity') || null,

            // Ancient Lineage
            hasAncientLineage: gs.get('creature.hasAncientLineage') || false,
            ancientProphecy: gs.get('creature.ancientProphecy') || null,

            // Bond/Relationship data
            bond: gs.getBondStatus?.() || null
        };
    }

    createCreatureDisplay(data, startY) {
        const { width } = this.scale;
        const centerX = width / 2;
        const creatureY = startY + 80;
        const currentStage = data.stage || 'baby';
        const portraitRecord = this.getProfilePortraitRecord(currentStage);
        const hasLivingPortrait = Boolean(
            portraitRecord ||
            this.profilePortraitPreview ||
            window.LivingPortraitService?.getEligibility?.().eligible
        );
        const identitySpread = this.isMobile ? 70 : 96;
        const pixelX = hasLivingPortrait
            ? centerX - identitySpread
            : centerX;
        const livingX = centerX + identitySpread;
        const portraitSize = this.isMobile ? 108 : 132;

        // Glow behind creature
        const glow = this.add.graphics();
        const glowColor = this.getRarityColor(data.rarity);
        glow.fillStyle(glowColor, 0.2);
        glow.fillCircle(pixelX, creatureY, hasLivingPortrait ? 58 : 80);
        glow.fillStyle(glowColor, 0.1);
        glow.fillCircle(pixelX, creatureY, hasLivingPortrait ? 72 : 100);
        this.elements.push(glow);

        // Check if cached texture matches current stage
        const textureMatchesStage = data.textureName && data.textureName.includes(`_${currentStage}`);

        devLog(`[CreatureProfileScene] Creature data:`, {
            hasGenes: !!data.genes,
            hasDNA: !!data.dna,
            textureName: data.textureName,
            stage: currentStage,
            textureMatchesStage
        });

        // Create creature sprite
        if (data.textureName && this.textures.exists(data.textureName) && textureMatchesStage) {
            // Use cached texture only if it matches the current stage
            devLog(`[CreatureProfileScene] Using cached texture: ${data.textureName}`);
            this.creatureSprite = this.add.image(pixelX, creatureY, data.textureName);
            this.creatureSprite.setScale(this.isMobile ? 1.0 : 1.2);
        } else if (this.graphicsEngine) {
            // Use the shared loader so interrupted or legacy saves receive the
            // same deterministic fallback as every other gameplay scene.
            const result = this.graphicsEngine.loadCreatureFromGameState(0);

            if (result?.textureName) {
                devLog(`[CreatureProfileScene] Generated new texture: ${result.textureName}`);
                this.creatureSprite = this.add.image(pixelX, creatureY, result.textureName);
                this.creatureSprite.setScale(this.isMobile ? 1.0 : 1.2);

                // Update GameState with new texture name so it's cached correctly
                window.GameState?.set('creature.textureName', result.textureName);
            }
        }

        if (this.creatureSprite) {
            this.creatureSprite.setDepth(10);
            this.elements.push(this.creatureSprite);

            // Gentle floating animation
            this.tweens.add({
                targets: this.creatureSprite,
                y: creatureY - 8,
                duration: 2000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }

        if (hasLivingPortrait) {
            this.createLivingPortraitFrame({
                x: livingX,
                y: creatureY,
                size: portraitSize,
                record: portraitRecord,
                stage: currentStage,
                creatureData: data
            });
            const pixelLabel = this.add.text(
                pixelX,
                creatureY + (portraitSize / 2) + 12,
                'PIXEL FORM',
                {
                    fontSize: this.isMobile ? '9px' : '11px',
                    color: '#8FE3CF',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5).setDepth(12);
            this.elements.push(pixelLabel);
        }

        // Creature name
        const nameY = creatureY + (hasLivingPortrait ? 94 : 70);
        const nameText = this.add.text(centerX, nameY, data.name, {
            fontSize: this.isMobile ? '24px' : '28px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(nameText);

        // Species subtitle
        const speciesText = this.add.text(centerX, nameY + 30, data.species, {
            fontSize: this.isMobile ? '13px' : '15px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(speciesText);

        // "What Makes You Special" summary card
        const cardY = nameY + 60;
        const cardPadding = this.isMobile ? 12 : 16;
        const cardWidth = width - cardPadding * 2;

        // Count special traits
        const specialTraits = [];

        // Rarity is always special
        const rarityRank = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
        if (rarityRank[data.rarity] >= 3) {
            specialTraits.push({ icon: '✨', text: this.capitalizeFirst(data.rarity), color: this.getRarityColorHex(data.rarity) });
        }

        // Generation
        if (data.generation > 1) {
            specialTraits.push({ icon: '🧬', text: `Gen ${data.generation}`, color: '#FFD700' });
        }

        // Special indicators
        if (data.isShiny) {
            specialTraits.push({ icon: '💫', text: 'Shiny', color: '#FFD700' });
        }
        if (data.hasDualAffinity) {
            specialTraits.push({ icon: '🌈', text: 'Dual Affinity', color: '#88CCFF' });
        }
        if (data.hasAncientLineage) {
            specialTraits.push({ icon: '🌌', text: 'Ancient', color: '#9B59B6' });
        }

        // Cosmic affinity
        if (data.cosmicAffinity?.element) {
            const affinityIcons = { star: '⭐', moon: '🌙', nebula: '🌀', crystal: '💎', void: '🕳️' };
            specialTraits.push({
                icon: affinityIcons[data.cosmicAffinity.element] || '✨',
                text: this.capitalizeFirst(data.cosmicAffinity.element),
                color: '#00FFFF'
            });
        }

        // Secret abilities count
        if (data.secretAbilities?.length > 0) {
            specialTraits.push({ icon: '🌟', text: `${data.secretAbilities.length} Secret Ability${data.secretAbilities.length > 1 ? 'ies' : ''}`, color: '#FF69B4' });
        }

        // Draw card only if there are special traits
        if (specialTraits.length > 0) {
            const cardHeight = 70;

            // Card background with gradient effect
            const card = this.add.graphics();
            card.fillStyle(0x1A1A3E, 0.95);
            card.fillRoundedRect(cardPadding, cardY, cardWidth, cardHeight, 12);
            card.lineStyle(2, this.getRarityColor(data.rarity), 0.8);
            card.strokeRoundedRect(cardPadding, cardY, cardWidth, cardHeight, 12);
            card.setDepth(11);
            this.elements.push(card);

            // "What Makes You Special" header
            const headerText = this.add.text(cardPadding + 12, cardY + 12, 'What Makes You Special', {
                fontSize: this.isMobile ? '10px' : '11px',
                color: '#888888',
                fontStyle: 'italic'
            }).setDepth(12);
            this.elements.push(headerText);

            // Display trait badges in a row
            const badgeY = cardY + 40;
            const badgeSpacing = Math.min(80, (cardWidth - 20) / specialTraits.length);
            const startX = cardPadding + 20;

            specialTraits.slice(0, 5).forEach((trait, index) => {
                const badgeX = startX + (index * badgeSpacing);

                // Badge background
                const badge = this.add.graphics();
                badge.fillStyle(Phaser.Display.Color.HexStringToColor(trait.color).color, 0.2);
                badge.fillRoundedRect(badgeX - 5, badgeY - 12, badgeSpacing - 10, 24, 6);
                badge.setDepth(12);
                this.elements.push(badge);

                // Badge text
                const badgeText = this.add.text(badgeX + (badgeSpacing - 10) / 2 - 5, badgeY, `${trait.icon} ${trait.text}`, {
                    fontSize: this.isMobile ? '10px' : '11px',
                    color: trait.color,
                    fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(13);
                this.elements.push(badgeText);
            });

            return cardY + cardHeight + 10;
        }

        return cardY;
    }

    getProfilePortraitRecord(stage) {
        if (this.profilePortraitPreview) {
            return {
                identityKey: 'preview_companion_23:baby:portrait',
                stage: 'baby',
                imageUrl: '/marketing/nova.webp',
                assetRef: null,
                storage: 'preview'
            };
        }
        return window.GameState?.getCreaturePortrait?.(stage) || null;
    }

    async waitForProfilePortrait(stage, initialRecord = null, creatureData = null) {
        const mediaService = window.CompanionMediaService || companionMediaService;
        const portraitService = window.LivingPortraitService;
        const activeJob = portraitService?.getActiveJob?.(stage);
        const activeIdentityKey = window.CreaturePortraitSpec
            ?.create?.(creatureData)?.identityKey;
        if (
            activeJob?.promise &&
            (!activeIdentityKey || activeJob.identityKey === activeIdentityKey)
        ) {
            return activeJob.promise;
        }

        if (initialRecord) {
            try {
                const resolved = await mediaService?.resolvePortrait?.(stage);
                if (resolved?.imageUrl) return resolved;
                if (initialRecord.imageUrl) return initialRecord;
                throw new Error('Protected portrait is still forming');
            } catch (error) {
                if (
                    error?.code !== 'generation_failed' ||
                    !portraitService?.getEligibility?.().eligible ||
                    !portraitService?.generate ||
                    !creatureData?.genes
                ) {
                    throw error;
                }
            }
        }

        if (
            portraitService?.getEligibility?.().eligible &&
            portraitService?.generate &&
            creatureData?.genes
        ) {
            return portraitService.generate({
                creatureData: {
                    name: creatureData.name,
                    stage,
                    genes: creatureData.genes,
                    dna: creatureData.dna
                },
                sprite: this.creatureSprite,
                style: 'cinematic',
                source: 'profile_recovery'
            });
        }

        const deadline = Date.now() + 240000;
        while (Date.now() < deadline && this.scene?.isActive?.()) {
            const persisted = window.GameState?.getCreaturePortrait?.(stage);
            if (persisted) {
                return mediaService?.resolvePortrait?.(stage) || persisted;
            }

            const pendingJob = portraitService?.getActiveJob?.(stage);
            if (pendingJob?.promise) {
                return pendingJob.promise;
            }

            await new Promise(resolve => window.setTimeout(resolve, 750));
        }

        throw new Error('Living portrait is not available yet');
    }

    createLivingPortraitFrame({ x, y, size, record, stage, creatureData }) {
        const frame = this.add.graphics();
        frame.fillStyle(0x07100F, 0.98);
        frame.fillRoundedRect(
            x - (size / 2),
            y - (size / 2),
            size,
            size,
            6
        );
        frame.lineStyle(2, 0x8FE3CF, 0.95);
        frame.strokeRoundedRect(
            x - (size / 2),
            y - (size / 2),
            size,
            size,
            6
        );
        frame.setDepth(9);
        const placeholder = this.add.text(x, y, 'LIVING FORM\nRESOLVING', {
            fontSize: this.isMobile ? '9px' : '11px',
            color: '#8FE3CF',
            align: 'center',
            fontStyle: 'bold',
            lineSpacing: 3
        }).setOrigin(0.5).setDepth(10);
        const label = this.add.text(
            x,
            y + (size / 2) + 12,
            'LIVING FORM',
            {
                fontSize: this.isMobile ? '9px' : '11px',
                color: '#F2C14E',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(12);
        this.elements.push(frame, placeholder, label);

        let portraitLoaded = false;
        const loadPortrait = candidate => {
            const nextRequestId = ++this.profilePortraitRequest;
            placeholder.disableInteractive?.();
            placeholder.setText('LIVING FORM\nRESOLVING');
            const recordPromise = this.profilePortraitPreview
                ? Promise.resolve(record)
                : candidate
                    ? Promise.resolve(candidate)
                    : this.waitForProfilePortrait(stage, record, creatureData);
            return Promise.resolve(recordPromise)
            .then(resolved => {
                if (!resolved?.imageUrl) return null;
                return Promise.resolve(
                    window.CompanionMediaService?.ensureTexture?.(
                        this,
                        resolved
                    )
                ).then(textureKey => ({ resolved, textureKey }));
            })
            .then(result => {
                if (
                    !result?.textureKey ||
                    nextRequestId !== this.profilePortraitRequest ||
                    portraitLoaded ||
                    !this.scene.isActive()
                ) {
                    return;
                }
                portraitLoaded = true;
                const portrait = this.add.image(
                    x,
                    y,
                    result.textureKey
                ).setDisplaySize(size - 8, size - 8).setDepth(10);
                this.tweens.add({
                    targets: portrait,
                    y: y - 3,
                    scaleX: portrait.scaleX * 1.025,
                    scaleY: portrait.scaleY * 1.025,
                    duration: 2600,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                placeholder.destroy();
                this.profilePortraitUnsubscribe?.();
                this.profilePortraitUnsubscribe = null;
                this.elements.push(portrait);
                if (!this.profilePortraitPreview) {
                    window.CompanionMediaService?.recordAppearance?.(
                        'companion_profile',
                        result.resolved,
                        'motion_still'
                    );
                }
            })
            .catch(error => {
                if (
                    nextRequestId !== this.profilePortraitRequest ||
                    portraitLoaded ||
                    !placeholder.active
                ) {
                    return;
                }
                placeholder
                    .setText('LIVING FORM\nTAP TO RETRY')
                    .setPadding(8, 8)
                    .setInteractive({ useHandCursor: true });
                placeholder.once('pointerup', () => {
                    record = window.GameState?.getCreaturePortrait?.(stage) || record;
                    loadPortrait();
                });
                devLog(
                    '[CreatureProfileScene] Living portrait unavailable:',
                    error.message
                );
            });
        };

        if (!this.profilePortraitPreview) {
            this.profilePortraitUnsubscribe?.();
            this.profilePortraitUnsubscribe = window.GameState?.on?.(
                'creaturePortraitReady',
                nextRecord => {
                    if (
                        !portraitLoaded &&
                        nextRecord?.stage === stage &&
                        nextRecord?.imageUrl
                    ) {
                        loadPortrait(nextRecord);
                    }
                }
            ) || null;
        }
        loadPortrait();
    }

    createBasicInfoSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        startY += 20;

        // Section header
        const header = this.createSectionHeader('Basic Info', startY);
        startY = header.y + 30;

        // Info grid
        const infoItems = [
            { label: 'Level', value: `${data.level}`, icon: '⭐' },
            { label: 'Experience', value: `${data.experience} XP`, icon: '✨' },
            { label: 'Mood', value: this.capitalizeFirst(data.mood), icon: this.getMoodIcon(data.mood) }
        ];

        if (data.cosmicAffinity) {
            infoItems.push({
                label: 'Cosmic Affinity',
                value: this.capitalizeFirst(data.cosmicAffinity.element || 'None'),
                icon: this.getAffinityIcon(data.cosmicAffinity.element)
            });
        }

        const itemsPerRow = this.isMobile ? 2 : 3;
        const itemWidth = (width - padding * 2) / itemsPerRow;

        infoItems.forEach((item, index) => {
            const col = index % itemsPerRow;
            const row = Math.floor(index / itemsPerRow);
            const x = padding + col * itemWidth + itemWidth / 2;
            const y = startY + row * 50;

            this.createInfoItem(x, y, item);
        });

        return startY + Math.ceil(infoItems.length / itemsPerRow) * 50 + 10;
    }

    /**
     * Create genetics section - shows rarity, generation, and key genetic traits
     * Always displays for ALL creatures
     */
    createGeneticsSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        startY += 20;

        const header = this.createSectionHeader('🧬 Genetics & Rarity', startY);
        startY = header.y + 30;

        // Rarity badge (prominent, centered)
        const rarityColor = this.getRarityColor(data.rarity);
        const rarityColorHex = this.getRarityColorHex(data.rarity);
        const badgeWidth = this.isMobile ? 160 : 180;
        const badgeHeight = 45;
        const badgeX = width / 2 - badgeWidth / 2;

        const rarityBadge = this.add.graphics();
        rarityBadge.fillStyle(rarityColor, 0.3);
        rarityBadge.fillRoundedRect(badgeX, startY, badgeWidth, badgeHeight, 12);
        rarityBadge.lineStyle(3, rarityColor, 1);
        rarityBadge.strokeRoundedRect(badgeX, startY, badgeWidth, badgeHeight, 12);
        rarityBadge.setDepth(11);
        this.elements.push(rarityBadge);

        const rarityText = this.add.text(width / 2, startY + badgeHeight / 2,
            `✨ ${this.capitalizeFirst(data.rarity)} ✨`, {
            fontSize: this.isMobile ? '18px' : '22px',
            color: rarityColorHex,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(12);
        this.elements.push(rarityText);

        startY += badgeHeight + 20;

        // Generation info
        const genText = this.add.text(width / 2, startY, `Generation ${data.generation || 1}`, {
            fontSize: this.isMobile ? '14px' : '16px',
            color: '#FFD700'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(genText);

        startY += 30;

        // Cosmic Affinity (if available)
        if (data.cosmicAffinity) {
            const affinityIcon = this.getAffinityIcon(data.cosmicAffinity.element);
            const affinityText = this.add.text(width / 2, startY,
                `${affinityIcon} Cosmic Affinity: ${this.capitalizeFirst(data.cosmicAffinity.element)}`, {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#00FFFF'
            }).setOrigin(0.5).setDepth(11);
            this.elements.push(affinityText);

            startY += 25;

            // Power level if available
            if (data.cosmicAffinity.powerLevel) {
                const powerPercent = Math.round(data.cosmicAffinity.powerLevel * 100);
                const powerText = this.add.text(width / 2, startY,
                    `Power Level: ${powerPercent}%`, {
                    fontSize: '12px',
                    color: '#88CCFF'
                }).setOrigin(0.5).setDepth(11);
                this.elements.push(powerText);
                startY += 20;
            }
        }

        // Key genetic traits (if genes exist)
        if (data.genes?.traits) {
            startY += 10;

            const traitsLabel = this.add.text(padding, startY, 'Key Traits:', {
                fontSize: '14px',
                color: '#7B68EE'
            }).setDepth(11);
            this.elements.push(traitsLabel);

            startY += 25;

            // Body type
            if (data.genes.traits.bodyShape) {
                const bodyType = data.genes.traits.bodyShape.type || 'balanced';
                const bodyText = this.add.text(padding + 10, startY,
                    `• Body Type: ${this.capitalizeFirst(bodyType)}`, {
                    fontSize: '13px',
                    color: '#AAAAAA'
                }).setDepth(11);
                this.elements.push(bodyText);
                startY += 22;
            }

            // Special features
            if (data.genes.traits.features) {
                const features = data.genes.traits.features;

                if (features.hasWings) {
                    const wingText = this.add.text(padding + 10, startY,
                        `• Has Wings (Size: ${Math.round((features.wingSize || 1) * 100)}%)`, {
                        fontSize: '13px',
                        color: '#AAAAAA'
                    }).setDepth(11);
                    this.elements.push(wingText);
                    startY += 22;
                }

                if (features.hasHorns) {
                    const hornText = this.add.text(padding + 10, startY,
                        `• Has Horns`, {
                        fontSize: '13px',
                        color: '#AAAAAA'
                    }).setDepth(11);
                    this.elements.push(hornText);
                    startY += 22;
                }

                if (features.hasTail) {
                    const tailText = this.add.text(padding + 10, startY,
                        `• Has Tail`, {
                        fontSize: '13px',
                        color: '#AAAAAA'
                    }).setDepth(11);
                    this.elements.push(tailText);
                    startY += 22;
                }

                // Eye count if special
                if (features.eyeCount && features.eyeCount !== 2) {
                    const eyeText = this.add.text(padding + 10, startY,
                        `• Eyes: ${features.eyeCount}`, {
                        fontSize: '13px',
                        color: '#AAAAAA'
                    }).setDepth(11);
                    this.elements.push(eyeText);
                    startY += 22;
                }

                // Markings
                if (features.markingType && features.markingType !== 'none') {
                    const markingText = this.add.text(padding + 10, startY,
                        `• Markings: ${this.capitalizeFirst(features.markingType)}`, {
                        fontSize: '13px',
                        color: '#AAAAAA'
                    }).setDepth(11);
                    this.elements.push(markingText);
                    startY += 22;
                }
            }
        }

        // Shiny indicator
        if (data.isShiny) {
            const shinyBadge = this.add.text(width / 2, startY + 5, '✨ SHINY CREATURE ✨', {
                fontSize: '14px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5).setDepth(11);
            this.elements.push(shinyBadge);
            startY += 30;
        }

        // Dual Affinity indicator
        if (data.hasDualAffinity && data.dualAffinity) {
            const affinityIcons = {
                star: '⭐', moon: '🌙', nebula: '🌌', crystal: '💎', void: '🕳️'
            };
            const icon1 = affinityIcons[data.dualAffinity.primary] || '✨';
            const icon2 = affinityIcons[data.dualAffinity.secondary] || '✨';

            const dualText = this.add.text(width / 2, startY + 5,
                `${icon1} ${icon2} Dual Affinity`, {
                fontSize: '14px',
                color: '#88CCFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(11);
            this.elements.push(dualText);
            startY += 30;
        }

        return startY + 10;
    }

    /**
     * Create heritage/lineage section for bred creatures
     * Shows family tree, parents, generation, and bloodline bonuses
     */
    createHeritageSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        // Only show if creature is an offspring or generation > 1
        if (!data.isOffspring && data.generation <= 1) {
            return startY;
        }

        startY += 20;

        const header = this.createSectionHeader('🧬 Heritage & Bloodline', startY);
        startY = header.y + 30;

        // Generation badge (prominent)
        const genBadgeWidth = 120;
        const genBadgeHeight = 40;
        const genBadgeX = width / 2 - genBadgeWidth / 2;

        const genBadge = this.add.graphics();
        genBadge.fillStyle(0x4B0082, 0.9);
        genBadge.fillRoundedRect(genBadgeX, startY, genBadgeWidth, genBadgeHeight, 10);
        genBadge.lineStyle(2, 0xFFD700, 1);
        genBadge.strokeRoundedRect(genBadgeX, startY, genBadgeWidth, genBadgeHeight, 10);
        genBadge.setDepth(11);
        this.elements.push(genBadge);

        const genText = this.add.text(width / 2, startY + genBadgeHeight / 2, `Generation ${data.generation}`, {
            fontSize: this.isMobile ? '16px' : '18px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(12);
        this.elements.push(genText);

        startY += genBadgeHeight + 20;

        // Family Tree Visualization
        startY = this.createFamilyTreeDisplay(data, startY, padding, width);

        // Bloodline Bonuses (if any)
        if (data.offspringBonus) {
            startY += 15;

            const bonusHeader = this.add.text(padding, startY, '✨ Bloodline Bonuses', {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#88FF88',
                fontStyle: 'bold'
            }).setDepth(11);
            this.elements.push(bonusHeader);

            startY += 25;

            // Cosmic Power bonus
            if (data.offspringBonus.cosmicPower && data.offspringBonus.cosmicPower > 1) {
                const powerBonus = Math.round((data.offspringBonus.cosmicPower - 1) * 100);
                const bonusText = this.add.text(padding + 15, startY, `💫 +${powerBonus}% Cosmic Power`, {
                    fontSize: '14px',
                    color: '#AAFFAA'
                }).setDepth(11);
                this.elements.push(bonusText);
                startY += 22;
            }

            // Description
            if (data.offspringBonus.description) {
                const descText = this.add.text(padding + 15, startY, `🎖️ ${data.offspringBonus.description}`, {
                    fontSize: '14px',
                    color: '#88CCFF'
                }).setDepth(11);
                this.elements.push(descText);
                startY += 22;
            }
        }

        // Generation benefits explanation
        startY += 10;
        const benefitText = this.add.text(padding, startY,
            `Higher generations gain stronger cosmic abilities!\nGen ${data.generation} creatures earn +${(data.generation - 1) * 5}% experience.`, {
            fontSize: '12px',
            color: '#888888',
            wordWrap: { width: width - padding * 2 }
        }).setDepth(11);
        this.elements.push(benefitText);
        startY += 45;

        // BIRTH EVENTS: Display special events that occurred at birth
        if (data.birthEvents && data.birthEvents.length > 0) {
            const eventHeader = this.add.text(padding, startY, '🎊 Birth Events', {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#FFD700',
                fontStyle: 'bold'
            }).setDepth(11);
            this.elements.push(eventHeader);
            startY += 25;

            data.birthEvents.forEach(event => {
                const eventText = this.add.text(padding + 15, startY, event.message || event.name, {
                    fontSize: '13px',
                    color: this.getBirthEventColor(event.rarity)
                }).setDepth(11);
                this.elements.push(eventText);
                startY += 20;
            });

            startY += 10;
        }

        // SECRET ABILITIES: Display unlocked special abilities
        if (data.secretAbilities && data.secretAbilities.length > 0) {
            const abilityHeader = this.add.text(padding, startY, '🌟 Secret Abilities', {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#FF69B4',
                fontStyle: 'bold'
            }).setDepth(11);
            this.elements.push(abilityHeader);
            startY += 25;

            data.secretAbilities.forEach(ability => {
                const abilityRow = this.add.text(padding + 15, startY, `${ability.icon || '⭐'} ${ability.name}`, {
                    fontSize: '13px',
                    color: '#E0BBE4',
                    fontStyle: 'bold'
                }).setDepth(11);
                this.elements.push(abilityRow);
                startY += 18;

                // Show ability description
                if (ability.description) {
                    const descText = this.add.text(padding + 30, startY, ability.description, {
                        fontSize: '11px',
                        color: '#AAAAAA',
                        wordWrap: { width: width - padding * 2 - 30 }
                    }).setDepth(11);
                    this.elements.push(descText);
                    startY += 18;
                }
            });

            startY += 10;
        }

        // ANCIENT LINEAGE: Show prophecy for ancient creatures
        if (data.hasAncientLineage && data.ancientProphecy) {
            startY += 5;
            const ancientHeader = this.add.text(padding, startY, '🌌 Ancient Lineage', {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#9B59B6',
                fontStyle: 'bold'
            }).setDepth(11);
            this.elements.push(ancientHeader);
            startY += 25;

            const prophecyText = this.add.text(padding + 15, startY, `"${data.ancientProphecy}"`, {
                fontSize: '12px',
                color: '#DDA0DD',
                fontStyle: 'italic',
                wordWrap: { width: width - padding * 2 - 30 }
            }).setDepth(11);
            this.elements.push(prophecyText);
            startY += prophecyText.height + 15;
        }

        // SHINY indicator
        if (data.isShiny) {
            const shinyBadge = this.add.text(padding, startY, '✨ SHINY CREATURE ✨', {
                fontSize: '14px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }).setDepth(11);
            this.elements.push(shinyBadge);
            startY += 25;
        }

        // DUAL AFFINITY display
        if (data.hasDualAffinity && data.dualAffinity) {
            const affinityIcons = {
                star: '⭐', moon: '🌙', nebula: '🌌', crystal: '💎', void: '🕳️'
            };
            const icon1 = affinityIcons[data.dualAffinity.primary] || '✨';
            const icon2 = affinityIcons[data.dualAffinity.secondary] || '✨';

            const dualText = this.add.text(padding, startY,
                `${icon1} ${icon2} Dual Affinity: ${data.dualAffinity.primary} + ${data.dualAffinity.secondary}`, {
                fontSize: '14px',
                color: '#88CCFF',
                fontStyle: 'bold'
            }).setDepth(11);
            this.elements.push(dualText);
            startY += 25;
        }

        return startY + 10;
    }

    /**
     * Get color for birth event based on rarity
     */
    getBirthEventColor(rarity) {
        const colors = {
            common: '#AAAAAA',
            uncommon: '#00FF00',
            rare: '#0088FF',
            ultraRare: '#FF00FF',
            legendary: '#FFD700'
        };
        return colors[rarity] || '#FFFFFF';
    }

    /**
     * Create family tree visualization showing parents and lineage
     */
    createFamilyTreeDisplay(data, startY, padding, width) {
        // Get parent data from collection
        const collection = window.GameState?.get('creatures') || [];
        const parentIds = data.parentIds || [];

        // Find parent creatures in collection
        const parent1 = parentIds[0] ? this.findCreatureById(parentIds[0], collection) : null;
        const parent2 = parentIds[1] ? parentIds[1] !== parentIds[0] ? this.findCreatureById(parentIds[1], collection) : null : null;

        if (!parent1 && !parent2 && parentIds.length === 0) {
            // No parent info available - show origin info
            const originText = this.add.text(width / 2, startY, '🥚 Hatched from Egg', {
                fontSize: '14px',
                color: '#AAAAAA'
            }).setOrigin(0.5).setDepth(11);
            this.elements.push(originText);
            return startY + 30;
        }

        // Family tree header
        const treeHeader = this.add.text(width / 2, startY, '👪 Family Tree', {
            fontSize: this.isMobile ? '14px' : '16px',
            color: '#E6E6FA',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(treeHeader);

        startY += 30;

        // Parents row
        const parentWidth = (width - padding * 3) / 2;
        const parentHeight = 80;

        // Draw connecting lines (family tree structure)
        const lineGraphics = this.add.graphics();
        lineGraphics.lineStyle(2, 0x7B68EE, 0.6);

        // Parent 1 card
        const p1X = padding;
        this.createParentCard(p1X, startY, parentWidth, parentHeight, parent1, parentIds[0], '💜');

        // Parent 2 card
        const p2X = width - padding - parentWidth;
        this.createParentCard(p2X, startY, parentWidth, parentHeight, parent2, parentIds[1], '💙');

        // Draw connecting lines
        const centerX = width / 2;
        const connectY = startY + parentHeight + 10;

        // Lines from parents to center
        lineGraphics.lineBetween(p1X + parentWidth / 2, startY + parentHeight, centerX, connectY);
        lineGraphics.lineBetween(p2X + parentWidth / 2, startY + parentHeight, centerX, connectY);

        // Line from center down to "You" indicator
        lineGraphics.lineBetween(centerX, connectY, centerX, connectY + 25);

        lineGraphics.setDepth(10);
        this.elements.push(lineGraphics);

        startY += parentHeight + 15;

        // "You" indicator (offspring - current creature) with gold border
        const youPortraitRadius = 20;
        const youPortraitY = startY + 25;

        // Gold portrait circle background for current creature
        const youPortraitBg = this.add.graphics();
        youPortraitBg.fillStyle(0x1A1A3E, 0.9);
        youPortraitBg.fillCircle(centerX, youPortraitY, youPortraitRadius + 4);
        youPortraitBg.lineStyle(3, 0xFFD700, 1); // Gold border for current creature
        youPortraitBg.strokeCircle(centerX, youPortraitY, youPortraitRadius + 4);
        youPortraitBg.setDepth(11);
        this.elements.push(youPortraitBg);

        // Render mini creature portrait
        if (data.genes && this.graphicsEngine) {
            try {
                const textureName = data.textureName || window.GameState?.get('creature.textureName');
                if (textureName && this.textures.exists(textureName)) {
                    const portrait = this.add.sprite(centerX, youPortraitY, textureName);
                    portrait.setScale(0.3);
                    portrait.setDepth(12);
                    this.elements.push(portrait);
                } else {
                    // Generate texture
                    const { textureName: newTexture } = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                        data.genes, 0, data.stage || 'adult'
                    );
                    const portrait = this.add.sprite(centerX, youPortraitY, newTexture);
                    portrait.setScale(0.3);
                    portrait.setDepth(12);
                    this.elements.push(portrait);
                }
            } catch (e) {
                // Fallback to star emoji
                const youEmoji = this.add.text(centerX, youPortraitY, '⭐', {
                    fontSize: '18px'
                }).setOrigin(0.5).setDepth(12);
                this.elements.push(youEmoji);
            }
        } else {
            const youEmoji = this.add.text(centerX, youPortraitY, '⭐', {
                fontSize: '18px'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(youEmoji);
        }

        // "You" label with name
        const youText = this.add.text(centerX, youPortraitY + youPortraitRadius + 12, data.name, {
            fontSize: '12px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(12);
        this.elements.push(youText);

        // Current creature badge
        const currentBadge = this.add.text(centerX, youPortraitY + youPortraitRadius + 26, '(You)', {
            fontSize: '10px',
            color: '#88FF88'
        }).setOrigin(0.5).setDepth(12);
        this.elements.push(currentBadge);

        return startY + 70;
    }

    /**
     * Create a parent card for the family tree with mini creature portrait
     */
    createParentCard(x, y, width, height, parentData, parentId, emoji) {
        // Card background
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x2A1A4E, 0.9);
        cardBg.fillRoundedRect(x, y, width, height, 10);
        cardBg.lineStyle(1, 0x7B68EE, 0.6);
        cardBg.strokeRoundedRect(x, y, width, height, 10);
        cardBg.setDepth(11);
        this.elements.push(cardBg);

        const centerX = x + width / 2;
        const portraitRadius = 22;

        if (parentData) {
            // Parent found - show details
            const rarity = parentData.rarity || parentData.genes?.rarity || 'common';
            const rarityColor = this.getRarityColorHex(rarity);
            const rarityColorNum = this.getRarityColor(rarity);

            // Mini creature portrait circle
            const portraitY = y + 28;
            const portraitBg = this.add.graphics();
            portraitBg.fillStyle(0x1A1A3E, 0.9);
            portraitBg.fillCircle(centerX, portraitY, portraitRadius + 3);
            portraitBg.lineStyle(2, rarityColorNum, 0.9); // Rarity-colored border
            portraitBg.strokeCircle(centerX, portraitY, portraitRadius + 3);
            portraitBg.setDepth(12);
            this.elements.push(portraitBg);

            // Try to render mini creature if we have genetics
            if (parentData.genes && this.graphicsEngine) {
                try {
                    const { textureName } = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                        parentData.genes, 0, 'adult'
                    );
                    const portrait = this.add.sprite(centerX, portraitY, textureName);
                    portrait.setScale(0.35);
                    portrait.setDepth(13);
                    this.elements.push(portrait);
                } catch (e) {
                    // Fallback to emoji
                    const emojiText = this.add.text(centerX, portraitY, emoji, {
                        fontSize: '20px'
                    }).setOrigin(0.5).setDepth(13);
                    this.elements.push(emojiText);
                }
            } else {
                // Emoji fallback when no genetics
                const emojiText = this.add.text(centerX, portraitY, emoji, {
                    fontSize: '20px'
                }).setOrigin(0.5).setDepth(13);
                this.elements.push(emojiText);
            }

            // Rarity dot indicator
            const dotX = centerX + portraitRadius;
            const dotY = portraitY - portraitRadius + 5;
            const dotBg = this.add.graphics();
            dotBg.fillStyle(rarityColorNum, 1);
            dotBg.fillCircle(dotX, dotY, 6);
            dotBg.lineStyle(1, 0xFFFFFF, 0.8);
            dotBg.strokeCircle(dotX, dotY, 6);
            dotBg.setDepth(14);
            this.elements.push(dotBg);

            // Parent name (below portrait)
            const nameText = this.add.text(centerX, y + 55, parentData.name || 'Unknown', {
                fontSize: '12px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(nameText);

            // Rarity + Generation
            const gen = parentData.generation || 1;
            const infoText = this.add.text(centerX, y + 70, `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} • Gen ${gen}`, {
                fontSize: '9px',
                color: rarityColor
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(infoText);
        } else {
            // Parent not found (may have been released or data lost)
            const portraitY = y + 28;
            const portraitBg = this.add.graphics();
            portraitBg.fillStyle(0x1A1A3E, 0.9);
            portraitBg.fillCircle(centerX, portraitY, portraitRadius + 3);
            portraitBg.lineStyle(2, 0x444444, 0.6);
            portraitBg.strokeCircle(centerX, portraitY, portraitRadius + 3);
            portraitBg.setDepth(12);
            this.elements.push(portraitBg);

            const unknownEmoji = this.add.text(centerX, portraitY, '❓', {
                fontSize: '22px'
            }).setOrigin(0.5).setDepth(13);
            this.elements.push(unknownEmoji);

            const unknownText = this.add.text(centerX, y + 55, 'Unknown', {
                fontSize: '11px',
                color: '#666666'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(unknownText);

            if (parentId) {
                const idText = this.add.text(centerX, y + 70, `ID: ${parentId.slice(-6)}`, {
                    fontSize: '8px',
                    color: '#444444'
                }).setOrigin(0.5).setDepth(12);
                this.elements.push(idText);
            }
        }
    }

    /**
     * Find a creature by ID in the collection
     */
    findCreatureById(id, collection) {
        if (!id || !collection) return null;

        return collection.find(c =>
            c.id === id ||
            c.genes?.id === id ||
            c.dna?.id === id
        );
    }

    createLifecycleSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;
        const centerX = width / 2;

        startY += 25;

        // Section header with cosmic theme
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x1A0A2E, 0.9);
        headerBg.fillRoundedRect(padding, startY, width - padding * 2, 35, 8);
        headerBg.setDepth(11);
        this.elements.push(headerBg);

        const headerText = this.add.text(centerX, startY + 17, '🌌 Cosmic Life Journey', {
            fontSize: this.isMobile ? '14px' : '16px',
            color: '#E6E6FA',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(12);
        this.elements.push(headerText);

        startY += 50;

        // Calculate days alive
        const daysAlive = data.birthDate
            ? Math.floor((Date.now() - data.birthDate) / (1000 * 60 * 60 * 24))
            : 0;

        // CORRECT stage definitions from evolution.json
        const stages = [
            { id: 'baby', icon: '🐣', name: 'Hatchling', days: 0, color: 0xFFB6C1, desc: 'Full of wonder' },
            { id: 'juvenile', icon: '🌱', name: 'Youngling', days: 1, color: 0x98FB98, desc: 'Growing stronger' },
            { id: 'adult', icon: '✨', name: 'Mature', days: 2, color: 0xFFD700, desc: 'Can breed!' },
            { id: 'elder', icon: '👑', name: 'Elder', days: 9, color: 0xE6E6FA, desc: 'Ancient wisdom' }
        ];

        const currentStageIndex = stages.findIndex(s => s.id === data.stage);
        const currentStage = stages[currentStageIndex] || stages[0];

        // Create cosmic spiral visualization
        const spiralCenterX = centerX;
        const spiralCenterY = startY + 80;
        const spiralRadius = this.isMobile ? 70 : 90;

        // Draw cosmic spiral background
        const spiralBg = this.add.graphics();
        for (let ring = 3; ring >= 0; ring--) {
            const ringRadius = spiralRadius + ring * 15;
            const alpha = 0.08 - ring * 0.015;
            spiralBg.fillStyle(0x7B68EE, alpha);
            spiralBg.fillCircle(spiralCenterX, spiralCenterY, ringRadius);
        }
        spiralBg.setDepth(10);
        this.elements.push(spiralBg);

        // Animated orbital particles
        for (let i = 0; i < 8; i++) {
            const particle = this.add.graphics();
            const angle = (i / 8) * Math.PI * 2;
            const orbitRadius = spiralRadius - 10;
            const x = spiralCenterX + Math.cos(angle) * orbitRadius;
            const y = spiralCenterY + Math.sin(angle) * orbitRadius;

            particle.fillStyle(0xFFFFFF, 0.4);
            particle.fillCircle(x, y, 2);
            particle.setDepth(11);
            this.elements.push(particle);

            // Orbit animation
            this.tweens.add({
                targets: particle,
                angle: 360,
                duration: 8000 + i * 500,
                repeat: -1,
                onUpdate: () => {
                    const currentAngle = (angle + (particle.angle * Math.PI / 180)) % (Math.PI * 2);
                    particle.x = spiralCenterX + Math.cos(currentAngle) * orbitRadius - x;
                    particle.y = spiralCenterY + Math.sin(currentAngle) * orbitRadius - y;
                }
            });
        }

        // Current stage display in center
        const stageCircle = this.add.graphics();
        stageCircle.fillStyle(currentStage.color, 0.3);
        stageCircle.fillCircle(spiralCenterX, spiralCenterY, 55);
        stageCircle.fillStyle(currentStage.color, 0.8);
        stageCircle.fillCircle(spiralCenterX, spiralCenterY, 45);
        stageCircle.lineStyle(3, 0xFFFFFF, 0.9);
        stageCircle.strokeCircle(spiralCenterX, spiralCenterY, 45);
        stageCircle.setDepth(12);
        this.elements.push(stageCircle);

        // Pulsing glow animation
        this.tweens.add({
            targets: stageCircle,
            alpha: { from: 1, to: 0.7 },
            duration: 1500,
            yoyo: true,
            repeat: -1
        });

        // Current stage icon (large)
        const currentIcon = this.add.text(spiralCenterX, spiralCenterY - 8, currentStage.icon, {
            fontSize: this.isMobile ? '32px' : '40px'
        }).setOrigin(0.5).setDepth(13);
        this.elements.push(currentIcon);

        // Current stage name
        const currentName = this.add.text(spiralCenterX, spiralCenterY + 25, currentStage.name, {
            fontSize: this.isMobile ? '12px' : '14px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(13);
        this.elements.push(currentName);

        // Stage indicators around the spiral
        stages.forEach((stage, index) => {
            const angle = -Math.PI / 2 + (index / stages.length) * Math.PI * 2;
            const indicatorRadius = spiralRadius + 25;
            const ix = spiralCenterX + Math.cos(angle) * indicatorRadius;
            const iy = spiralCenterY + Math.sin(angle) * indicatorRadius;

            const isActive = index <= currentStageIndex;
            const isCurrent = index === currentStageIndex;

            // Small indicator circle
            const indicator = this.add.graphics();
            if (isCurrent) {
                indicator.fillStyle(0xFFFFFF, 1);
                indicator.fillCircle(ix, iy, 8);
            } else if (isActive) {
                indicator.fillStyle(stage.color, 0.9);
                indicator.fillCircle(ix, iy, 6);
            } else {
                indicator.lineStyle(2, 0x555555, 0.5);
                indicator.strokeCircle(ix, iy, 5);
            }
            indicator.setDepth(14);
            this.elements.push(indicator);

            // Stage label (positioned outward)
            const labelRadius = indicatorRadius + 18;
            const lx = spiralCenterX + Math.cos(angle) * labelRadius;
            const ly = spiralCenterY + Math.sin(angle) * labelRadius;

            const labelColor = isCurrent ? '#FFD700' : (isActive ? '#AAAAAA' : '#555555');
            const label = this.add.text(lx, ly, `Day ${stage.days}`, {
                fontSize: '10px',
                color: labelColor
            }).setOrigin(0.5).setDepth(14);
            this.elements.push(label);
        });

        startY = spiralCenterY + spiralRadius + 45;

        // Age info card
        const cardWidth = width - padding * 2;
        const card = this.add.graphics();
        card.fillStyle(0x1A1A3E, 0.95);
        card.fillRoundedRect(padding, startY, cardWidth, 80, 12);
        card.lineStyle(2, currentStage.color, 0.6);
        card.strokeRoundedRect(padding, startY, cardWidth, 80, 12);
        card.setDepth(11);
        this.elements.push(card);

        // Age display
        const ageText = this.add.text(padding + 20, startY + 20, `${daysAlive}`, {
            fontSize: this.isMobile ? '28px' : '36px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setDepth(12);
        this.elements.push(ageText);

        const daysLabel = this.add.text(padding + 20 + ageText.width + 8, startY + 28, `day${daysAlive !== 1 ? 's' : ''} old`, {
            fontSize: this.isMobile ? '14px' : '16px',
            color: '#AAAAAA'
        }).setDepth(12);
        this.elements.push(daysLabel);

        // Next milestone
        const nextStage = stages[currentStageIndex + 1];
        let milestoneText = '';
        let milestoneColor = '#888888';

        if (nextStage) {
            const daysUntil = Math.max(0, nextStage.days - daysAlive);
            if (daysUntil > 0) {
                milestoneText = `⏳ ${daysUntil} day${daysUntil !== 1 ? 's' : ''} until ${nextStage.name}`;
            } else {
                milestoneText = `✨ Ready to evolve into ${nextStage.name}!`;
                milestoneColor = '#00FF88';
            }
        } else {
            milestoneText = '👑 Achieved Elder wisdom';
            milestoneColor = '#E6E6FA';
        }

        const milestone = this.add.text(padding + 20, startY + 55, milestoneText, {
            fontSize: this.isMobile ? '12px' : '14px',
            color: milestoneColor
        }).setDepth(12);
        this.elements.push(milestone);

        // Total lifespan indicator (small)
        const lifespanDays = 90;
        const lifespanPercent = Math.min(100, Math.round((daysAlive / lifespanDays) * 100));
        const lifespanText = this.add.text(cardWidth + padding - 20, startY + 40, `${lifespanPercent}%\njourney`, {
            fontSize: '11px',
            color: '#666666',
            align: 'right'
        }).setOrigin(1, 0.5).setDepth(12);
        this.elements.push(lifespanText);

        return startY + 100;
    }

    /**
     * DEV ONLY: Create stage testing UI for visualizing lifecycle progression
     */
    createStageTestingUI(data, startY, padding, width) {
        startY += 10;

        // Section header
        const devHeader = this.add.text(padding, startY, '🧪 DEV: Stage Testing', {
            fontSize: '14px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setDepth(11);
        this.elements.push(devHeader);

        startY += 30;

        const stages = ['baby', 'juvenile', 'adult', 'elder'];
        const stageInfo = {
            baby: { icon: '🐣', label: 'Baby', color: 0x90EE90 },
            juvenile: { icon: '🌱', label: 'Juvenile', color: 0x87CEEB },
            adult: { icon: '✨', label: 'Adult', color: 0x9370DB },
            elder: { icon: '👑', label: 'Elder', color: 0xFFD700 }
        };

        const buttonWidth = (width - padding * 2 - 30) / 4;
        const currentStage = data.stage || 'baby';

        stages.forEach((stage, index) => {
            const x = padding + index * (buttonWidth + 10);
            const info = stageInfo[stage];
            const isActive = stage === currentStage;

            // Button background
            const btnBg = this.add.graphics();
            btnBg.fillStyle(isActive ? info.color : 0x2A2A4E, isActive ? 1 : 0.5);
            btnBg.fillRoundedRect(x, startY, buttonWidth, 50, 8);
            if (isActive) {
                btnBg.lineStyle(2, 0xFFD700, 1);
                btnBg.strokeRoundedRect(x, startY, buttonWidth, 50, 8);
            }
            btnBg.setDepth(11);
            this.elements.push(btnBg);

            // Icon and label
            const btnText = this.add.text(x + buttonWidth / 2, startY + 15, info.icon, {
                fontSize: '20px'
            }).setOrigin(0.5, 0).setDepth(12);
            this.elements.push(btnText);

            const btnLabel = this.add.text(x + buttonWidth / 2, startY + 32, info.label, {
                fontSize: '10px',
                color: isActive ? '#FFFFFF' : '#888888'
            }).setOrigin(0.5, 0).setDepth(12);
            this.elements.push(btnLabel);

            // Make interactive
            const hitZone = this.add.zone(x, startY, buttonWidth, 50);
            hitZone.setInteractive({ useHandCursor: true });
            hitZone.setDepth(13);

            hitZone.on('pointerdown', () => {
                // Prevent double-clicks during restart
                if (this.isRestarting) return;
                this.isRestarting = true;

                console.log(`[CreatureProfileScene] DEV: Changing stage to ${stage}`);

                // Play sound immediately for feedback
                if (window.AudioManager) {
                    window.AudioManager.playButtonClick();
                }

                // Calculate birth date for this stage
                const stageDays = { baby: 0, juvenile: 1, adult: 3, elder: 10 };
                const daysNeeded = stageDays[stage] || 0;
                const newBirthDate = Date.now() - (daysNeeded * 24 * 60 * 60 * 1000);

                // Update active creature's GameState
                window.GameState?.set('creature.lifecycle.stage', stage);
                window.GameState?.set('creature.lifecycle.birthDate', newBirthDate);
                window.GameState?.set('creature.lifecycle.lastStageChange', Date.now());

                // Update visual days (approximate for each stage)
                const visualDays = { baby: 1, juvenile: 4, adult: 10, elder: 35 };
                window.GameState?.set('creature.lifecycle.daysAlive', visualDays[stage]);

                // Clear cached texture to force regeneration
                window.GameState?.set('creature.textureName', null);

                // CRITICAL: Also sync to creatures collection for breeding system
                const activeCreatureId = window.GameState?.get('creature.genes.id') ||
                                         window.GameState?.get('creature.dna.id');
                const collection = window.GameState?.get('creatures') || [];

                if (activeCreatureId && collection.length > 0) {
                    // Find and update the creature in collection
                    const creatureIndex = collection.findIndex(c =>
                        c.id === activeCreatureId ||
                        c.genes?.id === activeCreatureId ||
                        c.dna?.id === activeCreatureId
                    );

                    if (creatureIndex >= 0) {
                        // Update lifecycle in collection
                        if (!collection[creatureIndex].lifecycle) {
                            collection[creatureIndex].lifecycle = { evolutionHistory: [] };
                        }
                        collection[creatureIndex].lifecycle.stage = stage;
                        collection[creatureIndex].lifecycle.birthDate = newBirthDate;
                        collection[creatureIndex].lifecycle.lastStageChange = Date.now();

                        window.GameState?.set('creatures', collection);
                        console.log(`[CreatureProfileScene] DEV: Synced stage to collection creature at index ${creatureIndex}`);
                    }
                }

                // Save and restart
                window.GameState?.save?.();

                // Slight delay to prevent sticky pointer state, then restart
                this.time.delayedCall(50, () => {
                    this.scene.restart();
                });
            });

            // Hover effects
            hitZone.on('pointerover', () => {
                btnBg.clear();
                btnBg.fillStyle(info.color, 0.8);
                btnBg.fillRoundedRect(x, startY, buttonWidth, 50, 8);
                btnLabel.setColor('#FFFFFF');
            });

            hitZone.on('pointerout', () => {
                btnBg.clear();
                btnBg.fillStyle(isActive ? info.color : 0x2A2A4E, isActive ? 1 : 0.5);
                btnBg.fillRoundedRect(x, startY, buttonWidth, 50, 8);
                if (isActive) {
                    btnBg.lineStyle(2, 0xFFD700, 1);
                    btnBg.strokeRoundedRect(x, startY, buttonWidth, 50, 8);
                }
                btnLabel.setColor(isActive ? '#FFFFFF' : '#888888');
            });

            this.elements.push(hitZone);
        });

        startY += 60;

        // Info text
        const infoText = this.add.text(padding, startY,
            'Click a stage to see how your creature looks at that age.\nThe creature will update in the main game.',
            {
                fontSize: '10px',
                color: '#888888',
                align: 'center',
                wordWrap: { width: width - padding * 2 }
            }
        ).setDepth(11);
        this.elements.push(infoText);

        return startY + 35;
    }

    createStatsSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        startY += 20;

        const header = this.createSectionHeader('Stats', startY);
        startY = header.y + 30;

        const stats = [
            { key: 'health', label: 'Health', color: 0xFF6B6B, icon: '❤️' },
            { key: 'happiness', label: 'Happiness', color: 0xFFD93D, icon: '😊' },
            { key: 'energy', label: 'Energy', color: 0x6BCB77, icon: '⚡' }
        ];

        stats.forEach((stat, index) => {
            const y = startY + index * 40;
            const value = data.stats[stat.key] || 0;

            // Label
            const label = this.add.text(padding, y, `${stat.icon} ${stat.label}`, {
                fontSize: this.isMobile ? '14px' : '16px',
                color: '#FFFFFF'
            }).setDepth(11);
            this.elements.push(label);

            // Bar
            const barX = padding + 120;
            const barWidth = width - barX - padding - 50;
            const barHeight = 12;

            const barBg = this.add.graphics();
            barBg.fillStyle(0x2A2A4E, 1);
            barBg.fillRoundedRect(barX, y + 2, barWidth, barHeight, 6);
            barBg.setDepth(11);
            this.elements.push(barBg);

            const barFill = this.add.graphics();
            barFill.fillStyle(stat.color, 1);
            barFill.fillRoundedRect(barX, y + 2, barWidth * (value / 100), barHeight, 6);
            barFill.setDepth(12);
            this.elements.push(barFill);

            // Value
            const valueText = this.add.text(width - padding, y + 2, `${Math.round(value)}%`, {
                fontSize: '14px',
                color: '#FFFFFF'
            }).setOrigin(1, 0).setDepth(11);
            this.elements.push(valueText);
        });

        return startY + stats.length * 40 + 10;
    }

    /**
     * Create bond/relationship section
     */
    createBondSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        // Get bond data
        const bond = data.bond;
        if (!bond) {
            return startY;
        }

        startY += 20;

        const header = this.createSectionHeader('Relationship', startY);
        startY = header.y + 30;

        // Bond level with title
        const levelTitle = bond.description?.title || 'Stranger';
        const bondHeader = this.add.text(padding, startY, `💜 Bond Level ${bond.level}: ${levelTitle}`, {
            fontSize: this.isMobile ? '16px' : '18px',
            fontFamily: 'Arial, sans-serif',
            color: '#E040FB',
            fontStyle: 'bold'
        }).setDepth(11);
        this.elements.push(bondHeader);

        startY += 30;

        // Progress bar to next level
        const barX = padding;
        const barWidth = width - padding * 2;
        const barHeight = 16;

        const barBg = this.add.graphics();
        barBg.fillStyle(0x2A2A4E, 1);
        barBg.fillRoundedRect(barX, startY, barWidth, barHeight, 8);
        barBg.setDepth(11);
        this.elements.push(barBg);

        const progressPercent = bond.progressPercent / 100;
        const barFill = this.add.graphics();
        barFill.fillStyle(0xE040FB, 1);
        barFill.fillRoundedRect(barX, startY, barWidth * progressPercent, barHeight, 8);
        barFill.setDepth(12);
        this.elements.push(barFill);

        // XP text
        const xpText = this.add.text(width / 2, startY + barHeight / 2,
            `${bond.xpInCurrentLevel} / ${bond.xpPerLevel} XP`, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(13);
        this.elements.push(xpText);

        startY += 30;

        // Current perk
        if (bond.description?.perk) {
            const perkText = this.add.text(padding, startY, `✨ ${bond.description.perk}`, {
                fontSize: this.isMobile ? '13px' : '14px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFD700'
            }).setDepth(11);
            this.elements.push(perkText);
            startY += 25;
        }

        // Statistics grid
        startY += 10;
        const statItems = [
            { icon: '🤲', label: 'Care Actions', value: bond.careActions || 0 },
            { icon: '💬', label: 'Conversations', value: bond.conversations || 0 },
            { icon: '🏆', label: 'Levels Completed', value: bond.levelsCompleted || 0 },
            { icon: '🎯', label: 'Total Interactions', value: bond.totalInteractions || 0 }
        ];

        const colWidth = (width - padding * 2) / 2;
        statItems.forEach((stat, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = padding + col * colWidth;
            const y = startY + row * 28;

            const statText = this.add.text(x, y, `${stat.icon} ${stat.label}: ${stat.value}`, {
                fontSize: this.isMobile ? '12px' : '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#AAAAAA'
            }).setDepth(11);
            this.elements.push(statText);
        });

        startY += 60;

        // Ability slots status
        const slots = bond.abilitySlots || { slot1: true, slot2: false, slot3: false };
        const slotText = this.add.text(padding, startY, '⚔️ Ability Slots:', {
            fontSize: this.isMobile ? '14px' : '15px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
        }).setDepth(11);
        this.elements.push(slotText);

        // Slot indicators
        const slotStartX = padding + slotText.width + 15;
        for (let i = 1; i <= 3; i++) {
            const slotKey = `slot${i}`;
            const isUnlocked = slots[slotKey];
            const slotX = slotStartX + (i - 1) * 35;

            const slotBg = this.add.graphics();
            slotBg.fillStyle(isUnlocked ? 0x7B68EE : 0x333333, 1);
            slotBg.fillRoundedRect(slotX, startY - 2, 28, 28, 6);
            slotBg.lineStyle(2, isUnlocked ? 0xFFD700 : 0x555555, 1);
            slotBg.strokeRoundedRect(slotX, startY - 2, 28, 28, 6);
            slotBg.setDepth(11);
            this.elements.push(slotBg);

            const slotIcon = this.add.text(slotX + 14, startY + 12,
                isUnlocked ? i.toString() : '🔒', {
                fontSize: isUnlocked ? '14px' : '12px',
                color: '#FFFFFF'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(slotIcon);
        }

        // Unlock hints
        startY += 35;
        if (!slots.slot2) {
            const hint = this.add.text(padding, startY, '🔒 Slot 2 unlocks at Bond Level 5', {
                fontSize: '11px',
                color: '#888888'
            }).setDepth(11);
            this.elements.push(hint);
            startY += 18;
        }
        if (!slots.slot3) {
            const hint = this.add.text(padding, startY, '🔒 Slot 3 unlocks at Bond Level 10', {
                fontSize: '11px',
                color: '#888888'
            }).setDepth(11);
            this.elements.push(hint);
            startY += 18;
        }

        return startY + 10;
    }

    createPersonalitySection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        if (!data.personality && !data.personalityState) {
            return startY;
        }

        startY += 20;

        const header = this.createSectionHeader('Personality', startY);
        startY = header.y + 30;

        // Core personality trait
        const coreTrait = data.personality?.core || data.personalityState?.coreTrait || 'Unknown';
        const traitText = this.add.text(padding, startY, `Core Trait: ${this.capitalizeFirst(coreTrait)}`, {
            fontSize: this.isMobile ? '16px' : '18px',
            color: '#FFD700'
        }).setDepth(11);
        this.elements.push(traitText);

        startY += 30;

        // Personality attributes (if available)
        const attributes = data.personality?.attributes || data.personalityState?.attributes;
        if (attributes) {
            const attrKeys = Object.keys(attributes).slice(0, 4);
            attrKeys.forEach((key, index) => {
                const value = attributes[key];
                const attrText = this.add.text(padding, startY + index * 22,
                    `• ${this.capitalizeFirst(key)}: ${Math.round(value * 100)}%`, {
                    fontSize: '14px',
                    color: '#AAAAAA'
                }).setDepth(11);
                this.elements.push(attrText);
            });
            startY += attrKeys.length * 22;
        }

        return startY + 10;
    }

    createEvolutionHistorySection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        const history = data.evolutionHistory || [];
        if (history.length === 0) {
            return startY;
        }

        startY += 20;

        const header = this.createSectionHeader('Evolution History', startY);
        startY = header.y + 30;

        history.forEach((evolution, index) => {
            const date = new Date(evolution.timestamp);
            const dateStr = date.toLocaleDateString();
            const fromIcon = evolutionConfig.stages[evolution.from]?.icon || '?';
            const toIcon = evolutionConfig.stages[evolution.to]?.icon || '?';

            const historyText = this.add.text(padding, startY + index * 25,
                `${fromIcon} → ${toIcon}  ${this.capitalizeFirst(evolution.from)} to ${this.capitalizeFirst(evolution.to)} (${dateStr})`, {
                fontSize: '14px',
                color: '#AAAAAA'
            }).setDepth(11);
            this.elements.push(historyText);
        });

        return startY + history.length * 25 + 20;
    }

    /**
     * Create release creature section - allows player to release creature to make room
     * Only shows if player has more than 1 creature
     */
    createReleaseSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        // Only show if more than 1 creature in collection
        const collection = window.GameState?.get('creatures') || [];
        if (collection.length <= 1) {
            return startY;
        }

        startY += 30;

        const header = this.createSectionHeader('Manage Creature', startY);
        startY = header.y + 30;

        // Warning text
        const warning = this.add.text(width / 2, startY,
            '⚠️ Releasing a creature is permanent and cannot be undone.', {
            fontSize: '12px',
            color: '#FF6666',
            align: 'center',
            wordWrap: { width: width - padding * 2 }
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(warning);

        startY += 35;

        // Release button
        const btnWidth = this.isMobile ? 180 : 200;
        const btnHeight = 40;
        const btnX = width / 2 - btnWidth / 2;

        const releaseBtn = this.add.graphics();
        releaseBtn.fillStyle(0x8B0000, 0.9);
        releaseBtn.fillRoundedRect(btnX, startY, btnWidth, btnHeight, 10);
        releaseBtn.lineStyle(2, 0xFF4444);
        releaseBtn.strokeRoundedRect(btnX, startY, btnWidth, btnHeight, 10);
        releaseBtn.setDepth(11);
        this.elements.push(releaseBtn);

        const btnLabel = this.add.text(width / 2, startY + btnHeight / 2, '🕊️ Release Creature', {
            fontSize: '14px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(12);
        this.elements.push(btnLabel);

        const hitZone = this.add.zone(btnX, startY, btnWidth, btnHeight).setOrigin(0, 0);
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.setDepth(13);

        hitZone.on('pointerdown', () => {
            this.showReleaseConfirmation(data);
        });

        hitZone.on('pointerover', () => {
            releaseBtn.clear();
            releaseBtn.fillStyle(0xAA0000, 1);
            releaseBtn.fillRoundedRect(btnX, startY, btnWidth, btnHeight, 10);
            releaseBtn.lineStyle(3, 0xFF6666);
            releaseBtn.strokeRoundedRect(btnX, startY, btnWidth, btnHeight, 10);
        });

        hitZone.on('pointerout', () => {
            releaseBtn.clear();
            releaseBtn.fillStyle(0x8B0000, 0.9);
            releaseBtn.fillRoundedRect(btnX, startY, btnWidth, btnHeight, 10);
            releaseBtn.lineStyle(2, 0xFF4444);
            releaseBtn.strokeRoundedRect(btnX, startY, btnWidth, btnHeight, 10);
        });

        this.elements.push(hitZone);

        startY += btnHeight + 20;

        // Collection status
        const statusText = this.add.text(width / 2, startY,
            `Collection: ${collection.length}/8 creatures`, {
            fontSize: '12px',
            color: '#888888'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(statusText);

        return startY + 30;
    }

    /**
     * Show release confirmation dialog
     */
    showReleaseConfirmation(data) {
        const { width, height } = this.scale;
        const isMobile = this.isMobile;

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Create overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        // Create confirmation panel
        const panelWidth = isMobile ? width * 0.95 : 420;
        const panelHeight = isMobile ? 320 : 300;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(4, 0xFF4444);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setDepth(201);

        // Title
        const title = this.add.text(width / 2, panelY + 35, '🕊️ Release Creature?', {
            fontSize: isMobile ? '20px' : '24px',
            color: '#FF6666',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Warning message
        const warningText = this.add.text(width / 2, panelY + 85,
            `Are you sure you want to release\n"${data.name}"?\n\nThis action cannot be undone!`, {
            fontSize: isMobile ? '14px' : '16px',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        // Creature info
        const rarityColor = this.getRarityColorHex(data.rarity);
        const infoText = this.add.text(width / 2, panelY + 160,
            `${this.capitalizeFirst(data.rarity)} ${data.species}\nGeneration ${data.generation || 1}`, {
            fontSize: '12px',
            color: rarityColor,
            align: 'center'
        }).setOrigin(0.5).setDepth(202);

        // Buttons
        const btnWidth = 100;
        const btnHeight = 40;
        const btnSpacing = 20;
        const btnY = panelY + panelHeight - 70;

        // Cancel button
        const cancelBtnX = width / 2 - btnWidth - btnSpacing / 2;
        const cancelBtn = this.add.graphics();
        cancelBtn.fillStyle(0x4B0082, 1);
        cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        cancelBtn.lineStyle(2, 0x7B68EE);
        cancelBtn.strokeRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        cancelBtn.setDepth(202);

        const cancelLabel = this.add.text(cancelBtnX + btnWidth / 2, btnY + btnHeight / 2, 'Cancel', {
            fontSize: '14px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(203);

        const cancelZone = this.add.zone(cancelBtnX, btnY, btnWidth, btnHeight).setOrigin(0, 0);
        cancelZone.setInteractive({ useHandCursor: true });
        cancelZone.setDepth(210);

        // Release button
        const releaseBtnX = width / 2 + btnSpacing / 2;
        const releaseBtn = this.add.graphics();
        releaseBtn.fillStyle(0x8B0000, 1);
        releaseBtn.fillRoundedRect(releaseBtnX, btnY, btnWidth, btnHeight, 10);
        releaseBtn.lineStyle(2, 0xFF4444);
        releaseBtn.strokeRoundedRect(releaseBtnX, btnY, btnWidth, btnHeight, 10);
        releaseBtn.setDepth(202);

        const releaseLabel = this.add.text(releaseBtnX + btnWidth / 2, btnY + btnHeight / 2, 'Release', {
            fontSize: '14px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(203);

        const releaseZone = this.add.zone(releaseBtnX, btnY, btnWidth, btnHeight).setOrigin(0, 0);
        releaseZone.setInteractive({ useHandCursor: true });
        releaseZone.setDepth(210);

        const dialogElements = [overlay, panel, title, warningText, infoText,
            cancelBtn, cancelLabel, cancelZone, releaseBtn, releaseLabel, releaseZone];

        // Cancel handler
        cancelZone.on('pointerdown', () => {
            if (window.AudioManager) {
                window.AudioManager.playButtonClick();
            }
            dialogElements.forEach(el => el.destroy());
        });

        // Release handler
        releaseZone.on('pointerdown', () => {
            this.executeRelease(data, dialogElements);
        });

        // Hover effects
        cancelZone.on('pointerover', () => {
            cancelBtn.clear();
            cancelBtn.fillStyle(0x6B00B3, 1);
            cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
            cancelBtn.lineStyle(3, 0x9B68EE);
            cancelBtn.strokeRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        });

        cancelZone.on('pointerout', () => {
            cancelBtn.clear();
            cancelBtn.fillStyle(0x4B0082, 1);
            cancelBtn.fillRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
            cancelBtn.lineStyle(2, 0x7B68EE);
            cancelBtn.strokeRoundedRect(cancelBtnX, btnY, btnWidth, btnHeight, 10);
        });

        releaseZone.on('pointerover', () => {
            releaseBtn.clear();
            releaseBtn.fillStyle(0xAA0000, 1);
            releaseBtn.fillRoundedRect(releaseBtnX, btnY, btnWidth, btnHeight, 10);
            releaseBtn.lineStyle(3, 0xFF6666);
            releaseBtn.strokeRoundedRect(releaseBtnX, btnY, btnWidth, btnHeight, 10);
        });

        releaseZone.on('pointerout', () => {
            releaseBtn.clear();
            releaseBtn.fillStyle(0x8B0000, 1);
            releaseBtn.fillRoundedRect(releaseBtnX, btnY, btnWidth, btnHeight, 10);
            releaseBtn.lineStyle(2, 0xFF4444);
            releaseBtn.strokeRoundedRect(releaseBtnX, btnY, btnWidth, btnHeight, 10);
        });

        // ESC to cancel
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                dialogElements.forEach(el => el.destroy());
                this.input.keyboard.off('keydown', escHandler);
            }
        };
        this.input.keyboard?.on('keydown', escHandler);
    }

    /**
     * Execute the creature release
     */
    executeRelease(data, dialogElements) {
        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        // Find creature index in collection
        const collection = window.GameState?.get('creatures') || [];
        const creatureIndex = collection.findIndex(c =>
            c.id === data.id ||
            c.genes?.id === data.id ||
            c.dna?.id === data.id
        );

        if (creatureIndex === -1) {
            console.error('[CreatureProfileScene] Creature not found in collection');
            dialogElements.forEach(el => el.destroy());
            return;
        }

        // Remove creature from collection
        const result = window.GameState?.removeCreatureFromCollection(creatureIndex);

        if (result) {
            console.log(`[CreatureProfileScene] Released creature "${result.name}"`);

            // Clean up dialog
            dialogElements.forEach(el => el.destroy());

            // Show dramatic farewell scene
            this.showReleaseFarewell(result.name, data);
        } else {
            console.error('[CreatureProfileScene] Failed to release creature');
            dialogElements.forEach(el => el.destroy());
        }
    }

    /**
     * Show dramatic farewell scene after releasing creature
     * This is emotional and makes it clear the creature is GONE FOREVER
     */
    showReleaseFarewell(creatureName, creatureData) {
        const { width, height } = this.scale;

        // Play sad/melancholic farewell music
        this.playSadFarewellSound();

        // Dark overlay with slow fade in
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        this.tweens.add({
            targets: overlay,
            fillAlpha: 0.95,
            duration: 1500
        });

        // Create creature sprite one last time (centered, large)
        let creatureSprite = null;
        const textureKey = creatureData?.textureName || window.GameState?.get('creature.textureName');
        if (textureKey && this.textures.exists(textureKey)) {
            creatureSprite = this.add.sprite(width / 2, height * 0.35, textureKey);
            creatureSprite.setScale(2.5);
            creatureSprite.setDepth(201);
            creatureSprite.setAlpha(0);

            // Fade in creature
            this.tweens.add({
                targets: creatureSprite,
                alpha: 1,
                duration: 1000,
                delay: 500
            });
        }

        // Main farewell text - appears after creature
        const farewellText = this.add.text(width / 2, height * 0.55, `Farewell, ${creatureName}...`, {
            fontSize: this.isMobile ? '28px' : '36px',
            color: '#B0C4DE',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(201).setAlpha(0);

        this.tweens.add({
            targets: farewellText,
            alpha: 1,
            duration: 1500,
            delay: 1500
        });

        // Emotional sub-messages that appear sequentially
        const messages = [
            { text: 'They will return to the cosmic void...', delay: 3000 },
            { text: 'Carrying the memories of your time together.', delay: 4500 },
            { text: '💔 This farewell is forever.', delay: 6000, color: '#FF6B6B' },
            { text: 'May the stars guide their eternal journey.', delay: 7500 }
        ];

        const messageElements = [];

        messages.forEach((msg, index) => {
            const msgText = this.add.text(width / 2, height * 0.65 + index * 35, msg.text, {
                fontSize: '16px',
                color: msg.color || '#888888',
                fontStyle: msg.color ? 'bold' : 'normal'
            }).setOrigin(0.5).setDepth(201).setAlpha(0);

            messageElements.push(msgText);

            this.tweens.add({
                targets: msgText,
                alpha: 1,
                duration: 1000,
                delay: msg.delay
            });
        });

        // Create floating particles rising upward (soul leaving)
        this.time.delayedCall(2000, () => {
            this.createFarewellParticles(width / 2, height * 0.35);
        });

        // Creature slowly floats up and fades (ascending to cosmos)
        if (creatureSprite) {
            this.tweens.add({
                targets: creatureSprite,
                y: -100,
                alpha: 0,
                scale: 0.5,
                duration: 5000,
                delay: 4000,
                ease: 'Sine.easeIn'
            });
        }

        // Final message and transition
        const finalMessage = this.add.text(width / 2, height * 0.85,
            '🕊️ Touch anywhere to continue...', {
            fontSize: '14px',
            color: '#666666'
        }).setOrigin(0.5).setDepth(201).setAlpha(0);

        this.tweens.add({
            targets: finalMessage,
            alpha: 1,
            duration: 1000,
            delay: 9000
        });

        // Allow tap to continue after the emotional moment
        this.time.delayedCall(9000, () => {
            const exitZone = this.add.zone(0, 0, width, height).setOrigin(0, 0);
            exitZone.setInteractive();
            exitZone.setDepth(250);

            exitZone.once('pointerdown', () => {
                // Final sound
                if (window.AudioManager) {
                    window.AudioManager.playButtonClick();
                }

                // Fade everything out
                this.tweens.add({
                    targets: [overlay, farewellText, finalMessage, creatureSprite, ...messageElements],
                    alpha: 0,
                    duration: 1500,
                    onComplete: () => {
                        this.scene.start('GameScene');
                    }
                });
            });
        });
    }

    /**
     * Play sad/melancholic farewell sound sequence
     */
    playSadFarewellSound() {
        if (!window.AudioManager?.audioContext) return;

        const ctx = window.AudioManager.audioContext;
        const now = ctx.currentTime;

        // Sad descending melody (minor key)
        const notes = [
            { freq: 440, time: 0, duration: 0.8 },      // A4
            { freq: 392, time: 0.9, duration: 0.8 },    // G4
            { freq: 349, time: 1.8, duration: 0.8 },    // F4
            { freq: 330, time: 2.7, duration: 1.2 },    // E4 (held)
            { freq: 294, time: 4.0, duration: 1.5 },    // D4 (final, fading)
        ];

        notes.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = note.freq;

            gain.gain.setValueAtTime(0, now + note.time);
            gain.gain.linearRampToValueAtTime(0.15, now + note.time + 0.1);
            gain.gain.linearRampToValueAtTime(0, now + note.time + note.duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + note.time);
            osc.stop(now + note.time + note.duration + 0.1);
        });
    }

    /**
     * Create ascending farewell particles (soul leaving)
     */
    createFarewellParticles(x, y) {
        const colors = [0xB0C4DE, 0x87CEEB, 0xE6E6FA, 0xFFFFFF, 0xDDA0DD];

        for (let i = 0; i < 20; i++) {
            const particle = this.add.graphics();
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 2 + Math.random() * 4;

            particle.fillStyle(color, 0.8);
            particle.fillCircle(0, 0, size);

            particle.setPosition(
                x + (Math.random() - 0.5) * 100,
                y + (Math.random() - 0.5) * 50
            );
            particle.setDepth(202);
            particle.setAlpha(0);

            // Fade in, float up, fade out
            this.tweens.add({
                targets: particle,
                alpha: { from: 0, to: 0.8 },
                y: particle.y - 200 - Math.random() * 150,
                x: particle.x + (Math.random() - 0.5) * 80,
                duration: 3000 + Math.random() * 2000,
                delay: Math.random() * 2000,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: particle,
                        alpha: 0,
                        duration: 1000,
                        onComplete: () => particle.destroy()
                    });
                }
            });
        }
    }

    /**
     * Create dev tools section for testing (only visible in dev mode)
     * Allows quick age advancement for breeding testing
     */
    createDevToolsSection(data, startY) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        startY += 30;

        // Header with warning styling
        const header = this.add.text(width / 2, startY, '🔧 DEV TOOLS', {
            fontSize: '16px',
            color: '#FF6B6B',
            fontStyle: 'bold',
            backgroundColor: '#2A1A1A',
            padding: { x: 15, y: 5 }
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(header);

        startY += 40;

        // Current stage display
        const currentStage = data.lifecycle?.stage || 'unknown';
        const stageText = this.add.text(width / 2, startY, `Current Stage: ${currentStage.toUpperCase()}`, {
            fontSize: '14px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(stageText);

        startY += 30;

        // Age buttons
        const stages = ['baby', 'juvenile', 'adult', 'elder'];
        const buttonWidth = 70;
        const buttonSpacing = 10;
        const totalWidth = (buttonWidth * 4) + (buttonSpacing * 3);
        let buttonX = (width - totalWidth) / 2;

        stages.forEach(stage => {
            const isCurrentStage = stage === currentStage;
            const buttonColor = isCurrentStage ? 0x228B22 : 0x4A4A6E;
            const textColor = isCurrentStage ? '#00FF00' : '#FFFFFF';

            const btn = this.add.graphics();
            btn.fillStyle(buttonColor, 0.9);
            btn.fillRoundedRect(buttonX, startY, buttonWidth, 35, 8);
            btn.lineStyle(2, isCurrentStage ? 0x00FF00 : 0x7B68EE, 0.8);
            btn.strokeRoundedRect(buttonX, startY, buttonWidth, 35, 8);
            btn.setDepth(11);
            this.elements.push(btn);

            const btnText = this.add.text(buttonX + buttonWidth / 2, startY + 17, stage.charAt(0).toUpperCase() + stage.slice(1), {
                fontSize: '12px',
                color: textColor,
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(btnText);

            // Make interactive
            const hitZone = this.add.zone(buttonX + buttonWidth / 2, startY + 17, buttonWidth, 35);
            hitZone.setInteractive({ useHandCursor: true });
            hitZone.setDepth(13);

            hitZone.on('pointerdown', () => {
                if (window.DevTools) {
                    window.DevTools.ageCreature(stage);
                    // Play feedback sound
                    window.AudioManager?.playButtonClick?.();
                    // Refresh the profile
                    this.scene.restart();
                }
            });

            hitZone.on('pointerover', () => {
                btn.clear();
                btn.fillStyle(0x6B6B9E, 0.9);
                btn.fillRoundedRect(buttonX, startY, buttonWidth, 35, 8);
                btn.lineStyle(2, 0xFFD700, 1);
                btn.strokeRoundedRect(buttonX, startY, buttonWidth, 35, 8);
            });

            hitZone.on('pointerout', () => {
                btn.clear();
                btn.fillStyle(buttonColor, 0.9);
                btn.fillRoundedRect(buttonX, startY, buttonWidth, 35, 8);
                btn.lineStyle(2, isCurrentStage ? 0x00FF00 : 0x7B68EE, 0.8);
                btn.strokeRoundedRect(buttonX, startY, buttonWidth, 35, 8);
            });

            this.elements.push(hitZone);
            buttonX += buttonWidth + buttonSpacing;
        });

        startY += 55;

        // Additional dev buttons row
        const devActions = [
            { label: '➕ Add Test Creature', action: () => window.DevTools?.addTestCreature() },
            { label: '⏭️ Skip 7 Days', action: () => window.DevTools?.skipDays(7) },
            { label: '🧪 Setup Breeding', action: () => window.DevTools?.setupBreedingTest() }
        ];

        const actionBtnWidth = (width - padding * 2 - 20) / 3;
        let actionX = padding;

        devActions.forEach(action => {
            const actionBtn = this.add.graphics();
            actionBtn.fillStyle(0x1A3A5C, 0.9);
            actionBtn.fillRoundedRect(actionX, startY, actionBtnWidth, 30, 6);
            actionBtn.lineStyle(1, 0x4ECDC4, 0.6);
            actionBtn.strokeRoundedRect(actionX, startY, actionBtnWidth, 30, 6);
            actionBtn.setDepth(11);
            this.elements.push(actionBtn);

            const actionText = this.add.text(actionX + actionBtnWidth / 2, startY + 15, action.label, {
                fontSize: '11px',
                color: '#4ECDC4'
            }).setOrigin(0.5).setDepth(12);
            this.elements.push(actionText);

            const actionZone = this.add.zone(actionX + actionBtnWidth / 2, startY + 15, actionBtnWidth, 30);
            actionZone.setInteractive({ useHandCursor: true });
            actionZone.setDepth(13);

            actionZone.on('pointerdown', () => {
                action.action();
                window.AudioManager?.playButtonClick?.();
                // Show feedback
                actionText.setColor('#FFD700');
                this.time.delayedCall(200, () => {
                    actionText.setColor('#4ECDC4');
                });
            });

            this.elements.push(actionZone);
            actionX += actionBtnWidth + 10;
        });

        startY += 50;

        // Info text
        const infoText = this.add.text(width / 2, startY, 'Dev tools only visible in development mode', {
            fontSize: '10px',
            color: '#666666'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(infoText);

        return startY + 30;
    }

    createSectionHeader(title, y) {
        const { width } = this.scale;
        const padding = this.isMobile ? 16 : 24;

        // Line before title
        const line = this.add.graphics();
        line.lineStyle(1, 0x7B68EE, 0.5);
        line.lineBetween(padding, y, width - padding, y);
        line.setDepth(11);
        this.elements.push(line);

        // Title
        const header = this.add.text(padding, y + 10, title, {
            fontSize: this.isMobile ? '16px' : '18px',
            color: '#7B68EE',
            fontStyle: 'bold'
        }).setDepth(11);
        this.elements.push(header);

        return { y: y + 10, text: header };
    }

    createInfoItem(x, y, item) {
        const bg = this.add.graphics();
        bg.fillStyle(0x2A2A4E, 0.5);
        bg.fillRoundedRect(x - 50, y - 15, 100, 40, 8);
        bg.setDepth(10);
        this.elements.push(bg);

        const icon = this.add.text(x, y - 5, item.icon, {
            fontSize: '16px'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(icon);

        const value = this.add.text(x, y + 12, item.value, {
            fontSize: '12px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(11);
        this.elements.push(value);
    }

    showNoCreatureMessage() {
        const { width, height } = this.scale;

        const message = this.add.text(width / 2, height / 2, 'No creature hatched yet!', {
            fontSize: '20px',
            color: '#AAAAAA'
        }).setOrigin(0.5);
        this.elements.push(message);
    }

    setupInput() {
        // Touch/mouse scroll
        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown && this.maxScroll > 0) {
                const dy = pointer.prevPosition.y - pointer.y;
                this.scrollY = Phaser.Math.Clamp(this.scrollY + dy, 0, this.maxScroll);
                this.updateScroll();
            }
        });

        // Mouse wheel
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            if (this.maxScroll > 0) {
                this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScroll);
                this.updateScroll();
            }
        });
    }

    updateScroll() {
        // Update positions of scrollable elements
        // For now, keep it simple - could add smooth scrolling later
    }

    goBack() {
        if (window.AudioManager) {
            window.AudioManager.playButtonClick();
        }

        const resumeSanctuary = this.scene.isPaused?.('GameScene') === true;
        SceneTransitionHelper.stopScene(this, 'CreatureProfileScene');
        if (resumeSanctuary) {
            SceneTransitionHelper.resumeScene(this, 'GameScene');
            return;
        }
        this.scene.start('GameScene');
    }

    // Utility methods
    getRarityColor(rarity) {
        const colors = {
            common: 0x808080,
            uncommon: 0x1EFF00,
            rare: 0x0070DD,
            epic: 0xA335EE,
            legendary: 0xFF8000,
            mythic: 0xFF00FF,
            secret: 0x00FFFF
        };
        return colors[rarity] || colors.common;
    }

    getRarityColorHex(rarity) {
        const colors = {
            common: '#808080',
            uncommon: '#1EFF00',
            rare: '#0070DD',
            epic: '#A335EE',
            legendary: '#FF8000',
            mythic: '#FF00FF',
            secret: '#00FFFF'
        };
        return colors[rarity] || colors.common;
    }

    getMoodIcon(mood) {
        const icons = {
            happy: '😊',
            neutral: '😐',
            sad: '😢',
            abandoned: '😞'
        };
        return icons[mood] || '😊';
    }

    getAffinityIcon(element) {
        const icons = {
            star: '⭐',
            moon: '🌙',
            nebula: '🌌',
            crystal: '💎',
            void: '🕳️'
        };
        return icons[element] || '✨';
    }

    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    shutdown() {
        console.log('[CreatureProfileScene] Shutting down');
        this.profilePortraitRequest += 1;
        this.profilePortraitUnsubscribe?.();
        this.profilePortraitUnsubscribe = null;

        // Remove keyboard listeners
        if (this.input?.keyboard) {
            this.input.keyboard.off('keydown-ESC');
            this.input.keyboard.off('keydown-P');
        }

        // Remove input listeners
        if (this.input) {
            this.input.off('pointermove');
            this.input.off('wheel');
        }

        // Clear tweens
        this.tweens?.killAll();
        this.identityArchiveModal?.destroy?.();
        this.identityArchiveModal = null;
        this.destroyCompanionFieldMemoryReplay();

        // Destroy elements
        this.elements.forEach(el => el?.destroy?.());
        this.elements = [];
        this.creatureSprite = null;
        this.graphicsEngine = null;

        console.log('[CreatureProfileScene] Cleanup complete');
    }
}
