# Frameworks

This folder contains plain-language descriptions of reusable
problem-identification frameworks (lenses) that a problem-solving agent can
be assigned. Each framework lives in its own file: `frameworks/<slug>.md`,
where `<slug>` is the lowercase, hyphenated framework name (e.g.
`frameworks/five-whys.md`).

Ownership: Ticket 1.

## Who reads a framework file

- **The coordinator's classifier step** reads the compact JSON emitted by
  `orchestration/scripts/framework_catalog.py`. The helper extracts
  `good_for`, `when_to_use`, and `Known blind spot` from every recipe, so the
  coordinator can choose 2–4 lenses without loading full framework bodies.
  The coordinator then dispatches one independent agent per selected lens.
- **A problem-solving agent** reads exactly one framework file in full and
  applies it, per `prompts/problem-solving-agent.md`, producing output in
  `contracts/agent-findings.md` format.

A framework file is a **recipe for a way of thinking**, not code and not a
prompt. It should be written so a non-technical contributor — someone who
knows the framework (e.g. a consultant, coach, or product manager) but has
never written an agent prompt — can add a new one correctly by copying the
format below.

## Required format

Every framework file must begin with short YAML frontmatter, followed by a
fixed set of body headings, in this order:

```yaml
---
name: <Framework Name>
slug: <lowercase-hyphenated-slug>
good_for: <one short, pointed sentence: what this framework looks for>
when_to_use: <one short, pointed sentence: what kind of input calls for this lens>
---
```

`good_for` and `when_to_use` must stay to a single short sentence each. They,
along with `Known blind spot`, are extracted into the compact selection
catalog, so keep them concrete and pointed rather than general marketing
copy for the framework.

```markdown
# <Framework Name>

## Core idea
<2-4 sentences explaining the underlying thinking model, written for
someone unfamiliar with it. No jargon without a plain-language explanation
alongside it.>

## Reasoning steps
<A numbered list of steps a problem-solving agent follows when using this
lens on an input. Steps should be concrete enough to follow without
additional interpretation, but should not restate the general agent
instructions already covered in `prompts/problem-solving-agent.md` (e.g.
don't repeat "cite proof points" here — that rule is universal, not
framework-specific). Focus only on what is distinctive about applying this
specific framework.>

## What it tends to surface
<1-3 sentences on the kind of problem this framework is good at finding —
useful to the synthesizer when explaining *why* a given framework converged
or diverged on something.>

## Known blind spot
<1-2 sentences on what this framework tends to miss or distort. Every
framework has one; naming it helps the classifier pick a complementary set
of lenses instead of three lenses that all miss the same thing.>
```

For V1, framework files don't include worked examples — keep each section to
the compact, universal instructions above; evidence, assumptions, open
questions, and confidence are already covered by the agent instructions in
`prompts/problem-solving-agent.md`, not repeated here.

## Guidelines for writing a new framework file

- Write for a reader who knows the *subject matter* (business problems,
  team dynamics, product decisions) but has never seen this repository.
  Avoid engineering terms like "prompt," "agent," or "pipeline" inside the
  framework's own explanation — save those for the "Reasoning steps"
  section, which is instructional rather than explanatory.
- Keep "Reasoning steps" specific to this framework. Anything that's true
  for every framework (grounding in the input, separating observations from
  assumptions, output format) already lives in
  `prompts/problem-solving-agent.md` and `contracts/agent-findings.md` —
  don't duplicate it here.
- A framework file should stand alone. A problem-solving agent reads only
  the one framework file it was assigned — it should never need to read a
  second framework file to understand its own.
- Prefer frameworks that are genuinely different lenses (root-cause tracing,
  stakeholder/incentive analysis, systems thinking, customer-job framing,
  etc.) over near-duplicates of an existing file.

## Frameworks the classifier invents

The coordinator may invent a lens only when fewer than two existing
frameworks meaningfully fit the input (see `prompts/classifier.md`). An
invented lens must satisfy this same required format — frontmatter (`name`,
`slug`, `good_for`, `when_to_use`) plus the body headings (Core idea,
Reasoning steps, What it tends to surface, Known blind spot) — and is written
into the classification appendix for its framework agent. A contributor who
later notices the same invented lens recurring across runs can promote it to
a permanent file by following this format.

## Example

`frameworks/five-whys.md` is a complete, illustrative recipe. Use it as the
template when writing a new framework file.
