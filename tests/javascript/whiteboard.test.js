"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var test = require("node:test");

var RUNTIME_DIR = path.join(
  __dirname,
  "../../skills/rootboard/renderer/whiteboard"
);

function runtimePath(filename) {
  return path.join(RUNTIME_DIR, filename);
}

function FakeElement(tag) {
  var self = this;

  this.tagName = String(tag).toUpperCase();
  this.children = [];
  this.parentNode = null;
  this.style = {
    _customProperties: Object.create(null),
    setProperty: function (name, value) {
      this._customProperties[name] = String(value);
    },
    getPropertyValue: function (name) {
      return this._customProperties[name] || "";
    },
  };
  this.attributes = Object.create(null);
  this.className = "";
  this._innerHTML = "";
  this._textContent = "";
  this._listeners = Object.create(null);
  this._capturedPointers = Object.create(null);
  this.classList = {
    add: function (className) {
      var classes = self.className.split(/\s+/).filter(Boolean);
      if (classes.indexOf(className) === -1) classes.push(className);
      self.className = classes.join(" ");
    },
    remove: function (className) {
      self.className = self.className
        .split(/\s+/)
        .filter(function (candidate) {
          return candidate && candidate !== className;
        })
        .join(" ");
    },
    contains: function (className) {
      return self.className.split(/\s+/).indexOf(className) !== -1;
    },
    toggle: function (className, force) {
      var shouldAdd = force === undefined ? !this.contains(className) : !!force;
      if (shouldAdd) this.add(className);
      else this.remove(className);
      return shouldAdd;
    },
  };
}

Object.defineProperty(FakeElement.prototype, "innerHTML", {
  get: function () {
    return this._innerHTML;
  },
  set: function (value) {
    this._innerHTML = String(value);
    this.children = [];
  },
});

Object.defineProperty(FakeElement.prototype, "textContent", {
  get: function () {
    return this._textContent;
  },
  set: function (value) {
    this._textContent = String(value);
    this.children = [];
  },
});

FakeElement.prototype.appendChild = function (child) {
  child.parentNode = this;
  this.children.push(child);
  return child;
};

FakeElement.prototype.setAttribute = function (name, value) {
  this.attributes[name] = String(value);
};

FakeElement.prototype.getAttribute = function (name) {
  return this.hasAttribute(name) ? this.attributes[name] : null;
};

FakeElement.prototype.hasAttribute = function (name) {
  return Object.prototype.hasOwnProperty.call(this.attributes, name);
};

FakeElement.prototype.removeAttribute = function (name) {
  delete this.attributes[name];
};

FakeElement.prototype.addEventListener = function (type, listener) {
  if (!this._listeners[type]) this._listeners[type] = [];
  this._listeners[type].push(listener);
};

FakeElement.prototype.removeEventListener = function (type, listener) {
  this._listeners[type] = (this._listeners[type] || []).filter(function (candidate) {
    return candidate !== listener;
  });
};

FakeElement.prototype.listenerCount = function (type) {
  return (this._listeners[type] || []).length;
};

FakeElement.prototype.dispatch = function (type, event) {
  var dispatchedEvent = event || {};
  var listeners = this._listeners[type] || [];
  if (!dispatchedEvent.target) dispatchedEvent.target = this;
  dispatchedEvent.currentTarget = this;
  listeners.forEach(function (listener) {
    listener(dispatchedEvent);
  });
};

FakeElement.prototype.setPointerCapture = function (pointerId) {
  this._capturedPointers[pointerId] = true;
};

FakeElement.prototype.releasePointerCapture = function (pointerId) {
  if (!this._capturedPointers[pointerId]) return;
  delete this._capturedPointers[pointerId];
  this.dispatch("lostpointercapture", {
    target: this,
    pointerId: pointerId,
  });
};

FakeElement.prototype.hasPointerCapture = function (pointerId) {
  return !!this._capturedPointers[pointerId];
};

FakeElement.prototype.focus = function () {
  document.activeElement = this;
};

FakeElement.prototype.querySelectorAll = function (selector) {
  var matches = [];
  var className = selector.charAt(0) === "." ? selector.slice(1) : null;

  this.children.forEach(function visit(child) {
    if (className && child.classList.contains(className)) matches.push(child);
    child.children.forEach(visit);
  });
  return matches;
};

FakeElement.prototype.getBoundingClientRect = function () {
  var left = parseFloat(this.style.left) || 0;
  var top = parseFloat(this.style.top) || 0;
  var width = this.classList.contains("card") ? 220 : 0;
  var height = this.classList.contains("card") ? 230 : 0;

  return {
    x: left,
    y: top,
    left: left,
    top: top,
    right: left + width,
    bottom: top + height,
    width: width,
    height: height,
  };
};

function createEventTarget(properties) {
  var target = properties || {};
  var listeners = Object.create(null);

  target.addEventListener = function (type, listener) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(listener);
  };
  target.removeEventListener = function (type, listener) {
    listeners[type] = (listeners[type] || []).filter(function (candidate) {
      return candidate !== listener;
    });
  };
  target.listenerCount = function (type) {
    return (listeners[type] || []).length;
  };
  target.dispatch = function (type, event) {
    var dispatchedEvent = event || {};
    if (!dispatchedEvent.target) dispatchedEvent.target = target;
    dispatchedEvent.currentTarget = target;
    (listeners[type] || []).slice().forEach(function (listener) {
      listener(dispatchedEvent);
    });
  };
  return target;
}

function createScheduler() {
  var nextToken = 1;
  var jobs = Object.create(null);
  var callbacks = Object.create(null);

  return {
    setTimeout: function (callback, delayMs) {
      var token = nextToken++;
      jobs[token] = { callback: callback, delayMs: delayMs };
      callbacks[token] = callback;
      return token;
    },
    clearTimeout: function (token) {
      delete jobs[token];
    },
    jobsByDelay: function (delayMs) {
      return Object.keys(jobs)
        .filter(function (token) {
          return jobs[token].delayMs === delayMs;
        })
        .map(Number);
    },
    fire: function (token) {
      var callback = callbacks[token];
      if (!callback) return;
      delete jobs[token];
      callback();
    },
    pendingCount: function () {
      return Object.keys(jobs).length;
    },
  };
}

function createBoardEnvironment(scheduler, options) {
  var clock = scheduler || createScheduler();
  var core = require(runtimePath("whiteboard-core.js"));
  var mergeCompletions = [];
  var reducedMotion = !options || options.reducedMotion !== false;
  var selection = {
    ranges: [],
    removeAllRangesCalls: 0,
    addRangeCalls: 0,
    removeAllRanges: function () {
      this.removeAllRangesCalls += 1;
      this.ranges = [];
    },
    addRange: function (range) {
      this.addRangeCalls += 1;
      this.ranges.push(range);
    },
  };
  var createdRanges = [];
  global.window = createEventTarget({
    ProblemBoardCore: Object.assign({}, core, {
      createMergeHoldController: function (options) {
        var observedOptions = Object.assign({}, options);
        var onComplete = observedOptions.onComplete;

        observedOptions.onComplete = function (targetId) {
          mergeCompletions.push(targetId);
          onComplete(targetId);
        };
        return core.createMergeHoldController(observedOptions);
      },
    }),
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    matchMedia: function (query) {
      return {
        media: query,
        matches:
          query === "(prefers-reduced-motion: reduce)" && reducedMotion,
      };
    },
    getSelection: function () {
      return selection;
    },
  });
  global.document = createEventTarget({
    hidden: false,
    activeElement: null,
    createElement: function (tag) {
      return new FakeElement(tag);
    },
    createRange: function () {
      var range = {
        selectedNode: null,
        selectNodeContents: function (node) {
          this.selectedNode = node;
        },
      };
      createdRanges.push(range);
      return range;
    },
  });

  delete require.cache[require.resolve(runtimePath("whiteboard.js"))];
  require(runtimePath("whiteboard.js"));

  return {
    scheduler: clock,
    mergeCompletions: mergeCompletions,
    selection: selection,
    createdRanges: createdRanges,
  };
}

function mountBoard(cards, scheduler, options) {
  var environment = createBoardEnvironment(scheduler, options);

  var root = new FakeElement("div");
  var board = window.ProblemBoard.mount(
    { board_title: "Test", cards: cards || [] },
    root
  );
  return {
    board: board,
    root: root,
    scheduler: environment.scheduler,
    mergeCompletions: environment.mergeCompletions,
    selection: environment.selection,
    createdRanges: environment.createdRanges,
  };
}

function problemCard(id, x, y) {
  return {
    id: id,
    problem_statement: id,
    impact: "",
    position: { x: x, y: y },
  };
}

function pointerEvent(target, pointerId, clientX, clientY) {
  return {
    target: target,
    pointerId: pointerId,
    clientX: clientX,
    clientY: clientY,
  };
}

function movePointerOntoCard(board, source, targetId, pointerId, offsetX, offsetY) {
  var targetPosition = board._findCard(targetId).position;
  source.dispatch(
    "pointermove",
    pointerEvent(
      source,
      pointerId,
      targetPosition.x + (offsetX || 0),
      targetPosition.y + (offsetY || 0)
    )
  );
  return Object.assign({}, targetPosition);
}

function findByClass(root, className) {
  if (root.className.split(/\s+/).indexOf(className) !== -1) return root;
  for (var i = 0; i < root.children.length; i++) {
    var match = findByClass(root.children[i], className);
    if (match) return match;
  }
  return null;
}

function findByAction(root, action) {
  if (root.getAttribute("data-action") === action) return root;
  for (var i = 0; i < root.children.length; i++) {
    var match = findByAction(root.children[i], action);
    if (match) return match;
  }
  return null;
}

function findText(root, text) {
  if (root.textContent.indexOf(text) !== -1) return true;
  for (var i = 0; i < root.children.length; i++) {
    if (findText(root.children[i], text)) return true;
  }
  return false;
}

function actionIds(root) {
  var ids = [];
  var action = root.getAttribute("data-action");
  if (action !== null) ids.push(action);
  root.children.forEach(function (child) {
    ids = ids.concat(actionIds(child));
  });
  return ids;
}

function startPendingMergeDrag() {
  var mounted = mountBoard([
    problemCard("source", 0, 0),
    problemCard("target", 260, 0),
  ]);
  var board = mounted.board;
  var source = board.cardEls.source;
  var target = board.cardEls.target;
  var targetPosition = Object.assign({}, board._findCard("target").position);

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  source.dispatch(
    "pointermove",
    pointerEvent(source, 1, targetPosition.x, targetPosition.y)
  );

  var tokens = mounted.scheduler.jobsByDelay(1500);
  assert.equal(tokens.length, 1);
  assert.equal(target.classList.contains("merge-target"), true);
  assert.equal(source.hasPointerCapture(1), true);
  assert.deepEqual(board._findCard("source").position, targetPosition);

  return {
    mounted: mounted,
    source: source,
    target: target,
    targetPosition: targetPosition,
    staleToken: tokens[0],
  };
}

function startNormalMergeCompletion() {
  var mounted = mountBoard(
    [problemCard("source", 0, 0), problemCard("target", 260, 0)],
    null,
    { reducedMotion: false }
  );
  var board = mounted.board;
  var source = board.cardEls.source;
  var target = board.cardEls.target;
  var targetPosition = Object.assign({}, board._findCard("target").position);

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  source.dispatch(
    "pointermove",
    pointerEvent(source, 1, targetPosition.x + 40, targetPosition.y + 40)
  );

  var holdToken = mounted.scheduler.jobsByDelay(1500)[0];
  assert.notEqual(holdToken, undefined);
  mounted.scheduler.fire(holdToken);

  var completionTokens = mounted.scheduler.jobsByDelay(200);
  assert.equal(completionTokens.length, 1);
  assert.equal(board.cards.length, 2);
  assert.notEqual(board.mergeCompletion, null);

  return {
    mounted: mounted,
    source: source,
    target: target,
    targetPosition: targetPosition,
    holdToken: holdToken,
    completionToken: completionTokens[0],
  };
}

function assertNormalMergeCompletionCancelled(fixture, expectedIds) {
  var board = fixture.mounted.board;
  var cardsAfterCancellation = JSON.parse(JSON.stringify(board.cards));

  assert.equal(fixture.mounted.scheduler.pendingCount(), 0);
  assert.equal(board.mergeCompletion, null);
  assert.equal(board.activeDrag, null);
  assert.equal(fixture.source.hasPointerCapture(1), false);
  assert.equal(
    fixture.source.classList.contains("merge-source-completing"),
    false
  );
  assert.equal(
    fixture.target.classList.contains("merge-target-completing"),
    false
  );
  assert.equal(fixture.mounted.root.querySelectorAll(".merge-target").length, 0);
  assert.equal(
    fixture.mounted.root.querySelectorAll(".merge-source-completing").length,
    0
  );
  assert.equal(
    fixture.mounted.root.querySelectorAll(".merge-target-completing").length,
    0
  );
  assert.deepEqual(
    board.cards.map(function (card) {
      return card.id;
    }),
    expectedIds
  );

  fixture.mounted.scheduler.fire(fixture.holdToken);
  fixture.mounted.scheduler.fire(fixture.completionToken);

  assert.equal(fixture.mounted.scheduler.pendingCount(), 0);
  assert.equal(board.mergeCompletion, null);
  assert.deepEqual(fixture.mounted.mergeCompletions, ["target"]);
  assert.deepEqual(board.cards, cardsAfterCancellation);
}

function assertPendingMergeDragCancelled(fixture) {
  var mounted = fixture.mounted;
  var board = mounted.board;
  var cardsBeforeStaleTimer = JSON.parse(JSON.stringify(board.cards));

  assert.equal(mounted.scheduler.pendingCount(), 0);
  assert.equal(fixture.target.classList.contains("merge-target"), false);
  assert.equal(mounted.root.querySelectorAll(".merge-target").length, 0);
  assert.equal(fixture.source.hasPointerCapture(1), false);
  assert.equal(fixture.source.classList.contains("dragging"), false);
  assert.equal(board.activeDrag, null);
  assert.deepEqual(board._findCard("source").position, fixture.targetPosition);

  mounted.scheduler.fire(fixture.staleToken);

  assert.equal(mounted.scheduler.pendingCount(), 0);
  assert.deepEqual(mounted.mergeCompletions, []);
  assert.deepEqual(board.cards, cardsBeforeStaleTimer);
  assert.equal(board.mergeCompletion, null);
  assert.equal(mounted.root.querySelectorAll(".merge-target").length, 0);
}

