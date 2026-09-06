# Crystal Caves Rebuild

## Player promise

The Crystal Caves are the campaign's combat-and-platforming expedition. The
player follows three living pulses, breaks through corrupted cave life, and
defeats the corruption controlling the Crystal Guardian.

The Guardian is not killed. Its corrupted combat shell is defeated in a clear
boss victory, then the living Guardian remains and chooses to release the
Crystal Core.

## Child-facing flow

1. **Follow the pulse.** The next pulse is the only required objective shown.
2. **Reach it.** Crossing a pulse activates it automatically. No hidden button
   or special landing rule is required.
3. **Fight through.** Corrupted cave life creates short, readable combat gates.
4. **Defeat the corruption.** The boss meter says `CORRUPTION`, attacks have one
   short response cue, and victory says `CORRUPTION DEFEATED / GUARDIAN FREED`.

Optional fragments remain rewards, never blockers.

## Visual contract

- This is planetary geology, not a human mine. Remove carts, lanterns,
  skeletons, pickaxes, conventional ruins, and generic purple crystal bars.
- Terrain uses displaced mineral rafts, fractured ridges, porous void rock,
  pressure folds, and vents. These ideas are grounded in Europa chaos terrain,
  Enceladus plume fractures, and other observed extraterrestrial landforms.
- Pale mineral rims mean **safe footing**.
- Cyan living Current means **move toward this**.
- Magenta-black corruption means **fight or avoid this**.
- Platforms are substantial pieces of terrain with a single clear top surface.
  Visual slopes never disagree with axis-aligned Arcade Physics bodies.
- The foreground carries the collision truth. The painted background creates
  depth but never pretends to be walkable.
- Mobile framing keeps the player, companion astronaut, next pulse, and nearest
  threat above the control dock.

## Scope guard

This pass does not add a new puzzle language, crafting system, minecart system,
or required lore panel. It improves the existing movement, combat, route,
Guardian outcome, environment, and objective presentation.

## Reference basis

- NASA/JPL Europa imagery: fractured ridges, displaced and rotated plates,
  lower matrices, dark non-ice material, and refrozen chaos terrain.
- NASA Cassini Enceladus imagery: long fractures, raised flanks, deep grooves,
  and material venting from beneath the surface.

The level is an original fictional synthesis. No reference imagery is shipped
as game art.
