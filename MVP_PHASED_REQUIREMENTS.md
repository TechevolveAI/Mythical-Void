# Phased MVP Requirements - Mythical Void Game

## Phase 0: Current State (Completed)
**What Exists Now:**
- ✅ Basic creature hatching system
- ✅ Simple care mechanics (feed, play, rest)
- ✅ LocalStorage save system
- ✅ Basic genetics/traits system
- ✅ Static HTML/JS game with Phaser
- ✅ Environment configuration for API keys

---

## Phase 1: MVP - Core AI Chat Experience (Weeks 1-3)

### 1.1 Narrative Foundation
**Requirements:**
- [ ] Add crash landing intro sequence
- [ ] Implement "Sky Walker" narrative context
- [ ] Create player naming/onboarding flow
- [ ] Add story context to existing hatching scene

**Deliverables:**
```javascript
// New narrative state in GameState.js
narrative: {
  playerCrashed: true,
  voidCrossed: true,
  prophecyRevealed: false,
  chaptersUnlocked: ['crash_site'],
  discoveredLore: []
}
```

### 1.2 Basic Creature Chat System
**Requirements:**
- [ ] Click creature to open chat interface
- [ ] Chat UI overlay (400x500px, responsive)
- [ ] Message history display (last 20 messages)
- [ ] Text input with 200 char limit
- [ ] Typing indicators and animations

**Technical Implementation:**
```javascript
// src/systems/CreatureChat.js
class CreatureChat {
  - constructor(creature, gameState)
  - async sendMessage(playerMessage)
  - buildSystemPrompt() // Includes narrative context
  - saveConversation()
  - loadConversation()
}
```

### 1.3 Grok LLM Integration
**Requirements:**
- [ ] API connection using existing api-config.js
- [ ] System prompt with Sky Walker narrative
- [ ] Personality based on creature traits
- [ ] Happiness-influenced responses
- [ ] Error handling and retry logic

**System Prompt Core:**
- Creature as last of ancient species
- Player as prophesied Sky Walker
- Mission to find eggs and rebuild
- LifeCurrent awareness

### 1.4 Basic LifeCurrent Introduction
**Requirements:**
- [ ] Visual hints of LifeCurrent (particle effects)
- [ ] Creature mentions sensing the current
- [ ] Foundation for attunement system
- [ ] First Wellspring location

**Success Metrics:**
- Players chat 5+ times in first session
- 60% D1 retention
- Average session length > 10 minutes

---

## Phase 2: Core Gameplay Loop (Weeks 4-6)

### 2.1 LifeCurrent Attunement System
**Requirements:**
- [ ] Attunement level (0-100) based on chat
- [ ] Visual LifeCurrent flows at level 20+
- [ ] Egg detection improves with attunement
- [ ] Wellspring discovery mechanics

**Progression Unlocks:**
```
Level 10: Current Sense (see flows)
Level 20: Egg Detection (vague direction)
Level 30: Memory Echo (location memories)
Level 40: Precise Detection (map markers)
Level 50: Fast Travel (between Wellsprings)
```

### 2.2 Exploration & Discovery
**Requirements:**
- [ ] 3 distinct biomes to explore
- [ ] 10 findable eggs in Phase 2
- [ ] Environmental storytelling (ruins, artifacts)
- [ ] Resource gathering system
- [ ] Simple crafting (food, shelter basics)

### 2.3 Trust & Relationship System
**Requirements:**
- [ ] Trust levels (0-100) affecting chat quality
- [ ] Chat-triggered mini-quests
- [ ] Emotional state management
- [ ] Knowledge banking from conversations

**Trust Benefits:**
```
0-20: Basic information
21-40: Hints about eggs
41-60: Secret locations
61-80: Deep lore reveals
81-100: Perfect synchronization
```

### 2.4 The Void Corruption (Urgency Driver)
**Requirements:**
- [ ] Void corruption spreading mechanic
- [ ] Timer system (corrupts 1 zone/week)
- [ ] Visual corruption effects
- [ ] Eggs can be lost to corruption
- [ ] Basic defense building

