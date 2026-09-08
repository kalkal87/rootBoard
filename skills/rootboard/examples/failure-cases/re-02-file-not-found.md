# RE-02 — The input file does not exist

Probe P-02. Severity: `halt`. No run folder is created.

## Trigger

Give a path that doesn't exist:

```
$ python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/new_run.py" --from "/absolute/path/to/notes-that-do-not-exist.md"
RE-02: There is no file at /absolute/path/to/notes-that-do-not-exist.md.
Check the path, or paste the transcript in directly instead.
$ echo $?
3
```

Note that the script resolves the path to an absolute one before reporting it.
That matters: a user who typed a relative path may be wrong about which
directory they're in, and seeing the full path is often what reveals it.

## What the user sees

> I couldn't find a file at `~/notes/q3-retro.md` — nothing exists at that
> path, so no run was started and nothing was saved.
>
> Either check the path and give it to me again, or just paste the transcript
> into the chat instead.

## Why this passes

**What happened** — stated once, with the path repeated back verbatim. This
is the single highest-value element in the message: most of the time the user
spots their own typo the moment they see the path written out, and no further
exchange is needed.

**Was work saved** — "no run was started and nothing was saved", in the same
sentence rather than as an afterthought.

**What to do next** — two routes. The second one matters more than it looks:
a user whose file is inside a synced folder with an awkward path, or open in
another application, can always paste, and offering that avoids a round of
path debugging neither party wanted.

**Avoids the failure signals:** no raw filesystem error is surfaced, nothing
continues with empty input, and the path is repeated back rather than referred
to as "the file".

## The thing most likely to go wrong here

Paraphrasing the path instead of quoting it — "I couldn't find that file" —
which throws away the one piece of information that would let the user fix it
themselves.

The other is guessing. If a nearby file looks like what they meant, it is
fine to mention it as a question ("did you mean `q3-retro-notes.md`, which is
in that folder?"), but never to start a run on it. Analyzing the wrong
transcript silently is worse than not starting.
