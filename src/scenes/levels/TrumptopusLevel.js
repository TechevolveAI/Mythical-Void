import Approach from '../../dev/TrumptopusApproachPreview.js';
import Campaign from '../../dev/TrumptopusCampaignPreview.js';
import { TrumptopusSessionMenu } from '../../ui/TrumptopusSessionMenu.js';

// The production shell supplies lifecycle and real loadout behaviour around
// the same encounter, art and completion used by the private proofs.
export function withCampaignRuntime(Base) {
    return class extends Base {
        constructor(key) {
            super(key);
            this.productionFinale = true;
            this.levelId = 'final_void_1';
        }

        create() {
            super.create();
            this.sessionMenu = null;
            this.sceneSize = { width: this.scale.width, height: this.scale.height };
            this.pauseButton = this.add.text(this.scale.width - 16, 18, 'II', {
                fontFamily: 'Arial', fontSize: '22px', color: '#f2f4ed',
                backgroundColor: '#11201f', padding: { x: 17, y: 12 }
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(10002)
                .setInteractive({ useHandCursor: true })
                .on('pointerup', () => this.showPauseMenu());
            this.energyText = this.add.text(18, 147, '', {
                fontFamily: 'Arial', fontSize: '13px', color: '#c4d7d0'
            }).setScrollFactor(0).setDepth(10001);
            this.updateEnergyDisplay();
            this.onFinaleKey = event => {
                if (event.key !== 'Escape' || !this.scene.isActive() || this.levelCompletionActive) return;
                event.preventDefault(); event.stopImmediatePropagation();
                if (this.pauseMenuActive) this.hidePauseMenu();
                else this.showPauseMenu();
            };
            window.addEventListener('keydown', this.onFinaleKey, true);
            this.onFinaleResize = () => {
                // Restart from a durable checkpoint after an orientation change;
                // never leave collision in the old viewport or interrupt a film.
                if (!this.scene.isActive() || this.pauseMenuActive || this.levelCompletionActive) return;
                if (this.sceneSize.width === this.scale.width && this.sceneSize.height === this.scale.height) return;
                this.completion.saveProgress();
                this.clearInput();
                this.scene.restart();
            };
            this.scale.on('resize', this.onFinaleResize);
            this.events.on('resume', this.onFinaleResize);
            this.events.once('shutdown', () => {
                this.sessionMenu?.close();
                this.sessionMenu = null;
                this.scale.off('resize', this.onFinaleResize);
                this.events.off('resume', this.onFinaleResize);
                window.removeEventListener('keydown', this.onFinaleKey, true);
                this.clearPauseMenuElements();
                this.stopInvincibilityFlash?.();
                this.pauseMenuActive = false;
                // The base owns the follower and input. Release its other
                // scene-local graphics resources without changing player data.
                this.graphicsEngine?.destroy?.();
            });
        }

        updateHealthDisplay() {
            this.healthText?.setText(`Health ${this.health} / ${this.maxHealth}`);
        }

        updateEnergyDisplay() {
            this.energyText?.setText(`Energy ${this.crystalEnergy} / ${this.maxCrystalEnergy}`);
        }

        showPauseMenu() {
            if (this.pauseMenuActive || this.levelCompletionActive || this.isPlayerDead) return;
            this.openSessionMenu(false);
        }

        openSessionMenu(defeated) {
            this.clearInput();
            this.setPrototypePaused(true);
            this.pauseMenuActive = true;
            this.hidePlatformerMobileControls();
            this.sessionMenu?.close();
            this.sessionMenu = new TrumptopusSessionMenu({
                defeated,
                onResume: () => this.hidePauseMenu(),
                onRetry: () => {
                    this.completion.saveProgress();
                    this.sessionMenu?.close();
                    this.scene.restart();
                },
                onPowerups: () => {
                    this.sessionMenu?.close();
                    this.sessionMenu = null;
                    this.showPowerupMenu();
                },
                onExit: () => {
                    this.completion.saveProgress();
                    this.sessionMenu?.close();
                    this.returnToHub();
                }
            });
        }

        hidePauseMenu() {
            if (this.isPlayerDead) return;
            this.sessionMenu?.close();
            this.sessionMenu = null;
            this.clearPauseMenuElements();
            this.pauseMenuActive = false;
            this.clearInput();
            this.setPrototypePaused(false);
            this.showPlatformerMobileControls();
            this.onFinaleResize?.();
        }

        showPowerupMenu() {
            super.showPowerupMenu();
            this.pauseMenuElements.forEach(item => item.setDepth(item.depth + 20000));
        }

        onPlayerDeath() {
            if (this.isPlayerDead) return;
            this.isPlayerDead = true;
            this.openSessionMenu(true);
        }

        enterLevelCompletionState() {
            this.pauseButton?.setVisible(false);
            this.energyText?.setVisible(false);
            return super.enterLevelCompletionState();
        }

        returnToHub() {
            this.completion.saveProgress();
            this.clearInput();
            this.scene.start('HubWorldScene');
        }
    };
}

export class TrumptopusArenaLevel extends withCampaignRuntime(Campaign) {
    constructor() { super('TrumptopusArena'); }
}

export default class TrumptopusLevel extends withCampaignRuntime(Approach) {
    constructor() {
        super('FinalVoidLevel');
        this.arenaSceneKey = 'TrumptopusArena';
    }

    create() {
        if (!this.game.scene.keys.TrumptopusArena) {
            this.game.scene.add('TrumptopusArena', TrumptopusArenaLevel, false);
        }
        super.create();
    }
}
