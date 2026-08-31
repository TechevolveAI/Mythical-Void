/**
 * ErrorHandler - Centralized error handling system with recovery options
 * Provides user-friendly error messages and recovery mechanisms
 */

const OBSERVABILITY_STORAGE_KEY = 'mythical_void_observability_v1';
const OBSERVABILITY_ENDPOINT = '/.netlify/functions/observability-events';
const OBSERVABILITY_SCHEMA_VERSION = 1;
const OBSERVABILITY_QUEUE_LIMIT = 20;
const OBSERVABILITY_BATCH_LIMIT = 10;
const OBSERVABILITY_DEDUPE_MS = 30000;
const OBSERVABILITY_EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBSERVABILITY_DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const OBSERVABILITY_DELIVERY_ENABLED = typeof __MYTHICAL_OBSERVABILITY_DELIVERY_ENABLED__ === 'boolean'
    ? __MYTHICAL_OBSERVABILITY_DELIVERY_ENABLED__
    : true;

const OBSERVABILITY_CATEGORIES = new Set([
    'runtime',
    'scene_transition',
    'persistence',
    'network',
    'stuck_flow'
]);

const OBSERVABILITY_CODES = new Set([
    'runtime_uncaught',
    'promise_unhandled',
    'phaser_error',
    'scene_error',
    'scene_loading_timeout',
    'scene_no_active',
    'local_save_failed',
    'local_load_failed',
    'cloud_save_failed',
    'cloud_load_failed',
    'cloud_sync_failed',
    'cloud_sync_stalled',
    'cloud_save_conflict',
    'network_request_failed',
    'game_boot_failed',
    'unknown_critical'
]);

const OBSERVABILITY_SCENES = new Set([
    'HatchingScene',
    'PersonalityScene',
    'NamingScene',
    'SoulRevealScene',
    'GameScene',
    'ShopScene',
    'InventoryScene',
    'FusionPodScene',
    'BreedingHatchScene',
    'HubWorldScene',
    'CreatureProfileScene',
    'WelcomeBackScene',
    'VoidMiniGameScene',
    'AchievementMenuScene',
    'AbilitySelectionScene',
    'PlatformerLevel',
    'PlatformerLevelScene',
    'MythicalForestLevel',
    'CrystalCavesLevel',
    'ReefLevel',
    'VoidPeaksLevel',
    'AuroraDepthsLevel',
    'FinalVoidLevel',
    'VictoryScene',
    'unknown'
]);

const OBSERVABILITY_PHASES = new Set([
    'boot',
    'runtime',
    'start',
    'create',
    'transition',
    'save',
    'load',
    'sync',
    'unknown'
]);

const OBSERVABILITY_RECOVERY = new Set([
    'continued',
    'local_fallback',
    'retry_scheduled',
    'reload_offered',
    'manual_retry',
    'none',
    'unknown'
]);

const OBSERVABILITY_CONNECTIVITY = new Set(['online', 'offline', 'unknown']);
const OBSERVABILITY_VIEWPORT_CLASSES = new Set(['compact', 'medium', 'wide', 'unknown']);
const OBSERVABILITY_SEVERITIES = new Set(['warning', 'error']);
const OBSERVABILITY_EVENT_KEYS = new Set([
    'schema_version',
    'event_id',
    'occurred_at',
    'category',
    'code',
    'severity',
    'scene',
    'phase',
    'recovery',
    'connectivity',
    'viewport_class',
    'user_visible',
    'deployment_id'
]);
const OBSERVABILITY_LEGACY_EVENT_KEYS = new Set(
    [...OBSERVABILITY_EVENT_KEYS].filter(key => key !== 'deployment_id')
);

function getDefaultStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (error) {
        return null;
    }
}

function getClientDeploymentId() {
    try {
        const value = typeof __MYTHICAL_RELEASE_ID__ !== 'undefined'
            ? __MYTHICAL_RELEASE_ID__
            : 'local';
        return OBSERVABILITY_DEPLOYMENT_ID_PATTERN.test(value) ? value : 'unknown';
    } catch (error) {
        return 'unknown';
    }
}

function createEventId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    const randomPart = Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12);
    return `00000000-0000-4000-8000-${randomPart}`;
}

function normalizeScene(scene) {
    const sceneKey = typeof scene === 'string'
        ? scene
        : scene?.sys?.settings?.key || scene?.scene?.key;
    return OBSERVABILITY_SCENES.has(sceneKey) ? sceneKey : 'unknown';
}

function getViewportClass() {
    if (typeof window === 'undefined') return 'unknown';
    const width = Number(window.visualViewport?.width || window.innerWidth || 0);
    if (!Number.isFinite(width) || width <= 0) return 'unknown';
    if (width < 480) return 'compact';
    if (width < 900) return 'medium';
    return 'wide';
}

function getConnectivity() {
    if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
        return 'unknown';
    }
    return navigator.onLine ? 'online' : 'offline';
}

