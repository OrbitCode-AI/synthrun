import {
  l,
  x
} from "./chunk-3HENJRCK.js";

// ../orbit-cli/node_modules/@prefresh/core/src/constants.js
var VNODE_COMPONENT = "__c";
var NAMESPACE = "__PREFRESH__";
var COMPONENT_HOOKS = "__H";
var HOOKS_LIST = "__";
var EFFECTS_LIST = "__h";
var RERENDER_COUNT = "__r";
var CATCH_ERROR_OPTION = "__e";
var COMPONENT_DIRTY = "__d";
var COMPONENT_BITS = "__g";
var HOOK_VALUE = "__";
var HOOK_ARGS = "__H";
var HOOK_CLEANUP = "__c";

// ../orbit-cli/node_modules/@prefresh/core/src/utils.js
var COMPONENT_DIRTY_BIT = 1 << 3;
var isDirty = (vnode) => {
  if (vnode[VNODE_COMPONENT] && vnode[VNODE_COMPONENT][COMPONENT_DIRTY]) {
    return true;
  }
  if (vnode[VNODE_COMPONENT] && vnode[VNODE_COMPONENT][COMPONENT_BITS] & COMPONENT_DIRTY_BIT) {
    return true;
  }
};
var unsetDirty = (vnode) => {
  if (vnode[VNODE_COMPONENT]) {
    if (vnode[VNODE_COMPONENT][COMPONENT_DIRTY]) vnode[VNODE_COMPONENT][COMPONENT_DIRTY] = false;
    if (vnode[VNODE_COMPONENT][COMPONENT_BITS]) vnode[VNODE_COMPONENT][COMPONENT_BITS] &= ~COMPONENT_DIRTY_BIT;
  }
};

// ../orbit-cli/node_modules/@prefresh/core/src/runtime/catchError.js
var oldCatchError = l[CATCH_ERROR_OPTION];
l[CATCH_ERROR_OPTION] = (error, vnode, oldVNode, info) => {
  if (isDirty(vnode)) {
    unsetDirty(vnode);
  }
  if (oldCatchError) oldCatchError(error, vnode, oldVNode, info);
};

// ../orbit-cli/node_modules/@prefresh/core/src/runtime/debounceRendering.js
var defer = typeof Promise == "function" ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout;
l.debounceRendering = (process) => {
  defer(() => {
    try {
      process();
    } catch (e) {
      process[RERENDER_COUNT] = 0;
      throw e;
    }
  });
};

// ../orbit-cli/node_modules/@prefresh/core/src/runtime/vnodesForComponent.js
var vnodesForComponent = /* @__PURE__ */ new WeakMap();
var mappedVNodes = /* @__PURE__ */ new WeakMap();
var lastSeen = /* @__PURE__ */ new Map();

// ../orbit-cli/node_modules/@prefresh/core/src/runtime/vnode.js
var getMappedVnode = (type) => {
  if (mappedVNodes.has(type)) {
    return getMappedVnode(mappedVNodes.get(type));
  }
  return type;
};
var BUILT_IN_COMPONENTS = ["Fragment", "Suspense", "SuspenseList"];
var isBuiltIn = (type) => {
  return BUILT_IN_COMPONENTS.includes(type.name);
};
var oldVnode = l.vnode;
l.vnode = (vnode) => {
  if (vnode && typeof vnode.type === "function" && !isBuiltIn(vnode.type)) {
    const foundType = getMappedVnode(vnode.type);
    if (foundType !== vnode.type) {
      vnode.type = foundType;
      if (vnode[VNODE_COMPONENT] && "prototype" in vnode.type && vnode.type.prototype.render) {
        vnode[VNODE_COMPONENT].constructor = vnode.type;
      }
    }
  }
  if (oldVnode) oldVnode(vnode);
};
var oldDiff = l.__b;
l.__b = (vnode) => {
  if (vnode && typeof vnode.type === "function" && !isBuiltIn(vnode.type)) {
    const vnodes = vnodesForComponent.get(vnode.type);
    if (!vnodes) {
      vnodesForComponent.set(vnode.type, [vnode]);
    } else {
      vnodes.push(vnode);
    }
  }
  if (oldDiff) oldDiff(vnode);
};
var oldDiffed = l.diffed;
l.diffed = (vnode) => {
  if (vnode && typeof vnode.type === "function") {
    const vnodes = vnodesForComponent.get(vnode.type);
    lastSeen.set(vnode.__v, vnode);
    if (vnodes) {
      const matchingDom = vnodes.filter((p) => p.__c === vnode.__c);
      if (matchingDom.length > 1) {
        const i = vnodes.findIndex((p) => p === matchingDom[0]);
        vnodes.splice(i, 1);
      }
    }
  }
  if (oldDiffed) oldDiffed(vnode);
};

