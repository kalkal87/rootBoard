# Sharing This Skill

This document is for someone installing rootBoard and for the maintainer
preparing a copy to share. It covers Claude Code and Codex installation,
updates, invocation, package contents, private run files, and verification.

The source repository's `README.md` links here as the canonical installation
and update guide.

## V1 sharing format: one standalone skill, two hosts

The repository contains one self-contained skill at `skills/rootboard/`.
There is no build step: that directory contains `SKILL.md` and every runtime
resource it references. Skills.sh discovers the nested package automatically;
manual installations must install or link that directory, not the repository
root.

| Host and route | Installed skill root |
| --- | --- |
| Skills CLI | the destination reported by the CLI |
| Claude Code manual link | `~/.claude/skills/rootboard/` |
| Codex `$skill-installer` | the destination it reports, normally `$CODEX_HOME/skills/rootboard/` with `CODEX_HOME` defaulting to `~/.codex` |
| Codex manual link | `~/.agents/skills/rootboard/` |

The `name: rootboard` frontmatter in `SKILL.md` is the canonical skill name;
using `rootboard` as the folder name keeps every installation easy to
recognize. Codex also reads `agents/openai.yaml` for UI metadata and invocation
policy. Claude Code ignores that host-specific metadata.

This version remains a standalone skill rather than a plugin. That is the
smallest format for local use on both hosts. Revisit plugin packaging when
rootBoard needs marketplace discovery, team-managed distribution, connectors,
or multiple bundled skills.

## Installing

You need Claude Code or Codex, Python 3.9 or newer, a modern browser for the
final whiteboard, and a host that can create isolated subagents. The helpers
use only Python's standard library; there are no packages to install and no
build step.

### Install the published skill

The Skills CLI discovers `skills/rootboard/SKILL.md` automatically. Install
it globally for the host you use:

```bash
npx skills add kalkal87/rootBoard --skill rootboard --global --agent codex
npx skills add kalkal87/rootBoard --skill rootboard --global --agent claude-code
```

Run only the command for your host. The CLI performs the installation; no
second manual copy step is required.

### Test a private or local checkout

From the root of this repository, install the current working copy rather
than the version published on GitHub:

```bash
npx skills add . --skill rootboard --global --agent codex --copy
```

If an older `rootboard` installation already exists, move that entire folder
outside every scanned skills directory before installing. Keeping two copies
with the same skill name makes it unclear which one a host selected.

For a checkout-backed installation on another machine, clone the repository:

```bash
git clone https://github.com/kalkal87/rootBoard.git
```

The checkout is the development repository; its `skills/rootboard/` directory
is the self-contained package to install or link.

### Manual alternatives

For **Claude Code**, a symlink is recommended because it follows updates to
the source checkout:

```bash
mkdir -p ~/.claude/skills
ln -s /path/to/rootBoard/skills/rootboard ~/.claude/skills/rootboard
```

Use a recursive copy instead when you want a frozen copy:

```bash
cp -R /path/to/rootBoard/skills/rootboard ~/.claude/skills/rootboard
```

For **Codex**, the built-in installer is an alternative snapshot install. This
is a skill invocation followed by a natural-language request:

```text
$skill-installer Install the skill from kalkal87/rootBoard at path skills/rootboard and name it rootboard.
```

The repository path is `skills/rootboard` because that directory is the
self-contained package. Keep the destination printed by the installer; that
is the installed copy to inspect or replace later.

Contributors who want a checkout-backed Codex install can symlink it instead:

```bash
mkdir -p ~/.agents/skills
ln -s /path/to/rootBoard/skills/rootboard ~/.agents/skills/rootboard
```

A plain copy to the same Codex directory is also supported. On Windows, use a
directory symbolic link (`mklink /D` or PowerShell's
`New-Item -ItemType SymbolicLink`) or a recursive copy.

## Updating

- **Skills CLI install:** update the installed package through the CLI.

  ```bash
  npx skills update rootboard --global
  ```

- **Symlink install:** update the source clone; the installed skill follows it
  immediately.

  ```bash
  cd /path/to/rootBoard
  git pull
  ```