class PrivacyObservabilityTransport {
    constructor(options = {}) {
        this.endpoint = options.endpoint || OBSERVABILITY_ENDPOINT;
        this.storage = options.storage || getDefaultStorage();
        this.fetch = options.fetch || (
            typeof fetch === 'function' ? fetch.bind(globalThis) : null
        );
        this.now = options.now || (() => Date.now());
        this.queue = [];
        this.flushPromise = null;
        this.retryTimer = null;
        this.recentFingerprints = new Map();
        this.initialized = false;
        this.deliveryDisabled = options.deliveryEnabled === false || !OBSERVABILITY_DELIVERY_ENABLED;
        this.boundFlush = () => this.flush();
    }

    initialize() {
        if (this.initialized) return;
        this.initialized = true;

        // Portal builds are self-contained and must not repeatedly call a
        // website-only collection endpoint that does not exist on the host.
        if (this.deliveryDisabled) {
            this.queue = [];
            return;
        }

        this.queue = this.readQueue();
        this.persistQueue();

        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.boundFlush);
            window.addEventListener('pagehide', this.boundFlush);
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.boundFlush);
        }

        this.flush();
    }

    destroy() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.boundFlush);
            window.removeEventListener('pagehide', this.boundFlush);
        }
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.boundFlush);
        }
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        this.initialized = false;
    }

    capture(summary) {
        if (this.deliveryDisabled) return false;
        const event = this.createSanitizedEvent(summary);
        if (!event || this.isDuplicate(event)) return false;

        this.queue.push(event);
        this.queue = this.queue.slice(-OBSERVABILITY_QUEUE_LIMIT);
        this.persistQueue();
        this.flush();
        return true;
    }

    createSanitizedEvent(summary = {}) {
        if (!OBSERVABILITY_CODES.has(summary.code)) return null;

        const category = OBSERVABILITY_CATEGORIES.has(summary.category)
            ? summary.category
            : 'runtime';
        const severity = summary.severity === 'warning' ? 'warning' : 'error';
        const phase = OBSERVABILITY_PHASES.has(summary.phase)
            ? summary.phase
            : 'unknown';
        const recovery = OBSERVABILITY_RECOVERY.has(summary.recovery)
            ? summary.recovery
            : 'unknown';

        return {
            schema_version: OBSERVABILITY_SCHEMA_VERSION,
            event_id: createEventId(),
            occurred_at: new Date(this.now()).toISOString(),
            category,
            code: summary.code,
            severity,
            scene: normalizeScene(summary.scene),
            phase,
            recovery,
            connectivity: getConnectivity(),
            viewport_class: getViewportClass(),
            user_visible: summary.userVisible === true,
            deployment_id: getClientDeploymentId()
        };
    }

    isDuplicate(event) {
        const now = this.now();
        const fingerprint = [
            event.category,
            event.code,
            event.scene,
            event.phase,
            event.recovery
        ].join(':');
        const previous = this.recentFingerprints.get(fingerprint) || 0;

        for (const [key, timestamp] of this.recentFingerprints) {
            if (now - timestamp > OBSERVABILITY_DEDUPE_MS) {
                this.recentFingerprints.delete(key);
            }
        }
        if (previous > 0 && now - previous < OBSERVABILITY_DEDUPE_MS) return true;

        this.recentFingerprints.set(fingerprint, now);
        return false;
    }

    readQueue() {
        try {
            const stored = JSON.parse(this.storage?.getItem(OBSERVABILITY_STORAGE_KEY) || '[]');
            if (!Array.isArray(stored)) return [];
            return stored
                .filter(event => this.isValidStoredEvent(event))
                .map(event => ({
                    ...event,
                    deployment_id: event.deployment_id || getClientDeploymentId()
                }))
                .slice(-OBSERVABILITY_QUEUE_LIMIT);
        } catch (error) {
            return [];
        }
    }

    isValidStoredEvent(event) {
        if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
        const keys = Object.keys(event);
        const currentKeys = keys.length === OBSERVABILITY_EVENT_KEYS.size &&
            keys.every(key => OBSERVABILITY_EVENT_KEYS.has(key));
        const legacyKeys = keys.length === OBSERVABILITY_LEGACY_EVENT_KEYS.size &&
            keys.every(key => OBSERVABILITY_LEGACY_EVENT_KEYS.has(key));
        return (currentKeys || legacyKeys) &&
            event.schema_version === OBSERVABILITY_SCHEMA_VERSION &&
            OBSERVABILITY_EVENT_ID_PATTERN.test(event.event_id || '') &&
            Number.isFinite(Date.parse(event.occurred_at)) &&
            OBSERVABILITY_CATEGORIES.has(event.category) &&
            OBSERVABILITY_CODES.has(event.code) &&
            OBSERVABILITY_SEVERITIES.has(event.severity) &&
            OBSERVABILITY_SCENES.has(event.scene) &&
            OBSERVABILITY_PHASES.has(event.phase) &&
            OBSERVABILITY_RECOVERY.has(event.recovery) &&
            OBSERVABILITY_CONNECTIVITY.has(event.connectivity) &&
            OBSERVABILITY_VIEWPORT_CLASSES.has(event.viewport_class) &&
            (
                event.deployment_id === undefined ||
                OBSERVABILITY_DEPLOYMENT_ID_PATTERN.test(event.deployment_id)
            ) &&
            typeof event.user_visible === 'boolean';
    }

    persistQueue() {
        try {
            if (this.queue.length === 0) {
                this.storage?.removeItem(OBSERVABILITY_STORAGE_KEY);
            } else {
                this.storage?.setItem(
                    OBSERVABILITY_STORAGE_KEY,
                    JSON.stringify(this.queue)
                );
            }
        } catch (error) {
            // Remote delivery still proceeds when durable browser storage is unavailable.
        }
    }

    async flush() {
        if (this.flushPromise) return this.flushPromise;
        if (!this.fetch || this.queue.length === 0) return false;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;

        const events = this.queue.slice(0, OBSERVABILITY_BATCH_LIMIT);
        this.flushPromise = this.send(events)
            .then(delivered => {
                if (delivered) {
                    const deliveredIds = new Set(events.map(event => event.event_id));
                    this.queue = this.queue.filter(event => !deliveredIds.has(event.event_id));
                    this.persistQueue();
                }
                return delivered;
            })
            .finally(() => {
                this.flushPromise = null;
                if (this.initialized && this.queue.length > 0 && !this.retryTimer) {
                    this.retryTimer = setTimeout(() => {
                        this.retryTimer = null;
                        this.flush();
                    }, 10000);
                }
            });
        return this.flushPromise;
    }

    async send(events) {
        try {
            const response = await this.fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                keepalive: true,
                body: JSON.stringify({ events })
            });
            if (
                response &&
                [400, 401, 403, 404, 405, 410, 413, 422].includes(response.status)
            ) {
                // Observability is optional. A permanent endpoint/configuration
                // failure must never create a ten-second retry loop in gameplay.
                this.deliveryDisabled = true;
                return true;
            }
            return response?.ok === true;
        } catch (error) {
            // Avoid recursive reporting when the observability endpoint is unavailable.
            return false;
        }
    }
}

