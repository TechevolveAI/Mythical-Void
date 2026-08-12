/**
 * QuestTracker - UI component for displaying active quests
 * Shows quest progress and allows claiming rewards
 */

export default class QuestTracker {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.questItems = [];
        this.isExpanded = false;
        this.isMinimized = false;
        this.storyBannerElements = [];
        this.storyBannerTimer = null;
        this.storyBriefingQueueTimer = null;

        this.unsubscribers = [];
    }

    /**
     * Create the quest tracker UI
     */
    create() {
        const { width, height } = this.scene.scale;
        const isMobile = width < 600;

        // Position below the status block so the control remains visible and tappable.
        this.x = width - (isMobile ? 15 : 20);
        this.y = isMobile ? 145 : 155;

        // Container for all quest UI elements
        this.container = this.scene.add.container(this.x, this.y);
        this.container.setScrollFactor(0);
        this.container.setDepth(12000);

        // Create minimized button (always visible)
        this.createMinimizedButton(isMobile);

        // Create expanded panel (hidden by default)
        this.createExpandedPanel(isMobile);

        // Initially show minimized
        this.showMinimized();

        // Listen for quest updates
        this.setupEventListeners();

        // Initial update
        this.updateQuestDisplay();
        this.advanceCompletedStoryQuest();

        console.log('[QuestTracker] Created quest tracker UI');
    }

    /**
     * Create the minimized quest button
     */
    createMinimizedButton(isMobile) {
        const btnWidth = isMobile ? 50 : 60;
        const btnHeight = isMobile ? 50 : 60;

        // Button background
        this.minimizedBtn = this.scene.add.graphics();
        this.minimizedBtn.fillStyle(0x4B0082, 0.9);
        this.minimizedBtn.fillRoundedRect(-btnWidth, 0, btnWidth, btnHeight, 10);
        this.minimizedBtn.lineStyle(2, 0x9370DB);
        this.minimizedBtn.strokeRoundedRect(-btnWidth, 0, btnWidth, btnHeight, 10);
        this.container.add(this.minimizedBtn);

        // Quest icon
        this.minimizedIcon = this.scene.add.text(-btnWidth / 2, btnHeight / 2 - 5, '📜', {
            fontSize: isMobile ? '24px' : '28px'
        }).setOrigin(0.5);
        this.container.add(this.minimizedIcon);

        // Quest count badge
        this.questCountBadge = this.scene.add.graphics();
        this.container.add(this.questCountBadge);

        this.questCountText = this.scene.add.text(-btnWidth + 10, 5, '0', {
            fontSize: '12px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.container.add(this.questCountText);

        // Claimable indicator (pulsing)
        this.claimableIndicator = this.scene.add.graphics();
        this.claimableIndicator.fillStyle(0x00FF00, 1);
        this.claimableIndicator.fillCircle(-btnWidth + 10, btnHeight - 10, 8);
        this.claimableIndicator.setVisible(false);
        this.container.add(this.claimableIndicator);

        // Interactive zone
        this.minimizedZone = this.scene.add.zone(-btnWidth / 2, btnHeight / 2, btnWidth, btnHeight);
        this.minimizedZone.setInteractive({ useHandCursor: true });
        this.container.add(this.minimizedZone);

        this.minimizedZone.on('pointerdown', () => {
            this.toggleExpanded();
        });

        // Pulse animation for claimable
        this.scene.tweens.add({
            targets: this.claimableIndicator,
            alpha: { from: 1, to: 0.3 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * Create the expanded quest panel
     */
    createExpandedPanel(isMobile) {
        const panelWidth = isMobile ? 280 : 320;
        const panelHeight = isMobile ? 300 : 350;

        // Panel container (offset to the left)
        this.expandedPanel = this.scene.add.container(-panelWidth - 10, 0);
        this.expandedPanel.setVisible(false);
        this.container.add(this.expandedPanel);

        // Background
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x1A0A2E, 0.95);
        bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 15);
        bg.lineStyle(3, 0x6B00B3);
        bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 15);
        this.expandedPanel.add(bg);

        // Header
        const header = this.scene.add.text(panelWidth / 2, 25, '📜 Active Quests', {
            fontSize: isMobile ? '18px' : '22px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.expandedPanel.add(header);

        // Quest list container (scrollable area)
        this.questListContainer = this.scene.add.container(15, 55);
        this.expandedPanel.add(this.questListContainer);

        // Close button
        const closeBtn = this.scene.add.text(panelWidth - 15, 15, '✕', {
            fontSize: '20px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        closeBtn.on('pointerdown', () => {
            this.showMinimized();
        });

        closeBtn.on('pointerover', () => closeBtn.setColor('#FF6666'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#FFFFFF'));

        this.expandedPanel.add(closeBtn);

        // Store dimensions
        this.panelWidth = panelWidth;
        this.panelHeight = panelHeight;
        this.isMobile = isMobile;
    }

    /**
     * Update the quest display
     */
    updateQuestDisplay() {
        if (!window.QuestManager) return;

        const activeQuests = window.QuestManager.getActiveQuests();
        const claimableQuests = window.QuestManager.getClaimableQuests();

        // Update badge count (show claimable count if any, otherwise active count)
        const badgeCount = claimableQuests.length > 0 ? claimableQuests.length : activeQuests.length;
        this.questCountText.setText(badgeCount.toString());

        // Update badge color
        this.questCountBadge.clear();
        if (claimableQuests.length > 0) {
            this.questCountBadge.fillStyle(0x00FF00, 1);
            this.claimableIndicator.setVisible(true);
        } else {
            this.questCountBadge.fillStyle(0xFF6600, 1);
            this.claimableIndicator.setVisible(false);
        }
        this.questCountBadge.fillCircle(this.isMobile ? -40 : -50, 10, 12);

        // Update expanded panel quest list
        this.updateQuestList(activeQuests);
    }

    /**
     * Update the quest list in expanded panel
     */
    updateQuestList(quests) {
        // Clear existing quest items
        this.questListContainer.removeAll(true);
        this.questItems = [];

        const itemHeight = this.isMobile ? 65 : 70;
        const itemWidth = this.panelWidth - 30;
        const maxVisible = Math.floor((this.panelHeight - 80) / itemHeight);

        // Show quests (prioritize claimable, then in-progress)
        const sortedQuests = [...quests].sort((a, b) => {
            if (a.type === 'story' && b.type !== 'story') return -1;
            if (b.type === 'story' && a.type !== 'story') return 1;
            if (a.completed && !a.claimed) return -1;
            if (b.completed && !b.claimed) return 1;
            return (b.progress / b.objective.target) - (a.progress / a.objective.target);
        });

        sortedQuests.slice(0, maxVisible).forEach((quest, index) => {
            const y = index * itemHeight;
            const questItem = this.createQuestItem(quest, 0, y, itemWidth, itemHeight - 5);
            this.questListContainer.add(questItem);
            this.questItems.push(questItem);
        });

        // Show "more quests" indicator if needed
        if (sortedQuests.length > maxVisible) {
            const moreText = this.scene.add.text(
                itemWidth / 2,
                maxVisible * itemHeight,
                `+${sortedQuests.length - maxVisible} more quests...`,
                {
                    fontSize: '12px',
                    color: '#888888'
                }
            ).setOrigin(0.5, 0);
            this.questListContainer.add(moreText);
        }
    }

    /**
     * Create a single quest item
     */
    createQuestItem(quest, x, y, width, height) {
        const container = this.scene.add.container(x, y);

        // Background
        const bg = this.scene.add.graphics();
        const isClaimable = quest.completed && !quest.claimed;

        if (isClaimable) {
            bg.fillStyle(0x006600, 0.8);
            bg.lineStyle(2, 0x00FF00);
        } else {
            bg.fillStyle(0x2A0040, 0.8);
            bg.lineStyle(1, 0x4B0082);
        }
        bg.fillRoundedRect(0, 0, width, height, 8);
        bg.strokeRoundedRect(0, 0, width, height, 8);
        container.add(bg);

        // Icon
        const icon = this.scene.add.text(15, height / 2, quest.icon || '📋', {
            fontSize: '20px'
        }).setOrigin(0.5);
        container.add(icon);

        // Quest name
        const name = this.scene.add.text(35, 8, quest.name, {
            fontSize: this.isMobile ? '12px' : '14px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        });
        container.add(name);

        // Progress bar
        const progressBarWidth = width - 50;
        const progressBarHeight = 8;
        const progressX = 35;
        const progressY = height - 20;

        const progressBg = this.scene.add.graphics();
        progressBg.fillStyle(0x333333, 1);
        progressBg.fillRoundedRect(progressX, progressY, progressBarWidth, progressBarHeight, 4);
        container.add(progressBg);

        const progressPercent = Math.min(1, (quest.progress || 0) / quest.objective.target);
        const progressFill = this.scene.add.graphics();
        progressFill.fillStyle(isClaimable ? 0x00FF00 : 0x9370DB, 1);
        progressFill.fillRoundedRect(progressX, progressY, progressBarWidth * progressPercent, progressBarHeight, 4);
        container.add(progressFill);

        // Progress text
        const progressText = this.scene.add.text(
            progressX + progressBarWidth + 5,
            progressY + progressBarHeight / 2,
            `${quest.progress || 0}/${quest.objective.target}`,
            {
                fontSize: '10px',
                color: '#AAAAAA'
            }
        ).setOrigin(0, 0.5);
        container.add(progressText);

        // Reward preview
        let rewardStr = '';
        if (quest.rewards?.coins) rewardStr += `${quest.rewards.coins}🪙 `;
        if (quest.rewards?.xp) rewardStr += `${quest.rewards.xp}XP`;

        const reward = this.scene.add.text(width - 10, 10, rewardStr, {
            fontSize: '10px',
            color: '#FFD700'
        }).setOrigin(1, 0);
        container.add(reward);

        // Claim button for completed quests
        if (isClaimable) {
            const claimBtn = this.scene.add.text(width - 10, height - 15, 'CLAIM', {
                fontSize: '12px',
                color: '#00FF00',
                backgroundColor: '#004400',
                padding: { x: 8, y: 3 }
            }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

            claimBtn.on('pointerdown', () => {
                this.claimQuest(quest);
            });

            claimBtn.on('pointerover', () => claimBtn.setStyle({ backgroundColor: '#006600' }));
            claimBtn.on('pointerout', () => claimBtn.setStyle({ backgroundColor: '#004400' }));

            container.add(claimBtn);
        }

        return container;
    }

    /**
     * Claim a quest reward
     */
    claimQuest(quest, { showRewardAnimation = true } = {}) {
        if (!window.QuestManager) return;

        const rewards = window.QuestManager.claimReward(quest.questId);

        if (rewards) {
            // Show celebration
            if (showRewardAnimation) {
                this.showClaimAnimation(rewards);
            }

            // Play sound
            if (window.AudioManager) {
                window.AudioManager.playAchievement?.() || window.AudioManager.playLevelUp?.();
            }

            // Update display
            this.updateQuestDisplay();
        }
    }

    /**
     * Show claim animation
     */
    showClaimAnimation(rewards) {
        const { width, height } = this.scene.scale;

        // Reward text in center of screen
        let rewardStr = '🎉 Quest Complete! 🎉\n';
        if (rewards.coins) rewardStr += `+${rewards.coins} Coins `;
        if (rewards.xp) rewardStr += `+${rewards.xp} XP`;

        const rewardText = this.scene.add.text(width / 2, height / 2, rewardStr, {
            fontSize: '24px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(14520).setAlpha(0);

        // Animate
        this.scene.tweens.add({
            targets: rewardText,
            alpha: 1,
            scale: { from: 0.5, to: 1.2 },
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.time.delayedCall(1500, () => {
                    this.scene.tweens.add({
                        targets: rewardText,
                        alpha: 0,
                        y: height / 2 - 50,
                        duration: 500,
                        onComplete: () => rewardText.destroy()
                    });
                });
            }
        });

        // Particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this.scene, width / 2, height / 2, {
                count: 25,
                color: [0xFFD700, 0xFFA500, 0xFFFFFF],
                duration: 2000
            });
        }
    }

    /**
     * Toggle expanded/minimized state
     */
    toggleExpanded() {
        if (this.isExpanded) {
            this.showMinimized();
        } else {
            this.showExpanded();
        }

        // Play sound
        if (window.AudioManager) {
            window.AudioManager.playButtonClick?.();
        }
    }

    /**
     * Show expanded panel
     */
    showExpanded() {
        this.isExpanded = true;
        this.expandedPanel.setVisible(true);
        this.updateQuestDisplay();

        // Animate in
        this.scene.tweens.add({
            targets: this.expandedPanel,
            alpha: { from: 0, to: 1 },
            x: { from: -this.panelWidth - 50, to: -this.panelWidth - 10 },
            duration: 200,
            ease: 'Power2'
        });
    }

    /**
     * Show minimized button
     */
    showMinimized() {
        this.isExpanded = false;

        // Animate out
        this.scene.tweens.add({
            targets: this.expandedPanel,
            alpha: 0,
            x: -this.panelWidth - 50,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                this.expandedPanel.setVisible(false);
            }
        });
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        if (window.QuestManager) {
            const progressUnsub = window.QuestManager.on('questProgressUpdated', () => {
                this.updateQuestDisplay();
            });

            const completedUnsub = window.QuestManager.on('questCompleted', (data) => {
                this.updateQuestDisplay();
                this.showQuestCompleteNotification(data.quest);
                if (data.quest?.type === 'story') {
                    this.claimQuest(data.quest, { showRewardAnimation: false });
                }
            });

            const claimedUnsub = window.QuestManager.on('questRewardClaimed', ({ quest } = {}) => {
                this.updateQuestDisplay();
                if (quest?.type === 'story') {
                    const nextQuest = window.QuestManager.getQuestsByType('story')[0];
                    if (nextQuest) {
                        if (nextQuest.completed && !nextQuest.claimed) {
                            this.claimQuest(nextQuest, { showRewardAnimation: false });
                        } else {
                            this.scheduleStoryMissionBriefing(nextQuest);
                        }
                    }
                }
            });

            this.unsubscribers.push(progressUnsub, completedUnsub, claimedUnsub);
        }
    }

    advanceCompletedStoryQuest() {
        const storyQuest = window.QuestManager?.getQuestsByType?.('story')?.[0];
        if (storyQuest?.completed && !storyQuest.claimed) {
            this.claimQuest(storyQuest, { showRewardAnimation: false });
        }
    }

    /**
     * Show notification when quest is completed
     */
    showQuestCompleteNotification(quest) {
        const { width } = this.scene.scale;
        const isMobile = width < 600;

        // Flash the minimized button
        this.scene.tweens.add({
            targets: this.minimizedBtn,
            alpha: { from: 1, to: 0.5 },
            duration: 200,
            yoyo: true,
            repeat: 3
        });

        const label = quest.type === 'story' ? 'FIELD MISSION COMPLETE' : 'QUEST COMPLETE';
        const startY = isMobile ? 215 : 60;
        const fieldNote = quest.type === 'story' && quest.fieldNote ?
            `\n"${quest.fieldNote}"` :
            '';
        const notification = this.scene.add.text(
            width / 2,
            startY,
            `${label}\n${quest.name}${fieldNote}`,
            {
                fontSize: isMobile ? '15px' : '18px',
                color: '#00FF00',
                fontStyle: 'bold',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: { x: 20, y: 10 },
                align: 'center',
                wordWrap: { width: Math.min(420, width - 40) }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(14520).setAlpha(0);

        this.scene.tweens.add({
            targets: notification,
            alpha: 1,
            y: startY + 20,
            duration: 300,
            onComplete: () => {
                this.scene.time.delayedCall(2500, () => {
                    this.scene.tweens.add({
                        targets: notification,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => notification.destroy()
                    });
                });
            }
        });
    }

    /**
     * Show a non-blocking authored briefing for the active Project Beacon mission.
     */
    showStoryMissionBriefing(quest, { forceMobile = false } = {}) {
        if (!quest || quest.type !== 'story') return;

        this.clearScheduledStoryMissionBriefing();
        this.clearStoryMissionBriefing();

        const { width, height } = this.scene.scale;
        const isMobile = forceMobile || width < 600;
        const panelWidth = Math.min(isMobile ? 330 : 440, width - 24);
        const guidance = isMobile ?
            (quest.guidanceMobile || quest.guidanceDesktop) :
            (quest.guidanceDesktop || quest.guidanceMobile);
        const authoredLength = `${quest.briefing || quest.description || ''} ${guidance || ''}`.length;
        const hasLongCopy = authoredLength > 180;
        const panelHeight = isMobile
            ? (hasLongCopy ? 220 : 184)
            : (hasLongCopy ? 190 : 166);
        const panelX = (width - panelWidth) / 2;
        const mobilePanelLimit = Math.max(12, height - panelHeight - 150);
        const panelY = isMobile ? Math.min(190, mobilePanelLimit) : 76;
        const depth = 14500;

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x081720, 0.96);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.lineStyle(2, 0x66C7D4, 0.95);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.setScrollFactor(0).setDepth(depth);

        const eyebrow = this.scene.add.text(
            panelX + 16,
            panelY + 13,
            'PROJECT BEACON // NEW FIELD MISSION',
            {
                fontSize: isMobile ? '10px' : '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#66C7D4',
                fontStyle: 'bold'
            }
        ).setScrollFactor(0).setDepth(depth + 1);

        const title = this.scene.add.text(
            panelX + 16,
            panelY + 34,
            `${quest.icon || '📡'} ${quest.name}`,
            {
                fontSize: isMobile ? '16px' : '18px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold',
                wordWrap: { width: panelWidth - 52 }
            }
        ).setScrollFactor(0).setDepth(depth + 1);

        const objective = this.scene.add.text(
            panelX + 16,
            panelY + 62,
            `OBJECTIVE // ${quest.objectiveLabel || quest.description}`,
            {
                fontSize: isMobile ? '11px' : '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#8FE3CF',
                fontStyle: 'bold',
                wordWrap: { width: panelWidth - 32 }
            }
        ).setScrollFactor(0).setDepth(depth + 1);

        const briefing = this.scene.add.text(
            panelX + 16,
            panelY + 86,
            quest.briefing || quest.description,
            {
                fontSize: isMobile ? '12px' : '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#D6EEF2',
                lineSpacing: 2,
                wordWrap: { width: panelWidth - 32 }
            }
        ).setScrollFactor(0).setDepth(depth + 1);

        const instruction = this.scene.add.text(
            panelX + 16,
            panelY + panelHeight - 16,
            guidance || quest.description,
            {
                fontSize: isMobile ? '11px' : '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#F2C14E',
                fontStyle: 'bold',
                wordWrap: { width: panelWidth - 32 }
            }
        ).setOrigin(0, 1).setScrollFactor(0).setDepth(depth + 1);

        const close = this.scene.add.text(panelX + panelWidth - 16, panelY + 16, '×', {
            fontSize: '22px',
            color: '#A8C2C7'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2)
            .setInteractive({ useHandCursor: true });
        close.on('pointerdown', () => this.clearStoryMissionBriefing());

        this.storyBannerElements = [
            panel,
            eyebrow,
            title,
            objective,
            briefing,
            instruction,
            close
        ];
        this.storyBannerElements.forEach(element => element.setAlpha(0));
        this.scene.tweens.add({
            targets: this.storyBannerElements,
            alpha: 1,
            duration: 220,
            ease: 'Sine.easeOut'
        });

        this.storyBannerTimer = this.scene.time.delayedCall(7000, () => {
            this.clearStoryMissionBriefing();
        });
    }

    scheduleStoryMissionBriefing(
        quest,
        { initialDelay = 4500, retryDelay = 350 } = {}
    ) {
        if (!quest || quest.type !== 'story') return;

        this.clearScheduledStoryMissionBriefing();

        const attemptBriefing = () => {
            this.storyBriefingQueueTimer = null;
            if (this.scene?._isShuttingDown) return;

            const activeQuest = window.QuestManager
                ?.getQuestsByType?.('story')?.[0];
            if (
                !activeQuest
                || activeQuest.id !== quest.id
                || activeQuest.completed
                || activeQuest.claimed
            ) {
                return;
            }

            if (this.isBlockingStoryMomentActive()) {
                this.storyBriefingQueueTimer = this.scene.time.delayedCall(
                    retryDelay,
                    attemptBriefing
                );
                return;
            }

            this.showStoryMissionBriefing(activeQuest);
        };

        this.storyBriefingQueueTimer = this.scene.time.delayedCall(
            initialDelay,
            attemptBriefing
        );
    }

    isBlockingStoryMomentActive() {
        return Boolean(
            this.scene?.isFieldKitModalOpen
            || this.scene?.controlsTutorial?.isVisible
            || this.scene?.storyModalElements?.length
            || this.scene?.greetingElements?.length
            || this.scene?.livingSignalMomentElements?.length
            || this.scene?.hamburgerMenu?.isOpen
            || this.scene?.hamburgerMenu?.settingsModal?.isVisible
            || this.scene?.hamburgerMenu?.cloudSaveModal?.isVisible
            || this.scene?.hamburgerMenu?.beaconLogModal?.isVisible
            || this.scene?.carePanelManager?.panelVisible
            || this.scene?.creatureRadialMenu?.isVisible
        );
    }

    clearScheduledStoryMissionBriefing() {
        this.storyBriefingQueueTimer?.remove?.();
        this.storyBriefingQueueTimer = null;
    }

    clearStoryMissionBriefing() {
        this.storyBannerTimer?.remove?.();
        this.storyBannerTimer = null;
        this.storyBannerElements.forEach(element => {
            element?.removeAllListeners?.();
            element?.destroy?.();
        });
        this.storyBannerElements = [];
    }

    /**
     * Cleanup
     */
    destroy() {
        this.clearScheduledStoryMissionBriefing();
        this.clearStoryMissionBriefing();

        // Unsubscribe from events
        this.unsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        this.unsubscribers = [];

        // Remove all listeners from zones
        if (this.minimizedZone) {
            this.minimizedZone.removeAllListeners();
        }

        // Destroy container
        if (this.container) {
            this.container.destroy();
        }

        console.log('[QuestTracker] Destroyed');
    }
}
