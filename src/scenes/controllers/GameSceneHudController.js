import EconomyHudManager from '../../systems/ui/EconomyHudManager.js';
import { getMobileInteractionPromptLayout, getSafeAreaInsets } from '../../systems/MobileControlLayout.js';

const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

export default class GameSceneHudController {
    constructor(gameScene) {
        this.gameScene = gameScene;
    }

    get scene() {
        if (!this.gameScene) {
            throw new Error('GameSceneHudController requires an active scene');
        }

        return this.gameScene;
    }

    get gameState() {
        return window.GameState || null;
    }

    createUI() {
        const scene = this.scene;
        const { width, height } = scene.scale;

        this.createResetButton();

        scene.positionText = scene.add.text(16, 52, 'Position: (0, 0)', {
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            padding: { x: 6, y: 3 }
        });
        scene.positionText.setScrollFactor(0);
        scene.positionText.setDepth(2000);

        scene.statsText = scene.add.text(width - 16, 16, '', {
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            padding: { x: 8, y: 4 },
            align: 'right'
        });
        scene.statsText.setOrigin(1, 0);
        scene.statsText.setScrollFactor(0);
        scene.statsText.setDepth(2000);
        scene.updateStatsDisplay();

        this.createInteractionPrompt(width, height);

        if (!scene.economyHud) {
            scene.economyHud = new EconomyHudManager(scene, {
                economyManager: window.EconomyManager,
                playerProvider: () => scene.player
            });
        }
        scene.economyHud.init();

        this.createDailyBonusButton();
        this.createCombatButton();
        this.createCosmicMiniMap();
        this.createGlowingStatBars();
    }

    createInteractionPrompt(width = this.scene.scale.width, height = this.scene.scale.height) {
        const scene = this.scene;
        if (scene.interactionTextResizeHandler) {
            scene.scale.off?.('resize', scene.interactionTextResizeHandler);
            scene.interactionTextResizeHandler = null;
        }
        scene.interactionText?.destroy?.();
        scene.interactionText = scene.add.text(width / 2, height - 40, '', {
            fontSize: '16px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            align: 'center',
            padding: { x: 10, y: 6 }
        });
        scene.interactionText.setOrigin(0.5);
        scene.interactionText.setScrollFactor(0);
        scene.interactionText.setDepth(3000);
        scene.interactionText.setVisible(false);
        this.layoutInteractionText(width, height);

        scene.interactionTextResizeHandler = gameSize => {
            this.layoutInteractionText(
                Number(gameSize?.width) || scene.scale.width,
                Number(gameSize?.height) || scene.scale.height
            );
        };
        scene.scale.on('resize', scene.interactionTextResizeHandler);
    }

    layoutInteractionText(width, height) {
        const scene = this.scene;
        if (!scene.interactionText?.active) return;

        const isMobile = Boolean(
            scene.mobileControls?.isMobile ||
            window.responsiveManager?.isMobile ||
            width < 768
        );
        if (!isMobile) {
            scene.interactionText.setPosition(width / 2, height - 40);
            scene.interactionText.setOrigin(0.5, 0.5);
            scene.interactionText.setFontSize('16px');
            scene.interactionText.setWordWrapWidth?.(Math.max(240, width - 32));
            scene.interactionText.setDepth(3000);
            return;
        }

        const layout = getMobileInteractionPromptLayout({
            width,
            height,
            safeArea: getSafeAreaInsets()
        });
        scene.interactionText.setPosition(layout.x, layout.y);
        scene.interactionText.setOrigin(0.5, layout.originY);
        scene.interactionText.setFontSize(`${layout.fontSize}px`);
        scene.interactionText.setWordWrapWidth?.(layout.maxWidth);
        scene.interactionText.setDepth(10020);
    }

