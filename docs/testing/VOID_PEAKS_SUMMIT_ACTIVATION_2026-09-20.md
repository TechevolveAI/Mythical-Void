# Void Peaks summit activation repair

## Reproduced failure

Baseline: `4bdf530ea82c1703938e4a2d85c757196ccc7a05`.

The summit is 420 world units wide (4780-5200), but the encounter trigger
covered only 4770-4870. It also correctly required a grounded landing.
A normal jump from the final staircase passed over the narrow trigger and
landed beyond it. The approach artwork brightened, but the real boss never
spawned: no boss health, no combat-ready state, and no attacks. The reproduced
player reached x=5184 with feet at y=400 and zero browser errors.

The earlier summit smoke walked through the entrance marker. That proved the
walking path but did not protect the jump-over path.

## Bounded fix

- Cover the full physical summit with the encounter trigger.
- Preserve the grounded-surface check and all three route checkpoints.
- Preserve the safe arena entry, attack clock, difficulty, terrain and rewards.
- Do not change saves, other levels, video generation or creature artwork.

## Verification

Focused unit cases cover the full summit, airborne/below-summit rejection,
unfinished checkpoints, duplicate/defeated encounters and a declined start.
The new geometry test fails on the old implementation.

Run the built-game regression with both entry modes:

```sh
npx vite build
MOUNTAIN_SUMMIT_ENTRY=jump node scripts/check-mountain-boss.cjs
MOUNTAIN_SUMMIT_ENTRY=walk node scripts/check-mountain-boss.cjs
```

The script uses muted phone-sized touch and desktop keyboard browsers. It
stages a checkpoint-complete final approach; this is not a full campaign test.
The jump case must cross beyond the former trigger while still airborne.
Both cases require a live boss, its natural laser and ground-wave sequence,
actual player damage, a normal ranged hit, saved victory, and return flow.
Wave creation is observed without invoking or changing its attack clock, so
a projectile that hits and retires between browser polls is still recorded.

Private evidence belongs under `.visual-review/peaks-awakening/`, not the
website. Browser automation does not approve the visual quality or certify
physical iPhone/Samsung performance.
