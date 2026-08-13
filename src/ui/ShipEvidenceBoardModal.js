const TONE_COLORS = Object.freeze({
    ready: '#8FE3CF',
    protected: '#71E6B1',
    pending: '#AFC3CF',
    danger: '#EF767A'
});

export default class ShipEvidenceBoardModal {
    constructor(scene, {
        snapshotProvider,
        onReview,
        reconstructionSnapshotProvider = null,
        onReconstructionStep = null,
        onCompanionService = null,
        protocolSnapshotProvider = null,
        onProtocolStep = null,
        handoffSnapshotProvider = null,
        onClose = null
    } = {}) {
        this.scene = scene;
        this.snapshotProvider = snapshotProvider;
        this.onReview = onReview;
        this.reconstructionSnapshotProvider =
            reconstructionSnapshotProvider;
        this.onReconstructionStep = onReconstructionStep;
        this.onCompanionService = onCompanionService;
        this.protocolSnapshotProvider = protocolSnapshotProvider;
        this.onProtocolStep = onProtocolStep;
        this.handoffSnapshotProvider = handoffSnapshotProvider;
        this.onClose = onClose;
        this.elements = [];
        this.pointerRegions = [];
        this.isVisible = false;
        this.activeSectionId = null;
        this.physicsWasPaused = false;
        this.restoreMobileControls = false;
        this.escapeHandler = null;
    }

    show(sectionId = null) {
        const snapshot = this.snapshotProvider?.();
        const reconstruction =
            this.reconstructionSnapshotProvider?.();
        const protocol = this.protocolSnapshotProvider?.();
        const handoff = this.handoffSnapshotProvider?.();
        if (
            !snapshot?.available &&
            !reconstruction?.available &&
            !protocol?.available &&
            !handoff?.available
        ) return false;
        if (!this.isVisible) {
            this.physicsWasPaused = Boolean(
                this.scene.physics?.world?.isPaused
            );
            if (!this.physicsWasPaused) this.scene.physics?.pause?.();
            this.restoreMobileControls =
                this.scene.mobileControls?.suspend?.() === true;
        }
        this.isVisible = true;
        this.activeSectionId = (
            (
                snapshot?.available &&
                snapshot.sections.some(section => section.id === sectionId)
            ) ||
            (
                sectionId === 'reconstruction' &&
                reconstruction?.available
            ) ||
            (sectionId === 'protocol' && protocol?.available) ||
            (sectionId === 'handoff' && handoff?.available)
        )
            ? sectionId
            : reconstruction?.available
                ? 'reconstruction'
                : (snapshot?.available ? snapshot.nextSection?.id : null) ||
                (protocol?.available ? 'protocol' : 'systems');
        this.render();
        return true;
    }

