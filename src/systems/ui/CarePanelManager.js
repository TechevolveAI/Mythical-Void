import Phaser from 'phaser';

const getGameState = () => window.GameState;

class CarePanelManager {
    constructor(scene, { careSystem, playerProvider, geneticsProvider } = {}) {
        this.scene = scene;
        this.careSystem = careSystem;
        this.playerProvider = playerProvider;
        this.geneticsProvider = geneticsProvider;

        this.panelVisible = false;
        this.panelElements = [];
        this.careButtons = {};
        this.hintText = null;
    }

    init() {
        this.createHint();
        this.createPanel();
        this.createCareButtons();
        this.updateHint();
    }

    createHint() {
        if (this.hintText) return;
        const { width, height } = this.scene.scale;
        this.hintText = this.scene.add.text(16, height - 16, 'Care Corner loading…', {
            fontSize: '13px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: { x: 10, y: 6 }
        });
        this.hintText.setScrollFactor(0);
        this.hintText.setOrigin(0, 1);
        this.hintText.setDepth(2000);
    }

    createPanel() {
        const textureKey = 'carePanelTexture';
        if (!this.scene.textures.exists(textureKey)) {
            const graphics = this.scene.make.graphics({ add: false });
            graphics.fillStyle(0x0b0a2a, 0.85);
            graphics.fillRoundedRect(0, 0, 320, 420, 16);
            graphics.lineStyle(3, 0xFFD700, 0.8);
            graphics.strokeRoundedRect(0, 0, 320, 420, 16);
            graphics.generateTexture(textureKey, 320, 420);
            graphics.destroy();
        }

        const bg = this.scene.add.image(40, 40, textureKey);
        bg.setOrigin(0, 0);
        bg.setScrollFactor(0);
        bg.setDepth(1900);
        bg.setVisible(false);
        this.panelElements.push(bg);

        const title = this.scene.add.text(200, 60, '💖 Care Corner', {
            fontSize: '20px',
            color: '#FFD700',
            fontFamily: 'Poppins, Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);
        title.setScrollFactor(0);
        title.setDepth(1901);
        title.setVisible(false);
        this.panelElements.push(title);

        const closeButton = this.scene.add.text(340, 50, '✕', {
            fontSize: '22px',
            color: '#FF8A8A',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);
        closeButton.setScrollFactor(0);
        closeButton.setDepth(1901);
        closeButton.setVisible(false);
        closeButton.setInteractive({ useHandCursor: true });
        closeButton.on('pointerdown', () => this.togglePanel());
        this.panelElements.push(closeButton);
    }

    createCareButtons() {
        if (!this.careSystem) return;
        const actions = this.careSystem.getAllCareActionsInfo();
        const startY = 120;
        const spacing = 60;
        let index = 0;
        Object.entries(actions).forEach(([actionType, info]) => {
            const y = startY + index * spacing;
            const button = this.createCareButton(200, y, 240, 50, info.icon || '✨', info.name || actionType, actionType);
            this.careButtons[actionType] = button;
            index++;
        });
    }

    createCareButton(x, y, width, height, icon, label, actionType) {
        const textureKey = 'careButtonTexture';
        if (!this.scene.textures.exists(textureKey)) {
            const graphics = this.scene.make.graphics({ add: false });
            graphics.fillStyle(0x228B22, 0.9);
            graphics.fillRoundedRect(0, 0, width, height, 8);
            graphics.lineStyle(2, 0xFFFFFF, 0.8);
            graphics.strokeRoundedRect(0, 0, width, height, 8);
            graphics.generateTexture(textureKey, width, height);
            graphics.destroy();
        }

        const bg = this.scene.add.image(x - width / 2, y - height / 2, textureKey);
        bg.setOrigin(0, 0);
        bg.setScrollFactor(0);
        bg.setDepth(1900);
        bg.setVisible(false);
        this.panelElements.push(bg);

        const text = this.scene.add.text(x, y + 5, `${icon} ${label}`, {
            fontSize: '14px',
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);
        text.setScrollFactor(0);
        text.setDepth(1901);
        text.setVisible(false);
        this.panelElements.push(text);

        const zone = this.scene.add.zone(x, y, width, height);
        zone.setInteractive({ useHandCursor: true });
        zone.setScrollFactor(0);
        zone.setDepth(1902);
        zone.setVisible(false);
        zone.on('pointerdown', () => this.performAction(actionType));
        this.panelElements.push(zone);

        return { bg, text, zone, actionType };
    }

    togglePanel() {
        this.panelVisible = !this.panelVisible;
        this.panelElements.forEach(el => el.setVisible(this.panelVisible));
        Object.values(this.careButtons).forEach(({ bg, text, zone }) => {
            bg.setVisible(this.panelVisible);
            text.setVisible(this.panelVisible);
            zone.setVisible(this.panelVisible);
        });
        if (this.panelVisible) {
            this.updateButtons();
            if (window.UXEnhancements) {
                window.UXEnhancements.announce('Care Corner open. Tap a button to care for your buddy.');
            }
        }
    }

    async performAction(actionType) {
        if (!this.careSystem) return;
        try {
            const genetics = this.geneticsProvider ? this.geneticsProvider() : null;
            const result = await this.careSystem.performCareAction(actionType, genetics);
            if (result?.success) {
                this.showCareEffect(actionType, result.happinessBonus);
                this.updateButtons();
                this.updateHint();

                // INTEGRATION EXAMPLE: Get creature's response via CreatureAIController
                if (window.CreatureAIController) {
                    try {
                        const response = await window.CreatureAIController.respondToCareAction(actionType);
                        this.showCreatureResponse(response);
                    } catch (error) {
                        console.warn('[CarePanelManager] AI response failed:', error);
                        // Fail silently - care action still succeeded
                    }
                }
            } else {
                const reason = result?.reason || 'Not available right now';
                this.showCareMessage(actionType, 0, reason);
            }
        } catch (error) {
            console.warn('[CarePanelManager] Care action failed', error);
            this.showCareMessage(actionType, 0, 'Action failed');
        }
    }

    /**
     * Show creature's chat response
     */
    showCreatureResponse(response) {
        if (!response) return;

        const player = this.playerProvider ? this.playerProvider() : null;
        const x = player ? player.x : 400;
        const y = player ? player.y + 40 : 360; // Below player

        const bubble = this.scene.add.text(x, y, response, {
            fontSize: '14px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(123, 104, 238, 0.9)',
            padding: { x: 10, y: 8 },
            borderRadius: 10,
            align: 'center',
            wordWrap: { width: 250 },
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);
        bubble.setDepth(4000);

        // Fade in and out
        bubble.setAlpha(0);
        this.scene.tweens.add({
            targets: bubble,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });

        // Auto-dismiss after 3 seconds
        this.scene.time.delayedCall(3000, () => {
            this.scene.tweens.add({
                targets: bubble,
                alpha: 0,
                y: y - 20,
                duration: 500,
                ease: 'Power2',
                onComplete: () => bubble.destroy()
            });
        });
    }

    handleCareEvent(data) {
        if (!data) return;
        this.showCareEffect(data.action, data.happinessBonus);
        this.updateButtons();
        this.updateHint();
    }

    showCareEffect(actionType, happinessBonus) {
        const creatureName = getGameState()?.get('creature.name') || 'your buddy';
        const actionCopy = this.getActionCopy(actionType);
        const message = `${creatureName} ${actionCopy}${happinessBonus ? ` (+${happinessBonus} joy)` : ''}`;

        const player = this.playerProvider ? this.playerProvider() : null;
        const x = player ? player.x : 400;
        const y = player ? player.y - 40 : 300;

        const heart = this.scene.add.text(x, y, `💖 ${message}`, {
            fontSize: '16px',
            color: '#FFD1DC',
            stroke: '#000000',
            strokeThickness: 2,
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: heart,
            y: y - 60,
            alpha: 0,
            duration: 1400,
            ease: 'Sine.easeIn',
            onComplete: () => heart.destroy()
        });
    }

    showCareMessage(actionType, happinessBonus, errorMessage = null) {
        const copy = this.getActionCopy(actionType);
        const text = errorMessage ? `${copy} — ${errorMessage}` : `${copy} +${happinessBonus} joy`;
        const toast = this.scene.add.text(400, 140, text, {
            fontSize: '16px',
            color: errorMessage ? '#FF8A8A' : '#90EE90',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 12, y: 6 },
            align: 'center'
        }).setOrigin(0.5);
        toast.setScrollFactor(0);
        this.scene.tweens.add({
            targets: toast,
            alpha: 0,
            duration: 1200,
            delay: 1200,
            onComplete: () => toast.destroy()
        });
    }

    getActionCopy(actionType) {
        const friendly = {
            feed: 'loved the tasty snack! 🍎',
            play: 'giggles after playtime! 🎲',
            rest: 'is dozing happily. 😴',
            pet: 'purrs after those cuddles! 🤗',
            clean: 'sparkles after the bubble bath! 🫧',
            stats: 'stats ready'
        };
        return friendly[actionType] || 'feels cared for!';
    }

    updateButtons() {
        if (!this.careSystem) return;
        const careActions = this.careSystem.getAllCareActionsInfo();
        Object.entries(this.careButtons).forEach(([actionType, button]) => {
            const info = careActions[actionType];
            if (!info) return;
            const countText = info.isUnlimited ? '∞' : `${info.currentCount}/${info.limit}`;
            const status = info.canPerform ? 'Ready' : 'Later';
            button.text.setText(`${info.icon || '✨'} ${info.name} (${countText}) – ${status}`);
            button.bg.setTintFill(info.canPerform ? 0x228B22 : 0x666666);
        });
    }

    updateHint() {
        if (!this.hintText || !this.careSystem) {
            this.hintText?.setText('Care Corner unavailable');
            return;
        }
        const status = this.careSystem.getCareStatus();
        if (!status) return;
        const feedLeft = 3 - status.dailyCare.feedCount;
        const playLeft = 2 - status.dailyCare.playCount;
        this.hintText.setText(`TAB: open Care Corner • 🍎 Feed ${feedLeft} left • 🎮 Play ${playLeft} left • 😴 Rest anytime`);
    }

    destroy() {
        this.panelElements.forEach(el => el.destroy());
        this.panelElements = [];
        Object.values(this.careButtons).forEach(({ bg, text, zone }) => {
            bg.destroy();
            text.destroy();
            zone.destroy();
        });
        this.careButtons = {};
        this.hintText?.destroy();
        this.hintText = null;
    }
}

export default CarePanelManager;
