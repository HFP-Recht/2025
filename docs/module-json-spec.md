# Module JSON Specification for LLM Content Generation

This document describes the structure of a **Module JSON** file (e.g. `content/modules/30-vertragslehre.v1.json`).
Each module represents one subtopic within a course and contains **4 lessons** (3 if no mindmap source exists).
Different LLMs can specialize in generating each lesson type independently.

---

## Table of Contents

1. [Module Envelope](#1-module-envelope)
2. [Lesson 1 — Grundlagen (Theory)](#2-lesson-1--grundlagen-theory)
3. [Lesson 2 — Zusammenfassung (Summary)](#3-lesson-2--zusammenfassung-summary)
4. [Lesson 3 — Rechtsfälle (Cases)](#4-lesson-3--rechtsfälle-cases)
5. [Lesson 4 — Mindmap](#5-lesson-4--mindmap)
6. [ID Conventions](#6-id-conventions)
7. [Validation Rules](#7-validation-rules)

---

## 1. Module Envelope

The top-level object wraps all lessons and provides metadata.

```jsonc
{
  "schemaVersion": "1.0.0",          // fixed literal
  "moduleId": "30-vertragslehre",    // kebab-case, matches folder name
  "title": "Vertragslehre",          // human-readable, German
  "description": "Schwerpunktthema: Vertragslehre",
  "outcomes": [                       // array of 2-5 learning outcomes (strings)
    "die fünf zentralen Voraussetzungen für einen gültigen Vertragsabschluss aufzuzählen...",
    "anhand eines einfachen Praxisfalls ... zu prüfen, ob ein Vertrag rechtsgültig zustande gekommen ist.",
    "potenzielle Fallstricke ... zu erkennen und präventive Massnahmen abzuleiten."
  ],
  "version": 1,                       // integer, increment on updates
  "status": "published",              // "draft" | "review" | "approved" | "published"
  "legalReferences": [                // all law articles referenced across all lessons
    { "id": "ref-30-vertragslehre-1", "citation": "ZGB Art. 19" },
    { "id": "ref-30-vertragslehre-2", "citation": "OR Art. 1" }
    // ... pattern: ref-{moduleId}-{counter}
  ],
  "metadata": {
    "language": "de-CH"               // always de-CH for this project
  },
  "generation": {                     // optional provenance info
    "sourceDocumentIds": ["30 Vertragslehre"],
    "generatedBy": "llm-name-or-script",
    "generatedAt": "2026-02-12T07:06:11.068Z"
  },
  "lessons": [ /* ... see below ... */ ]
}
```

### Field Rules

| Field | Type | Required | Constraint |
|---|---|---|---|
| `schemaVersion` | `"1.0.0"` | yes | must be literal `"1.0.0"` |
| `moduleId` | string | yes | `[a-zA-Z0-9._-]+`, kebab-case |
| `title` | string | yes | non-empty |
| `description` | string | yes | non-empty |
| `outcomes` | string[] | yes | min 1 item |
| `version` | integer | yes | positive |
| `status` | enum | yes | `"draft"` \| `"review"` \| `"approved"` \| `"published"` |
| `legalReferences` | array | no | default `[]` |
| `metadata.language` | string | no | default `"de-CH"` |
| `generation` | object | no | provenance tracking |
| `lessons` | Lesson[] | yes | min 1, typically 3-4 |

---

## 2. Lesson 1 — Grundlagen (Theory)

**Purpose:** Introduce the core concepts of the subtopic with concise theory blocks, followed by a discussion prompt for group reflection.

**LLM Specialization:** This LLM should be an **expert in Swiss law pedagogy** — it distills complex legal concepts into clear, structured theory paragraphs aimed at vocational students (Berufsschüler).

```jsonc
{
  "lessonId": "30-vertragslehre-grundlagen",   // {moduleId}-grundlagen
  "title": "Grundlagen",
  "pageType": "theory",
  "blocks": [
    // --- N theory blocks (typically 3-8) ---
    {
      "id": "30-vertragslehre-theory-1",        // {moduleId}-theory-{counter}
      "type": "theory",
      "title": "1. Übereinstimmende Willensäusserung",
      "content": "Ein Vertrag kommt durch den Austausch von zwei **übereinstimmenden Willenserklärungen** zustande: dem **Antrag (Offerte)** der einen Partei und der **Annahme** durch die andere Partei. Dies ist die grundlegendste Voraussetzung für jeden Vertragsabschluss gemäss OR#Art. 1."
    },
    // ... more theory blocks ...

    // --- 1 discussion-prompt block (always last) ---
    {
      "id": "30-vertragslehre-discussion-6",     // {moduleId}-discussion-{counter}
      "type": "discussion-prompt",
      "title": "Reflexionsfragen zum Einstieg",
      "prompts": [
        {
          "id": "30-vertragslehre-refl-1",        // {moduleId}-refl-{counter}
          "prompt": "Tauschen Sie sich in der Gruppe über Situationen aus, in denen Sie unsicher waren, ob ein **mündlicher Auftrag** wirklich verbindlich war. ..."
        },
        {
          "id": "30-vertragslehre-refl-2",
          "prompt": "Diskutieren Sie Fälle, in denen Sie es mit **minderjährigen Kunden** ..."
        }
      ]
    }
  ]
}
```

### Block Types Used

| Block Type | Schema Key | Count | Position |
|---|---|---|---|
| `theory` | `TheoryBlockSchema` | 3-8 | first N blocks |
| `discussion-prompt` | `DiscussionPromptBlockSchema` | 1 | always last block |

### Theory Block Spec

```jsonc
{
  "id": "{moduleId}-theory-{N}",      // sequential counter starting at 1
  "type": "theory",
  "title": "numbered title",           // e.g. "1. Übereinstimmende Willensäusserung"
  "content": "markdown text"           // supports **bold**, *italic*, law references like OR#Art. 1
}
```

**Content guidelines:**
- Each theory block covers one core concept (Kernaussage)
- Use **bold** for key legal terms on first mention
- Reference specific law articles (e.g. "gemäss OR#Art. 1", "ZGB#Art. 12 ff.")
- Aim for 2-5 sentences per block — concise but complete
- Use professional but accessible German (de-CH)
- Titles should be numbered sequentially ("1. ...", "2. ...", "3. ...")

### Discussion-Prompt Block Spec

```jsonc
{
  "id": "{moduleId}-discussion-{N}",
  "type": "discussion-prompt",
  "title": "Reflexionsfragen zum Einstieg",
  "prompts": [
    {
      "id": "{moduleId}-refl-{N}",
      "prompt": "markdown text with a question for group discussion"
    }
  ]
}
```

**Content guidelines:**
- 2-3 discussion prompts
- Questions should connect theory to the students' professional reality (Werkstatt, Landtechnik, Baumaschinen)
- Use "Sie" (formal) and encourage group exchange
- Italic text for sub-questions within a prompt

---

## 3. Lesson 2 — Zusammenfassung (Summary)

**Purpose:** Provide a detailed summary of the subtopic with deeper theory blocks, each followed by a competence-check (6 Q&A pairs) to test comprehension.

**LLM Specialization:** This LLM should generate **comprehensive summaries** paired with **Socratic-style competence questions**. It needs deep knowledge of the legal content to write accurate solutions.

```jsonc
{
  "lessonId": "30-vertragslehre-zusammenfassung",  // {moduleId}-zusammenfassung
  "title": "Zusammenfassung",
  "pageType": "summary",
  "blocks": [
    // --- Alternating pairs: theory → competence-check ---
    {
      "id": "30-vertragslehre-sum-theory-1",
      "type": "theory",
      "title": "1. Übereinstimmende Willensäusserung",
      "content": "Das Fundament jedes Vertrags ist die gegenseitige, übereinstimmende Willensäusserung ..."
    },
    {
      "id": "30-vertragslehre-sum-check-2",
      "type": "competence-check",
      "title": "Kompetenz-Check: 1. Übereinstimmende Willensäusserung",
      "questions": [
        {
          "id": "30-vertragslehre-sum-q1-1",
          "prompt": "1. Was ist ein Antrag (Offerte) und was ist eine Annahme?",
          "solution": "Der Antrag ist die erste Willenserklärung, ..."
        },
        // ... 5 more questions (6 total per section) ...
      ]
    },
    // --- Next pair ---
    {
      "id": "30-vertragslehre-sum-theory-3",
      "type": "theory",
      "title": "2. Handlungsfähigkeit der Parteien",
      "content": "..."
    },
    {
      "id": "30-vertragslehre-sum-check-4",
      "type": "competence-check",
      "title": "Kompetenz-Check: 2. Handlungsfähigkeit der Parteien",
      "questions": [ /* 6 questions */ ]
    }
    // ... repeat for each section (typically 5 pairs = 10 blocks total) ...
  ]
}
```

### Block Types Used

| Block Type | Schema Key | Count | Pattern |
|---|---|---|---|
| `theory` | `TheoryBlockSchema` | N (typ. 5) | alternating, odd positions |
| `competence-check` | `CompetenceCheckBlockSchema` | N (typ. 5) | alternating, even positions |

### Summary Theory Block Spec

```jsonc
{
  "id": "{moduleId}-sum-theory-{N}",   // odd counter: 1, 3, 5, 7, 9
  "type": "theory",
  "title": "numbered section title",    // matches the Grundlagen numbering
  "content": "detailed summary text"    // longer than Grundlagen, includes sub-points
}
```

**Content guidelines:**
- More detailed than Grundlagen theory — includes sub-points, definitions, examples
- Covers the same sections as Grundlagen but with additional depth
- Law article references inline (e.g. "(Art. 1 OR)")
- Can include bulleted lists within the content string using newlines

### Competence-Check Block Spec

```jsonc
{
  "id": "{moduleId}-sum-check-{N}",    // even counter: 2, 4, 6, 8, 10
  "type": "competence-check",
  "title": "Kompetenz-Check: {section title}",
  "questions": [
    {
      "id": "{moduleId}-sum-q{sectionCounter}-{questionCounter}",
      "prompt": "numbered question text",   // "1. Was ist ...", "2. Welche ..."
      "solution": "model answer text"
    }
  ]
}
```

**Content guidelines for questions:**
- Exactly **6 questions** per competence-check block
- Questions follow **Bloom's taxonomy** progression:
  1-2: Knowledge/recall (define, name, list)
  3-4: Comprehension/application (explain, describe a scenario)
  5-6: Analysis/transfer (assess a case, formulate a recommendation)
- Each question has a numbered prefix ("1. ...", "2. ...", etc.)
- Solutions are concise but complete model answers (1-3 sentences)
- Solutions must be legally accurate for Swiss law
- Questions should reference vocational/professional context where possible (Werkstatt, Baumaschinen, Landtechnik)

---

## 4. Lesson 3 — Rechtsfälle (Cases)

**Purpose:** Present realistic law cases that students solve using a structured 4-step method. Each case is followed by a discussion prompt for further debate.

**LLM Specialization:** This LLM should be an **expert in Swiss law case construction**. It needs to create realistic, domain-specific scenarios and apply the 4-step legal analysis method correctly.

```jsonc
{
  "lessonId": "30-vertragslehre-rechtsfaelle",   // {moduleId}-rechtsfaelle
  "title": "Rechtsfälle",
  "pageType": "cases",
  "blocks": [
    // --- Alternating pairs: law-case → discussion-prompt ---
    {
      "id": "30-vertragslehre-case-1",
      "type": "law-case-4-step",
      "title": "Fall 1 (Grundlagen): Der motivierte Lernende",
      "caseText": "Der 17-jährige Lernende zum Baumaschinenmechaniker, Jonas, ...",
      "steps": [
        {
          "id": "step_1",
          "title": "Sachverhalt erfassen",
          "prompt": "Fokussieren Sie auf das Alter von Jonas ...",
          "hint": "Fokussieren Sie auf das Alter von Jonas ...",
          "solution": "Beteiligte: ... \nWas ist passiert: ...\nRechtsfrage: ..."
        },
        {
          "id": "step_2",
          "title": "Rechtsgrundlagen bestimmen",
          "prompt": "Die zentralen Begriffe sind ...",
          "hint": "Die zentralen Begriffe sind ...",
          "solution": "Rechtsgebiet: ...\nRechtsvorschrift: ..."
        },
        {
          "id": "step_3",
          "title": "Voraussetzungen prüfen",
          "prompt": "Prüfen Sie die Voraussetzungen ...",
          "hint": "Prüfen Sie die Voraussetzungen ...",
          "solution": "Tatbestandsmerkmale: ...\nRechtsfolge: ..."
        },
        {
          "id": "step_4",
          "title": "Entscheid und Kommunikation",
          "prompt": "Ist Jonas für dieses Geschäft handlungsfähig ...",
          "hint": "Ist Jonas für dieses Geschäft handlungsfähig ...",
          "solution": "Prüfung: ...\nKonsequenz: ..."
        }
      ]
    },
    {
      "id": "30-vertragslehre-disc-block-2",
      "type": "discussion-prompt",
      "title": "Diskussion: Fall 1 (Grundlagen): Der motivierte Lernende",
      "prompts": [
        {
          "id": "30-vertragslehre-disc-fall-id-1-1",
          "prompt": "Was wäre, wenn Jonas die Werkzeugkiste auf Raten gekauft hätte ...?"
        },
        {
          "id": "30-vertragslehre-disc-fall-id-1-2",
          "prompt": "Spielt die Höhe des Kaufpreises (CHF 2'800) eine Rolle?"
        }
      ]
    }
    // ... repeat for each case (typically 8-12 cases = 16-24 blocks) ...
  ]
}
```

### Block Types Used

| Block Type | Schema Key | Count | Pattern |
|---|---|---|---|
| `law-case-4-step` | `LawCaseBlockSchema` | N (typ. 8-12) | alternating, odd positions |
| `discussion-prompt` | `DiscussionPromptBlockSchema` | N (typ. 8-12) | alternating, even positions |

### Law-Case-4-Step Block Spec

```jsonc
{
  "id": "{moduleId}-case-{N}",         // odd counter: 1, 3, 5, ...
  "type": "law-case-4-step",
  "title": "Fall {N} ({difficulty}): {descriptive title}",
  "caseText": "realistic scenario text ...",
  "steps": [
    { "id": "step_1", "title": "Sachverhalt erfassen",        "prompt": "...", "hint": "...", "solution": "..." },
    { "id": "step_2", "title": "Rechtsgrundlagen bestimmen",  "prompt": "...", "hint": "...", "solution": "..." },
    { "id": "step_3", "title": "Voraussetzungen prüfen",      "prompt": "...", "hint": "...", "solution": "..." },
    { "id": "step_4", "title": "Entscheid und Kommunikation", "prompt": "...", "hint": "...", "solution": "..." }
  ]
}
```

**The 4-Step Method (always exactly 4 steps):**

| Step | ID | Title | Solution Format |
|---|---|---|---|
| 1 | `step_1` | Sachverhalt erfassen | **Beteiligte:** ...<br>**Was ist passiert:** ...<br>**Rechtsfrage:** ... |
| 2 | `step_2` | Rechtsgrundlagen bestimmen | **Rechtsgebiet:** ...<br>**Rechtsvorschrift:** ... (with article citations) |
| 3 | `step_3` | Voraussetzungen prüfen | **Tatbestandsmerkmale:** ...<br>**Rechtsfolge:** ... |
| 4 | `step_4` | Entscheid und Kommunikation | **Prüfung:** ...<br>**Konsequenz:** ... |

**Case title difficulty levels (progressive per case set):**
- Cases 1-3: `(Grundlagen)` — straightforward application of one concept
- Cases 4-6: `(Anwenden)` — requires combining multiple concepts
- Cases 7-9: `(Analysieren)` — requires deeper analysis, weighing arguments
- Cases 10-12: `(Transfer/Beurteilung)` — complex scenarios requiring judgment and recommendation

**Content guidelines for caseText:**
- Realistic scenarios from Swiss vocational context (Werkstatt, Baumaschinen, Landtechnik, Landwirtschaft)
- Named characters (Swiss German names: Meier, Huber, Keller, Schmid, Gfeller, Moser, Frei, Bruni, Fuchs)
- Specific amounts in CHF
- Specific machine/tool types relevant to the trade
- 3-8 sentences describing the situation and the conflict

**Content guidelines for steps:**
- `prompt` = the task/question posed to the student for this step
- `hint` = a clue to guide the student (can be identical to prompt)
- `solution` = the model answer using the format above
- Solutions must cite specific law articles (e.g. "ZGB Art. 19", "OR Art. 1")
- Solutions should be structured with labeled paragraphs (Beteiligte, Rechtsgebiet, Tatbestandsmerkmale, etc.)

### Discussion-Prompt Block (after each case)

```jsonc
{
  "id": "{moduleId}-disc-block-{N}",    // even counter: 2, 4, 6, ...
  "type": "discussion-prompt",
  "title": "Diskussion: {case title}",
  "prompts": [
    {
      "id": "{moduleId}-disc-fall-id-{caseNumber}-{promptNumber}",
      "prompt": "What-if question or deeper analysis prompt"
    }
  ]
}
```

**Content guidelines:**
- 2-3 prompts per discussion block
- Questions explore "what if" variations of the case
- Encourage critical thinking and connecting to other legal concepts
- Build on the case solution but push beyond it

---

## 5. Lesson 4 — Mindmap

**Purpose:** Provide a visual summary of the entire subtopic as an interactive Mermaid mindmap.

**LLM Specialization:** This LLM should excel at **hierarchical knowledge structuring** — distilling the subtopic into a clear tree with 3-4 levels of depth using Mermaid mindmap syntax.

```jsonc
{
  "lessonId": "30-vertragslehre-mindmap",        // {moduleId}-mindmap
  "title": "Mindmap",
  "pageType": "mindmap",
  "blocks": [
    {
      "id": "30-vertragslehre-mindmap-block",    // {moduleId}-mindmap-block
      "type": "mindmap",
      "title": "Mindmap: {subtopic title}",
      "content": "mindmap\n  root((Gültiger Vertragsabschluss))\n    1 Übereinstimmende Willensäusserung - OR Art 1\n      Fundament jedes Vertrags\n      ..."
    }
  ]
}
```

### Block Types Used

| Block Type | Schema Key | Count |
|---|---|---|
| `mindmap` | `MindmapBlockSchema` | exactly 1 |

### Mindmap Block Spec

```jsonc
{
  "id": "{moduleId}-mindmap-block",
  "type": "mindmap",
  "title": "Mindmap: {subtopic title}",
  "content": "mermaid mindmap syntax (string, newline-separated)"
}
```

**Mermaid mindmap syntax rules:**
- First line must be `mindmap`
- Second line: `  root(({central concept}))` — double parens for rounded box
- Indent with 2 or 4 spaces per level
- Levels: root → main branches → sub-branches → leaf nodes
- Do NOT use special characters that break Mermaid (no `()`, `{}`, `[]` in node text — use `-` or space instead)
- Reference law articles in branch text (e.g. `OR Art 1` without special chars)
- Maximum 4 levels deep

**Content structure:**
- Root: the central theme of the subtopic
- Level 1: main concepts (matching the numbered sections from Grundlagen)
- Level 2: key definitions, principles, or rules
- Level 3: examples, exceptions, or specific articles
- Level 4 (optional): details only where necessary

**Example snippet:**
```
mindmap
  root((Gültiger Vertragsabschluss))
    1 Übereinstimmende Willensäusserung - OR Art 1
      Fundament jedes Vertrags
      Antrag - Offerte
        Erste Willenserklärung
      Annahme
        Zweite, zustimmende Willenserklärung
    2 Handlungsfähigkeit der Parteien - ZGB Art 12 ff
      Voraussetzungen
        Volljährigkeit
        Urteilsfähigkeit
      Folge bei Mangel
        Vertrag ist ungültig bzw nichtig
```

**Note:** Subtopics 70 and 80 currently have no mindmap lesson. This is optional — only include this lesson when the content warrants a visual overview.

---

## 6. ID Conventions

All IDs must match the regex `[a-zA-Z0-9._-]+`.

| Element | Pattern | Example |
|---|---|---|
| moduleId | `{order}-{kebab-slug}` | `30-vertragslehre` |
| lessonId | `{moduleId}-{lessonType}` | `30-vertragslehre-grundlagen` |
| theory block (Grundlagen) | `{moduleId}-theory-{N}` | `30-vertragslehre-theory-1` |
| discussion block (Grundlagen) | `{moduleId}-discussion-{N}` | `30-vertragslehre-discussion-6` |
| reflection prompt | `{moduleId}-refl-{N}` | `30-vertragslehre-refl-1` |
| summary theory | `{moduleId}-sum-theory-{N}` | `30-vertragslehre-sum-theory-1` |
| summary check | `{moduleId}-sum-check-{N}` | `30-vertragslehre-sum-check-2` |
| summary question | `{moduleId}-sum-q{section}-{N}` | `30-vertragslehre-sum-q1-1` |
| law case block | `{moduleId}-case-{N}` | `30-vertragslehre-case-1` |
| case discussion | `{moduleId}-disc-block-{N}` | `30-vertragslehre-disc-block-2` |
| case disc. prompt | `{moduleId}-disc-fall-id-{case}-{N}` | `30-vertragslehre-disc-fall-id-1-1` |
| case steps | `step_1` ... `step_4` | always these exact 4 IDs |
| legal reference | `ref-{moduleId}-{N}` | `ref-30-vertragslehre-1` |
| mindmap block | `{moduleId}-mindmap-block` | `30-vertragslehre-mindmap-block` |

**Counters:** Block-level counters (`{N}`) are sequential within a lesson, starting at 1. They count across block types (theory-1, theory-2, ..., discussion-6 means there were 5 theory blocks before it).

---

## 7. Validation Rules

The JSON must pass two validation layers:

### 7a. Schema Validation (Zod)
- Enforced by `parseModuleVersion()` from `@hfp/content-schema`
- All `.strict()` objects — no extra properties allowed
- All enums are strictly typed
- `law-case-4-step` must have exactly 4 steps
- Step IDs must be exactly `step_1`, `step_2`, `step_3`, `step_4`

### 7b. Semantic Validation
- Enforced by `validateModuleSemantics()` from `@hfp/content-schema`
- All block IDs must be unique within a lesson
- All question/prompt IDs must be unique within a lesson
- Step IDs are scoped to their parent block (i.e. `step_1` can repeat across law-case blocks)
- Legal reference IDs used in `requiredLegalReferences` must exist in the top-level `legalReferences` array

---

## Quick Reference: Complete Lesson Structure

```
Module JSON
├── envelope (schemaVersion, moduleId, title, description, outcomes, ...)
├── legalReferences[]
└── lessons[]
    ├── [0] Grundlagen (pageType: "theory")
    │   ├── theory block × N
    │   └── discussion-prompt block × 1
    ├── [1] Zusammenfassung (pageType: "summary")
    │   ├── theory block + competence-check block  (pair 1)
    │   ├── theory block + competence-check block  (pair 2)
    │   ├── theory block + competence-check block  (pair 3)
    │   ├── theory block + competence-check block  (pair 4)
    │   └── theory block + competence-check block  (pair 5)
    ├── [2] Rechtsfälle (pageType: "cases")
    │   ├── law-case-4-step + discussion-prompt  (case 1)
    │   ├── law-case-4-step + discussion-prompt  (case 2)
    │   ├── ...
    │   └── law-case-4-step + discussion-prompt  (case N)
    └── [3] Mindmap (pageType: "mindmap")  ← optional
        └── mindmap block × 1
```