    render() {
        this.clearElements();
        if (!this.isVisible) return;
        const snapshot = this.snapshotProvider?.();
        const reconstruction =
            this.reconstructionSnapshotProvider?.();
        const protocol = this.protocolSnapshotProvider?.();
        const handoff = this.handoffSnapshotProvider?.();
        if (
            !snapshot?.available &&
            !reconstruction?.available &&
            !protocol?.available &&
            !handoff?.available
        ) return;
        const reconstructionActive =
            this.activeSectionId === 'reconstruction' &&
            reconstruction?.available;
        const protocolActive =
            this.activeSectionId === 'protocol' &&
            protocol?.available;
        const handoffActive =
            this.activeSectionId === 'handoff' &&
            handoff?.available;
        const archiveAvailable = snapshot?.available === true;
        const archiveComplete = snapshot?.complete === true;
        const archiveSection = snapshot?.available && snapshot.sections.find(
            entry => entry.id === this.activeSectionId
        ) || snapshot?.nextSection || snapshot?.sections?.[0];
        const section = reconstructionActive
            ? {
                id: 'reconstruction',
                title: 'WANDERER-77 RECONSTRUCTION',
                summary:
                    'Install each recovered living-world system by hand. Capability is not permission to launch, contact Earth, or carry a passenger.',
                rows: reconstruction.rows
            }
            : handoffActive
            ? {
                id: 'handoff',
                title: 'HOMECOMING HANDOFF',
                summary:
                    'Tests what can safely continue into the next chapter. Nothing is launched, transmitted, or treated as travel consent.',
                rows: handoff.rows
            }
            : protocolActive
            ? {
                id: 'protocol',
                title: 'PROTECTED RETURN PROTOCOL',
                summary:
                    'Build proof that Wanderer-77 survived while keeping every living-world finding outside the report.',
                rows: protocol.steps.map(step => ({
                    id: step.id,
                    label: `${step.order}. ${step.label}`,
                    status: step.status.toUpperCase(),
                    tone: step.applied
                        ? 'protected'
                        : step.ready
                            ? 'ready'
                            : 'pending',
                    detail: step.applied
                        ? step.appliedSummary
                        : step.ready
                            ? step.summary
                            : (
                                step.id === protocol.nextStep?.id
                                    ? step.requirement
                                    : 'Complete the prior safeguard first.'
                            )
                }))
            }
            : archiveSection || {
                id: 'systems',
                title: 'SHIP ARCHIVE LOCKED',
                summary: 'Review the mission log before opening the evidence archive.',
                rows: []
            };
        this.activeSectionId = section.id;

        const camera = this.scene.cameras?.main;
        const width = camera?.width || this.scene.scale.width;
        const height = camera?.height || this.scene.scale.height;
        const compact = width < 620 || height < 700;
        const shortLandscape = height < 520 && width > height;
        const centerX = width / 2;
        const bandHeight = Math.min(
            compact ? 690 : 650,
            height - 16
        );
        const top = (height - bandHeight) / 2;
        const depth = 17000;
        const contentLeft = compact ? 18 : Math.max(32, width * 0.12);
        const contentRight = width - contentLeft;
        const contentWidth = contentRight - contentLeft;

        const overlay = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive(
                new Phaser.Geom.Rectangle(0, 0, width, height),
                Phaser.Geom.Rectangle.Contains
            );
        overlay.fillStyle(0x020507, 0.97);
        overlay.fillRect(0, 0, width, height);
        overlay.fillStyle(0x0A1115, 1);
        overlay.fillRect(0, top, width, bandHeight);
        overlay.lineStyle(2, 0xDCE8ED, 0.55);
        overlay.lineBetween(0, top, width, top);
        overlay.lineBetween(0, top + bandHeight, width, top + bandHeight);
        overlay.on('pointerdown', pointer => {
            this.activatePointerRegion(pointer);
        });
        this.elements.push(overlay);

        const livery = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth + 1);
        [0xD72638, 0x050505, 0xFFFFFF, 0x138A36].forEach(
            (color, index) => {
                livery.fillStyle(color, 1);
                livery.fillRect(index * width / 4, top, width / 4, 5);
            }
        );
        this.elements.push(livery);

        const shield = this.scene.add.zone(
            centerX,
            top + bandHeight / 2,
            width,
            bandHeight
        ).setScrollFactor(0).setDepth(depth + 1);
        this.elements.push(shield);

        const addText = (x, y, value, style = {}) => {
            const text = this.scene.add.text(x, y, value, {
                fontFamily: 'Arial, sans-serif',
                color: '#EAF7F4',
                ...style
            }).setScrollFactor(0).setDepth(depth + 3);
            this.elements.push(text);
            return text;
        };

        addText(contentLeft, top + 23, 'WANDERER-77 // SHIP & EVIDENCE BOARD', {
            fontSize: compact ? '10px' : '12px',
            color: '#8FE3CF',
            fontStyle: 'bold'
        });
        addText(contentRight - 32, top + 23, 'NO TRANSMISSION', {
            fontSize: compact ? '9px' : '11px',
            color: '#EF767A',
            fontStyle: 'bold'
        }).setOrigin(1, 0);

        this.createTabs({
            snapshot,
            reconstruction,
            protocol,
            handoff,
            top,
            width,
            contentLeft,
            contentWidth,
            depth,
            compact
        });

        addText(
            contentLeft,
            top + (shortLandscape ? 105 : 122),
            section.title,
            {
            fontSize: shortLandscape
                ? '16px'
                : compact
                    ? '18px'
                    : '23px',
            color: '#F2C14E',
            fontStyle: 'bold'
            }
        );
        addText(
            contentLeft,
            top + (shortLandscape ? 132 : 153),
            section.summary,
            {
            fontSize: shortLandscape
                ? '9px'
                : compact
                    ? '11px'
                    : '13px',
            color: '#BFD8D2',
            wordWrap: { width: contentWidth },
            lineSpacing: 3
            }
        );

        this.renderRows({
            rows: section.rows,
            startY: top + (
                shortLandscape &&
                    (handoffActive || reconstructionActive)
                    ? 150
                    : compact
                        ? 202
                        : 204
            ),
            compact,
            columns:
                shortLandscape &&
                    (handoffActive || reconstructionActive)
                    ? 2
                    : 1,
            contentLeft,
            contentRight,
            contentWidth,
            depth,
            addText
        });

