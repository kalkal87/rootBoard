# Findings: Five Whys

## Framework
- **Name:** Five Whys
- **Slug:** five-whys
- **Lens summary:** Traces a stated symptom back through repeated "why"
  questions to find the structural root cause underneath it.

## Observations
- Escalations tagged "renewal" were up 65% in Q3 vs Q2 (Support lead,
  ~4:10).
- 8 of 11 renewal escalations in Q3 were requests for bulk seat/permission
  changes before the renewal date (Support lead, ~5:30).
- The bulk permission editor has been on the roadmap for three quarters and
  has been bumped each time (Eng lead, ~14:20).

## Assumptions
- Assuming "bumped each time" means the feature lost out to other roadmap
  items in ordinary prioritization, not that it was blocked by some
  technical dependency — the input states the pattern but never says why it
  keeps losing.

## Open Questions
- What specifically outranks the bulk editor each planning cycle? The input
  names the pattern of losing but not the competing priorities.

## Problems Identified

### Problem 1: Roadmap prioritization doesn't weight recurring seasonal support cost
- **Problem Statement:** The bulk permission-edit feature keeps losing
  roadmap prioritization fights because the recurring cost of not having it
  — a predictable, quarter-over-quarter spike in manual renewal escalations
  — isn't represented as a cost inside the prioritization process itself.
- **Impact / Symptoms:** Renewal escalations up 65% Q3 vs Q2, concentrated
  (8 of 11) in one repeated, entirely foreseeable request.
- **Proof Points:**
  - "Escalations tagged 'renewal' were up 65% in Q3 vs Q2." (Support lead,
    ~4:10)
  - "The bulk permission editor has been on the roadmap for three
    quarters, it keeps getting bumped." (Eng lead, ~14:20)
- **Confidence:** Medium

## Coverage Note
Five Whys fit this input well — there's a clear recurring symptom and a
traceable chain down to a structural cause. Confidence is Medium rather
than High because the input states the deprioritization pattern but never
says why it keeps losing; the final link in the chain is partly inferred.