    createResetButton() {
        const scene = this.scene;
        scene.resetButton = scene.add.text(16, 16, '↺ Re-center', {
            fontSize: '12px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 8, y: 4 }
        });
        scene.resetButton.setScrollFactor(0);
        scene.resetButton.setInteractive({ useHandCursor: true });
        scene.resetButton.on('pointerdown', () => {
            window.AudioManager?.playButtonClick?.();
            const startX = scene.worldWidth / 2;
            const startY = scene.worldHeight / 2;
            if (scene.player) {
                scene.player.setPosition(startX, startY);
                this.gameState?.set('world.currentPosition', { x: startX, y: startY });
            }
        });
    }

    createDailyBonusButton() {
        const scene = this.scene;

        if (!scene.careSystem?.getDailyLoginBonus) {
            return;
        }

        scene.dailyBonusButton?.destroy();
        const button = scene.add.text(scene.scale.width / 2, 12, '', {
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
            padding: { x: 12, y: 4 },
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            align: 'center'
        });
        button.setScrollFactor(0);
        button.setOrigin(0.5, 0);
        button.setDepth(2000);
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', () => this.claimDailyBonus());
        scene.dailyBonusButton = button;
        this.updateDailyBonusButton();
    }

    updateDailyBonusButton() {
        const scene = this.scene;

        if (!scene.dailyBonusButton || !scene.careSystem?.getDailyLoginBonus) {
            return;
        }

        if (scene.mobileHUD?.isVisible) {
            scene.dailyBonusButton.setVisible(false);
            return;
        }

        const bonus = scene.careSystem.getDailyLoginBonus();
        if (!bonus) {
            scene.dailyBonusButton.setVisible(false);
            return;
        }

        const text = bonus.available ?
            `🎁 Cozy Daily Gift Ready! (Streak ${bonus.streak})` :
            `🌙 Come back tomorrow for more cozy coins (${bonus.streak}-day streak)`;
        scene.dailyBonusButton.setVisible(true);
        scene.dailyBonusButton.setText(text);
        scene.dailyBonusButton.setColor(bonus.available ? '#FFD700' : '#FFFFFF');
        scene.dailyBonusButton.setBackgroundColor(bonus.available ? 'rgba(255,215,0,0.25)' : 'rgba(0,0,0,0.55)');
    }

    claimDailyBonus() {
        const scene = this.scene;

        if (!scene.careSystem?.claimDailyLoginBonus) {
            return;
        }

        try {
            const result = scene.careSystem.claimDailyLoginBonus();
            if (result?.success) {
                this.showBonusClaimedMessage();
                this.updateDailyBonusButton();
            } else if (result?.message) {
                scene.showInteractionHint(result.message);
            }
        } catch (error) {
            console.warn('[GameScene] Failed to claim daily bonus', error);
        }
    }

