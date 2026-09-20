# Mythical Void: human playtest guide

Audience: Kevin and an adult observing a player aged 9-12.
Start with Void Peaks, then use the same questions for each level. This guide is
not a claim that all devices, routes or endings have passed.

## What automation can and cannot tell us

Automation is good at repeatable rules: save/restore, reward counts, reachable
surfaces, collision positions, button bounds, error detection and measured frame
budgets under a specified setup. It can find some obvious visual faults. A pass
only covers the inputs and conditions actually tested, not every way to play.

| Area | Useful automated evidence | Human judgement still required |
| --- | --- | --- |
| Understanding | An objective exists and the exit responds | A new player notices it and knows what to do without coaching |
| Movement | Tested jumps land, input releases, feet match surfaces | Running, braking, jumping and recovering feel responsive and predictable |
| Difficulty | Attacks warn before damage; damage and recovery obey rules | A child can notice, understand and react; losing feels fair, not arbitrary |
| Pacing | The route is completable and checkpoints work | The climb feels substantial rather than repetitive, tiring or too short |
| Art | Assets load, text fits, no missing texture | Actors belong in the world, the scene has a clear focus and the mountain feels alien |
| Story and attachment | Correct scene and creature identity are selected | Players care about the creature, understand the event and want to see what happens next |
| Rewards | The correct item is granted once and changes its defined statistic | Players know what they earned, how to use it and why it is worth earning |
| Audio | Files load, mute/pause rules execute | Music and effects are enjoyable, balanced, informative and not startling or repetitive |
| Accessibility | Some contrast, bounds and alternate-input checks | Text is readable while playing; colour, timing, motion and dexterity demands suit actual players |
| Real devices | Emulated viewport and scripted touch journeys | Thumb reach, browser bars, interruptions, heat and sustained performance on the actual phone |
| Return motivation | A save resumes and the next destination unlocks | Returning players remember their goal and choose to continue voluntarily |

Automated screenshots, AI critique and passing tests are not adult visual
approval. A few positive sessions are useful evidence, not proof that every child
will understand or enjoy the game. Observe both new and returning players over time.

## A short test today

Allow around 20-30 minutes, but do not rush the player to meet that time. The
player should be a passenger or stationary, never the driver.

1. Open the normal live game. Record the device, browser, orientation and release
   being tested. Keep existing progress; do not clear site data to troubleshoot.
2. Try the existing save first. Can the player find the next destination? For a
   separate new-player check, use a private browser session and explain that its
   progress may disappear when that session closes.
3. Give one task: "Play Void Peaks and tell me when something feels confusing."
   Do not explain the route, attacks or reward in advance.
4. Observe quietly. Note the first hesitation, repeated mistake, stuck input,
   accidental tap or request for help. After roughly 20-30 seconds of confusion,
   ask "What are you trying to do?" Help sooner if the player is upset; record
   that help was needed. Do not turn the session into an endurance test.
5. Let the player finish or stop naturally. Ask the three questions below.
6. In the normal browser, refresh after reaching a checkpoint and after earning a
   reward. Later, close and reopen the tab. Check the expected progress remains.

Ask: "What happened?", "What would you do next?", and "Which bit would you change?"
Avoid "Was that easy?" or explaining the intended design before hearing the answer.
Lack of enthusiasm is useful feedback, not a player failure.

## Void Peaks checklist

- **Route:** The climb feels uphill and the next landing is visible before a
  committed jump. No walking through supposedly solid rock, hovering at rest or
  falling through the ground. Brief airborne frames during a jump are normal.
- **Recovery:** A missed jump lands on reachable lower terrain. The player can
  recover without a long restart, unexplained teleport or repeated fall loop.
- **Checkpoints:** The three lights activate on arrival without a separate puzzle.
  Resuming an older checkpoint puts the player on a safe current surface.
- **Choice:** The high ridge gives a shield; the direct route gives a free blast.
  Can the player recognise and notice the benefit without a parent interpreting it?
- **Summit:** The connected staircase reaches the face. The name **The Peak of the
  Mountain** and boss bar are readable; neither actor is hidden by controls.