**Success Metrics:**
- 50% of players find 5+ eggs
- Average attunement level > 30
- 40% D7 retention
- Chat interactions: 20+ per player

---

## Phase 3: Engagement & Retention (Weeks 7-9)

### 3.1 Camp Building System
**Requirements:**
- [ ] Place camps at LifeCurrent nodes
- [ ] Basic structures (shelter, storage, garden)
- [ ] Creature happiness bonuses in camps
- [ ] Multiple camp management
- [ ] Resource production over time

### 3.2 Collection & Progression
**Requirements:**
- [ ] Creature Codex (track discoveries)
- [ ] 50 genetic variants in Phase 3
- [ ] Rarity system (Common to Epic)
- [ ] Achievement system (30 achievements)
- [ ] Chapter-based progression (1-5)

### 3.3 Daily Engagement Features
**Requirements:**
- [ ] Daily login bonuses
- [ ] Morning/evening creature interactions
- [ ] Daily quests from creatures
- [ ] Push notifications (creature messages)
- [ ] Offline progress calculation

### 3.4 Challenge Systems
**Requirements:**
- [ ] LifeCurrent puzzles (redirect flows)
- [ ] Shadow creature encounters
- [ ] Environmental challenges
- [ ] Time-limited rescue missions
- [ ] Camp defense events

**Success Metrics:**
- 30% D30 retention
- Daily active users > 1000
- Average session: 2+ per day
- Collection completion > 20%

---

## Phase 4: Social & Monetization (Weeks 10-12)

### 4.1 Asynchronous Multiplayer
**Requirements:**
- [ ] Visit other players' worlds as "echoes"
- [ ] Leave messages for other players
- [ ] Share creatures through LifeCurrent
- [ ] Weekly community challenges
- [ ] Global progress tracking

### 4.2 Monetization Foundation
**Requirements:**
- [ ] Cosmetic shop (creature skins, decorations)
- [ ] Premium currency (Star Crystals)
- [ ] Optional ads for resource boosts
- [ ] Battle Pass system (free/premium tracks)
- [ ] Supporter packs ($4.99-$19.99)

**Ethical Monetization Rules:**
- No pay-to-win mechanics
- All content achievable free
- Cosmetics only
- Time savers, not gates

### 4.3 Advanced Chat Features
**Requirements:**
- [ ] Creature-to-creature conversations
- [ ] Group chat with multiple creatures
- [ ] Voice synthesis for creatures (optional)
- [ ] Chat export/sharing features
- [ ] Memorable quote collection

### 4.4 Events & Seasons
**Requirements:**
- [ ] Weekly event rotation
- [ ] Seasonal creatures (4 per year)
- [ ] Limited-time story chapters
- [ ] Community goals with rewards
- [ ] Holiday-themed content

**Success Metrics:**
- 5% monetization conversion
- $2.50 ARPPU
- Social feature adoption > 40%
- Community challenge participation > 30%

---

## Phase 5: Polish & Scale (Weeks 13-16)

### 5.1 Quality of Life
**Requirements:**
- [ ] Cloud save system
- [ ] Cross-device progression
- [ ] Advanced settings menu
- [ ] Accessibility options
- [ ] Multiple language support
- [ ] Photo mode

### 5.2 Endgame Content
**Requirements:**
- [ ] New Game+ mode
- [ ] Master difficulty
- [ ] 100+ total creature variants
- [ ] Secret ending paths
- [ ] Void Heart final area
- [ ] Post-game infinite mode

### 5.3 Advanced Systems
**Requirements:**
- [ ] Breeding combinations guide
- [ ] Advanced base automation
- [ ] Creature skill trees
- [ ] PvP creature competitions
- [ ] User-generated content tools

### 5.4 Platform Expansion
**Requirements:**
- [ ] iOS app store release
- [ ] Android play store release
- [ ] Steam version consideration
- [ ] Controller support
- [ ] Cloud gaming compatibility

