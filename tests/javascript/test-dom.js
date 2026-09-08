"use strict";

function tokens(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean);
}

function createElement(document, tag) {
  var attributes = Object.create(null);
  var listeners = Object.create(null);
  var children = [];
  var ownText = "";
  var html = "";
  var customProperties = Object.create(null);
  var style = {
    setProperty: function (name, value) {
      customProperties[name] = String(value);
    },
    getPropertyValue: function (name) {
      return customProperties[name] || "";
    },
  };

  var element = {
    tagName: String(tag).toUpperCase(),
    children: children,
    parentNode: null,
    ownerDocument: document,
    style: style,
    attributes: attributes,
    scrollLeft: 0,
    scrollTop: 0,
    offsetWidth: 0,
    offsetHeight: 0,

    appendChild: function (child) {
      if (child.parentNode) {
        var oldIndex = child.parentNode.children.indexOf(child);
        if (oldIndex !== -1) child.parentNode.children.splice(oldIndex, 1);
      }
      child.parentNode = element;
      children.push(child);
      return child;
    },

    setAttribute: function (name, value) {
      name = String(name).toLowerCase();
      attributes[name] = String(value);
    },

    getAttribute: function (name) {
      name = String(name).toLowerCase();
      return Object.prototype.hasOwnProperty.call(attributes, name)
        ? attributes[name]
        : null;
    },

    hasAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(
        attributes,
        String(name).toLowerCase()
      );
    },

    removeAttribute: function (name) {
      delete attributes[String(name).toLowerCase()];
    },

    addEventListener: function (type, listener) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(listener);
    },

    removeEventListener: function (type, listener) {
      listeners[type] = (listeners[type] || []).filter(function (candidate) {
        return candidate !== listener;
      });
    },

    querySelectorAll: function (selector) {
      var classNames = String(selector)
        .split(".")
        .filter(Boolean);
      if (selector.charAt(0) !== "." || !classNames.length) return [];

      var matches = [];
      function visit(node) {
        node.children.forEach(function (child) {
          if (
            classNames.every(function (className) {
              return child.classList.contains(className);
            })
          ) {
            matches.push(child);
          }
          visit(child);
        });
      }
      visit(element);
      return matches;
    },

    focus: function () {
      if (element.disabled) return;
      document.activeElement = element;
      dispatch(element, "focus");
    },

    blur: function () {
      if (document.activeElement !== element) return;
      document.activeElement = null;
      dispatch(element, "blur");
    },

    setPointerCapture: function (pointerId) {
      element._capturedPointerId = pointerId;
    },

    hasPointerCapture: function (pointerId) {
      return element._capturedPointerId === pointerId;
    },

    releasePointerCapture: function (pointerId) {
      if (element._capturedPointerId !== pointerId) return;
      element._capturedPointerId = null;
      dispatch(element, "lostpointercapture", { pointerId: pointerId });
    },

    getBoundingClientRect: function () {
      var left = parseFloat(element.style.left) || 0;
      var top = parseFloat(element.style.top) || 0;
      var width = element.classList.contains("card")
        ? element.offsetWidth || 220
        : element.clientWidth || element.offsetWidth || 0;
      var height = element.classList.contains("card")
        ? element.offsetHeight || 230
        : element.clientHeight || element.offsetHeight || 0;
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
    },

    closest: function (selector) {
      if (String(selector).charAt(0) !== ".") return null;
      var className = String(selector).slice(1);
      var current = element;
      while (current) {
        if (current.classList && current.classList.contains(className)) {
          return current;
        }
        current = current.parentNode;
      }
      return null;
    },

    _listeners: listeners,
  };

  function reflectStringProperty(propertyName, attributeName) {
    Object.defineProperty(element, propertyName, {
      enumerable: true,
      get: function () {
        return element.getAttribute(attributeName) || "";
      },
      set: function (value) {
        if (value === null || value === undefined) {
          element.removeAttribute(attributeName);
        } else {
          element.setAttribute(attributeName, value);
        }
      },
    });
  }

  Object.defineProperties(element, {
    className: {
      enumerable: true,
      get: function () {
        return element.getAttribute("class") || "";
      },
      set: function (value) {
        element.setAttribute("class", value);
      },
    },

    classList: {
      enumerable: true,
      value: {
        add: function () {
          var current = tokens(element.className);
          Array.prototype.slice.call(arguments).forEach(function (token) {
            token = String(token);
            if (current.indexOf(token) === -1) current.push(token);
          });
          element.className = current.join(" ");
        },
        remove: function () {
          var removals = Array.prototype.slice.call(arguments).map(String);
          element.className = tokens(element.className)
            .filter(function (token) {
              return removals.indexOf(token) === -1;
            })
            .join(" ");
        },
        toggle: function (token, force) {
          token = String(token);
          var present = this.contains(token);
          var shouldAdd = arguments.length > 1 ? !!force : !present;
          if (shouldAdd) this.add(token);
          else this.remove(token);
          return shouldAdd;
        },
        contains: function (token) {
          return tokens(element.className).indexOf(String(token)) !== -1;
        },
      },
    },

    textContent: {
      enumerable: true,
      get: function () {
        return (
          ownText +
          children
            .map(function (child) {
              return child.textContent;
            })
            .join("")
        );
      },
      set: function (value) {
        children.forEach(function (child) {
          child.parentNode = null;
        });
        children.length = 0;
        html = "";
        ownText = value === null || value === undefined ? "" : String(value);
      },
    },

    innerHTML: {
      enumerable: true,
      get: function () {
        return html;
      },
      set: function (value) {
        children.forEach(function (child) {
          child.parentNode = null;
        });
        children.length = 0;
        ownText = "";
        html = value === null || value === undefined ? "" : String(value);
      },
    },

    disabled: {
      enumerable: true,
      get: function () {
        return element.hasAttribute("disabled");
      },
      set: function (value) {
        if (value) element.setAttribute("disabled", "");
        else element.removeAttribute("disabled");
      },
    },

    hidden: {
      enumerable: true,
      get: function () {
        return element.hasAttribute("hidden");
      },
      set: function (value) {
        if (value) element.setAttribute("hidden", "");
        else element.removeAttribute("hidden");
      },
    },

    tabIndex: {
      enumerable: true,
      get: function () {
        var value = element.getAttribute("tabindex");
        if (value === null) return element.tagName === "BUTTON" ? 0 : -1;
        var number = Number(value);
        return Number.isNaN(number) ? -1 : number;
      },
      set: function (value) {
        element.setAttribute("tabindex", value);
      },
    },
  });

  reflectStringProperty("role", "role");
  reflectStringProperty("title", "title");
  reflectStringProperty("ariaLabel", "aria-label");
  reflectStringProperty("ariaPressed", "aria-pressed");
  reflectStringProperty("ariaDisabled", "aria-disabled");
  reflectStringProperty("ariaHidden", "aria-hidden");

  return element;
}

