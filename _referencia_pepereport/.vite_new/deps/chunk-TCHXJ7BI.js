import {
  getUnit,
  toUnitless
} from "./chunk-MTCATE3R.js";
import {
  ButtonBase_default
} from "./chunk-YOTA6WQL.js";
import {
  FormControlContext_default,
  useFormControl
} from "./chunk-J5R7M7QR.js";
import {
  HTMLElementType,
  Portal_default,
  useSlotProps_default
} from "./chunk-VV445RHK.js";
import {
  useSlot
} from "./chunk-FKPUPPMO.js";
import {
  refType_default
} from "./chunk-ZUDBCEXX.js";
import {
  debounce_default,
  ownerDocument,
  ownerDocument_default,
  ownerWindow_default,
  unsupportedProp_default
} from "./chunk-GYCI4TKR.js";
import {
  useEnhancedEffect_default as useEnhancedEffect_default2,
  useEventCallback_default2 as useEventCallback_default,
  useForkRef_default
} from "./chunk-GMAS6UZK.js";
import {
  createSvgIcon
} from "./chunk-LCEYT75R.js";
import {
  useForkRef
} from "./chunk-YAQSJOJQ.js";
import {
  Typography_default
} from "./chunk-TC62XVLI.js";
import {
  chainPropTypes
} from "./chunk-JX37XSKT.js";
import {
  createSimplePaletteValueFilter
} from "./chunk-G4FQZWC4.js";
import {
  memoTheme_default
} from "./chunk-N2AYC7D7.js";
import {
  capitalize_default
} from "./chunk-MD2DUWNX.js";
import {
  useDefaultProps
} from "./chunk-COZUWOGN.js";
import {
  useTheme
} from "./chunk-VIMWTUHL.js";
import {
  clsx_default,
  composeClasses,
  css,
  generateUtilityClass,
  generateUtilityClasses,
  keyframes,
  require_jsx_runtime,
  require_prop_types,
  require_react_is,
  styled_default2 as styled_default,
  useEnhancedEffect_default,
  useRtl
} from "./chunk-UIRN2W7R.js";
import {
  require_react
} from "./chunk-4BPZ7PBZ.js";
import {
  __toESM
} from "./chunk-G3PMV62Z.js";

// node_modules/@mui/material/esm/Popper/popperClasses.js
function getPopperUtilityClass(slot) {
  return generateUtilityClass("MuiPopper", slot);
}
var popperClasses = generateUtilityClasses("MuiPopper", ["root"]);

// node_modules/@mui/material/esm/Popper/Popper.js
var import_prop_types2 = __toESM(require_prop_types(), 1);
var React2 = __toESM(require_react(), 1);

// node_modules/@mui/material/esm/Popper/BasePopper.js
var React = __toESM(require_react(), 1);

// node_modules/@popperjs/core/lib/enums.js
var top = "top";
var bottom = "bottom";
var right = "right";
var left = "left";
var auto = "auto";
var basePlacements = [top, bottom, right, left];
var start = "start";
var end = "end";
var clippingParents = "clippingParents";
var viewport = "viewport";
var popper = "popper";
var reference = "reference";
var variationPlacements = basePlacements.reduce(function(acc, placement) {
  return acc.concat([placement + "-" + start, placement + "-" + end]);
}, []);
var placements = [].concat(basePlacements, [auto]).reduce(function(acc, placement) {
  return acc.concat([placement, placement + "-" + start, placement + "-" + end]);
}, []);
var beforeRead = "beforeRead";
var read = "read";
var afterRead = "afterRead";
var beforeMain = "beforeMain";
var main = "main";
var afterMain = "afterMain";
var beforeWrite = "beforeWrite";
var write = "write";
var afterWrite = "afterWrite";
var modifierPhases = [beforeRead, read, afterRead, beforeMain, main, afterMain, beforeWrite, write, afterWrite];

// node_modules/@popperjs/core/lib/dom-utils/getNodeName.js
function getNodeName(element) {
  return element ? (element.nodeName || "").toLowerCase() : null;
}

// node_modules/@popperjs/core/lib/dom-utils/getWindow.js
function getWindow(node) {
  if (node == null) {
    return window;
  }
  if (node.toString() !== "[object Window]") {
    var ownerDocument2 = node.ownerDocument;
    return ownerDocument2 ? ownerDocument2.defaultView || window : window;
  }
  return node;
}

// node_modules/@popperjs/core/lib/dom-utils/instanceOf.js
function isElement(node) {
  var OwnElement = getWindow(node).Element;
  return node instanceof OwnElement || node instanceof Element;
}
function isHTMLElement(node) {
  var OwnElement = getWindow(node).HTMLElement;
  return node instanceof OwnElement || node instanceof HTMLElement;
}
function isShadowRoot(node) {
  if (typeof ShadowRoot === "undefined") {
    return false;
  }
  var OwnElement = getWindow(node).ShadowRoot;
  return node instanceof OwnElement || node instanceof ShadowRoot;
}

// node_modules/@popperjs/core/lib/modifiers/applyStyles.js
function applyStyles(_ref) {
  var state = _ref.state;
  Object.keys(state.elements).forEach(function(name) {
    var style = state.styles[name] || {};
    var attributes = state.attributes[name] || {};
    var element = state.elements[name];
    if (!isHTMLElement(element) || !getNodeName(element)) {
      return;
    }
    Object.assign(element.style, style);
    Object.keys(attributes).forEach(function(name2) {
      var value = attributes[name2];
      if (value === false) {
        element.removeAttribute(name2);
      } else {
        element.setAttribute(name2, value === true ? "" : value);
      }
    });
  });
}
function effect(_ref2) {
  var state = _ref2.state;
  var initialStyles = {
    popper: {
      position: state.options.strategy,
      left: "0",
      top: "0",
      margin: "0"
    },
    arrow: {
      position: "absolute"
    },
    reference: {}
  };
  Object.assign(state.elements.popper.style, initialStyles.popper);
  state.styles = initialStyles;
  if (state.elements.arrow) {
    Object.assign(state.elements.arrow.style, initialStyles.arrow);
  }
  return function() {
    Object.keys(state.elements).forEach(function(name) {
      var element = state.elements[name];
      var attributes = state.attributes[name] || {};
      var styleProperties = Object.keys(state.styles.hasOwnProperty(name) ? state.styles[name] : initialStyles[name]);
      var style = styleProperties.reduce(function(style2, property) {
        style2[property] = "";
        return style2;
      }, {});
      if (!isHTMLElement(element) || !getNodeName(element)) {
        return;
      }
      Object.assign(element.style, style);
      Object.keys(attributes).forEach(function(attribute) {
        element.removeAttribute(attribute);
      });
    });
  };
}
var applyStyles_default = {
  name: "applyStyles",
  enabled: true,
  phase: "write",
  fn: applyStyles,
  effect,
  requires: ["computeStyles"]
};

// node_modules/@popperjs/core/lib/utils/getBasePlacement.js
function getBasePlacement(placement) {
  return placement.split("-")[0];
}

// node_modules/@popperjs/core/lib/utils/math.js
var max = Math.max;
var min = Math.min;
var round = Math.round;

// node_modules/@popperjs/core/lib/utils/userAgent.js
function getUAString() {
  var uaData = navigator.userAgentData;
  if (uaData != null && uaData.brands && Array.isArray(uaData.brands)) {
    return uaData.brands.map(function(item) {
      return item.brand + "/" + item.version;
    }).join(" ");
  }
  return navigator.userAgent;
}

// node_modules/@popperjs/core/lib/dom-utils/isLayoutViewport.js
function isLayoutViewport() {
  return !/^((?!chrome|android).)*safari/i.test(getUAString());
}

// node_modules/@popperjs/core/lib/dom-utils/getBoundingClientRect.js
function getBoundingClientRect(element, includeScale, isFixedStrategy) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  var clientRect = element.getBoundingClientRect();
  var scaleX = 1;
  var scaleY = 1;
  if (includeScale && isHTMLElement(element)) {
    scaleX = element.offsetWidth > 0 ? round(clientRect.width) / element.offsetWidth || 1 : 1;
    scaleY = element.offsetHeight > 0 ? round(clientRect.height) / element.offsetHeight || 1 : 1;
  }
  var _ref = isElement(element) ? getWindow(element) : window, visualViewport = _ref.visualViewport;
  var addVisualOffsets = !isLayoutViewport() && isFixedStrategy;
  var x = (clientRect.left + (addVisualOffsets && visualViewport ? visualViewport.offsetLeft : 0)) / scaleX;
  var y = (clientRect.top + (addVisualOffsets && visualViewport ? visualViewport.offsetTop : 0)) / scaleY;
  var width = clientRect.width / scaleX;
  var height = clientRect.height / scaleY;
  return {
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    x,
    y
  };
}

// node_modules/@popperjs/core/lib/dom-utils/getLayoutRect.js
function getLayoutRect(element) {
  var clientRect = getBoundingClientRect(element);
  var width = element.offsetWidth;
  var height = element.offsetHeight;
  if (Math.abs(clientRect.width - width) <= 1) {
    width = clientRect.width;
  }
  if (Math.abs(clientRect.height - height) <= 1) {
    height = clientRect.height;
  }
  return {
    x: element.offsetLeft,
    y: element.offsetTop,
    width,
    height
  };
}

// node_modules/@popperjs/core/lib/dom-utils/contains.js
function contains(parent, child) {
  var rootNode = child.getRootNode && child.getRootNode();
  if (parent.contains(child)) {
    return true;
  } else if (rootNode && isShadowRoot(rootNode)) {
    var next = child;
    do {
      if (next && parent.isSameNode(next)) {
        return true;
      }
      next = next.parentNode || next.host;
    } while (next);
  }
  return false;
}

// node_modules/@popperjs/core/lib/dom-utils/getComputedStyle.js
function getComputedStyle(element) {
  return getWindow(element).getComputedStyle(element);
}

// node_modules/@popperjs/core/lib/dom-utils/isTableElement.js
function isTableElement(element) {
  return ["table", "td", "th"].indexOf(getNodeName(element)) >= 0;
}

// node_modules/@popperjs/core/lib/dom-utils/getDocumentElement.js
function getDocumentElement(element) {
  return ((isElement(element) ? element.ownerDocument : (
    // $FlowFixMe[prop-missing]
    element.document
  )) || window.document).documentElement;
}

// node_modules/@popperjs/core/lib/dom-utils/getParentNode.js
function getParentNode(element) {
  if (getNodeName(element) === "html") {
    return element;
  }
  return (
    // this is a quicker (but less type safe) way to save quite some bytes from the bundle
    // $FlowFixMe[incompatible-return]
    // $FlowFixMe[prop-missing]
    element.assignedSlot || // step into the shadow DOM of the parent of a slotted node
    element.parentNode || // DOM Element detected
    (isShadowRoot(element) ? element.host : null) || // ShadowRoot detected
    // $FlowFixMe[incompatible-call]: HTMLElement is a Node
    getDocumentElement(element)
  );
}

// node_modules/@popperjs/core/lib/dom-utils/getOffsetParent.js
function getTrueOffsetParent(element) {
  if (!isHTMLElement(element) || // https://github.com/popperjs/popper-core/issues/837
  getComputedStyle(element).position === "fixed") {
    return null;
  }
  return element.offsetParent;
}
function getContainingBlock(element) {
  var isFirefox = /firefox/i.test(getUAString());
  var isIE = /Trident/i.test(getUAString());
  if (isIE && isHTMLElement(element)) {
    var elementCss = getComputedStyle(element);
    if (elementCss.position === "fixed") {
      return null;
    }
  }
  var currentNode = getParentNode(element);
  if (isShadowRoot(currentNode)) {
    currentNode = currentNode.host;
  }
  while (isHTMLElement(currentNode) && ["html", "body"].indexOf(getNodeName(currentNode)) < 0) {
    var css2 = getComputedStyle(currentNode);
    if (css2.transform !== "none" || css2.perspective !== "none" || css2.contain === "paint" || ["transform", "perspective"].indexOf(css2.willChange) !== -1 || isFirefox && css2.willChange === "filter" || isFirefox && css2.filter && css2.filter !== "none") {
      return currentNode;
    } else {
      currentNode = currentNode.parentNode;
    }
  }
  return null;
}
function getOffsetParent(element) {
  var window2 = getWindow(element);
  var offsetParent = getTrueOffsetParent(element);
  while (offsetParent && isTableElement(offsetParent) && getComputedStyle(offsetParent).position === "static") {
    offsetParent = getTrueOffsetParent(offsetParent);
  }
  if (offsetParent && (getNodeName(offsetParent) === "html" || getNodeName(offsetParent) === "body" && getComputedStyle(offsetParent).position === "static")) {
    return window2;
  }
  return offsetParent || getContainingBlock(element) || window2;
}

// node_modules/@popperjs/core/lib/utils/getMainAxisFromPlacement.js
function getMainAxisFromPlacement(placement) {
  return ["top", "bottom"].indexOf(placement) >= 0 ? "x" : "y";
}

// node_modules/@popperjs/core/lib/utils/within.js
function within(min2, value, max2) {
  return max(min2, min(value, max2));
}
function withinMaxClamp(min2, value, max2) {
  var v = within(min2, value, max2);
  return v > max2 ? max2 : v;
}

// node_modules/@popperjs/core/lib/utils/getFreshSideObject.js
function getFreshSideObject() {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
}

// node_modules/@popperjs/core/lib/utils/mergePaddingObject.js
function mergePaddingObject(paddingObject) {
  return Object.assign({}, getFreshSideObject(), paddingObject);
}

// node_modules/@popperjs/core/lib/utils/expandToHashMap.js
function expandToHashMap(value, keys) {
  return keys.reduce(function(hashMap, key) {
    hashMap[key] = value;
    return hashMap;
  }, {});
}

// node_modules/@popperjs/core/lib/modifiers/arrow.js
var toPaddingObject = function toPaddingObject2(padding, state) {
  padding = typeof padding === "function" ? padding(Object.assign({}, state.rects, {
    placement: state.placement
  })) : padding;
  return mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
};
function arrow(_ref) {
  var _state$modifiersData$;
  var state = _ref.state, name = _ref.name, options = _ref.options;
  var arrowElement = state.elements.arrow;
  var popperOffsets2 = state.modifiersData.popperOffsets;
  var basePlacement = getBasePlacement(state.placement);
  var axis = getMainAxisFromPlacement(basePlacement);
  var isVertical = [left, right].indexOf(basePlacement) >= 0;
  var len = isVertical ? "height" : "width";
  if (!arrowElement || !popperOffsets2) {
    return;
  }
  var paddingObject = toPaddingObject(options.padding, state);
  var arrowRect = getLayoutRect(arrowElement);
  var minProp = axis === "y" ? top : left;
  var maxProp = axis === "y" ? bottom : right;
  var endDiff = state.rects.reference[len] + state.rects.reference[axis] - popperOffsets2[axis] - state.rects.popper[len];
  var startDiff = popperOffsets2[axis] - state.rects.reference[axis];
  var arrowOffsetParent = getOffsetParent(arrowElement);
  var clientSize = arrowOffsetParent ? axis === "y" ? arrowOffsetParent.clientHeight || 0 : arrowOffsetParent.clientWidth || 0 : 0;
  var centerToReference = endDiff / 2 - startDiff / 2;
  var min2 = paddingObject[minProp];
  var max2 = clientSize - arrowRect[len] - paddingObject[maxProp];
  var center = clientSize / 2 - arrowRect[len] / 2 + centerToReference;
  var offset2 = within(min2, center, max2);
  var axisProp = axis;
  state.modifiersData[name] = (_state$modifiersData$ = {}, _state$modifiersData$[axisProp] = offset2, _state$modifiersData$.centerOffset = offset2 - center, _state$modifiersData$);
}
function effect2(_ref2) {
  var state = _ref2.state, options = _ref2.options;
  var _options$element = options.element, arrowElement = _options$element === void 0 ? "[data-popper-arrow]" : _options$element;
  if (arrowElement == null) {
    return;
  }
  if (typeof arrowElement === "string") {
    arrowElement = state.elements.popper.querySelector(arrowElement);
    if (!arrowElement) {
      return;
    }
  }
  if (!contains(state.elements.popper, arrowElement)) {
    return;
  }
  state.elements.arrow = arrowElement;
}
var arrow_default = {
  name: "arrow",
  enabled: true,
  phase: "main",
  fn: arrow,
  effect: effect2,
  requires: ["popperOffsets"],
  requiresIfExists: ["preventOverflow"]
};

// node_modules/@popperjs/core/lib/utils/getVariation.js
function getVariation(placement) {
  return placement.split("-")[1];
}

// node_modules/@popperjs/core/lib/modifiers/computeStyles.js
var unsetSides = {
  top: "auto",
  right: "auto",
  bottom: "auto",
  left: "auto"
};
function roundOffsetsByDPR(_ref, win) {
  var x = _ref.x, y = _ref.y;
  var dpr = win.devicePixelRatio || 1;
  return {
    x: round(x * dpr) / dpr || 0,
    y: round(y * dpr) / dpr || 0
  };
}
function mapToStyles(_ref2) {
  var _Object$assign2;
  var popper2 = _ref2.popper, popperRect = _ref2.popperRect, placement = _ref2.placement, variation = _ref2.variation, offsets = _ref2.offsets, position = _ref2.position, gpuAcceleration = _ref2.gpuAcceleration, adaptive = _ref2.adaptive, roundOffsets = _ref2.roundOffsets, isFixed = _ref2.isFixed;
  var _offsets$x = offsets.x, x = _offsets$x === void 0 ? 0 : _offsets$x, _offsets$y = offsets.y, y = _offsets$y === void 0 ? 0 : _offsets$y;
  var _ref3 = typeof roundOffsets === "function" ? roundOffsets({
    x,
    y
  }) : {
    x,
    y
  };
  x = _ref3.x;
  y = _ref3.y;
  var hasX = offsets.hasOwnProperty("x");
  var hasY = offsets.hasOwnProperty("y");
  var sideX = left;
  var sideY = top;
  var win = window;
  if (adaptive) {
    var offsetParent = getOffsetParent(popper2);
    var heightProp = "clientHeight";
    var widthProp = "clientWidth";
    if (offsetParent === getWindow(popper2)) {
      offsetParent = getDocumentElement(popper2);
      if (getComputedStyle(offsetParent).position !== "static" && position === "absolute") {
        heightProp = "scrollHeight";
        widthProp = "scrollWidth";
      }
    }
    offsetParent = offsetParent;
    if (placement === top || (placement === left || placement === right) && variation === end) {
      sideY = bottom;
      var offsetY = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.height : (
        // $FlowFixMe[prop-missing]
        offsetParent[heightProp]
      );
      y -= offsetY - popperRect.height;
      y *= gpuAcceleration ? 1 : -1;
    }
    if (placement === left || (placement === top || placement === bottom) && variation === end) {
      sideX = right;
      var offsetX = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.width : (
        // $FlowFixMe[prop-missing]
        offsetParent[widthProp]
      );
      x -= offsetX - popperRect.width;
      x *= gpuAcceleration ? 1 : -1;
    }
  }
  var commonStyles = Object.assign({
    position
  }, adaptive && unsetSides);
  var _ref4 = roundOffsets === true ? roundOffsetsByDPR({
    x,
    y
  }, getWindow(popper2)) : {
    x,
    y
  };
  x = _ref4.x;
  y = _ref4.y;
  if (gpuAcceleration) {
    var _Object$assign;
    return Object.assign({}, commonStyles, (_Object$assign = {}, _Object$assign[sideY] = hasY ? "0" : "", _Object$assign[sideX] = hasX ? "0" : "", _Object$assign.transform = (win.devicePixelRatio || 1) <= 1 ? "translate(" + x + "px, " + y + "px)" : "translate3d(" + x + "px, " + y + "px, 0)", _Object$assign));
  }
  return Object.assign({}, commonStyles, (_Object$assign2 = {}, _Object$assign2[sideY] = hasY ? y + "px" : "", _Object$assign2[sideX] = hasX ? x + "px" : "", _Object$assign2.transform = "", _Object$assign2));
}
function computeStyles(_ref5) {
  var state = _ref5.state, options = _ref5.options;
  var _options$gpuAccelerat = options.gpuAcceleration, gpuAcceleration = _options$gpuAccelerat === void 0 ? true : _options$gpuAccelerat, _options$adaptive = options.adaptive, adaptive = _options$adaptive === void 0 ? true : _options$adaptive, _options$roundOffsets = options.roundOffsets, roundOffsets = _options$roundOffsets === void 0 ? true : _options$roundOffsets;
  var commonStyles = {
    placement: getBasePlacement(state.placement),
    variation: getVariation(state.placement),
    popper: state.elements.popper,
    popperRect: state.rects.popper,
    gpuAcceleration,
    isFixed: state.options.strategy === "fixed"
  };
  if (state.modifiersData.popperOffsets != null) {
    state.styles.popper = Object.assign({}, state.styles.popper, mapToStyles(Object.assign({}, commonStyles, {
      offsets: state.modifiersData.popperOffsets,
      position: state.options.strategy,
      adaptive,
      roundOffsets
    })));
  }
  if (state.modifiersData.arrow != null) {
    state.styles.arrow = Object.assign({}, state.styles.arrow, mapToStyles(Object.assign({}, commonStyles, {
      offsets: state.modifiersData.arrow,
      position: "absolute",
      adaptive: false,
      roundOffsets
    })));
  }
  state.attributes.popper = Object.assign({}, state.attributes.popper, {
    "data-popper-placement": state.placement
  });
}
var computeStyles_default = {
  name: "computeStyles",
  enabled: true,
  phase: "beforeWrite",
  fn: computeStyles,
  data: {}
};