**Success Metrics:**
- 50% D30 retention
- 100k+ downloads
- 4.5+ star rating
- 10% monetization conversion
- Break-even on development costs

---

## Phase 6: Post-Launch Growth (Ongoing)

### 6.1 Live Operations
- Weekly content updates
- Monthly story chapters
- Seasonal events (4x yearly)
- Balance patches
- Bug fixes

### 6.2 Community Building
- Discord server with 10k+ members
- Content creator program
- Fan art contests
- Community moderators
- Regular developer streams

### 6.3 Expansion Content
- New planets beyond The Void ($9.99 DLC)
- Creature editor tools
- Mod support
- Franchise opportunities
- Sequel planning

---

## Development Timeline

```
Weeks 1-3:   Phase 1 (MVP) - Core Chat
Weeks 4-6:   Phase 2 - Gameplay Loop
Weeks 7-9:   Phase 3 - Retention
Weeks 10-12: Phase 4 - Social & Monetization
Weeks 13-16: Phase 5 - Polish
Week 17:     Soft Launch (limited regions)
Week 20:     Global Launch
Ongoing:     Phase 6 - Live Operations
```

## Resource Requirements

### Team Composition (Minimum)
- 1 Full-stack Developer (you)
- 1 UI/UX Designer (contract)
- 1 QA Tester (part-time)
- 1 Community Manager (post-launch)
- 1 Artist (creature/environment assets)

### Technology Stack
- **Frontend**: Phaser.js, HTML5, CSS3
- **AI**: Grok/XAI API
- **Backend** (Phase 4+): Supabase or Firebase
- **Analytics**: Mixpanel or Amplitude
- **Monetization**: RevenueCat or similar
- **Deployment**: Netlify → App Stores

### Budget Estimate
- **Phase 1-3**: $5,000 (minimal, mostly time)
- **Phase 4-5**: $15,000 (servers, assets, marketing)
- **Phase 6**: $30,000/year (operations, updates)

## Risk Mitigation

### Technical Risks
- **API Costs**: Implement caching, rate limiting
- **Performance**: Progressive loading, optimization
- **Save Corruption**: Multiple backup systems

### Business Risks
- **Low Retention**: A/B test onboarding
- **No Monetization**: Adjust pricing, add value
- **Competition**: Unique AI chat differentiator

### Launch Strategy
1. **Soft Launch**: Canada, Australia, Philippines
2. **Iterate**: 2-week optimization period
3. **Marketing**: Influencer early access
4. **Global Launch**: With press kit ready
5. **Post-Launch**: Weekly updates for 3 months

## Success Criteria for Full Launch

### Must Have (MVP)
- [ ] 40% D7 retention
- [ ] 4.0+ app store rating
- [ ] <3 second load time
- [ ] 99.9% uptime
- [ ] Positive sentiment (>70%)

### Nice to Have
- [ ] Viral moment on social media
- [ ] Featured by app stores
- [ ] 100k downloads month 1
- [ ] Break-even month 3
- [ ] Sequel demand

## Key Performance Indicators

### User Metrics
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Session length & frequency
- Chat interactions per session
- Eggs found per player

### Business Metrics
- Cost Per Install (CPI)
- Lifetime Value (LTV)
- Return on Ad Spend (ROAS)
- Conversion rate
- Average Revenue Per User (ARPU)

### Game Health Metrics
- Crash rate (<0.1%)
- Load time (<3s)
- API response time (<500ms)
- Save success rate (>99.9%)
- Chat quality score (>4/5)

---

## Next Immediate Steps

1. **Week 1 Sprint Planning**
   - Set up project board (Trello/Jira)
   - Create Git repository
   - Design chat UI mockups
   - Write detailed user stories

2. **Week 1 Development**
   - Implement crash landing intro
   - Create chat UI component
   - Integrate Grok API
   - Test basic conversations

3. **Week 1 Testing**
   - Friends & family alpha
   - Gather initial feedback
   - Iterate on chat personality
   - Fix critical bugs

This phased approach ensures each release adds meaningful value while building toward a complete, engaging, and monetizable game experience.