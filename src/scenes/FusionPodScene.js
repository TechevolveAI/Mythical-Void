/**
 * FusionPodScene - Cosmic fusion pod for creature fusion
 * Allows players to fuse TWO of their own creatures to create offspring
 *
 * Features:
 * - Two-creature selection from player's collection
 * - Adult-only fusion requirement
 * - Compatibility calculation and display
 * - Fusion cooldown management
 * - Offspring trait preview with parent inheritance display
 * - Generation tracking for lineage
 */

import SceneTransitionHelper from '../utils/SceneTransitionHelper.js';
import FusionConsentModal from '../ui/FusionConsentModal.js';
import SharedFusionModal from '../ui/SharedFusionModal.js';
import SharedGuardianshipModal from '../ui/SharedGuardianshipModal.js';
const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;
const FUSION_ELIGIBLE_STAGES = new Set(['adult', 'elder']);
const FUSION_ADULT_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const FUSION_STORY_COPY = Object.freeze({
    title: 'FUSION POD // CURRENT SYNTHESIS',
    subtitle: 'Two stable signatures form a new lineage. Both companions remain with you.',
    empty: 'Select two family records to compare their Current signatures.'
});

export function getCreatureFusionReadiness(creature, now = Date.now()) {
    const authoritativeReadiness = typeof window !== 'undefined'
        ? window.GameState?.getCreatureFusionReadiness?.(creature, now)
        : null;
    if (authoritativeReadiness) {
        return authoritativeReadiness;
    }

    if (!creature || typeof creature !== 'object') {
        return {
            eligible: false,
            reason: 'missing_creature',
            stage: 'unknown',
            readyAt: null,
            remainingMs: null
        };
    }

    const lifecycle = creature.lifecycle || {};
    if (lifecycle.hasDeparted || lifecycle.departureDate) {
        return {
            eligible: false,
            reason: 'departed',
            stage: String(lifecycle.stage || 'unknown').toLowerCase(),
            readyAt: null,
            remainingMs: null
        };
    }
    const stage = typeof lifecycle.stage === 'string'
        ? lifecycle.stage.toLowerCase()
        : '';

    if (FUSION_ELIGIBLE_STAGES.has(stage)) {
        return {
            eligible: true,
            reason: 'ready',
            stage,
            readyAt: null,
            remainingMs: 0
        };
    }

    const rawBirthDate = lifecycle.birthDate ?? creature.hatchTime;
    const birthDate = typeof rawBirthDate === 'number'
        ? rawBirthDate
        : Date.parse(rawBirthDate);
    if (!Number.isFinite(birthDate) || birthDate > now) {
        return {
            eligible: false,
            reason: 'missing_birth_record',
            stage: stage || 'unknown',
            readyAt: null,
            remainingMs: null
        };
    }

    const readyAt = birthDate + FUSION_ADULT_AGE_MS;
    const remainingMs = Math.max(0, readyAt - now);
    if (!stage && remainingMs === 0) {
        return {
            eligible: true,
            reason: 'ready',
            stage: 'adult',
            readyAt,
            remainingMs: 0
        };
    }

    return {
        eligible: false,
        reason: remainingMs > 0 ? 'maturing' : 'lifecycle_sync',
        stage: stage || 'unknown',
        readyAt,
        remainingMs
    };
}

export function isCreatureFusionEligible(creature, now = Date.now()) {
    return getCreatureFusionReadiness(creature, now).eligible;
}

export function formatFusionWaitTime(remainingMs) {
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        return 'ready for a lifecycle check';
    }

    const totalHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days === 0) return `${hours}h`;
    if (hours === 0) return `${days}d`;
    return `${days}d ${hours}h`;
}

