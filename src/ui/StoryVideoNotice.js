import { GeneratedStoryFilm } from '../systems/GeneratedStoryFilm.js';
import { storyVideoContext, videoNoticeKey } from '../systems/StoryVideoContext.js';
import { PreparedFilmPlayer } from './PreparedFilmPlayer.js';
import './story-video-notice.css';

const offered = new Set();
export function nextStoryVideo(service, levelId = null) {
    return service?.getUnviewedGeneratedVideos?.()?.find(ready =>
        !offered.has(videoNoticeKey(ready)) &&
        (!levelId || storyVideoContext(ready.momentId).levelId === levelId)
    ) || null;
}

export function showStoryVideoNotice(scene, service, ready, { onClose = () => {}, onWatch } = {}) {
    if (!ready || offered.has(videoNoticeKey(ready))) return null;
    offered.add(videoNoticeKey(ready));
    const root = document.createElement('aside');
    root.className = 'story-video-notice';
    root.setAttribute('aria-label', 'Creature film ready');
    const title = document.createElement('span');
    title.textContent = storyVideoContext(ready.momentId).label;
    title.setAttribute('role', 'status');
    const watch = document.createElement('button');
    watch.type = 'button'; watch.textContent = 'Watch';
    const dismiss = document.createElement('button');
    dismiss.type = 'button'; dismiss.textContent = '\u00d7';
    dismiss.setAttribute('aria-label', 'Dismiss film notice');
    dismiss.title = 'Dismiss';
    root.append(title, watch, dismiss);
    let closed = false;
    let expiry;
    const destroy = () => {
        if (closed) return;
        closed = true;
        clearTimeout(expiry);
        scene.events?.off?.('shutdown', destroy);
        root.remove(); onClose();
    };
    dismiss.addEventListener('click', destroy);
    watch.addEventListener('click', () => {
        if (closed) return;
        destroy();
        if (onWatch) onWatch();
        else openStoryVideo(scene, service, ready);
    });
    root.addEventListener('keydown', event => { if (event.key === 'Escape') destroy(); });
    scene.events?.once?.('shutdown', destroy);
    document.body.append(root);
    expiry = setTimeout(destroy, 7000);
    return { destroy };
}

export function openStoryVideo(scene, service, ready, onClose = () => {}) {
    const film = new GeneratedStoryFilm(service, ready);
    const player = new PreparedFilmPlayer({ film, scene, title: storyVideoContext(ready.momentId).label, onClose });
    void film.prepare().then(ok => { if (ok && !player.closed) void film.play(); });
    return player;
}