class ErrorHandler {
    constructor() {
        this.errorQueue = [];
        this.maxErrors = 10;
        this.errorContainer = null;
        this.isInitialized = false;
        this.observability = new PrivacyObservabilityTransport();
        this.sceneWatchdog = null;
        this.sceneStartDeadlines = new Map();
        this.observedScenes = new WeakSet();
        this.lastHealthySceneAt = Date.now();
        this.lastHealthySceneKey = 'unknown';
        this.intentionalPauseScene = null;
        this.noActiveSceneReported = false;
        this.cloudStatus = null;
        this.cloudSyncStartedAt = null;
        this.cloudSyncStallReported = false;

        // Rate limiting for user-facing messages
        this.lastMessageTime = 0;
        this.messageRateLimitMs = 2000; // Minimum 2 seconds between messages
        this.messagesShownThisSession = 0;
        this.maxMessagesPerSession = 5; // Don't spam users with too many errors

        // Suppress known non-critical errors (these have graceful fallbacks)
        this.suppressedPatterns = [
            /ResizeObserver loop/i,
            /MetaMask/i,
            /Extension context/i,
            /chrome-extension/i,
            /moz-extension/i,
            /safari-extension/i,
            /api\.nasa\.gov/i,  // NASA API errors - graceful fallbacks exist
            /APOD/i             // APOD specific errors
        ];
    }

    /**
     * Initialize the error handler system
     */
    initialize() {
        if (this.isInitialized) return;

        // Create error container
        this.createErrorContainer();

        // Set up global error handlers
        this.setupGlobalHandlers();

        // Start durable delivery for sanitized production diagnostics.
        this.observability.initialize();

        // Set up Phaser error handling
        this.setupPhaserErrorHandling();

        this.isInitialized = true;
        console.log('[ErrorHandler] Error handling system initialized');
    }

    /**
     * Create the error message container
     */
    createErrorContainer() {
        // Remove existing container if present
        const existing = document.getElementById('error-handler-container');
        if (existing) {
            existing.remove();
        }

        // Create new container with Tailwind classes
        const container = document.createElement('div');
        container.id = 'error-handler-container';
        container.className = 'fixed top-5 right-5 max-w-md z-[100000] pointer-events-none';
        document.body.appendChild(container);
        this.errorContainer = container;
    }

    /**
     * Set up global error handlers
     */
    setupGlobalHandlers() {
        const runtimeErrorHandler = (event) => {
            this.handleError({
                type: 'runtime',
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error,
                severity: 'error'
            });
        };

        const rejectionHandler = (event) => {
            this.handleError({
                type: 'promise',
                message: event.reason?.message || 'Unhandled promise rejection',
                error: event.reason,
                severity: 'warning'
            });
        };

        window.addEventListener('error', runtimeErrorHandler);
        window.addEventListener('unhandledrejection', rejectionHandler);
        this._cleanupHandlers = this._cleanupHandlers || [];
        this._cleanupHandlers.push(() => {
            window.removeEventListener('error', runtimeErrorHandler);
            window.removeEventListener('unhandledrejection', rejectionHandler);
        });
    }

