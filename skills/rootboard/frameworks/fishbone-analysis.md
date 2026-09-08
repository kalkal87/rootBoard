---
name: Fishbone Analysis
slug: fishbone-analysis
good_for: Mapping the many possible categories of cause behind one effect.
when_to_use: Use when a problem has several plausible contributing causes spread across different categories rather than one obvious linear chain.
---

# Fishbone Analysis

## Core idea

Fishbone (Ishikawa) analysis treats a problem as an "effect" fed by several
categories of potential cause — commonly people, process, tools/systems, and
environment or external factors. Rather than following one causal thread to
its root, it fans out across categories to check where contributing factors
might be hiding, then narrows in on the ones the input actually supports.

## Reasoning steps

1. State the effect (the problem) precisely, using the input's own
   description.
2. Set up cause categories relevant to the input's domain (e.g. People,
   Process, Tools/Systems, Environment/External) — adapt the category labels
   to fit the input rather than forcing an unrelated manufacturing template
   onto it.
3. For each category, scan the input for anything that plausibly contributes
   to the effect and place it there as an observation if the input states
   it, or an assumption if it's inferred.
4. Note any category where the input gives no signal at all — that's a gap
   in the input, not evidence that no cause exists there. Flag it as an open
   question rather than silently dropping the category.
5. Compare across categories to identify the few causes most strongly
   supported by the input and most likely to be driving the effect, rather
   than treating every populated branch as equally significant.

## What it tends to surface

Multiple, parallel contributing factors spread across different functional
areas — useful when a problem looks like it has more than one cause working
together rather than a single origin.

## Known blind spot

Fishbone analysis doesn't rank or sequence causes by time or dependency, so
it can produce a flat list of plausible factors without clarifying which one
to fix first, and it can imply causes are independent when they're actually
entangled with each other.
