import { getProjectBeaconLog } from '../systems/ProjectBeaconStory.js';
import {
    completeRemainAndDefendCampaign
} from '../systems/RemainAndDefendCampaign.js';
import {
    recordCampaignLegacyCapsule
} from '../systems/CampaignLegacy.js';

/**
 * Persistent, spoiler-safe campaign recap for Project Beacon.
 */
class ProjectBeaconLogModal {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.getGameState = options.getGameState || (() => window.GameState || null);
        this.elements = [];
        this.isVisible = false;
        this.activeTab = 'mission';
        this.selectedReportId = null;
        this.escapeHandler = null;
    }

    show(tab = 'mission') {
        this.activeTab = ['mission', 'recovery', 'archive'].includes(tab)
            ? tab
            : 'mission';
        this.isVisible = true;
        this.render();
    }

    render() {
        if (this.escapeHandler) {
            this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
            this.escapeHandler = null;
        }
        this.clearElements();
        if (!this.isVisible) return;

        const log = getProjectBeaconLog(this.getGameState());
        const { width, height } = this.scene.cameras.main;
        const short = height < 520;
        const compact = width < 600 || height < 650;
        const panelWidth = Math.min(700, width - 24);
        const panelHeight = Math.min(compact ? 700 : 690, height - 24);
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;
        const contentLeft = panelX + (compact ? 20 : 30);
        const contentWidth = panelWidth - (compact ? 40 : 60);

        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x02070D, 0.91);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0).setDepth(17600);
        overlay.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, width, height),
            Phaser.Geom.Rectangle.Contains
        );
        overlay.on('pointerdown', () => this.hide());
        this.elements.push(overlay);

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x08131C, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.lineStyle(2, 0x66C7D4, 0.9);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
        panel.setScrollFactor(0).setDepth(17601);
        this.elements.push(panel);

        const panelBlocker = this.scene.add.zone(
            panelX + panelWidth / 2,
            panelY + panelHeight / 2,
            panelWidth,
            panelHeight
        );
        panelBlocker.setScrollFactor(0).setDepth(17602);
        panelBlocker.setInteractive();
        this.elements.push(panelBlocker);

        this.addText(contentLeft, panelY + 22, 'PROJECT BEACON // MISSION LOG', {
            fontSize: compact ? '15px' : '18px',
            color: '#F2C14E',
            fontStyle: 'bold'
        });
        this.addText(
            contentLeft,
            panelY + 48,
            compact
                ? `${log.phase}  •  F${log.ship.flightNumber}  •  ${log.year}`
                : `${log.phase}  •  FLIGHT ${log.ship.flightNumber}  •  ${log.year}`,
            {
                fontSize: compact ? '11px' : '12px',
                color: '#8FE3CF',
                fontStyle: 'bold'
            }
        );

        const livery = this.scene.add.graphics();
        const liveryX = compact
            ? panelX + panelWidth - 78
            : panelX + panelWidth - 94;
        const liveryY = compact
            ? panelY + 7
            : panelY + 51;
        log.ship.livery.forEach((color, index) => {
            livery.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
            livery.fillRect(
                liveryX + (index * 13),
                liveryY,
                10,
                5
            );
        });
        livery.setScrollFactor(0).setDepth(17603);
        this.elements.push(livery);

        const close = this.addText(panelX + panelWidth - 24, panelY + 28, 'X', {
            fontSize: '17px',
            color: '#B8C7D1',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        close.setInteractive({ useHandCursor: true });
        close.on('pointerdown', () => this.hide());

        this.createTab(
            contentLeft,
            panelY + 78,
            contentWidth / 3 - 5,
            'MISSION',
            'mission'
        );
        this.createTab(
            contentLeft + contentWidth / 3 + 1,
            panelY + 78,
            contentWidth / 3 - 2,
            compact ? 'RECOVER' : 'RECOVERY',
            'recovery'
        );
        this.createTab(
            contentLeft + (contentWidth / 3) * 2 + 5,
            panelY + 78,
            contentWidth / 3 - 5,
            'FIELD REPORTS',
            'archive'
        );

        if (this.activeTab === 'archive') {
            this.renderArchive(log, {
                compact,
                short,
                panelX,
                panelY,
                panelWidth,
                panelHeight,
                contentLeft,
                contentWidth
            });
        } else if (this.activeTab === 'recovery') {
            this.renderRecovery(log, {
                compact,
                short,
                panelX,
                panelY,
                panelWidth,
                panelHeight,
                contentLeft,
                contentWidth
            });
        } else {
            this.renderMission(log, {
                compact,
                short,
                panelX,
                panelY,
                panelWidth,
                panelHeight,
                contentLeft,
                contentWidth
            });
        }

        this.escapeHandler = () => this.hide();
        this.scene.input.keyboard?.once('keydown-ESC', this.escapeHandler);
    }

    renderMission(log, layout) {
        const {
            compact, panelY, panelHeight, contentLeft, contentWidth
        } = layout;
        let y = panelY + 126;

        this.addLabel(contentLeft, y, 'CURRENT DIRECTIVE');
        y += 24;
        this.addText(contentLeft, y, log.directive, {
            fontSize: compact ? '16px' : '19px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            wordWrap: { width: contentWidth }
        });
        y += compact ? 30 : 34;
        const detail = this.addText(contentLeft, y, log.directiveDetail, {
            fontSize: compact ? '12px' : '14px',
            color: '#C7D2DA',
            lineSpacing: 4,
            wordWrap: { width: contentWidth }
        });
        y += detail.height + 22;

        const progressY = y;
        this.addLabel(contentLeft, progressY, `${log.ship.name.toUpperCase()} SYSTEMS`);
        this.addText(contentLeft + contentWidth, progressY, `${log.recoveredSystems}/${log.totalSystems}`, {
            fontSize: '12px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        }).setOrigin(1, 0);
        y += 24;

        const rowHeight = compact ? 35 : 38;
        log.systems.forEach((system, index) => {
            const rowY = y + index * rowHeight;
            const statusColor = system.recovered ? '#8FE3CF' : '#657682';
            this.addText(contentLeft, rowY, system.recovered ? '✓' : '○', {
                fontSize: '15px',
                color: statusColor,
                fontStyle: 'bold'
            });
            this.addText(contentLeft + 24, rowY, `${system.icon}  ${system.name}`, {
                fontSize: compact ? '12px' : '13px',
                color: system.recovered ? '#EAF7F4' : '#8B99A3',
                fontStyle: system.recovered ? 'bold' : 'normal'
            });
            if (!compact) {
                this.addText(contentLeft + contentWidth, rowY + 1, system.recovered ? 'ONLINE' : 'MISSING', {
                    fontSize: '10px',
                    color: statusColor,
                    fontStyle: 'bold'
                }).setOrigin(1, 0);
            }
        });
        y += log.systems.length * rowHeight + 18;

        this.addLabel(contentLeft, y, 'CURRENT NETWORK');
        y += 22;
        this.addText(
            contentLeft,
            y,
            `${log.currentEcology.networkStatusLabel}  •  ` +
                `${log.currentEcology.vitality}% VITALITY  •  ` +
                `${log.currentEcology.restoredCount}/${log.currentEcology.totalRegions} REGIONS\n` +
                `CARE ${log.currentEcology.careActions}  •  ` +
                `BEACON SIPHONS ${log.currentEcology.extractionActions}`,
            {
                fontSize: compact ? '11px' : '13px',
                color: '#8FE3CF',
                fontStyle: 'bold',
                lineSpacing: 3,
                wordWrap: { width: contentWidth }
            }
        );
        y += compact ? 48 : 52;

        this.addLabel(contentLeft, y, 'FEND COMMUNITY');
        y += 22;
        const communityProject = log.fendCommunity.complete
            ? 'LIVING COMMONS ESTABLISHED'
            : log.fendCommunity.nextProject?.ready
                ? `${log.fendCommunity.nextProject.label} READY`
                : `NEXT: ${log.fendCommunity.nextProject?.label || 'LIVING COMMONS'}`;
        const guardianFocus = log.guardianResidents.taskFocusResident;
        const guardianFocusLine = guardianFocus
            ? guardianFocus.taskStatus === 'ready'
                ? `GUARDIAN READY  •  ${guardianFocus.name.toUpperCase()}  •  ${guardianFocus.task.title.toUpperCase()}\n`
                : guardianFocus.taskStatus === 'active'
                    ? `GUARDIAN TASK  •  ${guardianFocus.name.toUpperCase()}  •  ${guardianFocus.taskProgress.progress}/${guardianFocus.taskProgress.target}\n`
                    : `GUARDIAN REQUEST  •  SPEAK WITH ${guardianFocus.name.toUpperCase()}\n`
            : '';
        const compactCulture = log.fendCulture.complete
            ? `  •  LISTEN ${log.fendCulture.selectedPriority.shortLabel}`
            : log.fendCulture.ready
                ? '  •  LISTEN READY'
                : '';
        const compactBoundary =
            log.companionConsent.ready || log.companionConsent.complete
                ? `EARTH ${log.companionConsent.reviewedCount}/${log.companionConsent.totalTopics} ` +
                    `${log.companionConsent.complete ? 'RECORDED' : 'RETURN'}  •  `
                : '';
        const compactCommunityText =
            `COMMONS ${log.fendCommunity.stage}/${log.fendCommunity.totalStages}  •  ${communityProject}\n` +
            `GUARDIANS ${log.guardianResidents.rescuedCount}/${log.guardianResidents.totalResidents}  •  ` +
            `TASKS ${log.guardianResidents.completedTaskCount}/${log.guardianResidents.totalResidents}  •  ` +
            `SUPPORT ${log.guardianResidents.supportedResidentCount}/${log.guardianResidents.rescuedCount || 0}  •  ` +
            `SYNERGY ${log.guardianResidents.synergyCount}/${log.guardianResidents.rescuedCount || 0}  •  ` +
            `ALLY ${log.guardianResidents.activeTeamResident?.name?.toUpperCase() || 'NONE'}\n` +
            guardianFocusLine +
            `SETTLERS ${log.fendResidents.metCount}/${log.fendResidents.totalResidents}  •  ` +
            `REQUESTS ${log.fendResidents.completedCount}/${log.fendResidents.totalResidents}` +
            `${compactCulture}\n` +
            `${compactBoundary}HEART +${log.fendCommunity.support.maxHealthBonus}  •  ` +
            `CHARGE +${log.fendCommunity.support.maxEnergyBonus}  •  ` +
            `RELAY ${log.fendCommunity.support.guardCharges}`;
        const detailedCommunityText =
            `${log.fendCommunity.stage}/${log.fendCommunity.totalStages} PROJECTS  •  ${communityProject}\n` +
            `GUARDIANS ${log.guardianResidents.rescuedCount}/${log.guardianResidents.totalResidents}  •  ` +
            `TASKS ${log.guardianResidents.completedTaskCount}/${log.guardianResidents.totalResidents}  •  ` +
            `SUPPORT ${log.guardianResidents.supportedResidentCount}/${log.guardianResidents.rescuedCount || 0}  •  ` +
            `SYNERGY ${log.guardianResidents.synergyCount}/${log.guardianResidents.rescuedCount || 0}  •  ` +
            `ALLY ${log.guardianResidents.activeTeamResident?.name?.toUpperCase() || 'NONE'}\n` +
            guardianFocusLine +
            `SETTLERS ${log.fendResidents.metCount}/${log.fendResidents.totalResidents}  •  ` +
            `REQUESTS ${log.fendResidents.completedCount}/${log.fendResidents.totalResidents}\n` +
            (
                log.fendCulture.complete
                    ? `FIRST LISTENING  •  ${log.fendCulture.selectedPriority.shortLabel}\n`
                    : log.fendCulture.ready
                        ? 'FIRST LISTENING  •  READY AT THE COMMONS\n'
                        : ''
            ) +
            (
                log.companionConsent.ready || log.companionConsent.complete
                    ? `EARTH BOUNDARIES  ${log.companionConsent.reviewedCount}/${log.companionConsent.totalTopics}  •  ` +
                        `${log.companionConsent.complete ? 'RECORDED' : 'RETURN TO WANDERER-77'}\n`
                    : ''
            ) +
            `SUPPORT  HEART +${log.fendCommunity.support.maxHealthBonus}  •  ` +
            `CHARGE +${log.fendCommunity.support.maxEnergyBonus}  •  ` +
            `RELAY ${log.fendCommunity.support.guardCharges}`;
        this.addText(
            contentLeft,
            y,
            compact ? compactCommunityText : detailedCommunityText,
            {
                fontSize: compact ? '9px' : '12px',
                color: '#EAF7F4',
                fontStyle: 'bold',
                lineSpacing: 3,
                wordWrap: { width: contentWidth }
            }
        );
        y += compact
            ? (guardianFocus ? 86 : 73)
            : (
                log.companionConsent.ready ||
                log.companionConsent.complete
                    ? 110
                    : log.fendCulture.ready || log.fendCulture.complete
                        ? 96
                        : 82
            ) + (guardianFocus ? 14 : 0);

        this.addLabel(contentLeft, y, 'TRUST RECORD');
        y += 24;
        const rescueRecord = log.companion.autonomousRescues > 0
            ? `  •  CHOSE TO INTERVENE ${log.companion.autonomousRescues}×`
            : '';
        const lineageRecord = log.companion.lineageRecords > 0
            ? `  •  LINEAGES STABILIZED ${log.companion.lineageRecords}`
            : '';
        const highPowerRecord = log.companion.highPowerReveals > 0
            ? `\nEXTREME POWER WITNESSED ${log.companion.highPowerReveals}×` +
                '  •  FIVE SYSTEMS STABILIZED'
            : '';
        const senseiRecord = log.senseiMemory.ready ||
            log.senseiMemory.recalledCount > 0
            ? `\nPERSONAL ARCHIVE ${log.senseiMemory.recalledCount}/${log.senseiMemory.totalMemories}` +
                (
                    log.senseiMemory.ready
                        ? '  •  MEMORY AVAILABLE AT WANDERER-77'
                        : log.senseiMemory.lesson.unlocked
                            ? `  •  CENTERING STANCE ${log.senseiMemory.lesson.status.toUpperCase()}`
                            : ''
                )
            : '';
        const trustLine =
            `${log.companion.name}  •  Bond level ${log.companion.bondLevel}` +
            rescueRecord +
            lineageRecord +
            highPowerRecord +
            senseiRecord;
        const trustText = this.addText(contentLeft, y, trustLine, {
            fontSize: compact ? '13px' : '15px',
            color: '#F2C14E',
            fontStyle: 'bold',
            wordWrap: { width: contentWidth }
        });
        y += trustText.height + 14;

        const note = log.trustEvidence
            ? 'On Earth, power at this scale would be detectable across a city.'
            : log.latestReport?.fieldNote
            || 'First contact offered trust before the mission had words for it.';
        const noteText = this.addText(contentLeft, y, `"${note}"`, {
            fontSize: compact ? '11px' : '13px',
            color: '#AFC3CF',
            fontStyle: 'italic',
            lineSpacing: 3,
            wordWrap: { width: contentWidth }
        });

        if (y + noteText.height > panelY + panelHeight - 24) {
            noteText.setVisible(false);
        }
    }

    renderRecovery(log, layout) {
        const {
            compact,
            short,
            panelY,
            panelHeight,
            contentLeft,
            contentWidth
        } = layout;
        const campaign = log.remainAndDefend;
        let y = panelY + (short ? 119 : 124);

        this.addLabel(contentLeft, y, 'REMAIN AND DEFEND // RECOVERY CHAPTER');
        this.addText(
            contentLeft + contentWidth,
            y,
            `${campaign.completedCount}/${campaign.totalPhases}`,
            {
                fontSize: '11px',
                color: campaign.complete ? '#8FE3CF' : '#F2C14E',
                fontStyle: 'bold'
            }
        ).setOrigin(1, 0);
        y += short ? 19 : 25;

        const progress = this.scene.add.graphics();
        progress.fillStyle(0x172A34, 1);
        const progressHeight = short ? 6 : 8;
        progress.fillRoundedRect(
            contentLeft,
            y,
            contentWidth,
            progressHeight,
            progressHeight / 2
        );
        progress.fillStyle(campaign.complete ? 0x71E6B1 : 0x66C7D4, 1);
        progress.fillRoundedRect(
            contentLeft,
            y,
            contentWidth * (campaign.progressPercent / 100),
            progressHeight,
            progressHeight / 2
        );
        progress.setScrollFactor(0).setDepth(17603);
        this.elements.push(progress);
        y += short ? 14 : 23;

        if (!campaign.unlocked) {
            this.addText(
                contentLeft,
                y,
                'The recovery chapter begins after Wanderer-77 is restored, the coordinates are protected, and you choose what comes first.',
                {
                    fontSize: compact ? '12px' : '14px',
                    color: '#C7D2DA',
                    lineSpacing: 5,
                    wordWrap: { width: contentWidth }
                }
            );
            return;
        }

        const rowHeight = short ? 28 : compact ? 36 : 39;
        const columnCount = short ? 2 : 1;
        const rowsPerColumn = Math.ceil(
            campaign.phases.length / columnCount
        );
        const columnGap = short ? 18 : 0;
        const columnWidth = short
            ? (contentWidth - columnGap) / 2
            : contentWidth;
        campaign.phases.forEach((phase, index) => {
            const column = short
                ? Math.floor(index / rowsPerColumn)
                : 0;
            const rowIndex = short ? index % rowsPerColumn : index;
            const rowX =
                contentLeft + column * (columnWidth + columnGap);
            const rowY = y + rowIndex * rowHeight;
            const current = phase.status === 'current';
            const row = this.scene.add.graphics();
            if (current) {
                row.fillStyle(0x143340, 1);
                row.fillRoundedRect(
                    rowX - 4,
                    rowY - 5,
                    columnWidth + 8,
                    rowHeight - 2,
                    5
                );
                row.lineStyle(1, 0x66C7D4, 0.8);
                row.strokeRoundedRect(
                    rowX - 4,
                    rowY - 5,
                    columnWidth + 8,
                    rowHeight - 2,
                    5
                );
            }
            row.setScrollFactor(0).setDepth(17602);
            this.elements.push(row);

            const marker = phase.complete
                ? '✓'
                : current
                    ? '→'
                    : '·';
            const color = phase.complete
                ? '#8FE3CF'
                : current
                    ? '#F2C14E'
                    : '#657682';
            this.addText(rowX, rowY, marker, {
                fontSize: short ? '11px' : '14px',
                color,
                fontStyle: 'bold'
            });
            this.addText(
                rowX + (short ? 18 : 24),
                rowY,
                `${phase.number}. ${phase.label}`,
                {
                    fontSize: short ? '9px' : compact ? '10px' : '12px',
                    color: current ? '#FFFFFF' : color,
                    fontStyle: current || phase.complete ? 'bold' : 'normal'
                }
            );
            if (!compact && !short) {
                this.addText(
                    contentLeft + contentWidth,
                    rowY + 1,
                    phase.status.toUpperCase(),
                    {
                        fontSize: '9px',
                        color,
                        fontStyle: 'bold'
                    }
                ).setOrigin(1, 0);
            }
        });
        y += rowsPerColumn * rowHeight + (short ? 7 : 13);

        if (short && campaign.councilReady && !campaign.complete) {
            this.createActionButton(
                contentLeft,
                panelY + panelHeight - 48 - 12,
                contentWidth,
                48,
                'HOLD THE COMMONS COUNCIL',
                () => this.completeRecoveryChapter()
            );
            return;
        }

        this.addLabel(contentLeft, y, campaign.complete
            ? 'CHAPTER RECORD'
            : 'CURRENT OBJECTIVE');
        y += 21;
        const objective = this.addText(
            contentLeft,
            y,
            campaign.complete
                ? 'The Fend can defend together. No Earth contact was attempted, and any future homecoming remains consent-led.'
                : campaign.currentPhase.objective,
            {
                fontSize: compact ? '11px' : '13px',
                color: campaign.complete ? '#8FE3CF' : '#DCE8ED',
                lineSpacing: 4,
                wordWrap: { width: contentWidth }
            }
        );

        if (campaign.councilReady && !campaign.complete) {
            const buttonHeight = 48;
            const buttonY =
                panelY + panelHeight - buttonHeight - (short ? 12 : 18);
            if (y + objective.height > buttonY - 12) {
                objective.setVisible(false);
            }
            this.createActionButton(
                contentLeft,
                buttonY,
                contentWidth,
                buttonHeight,
                'HOLD THE COMMONS COUNCIL',
                () => this.completeRecoveryChapter()
            );
        }
    }

    completeRecoveryChapter() {
        const gameState = this.getGameState();
        const result = completeRemainAndDefendCampaign(gameState, {
            save: false
        });
        if (!result?.changed) {
            window.AudioManager?.playError?.();
            return result;
        }
        recordCampaignLegacyCapsule(gameState, {
            intent: result.snapshot.priority,
            recordedAt: result.state.completedAt
        });
        window.AchievementSystem?.recordEvent?.(
            'story_interaction',
            {
                event: 'remain_and_defend_completed',
                phaseCount: result.snapshot.totalPhases,
                transmissionStatus: 'not_sent'
            }
        );
        window.AudioManager?.playAchievement?.();
        this.render();
        return result;
    }

    renderArchive(log, layout) {
        const {
            compact, panelY, panelHeight, contentLeft, contentWidth
        } = layout;
        let y = panelY + 124;
        const availableReports = log.reports.filter(report => report.status !== 'locked');
        const defaultReport = log.latestReport || log.reports[0];
        const selected = log.reports.find(
            report => report.id === this.selectedReportId && report.status !== 'locked'
        ) || defaultReport;

        this.addLabel(contentLeft, y, 'CAMPAIGN RECORD');
        y += 24;
        const rowHeight = compact ? 35 : 38;
        log.reports.forEach((report, index) => {
            const rowY = y + index * rowHeight;
            const unlocked = report.status !== 'locked';
            const active = selected?.id === report.id;
            const row = this.scene.add.graphics();
            if (active) {
                row.fillStyle(0x143340, 1);
                row.fillRoundedRect(contentLeft - 6, rowY - 6, contentWidth + 12, rowHeight - 3, 5);
            }
            row.setScrollFactor(0).setDepth(17602);
            this.elements.push(row);

            this.addText(contentLeft, rowY, unlocked ? report.icon : '·', {
                fontSize: compact ? '13px' : '15px',
                color: unlocked ? '#8FE3CF' : '#60717C'
            });
            this.addText(contentLeft + 25, rowY, report.title, {
                fontSize: compact ? '11px' : '13px',
                color: unlocked ? '#EAF7F4' : '#657682',
                fontStyle: unlocked ? 'bold' : 'normal'
            });
            this.addText(contentLeft + contentWidth, rowY + 1, report.status.toUpperCase(), {
                fontSize: compact ? '9px' : '10px',
                color: report.status === 'new' ? '#F2C14E' : unlocked ? '#8FE3CF' : '#657682',
                fontStyle: 'bold'
            }).setOrigin(1, 0);

            if (unlocked) {
                const zone = this.scene.add.zone(
                    contentLeft + contentWidth / 2,
                    rowY + rowHeight / 2 - 5,
                    contentWidth,
                    rowHeight - 3
                );
                zone.setScrollFactor(0).setDepth(17604);
                zone.setInteractive({ useHandCursor: true });
                zone.on('pointerdown', () => {
                    this.selectedReportId = report.id;
                    this.render();
                });
                this.elements.push(zone);
            }
        });
        y += log.reports.length * rowHeight + 18;

        this.addLabel(contentLeft, y, availableReports.length > 0 ? 'SELECTED REPORT' : 'ARCHIVE STATUS');
        y += 24;
        if (!selected || selected.status === 'locked') {
            this.addText(contentLeft, y, 'No expedition reports have been recovered yet.', {
                fontSize: compact ? '12px' : '14px',
                color: '#9DADB7',
                wordWrap: { width: contentWidth }
            });
            return;
        }

        const reportText = this.addText(contentLeft, y, selected.finding, {
            fontSize: compact ? '11px' : '13px',
            color: '#DCE8ED',
            lineSpacing: 4,
            wordWrap: { width: contentWidth }
        });
        y += reportText.height + 12;
        const fieldNote = this.addText(contentLeft, y, `FIELD NOTE: ${selected.fieldNote}`, {
            fontSize: compact ? '10px' : '12px',
            color: '#F2C14E',
            fontStyle: 'italic',
            lineSpacing: 3,
            wordWrap: { width: contentWidth }
        });
        if (y + fieldNote.height > panelY + panelHeight - 22) {
            fieldNote.setVisible(false);
        }
    }

    createTab(x, y, width, label, tab) {
        const active = this.activeTab === tab;
        const bg = this.scene.add.graphics();
        bg.fillStyle(active ? 0x1D5961 : 0x111F29, 1);
        bg.fillRoundedRect(x, y, width, 34, 5);
        bg.lineStyle(1, active ? 0x8FE3CF : 0x3F5664, 1);
        bg.strokeRoundedRect(x, y, width, 34, 5);
        bg.setScrollFactor(0).setDepth(17602);
        this.elements.push(bg);

        this.addText(x + width / 2, y + 17, label, {
            fontSize: '11px',
            color: active ? '#FFFFFF' : '#8EA0AA',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        if (!active) {
            const zone = this.scene.add.zone(x + width / 2, y + 17, width, 34);
            zone.setScrollFactor(0).setDepth(17604);
            zone.setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => {
                this.activeTab = tab;
                this.render();
            });
            this.elements.push(zone);
        }
    }

    createActionButton(x, y, width, height, label, onActivate) {
        const background = this.scene.add.graphics();
        background.fillStyle(0x1D5961, 1);
        background.fillRoundedRect(x, y, width, height, 6);
        background.lineStyle(2, 0x8FE3CF, 1);
        background.strokeRoundedRect(x, y, width, height, 6);
        background.setScrollFactor(0).setDepth(17602);
        this.elements.push(background);

        this.addText(x + width / 2, y + height / 2, label, {
            fontSize: '12px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const zone = this.scene.add.zone(
            x + width / 2,
            y + height / 2,
            width,
            height
        );
        zone.setScrollFactor(0).setDepth(17604);
        zone.setInteractive({ useHandCursor: true });
        zone.on('pointerdown', onActivate);
        this.elements.push(zone);
    }

    addLabel(x, y, text) {
        return this.addText(x, y, text, {
            fontSize: '10px',
            color: '#66C7D4',
            fontStyle: 'bold'
        });
    }

    addText(x, y, text, style = {}) {
        const element = this.scene.add.text(x, y, text, {
            fontFamily: '"Courier New", monospace',
            letterSpacing: 0,
            ...style
        });
        element.setScrollFactor(0).setDepth(17603);
        this.elements.push(element);
        return element;
    }

    hide() {
        this.isVisible = false;
        if (this.escapeHandler) {
            this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
            this.escapeHandler = null;
        }
        this.clearElements();
    }

    clearElements() {
        this.elements.forEach(element => element?.destroy?.());
        this.elements = [];
    }

    destroy() {
        this.hide();
    }
}

export default ProjectBeaconLogModal;