    createCombatButton() {
        const scene = this.scene;
        const isMobile = window.responsiveManager?.isMobile;
        scene.combatCooldown = 0;
        scene.combatCooldownMax = 1200;

        if (!isMobile) {
            return;
        }

        const buttonX = scene.scale.width - 90;
        const buttonY = scene.scale.height - 90;

        scene.combatBg?.destroy();
        scene.combatBg = scene.add.graphics();
        scene.combatBg.setScrollFactor(0);
        scene.combatBg.fillStyle(0xFF6B35, 0.85);
        scene.combatBg.fillCircle(buttonX, buttonY, 40);
        scene.combatBg.lineStyle(3, 0xFFFFFF, 0.8);
        scene.combatBg.strokeCircle(buttonX, buttonY, 40);

        scene.combatText?.destroy();
        scene.combatText = scene.add.text(buttonX, buttonY, '⚡', {
            fontSize: '32px'
        }).setOrigin(0.5);
        scene.combatText.setScrollFactor(0);

        scene.combatCooldownText?.destroy();
        scene.combatCooldownText = scene.add.text(buttonX, buttonY + 35, '0s', {
            fontSize: '14px',
            color: '#FFFFFF'
        }).setOrigin(0.5);
        scene.combatCooldownText.setScrollFactor(0);
        scene.combatCooldownText.setVisible(false);

        const zone = scene.add.zone(buttonX, buttonY, 80, 80).setOrigin(0.5);
        zone.setScrollFactor(0);
        zone.setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => scene.fireCombatProjectile());
        scene.combatButton = zone;
    }

    showWelcomeToastIfNeeded() {
        const scene = this.scene;
        const gameState = this.gameState;

        if (!gameState || !gameState.get('session.showWelcomeToast') || scene.welcomeToastDisplayed) {
            return;
        }

        const creatureName = gameState.get('session.pendingWelcomeName') || gameState.get('creature.name');
        const toast = scene.add.text(scene.scale.width / 2, 120, `Welcome to the sanctuary, ${creatureName}!`, {
            fontSize: '20px',
            color: '#FFD700',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            padding: { x: 20, y: 10 },
            align: 'center'
        }).setOrigin(0.5);
        toast.setScrollFactor(0);
        toast.setDepth(4000);

        scene.tweens.add({
            targets: toast,
            alpha: 0,
            delay: 2200,
            duration: 600,
            onComplete: () => toast.destroy()
        });

        gameState.set('session.showWelcomeToast', false);
        gameState.set('session.pendingWelcomeName', null);
        scene.welcomeToastDisplayed = true;
    }

    showVoidReturnToast(voidScore) {
        const scene = this.scene;
        const { width } = scene.scale;

        const toast = scene.add.text(width / 2, 120, `🌌 Returned from the Void! +${voidScore} coins collected`, {
            fontSize: '18px',
            color: '#E6E6FA',
            backgroundColor: 'rgba(75, 0, 130, 0.85)',
            padding: { x: 20, y: 12 },
            align: 'center'
        }).setOrigin(0.5);
        toast.setScrollFactor(0);
        toast.setDepth(4000);

        toast.y = -50;
        scene.tweens.add({
            targets: toast,
            y: 120,
            duration: 400,
            ease: 'Back.easeOut'
        });

        scene.tweens.add({
            targets: toast,
            alpha: 0,
            delay: 3000,
            duration: 600,
            onComplete: () => toast.destroy()
        });

        window.AudioManager?.playLevelUp?.();

        console.log(`[GameScene] Void return toast shown for ${voidScore} coins`);
    }

    createCosmicMiniMap() {
        const scene = this.scene;
        const size = 120;
        const margin = 16;
        const mapX = scene.scale.width - size - margin;
        const mapY = scene.scale.height - size - margin;

        const background = scene.add.graphics();
        background.setScrollFactor(0);
        background.setDepth(1500);
        background.fillStyle(0x0a0118, 0.8);
        background.fillRoundedRect(mapX, mapY, size, size, 12);
        background.lineStyle(2, 0x00CED1, 0.8);
        background.strokeRoundedRect(mapX, mapY, size, size, 12);

        scene.miniMapPlayerDot?.destroy();
        scene.miniMapPlayerDot = scene.add.circle(mapX + size / 2, mapY + size / 2, 4, 0xFFD700);
        scene.miniMapPlayerDot.setScrollFactor(0);
        scene.miniMapPlayerDot.setDepth(1501);

        scene.cosmicMiniMap = { x: mapX, y: mapY, size, background };
    }

    updateCosmicMiniMap() {
        const scene = this.scene;

        if (!scene.cosmicMiniMap || !scene.miniMapPlayerDot || !scene.player) {
            return;
        }

        const relX = Phaser.Math.Clamp(scene.player.x / scene.worldWidth, 0, 1);
        const relY = Phaser.Math.Clamp(scene.player.y / scene.worldHeight, 0, 1);
        scene.miniMapPlayerDot.setPosition(
            scene.cosmicMiniMap.x + relX * scene.cosmicMiniMap.size,
            scene.cosmicMiniMap.y + relY * scene.cosmicMiniMap.size
        );
    }

    createGlowingStatBars() {
        const scene = this.scene;

        scene.statBarGraphics?.destroy();
        scene.statBarGraphics = scene.add.graphics();
        scene.statBarGraphics.setScrollFactor(0);
        scene.statBarGraphics.setDepth(2000);

        scene.statBars = [
            { key: 'health', color: 0xFF6B6B, label: '❤️', x: 16, y: scene.scale.height - 70, width: 180, height: 14 },
            { key: 'energy', color: 0x4ECDC4, label: '⚡', x: 16, y: scene.scale.height - 50, width: 180, height: 14 }
        ];

        scene.statBarLabels?.forEach(l => l.destroy());
        scene.statBarLabels = scene.statBars.map(bar => {
            return scene.add.text(bar.x + bar.width + 8, bar.y + bar.height / 2, bar.label, {
                fontSize: '14px'
            }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2001);
        });

        this.updateGlowingStatBars();
    }

    updateGlowingStatBars() {
        const scene = this.scene;

        if (!scene.statBarGraphics || !scene.statBars.length) {
            return;
        }

        const stats = this.gameState?.get('creature.stats');
        if (!stats) {
            return;
        }

        scene.statBarGraphics.clear();
        scene.statBars.forEach((bar) => {
            const value = Phaser.Math.Clamp(stats[bar.key] ?? 0, 0, 100);
            const fill = (value / 100) * bar.width;
            scene.statBarGraphics.fillStyle(0x000000, 0.5);
            scene.statBarGraphics.fillRoundedRect(bar.x, bar.y, bar.width, bar.height, 8);
            scene.statBarGraphics.fillStyle(bar.color, 0.8);
            scene.statBarGraphics.fillRoundedRect(bar.x + 2, bar.y + 2, Math.max(0, fill - 4), bar.height - 4, 6);
        });
    }

    showBonusClaimedMessage() {
        const scene = this.scene;

        const bonusText = scene.add.text(400, 100, '🎉 Daily Bonus Claimed!', {
            fontSize: '20px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 16, y: 8 }
        });
        bonusText.setOrigin(0.5);
        bonusText.setScrollFactor(0);

        if (window.UXEnhancements) {
            window.UXEnhancements.announce('Daily bonus claimed successfully!', 'assertive');
        }

        scene.tweens.add({
            targets: bonusText,
            scale: { from: 0.8, to: 1.2 },
            alpha: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                scene.time.delayedCall(2000, () => {
                    scene.tweens.add({
                        targets: bonusText,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => bonusText.destroy()
                    });
                });
            }
        });
    }

    hideDesktopUIOnMobile() {
        const scene = this.scene;

        console.log('[GameScene] Hiding desktop UI elements for mobile');

        if (scene.statsText) {
            scene.statsText.setVisible(false);
        }

        scene.resetButton?.setVisible(false);
        scene.dailyBonusButton?.setVisible(false);
        scene.cosmicMiniMap?.background?.setVisible(false);
        scene.miniMapPlayerDot?.setVisible(false);

        if (scene.statBarGraphics) {
            scene.statBarGraphics.setVisible(false);
        }

        if (scene.personalityText) {
            scene.personalityText.setVisible(false);
        }

        if (scene.positionText) {
            scene.positionText.setVisible(false);
        }

        if (scene.economyHud) {
            if (scene.economyHud.currencyBgImage) {
                scene.economyHud.currencyBgImage.setVisible(false);
            }
            if (scene.economyHud.currencyIcon) {
                scene.economyHud.currencyIcon.setVisible(false);
            }
            if (scene.economyHud.currencyText) {
                scene.economyHud.currencyText.setVisible(false);
            }
        }

        if (scene.combatButton) {
            scene.combatButton.setVisible(false);
        }
        if (scene.combatBg) {
            scene.combatBg.setVisible(false);
        }
        if (scene.combatText) {
            scene.combatText.setVisible(false);
        }
    }
}
