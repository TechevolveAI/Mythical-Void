import { getProjectBeaconLog } from '../systems/ProjectBeaconStory.js';

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
        this.activeTab = tab === 'archive' ? 'archive' : 'mission';
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
        const compact = width < 600;
        const panelWidth = Math.min(700, width - 24);
        const panelHeight = Math.min(compact ? 700 : 610, height - 24);
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
        this.addText(contentLeft, panelY + 48, `${log.phase}  •  ${log.year}`, {
            fontSize: compact ? '11px' : '12px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });

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
            contentWidth / 2 - 4,
            'MISSION',
            'mission'
        );
        this.createTab(
            contentLeft + contentWidth / 2 + 4,
            panelY + 78,
            contentWidth / 2 - 4,
            'FIELD REPORTS',
            'archive'
        );

        if (this.activeTab === 'archive') {
            this.renderArchive(log, {
                compact,
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
        this.addLabel(contentLeft, progressY, 'WANDERER-7 SYSTEMS');
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

        this.addLabel(contentLeft, y, 'TRUST RECORD');
        y += 24;
        const trustLine = `${log.companion.name}  •  Bond level ${log.companion.bondLevel}`;
        this.addText(contentLeft, y, trustLine, {
            fontSize: compact ? '13px' : '15px',
            color: '#F2C14E',
            fontStyle: 'bold',
            wordWrap: { width: contentWidth }
        });
        y += 30;

        const note = log.latestReport?.fieldNote
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
