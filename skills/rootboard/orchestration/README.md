# Orchestration

The layer that connects the other four: framework recipes, independent
analysis agents, synthesis, and whiteboard rendering. Each of those knows
only its own job. This folder is what turns them into a single run.

Ownership: Ticket 6.

## Layout

| Path | What it is |
| --- | --- |
| `coordinator.md` | The compact runtime path. Start here. |
| `run-workflow.md` | The detailed reference for every stage, save, and gate. Load only the relevant stage when needed. |
| `agent-briefs.md` | Brief routing and the reason for agent isolation. |
| `briefs/` | Separate runtime briefs for framework agents and the synthesizer, loaded only at their stage. |
| `board-data-translation.md` | The mechanical mapping from `synthesis.md` to `board-data.json`. |
| `scripts/` | Eight small stdlib-only Python helpers for deterministic run work. |

`SKILL.md` routes the runtime to `coordinator.md`; `run-workflow.md` remains
the deeper reference rather than startup context.

## What this layer is responsible for

- **Sequencing.** Which stage runs when, and what has to exist before the
  next one starts.
- **Isolation.** Framework agents never see each other's work. The
  convergence signal the synthesizer grades is only meaningful if the lenses
  were genuinely independent, so the boundary is enforced in the brief rather
  than requested of the agent.
- **Persistence.** Every stage's output is on disk before the next begins.
  Any failure after run setup leaves the user with real work in a folder
  whose path they were already told.
- **Honesty.** A failed stage must not look like a successful one. This is
  the acceptance condition the `run-status.md` record and `check_run.py`
  exist to enforce, and the reason the board data is validated before the
  artifact is built rather than after.

## What it is not responsible for

It holds no analytical opinion. It does not decide which lenses fit, how a
problem should be reframed, what counts as convergence, or how a sticky note
looks. Those belong to `prompts/`, `frameworks/`, `contracts/`, and
`renderer/` respectively, and are read from there so this folder cannot
drift out of sync with them.

## Why some of this is scripts

Everything else in this skill package is instructions, deliberately. Eight
pieces of a run are deterministic or safer as scripts:

- creating the run folder and saving the input byte-for-byte, before
  anything that could fail has been attempted (`new_run.py`),
- extracting a compact, always-current framework selection catalog
  (`framework_catalog.py`),
- recording the serial-path timing events (`record_run_event.py`),
- checking board data against a contract the renderer is too tolerant to
  enforce (`validate_board_data.py`),
- translating synthesis into validated board data
  (`translate_board_data.py`),
- substituting a template and inlining three renderer assets — CSS, the core
  module, then the main renderer (`build_whiteboard.py`),
- confirming the run folder holds what the run says it holds
  (`check_run.py`).

They use only the Python 3 standard library — no packages to install, and
nothing to build. See `scripts/README.md` for the manual fallback if Python
is unavailable.

## Runtime failures

Every failure point a run can hit is named `RE-NN` and defined in
`contracts/runtime-errors.md`, which is where the stages here point when
something goes wrong. That contract is the input to Ticket 7, which owns the
user-facing message for each one.