// ../orbit-cli/node_modules/@prefresh/core/src/runtime/unmount.js
var oldUnmount = l.unmount;
l.unmount = (vnode) => {
  const type = (vnode || {}).type;
  if (typeof type === "function" && vnodesForComponent.has(type)) {
    const vnodes = vnodesForComponent.get(type);
    if (vnodes) {
      const index = vnodes.indexOf(vnode);
      if (index !== -1) {
        vnodes.splice(index, 1);
      }
    }
  }
  if (oldUnmount) oldUnmount(vnode);
};

// ../orbit-cli/node_modules/@prefresh/core/src/runtime/signaturesForType.js
var signaturesForType = /* @__PURE__ */ new WeakMap();

// ../orbit-cli/node_modules/@prefresh/core/src/computeKey.js
var computeKey = (signature) => {
  let fullKey = signature.key;
  let hooks;
  try {
    hooks = signature.getCustomHooks();
  } catch (err) {
    signature.forceReset = true;
    return fullKey;
  }
  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];
    if (typeof hook !== "function") {
      signature.forceReset = true;
      return fullKey;
    }
    const nestedHookSignature = signaturesForType.get(hook);
    if (nestedHookSignature === void 0) continue;
    const nestedHookKey = computeKey(nestedHookSignature);
    if (nestedHookSignature.forceReset) signature.forceReset = true;
    fullKey += "\n---\n" + nestedHookKey;
  }
  return fullKey;
};