    /**
     * Set up Phaser-specific error handling
     */
    setupPhaserErrorHandling(game) {
        if (!game || !game.events) return;

        const phaserErrorHandler = (error) => {
            this.handleError({
                type: 'phaser',
                message: error?.message || 'Phaser runtime error',
                error,
                severity: 'error'
            });
        };
        const sceneErrorHandler = (error, scene) => {
            this.handleError({
                type: 'phaser-scene',
                message: scene ? `Error in scene ${scene.sys.settings.key}` : 'Scene error',
                scene: scene?.sys?.settings?.key,
                phase: 'runtime',
                error,
                severity: 'error'
            });
        };

        game.events.on('error', phaserErrorHandler);
        game.events.on('sceneerror', sceneErrorHandler);
        this.startHealthWatchdog(game);

        if (!this._cleanupHandlers) {
            this._cleanupHandlers = [];
        }
        this._cleanupHandlers.push(() => {
            if (game.events && game.events.off) {
                game.events.off('error', phaserErrorHandler);
                game.events.off('sceneerror', sceneErrorHandler);
            }
        });
    }

    /**
     * Watch only lifecycle states that have an objective failure signal. Player
     * inactivity is deliberately not treated as a stuck flow.
     */
    startHealthWatchdog(game) {
        if (this.sceneWatchdog) clearInterval(this.sceneWatchdog);

        const observeScenes = () => {
            const scenes = Array.isArray(game.scene?.scenes) ? game.scene.scenes : [];
            scenes.forEach(scene => this.observeSceneLifecycle(scene));
            this.checkSceneHealth(game);
            this.checkCloudSaveHealth();
        };

        observeScenes();
        this.sceneWatchdog = setInterval(observeScenes, 1000);
        this._cleanupHandlers = this._cleanupHandlers || [];
        this._cleanupHandlers.push(() => {
            clearInterval(this.sceneWatchdog);
            this.sceneWatchdog = null;
        });
    }

    observeSceneLifecycle(scene) {
        if (!scene?.events || this.observedScenes.has(scene)) return;
        this.observedScenes.add(scene);

        const sceneKey = normalizeScene(scene);
        const status = Number(scene.sys?.settings?.status);
        // Phaser status 2-4 represents START, LOADING, and CREATING. Lazy
        // scenes may enter these states before the watchdog first observes them.
        if (status >= 2 && status <= 4) {
            this.sceneStartDeadlines.set(sceneKey, Date.now() + 15000);
        }
        scene.events.on('start', () => {
            this.sceneStartDeadlines.set(sceneKey, Date.now() + 15000);
        });
        scene.events.on('create', () => {
            this.sceneStartDeadlines.delete(sceneKey);
            this.lastHealthySceneAt = Date.now();
            this.lastHealthySceneKey = sceneKey;
            this.noActiveSceneReported = false;
        });
        scene.events.on('shutdown', () => {
            this.sceneStartDeadlines.delete(sceneKey);
        });
        scene.events.once('destroy', () => {
            this.sceneStartDeadlines.delete(sceneKey);
        });
    }

    checkSceneHealth(game) {
        const now = Date.now();
        for (const [scene, deadline] of this.sceneStartDeadlines) {
            if (now <= deadline) continue;
            this.sceneStartDeadlines.delete(scene);
            this.captureOperationalEvent({
                category: 'stuck_flow',
                code: 'scene_loading_timeout',
                severity: 'error',
                scene,
                phase: 'start',
                recovery: 'reload_offered',
                userVisible: false
            });
        }

        let activeScenes = [];
        try {
            activeScenes = game.scene?.getScenes?.(true) || [];
        } catch (error) {
            return;
        }

        if (activeScenes.length > 0) {
            this.lastHealthySceneAt = now;
            this.lastHealthySceneKey = normalizeScene(
                activeScenes[activeScenes.length - 1]
            );
            if (this.intentionalPauseScene === this.lastHealthySceneKey) {
                this.intentionalPauseScene = null;
            }
            this.noActiveSceneReported = false;
            return;
        }

        if (this.isIntentionalPauseHealthy(game)) {
            this.lastHealthySceneAt = now;
            this.noActiveSceneReported = false;
            return;
        }

        const pageVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
        const loopRunning = game.loop?.running !== false;
        if (
            pageVisible &&
            loopRunning &&
            !this.noActiveSceneReported &&
            now - this.lastHealthySceneAt > 12000
        ) {
            this.noActiveSceneReported = true;
            const recoveredScene = this.recoverNoActiveScene(game);
            this.captureOperationalEvent({
                category: 'stuck_flow',
                code: 'scene_no_active',
                severity: 'error',
                scene: this.lastHealthySceneKey,
                phase: 'transition',
                recovery: recoveredScene ? 'retry_scheduled' : 'reload_offered',
                userVisible: false
            });
        }
    }

