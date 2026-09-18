# Birthday ending recovery

## Cause

The Forest birthday question was an automatic event for 11 September 2026
(Europe/Dublin), with a deliberate `?birthday=cayden` preview override. On any
other date the ordinary Forest completion flow went straight to rewards. There
was no permanent replay action. The question also lacked physical keyboard input.

## Scoped repair

- The Mythical Forest rewards screen now offers **Secret Message** on both first
  completion and replays, regardless of date. Enter Sanctuary remains separate.
- The existing favorite-number question accepts `77` using its touch keypad or
  a physical keyboard. Backspace edits; Escape or Continue Without Message exits.
- The existing approved family message is unchanged. No new media is generated.
- Skipping or finishing returns to the existing rewards screen. Rewards are not
  awarded again and combat remains frozen.
- Async answer failures allow retry. Closing or shutting down the scene removes
  listeners and ignores late answer results. The result screen's Enter shortcut
  is suspended while entering the number.
- The original date-based automatic event remains intact. The final campaign
  ending is unchanged, pending clarification about whether it also needs replay.

The question is a playful surprise, not authentication or a privacy boundary.
The answer is not saved, logged or sent to a service.

## Verification

- Focused birthday, Forest encounter and rescue tests: 71 passed.
- Complete Jest suite: 236 suites, 2,302 tests passed.
- Production Vite build and `git diff --check`: passed.
- Muted real Chromium completion journeys at 390x844 and 1280x720: skipped the
  question, reopened it, retried a wrong answer, entered 77, saw the exact message,
  returned to unchanged rewards, entered Sanctuary and installed the Forest Core.
- Browser evidence uses staged combat to reach the real completion flow; it is
  not a claim of a full manual playthrough or testing on physical iOS hardware.
- Private evidence: `.visual-review/birthday-ending-sep18/`. Desktop keyboard
  evidence is recorded separately in `.visual-review/birthday-ending-keyboard-sep18/`.

This change is local until explicitly released through the protected PR workflow.
