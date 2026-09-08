"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../skills/rootboard/renderer/whiteboard/whiteboard-core.js");

function makeCard(overrides) {
  return Object.assign({
    id: "card",
    problem_statement: "Problem.",
    impact: "Impact.",
    proof_points: [],
    frameworks: [],
    position: { x: 0, y: 0 },
    convergence_note: "",
    created_by: "agent",
    tags: [],
    tension: false,
  }, overrides || {});
}

function createScheduler(eventLog) {
  let nextToken = 0;
  const jobs = new Map();
  const callbacks = new Map();
  const scheduled = [];
  const cancelled = [];
  const events = eventLog || [];

  return {
    schedule(callback, delayMs) {
      const token = nextToken;
      nextToken += 1;
      jobs.set(token, callback);
      callbacks.set(token, callback);
      scheduled.push({ token, delayMs });
      events.push(["schedule", token, delayMs]);
      return token;
    },
    cancelScheduled(token) {
      cancelled.push(token);
      jobs.delete(token);
      events.push(["cancel", token]);
    },
    fire(token) {
      const callback = jobs.get(token);
      if (!callback) return;
      jobs.delete(token);
      events.push(["fire", token]);
      callback();
    },
    jobs,
    callbacks,
    scheduled,
    cancelled,
    events,
  };
}

function makeMergeHoldHarness() {
  const events = [];
  const scheduler = createScheduler(events);
  const targetChanges = [];
  const completions = [];
  const controller = core.createMergeHoldController({
    schedule: scheduler.schedule,
    cancelScheduled: scheduler.cancelScheduled,
    onTargetChange(nextId, previousId) {
      targetChanges.push([nextId, previousId]);
      events.push(["target", nextId, previousId]);
    },
    onComplete(targetId) {
      completions.push(targetId);
      events.push(["complete", targetId]);
    },
  });

  return { controller, scheduler, targetChanges, completions, events };
}

const mergeSourceRect = { x: 10, y: 10, width: 10, height: 10 };

function mergeCandidate(id) {
  return {
    id,
    rect: { x: 0, y: 0, width: 100, height: 100 },
    order: 0,
  };
}

test("uses a deliberate 1.5 second merge hold", () => {
  assert.equal(core.MERGE_HOLD_MS, 1500);
});

test("selects the nearest card containing the dragged card center", () => {
  const target = core.selectMergeTarget(
    { x: 100, y: 100, width: 20, height: 20 },
    [
      { id: "wide", rect: { x: 0, y: 0, width: 300, height: 300 }, order: 0 },
      { id: "near", rect: { x: 90, y: 90, width: 80, height: 80 }, order: 1 },
    ]
  );
  assert.equal(target, "near");
});

test("uses paint order when target distances tie", () => {
  const target = core.selectMergeTarget(
    { x: 90, y: 90, width: 20, height: 20 },
    [
      { id: "under", rect: { x: 50, y: 50, width: 100, height: 100 }, order: 2 },
      { id: "over", rect: { x: 50, y: 50, width: 100, height: 100 }, order: 3 },
    ]
  );
  assert.equal(target, "over");
});

test("returns no target when the dragged center is outside candidates", () => {
  assert.equal(
    core.selectMergeTarget(
      { x: 0, y: 0, width: 20, height: 20 },
      [{ id: "far", rect: { x: 100, y: 100, width: 50, height: 50 }, order: 0 }]
    ),
    null
  );
});

test("treats a dragged center on a candidate edge as inside", () => {
  assert.equal(
    core.selectMergeTarget(
      { x: 90, y: 90, width: 20, height: 20 },
      [{ id: "edge", rect: { x: 100, y: 100, width: 50, height: 50 }, order: 0 }]
    ),
    "edge"
  );
});

test("starts one fixed-duration hold when a merge target is selected", () => {
  const harness = makeMergeHoldHarness();

  assert.equal(
    harness.controller.update(mergeSourceRect, [mergeCandidate("target-a")]),
    "target-a"
  );
  assert.deepEqual(harness.targetChanges, [["target-a", null]]);
  assert.deepEqual(harness.scheduler.scheduled, [{ token: 0, delayMs: 1500 }]);
  assert.deepEqual(Array.from(harness.scheduler.jobs.keys()), [0]);
});