    getNoActiveSceneRecoveryTarget() {
        const state = typeof window !== 'undefined' ? window.GameState : null;
        if (!state || typeof state.get !== 'function') return 'HatchingScene';

        const gameStarted = state.get('session.gameStarted') === true;
        const creatureHatched = state.get('creature.hatched') === true;
        const creatureName = state.get('creature.name');
        const creatureNamed = state.get('creature.named') === true || (
            typeof creatureName === 'string' &&
            creatureName.length > 0 &&
            creatureName !== 'Your Creature'
        );
        const creatureIdentity = state.get('creature.genes') ||
            state.get('creature.genetics');

        if (
            gameStarted &&
            creatureHatched &&
            creatureNamed &&
            creatureIdentity?.id
        ) {
            return state.get('tutorial.livingFormPending') === true
                ? 'SoulRevealScene'
                : 'GameScene';
        }
        return 'HatchingScene';
    }

    recoverNoActiveScene(game) {
        const manager = game?.scene;
        if (!manager || typeof manager.start !== 'function') return null;

        const target = this.getNoActiveSceneRecoveryTarget();
        try {
            manager.start(
                target,
                target === 'SoulRevealScene'
                    ? { resumeLivingForm: true }
                    : undefined
            );
            this.lastHealthySceneAt = Date.now();
            this.sceneStartDeadlines.set(target, Date.now() + 15000);
            return target;
        } catch (error) {
            return null;
        }
    }

    setIntentionalPause(scene, paused) {
        const sceneKey = normalizeScene(scene);
        if (paused && sceneKey !== 'unknown') {
            this.intentionalPauseScene = sceneKey;
            this.lastHealthySceneKey = sceneKey;
            this.lastHealthySceneAt = Date.now();
            this.noActiveSceneReported = false;
            return true;
        }
        if (!paused && (
            sceneKey === 'unknown' ||
            this.intentionalPauseScene === sceneKey
        )) {
            this.intentionalPauseScene = null;
        }
        return false;
    }

    isIntentionalPauseHealthy(game) {
        const sceneKey = this.intentionalPauseScene;
        if (!sceneKey) return false;
        try {
            const paused = game.scene?.isPaused?.(sceneKey) === true ||
                game.scene?.getScene?.(sceneKey)?.scene?.isPaused?.() === true;
            if (paused) return true;
        } catch (error) {
            // A stale pause marker is cleared below and normal health checks resume.
        }
        this.intentionalPauseScene = null;
        return false;
    }

    checkCloudSaveHealth() {
        const manager = typeof window !== 'undefined' ? window.CloudSave : null;
        if (!manager || typeof manager.getStatus !== 'function') return;

        let status;
        try {
            status = manager.getStatus()?.status;
        } catch (error) {
            return;
        }
        if (typeof status !== 'string') return;

        const previousStatus = this.cloudStatus;
        this.cloudStatus = status;
        if (status === 'syncing') {
            if (previousStatus !== 'syncing') {
                this.cloudSyncStartedAt = Date.now();
                this.cloudSyncStallReported = false;
            }
            if (
                !this.cloudSyncStallReported &&
                Date.now() - this.cloudSyncStartedAt > 30000
            ) {
                this.cloudSyncStallReported = true;
                this.captureOperationalEvent({
                    category: 'stuck_flow',
                    code: 'cloud_sync_stalled',
                    severity: 'warning',
                    scene: this.getCurrentScene(),
                    phase: 'sync',
                    recovery: 'local_fallback',
                    userVisible: false
                });
            }
            return;
        }

        this.cloudSyncStartedAt = null;
        this.cloudSyncStallReported = false;
        if (status === previousStatus) return;
        if (status === 'error') {
            this.captureOperationalEvent({
                category: 'persistence',
                code: 'cloud_sync_failed',
                severity: 'warning',
                scene: this.getCurrentScene(),
                phase: 'sync',
                recovery: 'local_fallback',
                userVisible: false
            });
        } else if (status === 'conflict') {
            this.captureOperationalEvent({
                category: 'persistence',
                code: 'cloud_save_conflict',
                severity: 'warning',
                scene: this.getCurrentScene(),
                phase: 'sync',
                recovery: 'manual_retry',
                userVisible: false
            });
        }
    }

