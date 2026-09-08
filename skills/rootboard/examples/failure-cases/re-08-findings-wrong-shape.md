# RE-08 — A lens's notes are not in the expected shape

Probe P-06. Severity: `degrade`.

## Trigger

Place a deliberately malformed document into a run folder as one of the
findings files and run the synthesis over it. Make it break the findings
format in five ways: no framework
attribution, observations and assumptions and open questions merged into one
list, a problem with no proof points, a problem with no confidence, and no
coverage note.

**The completeness check will not catch this.** Confirmed by running it
against a run folder holding the fixture:

```
Lenses assigned by the classifier: 3
  ok       findings-jobs-to-be-done.md
  ok       findings-lean-wastes.md
  ok       findings-five-whys.md
```

All three report `ok`, because the file exists and isn't empty. The check
compares assigned lenses against files on disk; judging whether a document can
actually be compared is a reading task, and `contracts/runtime-errors.md`
assigns it to the synthesis step rather than to a script. A green check means
the files are there, not that the analysis is sound.

## What the user sees

> The Jobs to Be Done reading finished, but what it wrote isn't in the shape
> the rest of the run can use — it ran its problems together as prose without
> separating out the evidence for each one, so there was no safe way to carry
> them onto the board without inventing the missing structure. I left it out
> of the comparison rather than half-using it.
>
> The file is still there, at
> `~/Documents/rootBoard/runs/2026-08-28-1102-churn-review/findings-jobs-to-be-done.md`,
> and it's readable — it just couldn't be compared against the others
> mechanically. The other two lenses are intact and the board is built from
> those. I can re-run that lens if you'd like the third view.

## Why this passes

**What happened** — says what was wrong with the document in terms of
consequence, not of format. "Ran its problems together as prose without
separating out the evidence" tells the user something real; "violates the
findings contract" tells them a rule was broken without saying which or why it
matters.

**Was work saved** — the exact path, and explicitly that the file is *still
readable by a person*. That distinction matters: the document may contain
perfectly good thinking that simply couldn't be processed, and the user is the
one who can judge that.

**What to do next** — read it directly, or have that lens re-run.

**Avoids the failure signals:** nothing is synthesized from a document with no
framework attribution, the problem with no proof points never reaches the
board, and the sound findings files are preserved rather than lost.

## Why not just use the parts that are fine

The fixture makes the argument. Its first problem has no proof points at all,
so carrying it onto the board would put a card in front of the user with
nothing traceable behind it — indistinguishable, on the board, from the cards
that are fully evidenced. And with no framework section, there is no way to
attribute anything it found to a named lens, so a synthesis that used it would
be claiming agreement between "Lean Wastes" and something unidentified.

Half-using a malformed document produces a board that looks complete and is
quietly less trustworthy than it appears, which is the same failure mode as an
invalid board (`re-10`) arriving by a different route.

## The thing most likely to go wrong here

Deleting the file. It's unusable by the run and it is still the only record of
what that lens thought — the user may want to read it, and the person fixing
the underlying problem certainly will.
