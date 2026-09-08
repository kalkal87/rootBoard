# Agent Briefs

The runtime briefs are split so the coordinator loads only the material for
the agent it is about to dispatch:

- `orchestration/briefs/framework-agent.md` — stage 4, one isolated agent per
  selected lens.
- `orchestration/briefs/synthesizer.md` — stage 5, after framework findings
  have landed.

Classification runs directly in the coordinator, so there is no classifier
brief or classifier subagent.

The isolation boundary is load-bearing: a framework agent receives the raw
input and exactly one lens, never another assignment, the classification
framing, or prior findings. Otherwise apparent convergence could be an echo
of shared context rather than independent support in the input.

Before dispatch, replace every packaged-resource and run-file placeholder in
a brief with a quoted absolute path. Packaged paths come from the active
`SKILL.md` directory, not the coordinator's current working directory. A
later-wave framework agent receives the same brief-only context as an
initial-wave agent; it never inherits earlier findings.

Translation and rendering are deterministic scripts and do not use agents.