// node_modules/@popperjs/core/lib/modifiers/eventListeners.js
var passive = {
  passive: true
};
function effect3(_ref) {
  var state = _ref.state, instance = _ref.instance, options = _ref.options;
  var _options$scroll = options.scroll, scroll = _options$scroll === void 0 ? true : _options$scroll, _options$resize = options.resize, resize = _options$resize === void 0 ? true : _options$resize;
  var window2 = getWindow(state.elements.popper);
  var scrollParents = [].concat(state.scrollParents.reference, state.scrollParents.popper);
  if (scroll) {
    scrollParents.forEach(function(scrollParent) {
      scrollParent.addEventListener("scroll", instance.update, passive);
    });
  }
  if (resize) {
    window2.addEventListener("resize", instance.update, passive);
  }
  return function() {
    if (scroll) {
      scrollParents.forEach(function(scrollParent) {
        scrollParent.removeEventListener("scroll", instance.update, passive);
      });
    }
    if (resize) {
      window2.removeEventListener("resize", instance.update, passive);
    }
  };
}
var eventListeners_default = {
  name: "eventListeners",
  enabled: true,
  phase: "write",
  fn: function fn() {
  },
  effect: effect3,
  data: {}
};

// node_modules/@popperjs/core/lib/utils/getOppositePlacement.js
var hash = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function getOppositePlacement(placement) {
  return placement.replace(/left|right|bottom|top/g, function(matched) {
    return hash[matched];
  });
}

// node_modules/@popperjs/core/lib/utils/getOppositeVariationPlacement.js
var hash2 = {
  start: "end",
  end: "start"
};
function getOppositeVariationPlacement(placement) {
  return placement.replace(/start|end/g, function(matched) {
    return hash2[matched];
  });
}

// node_modules/@popperjs/core/lib/dom-utils/getWindowScroll.js
function getWindowScroll(node) {
  var win = getWindow(node);
  var scrollLeft = win.pageXOffset;
  var scrollTop = win.pageYOffset;
  return {
    scrollLeft,
    scrollTop
  };
}

// node_modules/@popperjs/core/lib/dom-utils/getWindowScrollBarX.js
function getWindowScrollBarX(element) {
  return getBoundingClientRect(getDocumentElement(element)).left + getWindowScroll(element).scrollLeft;
}

// node_modules/@popperjs/core/lib/dom-utils/getViewportRect.js
function getViewportRect(element, strategy) {
  var win = getWindow(element);
  var html = getDocumentElement(element);
  var visualViewport = win.visualViewport;
  var width = html.clientWidth;
  var height = html.clientHeight;
  var x = 0;
  var y = 0;
  if (visualViewport) {
    width = visualViewport.width;
    height = visualViewport.height;
    var layoutViewport = isLayoutViewport();
    if (layoutViewport || !layoutViewport && strategy === "fixed") {
      x = visualViewport.offsetLeft;
      y = visualViewport.offsetTop;
    }
  }
  return {
    width,
    height,
    x: x + getWindowScrollBarX(element),
    y
  };
}

// node_modules/@popperjs/core/lib/dom-utils/getDocumentRect.js
function getDocumentRect(element) {
  var _element$ownerDocumen;
  var html = getDocumentElement(element);
  var winScroll = getWindowScroll(element);
  var body = (_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body;
  var width = max(html.scrollWidth, html.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0);
  var height = max(html.scrollHeight, html.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0);
  var x = -winScroll.scrollLeft + getWindowScrollBarX(element);
  var y = -winScroll.scrollTop;
  if (getComputedStyle(body || html).direction === "rtl") {
    x += max(html.clientWidth, body ? body.clientWidth : 0) - width;
  }
  return {
    width,
    height,
    x,
    y
  };
}

// node_modules/@popperjs/core/lib/dom-utils/isScrollParent.js
function isScrollParent(element) {
  var _getComputedStyle = getComputedStyle(element), overflow = _getComputedStyle.overflow, overflowX = _getComputedStyle.overflowX, overflowY = _getComputedStyle.overflowY;
  return /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
}

// node_modules/@popperjs/core/lib/dom-utils/getScrollParent.js
function getScrollParent(node) {
  if (["html", "body", "#document"].indexOf(getNodeName(node)) >= 0) {
    return node.ownerDocument.body;
  }
  if (isHTMLElement(node) && isScrollParent(node)) {
    return node;
  }
  return getScrollParent(getParentNode(node));
}

// node_modules/@popperjs/core/lib/dom-utils/listScrollParents.js
function listScrollParents(element, list) {
  var _element$ownerDocumen;
  if (list === void 0) {
    list = [];
  }
  var scrollParent = getScrollParent(element);
  var isBody = scrollParent === ((_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body);
  var win = getWindow(scrollParent);
  var target = isBody ? [win].concat(win.visualViewport || [], isScrollParent(scrollParent) ? scrollParent : []) : scrollParent;
  var updatedList = list.concat(target);
  return isBody ? updatedList : (
    // $FlowFixMe[incompatible-call]: isBody tells us target will be an HTMLElement here
    updatedList.concat(listScrollParents(getParentNode(target)))
  );
}

// node_modules/@popperjs/core/lib/utils/rectToClientRect.js
function rectToClientRect(rect) {
  return Object.assign({}, rect, {
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height
  });
}

// node_modules/@popperjs/core/lib/dom-utils/getClippingRect.js
function getInnerBoundingClientRect(element, strategy) {
  var rect = getBoundingClientRect(element, false, strategy === "fixed");
  rect.top = rect.top + element.clientTop;
  rect.left = rect.left + element.clientLeft;
  rect.bottom = rect.top + element.clientHeight;
  rect.right = rect.left + element.clientWidth;
  rect.width = element.clientWidth;
  rect.height = element.clientHeight;
  rect.x = rect.left;
  rect.y = rect.top;
  return rect;
}
function getClientRectFromMixedType(element, clippingParent, strategy) {
  return clippingParent === viewport ? rectToClientRect(getViewportRect(element, strategy)) : isElement(clippingParent) ? getInnerBoundingClientRect(clippingParent, strategy) : rectToClientRect(getDocumentRect(getDocumentElement(element)));
}
function getClippingParents(element) {
  var clippingParents2 = listScrollParents(getParentNode(element));
  var canEscapeClipping = ["absolute", "fixed"].indexOf(getComputedStyle(element).position) >= 0;
  var clipperElement = canEscapeClipping && isHTMLElement(element) ? getOffsetParent(element) : element;
  if (!isElement(clipperElement)) {
    return [];
  }
  return clippingParents2.filter(function(clippingParent) {
    return isElement(clippingParent) && contains(clippingParent, clipperElement) && getNodeName(clippingParent) !== "body";
  });
}
function getClippingRect(element, boundary, rootBoundary, strategy) {
  var mainClippingParents = boundary === "clippingParents" ? getClippingParents(element) : [].concat(boundary);
  var clippingParents2 = [].concat(mainClippingParents, [rootBoundary]);
  var firstClippingParent = clippingParents2[0];
  var clippingRect = clippingParents2.reduce(function(accRect, clippingParent) {
    var rect = getClientRectFromMixedType(element, clippingParent, strategy);
    accRect.top = max(rect.top, accRect.top);
    accRect.right = min(rect.right, accRect.right);
    accRect.bottom = min(rect.bottom, accRect.bottom);
    accRect.left = max(rect.left, accRect.left);
    return accRect;
  }, getClientRectFromMixedType(element, firstClippingParent, strategy));
  clippingRect.width = clippingRect.right - clippingRect.left;
  clippingRect.height = clippingRect.bottom - clippingRect.top;
  clippingRect.x = clippingRect.left;
  clippingRect.y = clippingRect.top;
  return clippingRect;
}

// node_modules/@popperjs/core/lib/utils/computeOffsets.js
function computeOffsets(_ref) {
  var reference2 = _ref.reference, element = _ref.element, placement = _ref.placement;
  var basePlacement = placement ? getBasePlacement(placement) : null;
  var variation = placement ? getVariation(placement) : null;
  var commonX = reference2.x + reference2.width / 2 - element.width / 2;
  var commonY = reference2.y + reference2.height / 2 - element.height / 2;
  var offsets;
  switch (basePlacement) {
    case top:
      offsets = {
        x: commonX,
        y: reference2.y - element.height
      };
      break;
    case bottom:
      offsets = {
        x: commonX,
        y: reference2.y + reference2.height
      };
      break;
    case right:
      offsets = {
        x: reference2.x + reference2.width,
        y: commonY
      };
      break;
    case left:
      offsets = {
        x: reference2.x - element.width,
        y: commonY
      };
      break;
    default:
      offsets = {
        x: reference2.x,
        y: reference2.y
      };
  }
  var mainAxis = basePlacement ? getMainAxisFromPlacement(basePlacement) : null;
  if (mainAxis != null) {
    var len = mainAxis === "y" ? "height" : "width";
    switch (variation) {
      case start:
        offsets[mainAxis] = offsets[mainAxis] - (reference2[len] / 2 - element[len] / 2);
        break;
      case end:
        offsets[mainAxis] = offsets[mainAxis] + (reference2[len] / 2 - element[len] / 2);
        break;
      default:
    }
  }
  return offsets;
}

// node_modules/@popperjs/core/lib/utils/detectOverflow.js
function detectOverflow(state, options) {
  if (options === void 0) {
    options = {};
  }
  var _options = options, _options$placement = _options.placement, placement = _options$placement === void 0 ? state.placement : _options$placement, _options$strategy = _options.strategy, strategy = _options$strategy === void 0 ? state.strategy : _options$strategy, _options$boundary = _options.boundary, boundary = _options$boundary === void 0 ? clippingParents : _options$boundary, _options$rootBoundary = _options.rootBoundary, rootBoundary = _options$rootBoundary === void 0 ? viewport : _options$rootBoundary, _options$elementConte = _options.elementContext, elementContext = _options$elementConte === void 0 ? popper : _options$elementConte, _options$altBoundary = _options.altBoundary, altBoundary = _options$altBoundary === void 0 ? false : _options$altBoundary, _options$padding = _options.padding, padding = _options$padding === void 0 ? 0 : _options$padding;
  var paddingObject = mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
  var altContext = elementContext === popper ? reference : popper;
  var popperRect = state.rects.popper;
  var element = state.elements[altBoundary ? altContext : elementContext];
  var clippingClientRect = getClippingRect(isElement(element) ? element : element.contextElement || getDocumentElement(state.elements.popper), boundary, rootBoundary, strategy);
  var referenceClientRect = getBoundingClientRect(state.elements.reference);
  var popperOffsets2 = computeOffsets({
    reference: referenceClientRect,
    element: popperRect,
    strategy: "absolute",
    placement
  });
  var popperClientRect = rectToClientRect(Object.assign({}, popperRect, popperOffsets2));
  var elementClientRect = elementContext === popper ? popperClientRect : referenceClientRect;
  var overflowOffsets = {
    top: clippingClientRect.top - elementClientRect.top + paddingObject.top,
    bottom: elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom,
    left: clippingClientRect.left - elementClientRect.left + paddingObject.left,
    right: elementClientRect.right - clippingClientRect.right + paddingObject.right
  };
  var offsetData = state.modifiersData.offset;
  if (elementContext === popper && offsetData) {
    var offset2 = offsetData[placement];
    Object.keys(overflowOffsets).forEach(function(key) {
      var multiply = [right, bottom].indexOf(key) >= 0 ? 1 : -1;
      var axis = [top, bottom].indexOf(key) >= 0 ? "y" : "x";
      overflowOffsets[key] += offset2[axis] * multiply;
    });
  }
  return overflowOffsets;
}

// node_modules/@popperjs/core/lib/utils/computeAutoPlacement.js
function computeAutoPlacement(state, options) {
  if (options === void 0) {
    options = {};
  }
  var _options = options, placement = _options.placement, boundary = _options.boundary, rootBoundary = _options.rootBoundary, padding = _options.padding, flipVariations = _options.flipVariations, _options$allowedAutoP = _options.allowedAutoPlacements, allowedAutoPlacements = _options$allowedAutoP === void 0 ? placements : _options$allowedAutoP;
  var variation = getVariation(placement);
  var placements2 = variation ? flipVariations ? variationPlacements : variationPlacements.filter(function(placement2) {
    return getVariation(placement2) === variation;
  }) : basePlacements;
  var allowedPlacements = placements2.filter(function(placement2) {
    return allowedAutoPlacements.indexOf(placement2) >= 0;
  });
  if (allowedPlacements.length === 0) {
    allowedPlacements = placements2;
  }
  var overflows = allowedPlacements.reduce(function(acc, placement2) {
    acc[placement2] = detectOverflow(state, {
      placement: placement2,
      boundary,
      rootBoundary,
      padding
    })[getBasePlacement(placement2)];
    return acc;
  }, {});
  return Object.keys(overflows).sort(function(a, b) {
    return overflows[a] - overflows[b];
  });
}

// node_modules/@popperjs/core/lib/modifiers/flip.js
function getExpandedFallbackPlacements(placement) {
  if (getBasePlacement(placement) === auto) {
    return [];
  }
  var oppositePlacement = getOppositePlacement(placement);
  return [getOppositeVariationPlacement(placement), oppositePlacement, getOppositeVariationPlacement(oppositePlacement)];
}
function flip(_ref) {
  var state = _ref.state, options = _ref.options, name = _ref.name;
  if (state.modifiersData[name]._skip) {
    return;
  }
  var _options$mainAxis = options.mainAxis, checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis, _options$altAxis = options.altAxis, checkAltAxis = _options$altAxis === void 0 ? true : _options$altAxis, specifiedFallbackPlacements = options.fallbackPlacements, padding = options.padding, boundary = options.boundary, rootBoundary = options.rootBoundary, altBoundary = options.altBoundary, _options$flipVariatio = options.flipVariations, flipVariations = _options$flipVariatio === void 0 ? true : _options$flipVariatio, allowedAutoPlacements = options.allowedAutoPlacements;
  var preferredPlacement = state.options.placement;
  var basePlacement = getBasePlacement(preferredPlacement);
  var isBasePlacement = basePlacement === preferredPlacement;
  var fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipVariations ? [getOppositePlacement(preferredPlacement)] : getExpandedFallbackPlacements(preferredPlacement));
  var placements2 = [preferredPlacement].concat(fallbackPlacements).reduce(function(acc, placement2) {
    return acc.concat(getBasePlacement(placement2) === auto ? computeAutoPlacement(state, {
      placement: placement2,
      boundary,
      rootBoundary,
      padding,
      flipVariations,
      allowedAutoPlacements
    }) : placement2);
  }, []);
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var checksMap = /* @__PURE__ */ new Map();
  var makeFallbackChecks = true;
  var firstFittingPlacement = placements2[0];
  for (var i = 0; i < placements2.length; i++) {
    var placement = placements2[i];
    var _basePlacement = getBasePlacement(placement);
    var isStartVariation = getVariation(placement) === start;
    var isVertical = [top, bottom].indexOf(_basePlacement) >= 0;
    var len = isVertical ? "width" : "height";
    var overflow = detectOverflow(state, {
      placement,
      boundary,
      rootBoundary,
      altBoundary,
      padding
    });
    var mainVariationSide = isVertical ? isStartVariation ? right : left : isStartVariation ? bottom : top;
    if (referenceRect[len] > popperRect[len]) {
      mainVariationSide = getOppositePlacement(mainVariationSide);
    }
    var altVariationSide = getOppositePlacement(mainVariationSide);
    var checks = [];
    if (checkMainAxis) {
      checks.push(overflow[_basePlacement] <= 0);
    }
    if (checkAltAxis) {
      checks.push(overflow[mainVariationSide] <= 0, overflow[altVariationSide] <= 0);
    }
    if (checks.every(function(check) {
      return check;
    })) {
      firstFittingPlacement = placement;
      makeFallbackChecks = false;
      break;
    }
    checksMap.set(placement, checks);
  }
  if (makeFallbackChecks) {
    var numberOfChecks = flipVariations ? 3 : 1;
    var _loop = function _loop2(_i2) {
      var fittingPlacement = placements2.find(function(placement2) {
        var checks2 = checksMap.get(placement2);
        if (checks2) {
          return checks2.slice(0, _i2).every(function(check) {
            return check;
          });
        }
      });
      if (fittingPlacement) {
        firstFittingPlacement = fittingPlacement;
        return "break";
      }
    };
    for (var _i = numberOfChecks; _i > 0; _i--) {
      var _ret = _loop(_i);
      if (_ret === "break") break;
    }
  }
  if (state.placement !== firstFittingPlacement) {
    state.modifiersData[name]._skip = true;
    state.placement = firstFittingPlacement;
    state.reset = true;
  }
}
var flip_default = {
  name: "flip",
  enabled: true,
  phase: "main",
  fn: flip,
  requiresIfExists: ["offset"],
  data: {
    _skip: false
  }
};

// node_modules/@popperjs/core/lib/modifiers/hide.js
function getSideOffsets(overflow, rect, preventedOffsets) {
  if (preventedOffsets === void 0) {
    preventedOffsets = {
      x: 0,
      y: 0
    };
  }
  return {
    top: overflow.top - rect.height - preventedOffsets.y,
    right: overflow.right - rect.width + preventedOffsets.x,
    bottom: overflow.bottom - rect.height + preventedOffsets.y,
    left: overflow.left - rect.width - preventedOffsets.x
  };
}
function isAnySideFullyClipped(overflow) {
  return [top, right, bottom, left].some(function(side) {
    return overflow[side] >= 0;
  });
}
function hide(_ref) {
  var state = _ref.state, name = _ref.name;
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var preventedOffsets = state.modifiersData.preventOverflow;
  var referenceOverflow = detectOverflow(state, {
    elementContext: "reference"
  });
  var popperAltOverflow = detectOverflow(state, {
    altBoundary: true
  });
  var referenceClippingOffsets = getSideOffsets(referenceOverflow, referenceRect);
  var popperEscapeOffsets = getSideOffsets(popperAltOverflow, popperRect, preventedOffsets);
  var isReferenceHidden = isAnySideFullyClipped(referenceClippingOffsets);
  var hasPopperEscaped = isAnySideFullyClipped(popperEscapeOffsets);
  state.modifiersData[name] = {
    referenceClippingOffsets,
    popperEscapeOffsets,
    isReferenceHidden,
    hasPopperEscaped
  };
  state.attributes.popper = Object.assign({}, state.attributes.popper, {
    "data-popper-reference-hidden": isReferenceHidden,
    "data-popper-escaped": hasPopperEscaped
  });
}
var hide_default = {
  name: "hide",
  enabled: true,
  phase: "main",
  requiresIfExists: ["preventOverflow"],
  fn: hide
};

// node_modules/@popperjs/core/lib/modifiers/offset.js
function distanceAndSkiddingToXY(placement, rects, offset2) {
  var basePlacement = getBasePlacement(placement);
  var invertDistance = [left, top].indexOf(basePlacement) >= 0 ? -1 : 1;
  var _ref = typeof offset2 === "function" ? offset2(Object.assign({}, rects, {
    placement
  })) : offset2, skidding = _ref[0], distance = _ref[1];
  skidding = skidding || 0;
  distance = (distance || 0) * invertDistance;
  return [left, right].indexOf(basePlacement) >= 0 ? {
    x: distance,
    y: skidding
  } : {
    x: skidding,
    y: distance
  };
}
function offset(_ref2) {
  var state = _ref2.state, options = _ref2.options, name = _ref2.name;
  var _options$offset = options.offset, offset2 = _options$offset === void 0 ? [0, 0] : _options$offset;
  var data = placements.reduce(function(acc, placement) {
    acc[placement] = distanceAndSkiddingToXY(placement, state.rects, offset2);
    return acc;
  }, {});
  var _data$state$placement = data[state.placement], x = _data$state$placement.x, y = _data$state$placement.y;
  if (state.modifiersData.popperOffsets != null) {
    state.modifiersData.popperOffsets.x += x;
    state.modifiersData.popperOffsets.y += y;
  }
  state.modifiersData[name] = data;
}
var offset_default = {
  name: "offset",
  enabled: true,
  phase: "main",
  requires: ["popperOffsets"],
  fn: offset
};

// node_modules/@popperjs/core/lib/modifiers/popperOffsets.js
function popperOffsets(_ref) {
  var state = _ref.state, name = _ref.name;
  state.modifiersData[name] = computeOffsets({
    reference: state.rects.reference,
    element: state.rects.popper,
    strategy: "absolute",
    placement: state.placement
  });
}
var popperOffsets_default = {
  name: "popperOffsets",
  enabled: true,
  phase: "read",
  fn: popperOffsets,
  data: {}
};

// node_modules/@popperjs/core/lib/utils/getAltAxis.js
function getAltAxis(axis) {
  return axis === "x" ? "y" : "x";
}

// node_modules/@popperjs/core/lib/modifiers/preventOverflow.js
function preventOverflow(_ref) {
  var state = _ref.state, options = _ref.options, name = _ref.name;
  var _options$mainAxis = options.mainAxis, checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis, _options$altAxis = options.altAxis, checkAltAxis = _options$altAxis === void 0 ? false : _options$altAxis, boundary = options.boundary, rootBoundary = options.rootBoundary, altBoundary = options.altBoundary, padding = options.padding, _options$tether = options.tether, tether = _options$tether === void 0 ? true : _options$tether, _options$tetherOffset = options.tetherOffset, tetherOffset = _options$tetherOffset === void 0 ? 0 : _options$tetherOffset;
  var overflow = detectOverflow(state, {
    boundary,
    rootBoundary,
    padding,
    altBoundary
  });
  var basePlacement = getBasePlacement(state.placement);
  var variation = getVariation(state.placement);
  var isBasePlacement = !variation;
  var mainAxis = getMainAxisFromPlacement(basePlacement);
  var altAxis = getAltAxis(mainAxis);
  var popperOffsets2 = state.modifiersData.popperOffsets;
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var tetherOffsetValue = typeof tetherOffset === "function" ? tetherOffset(Object.assign({}, state.rects, {
    placement: state.placement
  })) : tetherOffset;
  var normalizedTetherOffsetValue = typeof tetherOffsetValue === "number" ? {
    mainAxis: tetherOffsetValue,
    altAxis: tetherOffsetValue
  } : Object.assign({
    mainAxis: 0,
    altAxis: 0
  }, tetherOffsetValue);
  var offsetModifierState = state.modifiersData.offset ? state.modifiersData.offset[state.placement] : null;
  var data = {
    x: 0,
    y: 0
  };
  if (!popperOffsets2) {
    return;
  }
  if (checkMainAxis) {
    var _offsetModifierState$;
    var mainSide = mainAxis === "y" ? top : left;
    var altSide = mainAxis === "y" ? bottom : right;
    var len = mainAxis === "y" ? "height" : "width";
    var offset2 = popperOffsets2[mainAxis];
    var min2 = offset2 + overflow[mainSide];
    var max2 = offset2 - overflow[altSide];
    var additive = tether ? -popperRect[len] / 2 : 0;
    var minLen = variation === start ? referenceRect[len] : popperRect[len];
    var maxLen = variation === start ? -popperRect[len] : -referenceRect[len];
    var arrowElement = state.elements.arrow;
    var arrowRect = tether && arrowElement ? getLayoutRect(arrowElement) : {
      width: 0,
      height: 0
    };
    var arrowPaddingObject = state.modifiersData["arrow#persistent"] ? state.modifiersData["arrow#persistent"].padding : getFreshSideObject();
    var arrowPaddingMin = arrowPaddingObject[mainSide];
    var arrowPaddingMax = arrowPaddingObject[altSide];
    var arrowLen = within(0, referenceRect[len], arrowRect[len]);
    var minOffset = isBasePlacement ? referenceRect[len] / 2 - additive - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis : minLen - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis;
    var maxOffset = isBasePlacement ? -referenceRect[len] / 2 + additive + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis : maxLen + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis;
    var arrowOffsetParent = state.elements.arrow && getOffsetParent(state.elements.arrow);
    var clientOffset = arrowOffsetParent ? mainAxis === "y" ? arrowOffsetParent.clientTop || 0 : arrowOffsetParent.clientLeft || 0 : 0;
    var offsetModifierValue = (_offsetModifierState$ = offsetModifierState == null ? void 0 : offsetModifierState[mainAxis]) != null ? _offsetModifierState$ : 0;
    var tetherMin = offset2 + minOffset - offsetModifierValue - clientOffset;
    var tetherMax = offset2 + maxOffset - offsetModifierValue;
    var preventedOffset = within(tether ? min(min2, tetherMin) : min2, offset2, tether ? max(max2, tetherMax) : max2);
    popperOffsets2[mainAxis] = preventedOffset;
    data[mainAxis] = preventedOffset - offset2;
  }
  if (checkAltAxis) {
    var _offsetModifierState$2;
    var _mainSide = mainAxis === "x" ? top : left;
    var _altSide = mainAxis === "x" ? bottom : right;
    var _offset = popperOffsets2[altAxis];
    var _len = altAxis === "y" ? "height" : "width";
    var _min = _offset + overflow[_mainSide];
    var _max = _offset - overflow[_altSide];
    var isOriginSide = [top, left].indexOf(basePlacement) !== -1;
    var _offsetModifierValue = (_offsetModifierState$2 = offsetModifierState == null ? void 0 : offsetModifierState[altAxis]) != null ? _offsetModifierState$2 : 0;
    var _tetherMin = isOriginSide ? _min : _offset - referenceRect[_len] - popperRect[_len] - _offsetModifierValue + normalizedTetherOffsetValue.altAxis;
    var _tetherMax = isOriginSide ? _offset + referenceRect[_len] + popperRect[_len] - _offsetModifierValue - normalizedTetherOffsetValue.altAxis : _max;
    var _preventedOffset = tether && isOriginSide ? withinMaxClamp(_tetherMin, _offset, _tetherMax) : within(tether ? _tetherMin : _min, _offset, tether ? _tetherMax : _max);
    popperOffsets2[altAxis] = _preventedOffset;
    data[altAxis] = _preventedOffset - _offset;
  }
  state.modifiersData[name] = data;
}
var preventOverflow_default = {
  name: "preventOverflow",
  enabled: true,
  phase: "main",
  fn: preventOverflow,
  requiresIfExists: ["offset"]
};

// node_modules/@popperjs/core/lib/dom-utils/getHTMLElementScroll.js
function getHTMLElementScroll(element) {
  return {
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop
  };
}

// node_modules/@popperjs/core/lib/dom-utils/getNodeScroll.js
function getNodeScroll(node) {
  if (node === getWindow(node) || !isHTMLElement(node)) {
    return getWindowScroll(node);
  } else {
    return getHTMLElementScroll(node);
  }
}

// node_modules/@popperjs/core/lib/dom-utils/getCompositeRect.js
function isElementScaled(element) {
  var rect = element.getBoundingClientRect();
  var scaleX = round(rect.width) / element.offsetWidth || 1;
  var scaleY = round(rect.height) / element.offsetHeight || 1;
  return scaleX !== 1 || scaleY !== 1;
}
function getCompositeRect(elementOrVirtualElement, offsetParent, isFixed) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  var isOffsetParentAnElement = isHTMLElement(offsetParent);
  var offsetParentIsScaled = isHTMLElement(offsetParent) && isElementScaled(offsetParent);
  var documentElement = getDocumentElement(offsetParent);
  var rect = getBoundingClientRect(elementOrVirtualElement, offsetParentIsScaled, isFixed);
  var scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  var offsets = {
    x: 0,
    y: 0
  };
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== "body" || // https://github.com/popperjs/popper-core/issues/1078
    isScrollParent(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isHTMLElement(offsetParent)) {
      offsets = getBoundingClientRect(offsetParent, true);
      offsets.x += offsetParent.clientLeft;
      offsets.y += offsetParent.clientTop;
    } else if (documentElement) {
      offsets.x = getWindowScrollBarX(documentElement);
    }
  }
  return {
    x: rect.left + scroll.scrollLeft - offsets.x,
    y: rect.top + scroll.scrollTop - offsets.y,
    width: rect.width,
    height: rect.height
  };
}