test("keeps the existing hold timer while the merge target is unchanged", () => {
  const harness = makeMergeHoldHarness();
  const candidates = [mergeCandidate("target-a")];

  harness.controller.update(mergeSourceRect, candidates);
  harness.controller.update(mergeSourceRect, candidates);

  assert.deepEqual(harness.targetChanges, [["target-a", null]]);
  assert.deepEqual(harness.scheduler.scheduled, [{ token: 0, delayMs: 1500 }]);
  assert.deepEqual(harness.scheduler.cancelled, []);
  assert.deepEqual(Array.from(harness.scheduler.jobs.keys()), [0]);
});

test("restarts the hold after switching to a different merge target", () => {
  const harness = makeMergeHoldHarness();

  harness.controller.update(mergeSourceRect, [mergeCandidate("target-a")]);
  harness.controller.update(mergeSourceRect, [mergeCandidate("target-b")]);

  assert.deepEqual(harness.scheduler.cancelled, [0]);
  assert.deepEqual(harness.targetChanges, [
    ["target-a", null],
    ["target-b", "target-a"],
  ]);
  assert.deepEqual(harness.scheduler.scheduled, [
    { token: 0, delayMs: 1500 },
    { token: 1, delayMs: 1500 },
  ]);
  assert.deepEqual(Array.from(harness.scheduler.jobs.keys()), [1]);
});

test("clears a pending hold when the dragged card leaves all targets", () => {
  const harness = makeMergeHoldHarness();

  harness.controller.update(mergeSourceRect, [mergeCandidate("target-a")]);

  assert.equal(harness.controller.update(mergeSourceRect, []), null);
  assert.deepEqual(harness.scheduler.cancelled, [0]);
  assert.deepEqual(harness.targetChanges, [
    ["target-a", null],
    [null, "target-a"],
  ]);
  assert.equal(harness.scheduler.jobs.size, 0);
});

test("cancel clears the hold and permits a later update in the same drag", () => {
  const harness = makeMergeHoldHarness();

  harness.controller.update(mergeSourceRect, [mergeCandidate("target-a")]);
  harness.controller.cancel();

  assert.deepEqual(harness.scheduler.cancelled, [0]);
  assert.deepEqual(harness.targetChanges, [
    ["target-a", null],
    [null, "target-a"],
  ]);
  assert.equal(harness.scheduler.jobs.size, 0);

  assert.equal(
    harness.controller.update(mergeSourceRect, [mergeCandidate("target-b")]),
    "target-b"
  );
  assert.deepEqual(harness.scheduler.scheduled, [
    { token: 0, delayMs: 1500 },
    { token: 1, delayMs: 1500 },
  ]);
});

test("completes the current hold exactly once and then remains inert", () => {
  const harness = makeMergeHoldHarness();

  harness.controller.update(mergeSourceRect, [mergeCandidate("target-a")]);
  harness.scheduler.fire(0);

  assert.deepEqual(harness.targetChanges, [
    ["target-a", null],
    [null, "target-a"],
  ]);
  assert.deepEqual(harness.completions, ["target-a"]);
  assert.equal(harness.scheduler.jobs.size, 0);

  harness.scheduler.fire(0);
  assert.equal(
    harness.controller.update(mergeSourceRect, [mergeCandidate("target-b")]),
    null
  );
  assert.deepEqual(harness.completions, ["target-a"]);
  assert.equal(harness.scheduler.scheduled.length, 1);
});

test("dispose clears pending work and permanently disables the controller", () => {
  const harness = makeMergeHoldHarness();

  harness.controller.update(mergeSourceRect, [mergeCandidate("target-a")]);
  harness.controller.dispose();
  harness.controller.dispose();

  assert.deepEqual(harness.scheduler.cancelled, [0]);
  assert.deepEqual(harness.targetChanges, [
    ["target-a", null],
    [null, "target-a"],
  ]);
  assert.equal(harness.scheduler.jobs.size, 0);
  assert.equal(
    harness.controller.update(mergeSourceRect, [mergeCandidate("target-b")]),
    null
  );
  assert.equal(harness.scheduler.scheduled.length, 1);
  assert.deepEqual(harness.completions, []);
});

test("a reentrant target switch schedules and returns only the actual target", () => {
  const scheduler = createScheduler();
  const targetChanges = [];
  const completions = [];
  let controller;

  controller = core.createMergeHoldController({
    schedule: scheduler.schedule,
    cancelScheduled: scheduler.cancelScheduled,
    onTargetChange(nextId, previousId) {
      targetChanges.push([nextId, previousId]);
      if (nextId === "target-a") {
        controller.update(mergeSourceRect, [mergeCandidate("target-b")]);
      }
    },
    onComplete(targetId) {
      completions.push(targetId);
    },
  });

  assert.equal(
    controller.update(mergeSourceRect, [mergeCandidate("target-a")]),
    "target-b"
  );
  assert.deepEqual(targetChanges, [
    ["target-a", null],
    ["target-b", "target-a"],
  ]);
  assert.deepEqual(scheduler.scheduled, [{ token: 0, delayMs: 1500 }]);
  assert.deepEqual(Array.from(scheduler.jobs.keys()), [0]);

  scheduler.fire(0);
  assert.deepEqual(completions, ["target-b"]);
});

