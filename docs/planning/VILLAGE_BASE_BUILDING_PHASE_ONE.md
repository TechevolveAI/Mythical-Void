# Mythical Void Village / Base Building - Phase One

## 1. Current State

Mythical Void already has the foundations of a living settlement:

- `GameState` owns a versioned, deeply merged save tree and persists it through local and optional cloud saves.
- `FendCommunity` turns ecology, care, rescue, and signal evidence into four authored community projects.
- `FendResidents`, `GuardianResidents`, and `RescuedResidents` populate the Sanctuary with inhabitants and requests.
- `WorldBuilder` renders the Signal Garden, the staged Fend settlement, residents, landmarks, and interaction zones.
- The active companion and the `creatures` collection retain genetics, personality, lifecycle, bond, and identity data.
- Mobile controls can be suspended while DOM-backed full-screen interfaces are open.

The existing community system is narrative progression, not a reusable construction economy. Replacing it would discard working story content. Phase one therefore adds a village simulation beneath it and uses the first Fend project as the unlock.

## 2. Best Integration Point

The Village Heart is a new Sanctuary landmark beside the Signal Garden. The first Fend structure, First Light Shelter, establishes enough trust and safety to activate it.

The resulting flow is:

`restore a region -> establish First Light Shelter -> activate Village Heart -> place structures -> invite creature contributions -> produce supplies`

The Village Heart is not a military command center. It is a shared planning interface. The player proposes work; creatures contribute according to their identities.

## 3. Phase-One Player Loop

1. Restore the first region and establish First Light Shelter through the existing story loop.
2. Open the Village Heart in the Sanctuary.
3. Spend a one-time recovered stockpile of wood, stone, and food.
4. Choose a data-defined structure and an open settlement plot.
5. Watch the structure move from construction to complete.
6. Invite a companion to support a suitable structure.
7. Return later to collect automatically reconciled production.
8. Use new supplies to place the next structure and expand the visible settlement.

The interface keeps one current objective visible throughout this loop. Four milestones make the phase legible: establish three supply buildings, invite three creature crews, complete the Shared Habitat, and open the Discovery Workshop. Completion changes the objective to `Phase One Settlement Online` rather than leaving the player without direction.

The first Sanctuary return after the Village Heart awakens adds it to the navigation trail as a new destination. The marker clears once the player reaches the landmark, so the game introduces the system without leaving a permanent tutorial prompt behind.

## 4. Creature Integration

Phase one reads the creature data that already exists. A contribution profile is derived from personality, cosmic affinity, energy, and happiness.

- Curious, gentle, or nebula-attuned creatures are strong foragers.
- Energetic or bold creatures work efficiently at the sawmill.
- Wise, gentle, crystal-attuned creatures excel at Current Masonry.
- Curious, wise, or crystal-attuned creatures support the workshop.

Assignments are invitations, not ownership. A creature can support one structure at a time and can be reassigned without penalty. Rarity does not make a creature a better citizen.

## 5. Technical Architecture

`VillageSettlement.js` is the pure domain boundary. It owns:

- schema normalization
- building and resource definitions
- unlock checks
- starter stockpile initialization
- placement validation and resource spending
- construction reconciliation
- creature assignment
- capped elapsed-time production
- read-only snapshots for UI and rendering

`VillageCommandPanel.js` is a responsive DOM interface. `WorldBuilder` owns Sanctuary visuals. `GameScene` coordinates proximity, modal lifecycle, periodic reconciliation, and world refreshes.

Building definitions are data-driven and plot placement is deterministic. Phase one deliberately uses authored plots instead of unrestricted free placement. This gives touch users large reliable targets, avoids Sanctuary collision problems, and preserves a future path to roads and pathfinding.

## 6. UI / UX

The command panel uses one full-screen modal layer, pauses physics, and suspends mobile controls. It provides:

- a compact resource ledger
- live per-minute production rates, including an explicit no-active-crew state
- a four-step Phase One milestone track and one current objective
- five AI-authored building scenes with lightweight Current, star, parallax, and scan motion layers
- cinematic building thumbnails reused consistently in the catalog and foundation map
- structure cards with costs, prerequisites, production, immediate impact, and extension path
- a settlement plot map with valid, occupied, and constructing states
- creature contribution controls and visible efficiency
- direct status/error feedback without hidden console-only failures

No build control overlays the joystick or action dock.

The same generated building scenes are rendered on the Sanctuary plots. Constructing buildings appear scaffolded and desaturated; completed buildings float subtly, emit animated Current energy, and remain visually identifiable outside the menu. Completion and resource-production notices appear in the world so passive progress is not silent.