    /**
     * Handle an error with appropriate user feedback
     */
    handleError(errorInfo) {
        errorInfo = this.normalizeErrorInfo(errorInfo);

        // Check if this error should be suppressed (browser extensions, etc.)
        const errorMessage = errorInfo.message || '';
        const isSuppressed = this.suppressedPatterns.some(pattern => pattern.test(errorMessage));

        if (isSuppressed) {
            // Silently log suppressed errors for debugging but don't show to users
            console.debug('[ErrorHandler] Suppressed error:', errorMessage);
            return;
        }

        // Log to console for debugging with full details
        console.error('[ErrorHandler] Error caught:');
        console.error('  Message:', errorInfo.message);
        console.error('  Type:', errorInfo.type);
        console.error('  Severity:', errorInfo.severity);
        if (errorInfo.stack) {
            console.error('  Stack:', errorInfo.stack);
        }
        console.error('  Full error object:', errorInfo);

        // Determine if error is recoverable
        const isRecoverable = this.isErrorRecoverable(errorInfo);
        const willShowMessage = errorInfo.severity === 'error' && this.shouldShowMessage();
        const operationalEvent = this.createOperationalEvent(
            errorInfo,
            isRecoverable,
            willShowMessage
        );

        // Keep only a non-identifying summary in memory. Raw messages, stacks,
        // save data, and error objects are never queued or sent.
        this.errorQueue.push({
            code: operationalEvent?.code || 'unknown_critical',
            category: operationalEvent?.category || 'runtime',
            severity: errorInfo.severity,
            scene: operationalEvent?.scene || 'unknown',
            timestamp: Date.now()
        });

        // Trim queue if too long
        if (this.errorQueue.length > this.maxErrors) {
            this.errorQueue.shift();
        }

        if (operationalEvent) {
            this.captureOperationalEvent(operationalEvent);
        }

        // Show user-friendly error message with rate limiting
        // Only show critical errors to avoid overwhelming users
        if (willShowMessage) {
            this.showErrorMessage(errorInfo, isRecoverable);
        }

        // Auto-recover if possible
        if (isRecoverable) {
            this.attemptAutoRecovery(errorInfo);
        }
    }

    normalizeErrorInfo(errorInfo) {
        if (errorInfo && typeof errorInfo === 'object' && !Array.isArray(errorInfo)) {
            return {
                ...errorInfo,
                message: typeof errorInfo.message === 'string'
                    ? errorInfo.message
                    : errorInfo.error?.message || 'Unknown error',
                severity: errorInfo.severity === 'warning' ? 'warning' : 'error'
            };
        }
        return {
            type: 'runtime',
            message: typeof errorInfo === 'string' ? errorInfo : 'Unknown error',
            severity: 'error'
        };
    }

    createOperationalEvent(errorInfo, isRecoverable, userVisible) {
        const message = String(errorInfo.message || '').toLowerCase();
        const type = String(errorInfo.type || '').toLowerCase();
        let code = OBSERVABILITY_CODES.has(errorInfo.observabilityCode)
            ? errorInfo.observabilityCode
            : null;

        if (!code && /failed to fetch|networkerror|network request/.test(message)) {
            code = /cloud|save|sync/.test(message)
                ? 'cloud_sync_failed'
                : 'network_request_failed';
        } else if (!code && (type === 'save' || /save/.test(message))) {
            code = /cloud/.test(message) ? 'cloud_save_failed' : 'local_save_failed';
        } else if (!code && (type === 'load' || /load/.test(message))) {
            code = /cloud/.test(message) ? 'cloud_load_failed' : 'local_load_failed';
        } else if (!code && ['phaser-scene', 'scene'].includes(type)) {
            code = 'scene_error';
        } else if (!code && type === 'phaser') {
            code = 'phaser_error';
        } else if (!code && type === 'promise') {
            code = 'promise_unhandled';
        } else if (!code && type === 'runtime') {
            code = 'runtime_uncaught';
        } else if (!code && type === 'network') {
            code = 'network_request_failed';
        } else if (!code && type === 'initialization') {
            code = 'game_boot_failed';
        } else if (!code && errorInfo.severity === 'error') {
            code = 'unknown_critical';
        }

        if (!code) return null;

        let category = 'runtime';
        if (code.startsWith('scene_')) category = 'scene_transition';
        if (/save|load|sync|conflict/.test(code)) category = 'persistence';
        if (code === 'network_request_failed') category = 'network';

        const phase = OBSERVABILITY_PHASES.has(errorInfo.phase)
            ? errorInfo.phase
            : code.includes('save') ? 'save'
                : code.includes('load') ? 'load'
                    : code.includes('sync') ? 'sync'
                        : code.startsWith('scene_') ? 'transition'
                            : type === 'initialization' ? 'boot' : 'runtime';

        return {
            category,
            code,
            severity: errorInfo.severity,
            scene: errorInfo.scene || errorInfo.sceneKey || this.getCurrentScene(),
            phase,
            recovery: this.getRecoveryClassification(errorInfo, isRecoverable, code),
            userVisible
        };
    }

    getRecoveryClassification(errorInfo, isRecoverable, code = '') {
        const message = String(errorInfo.message || '').toLowerCase();
        if (code.startsWith('cloud_') || /cloud|sync/.test(message)) {
            return 'local_fallback';
        }
        if (errorInfo.type === 'network' || /fetch|api/.test(message)) {
            return 'retry_scheduled';
        }
        if (/save/.test(message)) return 'retry_scheduled';
        if (isRecoverable && errorInfo.severity === 'error') return 'reload_offered';
        return isRecoverable ? 'continued' : 'none';
    }

