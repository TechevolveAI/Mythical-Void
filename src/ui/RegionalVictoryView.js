import { createElement, Sprout, Gem, Orbit, Shield, Zap, Heart, Swords, Coins, Check, ChevronDown, Gift } from 'lucide';

const ICONS = { Sprout, Gem, Orbit, Shield, Zap, Heart, Swords, Coins, Check, ChevronDown, Gift };

function node(tag, className, text) {
    const result = document.createElement(tag);
    result.className = className;
    if (text) result.textContent = text;
    return result;
}

function icon(name) {
    const svg = createElement(ICONS[name] || Gift);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    return svg;
}

// Only locally captured game textures are accepted, never remote portraits.
function gameImage(url, className) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url || '')) return null;
    const image = node('img', className);
    image.alt = '';
    image.src = url;
    image.draggable = false;
    image.addEventListener('error', () => { image.hidden = true; });
    return image;
}

export function renderRegionalVictory(story, { rewards, portraitUrl, portraitName }) {
    const resident = rewards.find(reward => reward.kind === 'resident');
    const hero = node('figure', 'victory-resident');
    if (resident) hero.dataset.rewardKind = 'resident';
    const portrait = gameImage(portraitUrl, 'victory-resident-image');
    if (portrait) hero.append(portrait);
    else {
        const fallback = node('div', 'victory-resident-fallback');
        fallback.append(icon(resident ? 'Sprout' : 'Check'));
        hero.append(fallback);
    }
    const caption = node('figcaption', '', resident?.text || portraitName || 'Expedition complete');
    caption.append(node('span', 'victory-resident-status', resident ? 'Coming home with you' : 'Adventure complete'));
    hero.append(caption);
    story.append(hero);

    const itemRewards = rewards.filter(reward => !['resident', 'coins'].includes(reward.kind));
    const items = node('div', 'victory-loot');
    items.setAttribute('role', 'group');
    items.setAttribute('aria-label', 'Your rewards');
    const description = node('div', 'victory-reward-explanation');
    description.id = 'victory-reward-explanation';
    description.hidden = true;
    const buttons = [];
    for (const reward of itemRewards) {
        const button = node('button', 'expedition-debrief-reward victory-loot-item');
        button.type = 'button';
        button.dataset.rewardKind = reward.kind;
        button.setAttribute('aria-label', `${reward.text}. ${reward.shortLabel}. Show details`);
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', description.id);
        button.title = `${reward.text}: ${reward.shortLabel}`;
        const art = node('span', 'victory-item-art');
        art.append(icon(reward.icon));
        button.append(art, node('strong', '', reward.text), node('span', 'victory-item-destination', reward.shortLabel));
        const affordance = node('span', 'victory-item-more');
        affordance.append(icon('ChevronDown'));
        button.append(affordance);
        button.addEventListener('click', () => {
            const open = button.getAttribute('aria-expanded') !== 'true';
            buttons.forEach(other => other.setAttribute('aria-expanded', 'false'));
            button.setAttribute('aria-expanded', String(open));
            description.replaceChildren(node('strong', '', reward.text), node('p', '', reward.detail));
            description.hidden = !open;
        });
        items.append(button);
        buttons.push(button);
    }
    story.append(items, description);

    const coins = rewards.find(reward => reward.kind === 'coins');
    if (coins) {
        const counter = node('div', 'victory-coins');
        counter.dataset.rewardKind = 'coins';
        counter.append(icon('Coins'), node('strong', '', `+${coins.amount}`), node('span', '', 'Cosmic Coins'));
        story.append(counter);
    }
}