The settlement is grounded by one responsive living glade rather than a rectangular
build-mode overlay. Its irregular terrain footprint is derived from the authored
plot layout, with open seams toward the Signal Garden and the southern player
approach. On narrow screens the glade becomes a compact terrace; on desktop it
stretches into a commons spine. Occupied roots receive stronger local terrain and
ecology while unopened roots remain quiet, preserving one readable focal action.
Staffed production paths also retain their resource identity in the world: food
returns through gold growth nodes, wood through shaped timber marks, and stone
through pale crystal marks. These match worker cargo and the Heart's delivery
response so the player can follow a building's effect without opening the planner.

Returning after an offline cycle no longer interrupts play with a separate field
report scene. Village reconciliation first compares the saved and current
settlement, then the live Sanctuary briefly focuses the Heart. Named workers carry
color-matched food, wood, and stone signals along their authored routes; completed
structures take root in place; and a tapered Current ribbon states what changed and
the next available action. The moment waits behind onboarding and active overlays,
leaves touch controls enabled, clears automatically, and returns the camera to the
player. A deterministic local preview covers phone and desktop visual QA without
mutating a save.

The five scenes are pre-generated project assets rather than runtime generation requests. This keeps the menu immediate, deterministic, inexpensive, and available offline. Each building has a distinct visual identity; motion is layered with CSS and respects `prefers-reduced-motion`.

Settlement growth is also a world-state contract rather than a caption change.
The living glade begins around the awakened Heart and expands only toward roots
where construction has actually begun. Unused foundations remain visible and
interactive, but they no longer force the terrain to display its final footprint
on day one. Five deterministic profiles drive the same labels and world behavior:

| Tier | World identity | Persistent change |
| --- | --- | --- |
| Awakened Root | Signal seed | One breathing Current node and an intimate Heart clearing |
| First Root | First shelter | First canopy, safe route, and one gathering root |
| Connected Glade | Shared crossing | Linked Current crossing and a two-resident commons |
| Living Settlement | Resident commons | Multiple canopies and visible work/rest rhythm |
| Shared Sanctuary | Current canopy | All restored roots answer one communal network |

The commons is rendered inside the world rather than as another panel. Residents
who are home make short Heart check-ins; assigned workers retain their existing
building-to-Heart delivery routes. During story focus the commons recedes behind
the active moment, and compact layouts suppress the redundant Heart caption so
the contextual action beacon owns the interaction language.

Resident presence follows a single-world-location contract. A Habitat resident
is either resting at home, travelling to the Heart commons, or helping at an
assigned structure; the same resident is never drawn at two destinations. The
Habitat uses distinct resting, Heart, and work tethers, while Heart visitors walk
one authored Current route between their home threshold and a commons seat. One
resident remains home when several are available, preserving a readable daily
rhythm instead of making the Habitat look abandoned as the settlement grows.

Travelling residents are reciprocal world characters rather than ambient
decoration. When the player comes within greeting range, the shared Sanctuary
command channel targets that resident with one `GREET` action. Activating it does
not open the Village planner or stop exploration. The resident answers through a
temporary Living Current ribbon attached to their moving world figure, using an
authored line that changes with settlement growth. The ribbon retains readable
phone typography, remains inside the viewport, clears before story focus, and
records a community bond interaction. Its high-contrast world layer follows the
exact resident route independently of the resident's ambient focus alpha, and it
counter-scales the Sanctuary camera so 16px mobile dialogue remains 16px on
screen. This is the phase-one social contract for later resident quests and
relationship memories without introducing a separate dialogue system
prematurely.

Completed structures also carry a purpose sigil in their living-root threshold.
The five authored symbols represent renewing food, recovered repair value,
Current protection, shared homes, and shared energy. They remain quiet in the
ambient composition and brighten with the structure on approach. The one
target-attached command then names the immediate result (`FEED +5`, `WIN +10`,
`BLOCK 1 HIT`, `2 SAFE HOMES`, or `ENERGY +1`) instead of asking the player to
open a generic management surface before understanding why the building matters.
The structure name remains the command owner, so benefit clarity does not erase
place identity.

The selected empty root uses the same world grammar instead of a detached build
reticle. A translucent `future structure echo` shows the actual authored building
silhouette rising from its living-root bed, while a low ground ellipse and Current
shoots mark the footprint. One angular ribbon names the intended place in plain
language (`BUILD · SHARED HABITAT`). The preview disappears during story moments,
retains the existing large touch target, and becomes the completed structure in
the same location. This follows the strongest relevant patterns without copying
their aesthetics: Pikmin makes base work visibly useful in the field, Astroneer
exposes functional connections spatially, and Spiritfarer lets each improvement
become an inhabited place with emotional meaning.

### Sanctuary Living Current Guidance

The Sanctuary has many useful destinations, but it presents only one contextual
journey at a time. The existing Project Beacon waypoint is therefore the shared
navigation director for story, settlement, and expedition flow. Its priority is:

