(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProblemBoardCore = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var MERGE_HOLD_MS = 1500;

  function cleanText(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  }

  function comparisonKey(value) {
    return cleanText(value).toLowerCase().replace(/[.?!]+$/, "");
  }

  function listKey(value) {
    return cleanText(value).toLowerCase();
  }

  function uniqueStrings(values) {
    var seen = Object.create(null);
    var unique = [];

    (values || []).forEach(function (value) {
      var display;
      var key;

      if (typeof value !== "string") return;
      display = value.trim();
      if (!display) return;
      key = listKey(display);
      if (seen[key]) return;
      seen[key] = true;
      unique.push(display);
    });

    return unique;
  }

  function combineText(targetText, sourceText) {
    var target = typeof targetText === "string" ? targetText.trim() : "";
    var source = typeof sourceText === "string" ? sourceText.trim() : "";

    if (!target) return source;
    if (!source) return target;
    if (comparisonKey(target) === comparisonKey(source)) return target;
    return target + " " + source;
  }

  function center(rect) {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }

  function selectMergeTarget(sourceRect, candidates) {
    var sourceCenter = center(sourceRect);
    var best = null;
    (candidates || []).forEach(function (candidate) {
      var rect = candidate.rect;
      var contains = sourceCenter.x >= rect.x &&
        sourceCenter.x <= rect.x + rect.width &&
        sourceCenter.y >= rect.y &&
        sourceCenter.y <= rect.y + rect.height;
      var candidateCenter;
      var dx;
      var dy;
      var distance;

      if (!contains) return;

      candidateCenter = center(rect);
      dx = sourceCenter.x - candidateCenter.x;
      dy = sourceCenter.y - candidateCenter.y;
      distance = dx * dx + dy * dy;

      if (!best || distance < best.distance ||
          (distance === best.distance && candidate.order > best.order)) {
        best = { id: candidate.id, distance: distance, order: candidate.order };
      }
    });
    return best ? best.id : null;
  }

  function createMergeHoldController(options) {
    var currentTarget = null;
    var timerToken = null;
    var completed = false;
    var disposed = false;
    var generation = 0;

    function changeTarget(nextTarget) {
      var previousTarget = currentTarget;
      var scheduledToken;
      var transitionGeneration;

      if (nextTarget === previousTarget) return currentTarget;

      if (timerToken !== null) {
        options.cancelScheduled(timerToken);
        timerToken = null;
      }

      currentTarget = nextTarget;
      generation += 1;
      transitionGeneration = generation;
      options.onTargetChange(nextTarget, previousTarget);

      if (nextTarget !== null && !disposed && !completed &&
          currentTarget === nextTarget && generation === transitionGeneration) {
        scheduledToken = options.schedule(function () {
          var completedTarget;

          if (disposed || completed || currentTarget !== nextTarget ||
              generation !== transitionGeneration ||
              timerToken !== scheduledToken) return;

          completed = true;
          timerToken = null;
          completedTarget = currentTarget;
          currentTarget = null;
          generation += 1;
          options.onTargetChange(null, completedTarget);
          options.onComplete(completedTarget);
        }, MERGE_HOLD_MS);

        if (disposed || completed || currentTarget !== nextTarget ||
            generation !== transitionGeneration) {
          options.cancelScheduled(scheduledToken);
        } else {
          timerToken = scheduledToken;
        }
      }

      return currentTarget;
    }

    return {
      update: function (sourceRect, candidates) {
        var nextTarget;

        if (disposed || completed) return null;
        nextTarget = selectMergeTarget(sourceRect, candidates);
        if (nextTarget === currentTarget) return nextTarget;
        return changeTarget(nextTarget);
      },
      cancel: function () {
        if (disposed || completed) return;
        changeTarget(null);
      },
      dispose: function () {
        if (disposed) return;
        disposed = true;
        changeTarget(null);
      }
    };
  }

  function combineProblemStatements(targetText, sourceText) {
    var target = cleanText(targetText);
    var source = cleanText(sourceText);

    if (!target && !source) return "Untitled problem";
    if (!target) return source;
    if (!source) return target;
    if (comparisonKey(target) === comparisonKey(source)) return target;

    target = target.replace(/[.?!;:]+$/, "");
    if (!/[.?!]$/.test(source)) source += ".";
    return target + "; " + source;
  }

  function cloneFramework(framework) {
    return {
      name: framework.name,
      proof_points: Array.isArray(framework.proof_points) ?
        framework.proof_points.slice() : null,
      confidence: framework.confidence || null
    };
  }

  function mergeFrameworks(targetFrameworks, sourceFrameworks) {
    var merged = (targetFrameworks || []).map(cloneFramework);

    (sourceFrameworks || []).forEach(function (sourceFramework) {
      var sourceKey = listKey(sourceFramework.name);
      var matchIndex = -1;
      var targetFramework;
      var targetHasProofs;
      var sourceHasProofs;
      var proofPoints;

      merged.some(function (framework, index) {
        if (listKey(framework.name) !== sourceKey) return false;
        matchIndex = index;
        return true;
      });

      if (matchIndex === -1) {
        merged.push(cloneFramework(sourceFramework));
        return;
      }

      targetFramework = merged[matchIndex];
      targetHasProofs = Array.isArray(targetFramework.proof_points);
      sourceHasProofs = Array.isArray(sourceFramework.proof_points);
      proofPoints = null;

      if (targetHasProofs && sourceHasProofs) {
        proofPoints = uniqueStrings(
          targetFramework.proof_points.concat(sourceFramework.proof_points)
        );
      } else if (targetHasProofs) {
        proofPoints = uniqueStrings(targetFramework.proof_points);
      } else if (sourceHasProofs) {
        proofPoints = uniqueStrings(sourceFramework.proof_points);
      }

      merged[matchIndex] = {
        name: targetFramework.name,
        proof_points: proofPoints,
        confidence: targetFramework.confidence || sourceFramework.confidence || null
      };
    });

    return merged;
  }

  function mergeCards(targetCard, sourceCard, newId) {
    return {
      id: newId,
      problem_statement: combineProblemStatements(
        targetCard.problem_statement,
        sourceCard.problem_statement
      ),
      impact: combineText(targetCard.impact, sourceCard.impact),
      proof_points: uniqueStrings(
        (targetCard.proof_points || []).concat(sourceCard.proof_points || [])
      ),
      frameworks: mergeFrameworks(
        targetCard.frameworks || [],
        sourceCard.frameworks || []
      ),
      position: {
        x: targetCard.position.x,
        y: targetCard.position.y
      },
      convergence_note: combineText(
        targetCard.convergence_note,
        sourceCard.convergence_note
      ),
      created_by: "user",
      tags: uniqueStrings((targetCard.tags || []).concat(sourceCard.tags || [])),
      tension: targetCard.tension === true || sourceCard.tension === true
    };
  }

  return {
    MERGE_HOLD_MS: MERGE_HOLD_MS,
    selectMergeTarget: selectMergeTarget,
    createMergeHoldController: createMergeHoldController,
    combineProblemStatements: combineProblemStatements,
    mergeCards: mergeCards
  };
});
