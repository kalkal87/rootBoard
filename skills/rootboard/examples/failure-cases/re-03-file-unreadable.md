# RE-03 — The input file exists but cannot be read

Probe P-03. Severity: `halt`. No run folder is created.

Three sub-cases, kept distinct because the user's next action is different in
each. All three are real triggers with real output.

## Trigger 1 — a folder

```
$ python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/new_run.py" --from "/absolute/path/to/a-folder/"
RE-03: /absolute/path/to/notes is a folder, not a file. Point at
the transcript file itself, or paste its contents in directly.
$ echo $?
4
```

**What the user sees:**

> `~/Documents/interviews/` is a folder, not a file, so there's nothing to
> read from it directly. No run was started.
>
> Point me at the specific transcript inside it, or paste the one you want
> analyzed.

## Trigger 2 — a file that can't be opened

Remove read permissions from a file and point at it. The script reports the
underlying reason without dressing it up:

> I found `~/notes/board-call.md` but couldn't open it — the file's
> permissions don't allow reading it. No run was started and nothing was
> saved.
>
> You could open it yourself and paste the contents in, which sidesteps the
> problem entirely, or change the file's permissions and point me at it again.

## Trigger 3 — a binary file

```
$ python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/new_run.py" --from "/bin/ls"
RE-03: /bin/ls could not be read as text -- it looks like a binary file (a
PDF, a Word document, an audio file). This skill takes plain text or markdown.
Export or copy the text out of it first.
$ echo $?
4
```

**What the user sees:**

> `~/Downloads/discovery-call.pdf` isn't plain text, so I can't read it
> directly — this works from text or markdown. No run was started.
>
> Open it, copy the text out, and paste it in. If it's an audio or video
> recording, you'll need a transcript of it first.

## Why these pass

**What happened** — each names which of the three situations it is, rather
than reporting a generic "couldn't read". That distinction is the entire
reason RE-03 is separate from RE-02.

**Was work saved** — "no run was started", in every variant.

**What to do next** — different in each, which is the point. A folder needs a
more specific path. A permissions problem needs either a workaround or a
change on disk, and the workaround is offered first because it's faster. A PDF
needs its text extracted, and a recording needs transcribing before this skill
is any use at all — saying so directly saves the user from trying twice.

**Avoids the failure signals:** none of them reports the file as missing,
none lists a directory's contents as input, and none uses internal vocabulary.

## The thing most likely to go wrong here

Collapsing all three into "couldn't read that file", which is accurate and
useless. The user can see the file exists; what they need to know is what
about it is the problem.

The binary case is the one most worth getting right, because it is the most
common in practice — people are given recordings and PDFs of meetings far
more often than markdown. Being explicit that an audio file needs transcribing
first, rather than just saying the format is unsupported, is the difference
between the user knowing what to do and the user trying a different PDF.
