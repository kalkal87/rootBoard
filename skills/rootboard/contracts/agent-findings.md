# Agent Findings Contract

This is the shared agreement between each problem-solving agent and the
synthesizer. A problem-solving agent produces exactly one findings document,
written in this format, for the single framework it was assigned. The
synthesizer reads one or more of these documents and must be able to compare
them without guessing at missing structure.

This contract owns *what a findings document must contain and how it is
shaped*. It does not own *where the file is saved* — that is decided by the
invocation workflow (see `docs/invocation-and-runs.md`).
Within whatever run folder the invocation workflow provides, a findings file
should be named:

```
findings-<framework-slug>.md
```

Where `<framework-slug>` is the lowercase, hyphenated name of the framework
(e.g. `five-whys`, `jobs-to-be-done`, or a slug the classifier invented for a
one-off lens).

## Why this shape

The synthesizer's job is to compare independently-produced findings and tell
the user where they agree, where they conflict, and what none of them
noticed. That's only possible if:

- Every agent grounds its findings in the same source input, and shows its
  work (observation vs. inference vs. open question) instead of blending
  them.
- Every agent expresses "the problems I found" as discrete, comparable units
  rather than a single essay — so the synthesizer can match similar problems
  across documents and detect convergence.
- Every unit carries the same three fields the final board card needs
  (statement, impact, proof points), so nothing has to be reverse-engineered
  later.

## Required document structure

```markdown
# Findings: <Framework Name>

## Framework
- **Name:** <framework name>
- **Slug:** <framework-slug>
- **Lens summary:** <one sentence — what this framework looks for>

## Observations
- <a fact pulled directly from the input, with a proof point>
- <...>

## Assumptions
- <something the agent is inferring or filling in, not stated in the input>
- <...>

## Open Questions
- <something this lens surfaces that the input doesn't answer>
- <...>

## Problems Identified

### Problem 1: <short working title>
- **Problem Statement:** <the reframed, sharpened statement of the problem,
  as seen through this framework's lens — not a restatement of how the input
  phrased it>
- **Impact / Symptoms:** <one consultant-style consequence sentence,
  targeting 12–20 words and never exceeding 24, stating the business or
  operating outcome that gets worse if the problem continues>
- **Proof Points:**
  - <direct quote or close paraphrase from the input, with a locator>
  - <...>
- **Confidence:** High | Medium | Low

### Problem 2: <short working title>
- ...(repeat the same fields)

## Coverage Note
<One or two sentences on how well this framework fit this input. If the
framework barely applied, say so here instead of forcing weak problems into
the "Problems Identified" section.>
```

Repeat the `### Problem N` block for every problem this framework surfaced.
An agent may surface as few as zero problems (see Failure Behavior) or as
many as are genuinely distinct — there is no fixed count.

## Field rules

- **Observations, Assumptions, and Open Questions are separate lists and
  must not be mixed.** An observation is something the input actually says
  or clearly implies. An assumption is something the agent is filling in to
  make sense of a gap. An open question is something the agent doesn't know
  and thinks the user should resolve. If an agent is unsure which bucket a
  line belongs in, it belongs in Assumptions or Open Questions, never in
  Observations.
- **Every Problem Statement must be reframed, not copied.** It should sound
  like the framework's lens produced it — e.g. a Five Whys problem statement
  names a root cause; a Jobs-to-be-Done problem statement names an unmet job.
  Restating the input's own words back is not sufficient.
- **Every Impact / Symptoms field must be one consultant-style consequence
  sentence, targeting 12–20 words and never exceeding 24.** It answers:
  **What business or operating outcome gets worse if this problem
  continues?** Lead with the primary supported consequence — lost time or
  capacity, delayed value, weaker performance or conversion, revenue or
  service risk, or poorer decision quality — and quantify it when the input
  allows. Do not restate the cause, summarize stakeholder behavior, or list
  Proof Points. If the input supports only an observed symptom and not a
  downstream consequence, state the symptom plainly rather than inventing
  an impact. Put evidence detail and confidence or uncertainty explanation
  in their dedicated fields.
- **Every problem needs at least one Proof Point traceable to the input.** A
  proof point is a short quote or close paraphrase, plus a locator (a
  timestamp, speaker name, line reference, or paragraph description) — enough
  that the user could find the original moment in the source input. A
  problem with no proof point should not be listed; move it to Open
  Questions or Assumptions instead.
- **Proof Points must come from the original input, not from another
  agent's findings or from general knowledge.** Each problem-solving agent
  only ever sees the raw input and its own assigned framework — never other
  agents' output — so this should hold naturally.
- **Confidence is the agent's own calibration**, not a measure of how
  interesting the problem is. Low confidence is a valid and useful signal to
  the synthesizer; it is not a reason to omit a problem.

## Failure behavior

- If the assigned framework does not meaningfully apply to this input, the
  agent still produces a findings document, lists zero or very few problems,
  and uses the Coverage Note to say so plainly (e.g. "This input describes a
  single factual disagreement with no underlying process to trace — Five
  Whys surfaced no additional root cause beyond what's stated."). It must
  not invent problems to avoid an empty section.
- If the input is too short or ambiguous for any framework to produce
  grounded findings, the agent still returns a valid document: empty or
  near-empty Problems Identified, a small handful of Open Questions
  explaining what's missing, and a Coverage Note flagging the limitation.
- An agent must never fabricate a proof point. If a plausible-sounding
  problem has no traceable evidence, it goes in Assumptions or Open
  Questions instead of Problems Identified.

## What the synthesizer can rely on

Given one or more documents in this format, the synthesizer can assume:

- Every problem has a statement, impact, proof points, and a confidence
  level.
- Observations, assumptions, and open questions are never mixed together.
- A framework slug and lens summary are always present, so the synthesizer
  can attribute each problem to the framework(s) that surfaced it and
  explain *why* that framework surfaced it.
- An empty or near-empty Problems Identified section is a legitimate,
  informative result — not a malformed document.