    captureOperationalEvent(event) {
        try {
            return this.observability.capture(event);
        } catch (error) {
            return false;
        }
    }

    getCurrentScene() {
        try {
            const active = window.mythicalGame?.scene?.getScenes?.(true) || [];
            return normalizeScene(active[active.length - 1]);
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Check if we should show a message (rate limiting)
     */
    shouldShowMessage() {
        const now = Date.now();

        // Don't spam users with too many error messages
        if (this.messagesShownThisSession >= this.maxMessagesPerSession) {
            return false;
        }

        // Rate limit messages
        if (now - this.lastMessageTime < this.messageRateLimitMs) {
            return false;
        }

        this.lastMessageTime = now;
        this.messagesShownThisSession++;
        return true;
    }

    /**
     * Determine if an error is recoverable
     */
    isErrorRecoverable(errorInfo) {
        // Network errors are usually recoverable
        if (errorInfo.type === 'network') return true;

        // Save/load errors can be retried
        if (errorInfo.message?.includes('save') || errorInfo.message?.includes('load')) return true;

        // Asset loading errors can be retried
        if (errorInfo.message?.includes('texture') || errorInfo.message?.includes('asset')) return true;

        // API errors can fallback
        if (errorInfo.message?.includes('API') || errorInfo.message?.includes('fetch')) return true;

        // Scene transition errors might be recoverable
        if (errorInfo.message?.includes('scene')) return true;

        return false;
    }

    /**
     * Show user-friendly error message
     */
    showErrorMessage(errorInfo, isRecoverable) {
        if (!this.errorContainer || !document.body.contains(this.errorContainer)) {
            console.warn('[ErrorHandler] Error container not available in DOM');
            return;
        }

        // Create error element with Tailwind classes
        const errorElement = document.createElement('div');
        const bgClass = errorInfo.severity === 'error' ? 'bg-red-600/95' : 'bg-yellow-500/95';
        errorElement.className = `${bgClass} text-white p-4 mb-3 rounded-lg shadow-lg pointer-events-auto animate-slide-in`;

        // Create message content
        const icon = errorInfo.severity === 'error' ? '❌' : '⚠️';
        const title = this.getFriendlyErrorTitle(errorInfo);
        const message = this.getFriendlyErrorMessage(errorInfo);

        errorElement.innerHTML = `
            <div class="flex items-start">
                <span class="text-xl mr-3">${icon}</span>
                <div class="flex-1">
                    <div class="font-bold mb-1">${title}</div>
                    <div class="opacity-90 text-sm">${message}</div>
                    ${isRecoverable ? this.getRecoveryOptions(errorInfo) : ''}
                </div>
                <button onclick="window.ErrorHandler.dismissError(this)"
                        class="bg-transparent border-0 text-white cursor-pointer text-xl p-0 ml-3 opacity-70 hover:opacity-100 transition-opacity duration-200">×</button>
            </div>
        `;

        const isLocalDebug = ['localhost', '127.0.0.1'].includes(
            window.location.hostname
        ) && new URLSearchParams(window.location.search).has('debugErrors');
        if (isLocalDebug) {
            const debugDetails = document.createElement('pre');
            debugDetails.className = 'mt-2 text-xs whitespace-pre-wrap';
            debugDetails.textContent = [
                errorInfo.message || 'Unknown error',
                errorInfo.source
                    ? `${errorInfo.source}:${errorInfo.line || 0}:${errorInfo.column || 0}`
                    : '',
                errorInfo.error?.stack || errorInfo.stack || ''
            ].filter(Boolean).join('\n');
            errorElement.querySelector('.flex-1')?.appendChild(debugDetails);
        }

        // Add to container (verify container still exists)
        if (this.errorContainer && document.body.contains(this.errorContainer)) {
            this.errorContainer.appendChild(errorElement);

            // Auto-dismiss after delay (longer for errors)
            const dismissDelay = errorInfo.severity === 'error' ? 8000 : 5000;
            setTimeout(() => {
                this.dismissErrorElement(errorElement);
            }, dismissDelay);
        } else {
            console.warn('[ErrorHandler] Cannot append error element - container removed');
        }
    }

    /**
     * Get user-friendly error title
     */
    getFriendlyErrorTitle(errorInfo) {
        if (errorInfo.type === 'network') return 'Connection Issue';
        if (errorInfo.type === 'promise') return 'Background Operation Failed';
        if (errorInfo.message?.includes('save')) return 'Save Failed';
        if (errorInfo.message?.includes('load')) return 'Load Failed';
        if (errorInfo.message?.includes('texture')) return 'Graphics Loading Error';
        if (errorInfo.message?.includes('scene')) return 'Scene Transition Error';
        if (errorInfo.message?.includes('API')) return 'API Connection Issue';
        return errorInfo.severity === 'error' ? 'Something Went Wrong' : 'Warning';
    }

    /**
     * Get user-friendly error message
     */
    getFriendlyErrorMessage(errorInfo) {
        if (errorInfo.type === 'network') {
            return 'Please check your internet connection and try again.';
        }
        if (errorInfo.message?.includes('save')) {
            return 'Your progress could not be saved. We\'ll try again automatically.';
        }
        if (errorInfo.message?.includes('load')) {
            return 'Could not load your saved game. Starting with defaults.';
        }
        if (errorInfo.message?.includes('texture')) {
            return 'Some graphics failed to load. The game may look different.';
        }
        if (errorInfo.message?.includes('scene')) {
            return 'Failed to transition between game screens.';
        }
        if (errorInfo.message?.includes('API')) {
            return 'Cannot connect to game services. Some features may be limited.';
        }
        return 'The game encountered an issue but should continue working.';
    }

    /**
     * Get recovery option buttons
     */
    getRecoveryOptions(errorInfo) {
        const options = [];

        if (errorInfo.type === 'network' || errorInfo.message?.includes('API')) {
            options.push(`
                <button onclick="ErrorHandler.retryLastAction()" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-top: 8px;
                    margin-right: 5px;
                    transition: background 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                   onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    Retry
                </button>
            `);
        }

        if (errorInfo.severity === 'error') {
            options.push(`
                <button onclick="ErrorHandler.reloadGame()" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-top: 8px;
                    transition: background 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                   onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    Restart Game
                </button>
            `);
        }

        return options.length > 0 ? `<div>${options.join('')}</div>` : '';
    }

    /**
     * Attempt automatic recovery
     */
    attemptAutoRecovery(errorInfo) {
        // Auto-retry network requests
        if (errorInfo.type === 'network') {
            setTimeout(() => {
                console.log('[ErrorHandler] Attempting network retry...');
                // Trigger network retry logic
                if (window.mythicalGame) {
                    window.mythicalGame.events.emit('network-retry');
                }
            }, 2000);
        }

        // Auto-retry save operations
        if (errorInfo.message?.includes('save')) {
            setTimeout(() => {
                console.log('[ErrorHandler] Attempting to save again...');
                if (window.GameState) {
                    GameState.save();
                }
            }, 3000);
        }

        // Fallback for API errors
        if (errorInfo.message?.includes('API')) {
            console.log('[ErrorHandler] Switching to offline mode...');
            if (window.CreatureAI) {
                window.CreatureAI.enableFallbackMode();
            }
        }
    }

    /**
     * Dismiss error element with animation
     */
    dismissErrorElement(element) {
        if (!element) return false;

        // Manual dismissal and the auto-dismiss timer can race. Treat repeated
        // calls as a successful no-op instead of manufacturing console noise.
        if (!element.parentNode || !document.body.contains(element)) {
            return false;
        }

        element.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            // Double-check element still exists before removing
            if (element.parentNode && document.body.contains(element)) {
                element.remove();
            }
        }, 300);
        return true;
    }

