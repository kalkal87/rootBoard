# Findings: Fishbone Analysis

## Framework
- **Name:** Fishbone Analysis
- **Slug:** fishbone-analysis
- **Lens summary:** Sorts contributing causes of a problem into categories
  (people, process, technology, policy) to check whether one dominant cause
  is being treated as if it were the whole picture.

## Observations
- Renewal timing is fixed by contract, so the Q3 spike is predictable every
  quarter rather than a one-off (Sales ops, ~21:00).
- Support performs manual bulk edits informally for about 20% of accounts,
  only when an account escalates (CS manager, ~16:45).
- The console has no bulk permission-edit feature (Eng lead, ~14:20; CS
  manager, ~9:00).

## Assumptions
- Assuming the 20% figure is roughly stable quarter to quarter rather than
  a Q3-specific anomaly — the input presents it as an ongoing informal
  practice, not something new this quarter.

## Open Questions
- Is there a formal policy or SLA governing who gets the manual white-glove
  treatment, or is it purely a function of how loudly an account complains?
  The input suggests the latter but never states a policy either way.

## Problems Identified

### Problem 1: A predictable, calendar-driven spike is being absorbed reactively instead of planned for
- **Problem Statement:** Because renewal timing is contractually fixed, the
  Q3 escalation spike is a predictable seasonal pattern, not an anomaly —
  yet it's handled each quarter as a reactive support fire rather than a
  planned capacity or product investment.
- **Impact / Symptoms:** The same 65% Q3 escalation spike, reframed as a
  recurring, foreseeable seasonal load rather than a surprise.
- **Proof Points:**
  - "Renewal timing is fixed by contract, so this spike is predictable
    every quarter, not a one-off." (Sales ops, ~21:00)
- **Confidence:** Medium

### Problem 2: The informal white-glove workaround is a technology gap wearing a people/process disguise
- **Problem Statement:** The console's missing bulk permission-edit
  capability (technology) is currently being patched over by unevenly
  applied manual support labor (people/process), which hides the
  technology gap's true cost from anyone who isn't sitting in a support
  escalation call.
- **Impact / Symptoms:** Only about 20% of accounts receive the workaround,
  leaving the wider cost of the capability gap uncounted.
- **Proof Points:**
  - "We give white-glove manual bulk edits to about 20% of accounts
    already, informally, when someone escalates loud enough." (CS manager,
    ~16:45)
  - "The bulk permission editor has been on the roadmap for three
    quarters, it keeps getting bumped." (Eng lead, ~14:20)
- **Confidence:** Medium

## Coverage Note
Fishbone fit this input well once multiple categories of cause became
visible — the input supports at least three distinct branches (technology,
process, people) rather than one. Both problems are Medium confidence: each
is grounded in real proof points, but the causal link between categories
(e.g. that invisibility of cost is *why* prioritization keeps failing) is
this framework's own inference, not something the input states outright.