test("a reentrant cancel prevents the interrupted target from scheduling", () => {
  const scheduler = createScheduler();
  const targetChanges = [];
  let controller;

  controller = core.createMergeHoldController({
    schedule: scheduler.schedule,
    cancelScheduled: scheduler.cancelScheduled,
    onTargetChange(nextId, previousId) {
      targetChanges.push([nextId, previousId]);
      if (nextId === "target-a") controller.cancel();
    },
    onComplete() {},
  });

  assert.equal(
    controller.update(mergeSourceRect, [mergeCandidate("target-a")]),
    null
  );
  assert.deepEqual(targetChanges, [
    ["target-a", null],
    [null, "target-a"],
  ]);
  assert.deepEqual(scheduler.scheduled, []);
  assert.equal(scheduler.jobs.size, 0);
});

test("dispose is inert before its target-clear notification can reenter", () => {
  const scheduler = createScheduler();
  const targetChanges = [];
  let reentrantResult = "not-called";
  let controller;

  controller = core.createMergeHoldController({
    schedule: scheduler.schedule,
    cancelScheduled: scheduler.cancelScheduled,
    onTargetChange(nextId, previousId) {
      targetChanges.push([nextId, previousId]);
      if (nextId === null && previousId === "target-a") {
        reentrantResult = controller.update(
          mergeSourceRect,
          [mergeCandidate("target-b")]
        );
      }
    },
    onComplete() {},
  });

  controller.update(mergeSourceRect, [mergeCandidate("target-a")]);
  controller.dispose();

  assert.equal(reentrantResult, null);
  assert.deepEqual(targetChanges, [
    ["target-a", null],
    [null, "target-a"],
  ]);
  assert.deepEqual(scheduler.scheduled, [{ token: 0, delayMs: 1500 }]);
  assert.deepEqual(scheduler.cancelled, [0]);
  assert.equal(scheduler.jobs.size, 0);
  assert.equal(
    controller.update(mergeSourceRect, [mergeCandidate("target-c")]),
    null
  );
});

test("supports token zero through cancellation and completion", () => {
  const harness = makeMergeHoldHarness();

  harness.controller.update(mergeSourceRect, [mergeCandidate("target-a")]);
  harness.controller.cancel();
  harness.controller.update(mergeSourceRect, [mergeCandidate("target-b")]);
  harness.scheduler.fire(1);

  assert.deepEqual(harness.scheduler.cancelled, [0]);
  assert.deepEqual(harness.completions, ["target-b"]);
  assert.equal(harness.scheduler.jobs.size, 0);
});

test("ignores manually invoked stale and already-fired callbacks", () => {
  const harness = makeMergeHoldHarness();

  harness.controller.update(mergeSourceRect, [mergeCandidate("target-a")]);
  harness.controller.update(mergeSourceRect, [mergeCandidate("target-b")]);

  harness.scheduler.callbacks.get(0)();
  assert.deepEqual(harness.completions, []);

  harness.scheduler.fire(1);
  harness.scheduler.callbacks.get(1)();
  assert.deepEqual(harness.completions, ["target-b"]);
  assert.deepEqual(harness.targetChanges, [
    ["target-a", null],
    ["target-b", "target-a"],
    [null, "target-b"],
  ]);
});

test("orders cancellation and completion around target notifications", () => {
  const harness = makeMergeHoldHarness();

  harness.controller.update(mergeSourceRect, [mergeCandidate("target-a")]);
  harness.events.length = 0;
  harness.controller.update(mergeSourceRect, [mergeCandidate("target-b")]);

  assert.deepEqual(harness.events, [
    ["cancel", 0],
    ["target", "target-b", "target-a"],
    ["schedule", 1, 1500],
  ]);

  harness.events.length = 0;
  harness.scheduler.fire(1);
  assert.deepEqual(harness.events, [
    ["fire", 1],
    ["target", null, "target-b"],
    ["complete", "target-b"],
  ]);
});

test("drafts one transparent statement from target then source", () => {
  assert.equal(
    core.combineProblemStatements(
      "Ownership is unclear.",
      "Teams wait days for an owner."
    ),
    "Ownership is unclear; Teams wait days for an owner."
  );
});

