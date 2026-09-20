# Sanctuary repairer: scoped implementation

## Player journey

The old hooded merchant is now an alien repairer, the same resident for every player. His purple work-cowl, cyan eyes and amber task light preserve the old character's recognisable features. His mechanical arm works at an open living-wood stall. The map uses articulated Phaser parts, not a generated portrait pasted onto the world.

1. Approach the Sanctuary shop using the existing interaction.
2. Choose **Visit workbench**. Meet the repairer and see the current katana.
3. See what each permanent upgrade does, whether it is fitted, and which level awards it.
4. Choose **Try a strike** for an optional, isolated target demonstration, or **Browse supplies** to return to the existing Power category.
5. Close the workbench at any point and continue shopping or playing.

## Real effects, not another unlock system

- Resonant Edge, earned in Crystal Caves: the existing katana profile increases melee damage from 2 to 3 and reach from 70 to 85 world units.
- Aurora Guard, earned in Aurora Depths: the existing expedition system supplies one protective charge per expedition.
- Boss consumables: read the existing inventory and pending boss rewards; distinguish permanent upgrades from one-use supplies.
- Upgrades remain fitted automatically by the existing reward flow. The repairer does not charge players to re-install rewards they already earned.
- Practice uses the production astronaut/katana presentation and canonical combat profile. It has a separate target and no save, coin, inventory, reward or progression writes. It is a demonstration, not a full combat simulator or an Aurora Guard trial.

## Boundaries

No new currency, move, quest, AI dialogue, account, remote generation call, save migration or level change. Existing purchases and Base Builder remain in place. The portrait is authored once and loaded only when the workbench opens. The player's generated creature is unchanged.

The ordinary catalog keeps its current design; this pass replaces the world stall and resident, adds the workbench, fixes desktop prices obscured by Buy buttons, and improves modal/rotation cleanup. It is not a complete reskin of every shop screen.

## Modular ownership

- `RepairerWorkshop`: read-only mapping of existing kit and reward state.
- `RepairerResident`: world stall and articulated resident, owned by the scene lifecycle.
- `RepairerWorkbench`: accessible, scrollable dialogue/equipment view, focus and input ownership.
- `RepairerPractice`: disposable local target demonstration; closes on rotation or scene shutdown.
- `ShopScene`: existing purchase flow plus workbench entry and topmost-modal handling.

The practice actor is loaded on demand. Shared field-kit rules belong to the configuration chunk to avoid a static gameplay/UI import cycle. Legacy merchant texture support remains available for other biome shops.

## Verification and human review

Automated: focused workshop/purchase tests, full Jest suite, production Vite build and `node scripts/check-repairer-workshop.cjs`. The browser check runs muted at 390x844 and 1280x720, uses a staged real creature/save, verifies real input, pricing, a purchase, practice state isolation, image loading, rotation and scene cleanup, and records browser/network failures. All owned browsers and preview processes close at the end. Evidence is private under `.visual-review/repairer-implementation/`.

Human review still needed: does the illustrated resident feel like the portrait and belong in the Sanctuary; can a child find the workbench and explain permanent versus one-use rewards; does the stall read clearly on a real phone? Automated success does not establish visual appeal. Check with a fresh field kit, Crystal-only kit, both upgrades, and an empty/full bag. Practice must never use a reward or spend a coin.

Deployment is a separate release step. This implementation does not itself authorise a push or deploy.

