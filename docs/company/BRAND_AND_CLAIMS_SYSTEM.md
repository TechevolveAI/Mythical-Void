# Mythical Brand and Claims System

**Status:** Foundation inventory; Kevin approval required for brand-defining
changes  
**Date:** 11 August 2026

## 1. Brand promise

Mythical creates living adventures where intelligence is felt through
relationship, memory, agency, animation, and consequence—not announced through
an “AI-powered” badge.

Mythical Void's current emotional territory is:

- wonder with credible stakes;
- companionship that is earned rather than imposed;
- science fiction with hope and moral intelligence;
- restoration rather than extraction;
- playful accessibility with depth that respects every age;
- ambitious technology with unusually clear responsibility.

## 2. Voice

| Attribute | Use | Avoid |
| --- | --- | --- |
| Curious | Invite discovery and specific questions | Empty mystery or withheld basics |
| Cinematic | Concrete images, tension, and momentum | Trailer clichés and constant superlatives |
| Emotionally intelligent | Earn warmth through events and choices | Forced friendship, guilt, or dependency |
| Hopeful | Show difficult problems that collaboration can change | Naive certainty or consequence-free solutions |
| Precise | Say what is playable now and what is planned | Blurring prototypes, aspirations, and shipped behavior |
| Responsible | Explain boundaries plainly and confidently | Legal theatre, fear language, or unverifiable compliance claims |

Words and patterns to reduce:

- revolutionary, groundbreaking, never-before-seen, infinite, fully
  autonomous, sentient, truly alive;
- generic “embark on an epic journey” copy;
- claims that AI authored, decided, or understood something when the actual
  system is deterministic or human-authored;
- child-directed urgency, streak pressure, scarcity, or fear of disappointing
  the companion.

### Plain-language rule

Write for a curious person, not for an internal specialist.

- Lead with what the player can see, feel, choose, or do.
- Use short sentences and familiar words. Explain necessary game-world terms
  where they first appear.
- Do not use company, AI, legal, security, or engineering language in player
  copy unless it is immediately explained in ordinary words.
- Give children and teenagers clear instructions without speaking down to
  them. Give parents the extra detail they need in a separate layer.
- Safety, privacy, purchases, accounts, AI features, and permissions must state
  what happens, what choice exists, and where to get help.
- Reading ease is not permission to make a claim broader, less accurate, or
  more child-directed.

Before approval, a human reviewer should be able to answer: “Would a young
player understand this on the first read, and would their parent understand
the important consequence?” If either answer is unclear, rewrite it.

## 3. Claims classes

### C1 Verified product fact

May be used with its exact conditions and current source. Re-verify after the
source or deployment changes.

### C2 Fiction/world claim

May be written in narrative voice but must not be confused with a real product,
safety, scientific, or company claim.

### C3 Qualified/experience claim

Subjective or system-dependent. Use precise language and evidence; do not
convert it into an absolute.

### C4 Proposed/future

Use only when visibly labelled planned, experimental, prototype, or in
development. Never place in a present-tense feature list.

### C5 Restricted

Requires Kevin and professional or specialist review: legal compliance,
certification, security guarantees, child safety guarantees, accessibility
conformance, medical/educational benefits, market leadership, unique-world
firsts, commercial terms, and quantitative performance claims.

## 4. Initial claims inventory

| ID | Claim | Class/status | Conditions/source | Unsafe expansion |
| --- | --- | --- | --- | --- |
| CL-001 | “Play free in your browser.” | C1 usable | Current storefront and no payment flow; verify deployment | “Free forever” |
| CL-002 | “No download or account is required to start.” | C1 usable | Current browser route and local-first flow | “We collect no data” |
| CL-003 | “Progress is stored locally by default.” | C1 usable | `GameState` and cloud-save docs | “Your data never leaves your device” because hosting logs/optional services exist |
| CL-004 | “Explore and restore six living realms.” | C1 usable after build check | Current storefront and six realm/guardian implementation | “Infinite worlds” |
| CL-005 | “Procedural genetics shape appearance, affinity, personality, and potential.” | C1/C3 usable with demonstration | Current genetics/config/game systems | “Every possible creature is guaranteed globally unique” |
| CL-006 | “A companion that remembers.” | C3 usable with visible examples | Current state/memory systems; name the remembered behavior in proof content | “The creature remembers everything” |
| CL-007 | “Family-friendly fantasy combat without gore.” | C3 usable | Current content direction and storefront | Formal age rating or universal safety guarantee |
| CL-008 | “Project Beacon sent you to find hope for Earth.” | C2 usable | Current story canon | Presenting fiction as real science/mission |
| CL-009 | “AI-generated Living Portrait/video is optional and unavailable to under-16 profiles in this release.” | C1 sensitive; re-verify before each use | Production flags, server enforcement, privacy docs | “Child-safe AI” or “zero data risk” |
| CL-010 | “AI-first studio/company.” | C4 internal aspiration today | Company OS; not proof of deployed autonomous operation | “Fully autonomous company” |
| CL-011 | “Top-class governance.” | C4/C5 ambition | Requires operating evidence, audits, and transparent limitations | Certification or independent assurance claim |
| CL-012 | “1 of 1” / “every creature is unique.” | C3 unsubstantiated absolute | Random/procedural diversity is evident; collision/uniqueness guarantee not yet proven | Mathematical or globally enforced uniqueness |

## 5. Claim approval record

Every public-content package must attach:

```text
Claim IDs used:
Source version/date checked:
Qualifier retained:
Destination/audience:
Fiction clearly separated:
Generated media provenance:
Reviewer/approval:
Expiry or recheck trigger:
```

An agent must reject or escalate:

- any factual sentence with no claim ID/source;
- an approved claim whose qualifier was removed;
- a future capability written as present;
- a numerical claim without measurement definition and date;
- “safe,” “secure,” “compliant,” “anonymous,” or “unique” as an unqualified
  guarantee;
- an AI-system description inconsistent with the shipped implementation;
- a claim that a player, parent, creator, or authority endorsed Mythical when
  the evidence does not explicitly support that use.

A-034 operationalizes this rule for reusable campaign packages. Each variant
must cite only source claim IDs and include a literal excerpt for every claim;
channel adaptation may shorten, reorder, or change tone, but cannot add or
strengthen the proposition. The first CMP-001 package has four claims and eight
literal mappings across two text variants, with no proof, testimonial, media,
tracking, approval, or publication authority.

## 6. Proof library requirements

Marketing automation should draw from approved proof objects:

- product build/version;
- captured date and authoritative game state;
- short description of what the clip/image actually shows;
- applicable claim IDs;
- asset rights and generated-media provenance;
- player/customer permission where applicable;
- crop/edit history and accessibility description;
- expiry/recheck trigger.

The first three proof objects should cover:

1. hatch and first earned bond;
2. damaged-to-restored realm transformation;
3. a Project Beacon discovery or choice with meaningful context.

## 7. Open brand decisions

- Public master brand: `Mythical`, `Mythical Void`, or `Tech Evolve AI` as the
  visible studio/company relationship.
- Whether “AI” leads company communications or appears as supporting craft.
- Whether the younger player audience is explicit in headline positioning or
  expressed through trust/accessibility layers.
- Replacement for the unsubstantiated `1 of 1` language.
- Public release label: early access, alpha, playtest, demo, or launched game.
