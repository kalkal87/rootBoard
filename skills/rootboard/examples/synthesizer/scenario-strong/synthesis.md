# Synthesis

## Reframed Problem Statement(s)

**Enterprise admins cannot complete bulk permission changes before renewal
because the console lacks a bulk editor.** Every symptom in this run's
input — the 65% Q3 escalation jump, the near-churn mentions, the informal
white-glove treatment for one account in five — traces back to the same
missing capability, not to three separate issues.

## Convergence

**Strong convergence — all three assigned frameworks independently
identified this same underlying gap:**

- **Five Whys** traced the visible symptom (renewal escalations) down a
  causal chain to a structural cause: a roadmap-prioritization process that
  doesn't weight the recurring cost of not shipping the bulk editor.
- **Jobs to Be Done** identified the unmet customer job directly: admins
  need to finish bulk access changes before a fixed renewal deadline, and
  the product doesn't let them do it themselves.
- **Fishbone Analysis** reached the same gap from a third angle, naming it
  explicitly as a technology-category cause that's being disguised as a
  people/process issue because support quietly absorbs the cost.

This is meaningful agreement, not restated wording: a causal-chain lens, an
unmet-need lens, and a cause-category lens all landed on the same missing
feature via different evidence and different reasoning paths. That
convergence is why this reaches the board as one well-evidenced problem
rather than three separate, thinner ones.

## Divergence

The three frameworks converge on *what* the underlying gap is, but not on
*why it's been allowed to persist for three roadmap quarters* — and this run's
input doesn't resolve it:

- **Five Whys'** account: it's ordinary prioritization competition — other
  roadmap items have simply outranked the bulk editor each cycle. This is
  stated as an assumption in that framework's findings, not confirmed.
- **Fishbone's** account: the cost is invisible to whoever prioritizes the
  roadmap, because support quietly absorbs it through the informal 20%
  workaround instead of it ever showing up as a counted cost.

These aren't the same claim in different words — one says the fix is
losing a fair fight, the other says the fight isn't fair because the true
cost never gets weighed at all. Nothing in this run's input distinguishes
between them, so this is left open rather than resolved on the user's
behalf.

## Blind Spots

None of the three frameworks raised, as its own problem, the fairness and
hidden-churn risk sitting underneath the 20% figure: if only accounts that
escalate loudly enough get the manual workaround, the roughly 80% that
don't escalate are an unknown quantity — some may be self-serving
successfully (unlikely, since no self-serve path exists), some may be
quietly struggling and not asking, and some may be quietly churning without
ever generating an escalation the team sees. Jobs to Be Done's own Open
Question gestures at exactly this ("do accounts outside the white-glove 20%
attempt to self-serve and give up, or do they not ask at all?"), and
Fishbone's Problem 2 supplies the 20% figure as a supporting observation for
a different claim — but no framework made this its own flagged problem.
Seeing it required reading both documents side by side.

This is deliberately **not** promoted to a Structured Board Content entry:
it rests on connecting two documents' side observations, not on a
framework's own verified Problem with its own proof points. It belongs here
as a flag worth investigating directly, not as an established finding.

## Structured Board Content

### Missing bulk permission-edit capability
- **Problem Statement:** Enterprise admins cannot complete bulk permission
  changes before renewal because the console lacks a bulk editor.
- **Impact:** Renewal escalations rose 65%; three customers nearly churned,
  while only 20% received the manual workaround.
- **Proof Points:**
  - "Escalations tagged 'renewal' were up 65% in Q3 vs Q2." (Support lead,
    ~4:10)
  - "Customers keep asking us to just do the bulk edit for them over email
    because they can't find it in the console." (CS manager, ~9:00)
  - "We give white-glove manual bulk edits to about 20% of accounts
    already, informally, when someone escalates loud enough." (CS manager,
    ~16:45)
  - "The bulk permission editor has been on the roadmap for three
    quarters, it keeps getting bumped." (Eng lead, ~14:20)
- **Frameworks:**
  - Five Whys — "Escalations tagged 'renewal' were up 65% in Q3 vs Q2."
    (Support lead, ~4:10); "The bulk permission editor has been on the
    roadmap for three quarters, it keeps getting bumped." (Eng lead,
    ~14:20)
  - Jobs to Be Done — "Customers keep asking us to just do the bulk edit
    for them over email because they can't find it in the console." (CS
    manager, ~9:00); "We give white-glove manual bulk edits to about 20%
    of accounts already, informally, when someone escalates loud enough."
    (CS manager, ~16:45); "Three customers mentioned they almost churned
    because the renewal process took so long to sort out manually."
    (Support lead, ~19:10)
  - Fishbone Analysis — "Renewal timing is fixed by contract, so this
    spike is predictable every quarter, not a one-off." (Sales ops,
    ~21:00); "We give white-glove manual bulk edits to about 20% of
    accounts already, informally, when someone escalates loud enough." (CS
    manager, ~16:45)
- **Convergence Note:** Confidence: Five Whys Medium; Jobs to Be Done High;
  Fishbone Analysis Medium. Strong convergence — all three assigned
  frameworks independently identified the same underlying capability gap
  from different angles (causal chain, unmet customer job, and
  cross-category cause mapping). One tension is unresolved: Five Whys
  attributes the gap's persistence to ordinary prioritization competition,
  while Fishbone's people-branch observation suggests the true cost is
  invisible to prioritization because support absorbs it quietly. The
  input doesn't confirm either explanation — see Divergence.

## Coverage Note
All three assigned frameworks fit this input well; none returned an empty
Problems Identified section. Confidence is not uniformly High and is
reported per framework rather than smoothed into one number — Jobs to Be
Done's evidence is the strongest of the three (three independent, concrete
proof points), while Five Whys and Fishbone both carry a Medium confidence
because part of their causal reasoning is inferred rather than stated
outright by the input.

The fairness/hidden-churn blind spot named above is deliberately excluded
from Structured Board Content: it has real supporting observations but no
framework-verified Problem entry behind it, so it's flagged for direct
investigation rather than presented as an established finding.

`contracts/board-output.md`'s Card object has no dedicated confidence
field; per `contracts/synthesis-output.md`, confidence is folded into this
problem's Convergence Note as a leading line rather than dropped.