- **Fight:** The player can distinguish aimed lasers, the low wave to jump and
  alternating shots. Warnings are visible, recovery feels like a genuine opening,
  and the boss is neither harmless nor overwhelming. Play with normal enemies
  present; the automated route proof deliberately removed patrols.
- **Touch:** Hold left and right, release, jump while moving, switch direction,
  pause and resume. No movement should remain latched after release or a menu.
  Down in a platforming level is not the same as walking down in Sanctuary;
  separately check all four Sanctuary directions, especially down.
- **Victory:** Progress is secured before the celebration. The result identifies
  Hull Plating and Power Shot, explains the next ranged hit is five times stronger,
  and has an obvious Continue button. Repeated taps must not duplicate rewards or
  strand the player. Continue should lead through the first resident welcome to
  the hub, with no dead-end panel.
- **Reward use:** Find the power-up through Pause > Power-ups and check its benefit
  is noticeable in play. Do not judge the economy from a reward label alone.
- **Return:** After leaving and coming back, the player should understand where to
  go next. Record uncertainty even if all buttons technically work.

## Device and interruption checks

Use the actual iPhone and Galaxy available to the family, initially in Chrome,
then Safari on iPhone as a separate result. Record the OS/browser version when
possible. Desktop and emulated phone passes do not replace these checks.

- Portrait first: top controls, boss bar and Continue must remain reachable when
  browser bars expand or collapse. Try landscape separately; do not erase the
  portrait result by averaging the two experiences.
- Hold movement and tap jump/attack with another finger. Open a menu, switch apps,
  lock/unlock and return. Expect released movement and a controllable game, not a
  runaway actor, missing input or audio continuing in the background.
- Play long enough to notice stutter or a hot phone. Record when it starts and
  whether the same encounter was smooth earlier. Do not infer its cause from heat
  alone.
- Try ordinary weak connectivity when convenient. Optional portraits or video
  must not block play; a fallback does not prove generation itself works. Record
  whether media was loading, failed, skipped or actually played. Do not repeatedly
  regenerate media just to test it.
- An adult may deliberately test sound at a suitable time and volume. Check mute,
  pause/background behaviour, competing effects and music transitions. Automation
  must remain muted; this guide does not authorise host audio from test scripts.

## What still needs evidence

For the September 20 mountain candidate, automated evidence covers both routes on
390x844 and 1280x720, old-checkpoint recovery, staged boss interactions, reward
handoff and shared Forest/final-boss completion recovery. It is not a full natural
combat playthrough: patrols were removed during traversal and the final hit was
injected after proving a real ranged hit. It does not certify physical iOS or
Android, hearing/accessibility needs, difficulty or visual quality.

Prioritise natural play with enemies, physical phone input, sustained performance,
reward usefulness, fresh versus returning-player understanding, and an uncoached
complete ending. Retain the existing creature art for this test; report its fit
with the mountain rather than redesigning it during a release.

## Report a finding

Use one short record per issue. No child's name, photo, voice, birth date, account
details, credentials or full save export is needed. An adult can provide a cropped
game screenshot without notifications or personal information.

```text
Release / date:
Device / OS / browser / orientation:
New or returning save / level / checkpoint:
What the player tried:
What happened instead:
Help needed? What help?
Can it happen again? Steps:
Screenshot or short muted clip, if useful:
Priority: blocker / major friction / polish
```

**Blocker:** crash, lost progress, inescapable panel, unavailable required control,
repeated fall-through or unintended background audio. Stop that journey, preserve
the save and report immediately; pause further rollout or roll back a confirmed
release regression rather than telling a child to start over.

**Major friction:** repeated coaching, unclear damage, unusable reward, unreadable
route or uncomfortable controls. Fix before calling the affected journey ready
for unfamiliar players. **Polish:** a readable, usable feature that could look or
feel better; collect a small ordered list rather than expanding release scope.

Release permission, technical verification and human enjoyment/visual approval
are separate decisions. Record each honestly. A release for family testing is not
automatic approval for marketing footage or a claim of flawless gameplay.