test("puts Add before the compact board controls and creates a blank card", function () {
  var mounted = mountBoard([]);
  var root = mounted.root;
  var board = mounted.board;
  var toolbar = findByClass(root, "board-toolbar");
  var sidePanel = findByClass(root, "side-panel");
  var add = findByAction(sidePanel, "add");
  var textLabel = findByAction(sidePanel, "text");
  var zones = findByAction(sidePanel, "zones");
  var focus = findByAction(sidePanel, "focus");

  assert.deepEqual(actionIds(toolbar), []);
  assert.deepEqual(actionIds(sidePanel), ["add", "text", "zones", "focus"]);
  assert.equal(add.tagName, "BUTTON");
  assert.equal(textLabel.tagName, "BUTTON");
  assert.equal(zones.tagName, "BUTTON");
  assert.equal(focus.tagName, "BUTTON");
  assert.equal(sidePanel.children[0], add);
  assert.equal(sidePanel.children[1], textLabel);
  assert.equal(
    sidePanel.children[2].classList.contains("side-panel-divider"),
    true
  );
  assert.equal(sidePanel.children[3], zones);
  assert.equal(sidePanel.children[4], focus);
  assert.equal(findText(toolbar, "Add card"), false);
  assert.equal(findText(toolbar, "Merge cards"), false);
  assert.equal(findByClass(toolbar, "board-hint"), null);

  assert.equal(add.getAttribute("title"), null);
  assert.equal(add.getAttribute("aria-label"), "Add problem card");
  assert.equal(add.getAttribute("data-tooltip"), "Add problem card");
  assert.equal(textLabel.getAttribute("title"), null);
  assert.equal(textLabel.getAttribute("aria-label"), "Add text label");
  assert.equal(textLabel.getAttribute("data-tooltip"), "Add text label (T)");
  assert.equal(zones.getAttribute("title"), null);
  assert.equal(zones.getAttribute("aria-label"), "Toggle theme zones");
  assert.equal(focus.getAttribute("title"), null);
  assert.equal(focus.getAttribute("aria-label"), "Focus cards");
  assert.equal(zones.getAttribute("aria-pressed"), "true");

  zones.dispatch("click", { target: zones, stopPropagation: function () {} });
  assert.equal(zones.getAttribute("aria-pressed"), "false");

  add.dispatch("click", { target: add, stopPropagation: function () {} });
  assert.equal(board.cards.length, 1);
  assert.deepEqual(
    {
      problem_statement: board.cards[0].problem_statement,
      impact: board.cards[0].impact,
      proof_points: board.cards[0].proof_points,
      frameworks: board.cards[0].frameworks,
      tags: board.cards[0].tags,
      created_by: board.cards[0].created_by,
    },
    {
      problem_statement: "New problem",
      impact: "",
      proof_points: [],
      frameworks: [],
      tags: [],
      created_by: "user",
    }
  );

  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");
  assert.match(css, /\.side-panel-btn:focus-visible/);
  assert.match(css, /\.side-panel-btn\[data-action="add"\]/);
  assert.ok(
    css.indexOf('.side-panel-btn[data-action="add"]') >
      css.lastIndexOf(".side-panel-btn:hover"),
    "Add accent rule must follow the generic hover rules"
  );
  assert.match(
    css,
    /@media \(prefers-color-scheme: dark\) \{\s*\.side-panel-btn\[data-action="add"\] \{\s*color: #1f1f1f;\s*\}\s*\}/,
    "dark mode must give the blue Add button a dark foreground"
  );
});

test("waits for six pixels before activating a drag", function () {
  var mounted = mountBoard([
    problemCard("source", 0, 0),
    problemCard("target", 500, 0),
  ]);
  var board = mounted.board;
  var source = board.cardEls.source;

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  source.dispatch("pointermove", pointerEvent(source, 1, 5.9, 0));

  assert.deepEqual(board.cards[0].position, { x: 0, y: 0 });
  assert.equal(mounted.scheduler.pendingCount(), 0);

  source.dispatch("pointermove", pointerEvent(source, 1, 6, 0));

  assert.deepEqual(board.cards[0].position, { x: 6, y: 0 });
  assert.equal(source.classList.contains("dragging"), true);
});

test("only the active pointer can move or end a drag", function () {
  var mounted = mountBoard([
    problemCard("source", 0, 0),
    problemCard("target", 500, 0),
  ]);
  var board = mounted.board;
  var source = board.cardEls.source;
  var target = board.cardEls.target;

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  source.dispatch("pointermove", pointerEvent(source, 1, 6, 0));
  assert.deepEqual(board.cards[0].position, { x: 6, y: 0 });

  target.dispatch("pointerdown", pointerEvent(target, 2, 50, 50));
  source.dispatch("pointermove", pointerEvent(source, 2, 100, 0));
  target.dispatch("pointerup", pointerEvent(target, 2, 100, 0));
  source.dispatch("pointercancel", pointerEvent(source, 2, 100, 0));
  source.dispatch("lostpointercapture", pointerEvent(source, 2, 100, 0));

  assert.equal(board.activeDrag.pointerId, 1);
  assert.deepEqual(board.cards[0].position, { x: 6, y: 0 });
  assert.equal(source.classList.contains("dragging"), true);
  assert.equal(source.hasPointerCapture(1), true);
  assert.equal(target.hasPointerCapture(2), false);

  source.dispatch("pointermove", pointerEvent(source, 1, 10, 0));
  assert.deepEqual(board.cards[0].position, { x: 10, y: 0 });

  source.dispatch("pointerup", pointerEvent(source, 1, 10, 0));
  assert.equal(board.activeDrag, null);
  assert.equal(source.classList.contains("dragging"), false);
  assert.equal(source.hasPointerCapture(1), false);
});

test("renders one merge progress ring inside every sticky note", function () {
  var mounted = mountBoard([
    problemCard("source", 0, 0),
    problemCard("target", 260, 0),
  ]);

  ["source", "target"].forEach(function (id) {
    var sticky = findByClass(mounted.board.cardEls[id], "sticky");
    assert.equal(sticky.querySelectorAll(".merge-progress-ring").length, 1);
  });
});

test("shows one stable merge hold while the source stays on a target", function () {
  var mounted = mountBoard([
    problemCard("source", 0, 0),
    problemCard("target", 260, 0),
  ]);
  var board = mounted.board;
  var source = board.cardEls.source;
  var target = board.cardEls.target;
  var targetPosition = Object.assign({}, board._findCard("target").position);

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  source.dispatch(
    "pointermove",
    pointerEvent(source, 1, targetPosition.x, targetPosition.y)
  );

  var firstTimers = mounted.scheduler.jobsByDelay(1500);
  assert.equal(firstTimers.length, 1);
  assert.equal(target.classList.contains("merge-target"), true);
  assert.equal(target.querySelectorAll(".merge-progress-ring").length, 1);

  source.dispatch(
    "pointermove",
    pointerEvent(source, 1, targetPosition.x + 1, targetPosition.y)
  );

  assert.deepEqual(mounted.scheduler.jobsByDelay(1500), firstTimers);
  assert.equal(target.classList.contains("merge-target"), true);

  source.dispatch(
    "pointerup",
    pointerEvent(source, 1, targetPosition.x + 1, targetPosition.y)
  );
  assert.equal(mounted.scheduler.pendingCount(), 0);
  assert.equal(target.classList.contains("merge-target"), false);
  assert.equal(board.activeDrag, null);
  assert.equal(source.hasPointerCapture(1), false);
});

test("reduced motion completes a held merge once and focuses the merged statement", function () {
  var sourceCard = {
    id: "source",
    problem_statement: "Source checkout stalls",
    impact: "Source revenue loss",
    proof_points: ["Source quote", " shared proof "],
    frameworks: [
      {
        name: " jobs to be done ",
        proof_points: ["Source survey", "target interview"],
        confidence: "low",
      },
      {
        name: "Service Blueprint",
        proof_points: ["Source blueprint"],
        confidence: "medium",
      },
    ],
    position: { x: 0, y: 0 },
    convergence_note: "Source note.",
    created_by: "agent",
    tags: ["Checkout", " Shared "],
    tension: true,
  };
  var targetCard = {
    id: "target",
    problem_statement: "Target onboarding fails.",
    impact: "Target churn",
    proof_points: ["Target metric", "Shared proof"],
    frameworks: [
      {
        name: "Jobs to Be Done",
        proof_points: ["Target interview"],
        confidence: "high",
      },
      {
        name: "Five Whys",
        proof_points: null,
        confidence: "medium",
      },
    ],
    position: { x: 310, y: 80 },
    convergence_note: "Target note.",
    created_by: "agent",
    tags: ["Onboarding", "shared"],
    tension: false,
  };
  var mounted = mountBoard([sourceCard, targetCard], null, {
    reducedMotion: true,
  });
  var board = mounted.board;
  var source = board.cardEls.source;
  var target = board.cardEls.target;

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  source.dispatch("pointermove", pointerEvent(source, 1, 310, 80));

  var holdToken = mounted.scheduler.jobsByDelay(1500)[0];
  assert.notEqual(holdToken, undefined);
  assert.equal(target.classList.contains("merge-target"), true);

  mounted.scheduler.fire(holdToken);

  assert.equal(board.cards.length, 1);
  var merged = board.cards[0];
  assert.notEqual(merged.id, "source");
  assert.notEqual(merged.id, "target");
  assert.equal(board._findCard("source"), null);
  assert.equal(board._findCard("target"), null);
  assert.deepEqual(
    {
      problem_statement: merged.problem_statement,
      impact: merged.impact,
      proof_points: merged.proof_points,
      frameworks: merged.frameworks,
      position: merged.position,
      convergence_note: merged.convergence_note,
      created_by: merged.created_by,
      tags: merged.tags,
      tension: merged.tension,
    },
    {
      problem_statement:
        "Target onboarding fails; Source checkout stalls.",
      impact: "Target churn Source revenue loss",
      proof_points: ["Target metric", "Shared proof", "Source quote"],
      frameworks: [
        {
          name: "Jobs to Be Done",
          proof_points: ["Target interview", "Source survey"],
          confidence: "high",
        },
        {
          name: "Five Whys",
          proof_points: null,
          confidence: "medium",
        },
        {
          name: "Service Blueprint",
          proof_points: ["Source blueprint"],
          confidence: "medium",
        },
      ],
      position: { x: 310, y: 80 },
      convergence_note: "Target note. Source note.",
      created_by: "user",
      tags: ["Onboarding", "shared", "Checkout"],
      tension: true,
    }
  );
  assert.deepEqual(Object.keys(board.cardEls), [merged.id]);
  assert.deepEqual(mounted.mergeCompletions, ["target"]);
  assert.equal(board.activeDrag, null);
  assert.equal(board.mergeCompletion, null);
  assert.equal(source.hasPointerCapture(1), false);
  assert.equal(mounted.scheduler.pendingCount(), 0);

  var statement = board.statementEls[merged.id];
  assert.equal(document.activeElement, statement);
  assert.equal(mounted.createdRanges.length, 1);
  assert.equal(mounted.createdRanges[0].selectedNode, statement);
  assert.equal(mounted.selection.removeAllRangesCalls, 1);
  assert.equal(mounted.selection.addRangeCalls, 1);
  assert.deepEqual(mounted.selection.ranges, [mounted.createdRanges[0]]);

  var cardsAfterMerge = JSON.parse(JSON.stringify(board.cards));
  mounted.scheduler.fire(holdToken);
  assert.deepEqual(board.cards, cardsAfterMerge);
  assert.deepEqual(mounted.mergeCompletions, ["target"]);
  assert.equal(mounted.selection.removeAllRangesCalls, 1);
  assert.equal(mounted.selection.addRangeCalls, 1);

  source.dispatch("pointerdown", pointerEvent(source, 9, 0, 0));
  source.dispatch("pointermove", pointerEvent(source, 9, 500, 500));
  source.dispatch("pointerup", pointerEvent(source, 9, 500, 500));
  source.dispatch("pointercancel", pointerEvent(source, 9, 500, 500));

  assert.equal(board.activeDrag, null);
  assert.equal(source.hasPointerCapture(9), false);
  assert.equal(mounted.scheduler.pendingCount(), 0);
  assert.deepEqual(board.cards, cardsAfterMerge);
});

test("merge completion chooses a unique id when generated entropy collides", function () {
  var originalNow = Date.now;
  var originalRandom = Math.random;
  var fixedNow = 123456789;
  var fixedRandom = 0.125;
  var collidingId =
    "card-" +
    fixedNow.toString(36) +
    "-" +
    fixedRandom.toString(36).slice(2, 6);

  Date.now = function () {
    return fixedNow;
  };
  Math.random = function () {
    return fixedRandom;
  };

  try {
    var mounted = mountBoard(
      [
        problemCard("source", 0, 0),
        problemCard("target", 260, 0),
        {
          id: collidingId,
          problem_statement: "Unrelated survivor",
          impact: "Must remain untouched",
          proof_points: ["Independent evidence"],
          frameworks: [],
          position: { x: 900, y: 400 },
          tags: ["unrelated"],
        },
      ],
      null,
      { reducedMotion: true }
    );
    var board = mounted.board;
    var source = board.cardEls.source;
    var unrelated = board._findCard(collidingId);
    var unrelatedBefore = JSON.parse(JSON.stringify(unrelated));

    source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
    var targetPosition = movePointerOntoCard(board, source, "target", 1);
    var holdToken = mounted.scheduler.jobsByDelay(1500)[0];
    mounted.scheduler.fire(holdToken);

    assert.equal(board.cards.length, 2);
    var ids = board.cards.map(function (card) {
      return card.id;
    });
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(board.cards.indexOf(unrelated) !== -1, true);
    assert.deepEqual(unrelated, unrelatedBefore);

    var merged = board.cards.filter(function (card) {
      return card !== unrelated;
    })[0];
    assert.notEqual(merged.id, collidingId);
    assert.equal(merged.problem_statement, "target; source.");
    assert.equal(Object.keys(board.cardEls).length, 2);
    assert.equal(Object.keys(board.statementEls).length, 2);
    assert.notEqual(board.cardEls[merged.id], board.cardEls[unrelated.id]);
    assert.notEqual(
      board.statementEls[merged.id],
      board.statementEls[unrelated.id]
    );

    var mergedEl = board.cardEls[merged.id];
    mergedEl.dispatch("pointerdown", pointerEvent(mergedEl, 7, 0, 0));
    mergedEl.dispatch("pointermove", pointerEvent(mergedEl, 7, 6, 0));
    assert.equal(board.activeDrag.sourceId, merged.id);
    assert.deepEqual(merged.position, {
      x: targetPosition.x + 6,
      y: targetPosition.y,
    });
    mergedEl.dispatch("pointerup", pointerEvent(mergedEl, 7, 6, 0));
    assert.equal(board.activeDrag, null);
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
  }
});

test("detached source controls cannot mutate or rebuild a merged card drag", function () {
  var sourceData = problemCard("source", 0, 0);
  sourceData.impact = "Source impact";
  sourceData.proof_points = ["Source proof"];
  sourceData.frameworks = [
    {
      name: "Five Whys",
      proof_points: ["Source proof"],
      confidence: "medium",
    },
  ];
  sourceData.convergence_note = "Source confidence note.";
  var mounted = mountBoard(
    [sourceData, problemCard("target", 260, 0)],
    null,
    { reducedMotion: true }
  );
  var board = mounted.board;
  var sourceCard = board._findCard("source");
  var source = board.cardEls.source;
  var oldToolbar = findByClass(source, "card-toolbar");
  var oldDuplicate = oldToolbar.children[0];
  var oldDelete = oldToolbar.children[1];
  var oldToggle = findByClass(source, "disclosure-toggle");
  var oldAddPoint = findByClass(source, "add-point-btn");
  var oldRemovePoint = findByClass(source, "remove-point");
  var oldFields = source.querySelectorAll(".card-field");
  var oldStatement = oldFields[0];
  var oldImpact = oldFields[1];
  var oldProof = oldFields[2];

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  movePointerOntoCard(board, source, "target", 1);
  mounted.scheduler.fire(mounted.scheduler.jobsByDelay(1500)[0]);

  var merged = board.cards[0];
  var mergedEl = board.cardEls[merged.id];
  mergedEl.dispatch("pointerdown", pointerEvent(mergedEl, 8, 0, 0));
  mergedEl.dispatch("pointermove", pointerEvent(mergedEl, 8, 6, 0));
  var activeDrag = board.activeDrag;
  var cardsBeforeControls = JSON.parse(JSON.stringify(board.cards));
  var oldSourceBeforeControls = JSON.parse(JSON.stringify(sourceCard));

  oldStatement.textContent = "Detached statement";
  oldStatement.dispatch("blur");
  oldImpact.textContent = "Detached impact";
  oldImpact.dispatch("blur");
  oldProof.textContent = "Detached proof";
  oldProof.dispatch("blur");
  oldAddPoint.dispatch("click", {
    stopPropagation: function () {},
  });
  oldRemovePoint.dispatch("click", {
    stopPropagation: function () {},
  });
  oldToggle.dispatch("click", {
    stopPropagation: function () {},
  });
  oldDuplicate.dispatch("click", {
    stopPropagation: function () {},
  });
  oldDelete.dispatch("click", {
    stopPropagation: function () {},
  });

  assert.equal(board.activeDrag, activeDrag);
  assert.equal(mergedEl.hasPointerCapture(8), true);
  assert.equal(board.cardEls[merged.id], mergedEl);
  assert.deepEqual(board.cards, cardsBeforeControls);
  assert.deepEqual(sourceCard, oldSourceBeforeControls);
  assert.equal(board.disclosures.source, undefined);

  mergedEl.dispatch("pointerup", pointerEvent(mergedEl, 8, 6, 0));
  assert.equal(board.activeDrag, null);
});

test("normal motion travels to the target for 200ms before merging once", function () {
  var fixture = startNormalMergeCompletion();
  var mounted = fixture.mounted;
  var board = mounted.board;
  var sourceRect = fixture.source.getBoundingClientRect();
  var targetRect = fixture.target.getBoundingClientRect();
  var expectedX =
    targetRect.left + targetRect.width / 2 -
    (sourceRect.left + sourceRect.width / 2);
  var expectedY =
    targetRect.top + targetRect.height / 2 -
    (sourceRect.top + sourceRect.height / 2);

  assert.notEqual(expectedX, 0);
  assert.notEqual(expectedY, 0);
  assert.equal(
    fixture.source.style.getPropertyValue("--merge-travel-x"),
    expectedX + "px"
  );
  assert.equal(
    fixture.source.style.getPropertyValue("--merge-travel-y"),
    expectedY + "px"
  );
  assert.equal(
    fixture.source.classList.contains("merge-source-completing"),
    true
  );
  assert.equal(
    fixture.target.classList.contains("merge-target-completing"),
    true
  );
  assert.equal(mounted.scheduler.jobsByDelay(200).length, 1);

  var cardsDuringTravel = JSON.parse(JSON.stringify(board.cards));
  fixture.target.dispatch(
    "pointerdown",
    pointerEvent(fixture.target, 2, 260, 0)
  );
  fixture.source.dispatch(
    "pointerdown",
    pointerEvent(fixture.source, 3, 300, 40)
  );
  fixture.source.dispatch(
    "pointermove",
    pointerEvent(fixture.source, 1, 500, 500)
  );
  fixture.source.dispatch(
    "pointerup",
    pointerEvent(fixture.source, 1, 500, 500)
  );
  fixture.source.dispatch(
    "pointercancel",
    pointerEvent(fixture.source, 1, 500, 500)
  );

  assert.equal(board.activeDrag, null);
  assert.equal(fixture.target.hasPointerCapture(2), false);
  assert.equal(fixture.source.hasPointerCapture(3), false);
  assert.deepEqual(board.cards, cardsDuringTravel);
  assert.deepEqual(mounted.scheduler.jobsByDelay(200), [
    fixture.completionToken,
  ]);

  mounted.scheduler.fire(fixture.completionToken);

  assert.equal(board.cards.length, 1);
  var merged = board.cards[0];
  assert.notEqual(merged.id, "source");
  assert.notEqual(merged.id, "target");
  assert.equal(merged.problem_statement, "target; source.");
  assert.deepEqual(merged.position, fixture.targetPosition);
  assert.equal(board.mergeCompletion, null);
  assert.equal(mounted.scheduler.pendingCount(), 0);
  assert.equal(document.activeElement, board.statementEls[merged.id]);
  assert.equal(mounted.selection.removeAllRangesCalls, 1);
  assert.equal(mounted.selection.addRangeCalls, 1);
  assert.equal(
    mounted.createdRanges[0].selectedNode,
    board.statementEls[merged.id]
  );

  var cardsAfterMerge = JSON.parse(JSON.stringify(board.cards));
  mounted.scheduler.fire(fixture.holdToken);
  mounted.scheduler.fire(fixture.completionToken);
  assert.deepEqual(board.cards, cardsAfterMerge);
  assert.deepEqual(mounted.mergeCompletions, ["target"]);
  assert.equal(mounted.selection.addRangeCalls, 1);
});

test("merge begin rejects a target replaced while pointer capture is released", function () {
  var mounted = mountBoard(
    [problemCard("source", 0, 0), problemCard("target", 260, 0)],
    null,
    { reducedMotion: false }
  );
  var board = mounted.board;
  var sourceCard = board._findCard("source");
  var originalTarget = board._findCard("target");
  var replacementTarget = JSON.parse(JSON.stringify(originalTarget));
  replacementTarget.problem_statement = "Reentrant replacement target";
  replacementTarget.impact = "Must remain unmerged";
  var replacementBefore = JSON.parse(JSON.stringify(replacementTarget));
  var source = board.cardEls.source;
  var target = board.cardEls.target;

  source.addEventListener("lostpointercapture", function () {
    board.cards = board.cards.map(function (card) {
      return card === originalTarget ? replacementTarget : card;
    });
  });

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  movePointerOntoCard(board, source, "target", 1, 40, 40);
  var holdToken = mounted.scheduler.jobsByDelay(1500)[0];
  mounted.scheduler.fire(holdToken);

  assert.equal(board._findCard("source"), sourceCard);
  assert.equal(board._findCard("target"), replacementTarget);
  assert.deepEqual(replacementTarget, replacementBefore);
  assert.equal(board.cards.length, 2);
  assert.equal(board.mergeCompletion, null);
  assert.deepEqual(mounted.scheduler.jobsByDelay(200), []);
  assert.equal(mounted.scheduler.pendingCount(), 0);
  assert.equal(board.activeDrag, null);
  assert.equal(source.hasPointerCapture(1), false);
  assert.equal(source.classList.contains("merge-source-completing"), false);
  assert.equal(target.classList.contains("merge-target-completing"), false);
  assert.equal(mounted.selection.addRangeCalls, 0);

  var cardsAfterRejection = JSON.parse(JSON.stringify(board.cards));
  mounted.scheduler.fire(holdToken);
  assert.deepEqual(board.cards, cardsAfterRejection);
  assert.deepEqual(mounted.mergeCompletions, ["target"]);
});

test("reduced merge begin stays inert when pointer release destroys the board", function () {
  var mounted = mountBoard(
    [problemCard("source", 0, 0), problemCard("target", 260, 0)],
    null,
    { reducedMotion: true }
  );
  var board = mounted.board;
  var source = board.cardEls.source;
  var target = board.cardEls.target;

  source.addEventListener("lostpointercapture", function () {
    board.destroy();
  });
  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  movePointerOntoCard(board, source, "target", 1);
  var cardsBeforeHold = JSON.parse(JSON.stringify(board.cards));
  var holdToken = mounted.scheduler.jobsByDelay(1500)[0];

  mounted.scheduler.fire(holdToken);

  assert.equal(board._destroyed, true);
  assert.equal(board.activeDrag, null);
  assert.equal(board.mergeCompletion === null, true);
  assert.equal(mounted.scheduler.pendingCount(), 0);
  assert.equal(source.hasPointerCapture(1), false);
  assert.equal(source.classList.contains("dragging"), false);
  assert.equal(source.classList.contains("merge-source-completing"), false);
  assert.equal(target.classList.contains("merge-target"), false);
  assert.equal(target.classList.contains("merge-target-completing"), false);
  assert.deepEqual(board.cards, cardsBeforeHold);
  assert.equal(mounted.root.children.length, 0);
  assert.equal(mounted.selection.addRangeCalls, 0);

  mounted.scheduler.fire(holdToken);
  assert.equal(board.mergeCompletion, null);
  assert.deepEqual(board.cards, cardsBeforeHold);
  assert.deepEqual(mounted.mergeCompletions, ["target"]);
});

test("normal merge begin stays inert when pointer release remounts the root", function () {
  var environment = createBoardEnvironment(null, { reducedMotion: false });
  var root = new FakeElement("div");
  var boardA = window.ProblemBoard.mount(
    {
      board_title: "Board A",
      cards: [problemCard("source-a", 0, 0), problemCard("target-a", 260, 0)],
    },
    root
  );
  var source = boardA.cardEls["source-a"];
  var target = boardA.cardEls["target-a"];
  var boardB = null;

  source.addEventListener("lostpointercapture", function () {
    boardB = window.ProblemBoard.mount(
      {
        board_title: "Board B",
        cards: [
          problemCard("source-b", 0, 0),
          problemCard("target-b", 260, 0),
        ],
      },
      root
    );
  });
  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  movePointerOntoCard(boardA, source, "target-a", 1, 40, 40);
  var boardACardsBeforeHold = JSON.parse(JSON.stringify(boardA.cards));
  var holdToken = environment.scheduler.jobsByDelay(1500)[0];

  environment.scheduler.fire(holdToken);

  assert.notEqual(boardB, null);
  assert.equal(boardA._destroyed, true);
  assert.equal(boardA.activeDrag, null);
  assert.equal(boardA.mergeCompletion === null, true);
  assert.deepEqual(environment.scheduler.jobsByDelay(200), []);
  assert.equal(environment.scheduler.pendingCount(), 0);
  assert.equal(source.hasPointerCapture(1), false);
  assert.equal(source.classList.contains("dragging"), false);
  assert.equal(source.classList.contains("merge-source-completing"), false);
  assert.equal(target.classList.contains("merge-target"), false);
  assert.equal(target.classList.contains("merge-target-completing"), false);
  assert.deepEqual(boardA.cards, boardACardsBeforeHold);
  assert.deepEqual(Object.keys(boardB.cardEls).sort(), ["source-b", "target-b"]);
  assert.deepEqual(
    boardB.cards.map(function (card) {
      return card.id;
    }),
    ["source-b", "target-b"]
  );

  var boardBCardsAfterRemount = JSON.parse(JSON.stringify(boardB.cards));
  environment.scheduler.fire(holdToken);
  assert.equal(boardA.mergeCompletion, null);
  assert.deepEqual(boardA.cards, boardACardsBeforeHold);
  assert.deepEqual(boardB.cards, boardBCardsAfterRemount);
  assert.deepEqual(environment.mergeCompletions, ["target-a"]);
});

test("normal completion cancels when a card object is replaced under the same id", function () {
  ["target", "source"].forEach(function (replacedId) {
    var fixture = startNormalMergeCompletion();
    var mounted = fixture.mounted;
    var board = mounted.board;
    var originalSource = board._findCard("source");
    var originalTarget = board._findCard("target");
    var original = board._findCard(replacedId);
    var replacement = JSON.parse(JSON.stringify(original));
    replacement.problem_statement = "Replacement " + replacedId;
    replacement.impact = "Replacement must not be merged";

    board.cards = board.cards.map(function (card) {
      return card === original ? replacement : card;
    });
    var cardsBeforeTimer = JSON.parse(JSON.stringify(board.cards));

    mounted.scheduler.fire(fixture.completionToken);

    assert.equal(board.cards.length, 2, replacedId);
    assert.equal(board._findCard(replacedId), replacement, replacedId);
    assert.equal(
      board._findCard("source"),
      replacedId === "source" ? replacement : originalSource,
      replacedId
    );
    assert.equal(
      board._findCard("target"),
      replacedId === "target" ? replacement : originalTarget,
      replacedId
    );
    assert.deepEqual(board.cards, cardsBeforeTimer, replacedId);
    assert.equal(board.mergeCompletion, null, replacedId);
    assert.equal(mounted.scheduler.pendingCount(), 0, replacedId);
    assert.equal(
      fixture.source.classList.contains("merge-source-completing"),
      false,
      replacedId
    );
    assert.equal(
      fixture.target.classList.contains("merge-target-completing"),
      false,
      replacedId
    );
    assert.equal(mounted.selection.addRangeCalls, 0, replacedId);

    mounted.scheduler.fire(fixture.holdToken);
    mounted.scheduler.fire(fixture.completionToken);
    assert.deepEqual(board.cards, cardsBeforeTimer, replacedId);
    assert.deepEqual(mounted.mergeCompletions, ["target"], replacedId);
  });
});

test("removing the source cancels a normal-motion merge completion", function () {
  var fixture = startNormalMergeCompletion();

  fixture.mounted.board._removeCard("source");

  assertNormalMergeCompletionCancelled(fixture, ["target"]);
});

test("removing the target cancels a normal-motion merge completion", function () {
  var fixture = startNormalMergeCompletion();

  fixture.mounted.board._removeCard("target");

  assertNormalMergeCompletionCancelled(fixture, ["source"]);
});

test("external render cancels a normal-motion merge completion", function () {
  var fixture = startNormalMergeCompletion();

  fixture.mounted.board.render();

  assertNormalMergeCompletionCancelled(fixture, ["source", "target"]);

  var cardsAfterRender = JSON.parse(
    JSON.stringify(fixture.mounted.board.cards)
  );
  fixture.source.dispatch(
    "pointerdown",
    pointerEvent(fixture.source, 7, 300, 40)
  );
  fixture.source.dispatch(
    "pointermove",
    pointerEvent(fixture.source, 7, 600, 600)
  );
  fixture.source.dispatch(
    "pointerup",
    pointerEvent(fixture.source, 7, 600, 600)
  );
  fixture.source.dispatch(
    "pointercancel",
    pointerEvent(fixture.source, 7, 600, 600)
  );
  assert.equal(fixture.source.hasPointerCapture(7), false);
  assert.equal(fixture.mounted.board.activeDrag, null);
  assert.deepEqual(fixture.mounted.board.cards, cardsAfterRender);
});

test("remount cancels and retires a normal-motion merge completion", function () {
  var environment = createBoardEnvironment(null, { reducedMotion: false });
  var root = new FakeElement("div");
  var boardA = window.ProblemBoard.mount(
    {
      board_title: "Board A",
      cards: [problemCard("source-a", 0, 0), problemCard("target-a", 260, 0)],
    },
    root
  );
  var oldSource = boardA.cardEls["source-a"];
  var oldTarget = boardA.cardEls["target-a"];

  oldSource.dispatch("pointerdown", pointerEvent(oldSource, 1, 0, 0));
  movePointerOntoCard(boardA, oldSource, "target-a", 1, 40, 40);
  var holdToken = environment.scheduler.jobsByDelay(1500)[0];
  environment.scheduler.fire(holdToken);
  var completionToken = environment.scheduler.jobsByDelay(200)[0];
  assert.notEqual(completionToken, undefined);

  var boardB = window.ProblemBoard.mount(
    {
      board_title: "Board B",
      cards: [problemCard("source-b", 0, 0), problemCard("target-b", 260, 0)],
    },
    root
  );

  assert.equal(environment.scheduler.pendingCount(), 0);
  assert.equal(boardA.mergeCompletion, null);
  assert.equal(oldSource.classList.contains("merge-source-completing"), false);
  assert.equal(oldTarget.classList.contains("merge-target-completing"), false);
  assert.equal(boardA.destroy(), false);
  assert.deepEqual(Object.keys(boardB.cardEls).sort(), ["source-b", "target-b"]);

  var boardACards = JSON.parse(JSON.stringify(boardA.cards));
  var boardBCards = JSON.parse(JSON.stringify(boardB.cards));
  environment.scheduler.fire(holdToken);
  environment.scheduler.fire(completionToken);
  assert.deepEqual(boardA.cards, boardACards);
  assert.deepEqual(boardB.cards, boardBCards);
});

test("owning pointerup cancels a pending merge hold at the drop position", function () {
  var fixture = startPendingMergeDrag();

  fixture.source.dispatch(
    "pointerup",
    pointerEvent(fixture.source, 1, 260, 0)
  );

  assertPendingMergeDragCancelled(fixture);
});

test("owning pointercancel cancels a pending merge hold", function () {
  var fixture = startPendingMergeDrag();

  fixture.source.dispatch(
    "pointercancel",
    pointerEvent(fixture.source, 1, 260, 0)
  );

  assertPendingMergeDragCancelled(fixture);
});

test("owning lostpointercapture cancels a pending merge hold", function () {
  var fixture = startPendingMergeDrag();

  fixture.source.dispatch(
    "lostpointercapture",
    pointerEvent(fixture.source, 1, 260, 0)
  );

  assertPendingMergeDragCancelled(fixture);
});

test("window blur cancels a pending merge hold", function () {
  var fixture = startPendingMergeDrag();

  window.dispatch("blur");

  assertPendingMergeDragCancelled(fixture);
});

test("only hidden visibility changes cancel a pending merge hold", function () {
  var fixture = startPendingMergeDrag();

  document.dispatch("visibilitychange");

  assert.equal(fixture.mounted.scheduler.pendingCount(), 1);
  assert.notEqual(fixture.mounted.board.activeDrag, null);
  assert.equal(fixture.source.hasPointerCapture(1), true);
  assert.equal(fixture.target.classList.contains("merge-target"), true);

  document.hidden = true;
  document.dispatch("visibilitychange");

  assertPendingMergeDragCancelled(fixture);
});

test("render cancels a pending merge hold before rebuilding card DOM", function () {
  var fixture = startPendingMergeDrag();

  fixture.mounted.board.render();

  assertPendingMergeDragCancelled(fixture);
});

test("removing the held merge target cancels before removal and render", function () {
  var fixture = startPendingMergeDrag();

  fixture.mounted.board._removeCard("target");

  assert.deepEqual(
    fixture.mounted.board.cards.map(function (card) {
      return card.id;
    }),
    ["source"]
  );
  assertPendingMergeDragCancelled(fixture);
});

test("removing the active drag source cancels before removal and render", function () {
  var fixture = startPendingMergeDrag();
  var board = fixture.mounted.board;

  board._removeCard("source");

  assert.equal(fixture.mounted.scheduler.pendingCount(), 0);
  assert.equal(fixture.target.classList.contains("merge-target"), false);
  assert.equal(fixture.source.hasPointerCapture(1), false);
  assert.equal(fixture.source.classList.contains("dragging"), false);
  assert.equal(board.activeDrag, null);
  assert.deepEqual(
    board.cards.map(function (card) {
      return card.id;
    }),
    ["target"]
  );

  var cardsBeforeStaleTimer = JSON.parse(JSON.stringify(board.cards));
  fixture.mounted.scheduler.fire(fixture.staleToken);
  assert.deepEqual(fixture.mounted.mergeCompletions, []);
  assert.deepEqual(board.cards, cardsBeforeStaleTimer);
  assert.equal(board.mergeCompletion, null);
});

test("remounting the same root retires the previous board lifecycle", function () {
  var environment = createBoardEnvironment();
  var root = new FakeElement("div");
  var boardA = window.ProblemBoard.mount(
    {
      board_title: "Board A",
      cards: [
        problemCard("source-a", 0, 0),
        problemCard("target-a", 260, 0),
      ],
    },
    root
  );
  var oldSource = boardA.cardEls["source-a"];
  var oldTarget = boardA.cardEls["target-a"];
  var oldCanvas = boardA.canvas;

  oldSource.dispatch("pointerdown", pointerEvent(oldSource, 1, 0, 0));
  movePointerOntoCard(boardA, oldSource, "target-a", 1);

  var staleToken = environment.scheduler.jobsByDelay(1500)[0];
  assert.notEqual(staleToken, undefined);
  assert.equal(window.listenerCount("blur"), 1);
  assert.equal(document.listenerCount("visibilitychange"), 1);
  assert.equal(document.listenerCount("keydown"), 1);
  assert.equal(oldCanvas.listenerCount("wheel"), 1);
  ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach(
    function (type) {
      assert.equal(oldCanvas.listenerCount(type), 1);
    }
  );

  var boardB = window.ProblemBoard.mount(
    {
      board_title: "Board B",
      cards: [
        problemCard("source-b", 0, 0),
        problemCard("target-b", 260, 0),
      ],
    },
    root
  );

  assert.equal(environment.scheduler.pendingCount(), 0);
  assert.equal(boardA.activeDrag, null);
  assert.equal(oldTarget.classList.contains("merge-target"), false);
  assert.equal(oldSource.classList.contains("dragging"), false);
  assert.equal(oldSource.hasPointerCapture(1), false);
  assert.equal(window.listenerCount("blur"), 1);
  assert.equal(document.listenerCount("visibilitychange"), 1);
  assert.equal(document.listenerCount("keydown"), 1);
  assert.equal(oldCanvas.listenerCount("wheel"), 0);
  ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach(
    function (type) {
      assert.equal(oldCanvas.listenerCount(type), 0);
      assert.equal(boardB.canvas.listenerCount(type), 1);
    }
  );
  assert.equal(boardB.canvas.listenerCount("wheel"), 1);
  boardA.destroy();
  boardA.destroy();
  assert.equal(window.listenerCount("blur"), 1);
  assert.equal(document.listenerCount("visibilitychange"), 1);
  assert.equal(document.listenerCount("keydown"), 1);
  var boardBScroll = { left: boardB.canvas.scrollLeft, top: boardB.canvas.scrollTop };
  oldCanvas.dispatch("wheel", {
    ctrlKey: true,
    deltaY: -100,
    clientX: 0,
    clientY: 0,
    preventDefault: function () {
      throw new Error("retired wheel handler must be detached");
    },
  });
  oldCanvas.dispatch("pointerdown", {
    target: oldCanvas,
    pointerType: "mouse",
    button: 0,
    pointerId: 9,
    clientX: 20,
    clientY: 20,
  });
  oldCanvas.dispatch("pointermove", {
    target: oldCanvas,
    pointerType: "mouse",
    pointerId: 9,
    clientX: 0,
    clientY: 0,
  });
  assert.deepEqual(
    { left: boardB.canvas.scrollLeft, top: boardB.canvas.scrollTop },
    boardBScroll
  );
  assert.equal(root.children.length, 4);
  assert.equal(root.querySelectorAll(".board-toolbar").length, 1);
  assert.equal(root.querySelectorAll(".side-panel").length, 1);
  assert.equal(root.querySelectorAll(".card").length, 2);
  assert.deepEqual(Object.keys(boardB.cardEls).sort(), ["source-b", "target-b"]);

  var boardACardsBeforeStale = JSON.parse(JSON.stringify(boardA.cards));
  var boardBCardsBeforeStale = JSON.parse(JSON.stringify(boardB.cards));
  environment.scheduler.fire(staleToken);
  assert.deepEqual(environment.mergeCompletions, []);
  assert.deepEqual(boardA.cards, boardACardsBeforeStale);
  assert.deepEqual(boardB.cards, boardBCardsBeforeStale);

  var sourceB = boardB.cardEls["source-b"];
  sourceB.dispatch("pointerdown", pointerEvent(sourceB, 2, 0, 0));
  movePointerOntoCard(boardB, sourceB, "target-b", 2);
  assert.equal(environment.scheduler.pendingCount(), 1);

  window.dispatch("blur");

  assert.equal(environment.scheduler.pendingCount(), 0);
  assert.equal(boardB.activeDrag, null);
  assert.equal(sourceB.hasPointerCapture(2), false);
  assert.deepEqual(boardA.cards, boardACardsBeforeStale);
});

test("T shortcut adds a label only to the active mounted board", function () {
  createBoardEnvironment();
  var rootA = new FakeElement("div");
  var rootB = new FakeElement("div");
  var boardA = window.ProblemBoard.mount(
    { board_title: "Board A", cards: [problemCard("a", 0, 0)] },
    rootA
  );
  var boardB = window.ProblemBoard.mount(
    { board_title: "Board B", cards: [problemCard("b", 0, 0)] },
    rootB
  );

  assert.equal(document.listenerCount("keydown"), 2);
  document.dispatch("keydown", {
    key: "t",
    target: rootB,
    preventDefault: function () {},
  });
  assert.equal(boardA.labels.length, 0);
  assert.equal(boardB.labels.length, 1);

  rootA.dispatch("pointerdown", { target: rootA });
  document.dispatch("keydown", {
    key: "t",
    target: rootA,
    preventDefault: function () {},
  });
  assert.equal(boardA.labels.length, 1);
  assert.equal(boardB.labels.length, 1);

  boardA.destroy();
  assert.equal(document.listenerCount("keydown"), 1);
  document.dispatch("keydown", {
    key: "t",
    target: rootB,
    preventDefault: function () {},
  });
  assert.equal(boardA.labels.length, 1);
  assert.equal(boardB.labels.length, 2);
});

test("destroyed boards ignore retained card and control handlers", function () {
  var environment = createBoardEnvironment();
  var root = new FakeElement("div");
  var board = window.ProblemBoard.mount(
    {
      board_title: "Retired board",
      cards: [
        problemCard("source", 0, 0),
        problemCard("target", 260, 0),
      ],
    },
    root
  );
  var source = board.cardEls.source;
  var target = board.cardEls.target;
  var addButton = findByAction(root, "add");
  var sourcePosition = JSON.parse(JSON.stringify(board.cards[0].position));
  var cardCount = board.cards.length;

  board.destroy();
  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  source.dispatch("pointermove", pointerEvent(source, 1, 260, 0));

  assert.equal(board.activeDrag, null);
  assert.equal(source.hasPointerCapture(1), false);
  assert.equal(environment.scheduler.pendingCount(), 0);
  assert.equal(target.classList.contains("merge-target"), false);
  assert.deepEqual(board.cards[0].position, sourcePosition);

  addButton.dispatch("click", {
    target: addButton,
    stopPropagation: function () {},
  });

  assert.equal(board.cards.length, cardCount);
  assert.equal(root.children.length, 0);
  assert.equal(window.listenerCount("blur"), 0);
  assert.equal(document.listenerCount("visibilitychange"), 0);
  assert.equal(document.listenerCount("keydown"), 0);
  assert.equal(board.destroy(), false);
});

test("restarts target feedback when the dragged card moves onto another card", function () {
  var mounted = mountBoard([
    problemCard("source", 0, 0),
    problemCard("target-a", 260, 0),
    problemCard("target-b", 520, 0),
  ]);
  var board = mounted.board;
  var source = board.cardEls.source;
  var targetA = board.cardEls["target-a"];
  var targetB = board.cardEls["target-b"];

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  movePointerOntoCard(board, source, "target-a", 1);
  var firstTimer = mounted.scheduler.jobsByDelay(1500)[0];
  assert.notEqual(firstTimer, undefined);
  assert.equal(targetA.classList.contains("merge-target"), true);

  movePointerOntoCard(board, source, "target-b", 1);

  var secondTimers = mounted.scheduler.jobsByDelay(1500);
  assert.equal(secondTimers.length, 1);
  assert.notEqual(secondTimers[0], firstTimer);
  assert.equal(targetA.classList.contains("merge-target"), false);
  assert.equal(targetB.classList.contains("merge-target"), true);
  assert.equal(targetB.querySelectorAll(".merge-progress-ring").length, 1);
});

test("clears merge feedback outside every candidate without ending the drag", function () {
  var mounted = mountBoard([
    problemCard("source", 0, 0),
    problemCard("target-a", 260, 0),
    problemCard("target-b", 520, 0),
  ]);
  var board = mounted.board;
  var source = board.cardEls.source;

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  movePointerOntoCard(board, source, "target-a", 1);
  assert.equal(mounted.scheduler.pendingCount(), 1);
  assert.equal(board.cardEls["target-a"].classList.contains("merge-target"), true);

  source.dispatch("pointermove", pointerEvent(source, 1, 800, 0));

  assert.equal(mounted.scheduler.pendingCount(), 0);
  assert.equal(board.cardEls["target-a"].classList.contains("merge-target"), false);
  assert.equal(board.cardEls["target-b"].classList.contains("merge-target"), false);
  assert.equal(board.activeDrag.pointerId, 1);
  assert.equal(source.classList.contains("dragging"), true);
});

test("defines compact merge hold progress and halo animation styles", function () {
  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");
  var reducedMotionStart = css.indexOf(
    "@media (prefers-reduced-motion: reduce)"
  );
  var reducedMotionCss =
    reducedMotionStart === -1 ? "" : css.slice(reducedMotionStart);

  assert.match(css, /\.card\.merge-target/);
  assert.match(css, /\.merge-progress-ring/);
  assert.match(css, /\.merge-progress-fill/);
  assert.match(css, /@keyframes merge-progress-fill/);
  assert.match(css, /@keyframes merge-halo-pulse/);
  assert.match(css, /animation:\s*merge-progress-fill\s+1\.5s\b/);
  assert.match(css, /animation:\s*merge-halo-pulse\s+0\.75s[^;]*alternate/);
  assert.doesNotMatch(
    reducedMotionCss,
    /\.merge-progress-fill\s*\{[^}]*animation:\s*none/,
    "reduced motion must preserve the timed progress indicator"
  );
  assert.doesNotMatch(
    reducedMotionCss,
    /\.merge-progress-fill\s*\{[^}]*stroke-dashoffset:\s*0/,
    "reduced motion must not show progress as complete before the hold timer"
  );
});

test("defines merge travel and reduced-motion completion styles", function () {
  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");
  var reducedMotionStart = css.indexOf(
    "@media (prefers-reduced-motion: reduce)"
  );
  var reducedMotionCss =
    reducedMotionStart === -1 ? "" : css.slice(reducedMotionStart);

  assert.match(
    css,
    /\.card\.merge-source-completing \{\s*opacity:\s*0;\s*transform:\s*translate\(var\(--merge-travel-x\), var\(--merge-travel-y\)\) scale\(0\.72\) !important;\s*transition:\s*opacity 0\.2s ease, transform 0\.2s ease !important;\s*\}/
  );
  assert.match(
    css,
    /\.card\.merge-target-completing \.sticky \{\s*transform:\s*translateY\(-5px\) scale\(1\.025\);\s*transition:\s*transform 0\.2s ease;\s*\}/
  );
  assert.match(
    reducedMotionCss,
    /\.card\.merge-source-completing\s*\{[^}]*transform:\s*none !important;[^}]*transition:\s*none !important;/,
    "reduced motion must disable source travel"
  );
  assert.match(
    reducedMotionCss,
    /\.card\.merge-target \.sticky,\s*\.card\.merge-target-completing \.sticky\s*\{[^}]*animation:\s*none;[^}]*transform:\s*none;/,
    "reduced motion must disable halo pulse and target lift"
  );
  assert.doesNotMatch(
    reducedMotionCss,
    /\.merge-progress-fill\s*\{[^}]*animation:\s*none/,
    "reduced motion must preserve the 1.5s progress animation"
  );
});

