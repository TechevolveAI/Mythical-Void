# EU AI Act Compliance Statement

## Mythical Void - AI Systems Transparency

**Document Version**: 1.0
**Last Updated**: January 2026
**Applicable Regulation**: EU AI Act (Regulation 2024/1689)

---

## Executive Summary

Mythical Void is a child-focused virtual pet game (ages 8-14) that has been designed with EU AI Act compliance from the ground up. This document provides full transparency about our AI systems usage.

**Key Compliance Points:**
- All creature chat responses are **pre-written by humans** (no LLM/AI generation)
- Optional AI Art Generation feature uses **clearly labeled** outputs
- Enhanced child safety measures exceed regulatory requirements
- No high-risk AI applications are used

---

## AI Systems Inventory

### 1. Creature Chat System

| Aspect | Details |
|--------|---------|
| **System Name** | CreatureAIController |
| **AI Provider** | **None** - Pre-written responses only |
| **Risk Category** | **Minimal Risk** (no AI) |
| **Data Processing** | No personal data processed |

**Technical Implementation:**
- All creature chat responses come from `src/config/creature-responses.json`
- Responses are authored by humans and reviewed for child safety
- Deterministic response selection based on creature mood/action
- No external API calls, no internet connectivity required

**Code Reference:** `src/systems/CreatureAIController.js`
```javascript
// EU AI Act Compliance Note:
// This system uses ONLY pre-written, human-authored responses.
// NO external LLM/AI APIs are called.
```

### 2. AI Art Generation (Optional Feature)

| Aspect | Details |
|--------|---------|
| **System Name** | AI Art Generator |
| **AI Provider** | Replicate API (Stable Diffusion XL) |
| **Risk Category** | **Limited Risk** |
| **Transparency Obligation** | Images labeled as AI-generated |

**Technical Implementation:**
- User explicitly requests AI art generation (opt-in only)
- API calls made via Netlify serverless function (server-side)
- Generated images are clearly labeled as "AI Generated"
- Download filenames include "ai_art" identifier

**Code Reference:** `netlify/functions/generate-ai-art.js`

**User Interface Labeling:**
- Modal title: "AI Art Generator"
- Button text: "Generate AI Art"
- Generated image watermark: "AI Generated"

### 3. ThoughtBubbleSystem

| Aspect | Details |
|--------|---------|
| **System Name** | ThoughtBubbleSystem |
| **AI Provider** | **None** - Pre-written only |
| **Risk Category** | **Minimal Risk** (no AI) |

**Technical Implementation:**
- ALL thoughts are pre-written in configuration files
- Thoughts selected based on game context (mood, events, biome)
- No AI generation of any kind
- Includes struggling player support (pre-written encouragement)

---

## Child Safety Measures

### Content Safety (Article 5 Protections)

Our chat systems implement multiple safety layers:

1. **Disallowed Content Patterns** (hard blocks):
   - Adult topics (romance, drugs, politics, religion)
   - Personal information requests
   - External references (social media, websites)
   - Negative/harmful content
   - Brand mentions
   - Pretending to be human

2. **Safety Filter Chain**:
   ```
   User Input → Sanitization → Whitelist Check → Response → Final Safety Filter
   ```

3. **Fallback System**:
   - If any filter fails, system returns safe default response
   - "I'm so happy to be with you!" (hardcoded safe response)

### Code Reference (Safety Patterns):
```javascript
// src/systems/CreatureAIController.js
const DISALLOWED_PATTERNS = {
    ADULT_TOPICS: /\b(sex|romantic|drugs|alcohol|politics|religion)\b/i,
    PERSONAL_INFO: /\b(password|address|phone|email|real name)\b/i,
    EXTERNAL_REFS: /\b(youtube|tiktok|instagram|twitter|discord)\b/i,
    NEGATIVE: /\b(hate|stupid|idiot|kill|die|hurt)\b/i,
    // ... more patterns
};
```

---

## Risk Assessment

### Classification Under EU AI Act

| System | Risk Level | Justification |
|--------|------------|---------------|
| Creature Chat | Minimal | No AI - pre-written responses only |
| AI Art Generator | Limited | Optional image generation with clear labeling |
| ThoughtBubbles | Minimal | No AI - pre-written thoughts only |
| Game Logic | Minimal | No AI - deterministic algorithms |

### Why Not High-Risk?

Mythical Void does NOT:
- Make decisions affecting health, safety, or rights
- Process biometric data
- Influence voting or political opinions
- Perform employment or education assessments
- Use real-time biometric identification

---

## Transparency Measures

### For Users (Article 50 Compliance)

1. **AI Art Generator**:
   - Feature clearly labeled as "AI Art Generator"
   - Generated images marked as "AI Generated"
   - User must explicitly opt-in to generate

2. **Game Chat**:
   - No disclosure needed (no AI used)
   - All responses are pre-written

### For Parents/Guardians

This game is designed for children ages 8-14 with:
- Always-enabled Kid Mode (cannot be disabled)
- Pre-written, reviewed content only
- No personal data collection
- No AI-generated text shown to children

---

## Data Processing

### Personal Data

| Data Type | Collected | Purpose | Storage |
|-----------|-----------|---------|---------|
| User Name | Yes (creature name) | Gameplay | Local browser only |
| Chat History | No | N/A | N/A |
| Biometric Data | No | N/A | N/A |
| Location | No | N/A | N/A |
| Age | No | N/A | N/A |

### AI Training Data

**Mythical Void does NOT:**
- Send user data to AI systems
- Use gameplay data for AI training
- Share any data with third parties
- Store data beyond local browser storage

---

## Technical Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────┐
│                  MYTHICAL VOID                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────┐    ┌─────────────────┐        │
│  │  Creature Chat  │    │ ThoughtBubbles  │        │
│  │  (Pre-written)  │    │ (Pre-written)   │        │
│  │  NO AI          │    │ NO AI           │        │
│  └─────────────────┘    └─────────────────┘        │
│                                                     │
│  ┌─────────────────┐                               │
│  │ AI Art Generator│ ──────► Replicate API         │
│  │ (Optional, Opt-in)       (Server-side)          │
│  │ LABELED OUTPUT  │                               │
│  └─────────────────┘                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### API Security

- No client-side API keys
- Server-side only (Netlify functions)
- Rate limiting implemented
- No user data transmitted

---

## Compliance Timeline

| Milestone | Date | Status |
|-----------|------|--------|
| Prohibited practices review | Feb 2025 | Compliant |
| GPAI transparency obligations | Aug 2025 | Compliant |
| Full EU AI Act applicability | Aug 2026 | Compliant |

---

## Contact Information

**Compliance Questions**: Contact the development team via GitHub Issues

**Repository**: https://github.com/mythical-void/mythical-void

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2026 | Initial compliance documentation |

---

*This document is maintained as part of our commitment to transparency and regulatory compliance.*
