# Youth Audience, UX, and Privacy Direction

Status: product and engineering guidance, 30 July 2026. This is not legal advice.

## Product Position

Mythical Void should be designed as a child-safe game for everyone. Age should
change only optional network features, not the quality of the adventure.

The likely audience is broader than a conventional children's game:

| Segment | What should earn their attention | Main risk |
| --- | --- | --- |
| Ages 9-12 | Immediate agency, readable objectives, creature behavior, discovery | Dense prose, confusing controls, and accidental data collection |
| Ages 13-15 | Identity, mastery, mystery, meaningful companionship | Baby-talk, forced sentiment, and shallow reward language |
| Ages 16-17 | Narrative consequences, mechanical depth, character continuity | A presentation that feels designed only for younger children |
| Adults | Science-fiction premise, ethical tension, polish, layered humor | Friction or sentiment that has not been earned through play |

These are hypotheses, not confirmed customer segments. Validate them with
moderated playtests across each band before adding analytics. Record task
completion, observed confusion, and interview responses without collecting
unnecessary identifiers.

Ofcom's 2025 report covers the media habits of children ages 3-17, and Pew's
teen gaming research shows that games are a mainstream part of life for ages
13-17. Neither source proves Mythical Void's market fit. They support testing a
cross-age experience rather than assuming one narrow "kids game" audience.

- [Ofcom: Children and parents media use and attitudes 2025](https://www.ofcom.org.uk/media-use-and-attitudes/media-habits-children/children-and-parents-media-use-and-attitudes-report-2025)
- [Pew Research Center: Teens and Video Games Today](https://www.pewresearch.org/internet/2024/05/09/teens-and-video-games-today/)

## Experience Rules

1. Gameplay controls occupy a permanent bottom dock on touch devices. Nothing
   interactive may overlap that dock.
2. Opening a story, consent, settings, pause, or tutorial modal suspends the
   controls, pauses gameplay where appropriate, and installs a full-screen
   pointer shield.
3. Story body text uses a conventional readable font, at least 15-16px in the
   current canvas coordinate system, strong contrast, left alignment, and short
   pages.
4. Warmth is earned through observed behavior and repeated choices. The
   creature is not an instant best friend and is not presented as a collectible
   prize during first contact.
5. Early creature communication is behavior or uncertain suit interpretation.
   Fluent dialogue can emerge as the bond develops.
6. Project Beacon's pressure is present from the start, but the final
   Earth-versus-this-world decision is not foreshadowed as an immediate choice.

Apple recommends respecting safe areas, adapting to device changes, and using
44pt controls for comfortable touch interaction. WCAG 2.2 AA sets minimum
contrast and target-size requirements; the game should use 44-48px frequent
controls as its practical baseline.

- [Apple Human Interface Guidelines: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple Human Interface Guidelines: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Privacy and Age Flow

The selected implementation uses four neutral bands:

- Under 13: local play only.
- 13-15: local play only until a guardian-approved route exists.
- 16-17: optional pseudonymous cloud features, with child-level privacy
  defaults.
- 18+: optional pseudonymous cloud features.

The band is stored locally. The game does not ask for a birth date, email,
real name, or location. Cloud Save remains optional and is never required for
progression.

Why the previous `13+` split was insufficient:

- COPPA applies in the US to child-directed and mixed-audience services that
  collect personal information from children under 13. Persistent identifiers
  can count as personal information. A mixed-audience age screen must be
  neutral and must not encourage a child to choose an older answer.
- GDPR Article 8 permits member states to set the child-consent threshold from
  13 to 16 when consent is the legal basis.
- Ireland's digital age of consent is 16.
- UK Children's Code protections continue through age 17 and favor high
  privacy defaults, data minimization, and proportionate age assurance.
- A local-only route does not by itself eliminate hosting logs, cookies,
  analytics, crash reporting, or third-party API collection. Those systems
  require their own data inventory and retention controls.

Primary sources:

- [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [FTC 2026 age-verification policy statement](https://www.ftc.gov/news-events/news/press-releases/2026/02/ftc-issues-coppa-policy-statement-incentivize-use-age-verification-technologies-protect-children)
- [GDPR Article 8](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [Irish Data Protection Act 2018, section 31](https://www.irishstatutebook.ie/eli/2018/act/7/section/31)
- [Irish DPC: child-oriented data processing](https://www.dataprotection.ie/en/dpc-guidance/fundamentals-child-oriented-approach-data-processing)
- [ICO Children's Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/introduction-to-the-childrens-code)
- [European Commission DSA guidance for minors](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors)

## Personalized Creature Media

External portrait and video generation stays off for under-16 profiles in this
release. For eligible opt-in use:

- Send procedural creature genetics and a random creature identity only.
- Do not send the player's name, age, voice, photo, location, or free-form
  prompt.
- Authenticate requests server-side and enforce the eligibility policy there;
  a client-only gate is not sufficient.
- State the model provider, retention period, storage location, and delete
  behavior before generation.
- Copy temporary provider output into owned storage and attach provenance.
- Keep the pixel creature as the canonical gameplay form.

Production enablement still requires owned media storage, server-side age and
session verification, idempotency, rate limits, deletion/export controls, and a
documented data-protection impact assessment.