test("focused dragging stays above focused peers despite the focus cascade", function () {
  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");

  assert.match(
    css,
    /\.card\.focus-focused\.dragging\s*\{[^}]*z-index:\s*40\s*;/,
    "expected a focus-specific dragging rule to preserve the drag layer"
  );
});

test("focused drag merge inherits the active focus set", function () {
  var mounted = mountBoard([
    problemCard("source", 0, 0),
    problemCard("target", 260, 0),
  ]);
  var board = mounted.board;

  findByAction(mounted.root, "focus").dispatch("click");
  board.cardEls.source.dispatch("click");
  board.cardEls.target.dispatch("click");

  var source = board.cardEls.source;
  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  movePointerOntoCard(board, source, "target", 1);
  mounted.scheduler.fire(mounted.scheduler.jobsByDelay(1500)[0]);

  assert.equal(board.cards.length, 1);
  assert.equal(board.focus.count(), 1);
  assert.equal(board.focus.has(board.cards[0].id), true);
  assert.equal(board.cardEls[board.cards[0].id].classList.contains("focus-focused"), true);
  assert.equal(findByClass(mounted.root, "focus-status-full").textContent, "1 card focused");
});

test("active focus keeps dimmed cards selection-only during drag merge", function () {
  var mounted = mountBoard([
    problemCard("source", 0, 0),
    problemCard("dimmed", 260, 0),
  ]);
  var board = mounted.board;

  findByAction(mounted.root, "focus").dispatch("click");
  board.cardEls.source.dispatch("click");
  var source = board.cardEls.source;
  var dimmed = board.cardEls.dimmed;
  assert.equal(dimmed.classList.contains("focus-dimmed"), true);

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  source.dispatch("pointermove", pointerEvent(source, 1, 260, 0));

  assert.deepEqual(mounted.scheduler.jobsByDelay(1500), []);
  assert.equal(dimmed.classList.contains("merge-target"), false);
  assert.equal(board.cards.length, 2);
});