export function getFallbackFusionCompatibility(parentA, parentB) {
    const getIdentity = parent => String(
        parent?.id ||
        parent?.genes?.id ||
        parent?.dna?.id ||
        parent?.genes?.species ||
        parent?.dna?.species ||
        'unknown'
    ).trim().toLowerCase();
    const pairKey = [getIdentity(parentA), getIdentity(parentB)]
        .sort()
        .join('|');
    let hash = 2166136261;
    for (let index = 0; index < pairKey.length; index++) {
        hash ^= pairKey.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    const percentage = 50 + ((hash >>> 0) % 41);
    return {
        percentage,
        score: percentage,
        maxScore: 100,
        source: 'stable_identity_fallback'
    };
}

function getGameState() {
    if (typeof window === 'undefined' || !window.GameState) {
        throw new Error('GameState system not ready');
    }
    return window.GameState;
}

class FusionPodScene extends Phaser.Scene {
    constructor() {
        super({ key: 'FusionPodScene' });

        // Selected parents (from player's collection)
        this.parent1Index = null;
        this.parent1Data = null;
        this.parent2Index = null;
        this.parent2Data = null;

        this.compatibility = null;
        this.breedingInProgress = false;

        // UI elements
        this.overlay = null;
        this.panel = null;
        this.elements = [];
        this.selectionModal = null;
        this.selectionModalElements = [];
        this.previewCreatures = null;
        this.previewAutoSelect = false;
        this.previewAutoStart = false;
        this.fusionTransaction = null;
        this.fusionOperationId = null;
        this.fusionResultSeed = null;
        this.fusionOffspringSequence = 0;
        this.parentSlotElements = [];
        this.selectionModalOpen = false;
        this.previousTopOnly = true;
        this.breedButtonEnabled = false;
        this.cleanupComplete = false;
        this.fusionConsentModal = null;
        this.sharedFusionModal = null;
        this.sharedGuardianshipModal = null;
        this.fusionConsentReceipt = null;
        this.previewConsentOnly = false;
        this.previewSharedFusionAvailable = false;
        this.previewSharedGuardianshipAccount = false;
    }

    init(data = {}) {
        this.parent1Index = null;
        this.parent1Data = null;
        this.parent2Index = null;
        this.parent2Data = null;
        this.compatibility = null;
        this.breedingInProgress = false;
        this.fusionTransaction = null;
        this.fusionOperationId = null;
        this.fusionResultSeed = null;
        this.fusionOffspringSequence = 0;
        this.cleanupComplete = false;
        this.fusionConsentReceipt = null;
        this.previewCreatures = Array.isArray(data.previewCreatures)
            ? data.previewCreatures
            : null;
        this.previewConsentOnly = Boolean(
            this.previewCreatures && data.previewConsentOnly
        );
        this.previewAutoSelect = Boolean(
            this.previewCreatures && data.previewAutoSelect
        );
        this.previewAutoStart = Boolean(
            this.previewAutoSelect && data.previewAutoStart
        );
        this.previewSharedFusionAvailable = Boolean(
            this.previewCreatures &&
            data.previewSharedFusionAvailable
        );
        this.previewSharedGuardianshipAccount = Boolean(
            this.previewCreatures &&
            data.previewSharedGuardianshipAccount
        );
    }

    getFusionCollection() {
        return this.previewCreatures || getGameState().getCreatureCollection?.() || [];
    }

    create() {
        console.log('[FusionPodScene] Creating fusion pod...');

        const { width, height } = this.scale;
        this.releaseSanctuaryOpeningGuard();
        this.events?.once?.('shutdown', this.shutdown, this);
        this.events?.once?.('destroy', this.shutdown, this);

        // Stop other scenes to ensure clean display
        const scenesToStop = ['GameScene'];
        SceneTransitionHelper.pauseActiveScenes(this, scenesToStop);

        // A page refresh or abandoned hatch reveal can leave a reserved
        // result behind. Resume the exact staged creature rather than rolling
        // different genes; an unstaged reservation is safe to cancel.
        if (!this.previewCreatures) {
            const resumableFusion = getGameState().getPendingFusionHatchData?.();
            if (resumableFusion) {
                window.UXEnhancements?.hideLoading?.();
                this.scene.start('BreedingHatchScene', resumableFusion);
                return;
            }
            const reservedFusion =
                getGameState().getPendingReservedFusion?.();
            if (reservedFusion) {
                this.resumeReservedFusion(reservedFusion, width, height);
                return;
            }
            getGameState().clearInterruptedFusion?.('pod_reentered');
            getGameState().reconcileCreatureCollectionLifecycles?.({
                persist: true
            });
            const fusionStatus = getGameState().getBreedingShrineStatus?.();
            if (!fusionStatus?.unlocked) {
                this.showRequirementNotMet(
                    width,
                    height,
                    'locked',
                    fusionStatus?.currentLevel || 1
                );
                return;
            }
        }

        // Check fusion requirements after inactive creature lifecycles have
        // been reconciled.
        const collection = this.getFusionCollection();
        const readiness = this.getCollectionReadiness(collection);
        const adultCreatures = readiness
            .filter(entry => entry.eligible)
            .map(entry => entry.creature);
        const sharedFusionAvailable =
            this.isSharedFusionAvailable() ||
            this.isSharedGuardianshipAvailable();

        if (collection.length < 2 && !sharedFusionAvailable) {
            this.showRequirementNotMet(width, height, 'need_creatures', {
                collection,
                readiness
            });
            return;
        }

        if (
            adultCreatures.length < 2 &&
            !(sharedFusionAvailable && adultCreatures.length >= 1)
        ) {
            this.showRequirementNotMet(width, height, 'need_adults', {
                collection,
                readiness
            });
            return;
        }

        // Create the breeding UI
        this.createOverlay(width, height);
        this.createMainPanel(width, height);
        this.createTitle(width);
        this.createParentSlots(width, height);
        this.createCompatibilityDisplay(width, height);
        this.createBreedButton(width, height);
        this.createSharedFusionButton();
        this.createCloseButton(width);

        if (this.previewSharedGuardianshipAccount) {
            this.time.delayedCall(80, () => this.openSharedGuardianship());
        }

        if (this.previewConsentOnly) {
            this.time.delayedCall(80, () => {
                const eligible = this.getAdultCreatures(
                    this.getFusionCollection()
                );
                if (eligible.length < 2 || this.cleanupComplete) return;
                this.parent1Data = eligible[0];
                this.parent2Data = eligible[1];
                this.parent1Index = 0;
                this.parent2Index = 1;
                this.calculateCompatibility();
                this.refreshUI();
                this.requestFusionConsent();
            });
        }

        if (this.previewAutoSelect && !this.previewConsentOnly) {
            this.time.delayedCall(50, () => {
                const eligible = this.getAdultCreatures(this.getFusionCollection());
                if (eligible.length < 2 || this.cleanupComplete) return;

                const collection = this.getFusionCollection();
                this.parent1Index = collection.indexOf(eligible[0]);
                this.parent1Data = eligible[0];
                this.parent2Index = collection.indexOf(eligible[1]);
                this.parent2Data = eligible[1];
                this.calculateCompatibility();
                this.refreshUI();
                if (this.previewAutoStart) {
                    this.time.delayedCall(500, () => {
                        if (!this.cleanupComplete) {
                            const parents = [
                                this.parent1Data,
                                this.parent2Data
                            ];
                            const consentReceipt = window.FusionConsent
                                ?.createLocalFusionConsentReceipt?.({
                                    operationId:
                                        this.fusionOperationId ||
                                        `fusion_preview_${Date.now()}`,
                                    parents
                                });
                            this.fusionOperationId =
                                consentReceipt?.operationId ||
                                this.fusionOperationId;
                            this.fusionConsentReceipt = consentReceipt;
                            this.attemptBreeding({ consentReceipt });
                        }
                    });
                }
            });
        }

        // Play fusion pod ambient sound and start fusion music
        if (window.AudioManager) {
            window.AudioManager.playFusionAmbient?.();
            window.AudioManager.playAreaMusic?.('breeding');
        }

        // Hide loading overlay
        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }

        console.log('[FusionPodScene] Fusion pod created');
    }

    releaseSanctuaryOpeningGuard() {
        this.scene?.get?.('GameScene')?.releaseFusionPodOpeningGuard?.();
    }

    isSharedFusionAvailable() {
        if (this.previewSharedFusionAvailable) {
            return true;
        }
        if (
            this.previewCreatures ||
            !window.SharedFusionInvitation
        ) {
            return false;
        }
        return window.SharedFusionInvitation
            .getSharedFusionAvailability?.(
                window.CloudSave
            )?.available === true;
    }

    isSharedGuardianshipAvailable() {
        if (this.previewSharedGuardianshipAccount) return true;
        if (this.previewSharedFusionAvailable) return false;
        if (this.previewCreatures || !window.SharedGuardianship?.isEnabled?.()) {
            return false;
        }
        return window.SharedGuardianship
            .getSharedGuardianshipEntryAvailability?.(window.CloudSave)
            ?.available === true;
    }

    createSharedFusionButton() {
        const sharedGuardianshipAvailable = this.isSharedGuardianshipAvailable();
        if (!sharedGuardianshipAvailable && !this.isSharedFusionAvailable()) return;
        const width = 58;
        const height = 50;
        const x = this.panelBounds.x + 7;
        const y = this.breedButtonBounds.y;
        const background = this.add.graphics()
            .setDepth(201);
        const draw = highlighted => {
            background.clear();
            background.fillStyle(
                highlighted ? 0x176B4A : 0x102B26,
                1
            );
            background.fillRoundedRect(
                x,
                y,
                width,
                height,
                8
            );
            background.lineStyle(
                2,
                highlighted ? 0xFFFFFF : 0x5EE6A8,
                1
            );
            background.strokeRoundedRect(
                x,
                y,
                width,
                height,
                8
            );
        };
        draw(false);
        const label = this.add.text(
            x + width / 2,
            y + height / 2,
            sharedGuardianshipAvailable ? 'SHARE' : 'LINK',
            {
                fontSize: '10px',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setDepth(202);
        const hitZone = this.add.zone(
            x + width / 2,
            y + height / 2,
            width,
            height
        )
            .setDepth(203)
            .setInteractive({ useHandCursor: true });
        let tooltip = null;
        hitZone.on('pointerdown', () => {
            if (sharedGuardianshipAvailable) this.openSharedGuardianship();
            else this.openSharedFusion();
        });
        hitZone.on('pointerover', () => {
            draw(true);
            tooltip = this.add.text(
                x,
                y - 8,
                sharedGuardianshipAvailable
                    ? 'One creature in two Sanctuaries'
                    : 'Protected Shared Fusion',
                {
                    fontSize: '10px',
                    color: '#FFFFFF',
                    backgroundColor: '#050807',
                    padding: { x: 7, y: 4 }
                }
            ).setOrigin(0, 1).setDepth(204);
        });
        hitZone.on('pointerout', () => {
            draw(false);
            tooltip?.destroy?.();
            tooltip = null;
        });
        this.elements.push(background, label, hitZone);
    }

    openSharedGuardianship() {
        if (
            this.sharedGuardianshipModal ||
            !this.isSharedGuardianshipAvailable()
        ) {
            return false;
        }
        const parents = this.getFusionCollection().filter(creature => (
            window.FusionConsent
                ?.getFusionCompanionReadiness?.(creature)?.willing
        ));
        const previewAccount = this.previewSharedGuardianshipAccount
            ? {
                getStatus: async () => ({
                    configured: true,
                    authenticated: true,
                    permanent: false,
                    verified: false,
                    anonymous: true
                })
            }
            : null;
        this.sharedGuardianshipModal = new SharedGuardianshipModal(this, {
            ...(previewAccount
                ? { account: previewAccount, previewAccess: true }
                : {})
        });
        return this.sharedGuardianshipModal.show({
            parents,
            onClose: () => {
                this.sharedGuardianshipModal = null;
                this.updateBreedButton();
            },
            onComplete: () => {
                this.sharedGuardianshipModal = null;
                this.closeScene();
            }
        });
    }

    openSharedFusion() {
        if (this.sharedFusionModal || !this.isSharedFusionAvailable()) {
            return false;
        }
        const parents = this.getFusionCollection().filter(creature => (
            window.FusionConsent
                ?.getFusionCompanionReadiness?.(creature)?.willing
        ));
        if (parents.length < 1) return false;
        this.sharedFusionModal = new SharedFusionModal(this);
        return this.sharedFusionModal.show({
            parents,
            onClose: () => {
                this.sharedFusionModal = null;
                this.updateBreedButton();
            },
            onComplete: () => {
                this.sharedFusionModal = null;
                this.closeScene();
            }
        });
    }

    async resumeReservedFusion(transaction, width, height) {
        this.fusionTransaction = transaction;
        this.fusionOperationId = transaction.operationId;
        const collection = getGameState().getCreatureCollection?.() || [];
        const parents = transaction.parentIds?.map(parentId => (
            collection.find(creature => creature?.id === parentId)
        )) || [];

        if (parents.length !== 2 || parents.some(parent => !parent)) {
            this.showRequirementNotMet(
                width,
                height,
                'reserved_recovery',
                'Sync this Sanctuary save to restore both parent records.'
            );
            return;
        }

        [this.parent1Data, this.parent2Data] = parents;
        window.UXEnhancements?.showLoading?.(
            'Restoring reserved lineage...'
        );

        const executionResult = await this.executeServerFusionOutcome();
        if (!executionResult.success || !executionResult.execution) {
            this.showRequirementNotMet(
                width,
                height,
                'reserved_recovery',
                'The lineage service is still unavailable. The reserved result remains safe; return to the Pod to retry.'
            );
            return;
        }

        this.fusionTransaction = executionResult.transaction;
        const hatchData = this.buildServerHatchData(
            executionResult.execution.outcome
        );
        const staged = this.stageFusionHatchData(hatchData);
        if (!staged.success) {
            this.showRequirementNotMet(
                width,
                height,
                'reserved_recovery',
                'The result returned but could not be secured locally. The reservation remains safe; sync and retry.'
            );
            return;
        }

        window.UXEnhancements?.hideLoading?.();
        this.shutdown();
        this.scene.start('BreedingHatchScene', hatchData);
    }

    requestFusionConsent() {
        if (!this.parent1Data || !this.parent2Data) return false;
        this.fusionOperationId = this.fusionOperationId ||
            (
                this.previewCreatures
                    ? `fusion_preview_consent_${Date.now()}`
                    : getGameState().createPortableId?.('fusion')
            );
        const parents = [this.parent1Data, this.parent2Data];
        const readiness = window.FusionConsent
            ?.getFusionConsentReadiness?.(parents) || {
            ready: true,
            parents: parents.map(parent => ({
                creatureId: parent.id,
                name: parent.name,
                willing: true
            }))
        };
        this.fusionConsentModal?.destroy?.();
        this.fusionConsentModal = new FusionConsentModal(this);
        return this.fusionConsentModal.show({
            parents,
            readiness,
            onConfirm: () => {
                const receipt = this.previewCreatures
                    ? window.FusionConsent
                        ?.createLocalFusionConsentReceipt?.({
                            operationId: this.fusionOperationId,
                            parents
                        })
                    : window.FusionConsent?.recordLocalFusionConsent?.(
                        getGameState(),
                        {
                            operationId: this.fusionOperationId,
                            parents
                        }
                    );
                if (!receipt) {
                    this.showBreedingError(
                        'Fusion paused: both companions must approach willingly.'
                    );
                    return;
                }
                this.fusionConsentReceipt = receipt;
                if (!this.previewConsentOnly) {
                    this.attemptBreeding({ consentReceipt: receipt });
                }
            },
            onCancel: () => {
                this.fusionOperationId = null;
                this.fusionConsentReceipt = null;
            }
        });
    }

    /**
     * Get fusion-eligible adult creatures from the collection.
     */
    getAdultCreatures(collection) {
        return collection.filter(creature => isCreatureFusionEligible(creature));
    }

    getCollectionReadiness(collection, now = Date.now()) {
        return collection.map(creature => ({
            creature,
            ...getCreatureFusionReadiness(creature, now)
        }));
    }

    /**
     * Check if a specific creature is eligible for fusion.
     */
    isCreatureAdult(creature) {
        return isCreatureFusionEligible(creature);
    }

    /**
     * Show requirement not met screen
     */
    showRequirementNotMet(width, height, reason, context) {
        // CRITICAL: Hide any loading overlay first
        if (window.UXEnhancements) {
            window.UXEnhancements.hideLoading();
        }

        this.createOverlay(width, height);

        const panelWidth = Math.min(350, width - 40);
        const panelHeight = ['need_adults', 'reserved_recovery'].includes(reason)
            ? 330
            : 280;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0xFF6666, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setDepth(200);

        let title, message, icon;

        if (reason === 'locked') {
            icon = '◈';
            title = 'Creature Not Yet Ready';
            const currentLevel = Number(context) || 1;
            message = `The Fusion Pod responds at companion Level 5.\n\nCurrent level: ${currentLevel}/5\n\nContinue expeditions and strengthen the bond.`;
        } else if (reason === 'need_creatures') {
            icon = '🥚';
            title = 'More Creatures Needed';
            const collectionCount = context?.collection?.length || 0;
            message = `Two family records are required.\n\nCollection: ${collectionCount}/2 creatures\n\nRescue or hatch another companion to continue.`;
        } else if (reason === 'reserved_recovery') {
            icon = '◇';
            title = 'Reserved Lineage Safe';
            message = `${context}\n\nNo new operation will be created and neither parent record has changed.`;
        } else {
            icon = '⏳';
            title = 'Signatures Still Forming';
            const readiness = context?.readiness || [];
            const readyCount = readiness.filter(entry => entry.eligible).length;
            const statusLines = readiness
                .filter(entry => !entry.eligible)
                .slice(0, 2)
                .map(entry => {
                    const name = entry.creature?.name || 'Companion';
                    if (entry.reason === 'maturing') {
                        return `${name}: stable in ${formatFusionWaitTime(entry.remainingMs)}`;
                    }
                    if (entry.reason === 'wellbeing') {
                        return `${name}: needs care before growth can continue`;
                    }
                    return `${name}: lifecycle record needs a sanctuary check`;
                });
            message = [
                `Stable adult signatures: ${readyCount}/2`,
                ...statusLines,
                '',
                'Both companions remain after synthesis.'
            ].join('\n');
        }

        this.add.text(width / 2, panelY + 40, `${icon} ${title}`, {
            fontSize: '20px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);

        this.add.text(
            width / 2,
            panelY + (
                ['need_adults', 'reserved_recovery'].includes(reason)
                    ? 155
                    : 130
            ),
            message,
            {
            fontSize: '14px',
            color: '#FFFFFF',
            align: 'center',
            wordWrap: { width: panelWidth - 40 }
            }
        ).setOrigin(0.5).setDepth(201);

        // Close button
        const closeBtn = this.add.text(width / 2, panelY + panelHeight - 40, 'Got it', {
            fontSize: '16px',
            color: '#FFFFFF',
            backgroundColor: '#4B0082',
            padding: { x: 30, y: 10 }
        }).setOrigin(0.5).setDepth(201).setInteractive();

        closeBtn.on('pointerdown', () => this.closeScene());
        closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#6B21A8' }));
        closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#4B0082' }));
    }

    createOverlay(width, height) {
        this.overlay = this.add.graphics();
        this.overlay.fillStyle(0x050214, 0.9);
        this.overlay.fillRect(0, 0, width, height);
        this.overlay.setDepth(100);

        // Create twinkling stars
        for (let i = 0; i < 30; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(1, 3);

            const star = this.add.graphics();
            star.fillStyle(0xFFFFFF, Phaser.Math.FloatBetween(0.3, 0.8));
            star.fillCircle(x, y, size);
            star.setDepth(101);

            this.tweens.add({
                targets: star,
                alpha: { from: 0.3, to: 1 },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.elements.push(star);
        }

        this.elements.push(this.overlay);
    }

    getResponsiveLayout(width, height) {
        const shortLandscape = height < 520 && width > height;
        const panelWidth = shortLandscape
            ? Math.min(760, width - 30)
            : Math.min(400, width - 30);
        const panelHeight = shortLandscape
            ? Math.min(370, height - 16)
            : Math.min(550, height - 60);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        if (shortLandscape) {
            const leftCenterX = panelX + panelWidth * 0.27;
            const rightCenterX = panelX + panelWidth * 0.75;
            return {
                shortLandscape,
                panel: {
                    x: panelX,
                    y: panelY,
                    width: panelWidth,
                    height: panelHeight
                },
                titleY: panelY + 20,
                subtitleY: panelY + 43,
                slots: {
                    centerX: leftCenterX,
                    y: panelY + 76,
                    width: 116,
                    height: 150,
                    gap: 18
                },
                compatibility: {
                    centerX: rightCenterX,
                    topY: panelY + 78,
                    barWidth: Math.min(230, panelWidth * 0.34)
                },
                action: {
                    x: panelX + panelWidth / 2 + 18,
                    y: panelY + panelHeight - 66,
                    width: panelWidth / 2 - 36,
                    height: 48
                }
            };
        }

        return {
            shortLandscape,
            panel: {
                x: panelX,
                y: panelY,
                width: panelWidth,
                height: panelHeight
            },
            titleY: panelY + 28,
            subtitleY: panelY + 52,
            slots: {
                centerX: width / 2,
                y: panelY + 85,
                width: 130,
                height: 160,
                gap: 30
            },
            compatibility: {
                centerX: width / 2,
                topY: panelY + 265,
                barWidth: 200
            },
            action: {
                x: panelX + 7,
                y: panelY + panelHeight - 80,
                width: panelWidth - 14,
                height: 50
            }
        };
    }

    createMainPanel(width, height) {
        this.layout = this.getResponsiveLayout(width, height);
        const {
            x: panelX,
            y: panelY,
            width: panelWidth,
            height: panelHeight
        } = this.layout.panel;

        this.panel = this.add.graphics();
        this.panel.fillStyle(0x1A1A3E, 0.95);
        this.panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        this.panel.lineStyle(3, 0x9370DB, 1);
        this.panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        this.panel.lineStyle(1, 0xFFD700, 0.3);
        this.panel.strokeRoundedRect(panelX + 4, panelY + 4, panelWidth - 8, panelHeight - 8, 18);
        this.panel.setDepth(200);

        this.panelBounds = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };
        this.elements.push(this.panel);
    }

    createTitle(width) {
        const centerX = this.panelBounds.x + this.panelBounds.width / 2;
        const titleText = this.add.text(centerX, this.layout.titleY, FUSION_STORY_COPY.title, {
            fontSize: this.layout.shortLandscape ? '15px' : '16px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(201);

        const subtitleText = this.add.text(
            centerX,
            this.layout.subtitleY,
            FUSION_STORY_COPY.subtitle,
            {
                fontSize: this.layout.shortLandscape ? '9px' : '10px',
                color: '#AFC3CF',
                align: 'center',
                wordWrap: {
                    width: this.layout.shortLandscape
                        ? this.panelBounds.width - 120
                        : this.panelBounds.width - 70
                }
            }
        ).setOrigin(0.5).setDepth(201);

        this.elements.push(titleText, subtitleText);
    }

    createParentSlots(width, height) {
        const {
            centerX,
            y: startY,
            width: slotWidth,
            height: slotHeight,
            gap
        } = this.layout.slots;

        // Parent 1 slot (left)
        const slot1X = centerX - slotWidth - gap / 2;
        this.createParentSlot(slot1X, startY, slotWidth, slotHeight, 1);

        // Center "+" symbol
        const plusText = this.add.text(centerX, startY + slotHeight / 2, '+', {
            fontSize: '32px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);
        this.parentSlotElements.push(plusText);

        // Parent 2 slot (right)
        const slot2X = centerX + gap / 2;
        this.createParentSlot(slot2X, startY, slotWidth, slotHeight, 2);
    }

    createParentSlot(x, y, width, height, slotNum) {
        // Slot background
        const slot = this.add.graphics();
        slot.fillStyle(0x2A1A4E, 0.8);
        slot.fillRoundedRect(x, y, width, height, 12);
        slot.lineStyle(2, 0x6B4EAA, 1);
        slot.strokeRoundedRect(x, y, width, height, 12);
        slot.setDepth(201);

        // Label
        const label = this.add.text(x + width / 2, y + 15, `LINEAGE ${slotNum === 1 ? 'A' : 'B'}`, {
            fontSize: '10px',
            color: '#88CCFF'
        }).setOrigin(0.5).setDepth(202);

        // Selection indicator
        const parentData = slotNum === 1 ? this.parent1Data : this.parent2Data;

        let displayContent;
        if (parentData) {
            displayContent = this.createCreatureDisplay(x, y, width, height, parentData, slotNum);
        } else {
            // Empty slot - tap to select
            const placeholder = this.add.text(x + width / 2, y + height / 2, '👆\nTap to\nSelect', {
                fontSize: '14px',
                color: '#888888',
                align: 'center'
            }).setOrigin(0.5).setDepth(202);
            displayContent = [placeholder];
        }

        // Make slot interactive
        const hitZone = this.add.zone(x, y, width, height).setOrigin(0, 0);
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.setDepth(203);

        hitZone.on('pointerdown', () => {
            this.openCreatureSelector(slotNum);
        });

        hitZone.on('pointerover', () => {
            slot.clear();
            slot.fillStyle(0x3A2A5E, 0.9);
            slot.fillRoundedRect(x, y, width, height, 12);
            slot.lineStyle(2, 0x9370DB, 1);
            slot.strokeRoundedRect(x, y, width, height, 12);
        });

        hitZone.on('pointerout', () => {
            slot.clear();
            slot.fillStyle(0x2A1A4E, 0.8);
            slot.fillRoundedRect(x, y, width, height, 12);
            slot.lineStyle(2, 0x6B4EAA, 1);
            slot.strokeRoundedRect(x, y, width, height, 12);
        });

        // Store references
        if (slotNum === 1) {
            this.slot1Elements = { slot, label, content: displayContent, hitZone };
        } else {
            this.slot2Elements = { slot, label, content: displayContent, hitZone };
        }

        this.parentSlotElements.push(slot, label, hitZone, ...displayContent);
    }

    createCreatureDisplay(slotX, slotY, slotWidth, slotHeight, creature, slotNum) {
        const centerX = slotX + slotWidth / 2;
        const elements = [];

        // Creature visual (colored circle based on rarity)
        const visual = this.add.graphics();
        const color = this.getCreatureColor(creature.genes || creature.dna);
        visual.fillStyle(color, 0.9);
        visual.fillCircle(centerX, slotY + 55, 22);
        visual.lineStyle(2, 0xFFD700, 0.8);
        visual.strokeCircle(centerX, slotY + 55, 22);
        visual.setDepth(202);
        elements.push(visual);

        // Creature name
        const name = this.add.text(centerX, slotY + 90, creature.name || 'Unknown', {
            fontSize: '11px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);
        elements.push(name);

        // Rarity
        const rarity = creature.rarity || creature.genes?.rarity || 'common';
        const rarityColors = {
            common: '#AAAAAA',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FFD700'
        };
        const rarityText = this.add.text(centerX, slotY + 105, rarity.toUpperCase(), {
            fontSize: '9px',
            color: rarityColors[rarity] || '#FFFFFF'
        }).setOrigin(0.5).setDepth(202);
        elements.push(rarityText);

        // Stage indicator
        const stage = this.getCreatureStage(creature);
        const stageEmoji = stage === 'elder' ? '👑' : '✨';
        const stageText = this.add.text(centerX, slotY + 120, `${stageEmoji} ${stage}`, {
            fontSize: '10px',
            color: '#88FF88'
        }).setOrigin(0.5).setDepth(202);
        elements.push(stageText);

        // Generation indicator
        const generation = creature.generation || 1;
        const genText = this.add.text(centerX, slotY + 135, `Gen ${generation}`, {
            fontSize: '9px',
            color: '#888888'
        }).setOrigin(0.5).setDepth(202);
        elements.push(genText);

        return elements;
    }

    getCreatureStage(creature) {
        const lifecycle = creature.lifecycle || {};
        if (lifecycle.stage) return lifecycle.stage;

        const birthDate = lifecycle.birthDate || creature.hatchTime;
        if (birthDate) {
            const daysAlive = (Date.now() - birthDate) / (1000 * 60 * 60 * 24);
            if (daysAlive >= 9) return 'elder';
            if (daysAlive >= 2) return 'adult';
            if (daysAlive >= 1) return 'juvenile';
            return 'baby';
        }
        return 'unknown';
    }

    getCreatureSelectorPage(creatures, requestedPage, pageSize) {
        const totalPages = Math.max(1, Math.ceil(creatures.length / pageSize));
        const page = Math.min(Math.max(0, requestedPage), totalPages - 1);
        const start = page * pageSize;

        return {
            items: creatures.slice(start, start + pageSize),
            page,
            totalPages
        };
    }

    openCreatureSelector(slotNum, requestedPage = 0) {
        if (this.selectionModalOpen) {
            return;
        }

        console.log(`[FusionPodScene] Opening creature selector for slot ${slotNum}`);

        this.selectionModalOpen = true;
        this.previousTopOnly = this.input?.topOnly ?? true;
        this.input.topOnly = true;

        const { width, height } = this.scale;
        const collection = this.getFusionCollection();

        // Filter for adult creatures only
        const adultCreatures = collection.map((creature, index) => ({ ...creature, collectionIndex: index }))
            .filter(creature => this.isCreatureAdult(creature));

        // Create modal overlay (visual only - NOT interactive to prevent blocking button touches on mobile)
        const modalOverlay = this.add.graphics();
        modalOverlay.fillStyle(0x000000, 0.7);
        modalOverlay.fillRect(0, 0, width, height);
        modalOverlay.setDepth(300);
        // NOTE: Overlay is NOT made interactive - use Cancel button to close instead

        // Modal panel
        const modalWidth = Math.min(340, width - 40);
        const modalHeight = Math.min(400, height - 80);
        const modalX = (width - modalWidth) / 2;
        const modalY = (height - modalHeight) / 2;

        const modalPanel = this.add.graphics();
        modalPanel.fillStyle(0x1A1A3E, 0.98);
        modalPanel.fillRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        modalPanel.lineStyle(3, 0x9370DB, 1);
        modalPanel.strokeRoundedRect(modalX, modalY, modalWidth, modalHeight, 15);
        modalPanel.setDepth(301);

        // Modal title
        const modalTitle = this.add.text(width / 2, modalY + 25, `Select Parent ${slotNum}`, {
            fontSize: '18px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(302);

        const rowHeight = 55;
        const pageSize = Math.max(1, Math.floor((modalHeight - 150) / rowHeight));
        const selectorPage = this.getCreatureSelectorPage(
            adultCreatures,
            requestedPage,
            pageSize
        );
        const pageLabel = selectorPage.totalPages > 1
            ? ` • Page ${selectorPage.page + 1}/${selectorPage.totalPages}`
            : '';
        const modalSubtitle = this.add.text(width / 2, modalY + 48, `Adults and elders${pageLabel}`, {
            fontSize: '11px',
            color: '#888888'
        }).setOrigin(0.5).setDepth(302);

        this.selectionModalElements = [modalOverlay, modalPanel, modalTitle, modalSubtitle];

        // List creatures
        let rowY = modalY + 75;

        selectorPage.items.forEach(creature => {
            // CRITICAL: Capture rowY value for this iteration to avoid closure bug
            const currentRowY = rowY;

            // Check if already selected in other slot
            const otherSlotIndex = slotNum === 1 ? this.parent2Index : this.parent1Index;
            const isSelectedElsewhere = creature.collectionIndex === otherSlotIndex;

            const rowBg = this.add.graphics();
            rowBg.fillStyle(isSelectedElsewhere ? 0x333333 : 0x2A1A4E, 0.8);
            rowBg.fillRoundedRect(modalX + 15, currentRowY, modalWidth - 30, rowHeight - 5, 8);
            rowBg.setDepth(302);

            // Make entire row tappable on mobile (if not selected elsewhere)
            if (!isSelectedElsewhere) {
                const rowZone = this.add.zone(modalX + 15 + (modalWidth - 30) / 2, currentRowY + (rowHeight - 5) / 2, modalWidth - 30, rowHeight - 5);
                rowZone.setInteractive({ useHandCursor: true });
                rowZone.setDepth(304);  // Above the row elements

                rowZone.on('pointerdown', () => {
                    console.log(`[FusionPodScene] Row tapped for ${creature.name}`);
                    this.selectCreatureForSlot(slotNum, creature.collectionIndex, creature);
                });

                // Use captured currentRowY value, not loop variable rowY
                rowZone.on('pointerover', () => {
                    rowBg.clear();
                    rowBg.fillStyle(0x3A2A6E, 0.9);
                    rowBg.fillRoundedRect(modalX + 15, currentRowY, modalWidth - 30, rowHeight - 5, 8);
                });

                rowZone.on('pointerout', () => {
                    rowBg.clear();
                    rowBg.fillStyle(0x2A1A4E, 0.8);
                    rowBg.fillRoundedRect(modalX + 15, currentRowY, modalWidth - 30, rowHeight - 5, 8);
                });

                this.selectionModalElements.push(rowZone);
            }

            // Creature icon
            const iconColor = this.getCreatureColor(creature.genes || creature.dna);
            const icon = this.add.graphics();
            icon.fillStyle(iconColor, 0.9);
            icon.fillCircle(modalX + 40, currentRowY + 22, 15);
            icon.setDepth(303);

            // Creature info
            const name = this.add.text(modalX + 65, currentRowY + 8, creature.name || 'Unknown', {
                fontSize: '13px',
                color: isSelectedElsewhere ? '#666666' : '#FFFFFF',
                fontStyle: 'bold'
            }).setDepth(303);

            const rarity = creature.rarity || creature.genes?.rarity || 'common';
            const generation = creature.generation || 1;
            const info = this.add.text(modalX + 65, currentRowY + 26, `${rarity} • Gen ${generation}`, {
                fontSize: '10px',
                color: '#888888'
            }).setDepth(303);

            // Select button (if not selected elsewhere)
            if (!isSelectedElsewhere) {
                const selectBtn = this.add.text(modalX + modalWidth - 60, currentRowY + 18, 'SELECT', {
                    fontSize: '12px',
                    color: '#00FF00',
                    backgroundColor: '#1A3A1A',
                    padding: { x: 12, y: 8 }  // Larger padding for easier mobile tapping
                }).setOrigin(0.5).setDepth(303);

                // Create larger hit area for mobile touch (44x44 minimum recommended)
                const hitWidth = Math.max(selectBtn.width + 20, 60);
                const hitHeight = Math.max(selectBtn.height + 16, 44);
                selectBtn.setInteractive(
                    new Phaser.Geom.Rectangle(-hitWidth/2, -hitHeight/2, hitWidth, hitHeight),
                    Phaser.Geom.Rectangle.Contains
                );

                selectBtn.on('pointerdown', () => {
                    console.log(`[FusionPodScene] SELECT button tapped for ${creature.name}`);
                    this.selectCreatureForSlot(slotNum, creature.collectionIndex, creature);
                    // Note: closeSelectionModal is now called inside selectCreatureForSlot
                });

                selectBtn.on('pointerover', () => selectBtn.setStyle({ backgroundColor: '#2A5A2A' }));
                selectBtn.on('pointerout', () => selectBtn.setStyle({ backgroundColor: '#1A3A1A' }));

                this.selectionModalElements.push(selectBtn);
            } else {
                const usedLabel = this.add.text(modalX + modalWidth - 55, currentRowY + 18, 'In Use', {
                    fontSize: '10px',
                    color: '#666666'
                }).setOrigin(0.5).setDepth(303);
                this.selectionModalElements.push(usedLabel);
            }

            this.selectionModalElements.push(rowBg, icon, name, info);
            rowY += rowHeight;
        });

        if (selectorPage.totalPages > 1) {
            const navigationY = modalY + modalHeight - 62;
            const addPageButton = (x, label, nextPage, enabled) => {
                const button = this.add.text(x, navigationY, label, {
                    fontSize: '13px',
                    color: enabled ? '#FFFFFF' : '#666666',
                    backgroundColor: enabled ? '#4B3A78' : '#252535',
                    padding: { x: 14, y: 8 }
                }).setOrigin(0.5).setDepth(303);

                if (enabled) {
                    button.setInteractive({ useHandCursor: true });
                    button.on('pointerdown', () => {
                        this.closeSelectionModal();
                        this.openCreatureSelector(slotNum, nextPage);
                    });
                }
                this.selectionModalElements.push(button);
            };

            addPageButton(
                width / 2 - 85,
                'Previous',
                selectorPage.page - 1,
                selectorPage.page > 0
            );
            addPageButton(
                width / 2 + 85,
                'Next',
                selectorPage.page + 1,
                selectorPage.page < selectorPage.totalPages - 1
            );
        }

        // Close button with larger touch target for mobile
        const closeBtn = this.add.text(width / 2, modalY + modalHeight - 24, 'Cancel', {
            fontSize: '16px',
            color: '#FFFFFF',
            backgroundColor: '#555555',
            padding: { x: 30, y: 12 }  // Larger padding for mobile
        }).setOrigin(0.5).setDepth(302);

        // Create larger hit area for mobile (minimum 44x44 recommended)
        const cancelHitWidth = Math.max(closeBtn.width + 20, 100);
        const cancelHitHeight = Math.max(closeBtn.height + 16, 48);
        closeBtn.setInteractive(
            new Phaser.Geom.Rectangle(-cancelHitWidth/2, -cancelHitHeight/2, cancelHitWidth, cancelHitHeight),
            Phaser.Geom.Rectangle.Contains
        );

        closeBtn.on('pointerdown', () => {
            console.log('[FusionPodScene] Cancel button tapped');
            this.closeSelectionModal();
        });
        closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#777777' }));
        closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#555555' }));

        this.selectionModalElements.push(closeBtn);

        // NOTE: Overlay is NOT interactive - use Cancel button to close the modal
        // This prevents touch events from being blocked on mobile devices
    }

    closeSelectionModal() {
        if (!this.selectionModalOpen && this.selectionModalElements.length === 0) {
            return;
        }

        console.log('[FusionPodScene] Closing selection modal, destroying', this.selectionModalElements.length, 'elements');

        if (this.input) {
            this.input.topOnly = this.previousTopOnly;
        }

        // Destroy all modal elements with proper cleanup
        this.selectionModalElements.forEach(el => {
            if (el) {
                // Remove any event listeners first
                if (el.removeAllListeners) {
                    el.removeAllListeners();
                }
                // Destroy the element
                if (el.destroy) {
                    el.destroy();
                }
            }
        });

        this.selectionModalElements = [];
        this.selectionModalOpen = false;
        console.log('[FusionPodScene] Selection modal closed');
    }

    selectCreatureForSlot(slotNum, collectionIndex, creature) {
        console.log(`[FusionPodScene] Selected creature ${creature.name} for slot ${slotNum}`);

        // 1. Store creature data
        if (slotNum === 1) {
            this.parent1Index = collectionIndex;
            this.parent1Data = creature;
        } else {
            this.parent2Index = collectionIndex;
            this.parent2Data = creature;
        }

        // 2. Calculate compatibility before rebuilding the display so the
        // refreshed meter and action button render the new state immediately.
        if (this.parent1Data && this.parent2Data) {
            this.calculateCompatibility();
        }

        // 3. Close modal IMMEDIATELY (no delay)
        this.closeSelectionModal();

        // 4. Play selection sound
        window.AudioManager?.playButtonClick?.();

        // 5. Refresh UI immediately (no delay - modal cleanup is synchronous)
        this.refreshUI();

        // 6. Animate the filled slot with visual feedback
        this.animateSlotFill(slotNum, creature.name);

        // 7. Auto-highlight empty slot to guide user to next action
        if (slotNum === 1 && !this.parent2Data) {
            this.highlightEmptySlot(2);
        } else if (slotNum === 2 && !this.parent1Data) {
            this.highlightEmptySlot(1);
        }

        // 8. Play success sound when both parents are ready.
        if (this.parent1Data && this.parent2Data) {
            window.AudioManager?.playLevelUp?.();
        }
    }

    /**
     * Animate a slot when a creature is selected - provides non-blocking visual feedback
     * Shows a brief pulse animation on the slot and a floating checkmark
     */
    animateSlotFill(slotNum, creatureName) {
        const slotElements = slotNum === 1 ? this.slot1Elements : this.slot2Elements;
        if (!slotElements?.slot) return;

        // Get slot position for the checkmark
        const slotPos = this.getSlotPosition(slotNum);

        // Pulse animation on the slot background
        this.tweens.add({
            targets: slotElements.slot,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 150,
            yoyo: true,
            ease: 'Power2'
        });

        // Brief checkmark near the slot (non-blocking, fades quickly)
        const check = this.add.text(slotPos.x + 50, slotPos.y + 20, '✓', {
            fontSize: '28px',
            color: '#00FF00',
            stroke: '#004400',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(250);

        // Float up and fade out
        this.tweens.add({
            targets: check,
            alpha: 0,
            y: slotPos.y - 10,
            duration: 800,
            delay: 200,
            ease: 'Power2',
            onComplete: () => check.destroy()
        });

        console.log(`[FusionPodScene] Animated slot ${slotNum} fill for ${creatureName}`);
    }

    /**
     * Highlight an empty slot to guide user to select the other parent
     * Uses a subtle pulsing border effect
     */
    highlightEmptySlot(slotNum) {
        const slotElements = slotNum === 1 ? this.slot1Elements : this.slot2Elements;
        if (!slotElements?.slot) return;

        // Subtle pulsing highlight effect (3 pulses)
        this.tweens.add({
            targets: slotElements.slot,
            alpha: { from: 0.6, to: 1 },
            duration: 400,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });

        console.log(`[FusionPodScene] Highlighting empty slot ${slotNum}`);
    }

    /**
     * Get the position of a slot for animation purposes
     */
    getSlotPosition(slotNum) {
        const {
            centerX,
            y: startY,
            width: slotWidth,
            gap
        } = this.layout.slots;

        if (slotNum === 1) {
            return {
                x: centerX - slotWidth - gap / 2 + slotWidth / 2,
                y: startY
            };
        } else {
            return {
                x: centerX + gap / 2 + slotWidth / 2,
                y: startY
            };
        }
    }

    refreshUI() {
        const { width, height } = this.scale;

        this.parentSlotElements.forEach(element => element?.destroy?.());
        this.parentSlotElements = [];
        this.slot1Elements = null;
        this.slot2Elements = null;

        this.elements = this.elements.filter(element => element?.active);

        this.createParentSlots(width, height);
        this.updateCompatibilityDisplay();
        this.updateBreedButton();
    }

    calculateCompatibility() {
        if (!this.parent1Data || !this.parent2Data) {
            this.compatibility = null;
            return;
        }

        if (window.BreedingEngine?.resolveCreatureGenes) {
            const genes1 = window.BreedingEngine.resolveCreatureGenes(
                this.parent1Data
            );
            const genes2 = window.BreedingEngine.resolveCreatureGenes(
                this.parent2Data
            );
            this.compatibility = window.BreedingEngine.getBreedingCompatibility(
                genes1,
                genes2
            );
        } else {
            this.compatibility = getFallbackFusionCompatibility(
                this.parent1Data,
                this.parent2Data
            );
        }

        console.log('[FusionPodScene] Compatibility:', this.compatibility);

        // Play compatibility sound based on result
        const isGoodCompatibility = this.compatibility.percentage >= 70 || this.compatibility.score >= 70;
        window.AudioManager?.playFusionCompatibility?.(isGoodCompatibility);
    }

    createCompatibilityDisplay(width, height) {
        const {
            centerX,
            topY,
            barWidth
        } = this.layout.compatibility;

        // Compatibility label
        const label = this.add.text(centerX, topY, 'Genetic Compatibility', {
            fontSize: '12px',
            color: '#AAAAAA'
        }).setOrigin(0.5).setDepth(201);

        // Placeholder when no selection
        this.compatibilityText = this.add.text(centerX, topY + 25, '--', {
            fontSize: '28px',
            color: '#666666',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);

        // Compatibility bar background
        const barHeight = 10;
        const barX = centerX - barWidth / 2;
        const barY = topY + 55;

        this.compatBarBg = this.add.graphics();
        this.compatBarBg.fillStyle(0x333333, 1);
        this.compatBarBg.fillRoundedRect(barX, barY, barWidth, barHeight, 5);
        this.compatBarBg.setDepth(201);

        this.compatBarFill = this.add.graphics();
        this.compatBarFill.setDepth(202);

        // Explanation text
        this.explanationText = this.add.text(centerX, topY + 75, FUSION_STORY_COPY.empty, {
            fontSize: '10px',
            color: '#8B99A3',
            align: 'center',
            wordWrap: { width: 250 }
        }).setOrigin(0.5).setDepth(201);

        // Offspring Predictions Section
        this.predictionsLabel = this.add.text(centerX, topY + 105, 'PROJECTED LINEAGE', {
            fontSize: '11px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201).setAlpha(0);

        // Predictions container for dynamic content
        this.predictionsContainer = this.add.container(centerX, topY + 130).setDepth(201).setAlpha(0);

        this.elements.push(label, this.compatibilityText, this.compatBarBg, this.compatBarFill,
            this.explanationText, this.predictionsLabel, this.predictionsContainer);
    }

    /**
     * Calculate offspring predictions based on parent data
     */
    calculateOffspringPredictions() {
        if (!this.parent1Data || !this.parent2Data) return null;

        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const rarityColors = {
            common: '#888888',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FFD700'
        };

        // Calculate expected rarity
        const p1RarityIdx = rarities.indexOf(this.parent1Data.rarity || 'common');
        const p2RarityIdx = rarities.indexOf(this.parent2Data.rarity || 'common');
        const avgRarityIdx = Math.floor((p1RarityIdx + p2RarityIdx) / 2);
        const baseRarity = rarities[avgRarityIdx];

        // Calculate upgrade chance based on compatibility
        const compatibility = this.compatibility?.percentage || 50;
        const upgradeChance = Math.min(20 + Math.floor(compatibility / 10), 40); // 20-40% based on compatibility

        // Get cosmic affinities
        const p1Affinity = this.parent1Data.genes?.cosmicAffinity?.element ||
                          this.parent1Data.cosmicAffinity || null;
        const p2Affinity = this.parent2Data.genes?.cosmicAffinity?.element ||
                          this.parent2Data.cosmicAffinity || null;

        // Determine potential affinities
        const affinityOptions = [];
        if (p1Affinity) affinityOptions.push(p1Affinity);
        if (p2Affinity && p2Affinity !== p1Affinity) affinityOptions.push(p2Affinity);
        if (affinityOptions.length === 0) affinityOptions.push('star');

        // Generation bonus
        const p1Gen = this.parent1Data.generation || 1;
        const p2Gen = this.parent2Data.generation || 1;
        const offspringGen = Math.max(p1Gen, p2Gen) + 1;
        const genBonus = Math.round(offspringGen * 5); // 5% per generation

        // Get body types from parents
        const p1BodyType = this.parent1Data.genes?.traits?.bodyShape?.type ||
                          this.parent1Data.dna?.traits?.bodyShape?.type || null;
        const p2BodyType = this.parent2Data.genes?.traits?.bodyShape?.type ||
                          this.parent2Data.dna?.traits?.bodyShape?.type || null;

        return {
            baseRarity,
            baseRarityColor: rarityColors[baseRarity],
            upgradeChance,
            potentialUpgradeRarity: avgRarityIdx < rarities.length - 1 ? rarities[avgRarityIdx + 1] : null,
            potentialUpgradeColor: avgRarityIdx < rarities.length - 1 ? rarityColors[rarities[avgRarityIdx + 1]] : null,
            affinityOptions,
            generation: offspringGen,
            genBonus,
            bodyTypes: [p1BodyType, p2BodyType].filter(Boolean),
            compatibility
        };
    }

    updateCompatibilityDisplay() {
        if (!this.compatibilityText) return;

        const {
            centerX,
            topY,
            barWidth
        } = this.layout.compatibility;
        const barX = centerX - barWidth / 2;
        const barY = topY + 55;

        // Stop any running bonus tween before clearing predictions
        if (this.bonusLineTween) {
            this.bonusLineTween.stop();
            this.bonusLineTween = null;
        }

        // Clear previous predictions
        if (this.predictionsContainer) {
            this.predictionsContainer.removeAll(true);
        }

        if (this.compatibility && this.parent1Data && this.parent2Data) {
            const percentage = this.compatibility.percentage || 50;
            const color = percentage >= 70 ? '#00FF00' : percentage >= 40 ? '#FFFF00' : '#FF6666';

            this.compatibilityText.setText(`${percentage}%`);
            this.compatibilityText.setColor(color);

            // Update bar
            this.compatBarFill.clear();
            this.compatBarFill.fillStyle(parseInt(color.replace('#', ''), 16), 0.9);
            this.compatBarFill.fillRoundedRect(barX, barY, barWidth * (percentage / 100), 10, 5);

            // Update explanation
            const explanation = percentage >= 70
                ? 'Excellent match! High genetic diversity.'
                : percentage >= 40
                    ? 'Good compatibility. Mixed trait inheritance.'
                    : 'Low compatibility. Offspring may have limited traits.';
            this.explanationText?.setText(explanation);

            // Show predictions
            this.showOffspringPredictions();
        } else {
            this.compatibilityText.setText('--');
            this.compatibilityText.setColor('#666666');
            this.compatBarFill?.clear();
            this.explanationText?.setText(FUSION_STORY_COPY.empty);

            // Hide predictions
            this.predictionsLabel?.setAlpha(0);
            this.predictionsContainer?.setAlpha(0);
        }
    }

    /**
     * Display offspring predictions in the UI
     */
    showOffspringPredictions() {
        const predictions = this.calculateOffspringPredictions();
        if (!predictions || !this.predictionsContainer) return;

        // Show the section
        this.predictionsLabel?.setAlpha(1);
        this.predictionsContainer.setAlpha(1);

        const addProjectionLine = (text, color) => {
            const line = this.add.text(
                0,
                this.predictionsContainer.list.length * 17,
                text,
                {
                    fontSize: '10px',
                    color,
                    fontStyle: 'bold',
                    align: 'center'
                }
            ).setOrigin(0.5, 0);
            this.predictionsContainer.add(line);
        };

        const rarityProjection = predictions.potentialUpgradeRarity
            ? `${predictions.baseRarity.toUpperCase()} • ${predictions.upgradeChance}% ${predictions.potentialUpgradeRarity.toUpperCase()}`
            : predictions.baseRarity.toUpperCase();
        addProjectionLine(`RARITY // ${rarityProjection}`, predictions.baseRarityColor);
        addProjectionLine(
            `GEN ${predictions.generation} // +${predictions.genBonus}% COSMIC POWER`,
            '#88CCFF'
        );
        addProjectionLine(
            `AFFINITY // ${predictions.affinityOptions.map(
                affinity => String(affinity).toUpperCase()
            ).join(' / ')}`,
            '#E6E6FA'
        );
        if (predictions.compatibility >= 80) {
            addProjectionLine('RESONANCE BONUS // STRONG', '#FFD700');
        }
    }

    createBreedButton(width, height) {
        const buttonY = this.layout.action.y;
        const sharedLinkLane = (
            this.isSharedFusionAvailable() ||
            this.isSharedGuardianshipAvailable()
        ) ? 65 : 0;
        const actionX = this.layout.action.x + sharedLinkLane;
        const actionWidth = this.layout.action.width - sharedLinkLane;
        const centerX = actionX + actionWidth / 2;
        const btnWidth = Math.min(
            this.layout.shortLandscape ? 300 : 230,
            actionWidth
        );
        const btnHeight = this.layout.action.height;

        this.breedButtonBg = this.add.graphics();
        this.breedButtonBg.setDepth(201);

        this.breedButton = this.add.text(centerX, buttonY + btnHeight / 2, '🥚 Select Parents First', {
            fontSize: '14px',
            color: '#888888',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        this.breedButtonBounds = { x: centerX - btnWidth / 2, y: buttonY, width: btnWidth, height: btnHeight };

        this.breedButtonHitZone = this.add.zone(
            centerX,
            buttonY + btnHeight / 2,
            btnWidth,
            btnHeight
        ).setDepth(203);
        this.breedButtonHitZone.setInteractive({ useHandCursor: true });
        this.breedButtonHitZone.on('pointerdown', () => {
            if (!this.breedButtonEnabled) return;
            console.log('[FusionPodScene] Begin Fusion button clicked!');
            this.attemptBreeding();
        });
        this.breedButtonHitZone.on('pointerover', () => {
            if (!this.breedButtonEnabled) return;
            this.drawBreedButtonBackground(0x6B21A8, 0xFFD700);
        });
        this.breedButtonHitZone.on('pointerout', () => {
            if (!this.breedButtonEnabled) return;
            this.drawBreedButtonBackground(0x4B0082, 0xFFD700);
        });

        this.updateBreedButton();

        this.elements.push(
            this.breedButtonBg,
            this.breedButton,
            this.breedButtonHitZone
        );
    }

    drawBreedButtonBackground(fillColor, borderColor) {
        if (!this.breedButtonBg || !this.breedButtonBounds) return;
        const {
            x,
            y,
            width: btnWidth,
            height: btnHeight
        } = this.breedButtonBounds;

        this.breedButtonBg.clear();
        this.breedButtonBg.fillStyle(fillColor, 1);
        this.breedButtonBg.fillRoundedRect(x, y, btnWidth, btnHeight, 8);
        this.breedButtonBg.lineStyle(2, borderColor, 1);
        this.breedButtonBg.strokeRoundedRect(x, y, btnWidth, btnHeight, 8);
    }

    setBreedButtonEnabled(enabled) {
        this.breedButtonEnabled = Boolean(enabled);
        if (!this.breedButtonHitZone) return;

        if (this.breedButtonEnabled) {
            this.breedButtonHitZone.setInteractive({ useHandCursor: true });
        } else {
            this.breedButtonHitZone.disableInteractive();
        }
    }

    updateBreedButton() {
        if (!this.breedButton || !this.breedButtonBg || !this.breedButtonHitZone) return;

        const canBreed = this.parent1Data && this.parent2Data;

        // Check cooldown
        const status = this.previewCreatures
            ? { canBreed: true, cooldownRemaining: 0 }
            : getGameState().getBreedingShrineStatus?.() || {
                canBreed: true,
                cooldownRemaining: 0
            };
        const onCooldown = status.cooldownRemaining > 0;
        const awaitingReconciliation =
            status.reconciliationPending > 0;
        const hasCapacity = this.previewCreatures ||
            (getGameState().getCollectionStatus?.().count || 0) <
                (getGameState().getCollectionStatus?.().max || 8);

        if (
            canBreed &&
            status.canBreed !== false &&
            hasCapacity &&
            !awaitingReconciliation
        ) {
            this.drawBreedButtonBackground(0x4B0082, 0xFFD700);
            this.breedButton.setText('BEGIN CURRENT SYNTHESIS');
            this.breedButton.setColor('#FFFFFF');
            this.setBreedButtonEnabled(true);
        } else if (awaitingReconciliation) {
            this.drawBreedButtonBackground(0x333333, 0xFF6666);
            this.breedButton.setText('VERIFY PRIOR LINEAGE');
            this.breedButton.setColor('#FFB3B3');
            this.setBreedButtonEnabled(false);
        } else if (onCooldown) {
            this.drawBreedButtonBackground(0x333333, 0x666666);
            this.breedButton.setText(`⏳ ${this.formatCooldown(status.cooldownRemaining)}`);
            this.breedButton.setColor('#888888');
            this.setBreedButtonEnabled(false);
        } else if (!hasCapacity) {
            this.drawBreedButtonBackground(0x333333, 0xFF6666);
            this.breedButton.setText('Collection Full');
            this.breedButton.setColor('#FF9999');
            this.setBreedButtonEnabled(false);
        } else {
            this.drawBreedButtonBackground(0x333333, 0x666666);
            this.breedButton.setText('SELECT TWO FAMILY RECORDS');
            this.breedButton.setColor('#888888');
            this.setBreedButtonEnabled(false);
        }
    }

    attemptBreeding({ consentReceipt = null } = {}) {
        if (this.breedingInProgress || !this.parent1Data || !this.parent2Data) return;
        if (!consentReceipt && !this.fusionConsentReceipt) {
            this.requestFusionConsent();
            return;
        }
        this.fusionConsentReceipt =
            consentReceipt || this.fusionConsentReceipt;

        const status = this.previewCreatures
            ? { canBreed: true }
            : getGameState().getBreedingShrineStatus?.();
        if (status?.canBreed === false) {
            const message = status.reconciliationPending > 0
                ? 'Reconnect Cloud Save to verify the previous lineage first.'
                : status.cooldownRemaining > 0
                    ? `Fusion recharges in ${this.formatCooldown(status.cooldownRemaining)}`
                    : 'Fusion Pod is not ready';
            this.showBreedingError(message);
            return;
        }

        console.log('[FusionPodScene] Attempting fusion...');
        console.log('Parent 1:', this.parent1Data.name);
        console.log('Parent 2:', this.parent2Data.name);

        this.breedingInProgress = true;
        this.setBreedButtonEnabled(false);
        this.breedButton?.setText?.('SYNTHESIS IN PROGRESS');
        this.breedButton?.setColor?.('#AFC3CF');
        this.drawBreedButtonBackground(0x263245, 0x657682);

        // Show loading
        if (window.UXEnhancements) {
            window.UXEnhancements.showLoading('Creating new life...');
        }

        // Play egg creation sound sequence
        window.AudioManager?.playFusionCreateEgg?.();

        // Particle effect
        const { width, height } = this.scale;
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                count: 30,
                color: [0xFFD700, 0x9370DB, 0xFF69B4],
                duration: 2500
            });
        }

        const parentIds = [this.parent1Data.id, this.parent2Data.id];
        this.fusionOperationId = this.fusionOperationId || (
            this.previewCreatures
                ? `fusion_preview_${Date.now()}`
                : getGameState().createPortableId?.('fusion') ||
                    `fusion_${Date.now()}`
        );
        this.fusionResultSeed = window.FusionAuthority?.deriveResultSeed?.(
            this.fusionOperationId,
            parentIds
        ) || this.fusionOperationId;
        this.fusionOffspringSequence = 0;

        // Perform breeding after dramatic delay
        this.time.delayedCall(2000, async () => {
            try {
                let offspringGenes;
                let offspringInheritance = null;
                let birthResult = { events: [], effects: {}, hasRareEvent: false };
                const restorePreflightRandom =
                    window.FusionAuthority?.enterDeterministicRandomScope?.(
                        `${this.fusionResultSeed}:preflight`,
                        window.Phaser
                    );
                try {
                    const parent1Genes = window.BreedingEngine
                        ?.resolveCreatureGenes?.(this.parent1Data);
                    const parent2Genes = window.BreedingEngine
                        ?.resolveCreatureGenes?.(this.parent2Data);

                    const breedingResult = window.BreedingEngine
                        ?.breedCreaturesWithLineage?.(
                            parent1Genes,
                            parent2Genes
                        );
                    offspringGenes = breedingResult?.genes || parent1Genes;
                    offspringInheritance = breedingResult?.inheritance || null;

                    if (window.BirthEventSystem) {
                        birthResult = window.BirthEventSystem.rollBirthEvents(
                            this.parent1Data,
                            this.parent2Data,
                            'common'
                        );
                    }
                } finally {
                    restorePreflightRandom?.();
                }

                const collectionStatus = this.previewCreatures
                    ? {
                        count: this.previewCreatures.length,
                        max: this.previewCreatures.length + 2
                    }
                    : getGameState().getCollectionStatus?.() || {
                        count: 0,
                        max: 8
                    };
                const offspringCapacity = Math.max(
                    1,
                    Math.min(
                        2,
                        Number(collectionStatus.max) -
                            Number(collectionStatus.count)
                    )
                );
                const transactionResult = this.beginFusionTransaction(
                    offspringCapacity
                );
                if (!transactionResult.success) {
                    throw new Error(this.getFusionFailureMessage(transactionResult));
                }
                this.fusionTransaction = transactionResult.transaction;
                const authorityResult = this.attachFusionAuthorityRequest();
                if (!authorityResult.success) {
                    throw new Error(this.getFusionFailureMessage(authorityResult));
                }
                this.fusionTransaction = authorityResult.transaction;
                const reservationResult = await this.reserveFusionAuthority();
                if (!reservationResult.success) {
                    throw new Error(this.getFusionFailureMessage(reservationResult));
                }
                this.fusionTransaction = reservationResult.transaction;
                const isTwinBirth =
                    this.fusionTransaction.offspringCount === 2;
                birthResult = this.alignLocalBirthResult(
                    birthResult,
                    isTwinBirth
                );
                const executionResult = await this.executeServerFusionOutcome();
                if (!executionResult.success) {
                    throw new Error(this.getFusionFailureMessage(executionResult));
                }
                if (executionResult.execution) {
                    this.fusionTransaction = executionResult.transaction;
                    const hatchData = this.buildServerHatchData(
                        executionResult.execution.outcome
                    );
                    const staged = this.stageFusionHatchData(hatchData);
                    if (!staged.success) {
                        throw new Error(this.getFusionFailureMessage(staged));
                    }
                    this.shutdown();
                    this.scene.start('BreedingHatchScene', hatchData);
                    return;
                }

                const restoreGenerationRandom =
                    window.FusionAuthority?.enterDeterministicRandomScope?.(
                        `${this.fusionResultSeed}:generation`,
                        window.Phaser
                    );
                try {
                    if (isTwinBirth) {
                    console.log('[FusionPodScene] 👯 TWIN BIRTH! Creating two creatures...');

                    // Create TWO separate offspring with individual characteristics
                    const twin1Result = this.createOffspringData(
                        offspringGenes,
                        offspringInheritance
                    );

                    // Generate different genes for twin 2 (another breeding roll)
                    const twin2BreedingResult = window.BreedingEngine
                        ?.breedCreaturesWithLineage?.(
                            window.BreedingEngine.resolveCreatureGenes(this.parent1Data),
                            window.BreedingEngine.resolveCreatureGenes(this.parent2Data)
                        );
                    const twin2Result = this.createOffspringData(
                        twin2BreedingResult?.genes || offspringGenes,
                        twin2BreedingResult?.inheritance || offspringInheritance
                    );

                    // Give twins unique identifiers and slight variations
                    twin1Result.offspringData.isTwin = true;
                    twin1Result.offspringData.twinIndex = 1;
                    twin1Result.offspringData.twinSibling = twin2Result.offspringGenes.id;

                    twin2Result.offspringData.isTwin = true;
                    twin2Result.offspringData.twinIndex = 2;
                    twin2Result.offspringData.twinSibling = twin1Result.offspringGenes.id;

                    // Apply birth events to both twins
                    if (birthResult.events.length > 0) {
                        console.log('[FusionPodScene] 🎉 Birth events for twins:', birthResult.events.map(e => e.name));
                        window.BirthEventSystem?.applyBirthEffects(twin1Result.offspringData, birthResult, this.parent1Data, this.parent2Data);
                        window.BirthEventSystem?.applyBirthEffects(twin2Result.offspringData, birthResult, this.parent1Data, this.parent2Data);
                    }

                    // Check secret abilities for each twin
                    [twin1Result, twin2Result].forEach((twinResult, idx) => {
                        const abilityCheckData = {
                            ...twinResult.offspringData,
                            genes: twinResult.offspringGenes,
                            cosmicAffinity: twinResult.offspringGenes.cosmicAffinity,
                            personality: twinResult.offspringGenes.personality?.core,
                            rarity: twinResult.offspringData.rarity
                        };
                        const unlockedAbilities = window.BirthEventSystem?.checkSecretAbilities(abilityCheckData) || [];
                        if (unlockedAbilities.length > 0) {
                            console.log(`[FusionPodScene] 🌟 Twin ${idx + 1} abilities:`, unlockedAbilities.map(a => a.name));
                            twinResult.offspringData.secretAbilities = unlockedAbilities;
                        }
                    });

                    if (window.UXEnhancements) {
                        window.UXEnhancements.hideLoading();
                    }

                    // Launch BreedingHatchScene with TWIN data. Clean the Pod
                    // explicitly because DOM/canvas overlays must not depend
                    // on a later scene-manager shutdown tick.
                    const hatchData = {
                        isTwinBirth: true,
                        twin1: {
                            offspringGenes: twin1Result.offspringGenes,
                            offspringData: {
                                ...twin1Result.offspringData,
                                creatureId: this.fusionTransaction.offspringIds[0]
                            }
                        },
                        twin2: {
                            offspringGenes: twin2Result.offspringGenes,
                            offspringData: {
                                ...twin2Result.offspringData,
                                creatureId: this.fusionTransaction.offspringIds[1]
                            }
                        },
                        parent1: this.parent1Data,
                        parent2: this.parent2Data,
                        birthEvents: birthResult.events,
                        hasRareEvent: true, // Twins are always a rare event
                        fusionTransaction: this.fusionTransaction,
                        previewOnly: Boolean(this.previewCreatures)
                    };
                    const staged = this.stageFusionHatchData(hatchData);
                    if (!staged.success) {
                        throw new Error(this.getFusionFailureMessage(staged));
                    }
                    this.shutdown();
                    this.scene.start('BreedingHatchScene', hatchData);

                    } else {
                    // Standard single offspring
                    const result = this.createOffspringData(
                        offspringGenes,
                        offspringInheritance
                    );

                    // Apply birth event effects to offspring
                    if (birthResult.events.length > 0) {
                        console.log('[FusionPodScene] 🎉 Birth events triggered:', birthResult.events.map(e => e.name));
                        window.BirthEventSystem?.applyBirthEffects(
                            result.offspringData,
                            birthResult,
                            this.parent1Data,
                            this.parent2Data
                        );
                    }

                    // Check for secret abilities based on creature data
                    const abilityCheckData = {
                        ...result.offspringData,
                        genes: result.offspringGenes,
                        cosmicAffinity: result.offspringGenes.cosmicAffinity,
                        personality: result.offspringGenes.personality?.core,
                        rarity: result.offspringData.rarity
                    };
                    const unlockedAbilities = window.BirthEventSystem?.checkSecretAbilities(abilityCheckData) || [];
                    if (unlockedAbilities.length > 0) {
                        console.log('[FusionPodScene] 🌟 Secret abilities unlocked:', unlockedAbilities.map(a => a.name));
                        result.offspringData.secretAbilities = unlockedAbilities;
                    }

                    if (window.UXEnhancements) {
                        window.UXEnhancements.hideLoading();
                    }

                    // Launch the spectacular BreedingHatchScene
                    const hatchData = {
                        offspringGenes: result.offspringGenes,
                        offspringData: {
                            ...result.offspringData,
                            creatureId: this.fusionTransaction.offspringIds[0]
                        },
                        parent1: this.parent1Data,
                        parent2: this.parent2Data,
                        birthEvents: birthResult.events,
                        hasRareEvent: birthResult.hasRareEvent,
                        fusionTransaction: this.fusionTransaction,
                        previewOnly: Boolean(this.previewCreatures)
                    };
                    const staged = this.stageFusionHatchData(hatchData);
                    if (!staged.success) {
                        throw new Error(this.getFusionFailureMessage(staged));
                    }
                    this.shutdown();
                    this.scene.start('BreedingHatchScene', hatchData);
                    }
                } finally {
                    restoreGenerationRandom?.();
                }

            } catch (error) {
                console.error('[FusionPodScene] Fusion error:', error);
                console.error('[FusionPodScene] Error stack:', error?.stack);
                if (window.UXEnhancements) {
                    window.UXEnhancements.hideLoading();
                }
                const serverReserved =
                    this.fusionTransaction?.authorityReservation
                        ?.reservationMode === 'server_reserved';
                if (
                    this.fusionTransaction &&
                    !this.previewCreatures &&
                    !serverReserved
                ) {
                    getGameState().clearInterruptedFusion?.('generation_failed');
                    this.fusionTransaction = null;
                }
                // Show more helpful error message
                const errorMsg = serverReserved
                    ? 'Connection interrupted. Reserved lineage is safe; re-enter the Pod to resume.'
                    : error?.message || 'Unknown error';
                this.showBreedingError(
                    serverReserved
                        ? errorMsg
                        : `Fusion failed: ${errorMsg.substring(0, 50)}`
                );
            }

            this.breedingInProgress = false;
            if (!this.cleanupComplete) {
                this.updateBreedButton();
            }
        });
    }

    alignLocalBirthResult(birthResult = {}, isTwinBirth = false) {
        const events = (
            Array.isArray(birthResult.events)
                ? birthResult.events
                : []
        ).filter(event => event?.id !== 'twinBirth');
        if (isTwinBirth) {
            events.push({
                id: 'twinBirth',
                name: 'Twin Birth',
                chance: 1,
                rarity: 'ultraRare',
                message: 'Two stable Current signatures emerged.',
                triggeredAt: Date.now()
            });
        }
        return {
            ...birthResult,
            events,
            hasRareEvent: isTwinBirth ||
                Boolean(birthResult.hasRareEvent)
        };
    }

    beginFusionTransaction(offspringCapacity) {
        if (this.previewCreatures) {
            const operationId = this.fusionOperationId || `preview_fusion_${Date.now()}`;
            const candidateOffspringIds = Array.from(
                { length: offspringCapacity },
                (_, index) => (
                    `creature_preview_${Date.now()}_${index + 1}`
                )
            );
            return {
                success: true,
                transaction: {
                    schemaVersion: 2,
                    operationId,
                    parentIds: [this.parent1Data.id, this.parent2Data.id],
                    candidateOffspringIds,
                    offspringCapacity,
                    offspringIds: [...candidateOffspringIds],
                    offspringCount: offspringCapacity,
                    createdAt: Date.now(),
                    resultSeed: this.fusionResultSeed,
                    status: 'pending',
                    consentReceipt: this.fusionConsentReceipt
                }
            };
        }

        return getGameState().beginFusionTransaction?.(
            [this.parent1Data.id, this.parent2Data.id],
            offspringCapacity,
            {
                operationId: this.fusionOperationId,
                resultSeed: this.fusionResultSeed,
                consentReceipt: this.fusionConsentReceipt
            }
        ) || { success: false, reason: 'transaction_unavailable' };
    }

    attachFusionAuthorityRequest() {
        const authority = window.FusionAuthority;
        if (!authority?.createRequest) {
            return {
                success: true,
                transaction: this.fusionTransaction
            };
        }

        let authorityRequest;
        try {
            authorityRequest = authority.createRequest({
                transaction: this.fusionTransaction,
                parents: [this.parent1Data, this.parent2Data],
                expectedSaveRevision: window.CloudSave?.remoteRevision || 0
            });
        } catch (error) {
            return { success: false, reason: 'invalid_authority_request' };
        }

        if (this.previewCreatures) {
            return {
                success: true,
                transaction: {
                    ...this.fusionTransaction,
                    authorityRequest
                }
            };
        }

        return getGameState().attachFusionAuthorityRequest?.(
            this.fusionTransaction.operationId,
            authorityRequest
        ) || { success: false, reason: 'transaction_unavailable' };
    }

    async reserveFusionAuthority() {
        const authorityRequest = this.fusionTransaction?.authorityRequest;
        if (!authorityRequest || !window.FusionAuthority?.reserveOperation) {
            return {
                success: true,
                transaction: this.fusionTransaction
            };
        }

        let reservation;
        try {
            reservation = await window.FusionAuthority.reserveOperation(
                authorityRequest,
                { cloudSave: window.CloudSave }
            );
        } catch (error) {
            return {
                success: false,
                reason: error?.code === '40001'
                    ? 'save_revision_conflict'
                    : 'authority_reservation_rejected'
            };
        }

        if (this.previewCreatures) {
            return {
                success: true,
                transaction: {
                    ...this.fusionTransaction,
                    offspringIds: [...reservation.offspringIds],
                    offspringCount: reservation.offspringCount,
                    authorityReservation: reservation
                }
            };
        }

        return getGameState().attachFusionAuthorityReservation?.(
            this.fusionTransaction.operationId,
            reservation
        ) || { success: false, reason: 'transaction_unavailable' };
    }

    async executeServerFusionOutcome() {
        const authority = window.FusionAuthority;
        const authorityRequest = this.fusionTransaction?.authorityRequest;
        const reservation = this.fusionTransaction?.authorityReservation;
        if (
            !authorityRequest ||
            !reservation ||
            reservation.reservationMode !== 'server_reserved'
        ) {
            return {
                success: true,
                execution: null,
                transaction: this.fusionTransaction
            };
        }
        if (!authority?.executeReservedOperation) {
            return { success: false, reason: 'authority_execution_unavailable' };
        }

        let execution;
        try {
            execution = await authority.executeReservedOperation(
                authorityRequest,
                reservation,
                { cloudSave: window.CloudSave }
            );
        } catch (error) {
            return { success: false, reason: 'authority_execution_rejected' };
        }

        const attached = getGameState().attachFusionAuthorityExecution?.(
            this.fusionTransaction.operationId,
            execution
        ) || { success: false, reason: 'transaction_unavailable' };
        return {
            ...attached,
            execution
        };
    }

    buildServerHatchData(outcome) {
        const common = {
            parent1: this.parent1Data,
            parent2: this.parent2Data,
            birthEvents: outcome.birthEvents || [],
            hasRareEvent: Boolean(outcome.hasRareEvent),
            fusionTransaction: this.fusionTransaction,
            previewOnly: Boolean(this.previewCreatures),
            serverGenerated: true
        };
        if (outcome.isTwinBirth) {
            return {
                ...common,
                isTwinBirth: true,
                twin1: outcome.offspring[0],
                twin2: outcome.offspring[1]
            };
        }
        return {
            ...common,
            offspringGenes: outcome.offspring[0].offspringGenes,
            offspringData: outcome.offspring[0].offspringData
        };
    }

    stageFusionHatchData(hatchData) {
        if (this.previewCreatures) {
            return { success: true, reason: 'preview' };
        }

        const operationId = this.fusionTransaction?.operationId;
        if (!operationId) {
            return { success: false, reason: 'transaction_not_found' };
        }

        let authorityReceipt =
            this.fusionTransaction?.authorityExecution?.receipt || null;
        const authorityRequest = this.fusionTransaction?.authorityRequest;
        if (
            !authorityReceipt &&
            authorityRequest &&
            window.FusionAuthority?.createLocalReceipt
        ) {
            try {
                authorityReceipt = window.FusionAuthority.createLocalReceipt(
                    authorityRequest,
                    hatchData,
                    Date.now(),
                    this.fusionTransaction?.authorityReservation
                );
            } catch (error) {
                return { success: false, reason: 'invalid_authority_receipt' };
            }
        }

        return getGameState().stageFusionResult?.(
            operationId,
            hatchData,
            authorityReceipt
        ) || {
            success: false,
            reason: 'transaction_unavailable'
        };
    }

    getFusionFailureMessage(result = {}) {
        const messages = {
            fusion_in_progress: 'Another fusion is already in progress.',
            locked: 'Fusion Pod is still locked.',
            cooldown: `Fusion recharges in ${this.formatCooldown(result.cooldownRemaining)}`,
            invalid_parents: 'Choose two different creatures.',
            ineligible_parents: 'Both creatures must be adults or elders.',
            collection_capacity: result.required === 2
                ? 'Twin creature found, but two collection spaces are required.'
                : 'Your creature collection is full.',
            transaction_unavailable: 'Fusion records are unavailable. Please return and try again.',
            transaction_not_found: 'Fusion record was interrupted. Please return and try again.',
            invalid_result: 'The new lineage could not be preserved. Please try again.',
            invalid_operation_id: 'Fusion could not create a secure operation record.',
            fusion_consent_required: 'Both companions must approach willingly before Fusion.',
            operation_replayed: 'This Fusion operation has already completed.',
            invalid_authority_request: 'Parent ownership could not be verified.',
            invalid_authority_reservation: 'Fusion authorization could not be saved.',
            invalid_authority_receipt: 'The new lineage proof could not be verified.',
            save_revision_conflict: 'Newer cloud progress was found. Sync before using Fusion.',
            authority_reservation_rejected: 'These parent records could not be authorized.',
            invalid_authority_execution: 'The server lineage result did not match this Fusion.',
            authority_execution_unavailable: 'Fusion generation is temporarily unavailable.',
            authority_execution_rejected: 'The server could not complete this lineage.'
        };
        return messages[result.reason] || 'Fusion could not begin.';
    }

    createOffspringData(mendelianGenes, inheritance = null) {
        this.fusionOffspringSequence = (this.fusionOffspringSequence || 0) + 1;
        const deterministicGenesId = [
            'genes',
            String(this.fusionOperationId || 'fusion')
                .replace(/[^A-Za-z0-9_-]/g, '')
                .slice(0, 96),
            this.fusionOffspringSequence
        ].join('_');

        // Determine generation (max of parents + 1)
        const parent1Gen = this.parent1Data.generation || 1;
        const parent2Gen = this.parent2Data.generation || 1;
        const offspringGen = Math.max(parent1Gen, parent2Gen) + 1;

        // Determine rarity (chance for upgrade based on parents)
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const parent1RarityIdx = rarities.indexOf(this.parent1Data.rarity || 'common');
        const parent2RarityIdx = rarities.indexOf(this.parent2Data.rarity || 'common');
        const avgRarityIdx = Math.floor((parent1RarityIdx + parent2RarityIdx) / 2);

        // Keep the actual roll aligned with the percentage shown in the Pod.
        const compatibility = this.compatibility?.percentage || 50;
        const rarityUpgradeChance = Math.min(
            20 + Math.floor(compatibility / 10),
            40
        ) / 100;
        let offspringRarityIdx = avgRarityIdx;
        if (
            Math.random() < rarityUpgradeChance &&
            avgRarityIdx < rarities.length - 1
        ) {
            offspringRarityIdx = avgRarityIdx + 1;
        }
        const offspringRarity = rarities[offspringRarityIdx];

        // Determine which traits came from which parent
        const inheritedTraits = this.determineInheritedTraits(
            mendelianGenes,
            inheritance
        );

        // Get phenotype and visual config from BreedingEngine
        let phenotype = null;
        let breedingVisualConfig = null;
        if (window.BreedingEngine) {
            phenotype = window.BreedingEngine.getPhenotype(mendelianGenes);
            breedingVisualConfig = window.BreedingEngine.getVisualConfigFromPhenotype(
                phenotype,
                {
                    parent1: this.parent1Data.genes || this.parent1Data.dna,
                    parent2: this.parent2Data.genes || this.parent2Data.dna
                },
                offspringRarity
            );
        }

        // CRITICAL: Generate a full creature using CreatureGenetics to get proper traits
        // structure needed by GraphicsEngine (colorGenome, bodyShape, features)
        let baseGenes = null;
        if (window.CreatureGenetics) {
            // generateCreatureGenetics takes rarity string directly (not an object)
            baseGenes = window.CreatureGenetics.generateCreatureGenetics(offspringRarity);
        }

        // Create full creature genetics by merging base genetics with breeding traits
        const fullGenes = {
            id: deterministicGenesId,
            // Core species and visual data from CreatureGenetics
            species: baseGenes?.species || 'hybrid',
            rarity: offspringRarity,
            cosmicAffinity: baseGenes?.cosmicAffinity || this.blendCosmicAffinity(),
            personality: baseGenes?.personality || { core: 'curious' },
            metadata: {
                ...(baseGenes?.metadata || {}),
                generatedAt: this.fusionTransaction?.createdAt || Date.now(),
                fusionResultSeed: this.fusionResultSeed
            },
            // Traits - merge base genetics traits with breeding visuals
            traits: {
                // CRITICAL: Include colorGenome, bodyShape, features from base for GraphicsEngine
                colorGenome: baseGenes?.traits?.colorGenome || this.generateFallbackColorGenome(offspringRarity),
                bodyShape: baseGenes?.traits?.bodyShape || { type: 'balanced', intensity: 0.5 },
                features: baseGenes?.traits?.features || this.generateFallbackFeatures(),
                // Mendelian breeding traits
                ...(window.BreedingEngine?.getCreatureTraits(mendelianGenes) || {}),
                breedingVisuals: breedingVisualConfig
            },
            // Store Mendelian genes for breeding continuity
            mendelianGenes: mendelianGenes,
            phenotype: phenotype,
            inheritance: inheritance || inheritedTraits.details
        };

        return {
            offspringGenes: fullGenes,
            offspringData: {
                generation: offspringGen,
                rarity: offspringRarity,
                inheritedTraits: inheritedTraits,
                parentIds: [
                    this.parent1Data.id || 'parent1',
                    this.parent2Data.id || 'parent2'
                ],
                parentNames: [
                    this.parent1Data.name,
                    this.parent2Data.name
                ],
                offspringBonus: {
                    cosmicPower: 1.0 + (offspringGen * 0.05), // 5% bonus per generation
                    description: `Dual Descent (Gen ${offspringGen})`
                }
            }
        };
    }

    determineInheritedTraits(mendelianGenes, recordedInheritance = null) {
        const traits = {
            fromParent1: [],
            fromParent2: [],
            details: {}
        };

        const parent1Genes = window.BreedingEngine?.resolveCreatureGenes?.(
            this.parent1Data
        ) || {};
        const parent2Genes = window.BreedingEngine?.resolveCreatureGenes?.(
            this.parent2Data
        ) || {};
        const definitions = window.BreedingEngine?.traitDefinitions || {};

        Object.keys(definitions).forEach(traitKey => {
            const childAlleles = Array.isArray(mendelianGenes?.[traitKey])
                ? mendelianGenes[traitKey]
                : [];
            const explicit = recordedInheritance?.[traitKey];
            const parent1Allele = explicit?.parent1Allele || childAlleles.find(
                allele => parent1Genes[traitKey]?.includes(allele)
            ) || null;
            const parent2Allele = explicit?.parent2Allele || childAlleles.find(
                allele => parent2Genes[traitKey]?.includes(allele) &&
                    allele !== parent1Allele
            ) || childAlleles.find(
                allele => parent2Genes[traitKey]?.includes(allele)
            ) || null;
            const traitName = definitions[traitKey].name;
            const expressedAllele = explicit?.expressedAllele ||
                window.BreedingEngine.getPhenotype({
                    [traitKey]: childAlleles
                })[traitKey];
            const expressedFrom = explicit?.expressedFrom || (
                parent1Allele === parent2Allele
                    ? 'both'
                    : expressedAllele === parent1Allele
                        ? 'parent1'
                        : 'parent2'
            );

            if (expressedFrom === 'parent1' || expressedFrom === 'both') {
                traits.fromParent1.push(traitName);
            }
            if (expressedFrom === 'parent2' || expressedFrom === 'both') {
                traits.fromParent2.push(traitName);
            }
            traits.details[traitKey] = {
                trait: traitName,
                parent1Allele,
                parent2Allele,
                expressedAllele,
                expressedFrom
            };
        });

        return traits;
    }

    blendCosmicAffinity() {
        const affinities = ['star', 'moon', 'nebula', 'crystal', 'void'];
        const p1Affinity = this.parent1Data.cosmicAffinity ||
            this.parent1Data.genes?.cosmicAffinity?.element;
        const p2Affinity = this.parent2Data.cosmicAffinity ||
            this.parent2Data.genes?.cosmicAffinity?.element;

        // 50% chance each parent's affinity, or random if neither has one
        if (p1Affinity && p2Affinity) {
            return Math.random() < 0.5 ? p1Affinity : p2Affinity;
        }
        return p1Affinity || p2Affinity || affinities[Phaser.Math.Between(0, affinities.length - 1)];
    }

    /**
     * Generate fallback color genome when CreatureGenetics is unavailable
     * Blends colors from parents for visual inheritance
     *
     * CRITICAL: Must return plain hex numbers, NOT objects with nested properties!
     * GraphicsEngine expects: { primary: 0x4CAF50, secondary: 0x8BC34A, accent: 0xFFEB3B }
     * Returning objects causes "Maximum call stack size exceeded" in Phaser's Color system.
     */
    generateFallbackColorGenome(rarity) {
        // Get parent colors if available
        const p1Colors = this.parent1Data.genes?.traits?.colorGenome ||
            this.parent1Data.dna?.traits?.colorGenome;
        const p2Colors = this.parent2Data.genes?.traits?.colorGenome ||
            this.parent2Data.dna?.traits?.colorGenome;

        // Rarity-based fallback colors (plain hex numbers)
        const rarityColors = {
            common: { primary: 0x4CAF50, secondary: 0x8BC34A, accent: 0xFFEB3B },
            uncommon: { primary: 0x2196F3, secondary: 0x03A9F4, accent: 0xE1F5FE },
            rare: { primary: 0x9C27B0, secondary: 0xBA68C8, accent: 0xF3E5F5 },
            epic: { primary: 0xFF5722, secondary: 0xFF9800, accent: 0xFFF3E0 },
            legendary: { primary: 0xFFD700, secondary: 0xFFC107, accent: 0xFFF8E1 }
        };

        const baseColors = rarityColors[rarity] || rarityColors.common;

        // Helper to extract hex from potentially nested color objects
        const extractHex = (colorValue, fallback) => {
            if (typeof colorValue === 'number' && !isNaN(colorValue)) {
                return colorValue;
            }
            if (typeof colorValue === 'object' && colorValue !== null) {
                // Handle nested formats: {color: hex}, {hex: hex}, {value: hex}, {primary: hex}
                if (typeof colorValue.color === 'number') return colorValue.color;
                if (typeof colorValue.hex === 'number') return colorValue.hex;
                if (typeof colorValue.value === 'number') return colorValue.value;
                if (typeof colorValue.primary === 'number') return colorValue.primary;
            }
            return fallback;
        };

        // Return PLAIN HEX NUMBERS - not objects!
        return {
            primary: extractHex(p1Colors?.primary, baseColors.primary),
            secondary: extractHex(p2Colors?.secondary, baseColors.secondary),
            accent: extractHex(p1Colors?.accent || p2Colors?.accent, baseColors.accent),
            // Include additional properties expected by GraphicsEngine
            shimmerIntensity: 0.5,
            colorComplexity: 0.5
        };
    }

    /**
     * Generate fallback features when CreatureGenetics is unavailable
     */
    generateFallbackFeatures() {
        return {
            eyeType: {
                type: 'round',
                size: 1.0,
                shine: 0.8
            },
            wings: {
                type: 'feathered',
                size: 0.8
            },
            markings: [],
            wackyMutations: []
        };
    }

    showBreedingSuccess(result) {
        const { width, height } = this.scale;

        // Clear current elements
        this.elements.forEach(el => el?.destroy?.());
        this.elements = [];

        // Recreate overlay
        this.createOverlay(width, height);

        // Success panel
        const panelWidth = Math.min(350, width - 40);
        const panelHeight = 450;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.lineStyle(3, 0xFFD700, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 20);
        panel.setDepth(201);

        // Title
        this.add.text(width / 2, panelY + 35, '🎉 New Life Created! 🎉', {
            fontSize: '20px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);

        // Parent inheritance display
        let y = panelY + 80;

        const offspringData = result.offspringData || {};
        const inherited = offspringData.inheritedTraits || {};

        // From Parent 1
        this.add.text(width / 2, y, `From ${offspringData.parentNames?.[0] || 'Parent 1'}:`, {
            fontSize: '12px',
            color: '#88CCFF'
        }).setOrigin(0.5).setDepth(202);
        y += 20;

        (inherited.fromParent1 || []).forEach(trait => {
            this.add.text(width / 2, y, `• ${trait}`, {
                fontSize: '11px',
                color: '#FFFFFF'
            }).setOrigin(0.5).setDepth(202);
            y += 18;
        });

        y += 10;

        // From Parent 2
        this.add.text(width / 2, y, `From ${offspringData.parentNames?.[1] || 'Parent 2'}:`, {
            fontSize: '12px',
            color: '#FF88CC'
        }).setOrigin(0.5).setDepth(202);
        y += 20;

        (inherited.fromParent2 || []).forEach(trait => {
            this.add.text(width / 2, y, `• ${trait}`, {
                fontSize: '11px',
                color: '#FFFFFF'
            }).setOrigin(0.5).setDepth(202);
            y += 18;
        });

        y += 15;

        // Offspring info
        const rarityColors = {
            common: '#AAAAAA',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FFD700'
        };

        this.add.text(width / 2, y, `Rarity: ${(offspringData.rarity || 'common').toUpperCase()}`, {
            fontSize: '14px',
            color: rarityColors[offspringData.rarity] || '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(202);
        y += 25;

        this.add.text(width / 2, y, `Generation ${offspringData.generation || 2}`, {
            fontSize: '12px',
            color: '#FFD700'
        }).setOrigin(0.5).setDepth(202);
        y += 20;

        // Offspring bonus
        const bonus = offspringData.offspringBonus;
        if (bonus) {
            this.add.text(width / 2, y, `✨ ${bonus.description}`, {
                fontSize: '11px',
                color: '#88FF88'
            }).setOrigin(0.5).setDepth(202);
            y += 18;

            const powerBonus = Math.round((bonus.cosmicPower - 1) * 100);
            if (powerBonus > 0) {
                this.add.text(width / 2, y, `+${powerBonus}% Cosmic Power`, {
                    fontSize: '10px',
                    color: '#AAFFAA'
                }).setOrigin(0.5).setDepth(202);
            }
        }

        // Store result for adding to collection
        this.offspringResult = result;

        // Buttons
        const btnY = panelY + panelHeight - 80;
        const collectionStatus = getGameState().getCollectionStatus?.() || { hasSpace: true };

        if (collectionStatus.hasSpace) {
            const addBtn = this.add.text(width / 2, btnY, '🐾 Add to Collection', {
                fontSize: '16px',
                color: '#FFFFFF',
                backgroundColor: '#00AA00',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setDepth(202).setInteractive();

            addBtn.on('pointerdown', () => {
                this.addOffspringToCollection(result);
            });

            addBtn.on('pointerover', () => addBtn.setStyle({ backgroundColor: '#00DD00' }));
            addBtn.on('pointerout', () => addBtn.setStyle({ backgroundColor: '#00AA00' }));

            // Skip button
            const skipBtn = this.add.text(width / 2, btnY + 45, 'Skip', {
                fontSize: '12px',
                color: '#888888'
            }).setOrigin(0.5).setDepth(202).setInteractive();

            skipBtn.on('pointerdown', () => this.closeScene());
        } else {
            this.add.text(width / 2, btnY, '⚠️ Collection full (8/8)', {
                fontSize: '14px',
                color: '#FF6666'
            }).setOrigin(0.5).setDepth(202);

            const continueBtn = this.add.text(width / 2, btnY + 35, 'Continue', {
                fontSize: '14px',
                color: '#FFFFFF',
                backgroundColor: '#4B0082',
                padding: { x: 25, y: 8 }
            }).setOrigin(0.5).setDepth(202).setInteractive();

            continueBtn.on('pointerdown', () => this.closeScene());
        }

        // Play celebration
        window.AudioManager?.playLevelUp?.();
    }

    addOffspringToCollection(result) {
        const { width, height } = this.scale;

        const offspringGenes = result.offspringGenes || {};
        const offspringData = result.offspringData || {};

        // Generate name
        const namePrefixes = ['Star', 'Moon', 'Nova', 'Cosmic', 'Nebula', 'Crystal'];
        const nameSuffixes = ['ling', 'spark', 'wing', 'heart', 'soul', 'glow'];
        const prefix = namePrefixes[Phaser.Math.Between(0, namePrefixes.length - 1)];
        const suffix = nameSuffixes[Phaser.Math.Between(0, nameSuffixes.length - 1)];
        const offspringName = `${prefix}${suffix}`;

        // Create creature data
        const creatureData = {
            id: `creature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: offspringName,
            genes: offspringGenes,
            dna: offspringGenes,
            personality: null,
            personalityState: null,
            stats: { happiness: 100, energy: 100, health: 100 },
            level: 1,
            experience: 0,
            textureName: null,
            hatchTime: Date.now(),
            lifecycle: {
                birthDate: Date.now(),
                stage: 'baby',
                lastStageChange: Date.now(),
                evolutionHistory: []
            },
            cosmicAffinity: offspringGenes.cosmicAffinity,
            rarity: offspringData.rarity || 'common',
            addedAt: Date.now(),
            isOffspring: true,
            generation: offspringData.generation || 2,
            parentIds: offspringData.parentIds || [],
            offspringBonus: offspringData.offspringBonus || null
        };

        // Add to collection
        const added = getGameState().addCreatureToCollection?.(creatureData);

        if (added) {
            const successMsg = this.add.text(width / 2, height / 2, `✅ ${offspringName} joined your collection!`, {
                fontSize: '18px',
                color: '#00FF00',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(300);

            window.AudioManager?.playPurchase?.();

            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                    count: 20,
                    color: [0x00FF00, 0xFFD700],
                    duration: 1500
                });
            }

            this.time.delayedCall(2500, () => {
                successMsg?.destroy?.();
                this.closeScene();
            });
        } else {
            const errorMsg = this.add.text(width / 2, height / 2, '❌ Failed to add to collection', {
                fontSize: '16px',
                color: '#FF6666'
            }).setOrigin(0.5).setDepth(300);

            window.AudioManager?.playError?.();

            this.time.delayedCall(2000, () => {
                errorMsg?.destroy?.();
                this.closeScene();
            });
        }
    }

    showBreedingError(message) {
        const { width, height } = this.scale;

        const errorText = this.add.text(width / 2, height / 2 + 100, message, {
            fontSize: '14px',
            color: '#FF6666',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: { x: 15, y: 10 }
        }).setOrigin(0.5).setDepth(300);

        this.time.delayedCall(3000, () => errorText.destroy());
        window.AudioManager?.playError?.();
    }

    createCloseButton(width) {
        const closeX = this.panelBounds.x + this.panelBounds.width - 25;
        const closeY = this.panelBounds.y + 20;

        const closeButton = this.add.text(closeX, closeY, '✕', {
            fontSize: '24px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(202).setInteractive();

        closeButton.on('pointerdown', () => this.closeScene());
        closeButton.on('pointerover', () => closeButton.setColor('#FF6666'));
        closeButton.on('pointerout', () => closeButton.setColor('#FFFFFF'));

        this.elements.push(closeButton);
    }

    closeScene() {
        console.log('[FusionPodScene] Closing and returning to GameScene');

        this.releaseSanctuaryOpeningGuard();
        this.shutdown();
        SceneTransitionHelper.stopScene(this, 'FusionPodScene');

        if (this.scene.isPaused?.('GameScene')) {
            SceneTransitionHelper.resumeScene(this, 'GameScene');
            return;
        }

        try {
            this.scene.start('GameScene');
        } catch (error) {
            console.error('[FusionPodScene] Failed to return to GameScene:', error);
        }
    }

    getCreatureColor(genes) {
        if (!genes) return 0x9370DB;

        const rarityColors = {
            common: 0x808080,
            uncommon: 0x00CC00,
            rare: 0x0088FF,
            epic: 0xAA00FF,
            legendary: 0xFFD700
        };

        return rarityColors[genes.rarity] || 0x9370DB;
    }

    formatCooldown(ms) {
        if (!ms || ms <= 0) return 'Ready';
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }

    shutdown() {
        if (this.cleanupComplete) return;
        this.cleanupComplete = true;
        console.log('[FusionPodScene] Shutting down...');

        // Stop fusion music
        window.AudioManager?.stopMusic?.();

        this.closeSelectionModal();
        this.parentSlotElements.forEach(element => element?.destroy?.());
        this.parentSlotElements = [];
        this.fusionConsentModal?.destroy?.();
        this.fusionConsentModal = null;
        this.sharedFusionModal?.destroy?.();
        this.sharedFusionModal = null;
        this.sharedGuardianshipModal?.destroy?.();
        this.sharedGuardianshipModal = null;

        this.elements.forEach(el => {
            try {
                el?.destroy?.();
            } catch (e) {
                // Element might already be destroyed
            }
        });
        this.elements = [];

        if (this.time) {
            this.time.removeAllEvents();
        }

        if (this.tweens) {
            this.tweens.killAll();
        }

        // Clear bonus tween reference
        if (this.bonusLineTween) {
            this.bonusLineTween.stop();
            this.bonusLineTween = null;
        }

        // Clear state
        this.parent1Index = null;
        this.parent1Data = null;
        this.parent2Index = null;
        this.parent2Data = null;
        this.fusionTransaction = null;
        this.fusionOperationId = null;
        this.fusionResultSeed = null;
        this.fusionOffspringSequence = 0;
        this.fusionConsentReceipt = null;
        this.breedingInProgress = false;
        this.breedButtonEnabled = false;
        this.compatibility = null;

        console.log('[FusionPodScene] Cleanup complete');
    }
}

// Export for module systems
export default FusionPodScene;
