# Responses

One user-facing response for every failure point in
`contracts/runtime-errors.md`. That contract owns *what can go wrong, where,
and what survives it*; this file owns *what the user is told*.

Read `voice.md` first — it is the standard all twelve are written to, and it
lists the words that must never reach the user.

The messages below are models, not scripts to paste. Substitute the real
paths, lens names and counts; keep the shape, the order, and the tone. A
message that names no real path has not been filled in.

**Before writing any of them, check the run folder.** Every claim about what
was saved is a claim about a file you have confirmed exists.

---

## RE-01 — No input was provided

Fires before anything else, when the skill is invoked with no transcript and
no path. This is a request, not an error: do not open with an apology, and do
not write it as though something went wrong.

> I need the transcript or context dump before I can start — that's the
> material this works from, and guessing from a one-line description would
> just hand you back your own assumptions.
>
> Paste it straight into the chat, or give me a path to a text or markdown
> file. Nothing's been created yet, so there's nothing to clean up.

Do not create a run folder. Do not offer to analyze the request itself.

---

## RE-02 — The input file does not exist

The path has to be repeated back verbatim. Nine times out of ten the user
spots the typo the moment they see it.

> I couldn't find a file at `~/notes/q3-retro.md` — nothing exists at that
> path, so no run was started and nothing was saved.
>
> Either check the path and give it to me again, or just paste the transcript
> into the chat instead.

Both ways forward, every time. A user whose file lives somewhere they can't
easily name can always paste.

---

## RE-03 — The input file exists but cannot be read

Kept separate from RE-02 because the next action differs. Say which of the
three it is — that is what makes the message actionable rather than merely
accurate.

**A folder rather than a file:**

> `~/Documents/interviews/` is a folder, not a file, so there's nothing to
> read from it directly. No run was started.
>
> Point me at the specific transcript inside it, or paste the one you want
> analyzed.

**Permissions:**

> I found `~/notes/board-call.md` but couldn't open it — the file's
> permissions don't allow reading it. No run was started and nothing was
> saved.
>
> You could open it yourself and paste the contents in, which sidesteps the
> problem entirely, or change the file's permissions and point me at it again.

**A binary file — a PDF, a Word document, a recording:**

> `~/Downloads/discovery-call.pdf` isn't plain text, so I can't read it
> directly — this works from text or markdown. No run was started.
>
> Open it, copy the text out, and paste it in. If it's an audio or video
> recording, you'll need a transcript of it first.

Never report any of these as "not found". The file is right there, and telling
someone their file is missing when they can see it is worse than saying
nothing.

---

## RE-04 — The run folder could not be created

Rare, and the only case where the user's pasted transcript is at risk — it is
in the conversation and nowhere else. Do not lose it while explaining.

If a host sandbox blocked `~/Documents/rootBoard/runs/`, use the host's
approval flow for that exact directory and retry before reporting RE-04. If
the user declines, do not silently place the transcript in the active project;
offer that location and wait for explicit consent.

> I couldn't create the folder for this run at
> `~/Documents/rootBoard/runs/`. Nothing was analyzed or saved, and your
> transcript is still here in the chat, so it isn't lost.
>
> If you want, I can instead use
> `<project-root>/rootboard-runs/`. That puts the transcript and analysis
> inside this project, where they may appear in `git status`, so I will only
> use it if you explicitly approve that location. You can also name another
> folder.

Do not start the analysis anyway with the intention of saving it later.

---

## RE-05 — The input is too short or too unclear

**Not an abort.** The run happens, produces a real whiteboard, and this is
said as part of the closing summary — never on its own, and never before the
work is done. The user gets a deliverable; they also get an honest account of
how much it can carry.

> One thing worth knowing about this board: the notes were fairly short —
> about 90 words, covering a single exchange — so both lenses were working
> from thin material, and each said so in its own coverage note. Only two
> lenses ran rather than the usual three, because a third would have restated
> the same handful of impressions in different words and made it look like
> more agreement than there is.
>
> What's on the board is genuinely grounded in what you gave me, and the two
> cards are honest about being uncertain. One thing the readings noticed that
> the board doesn't show: almost everything in the note is an impression you
> then take back in the same sentence, and the one checkable thing — velocity
> — you say you haven't checked.
>
> If you want more out of this, the shortest path is checking one of them. Or
> re-run with the reorg conversation, if there was one.

Never imply the user did something wrong, and never refuse to run. "The
transcript is short" is an observation; "you didn't give me enough" is a
reprimand for something that isn't a fault.

Where the input asked a question — this one ends "is there a problem here or
am I inventing one?" — answer it. On a thin input the most useful thing the
run produces is often not on the board.

---

## RE-06 — A framework is a poor fit

Also a normal result, also part of the closing summary. The user needs to know
a lens found little, because otherwise a thin board looks like a thin problem
space.

> Worth flagging: the Five Whys reading found very little here. It traces one
> symptom back to a root cause, and this transcript is a forward-looking
> planning discussion with no recurring failure to trace — so it surfaced one
> low-confidence problem and said in its own notes that the fit was weak. The
> board is effectively carried by the other two lenses.
>
> That's in `findings-five-whys.md` if you want to see what it did look at.

