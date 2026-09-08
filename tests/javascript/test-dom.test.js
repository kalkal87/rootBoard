"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var testDom = require("./test-dom.js");
var createDocument = testDom.createDocument;
var dispatch = testDom.dispatch;

function buttonWithClickCount() {
  var button = createDocument().createElement("button");
  var clicks = 0;
  button.addEventListener("click", function () {
    clicks += 1;
  });
  return {
    button: button,
    clicks: function () {
      return clicks;
    },
  };
}

test("native BUTTON activates one click from Enter keydown", function () {
  var view = buttonWithClickCount();

  dispatch(view.button, "keydown", { key: "Enter" });

  assert.equal(view.clicks(), 1);
});

test("Space keydown arms without clicking and matching keyup clicks once", function () {
  var view = buttonWithClickCount();

  dispatch(view.button, "keydown", { key: "Spacebar" });
  assert.equal(view.clicks(), 0);

  dispatch(view.button, "keyup", { key: "Spacebar" });
  assert.equal(view.clicks(), 1);
});

test("isolated or canceled Space input does not activate a BUTTON", function () {
  var isolated = buttonWithClickCount();
  dispatch(isolated.button, "keyup", { key: " " });
  assert.equal(isolated.clicks(), 0, "isolated Space keyup should not click");

  var canceled = buttonWithClickCount();
  canceled.button.addEventListener("keydown", function (event) {
    event.preventDefault();
  });
  dispatch(canceled.button, "keydown", { key: " " });
  dispatch(canceled.button, "keyup", { key: " " });
  assert.equal(canceled.clicks(), 0, "canceled Space keydown should not arm");

  var staleAfterCanceledKeydown = buttonWithClickCount();
  var cancelNextKeydown = false;
  staleAfterCanceledKeydown.button.addEventListener("keydown", function (event) {
    if (cancelNextKeydown) event.preventDefault();
  });
  dispatch(staleAfterCanceledKeydown.button, "keydown", { key: " " });
  cancelNextKeydown = true;
  dispatch(staleAfterCanceledKeydown.button, "keydown", { key: " " });
  dispatch(staleAfterCanceledKeydown.button, "keyup", { key: " " });
  assert.equal(
    staleAfterCanceledKeydown.clicks(),
    0,
    "canceled Space keydown should clear an existing arm"
  );
});

test("canceled or disabled Space sequences consume activation arms", function () {
  var canceledKeyup = buttonWithClickCount();
  var cancelNextKeyup = true;
  canceledKeyup.button.addEventListener("keyup", function (event) {
    if (cancelNextKeyup) {
      cancelNextKeyup = false;
      event.preventDefault();
    }
  });
  dispatch(canceledKeyup.button, "keydown", { key: " " });
  dispatch(canceledKeyup.button, "keyup", { key: " " });
  dispatch(canceledKeyup.button, "keyup", { key: " " });
  assert.equal(
    canceledKeyup.clicks(),
    0,
    "canceled Space keyup should suppress and consume the arm"
  );

  var disabledBeforeKeyup = buttonWithClickCount();
  dispatch(disabledBeforeKeyup.button, "keydown", { key: "Spacebar" });
  disabledBeforeKeyup.button.disabled = true;
  dispatch(disabledBeforeKeyup.button, "keyup", { key: "Spacebar" });
  disabledBeforeKeyup.button.disabled = false;
  dispatch(disabledBeforeKeyup.button, "keyup", { key: "Spacebar" });
  assert.equal(
    disabledBeforeKeyup.clicks(),
    0,
    "disabled Space keyup should suppress and consume the arm"
  );

  var disabledKeydown = buttonWithClickCount();
  disabledKeydown.button.disabled = true;
  dispatch(disabledKeydown.button, "keydown", { key: " " });
  disabledKeydown.button.disabled = false;
  dispatch(disabledKeydown.button, "keyup", { key: " " });
  assert.equal(
    disabledKeydown.clicks(),
    0,
    "disabled Space keydown should never arm"
  );

  var staleAfterDisabledKeydown = buttonWithClickCount();
  dispatch(staleAfterDisabledKeydown.button, "keydown", { key: "Spacebar" });
  staleAfterDisabledKeydown.button.disabled = true;
  dispatch(staleAfterDisabledKeydown.button, "keydown", { key: "Spacebar" });
  staleAfterDisabledKeydown.button.disabled = false;
  dispatch(staleAfterDisabledKeydown.button, "keyup", { key: "Spacebar" });
  assert.equal(
    staleAfterDisabledKeydown.clicks(),
    0,
    "disabled Space keydown should clear an existing arm"
  );
});
