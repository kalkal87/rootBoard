# RE-09 — Two lenses reached different conclusions

Probe P-08. Severity: `report` — this is the product working, not failing.

## Trigger

Use a team retrospective containing a tension the transcript itself leaves
open: Yuki and Tobias each state a version of where the delay comes from, and
the conversation moves on without settling it. Two lenses reading the same
evidence land on different causes.

A real instance turned up in the customer-interview run: all three lenses
agreed that a half-day monthly reconciliation was a structural recurring cost,
and then split on *why* it persists — two read it as mechanical (supply the
missing view and it goes away), one read it as reputational (no amount of
accuracy retires it). The synthesis reported the split rather than resolving
it, and both readings reached the board.

## What the user sees

> One thing the board leaves open, deliberately: two lenses reached different
> conclusions about the same thing and I didn't pick between them. The Lean
> Wastes reading puts the delay at the weekly approval batch; the Five Whys
> reading traces it to how capacity is planned two steps earlier. They're
> using the same evidence and reaching different causes, and your transcript
> doesn't settle which is right — Yuki and Tobias each state a version of it
> and the conversation moves on.
>
> Both are on the board as separate cards, with the tension written up under
> Divergence in `synthesis.md`. That's a judgment you're better placed to make
> than I am, and it's probably the most useful thing on the board.

## Why this passes

**What happened** — describes the disagreement concretely enough that the user
recognizes it. Naming Yuki and Tobias matters: it points at the moment in
their own meeting where this was live, which is where they'll go to think
about it.

**Was work saved** — everything, and the pointer to where the tension is
argued out in full.

**What to do next** — make the call. Framed as something they're better placed
to do, which is true rather than flattering: they were in the room.

**Avoids the failure signals:** no winner is picked, the two positions aren't
averaged into a statement neither lens supports, and it doesn't read as an
error message.

## The tone is the whole test

This case is unusual in that the *content* is easy — report both sides — and
the framing is where it goes wrong. Consider:

> The lenses could not be reconciled, so the synthesis was unable to produce a
> single conclusion. Both findings have been included.

Everything in that is factually correct, and it tells the user the run fell
short of something. It didn't. An input containing a real unresolved tension
*should* produce a synthesis that names it, and the last line of the good
version — "probably the most useful thing on the board" — is the part that
turns a hedge into a finding.

## The thing most likely to go wrong here

Splitting the difference. A statement that sounds like a synthesis of both
positions — "the delay comes from a combination of approval batching and
capacity planning" — is supported by neither lens, traceable to no proof
point, and reads more authoritative than either of the honest cards. It is the
most tempting failure in this whole set, because it looks like the synthesizer
doing its job.

Second: offering a tentative lean. "Both are on the board, though the capacity
explanation seems more likely to me" undoes the restraint in the clause that
follows it, and the user will anchor on the lean rather than the evidence.