Do not present the run as though every lens contributed equally, and do not
quietly drop the lens from the count. Three lenses ran; one found little.

---

## RE-07 — A lens failed or returned nothing

The run continues on the lenses that did report, and every claim about it
shrinks accordingly. The message has to make the missing lens visible enough
that the user reads the board as a two-lens board.

> One of the three lenses didn't finish: the Lean Wastes reading stopped
> partway and didn't produce anything. The other two completed normally, and
> everything else is saved in
> `~/Documents/rootBoard/runs/2026-08-28-0915-supply-delays/` — your
> transcript, the Jobs to Be Done and Five Whys readings, the synthesis, and
> the whiteboard.
>
> So treat this as a two-lens board rather than a three-lens one. Where those
> two agreed, that's real, but it's weaker evidence than agreement across
> three would have been. I can re-run just the Lean Wastes reading against
> the same transcript if you want the third view — it won't disturb what's
> already there.

The offer to re-run the single missing lens matters: it costs the user
nothing and it is the obvious thing they want.

---

## RE-08 — A lens's notes are not in the expected shape

Handled as RE-07 from the synthesis onward, with one addition: say what was
wrong with the document, so the user can tell a broken reading from an
unlucky one.

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

Never delete the unusable file. The user may want to read it, and it is the
only evidence of what that lens actually thought.

---

## RE-09 — The lenses genuinely disagree

The product working, not failing. Written as a finding, with no hint that
something needs fixing. An error-shaped message here is itself the defect.

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

Do not average the two positions, and do not add your own tentative lean.

---

## RE-10 — The whiteboard's data isn't usable

The analysis is intact; the translation of it into the whiteboard's data file
is not. Everything the user actually cares about reading still exists, and the
message should lead with that rather than with the defect.

> I couldn't build the whiteboard from this run. When the synthesis was turned
> into the whiteboard's data file, two cards came out sharing the same
> identifier and one ended up with no problem statement — which would have
> given you a board that opened fine and quietly behaved wrong, so I stopped
> instead of handing it over.
>
> Everything up to that point is saved and worth reading, in
> `~/Documents/rootBoard/runs/2026-08-28-1430-onboarding/`: your
> transcript, all three readings, and `synthesis.md`, which is the full
> analysis in prose and doesn't depend on the board at all.
>
> Want me to rebuild the board data and try again? Nothing needs re-analyzing.

Say what the defect was in plain terms. "Two cards shared the same
identifier" is specific and harmless; "duplicate id violates the board
contract" says the same thing in words the user can't use.

Explaining *why* stopping was right matters here, because from the outside a
board that opens looks better than no board.

---

## RE-11 — The whiteboard couldn't be made

The analysis and the board data are both sound; assembling the file failed.
Different from RE-10 and the user's next step is different too.

> The analysis all completed, but I couldn't assemble the whiteboard file
> itself — part of the whiteboard's own code is missing from the installed
> skill, so there was nothing to build the page from.
>
> The whole run is saved in
> `~/Documents/rootBoard/runs/2026-08-28-1610-pricing/`. `synthesis.md`
> is the full analysis and reads on its own, and `board-data.json` holds all
> five cards, so nothing has to be re-analyzed once this is sorted.
>
> This one's an installation problem rather than anything to do with your
> transcript — re-installing or updating the skill should fix it, and then I
> can build the board from the data that's already saved.

Naming it as an installation problem rather than a problem with their input
is the part that saves the user from re-running anything.

---

## RE-12 — Finding, reopening, or cleaning up an old run

Not a failure. Included because it is the one case where a response can
destroy the user's work.

**Finding a run:**

> Runs are kept in `~/Documents/rootBoard/runs/`, one folder each, named
> by date and subject — so last week's retro is
> `2026-08-21-1045-q3-retro/`. Its whiteboard is `whiteboard.html` inside
> that folder; open it in a browser and you'll get the board exactly as it
> was, though any cards you moved or edited in the browser last time won't
> have been kept.

**Cleaning up:**

> There are 14 run folders in `~/Documents/rootBoard/runs/`, going back
> to March. Deleting them removes the transcripts along with everything else
> — those folders hold your original material verbatim, so it's worth a look
> before anything goes.
>
> Which do you want removed? I can list them with dates and subjects, or
> delete everything older than a date you name — but I'll show you the exact
> list and wait for your go-ahead before deleting anything.

Never delete before the user has seen the specific list and confirmed it. The
warning about transcripts is not boilerplate: these folders hold customer
names, internal strategy and salaries in plain text, and the user may not have
thought about that since the run.

---

## Two rules across all twelve

**Check before you claim.** Every path in every message above is a file you
have confirmed on disk. `orchestration/scripts/check_run.py` exists for
exactly this, and its output tells you which parts of a run are real.

**A partial run is described as partial.** In the closing summary, in the
first sentence, not in a footnote. The rubric scores a complete-looking report
of an incomplete run at zero, and it is right to — the user's next decision
gets made on what you told them.