// ../orbit-cli/node_modules/@prefresh/core/src/index.js
var typesById = /* @__PURE__ */ new Map();
var pendingUpdates = [];
function sign(type, key, forceReset, getCustomHooks, status) {
  if (type) {
    let signature = signaturesForType.get(type);
    if (status === "begin") {
      signaturesForType.set(type, {
        type,
        key,
        forceReset,
        getCustomHooks: getCustomHooks || (() => [])
      });
      return "needsHooks";
    } else if (status === "needsHooks") {
      signature.fullKey = computeKey(signature);
    }
  }
}
function replaceComponent(OldType, NewType, resetHookState) {
  const vnodes = vnodesForComponent.get(OldType);
  if (!vnodes) return;
  vnodesForComponent.delete(OldType);
  vnodesForComponent.set(NewType, vnodes);
  mappedVNodes.set(OldType, NewType);
  pendingUpdates = pendingUpdates.filter((p) => p[0] !== OldType);
  vnodes.forEach((node) => {
    let vnode = node;
    if (vnode && vnode.__v && !vnode.__c && lastSeen.has(vnode.__v)) {
      vnode = lastSeen.get(vnode.__v);
      lastSeen.delete(vnode.__v);
    }
    if (!vnode || !vnode.__c || !vnode.__c.__P) return;
    vnode.type = NewType;
    if (vnode[VNODE_COMPONENT]) {
      vnode[VNODE_COMPONENT].constructor = vnode.type;
      try {
        if (vnode[VNODE_COMPONENT] instanceof OldType) {
          const oldInst = vnode[VNODE_COMPONENT];
          const newInst = new NewType(
            vnode[VNODE_COMPONENT].props,
            vnode[VNODE_COMPONENT].context
          );
          vnode[VNODE_COMPONENT] = newInst;
          for (let i in oldInst) {
            const type = typeof oldInst[i];
            if (!(i in newInst)) {
              newInst[i] = oldInst[i];
            } else if (type !== "function" && typeof newInst[i] === type) {
              if (type === "object" && newInst[i] != null && newInst[i].constructor === oldInst[i].constructor) {
                Object.assign(newInst[i], oldInst[i]);
              } else {
                newInst[i] = oldInst[i];
              }
            }
          }
        }
      } catch (e) {
        vnode[VNODE_COMPONENT].constructor = NewType;
      }
      if (resetHookState) {
        if (vnode[VNODE_COMPONENT][COMPONENT_HOOKS] && vnode[VNODE_COMPONENT][COMPONENT_HOOKS][HOOKS_LIST] && vnode[VNODE_COMPONENT][COMPONENT_HOOKS][HOOKS_LIST].length) {
          vnode[VNODE_COMPONENT][COMPONENT_HOOKS][HOOKS_LIST].forEach(
            (possibleEffect) => {
              if (possibleEffect[HOOK_CLEANUP] && typeof possibleEffect[HOOK_CLEANUP] === "function") {
                possibleEffect[HOOK_CLEANUP]();
                possibleEffect[HOOK_CLEANUP] = void 0;
              } else if (possibleEffect[HOOK_ARGS] && possibleEffect[HOOK_VALUE] && Object.keys(possibleEffect).length === 3) {
                const cleanupKey = Object.keys(possibleEffect).find(
                  (key) => key !== HOOK_ARGS && key !== HOOK_VALUE
                );
                if (cleanupKey && typeof possibleEffect[cleanupKey] == "function") {
                  possibleEffect[cleanupKey]();
                  possibleEffect[cleanupKey] = void 0;
                }
              }
            }
          );
        }
        vnode[VNODE_COMPONENT][COMPONENT_HOOKS] = {
          [HOOKS_LIST]: [],
          [EFFECTS_LIST]: []
        };
      } else if (vnode[VNODE_COMPONENT][COMPONENT_HOOKS] && vnode[VNODE_COMPONENT][COMPONENT_HOOKS][HOOKS_LIST] && vnode[VNODE_COMPONENT][COMPONENT_HOOKS][HOOKS_LIST].length) {
        vnode[VNODE_COMPONENT][COMPONENT_HOOKS][HOOKS_LIST].forEach(
          (possibleEffect) => {
            if (possibleEffect[HOOK_CLEANUP] && typeof possibleEffect[HOOK_CLEANUP] === "function") {
              possibleEffect[HOOK_CLEANUP]();
              possibleEffect[HOOK_CLEANUP] = void 0;
            } else if (possibleEffect[HOOK_ARGS] && possibleEffect[HOOK_VALUE] && Object.keys(possibleEffect).length === 3) {
              const cleanupKey = Object.keys(possibleEffect).find(
                (key) => key !== HOOK_ARGS && key !== HOOK_VALUE
              );
              if (cleanupKey && typeof possibleEffect[cleanupKey] == "function")
                possibleEffect[cleanupKey]();
              possibleEffect[cleanupKey] = void 0;
            }
          }
        );
        vnode[VNODE_COMPONENT][COMPONENT_HOOKS][HOOKS_LIST].forEach((hook) => {
          if (hook.__H && Array.isArray(hook.__H)) {
            hook.__H = void 0;
          }
        });
      }
      x.prototype.forceUpdate.call(vnode[VNODE_COMPONENT]);
    }
  });
}
self[NAMESPACE] = {
  getSignature: (type) => signaturesForType.get(type),
  register: (type, id) => {
    if (typeof type !== "function") return;
    if (typesById.has(id)) {
      const existing = typesById.get(id);
      if (existing !== type) {
        pendingUpdates.push([existing, type]);
        typesById.set(id, type);
      }
    } else {
      typesById.set(id, type);
    }
    if (!signaturesForType.has(type)) {
      signaturesForType.set(type, {
        getCustomHooks: () => [],
        type
      });
    }
  },
  getPendingUpdates: () => pendingUpdates,
  flush: () => {
    pendingUpdates = [];
  },
  replaceComponent,
  sign,
  computeKey
};
//# sourceMappingURL=@prefresh_core.js.map