test("off-focus drag merge transfers remembered membership to the result", function () {
  var mounted = mountBoard([
    problemCard("source", 0, 0),
    problemCard("target", 260, 0),
  ]);
  var board = mounted.board;
  var focus = findByAction(mounted.root, "focus");

  focus.dispatch("click");
  board.cardEls.source.dispatch("click");
  findByAction(mounted.root, "focus").dispatch("click");

  var source = board.cardEls.source;
  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  source.dispatch("pointermove", pointerEvent(source, 1, 260, 0));
  mounted.scheduler.fire(mounted.scheduler.jobsByDelay(1500)[0]);

  assert.equal(board.focus.active, false);
  assert.equal(board.focus.count(), 1);
  assert.equal(board.focus.has(board.cards[0].id), true);
  findByAction(mounted.root, "focus").dispatch("click");
  assert.equal(board.cardEls[board.cards[0].id].classList.contains("focus-focused"), true);
});

test("zoom keeps activation in client pixels and movement and travel in canvas units", function () {
  var mounted = mountBoard(
    [problemCard("source", 0, 0), problemCard("target", 260, 0)],
    null,
    { reducedMotion: false }
  );
  var board = mounted.board;
  var source = board.cardEls.source;
  var target = board.cardEls.target;
  board.zoom = 0.5;

  function scaledRect(element) {
    var left = (parseFloat(element.style.left) || 0) * board.zoom;
    var top = (parseFloat(element.style.top) || 0) * board.zoom;
    return {
      x: left,
      y: top,
      left: left,
      top: top,
      right: left + 110,
      bottom: top + 115,
      width: 110,
      height: 115,
    };
  }
  source.getBoundingClientRect = function () {
    return scaledRect(source);
  };
  target.getBoundingClientRect = function () {
    return scaledRect(target);
  };

  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  source.dispatch("pointermove", pointerEvent(source, 1, 5, 0));
  assert.equal(board.activeDrag.activated, false);
  var targetPosition = board._findCard("target").position;
  source.dispatch(
    "pointermove",
    pointerEvent(
      source,
      1,
      (targetPosition.x + 40) * board.zoom,
      (targetPosition.y + 40) * board.zoom
    )
  );
  assert.equal(board.activeDrag.activated, true);
  assert.deepEqual(board._findCard("source").position, {
    x: targetPosition.x + 40,
    y: targetPosition.y + 40,
  });

  var holdToken = mounted.scheduler.jobsByDelay(1500)[0];
  assert.notEqual(holdToken, undefined);
  mounted.scheduler.fire(holdToken);
  assert.equal(source.style.getPropertyValue("--merge-travel-x"), "-40px");
  assert.equal(source.style.getPropertyValue("--merge-travel-y"), "-40px");
});

test("focus and zoom changes cancel a pending drag merge", function () {
  var focusFixture = startPendingMergeDrag();
  findByAction(focusFixture.mounted.root, "focus").dispatch("click");
  assertPendingMergeDragCancelled(focusFixture);

  var zoomFixture = startPendingMergeDrag();
  zoomFixture.mounted.board.canvas.clientWidth = 800;
  zoomFixture.mounted.board.canvas.clientHeight = 600;
  zoomFixture.mounted.board._setZoom(0.5);
  assertPendingMergeDragCancelled(zoomFixture);
});

test("renderer exposes no click merge mode controls, state, or selection classes", function () {
  var mounted = mountBoard([problemCard("source", 0, 0)]);
  var js = fs.readFileSync(runtimePath("whiteboard.js"), "utf8");
  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");

  assert.equal(mounted.board.mergeMode, undefined);
  assert.equal(mounted.board.mergeSelection, undefined);
  assert.equal(findText(mounted.root, "Merge cards"), false);
  assert.equal(findByClass(mounted.root, "board-hint"), null);
  assert.doesNotMatch(js, /mergeMode|mergeSelection|_onToggleMergeMode|_onCardMergeClick/);
  assert.doesNotMatch(css, /merge-selectable|merge-selected|focus-merge/);
});

test("chrome keeps the inline PNG rootBoard brand and zoom controls", function () {
  var mounted = mountBoard([problemCard("source", 40, 40)]);
  var brand = findByClass(mounted.root, "board-brand");
  var wordmark = findByClass(brand, "wordmark");
  var zoomControls = findByClass(mounted.root, "zoom-controls");

  assert.ok(brand);
  assert.equal(brand.children[0].tagName, "IMG");
  assert.match(brand.children[0].getAttribute("src"), /^data:image\/png;base64,/);
  assert.equal(brand.children[0].getAttribute("alt"), "");
  assert.equal(wordmark.textContent, "rootBoard");
  assert.deepEqual(
    zoomControls.children.map(function (control) {
      return control.getAttribute("title");
    }),
    ["Zoom out", "Reset zoom to 100%", "Zoom in"]
  );
  assert.equal(mounted.board.canvasSizer.style.width, "3600px");
  assert.equal(mounted.board.canvasSizer.style.height, "2400px");
});

