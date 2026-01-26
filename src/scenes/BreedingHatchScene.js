/**
 * BreedingHatchScene - Spectacular offspring reveal scene
 * A dramatic cinematic experience when a bred offspring is created
 *
 * Features:
 * - Both parents displayed with their traits
 * - Cosmic fusion animation
 * - DNA helix visual effect
 * - Offspring reveal with inheritance breakdown
 * - Generation and bonus display
 * - Naming prompt for the new creature
 */

const Phaser = typeof window !== 'undefined' ? window.Phaser : undefined;

class BreedingHatchScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BreedingHatchScene' });

        this.offspringData = null;
        this.parent1Data = null;
        this.parent2Data = null;
        this.elements = [];
        this.phase = 'intro'; // intro, fusion, reveal, naming
        this.graphicsEngine = null;
        this.parent1Sprite = null;
        this.parent2Sprite = null;
        this.offspringSprite = null;
    }

    init(data) {
        console.log('[BreedingHatchScene] Initializing with data:', data);

        // Check for twin birth
        this.isTwinBirth = data?.isTwinBirth || false;

        if (this.isTwinBirth) {
            // Twin birth: two separate creatures
            this.twin1 = data?.twin1 || null;
            this.twin2 = data?.twin2 || null;
            console.log('[BreedingHatchScene] 👯 TWIN BIRTH MODE');
        } else {
            // Standard single offspring
            this.offspringData = data?.offspringData || null;
            this.offspringGenes = data?.offspringGenes || null;
        }

        this.parent1Data = data?.parent1 || null;
        this.parent2Data = data?.parent2 || null;
        // Birth events from BirthEventSystem
        this.birthEvents = data?.birthEvents || [];
        this.hasRareEvent = data?.hasRareEvent || false;
    }

    create() {
        console.log('[BreedingHatchScene] Creating breeding hatch scene...');

        const { width, height } = this.scale;

        // Stop other scenes
        ['GameScene', 'FusionPodScene'].forEach(sceneKey => {
            try {
                this.scene.stop(sceneKey);
            } catch (e) {
                // Scene might not exist
            }
        });

        // Initialize GraphicsEngine for proper creature rendering
        if (window.GraphicsEngine) {
            this.graphicsEngine = new window.GraphicsEngine(this);
            console.log('[BreedingHatchScene] GraphicsEngine initialized');
        } else {
            console.warn('[BreedingHatchScene] GraphicsEngine not available, using fallback rendering');
        }

        // Create cosmic background
        this.createCosmicBackground(width, height);

        // Start the cinematic sequence
        this.startIntroPhase(width, height);
    }

    createCosmicBackground(width, height) {
        // Deep space gradient background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x050214, 0x050214, 0x1A0A2E, 0x1A0A2E, 1);
        bg.fillRect(0, 0, width, height);
        bg.setDepth(0);
        this.elements.push(bg);

        // Animated stars
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(1, 3);

            const star = this.add.graphics();
            star.fillStyle(0xFFFFFF, Phaser.Math.FloatBetween(0.3, 1));
            star.fillCircle(x, y, size);
            star.setDepth(1);

            // Twinkle animation
            this.tweens.add({
                targets: star,
                alpha: { from: 0.3, to: 1 },
                duration: Phaser.Math.Between(800, 2000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.elements.push(star);
        }

        // Nebula clouds
        for (let i = 0; i < 5; i++) {
            const nebula = this.add.graphics();
            const nebulaX = Phaser.Math.Between(0, width);
            const nebulaY = Phaser.Math.Between(0, height);
            const colors = [0x9370DB, 0xFF69B4, 0x4169E1, 0x00CED1];

            nebula.fillStyle(colors[i % colors.length], 0.1);
            nebula.fillCircle(nebulaX, nebulaY, Phaser.Math.Between(100, 200));
            nebula.setDepth(2);

            // Slow drift
            this.tweens.add({
                targets: nebula,
                x: nebulaX + Phaser.Math.Between(-30, 30),
                y: nebulaY + Phaser.Math.Between(-20, 20),
                alpha: { from: 0.1, to: 0.15 },
                duration: 5000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.elements.push(nebula);
        }
    }

    startIntroPhase(width, height) {
        this.phase = 'intro';

        // Title
        const title = this.add.text(width / 2, 50, '✨ Cosmic Union ✨', {
            fontSize: '28px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(100).setAlpha(0);
        this.elements.push(title);

        // Fade in title
        this.tweens.add({
            targets: title,
            alpha: 1,
            duration: 1000,
            ease: 'Power2'
        });

        // Show parents after short delay
        this.time.delayedCall(500, () => {
            this.showParents(width, height);
        });

        // Play mystical sound
        window.AudioManager?.playVisionReveal?.();
    }

    showParents(width, height) {
        const centerY = height / 2 - 50;
        const parent1X = width * 0.25;
        const parent2X = width * 0.75;

        // Parent 1 (left side)
        const p1Container = this.createParentDisplay(
            parent1X, centerY,
            this.parent1Data,
            'left',
            0x88CCFF
        );

        // Parent 2 (right side)
        const p2Container = this.createParentDisplay(
            parent2X, centerY,
            this.parent2Data,
            'right',
            0xFF88CC
        );

        // Animate parents sliding in
        this.tweens.add({
            targets: p1Container,
            x: { from: -100, to: parent1X },
            alpha: { from: 0, to: 1 },
            duration: 800,
            ease: 'Back.easeOut'
        });

        this.tweens.add({
            targets: p2Container,
            x: { from: width + 100, to: parent2X },
            alpha: { from: 0, to: 1 },
            duration: 800,
            ease: 'Back.easeOut'
        });

        // Connection text
        this.time.delayedCall(1000, () => {
            const connectionText = this.add.text(width / 2, centerY, '💫', {
                fontSize: '40px'
            }).setOrigin(0.5).setDepth(100).setAlpha(0);
            this.elements.push(connectionText);

            this.tweens.add({
                targets: connectionText,
                alpha: 1,
                scale: { from: 0.5, to: 1.2 },
                duration: 500,
                yoyo: true,
                repeat: 2,
                onComplete: () => {
                    this.startFusionPhase(width, height);
                }
            });
        });
    }

    createParentDisplay(x, y, parentData, side, glowColor) {
        const container = this.add.container(x, y);
        container.setDepth(50);
        container.setAlpha(0);

        // Glow circle
        const glow = this.add.graphics();
        glow.fillStyle(glowColor, 0.3);
        glow.fillCircle(0, 0, 70);
        container.add(glow);

        // Pulsing glow animation
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.3, to: 0.5 },
            scaleX: { from: 1, to: 1.15 },
            scaleY: { from: 1, to: 1.15 },
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Try to render actual creature using GraphicsEngine
        let creatureSprite = null;
        const genes = parentData?.genes || parentData?.dna;

        if (this.graphicsEngine && genes) {
            try {
                // Determine the parent's current stage (they should be adults to breed)
                const stage = parentData?.lifecycle?.stage || 'adult';

                // Generate creature texture
                const result = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                    genes,
                    0,
                    stage
                );

                if (result && result.textureName && this.textures.exists(result.textureName)) {
                    creatureSprite = this.add.image(0, 0, result.textureName);
                    creatureSprite.setScale(0.8); // Scale down slightly to fit in display
                    container.add(creatureSprite);

                    // Store reference for animations
                    if (side === 'left') {
                        this.parent1Sprite = creatureSprite;
                    } else {
                        this.parent2Sprite = creatureSprite;
                    }

                    console.log(`[BreedingHatchScene] Rendered ${side} parent creature: ${result.textureName}`);
                }
            } catch (error) {
                console.warn('[BreedingHatchScene] Failed to render parent creature:', error);
            }
        }

        // Fallback to colored circle if creature rendering failed
        if (!creatureSprite) {
            const visual = this.add.graphics();
            const color = this.getCreatureColor(genes);
            visual.fillStyle(color, 0.9);
            visual.fillCircle(0, 0, 40);
            visual.lineStyle(3, 0xFFD700, 0.8);
            visual.strokeCircle(0, 0, 40);
            container.add(visual);

            // Breathing animation for fallback
            this.tweens.add({
                targets: visual,
                scaleX: 1.05,
                scaleY: 0.95,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        } else {
            // Breathing animation for actual sprite
            this.tweens.add({
                targets: creatureSprite,
                scaleX: 0.85,
                scaleY: 0.75,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // Parent name
        const name = parentData?.name || 'Parent';
        const nameText = this.add.text(0, 70, name, {
            fontSize: '16px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        container.add(nameText);

        // Rarity label with glow effect
        const rarity = parentData?.rarity || 'common';
        const rarityColors = {
            common: '#AAAAAA',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FFD700'
        };
        const rarityText = this.add.text(0, 90, rarity.toUpperCase(), {
            fontSize: '11px',
            color: rarityColors[rarity] || '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(rarityText);

        // Generation badge
        const gen = parentData?.generation || 1;
        const genBadge = this.add.graphics();
        genBadge.fillStyle(0x2A1A4E, 0.9);
        genBadge.fillRoundedRect(-25, 100, 50, 20, 10);
        container.add(genBadge);

        const genText = this.add.text(0, 110, `Gen ${gen}`, {
            fontSize: '10px',
            color: '#88CCFF'
        }).setOrigin(0.5);
        container.add(genText);

        this.elements.push(container);
        return container;
    }

    startFusionPhase(width, height) {
        this.phase = 'fusion';
        const centerX = width / 2;
        const centerY = height / 2 - 50;

        // DNA Helix effect
        this.createDNAHelix(centerX, centerY);

        // Fusion message
        const fusionText = this.add.text(centerX, height - 150, 'Combining Cosmic Genetics...', {
            fontSize: '16px',
            color: '#88FFCC',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(100).setAlpha(0);
        this.elements.push(fusionText);

        this.tweens.add({
            targets: fusionText,
            alpha: 1,
            duration: 500
        });

        // Energy particles flowing to center
        this.createEnergyFlow(width, height, centerX, centerY);

        // After fusion animation, reveal offspring
        this.time.delayedCall(3500, () => {
            fusionText.destroy();
            this.startRevealPhase(width, height);
        });

        // Play fusion sound
        window.AudioManager?.playAchievement?.();
    }

    createDNAHelix(centerX, centerY) {
        const helixGraphics = this.add.graphics();
        helixGraphics.setDepth(75);
        this.elements.push(helixGraphics);

        let time = 0;
        const helixTimer = this.time.addEvent({
            delay: 50,
            callback: () => {
                helixGraphics.clear();

                // Draw double helix
                for (let i = 0; i < 20; i++) {
                    const t = time + i * 0.3;
                    const y = centerY - 80 + i * 8;

                    // Left strand
                    const x1 = centerX + Math.sin(t) * 30;
                    // Right strand
                    const x2 = centerX + Math.sin(t + Math.PI) * 30;

                    // Draw strands
                    helixGraphics.fillStyle(0x88CCFF, 0.8);
                    helixGraphics.fillCircle(x1, y, 4);
                    helixGraphics.fillStyle(0xFF88CC, 0.8);
                    helixGraphics.fillCircle(x2, y, 4);

                    // Draw connecting bars
                    if (i % 3 === 0) {
                        helixGraphics.lineStyle(2, 0xFFD700, 0.6);
                        helixGraphics.lineBetween(x1, y, x2, y);
                    }
                }

                time += 0.15;
            },
            loop: true
        });

        // Stop after fusion phase
        this.time.delayedCall(3000, () => {
            helixTimer.destroy();

            // Flash effect
            this.tweens.add({
                targets: helixGraphics,
                alpha: 0,
                duration: 500,
                onComplete: () => helixGraphics.destroy()
            });
        });
    }

    createEnergyFlow(width, height, targetX, targetY) {
        // Create particles flowing from edges to center
        const colors = [0x88CCFF, 0xFF88CC, 0xFFD700, 0x88FF88];

        for (let i = 0; i < 30; i++) {
            this.time.delayedCall(i * 100, () => {
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const distance = Phaser.Math.Between(200, 300);
                const startX = targetX + Math.cos(angle) * distance;
                const startY = targetY + Math.sin(angle) * distance;

                const particle = this.add.graphics();
                particle.fillStyle(colors[i % colors.length], 0.8);
                particle.fillCircle(0, 0, Phaser.Math.Between(3, 6));
                particle.setPosition(startX, startY);
                particle.setDepth(80);

                this.tweens.add({
                    targets: particle,
                    x: targetX,
                    y: targetY,
                    alpha: 0,
                    scale: 0.3,
                    duration: 1000,
                    ease: 'Quad.easeIn',
                    onComplete: () => particle.destroy()
                });
            });
        }
    }

    startRevealPhase(width, height) {
        this.phase = 'reveal';
        const centerY = height / 2 - 30;

        // Screen flash
        const flash = this.add.graphics();
        flash.fillStyle(0xFFFFFF, 0.8);
        flash.fillRect(0, 0, width, height);
        flash.setDepth(200);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            onComplete: () => flash.destroy()
        });

        // Clear parent displays
        this.elements.forEach(el => {
            if (el && el.type === 'Container') {
                this.tweens.add({
                    targets: el,
                    alpha: 0,
                    y: '-=50',
                    duration: 300
                });
            }
        });

        // Play birth sound
        window.AudioManager?.playBabyChirp?.();

        // Show offspring after flash
        this.time.delayedCall(300, () => {
            if (this.isTwinBirth) {
                this.showTwins(width, height);
            } else {
                const centerX = width / 2;
                this.showOffspring(centerX, centerY, width, height);
            }
        });
    }

    showOffspring(centerX, centerY, width, height) {
        // Golden glow behind baby
        const glow = this.add.graphics();
        glow.fillStyle(0xFFD700, 0.4);
        glow.fillCircle(centerX, centerY, 90);
        glow.setDepth(90);
        this.elements.push(glow);

        // Pulsing glow animation
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.4, to: 0.2 },
            scaleX: { from: 1, to: 1.4 },
            scaleY: { from: 1, to: 1.4 },
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Inner pink glow for baby (cute effect)
        const innerGlow = this.add.graphics();
        innerGlow.fillStyle(0xFFB6C1, 0.3);
        innerGlow.fillCircle(centerX, centerY, 60);
        innerGlow.setDepth(91);
        this.elements.push(innerGlow);

        this.tweens.add({
            targets: innerGlow,
            alpha: { from: 0.3, to: 0.15 },
            scaleX: { from: 1, to: 1.2 },
            scaleY: { from: 1, to: 1.2 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 300
        });

        // Try to render actual baby creature using GraphicsEngine
        let creatureRendered = false;

        if (this.graphicsEngine && this.offspringGenes) {
            try {
                // Generate baby creature texture with 'baby' stage for cute proportions
                const result = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                    this.offspringGenes,
                    0,
                    'baby' // CRITICAL: Baby stage gives big eyes, round body, cute features
                );

                if (result && result.textureName && this.textures.exists(result.textureName)) {
                    // Create the actual creature sprite
                    this.offspringSprite = this.add.image(centerX, centerY, result.textureName);
                    this.offspringSprite.setDepth(100);
                    this.offspringSprite.setScale(0); // Start small for pop-in effect
                    this.elements.push(this.offspringSprite);

                    // Store texture name for later use when saving creature
                    this.offspringTextureName = result.textureName;

                    // Spectacular pop-in animation
                    this.tweens.add({
                        targets: this.offspringSprite,
                        scaleX: 1.2,
                        scaleY: 1.2,
                        duration: 600,
                        ease: 'Back.easeOut',
                        onComplete: () => {
                            // Settle to normal size
                            this.tweens.add({
                                targets: this.offspringSprite,
                                scaleX: 1,
                                scaleY: 1,
                                duration: 200,
                                ease: 'Quad.easeOut'
                            });
                        }
                    });

                    // Cute baby breathing animation
                    this.time.delayedCall(800, () => {
                        if (this.offspringSprite) {
                            this.tweens.add({
                                targets: this.offspringSprite,
                                scaleX: 1.08,
                                scaleY: 0.95,
                                duration: 1200,
                                yoyo: true,
                                repeat: -1,
                                ease: 'Sine.easeInOut'
                            });
                        }
                    });

                    // Bobbing animation (babies bob more)
                    this.time.delayedCall(1000, () => {
                        if (this.offspringSprite) {
                            this.tweens.add({
                                targets: this.offspringSprite,
                                y: centerY - 10,
                                duration: 1500,
                                yoyo: true,
                                repeat: -1,
                                ease: 'Sine.easeInOut'
                            });
                        }
                    });

                    // Occasional excited bounce
                    this.time.addEvent({
                        delay: 4000 + Math.random() * 3000,
                        callback: () => {
                            if (this.offspringSprite && this.offspringSprite.active) {
                                this.tweens.add({
                                    targets: this.offspringSprite,
                                    scaleX: 1.15,
                                    scaleY: 0.85,
                                    duration: 100,
                                    yoyo: true,
                                    onComplete: () => {
                                        window.AudioManager?.playBabyChirp?.();
                                    }
                                });
                            }
                        },
                        loop: true
                    });

                    creatureRendered = true;
                    console.log('[BreedingHatchScene] Baby creature rendered successfully:', result.textureName);
                }
            } catch (error) {
                console.warn('[BreedingHatchScene] Failed to render baby creature:', error);
            }
        }

        // Fallback rendering if GraphicsEngine failed
        if (!creatureRendered) {
            const offspringVisual = this.add.graphics();
            const color = this.getCreatureColor(this.offspringGenes);
            offspringVisual.fillStyle(color, 0.95);
            offspringVisual.fillCircle(centerX, centerY, 40);
            offspringVisual.lineStyle(3, 0xFFD700, 1);
            offspringVisual.strokeCircle(centerX, centerY, 40);
            offspringVisual.setDepth(100);
            offspringVisual.setScale(0);
            this.elements.push(offspringVisual);

            this.tweens.add({
                targets: offspringVisual,
                scaleX: 1,
                scaleY: 1,
                duration: 500,
                ease: 'Back.easeOut'
            });

            // Add fallback eyes for cute effect
            this.time.delayedCall(400, () => {
                const eyeL = this.add.graphics();
                eyeL.fillStyle(0xFFFFFF, 1);
                eyeL.fillCircle(centerX - 14, centerY - 8, 12);
                eyeL.fillStyle(0x000000, 1);
                eyeL.fillCircle(centerX - 14, centerY - 5, 7);
                eyeL.fillStyle(0xFFFFFF, 1);
                eyeL.fillCircle(centerX - 16, centerY - 8, 4);
                eyeL.setDepth(101);
                this.elements.push(eyeL);

                const eyeR = this.add.graphics();
                eyeR.fillStyle(0xFFFFFF, 1);
                eyeR.fillCircle(centerX + 14, centerY - 8, 12);
                eyeR.fillStyle(0x000000, 1);
                eyeR.fillCircle(centerX + 14, centerY - 5, 7);
                eyeR.fillStyle(0xFFFFFF, 1);
                eyeR.fillCircle(centerX + 12, centerY - 8, 4);
                eyeR.setDepth(101);
                this.elements.push(eyeR);

                // Blinking
                this.time.addEvent({
                    delay: 3000,
                    callback: () => {
                        this.tweens.add({
                            targets: [eyeL, eyeR],
                            scaleY: 0.1,
                            duration: 100,
                            yoyo: true
                        });
                    },
                    loop: true
                });
            });

            // Breathing for fallback
            this.tweens.add({
                targets: offspringVisual,
                scaleX: 1.08,
                scaleY: 0.95,
                duration: 1200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: 500
            });
        }

        // Periodic cute sparkles around baby
        this.time.addEvent({
            delay: 2500,
            callback: () => {
                if (window.FXLibrary) {
                    window.FXLibrary.stardustBurst(this, centerX, centerY, {
                        count: 5,
                        color: [0xFFB6C1, 0xFFFFFF, 0x87CEEB, 0xFFD700],
                        duration: 1500
                    });
                }
            },
            loop: true
        });

        // "New Life!" title
        const newLifeText = this.add.text(centerX, centerY - 100, '🎉 New Life Created! 🎉', {
            fontSize: '24px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(100).setAlpha(0);
        this.elements.push(newLifeText);

        this.tweens.add({
            targets: newLifeText,
            alpha: 1,
            y: centerY - 110,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Show inheritance info
        this.time.delayedCall(800, () => {
            this.showInheritanceInfo(width, height, centerY);
        });

        // Celebration particles
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, centerX, centerY, {
                count: 40,
                color: [0xFFD700, 0x88CCFF, 0xFF88CC, 0x88FF88],
                duration: 3000
            });
        }

        // Play celebration sound
        window.AudioManager?.playLevelUp?.();
    }

    /**
     * Show TWIN babies side by side - special twin birth reveal!
     */
    showTwins(width, height) {
        const centerY = height / 2 - 50;
        const twin1X = width * 0.35;
        const twin2X = width * 0.65;

        // For twin reference
        this.twin1Sprite = null;
        this.twin2Sprite = null;
        this.twin1Name = null;
        this.twin2Name = null;

        // Set genes for first twin (for backward compatibility)
        this.offspringGenes = this.twin1?.offspringGenes;
        this.offspringData = this.twin1?.offspringData;

        // "TWINS!" announcement
        const twinsTitle = this.add.text(width / 2, 60, '👯 TWINS! 👯', {
            fontSize: '36px',
            color: '#FF69B4',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(100).setAlpha(0);
        this.elements.push(twinsTitle);

        this.tweens.add({
            targets: twinsTitle,
            alpha: 1,
            scale: { from: 0.5, to: 1.2 },
            duration: 800,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: twinsTitle,
                    scale: 1,
                    duration: 200
                });
            }
        });

        // Subtitle
        const subtitle = this.add.text(width / 2, 100, 'A rare and magical blessing!', {
            fontSize: '14px',
            color: '#FFB6C1',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(100).setAlpha(0);
        this.elements.push(subtitle);

        this.tweens.add({
            targets: subtitle,
            alpha: 1,
            duration: 500,
            delay: 300
        });

        // Extra particles for twins!
        if (window.FXLibrary) {
            window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                count: 60,
                color: [0xFF69B4, 0xFFD700, 0x87CEEB, 0x98FB98],
                duration: 3500
            });
        }

        // Play extra celebration for twins
        window.AudioManager?.playAchievement?.();
        this.time.delayedCall(500, () => window.AudioManager?.playBabyCoo?.());

        // Show each twin with delay
        this.time.delayedCall(500, () => {
            this.showSingleTwin(twin1X, centerY, this.twin1, 1, width, height);
        });

        this.time.delayedCall(1200, () => {
            this.showSingleTwin(twin2X, centerY, this.twin2, 2, width, height);
        });

        // Show inheritance info after both twins are revealed
        this.time.delayedCall(2500, () => {
            this.showTwinInheritanceInfo(width, height, centerY);
        });
    }

    /**
     * Show a single twin creature
     */
    showSingleTwin(x, y, twinData, twinIndex, width, height) {
        const genes = twinData?.offspringGenes;
        const data = twinData?.offspringData;

        // Glow behind baby
        const glow = this.add.graphics();
        const glowColor = twinIndex === 1 ? 0x88CCFF : 0xFF88CC;
        glow.fillStyle(glowColor, 0.4);
        glow.fillCircle(x, y, 70);
        glow.setDepth(90);
        this.elements.push(glow);

        // Pulsing glow
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.4, to: 0.2 },
            scaleX: { from: 1, to: 1.3 },
            scaleY: { from: 1, to: 1.3 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Try to render creature
        let creatureRendered = false;

        if (this.graphicsEngine && genes) {
            try {
                const result = this.graphicsEngine.createRandomizedSpaceMythicCreature(
                    genes,
                    0,
                    'baby'
                );

                if (result && result.textureName && this.textures.exists(result.textureName)) {
                    const sprite = this.add.image(x, y, result.textureName);
                    sprite.setDepth(100);
                    sprite.setScale(0);
                    this.elements.push(sprite);

                    // Store reference
                    if (twinIndex === 1) {
                        this.twin1Sprite = sprite;
                        this.twin1TextureName = result.textureName;
                    } else {
                        this.twin2Sprite = sprite;
                        this.twin2TextureName = result.textureName;
                    }

                    // Pop-in animation
                    this.tweens.add({
                        targets: sprite,
                        scaleX: 0.9,
                        scaleY: 0.9,
                        duration: 500,
                        ease: 'Back.easeOut'
                    });

                    // Breathing animation
                    this.time.delayedCall(600, () => {
                        this.tweens.add({
                            targets: sprite,
                            scaleX: 0.95,
                            scaleY: 0.85,
                            duration: 1200,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    });

                    creatureRendered = true;
                    console.log(`[BreedingHatchScene] Twin ${twinIndex} rendered:`, result.textureName);
                }
            } catch (error) {
                console.warn(`[BreedingHatchScene] Failed to render twin ${twinIndex}:`, error);
            }
        }

        // Fallback circle if rendering failed
        if (!creatureRendered) {
            const visual = this.add.graphics();
            const color = this.getCreatureColor(genes);
            visual.fillStyle(color, 0.95);
            visual.fillCircle(x, y, 35);
            visual.lineStyle(2, 0xFFD700, 1);
            visual.strokeCircle(x, y, 35);
            visual.setDepth(100);
            visual.setScale(0);
            this.elements.push(visual);

            this.tweens.add({
                targets: visual,
                scaleX: 1,
                scaleY: 1,
                duration: 500,
                ease: 'Back.easeOut'
            });
        }

        // Twin label
        const label = this.add.text(x, y + 60, `Twin ${twinIndex}`, {
            fontSize: '14px',
            color: twinIndex === 1 ? '#88CCFF' : '#FF88CC',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(label);

        this.tweens.add({
            targets: label,
            alpha: 1,
            duration: 300,
            delay: 400
        });

        // Rarity badge
        const rarity = data?.rarity || 'common';
        const rarityColors = {
            common: '#AAAAAA',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FFD700'
        };
        const rarityLabel = this.add.text(x, y + 78, rarity.toUpperCase(), {
            fontSize: '10px',
            color: rarityColors[rarity] || '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(rarityLabel);

        this.tweens.add({
            targets: rarityLabel,
            alpha: 1,
            duration: 300,
            delay: 500
        });

        // Play chirp
        window.AudioManager?.playBabyChirp?.();
    }

    /**
     * Show inheritance info for twins
     */
    showTwinInheritanceInfo(width, height, creatureY) {
        const panelY = creatureY + 100;
        const panelHeight = 200;

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.9);
        panel.fillRoundedRect(width / 2 - 170, panelY, 340, panelHeight, 15);
        panel.lineStyle(2, 0xFF69B4, 0.8);
        panel.strokeRoundedRect(width / 2 - 170, panelY, 340, panelHeight, 15);
        panel.setDepth(100).setAlpha(0);
        this.elements.push(panel);

        this.tweens.add({
            targets: panel,
            alpha: 1,
            duration: 300
        });

        let y = panelY + 20;

        // Twin birth message
        const twinMsg = this.add.text(width / 2, y, '👯 A Double Blessing! 👯', {
            fontSize: '16px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(twinMsg);
        y += 25;

        // Description
        const desc = this.add.text(width / 2, y, 'Two unique creatures born together,\neach with their own traits and destiny!', {
            fontSize: '11px',
            color: '#E0E0E0',
            align: 'center'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(desc);
        y += 40;

        // Twin 1 info
        const twin1Rarity = this.twin1?.offspringData?.rarity || 'common';
        const twin1Gen = this.twin1?.offspringData?.generation || 2;
        const twin1Info = this.add.text(width / 2, y, `Twin 1: ${twin1Rarity.toUpperCase()} • Gen ${twin1Gen}`, {
            fontSize: '12px',
            color: '#88CCFF'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(twin1Info);
        y += 20;

        // Twin 2 info
        const twin2Rarity = this.twin2?.offspringData?.rarity || 'common';
        const twin2Gen = this.twin2?.offspringData?.generation || 2;
        const twin2Info = this.add.text(width / 2, y, `Twin 2: ${twin2Rarity.toUpperCase()} • Gen ${twin2Gen}`, {
            fontSize: '12px',
            color: '#FF88CC'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(twin2Info);
        y += 25;

        // Parent heritage
        const p1Name = this.parent1Data?.name || 'Parent 1';
        const p2Name = this.parent2Data?.name || 'Parent 2';
        const heritage = this.add.text(width / 2, y, `Children of ${p1Name} & ${p2Name}`, {
            fontSize: '11px',
            color: '#9370DB',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(heritage);

        // Animate text
        [twinMsg, desc, twin1Info, twin2Info, heritage].forEach((el, i) => {
            this.tweens.add({
                targets: el,
                alpha: 1,
                y: el.y - 5,
                duration: 300,
                delay: 200 + i * 150
            });
        });

        // Show naming prompt for twins
        this.time.delayedCall(1500, () => {
            this.showTwinNamingPrompt(width, height);
        });
    }

    /**
     * Show naming prompt for both twins
     */
    showTwinNamingPrompt(width, height) {
        this.phase = 'naming';

        const promptY = height - 120;

        // Generate default names
        const namePrefixes = ['Star', 'Moon', 'Nova', 'Cosmic', 'Nebula', 'Crystal'];
        const nameSuffixes = ['ling', 'spark', 'wing', 'heart', 'soul', 'glow'];

        this.twin1Name = namePrefixes[Phaser.Math.Between(0, namePrefixes.length - 1)] +
            nameSuffixes[Phaser.Math.Between(0, nameSuffixes.length - 1)];
        this.twin2Name = namePrefixes[Phaser.Math.Between(0, namePrefixes.length - 1)] +
            nameSuffixes[Phaser.Math.Between(0, nameSuffixes.length - 1)];

        // Make sure names are different
        while (this.twin2Name === this.twin1Name) {
            this.twin2Name = namePrefixes[Phaser.Math.Between(0, namePrefixes.length - 1)] +
                nameSuffixes[Phaser.Math.Between(0, nameSuffixes.length - 1)];
        }

        // Prompt text
        const promptText = this.add.text(width / 2, promptY - 40, 'Name Your Twins:', {
            fontSize: '16px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(200);
        this.elements.push(promptText);

        // Twin 1 name box
        const box1 = this.add.graphics();
        box1.fillStyle(0x2A1A4E, 0.9);
        box1.fillRoundedRect(width * 0.25 - 70, promptY - 5, 140, 35, 8);
        box1.lineStyle(2, 0x88CCFF, 0.8);
        box1.strokeRoundedRect(width * 0.25 - 70, promptY - 5, 140, 35, 8);
        box1.setDepth(200);
        this.elements.push(box1);

        const name1Text = this.add.text(width * 0.25, promptY + 12, this.twin1Name, {
            fontSize: '14px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);
        this.elements.push(name1Text);

        // Twin 2 name box
        const box2 = this.add.graphics();
        box2.fillStyle(0x2A1A4E, 0.9);
        box2.fillRoundedRect(width * 0.75 - 70, promptY - 5, 140, 35, 8);
        box2.lineStyle(2, 0xFF88CC, 0.8);
        box2.strokeRoundedRect(width * 0.75 - 70, promptY - 5, 140, 35, 8);
        box2.setDepth(200);
        this.elements.push(box2);

        const name2Text = this.add.text(width * 0.75, promptY + 12, this.twin2Name, {
            fontSize: '14px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);
        this.elements.push(name2Text);

        // Editable zones
        const zone1 = this.add.zone(width * 0.25 - 70, promptY - 5, 140, 35).setOrigin(0, 0);
        zone1.setInteractive().setDepth(202);
        zone1.on('pointerdown', () => {
            const newName = prompt('Name Twin 1:', this.twin1Name);
            if (newName && newName.trim().length > 0) {
                this.twin1Name = newName.trim().substring(0, 20);
                name1Text.setText(this.twin1Name);
            }
        });

        const zone2 = this.add.zone(width * 0.75 - 70, promptY - 5, 140, 35).setOrigin(0, 0);
        zone2.setInteractive().setDepth(202);
        zone2.on('pointerdown', () => {
            const newName = prompt('Name Twin 2:', this.twin2Name);
            if (newName && newName.trim().length > 0) {
                this.twin2Name = newName.trim().substring(0, 20);
                name2Text.setText(this.twin2Name);
            }
        });

        // Confirm button
        const confirmBtn = this.add.text(width / 2, promptY + 55, '✓ Welcome Both to the Family!', {
            fontSize: '16px',
            color: '#FFFFFF',
            backgroundColor: '#00AA00',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setDepth(200).setInteractive();
        this.elements.push(confirmBtn);

        confirmBtn.on('pointerdown', () => {
            this.completeTwinBreeding();
        });

        confirmBtn.on('pointerover', () => confirmBtn.setStyle({ backgroundColor: '#00DD00' }));
        confirmBtn.on('pointerout', () => confirmBtn.setStyle({ backgroundColor: '#00AA00' }));
    }

    /**
     * Complete breeding for BOTH twins
     */
    completeTwinBreeding() {
        console.log('[BreedingHatchScene] Completing twin breeding:', this.twin1Name, '&', this.twin2Name);

        const { width, height } = this.scale;
        const addedCreatures = [];

        // Create and add BOTH twins to collection
        [
            { data: this.twin1, name: this.twin1Name, textureName: this.twin1TextureName, index: 1 },
            { data: this.twin2, name: this.twin2Name, textureName: this.twin2TextureName, index: 2 }
        ].forEach(twin => {
            const creatureData = {
                id: `creature_${Date.now()}_twin${twin.index}_${Math.random().toString(36).substr(2, 9)}`,
                name: twin.name,
                genes: twin.data?.offspringGenes,
                dna: twin.data?.offspringGenes,
                personality: null,
                personalityState: null,
                stats: { happiness: 100, energy: 100, health: 100 },
                level: 1,
                experience: 0,
                textureName: twin.textureName || null,
                hatchTime: Date.now(),
                lifecycle: {
                    birthDate: Date.now(),
                    stage: 'baby',
                    lastStageChange: Date.now(),
                    evolutionHistory: []
                },
                cosmicAffinity: twin.data?.offspringGenes?.cosmicAffinity,
                rarity: twin.data?.offspringData?.rarity || 'common',
                addedAt: Date.now(),
                isOffspring: true,
                isTwin: true,
                twinIndex: twin.index,
                twinSiblingName: twin.index === 1 ? this.twin2Name : this.twin1Name,
                generation: twin.data?.offspringData?.generation || 2,
                parentIds: twin.data?.offspringData?.parentIds || [],
                offspringBonus: twin.data?.offspringData?.offspringBonus || null,
                birthEvents: twin.data?.offspringData?.birthEvents || [],
                secretAbilities: twin.data?.offspringData?.secretAbilities || []
            };

            // Handle both old boolean return and new object return for backward compatibility
            const result = window.GameState?.addCreatureToCollection?.(creatureData);
            const isSuccess = result === true || (result && result.success);
            if (isSuccess) {
                addedCreatures.push(creatureData);
                console.log(`[BreedingHatchScene] Twin ${twin.index} added:`, twin.name);
            } else {
                console.log(`[BreedingHatchScene] Twin ${twin.index} failed:`, result?.reason || 'unknown');
            }
        });

        if (addedCreatures.length === 2) {
            // Set the FIRST twin as active creature
            const firstTwin = addedCreatures[0];

            window.GameState?.set('creature.name', firstTwin.name);
            window.GameState?.set('creature.genes', firstTwin.genes);
            window.GameState?.set('creature.dna', firstTwin.dna);
            window.GameState?.set('creature.personality', null);
            window.GameState?.set('creature.personalityState', null);
            window.GameState?.set('creature.stats', firstTwin.stats);
            window.GameState?.set('creature.level', 1);
            window.GameState?.set('creature.experience', 0);
            window.GameState?.set('creature.textureName', null);
            window.GameState?.set('creature.lifecycle', firstTwin.lifecycle);
            window.GameState?.set('creature.rarity', firstTwin.rarity);
            window.GameState?.set('creature.cosmicAffinity', firstTwin.cosmicAffinity);
            window.GameState?.set('creature.generation', firstTwin.generation);
            window.GameState?.set('creature.hatched', true);
            window.GameState?.set('creature.named', true);
            window.GameState?.save?.();

            // Success message
            const successText = this.add.text(width / 2, height / 2,
                `✅ ${this.twin1Name} & ${this.twin2Name}\njoined your family!`, {
                fontSize: '18px',
                color: '#00FF00',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }).setOrigin(0.5).setDepth(300);

            window.AudioManager?.playPurchase?.();
            window.AudioManager?.playLevelUp?.();

            // Extra celebration for twins
            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst(this, width * 0.35, height / 2, {
                    count: 25,
                    color: [0x88CCFF, 0xFFD700],
                    duration: 2000
                });
                window.FXLibrary.stardustBurst(this, width * 0.65, height / 2, {
                    count: 25,
                    color: [0xFF88CC, 0xFFD700],
                    duration: 2000
                });
            }

            this.time.delayedCall(3000, () => {
                this.returnToGame();
            });
        } else if (addedCreatures.length === 1) {
            // Only one twin added (collection might be almost full)
            const successText = this.add.text(width / 2, height / 2,
                `✅ ${addedCreatures[0].name} joined!\n⚠️ Collection full for second twin`, {
                fontSize: '16px',
                color: '#FFAA00',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            }).setOrigin(0.5).setDepth(300);

            window.AudioManager?.playPurchase?.();

            this.time.delayedCall(2500, () => {
                this.returnToGame();
            });
        } else {
            // Collection full
            const errorText = this.add.text(width / 2, height / 2, '❌ Collection is full!', {
                fontSize: '18px',
                color: '#FF6666',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(300);

            window.AudioManager?.playError?.();

            this.time.delayedCall(2000, () => {
                this.returnToGame();
            });
        }
    }

    showInheritanceInfo(width, height, creatureY) {
        const panelY = creatureY + 80;
        const offspringData = this.offspringData || {};

        // Calculate panel height based on content
        let panelHeight = 180; // Base height
        if (this.birthEvents && this.birthEvents.length > 0) {
            panelHeight += 20 + (this.birthEvents.length * 16); // Header + events
        }
        if (offspringData.secretAbilities && offspringData.secretAbilities.length > 0) {
            panelHeight += 20 + (offspringData.secretAbilities.length * 16); // Header + abilities
        }

        // Inheritance panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.9);
        panel.fillRoundedRect(width / 2 - 160, panelY, 320, panelHeight, 15);
        panel.lineStyle(2, 0x9370DB, 0.8);
        panel.strokeRoundedRect(width / 2 - 160, panelY, 320, panelHeight, 15);
        panel.setDepth(100).setAlpha(0);
        this.elements.push(panel);

        this.tweens.add({
            targets: panel,
            alpha: 1,
            duration: 300
        });

        let y = panelY + 20;

        // From Parent 1
        const p1Name = offspringData.parentNames?.[0] || 'Parent 1';
        const from1 = this.add.text(width / 2, y, `From ${p1Name}:`, {
            fontSize: '12px',
            color: '#88CCFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(from1);
        y += 18;

        const traits1 = offspringData.inheritedTraits?.fromParent1 || ['Body Shape', 'Pattern'];
        const traits1Text = this.add.text(width / 2, y, traits1.join(', '), {
            fontSize: '11px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(traits1Text);
        y += 25;

        // From Parent 2
        const p2Name = offspringData.parentNames?.[1] || 'Parent 2';
        const from2 = this.add.text(width / 2, y, `From ${p2Name}:`, {
            fontSize: '12px',
            color: '#FF88CC',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(from2);
        y += 18;

        const traits2 = offspringData.inheritedTraits?.fromParent2 || ['Eye Color', 'Markings'];
        const traits2Text = this.add.text(width / 2, y, traits2.join(', '), {
            fontSize: '11px',
            color: '#FFFFFF'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(traits2Text);
        y += 25;

        // Generation & Rarity
        const gen = offspringData.generation || 2;
        const rarity = offspringData.rarity || 'common';
        const rarityColors = {
            common: '#AAAAAA',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FFD700'
        };

        const genRarityText = this.add.text(width / 2, y, `Generation ${gen} • ${rarity.toUpperCase()}`, {
            fontSize: '14px',
            color: rarityColors[rarity] || '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101).setAlpha(0);
        this.elements.push(genRarityText);
        y += 22;

        // Offspring bonus
        const bonus = offspringData.offspringBonus;
        if (bonus) {
            const bonusText = this.add.text(width / 2, y, `✨ ${bonus.description}`, {
                fontSize: '12px',
                color: '#88FF88'
            }).setOrigin(0.5).setDepth(101).setAlpha(0);
            this.elements.push(bonusText);
            y += 20;
        }

        // BIRTH EVENTS: Show any triggered special events
        const birthEventElements = [];
        if (this.birthEvents && this.birthEvents.length > 0) {
            // Show birth events header
            const eventHeader = this.add.text(width / 2, y, '🎊 Special Birth Events:', {
                fontSize: '12px',
                color: '#FFD700',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(101).setAlpha(0);
            this.elements.push(eventHeader);
            birthEventElements.push(eventHeader);
            y += 18;

            // Show each event
            this.birthEvents.forEach(event => {
                const eventText = this.add.text(width / 2, y, event.message, {
                    fontSize: '11px',
                    color: this.getBirthEventColor(event.rarity)
                }).setOrigin(0.5).setDepth(101).setAlpha(0);
                this.elements.push(eventText);
                birthEventElements.push(eventText);
                y += 16;
            });

            // Play extra celebration for rare events
            if (this.hasRareEvent) {
                this.time.delayedCall(500, () => {
                    window.AudioManager?.playAchievement?.();
                    if (window.FXLibrary) {
                        window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                            count: 50,
                            color: [0xFFD700, 0xFF69B4, 0x9370DB],
                            duration: 2500
                        });
                    }
                });
            }
        }

        // SECRET ABILITIES: Show any unlocked abilities
        const abilityElements = [];
        if (offspringData.secretAbilities && offspringData.secretAbilities.length > 0) {
            const abilityHeader = this.add.text(width / 2, y, '🌟 Secret Abilities Unlocked:', {
                fontSize: '12px',
                color: '#FF69B4',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(101).setAlpha(0);
            this.elements.push(abilityHeader);
            abilityElements.push(abilityHeader);
            y += 18;

            offspringData.secretAbilities.forEach(ability => {
                const abilityText = this.add.text(width / 2, y, `${ability.icon} ${ability.name}`, {
                    fontSize: '11px',
                    color: '#E0BBE4'
                }).setOrigin(0.5).setDepth(101).setAlpha(0);
                this.elements.push(abilityText);
                abilityElements.push(abilityText);
                y += 16;
            });
        }

        // Animate in sequence
        const textElements = [from1, traits1Text, from2, traits2Text, genRarityText, ...birthEventElements, ...abilityElements];
        textElements.forEach((el, i) => {
            this.tweens.add({
                targets: el,
                alpha: 1,
                y: el.y - 5,
                duration: 300,
                delay: 200 + i * 150
            });
        });

        // Show naming prompt after info displayed
        this.time.delayedCall(1500, () => {
            this.showNamingPrompt(width, height);
        });
    }

    showNamingPrompt(width, height) {
        this.phase = 'naming';

        const promptY = height - 100;

        // Name your offspring text
        const promptText = this.add.text(width / 2, promptY - 30, 'Name Your New Creature:', {
            fontSize: '16px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(200);
        this.elements.push(promptText);

        // Generate default name
        const namePrefixes = ['Star', 'Moon', 'Nova', 'Cosmic', 'Nebula', 'Crystal', 'Void', 'Astral'];
        const nameSuffixes = ['ling', 'spark', 'wing', 'heart', 'soul', 'glow', 'beam', 'dust'];
        const defaultName = namePrefixes[Phaser.Math.Between(0, namePrefixes.length - 1)] +
            nameSuffixes[Phaser.Math.Between(0, nameSuffixes.length - 1)];

        // Name display (tap to edit)
        this.offspringName = defaultName;

        const nameBox = this.add.graphics();
        nameBox.fillStyle(0x2A1A4E, 0.9);
        nameBox.fillRoundedRect(width / 2 - 100, promptY - 5, 200, 40, 8);
        nameBox.lineStyle(2, 0xFFD700, 0.8);
        nameBox.strokeRoundedRect(width / 2 - 100, promptY - 5, 200, 40, 8);
        nameBox.setDepth(200);
        this.elements.push(nameBox);

        const nameText = this.add.text(width / 2, promptY + 15, this.offspringName, {
            fontSize: '18px',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);
        this.elements.push(nameText);

        // Confirm button
        const confirmBtn = this.add.text(width / 2, promptY + 60, '✓ Welcome to the Family!', {
            fontSize: '16px',
            color: '#FFFFFF',
            backgroundColor: '#00AA00',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setDepth(200).setInteractive();
        this.elements.push(confirmBtn);

        confirmBtn.on('pointerdown', () => {
            this.completeBreeding();
        });

        confirmBtn.on('pointerover', () => confirmBtn.setStyle({ backgroundColor: '#00DD00' }));
        confirmBtn.on('pointerout', () => confirmBtn.setStyle({ backgroundColor: '#00AA00' }));

        // Make name editable on mobile
        const nameZone = this.add.zone(width / 2 - 100, promptY - 5, 200, 40).setOrigin(0, 0);
        nameZone.setInteractive().setDepth(202);

        nameZone.on('pointerdown', () => {
            // Simple prompt for name change
            const newName = prompt('Enter creature name:', this.offspringName);
            if (newName && newName.trim().length > 0) {
                this.offspringName = newName.trim().substring(0, 20);
                nameText.setText(this.offspringName);
            }
        });
    }

    completeBreeding() {
        console.log('[BreedingHatchScene] Completing breeding with name:', this.offspringName);

        // Create creature data for collection
        const creatureData = {
            id: `creature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: this.offspringName,
            genes: this.offspringGenes,
            dna: this.offspringGenes,
            personality: null,
            personalityState: null,
            stats: { happiness: 100, energy: 100, health: 100 },
            level: 1,
            experience: 0,
            textureName: this.offspringTextureName || null, // Store rendered texture
            hatchTime: Date.now(),
            lifecycle: {
                birthDate: Date.now(),
                stage: 'baby',
                lastStageChange: Date.now(),
                evolutionHistory: []
            },
            cosmicAffinity: this.offspringGenes?.cosmicAffinity,
            rarity: this.offspringData?.rarity || 'common',
            addedAt: Date.now(),
            isOffspring: true,
            generation: this.offspringData?.generation || 2,
            parentIds: this.offspringData?.parentIds || [],
            offspringBonus: this.offspringData?.offspringBonus || null,
            // Birth events and special abilities
            birthEvents: this.offspringData?.birthEvents || [],
            secretAbilities: this.offspringData?.secretAbilities || [],
            isShiny: this.offspringData?.isShiny || false,
            hasDualAffinity: this.offspringData?.hasDualAffinity || false,
            dualAffinity: this.offspringData?.dualAffinity || null
        };

        // Add to collection - returns object with { success, reason, creature }
        const result = window.GameState?.addCreatureToCollection?.(creatureData);

        // Handle both old boolean return and new object return for backward compatibility
        const isSuccess = result === true || (result && result.success);
        const failureReason = result?.reason || 'unknown';

        const { width, height } = this.scale;

        if (isSuccess) {
            // CRITICAL: Set the new baby as the active creature
            // This ensures the player sees their new baby when returning to GameScene
            console.log('[BreedingHatchScene] Setting new baby as active creature');

            // Set all active creature properties
            window.GameState?.set('creature.name', creatureData.name);
            window.GameState?.set('creature.genes', creatureData.genes);
            window.GameState?.set('creature.dna', creatureData.dna);
            window.GameState?.set('creature.personality', creatureData.personality);
            window.GameState?.set('creature.personalityState', creatureData.personalityState);
            window.GameState?.set('creature.stats', creatureData.stats);
            window.GameState?.set('creature.level', creatureData.level);
            window.GameState?.set('creature.experience', creatureData.experience);
            // CRITICAL: Preserve the rendered texture name so the creature looks the same
            // Setting to null would cause regeneration with different random values
            window.GameState?.set('creature.textureName', this.offspringTextureName || null);
            window.GameState?.set('creature.lifecycle', creatureData.lifecycle);
            window.GameState?.set('creature.rarity', creatureData.rarity);
            window.GameState?.set('creature.cosmicAffinity', creatureData.cosmicAffinity);
            window.GameState?.set('creature.generation', creatureData.generation);
            window.GameState?.set('creature.parentIds', creatureData.parentIds);
            window.GameState?.set('creature.isOffspring', true);
            window.GameState?.set('creature.offspringBonus', creatureData.offspringBonus);
            window.GameState?.set('creature.hatched', true);
            window.GameState?.set('creature.named', true);

            // Save the state
            window.GameState?.save?.();

            console.log('[BreedingHatchScene] Baby creature set as active:', creatureData.name, 'stage:', creatureData.lifecycle.stage);

            // Success message
            const successText = this.add.text(width / 2, height / 2, `✅ ${this.offspringName} joined your family!`, {
                fontSize: '20px',
                color: '#00FF00',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(300);

            window.AudioManager?.playPurchase?.();

            // Final celebration
            if (window.FXLibrary) {
                window.FXLibrary.stardustBurst(this, width / 2, height / 2, {
                    count: 30,
                    color: [0x00FF00, 0xFFD700],
                    duration: 2000
                });
            }

            // Return to game after delay
            this.time.delayedCall(2500, () => {
                this.returnToGame();
            });
        } else {
            // Show appropriate error message based on failure reason
            let errorMessage = '❌ Something went wrong!';
            if (failureReason === 'full') {
                errorMessage = '❌ Collection is full (8/8)!\nRelease a creature to make room.';
            } else if (failureReason === 'duplicate') {
                // This shouldn't happen for bred offspring, but handle it gracefully
                console.warn('[BreedingHatchScene] Duplicate creature detected - this is unusual for breeding');
                errorMessage = '⚠️ Creature already exists!\nPlease try breeding again.';
            }

            console.log('[BreedingHatchScene] Failed to add creature:', failureReason);

            const errorText = this.add.text(width / 2, height / 2, errorMessage, {
                fontSize: '18px',
                color: '#FF6666',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            }).setOrigin(0.5).setDepth(300);

            window.AudioManager?.playError?.();

            this.time.delayedCall(2500, () => {
                this.returnToGame();
            });
        }
    }

    returnToGame() {
        this.scene.start('GameScene');
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

    shutdown() {
        console.log('[BreedingHatchScene] Shutting down...');

        // Destroy all tracked elements
        this.elements.forEach(el => {
            try {
                el?.destroy?.();
            } catch (e) {
                // Element might already be destroyed
            }
        });
        this.elements = [];

        // Clear timers
        if (this.time) {
            this.time.removeAllEvents();
        }

        // Kill all tweens
        if (this.tweens) {
            this.tweens.killAll();
        }

        // Clean up sprite references
        this.parent1Sprite = null;
        this.parent2Sprite = null;
        this.offspringSprite = null;
        this.offspringTextureName = null;

        // Clean up data references
        this.offspringData = null;
        this.offspringGenes = null;
        this.parent1Data = null;
        this.parent2Data = null;

        // Clean up graphics engine
        this.graphicsEngine = null;

        console.log('[BreedingHatchScene] Cleanup complete');
    }
}

// Export for module systems
export default BreedingHatchScene;

// Register globally
if (typeof window !== 'undefined') {
    window.BreedingHatchScene = BreedingHatchScene;
}