test("deduplicates normalized statements and handles blanks", () => {
  assert.equal(
    core.combineProblemStatements(" Setup   is confusing! ", "setup is confusing"),
    "Setup is confusing!"
  );
  assert.equal(core.combineProblemStatements("", "Handoffs are slow."), "Handoffs are slow.");
  assert.equal(core.combineProblemStatements("", ""), "Untitled problem");
});

test("normalizes target join punctuation and completes source punctuation", () => {
  assert.equal(
    core.combineProblemStatements("Ownership is unclear:", "Handoffs are slow"),
    "Ownership is unclear; Handoffs are slow."
  );
  assert.equal(
    core.combineProblemStatements("Ownership is unclear;", "Why do handoffs stall?"),
    "Ownership is unclear; Why do handoffs stall?"
  );
});

test("merges editable card content in target then source order", () => {
  const merged = core.mergeCards(
    makeCard({
      id: "target",
      problem_statement: "Ownership is unclear.",
      impact: " Work   stalls. ",
      proof_points: [
        "Ticket waited 5 days.",
        " Same   evidence  ",
        "Evidence.",
        "   ",
      ],
      position: { x: 400, y: 220 },
      tags: [" Ownership ", "Workflow"],
    }),
    makeCard({
      id: "source",
      problem_statement: "Handoffs are slow.",
      impact: " Teams wait for decisions. ",
      proof_points: [
        "same evidence",
        " evidence ",
        "Three teams were blocked.",
      ],
      position: { x: 20, y: 10 },
      tags: ["ownership", " Handoffs "],
    }),
    "merged-1"
  );

  assert.deepEqual(merged, {
    id: "merged-1",
    problem_statement: "Ownership is unclear; Handoffs are slow.",
    impact: "Work   stalls. Teams wait for decisions.",
    proof_points: [
      "Ticket waited 5 days.",
      "Same   evidence",
      "Evidence.",
      "evidence",
      "Three teams were blocked.",
    ],
    frameworks: [],
    position: { x: 400, y: 220 },
    convergence_note: "",
    created_by: "user",
    tags: ["Ownership", "Workflow", "Handoffs"],
    tension: false,
  });
});

test("keeps target impact wording when normalized impacts match", () => {
  const merged = core.mergeCards(
    makeCard({ impact: "  Work   stalls!  " }),
    makeCard({ impact: "work stalls" }),
    "merged-1"
  );

  assert.equal(merged.impact, "Work   stalls!");
});

test("retains distinct frameworks in target then source order", () => {
  const targetFramework = {
    name: "Target lens",
    proof_points: ["Target proof"],
    confidence: "high",
  };
  const sourceFramework = {
    name: "Source lens",
    proof_points: ["Source proof"],
    confidence: "low",
  };
  const merged = core.mergeCards(
    makeCard({ frameworks: [targetFramework] }),
    makeCard({ frameworks: [sourceFramework] }),
    "merged-1"
  );

  assert.deepEqual(merged.frameworks, [targetFramework, sourceFramework]);
  assert.notStrictEqual(merged.frameworks[0], targetFramework);
  assert.notStrictEqual(merged.frameworks[0].proof_points, targetFramework.proof_points);
  assert.notStrictEqual(merged.frameworks[1], sourceFramework);
  assert.notStrictEqual(merged.frameworks[1].proof_points, sourceFramework.proof_points);
});

test("matches normalized framework names and combines explicit proof arrays", () => {
  const merged = core.mergeCards(
    makeCard({
      frameworks: [{
        name: "Jobs   to be Done",
        proof_points: [" First ", " Shared   fact ", "", "Evidence."],
        confidence: "high",
      }],
    }),
    makeCard({
      frameworks: [{
        name: " jobs to BE done ",
        proof_points: ["shared fact", " evidence ", " Second "],
        confidence: "low",
      }],
    }),
    "merged-1"
  );

  assert.deepEqual(merged.frameworks, [{
    name: "Jobs   to be Done",
    proof_points: ["First", "Shared   fact", "Evidence.", "evidence", "Second"],
    confidence: "high",
  }]);
});