test("wheel zoom anchors the viewport, updates the sizer, and canvas drag pans", function () {
  var mounted = mountBoard([problemCard("source", 40, 40)]);
  var board = mounted.board;
  var canvas = board.canvas;
  var prevented = false;
  canvas.clientWidth = 800;
  canvas.clientHeight = 600;
  canvas.scrollLeft = 400;
  canvas.scrollTop = 300;

  canvas.dispatch("wheel", {
    target: canvas,
    ctrlKey: true,
    metaKey: false,
    deltaY: -100,
    clientX: 200,
    clientY: 100,
    preventDefault: function () {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.ok(board.zoom > 1);
  assert.equal(board.canvasInner.style.transform, "scale(" + board.zoom + ")");
  assert.equal(board.zoomLevelEl.textContent, Math.round(board.zoom * 100) + "%");
  assert.equal(board.canvasSizer.style.width, 3600 * board.zoom + "px");
  assert.equal(board.canvasSizer.style.height, 2400 * board.zoom + "px");
  assert.equal(canvas.scrollLeft, 600 * board.zoom - 200);
  assert.equal(canvas.scrollTop, 400 * board.zoom - 100);

  var zoomAfterModifiedWheel = board.zoom;
  canvas.dispatch("wheel", {
    target: canvas,
    ctrlKey: false,
    metaKey: false,
    deltaY: 100,
    clientX: 0,
    clientY: 0,
    preventDefault: function () {
      throw new Error("plain wheel must remain native scrolling");
    },
  });
  assert.equal(board.zoom, zoomAfterModifiedWheel);

  canvas.scrollLeft = 300;
  canvas.scrollTop = 200;
  canvas.dispatch("pointerdown", {
    target: canvas,
    pointerType: "mouse",
    button: 0,
    pointerId: 7,
    clientX: 100,
    clientY: 90,
  });
  assert.equal(canvas.classList.contains("panning"), true);
  canvas.dispatch("pointermove", {
    target: canvas,
    pointerType: "mouse",
    pointerId: 7,
    clientX: 70,
    clientY: 50,
  });
  assert.equal(canvas.scrollLeft, 330);
  assert.equal(canvas.scrollTop, 240);
  canvas.dispatch("pointerup", {
    target: canvas,
    pointerType: "mouse",
    pointerId: 7,
    clientX: 70,
    clientY: 50,
  });
  assert.equal(canvas.classList.contains("panning"), false);
});

test("starting a canvas pan cancels an active drag hold", function () {
  var fixture = startPendingMergeDrag();
  var canvas = fixture.mounted.board.canvas;

  canvas.dispatch("pointerdown", {
    target: canvas,
    pointerType: "mouse",
    button: 0,
    pointerId: 8,
    clientX: 100,
    clientY: 100,
  });

  assertPendingMergeDragCancelled(fixture);
  assert.equal(canvas.classList.contains("panning"), true);
});

test("zoomed Add places the card in the current visible viewport", function () {
  var mounted = mountBoard([problemCard("source", 40, 40)]);
  var board = mounted.board;
  board.canvas.clientWidth = 800;
  board.canvas.clientHeight = 600;
  board._setZoom(0.5);
  board.canvas.scrollLeft = 900;
  board.canvas.scrollTop = 600;

  findByAction(mounted.root, "add").dispatch("click", {
    target: findByAction(mounted.root, "add"),
    stopPropagation: function () {},
  });

  var added = board.cards[board.cards.length - 1];
  var viewportX = added.position.x * board.zoom - board.canvas.scrollLeft;
  var viewportY = added.position.y * board.zoom - board.canvas.scrollTop;
  assert.ok(viewportX >= 60 && viewportX < 360);
  assert.ok(viewportY >= 80 && viewportY < 280);
});

test("initial overlap resolution uses measured heights and render does not repeat it", function () {
  var tall = problemCard("tall", 40, 40);
  var middle = problemCard("middle", 40, 40);
  var final = problemCard("final", 40, 40);
  var mounted = mountBoard([tall, middle, final]);
  var board = mounted.board;

  assert.deepEqual(
    board.cards.map(function (card) {
      return card.position.y;
    }),
    [40, 298, 556]
  );
  board.cards.forEach(function (card) {
    card.position.y = 40;
    board.cardEls[card.id].style.top = "40px";
  });
  board.cardEls.tall.offsetHeight = 310;
  board.cardEls.middle.offsetHeight = 180;
  board.cardEls.final.offsetHeight = 260;
  board._resolveInitialOverlap();
  assert.deepEqual(
    board.cards.map(function (card) {
      return card.position.y;
    }),
    [40, 378, 586]
  );
  board.cards[1].position.y = 40;
  board.render();
  assert.equal(board.cards[1].position.y, 40);
});

test("focus toggle and zoom cancel normal-motion merge completion", function () {
  var focusFixture = startNormalMergeCompletion();
  findByAction(focusFixture.mounted.root, "focus").dispatch("click", {
    target: findByAction(focusFixture.mounted.root, "focus"),
  });
  assertNormalMergeCompletionCancelled(focusFixture, ["source", "target"]);

  var zoomFixture = startNormalMergeCompletion();
  zoomFixture.mounted.board.canvas.clientWidth = 800;
  zoomFixture.mounted.board.canvas.clientHeight = 600;
  zoomFixture.mounted.board._setZoom(0.5);
  assertNormalMergeCompletionCancelled(zoomFixture, ["source", "target"]);
});

test("clearing focus cancels normal-motion merge completion", function () {
  var mounted = mountBoard(
    [problemCard("source", 0, 0), problemCard("target", 260, 0)],
    null,
    { reducedMotion: false }
  );
  var board = mounted.board;
  findByAction(mounted.root, "focus").dispatch("click", {
    target: findByAction(mounted.root, "focus"),
  });
  board.cardEls.source.dispatch("click", { target: board.cardEls.source });
  board.cardEls.target.dispatch("click", { target: board.cardEls.target });
  var source = board.cardEls.source;
  var target = board.cardEls.target;
  source.dispatch("pointerdown", pointerEvent(source, 1, 0, 0));
  movePointerOntoCard(board, source, "target", 1, 40, 40);
  var holdToken = mounted.scheduler.jobsByDelay(1500)[0];
  mounted.scheduler.fire(holdToken);
  var completionToken = mounted.scheduler.jobsByDelay(200)[0];
  assert.notEqual(completionToken, undefined);

  board._clearFocus();

  assert.equal(board.focus.active, true);
  assert.equal(board.focus.count(), 0);
  assertNormalMergeCompletionCancelled(
    {
      mounted: mounted,
      source: source,
      target: target,
      holdToken: holdToken,
      completionToken: completionToken,
    },
    ["source", "target"]
  );
});

{
var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var testDom = require("./test-dom.js");
var createDocument = testDom.createDocument;
var dispatch = testDom.dispatch;

function card(id, statement, x) {
  return {
    id: id,
    problem_statement: statement,
    impact: "Impact for " + statement,
    proof_points: ["Evidence for " + statement],
    frameworks: [],
    position: { x: x, y: 40 },
    convergence_note: "",
    created_by: "agent",
    tags: [],
    tension: false,
  };
}

function firstCard() {
  var result = card("card-1", "Problem 1", 40);
  result.frameworks = [
    {
      name: "Test lens",
      proof_points: ["Lens evidence"],
      confidence: "high",
    },
  ];
  result.convergence_note = "Confidence: Test lens High.";
  return result;
}

function confidenceCard() {
  var result = card("confidence-card", "Confidence semantics", 40);
  result.frameworks = [
    {
      name: "Structured",
      proof_points: ["Proof A"],
      confidence: "High",
    },
    {
      name: "Fallback",
      proof_points: ["Proof B"],
      confidence: null,
    },
    {
      name: "Unknown",
      proof_points: ["Proof C"],
      confidence: null,
    },
    {
      name: "Fourth",
      proof_points: ["Proof D"],
      confidence: "Low",
    },
    {
      name: "Fifth",
      proof_points: ["Proof E"],
      confidence: "Medium",
    },
  ];
  result.convergence_note = "Confidence: Structured High; Fallback Medium.";
  return result;
}

function oneCard() {
  return [firstCard()];
}

function threeCards() {
  return [
    firstCard(),
    card("card-2", "Problem 2", 300),
    card("card-3", "Problem 3", 560),
  ];
}

function eightCards() {
  return [
    card("card-1", "Problem 1", 40),
    card("card-2", "Problem 2", 300),
    card("card-3", "Problem 3", 560),
    card("card-4", "Problem 4", 820),
    card("card-5", "Problem 5", 1080),
    card("card-6", "Problem 6", 1340),
    card("card-7", "Problem 7", 1600),
    card("card-8", "Problem 8", 1860),
  ];
}

var waveNames = ["vivid-blue", "coral", "warm-yellow", "deep-navy"];

function randomSpy(value) {
  function random() {
    random.calls++;
    return value;
  }
  random.calls = 0;
  return random;
}

function walk(root) {
  return [root].concat(
    root.children.reduce(function (all, child) {
      return all.concat(walk(child));
    }, [])
  );
}

function cards(root) {
  return walk(root).filter(function (node) {
    return node.classList.contains("card");
  });
}

function assertValidWaves(root) {
  cards(root).forEach(function (candidate) {
    assert.ok(
      waveNames.indexOf(candidate.getAttribute("data-wave")) !== -1,
      "expected every rendered card to have a valid data-wave"
    );
  });
}

function findByClass(root, name) {
  return (
    walk(root).filter(function (node) {
      return node.classList.contains(name);
    })[0] || null
  );
}

function findAllByClass(root, name) {
  return walk(root).filter(function (node) {
    return node.classList.contains(name);
  });
}

function disclosure(cardEl, section) {
  return (
    findAllByClass(cardEl, "disclosure-toggle").filter(function (toggle) {
      return toggle.getAttribute("data-section") === section;
    })[0] || null
  );
}

function controlledPanel(root, toggle) {
  return toggle
    ? findByAttribute(root, "id", toggle.getAttribute("aria-controls"))
    : null;
}

function cardPositions(board) {
  return board.cards.map(function (candidate) {
    return { id: candidate.id, x: candidate.position.x, y: candidate.position.y };
  });
}

function findByAttribute(root, name, value) {
  return (
    walk(root).filter(function (node) {
      return node.getAttribute(name) === value;
    })[0] || null
  );
}

function findByTitle(root, value) {
  return findByAttribute(root, "title", value);
}

function findByTooltip(root, value) {
  return findByAttribute(root, "data-tooltip", value);
}

function findByAria(root, value) {
  return findByAttribute(root, "aria-label", value);
}

function findByText(root, value) {
  return (
    walk(root).filter(function (node) {
      return node.textContent === value;
    })[0] || null
  );
}

function findCardByStatement(root, value) {
  return (
    cards(root).filter(function (candidate) {
      var statement = findByClass(candidate, "problem-statement");
      return statement && statement.textContent === value;
    })[0] || null
  );
}

function focusedCards(root) {
  return cards(root).filter(function (candidate) {
    return candidate.classList.contains("focus-focused");
  });
}

function memoryStorage() {
  var values = Object.create(null);
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : null;
    },
    setItem: function (key, value) {
      values[key] = String(value);
    },
    values: values,
  };
}

function mountBoard(cardData, optionsOrScheduler, measureOrOptions) {
  var secondIsScheduler =
    optionsOrScheduler &&
    typeof optionsOrScheduler.jobsByDelay === "function";
  var scheduler = secondIsScheduler
    ? optionsOrScheduler
    : createScheduler();
  var measureElement =
    typeof measureOrOptions === "function" ? measureOrOptions : null;
  var options = measureElement
    ? optionsOrScheduler || {}
    : measureOrOptions || (secondIsScheduler ? {} : optionsOrScheduler || {});
  var core = require(runtimePath("whiteboard-core.js"));
  var mergeCompletions = [];
  var reducedMotion = options.reducedMotion !== false;
  var selection = {
    ranges: [],
    removeAllRangesCalls: 0,
    addRangeCalls: 0,
    removeAllRanges: function () {
      this.removeAllRangesCalls += 1;
      this.ranges = [];
    },
    addRange: function (range) {
      this.addRangeCalls += 1;
      this.ranges.push(range);
    },
  };
  var createdRanges = [];
  global.document = createDocument();
  if (measureElement) {
    var createElement = document.createElement;
    document.createElement = function (tag) {
      var element = createElement(tag);
      var explicitHeight = 0;
      Object.defineProperty(element, "offsetHeight", {
        configurable: true,
        get: function () {
          return explicitHeight || measureElement(element) || 0;
        },
        set: function (value) {
          explicitHeight = value;
        },
      });
      return element;
    };
  }
  document.createRange = function () {
    var range = {
      selectedNode: null,
      selectNodeContents: function (node) {
        this.selectedNode = node;
      },
    };
    createdRanges.push(range);
    return range;
  };
  global.window = createEventTarget({
    ProblemBoardCore: Object.assign({}, core, {
      createMergeHoldController: function (controllerOptions) {
        var observedOptions = Object.assign({}, controllerOptions);
        var onComplete = observedOptions.onComplete;
        observedOptions.onComplete = function (targetId) {
          mergeCompletions.push(targetId);
          onComplete(targetId);
        };
        return core.createMergeHoldController(observedOptions);
      },
    }),
    setTimeout: scheduler.setTimeout,
    clearTimeout: scheduler.clearTimeout,
    matchMedia: function (query) {
      return {
        media: query,
        matches:
          query === "(prefers-reduced-motion: reduce)" && reducedMotion,
      };
    },
    getSelection: function () {
      return selection;
    },
    navigator: options.navigator,
    localStorage: options.storage,
    location: { pathname: options.pathname || "/boards/test-board.html" },
  });
  delete require.cache[require.resolve(runtimePath("whiteboard.js"))];
  require(runtimePath("whiteboard.js"));
  var root = document.createElement("div");
  var board = window.ProblemBoard.mount(
    {
      board_title: "Focus test",
      source_summary: "Test board",
      cards: cardData,
    },
    root,
    options
  );
  return {
    root: root,
    board: board,
    scheduler: scheduler,
    mergeCompletions: mergeCompletions,
    selection: selection,
    createdRanges: createdRanges,
  };
}

function beginDragMergeElements(view, source, target, pointerId) {
  var sourceLeft = parseFloat(source.style.left) || 0;
  var sourceTop = parseFloat(source.style.top) || 0;
  var targetLeft = parseFloat(target.style.left) || 0;
  var targetTop = parseFloat(target.style.top) || 0;
  var id = pointerId || 1;

  dispatch(source, "pointerdown", {
    clientX: sourceLeft,
    clientY: sourceTop,
    pointerId: id,
  });
  dispatch(source, "pointermove", {
    clientX: sourceLeft + targetLeft - sourceLeft,
    clientY: sourceTop + targetTop - sourceTop,
    pointerId: id,
  });
  return view.scheduler.jobsByDelay(1500)[0];
}

function dragMergeElements(view, source, target, pointerId) {
  var holdToken = beginDragMergeElements(view, source, target, pointerId);
  assert.notEqual(holdToken, undefined, "expected a drag-merge hold timer");
  view.scheduler.fire(holdToken);
  return view.board.cards[0];
}

function dragMerge(view, sourceText, targetText, pointerId) {
  return dragMergeElements(
    view,
    findCardByStatement(view.root, sourceText),
    findCardByStatement(view.root, targetText),
    pointerId
  );
}

function enterFocus(cardData) {
  var view = mountBoard(cardData);
  var focusButton = findByAria(view.root, "Focus cards");
  assert.ok(focusButton, "expected a Focus cards control");
  dispatch(focusButton, "click");
  return view;
}

test("top bar keeps brand and title while removing secondary copy", function () {
  createBoardEnvironment();
  var root = new FakeElement("div");
  window.ProblemBoard.mount(
    {
      board_title: "Customer onboarding friction",
      source_summary: "Interview notes from the activation team",
      cards: [],
    },
    root
  );

  var toolbar = findByClass(root, "board-toolbar");
  var brand = findByClass(toolbar, "board-brand");
  var divider = findByClass(toolbar, "board-divider");
  var title = findByTitle(toolbar, "Customer onboarding friction");
  var status = findByClass(toolbar, "board-status");
  assert.ok(toolbar);
  assert.ok(brand);
  assert.ok(divider);
  assert.ok(title);
  assert.ok(status);
  assert.equal(toolbar.children.length, 4);
  assert.equal(toolbar.children[0], brand);
  assert.equal(toolbar.children[1], divider);
  assert.equal(toolbar.children[2], title);
  assert.equal(toolbar.children[3], status);
  assert.equal(title.tagName, "H1");
  assert.equal(title.textContent, "Customer onboarding friction");
  assert.equal(findByClass(root, "source-summary"), null);
  assert.equal(findByClass(root, "board-scratch-note"), null);
  assert.equal(findByClass(root, "copy-context"), null);
  assert.equal(status.hidden, true);
});

test("Copy context sends a paste-ready prompt with the complete synthesis", async function () {
  var synthesis =
    "# Synthesis\n\n## Reframed Problem Statements\n\n" +
    "The full source stays intact — including punctuation.\n";
  var copiedPayloads = [];
  var view = mountBoard(oneCard(), {
    synthesisMarkdown: synthesis,
    navigator: {
      clipboard: {
        writeText: function (payload) {
          copiedPayloads.push(payload);
          return Promise.resolve();
        },
      },
    },
  });
  var toolbar = findByClass(view.root, "board-toolbar");
  var copy = findByClass(toolbar, "copy-context");

  assert.ok(copy);
  assert.equal(copy.tagName, "BUTTON");
  assert.equal(copy.textContent, "Copy context");
  assert.equal(
    copy.getAttribute("aria-label"),
    "Copy synthesis context for another AI chat"
  );
  assert.equal(copy.getAttribute("aria-live"), "polite");
  assert.equal(toolbar.children.length, 5);
  assert.equal(toolbar.children[3], copy);

  dispatch(copy, "click");
  assert.equal(copy.textContent, "Copying…");
  assert.equal(copy.disabled, true);

  await new Promise(function (resolve) {
    setImmediate(resolve);
  });

  assert.equal(copiedPayloads.length, 1);
  assert.match(
    copiedPayloads[0],
    /^Use the rootBoard synthesis below as shared context/
  );
  assert.match(copiedPayloads[0], /Treat the synthesis as source material/);
  assert.match(copiedPayloads[0], /Do not jump straight to solutions/);
  assert.match(copiedPayloads[0], /ask me the single most useful question/);
  assert.ok(
    copiedPayloads[0].indexOf(synthesis) >
      copiedPayloads[0].indexOf("--- BEGIN ROOTBOARD SYNTHESIS ---")
  );
  assert.ok(
    copiedPayloads[0].indexOf("--- END ROOTBOARD SYNTHESIS ---") >
      copiedPayloads[0].indexOf(synthesis)
  );

  assert.equal(copy.textContent, "Copied!");
  assert.equal(copy.disabled, false);
  assert.equal(copy.getAttribute("aria-label"), "Context copied");

  var feedbackTimer = view.scheduler.jobsByDelay(2000)[0];
  assert.ok(feedbackTimer);
  view.scheduler.fire(feedbackTimer);
  assert.equal(copy.textContent, "Copy context");
  assert.equal(
    copy.getAttribute("aria-label"),
    "Copy synthesis context for another AI chat"
  );
});

test("Copy context reports clipboard failures and remains retryable", function () {
  var view = mountBoard(oneCard(), {
    synthesisMarkdown: "# Synthesis\n",
    copyText: function () {
      throw new Error("clipboard blocked");
    },
  });
  var copy = findByClass(view.root, "copy-context");

  dispatch(copy, "click");

  assert.equal(copy.textContent, "Copy failed");
  assert.equal(copy.disabled, false);
  assert.equal(copy.getAttribute("aria-label"), "Copy failed. Try again");
  assert.equal(view.scheduler.jobsByDelay(2000).length, 1);
});

test("board title is an accessible single-line inline editor", function () {
  var view = mountBoard(oneCard());
  var title = findByClass(view.root, "board-title");

  assert.ok(title);
  assert.equal(title.tagName, "H1");
  assert.equal(title.textContent, "Focus test");
  assert.equal(title.getAttribute("contenteditable"), "true");
  assert.equal(title.getAttribute("role"), "textbox");
  assert.equal(title.getAttribute("aria-label"), "Board name");
  assert.equal(title.getAttribute("aria-multiline"), "false");
});

test("board title saves on blur and is restored after reload", function () {
  var storage = memoryStorage();
  var first = mountBoard(oneCard(), { storage: storage });
  var firstTitle = findByClass(first.root, "board-title");

  firstTitle.focus();
  firstTitle.textContent = "  Renamed   project board  ";
  firstTitle.blur();

  assert.equal(first.board.boardTitle, "Renamed project board");
  assert.equal(firstTitle.textContent, "Renamed project board");
  assert.equal(firstTitle.getAttribute("title"), "Renamed project board");
  assert.equal(document.title, "Renamed project board");
  assert.equal(Object.values(storage.values)[0], "Renamed project board");

  var reloaded = mountBoard(oneCard(), { storage: storage });
  var reloadedTitle = findByClass(reloaded.root, "board-title");
  assert.equal(reloaded.board.boardTitle, "Renamed project board");
  assert.equal(reloadedTitle.textContent, "Renamed project board");
  assert.equal(document.title, "Renamed project board");
});

test("board title Enter saves, Escape cancels, and blank input is rejected", function () {
  var storage = memoryStorage();
  var view = mountBoard(oneCard(), { storage: storage });
  var title = findByClass(view.root, "board-title");

  title.focus();
  title.textContent = "Saved with Enter";
  var enter = dispatch(title, "keydown", { key: "Enter" });
  assert.equal(enter.defaultPrevented, true);
  assert.equal(view.board.boardTitle, "Saved with Enter");

  title.focus();
  title.textContent = "Canceled name";
  var escape = dispatch(title, "keydown", { key: "Escape" });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(title.textContent, "Saved with Enter");
  assert.equal(view.board.boardTitle, "Saved with Enter");

  title.focus();
  title.textContent = "   ";
  title.blur();
  assert.equal(title.textContent, "Saved with Enter");
  assert.equal(view.board.boardTitle, "Saved with Enter");
});

test("persisted board titles do not leak to a different board", function () {
  var storage = memoryStorage();
  var first = mountBoard(oneCard(), { storage: storage });
  var firstTitle = findByClass(first.root, "board-title");
  firstTitle.focus();
  firstTitle.textContent = "Only this board";
  firstTitle.blur();

  var other = mountBoard(
    [card("different-card", "Different problem", 40)],
    { storage: storage }
  );
  assert.equal(other.board.boardTitle, "Focus test");
  assert.equal(
    findByClass(other.root, "board-title").textContent,
    "Focus test"
  );
});

test("board contract keeps source summary as undisplayed metadata", function () {
  var contract = fs.readFileSync(
    path.join(RUNTIME_DIR, "../../contracts/board-output.md"),
    "utf8"
  );
  assert.match(
    contract,
    /`source_summary`[^\n]*Informational metadata; not rendered in the whiteboard chrome\./
  );
  assert.doesNotMatch(contract, /`source_summary`[^\n]*Shown under the title/);
});

test("top bar exposes full compact and accessible Focus status", function () {
  var view = enterFocus(threeCards());
  var status = findByClass(view.root, "board-status");
  var live = findByClass(status, "focus-status-text");
  var full = findByClass(status, "focus-status-full");
  var compact = findByClass(status, "focus-status-compact");
  var indicator = findByClass(status, "focus-status-indicator");
  var clear = findByAria(status, "Clear focused cards");

  assert.equal(status.hidden, false);
  assert.equal(status.children.length, 2);
  assert.equal(status.children[0], live);
  assert.equal(status.children[1], clear);
  assert.equal(live.children.length, 3);
  assert.equal(live.children[0], indicator);
  assert.equal(live.children[1], full);
  assert.equal(live.children[2], compact);
  assert.equal(live.getAttribute("role"), "status");
  assert.equal(live.getAttribute("aria-live"), "polite");
  assert.equal(live.getAttribute("aria-label"), "Select cards to focus.");
  assert.equal(full.getAttribute("aria-hidden"), "true");
  assert.equal(compact.getAttribute("aria-hidden"), "true");
  assert.equal(indicator.getAttribute("aria-hidden"), "true");
  assert.equal(full.textContent, "Select cards to focus.");
  assert.equal(compact.textContent, "Select cards");
  assert.equal(indicator.hidden, true);
  assert.equal(clear.textContent, "Clear");
  assert.equal(clear.hidden, true);
  assert.equal(clear.disabled, true);

  dispatch(cards(view.root)[0], "click");
  assert.equal(live.getAttribute("aria-label"), "1 card focused");
  assert.equal(full.textContent, "1 card focused");
  assert.equal(compact.textContent, "1 focused");
  assert.equal(indicator.hidden, false);
  assert.equal(clear.hidden, false);
  assert.equal(clear.disabled, false);

  dispatch(cards(view.root)[1], "click");
  assert.equal(live.getAttribute("aria-label"), "2 cards focused");
  assert.equal(full.textContent, "2 cards focused");
  assert.equal(compact.textContent, "2 focused");

  dispatch(clear, "click");
  assert.equal(live.getAttribute("aria-label"), "Select cards to focus.");
  assert.equal(full.textContent, "Select cards to focus.");
  assert.equal(compact.textContent, "Select cards");
  assert.equal(indicator.hidden, true);
  assert.equal(clear.hidden, true);
  assert.equal(clear.disabled, true);
});

test("collapsed confidence face uses accessible dots without textual levels", function () {
  var view = mountBoard([confidenceCard()]);
  var signalBlock = findByClass(view.root, "signal-block");
  var dots = findAllByClass(signalBlock, "signal-dot");

  assert.equal(signalBlock.textContent, "Confidence+1");
  assert.deepEqual(
    dots.map(function (dot) {
      return dot.getAttribute("aria-label");
    }),
    [
      "Structured — High confidence",
      "Fallback — Medium confidence",
      "Unknown — Not stated confidence",
      "Fourth — Low confidence",
    ]
  );
  dots.forEach(function (dot) {
    assert.equal(dot.getAttribute("role"), "img");
  });
  var overflow = findByClass(signalBlock, "signal-more");
  assert.equal(overflow.getAttribute("role"), "img");
  assert.equal(
    overflow.getAttribute("aria-label"),
    "1 additional framework confidence signal"
  );
});

test("card face orders confidence, problem, impact, and disclosures", function () {
  var view = mountBoard(oneCard());
  var renderedCard = findCardByStatement(view.root, "Problem 1");
  var sticky = findByClass(renderedCard, "sticky");
  var substantiveChildren = sticky.children.filter(function (child) {
    return (
      !child.classList.contains("stack-layer") &&
      !child.classList.contains("merge-progress-ring") &&
      !child.classList.contains("card-toolbar")
    );
  });
  var signal = findByClass(sticky, "signal-block");
  var problem = findByClass(sticky, "problem-statement");
  var impact = findByClass(sticky, "impact-copy");
  var proof = disclosure(renderedCard, "proof");
  var lens = disclosure(renderedCard, "lens");
  var faceOrder = walk(sticky);

  assert.equal(substantiveChildren[0], signal);
  assert.ok(faceOrder.indexOf(signal) < faceOrder.indexOf(problem));
  assert.ok(faceOrder.indexOf(problem) < faceOrder.indexOf(impact));
  assert.ok(faceOrder.indexOf(impact) < faceOrder.indexOf(proof));
  assert.ok(faceOrder.indexOf(proof) < faceOrder.indexOf(lens));
});

test("expanded lens panel shows structured, fallback, and unknown confidence", function () {
  var view = mountBoard([confidenceCard()]);
  var renderedCard = findCardByStatement(view.root, "Confidence semantics");

  dispatch(disclosure(renderedCard, "lens"), "click");
  renderedCard = findCardByStatement(view.root, "Confidence semantics");
  assert.deepEqual(
    findAllByClass(renderedCard, "framework-confidence")
      .slice(0, 3)
      .map(function (confidence) {
        return confidence.textContent;
      }),
    ["Confidence: High", "Confidence: Medium", "Confidence: Not stated"]
  );
});

test("proof and lens disclosures start collapsed with stable unique wiring", function () {
  var view = mountBoard(oneCard());
  var renderedCard = findCardByStatement(view.root, "Problem 1");
  var proof = disclosure(renderedCard, "proof");
  var lens = disclosure(renderedCard, "lens");

  assert.ok(proof, "expected a Proof disclosure");
  assert.ok(lens, "expected a Lens disclosure");
  assert.equal(proof.tagName, "BUTTON");
  assert.equal(lens.tagName, "BUTTON");
  assert.equal(proof.getAttribute("type"), "button");
  assert.equal(lens.getAttribute("type"), "button");
  assert.equal(
    findByClass(proof, "disclosure-label").textContent,
    "Proof points"
  );
  assert.equal(
    findByClass(lens, "disclosure-label").textContent,
    "Lens & confidence"
  );
  assert.equal(proof.getAttribute("aria-expanded"), "false");
  assert.equal(lens.getAttribute("aria-expanded"), "false");

  var disclosureBase =
    view.board.instanceId + "-card-" + encodeURIComponent("card-1");
  assert.equal(
    proof.getAttribute("id"),
    disclosureBase + "-proof-toggle"
  );
  assert.equal(
    proof.getAttribute("aria-controls"),
    disclosureBase + "-proof-panel"
  );
  assert.equal(lens.getAttribute("id"), disclosureBase + "-lens-toggle");
  assert.equal(
    lens.getAttribute("aria-controls"),
    disclosureBase + "-lens-panel"
  );
  assert.notEqual(proof.getAttribute("id"), lens.getAttribute("id"));
  assert.notEqual(
    proof.getAttribute("aria-controls"),
    lens.getAttribute("aria-controls")
  );

  [proof, lens].forEach(function (toggle) {
    var panel = controlledPanel(renderedCard, toggle);
    assert.ok(panel, "expected the controlled panel to stay in the DOM");
    assert.equal(panel.getAttribute("role"), "region");
    assert.equal(panel.getAttribute("aria-labelledby"), toggle.getAttribute("id"));
    assert.equal(panel.hidden, true);
    assert.equal(
      findByClass(toggle, "disclosure-chevron").getAttribute("aria-hidden"),
      "true"
    );
  });

  var proofToggleId = proof.getAttribute("id");
  var proofPanelId = proof.getAttribute("aria-controls");
  var lensToggleId = lens.getAttribute("id");
  var lensPanelId = lens.getAttribute("aria-controls");
  view.board.render();
  renderedCard = findCardByStatement(view.root, "Problem 1");
  proof = disclosure(renderedCard, "proof");
  lens = disclosure(renderedCard, "lens");
  assert.equal(proof.getAttribute("id"), proofToggleId);
  assert.equal(proof.getAttribute("aria-controls"), proofPanelId);
  assert.equal(lens.getAttribute("id"), lensToggleId);
  assert.equal(lens.getAttribute("aria-controls"), lensPanelId);

  var secondRoot = document.createElement("div");
  var secondBoard = window.ProblemBoard.mount(
    {
      board_title: "Second board",
      source_summary: "Same card ID",
      cards: oneCard(),
    },
    secondRoot
  );
  var secondProof = disclosure(
    findCardByStatement(secondRoot, "Problem 1"),
    "proof"
  );
  assert.notEqual(secondBoard.instanceId, view.board.instanceId);
  assert.notEqual(secondProof.getAttribute("id"), proofToggleId);
  assert.notEqual(secondProof.getAttribute("aria-controls"), proofPanelId);
});

test("disclosures toggle independently with native keys and restore focus", function () {
  var view = mountBoard(oneCard());
  var renderedCard = findCardByStatement(view.root, "Problem 1");
  var proof = disclosure(renderedCard, "proof");
  var lens = disclosure(renderedCard, "lens");
  var proofPanelId = proof.getAttribute("aria-controls");
  var originalLeft = renderedCard.style.left;
  var originalTop = renderedCard.style.top;
  ["disclosure-label", "disclosure-chevron"].forEach(function (className, index) {
    dispatch(findByClass(proof, className), "pointerdown", {
      clientX: 10,
      clientY: 10,
      pointerId: index + 1,
    });
    assert.equal(renderedCard.classList.contains("dragging"), false);
    assert.equal(renderedCard.style.left, originalLeft);
    assert.equal(renderedCard.style.top, originalTop);
  });

  proof.focus();
  dispatch(proof, "keydown", { key: "Enter" });
  renderedCard = findCardByStatement(view.root, "Problem 1");
  proof = disclosure(renderedCard, "proof");
  lens = disclosure(renderedCard, "lens");
  assert.equal(proof.getAttribute("aria-expanded"), "true");
  assert.equal(lens.getAttribute("aria-expanded"), "false");
  assert.equal(controlledPanel(renderedCard, proof).hidden, false);
  assert.equal(document.activeElement, proof);

  dispatch(proof, "keydown", { key: " " });
  assert.equal(
    disclosure(findCardByStatement(view.root, "Problem 1"), "proof").getAttribute(
      "aria-expanded"
    ),
    "true"
  );
  dispatch(proof, "keyup", { key: " " });
  renderedCard = findCardByStatement(view.root, "Problem 1");
  proof = disclosure(renderedCard, "proof");
  lens = disclosure(renderedCard, "lens");
  assert.equal(proof.getAttribute("aria-expanded"), "false");
  assert.equal(proof.getAttribute("aria-controls"), proofPanelId);
  assert.ok(controlledPanel(renderedCard, proof));
  assert.equal(controlledPanel(renderedCard, proof).hidden, true);
  assert.equal(document.activeElement, proof);

  dispatch(lens, "click");
  renderedCard = findCardByStatement(view.root, "Problem 1");
  proof = disclosure(renderedCard, "proof");
  lens = disclosure(renderedCard, "lens");
  assert.equal(proof.getAttribute("aria-expanded"), "false");
  assert.equal(lens.getAttribute("aria-expanded"), "true");
  assert.equal(controlledPanel(renderedCard, lens).hidden, false);
});

test("lens disclosure follows frameworks-or-note predicate", function () {
  var emptyLens = card("card-1", "No lens", 40);
  var emptyView = mountBoard([emptyLens]);
  assert.equal(
    disclosure(findCardByStatement(emptyView.root, "No lens"), "lens"),
    null
  );

  var noteOnly = card("card-1", "Note only", 40);
  noteOnly.convergence_note = "A convergence note without frameworks.";
  var noteView = mountBoard([noteOnly]);
  assert.ok(
    disclosure(findCardByStatement(noteView.root, "Note only"), "lens")
  );
});

test("proof disclosures preserve mutations and replacement IDs start collapsed", function () {
  var proofless = card("card-1", "Mutable proof", 40);
  proofless.proof_points = [];
  var view = mountBoard([proofless]);
  var renderedCard = findCardByStatement(view.root, "Mutable proof");
  var proof = disclosure(renderedCard, "proof");

  assert.ok(proof, "expected Proof even without proof points");
  assert.equal(proof.getAttribute("aria-expanded"), "false");
  dispatch(proof, "click");
  renderedCard = findCardByStatement(view.root, "Mutable proof");
  proof = disclosure(renderedCard, "proof");
  var panel = controlledPanel(renderedCard, proof);
  assert.equal(panel.hidden, false);
  var addPoint = findByClass(panel, "add-point-btn");
  assert.ok(addPoint, "expected the existing proof add control");

  dispatch(addPoint, "click");
  renderedCard = findCardByStatement(view.root, "Mutable proof");
  proof = disclosure(renderedCard, "proof");
  panel = controlledPanel(renderedCard, proof);
  assert.equal(view.board.cards[0].proof_points.length, 1);
  var removePoint = findByClass(panel, "remove-point");
  assert.ok(removePoint, "expected the existing proof remove control");
  dispatch(removePoint, "click");
  assert.equal(view.board.cards[0].proof_points.length, 0);

  renderedCard = findCardByStatement(view.root, "Mutable proof");
  proof = disclosure(renderedCard, "proof");
  panel = controlledPanel(renderedCard, proof);
  dispatch(findByClass(panel, "add-point-btn"), "click");
  renderedCard = findCardByStatement(view.root, "Mutable proof");
  proof = disclosure(renderedCard, "proof");
  panel = controlledPanel(renderedCard, proof);
  var proofText = findByAttribute(panel, "contenteditable", "true");
  proofText.textContent = "Edited evidence";
  dispatch(proofText, "blur");
  assert.equal(view.board.cards[0].proof_points[0], "Edited evidence");

  dispatch(proof, "click");
  renderedCard = findCardByStatement(view.root, "Mutable proof");
  proof = disclosure(renderedCard, "proof");
  assert.equal(controlledPanel(renderedCard, proof).hidden, true);
  dispatch(proof, "click");
  renderedCard = findCardByStatement(view.root, "Mutable proof");
  proof = disclosure(renderedCard, "proof");
  panel = controlledPanel(renderedCard, proof);
  assert.equal(panel.hidden, false);
  assert.equal(
    findByAttribute(panel, "contenteditable", "true").textContent,
    "Edited evidence"
  );

  var originalId = view.board.cards[0].id;
  dispatch(findByTitle(renderedCard, "Duplicate"), "click");
  var duplicateId = view.board.cards[1].id;
  assert.equal(disclosure(cards(view.root)[0], "proof").getAttribute("aria-expanded"), "true");
  assert.equal(disclosure(cards(view.root)[1], "proof").getAttribute("aria-expanded"), "false");

  dragMergeElements(view, cards(view.root)[1], cards(view.root)[0]);
  var mergedId = view.board.cards[0].id;
  assert.equal(view.board.disclosures[originalId], undefined);
  assert.equal(view.board.disclosures[duplicateId], undefined);
  assert.equal(disclosure(cards(view.root)[0], "proof").getAttribute("aria-expanded"), "false");
  assert.deepEqual(view.board.disclosures[mergedId], {
    proof: false,
    lens: false,
  });

  dispatch(findByTitle(cards(view.root)[0], "Delete"), "click");
  assert.equal(view.board.disclosures[mergedId], undefined);
});

test("wave cycle uses shuffled complete bags and stays stable across rerenders", function () {
  var firstRandom = randomSpy(0);
  var view = mountBoard(eightCards(), { random: firstRandom });
  var initialWaves = cards(view.root).map(function (candidate) {
    return candidate.getAttribute("data-wave");
  });

  assert.deepEqual(initialWaves.slice(0, 4).sort(), waveNames.slice().sort());
  assert.deepEqual(initialWaves.slice(4, 8).sort(), waveNames.slice().sort());
  assert.equal(firstRandom.calls, 6);

  view.board.render();
  assert.deepEqual(
    cards(view.root).map(function (candidate) {
      return candidate.getAttribute("data-wave");
    }),
    initialWaves
  );
  assert.equal(firstRandom.calls, 6);

  var secondRandom = randomSpy(0.999);
  var secondView = mountBoard(eightCards(), { random: secondRandom });
  var secondWaves = cards(secondView.root).map(function (candidate) {
    return candidate.getAttribute("data-wave");
  });
  assert.notDeepEqual(secondWaves.slice(0, 4), initialWaves.slice(0, 4));
  assert.equal(secondRandom.calls, 6);
});

test("wave assignments stay valid after add, duplicate, and merge", function () {
  var view = mountBoard(threeCards(), { random: randomSpy(0) });

  dispatch(findByAria(view.root, "Add problem card"), "click");
  assertValidWaves(view.root);

  dispatch(
    findByTitle(findCardByStatement(view.root, "Problem 1"), "Duplicate"),
    "click"
  );
  assertValidWaves(view.root);

  dragMerge(view, "Problem 1", "Problem 2");
  assertValidWaves(view.root);
});

test("initial theme zone encloses a rendered collapsed card taller than its estimate", function () {
  var themedCards = [
    card("tall-card", "A tall collapsed problem statement", 40),
    card("peer-card", "A related problem statement", 380),
  ];
  themedCards.forEach(function (candidate) {
    candidate.tags = ["Shared theme"];
  });
  var tallCardHeight = 340;
  var view = mountBoard(themedCards, null, function (element) {
    if (!element.classList.contains("card")) return 0;
    var statement = findByClass(element, "problem-statement");
    return statement && statement.textContent === themedCards[0].problem_statement
      ? tallCardHeight
      : 260;
  });

  var zone = findByClass(view.root, "zone");
  var zoneBottom = parseFloat(zone.style.top) + parseFloat(zone.style.height);
  var tallCardBottom = themedCards[0].position.y + tallCardHeight;

  assert.ok(
    zoneBottom >= tallCardBottom,
    "expected the initial theme zone to enclose the rendered tall card"
  );
});

test("empty-canvas drag pans left, right, up, and down", function () {
  var view = mountBoard(threeCards());
  var canvas = findByClass(view.root, "board-canvas");
  canvas.scrollLeft = 500;
  canvas.scrollTop = 500;

  dispatch(canvas, "pointerdown", {
    pointerType: "mouse",
    button: 0,
    clientX: 400,
    clientY: 300,
    pointerId: 9,
  });

  assert.equal(canvas.classList.contains("panning"), true);
  assert.equal(canvas._capturedPointerId, 9);

  dispatch(canvas, "pointermove", { clientX: 300, clientY: 300, pointerId: 9 });
  assert.equal(canvas.scrollLeft, 600, "dragging left should pan right");
  assert.equal(canvas.scrollTop, 500);

  dispatch(canvas, "pointermove", { clientX: 500, clientY: 300, pointerId: 9 });
  assert.equal(canvas.scrollLeft, 400, "dragging right should pan left");
  assert.equal(canvas.scrollTop, 500);

  dispatch(canvas, "pointermove", { clientX: 400, clientY: 200, pointerId: 9 });
  assert.equal(canvas.scrollLeft, 500);
  assert.equal(canvas.scrollTop, 600, "dragging up should pan down");

  dispatch(canvas, "pointermove", { clientX: 400, clientY: 400, pointerId: 9 });
  assert.equal(canvas.scrollLeft, 500);
  assert.equal(canvas.scrollTop, 400, "dragging down should pan up");

  dispatch(canvas, "pointerup", { pointerId: 9 });
  assert.equal(canvas.classList.contains("panning"), false);
});

test("text control creates, edits, cancels, and deletes a lightweight label", function () {
  var view = mountBoard(oneCard());
  var textButton = findByAria(view.root, "Add text label");

  dispatch(textButton, "click");
  assert.equal(view.board.labels.length, 1);
  assert.equal(findAllByClass(view.root, "board-label").length, 1);

  var label = view.board.labels[0];
  var labelEl = view.board.labelEls[label.id];
  var textEl = view.board.labelTextEls[label.id];
  assert.equal(textEl.getAttribute("contenteditable"), "true");
  assert.equal(textEl.getAttribute("aria-multiline"), "false");
  assert.equal(document.activeElement, textEl);
  assert.equal(view.selection.ranges[0].selectedNode, textEl);

  textEl.textContent = "  Working   agreement  ";
  dispatch(textEl, "input");
  var enter = dispatch(textEl, "keydown", { key: "Enter" });
  assert.equal(enter.defaultPrevented, true);
  assert.equal(label.text, "Working agreement");
  assert.equal(textEl.textContent, "Working agreement");

  textEl.focus();
  textEl.textContent = "Canceled replacement";
  dispatch(textEl, "input");
  var escape = dispatch(textEl, "keydown", { key: "Escape" });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(label.text, "Working agreement");
  assert.equal(textEl.textContent, "Working agreement");

  dispatch(textButton, "click");
  var emptyLabel = view.board.labels[1];
  var emptyText = view.board.labelTextEls[emptyLabel.id];
  dispatch(emptyText, "keydown", { key: "Escape" });
  assert.equal(view.board.labels.length, 1);

  labelEl = view.board.labelEls[label.id];
  dispatch(findByAria(labelEl, "Delete text label"), "click");
  assert.equal(view.board.labels.length, 0);
  assert.equal(findAllByClass(view.root, "board-label").length, 0);
});

test("label editing leaves Enter and Escape to an active IME composition", function () {
  var view = mountBoard(oneCard());
  dispatch(findByAria(view.root, "Add text label"), "click");
  var label = view.board.labels[0];
  var textEl = view.board.labelTextEls[label.id];
  textEl.textContent = "作業中";
  dispatch(textEl, "input");

  var enter = dispatch(textEl, "keydown", {
    key: "Enter",
    isComposing: true,
  });
  assert.equal(enter.defaultPrevented, false);
  assert.equal(document.activeElement, textEl);
  assert.equal(label.text, "作業中");

  var escape = dispatch(textEl, "keydown", {
    key: "Escape",
    isComposing: true,
  });
  assert.equal(escape.defaultPrevented, false);
  assert.equal(document.activeElement, textEl);
  assert.equal(textEl.textContent, "作業中");

  var commit = dispatch(textEl, "keydown", { key: "Enter" });
  assert.equal(commit.defaultPrevented, true);
  assert.notEqual(document.activeElement, textEl);
  assert.equal(label.text, "作業中");
});

test("T shortcut adds a label but stays inert while text is being edited", function () {
  var view = mountBoard(oneCard());
  var prevented = false;

  document.dispatch("keydown", {
    key: "T",
    target: view.root,
    preventDefault: function () {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(view.board.labels.length, 1);

  var labelText = view.board.labelTextEls[view.board.labels[0].id];
  document.dispatch("keydown", {
    key: "t",
    target: labelText,
    preventDefault: function () {
      throw new Error("typing in a label must not activate the shortcut");
    },
  });
  assert.equal(view.board.labels.length, 1);

  document.dispatch("keydown", {
    key: "t",
    target: findByClass(view.root, "board-title"),
    preventDefault: function () {
      throw new Error("typing in the board title must not activate the shortcut");
    },
  });
  assert.equal(view.board.labels.length, 1);

  document.dispatch("keydown", {
    key: "t",
    target: view.root,
    ctrlKey: true,
    preventDefault: function () {
      throw new Error("modified browser shortcuts must be preserved");
    },
  });
  assert.equal(view.board.labels.length, 1);
});

test("labels drag independently and remain unchanged through Focus rerenders", function () {
  var view = mountBoard(threeCards());
  dispatch(findByAria(view.root, "Add text label"), "click");
  var label = view.board.labels[0];
  var textEl = view.board.labelTextEls[label.id];
  textEl.textContent = "Decision gate";
  dispatch(textEl, "input");
  textEl.blur();

  var labelEl = view.board.labelEls[label.id];
  var canvas = findByClass(view.root, "board-canvas");
  var start = { x: label.position.x, y: label.position.y };
  dispatch(labelEl, "pointerdown", {
    pointerType: "mouse",
    button: 0,
    pointerId: 7,
    clientX: start.x,
    clientY: start.y,
  });
  dispatch(labelEl, "pointermove", {
    pointerType: "mouse",
    button: 0,
    pointerId: 7,
    clientX: start.x + 48,
    clientY: start.y + 32,
  });
  dispatch(labelEl, "pointerup", {
    pointerType: "mouse",
    button: 0,
    pointerId: 7,
    clientX: start.x + 48,
    clientY: start.y + 32,
  });

  assert.deepEqual(label.position, { x: start.x + 48, y: start.y + 32 });
  assert.equal(canvas.classList.contains("panning"), false);
  assert.equal(view.board.activeDrag, null);

  dispatch(findByAria(view.root, "Focus cards"), "click");
  assert.equal(view.board.labels.length, 1);
  assert.equal(view.board.labels[0].text, "Decision gate");
  assert.deepEqual(view.board.labels[0].position, {
    x: start.x + 48,
    y: start.y + 32,
  });
  assert.equal(
    view.board.labelTextEls[label.id].textContent,
    "Decision gate"
  );
});

test("side panel controls expose hover screen tips", function () {
  var view = mountBoard(threeCards());
  var panel = findByClass(view.root, "side-panel");
  var controls = panel.children.filter(function (control) {
    return control.classList.contains("side-panel-btn");
  });

  assert.deepEqual(
    controls.map(function (control) {
      return control.getAttribute("data-tooltip");
    }),
    [
      "Add problem card",
      "Add text label (T)",
      "Toggle theme zones",
      "Focus cards for comparison",
    ]
  );
  assert.deepEqual(
    controls.map(function (control) {
      return control.getAttribute("aria-label");
    }),
    [
      "Add problem card",
      "Add text label",
      "Toggle theme zones",
      "Focus cards",
    ]
  );
  assert.deepEqual(
    controls.map(function (control) {
      return control.getAttribute("title");
    }),
    [null, null, null, null],
    "expected custom screen tips without duplicate browser tooltips"
  );

  dispatch(controls[3], "click");
  assert.equal(
    controls[2].getAttribute("data-tooltip"),
    "Theme zones are hidden in Focus Mode"
  );
  assert.equal(
    controls[3].getAttribute("data-tooltip"),
    "Exit Focus Mode"
  );

  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");
  assert.match(
    css,
    /\.side-panel-btn::after\s*\{[^}]*content:\s*attr\(data-tooltip\)/s,
    "expected custom tooltip content on side-panel controls"
  );
  assert.match(
    css,
    /\.side-panel-btn:hover::after[^}]*\.side-panel-btn:focus-visible::after/s,
    "expected screen tips on hover and keyboard focus"
  );
  assert.match(
    css,
    /\.side-panel-btn\s*\{[^}]*font-family:\s*inherit/s,
    "expected every side control and tooltip to use the whiteboard font"
  );
  assert.doesNotMatch(
    css,
    /font-family:\s*Georgia/i,
    "expected no serif-only font override in the whiteboard"
  );
});

test("tag-derived theme zones toggle without moving cards", function () {
  var data = threeCards();
  data[0].tags = ["activation"];
  data[1].tags = ["activation"];
  data[2].tags = ["ownership"];
  var view = mountBoard(data);
  var before = cardPositions(view.board);
  var zonesButton = findByAria(view.root, "Toggle theme zones");

  assert.equal(findAllByClass(view.root, "zone").length, 1);
  assert.equal(zonesButton.getAttribute("aria-pressed"), "true");
  dispatch(zonesButton, "click");
  assert.equal(findAllByClass(view.root, "zone").length, 0);
  assert.equal(zonesButton.getAttribute("aria-pressed"), "false");
  assert.deepEqual(cardPositions(view.board), before);

  dispatch(zonesButton, "click");
  assert.equal(findAllByClass(view.root, "zone").length, 1);
  assert.equal(zonesButton.getAttribute("aria-pressed"), "true");
  assert.deepEqual(cardPositions(view.board), before);
});

test("keyword theme zones hide during Focus and restore without moving cards", function () {
  var data = [
    card("card-1", "Shared onboarding friction", 40),
    card("card-2", "Shared onboarding delays", 300),
  ];
  data[0].impact = "Teams see shared onboarding friction during setup";
  data[1].impact = "Teams see shared onboarding delays during setup";
  var view = mountBoard(data);
  var before = cardPositions(view.board);
  var zonesButton = findByAria(view.root, "Toggle theme zones");
  var focusButton = findByAria(view.root, "Focus cards");

  assert.equal(findAllByClass(view.root, "zone").length, 1);
  dispatch(focusButton, "click");
  assert.equal(findAllByClass(view.root, "zone").length, 0);
  zonesButton = findByAria(view.root, "Theme zones are hidden in Focus Mode");
  assert.ok(zonesButton);
  assert.equal(zonesButton.disabled, true);
  assert.deepEqual(cardPositions(view.board), before);

  dispatch(findByAria(view.root, "Exit Focus Mode"), "click");
  zonesButton = findByAria(view.root, "Toggle theme zones");
  assert.equal(findAllByClass(view.root, "zone").length, 1);
  assert.equal(zonesButton.disabled, false);
  assert.deepEqual(cardPositions(view.board), before);

  dispatch(zonesButton, "click");
  assert.equal(zonesButton.getAttribute("aria-pressed"), "false");
  assert.equal(findAllByClass(view.root, "zone").length, 0);
  dispatch(findByAria(view.root, "Focus cards"), "click");
  dispatch(findByAria(view.root, "Exit Focus Mode"), "click");
  zonesButton = findByAria(view.root, "Toggle theme zones");
  assert.equal(zonesButton.getAttribute("aria-pressed"), "false");
  assert.equal(findAllByClass(view.root, "zone").length, 0);
  assert.deepEqual(cardPositions(view.board), before);
});

function cssHex(declarations, variableName) {
  var match = new RegExp(
    "--" + variableName + "\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;"
  ).exec(declarations);
  assert.ok(match, "expected --" + variableName + " to have a hex value");
  return match[1];
}

function relativeLuminance(hex) {
  var channels = [1, 3, 5].map(function (offset) {
    var value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  var firstLuminance = relativeLuminance(first);
  var secondLuminance = relativeLuminance(second);
  var lighter = Math.max(firstLuminance, secondLuminance);
  var darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function cssRule(css, selectorPattern) {
  var source =
    selectorPattern instanceof RegExp
      ? selectorPattern.source
      : selectorPattern;
  var match = new RegExp(
    "(?:^|\\n)\\s*" + source + "\\s*\\{([^}]*)\\}",
    "s"
  ).exec(css);
  assert.ok(match, "expected CSS rule matching " + source);
  return match[1];
}

function cssValue(declarations, propertyName) {
  var escapedName = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var match = new RegExp(
    "(?:^|;)\\s*" + escapedName + "\\s*:\\s*([^;]+);",
    "m"
  ).exec(declarations);
  assert.ok(match, "expected " + propertyName + " in CSS declarations");
  return match[1].trim();
}

function cssProperty(declarations, propertyName) {
  var match = new RegExp(
    propertyName + "\\s*:\\s*(var\\(--[^)]+\\)|#[0-9a-fA-F]{3,6})\\s*;"
  ).exec(declarations);
  assert.ok(match, "expected " + propertyName + " to declare a CSS color");
  return match[1];
}

function resolveCssColor(value, rootDeclarations) {
  var variable = /^var\(--([^)]+)\)$/.exec(value);
  if (variable) return cssHex(rootDeclarations, variable[1]);
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return (
      "#" +
      value
        .slice(1)
        .split("")
        .map(function (character) {
          return character + character;
        })
        .join("")
    );
  }
  return value;
}

function cssBlockAfter(css, marker) {
  var markerIndex = css.indexOf(marker);
  while (markerIndex >= 0) {
    var afterMarker = css.slice(markerIndex + marker.length);
    if (/^\s*\{/.test(afterMarker) || marker.indexOf("@media") === 0) break;
    markerIndex = css.indexOf(marker, markerIndex + marker.length);
  }
  assert.ok(markerIndex >= 0, "expected CSS marker " + marker);
  var openIndex = css.indexOf("{", markerIndex);
  assert.ok(openIndex >= 0, "expected CSS block after " + marker);
  var depth = 0;
  for (var index = openIndex; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(openIndex + 1, index);
    }
  }
  assert.fail("expected balanced CSS block after " + marker);
}

test("quiet top bar keeps layout responsive and chrome contrast accessible", function () {
  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");
  var toolbar = cssBlockAfter(css, ".board-toolbar");
  var brand = cssBlockAfter(css, ".board-brand");
  var title = cssBlockAfter(css, ".board-toolbar h1");
  var copyContext = cssBlockAfter(css, ".copy-context");
  var compact = cssBlockAfter(css, ".focus-status-compact");
  var indicator = cssBlockAfter(css, ".focus-status-indicator");
  var clear = cssBlockAfter(css, ".focus-clear");
  var status = cssBlockAfter(css, ".board-status");
  var statusText = cssBlockAfter(css, ".focus-status-text");
  var breakpoint = cssBlockAfter(css, "@media (max-width: 640px)");
  var lightRoot = cssBlockAfter(css, ":root");
  var darkRoot = cssBlockAfter(css, "@media (prefers-color-scheme: dark)");
  darkRoot = cssBlockAfter(darkRoot, ":root");

  assert.match(toolbar, /height:\s*52px/);
  assert.match(toolbar, /gap:\s*10px/);
  assert.match(toolbar, /padding:\s*0\s+16px/);
  assert.match(cssBlockAfter(css, ".board-canvas"), /top:\s*52px/);
  assert.match(cssBlockAfter(css, ".board-divider"), /height:\s*22px/);
  [
    ["min-width", "0"],
    ["flex", "1 1 auto"],
    ["margin", "0"],
    ["overflow", "hidden"],
    ["font-size", "15px"],
    ["font-weight", "700"],
    ["text-overflow", "ellipsis"],
    ["white-space", "nowrap"],
    ["color", "var(--chrome-ink)"]
  ].forEach(function (declaration) {
    assert.match(
      title,
      new RegExp(
        declaration[0] +
          "\\s*:\\s*" +
          declaration[1]
            .replaceAll("(", "\\(")
            .replaceAll(")", "\\)")
            .replace(/ /g, "\\s*")
      )
    );
  });
  assert.match(compact, /display:\s*none/);
  assert.match(indicator, /background:\s*var\(--accent\)/);
  assert.match(clear, /color:\s*var\(--accent\)/);
  assert.match(status, /display:\s*flex/);
  assert.match(status, /align-items:\s*center/);
  assert.match(status, /flex:\s*none/);
  assert.match(statusText, /display:\s*flex/);
  assert.match(statusText, /align-items:\s*center/);
  assert.match(copyContext, /flex:\s*none/);
  assert.match(copyContext, /border:\s*1px\s+solid\s+var\(--toolbar-border\)/);
  assert.match(copyContext, /color:\s*var\(--chrome-ink\)/);
  assert.match(copyContext, /white-space:\s*nowrap/);
  assert.match(
    cssBlockAfter(css, ".copy-context:focus-visible"),
    /outline:\s*2px[^;]*var\(--accent-ring\)/
  );
  assert.match(brand, /gap:\s*8px/);
  assert.match(cssBlockAfter(css, ".board-brand .wordmark"), /color:\s*var\(--chrome-ink\)/);
  assert.match(title, /color:\s*var\(--chrome-ink\)/);
  assert.match(cssBlockAfter(css, ".focus-clear:focus-visible"), /outline:\s*2px[^;]*var\(--accent-ring\)/);
  assert.doesNotMatch(css, /\.source-summary/);
  assert.doesNotMatch(css, /\.board-scratch-note/);

  assert.match(breakpoint, /\.board-toolbar\s*\{[^}]*gap:\s*6px[^}]*padding:\s*0\s+10px/s);
  assert.match(breakpoint, /\.board-brand\s*\{[^}]*gap:\s*6px/s);
  assert.match(breakpoint, /\.board-status\s*\{[^}]*gap:\s*5px[^}]*margin-left:\s*4px/s);
  assert.match(breakpoint, /\.focus-status-full\s*\{[^}]*display:\s*none/s);
  assert.match(breakpoint, /\.focus-status-compact\s*\{[^}]*display:\s*inline/s);
  assert.match(breakpoint, /\.focus-clear\s*\{[^}]*padding:\s*4px\s+6px/s);
  assert.match(breakpoint, /\.copy-context\s*\{[^}]*padding:\s*6px\s+8px/s);
  assert.doesNotMatch(breakpoint, /\.board-divider\s*\{/);
  assert.doesNotMatch(breakpoint, /\.board-toolbar h1\s*\{[^}]*font-size\s*:/s);
  assert.doesNotMatch(breakpoint, /\.board-brand[^}]*display:\s*none|\.focus-clear[^}]*display:\s*none/s);

  [lightRoot, darkRoot].forEach(function (root) {
    var toolbarBackground = cssHex(root, "toolbar-bg");
    ["chrome-ink", "chrome-ink-soft", "accent"].forEach(function (name) {
      assert.ok(contrastRatio(cssHex(root, name), toolbarBackground) >= 4.5);
    });
    assert.ok(contrastRatio(cssHex(root, "accent-ring"), toolbarBackground) >= 3);
  });
});

test("quiet top bar hover affordance keeps accent contrast accessible", function () {
  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");
  var hoverRule = /\.focus-clear:hover:not\(:disabled\)\s*\{([^}]*)\}/.exec(css);
  assert.ok(hoverRule, "expected a Focus Clear hover rule");
  assert.match(hoverRule[1], /text-decoration:\s*underline/);
  assert.match(hoverRule[1], /text-underline-offset:\s*2px/);
  var background = /background:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/.exec(hoverRule[1]);
  assert.ok(background, "expected a translucent hover background");
  var roots = css.match(/:root\s*\{[^}]*\}/g) || [];
  assert.ok(roots.length >= 2, "expected light and dark :root declarations");

  roots.slice(0, 2).forEach(function (root) {
    var toolbar = cssHex(root, "toolbar-bg").slice(1);
    var toolbarRgb = [0, 2, 4].map(function (offset) {
      return parseInt(toolbar.slice(offset, offset + 2), 16);
    });
    var alpha = Number(background[4]);
    var hoverRgb = [1, 2, 3].map(function (channel) {
      return Math.round(Number(background[channel]) * alpha + toolbarRgb[channel - 1] * (1 - alpha));
    });
    var hoverHex = "#" + hoverRgb.map(function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
    assert.ok(
      contrastRatio(cssHex(root, "accent"), hoverHex) >= 4.5,
      "hover accent contrast was below 4.5:1"
    );
  });
});

test("sticky waves use the approved palette and readable text tones", function () {
  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");
  var root = cssRule(css, ":root");
  var waves = {
    "vivid-blue": ["#DAE4FA", "#3D7BFA", "#2451AD"],
    coral: ["#FCDFD5", "#FF6B57", "#9B3327"],
    "warm-yellow": ["#FDEAB9", "#FFC83D", "#725200"],
    "deep-navy": ["#AAB9D0", "#0F2341", "#0F2341"],
  };
  var stickyInk = cssValue(root, "--sticky-ink");
  var impactInk = cssValue(root, "--sticky-impact-ink");
  var disclosureRing = cssValue(root, "--disclosure-focus-ring");
  var tensionEdge = cssValue(root, "--tension-edge");

  assert.equal(stickyInk.toUpperCase(), "#18202B");
  assert.equal(impactInk.toUpperCase(), "#3D4652");
  assert.equal(disclosureRing.toUpperCase(), "#2456A6");
  assert.equal(tensionEdge.toUpperCase(), "#624700");

  Object.keys(waves).forEach(function (name) {
    var expected = waves[name];
    var paper = cssValue(root, "--wave-" + name + "-paper");
    var accent = cssValue(root, "--wave-" + name + "-accent");
    var label = cssValue(root, "--wave-" + name + "-label");
    assert.deepEqual(
      [paper, accent, label].map(function (value) {
        return value.toUpperCase();
      }),
      expected
    );
    [stickyInk, impactInk, label].forEach(function (tone) {
      assert.ok(
        contrastRatio(tone, paper) >= 4.5,
        name + " text must reach 4.5:1 on its paper"
      );
    });
    [disclosureRing, tensionEdge].forEach(function (indicator) {
      assert.ok(
        contrastRatio(indicator, paper) >= 3,
        name + " indicator must reach 3:1 on its paper"
      );
    });

    var waveRule = cssRule(
      css,
      "\\.card\\[data-wave=\\\"" + name + "\\\"\\]"
    );
    assert.equal(
      cssValue(waveRule, "--sticky-paper"),
      "var(--wave-" + name + "-paper)"
    );
    assert.equal(
      cssValue(waveRule, "--sticky-accent"),
      "var(--wave-" + name + "-accent)"
    );
    assert.equal(
      cssValue(waveRule, "--sticky-label"),
      "var(--wave-" + name + "-label)"
    );
  });
});

test("sticky CSS matches the reference geometry and semantic exceptions", function () {
  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");
  var js = fs.readFileSync(runtimePath("whiteboard.js"), "utf8");
  var cardRule = cssRule(css, "\\.card");
  var stickyRule = cssRule(css, "\\.sticky");
  var signalRule = cssRule(css, "\\.signal-block");
  var labelsRule = cssRule(css, "\\.signal-label\\s*,\\s*\\.card-label");
  var problemRule = cssRule(css, "\\.problem-statement");
  var impactLabelRule = cssRule(
    css,
    "\\.problem-statement\\s*\\+\\s*\\.card-label"
  );
  var impactRule = cssRule(css, "\\.impact-copy");
  var disclosureRule = cssRule(css, "\\.disclosure-toggle");
  var panelRule = cssRule(css, "\\.disclosure-panel");
  var foldRule = cssRule(css, "\\.sticky::after");
  var toolbarRule = cssRule(css, "\\.card \\.card-toolbar");
  var stackRule = cssRule(css, "\\.stack-layer");
  var removePointRule = cssRule(css, "\\.remove-point");
  var removePointHoverRule = cssRule(css, "\\.remove-point:hover");
  var addPointRule = cssRule(css, "\\.add-point-btn");
  var openChevronRule = cssRule(
    css,
    "\\.disclosure-toggle\\[aria-expanded=\\\"true\\\"\\] " +
      "\\.disclosure-chevron"
  );

  assert.match(js, /var CARD_W = 300;/);
  assert.equal(cssValue(cardRule, "width"), "300px");
  assert.equal(cssValue(stickyRule, "padding"), "28px 24px 20px");
  assert.equal(cssValue(stickyRule, "border-radius"), "10px");
  assert.equal(
    cssValue(stickyRule, "box-shadow"),
    "0 8px 20px rgba(0, 0, 0, 0.24)"
  );
  assert.equal(cssValue(stickyRule, "background"), "var(--sticky-paper)");
  assert.doesNotMatch(stickyRule, /(?:^|;)\s*border\s*:/m);

  assert.equal(cssValue(signalRule, "align-items"), "center");
  assert.equal(cssValue(signalRule, "justify-content"), "flex-start");
  assert.equal(cssValue(signalRule, "margin"), "0 0 20px");
  assert.equal(cssValue(labelsRule, "font-size"), "10px");
  assert.equal(cssValue(labelsRule, "font-weight"), "700");
  assert.equal(cssValue(labelsRule, "line-height"), "1");
  assert.equal(cssValue(labelsRule, "letter-spacing"), "0.05em");
  assert.equal(cssValue(problemRule, "font-size"), "24px");
  assert.equal(cssValue(problemRule, "font-weight"), "800");
  assert.equal(cssValue(problemRule, "line-height"), "1.2");
  assert.equal(cssValue(problemRule, "letter-spacing"), "-0.03em");
  assert.equal(cssValue(impactLabelRule, "margin-top"), "20px");
  assert.equal(cssValue(impactRule, "font-size"), "13px");
  assert.equal(cssValue(impactRule, "font-weight"), "400");
  assert.equal(cssValue(impactRule, "line-height"), "1.5");

  assert.equal(cssValue(disclosureRule, "margin-top"), "12px");
  assert.equal(cssValue(disclosureRule, "padding"), "13px 14px");
  assert.equal(
    cssValue(disclosureRule, "border"),
    "1px solid color-mix(in srgb, var(--sticky-accent) 28%, transparent)"
  );
  assert.equal(cssValue(disclosureRule, "border-radius"), "8px");
  assert.equal(cssValue(disclosureRule, "background"), "transparent");
  assert.equal(cssValue(disclosureRule, "color"), "var(--sticky-ink)");
  assert.equal(cssValue(disclosureRule, "font-weight"), "700");
  assert.equal(cssValue(disclosureRule, "cursor"), "pointer");
  assert.match(
    js,
    /class:\s*"disclosure-chevron"[\s\S]*?text:\s*"▸"/
  );
  assert.doesNotMatch(js, /text:\s*open\s*\?/);
  assert.equal(cssValue(openChevronRule, "transform"), "rotate(90deg)");
  assert.equal(cssValue(panelRule, "margin-top"), "-8px");
  assert.equal(cssValue(panelRule, "padding"), "16px 14px 13px");
  assert.equal(
    cssValue(panelRule, "border"),
    "1px solid color-mix(in srgb, var(--sticky-accent) 28%, transparent)"
  );
  assert.equal(cssValue(panelRule, "border-top"), "0");
  assert.equal(cssValue(panelRule, "border-radius"), "0 0 8px 8px");
  assert.doesNotMatch(
    panelRule,
    /(?:^|;)\s*(?:height|max-height|overflow)\s*:/m
  );
  assert.equal(
    cssValue(cssRule(css, "\\.disclosure-panel\\[hidden\\]"), "display"),
    "none"
  );

  assert.equal(cssValue(foldRule, "width"), "32px");
  assert.equal(cssValue(foldRule, "height"), "32px");
  assert.equal(cssValue(foldRule, "background"), "var(--sticky-accent)");
  assert.equal(
    cssValue(foldRule, "clip-path"),
    "polygon(0 0, 100% 0, 100% 100%)"
  );
  assert.equal(cssValue(foldRule, "border-radius"), "0 10px 0 0");
  assert.equal(
    cssValue(foldRule, "box-shadow"),
    "-2px 2px 3px rgba(0, 0, 0, 0.16)"
  );
  assert.equal(cssValue(foldRule, "pointer-events"), "none");
  assert.doesNotMatch(foldRule, /(?:#fff(?:fff)?|gradient)/i);
  assert.doesNotMatch(css, /\.sticky::before/);
  assert.equal(cssValue(toolbarRule, "z-index"), "2");
  assert.equal(cssValue(stackRule, "background"), "var(--sticky-paper)");
  assert.equal(cssValue(stackRule, "border-radius"), "10px");
  assert.equal(
    cssValue(stackRule, "box-shadow"),
    "0 5px 14px rgba(0, 0, 0, 0.20)"
  );
  assert.doesNotMatch(stackRule, /(?:^|;)\s*border\s*:/m);
  assert.equal(cssValue(removePointRule, "color"), "var(--sticky-label)");
  assert.equal(
    cssValue(removePointHoverRule, "color"),
    "var(--sticky-ink)"
  );
  assert.equal(cssValue(addPointRule, "color"), "var(--sticky-label)");

  var signalDotRule = cssRule(css, "\\.signal-dot");
  assert.equal(
    cssValue(signalDotRule, "border"),
    "1.5px solid var(--sticky-accent)"
  );
  assert.equal(
    cssValue(signalDotRule, "outline"),
    "1px solid var(--sticky-ink)"
  );
  assert.equal(
    cssValue(
      cssRule(css, "\\.signal-dot\\[data-confidence=\\\"high\\\"\\]"),
      "background"
    ),
    "var(--sticky-accent)"
  );
  assert.equal(
    cssValue(
      cssRule(css, "\\.signal-dot\\[data-confidence=\\\"medium\\\"\\]"),
      "background"
    ),
    "linear-gradient(90deg, var(--sticky-accent) 50%, transparent 50%)"
  );
  var lowRule = cssRule(
    css,
    "\\.signal-dot\\[data-confidence=\\\"low\\\"\\]"
  );
  assert.equal(cssValue(lowRule, "border-color"), "var(--sticky-accent)");
  assert.equal(
    cssValue(lowRule, "background"),
    "radial-gradient(circle, var(--sticky-accent) 28%, transparent 30%)"
  );
  assert.equal(
    cssValue(cssRule(css, "\\.proof-points li::marker"), "color"),
    "var(--sticky-accent)"
  );

  assert.equal(
    cssValue(
      cssRule(css, "\\.card\\[data-convergence=\\\"partial\\\"\\] \\.sticky"),
      "box-shadow"
    ),
    "0 10px 24px rgba(0, 0, 0, 0.28)"
  );
  assert.equal(
    cssValue(
      cssRule(css, "\\.card\\[data-convergence=\\\"strong\\\"\\] \\.sticky"),
      "box-shadow"
    ),
    "0 14px 30px rgba(0, 0, 0, 0.34)"
  );
  assert.equal(
    cssValue(
      cssRule(css, "\\.card\\[data-convergence=\\\"partial\\\"\\] \\.stack-layer"),
      "box-shadow"
    ),
    "0 7px 18px rgba(0, 0, 0, 0.24)"
  );
  assert.equal(
    cssValue(
      cssRule(css, "\\.card\\[data-convergence=\\\"strong\\\"\\] \\.stack-layer"),
      "box-shadow"
    ),
    "0 9px 22px rgba(0, 0, 0, 0.28)"
  );
  assert.equal(
    cssValue(cssRule(css, "\\.card\\.focus-focused \\.sticky"), "box-shadow"),
    "0 14px 30px rgba(0, 0, 0, 0.32)"
  );
  assert.equal(
    cssValue(
      cssRule(
        css,
        "\\.card\\.focus-focused\\[data-convergence=\\\"partial\\\"\\] " +
          "\\.sticky"
      ),
      "box-shadow"
    ),
    "0 17px 36px rgba(0, 0, 0, 0.36)"
  );
  assert.equal(
    cssValue(
      cssRule(
        css,
        "\\.card\\.focus-focused\\[data-convergence=\\\"strong\\\"\\] " +
          "\\.sticky"
      ),
      "box-shadow"
    ),
    "0 20px 42px rgba(0, 0, 0, 0.40)"
  );

  assert.equal(
    cssValue(cssRule(css, "\\.sticky\\[data-tension=\\\"true\\\"\\]"), "border-bottom"),
    "4px dashed var(--tension-edge)"
  );
  assert.equal(
    cssValue(cssRule(css, "\\.card\\.merge-target \\.sticky"), "outline"),
    "2px solid var(--accent-ring)"
  );
  var focusSelectableRule = cssRule(
    css,
    "\\.card\\.focus-selectable:hover \\.sticky\\s*,[^\\{]*" +
      "\\.card\\.focus-selectable:focus-visible \\.sticky[^\\{]*"
  );
  assert.equal(
    cssValue(focusSelectableRule, "outline"),
    "2px dashed var(--card-focus-ring)"
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.disclosure-toggle,\s*\.disclosure-chevron,\s*\.disclosure-panel\s*\{[^}]*transition:\s*none;/s
  );
});

test("focus toggle enters live selection and remembers the set", function () {
  var view = mountBoard(threeCards());
  var focusButton = findByTooltip(view.root, "Focus cards for comparison");

  assert.ok(focusButton, "expected a Focus cards control");
  dispatch(focusButton, "click");
  assert.equal(focusButton.getAttribute("aria-pressed"), "true");
  cards(view.root).forEach(function (candidate) {
    assert.equal(candidate.classList.contains("focus-selectable"), true);
    assert.equal(candidate.classList.contains("focus-dimmed"), false);
    var initialDisclosures = findAllByClass(candidate, "disclosure-toggle");
    assert.ok(initialDisclosures.length >= 1);
    initialDisclosures.forEach(function (toggle) {
      assert.equal(toggle.hidden, false);
      assert.equal(toggle.disabled, true);
    });
  });
  var disabledProof = disclosure(cards(view.root)[0], "proof");
  var disabledExpanded = disabledProof.getAttribute("aria-expanded");
  var focusedId = view.board.cards[0].id;
  var focusCount = view.board.focus.count();
  var focusMembership = view.board.focus.has(focusedId);
  var focusCardState = cards(view.root)[0].className;
  dispatch(findByClass(disabledProof, "disclosure-label"), "click");
  assert.equal(
    disclosure(cards(view.root)[0], "proof").getAttribute("aria-expanded"),
    disabledExpanded
  );
  assert.equal(view.board.focus.count(), focusCount);
  assert.equal(view.board.focus.has(focusedId), focusMembership);
  assert.equal(cards(view.root)[0].className, focusCardState);

  dispatch(cards(view.root)[0], "click");
  assert.equal(cards(view.root)[0].classList.contains("focus-focused"), true);
  assert.equal(cards(view.root)[1].classList.contains("focus-dimmed"), true);
  assert.equal(
    findByClass(view.root, "focus-status-full").textContent,
    "1 card focused"
  );
  var focusedDisclosures = findAllByClass(
    cards(view.root)[0],
    "disclosure-toggle"
  );
  assert.ok(focusedDisclosures.length >= 2);
  focusedDisclosures.forEach(function (toggle) {
    assert.equal(toggle.disabled, false);
  });
  var dimmedDisclosures = findAllByClass(
    cards(view.root)[1],
    "disclosure-toggle"
  );
  assert.ok(dimmedDisclosures.length >= 1);
  dimmedDisclosures.forEach(function (toggle) {
    assert.equal(toggle.disabled, true);
  });

  dispatch(focusButton, "click");
  cards(view.root).forEach(function (candidate) {
    assert.equal(candidate.classList.contains("focus-dimmed"), false);
  });
  dispatch(focusButton, "click");
  assert.equal(cards(view.root)[0].classList.contains("focus-focused"), true);
});

test("dimmed card click and keyboard activation add it to focus", function () {
  var view = enterFocus(threeCards());
  dispatch(cards(view.root)[0], "click");

  var second = findCardByStatement(view.root, "Problem 2");
  assert.equal(second.getAttribute("role"), "button");
  assert.equal(second.getAttribute("tabindex"), "0");
  assert.equal(second.getAttribute("aria-label"), "Add Problem 2 to focus");
  second.focus();
  var enterEvent = dispatch(second, "keydown", { key: "Enter" });
  assert.equal(enterEvent.defaultPrevented, true);
  assert.equal(
    findCardByStatement(view.root, "Problem 2").classList.contains(
      "focus-focused"
    ),
    true
  );
  assert.equal(
    document.activeElement,
    findCardByStatement(view.root, "Problem 2")
  );
  assert.equal(document.activeElement.getAttribute("role"), "group");
  assert.equal(
    document.activeElement.getAttribute("aria-label"),
    "Focused card: Problem 2"
  );

  var third = findCardByStatement(view.root, "Problem 3");
  third.focus();
  var spaceEvent = dispatch(third, "keydown", { key: " " });
  assert.equal(spaceEvent.defaultPrevented, true);
  assert.equal(
    findCardByStatement(view.root, "Problem 3").classList.contains(
      "focus-focused"
    ),
    true
  );
  assert.equal(
    findByClass(view.root, "focus-status-full").textContent,
    "3 cards focused"
  );
  assert.equal(
    document.activeElement,
    findCardByStatement(view.root, "Problem 3")
  );
  assert.equal(document.activeElement.getAttribute("role"), "group");
  assert.equal(
    document.activeElement.getAttribute("aria-label"),
    "Focused card: Problem 3"
  );
});

test("subtle card control removes focus and clear returns to selection", function () {
  var view = enterFocus(threeCards());
  dispatch(cards(view.root)[0], "click");
  dispatch(cards(view.root)[1], "click");

  var remove = findByAria(cards(view.root)[0], "Remove from focus");
  assert.ok(remove, "expected a Remove from focus control");
  assert.equal(remove.getAttribute("title"), "Remove from focus");
  dispatch(remove, "click");
  assert.equal(cards(view.root)[0].classList.contains("focus-dimmed"), true);
  assert.equal(
    document.activeElement,
    findCardByStatement(view.root, "Problem 1")
  );

  var clearButton = findByAria(view.root, "Clear focused cards");
  assert.ok(clearButton, "expected a Clear focused cards control");
  dispatch(clearButton, "click");
  cards(view.root).forEach(function (candidate) {
    assert.equal(candidate.classList.contains("focus-selectable"), true);
    assert.equal(candidate.classList.contains("focus-dimmed"), false);
  });
  assert.equal(
    document.activeElement.getAttribute("aria-label"),
    "Exit Focus Mode"
  );
});

test("dark Focus chrome and indicators meet contrast thresholds", function () {
  var css = fs.readFileSync(runtimePath("whiteboard.css"), "utf8");
  var roots = css.match(/:root\s*\{[^}]*\}/g) || [];
  assert.ok(roots.length >= 2, "expected light and dark :root declarations");

  assert.match(
    css,
    /\.focus-status-text\s*\{[^}]*color:\s*var\(--chrome-ink-soft\)/,
    "expected the focus status to use the dedicated chrome color"
  );
  assert.match(
    css,
    /\.side-panel-btn\s*\{[^}]*color:\s*var\(--chrome-ink-soft\)/,
    "expected inactive side-panel controls to use the dedicated chrome color"
  );
  assert.match(
    css,
    /outline:\s*2px dashed var\(--card-focus-ring\)/,
    "expected Focus card outlines to use the dedicated ring color"
  );

  var darkRoot = roots[1];
  var chrome = cssHex(darkRoot, "chrome-ink-soft");
  var toolbar = cssHex(darkRoot, "toolbar-bg");
  var ring = cssHex(darkRoot, "card-focus-ring");
  var chromeContrast = contrastRatio(chrome, toolbar);
  assert.ok(
    chromeContrast >= 4.5,
    "dark Focus chrome contrast was " + chromeContrast.toFixed(2) + ":1"
  );

  var activeRule = /\.side-panel-btn\.active\s*\{([^}]*)\}/.exec(css);
  assert.ok(activeRule, "expected the active Focus side-panel rule");
  var activeBackground = cssProperty(activeRule[1], "background");
  var activeForeground = cssProperty(activeRule[1], "color");
  var activeContrast = contrastRatio(
    resolveCssColor(activeForeground, darkRoot),
    resolveCssColor(activeBackground, darkRoot)
  );
  assert.ok(
    activeContrast >= 4.5,
    "dark active Focus contrast was " + activeContrast.toFixed(2) + ":1"
  );
  assert.equal(activeBackground, "var(--focus-active-bg)");
  assert.equal(activeForeground, "var(--focus-active-ink)");

  var board = cssHex(darkRoot, "board-bg");
  var boardRingContrast = contrastRatio(ring, board);
  assert.ok(
    boardRingContrast >= 3,
    "dark Focus ring contrast on board background was " +
      boardRingContrast.toFixed(2) + ":1"
  );

});

test("active add focuses the new card", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(findByAria(view.root, "Add problem card"), "click");
  assert.equal(focusedCards(view.root).length, 2);
  assert.equal(
    findCardByStatement(view.root, "New problem").classList.contains(
      "focus-focused"
    ),
    true
  );
});

