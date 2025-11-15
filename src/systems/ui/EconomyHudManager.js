import Phaser from 'phaser';

/**
 * EconomyHudManager - Handles the Cosmic Coin HUD rendering and updates.
 * Responsibilities:
 *  - Create/destroy the HUD visuals.
 *  - Listen to EconomyManager events and animate balance changes.
 *  - Provide floating coin feedback near the player when coins are earned.
 */

export default class EconomyHudManager {
    constructor(scene, { economyManager, playerProvider } = {}) {
        this.scene = scene;
        this.economyManager = economyManager;
        this.playerProvider = playerProvider;

        this.currencyBgImage = null;
        this.currencyIcon = null;
        this.currencyText = null;
        this.iconRotateTween = null;
        this.balanceAnimationTimer = null;
        this.currentDisplayedBalance = 0;

        this.handleCoinsAddedBound = null;
        this.handleCoinsSpentBound = null;
        this.handleCoinsInsufficientBound = null;
    }

    init() {
        const hudX = 784;
        const hudY = 90;

        const bgTexture = this.getHudBackgroundTexture();
        this.currencyBgImage = this.scene.add.image(hudX - 140, hudY - 8, bgTexture);
        this.currencyBgImage.setOrigin(0, 0);
        this.currencyBgImage.setScrollFactor(0);
        this.currencyBgImage.setDepth(1000);

        this.currencyIcon = this.scene.add.image(hudX - 120, hudY + 8, 'cosmicCoin');
        this.currencyIcon.setScale(0.75);
        this.currencyIcon.setScrollFactor(0);
        this.currencyIcon.setDepth(1001);

        this.iconRotateTween = this.scene.tweens.add({
            targets: this.currencyIcon,
            angle: 360,
            duration: 6000,
            repeat: -1,
            ease: 'Linear'
        });

        this.currentDisplayedBalance = this.economyManager ? this.economyManager.getBalance() : 0;
        this.currencyText = this.scene.add.text(
            hudX - 95,
            hudY + 8,
            this.formatCurrencyText(this.currentDisplayedBalance),
            {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                color: '#00CED1',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        this.currencyText.setOrigin(0, 0.5);
        this.currencyText.setScrollFactor(0);
        this.currencyText.setDepth(1001);

        if (this.economyManager) {
            this.handleCoinsAddedBound = this.handleCoinsAddedBound || ((data) => this.handleCoinsAdded(data));
            this.handleCoinsSpentBound = this.handleCoinsSpentBound || ((data) => this.handleCoinsSpent(data));
            this.handleCoinsInsufficientBound = this.handleCoinsInsufficientBound || ((data) => this.handleInsufficientCoins(data));

            this.economyManager.on('coins:added', this.handleCoinsAddedBound);
            this.economyManager.on('coins:spent', this.handleCoinsSpentBound);
            this.economyManager.on('coins:insufficient', this.handleCoinsInsufficientBound);
        }
    }

    getHudBackgroundTexture() {
        const textureKey = 'economyHudBgTexture';
        if (this.scene.textures.exists(textureKey)) {
            return textureKey;
        }

        const width = 140;
        const height = 32;
        const graphics = this.scene.make.graphics({ add: false });
        graphics.fillStyle(0x9370DB, 0.15);
        graphics.fillRoundedRect(0, 0, width, height, 8);
        graphics.lineStyle(2, 0x00CED1, 0.6);
        graphics.strokeRoundedRect(0, 0, width, height, 8);
        graphics.generateTexture(textureKey, width, height);
        graphics.destroy();
        return textureKey;
    }

    handleCoinsAdded(data) {
        this.animateCurrencyChange(data.oldBalance, data.newBalance);

        this.scene.tweens.add({
            targets: this.currencyBgImage,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });

        this.scene.tweens.add({
            targets: this.currencyIcon,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 150,
            ease: 'Back.easeOut',
            yoyo: true
        });

        this.scene.tweens.add({
            targets: this.currencyText,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 200,
            ease: 'Back.easeOut',
            yoyo: true
        });

        this.showFloatingCoinText(data.amount);
    }

    handleCoinsSpent(data) {
        this.animateCurrencyChange(data.oldBalance, data.newBalance);

        if (window.AudioManager && data.reason && data.reason.startsWith('purchase:')) {
            window.AudioManager.playPurchase();
        }

        const originalColor = this.currencyText.style.color;
        this.currencyText.setColor('#FF6347');

        this.scene.time.delayedCall(300, () => {
            this.currencyText.setColor(originalColor);
        });
    }

    handleInsufficientCoins() {
        if (window.AudioManager) {
            window.AudioManager.playError();
        }

        const originalX = this.currencyText.x;

        this.scene.tweens.add({
            targets: [this.currencyText, this.currencyIcon, this.currencyBgImage],
            x: '+=5',
            duration: 50,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.currencyText.x = originalX;
                this.currencyIcon.x = originalX - 25;
            }
        });

        this.currencyText.setColor('#FF0000');
        this.scene.time.delayedCall(500, () => {
            this.currencyText.setColor('#00CED1');
        });
    }

    animateCurrencyChange(oldBalance, newBalance) {
        if (this.balanceAnimationTimer) {
            this.balanceAnimationTimer.remove();
            this.balanceAnimationTimer = null;
        }

        const duration = 500;
        const steps = 20;
        const stepDuration = duration / steps;
        const balanceDiff = newBalance - oldBalance;
        const stepAmount = balanceDiff / steps;

        let currentStep = 0;

        this.currentDisplayedBalance = oldBalance;
        this.balanceAnimationTimer = this.scene.time.addEvent({
            delay: stepDuration,
            callback: () => {
                currentStep++;
                this.currentDisplayedBalance += stepAmount;

                if (currentStep >= steps) {
                    this.currentDisplayedBalance = newBalance;
                    this.balanceAnimationTimer?.remove();
                    this.balanceAnimationTimer = null;
                }

                this.currencyText.setText(
                    this.formatCurrencyText(Math.floor(this.currentDisplayedBalance))
                );
            },
            repeat: steps - 1
        });
    }

    showFloatingCoinText(amount) {
        const player = typeof this.playerProvider === 'function' ? this.playerProvider() : null;
        if (!player) return;

        const offsetX = Phaser.Math.Between(-20, 20);
        const startX = player.x + offsetX;
        const startY = player.y - 30;

        const floatingText = this.scene.add.text(startX, startY, `+${amount}`, {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: 'rgba(0, 0, 0, 0.7)',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);

        floatingText.setScrollFactor(1);
        floatingText.setDepth(1000);

        this.scene.tweens.add({
            targets: floatingText,
            y: startY - 80,
            alpha: { from: 1, to: 0 },
            scale: { from: 1, to: 1.5 },
            duration: 1500,
            ease: 'Power2',
            onComplete: () => floatingText.destroy()
        });

        this.scene.tweens.add({
            targets: floatingText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            ease: 'Back.easeOut',
            yoyo: true
        });
    }

    formatCurrencyText(amount) {
        if (this.economyManager && typeof this.economyManager.formatCoins === 'function') {
            return this.economyManager.formatCoins(amount);
        }
        return Math.floor(amount).toLocaleString();
    }

    destroy() {
        if (this.economyManager) {
            this.economyManager.off('coins:added', this.handleCoinsAddedBound);
            this.economyManager.off('coins:spent', this.handleCoinsSpentBound);
            this.economyManager.off('coins:insufficient', this.handleCoinsInsufficientBound);
        }

        this.handleCoinsAddedBound = null;
        this.handleCoinsSpentBound = null;
        this.handleCoinsInsufficientBound = null;

        this.balanceAnimationTimer?.remove();
        this.balanceAnimationTimer = null;

        if (this.iconRotateTween) {
            this.iconRotateTween.stop();
            this.iconRotateTween.remove();
            this.iconRotateTween = null;
        }

        this.currencyBgImage?.destroy();
        this.currencyIcon?.destroy();
        this.currencyText?.destroy();

        this.currencyBgImage = null;
        this.currencyIcon = null;
        this.currencyText = null;
    }
}