        addText(
            contentLeft,
            top + bandHeight - (shortLandscape ? 82 : 88),
            reconstructionActive
                ? `RECONSTRUCTION ${reconstruction.completedCount}/${reconstruction.totalSteps}  //  ` +
                    `BERTH ${reconstruction.fieldSupport.status}\n` +
                    'NO LAUNCH  //  TRAVEL UNDECIDED'
                : handoffActive
                ? `HANDOFF ${handoff.completedCount}/${handoff.totalRequirements}  //  ` +
                    'LOCAL VALIDATION  //  NO TRANSMISSION'
                : protocolActive
                ? `SAFEGUARDS ${protocol.completedCount}/${protocol.totalSteps}  //  ` +
                    'REPORT HELD  //  NO TRANSMISSION'
                : `ARCHIVE ${snapshot?.reviewedCount || 0}/${snapshot?.totalSections || 0}  //  ` +
                    'COORDINATES SEALED  //  TRAVEL UNDECIDED',
            {
                fontSize: compact ? '9px' : '11px',
                color: '#AFC3CF',
                fontStyle: 'bold',
                lineSpacing: 2
            }
        );

        const nextSection = snapshot?.nextSection || null;
        const canRecord = !reconstructionActive &&
            !protocolActive &&
            !section.reviewed &&
            nextSection?.id === section.id;
        const reconstructionCanApply =
            reconstructionActive &&
            reconstruction?.readyStep;
        const berthCanService =
            reconstructionActive &&
            !reconstructionCanApply &&
            reconstruction?.fieldSupport?.ready;
        const protocolCanApply =
            protocolActive &&
            protocol?.ready &&
            protocol.nextStep;
        const buttonLabel = reconstructionActive
            ? berthCanService
                ? 'SERVICE COMPANION AT POWERED BERTH'
            : reconstruction.complete
                ? archiveComplete
                    ? 'CLOSE RECONSTRUCTION RECORD'
                    : 'OPEN SHIP ARCHIVE'
                : reconstructionCanApply
                    ? `INSTALL ${reconstruction.readyStep.partName.toUpperCase()}`
                    : `RECOVER ${reconstruction.nextStep?.partName.toUpperCase() || 'NEXT SYSTEM'}`
            : handoffActive
            ? handoff.readyForHomecoming
                ? 'CLOSE VERIFIED RECORD'
                : 'REVIEW NEXT REQUIREMENT'
            : protocolActive
            ? protocol.complete
                ? 'CLOSE BOARD'
                : protocolCanApply
                    ? `APPLY ${protocol.nextStep.label}`
                    : 'REQUIREMENT PENDING'
            : archiveComplete && protocol?.available
                ? 'OPEN RETURN PROTOCOL'
                : canRecord
                    ? `RECORD ${section.label} REVIEW`
                    : `GO TO ${nextSection?.label || 'NEXT SECTION'}`;
        this.createActionButton({
            y: top + bandHeight - (shortLandscape ? 58 : 62),
            label: buttonLabel,
            width,
            depth,
            enabled: reconstructionActive
                ? reconstruction.complete ||
                    Boolean(reconstructionCanApply) ||
                    Boolean(berthCanService)
                : handoffActive ||
                !protocolActive || protocol.complete ||
                Boolean(protocolCanApply),
            onPress: () => {
                if (
                    reconstructionActive &&
                    berthCanService
                ) {
                    this.serviceCompanion();
                } else if (
                    reconstructionActive &&
                    reconstruction.complete &&
                    archiveAvailable &&
                    !archiveComplete
                ) {
                    this.activeSectionId =
                        nextSection?.id || 'systems';
                    this.render();
                } else if (
                    reconstructionActive &&
                    reconstruction.complete
                ) {
                    this.hide();
                } else if (reconstructionCanApply) {
                    this.applyReconstructionStep(
                        reconstruction.readyStep.id
                    );
                } else if (handoffActive && handoff.readyForHomecoming) {
                    this.hide();
                } else if (handoffActive) {
                    this.activeSectionId =
                        protocol?.available && !protocol.complete
                            ? 'protocol'
                            : 'systems';
                    this.render();
                } else if (protocolActive && protocol.complete) {
                    this.hide();
                } else if (protocolCanApply) {
                    this.applyProtocolStep(
                        protocol.nextStep.id
                    );
                } else if (
                    !protocolActive &&
                    archiveComplete &&
                    protocol?.available
                ) {
                    this.activeSectionId = 'protocol';
                    this.render();
                } else if (canRecord) {
                    this.reviewActiveSection();
                } else {
                    this.activeSectionId =
                        nextSection?.id || 'systems';
                    this.render();
                }
            }
        });

