# Meta — Documentation Style Guide

This document defines how to create, edit, and maintain all documentation files inside `.claude/documents/`. It is the authoritative source of truth for documentation standards in the OPA project. Read this before creating or editing any document.

> ⚠️ **Language note:** Documents written before 2026-06-07 are in Spanish. All new documents must be written in English. Existing Spanish documents should be migrated to English when they are next edited for a substantive update.
>
> **Why English, not Spanish (confirmed 2026-09-15):** measured empirically against 4 real paragraph pairs from this project's own docs (same content, same level of technical detail, tokenized with a BPE tokenizer comparable to Claude's) — English consistently used fewer tokens, averaging **~13-15% cheaper** than the equivalent Spanish text. This isn't a stylistic preference: BPE vocabularies are trained on corpora dominated by English, so Spanish text (accented characters, richer verb conjugations, longer average word length) tends to fragment into more sub-word tokens for the same information. Every document read into context on every future session costs real tokens — this compounds. **This is a decision about the language of prose going forward, not a mandate to retroactively translate the large volume of Spanish content already written** (real sessions have written most substantive updates in Spanish since well after this guide was created, in practice — see the "Practical note" below); that migration is its own separate, deliberate task if it's ever undertaken, not something to attempt piecemeal.
>
> **Practical note:** despite this guide, in practice most sessions after 2026-06-07 continued writing substantive updates to these documents in Spanish (the project's working language — see `CLAUDE.md`). As of 2026-09-15, `database-2026-06-06-schema-and-seed.md` is almost entirely Spanish, `frontend-2026-06-06-screens-and-components.md` is heavily mixed, and even `design-2026-06-06-visual-system.md` has Spanish fragments in later additions. `backend-2026-06-15-api-layer.md`, `product-2026-06-10-brand-system.md`, and `product-2026-06-15-admin-panel.md` are the documents that actually stayed in English. Going forward, prefer English for new substantive content in these documents given the measured token cost — but don't let chasing that ideal block getting a real update written promptly in whichever language is faster in the moment.

> ⚠️ **Known error in `meta-2026-06-06-how-to-use-documents.md`:** The filename format example shows `YYYY-DD-MM` but the correct format is `YYYY-MM-DD`. All existing files use the correct format. This style guide supersedes the older meta document.

---

## Who creates documents

Documents are created exclusively by Claude Code, triggered by a user prompt. Users do not write documents manually. External readers (developers, collaborators) should be able to understand any document, but the primary audience is Claude itself across sessions.

**Trigger phrases that initiate document creation:**
- "Create a document about X"
- "Document what we just built"
- "Update the documentation for Y"

---

## When to create vs. edit

| Situation | Action |
|---|---|
| Something significant was implemented that no existing document covers | **Create a new document** |
| A new functional area was added to the project | **Create a new document** |
| An existing document's area was extended or changed | **Edit the existing document** |
| A pending item was completed | **Edit the existing document** — move it from Pending to the relevant section |
| An existing document has grown too long to navigate | **Create a new document** with an updated date, add a deprecation notice to the old one |
| Two documents contradict each other | **Edit the older one** to align with the newer one, or add a `⚠️` notice pointing to the authoritative source |

**Default rule: edit over create.** Only create a new document when the scope is clearly distinct or the existing document is no longer navigable.

---

## Automatic updates after code changes

When Claude completes an implementation that affects any area covered by an existing document, it must:

1. Update the relevant sections in the document
2. Move completed items out of **Pending**
3. At the end of the turn, notify the user with a brief summary of what changed in the documentation

Claude must NOT wait to be asked. This happens automatically after every significant code change.

---

## Filename format

```
{category}-{date}-{title}.md
```

| Part | Description | Example |
|---|---|---|
| `{category}` | Document category (see valid categories below) | `database` |
| `{date}` | Creation date in `YYYY-MM-DD` format | `2026-06-07` |
| `{title}` | Descriptive title in kebab-case | `schema-and-seed` |

**Full example:** `database-2026-06-07-schema-and-seed.md`

The date reflects when the document was **created**, not last edited. Do not rename files when updating them.

### Valid categories

| Category | Contents |
|---|---|
| `database` | Table schema, migrations, seed data, storage buckets, auth triggers |
| `backend` | Supabase integration, hooks, stores, TypeScript types, Edge Functions |
| `frontend` | Screens, components, routes, animations, technical config |
| `design` | Visual system: colors, typography, spacing, UI components, principles |
| `meta` | Documentation about the documentation system itself |
| `product` | Cross-cutting product decisions: feature specs, business model, user roles, flows that span multiple layers |

If a new category is needed, it must be a single lowercase word. Prefer English.

---

## Internal document structure

Every document must follow this template exactly:

```markdown
# {Category} — {Descriptive Title}

One or two sentences explaining what this document covers and why it exists.

---

## {Section 1}

Content...

---

## {Section N}

Content...

---

## Pending

- [ ] Unimplemented item with enough context to act on it
- [ ] Another pending item
```

### Formatting rules

- **Language:** English (see note at top of this document for legacy files)
- **Tables** for comparing options or listing fields with multiple attributes
- **Code blocks** (` ``` `) for SQL, TypeScript, file paths, and shell commands — always with the language identifier
- **Section titles** must be descriptive, not generic ("Auth Flow", not "Authentication")
- **`Pending`** is mandatory and always the last section
- **No vague TODOs** — every pending item must have enough context to be actionable ("Add skeleton loaders to OutfitCard during data fetch" not "improve loading")
- **No full file dumps** — only include relevant snippets, not entire files
- **Decisions must include rationale** — if something was done a specific way for a technical reason, explain it briefly inline

---

## Resolving conflicts between documents

If two documents contain contradictory information about the same topic:

1. **The document with the most recent date takes precedence**
2. Update the older document to be consistent, or add this notice:
   ```
   > ⚠️ This section was superseded. See `{newer-document}.md` for the current state.
   ```

---

## What NOT to include

- Complete file contents (snippets only)
- Decisions pending user approval (those stay in the conversation)
- Vague TODOs without context
- Information already obvious from well-named code identifiers
- Implementation details that change frequently and are better read from the source

---

## Questions Claude must ask before creating a new document

Before writing any new document, Claude must ask the user the following questions using expandable options. The goal is to produce a document that is accurate, scoped correctly, and useful across sessions. Do not skip questions — exhaustive upfront clarity prevents incorrect documentation.

### Questions to ask

<details>
<summary>1. What category does this document belong to?</summary>

Options:
- `database` — Schema, migrations, seed, storage, auth triggers
- `backend` — Supabase client, hooks, stores, TypeScript types, Edge Functions
- `frontend` — Screens, components, routes, animations, technical config
- `design` — Colors, typography, spacing, UI components, design principles
- `meta` — The documentation system itself
- Other (specify a single lowercase word)

</details>

<details>
<summary>2. What is the exact scope of this document?</summary>

Options:
- A single feature or screen (e.g., "Outfit Scroll screen only")
- An entire functional area (e.g., "all authentication flows")
- A cross-cutting concern (e.g., "error handling across the app")
- A decision log (e.g., "why we chose X over Y")

</details>

<details>
<summary>3. Is there an existing document that partially covers this topic?</summary>

Options:
- No, this is a completely new area
- Yes, and the new document should replace it (mark old one as deprecated)
- Yes, but the scope is different enough to warrant a separate document
- Yes, and I'd rather expand the existing document instead (reconsider creating a new one)

</details>

<details>
<summary>4. What is the current implementation state of the content being documented?</summary>

Options:
- Fully implemented and working
- Partially implemented — needs Pending items to reflect what's missing
- Not yet implemented — this is forward-looking documentation
- Mixed — some parts done, some pending

</details>

<details>
<summary>5. Are there known technical decisions or constraints that must be documented?</summary>

Options:
- Yes — I'll describe them (workarounds, tradeoffs, version constraints, etc.)
- No specific decisions, just implementation details
- I'm not sure — Claude should infer from the code

</details>

<details>
<summary>6. Should this document include code snippets?</summary>

Options:
- Yes, include key snippets (SQL schema, TypeScript types, config objects)
- No, keep it prose and tables only
- Only include snippets for non-obvious or tricky parts

</details>

<details>
<summary>7. What should appear in the Pending section?</summary>

Options:
- I'll list the pending items explicitly
- Claude should infer pending items from context and the existing CLAUDE.md
- There are no pending items — everything in scope is complete
- Include a mix of known gaps and items Claude identifies from the code

</details>

---

## Current documents

| File | Covers |
|---|---|
| `database-2026-06-06-schema-and-seed.md` | Table schema, seed data, storage buckets, auth trigger |
| `backend-2026-06-06-supabase-integration.md` | Supabase client, auth flow, data hooks, TypeScript types |
| `frontend-2026-06-06-screens-and-components.md` | Screens, components, design tokens, technical config |
| `design-2026-06-06-visual-system.md` | Color palette, typography, cards, Storage resources, principles |
| `meta-2026-06-06-how-to-use-documents.md` | Older meta doc — superseded by this file for style guidance |
| `meta-2026-06-07-documentation-style-guide.md` | This file — authoritative style guide |
| `meta-2026-06-10-pending-features.md` | Single source of truth for all unimplemented features and product ideas |
| `product-2026-06-10-brand-system.md` | Brand model: onboarding, profile, panel, sales model, stock, verification, monetization |
| `backend-2026-06-15-api-layer.md` | Hono API on Supabase Edge Functions: stack, endpoints, auth middleware, pending routes |
| `product-2026-06-15-admin-panel.md` | Internal admin panel (`opa-admin`): purpose, stack, screens, access model |
| `meta-2026-09-14-code-audit.md` | Code quality audit of `main` — bad practices, dead code, dependency cleanup; complete as of 2026-09-15 |

---

## Pending

- [ ] Migrate all pre-2026-06-07 documents from Spanish to English on next substantive edit
- [ ] Add `auth` category if authentication flows grow complex enough to split from `backend`
- [ ] Add a `decisions` category document once architectural tradeoffs accumulate beyond what fits inline