test("add places the new card in the visible viewport", function () {
  var view = mountBoard(threeCards());
  var canvas = findByClass(view.root, "board-canvas");
  canvas.scrollLeft = 900;
  canvas.scrollTop = 600;

  dispatch(findByAria(view.root, "Add problem card"), "click");

  var added = findCardByStatement(view.root, "New problem");
  var left = parseFloat(added.style.left);
  var top = parseFloat(added.style.top);
  assert.ok(
    left >= 960 && left < 1260,
    "expected card within horizontal viewport"
  );
  assert.ok(
    top >= 680 && top < 880,
    "expected card within vertical viewport"
  );
});

test("active duplicate focuses the copy", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(
    findByTitle(findCardByStatement(view.root, "Problem 1"), "Duplicate"),
    "click"
  );
  var focusedCopies = focusedCards(view.root).filter(function (candidate) {
    return (
      findByClass(candidate, "problem-statement").textContent === "Problem 1"
    );
  });
  assert.equal(focusedCopies.length, 2);
});

test("missing duplicate source reconciles stale selections", function () {
  var view = enterFocus(threeCards());
  view.board.focus.add("missing-card");
  view.board.render();
  var cardCount = view.board.cards.length;
  assert.equal(
    findByClass(view.root, "focus-status-full").textContent,
    "1 card focused"
  );
  cards(view.root).forEach(function (candidate) {
    assert.equal(candidate.classList.contains("focus-dimmed"), true);
  });

  view.board._duplicateCard("missing-card");

  assert.equal(view.board.cards.length, cardCount);
  assert.equal(view.board.focus.has("missing-card"), false);
  assert.equal(
    findByClass(view.root, "focus-status-full").textContent,
    "Select cards to focus."
  );
  cards(view.root).forEach(function (candidate) {
    assert.equal(candidate.classList.contains("focus-selectable"), true);
  });
});

