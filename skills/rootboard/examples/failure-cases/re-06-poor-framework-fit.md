# RE-06 — One lens found almost nothing

Probe P-05. Severity: `report` — a normal result, said as part of the run's
closing summary rather than on its own.

## Trigger

Use a forward-looking planning discussion and check whether the classifier
assigned a retrospective cause-tracing lens to it; or assign one directly. A
lens built to trace a recurring failure backwards has little to work with in
a conversation about what to build next.

A milder, real instance is in the thin-input run
(`re-05-thin-input.md`): Five Whys reported partial fit and said so plainly
in its own coverage note —

> Five Whys fit this input only partially. The stated symptoms are impressions
> the author himself doubts, and the input answers almost none of the "why"
> questions they raise, so the chain runs out of support after one or two
> steps.

That is the shape of a correct RE-06: the lens says where it ran out, in its
own document, without inventing anything to fill the gap.

## What the user sees

> Worth flagging: the Five Whys reading found very little here. It traces one
> symptom back to a root cause, and this transcript is a forward-looking
> planning discussion with no recurring failure to trace — so it surfaced one
> low-confidence problem and said in its own notes that the fit was weak. The
> board is effectively carried by the other two lenses.
>
> That's in `findings-five-whys.md` if you want to see what it did look at.

## Why this passes

**What happened** — names the lens, and explains the mismatch in one clause:
this lens traces a recurring failure, your input doesn't have one. The user
learns something about their own material, not just about the tool.

**Was work saved** — everything; the lens's file is named so they can look.

**What to do next** — implicitly, read the board knowing two lenses carry it.
There's no corrective action because nothing is broken, and inventing one
would be worse than leaving it out.

**Avoids the failure signals:** no causal chain is manufactured to fill the
section, the weak fit is surfaced rather than left for the user to infer from
a thin board, and the run isn't presented as though all three lenses
contributed equally.

## Why this isn't a failure

A lens that doesn't fit is information about the input. "No recurring failure
to trace" is a real fact about a planning discussion, and a user who learns
that their situation isn't a root-cause problem has learned something worth
knowing.

The alternative is much worse. Each stage of this pipeline has a structural
incentive to produce output: agents fill a Problems Identified section, the
synthesis produces statements, and a board looks better with more cards. A
lens that manufactures a causal chain to avoid an empty section produces a
card indistinguishable from a well-evidenced one, and the convergence grading
downstream may then treat it as agreement.

## The thing most likely to go wrong here

Silence. The weak fit is recorded honestly in the lens's own coverage note and
picked up by the synthesis — and then nobody tells the user, who is left to
work out from a two-card board that a third of the analysis found nothing.
Everything upstream can behave correctly and this still fails at the last
step, because the run folder is not where most users go looking.
