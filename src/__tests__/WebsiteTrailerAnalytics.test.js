const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../site/trailer.js'), 'utf8');
const { measureTrailer } = new Function(`${source.replaceAll('export ', '')}; return { measureTrailer };`)();

describe('website-only film measurement', () => {
    let player, now, choice, events;
    beforeEach(() => {
        now = 0; choice = 'granted'; events = [];
        jest.spyOn(performance, 'now').mockImplementation(() => now);
        Object.defineProperty(document, 'visibilityState', { configurable:true, value:'visible' });
        window.MythicalAnalytics = { getConsent: () => choice, track: (name, data) => { events.push([name, data]); return true; } };
        player = document.createElement('video');
        Object.defineProperty(player, 'duration', { value:100 });
        Object.defineProperty(player, 'paused', { value:false, configurable:true });
        measureTrailer(player);
    });
    afterEach(() => { jest.restoreAllMocks(); delete window.MythicalAnalytics; });
    const tick = time => { now += 1000; player.currentTime = time; player.dispatchEvent(new Event('timeupdate')); };
    const end = () => player.dispatchEvent(new Event('ended'));
    test('actual playback counts one start, bounded progress and one completion', () => {
        for (let i=0;i<=100;i++) tick(i);
        end(); end();
        expect(events.map(e=>e[0])).toEqual(['trailer_start','trailer_progress','trailer_progress','trailer_progress','trailer_progress','trailer_complete']);
        expect(events.filter(e=>e[0]==='trailer_progress').map(e=>e[1].watch_bucket)).toEqual(['25','50','75','90']);
    });
    test('seeking straight to the end never counts completion', () => { tick(0); player.dispatchEvent(new Event('seeking')); tick(99); tick(100); end(); expect(events.map(e=>e[0])).toEqual(['trailer_start']); });
    test('same footage replayed cannot accumulate false coverage', () => { for(let repeat=0;repeat<5;repeat++) for(let i=0;i<=20;i++) tick(i); end(); expect(events.map(e=>e[0])).toEqual(['trailer_start']); });
    test('does not backfill pre-consent watching', () => { choice='denied'; for(let i=0;i<80;i++)tick(i); choice='granted'; for(let i=80;i<=100;i++)tick(i); end(); expect(events.map(e=>e[0])).toEqual(['trailer_start']); });
    test('no events while denied, paused or hidden', () => {
        choice='denied'; tick(0); tick(1);
        choice='granted'; Object.defineProperty(player,'paused',{value:true}); tick(2); tick(3);
        Object.defineProperty(document,'visibilityState',{value:'hidden'}); tick(4); tick(5); end(); expect(events).toEqual([]);
    });
});