// node_modules/@popperjs/core/lib/utils/orderModifiers.js
function order(modifiers) {
  var map = /* @__PURE__ */ new Map();
  var visited = /* @__PURE__ */ new Set();
  var result = [];
  modifiers.forEach(function(modifier) {
    map.set(modifier.name, modifier);
  });
  function sort(modifier) {
    visited.add(modifier.name);
    var requires = [].concat(modifier.requires || [], modifier.requiresIfExists || []);
    requires.forEach(function(dep) {
      if (!visited.has(dep)) {
        var depModifier = map.get(dep);
        if (depModifier) {
          sort(depModifier);
        }
      }
    });
    result.push(modifier);
  }
  modifiers.forEach(function(modifier) {
    if (!visited.has(modifier.name)) {
      sort(modifier);
    }
  });
  return result;
}
function orderModifiers(modifiers) {
  var orderedModifiers = order(modifiers);
  return modifierPhases.reduce(function(acc, phase) {
    return acc.concat(orderedModifiers.filter(function(modifier) {
      return modifier.phase === phase;
    }));
  }, []);
}

// node_modules/@popperjs/core/lib/utils/debounce.js
function debounce(fn2) {
  var pending;
  return function() {
    if (!pending) {
      pending = new Promise(function(resolve) {
        Promise.resolve().then(function() {
          pending = void 0;
          resolve(fn2());
        });
      });
    }
    return pending;
  };
}

// node_modules/@popperjs/core/lib/utils/mergeByName.js
function mergeByName(modifiers) {
  var merged = modifiers.reduce(function(merged2, current) {
    var existing = merged2[current.name];
    merged2[current.name] = existing ? Object.assign({}, existing, current, {
      options: Object.assign({}, existing.options, current.options),
      data: Object.assign({}, existing.data, current.data)
    }) : current;
    return merged2;
  }, {});
  return Object.keys(merged).map(function(key) {
    return merged[key];
  });
}

// node_modules/@popperjs/core/lib/createPopper.js
var DEFAULT_OPTIONS = {
  placement: "bottom",
  modifiers: [],
  strategy: "absolute"
};
function areValidElements() {
  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }
  return !args.some(function(element) {
    return !(element && typeof element.getBoundingClientRect === "function");
  });
}
function popperGenerator(generatorOptions) {
  if (generatorOptions === void 0) {
    generatorOptions = {};
  }
  var _generatorOptions = generatorOptions, _generatorOptions$def = _generatorOptions.defaultModifiers, defaultModifiers3 = _generatorOptions$def === void 0 ? [] : _generatorOptions$def, _generatorOptions$def2 = _generatorOptions.defaultOptions, defaultOptions = _generatorOptions$def2 === void 0 ? DEFAULT_OPTIONS : _generatorOptions$def2;
  return function createPopper4(reference2, popper2, options) {
    if (options === void 0) {
      options = defaultOptions;
    }
    var state = {
      placement: "bottom",
      orderedModifiers: [],
      options: Object.assign({}, DEFAULT_OPTIONS, defaultOptions),
      modifiersData: {},
      elements: {
        reference: reference2,
        popper: popper2
      },
      attributes: {},
      styles: {}
    };
    var effectCleanupFns = [];
    var isDestroyed = false;
    var instance = {
      state,
      setOptions: function setOptions(setOptionsAction) {
        var options2 = typeof setOptionsAction === "function" ? setOptionsAction(state.options) : setOptionsAction;
        cleanupModifierEffects();
        state.options = Object.assign({}, defaultOptions, state.options, options2);
        state.scrollParents = {
          reference: isElement(reference2) ? listScrollParents(reference2) : reference2.contextElement ? listScrollParents(reference2.contextElement) : [],
          popper: listScrollParents(popper2)
        };
        var orderedModifiers = orderModifiers(mergeByName([].concat(defaultModifiers3, state.options.modifiers)));
        state.orderedModifiers = orderedModifiers.filter(function(m) {
          return m.enabled;
        });
        runModifierEffects();
        return instance.update();
      },
      // Sync update – it will always be executed, even if not necessary. This
      // is useful for low frequency updates where sync behavior simplifies the
      // logic.
      // For high frequency updates (e.g. `resize` and `scroll` events), always
      // prefer the async Popper#update method
      forceUpdate: function forceUpdate() {
        if (isDestroyed) {
          return;
        }
        var _state$elements = state.elements, reference3 = _state$elements.reference, popper3 = _state$elements.popper;
        if (!areValidElements(reference3, popper3)) {
          return;
        }
        state.rects = {
          reference: getCompositeRect(reference3, getOffsetParent(popper3), state.options.strategy === "fixed"),
          popper: getLayoutRect(popper3)
        };
        state.reset = false;
        state.placement = state.options.placement;
        state.orderedModifiers.forEach(function(modifier) {
          return state.modifiersData[modifier.name] = Object.assign({}, modifier.data);
        });
        for (var index = 0; index < state.orderedModifiers.length; index++) {
          if (state.reset === true) {
            state.reset = false;
            index = -1;
            continue;
          }
          var _state$orderedModifie = state.orderedModifiers[index], fn2 = _state$orderedModifie.fn, _state$orderedModifie2 = _state$orderedModifie.options, _options = _state$orderedModifie2 === void 0 ? {} : _state$orderedModifie2, name = _state$orderedModifie.name;
          if (typeof fn2 === "function") {
            state = fn2({
              state,
              options: _options,
              name,
              instance
            }) || state;
          }
        }
      },
      // Async and optimistically optimized update – it will not be executed if
      // not necessary (debounced to run at most once-per-tick)
      update: debounce(function() {
        return new Promise(function(resolve) {
          instance.forceUpdate();
          resolve(state);
        });
      }),
      destroy: function destroy() {
        cleanupModifierEffects();
        isDestroyed = true;
      }
    };
    if (!areValidElements(reference2, popper2)) {
      return instance;
    }
    instance.setOptions(options).then(function(state2) {
      if (!isDestroyed && options.onFirstUpdate) {
        options.onFirstUpdate(state2);
      }
    });
    function runModifierEffects() {
      state.orderedModifiers.forEach(function(_ref) {
        var name = _ref.name, _ref$options = _ref.options, options2 = _ref$options === void 0 ? {} : _ref$options, effect4 = _ref.effect;
        if (typeof effect4 === "function") {
          var cleanupFn = effect4({
            state,
            name,
            instance,
            options: options2
          });
          var noopFn = function noopFn2() {
          };
          effectCleanupFns.push(cleanupFn || noopFn);
        }
      });
    }
    function cleanupModifierEffects() {
      effectCleanupFns.forEach(function(fn2) {
        return fn2();
      });
      effectCleanupFns = [];
    }
    return instance;
  };
}
var createPopper = popperGenerator();

// node_modules/@popperjs/core/lib/popper-lite.js
var defaultModifiers = [eventListeners_default, popperOffsets_default, computeStyles_default, applyStyles_default];
var createPopper2 = popperGenerator({
  defaultModifiers
});

// node_modules/@popperjs/core/lib/popper.js
var defaultModifiers2 = [eventListeners_default, popperOffsets_default, computeStyles_default, applyStyles_default, offset_default, flip_default, preventOverflow_default, arrow_default, hide_default];
var createPopper3 = popperGenerator({
  defaultModifiers: defaultModifiers2
});