function createDocument() {
  var listeners = Object.create(null);
  var document = {
    activeElement: null,
    hidden: false,
    createElement: function (tag) {
      return createElement(document, tag);
    },
    addEventListener: function (type, listener) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(listener);
    },
    removeEventListener: function (type, listener) {
      listeners[type] = (listeners[type] || []).filter(function (candidate) {
        return candidate !== listener;
      });
    },
    dispatch: function (type, event) {
      (listeners[type] || []).slice().forEach(function (listener) {
        listener(event || {});
      });
    },
  };
  return document;
}

function isDisabledActivation(element, type, event) {
  if (!element || element.tagName !== "BUTTON" || !element.disabled) {
    return false;
  }
  if (type === "click") return true;
  return (
    (type === "keydown" || type === "keypress" || type === "keyup") &&
    (event.key === "Enter" || event.key === " " || event.key === "Spacebar")
  );
}

function dispatch(element, type, init) {
  init = init || {};
  var event = {};
  Object.keys(init).forEach(function (key) {
    event[key] = init[key];
  });
  event.type = type;
  event.target = element;
  event.currentTarget = null;
  event.key = init.key;
  event.clientX = init.clientX || 0;
  event.clientY = init.clientY || 0;
  event.pageX = init.pageX || 0;
  event.pageY = init.pageY || 0;
  event.pointerId = init.pointerId === undefined ? 0 : init.pointerId;
  event.defaultPrevented = false;
  event.cancelBubble = false;
  event._propagationStopped = false;
  event._immediatePropagationStopped = false;
  event.preventDefault = function () {
    event.defaultPrevented = true;
  };
  event.stopPropagation = function () {
    event.cancelBubble = true;
    event._propagationStopped = true;
  };
  event.stopImmediatePropagation = function () {
    event.stopPropagation();
    event._immediatePropagationStopped = true;
  };

  if (!element) return event;

  var isSpace = event.key === " " || event.key === "Spacebar";
  var armedSpace = false;
  if (type === "keydown" && isSpace) {
    element._spaceActivationArmed = false;
  } else if (type === "keyup" && isSpace) {
    armedSpace = !!element._spaceActivationArmed;
    element._spaceActivationArmed = false;
  }

  if (isDisabledActivation(element, type, event)) return event;

  var path = [];
  var current = element;
  while (current) {
    path.push(current);
    current = current.parentNode;
  }

  for (var i = 0; i < path.length; i++) {
    event.currentTarget = path[i];
    var handlers = (path[i]._listeners[type] || []).slice();
    for (var j = 0; j < handlers.length; j++) {
      handlers[j].call(path[i], event);
      if (event._immediatePropagationStopped) break;
    }
    if (event._propagationStopped) break;
  }
  event.currentTarget = null;

  if (
    element.tagName === "BUTTON" &&
    !element.disabled &&
    !event.defaultPrevented
  ) {
    if (type === "keydown" && event.key === "Enter") {
      dispatch(element, "click");
    } else if (type === "keydown" && isSpace) {
      element._spaceActivationArmed = true;
    } else if (type === "keyup" && isSpace && armedSpace) {
      dispatch(element, "click");
    }
  }

  return event;
}

module.exports = {
  createDocument: createDocument,
  dispatch: dispatch,
};