test("active delete removes focus membership", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(
    findByTitle(findCardByStatement(view.root, "Problem 1"), "Delete"),
    "click"
  );
  assert.equal(focusedCards(view.root).length, 0);
  cards(view.root).forEach(function (candidate) {
    assert.equal(candidate.classList.contains("focus-selectable"), true);
  });
});

test("off-mode add does not expand the remembered set", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(findByAria(view.root, "Exit Focus Mode"), "click");
  dispatch(findByAria(view.root, "Add problem card"), "click");
  dispatch(findByAria(view.root, "Focus cards"), "click");
  assert.equal(focusedCards(view.root).length, 1);
  assert.equal(
    findCardByStatement(view.root, "New problem").classList.contains(
      "focus-dimmed"
    ),
    true
  );
});

test("off-mode duplicate does not expand the remembered set", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(findByAria(view.root, "Exit Focus Mode"), "click");
  dispatch(
    findByTitle(findCardByStatement(view.root, "Problem 1"), "Duplicate"),
    "click"
  );
  dispatch(findByAria(view.root, "Focus cards"), "click");
  assert.equal(focusedCards(view.root).length, 1);
});

test("deleting a remembered card while focus is off reconciles the set", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(findByAria(view.root, "Exit Focus Mode"), "click");
  dispatch(
    findByTitle(findCardByStatement(view.root, "Problem 1"), "Delete"),
    "click"
  );
  dispatch(findByAria(view.root, "Focus cards"), "click");

  assert.equal(focusedCards(view.root).length, 0);
  cards(view.root).forEach(function (candidate) {
    assert.equal(candidate.classList.contains("focus-selectable"), true);
  });
});