        const close = addText(width - 22, top + 21, 'X', {
            fontSize: '16px',
            color: '#AFC3CF',
            fontStyle: 'bold',
            padding: { x: 14, y: 10 }
        }).setOrigin(0.5, 0)
            .setDepth(depth + 6);
        this.registerPointerRegion({
            left: width - 44,
            top,
            width: 44,
            height: 52,
            priority: 50,
            onPress: () => this.hide()
        });

        this.escapeHandler = () => this.hide();
        this.scene.input.keyboard?.once(
            'keydown-ESC',
            this.escapeHandler
        );
    }

    createTabs({
        snapshot,
        reconstruction,
        protocol,
        handoff,
        top,
        contentLeft,
        contentWidth,
        depth,
        compact
    }) {
        const tabs = [
            ...(reconstruction?.available
                ? [{
                    id: 'reconstruction',
                    label: 'REPAIR',
                    reviewed: reconstruction.complete
                }]
                : []),
            ...(snapshot?.available ? snapshot.sections : []),
            ...(protocol?.available
                ? [{
                    id: 'protocol',
                    label: 'RETURN',
                    reviewed: protocol.complete
                }]
                : []),
            ...(handoff?.available
                ? [{
                    id: 'handoff',
                    label: 'LEGACY',
                    reviewed: handoff.readyForHomecoming
                }]
                : [])
        ];
        const gap = 6;
        const tabWidth =
            (contentWidth - gap * (tabs.length - 1)) /
            tabs.length;
        tabs.forEach((section, index) => {
            const x = contentLeft + index * (tabWidth + gap);
            const active = section.id === this.activeSectionId;
            const tab = this.scene.add.graphics()
                .setScrollFactor(0)
                .setDepth(depth + 2);
            tab.fillStyle(active ? 0x174A43 : 0x101A20, 1);
            tab.fillRoundedRect(x, top + 60, tabWidth, 40, 5);
            tab.lineStyle(
                1,
                section.reviewed ? 0x71E6B1 : 0x50616C,
                1
            );
            tab.strokeRoundedRect(x, top + 60, tabWidth, 40, 5);
            const label = this.scene.add.text(
                x + tabWidth / 2,
                top + 80,
                `${section.reviewed ? 'OK ' : ''}${section.label}`,
                {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: compact ? '9px' : '11px',
                    color: active ? '#FFFFFF' : '#AFC3CF',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 4);
            this.registerPointerRegion({
                left: x,
                top: top + 58,
                width: tabWidth,
                height: 46,
                priority: 20,
                onPress: () => {
                    this.activeSectionId = section.id;
                    this.render();
                }
            });
            this.elements.push(tab, label);
        });
    }

    renderRows({
        rows,
        startY,
        compact,
        columns = 1,
        contentLeft,
        contentRight,
        contentWidth,
        depth,
        addText
    }) {
        const rowHeight = columns > 1
            ? 52
            : compact
                ? rows.length > 4 ? 58 : 76
                : rows.length > 4 ? 62 : 82;
        const columnGap = columns > 1 ? 18 : 0;
        const columnWidth =
            (contentWidth - columnGap * (columns - 1)) /
            columns;
        const rowsPerColumn = Math.ceil(rows.length / columns);
        rows.forEach((row, index) => {
            const column = Math.floor(index / rowsPerColumn);
            const rowIndex = index % rowsPerColumn;
            const left =
                contentLeft + column * (columnWidth + columnGap);
            const right = left + columnWidth;
            const y = startY + rowIndex * rowHeight;
            const color = TONE_COLORS[row.tone] || TONE_COLORS.pending;
            const divider = this.scene.add.graphics()
                .setScrollFactor(0)
                .setDepth(depth + 2);
            divider.lineStyle(1, 0x31424B, 0.8);
            divider.lineBetween(
                left,
                y - 8,
                right,
                y - 8
            );
            this.elements.push(divider);
            addText(left, y, row.label, {
                fontSize: compact ? '10px' : '12px',
                color: '#EAF7F4',
                fontStyle: 'bold'
            });
            addText(right, y, row.status, {
                fontSize: compact ? '8px' : '10px',
                color,
                fontStyle: 'bold'
            }).setOrigin(1, 0);
            addText(left, y + 20, row.detail, {
                fontSize: compact ? '9px' : '11px',
                color: '#AFC3CF',
                wordWrap: { width: columnWidth },
                lineSpacing: 2
            });
        });
    }

    reviewActiveSection() {
        const result = this.onReview?.(this.activeSectionId);
        if (!result?.changed) return;
        this.activeSectionId =
            result.snapshot.nextSection?.id ||
            this.activeSectionId;
        this.render();
    }

    applyProtocolStep(stepId) {
        const result = this.onProtocolStep?.(stepId);
        if (!result?.changed) return;
        this.activeSectionId = 'protocol';
        this.render();
    }

    applyReconstructionStep(stepId) {
        const result = this.onReconstructionStep?.(stepId);
        if (!result?.changed) return;
        this.activeSectionId = 'reconstruction';
        this.scene.time?.delayedCall?.(0, () => {
            if (this.isVisible) this.render();
        });
    }

    serviceCompanion() {
        const result = this.onCompanionService?.();
        if (!result?.changed) return;
        this.activeSectionId = 'reconstruction';
        this.scene.time?.delayedCall?.(0, () => {
            if (this.isVisible) this.render();
        });
    }

    createActionButton({
        y,
        label,
        width,
        depth,
        enabled = true,
        onPress
    }) {
        const buttonWidth = Math.min(width - 36, 440);
        const buttonHeight = 50;
        const left = width / 2 - buttonWidth / 2;
        const button = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(depth + 2);
        button.fillStyle(enabled ? 0x1C6A47 : 0x293236, 1);
        button.fillRoundedRect(left, y, buttonWidth, buttonHeight, 6);
        button.lineStyle(2, enabled ? 0x3FAE62 : 0x59656A, 1);
        button.strokeRoundedRect(left, y, buttonWidth, buttonHeight, 6);
        const labelText = this.scene.add.text(
            width / 2,
            y + buttonHeight / 2,
            label,
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: width < 620 ? '10px' : '12px',
                color: enabled ? '#FFFFFF' : '#8F9B9F',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 5);
        const horizontalPadding = Math.max(
            12,
            (buttonWidth - labelText.width) / 2
        );
        const verticalPadding = Math.max(
            8,
            (buttonHeight - labelText.height) / 2
        );
        labelText.setPadding({
            left: horizontalPadding,
            right: horizontalPadding,
            top: verticalPadding,
            bottom: verticalPadding
        });
        if (enabled) {
            this.registerPointerRegion({
                left,
                top: y,
                width: buttonWidth,
                height: buttonHeight,
                priority: 30,
                onPress
            });
        }
        this.elements.push(button, labelText);
    }

    registerPointerRegion({
        left,
        top,
        width,
        height,
        priority = 0,
        onPress
    }) {
        if (
            ![left, top, width, height].every(Number.isFinite) ||
            width <= 0 ||
            height <= 0 ||
            typeof onPress !== 'function'
        ) return false;
        this.pointerRegions.push({
            left,
            right: left + width,
            top,
            bottom: top + height,
            priority,
            onPress
        });
        this.pointerRegions.sort(
            (leftRegion, rightRegion) =>
                rightRegion.priority - leftRegion.priority
        );
        return true;
    }

    activatePointerRegion(pointer) {
        const x = Number(pointer?.x);
        const y = Number(pointer?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        const region = this.pointerRegions.find(candidate => (
            x >= candidate.left &&
            x <= candidate.right &&
            y >= candidate.top &&
            y <= candidate.bottom
        ));
        if (!region) return false;
        region.onPress();
        return true;
    }

    clearElements() {
        if (this.escapeHandler) {
            this.scene.input.keyboard?.off(
                'keydown-ESC',
                this.escapeHandler
            );
            this.escapeHandler = null;
        }
        this.elements.forEach(element => {
            element?.removeAllListeners?.();
            element?.destroy?.();
        });
        this.elements = [];
        this.pointerRegions = [];
    }

    hide() {
        if (!this.isVisible) return;
        this.isVisible = false;
        this.clearElements();
        if (!this.physicsWasPaused) this.scene.physics?.resume?.();
        if (this.restoreMobileControls) {
            this.scene.mobileControls?.resume?.();
        }
        this.onClose?.();
    }

    destroy() {
        this.hide();
        this.onClose = null;
        this.onReview = null;
        this.onReconstructionStep = null;
        this.onCompanionService = null;
        this.reconstructionSnapshotProvider = null;
        this.onProtocolStep = null;
        this.protocolSnapshotProvider = null;
        this.snapshotProvider = null;
    }
}