test("normalizes whichever single explicit framework proof array is present", () => {
  const targetOnly = core.mergeCards(
    makeCard({
      frameworks: [{
        name: "Lens",
        proof_points: [" Target ", "target", "  "],
        confidence: null,
      }],
    }),
    makeCard({
      frameworks: [{ name: "lens", proof_points: null, confidence: null }],
    }),
    "target-only"
  );
  const sourceOnly = core.mergeCards(
    makeCard({
      frameworks: [{ name: "Lens", proof_points: null, confidence: null }],
    }),
    makeCard({
      frameworks: [{
        name: "lens",
        proof_points: [" Source   proof ", "source proof", ""],
        confidence: null,
      }],
    }),
    "source-only"
  );

  assert.deepEqual(targetOnly.frameworks[0].proof_points, ["Target"]);
  assert.deepEqual(sourceOnly.frameworks[0].proof_points, ["Source   proof"]);
});

test("keeps null framework proof points when neither side has an explicit array", () => {
  const merged = core.mergeCards(
    makeCard({
      frameworks: [{ name: "Lens", proof_points: null, confidence: null }],
    }),
    makeCard({
      frameworks: [{ name: "lens", proof_points: null, confidence: null }],
    }),
    "merged-1"
  );

  assert.equal(merged.frameworks[0].proof_points, null);
});

test("uses target framework confidence, then source confidence, then null", () => {
  function mergeConfidence(targetConfidence, sourceConfidence) {
    return core.mergeCards(
      makeCard({
        frameworks: [{
          name: "Lens",
          proof_points: null,
          confidence: targetConfidence,
        }],
      }),
      makeCard({
        frameworks: [{
          name: "lens",
          proof_points: null,
          confidence: sourceConfidence,
        }],
      }),
      "merged-1"
    ).frameworks[0].confidence;
  }

  assert.equal(mergeConfidence("high", "low"), "high");
  assert.equal(mergeConfidence(null, "medium"), "medium");
  assert.equal(mergeConfidence(null, null), null);
});

test("deduplicates or joins convergence notes without rewriting display whitespace", () => {
  const duplicate = core.mergeCards(
    makeCard({ convergence_note: "  Same   note!  " }),
    makeCard({ convergence_note: "same note" }),
    "duplicate"
  );
  const distinct = core.mergeCards(
    makeCard({ convergence_note: " First   note. " }),
    makeCard({ convergence_note: " Second note. " }),
    "distinct"
  );
  const oneBlank = core.mergeCards(
    makeCard({ convergence_note: "  " }),
    makeCard({ convergence_note: " Source   note. " }),
    "one-blank"
  );

  assert.equal(duplicate.convergence_note, "Same   note!");
  assert.equal(distinct.convergence_note, "First   note. Second note.");
  assert.equal(oneBlank.convergence_note, "Source   note.");
});

test("sets tension when either input is tense", () => {
  assert.equal(
    core.mergeCards(makeCard({ tension: true }), makeCard(), "target-tense").tension,
    true
  );
  assert.equal(
    core.mergeCards(makeCard(), makeCard({ tension: true }), "source-tense").tension,
    true
  );
  assert.equal(
    core.mergeCards(makeCard(), makeCard(), "neither-tense").tension,
    false
  );
});

test("does not mutate inputs and allocates new nested merge data", () => {
  const target = makeCard({
    proof_points: ["Target proof"],
    frameworks: [{
      name: "Target lens",
      proof_points: ["Nested target proof"],
      confidence: "high",
    }],
    position: { x: 5, y: 8 },
    tags: ["Target"],
  });
  const source = makeCard({
    proof_points: ["Source proof"],
    frameworks: [{
      name: "Source lens",
      proof_points: ["Nested source proof"],
      confidence: "low",
    }],
    position: { x: 13, y: 21 },
    tags: ["Source"],
  });
  const targetBefore = structuredClone(target);
  const sourceBefore = structuredClone(source);

  const merged = core.mergeCards(target, source, "merged-1");

  assert.deepEqual(target, targetBefore);
  assert.deepEqual(source, sourceBefore);
  assert.notStrictEqual(merged.proof_points, target.proof_points);
  assert.notStrictEqual(merged.proof_points, source.proof_points);
  assert.notStrictEqual(merged.frameworks, target.frameworks);
  assert.notStrictEqual(merged.frameworks, source.frameworks);
  assert.notStrictEqual(merged.frameworks[0], target.frameworks[0]);
  assert.notStrictEqual(merged.frameworks[0].proof_points, target.frameworks[0].proof_points);
  assert.notStrictEqual(merged.frameworks[1], source.frameworks[0]);
  assert.notStrictEqual(merged.frameworks[1].proof_points, source.frameworks[0].proof_points);
  assert.notStrictEqual(merged.position, target.position);
  assert.notStrictEqual(merged.tags, target.tags);
  assert.notStrictEqual(merged.tags, source.tags);
});