1. the active authored story mission
2. the unrecovered field kit at Wanderer-77
3. a newly awakened or decision-ready Village Heart
4. the next ready or resumable expedition at the world gate

An active non-spatial story scene intentionally suppresses lower-priority guidance.
Village focus moments, the planner, the arrival reveal, and story dialogue suppress
all navigation marks so two calls to action never compete.

The Living Current uses three world-connected states rather than a rectangular HUD
card: a short ground trail leaves the player's feet while travelling, an edge-safe
ribbon names an off-screen destination, and a breathing threshold settles around
the destination once it enters view. The ribbon respects phone safe areas and the
threshold replaces it immediately after camera recentering. When a nearby landmark
publishes its direct action, navigation yields all three layers so the action becomes
the sole instruction. The same mobile journey contract verifies actual movement
through the settlement district, Signal Garden, and hub gate, preserving one legible
route across the Sanctuary's systems.

### Ambient Settlement Hierarchy

The developed Village must read as an inhabited place before the player opens a
panel. Ambient presentation assigns every plot one explicit role:

- `inhabited_structure` keeps completed or growing architecture, its grounded
  activity, and assigned helper visible at rest.
- `guided_foundation` is the single empty root currently invited by progression.
- `reserved_root` recedes into the terrain until the settlement chooses it.

On compact viewports, authored building silhouettes occupy roughly 90-100 world
pixels and retain enough color and opacity to be recognized beside the 132-pixel
Heart. Reserved roots retain their collision-free touch regions but lose visual
weight; their interaction language appears only on approach. This separates
content hierarchy from hit-target size.

The Heart also has two authored intensity states. `quiet_ambient` breathes slowly
as the settlement anchor while another build, assignment, or journey owns the
next action. `decision_beacon` restores the full pulse only when the Heart is
waiting for a consequential player choice. Workers remain visible along physical
building-to-Heart routes, so the settlement communicates production through
activity rather than a permanent status panel.

## 7. Gameplay Impact Contract

Every completed building changes another established game loop:

| Building | Immediate effect | Settlement role | Extension path |
| --- | --- | --- | --- |
| Forager Hut | +5 happiness on Feed actions | Produces food | Resident supply and sustainable cultivation |
| Living Sawmill | +10 coins after expedition victories | Produces wood | Bridges, repairs, and new districts |
| Current Masonry | +1 guard charge per expedition | Produces stone | Permanent structures and defenses |
| Shared Habitat | +2 permanent creature capacity | Expands housing | Resident groups and social systems |
| Discovery Workshop | +1 maximum expedition energy | Joint research | Equipment, katana, and technology upgrades |

These effects are derived from completed settlement state at the point of use. They do not rely on a second cache that can drift away from the saved village.

Cross-loop support is announced where it matters. Feed feedback names the Forager Hut bonus, and expeditions open with a compact Village Support briefing listing active guard charges, crystal energy, and victory-coin support. The player can therefore connect a building choice to its actual result without remembering menu copy.

Every expedition completion also credits active Village support in the reward summary. This includes the Living Sawmill coin contribution and the Current Masonry and Discovery Workshop field systems, so the effect remains visible even after the entry briefing has faded.

## 8. Save Migration

Village data is stored at `world.village` with its own `schemaVersion`. Existing saves receive the default through `GameState.deepMerge(createInitialState(), savedState)`. The domain normalizer also validates every resource, building, plot, timestamp, assignment, and history record.

No existing field is renamed or removed. Local saves and cloud saves already serialize the complete state tree, so no parallel village save service is introduced.

## 9. Vertical Slice

### Must Have

- Village Heart unlock tied to First Light Shelter
- wood, stone, and food
- five authored plots
- Forager Hut, Sawmill, Current Masonry, Habitat, and Workshop
- resource costs and prerequisite validation
- construction and completed states
- active/collected creature contribution assignments
- genetics/personality efficiency modifiers
- capped offline production reconciliation
- persistent world visuals and responsive management UI

### Nice To Have

- building upgrades

### Later

- paths and navigation meshes
- freeform expansion and territory
- families, social groups, and housing preferences
- trade, NPC settlements, defence, raids, and events
- multiple settlements and a discovery tree

## 10. Risks

- `GameScene` is already very large. Phase one limits additions to orchestration and keeps rules outside the scene.
- The Sanctuary is visually dense. Authored plots prevent collision and control overlap, but later expansion needs a dedicated settlement district.
- Passive production can become an idle-game shortcut. Production is capped and requires a creature contribution; future balancing should connect supplies to active expeditions and care.
- Creature data has legacy shapes. The contribution profiler uses normalized fallbacks and must remain covered by tests as genetics evolve.