    /**
     * Static method to dismiss error (for onclick)
     */
    static dismissError(button) {
        const errorElement = button.closest('div').parentNode;
        if (window.errorHandler) {
            window.errorHandler.dismissErrorElement(errorElement);
        }
    }

    /**
     * Static method to retry last action
     */
    static retryLastAction() {
        console.log('[ErrorHandler] Retrying last action...');
        if (window.mythicalGame) {
            window.mythicalGame.events.emit('retry-last-action');
        }
    }

    /**
     * Static method to reload game
     */
    static reloadGame() {
        console.log('[ErrorHandler] Reloading game...');
        // Save current state first
        if (window.GameState) {
            GameState.save();
        }
        // Reload page
        setTimeout(() => {
            window.location.reload();
        }, 100);
    }

    /**
     * Compatibility proxy for systems that call ErrorHandler statically.
     */
    static handleError(error, context = 'runtime', severity = 'error') {
        if (typeof window === 'undefined' || !window.errorHandler) return;
        window.errorHandler.handleError({
            type: context,
            message: error?.message || String(error || 'Unknown error'),
            error,
            severity
        });
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        const stats = {
            total: this.errorQueue.length,
            errors: this.errorQueue.filter(e => e.severity === 'error').length,
            warnings: this.errorQueue.filter(e => e.severity === 'warning').length,
            recent: this.errorQueue.slice(-5)
        };
        return stats;
    }

    /**
     * Clear error queue
     */
    clearErrors() {
        this.errorQueue = [];
        if (this.errorContainer) {
            this.errorContainer.innerHTML = '';
        }
    }

    destroy() {
        (this._cleanupHandlers || []).forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                // Cleanup is best-effort and must never interrupt shutdown.
            }
        });
        this._cleanupHandlers = [];
        this.observability.destroy();
        this.isInitialized = false;
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
    window.errorHandler = new ErrorHandler();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ErrorHandler,
        PrivacyObservabilityTransport,
        OBSERVABILITY_STORAGE_KEY
    };
}