test("active drag merge focuses its result and restores focus chrome", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(findCardByStatement(view.root, "Problem 2"), "click");

  dragMerge(view, "Problem 1", "Problem 2");

  assert.equal(focusedCards(view.root).length, 1);
  assert.equal(
    findByClass(view.root, "focus-status-full").textContent,
    "1 card focused"
  );
  assert.equal(findByAria(view.root, "Clear focused cards").hidden, false);
});

test("off-mode merge transfers remembered membership to its result", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(findByAria(view.root, "Exit Focus Mode"), "click");

  dragMerge(view, "Problem 1", "Problem 2");

  dispatch(findByAria(view.root, "Focus cards"), "click");
  assert.equal(focusedCards(view.root).length, 1);
});

test("entering focus cancels a pending drag merge", function () {
  var view = mountBoard(threeCards());
  var source = findCardByStatement(view.root, "Problem 1");
  var target = findCardByStatement(view.root, "Problem 2");
  beginDragMergeElements(view, source, target, 1);
  assert.equal(view.scheduler.jobsByDelay(1500).length, 1);
  assert.ok(findByClass(view.root, "merge-target"));

  dispatch(findByAria(view.root, "Focus cards"), "click");

  assert.equal(view.scheduler.pendingCount(), 0);
  assert.equal(view.board.activeDrag, null);
  assert.equal(findByClass(view.root, "merge-target"), null);
  assert.equal(view.board.cards.length, 3);
});

test("focus chrome keeps Add available and focused cards editable and draggable", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(findCardByStatement(view.root, "Problem 2"), "click");
  assert.equal(findByAria(view.root, "Add problem card").disabled, false);
  assert.equal(
    findByTooltip(view.root, "Theme zones are hidden in Focus Mode").disabled,
    true
  );
  assert.equal(findByAria(view.root, "Clear focused cards").hidden, false);
  assert.equal(findByAria(view.root, "Clear focused cards").disabled, false);
  assert.equal(
    findByClass(view.root, "focus-status-full").textContent,
    "2 cards focused"
  );

  var focused = findCardByStatement(view.root, "Problem 1");
  assert.equal(focused.classList.contains("focus-focused"), true);
  assert.ok(findByTitle(focused, "Duplicate"));
  assert.ok(findByTitle(focused, "Delete"));
  assert.ok(findByAria(focused, "Remove from focus"));
  assert.ok(findByClass(focused, "add-point-btn"));
  assert.ok(findByClass(focused, "remove-point"));
  var focusedDisclosures = findAllByClass(focused, "disclosure-toggle");
  assert.equal(focusedDisclosures.length, 2);
  focusedDisclosures.forEach(function (toggle) {
    assert.equal(toggle.disabled, false);
  });
  var editableStatement = findByClass(focused, "problem-statement");
  assert.equal(editableStatement.getAttribute("contenteditable"), "true");
  var originalLeft = focused.style.left;
  dispatch(focused, "pointerdown", {
    clientX: 40,
    clientY: 40,
    pointerId: 1,
  });
  dispatch(focused, "pointermove", {
    clientX: 80,
    clientY: 40,
    pointerId: 1,
  });
  assert.notEqual(focused.style.left, originalLeft);
  assert.equal(findByAria(view.root, "Exit Focus Mode").disabled, false);
});

test("focus selection supports keyboard activation without merge-selection state", function () {
  var view = enterFocus(threeCards());
  var selectable = findCardByStatement(view.root, "Problem 1");
  assert.equal(selectable.getAttribute("role"), "button");
  assert.equal(selectable.getAttribute("tabindex"), "0");
  assert.equal(selectable.getAttribute("aria-label"), "Add Problem 1 to focus");
  selectable.focus();

  var enterSelect = dispatch(selectable, "keydown", { key: "Enter" });
  assert.equal(enterSelect.defaultPrevented, true);
  var focused = findCardByStatement(view.root, "Problem 1");
  assert.equal(document.activeElement, focused);
  assert.equal(focused.classList.contains("focus-focused"), true);
  assert.equal(focused.getAttribute("role"), "group");
  assert.equal(focused.getAttribute("aria-label"), "Focused card: Problem 1");
  assert.equal(focused.hasAttribute("aria-pressed"), false);
});

test("dimmed cards are pointer-drag inert but remain focus-selectable", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  var dimmed = findCardByStatement(view.root, "Problem 2");
  var originalLeft = dimmed.style.left;
  dispatch(dimmed, "pointerdown", {
    clientX: 300,
    clientY: 40,
    pointerId: 2,
  });
  dispatch(dimmed, "pointermove", {
    clientX: 560,
    clientY: 40,
    pointerId: 2,
  });
  assert.equal(dimmed.style.left, originalLeft);
  assert.equal(view.board.activeDrag, null);

  dispatch(dimmed, "click");
  assert.equal(focusedCards(view.root).length, 2);
  assert.equal(
    findCardByStatement(view.root, "Problem 2").classList.contains(
      "focus-focused"
    ),
    true
  );
});

test("clear and focus exit cancel pending drag merges and preserve focus semantics", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(findCardByStatement(view.root, "Problem 2"), "click");

  var source = findCardByStatement(view.root, "Problem 1");
  var target = findCardByStatement(view.root, "Problem 2");
  beginDragMergeElements(view, source, target, 1);
  assert.equal(view.scheduler.jobsByDelay(1500).length, 1);
  dispatch(findByAria(view.root, "Clear focused cards"), "click");
  assert.equal(view.scheduler.pendingCount(), 0);
  assert.equal(view.board.activeDrag, null);
  assert.equal(
    findByClass(view.root, "focus-status-full").textContent,
    "Select cards to focus."
  );

  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(findCardByStatement(view.root, "Problem 2"), "click");
  source = findCardByStatement(view.root, "Problem 1");
  target = findCardByStatement(view.root, "Problem 2");
  beginDragMergeElements(view, source, target, 2);
  dispatch(findByAria(view.root, "Exit Focus Mode"), "click");
  assert.equal(view.scheduler.pendingCount(), 0);
  assert.equal(view.board.activeDrag, null);
  assert.equal(findByClass(view.root, "focus-status-full").textContent, "");
  dispatch(findByAria(view.root, "Focus cards"), "click");
  assert.equal(
    findByClass(view.root, "focus-status-full").textContent,
    "2 cards focused"
  );
});

test("deleting the final board card exits and disables focus", function () {
  var view = enterFocus(oneCard());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  dispatch(
    findByTitle(findCardByStatement(view.root, "Problem 1"), "Delete"),
    "click"
  );

  var focusButton = findByAria(view.root, "Focus cards");
  assert.equal(focusButton.getAttribute("aria-pressed"), "false");
  assert.equal(focusButton.disabled, true);

  dispatch(findByAria(view.root, "Add problem card"), "click");
  assert.equal(focusButton.disabled, false);
  assert.equal(focusedCards(view.root).length, 0);
});

test("focused drag and edit persist, while dimmed pointer movement is inert", function () {
  var view = enterFocus(threeCards());
  dispatch(findCardByStatement(view.root, "Problem 1"), "click");
  var focused = findCardByStatement(view.root, "Problem 1");
  var dimmed = findCardByStatement(view.root, "Problem 2");
  var dimmedLeft = dimmed.style.left;

  dispatch(focused, "pointerdown", {
    clientX: 10,
    clientY: 10,
    pointerId: 1,
  });
  dispatch(focused, "pointermove", {
    clientX: 40,
    clientY: 50,
    pointerId: 1,
  });
  dispatch(focused, "pointerup", {
    clientX: 40,
    clientY: 50,
    pointerId: 1,
  });
  var movedLeft = focused.style.left;

  dispatch(dimmed, "pointerdown", {
    clientX: 10,
    clientY: 10,
    pointerId: 2,
  });
  dispatch(dimmed, "pointermove", {
    clientX: 80,
    clientY: 80,
    pointerId: 2,
  });
  assert.equal(dimmed.style.left, dimmedLeft);

  var statement = findByClass(focused, "problem-statement");
  statement.textContent = "Edited while focused";
  dispatch(statement, "blur");
  dispatch(findByAria(view.root, "Exit Focus Mode"), "click");

  assert.equal(
    findCardByStatement(view.root, "Edited while focused").style.left,
    movedLeft
  );
  assert.equal(
    findByClass(
      findCardByStatement(view.root, "Edited while focused"),
      "problem-statement"
    ).textContent,
    "Edited while focused"
  );
});
}