// node_modules/@mui/material/esm/Popper/BasePopper.js
var import_prop_types = __toESM(require_prop_types(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
function flipPlacement(placement, direction) {
  if (direction === "ltr") {
    return placement;
  }
  switch (placement) {
    case "bottom-end":
      return "bottom-start";
    case "bottom-start":
      return "bottom-end";
    case "top-end":
      return "top-start";
    case "top-start":
      return "top-end";
    default:
      return placement;
  }
}
function resolveAnchorEl(anchorEl) {
  return typeof anchorEl === "function" ? anchorEl() : anchorEl;
}
function isHTMLElement2(element) {
  return element.nodeType !== void 0;
}
function isVirtualElement(element) {
  return !isHTMLElement2(element);
}
var useUtilityClasses = (ownerState) => {
  const {
    classes
  } = ownerState;
  const slots = {
    root: ["root"]
  };
  return composeClasses(slots, getPopperUtilityClass, classes);
};
var defaultPopperOptions = {};
var PopperTooltip = React.forwardRef(function PopperTooltip2(props, forwardedRef) {
  const {
    anchorEl,
    children,
    direction,
    disablePortal,
    modifiers,
    open,
    placement: initialPlacement,
    popperOptions,
    popperRef: popperRefProp,
    slotProps = {},
    slots = {},
    TransitionProps,
    // @ts-ignore internal logic
    ownerState: ownerStateProp,
    // prevent from spreading to DOM, it can come from the parent component e.g. Select.
    ...other
  } = props;
  const tooltipRef = React.useRef(null);
  const ownRef = useForkRef(tooltipRef, forwardedRef);
  const popperRef = React.useRef(null);
  const handlePopperRef = useForkRef(popperRef, popperRefProp);
  const handlePopperRefRef = React.useRef(handlePopperRef);
  useEnhancedEffect_default(() => {
    handlePopperRefRef.current = handlePopperRef;
  }, [handlePopperRef]);
  React.useImperativeHandle(popperRefProp, () => popperRef.current, []);
  const rtlPlacement = flipPlacement(initialPlacement, direction);
  const [placement, setPlacement] = React.useState(rtlPlacement);
  const [resolvedAnchorElement, setResolvedAnchorElement] = React.useState(resolveAnchorEl(anchorEl));
  React.useEffect(() => {
    if (popperRef.current) {
      popperRef.current.forceUpdate();
    }
  });
  React.useEffect(() => {
    if (anchorEl) {
      setResolvedAnchorElement(resolveAnchorEl(anchorEl));
    }
  }, [anchorEl]);
  useEnhancedEffect_default(() => {
    if (!resolvedAnchorElement || !open) {
      return void 0;
    }
    const handlePopperUpdate = (data) => {
      setPlacement(data.placement);
    };
    if (true) {
      if (resolvedAnchorElement && isHTMLElement2(resolvedAnchorElement) && resolvedAnchorElement.nodeType === 1) {
        const box = resolvedAnchorElement.getBoundingClientRect();
        if (box.top === 0 && box.left === 0 && box.right === 0 && box.bottom === 0) {
          console.warn(["MUI: The `anchorEl` prop provided to the component is invalid.", "The anchor element should be part of the document layout.", "Make sure the element is present in the document or that it's not display none."].join("\n"));
        }
      }
    }
    let popperModifiers = [{
      name: "preventOverflow",
      options: {
        altBoundary: disablePortal
      }
    }, {
      name: "flip",
      options: {
        altBoundary: disablePortal
      }
    }, {
      name: "onUpdate",
      enabled: true,
      phase: "afterWrite",
      fn: ({
        state
      }) => {
        handlePopperUpdate(state);
      }
    }];
    if (modifiers != null) {
      popperModifiers = popperModifiers.concat(modifiers);
    }
    if (popperOptions && popperOptions.modifiers != null) {
      popperModifiers = popperModifiers.concat(popperOptions.modifiers);
    }
    const popper2 = createPopper3(resolvedAnchorElement, tooltipRef.current, {
      placement: rtlPlacement,
      ...popperOptions,
      modifiers: popperModifiers
    });
    handlePopperRefRef.current(popper2);
    return () => {
      popper2.destroy();
      handlePopperRefRef.current(null);
    };
  }, [resolvedAnchorElement, disablePortal, modifiers, open, popperOptions, rtlPlacement]);
  const childProps = {
    placement
  };
  if (TransitionProps !== null) {
    childProps.TransitionProps = TransitionProps;
  }
  const classes = useUtilityClasses(props);
  const Root = slots.root ?? "div";
  const rootProps = useSlotProps_default({
    elementType: Root,
    externalSlotProps: slotProps.root,
    externalForwardedProps: other,
    additionalProps: {
      role: "tooltip",
      ref: ownRef
    },
    ownerState: props,
    className: classes.root
  });
  return (0, import_jsx_runtime.jsx)(Root, {
    ...rootProps,
    children: typeof children === "function" ? children(childProps) : children
  });
});
var Popper = React.forwardRef(function Popper2(props, forwardedRef) {
  const {
    anchorEl,
    children,
    container: containerProp,
    direction = "ltr",
    disablePortal = false,
    keepMounted = false,
    modifiers,
    open,
    placement = "bottom",
    popperOptions = defaultPopperOptions,
    popperRef,
    style,
    transition = false,
    slotProps = {},
    slots = {},
    ...other
  } = props;
  const [exited, setExited] = React.useState(true);
  const handleEnter = () => {
    setExited(false);
  };
  const handleExited = () => {
    setExited(true);
  };
  if (!keepMounted && !open && (!transition || exited)) {
    return null;
  }
  let container;
  if (containerProp) {
    container = containerProp;
  } else if (anchorEl) {
    const resolvedAnchorEl = resolveAnchorEl(anchorEl);
    container = resolvedAnchorEl && isHTMLElement2(resolvedAnchorEl) ? ownerDocument(resolvedAnchorEl).body : ownerDocument(null).body;
  }
  const display = !open && keepMounted && (!transition || exited) ? "none" : void 0;
  const transitionProps = transition ? {
    in: open,
    onEnter: handleEnter,
    onExited: handleExited
  } : void 0;
  return (0, import_jsx_runtime.jsx)(Portal_default, {
    disablePortal,
    container,
    children: (0, import_jsx_runtime.jsx)(PopperTooltip, {
      anchorEl,
      direction,
      disablePortal,
      modifiers,
      ref: forwardedRef,
      open: transition ? !exited : open,
      placement,
      popperOptions,
      popperRef,
      slotProps,
      slots,
      ...other,
      style: {
        // Prevents scroll issue, waiting for Popper.js to add this style once initiated.
        position: "fixed",
        // Fix Popper.js display issue
        top: 0,
        left: 0,
        display,
        ...style
      },
      TransitionProps: transitionProps,
      children
    })
  });
});
true ? Popper.propTypes = {
  // ┌────────────────────────────── Warning ──────────────────────────────┐
  // │ These PropTypes are generated from the TypeScript type definitions. │
  // │ To update them, edit the TypeScript types and run `pnpm proptypes`. │
  // └─────────────────────────────────────────────────────────────────────┘
  /**
   * An HTML element, [virtualElement](https://popper.js.org/docs/v2/virtual-elements/),
   * or a function that returns either.
   * It's used to set the position of the popper.
   * The return value will passed as the reference object of the Popper instance.
   */
  anchorEl: chainPropTypes(import_prop_types.default.oneOfType([HTMLElementType, import_prop_types.default.object, import_prop_types.default.func]), (props) => {
    if (props.open) {
      const resolvedAnchorEl = resolveAnchorEl(props.anchorEl);
      if (resolvedAnchorEl && isHTMLElement2(resolvedAnchorEl) && resolvedAnchorEl.nodeType === 1) {
        const box = resolvedAnchorEl.getBoundingClientRect();
        if (box.top === 0 && box.left === 0 && box.right === 0 && box.bottom === 0) {
          return new Error(["MUI: The `anchorEl` prop provided to the component is invalid.", "The anchor element should be part of the document layout.", "Make sure the element is present in the document or that it's not display none."].join("\n"));
        }
      } else if (!resolvedAnchorEl || typeof resolvedAnchorEl.getBoundingClientRect !== "function" || isVirtualElement(resolvedAnchorEl) && resolvedAnchorEl.contextElement != null && resolvedAnchorEl.contextElement.nodeType !== 1) {
        return new Error(["MUI: The `anchorEl` prop provided to the component is invalid.", "It should be an HTML element instance or a virtualElement ", "(https://popper.js.org/docs/v2/virtual-elements/)."].join("\n"));
      }
    }
    return null;
  }),
  /**
   * Popper render function or node.
   */
  children: import_prop_types.default.oneOfType([import_prop_types.default.node, import_prop_types.default.func]),
  /**
   * An HTML element or function that returns one.
   * The `container` will have the portal children appended to it.
   *
   * You can also provide a callback, which is called in a React layout effect.
   * This lets you set the container from a ref, and also makes server-side rendering possible.
   *
   * By default, it uses the body of the top-level document object,
   * so it's simply `document.body` most of the time.
   */
  container: import_prop_types.default.oneOfType([HTMLElementType, import_prop_types.default.func]),
  /**
   * Direction of the text.
   * @default 'ltr'
   */
  direction: import_prop_types.default.oneOf(["ltr", "rtl"]),
  /**
   * The `children` will be under the DOM hierarchy of the parent component.
   * @default false
   */
  disablePortal: import_prop_types.default.bool,
  /**
   * Always keep the children in the DOM.
   * This prop can be useful in SEO situation or
   * when you want to maximize the responsiveness of the Popper.
   * @default false
   */
  keepMounted: import_prop_types.default.bool,
  /**
   * Popper.js is based on a "plugin-like" architecture,
   * most of its features are fully encapsulated "modifiers".
   *
   * A modifier is a function that is called each time Popper.js needs to
   * compute the position of the popper.
   * For this reason, modifiers should be very performant to avoid bottlenecks.
   * To learn how to create a modifier, [read the modifiers documentation](https://popper.js.org/docs/v2/modifiers/).
   */
  modifiers: import_prop_types.default.arrayOf(import_prop_types.default.shape({
    data: import_prop_types.default.object,
    effect: import_prop_types.default.func,
    enabled: import_prop_types.default.bool,
    fn: import_prop_types.default.func,
    name: import_prop_types.default.any,
    options: import_prop_types.default.object,
    phase: import_prop_types.default.oneOf(["afterMain", "afterRead", "afterWrite", "beforeMain", "beforeRead", "beforeWrite", "main", "read", "write"]),
    requires: import_prop_types.default.arrayOf(import_prop_types.default.string),
    requiresIfExists: import_prop_types.default.arrayOf(import_prop_types.default.string)
  })),
  /**
   * If `true`, the component is shown.
   */
  open: import_prop_types.default.bool.isRequired,
  /**
   * Popper placement.
   * @default 'bottom'
   */
  placement: import_prop_types.default.oneOf(["auto-end", "auto-start", "auto", "bottom-end", "bottom-start", "bottom", "left-end", "left-start", "left", "right-end", "right-start", "right", "top-end", "top-start", "top"]),
  /**
   * Options provided to the [`Popper.js`](https://popper.js.org/docs/v2/constructors/#options) instance.
   * @default {}
   */
  popperOptions: import_prop_types.default.shape({
    modifiers: import_prop_types.default.array,
    onFirstUpdate: import_prop_types.default.func,
    placement: import_prop_types.default.oneOf(["auto-end", "auto-start", "auto", "bottom-end", "bottom-start", "bottom", "left-end", "left-start", "left", "right-end", "right-start", "right", "top-end", "top-start", "top"]),
    strategy: import_prop_types.default.oneOf(["absolute", "fixed"])
  }),
  /**
   * A ref that points to the used popper instance.
   */
  popperRef: refType_default,
  /**
   * The props used for each slot inside the Popper.
   * @default {}
   */
  slotProps: import_prop_types.default.shape({
    root: import_prop_types.default.oneOfType([import_prop_types.default.func, import_prop_types.default.object])
  }),
  /**
   * The components used for each slot inside the Popper.
   * Either a string to use a HTML element or a component.
   * @default {}
   */
  slots: import_prop_types.default.shape({
    root: import_prop_types.default.elementType
  }),
  /**
   * Help supporting a react-transition-group/Transition component.
   * @default false
   */
  transition: import_prop_types.default.bool
} : void 0;
var BasePopper_default = Popper;

// node_modules/@mui/material/esm/Popper/Popper.js
var import_jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
var PopperRoot = styled_default(BasePopper_default, {
  name: "MuiPopper",
  slot: "Root"
})({});
var Popper3 = React2.forwardRef(function Popper4(inProps, ref) {
  const isRtl = useRtl();
  const props = useDefaultProps({
    props: inProps,
    name: "MuiPopper"
  });
  const {
    anchorEl,
    component,
    components,
    componentsProps,
    container,
    disablePortal,
    keepMounted,
    modifiers,
    open,
    placement,
    popperOptions,
    popperRef,
    transition,
    slots,
    slotProps,
    ...other
  } = props;
  const RootComponent = slots?.root ?? components?.Root;
  const otherProps = {
    anchorEl,
    container,
    disablePortal,
    keepMounted,
    modifiers,
    open,
    placement,
    popperOptions,
    popperRef,
    transition,
    ...other
  };
  return (0, import_jsx_runtime2.jsx)(PopperRoot, {
    as: component,
    direction: isRtl ? "rtl" : "ltr",
    slots: {
      root: RootComponent
    },
    slotProps: slotProps ?? componentsProps,
    ...otherProps,
    ref
  });
});
true ? Popper3.propTypes = {
  // ┌────────────────────────────── Warning ──────────────────────────────┐
  // │ These PropTypes are generated from the TypeScript type definitions. │
  // │ To update them, edit the TypeScript types and run `pnpm proptypes`. │
  // └─────────────────────────────────────────────────────────────────────┘
  /**
   * An HTML element, [virtualElement](https://popper.js.org/docs/v2/virtual-elements/),
   * or a function that returns either.
   * It's used to set the position of the popper.
   * The return value will passed as the reference object of the Popper instance.
   */
  anchorEl: import_prop_types2.default.oneOfType([HTMLElementType, import_prop_types2.default.object, import_prop_types2.default.func]),
  /**
   * Popper render function or node.
   */
  children: import_prop_types2.default.oneOfType([import_prop_types2.default.node, import_prop_types2.default.func]),
  /**
   * The component used for the root node.
   * Either a string to use a HTML element or a component.
   */
  component: import_prop_types2.default.elementType,
  /**
   * The components used for each slot inside the Popper.
   * Either a string to use a HTML element or a component.
   *
   * @deprecated use the `slots` prop instead. This prop will be removed in a future major release. [How to migrate](/material-ui/migration/migrating-from-deprecated-apis/).
   * @default {}
   */
  components: import_prop_types2.default.shape({
    Root: import_prop_types2.default.elementType
  }),
  /**
   * The props used for each slot inside the Popper.
   *
   * @deprecated use the `slotProps` prop instead. This prop will be removed in a future major release. [How to migrate](/material-ui/migration/migrating-from-deprecated-apis/).
   * @default {}
   */
  componentsProps: import_prop_types2.default.shape({
    root: import_prop_types2.default.oneOfType([import_prop_types2.default.func, import_prop_types2.default.object])
  }),
  /**
   * An HTML element or function that returns one.
   * The `container` will have the portal children appended to it.
   *
   * You can also provide a callback, which is called in a React layout effect.
   * This lets you set the container from a ref, and also makes server-side rendering possible.
   *
   * By default, it uses the body of the top-level document object,
   * so it's simply `document.body` most of the time.
   */
  container: import_prop_types2.default.oneOfType([HTMLElementType, import_prop_types2.default.func]),
  /**
   * The `children` will be under the DOM hierarchy of the parent component.
   * @default false
   */
  disablePortal: import_prop_types2.default.bool,
  /**
   * Always keep the children in the DOM.
   * This prop can be useful in SEO situation or
   * when you want to maximize the responsiveness of the Popper.
   * @default false
   */
  keepMounted: import_prop_types2.default.bool,
  /**
   * Popper.js is based on a "plugin-like" architecture,
   * most of its features are fully encapsulated "modifiers".
   *
   * A modifier is a function that is called each time Popper.js needs to
   * compute the position of the popper.
   * For this reason, modifiers should be very performant to avoid bottlenecks.
   * To learn how to create a modifier, [read the modifiers documentation](https://popper.js.org/docs/v2/modifiers/).
   */
  modifiers: import_prop_types2.default.arrayOf(import_prop_types2.default.shape({
    data: import_prop_types2.default.object,
    effect: import_prop_types2.default.func,
    enabled: import_prop_types2.default.bool,
    fn: import_prop_types2.default.func,
    name: import_prop_types2.default.any,
    options: import_prop_types2.default.object,
    phase: import_prop_types2.default.oneOf(["afterMain", "afterRead", "afterWrite", "beforeMain", "beforeRead", "beforeWrite", "main", "read", "write"]),
    requires: import_prop_types2.default.arrayOf(import_prop_types2.default.string),
    requiresIfExists: import_prop_types2.default.arrayOf(import_prop_types2.default.string)
  })),
  /**
   * If `true`, the component is shown.
   */
  open: import_prop_types2.default.bool.isRequired,
  /**
   * Popper placement.
   * @default 'bottom'
   */
  placement: import_prop_types2.default.oneOf(["auto-end", "auto-start", "auto", "bottom-end", "bottom-start", "bottom", "left-end", "left-start", "left", "right-end", "right-start", "right", "top-end", "top-start", "top"]),
  /**
   * Options provided to the [`Popper.js`](https://popper.js.org/docs/v2/constructors/#options) instance.
   * @default {}
   */
  popperOptions: import_prop_types2.default.shape({
    modifiers: import_prop_types2.default.array,
    onFirstUpdate: import_prop_types2.default.func,
    placement: import_prop_types2.default.oneOf(["auto-end", "auto-start", "auto", "bottom-end", "bottom-start", "bottom", "left-end", "left-start", "left", "right-end", "right-start", "right", "top-end", "top-start", "top"]),
    strategy: import_prop_types2.default.oneOf(["absolute", "fixed"])
  }),
  /**
   * A ref that points to the used popper instance.
   */
  popperRef: refType_default,
  /**
   * The props used for each slot inside the Popper.
   * @default {}
   */
  slotProps: import_prop_types2.default.shape({
    root: import_prop_types2.default.oneOfType([import_prop_types2.default.func, import_prop_types2.default.object])
  }),
  /**
   * The components used for each slot inside the Popper.
   * Either a string to use a HTML element or a component.
   * @default {}
   */
  slots: import_prop_types2.default.shape({
    root: import_prop_types2.default.elementType
  }),
  /**
   * The system prop that allows defining system overrides as well as additional CSS styles.
   */
  sx: import_prop_types2.default.oneOfType([import_prop_types2.default.arrayOf(import_prop_types2.default.oneOfType([import_prop_types2.default.func, import_prop_types2.default.object, import_prop_types2.default.bool])), import_prop_types2.default.func, import_prop_types2.default.object]),
  /**
   * Help supporting a react-transition-group/Transition component.
   * @default false
   */
  transition: import_prop_types2.default.bool
} : void 0;
var Popper_default = Popper3;

// node_modules/@mui/material/esm/Chip/chipClasses.js
function getChipUtilityClass(slot) {
  return generateUtilityClass("MuiChip", slot);
}
var chipClasses = generateUtilityClasses("MuiChip", ["root", "sizeSmall", "sizeMedium", "colorDefault", "colorError", "colorInfo", "colorPrimary", "colorSecondary", "colorSuccess", "colorWarning", "disabled", "clickable", "clickableColorPrimary", "clickableColorSecondary", "deletable", "deletableColorPrimary", "deletableColorSecondary", "outlined", "filled", "outlinedPrimary", "outlinedSecondary", "filledPrimary", "filledSecondary", "avatar", "avatarSmall", "avatarMedium", "avatarColorPrimary", "avatarColorSecondary", "icon", "iconSmall", "iconMedium", "iconColorPrimary", "iconColorSecondary", "label", "labelSmall", "labelMedium", "deleteIcon", "deleteIconSmall", "deleteIconMedium", "deleteIconColorPrimary", "deleteIconColorSecondary", "deleteIconOutlinedColorPrimary", "deleteIconOutlinedColorSecondary", "deleteIconFilledColorPrimary", "deleteIconFilledColorSecondary", "focusVisible"]);
var chipClasses_default = chipClasses;

// node_modules/@mui/material/esm/Chip/Chip.js
var React4 = __toESM(require_react(), 1);
var import_prop_types3 = __toESM(require_prop_types(), 1);

// node_modules/@mui/material/esm/internal/svg-icons/Cancel.js
var React3 = __toESM(require_react(), 1);
var import_jsx_runtime3 = __toESM(require_jsx_runtime(), 1);
var Cancel_default = createSvgIcon((0, import_jsx_runtime3.jsx)("path", {
  d: "M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"
}), "Cancel");

// node_modules/@mui/material/esm/Chip/Chip.js
var import_jsx_runtime4 = __toESM(require_jsx_runtime(), 1);
var useUtilityClasses2 = (ownerState) => {
  const {
    classes,
    disabled,
    size,
    color,
    iconColor,
    onDelete,
    clickable,
    variant
  } = ownerState;
  const slots = {
    root: ["root", variant, disabled && "disabled", `size${capitalize_default(size)}`, `color${capitalize_default(color)}`, clickable && "clickable", clickable && `clickableColor${capitalize_default(color)}`, onDelete && "deletable", onDelete && `deletableColor${capitalize_default(color)}`, `${variant}${capitalize_default(color)}`],
    label: ["label", `label${capitalize_default(size)}`],
    avatar: ["avatar", `avatar${capitalize_default(size)}`, `avatarColor${capitalize_default(color)}`],
    icon: ["icon", `icon${capitalize_default(size)}`, `iconColor${capitalize_default(iconColor)}`],
    deleteIcon: ["deleteIcon", `deleteIcon${capitalize_default(size)}`, `deleteIconColor${capitalize_default(color)}`, `deleteIcon${capitalize_default(variant)}Color${capitalize_default(color)}`]
  };
  return composeClasses(slots, getChipUtilityClass, classes);
};
var ChipRoot = styled_default("div", {
  name: "MuiChip",
  slot: "Root",
  overridesResolver: (props, styles2) => {
    const {
      ownerState
    } = props;
    const {
      color,
      iconColor,
      clickable,
      onDelete,
      size,
      variant
    } = ownerState;
    return [{
      [`& .${chipClasses_default.avatar}`]: styles2.avatar
    }, {
      [`& .${chipClasses_default.avatar}`]: styles2[`avatar${capitalize_default(size)}`]
    }, {
      [`& .${chipClasses_default.avatar}`]: styles2[`avatarColor${capitalize_default(color)}`]
    }, {
      [`& .${chipClasses_default.icon}`]: styles2.icon
    }, {
      [`& .${chipClasses_default.icon}`]: styles2[`icon${capitalize_default(size)}`]
    }, {
      [`& .${chipClasses_default.icon}`]: styles2[`iconColor${capitalize_default(iconColor)}`]
    }, {
      [`& .${chipClasses_default.deleteIcon}`]: styles2.deleteIcon
    }, {
      [`& .${chipClasses_default.deleteIcon}`]: styles2[`deleteIcon${capitalize_default(size)}`]
    }, {
      [`& .${chipClasses_default.deleteIcon}`]: styles2[`deleteIconColor${capitalize_default(color)}`]
    }, {
      [`& .${chipClasses_default.deleteIcon}`]: styles2[`deleteIcon${capitalize_default(variant)}Color${capitalize_default(color)}`]
    }, styles2.root, styles2[`size${capitalize_default(size)}`], styles2[`color${capitalize_default(color)}`], clickable && styles2.clickable, clickable && color !== "default" && styles2[`clickableColor${capitalize_default(color)})`], onDelete && styles2.deletable, onDelete && color !== "default" && styles2[`deletableColor${capitalize_default(color)}`], styles2[variant], styles2[`${variant}${capitalize_default(color)}`]];
  }
})(memoTheme_default(({
  theme
}) => {
  const textColor = theme.palette.mode === "light" ? theme.palette.grey[700] : theme.palette.grey[300];
  return {
    maxWidth: "100%",
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.pxToRem(13),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    lineHeight: 1.5,
    color: (theme.vars || theme).palette.text.primary,
    backgroundColor: (theme.vars || theme).palette.action.selected,
    borderRadius: 32 / 2,
    whiteSpace: "nowrap",
    transition: theme.transitions.create(["background-color", "box-shadow"]),
    // reset cursor explicitly in case ButtonBase is used
    cursor: "unset",
    // We disable the focus ring for mouse, touch and keyboard users.
    outline: 0,
    textDecoration: "none",
    border: 0,
    // Remove `button` border
    padding: 0,
    // Remove `button` padding
    verticalAlign: "middle",
    boxSizing: "border-box",
    [`&.${chipClasses_default.disabled}`]: {
      opacity: (theme.vars || theme).palette.action.disabledOpacity,
      pointerEvents: "none"
    },
    [`& .${chipClasses_default.avatar}`]: {
      marginLeft: 5,
      marginRight: -6,
      width: 24,
      height: 24,
      color: theme.vars ? theme.vars.palette.Chip.defaultAvatarColor : textColor,
      fontSize: theme.typography.pxToRem(12)
    },
    [`& .${chipClasses_default.avatarColorPrimary}`]: {
      color: (theme.vars || theme).palette.primary.contrastText,
      backgroundColor: (theme.vars || theme).palette.primary.dark
    },
    [`& .${chipClasses_default.avatarColorSecondary}`]: {
      color: (theme.vars || theme).palette.secondary.contrastText,
      backgroundColor: (theme.vars || theme).palette.secondary.dark
    },
    [`& .${chipClasses_default.avatarSmall}`]: {
      marginLeft: 4,
      marginRight: -4,
      width: 18,
      height: 18,
      fontSize: theme.typography.pxToRem(10)
    },
    [`& .${chipClasses_default.icon}`]: {
      marginLeft: 5,
      marginRight: -6
    },
    [`& .${chipClasses_default.deleteIcon}`]: {
      WebkitTapHighlightColor: "transparent",
      color: theme.alpha((theme.vars || theme).palette.text.primary, 0.26),
      fontSize: 22,
      cursor: "pointer",
      margin: "0 5px 0 -6px",
      "&:hover": {
        color: theme.alpha((theme.vars || theme).palette.text.primary, 0.4)
      }
    },
    variants: [{
      props: {
        size: "small"
      },
      style: {
        height: 24,
        [`& .${chipClasses_default.icon}`]: {
          fontSize: 18,
          marginLeft: 4,
          marginRight: -4
        },
        [`& .${chipClasses_default.deleteIcon}`]: {
          fontSize: 16,
          marginRight: 4,
          marginLeft: -4
        }
      }
    }, ...Object.entries(theme.palette).filter(createSimplePaletteValueFilter(["contrastText"])).map(([color]) => {
      return {
        props: {
          color
        },
        style: {
          backgroundColor: (theme.vars || theme).palette[color].main,
          color: (theme.vars || theme).palette[color].contrastText,
          [`& .${chipClasses_default.deleteIcon}`]: {
            color: theme.alpha((theme.vars || theme).palette[color].contrastText, 0.7),
            "&:hover, &:active": {
              color: (theme.vars || theme).palette[color].contrastText
            }
          }
        }
      };
    }), {
      props: (props) => props.iconColor === props.color,
      style: {
        [`& .${chipClasses_default.icon}`]: {
          color: theme.vars ? theme.vars.palette.Chip.defaultIconColor : textColor
        }
      }
    }, {
      props: (props) => props.iconColor === props.color && props.color !== "default",
      style: {
        [`& .${chipClasses_default.icon}`]: {
          color: "inherit"
        }
      }
    }, {
      props: {
        onDelete: true
      },
      style: {
        [`&.${chipClasses_default.focusVisible}`]: {
          backgroundColor: theme.alpha((theme.vars || theme).palette.action.selected, `${(theme.vars || theme).palette.action.selectedOpacity} + ${(theme.vars || theme).palette.action.focusOpacity}`)
        }
      }
    }, ...Object.entries(theme.palette).filter(createSimplePaletteValueFilter(["dark"])).map(([color]) => {
      return {
        props: {
          color,
          onDelete: true
        },
        style: {
          [`&.${chipClasses_default.focusVisible}`]: {
            background: (theme.vars || theme).palette[color].dark
          }
        }
      };
    }), {
      props: {
        clickable: true
      },
      style: {
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        cursor: "pointer",
        "&:hover": {
          backgroundColor: theme.alpha((theme.vars || theme).palette.action.selected, `${(theme.vars || theme).palette.action.selectedOpacity} + ${(theme.vars || theme).palette.action.hoverOpacity}`)
        },
        [`&.${chipClasses_default.focusVisible}`]: {
          backgroundColor: theme.alpha((theme.vars || theme).palette.action.selected, `${(theme.vars || theme).palette.action.selectedOpacity} + ${(theme.vars || theme).palette.action.focusOpacity}`)
        },
        "&:active": {
          boxShadow: (theme.vars || theme).shadows[1]
        }
      }
    }, ...Object.entries(theme.palette).filter(createSimplePaletteValueFilter(["dark"])).map(([color]) => ({
      props: {
        color,
        clickable: true
      },
      style: {
        [`&:hover, &.${chipClasses_default.focusVisible}`]: {
          backgroundColor: (theme.vars || theme).palette[color].dark
        }
      }
    })), {
      props: {
        variant: "outlined"
      },
      style: {
        backgroundColor: "transparent",
        border: theme.vars ? `1px solid ${theme.vars.palette.Chip.defaultBorder}` : `1px solid ${theme.palette.mode === "light" ? theme.palette.grey[400] : theme.palette.grey[700]}`,
        [`&.${chipClasses_default.clickable}:hover`]: {
          backgroundColor: (theme.vars || theme).palette.action.hover
        },
        [`&.${chipClasses_default.focusVisible}`]: {
          backgroundColor: (theme.vars || theme).palette.action.focus
        },
        [`& .${chipClasses_default.avatar}`]: {
          marginLeft: 4
        },
        [`& .${chipClasses_default.avatarSmall}`]: {
          marginLeft: 2
        },
        [`& .${chipClasses_default.icon}`]: {
          marginLeft: 4
        },
        [`& .${chipClasses_default.iconSmall}`]: {
          marginLeft: 2
        },
        [`& .${chipClasses_default.deleteIcon}`]: {
          marginRight: 5
        },
        [`& .${chipClasses_default.deleteIconSmall}`]: {
          marginRight: 3
        }
      }
    }, ...Object.entries(theme.palette).filter(createSimplePaletteValueFilter()).map(([color]) => ({
      props: {
        variant: "outlined",
        color
      },
      style: {
        color: (theme.vars || theme).palette[color].main,
        border: `1px solid ${theme.alpha((theme.vars || theme).palette[color].main, 0.7)}`,
        [`&.${chipClasses_default.clickable}:hover`]: {
          backgroundColor: theme.alpha((theme.vars || theme).palette[color].main, (theme.vars || theme).palette.action.hoverOpacity)
        },
        [`&.${chipClasses_default.focusVisible}`]: {
          backgroundColor: theme.alpha((theme.vars || theme).palette[color].main, (theme.vars || theme).palette.action.focusOpacity)
        },
        [`& .${chipClasses_default.deleteIcon}`]: {
          color: theme.alpha((theme.vars || theme).palette[color].main, 0.7),
          "&:hover, &:active": {
            color: (theme.vars || theme).palette[color].main
          }
        }
      }
    }))]
  };
}));
var ChipLabel = styled_default("span", {
  name: "MuiChip",
  slot: "Label",
  overridesResolver: (props, styles2) => {
    const {
      ownerState
    } = props;
    const {
      size
    } = ownerState;
    return [styles2.label, styles2[`label${capitalize_default(size)}`]];
  }
})({
  overflow: "hidden",
  textOverflow: "ellipsis",
  paddingLeft: 12,
  paddingRight: 12,
  whiteSpace: "nowrap",
  variants: [{
    props: {
      variant: "outlined"
    },
    style: {
      paddingLeft: 11,
      paddingRight: 11
    }
  }, {
    props: {
      size: "small"
    },
    style: {
      paddingLeft: 8,
      paddingRight: 8
    }
  }, {
    props: {
      size: "small",
      variant: "outlined"
    },
    style: {
      paddingLeft: 7,
      paddingRight: 7
    }
  }]
});
function isDeleteKeyboardEvent(keyboardEvent) {
  return keyboardEvent.key === "Backspace" || keyboardEvent.key === "Delete";
}
var Chip = React4.forwardRef(function Chip2(inProps, ref) {
  const props = useDefaultProps({
    props: inProps,
    name: "MuiChip"
  });
  const {
    avatar: avatarProp,
    className,
    clickable: clickableProp,
    color = "default",
    component: ComponentProp,
    deleteIcon: deleteIconProp,
    disabled = false,
    icon: iconProp,
    label,
    onClick,
    onDelete,
    onKeyDown,
    onKeyUp,
    size = "medium",
    variant = "filled",
    tabIndex,
    skipFocusWhenDisabled = false,
    // TODO v6: Rename to `focusableWhenDisabled`.
    slots = {},
    slotProps = {},
    ...other
  } = props;
  const chipRef = React4.useRef(null);
  const handleRef = useForkRef_default(chipRef, ref);
  const handleDeleteIconClick = (event) => {
    event.stopPropagation();
    if (onDelete) {
      onDelete(event);
    }
  };
  const handleKeyDown = (event) => {
    if (event.currentTarget === event.target && isDeleteKeyboardEvent(event)) {
      event.preventDefault();
    }
    if (onKeyDown) {
      onKeyDown(event);
    }
  };
  const handleKeyUp = (event) => {
    if (event.currentTarget === event.target) {
      if (onDelete && isDeleteKeyboardEvent(event)) {
        onDelete(event);
      }
    }
    if (onKeyUp) {
      onKeyUp(event);
    }
  };
  const clickable = clickableProp !== false && onClick ? true : clickableProp;
  const component = clickable || onDelete ? ButtonBase_default : ComponentProp || "div";
  const ownerState = {
    ...props,
    component,
    disabled,
    size,
    color,
    iconColor: React4.isValidElement(iconProp) ? iconProp.props.color || color : color,
    onDelete: !!onDelete,
    clickable,
    variant
  };
  const classes = useUtilityClasses2(ownerState);
  const moreProps = component === ButtonBase_default ? {
    component: ComponentProp || "div",
    focusVisibleClassName: classes.focusVisible,
    ...onDelete && {
      disableRipple: true
    }
  } : {};
  let deleteIcon = null;
  if (onDelete) {
    deleteIcon = deleteIconProp && React4.isValidElement(deleteIconProp) ? React4.cloneElement(deleteIconProp, {
      className: clsx_default(deleteIconProp.props.className, classes.deleteIcon),
      onClick: handleDeleteIconClick
    }) : (0, import_jsx_runtime4.jsx)(Cancel_default, {
      className: classes.deleteIcon,
      onClick: handleDeleteIconClick
    });
  }
  let avatar = null;
  if (avatarProp && React4.isValidElement(avatarProp)) {
    avatar = React4.cloneElement(avatarProp, {
      className: clsx_default(classes.avatar, avatarProp.props.className)
    });
  }
  let icon = null;
  if (iconProp && React4.isValidElement(iconProp)) {
    icon = React4.cloneElement(iconProp, {
      className: clsx_default(classes.icon, iconProp.props.className)
    });
  }
  if (true) {
    if (avatar && icon) {
      console.error("MUI: The Chip component can not handle the avatar and the icon prop at the same time. Pick one.");
    }
  }
  const externalForwardedProps = {
    slots,
    slotProps
  };
  const [RootSlot, rootProps] = useSlot("root", {
    elementType: ChipRoot,
    externalForwardedProps: {
      ...externalForwardedProps,
      ...other
    },
    ownerState,
    // The `component` prop is preserved because `Chip` relies on it for internal logic. If `shouldForwardComponentProp` were `false`, `useSlot` would remove the `component` prop, potentially breaking the component's behavior.
    shouldForwardComponentProp: true,
    ref: handleRef,
    className: clsx_default(classes.root, className),
    additionalProps: {
      disabled: clickable && disabled ? true : void 0,
      tabIndex: skipFocusWhenDisabled && disabled ? -1 : tabIndex,
      ...moreProps
    },
    getSlotProps: (handlers) => ({
      ...handlers,
      onClick: (event) => {
        handlers.onClick?.(event);
        onClick?.(event);
      },
      onKeyDown: (event) => {
        handlers.onKeyDown?.(event);
        handleKeyDown(event);
      },
      onKeyUp: (event) => {
        handlers.onKeyUp?.(event);
        handleKeyUp(event);
      }
    })
  });
  const [LabelSlot, labelProps] = useSlot("label", {
    elementType: ChipLabel,
    externalForwardedProps,
    ownerState,
    className: classes.label
  });
  return (0, import_jsx_runtime4.jsxs)(RootSlot, {
    as: component,
    ...rootProps,
    children: [avatar || icon, (0, import_jsx_runtime4.jsx)(LabelSlot, {
      ...labelProps,
      children: label
    }), deleteIcon]
  });
});
true ? Chip.propTypes = {
  // ┌────────────────────────────── Warning ──────────────────────────────┐
  // │ These PropTypes are generated from the TypeScript type definitions. │
  // │    To update them, edit the d.ts file and run `pnpm proptypes`.     │
  // └─────────────────────────────────────────────────────────────────────┘
  /**
   * The Avatar element to display.
   */
  avatar: import_prop_types3.default.element,
  /**
   * This prop isn't supported.
   * Use the `component` prop if you need to change the children structure.
   */
  children: unsupportedProp_default,
  /**
   * Override or extend the styles applied to the component.
   */
  classes: import_prop_types3.default.object,
  /**
   * @ignore
   */
  className: import_prop_types3.default.string,
  /**
   * If `true`, the chip will appear clickable, and will raise when pressed,
   * even if the onClick prop is not defined.
   * If `false`, the chip will not appear clickable, even if onClick prop is defined.
   * This can be used, for example,
   * along with the component prop to indicate an anchor Chip is clickable.
   * Note: this controls the UI and does not affect the onClick event.
   */
  clickable: import_prop_types3.default.bool,
  /**
   * The color of the component.
   * It supports both default and custom theme colors, which can be added as shown in the
   * [palette customization guide](https://mui.com/material-ui/customization/palette/#custom-colors).
   * @default 'default'
   */
  color: import_prop_types3.default.oneOfType([import_prop_types3.default.oneOf(["default", "primary", "secondary", "error", "info", "success", "warning"]), import_prop_types3.default.string]),
  /**
   * The component used for the root node.
   * Either a string to use a HTML element or a component.
   */
  component: import_prop_types3.default.elementType,
  /**
   * Override the default delete icon element. Shown only if `onDelete` is set.
   */
  deleteIcon: import_prop_types3.default.element,
  /**
   * If `true`, the component is disabled.
   * @default false
   */
  disabled: import_prop_types3.default.bool,
  /**
   * Icon element.
   */
  icon: import_prop_types3.default.element,
  /**
   * The content of the component.
   */
  label: import_prop_types3.default.node,
  /**
   * @ignore
   */
  onClick: import_prop_types3.default.func,
  /**
   * Callback fired when the delete icon is clicked.
   * If set, the delete icon will be shown.
   */
  onDelete: import_prop_types3.default.func,
  /**
   * @ignore
   */
  onKeyDown: import_prop_types3.default.func,
  /**
   * @ignore
   */
  onKeyUp: import_prop_types3.default.func,
  /**
   * The size of the component.
   * @default 'medium'
   */
  size: import_prop_types3.default.oneOfType([import_prop_types3.default.oneOf(["medium", "small"]), import_prop_types3.default.string]),
  /**
   * If `true`, allows the disabled chip to escape focus.
   * If `false`, allows the disabled chip to receive focus.
   * @default false
   */
  skipFocusWhenDisabled: import_prop_types3.default.bool,
  /**
   * The props used for each slot inside.
   * @default {}
   */
  slotProps: import_prop_types3.default.shape({
    label: import_prop_types3.default.oneOfType([import_prop_types3.default.func, import_prop_types3.default.object]),
    root: import_prop_types3.default.oneOfType([import_prop_types3.default.func, import_prop_types3.default.object])
  }),
  /**
   * The components used for each slot inside.
   * @default {}
   */
  slots: import_prop_types3.default.shape({
    label: import_prop_types3.default.elementType,
    root: import_prop_types3.default.elementType
  }),
  /**
   * The system prop that allows defining system overrides as well as additional CSS styles.
   */
  sx: import_prop_types3.default.oneOfType([import_prop_types3.default.arrayOf(import_prop_types3.default.oneOfType([import_prop_types3.default.func, import_prop_types3.default.object, import_prop_types3.default.bool])), import_prop_types3.default.func, import_prop_types3.default.object]),
  /**
   * @ignore
   */
  tabIndex: import_prop_types3.default.number,
  /**
   * The variant to use.
   * @default 'filled'
   */
  variant: import_prop_types3.default.oneOfType([import_prop_types3.default.oneOf(["filled", "outlined"]), import_prop_types3.default.string])
} : void 0;
var Chip_default = Chip;

// node_modules/@mui/material/esm/InputAdornment/inputAdornmentClasses.js
function getInputAdornmentUtilityClass(slot) {
  return generateUtilityClass("MuiInputAdornment", slot);
}
var inputAdornmentClasses = generateUtilityClasses("MuiInputAdornment", ["root", "filled", "standard", "outlined", "positionStart", "positionEnd", "disablePointerEvents", "hiddenLabel", "sizeSmall"]);
var inputAdornmentClasses_default = inputAdornmentClasses;

// node_modules/@mui/material/esm/InputAdornment/InputAdornment.js
var React5 = __toESM(require_react(), 1);
var import_prop_types4 = __toESM(require_prop_types(), 1);
var import_jsx_runtime5 = __toESM(require_jsx_runtime(), 1);
var _span;
var overridesResolver = (props, styles2) => {
  const {
    ownerState
  } = props;
  return [styles2.root, styles2[`position${capitalize_default(ownerState.position)}`], ownerState.disablePointerEvents === true && styles2.disablePointerEvents, styles2[ownerState.variant]];
};
var useUtilityClasses3 = (ownerState) => {
  const {
    classes,
    disablePointerEvents,
    hiddenLabel,
    position,
    size,
    variant
  } = ownerState;
  const slots = {
    root: ["root", disablePointerEvents && "disablePointerEvents", position && `position${capitalize_default(position)}`, variant, hiddenLabel && "hiddenLabel", size && `size${capitalize_default(size)}`]
  };
  return composeClasses(slots, getInputAdornmentUtilityClass, classes);
};
var InputAdornmentRoot = styled_default("div", {
  name: "MuiInputAdornment",
  slot: "Root",
  overridesResolver
})(memoTheme_default(({
  theme
}) => ({
  display: "flex",
  maxHeight: "2em",
  alignItems: "center",
  whiteSpace: "nowrap",
  color: (theme.vars || theme).palette.action.active,
  variants: [{
    props: {
      variant: "filled"
    },
    style: {
      [`&.${inputAdornmentClasses_default.positionStart}&:not(.${inputAdornmentClasses_default.hiddenLabel})`]: {
        marginTop: 16
      }
    }
  }, {
    props: {
      position: "start"
    },
    style: {
      marginRight: 8
    }
  }, {
    props: {
      position: "end"
    },
    style: {
      marginLeft: 8
    }
  }, {
    props: {
      disablePointerEvents: true
    },
    style: {
      pointerEvents: "none"
    }
  }]
})));
var InputAdornment = React5.forwardRef(function InputAdornment2(inProps, ref) {
  const props = useDefaultProps({
    props: inProps,
    name: "MuiInputAdornment"
  });
  const {
    children,
    className,
    component = "div",
    disablePointerEvents = false,
    disableTypography = false,
    position,
    variant: variantProp,
    ...other
  } = props;
  const muiFormControl = useFormControl() || {};
  let variant = variantProp;
  if (variantProp && muiFormControl.variant) {
    if (true) {
      if (variantProp === muiFormControl.variant) {
        console.error("MUI: The `InputAdornment` variant infers the variant prop you do not have to provide one.");
      }
    }
  }
  if (muiFormControl && !variant) {
    variant = muiFormControl.variant;
  }
  const ownerState = {
    ...props,
    hiddenLabel: muiFormControl.hiddenLabel,
    size: muiFormControl.size,
    disablePointerEvents,
    position,
    variant
  };
  const classes = useUtilityClasses3(ownerState);
  return (0, import_jsx_runtime5.jsx)(FormControlContext_default.Provider, {
    value: null,
    children: (0, import_jsx_runtime5.jsx)(InputAdornmentRoot, {
      as: component,
      ownerState,
      className: clsx_default(classes.root, className),
      ref,
      ...other,
      children: typeof children === "string" && !disableTypography ? (0, import_jsx_runtime5.jsx)(Typography_default, {
        color: "textSecondary",
        children
      }) : (0, import_jsx_runtime5.jsxs)(React5.Fragment, {
        children: [position === "start" ? (
          /* notranslate needed while Google Translate will not fix zero-width space issue */
          _span || (_span = (0, import_jsx_runtime5.jsx)("span", {
            className: "notranslate",
            "aria-hidden": true,
            children: "​"
          }))
        ) : null, children]
      })
    })
  });
});
true ? InputAdornment.propTypes = {
  // ┌────────────────────────────── Warning ──────────────────────────────┐
  // │ These PropTypes are generated from the TypeScript type definitions. │
  // │    To update them, edit the d.ts file and run `pnpm proptypes`.     │
  // └─────────────────────────────────────────────────────────────────────┘
  /**
   * The content of the component, normally an `IconButton` or string.
   */
  children: import_prop_types4.default.node,
  /**
   * Override or extend the styles applied to the component.
   */
  classes: import_prop_types4.default.object,
  /**
   * @ignore
   */
  className: import_prop_types4.default.string,
  /**
   * The component used for the root node.
   * Either a string to use a HTML element or a component.
   */
  component: import_prop_types4.default.elementType,
  /**
   * Disable pointer events on the root.
   * This allows for the content of the adornment to focus the `input` on click.
   * @default false
   */
  disablePointerEvents: import_prop_types4.default.bool,
  /**
   * If children is a string then disable wrapping in a Typography component.
   * @default false
   */
  disableTypography: import_prop_types4.default.bool,
  /**
   * The position this adornment should appear relative to the `Input`.
   */
  position: import_prop_types4.default.oneOf(["end", "start"]).isRequired,
  /**
   * The system prop that allows defining system overrides as well as additional CSS styles.
   */
  sx: import_prop_types4.default.oneOfType([import_prop_types4.default.arrayOf(import_prop_types4.default.oneOfType([import_prop_types4.default.func, import_prop_types4.default.object, import_prop_types4.default.bool])), import_prop_types4.default.func, import_prop_types4.default.object]),
  /**
   * The variant to use.
   * Note: If you are using the `TextField` component or the `FormControl` component
   * you do not have to set this manually.
   */
  variant: import_prop_types4.default.oneOf(["filled", "outlined", "standard"])
} : void 0;
var InputAdornment_default = InputAdornment;

// node_modules/@mui/material/esm/Skeleton/skeletonClasses.js
function getSkeletonUtilityClass(slot) {
  return generateUtilityClass("MuiSkeleton", slot);
}
var skeletonClasses = generateUtilityClasses("MuiSkeleton", ["root", "text", "rectangular", "rounded", "circular", "pulse", "wave", "withChildren", "fitContent", "heightAuto"]);
var skeletonClasses_default = skeletonClasses;

// node_modules/@mui/material/esm/Skeleton/Skeleton.js
var React6 = __toESM(require_react(), 1);
var import_prop_types5 = __toESM(require_prop_types(), 1);
var import_jsx_runtime6 = __toESM(require_jsx_runtime(), 1);
var useUtilityClasses4 = (ownerState) => {
  const {
    classes,
    variant,
    animation,
    hasChildren,
    width,
    height
  } = ownerState;
  const slots = {
    root: ["root", variant, animation, hasChildren && "withChildren", hasChildren && !width && "fitContent", hasChildren && !height && "heightAuto"]
  };
  return composeClasses(slots, getSkeletonUtilityClass, classes);
};
var pulseKeyframe = keyframes`
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }

  100% {
    opacity: 1;
  }
`;
var waveKeyframe = keyframes`
  0% {
    transform: translateX(-100%);
  }

  50% {
    /* +0.5s of delay between each loop */
    transform: translateX(100%);
  }

  100% {
    transform: translateX(100%);
  }
`;
var pulseAnimation = typeof pulseKeyframe !== "string" ? css`
        animation: ${pulseKeyframe} 2s ease-in-out 0.5s infinite;
      ` : null;
var waveAnimation = typeof waveKeyframe !== "string" ? css`
        &::after {
          animation: ${waveKeyframe} 2s linear 0.5s infinite;
        }
      ` : null;
var SkeletonRoot = styled_default("span", {
  name: "MuiSkeleton",
  slot: "Root",
  overridesResolver: (props, styles2) => {
    const {
      ownerState
    } = props;
    return [styles2.root, styles2[ownerState.variant], ownerState.animation !== false && styles2[ownerState.animation], ownerState.hasChildren && styles2.withChildren, ownerState.hasChildren && !ownerState.width && styles2.fitContent, ownerState.hasChildren && !ownerState.height && styles2.heightAuto];
  }
})(memoTheme_default(({
  theme
}) => {
  const radiusUnit = getUnit(theme.shape.borderRadius) || "px";
  const radiusValue = toUnitless(theme.shape.borderRadius);
  return {
    display: "block",
    // Create a "on paper" color with sufficient contrast retaining the color
    backgroundColor: theme.vars ? theme.vars.palette.Skeleton.bg : theme.alpha(theme.palette.text.primary, theme.palette.mode === "light" ? 0.11 : 0.13),
    height: "1.2em",
    variants: [{
      props: {
        variant: "text"
      },
      style: {
        marginTop: 0,
        marginBottom: 0,
        height: "auto",
        transformOrigin: "0 55%",
        transform: "scale(1, 0.60)",
        borderRadius: `${radiusValue}${radiusUnit}/${Math.round(radiusValue / 0.6 * 10) / 10}${radiusUnit}`,
        "&:empty:before": {
          content: '"\\00a0"'
        }
      }
    }, {
      props: {
        variant: "circular"
      },
      style: {
        borderRadius: "50%"
      }
    }, {
      props: {
        variant: "rounded"
      },
      style: {
        borderRadius: (theme.vars || theme).shape.borderRadius
      }
    }, {
      props: ({
        ownerState
      }) => ownerState.hasChildren,
      style: {
        "& > *": {
          visibility: "hidden"
        }
      }
    }, {
      props: ({
        ownerState
      }) => ownerState.hasChildren && !ownerState.width,
      style: {
        maxWidth: "fit-content"
      }
    }, {
      props: ({
        ownerState
      }) => ownerState.hasChildren && !ownerState.height,
      style: {
        height: "auto"
      }
    }, {
      props: {
        animation: "pulse"
      },
      style: pulseAnimation || {
        animation: `${pulseKeyframe} 2s ease-in-out 0.5s infinite`
      }
    }, {
      props: {
        animation: "wave"
      },
      style: {
        position: "relative",
        overflow: "hidden",
        /* Fix bug in Safari https://bugs.webkit.org/show_bug.cgi?id=68196 */
        WebkitMaskImage: "-webkit-radial-gradient(white, black)",
        "&::after": {
          background: `linear-gradient(
                90deg,
                transparent,
                ${(theme.vars || theme).palette.action.hover},
                transparent
              )`,
          content: '""',
          position: "absolute",
          transform: "translateX(-100%)",
          bottom: 0,
          left: 0,
          right: 0,
          top: 0
        }
      }
    }, {
      props: {
        animation: "wave"
      },
      style: waveAnimation || {
        "&::after": {
          animation: `${waveKeyframe} 2s linear 0.5s infinite`
        }
      }
    }]
  };
}));
var Skeleton = React6.forwardRef(function Skeleton2(inProps, ref) {
  const props = useDefaultProps({
    props: inProps,
    name: "MuiSkeleton"
  });
  const {
    animation = "pulse",
    className,
    component = "span",
    height,
    style,
    variant = "text",
    width,
    ...other
  } = props;
  const ownerState = {
    ...props,
    animation,
    component,
    variant,
    hasChildren: Boolean(other.children)
  };
  const classes = useUtilityClasses4(ownerState);
  return (0, import_jsx_runtime6.jsx)(SkeletonRoot, {
    as: component,
    ref,
    className: clsx_default(classes.root, className),
    ownerState,
    ...other,
    style: {
      width,
      height,
      ...style
    }
  });
});
true ? Skeleton.propTypes = {
  // ┌────────────────────────────── Warning ──────────────────────────────┐
  // │ These PropTypes are generated from the TypeScript type definitions. │
  // │    To update them, edit the d.ts file and run `pnpm proptypes`.     │
  // └─────────────────────────────────────────────────────────────────────┘
  /**
   * The animation.
   * If `false` the animation effect is disabled.
   * @default 'pulse'
   */
  animation: import_prop_types5.default.oneOf(["pulse", "wave", false]),
  /**
   * Optional children to infer width and height from.
   */
  children: import_prop_types5.default.node,
  /**
   * Override or extend the styles applied to the component.
   */
  classes: import_prop_types5.default.object,
  /**
   * @ignore
   */
  className: import_prop_types5.default.string,
  /**
   * The component used for the root node.
   * Either a string to use a HTML element or a component.
   */
  component: import_prop_types5.default.elementType,
  /**
   * Height of the skeleton.
   * Useful when you don't want to adapt the skeleton to a text element but for instance a card.
   */
  height: import_prop_types5.default.oneOfType([import_prop_types5.default.number, import_prop_types5.default.string]),
  /**
   * @ignore
   */
  style: import_prop_types5.default.object,
  /**
   * The system prop that allows defining system overrides as well as additional CSS styles.
   */
  sx: import_prop_types5.default.oneOfType([import_prop_types5.default.arrayOf(import_prop_types5.default.oneOfType([import_prop_types5.default.func, import_prop_types5.default.object, import_prop_types5.default.bool])), import_prop_types5.default.func, import_prop_types5.default.object]),
  /**
   * The type of content that will be rendered.
   * @default 'text'
   */
  variant: import_prop_types5.default.oneOfType([import_prop_types5.default.oneOf(["circular", "rectangular", "rounded", "text"]), import_prop_types5.default.string]),
  /**
   * Width of the skeleton.
   * Useful when the skeleton is inside an inline element with no width of its own.
   */
  width: import_prop_types5.default.oneOfType([import_prop_types5.default.number, import_prop_types5.default.string])
} : void 0;
var Skeleton_default = Skeleton;

// node_modules/@mui/material/esm/Tab/tabClasses.js
function getTabUtilityClass(slot) {
  return generateUtilityClass("MuiTab", slot);
}
var tabClasses = generateUtilityClasses("MuiTab", ["root", "labelIcon", "textColorInherit", "textColorPrimary", "textColorSecondary", "selected", "disabled", "fullWidth", "wrapped", "iconWrapper", "icon"]);
var tabClasses_default = tabClasses;

// node_modules/@mui/material/esm/Tab/Tab.js
var React7 = __toESM(require_react(), 1);
var import_prop_types6 = __toESM(require_prop_types(), 1);
var import_jsx_runtime7 = __toESM(require_jsx_runtime(), 1);
var useUtilityClasses5 = (ownerState) => {
  const {
    classes,
    textColor,
    fullWidth,
    wrapped,
    icon,
    label,
    selected,
    disabled
  } = ownerState;
  const slots = {
    root: ["root", icon && label && "labelIcon", `textColor${capitalize_default(textColor)}`, fullWidth && "fullWidth", wrapped && "wrapped", selected && "selected", disabled && "disabled"],
    icon: ["iconWrapper", "icon"]
  };
  return composeClasses(slots, getTabUtilityClass, classes);
};
var TabRoot = styled_default(ButtonBase_default, {
  name: "MuiTab",
  slot: "Root",
  overridesResolver: (props, styles2) => {
    const {
      ownerState
    } = props;
    return [styles2.root, ownerState.label && ownerState.icon && styles2.labelIcon, styles2[`textColor${capitalize_default(ownerState.textColor)}`], ownerState.fullWidth && styles2.fullWidth, ownerState.wrapped && styles2.wrapped, {
      [`& .${tabClasses_default.iconWrapper}`]: styles2.iconWrapper
    }, {
      [`& .${tabClasses_default.icon}`]: styles2.icon
    }];
  }
})(memoTheme_default(({
  theme
}) => ({
  ...theme.typography.button,
  maxWidth: 360,
  minWidth: 90,
  position: "relative",
  minHeight: 48,
  flexShrink: 0,
  padding: "12px 16px",
  overflow: "hidden",
  whiteSpace: "normal",
  textAlign: "center",
  lineHeight: 1.25,
  variants: [{
    props: ({
      ownerState
    }) => ownerState.label && (ownerState.iconPosition === "top" || ownerState.iconPosition === "bottom"),
    style: {
      flexDirection: "column"
    }
  }, {
    props: ({
      ownerState
    }) => ownerState.label && ownerState.iconPosition !== "top" && ownerState.iconPosition !== "bottom",
    style: {
      flexDirection: "row"
    }
  }, {
    props: ({
      ownerState
    }) => ownerState.icon && ownerState.label,
    style: {
      minHeight: 72,
      paddingTop: 9,
      paddingBottom: 9
    }
  }, {
    props: ({
      ownerState,
      iconPosition
    }) => ownerState.icon && ownerState.label && iconPosition === "top",
    style: {
      [`& > .${tabClasses_default.icon}`]: {
        marginBottom: 6
      }
    }
  }, {
    props: ({
      ownerState,
      iconPosition
    }) => ownerState.icon && ownerState.label && iconPosition === "bottom",
    style: {
      [`& > .${tabClasses_default.icon}`]: {
        marginTop: 6
      }
    }
  }, {
    props: ({
      ownerState,
      iconPosition
    }) => ownerState.icon && ownerState.label && iconPosition === "start",
    style: {
      [`& > .${tabClasses_default.icon}`]: {
        marginRight: theme.spacing(1)
      }
    }
  }, {
    props: ({
      ownerState,
      iconPosition
    }) => ownerState.icon && ownerState.label && iconPosition === "end",
    style: {
      [`& > .${tabClasses_default.icon}`]: {
        marginLeft: theme.spacing(1)
      }
    }
  }, {
    props: {
      textColor: "inherit"
    },
    style: {
      color: "inherit",
      opacity: 0.6,
      // same opacity as theme.palette.text.secondary
      [`&.${tabClasses_default.selected}`]: {
        opacity: 1
      },
      [`&.${tabClasses_default.disabled}`]: {
        opacity: (theme.vars || theme).palette.action.disabledOpacity
      }
    }
  }, {
    props: {
      textColor: "primary"
    },
    style: {
      color: (theme.vars || theme).palette.text.secondary,
      [`&.${tabClasses_default.selected}`]: {
        color: (theme.vars || theme).palette.primary.main
      },
      [`&.${tabClasses_default.disabled}`]: {
        color: (theme.vars || theme).palette.text.disabled
      }
    }
  }, {
    props: {
      textColor: "secondary"
    },
    style: {
      color: (theme.vars || theme).palette.text.secondary,
      [`&.${tabClasses_default.selected}`]: {
        color: (theme.vars || theme).palette.secondary.main
      },
      [`&.${tabClasses_default.disabled}`]: {
        color: (theme.vars || theme).palette.text.disabled
      }
    }
  }, {
    props: ({
      ownerState
    }) => ownerState.fullWidth,
    style: {
      flexShrink: 1,
      flexGrow: 1,
      flexBasis: 0,
      maxWidth: "none"
    }
  }, {
    props: ({
      ownerState
    }) => ownerState.wrapped,
    style: {
      fontSize: theme.typography.pxToRem(12)
    }
  }]
})));
var Tab = React7.forwardRef(function Tab2(inProps, ref) {
  const props = useDefaultProps({
    props: inProps,
    name: "MuiTab"
  });
  const {
    className,
    disabled = false,
    disableFocusRipple = false,
    // eslint-disable-next-line react/prop-types
    fullWidth,
    icon: iconProp,
    iconPosition = "top",
    // eslint-disable-next-line react/prop-types
    indicator,
    label,
    onChange,
    onClick,
    onFocus,
    // eslint-disable-next-line react/prop-types
    selected,
    // eslint-disable-next-line react/prop-types
    selectionFollowsFocus,
    // eslint-disable-next-line react/prop-types
    textColor = "inherit",
    value,
    wrapped = false,
    ...other
  } = props;
  const ownerState = {
    ...props,
    disabled,
    disableFocusRipple,
    selected,
    icon: !!iconProp,
    iconPosition,
    label: !!label,
    fullWidth,
    textColor,
    wrapped
  };
  const classes = useUtilityClasses5(ownerState);
  const icon = iconProp && label && React7.isValidElement(iconProp) ? React7.cloneElement(iconProp, {
    className: clsx_default(classes.icon, iconProp.props.className)
  }) : iconProp;
  const handleClick = (event) => {
    if (!selected && onChange) {
      onChange(event, value);
    }
    if (onClick) {
      onClick(event);
    }
  };
  const handleFocus = (event) => {
    if (selectionFollowsFocus && !selected && onChange) {
      onChange(event, value);
    }
    if (onFocus) {
      onFocus(event);
    }
  };
  return (0, import_jsx_runtime7.jsxs)(TabRoot, {
    focusRipple: !disableFocusRipple,
    className: clsx_default(classes.root, className),
    ref,
    role: "tab",
    "aria-selected": selected,
    disabled,
    onClick: handleClick,
    onFocus: handleFocus,
    ownerState,
    tabIndex: selected ? 0 : -1,
    ...other,
    children: [iconPosition === "top" || iconPosition === "start" ? (0, import_jsx_runtime7.jsxs)(React7.Fragment, {
      children: [icon, label]
    }) : (0, import_jsx_runtime7.jsxs)(React7.Fragment, {
      children: [label, icon]
    }), indicator]
  });
});
true ? Tab.propTypes = {
  // ┌────────────────────────────── Warning ──────────────────────────────┐
  // │ These PropTypes are generated from the TypeScript type definitions. │
  // │    To update them, edit the d.ts file and run `pnpm proptypes`.     │
  // └─────────────────────────────────────────────────────────────────────┘
  /**
   * This prop isn't supported.
   * Use the `component` prop if you need to change the children structure.
   */
  children: unsupportedProp_default,
  /**
   * Override or extend the styles applied to the component.
   */
  classes: import_prop_types6.default.object,
  /**
   * @ignore
   */
  className: import_prop_types6.default.string,
  /**
   * If `true`, the component is disabled.
   * @default false
   */
  disabled: import_prop_types6.default.bool,
  /**
   * If `true`, the  keyboard focus ripple is disabled.
   * @default false
   */
  disableFocusRipple: import_prop_types6.default.bool,
  /**
   * If `true`, the ripple effect is disabled.
   *
   * ⚠️ Without a ripple there is no styling for :focus-visible by default. Be sure
   * to highlight the element by applying separate styles with the `.Mui-focusVisible` class.
   * @default false
   */
  disableRipple: import_prop_types6.default.bool,
  /**
   * The icon to display.
   */
  icon: import_prop_types6.default.oneOfType([import_prop_types6.default.element, import_prop_types6.default.string]),
  /**
   * The position of the icon relative to the label.
   * @default 'top'
   */
  iconPosition: import_prop_types6.default.oneOf(["bottom", "end", "start", "top"]),
  /**
   * The label element.
   */
  label: import_prop_types6.default.node,
  /**
   * @ignore
   */
  onChange: import_prop_types6.default.func,
  /**
   * @ignore
   */
  onClick: import_prop_types6.default.func,
  /**
   * @ignore
   */
  onFocus: import_prop_types6.default.func,
  /**
   * The system prop that allows defining system overrides as well as additional CSS styles.
   */
  sx: import_prop_types6.default.oneOfType([import_prop_types6.default.arrayOf(import_prop_types6.default.oneOfType([import_prop_types6.default.func, import_prop_types6.default.object, import_prop_types6.default.bool])), import_prop_types6.default.func, import_prop_types6.default.object]),
  /**
   * You can provide your own value. Otherwise, we fallback to the child position index.
   */
  value: import_prop_types6.default.any,
  /**
   * Tab labels appear in a single row.
   * They can use a second line if needed.
   * @default false
   */
  wrapped: import_prop_types6.default.bool
} : void 0;
var Tab_default = Tab;

// node_modules/@mui/material/esm/TabScrollButton/tabScrollButtonClasses.js
function getTabScrollButtonUtilityClass(slot) {
  return generateUtilityClass("MuiTabScrollButton", slot);
}
var tabScrollButtonClasses = generateUtilityClasses("MuiTabScrollButton", ["root", "vertical", "horizontal", "disabled"]);
var tabScrollButtonClasses_default = tabScrollButtonClasses;

// node_modules/@mui/material/esm/TabScrollButton/TabScrollButton.js
var React10 = __toESM(require_react(), 1);
var import_prop_types7 = __toESM(require_prop_types(), 1);

// node_modules/@mui/material/esm/internal/svg-icons/KeyboardArrowLeft.js
var React8 = __toESM(require_react(), 1);
var import_jsx_runtime8 = __toESM(require_jsx_runtime(), 1);
var KeyboardArrowLeft_default = createSvgIcon((0, import_jsx_runtime8.jsx)("path", {
  d: "M15.41 16.09l-4.58-4.59 4.58-4.59L14 5.5l-6 6 6 6z"
}), "KeyboardArrowLeft");

// node_modules/@mui/material/esm/internal/svg-icons/KeyboardArrowRight.js
var React9 = __toESM(require_react(), 1);
var import_jsx_runtime9 = __toESM(require_jsx_runtime(), 1);
var KeyboardArrowRight_default = createSvgIcon((0, import_jsx_runtime9.jsx)("path", {
  d: "M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6z"
}), "KeyboardArrowRight");

// node_modules/@mui/material/esm/TabScrollButton/TabScrollButton.js
var import_jsx_runtime10 = __toESM(require_jsx_runtime(), 1);
var useUtilityClasses6 = (ownerState) => {
  const {
    classes,
    orientation,
    disabled
  } = ownerState;
  const slots = {
    root: ["root", orientation, disabled && "disabled"]
  };
  return composeClasses(slots, getTabScrollButtonUtilityClass, classes);
};
var TabScrollButtonRoot = styled_default(ButtonBase_default, {
  name: "MuiTabScrollButton",
  slot: "Root",
  overridesResolver: (props, styles2) => {
    const {
      ownerState
    } = props;
    return [styles2.root, ownerState.orientation && styles2[ownerState.orientation]];
  }
})({
  width: 40,
  flexShrink: 0,
  opacity: 0.8,
  [`&.${tabScrollButtonClasses_default.disabled}`]: {
    opacity: 0
  },
  variants: [{
    props: {
      orientation: "vertical"
    },
    style: {
      width: "100%",
      height: 40,
      "& svg": {
        transform: "var(--TabScrollButton-svgRotate)"
      }
    }
  }]
});
var TabScrollButton = React10.forwardRef(function TabScrollButton2(inProps, ref) {
  const props = useDefaultProps({
    props: inProps,
    name: "MuiTabScrollButton"
  });
  const {
    className,
    slots = {},
    slotProps = {},
    direction,
    orientation,
    disabled,
    ...other
  } = props;
  const isRtl = useRtl();
  const ownerState = {
    isRtl,
    ...props
  };
  const classes = useUtilityClasses6(ownerState);
  const StartButtonIcon = slots.StartScrollButtonIcon ?? KeyboardArrowLeft_default;
  const EndButtonIcon = slots.EndScrollButtonIcon ?? KeyboardArrowRight_default;
  const startButtonIconProps = useSlotProps_default({
    elementType: StartButtonIcon,
    externalSlotProps: slotProps.startScrollButtonIcon,
    additionalProps: {
      fontSize: "small"
    },
    ownerState
  });
  const endButtonIconProps = useSlotProps_default({
    elementType: EndButtonIcon,
    externalSlotProps: slotProps.endScrollButtonIcon,
    additionalProps: {
      fontSize: "small"
    },
    ownerState
  });
  return (0, import_jsx_runtime10.jsx)(TabScrollButtonRoot, {
    component: "div",
    className: clsx_default(classes.root, className),
    ref,
    role: null,
    ownerState,
    tabIndex: null,
    ...other,
    style: {
      ...other.style,
      ...orientation === "vertical" && {
        "--TabScrollButton-svgRotate": `rotate(${isRtl ? -90 : 90}deg)`
      }
    },
    children: direction === "left" ? (0, import_jsx_runtime10.jsx)(StartButtonIcon, {
      ...startButtonIconProps
    }) : (0, import_jsx_runtime10.jsx)(EndButtonIcon, {
      ...endButtonIconProps
    })
  });
});
true ? TabScrollButton.propTypes = {
  // ┌────────────────────────────── Warning ──────────────────────────────┐
  // │ These PropTypes are generated from the TypeScript type definitions. │
  // │    To update them, edit the d.ts file and run `pnpm proptypes`.     │
  // └─────────────────────────────────────────────────────────────────────┘
  /**
   * The content of the component.
   */
  children: import_prop_types7.default.node,
  /**
   * Override or extend the styles applied to the component.
   */
  classes: import_prop_types7.default.object,
  /**
   * @ignore
   */
  className: import_prop_types7.default.string,
  /**
   * The direction the button should indicate.
   */
  direction: import_prop_types7.default.oneOf(["left", "right"]).isRequired,
  /**
   * If `true`, the component is disabled.
   * @default false
   */
  disabled: import_prop_types7.default.bool,
  /**
   * The component orientation (layout flow direction).
   */
  orientation: import_prop_types7.default.oneOf(["horizontal", "vertical"]).isRequired,
  /**
   * The extra props for the slot components.
   * You can override the existing props or add new ones.
   * @default {}
   */
  slotProps: import_prop_types7.default.shape({
    endScrollButtonIcon: import_prop_types7.default.oneOfType([import_prop_types7.default.func, import_prop_types7.default.object]),
    startScrollButtonIcon: import_prop_types7.default.oneOfType([import_prop_types7.default.func, import_prop_types7.default.object])
  }),
  /**
   * The components used for each slot inside.
   * @default {}
   */
  slots: import_prop_types7.default.shape({
    EndScrollButtonIcon: import_prop_types7.default.elementType,
    StartScrollButtonIcon: import_prop_types7.default.elementType
  }),
  /**
   * @ignore
   */
  style: import_prop_types7.default.object,
  /**
   * The system prop that allows defining system overrides as well as additional CSS styles.
   */
  sx: import_prop_types7.default.oneOfType([import_prop_types7.default.arrayOf(import_prop_types7.default.oneOfType([import_prop_types7.default.func, import_prop_types7.default.object, import_prop_types7.default.bool])), import_prop_types7.default.func, import_prop_types7.default.object])
} : void 0;
var TabScrollButton_default = TabScrollButton;

// node_modules/@mui/material/esm/Tabs/tabsClasses.js
function getTabsUtilityClass(slot) {
  return generateUtilityClass("MuiTabs", slot);
}
var tabsClasses = generateUtilityClasses("MuiTabs", ["root", "vertical", "list", "flexContainer", "flexContainerVertical", "centered", "scroller", "fixed", "scrollableX", "scrollableY", "hideScrollbar", "scrollButtons", "scrollButtonsHideMobile", "indicator"]);
var tabsClasses_default = tabsClasses;

// node_modules/@mui/material/esm/Tabs/Tabs.js
var React12 = __toESM(require_react(), 1);
var import_react_is = __toESM(require_react_is(), 1);
var import_prop_types9 = __toESM(require_prop_types(), 1);

// node_modules/@mui/material/esm/internal/animate.js
function easeInOutSin(time) {
  return (1 + Math.sin(Math.PI * time - Math.PI / 2)) / 2;
}
function animate(property, element, to, options = {}, cb = () => {
}) {
  const {
    ease = easeInOutSin,
    duration = 300
    // standard
  } = options;
  let start2 = null;
  const from = element[property];
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  const step = (timestamp) => {
    if (cancelled) {
      cb(new Error("Animation cancelled"));
      return;
    }
    if (start2 === null) {
      start2 = timestamp;
    }
    const time = Math.min(1, (timestamp - start2) / duration);
    element[property] = ease(time) * (to - from) + from;
    if (time >= 1) {
      requestAnimationFrame(() => {
        cb(null);
      });
      return;
    }
    requestAnimationFrame(step);
  };
  if (from === to) {
    cb(new Error("Element already at target position"));
    return cancel;
  }
  requestAnimationFrame(step);
  return cancel;
}

// node_modules/@mui/material/esm/Tabs/ScrollbarSize.js
var React11 = __toESM(require_react(), 1);
var import_prop_types8 = __toESM(require_prop_types(), 1);
var import_jsx_runtime11 = __toESM(require_jsx_runtime(), 1);
var styles = {
  width: 99,
  height: 99,
  position: "absolute",
  top: -9999,
  overflow: "scroll"
};
function ScrollbarSize(props) {
  const {
    onChange,
    ...other
  } = props;
  const scrollbarHeight = React11.useRef();
  const nodeRef = React11.useRef(null);
  const setMeasurements = () => {
    scrollbarHeight.current = nodeRef.current.offsetHeight - nodeRef.current.clientHeight;
  };
  useEnhancedEffect_default2(() => {
    const handleResize = debounce_default(() => {
      const prevHeight = scrollbarHeight.current;
      setMeasurements();
      if (prevHeight !== scrollbarHeight.current) {
        onChange(scrollbarHeight.current);
      }
    });
    const containerWindow = ownerWindow_default(nodeRef.current);
    containerWindow.addEventListener("resize", handleResize);
    return () => {
      handleResize.clear();
      containerWindow.removeEventListener("resize", handleResize);
    };
  }, [onChange]);
  React11.useEffect(() => {
    setMeasurements();
    onChange(scrollbarHeight.current);
  }, [onChange]);
  return (0, import_jsx_runtime11.jsx)("div", {
    style: styles,
    ...other,
    ref: nodeRef
  });
}
true ? ScrollbarSize.propTypes = {
  onChange: import_prop_types8.default.func.isRequired
} : void 0;

// node_modules/@mui/material/esm/Tabs/Tabs.js
var import_jsx_runtime12 = __toESM(require_jsx_runtime(), 1);
var nextItem = (list, item) => {
  if (list === item) {
    return list.firstChild;
  }
  if (item && item.nextElementSibling) {
    return item.nextElementSibling;
  }
  return list.firstChild;
};
var previousItem = (list, item) => {
  if (list === item) {
    return list.lastChild;
  }
  if (item && item.previousElementSibling) {
    return item.previousElementSibling;
  }
  return list.lastChild;
};
var moveFocus = (list, currentFocus, traversalFunction) => {
  let wrappedOnce = false;
  let nextFocus = traversalFunction(list, currentFocus);
  while (nextFocus) {
    if (nextFocus === list.firstChild) {
      if (wrappedOnce) {
        return;
      }
      wrappedOnce = true;
    }
    const nextFocusDisabled = nextFocus.disabled || nextFocus.getAttribute("aria-disabled") === "true";
    if (!nextFocus.hasAttribute("tabindex") || nextFocusDisabled) {
      nextFocus = traversalFunction(list, nextFocus);
    } else {
      nextFocus.focus();
      return;
    }
  }
};
var useUtilityClasses7 = (ownerState) => {
  const {
    vertical,
    fixed,
    hideScrollbar,
    scrollableX,
    scrollableY,
    centered,
    scrollButtonsHideMobile,
    classes
  } = ownerState;
  const slots = {
    root: ["root", vertical && "vertical"],
    scroller: ["scroller", fixed && "fixed", hideScrollbar && "hideScrollbar", scrollableX && "scrollableX", scrollableY && "scrollableY"],
    list: ["list", "flexContainer", vertical && "flexContainerVertical", vertical && "vertical", centered && "centered"],
    indicator: ["indicator"],
    scrollButtons: ["scrollButtons", scrollButtonsHideMobile && "scrollButtonsHideMobile"],
    scrollableX: [scrollableX && "scrollableX"],
    hideScrollbar: [hideScrollbar && "hideScrollbar"]
  };
  return composeClasses(slots, getTabsUtilityClass, classes);
};
var TabsRoot = styled_default("div", {
  name: "MuiTabs",
  slot: "Root",
  overridesResolver: (props, styles2) => {
    const {
      ownerState
    } = props;
    return [{
      [`& .${tabsClasses_default.scrollButtons}`]: styles2.scrollButtons
    }, {
      [`& .${tabsClasses_default.scrollButtons}`]: ownerState.scrollButtonsHideMobile && styles2.scrollButtonsHideMobile
    }, styles2.root, ownerState.vertical && styles2.vertical];
  }
})(memoTheme_default(({
  theme
}) => ({
  overflow: "hidden",
  minHeight: 48,
  // Add iOS momentum scrolling for iOS < 13.0
  WebkitOverflowScrolling: "touch",
  display: "flex",
  variants: [{
    props: ({
      ownerState
    }) => ownerState.vertical,
    style: {
      flexDirection: "column"
    }
  }, {
    props: ({
      ownerState
    }) => ownerState.scrollButtonsHideMobile,
    style: {
      [`& .${tabsClasses_default.scrollButtons}`]: {
        [theme.breakpoints.down("sm")]: {
          display: "none"
        }
      }
    }
  }]
})));
var TabsScroller = styled_default("div", {
  name: "MuiTabs",
  slot: "Scroller",
  overridesResolver: (props, styles2) => {
    const {
      ownerState
    } = props;
    return [styles2.scroller, ownerState.fixed && styles2.fixed, ownerState.hideScrollbar && styles2.hideScrollbar, ownerState.scrollableX && styles2.scrollableX, ownerState.scrollableY && styles2.scrollableY];
  }
})({
  position: "relative",
  display: "inline-block",
  flex: "1 1 auto",
  whiteSpace: "nowrap",
  variants: [{
    props: ({
      ownerState
    }) => ownerState.fixed,
    style: {
      overflowX: "hidden",
      width: "100%"
    }
  }, {
    props: ({
      ownerState
    }) => ownerState.hideScrollbar,
    style: {
      // Hide dimensionless scrollbar on macOS
      scrollbarWidth: "none",
      // Firefox
      "&::-webkit-scrollbar": {
        display: "none"
        // Safari + Chrome
      }
    }
  }, {
    props: ({
      ownerState
    }) => ownerState.scrollableX,
    style: {
      overflowX: "auto",
      overflowY: "hidden"
    }
  }, {
    props: ({
      ownerState
    }) => ownerState.scrollableY,
    style: {
      overflowY: "auto",
      overflowX: "hidden"
    }
  }]
});
var List = styled_default("div", {
  name: "MuiTabs",
  slot: "List",
  overridesResolver: (props, styles2) => {
    const {
      ownerState
    } = props;
    return [styles2.list, styles2.flexContainer, ownerState.vertical && styles2.flexContainerVertical, ownerState.centered && styles2.centered];
  }
})({
  display: "flex",
  variants: [{
    props: ({
      ownerState
    }) => ownerState.vertical,
    style: {
      flexDirection: "column"
    }
  }, {
    props: ({
      ownerState
    }) => ownerState.centered,
    style: {
      justifyContent: "center"
    }
  }]
});
var TabsIndicator = styled_default("span", {
  name: "MuiTabs",
  slot: "Indicator"
})(memoTheme_default(({
  theme
}) => ({
  position: "absolute",
  height: 2,
  bottom: 0,
  width: "100%",
  transition: theme.transitions.create(),
  variants: [{
    props: {
      indicatorColor: "primary"
    },
    style: {
      backgroundColor: (theme.vars || theme).palette.primary.main
    }
  }, {
    props: {
      indicatorColor: "secondary"
    },
    style: {
      backgroundColor: (theme.vars || theme).palette.secondary.main
    }
  }, {
    props: ({
      ownerState
    }) => ownerState.vertical,
    style: {
      height: "100%",
      width: 2,
      right: 0
    }
  }]
})));
var TabsScrollbarSize = styled_default(ScrollbarSize)({
  overflowX: "auto",
  overflowY: "hidden",
  // Hide dimensionless scrollbar on macOS
  scrollbarWidth: "none",
  // Firefox
  "&::-webkit-scrollbar": {
    display: "none"
    // Safari + Chrome
  }
});
var defaultIndicatorStyle = {};
var warnedOnceTabPresent = false;
var Tabs = React12.forwardRef(function Tabs2(inProps, ref) {
  const props = useDefaultProps({
    props: inProps,
    name: "MuiTabs"
  });
  const theme = useTheme();
  const isRtl = useRtl();
  const {
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    action,
    centered = false,
    children: childrenProp,
    className,
    component = "div",
    allowScrollButtonsMobile = false,
    indicatorColor = "primary",
    onChange,
    orientation = "horizontal",
    ScrollButtonComponent,
    // TODO: remove in v7 (deprecated in v6)
    scrollButtons = "auto",
    selectionFollowsFocus,
    slots = {},
    slotProps = {},
    TabIndicatorProps = {},
    // TODO: remove in v7 (deprecated in v6)
    TabScrollButtonProps = {},
    // TODO: remove in v7 (deprecated in v6)
    textColor = "primary",
    value,
    variant = "standard",
    visibleScrollbar = false,
    ...other
  } = props;
  const scrollable = variant === "scrollable";
  const vertical = orientation === "vertical";
  const scrollStart = vertical ? "scrollTop" : "scrollLeft";
  const start2 = vertical ? "top" : "left";
  const end2 = vertical ? "bottom" : "right";
  const clientSize = vertical ? "clientHeight" : "clientWidth";
  const size = vertical ? "height" : "width";
  const ownerState = {
    ...props,
    component,
    allowScrollButtonsMobile,
    indicatorColor,
    orientation,
    vertical,
    scrollButtons,
    textColor,
    variant,
    visibleScrollbar,
    fixed: !scrollable,
    hideScrollbar: scrollable && !visibleScrollbar,
    scrollableX: scrollable && !vertical,
    scrollableY: scrollable && vertical,
    centered: centered && !scrollable,
    scrollButtonsHideMobile: !allowScrollButtonsMobile
  };
  const classes = useUtilityClasses7(ownerState);
  const startScrollButtonIconProps = useSlotProps_default({
    elementType: slots.StartScrollButtonIcon,
    externalSlotProps: slotProps.startScrollButtonIcon,
    ownerState
  });
  const endScrollButtonIconProps = useSlotProps_default({
    elementType: slots.EndScrollButtonIcon,
    externalSlotProps: slotProps.endScrollButtonIcon,
    ownerState
  });
  if (true) {
    if (centered && scrollable) {
      console.error('MUI: You can not use the `centered={true}` and `variant="scrollable"` properties at the same time on a `Tabs` component.');
    }
  }
  const [mounted, setMounted] = React12.useState(false);
  const [indicatorStyle, setIndicatorStyle] = React12.useState(defaultIndicatorStyle);
  const [displayStartScroll, setDisplayStartScroll] = React12.useState(false);
  const [displayEndScroll, setDisplayEndScroll] = React12.useState(false);
  const [updateScrollObserver, setUpdateScrollObserver] = React12.useState(false);
  const [scrollerStyle, setScrollerStyle] = React12.useState({
    overflow: "hidden",
    scrollbarWidth: 0
  });
  const valueToIndex = /* @__PURE__ */ new Map();
  const tabsRef = React12.useRef(null);
  const tabListRef = React12.useRef(null);
  const externalForwardedProps = {
    slots,
    slotProps: {
      indicator: TabIndicatorProps,
      scrollButton: TabScrollButtonProps,
      ...slotProps
    }
  };
  const getTabsMeta = () => {
    const tabsNode = tabsRef.current;
    let tabsMeta;
    if (tabsNode) {
      const rect = tabsNode.getBoundingClientRect();
      tabsMeta = {
        clientWidth: tabsNode.clientWidth,
        scrollLeft: tabsNode.scrollLeft,
        scrollTop: tabsNode.scrollTop,
        scrollWidth: tabsNode.scrollWidth,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right
      };
    }
    let tabMeta;
    if (tabsNode && value !== false) {
      const children2 = tabListRef.current.children;
      if (children2.length > 0) {
        const tab = children2[valueToIndex.get(value)];
        if (true) {
          if (!tab) {
            console.error([`MUI: The \`value\` provided to the Tabs component is invalid.`, `None of the Tabs' children match with "${value}".`, valueToIndex.keys ? `You can provide one of the following values: ${Array.from(valueToIndex.keys()).join(", ")}.` : null].join("\n"));
          }
        }
        tabMeta = tab ? tab.getBoundingClientRect() : null;
        if (true) {
          if (!warnedOnceTabPresent && tabMeta && tabMeta.width === 0 && tabMeta.height === 0 && // if the whole Tabs component is hidden, don't warn
          tabsMeta.clientWidth !== 0) {
            tabsMeta = null;
            console.error(["MUI: The `value` provided to the Tabs component is invalid.", `The Tab with this \`value\` ("${value}") is not part of the document layout.`, "Make sure the tab item is present in the document or that it's not `display: none`."].join("\n"));
            warnedOnceTabPresent = true;
          }
        }
      }
    }
    return {
      tabsMeta,
      tabMeta
    };
  };
  const updateIndicatorState = useEventCallback_default(() => {
    const {
      tabsMeta,
      tabMeta
    } = getTabsMeta();
    let startValue = 0;
    let startIndicator;
    if (vertical) {
      startIndicator = "top";
      if (tabMeta && tabsMeta) {
        startValue = tabMeta.top - tabsMeta.top + tabsMeta.scrollTop;
      }
    } else {
      startIndicator = isRtl ? "right" : "left";
      if (tabMeta && tabsMeta) {
        startValue = (isRtl ? -1 : 1) * (tabMeta[startIndicator] - tabsMeta[startIndicator] + tabsMeta.scrollLeft);
      }
    }
    const newIndicatorStyle = {
      [startIndicator]: startValue,
      // May be wrong until the font is loaded.
      [size]: tabMeta ? tabMeta[size] : 0
    };
    if (typeof indicatorStyle[startIndicator] !== "number" || typeof indicatorStyle[size] !== "number") {
      setIndicatorStyle(newIndicatorStyle);
    } else {
      const dStart = Math.abs(indicatorStyle[startIndicator] - newIndicatorStyle[startIndicator]);
      const dSize = Math.abs(indicatorStyle[size] - newIndicatorStyle[size]);
      if (dStart >= 1 || dSize >= 1) {
        setIndicatorStyle(newIndicatorStyle);
      }
    }
  });
  const scroll = (scrollValue, {
    animation = true
  } = {}) => {
    if (animation) {
      animate(scrollStart, tabsRef.current, scrollValue, {
        duration: theme.transitions.duration.standard
      });
    } else {
      tabsRef.current[scrollStart] = scrollValue;
    }
  };
  const moveTabsScroll = (delta) => {
    let scrollValue = tabsRef.current[scrollStart];
    if (vertical) {
      scrollValue += delta;
    } else {
      scrollValue += delta * (isRtl ? -1 : 1);
    }
    scroll(scrollValue);
  };
  const getScrollSize = () => {
    const containerSize = tabsRef.current[clientSize];
    let totalSize = 0;
    const children2 = Array.from(tabListRef.current.children);
    for (let i = 0; i < children2.length; i += 1) {
      const tab = children2[i];
      if (totalSize + tab[clientSize] > containerSize) {
        if (i === 0) {
          totalSize = containerSize;
        }
        break;
      }
      totalSize += tab[clientSize];
    }
    return totalSize;
  };
  const handleStartScrollClick = () => {
    moveTabsScroll(-1 * getScrollSize());
  };
  const handleEndScrollClick = () => {
    moveTabsScroll(getScrollSize());
  };
  const [ScrollbarSlot, {
    onChange: scrollbarOnChange,
    ...scrollbarSlotProps
  }] = useSlot("scrollbar", {
    className: clsx_default(classes.scrollableX, classes.hideScrollbar),
    elementType: TabsScrollbarSize,
    shouldForwardComponentProp: true,
    externalForwardedProps,
    ownerState
  });
  const handleScrollbarSizeChange = React12.useCallback((scrollbarWidth) => {
    scrollbarOnChange?.(scrollbarWidth);
    setScrollerStyle({
      overflow: null,
      scrollbarWidth
    });
  }, [scrollbarOnChange]);
  const [ScrollButtonsSlot, scrollButtonSlotProps] = useSlot("scrollButtons", {
    className: clsx_default(classes.scrollButtons, TabScrollButtonProps.className),
    elementType: TabScrollButton_default,
    externalForwardedProps,
    ownerState,
    additionalProps: {
      orientation,
      slots: {
        StartScrollButtonIcon: slots.startScrollButtonIcon || slots.StartScrollButtonIcon,
        EndScrollButtonIcon: slots.endScrollButtonIcon || slots.EndScrollButtonIcon
      },
      slotProps: {
        startScrollButtonIcon: startScrollButtonIconProps,
        endScrollButtonIcon: endScrollButtonIconProps
      }
    }
  });
  const getConditionalElements = () => {
    const conditionalElements2 = {};
    conditionalElements2.scrollbarSizeListener = scrollable ? (0, import_jsx_runtime12.jsx)(ScrollbarSlot, {
      ...scrollbarSlotProps,
      onChange: handleScrollbarSizeChange
    }) : null;
    const scrollButtonsActive = displayStartScroll || displayEndScroll;
    const showScrollButtons = scrollable && (scrollButtons === "auto" && scrollButtonsActive || scrollButtons === true);
    conditionalElements2.scrollButtonStart = showScrollButtons ? (0, import_jsx_runtime12.jsx)(ScrollButtonsSlot, {
      direction: isRtl ? "right" : "left",
      onClick: handleStartScrollClick,
      disabled: !displayStartScroll,
      ...scrollButtonSlotProps
    }) : null;
    conditionalElements2.scrollButtonEnd = showScrollButtons ? (0, import_jsx_runtime12.jsx)(ScrollButtonsSlot, {
      direction: isRtl ? "left" : "right",
      onClick: handleEndScrollClick,
      disabled: !displayEndScroll,
      ...scrollButtonSlotProps
    }) : null;
    return conditionalElements2;
  };
  const scrollSelectedIntoView = useEventCallback_default((animation) => {
    const {
      tabsMeta,
      tabMeta
    } = getTabsMeta();
    if (!tabMeta || !tabsMeta) {
      return;
    }
    if (tabMeta[start2] < tabsMeta[start2]) {
      const nextScrollStart = tabsMeta[scrollStart] + (tabMeta[start2] - tabsMeta[start2]);
      scroll(nextScrollStart, {
        animation
      });
    } else if (tabMeta[end2] > tabsMeta[end2]) {
      const nextScrollStart = tabsMeta[scrollStart] + (tabMeta[end2] - tabsMeta[end2]);
      scroll(nextScrollStart, {
        animation
      });
    }
  });
  const updateScrollButtonState = useEventCallback_default(() => {
    if (scrollable && scrollButtons !== false) {
      setUpdateScrollObserver(!updateScrollObserver);
    }
  });
  React12.useEffect(() => {
    const handleResize = debounce_default(() => {
      if (tabsRef.current) {
        updateIndicatorState();
      }
    });
    let resizeObserver;
    const handleMutation = (records) => {
      records.forEach((record) => {
        record.removedNodes.forEach((item) => {
          resizeObserver?.unobserve(item);
        });
        record.addedNodes.forEach((item) => {
          resizeObserver?.observe(item);
        });
      });
      handleResize();
      updateScrollButtonState();
    };
    const win = ownerWindow_default(tabsRef.current);
    win.addEventListener("resize", handleResize);
    let mutationObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleResize);
      Array.from(tabListRef.current.children).forEach((child) => {
        resizeObserver.observe(child);
      });
    }
    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(handleMutation);
      mutationObserver.observe(tabListRef.current, {
        childList: true
      });
    }
    return () => {
      handleResize.clear();
      win.removeEventListener("resize", handleResize);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [updateIndicatorState, updateScrollButtonState]);
  React12.useEffect(() => {
    const tabListChildren = Array.from(tabListRef.current.children);
    const length = tabListChildren.length;
    if (typeof IntersectionObserver !== "undefined" && length > 0 && scrollable && scrollButtons !== false) {
      const firstTab = tabListChildren[0];
      const lastTab = tabListChildren[length - 1];
      const observerOptions = {
        root: tabsRef.current,
        threshold: 0.99
      };
      const handleScrollButtonStart = (entries) => {
        setDisplayStartScroll(!entries[0].isIntersecting);
      };
      const firstObserver = new IntersectionObserver(handleScrollButtonStart, observerOptions);
      firstObserver.observe(firstTab);
      const handleScrollButtonEnd = (entries) => {
        setDisplayEndScroll(!entries[0].isIntersecting);
      };
      const lastObserver = new IntersectionObserver(handleScrollButtonEnd, observerOptions);
      lastObserver.observe(lastTab);
      return () => {
        firstObserver.disconnect();
        lastObserver.disconnect();
      };
    }
    return void 0;
  }, [scrollable, scrollButtons, updateScrollObserver, childrenProp?.length]);
  React12.useEffect(() => {
    setMounted(true);
  }, []);
  React12.useEffect(() => {
    updateIndicatorState();
  });
  React12.useEffect(() => {
    scrollSelectedIntoView(defaultIndicatorStyle !== indicatorStyle);
  }, [scrollSelectedIntoView, indicatorStyle]);
  React12.useImperativeHandle(action, () => ({
    updateIndicator: updateIndicatorState,
    updateScrollButtons: updateScrollButtonState
  }), [updateIndicatorState, updateScrollButtonState]);
  const [IndicatorSlot, indicatorSlotProps] = useSlot("indicator", {
    className: clsx_default(classes.indicator, TabIndicatorProps.className),
    elementType: TabsIndicator,
    externalForwardedProps,
    ownerState,
    additionalProps: {
      style: indicatorStyle
    }
  });
  const indicator = (0, import_jsx_runtime12.jsx)(IndicatorSlot, {
    ...indicatorSlotProps
  });
  let childIndex = 0;
  const children = React12.Children.map(childrenProp, (child) => {
    if (!React12.isValidElement(child)) {
      return null;
    }
    if (true) {
      if ((0, import_react_is.isFragment)(child)) {
        console.error(["MUI: The Tabs component doesn't accept a Fragment as a child.", "Consider providing an array instead."].join("\n"));
      }
    }
    const childValue = child.props.value === void 0 ? childIndex : child.props.value;
    valueToIndex.set(childValue, childIndex);
    const selected = childValue === value;
    childIndex += 1;
    return React12.cloneElement(child, {
      fullWidth: variant === "fullWidth",
      indicator: selected && !mounted && indicator,
      selected,
      selectionFollowsFocus,
      onChange,
      textColor,
      value: childValue,
      ...childIndex === 1 && value === false && !child.props.tabIndex ? {
        tabIndex: 0
      } : {}
    });
  });
  const handleKeyDown = (event) => {
    if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const list = tabListRef.current;
    const currentFocus = ownerDocument_default(list).activeElement;
    const role = currentFocus.getAttribute("role");
    if (role !== "tab") {
      return;
    }
    let previousItemKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    let nextItemKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    if (orientation === "horizontal" && isRtl) {
      previousItemKey = "ArrowRight";
      nextItemKey = "ArrowLeft";
    }
    switch (event.key) {
      case previousItemKey:
        event.preventDefault();
        moveFocus(list, currentFocus, previousItem);
        break;
      case nextItemKey:
        event.preventDefault();
        moveFocus(list, currentFocus, nextItem);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(list, null, nextItem);
        break;
      case "End":
        event.preventDefault();
        moveFocus(list, null, previousItem);
        break;
      default:
        break;
    }
  };
  const conditionalElements = getConditionalElements();
  const [RootSlot, rootSlotProps] = useSlot("root", {
    ref,
    className: clsx_default(classes.root, className),
    elementType: TabsRoot,
    externalForwardedProps: {
      ...externalForwardedProps,
      ...other,
      component
    },
    ownerState
  });
  const [ScrollerSlot, scrollerSlotProps] = useSlot("scroller", {
    ref: tabsRef,
    className: classes.scroller,
    elementType: TabsScroller,
    externalForwardedProps,
    ownerState,
    additionalProps: {
      style: {
        overflow: scrollerStyle.overflow,
        [vertical ? `margin${isRtl ? "Left" : "Right"}` : "marginBottom"]: visibleScrollbar ? void 0 : -scrollerStyle.scrollbarWidth
      }
    }
  });
  const [ListSlot, listSlotProps] = useSlot("list", {
    ref: tabListRef,
    className: clsx_default(classes.list, classes.flexContainer),
    elementType: List,
    externalForwardedProps,
    ownerState,
    getSlotProps: (handlers) => ({
      ...handlers,
      onKeyDown: (event) => {
        handleKeyDown(event);
        handlers.onKeyDown?.(event);
      }
    })
  });
  return (0, import_jsx_runtime12.jsxs)(RootSlot, {
    ...rootSlotProps,
    children: [conditionalElements.scrollButtonStart, conditionalElements.scrollbarSizeListener, (0, import_jsx_runtime12.jsxs)(ScrollerSlot, {
      ...scrollerSlotProps,
      children: [(0, import_jsx_runtime12.jsx)(ListSlot, {
        "aria-label": ariaLabel,
        "aria-labelledby": ariaLabelledBy,
        "aria-orientation": orientation === "vertical" ? "vertical" : null,
        role: "tablist",
        ...listSlotProps,
        children
      }), mounted && indicator]
    }), conditionalElements.scrollButtonEnd]
  });
});
true ? Tabs.propTypes = {
  // ┌────────────────────────────── Warning ──────────────────────────────┐
  // │ These PropTypes are generated from the TypeScript type definitions. │
  // │    To update them, edit the d.ts file and run `pnpm proptypes`.     │
  // └─────────────────────────────────────────────────────────────────────┘
  /**
   * Callback fired when the component mounts.
   * This is useful when you want to trigger an action programmatically.
   * It supports two actions: `updateIndicator()` and `updateScrollButtons()`
   *
   * @param {object} actions This object contains all possible actions
   * that can be triggered programmatically.
   */
  action: refType_default,
  /**
   * If `true`, the scroll buttons aren't forced hidden on mobile.
   * By default the scroll buttons are hidden on mobile and takes precedence over `scrollButtons`.
   * @default false
   */
  allowScrollButtonsMobile: import_prop_types9.default.bool,
  /**
   * The label for the Tabs as a string.
   */
  "aria-label": import_prop_types9.default.string,
  /**
   * An id or list of ids separated by a space that label the Tabs.
   */
  "aria-labelledby": import_prop_types9.default.string,
  /**
   * If `true`, the tabs are centered.
   * This prop is intended for large views.
   * @default false
   */
  centered: import_prop_types9.default.bool,
  /**
   * The content of the component.
   */
  children: import_prop_types9.default.node,
  /**
   * Override or extend the styles applied to the component.
   */
  classes: import_prop_types9.default.object,
  /**
   * @ignore
   */
  className: import_prop_types9.default.string,
  /**
   * The component used for the root node.
   * Either a string to use a HTML element or a component.
   */
  component: import_prop_types9.default.elementType,
  /**
   * Determines the color of the indicator.
   * @default 'primary'
   */
  indicatorColor: import_prop_types9.default.oneOfType([import_prop_types9.default.oneOf(["primary", "secondary"]), import_prop_types9.default.string]),
  /**
   * Callback fired when the value changes.
   *
   * @param {React.SyntheticEvent} event The event source of the callback. **Warning**: This is a generic event not a change event.
   * @param {any} value We default to the index of the child (number)
   */
  onChange: import_prop_types9.default.func,
  /**
   * The component orientation (layout flow direction).
   * @default 'horizontal'
   */
  orientation: import_prop_types9.default.oneOf(["horizontal", "vertical"]),
  /**
   * The component used to render the scroll buttons.
   * @deprecated use the `slots.scrollButtons` prop instead. This prop will be removed in a future major release. See [Migrating from deprecated APIs](https://mui.com/material-ui/migration/migrating-from-deprecated-apis/) for more details.
   * @default TabScrollButton
   */
  ScrollButtonComponent: import_prop_types9.default.elementType,
  /**
   * Determine behavior of scroll buttons when tabs are set to scroll:
   *
   * - `auto` will only present them when not all the items are visible.
   * - `true` will always present them.
   * - `false` will never present them.
   *
   * By default the scroll buttons are hidden on mobile.
   * This behavior can be disabled with `allowScrollButtonsMobile`.
   * @default 'auto'
   */
  scrollButtons: import_prop_types9.default.oneOf(["auto", false, true]),
  /**
   * If `true` the selected tab changes on focus. Otherwise it only
   * changes on activation.
   */
  selectionFollowsFocus: import_prop_types9.default.bool,
  /**
   * The props used for each slot inside.
   * @default {}
   */
  slotProps: import_prop_types9.default.shape({
    endScrollButtonIcon: import_prop_types9.default.oneOfType([import_prop_types9.default.func, import_prop_types9.default.object]),
    indicator: import_prop_types9.default.oneOfType([import_prop_types9.default.func, import_prop_types9.default.object]),
    list: import_prop_types9.default.oneOfType([import_prop_types9.default.func, import_prop_types9.default.object]),
    root: import_prop_types9.default.oneOfType([import_prop_types9.default.func, import_prop_types9.default.object]),
    scrollbar: import_prop_types9.default.oneOfType([import_prop_types9.default.func, import_prop_types9.default.object]),
    scrollButtons: import_prop_types9.default.oneOfType([import_prop_types9.default.func, import_prop_types9.default.object]),
    scroller: import_prop_types9.default.oneOfType([import_prop_types9.default.func, import_prop_types9.default.object]),
    startScrollButtonIcon: import_prop_types9.default.oneOfType([import_prop_types9.default.func, import_prop_types9.default.object])
  }),
  /**
   * The components used for each slot inside.
   * @default {}
   */
  slots: import_prop_types9.default.shape({
    endScrollButtonIcon: import_prop_types9.default.elementType,
    EndScrollButtonIcon: import_prop_types9.default.elementType,
    indicator: import_prop_types9.default.elementType,
    list: import_prop_types9.default.elementType,
    root: import_prop_types9.default.elementType,
    scrollbar: import_prop_types9.default.elementType,
    scrollButtons: import_prop_types9.default.elementType,
    scroller: import_prop_types9.default.elementType,
    startScrollButtonIcon: import_prop_types9.default.elementType,
    StartScrollButtonIcon: import_prop_types9.default.elementType
  }),
  /**
   * The system prop that allows defining system overrides as well as additional CSS styles.
   */
  sx: import_prop_types9.default.oneOfType([import_prop_types9.default.arrayOf(import_prop_types9.default.oneOfType([import_prop_types9.default.func, import_prop_types9.default.object, import_prop_types9.default.bool])), import_prop_types9.default.func, import_prop_types9.default.object]),
  /**
   * Props applied to the tab indicator element.
   * @deprecated use the `slotProps.indicator` prop instead. This prop will be removed in a future major release. See [Migrating from deprecated APIs](https://mui.com/material-ui/migration/migrating-from-deprecated-apis/) for more details.
   * @default  {}
   */
  TabIndicatorProps: import_prop_types9.default.object,
  /**
   * Props applied to the [`TabScrollButton`](https://mui.com/material-ui/api/tab-scroll-button/) element.
   * @deprecated use the `slotProps.scrollButtons` prop instead. This prop will be removed in a future major release. See [Migrating from deprecated APIs](https://mui.com/material-ui/migration/migrating-from-deprecated-apis/) for more details.
   * @default {}
   */
  TabScrollButtonProps: import_prop_types9.default.object,
  /**
   * Determines the color of the `Tab`.
   * @default 'primary'
   */
  textColor: import_prop_types9.default.oneOf(["inherit", "primary", "secondary"]),
  /**
   * The value of the currently selected `Tab`.
   * If you don't want any selected `Tab`, you can set this prop to `false`.
   */
  value: import_prop_types9.default.any,
  /**
   * Determines additional display behavior of the tabs:
   *
   *  - `scrollable` will invoke scrolling properties and allow for horizontally
   *  scrolling (or swiping) of the tab bar.
   *  - `fullWidth` will make the tabs grow to use all the available space,
   *  which should be used for small views, like on mobile.
   *  - `standard` will render the default state.
   * @default 'standard'
   */
  variant: import_prop_types9.default.oneOf(["fullWidth", "scrollable", "standard"]),
  /**
   * If `true`, the scrollbar is visible. It can be useful when displaying
   * a long vertical list of tabs.
   * @default false
   */
  visibleScrollbar: import_prop_types9.default.bool
} : void 0;
var Tabs_default = Tabs;

export {
  getPopperUtilityClass,
  Popper_default,
  getChipUtilityClass,
  chipClasses_default,
  Chip_default,
  getInputAdornmentUtilityClass,
  inputAdornmentClasses_default,
  InputAdornment_default,
  getSkeletonUtilityClass,
  skeletonClasses_default,
  Skeleton_default,
  getTabUtilityClass,
  tabClasses_default,
  Tab_default,
  KeyboardArrowLeft_default,
  KeyboardArrowRight_default,
  getTabScrollButtonUtilityClass,
  tabScrollButtonClasses_default,
  TabScrollButton_default,
  getTabsUtilityClass,
  tabsClasses_default,
  Tabs_default
};
//# sourceMappingURL=chunk-TCHXJ7BI.js.map
