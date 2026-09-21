import manifest from '../config/final-void-films.json';
import { PreparedFilm } from './PreparedFilm.js';
import { PreparedFilmPlayer } from '../ui/PreparedFilmPlayer.js';

/** Scene-owned, shared films only. Optional personalized media stays a separate path. */
export class FinaleFilms {
    constructor(scene, { encounterId, config = manifest, createFilm = asset => new PreparedFilm(asset) } = {}) {
        this.scene = scene;
        this.config = config;
        this.enabled = config.enabled === true && encounterId === config.encounterId;
        this.createFilm = createFilm;
        this.films = new Map();
        this.player = null;
        this.closed = false;
        this.onShutdown = () => this.dispose();
        scene?.events?.once?.('shutdown', this.onShutdown);
        scene?.events?.once?.('destroy', this.onShutdown);
    }

    getFilm(beat) {
        const definition = this.config.films?.[beat];
        if (!this.enabled || this.closed || definition?.approved !== true || !definition.asset) return null;
        if (!this.films.has(beat)) this.films.set(beat, this.createFilm(definition.asset));
        return this.films.get(beat);
    }

    prepare(beat) {
        return this.getFilm(beat)?.prepare() || Promise.resolve(false);
    }

    isReady(beat) {
        return this.films.get(beat)?.state === 'prepared';
    }

    watch(beat, { onClose = () => {} } = {}) {
        if (this.closed || this.player || !this.isReady(beat)) return false;
        const film = this.films.get(beat);
        this.player = new PreparedFilmPlayer({
            film, scene: this.scene, title: this.config.films[beat].title,
            onClose: () => {
                this.player = null;
                this.films.delete(beat);
                if (!this.closed) onClose();
            }
        });
        // The outer Watch click is the gesture; no second click or fetch is required.
        void film.play();
        return true;
    }

    dispose() {
        if (this.closed) return;
        this.closed = true;
        this.scene?.events?.off?.('shutdown', this.onShutdown);
        this.scene?.events?.off?.('destroy', this.onShutdown);
        this.player?.close({ resume: false });
        this.films.forEach(film => film.dispose());
        this.films.clear();
    }
}