- **Local checkout copy or Codex installer snapshot:** move the existing
  installed folder to a backup outside every scanned skills directory, then
  repeat the installation. Verify discovery and the smoke test below before
  deleting the backup.

Public releases use Git tags such as `v1.0.0`. For an unreleased checkout,
record the source commit used for the test. Codex detects skill changes
automatically; restart it if an update does not appear.

## Invoking the skill

Once installed, open the host from any project. The skill is global and does
not rely on that project's working directory.

- **Claude Code:** describe the matching task in plain language, or invoke
  `/rootboard` when the installed version supports named skill invocation.
- **Codex:** run `/skills` to confirm that `rootboard` is present, then invoke
  it explicitly with `$rootboard`. Codex may also select it implicitly from a
  request that matches the frontmatter description.

Example:

```text
$rootboard Find the underlying problems in this transcript:
[paste transcript]
```

Either way, once the skill is running, follow `SKILL.md`'s own description
of what it accepts and what it does — this document only covers getting it
installed and started, not what happens during a run.

## Reusable skill files vs. private run files

Two different kinds of files exist once you're using this skill, and only
one of them is part of the shared package:

**Reusable skill files** — everything inside the installed skill root, which
maps to `skills/rootboard/` in the source repository:
`SKILL.md`, `agents/`, `prompts/`, `frameworks/`, `contracts/`, `renderer/`,
`orchestration/`, `docs/`, `error-handling/`, `examples/`, and `assets/`.
These are the instructions, helpers, and templates that make the skill work.
They never contain anyone's actual transcripts or run output.

The maintainer's evaluation suite and its answer keys are **not** part of this
repository or installed package. Keep them in a separate private workspace so
a session running the skill cannot see grading material before producing its
answer.

**Private run files** — everything a *run* of the skill produces: the
original input you gave it, the classifier's choices, each framework's
findings, the synthesis, and the final whiteboard artifact. These are saved
per-run, per-user, **outside** the installed skill folder entirely — by
default under `~/Documents/rootBoard/runs/<run-name>/` on the machine
that ran it. See `docs/invocation-and-runs.md` for the exact layout and for
how to opt into project-local storage instead. Run files are never part of
this repository, are never distributed to other users, and updating the
skill (`git pull`) never touches them.

If you're ever unsure which category a file falls into: if it is under the
installed `SKILL.md`, it is a reusable skill file; if it is inside a
`.../runs/<run-name>/` folder, it is a private run file.

## Verifying an install works

Useful after a fresh install, after moving the install to a new machine, or
after changing the sharing format:

1. **Confirm discovery.** In Codex, run `/skills` and confirm `rootboard`
   appears. For either host, confirm the active `SKILL.md` belongs to the
   installation route you chose. If Codex does not see a valid install,
   restart it once before troubleshooting the path.
2. **Invoke it from somewhere else.** Start the host from a project unrelated
   to this repository; using a scratch-project path containing a space also
   checks path quoting. Invoke the skill with a small transcript. It should
   resolve its packaged resources from the installed skill root, not the
   scratch project.
3. **Check where the run landed.** Confirm its folder was created under
   `~/Documents/rootBoard/runs/`, not inside the skill or scratch project. A
   sandboxed Codex session may request permission for that exact external
   location. If you decline and then explicitly choose project-local storage,
   the run should instead be under that project's `rootboard-runs/`.
4. **Open the whiteboard artifact.** It should open directly from the run
   folder in a browser with no missing styles or broken interactions. The
   artifact is self-contained: `orchestration/scripts/build_whiteboard.py`
   inlines the renderer's CSS and JS into the HTML as it builds it, so the
   finished `whiteboard.html` has no external references at all. That is
   what lets it work from a run folder in Documents — and lets the user
   move, copy, or email the file — even though the board *template* inside
   the skill folder links to its CSS and JS relatively. A whiteboard that
   opens unstyled means the build step was bypassed, not that the install
   is in the wrong place.

Documentation cross-references remain relative within the package. During a
run, the coordinator resolves the active `SKILL.md` directory and expands
packaged resource and helper paths to quoted absolute paths before shell or
subagent use. That distinction is what makes the skill work from an unrelated
project without hard-coding an installation location.
