import { jsx as f, jsxs as F, Fragment as St } from "react/jsx-runtime";
import * as he from "react";
import fe, { createContext as Rt, useContext as bt, useReducer as fs, useRef as le, useEffect as ue, useMemo as Ee, useCallback as Xe, useLayoutEffect as oc, useState as ye, memo as sc, cloneElement as ic, forwardRef as tr, createElement as zr, useImperativeHandle as cc, Fragment as bn } from "react";
import { unstable_batchedUpdates as zn, createPortal as nr } from "react-dom";
var An = { exports: {} }, br = {};
var ho;
function lc() {
  if (ho) return br;
  ho = 1;
  var t = fe.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  return br.c = function(e) {
    return t.H.useMemoCache(e);
  }, br;
}
var wr = {};
var mo;
function ac() {
  return mo || (mo = 1, process.env.NODE_ENV !== "production" && (function() {
    var t = fe.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    wr.c = function(e) {
      var n = t.H;
      return n === null && console.error(
        `Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`
      ), n.useMemoCache(e);
    };
  })()), wr;
}
var go;
function uc() {
  return go || (go = 1, process.env.NODE_ENV === "production" ? An.exports = lc() : An.exports = ac()), An.exports;
}
var Q = uc();
const ps = Rt(null), hs = Rt(null);
function jr() {
  return bt(hs);
}
const ms = Rt([]);
function gs() {
  return bt(ms);
}
const vs = Rt(null);
function dc() {
  return bt(vs);
}
var z = /* @__PURE__ */ ((t) => (t.BRANCH = "BRANCH", t.CIRCUIT = "CIRCUIT", t.INSTRUCTION = "INSTRUCTION", t.RUNG = "RUNG", t))(z || {});
function Ft(t, e, n, r) {
  const o = ys(t, e, n, r.circuit);
  return {
    ...r,
    circuit: o
  };
}
function ys(t, e, n, r) {
  if (r.id === e) {
    const s = [...r.elements];
    return s.splice(n, 0, t), {
      ...r,
      elements: s
    };
  }
  const o = r.elements.map((s) => {
    if (s.type === z.BRANCH) {
      const i = s.circuits.map((c) => ys(t, e, n, c));
      return {
        ...s,
        circuits: i
      };
    } else
      return s;
  });
  return {
    ...r,
    elements: o
  };
}
function bs(t, e, n) {
  const r = n.elements.map((o) => {
    if (o.type === z.BRANCH) {
      const s = o.circuits.findIndex((i) => i.id === t);
      return s !== -1 ? {
        ...o,
        circuits: [...o.circuits.slice(0, s + 1), e, ...o.circuits.slice(s + 1)]
      } : {
        ...o,
        circuits: o.circuits.map((i) => bs(t, e, i))
      };
    }
    return o;
  });
  return {
    ...n,
    elements: r
  };
}
function Nt(t, e) {
  const n = JSON.parse(JSON.stringify(e));
  let r = null;
  function o(s) {
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c.type === z.BRANCH)
        for (let l = 0; l < c.circuits.length; l++) {
          const a = c.circuits[l];
          if (a.id === t)
            return r = c.circuits.splice(l, 1)[0], c.circuits.length === 1 && s.splice(i, 1, ...c.circuits[0].elements), r;
          const u = o(a.elements);
          if (u)
            return u;
        }
      else if (c.id === t)
        return r = s.splice(i, 1)[0], r;
    }
    return null;
  }
  return o(n.circuit.elements), {
    newRungData: n,
    cutObject: r
  };
}
function fc(t, e) {
  const n = ws(t, e.circuit);
  return {
    ...e,
    circuit: n
  };
}
function ws(t, e) {
  const n = e.elements.map((r) => {
    if (r.type === z.BRANCH) {
      const o = r.circuits.map((s) => ws(t, s));
      return {
        ...r,
        circuits: o
      };
    } else
      return r.id === t.id ? t : r;
  });
  return {
    ...e,
    elements: n
  };
}
function Ut(t) {
  const e = [];
  for (const n of t.elements)
    if (n.type === z.INSTRUCTION)
      e.push(n.id);
    else if (n.type === z.BRANCH)
      for (const r of n.circuits)
        e.push(...Ut(r));
  return e;
}
function tn(t, e) {
  let n = -1;
  for (let r = 0; r < t.length; r++)
    if (e.has(t[r])) {
      n = r;
      break;
    }
  if (n === -1) return null;
  for (let r = n; r < t.length; r++)
    if (!e.has(t[r])) return t[r];
  for (let r = n - 1; r >= 0; r--)
    if (!e.has(t[r])) return t[r];
  return null;
}
function rr(t, e) {
  return Is(t, e, t.id);
}
function Is(t, e, n) {
  const r = t.elements.filter((o) => o.type === z.INSTRUCTION).map((o) => o.id);
  if (r.some((o) => e.has(o))) {
    const o = tn(r, e);
    return o ? {
      id: o,
      type: z.INSTRUCTION
    } : t.id !== n ? {
      id: t.id,
      type: z.CIRCUIT
    } : {
      id: n,
      type: z.RUNG
    };
  }
  for (const o of t.elements)
    if (o.type === z.BRANCH)
      for (const s of o.circuits) {
        const i = Is(s, e, n);
        if (i) return i;
      }
  return null;
}
const At = {
  selectedIds: [],
  selectedType: null,
  anchorId: null
}, mn = {
  rungs: {},
  rungIds: [],
  selection: At
};
function pc(t, e, n, r) {
  const o = t.map((a) => e[a]?.circuit.id).filter(Boolean), s = n ? o.indexOf(n) : -1, i = o.indexOf(r);
  if (s === -1 || i === -1) return [r];
  const c = Math.min(s, i), l = Math.max(s, i);
  return o.slice(c, l + 1);
}
function hc(t, e, n, r) {
  const o = [];
  for (const a of t) {
    const u = e[a];
    u && o.push(...Ut(u.circuit));
  }
  const s = n ? o.indexOf(n) : -1, i = o.indexOf(r);
  if (s === -1 || i === -1) return [r];
  const c = Math.min(s, i), l = Math.max(s, i);
  return o.slice(c, l + 1);
}
function mc(t, e) {
  switch (e.type) {
    case "ADD_RUNG": {
      const {
        rungData: n,
        index: r
      } = e.payload, o = [...t.rungIds];
      return o.splice(r, 0, n.id), {
        ...t,
        rungs: {
          ...t.rungs,
          [n.id]: n
        },
        rungIds: o,
        selection: {
          selectedIds: [n.circuit.id],
          selectedType: z.RUNG,
          anchorId: n.circuit.id
        }
      };
    }
    case "DELETE_RUNG": {
      const {
        rungId: n
      } = e.payload, o = t.rungs[n]?.circuit.id, s = {
        ...t.rungs
      };
      delete s[n];
      const i = t.rungIds.filter((u) => u !== n), c = o ? t.selection.selectedIds.filter((u) => u !== o) : t.selection.selectedIds, l = t.selection.anchorId === o;
      let a;
      if (c.length > 0)
        a = {
          ...t.selection,
          selectedIds: c,
          anchorId: l ? c.at(-1) ?? null : t.selection.anchorId
        };
      else if (o) {
        const u = t.rungIds.map((p) => t.rungs[p]?.circuit.id).filter(Boolean), d = tn(u, /* @__PURE__ */ new Set([o]));
        a = d ? {
          selectedIds: [d],
          selectedType: z.RUNG,
          anchorId: d
        } : At;
      } else
        a = At;
      return {
        ...t,
        rungs: s,
        rungIds: i,
        selection: a
      };
    }
    case "MODIFY_RUNG": {
      const {
        rungData: n
      } = e.payload;
      return {
        ...t,
        rungs: {
          ...t.rungs,
          [n.id]: n
        }
      };
    }
    case "MOVE_RUNG": {
      const {
        fromIndex: n,
        toIndex: r
      } = e.payload, o = [...t.rungIds], [s] = o.splice(n, 1);
      return o.splice(r, 0, s), {
        ...t,
        rungIds: o
      };
    }
    case "ADD_INSTRUCTION": {
      const {
        instruction: n,
        circuitId: r,
        index: o,
        rungId: s
      } = e.payload, i = t.rungs[s];
      if (!i) return t;
      const c = Ft(n, r, o, i);
      return {
        ...t,
        rungs: {
          ...t.rungs,
          [s]: c
        },
        selection: {
          selectedIds: [n.id],
          selectedType: z.INSTRUCTION,
          anchorId: n.id
        }
      };
    }
    case "MOVE_INSTRUCTION": {
      const {
        instrId: n,
        fromRungId: r,
        toCircuitId: o,
        toRungId: s,
        toIndex: i
      } = e.payload, c = t.rungs[r];
      if (!c) return t;
      const {
        newRungData: l,
        cutObject: a
      } = Nt(n, c);
      if (a?.type !== z.INSTRUCTION) return t;
      let u = {
        ...t.rungs,
        [r]: l
      };
      const d = u[s];
      if (d) {
        const p = Ft(a, o, i, d);
        u = {
          ...u,
          [s]: p
        };
      }
      return {
        ...t,
        rungs: u
      };
    }
    case "MODIFY_INSTRUCTION": {
      const {
        instruction: n,
        rungId: r
      } = e.payload, o = t.rungs[r];
      if (!o) return t;
      const s = fc(n, o);
      return {
        ...t,
        rungs: {
          ...t.rungs,
          [r]: s
        }
      };
    }
    case "DELETE_INSTRUCTION": {
      const {
        instructionId: n,
        rungId: r
      } = e.payload, o = t.rungs[r];
      if (!o) return t;
      const {
        newRungData: s
      } = Nt(n, o), i = t.selection.selectedIds.filter((a) => a !== n), c = t.selection.anchorId === n;
      let l;
      if (i.length > 0)
        l = {
          ...t.selection,
          selectedIds: i,
          anchorId: c ? i.at(-1) ?? null : t.selection.anchorId
        };
      else {
        const a = rr(o.circuit, /* @__PURE__ */ new Set([n]));
        l = a ? {
          selectedIds: [a.id],
          selectedType: a.type,
          anchorId: a.id
        } : At;
      }
      return {
        ...t,
        rungs: {
          ...t.rungs,
          [r]: s
        },
        selection: l
      };
    }
    case "ADD_BRANCH": {
      const {
        branchData: n,
        circuitId: r,
        index: o,
        rungId: s
      } = e.payload, i = t.rungs[s];
      if (!i) return t;
      const c = Ft(n, r, o, i);
      return {
        ...t,
        rungs: {
          ...t.rungs,
          [s]: c
        },
        selection: {
          selectedIds: [n.circuits[0].id],
          selectedType: z.CIRCUIT,
          anchorId: n.circuits[0].id
        }
      };
    }
    case "ADD_BRANCH_LEVEL": {
      const {
        newCircuitData: n,
        selectedCircuitId: r,
        rungId: o
      } = e.payload, s = t.rungs[o];
      if (!s) return t;
      const i = bs(r, n, s.circuit);
      return {
        ...t,
        rungs: {
          ...t.rungs,
          [o]: {
            ...s,
            circuit: i
          }
        },
        selection: {
          selectedIds: [n.id],
          selectedType: z.CIRCUIT,
          anchorId: n.id
        }
      };
    }
    case "SELECT": {
      const {
        id: n,
        type: r,
        mode: o
      } = e.payload;
      if (o === "toggle") {
        if (t.selection.selectedType !== null && t.selection.selectedType !== r)
          return {
            ...t,
            selection: {
              selectedIds: [n],
              selectedType: r,
              anchorId: n
            }
          };
        const s = t.selection.selectedIds;
        if (s.includes(n)) {
          const i = s.filter((l) => l !== n);
          if (i.length === 0) return {
            ...t,
            selection: At
          };
          const c = t.selection.anchorId === n ? i[i.length - 1] : t.selection.anchorId;
          return {
            ...t,
            selection: {
              selectedIds: i,
              selectedType: r,
              anchorId: c
            }
          };
        }
        return {
          ...t,
          selection: {
            selectedIds: [...s, n],
            selectedType: r,
            anchorId: n
          }
        };
      }
      if (o === "range") {
        if (r === z.RUNG) {
          if (t.selection.selectedType !== null && t.selection.selectedType !== r)
            return {
              ...t,
              selection: {
                selectedIds: [n],
                selectedType: r,
                anchorId: n
              }
            };
          const i = pc(t.rungIds, t.rungs, t.selection.anchorId, n), c = t.selection.anchorId ?? n;
          return {
            ...t,
            selection: {
              selectedIds: i,
              selectedType: z.RUNG,
              anchorId: c
            }
          };
        }
        if (r === z.CIRCUIT)
          return {
            ...t,
            selection: {
              selectedIds: [n],
              selectedType: z.CIRCUIT,
              anchorId: n
            }
          };
        if (r === z.INSTRUCTION) {
          if (t.selection.selectedType !== null && t.selection.selectedType !== r)
            return {
              ...t,
              selection: {
                selectedIds: [n],
                selectedType: r,
                anchorId: n
              }
            };
          const i = hc(t.rungIds, t.rungs, t.selection.anchorId, n), c = t.selection.anchorId ?? n;
          return {
            ...t,
            selection: {
              selectedIds: i,
              selectedType: z.INSTRUCTION,
              anchorId: c
            }
          };
        }
        if (t.selection.selectedType !== null && t.selection.selectedType !== r)
          return {
            ...t,
            selection: {
              selectedIds: [n],
              selectedType: r,
              anchorId: n
            }
          };
        const s = t.selection.selectedIds;
        if (s.includes(n)) {
          const i = s.filter((l) => l !== n);
          if (i.length === 0) return {
            ...t,
            selection: At
          };
          const c = t.selection.anchorId === n ? i[i.length - 1] : t.selection.anchorId;
          return {
            ...t,
            selection: {
              selectedIds: i,
              selectedType: r,
              anchorId: c
            }
          };
        }
        return {
          ...t,
          selection: {
            selectedIds: [...s, n],
            selectedType: r,
            anchorId: n
          }
        };
      }
      return {
        ...t,
        selection: {
          selectedIds: [n],
          selectedType: r,
          anchorId: n
        }
      };
    }
    case "SELECT_ALL": {
      if (t.selection.selectedType === z.INSTRUCTION) {
        const r = t.selection.selectedIds[0];
        if (r)
          for (const o of t.rungIds) {
            const s = t.rungs[o];
            if (!s) continue;
            const i = Ut(s.circuit);
            if (i.includes(r))
              return {
                ...t,
                selection: {
                  selectedIds: i,
                  selectedType: z.INSTRUCTION,
                  anchorId: t.selection.anchorId
                }
              };
          }
      }
      const n = t.rungIds.map((r) => t.rungs[r]?.circuit.id).filter(Boolean);
      return {
        ...t,
        selection: {
          selectedIds: n,
          selectedType: z.RUNG,
          anchorId: t.selection.anchorId
        }
      };
    }
    case "CLEAR_SELECTION":
      return {
        ...t,
        selection: At
      };
    case "PASTE_RUNGS": {
      const {
        rungs: n,
        index: r
      } = e.payload;
      if (n.length === 0) return t;
      const o = [...t.rungIds], s = {
        ...t.rungs
      };
      for (let c = 0; c < n.length; c++) {
        const l = n[c];
        o.splice(r + c, 0, l.id), s[l.id] = l;
      }
      const i = n[n.length - 1];
      return {
        ...t,
        rungs: s,
        rungIds: o,
        selection: {
          selectedIds: [i.circuit.id],
          selectedType: z.RUNG,
          anchorId: i.circuit.id
        }
      };
    }
    case "SET_RUNGS": {
      const {
        rungs: n,
        rungIds: r,
        selection: o
      } = e.payload;
      return {
        ...t,
        rungs: n,
        rungIds: r,
        selection: o ?? At
      };
    }
    case "RESET":
      return mn;
    default:
      return t;
  }
}
const gc = 50, vc = /* @__PURE__ */ new Set(["ADD_RUNG", "DELETE_RUNG", "MODIFY_RUNG", "MOVE_RUNG", "ADD_INSTRUCTION", "MOVE_INSTRUCTION", "MODIFY_INSTRUCTION", "DELETE_INSTRUCTION", "ADD_BRANCH", "ADD_BRANCH_LEVEL", "PASTE_RUNGS", "SET_RUNGS"]);
function Ir(t) {
  return {
    rungs: t.rungs,
    rungIds: t.rungIds
  };
}
function vo(t, e) {
  return {
    ...t,
    rungs: e.rungs,
    rungIds: e.rungIds
  };
}
function _s(t) {
  return {
    past: [],
    present: t,
    future: []
  };
}
function yo(t, e) {
  if (e.type === "UNDO") {
    if (t.past.length === 0) return t;
    const r = t.past[t.past.length - 1];
    return {
      past: t.past.slice(0, -1),
      present: vo(t.present, r),
      future: [Ir(t.present), ...t.future]
    };
  }
  if (e.type === "REDO") {
    if (t.future.length === 0) return t;
    const r = t.future[0];
    return {
      past: [...t.past, Ir(t.present)],
      present: vo(t.present, r),
      future: t.future.slice(1)
    };
  }
  if (e.type === "RESET")
    return _s(mn);
  const n = mc(t.present, e);
  if (vc.has(e.type)) {
    const r = [...t.past, Ir(t.present)];
    return r.length > gc && r.shift(), {
      past: r,
      present: n,
      future: []
    };
  }
  return {
    ...t,
    present: n
  };
}
let Ss = 0;
function qt(t) {
  return `${t}_${++Ss}`;
}
function yc() {
  Ss = 0;
}
function bc(t, e) {
  const n = t.match(/^([A-Z_][A-Z0-9_]*)\(([^)]*)\)$/i);
  if (!n)
    return {
      rungId: e,
      message: `Invalid instruction format: "${t}"`,
      severity: "error"
    };
  const [, r, o] = n, s = o ? o.split(",").map((i) => i.trim()) : [];
  return {
    type: z.INSTRUCTION,
    instructionType: r.toUpperCase(),
    parameters: s,
    id: qt("i"),
    errors: []
  };
}
function xs(t, e, n) {
  const r = [];
  let o = 0;
  for (; o < t.length; ) {
    const s = t[o];
    if (s === "[") {
      const i = Ic(t, o, e, n);
      i.branch && r.push(i.branch), o = i.endPos;
    } else if (/[A-Z_]/i.test(s)) {
      const i = wc(t, o), c = t.slice(o, i), l = bc(c, e);
      "message" in l ? n.push(l) : r.push(l), o = i;
    } else
      o++;
  }
  return r;
}
function wc(t, e) {
  let n = e, r = 0;
  for (; n < t.length; ) {
    const o = t[n];
    if (o === "(") r++;
    else if (o === ")") {
      if (r--, r === 0) return n + 1;
    } else if (r === 0 && (o === "[" || o === "," || o === "]"))
      return n;
    n++;
  }
  return n;
}
function Ic(t, e, n, r) {
  let o = 0, s = 0, i = e, c = e + 1;
  const l = [];
  for (; i < t.length; ) {
    const u = t[i];
    if (u === "[")
      o++;
    else if (u === "]") {
      if (o--, o === 0) {
        l.push(t.slice(c, i));
        break;
      }
    } else u === "(" ? s++ : u === ")" ? s-- : u === "," && o === 1 && s === 0 && (l.push(t.slice(c, i)), c = i + 1);
    i++;
  }
  if (l.length === 0)
    return {
      branch: null,
      endPos: i + 1
    };
  const a = l.map((u) => {
    const d = xs(u, n, r);
    return {
      type: z.CIRCUIT,
      id: qt("c"),
      elements: d,
      errors: []
    };
  });
  return {
    branch: {
      type: z.BRANCH,
      id: qt("b"),
      circuits: a
    },
    endPos: i + 1
  };
}
function _c(t) {
  const e = qt("r"), n = [], r = t.trim();
  if (!r)
    return {
      rung: {
        id: e,
        comment: "",
        circuit: {
          type: z.CIRCUIT,
          id: qt("c"),
          elements: [],
          errors: []
        },
        errors: []
      },
      errors: []
    };
  const o = xs(r, e, n);
  return {
    rung: {
      id: e,
      comment: "",
      circuit: {
        type: z.CIRCUIT,
        id: qt("c"),
        elements: o,
        errors: []
      },
      errors: []
    },
    errors: n
  };
}
function Ts(t) {
  const e = [];
  for (const n of t.elements)
    if (n.type === z.INSTRUCTION)
      e.push(n.id);
    else if (n.type === z.BRANCH)
      for (const r of n.circuits)
        e.push(...Ts(r));
  return e;
}
function Sc(t) {
  return Ts(t.circuit);
}
function wn(t) {
  yc();
  const e = [], n = {}, r = [];
  if (!t || !t.trim())
    return {
      state: {
        rungs: {},
        rungIds: [],
        selection: {
          selectedIds: [],
          selectedType: null,
          anchorId: null
        }
      },
      errors: []
    };
  const o = t.split(";");
  return o.length > 0 && !o[o.length - 1].trim() && o.pop(), o.forEach((s) => {
    const {
      rung: i,
      errors: c
    } = _c(s);
    n[i.id] = i, r.push(i.id), e.push(...c);
  }), {
    state: {
      rungs: n,
      rungIds: r,
      selection: {
        selectedIds: [],
        selectedType: null,
        anchorId: null
      }
    },
    errors: e
  };
}
function In(t) {
  const e = t.parameters.map((n) => n || "?").join(",");
  return `${t.instructionType}(${e})`;
}
function xc(t) {
  return t.type === z.INSTRUCTION ? In(t) : Tc(t);
}
function Tc(t) {
  return `[${t.circuits.map(nn).join(",")}]`;
}
function nn(t) {
  return t.elements.map(xc).join("");
}
function Nc(t) {
  const e = t.rungIds.map((n) => {
    const r = t.rungs[n];
    return r ? nn(r.circuit) : "";
  });
  return e.length === 0 ? "" : e.join(";") + ";";
}
function Sg(t) {
  const e = Q.c(118), {
    children: n,
    errors: r,
    ldDiagnostics: o,
    tags: s,
    getTag: i,
    isSimulationRunning: c,
    renderInstructionMenuExtras: l,
    onRungAdd: a,
    onRungDelete: u,
    onRungChange: d,
    onInstructionAdd: p,
    onInstructionChange: h,
    onInstructionDelete: v,
    onSelectionChange: m
  } = t;
  let g;
  e[0] !== r ? (g = r === void 0 ? [] : r, e[0] = r, e[1] = g) : g = e[1];
  const I = g, T = o === void 0 ? [] : o;
  let b;
  e[2] !== s ? (b = s === void 0 ? [] : s, e[2] = s, e[3] = b) : b = e[3];
  const x = b, S = c === void 0 ? !1 : c, C = "value" in t ? t.value : void 0, O = "onChange" in t ? t.onChange : void 0, N = "defaultValue" in t ? t.defaultValue : void 0, E = "dslValue" in t ? t.dslValue : void 0, _ = "dslOnChange" in t ? t.dslOnChange : void 0, w = "defaultDslValue" in t ? t.defaultDslValue : void 0, y = E !== void 0 || w !== void 0, R = C !== void 0 || E !== void 0;
  let k;
  e[4] !== E ? (k = E !== void 0 ? wn(E) : null, e[4] = E, e[5] = k) : k = e[5];
  const A = k;
  let P;
  e[6] !== w || e[7] !== N || e[8] !== E || e[9] !== A?.state || e[10] !== C ? (P = () => C !== void 0 ? C : N !== void 0 ? N : E !== void 0 ? A?.state ?? mn : w !== void 0 ? wn(w).state : mn, e[6] = w, e[7] = N, e[8] = E, e[9] = A?.state, e[10] = C, e[11] = P) : P = e[11];
  const $ = P;
  let X;
  e[12] !== $ ? (X = () => _s($()), e[12] = $, e[13] = X) : X = e[13];
  const [L, B] = fs(yo, void 0, X), U = L.present, H = L.past.length > 0, K = L.future.length > 0, Z = R && !y ? C : U, j = le(Z);
  let M, G;
  e[14] !== Z ? (G = () => {
    j.current = Z;
  }, M = [Z], e[14] = Z, e[15] = M, e[16] = G) : (M = e[15], G = e[16]), ue(G, M);
  const q = le(L);
  let Y, W;
  e[17] !== L ? (Y = () => {
    q.current = L;
  }, W = [L], e[17] = L, e[18] = Y, e[19] = W) : (Y = e[18], W = e[19]), ue(Y, W);
  const ae = le(!1), ie = le(E);
  let Ie;
  e[20] !== B || e[21] !== E || e[22] !== y || e[23] !== A?.state ? (Ie = () => {
    if (y && E !== void 0 && E !== ie.current && !ae.current) {
      const V = A?.state ?? mn;
      B({
        type: "SET_RUNGS",
        payload: {
          rungs: V.rungs,
          rungIds: V.rungIds
        }
      });
    }
    ie.current = E, ae.current = !1;
  }, e[20] = B, e[21] = E, e[22] = y, e[23] = A?.state, e[24] = Ie) : Ie = e[24];
  let se;
  e[25] !== E || e[26] !== y || e[27] !== A ? (se = [E, y, A], e[25] = E, e[26] = y, e[27] = A, e[28] = se) : se = e[28], ue(Ie, se);
  let Oe, Ge;
  e[29] !== _ || e[30] !== U || e[31] !== y ? (Oe = () => {
    if (y && _) {
      const V = Nc(U);
      V !== ie.current && (ae.current = !0, ie.current = V, _(V));
    }
  }, Ge = [U, y, _], e[29] = _, e[30] = U, e[31] = y, e[32] = Oe, e[33] = Ge) : (Oe = e[32], Ge = e[33]), ue(Oe, Ge);
  let ft;
  e[34] !== Z.rungIds || e[35] !== Z.rungs ? (ft = (V) => {
    const re = Z.rungIds[V.rung], Ce = re ? Z.rungs[re] : void 0, je = Ce ? Sc(Ce) : [], lt = V.element !== void 0 ? je[V.element] : void 0;
    return {
      rungId: re,
      elementId: lt,
      message: V.message,
      severity: V.severity,
      code: V.code
    };
  }, e[34] = Z.rungIds, e[35] = Z.rungs, e[36] = ft) : ft = e[36];
  const Et = T.map(ft);
  let Ye;
  e[37] !== A?.errors ? (Ye = A?.errors ?? [], e[37] = A?.errors, e[38] = Ye) : Ye = e[38];
  const Me = [...I, ...Et, ...Ye];
  let He, Je;
  e[39] !== m || e[40] !== Z.selection.selectedIds || e[41] !== Z.selection.selectedType ? (He = () => {
    m && m({
      ids: Z.selection.selectedIds,
      type: Z.selection.selectedType
    });
  }, Je = [Z.selection.selectedIds, Z.selection.selectedType, m], e[39] = m, e[40] = Z.selection.selectedIds, e[41] = Z.selection.selectedType, e[42] = He, e[43] = Je) : (He = e[42], Je = e[43]), ue(He, Je);
  let pt;
  e[44] !== B || e[45] !== R || e[46] !== y || e[47] !== O ? (pt = (V) => {
    if (R && !y && O) {
      const re = yo(q.current, V);
      q.current = re, j.current = re.present, B(V), O(re.present);
    } else
      B(V);
  }, e[44] = B, e[45] = R, e[46] = y, e[47] = O, e[48] = pt) : pt = e[48];
  const ee = pt;
  let de;
  e[49] !== ee || e[50] !== a ? (de = (V, re) => {
    ee({
      type: "ADD_RUNG",
      payload: {
        rungData: V,
        index: re
      }
    }), a?.(V, re);
  }, e[49] = ee, e[50] = a, e[51] = de) : de = e[51];
  let ne;
  e[52] !== ee || e[53] !== u ? (ne = (V) => {
    ee({
      type: "DELETE_RUNG",
      payload: {
        rungId: V
      }
    }), u?.(V);
  }, e[52] = ee, e[53] = u, e[54] = ne) : ne = e[54];
  let oe;
  e[55] !== ee || e[56] !== d ? (oe = (V) => {
    ee({
      type: "MODIFY_RUNG",
      payload: {
        rungData: V
      }
    }), d?.(V);
  }, e[55] = ee, e[56] = d, e[57] = oe) : oe = e[57];
  let ce;
  e[58] !== ee ? (ce = (V, re) => {
    ee({
      type: "MOVE_RUNG",
      payload: {
        fromIndex: V,
        toIndex: re
      }
    });
  }, e[58] = ee, e[59] = ce) : ce = e[59];
  let Le;
  e[60] !== ee || e[61] !== p ? (Le = (V, re, Ce, je) => {
    ee({
      type: "ADD_INSTRUCTION",
      payload: {
        instruction: V,
        circuitId: re,
        index: Ce,
        rungId: je
      }
    }), p?.(V, je);
  }, e[60] = ee, e[61] = p, e[62] = Le) : Le = e[62];
  let tt;
  e[63] !== ee ? (tt = (V, re, Ce, je, lt) => {
    ee({
      type: "MOVE_INSTRUCTION",
      payload: {
        instrId: V,
        fromRungId: re,
        toCircuitId: Ce,
        toRungId: je,
        toIndex: lt
      }
    });
  }, e[63] = ee, e[64] = tt) : tt = e[64];
  let $e;
  e[65] !== ee || e[66] !== h ? ($e = (V, re) => {
    ee({
      type: "MODIFY_INSTRUCTION",
      payload: {
        instruction: V,
        rungId: re
      }
    }), h?.(V, re);
  }, e[65] = ee, e[66] = h, e[67] = $e) : $e = e[67];
  let ht;
  e[68] !== ee || e[69] !== v ? (ht = (V, re) => {
    ee({
      type: "DELETE_INSTRUCTION",
      payload: {
        instructionId: V,
        rungId: re
      }
    }), v?.(V, re);
  }, e[68] = ee, e[69] = v, e[70] = ht) : ht = e[70];
  let mt, It, Ke, gt, Dt;
  e[71] !== ee ? (mt = (V, re, Ce, je) => {
    ee({
      type: "ADD_BRANCH",
      payload: {
        branchData: V,
        circuitId: re,
        index: Ce,
        rungId: je
      }
    });
  }, It = (V, re, Ce) => {
    ee({
      type: "ADD_BRANCH_LEVEL",
      payload: {
        newCircuitData: V,
        selectedCircuitId: re,
        rungId: Ce
      }
    });
  }, Ke = (V, re, Ce) => {
    ee({
      type: "SELECT",
      payload: {
        id: V,
        type: re,
        mode: Ce === void 0 ? "replace" : Ce
      }
    });
  }, gt = () => {
    ee({
      type: "SELECT_ALL"
    });
  }, Dt = () => {
    ee({
      type: "CLEAR_SELECTION"
    });
  }, e[71] = ee, e[72] = mt, e[73] = It, e[74] = Ke, e[75] = gt, e[76] = Dt) : (mt = e[72], It = e[73], Ke = e[74], gt = e[75], Dt = e[76]);
  let Tt;
  e[77] !== ee || e[78] !== a ? (Tt = (V, re) => {
    ee({
      type: "PASTE_RUNGS",
      payload: {
        rungs: V,
        index: re
      }
    }), V.forEach((Ce, je) => a?.(Ce, re + je));
  }, e[77] = ee, e[78] = a, e[79] = Tt) : Tt = e[79];
  let kt, $t, zt, Ne;
  e[80] !== ee ? (kt = (V, re, Ce) => {
    ee({
      type: "SET_RUNGS",
      payload: {
        rungs: V,
        rungIds: re,
        selection: Ce
      }
    });
  }, $t = () => {
    ee({
      type: "RESET"
    });
  }, zt = () => {
    ee({
      type: "UNDO"
    });
  }, Ne = () => {
    ee({
      type: "REDO"
    });
  }, e[80] = ee, e[81] = kt, e[82] = $t, e[83] = zt, e[84] = Ne) : (kt = e[81], $t = e[82], zt = e[83], Ne = e[84]);
  let Pe;
  e[85] !== K || e[86] !== H || e[87] !== de || e[88] !== ne || e[89] !== oe || e[90] !== ce || e[91] !== Le || e[92] !== tt || e[93] !== $e || e[94] !== ht || e[95] !== mt || e[96] !== It || e[97] !== Ke || e[98] !== gt || e[99] !== Dt || e[100] !== Tt || e[101] !== kt || e[102] !== $t || e[103] !== zt || e[104] !== Ne ? (Pe = {
    addRung: de,
    deleteRung: ne,
    modifyRung: oe,
    moveRung: ce,
    addInstruction: Le,
    moveInstruction: tt,
    modifyInstruction: $e,
    deleteInstruction: ht,
    addBranch: mt,
    addBranchLevel: It,
    select: Ke,
    selectAll: gt,
    clearSelection: Dt,
    pasteRungs: Tt,
    setRungs: kt,
    reset: $t,
    undo: zt,
    redo: Ne,
    canUndo: H,
    canRedo: K
  }, e[85] = K, e[86] = H, e[87] = de, e[88] = ne, e[89] = oe, e[90] = ce, e[91] = Le, e[92] = tt, e[93] = $e, e[94] = ht, e[95] = mt, e[96] = It, e[97] = Ke, e[98] = gt, e[99] = Dt, e[100] = Tt, e[101] = kt, e[102] = $t, e[103] = zt, e[104] = Ne, e[105] = Pe) : Pe = e[105];
  const _t = {
    state: Z,
    actions: Pe,
    errors: Me
  };
  let Ze;
  e[106] !== i || e[107] !== S ? (Ze = i ? {
    getTag: i,
    isRunning: S
  } : null, e[106] = i, e[107] = S, e[108] = Ze) : Ze = e[108];
  const Be = Ze, rt = l ?? null;
  let it;
  e[109] !== n || e[110] !== rt ? (it = /* @__PURE__ */ f(vs.Provider, { value: rt, children: n }), e[109] = n, e[110] = rt, e[111] = it) : it = e[111];
  let _e;
  e[112] !== Be || e[113] !== it ? (_e = /* @__PURE__ */ f(hs.Provider, { value: Be, children: it }), e[112] = Be, e[113] = it, e[114] = _e) : _e = e[114];
  let ct;
  return e[115] !== _e || e[116] !== x ? (ct = /* @__PURE__ */ f(ms.Provider, { value: x, children: _e }), e[115] = _e, e[116] = x, e[117] = ct) : ct = e[117], /* @__PURE__ */ f(ps.Provider, { value: _t, children: ct });
}
function ke() {
  const t = bt(ps);
  if (!t)
    throw new Error("useLadderEditor must be used within LadderEditorProvider");
  return t;
}
function xg(t) {
  const e = Q.c(18), {
    state: n,
    actions: r
  } = ke(), o = n.rungs[t];
  let s;
  e[0] !== o || e[1] !== n.selection.selectedIds ? (s = o ? n.selection.selectedIds.includes(o.circuit.id) : !1, e[0] = o, e[1] = n.selection.selectedIds, e[2] = s) : s = e[2];
  let i;
  e[3] !== r || e[4] !== o ? (i = (u) => {
    o && r.modifyRung({
      ...o,
      ...u
    });
  }, e[3] = r, e[4] = o, e[5] = i) : i = e[5];
  let c;
  e[6] !== r || e[7] !== t ? (c = () => r.deleteRung(t), e[6] = r, e[7] = t, e[8] = c) : c = e[8];
  let l;
  e[9] !== r || e[10] !== o ? (l = () => {
    o && r.select(o.circuit.id, z.RUNG);
  }, e[9] = r, e[10] = o, e[11] = l) : l = e[11];
  let a;
  return e[12] !== o || e[13] !== s || e[14] !== i || e[15] !== c || e[16] !== l ? (a = {
    rung: o,
    isSelected: s,
    modify: i,
    delete: c,
    select: l
  }, e[12] = o, e[13] = s, e[14] = i, e[15] = c, e[16] = l, e[17] = a) : a = e[17], a;
}
function Cc(t, e) {
  const n = Q.c(30), {
    state: r,
    actions: o,
    errors: s
  } = ke(), i = r.rungs[e];
  let c;
  e: {
    if (!i) {
      c = null;
      break e;
    }
    let I;
    if (n[0] !== t || n[1] !== i.circuit.elements) {
      let T = function(b) {
        for (const x of b) {
          if (x.type === z.INSTRUCTION && x.id === t)
            return x;
          if (x.type === z.BRANCH)
            for (const S of x.circuits) {
              const C = T(S.elements);
              if (C)
                return C;
            }
        }
        return null;
      };
      I = T(i.circuit.elements), n[0] = t, n[1] = i.circuit.elements, n[2] = I;
    } else
      I = n[2];
    c = I;
  }
  const l = c;
  let a;
  if (n[3] !== s || n[4] !== t) {
    let I;
    n[6] !== t ? (I = (T) => T.elementId === t, n[6] = t, n[7] = I) : I = n[7], a = s.filter(I), n[3] = s, n[4] = t, n[5] = a;
  } else
    a = n[5];
  const u = a;
  let d;
  n[8] !== t || n[9] !== r.selection.selectedIds ? (d = r.selection.selectedIds.includes(t), n[8] = t, n[9] = r.selection.selectedIds, n[10] = d) : d = n[10];
  const p = u.length > 0;
  let h;
  n[11] !== o || n[12] !== l || n[13] !== e ? (h = (I) => {
    l && o.modifyInstruction({
      ...l,
      ...I
    }, e);
  }, n[11] = o, n[12] = l, n[13] = e, n[14] = h) : h = n[14];
  let v;
  n[15] !== o || n[16] !== t || n[17] !== e ? (v = () => o.deleteInstruction(t, e), n[15] = o, n[16] = t, n[17] = e, n[18] = v) : v = n[18];
  let m;
  n[19] !== o || n[20] !== t ? (m = () => o.select(t, z.INSTRUCTION), n[19] = o, n[20] = t, n[21] = m) : m = n[21];
  let g;
  return n[22] !== l || n[23] !== u || n[24] !== d || n[25] !== p || n[26] !== h || n[27] !== v || n[28] !== m ? (g = {
    instruction: l,
    isSelected: d,
    hasError: p,
    errors: u,
    modify: h,
    delete: v,
    select: m
  }, n[22] = l, n[23] = u, n[24] = d, n[25] = p, n[26] = h, n[27] = v, n[28] = m, n[29] = g) : g = n[29], g;
}
function Tg() {
  const t = Q.c(12), {
    state: e,
    actions: n
  } = ke();
  let r;
  t[0] !== e.selection.selectedIds ? (r = e.selection.selectedIds.at(-1) ?? null, t[0] = e.selection.selectedIds, t[1] = r) : r = t[1];
  let o;
  t[2] !== e.selection.selectedIds ? (o = (i) => e.selection.selectedIds.includes(i), t[2] = e.selection.selectedIds, t[3] = o) : o = t[3];
  let s;
  return t[4] !== n.clearSelection || t[5] !== n.select || t[6] !== n.selectAll || t[7] !== e.selection.selectedIds || t[8] !== e.selection.selectedType || t[9] !== r || t[10] !== o ? (s = {
    selectedIds: e.selection.selectedIds,
    primarySelectedId: r,
    selectedType: e.selection.selectedType,
    isSelected: o,
    select: n.select,
    selectAll: n.selectAll,
    clear: n.clearSelection
  }, t[4] = n.clearSelection, t[5] = n.select, t[6] = n.selectAll, t[7] = e.selection.selectedIds, t[8] = e.selection.selectedType, t[9] = r, t[10] = o, t[11] = s) : s = t[11], s;
}
const Fe = [];
for (let t = 0; t < 256; ++t)
  Fe.push((t + 256).toString(16).slice(1));
function Rc(t, e = 0) {
  return (Fe[t[e + 0]] + Fe[t[e + 1]] + Fe[t[e + 2]] + Fe[t[e + 3]] + "-" + Fe[t[e + 4]] + Fe[t[e + 5]] + "-" + Fe[t[e + 6]] + Fe[t[e + 7]] + "-" + Fe[t[e + 8]] + Fe[t[e + 9]] + "-" + Fe[t[e + 10]] + Fe[t[e + 11]] + Fe[t[e + 12]] + Fe[t[e + 13]] + Fe[t[e + 14]] + Fe[t[e + 15]]).toLowerCase();
}
let _r;
const Oc = new Uint8Array(16);
function Ec() {
  if (!_r) {
    if (typeof crypto > "u" || !crypto.getRandomValues)
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    _r = crypto.getRandomValues.bind(crypto);
  }
  return _r(Oc);
}
const Dc = typeof crypto < "u" && crypto.randomUUID && crypto.randomUUID.bind(crypto), bo = { randomUUID: Dc };
function kc(t, e, n) {
  t = t || {};
  const r = t.random ?? t.rng?.() ?? Ec();
  if (r.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return r[6] = r[6] & 15 | 64, r[8] = r[8] & 63 | 128, Rc(r);
}
function Ot(t, e, n) {
  return bo.randomUUID && !t ? bo.randomUUID() : kc(t);
}
const jn = () => ({
  id: `circuit-${Ot()}`,
  elements: [],
  type: z.CIRCUIT,
  errors: []
}), Ns = () => ({
  circuits: [jn(), jn()],
  type: z.BRANCH,
  id: `branch-${Ot()}`
});
var be = /* @__PURE__ */ ((t) => (t.XIO = "XIO", t.XIC = "XIC", t.ONS = "ONS", t))(be || {}), we = /* @__PURE__ */ ((t) => (t.OTE = "OTE", t.OTL = "OTL", t.OTU = "OTU", t))(we || {}), Qe = /* @__PURE__ */ ((t) => (t.TON = "TON", t.TOF = "TOF", t.RTO = "RTO", t))(Qe || {}), ut = /* @__PURE__ */ ((t) => (t.CTU = "CTU", t.CTD = "CTD", t))(ut || {}), Vt = /* @__PURE__ */ ((t) => (t.RES = "RES", t))(Vt || {}), Gt = /* @__PURE__ */ ((t) => (t.MOV = "MOVE", t))(Gt || {}), ze = /* @__PURE__ */ ((t) => (t.ADD = "ADD", t.SUB = "SUB", t.MUL = "MUL", t.DIV = "DIV", t))(ze || {}), ge = /* @__PURE__ */ ((t) => (t.EQ = "EQ", t.NE = "NE", t.GT = "GT", t.GE = "GE", t.LT = "LT", t.LE = "LE", t.LIMIT = "LIMIT", t))(ge || {});
const Ng = be, Cs = {
  ...we,
  ...Vt,
  ...Qe,
  ...ut,
  ...Gt,
  ...ze
}, $c = Object.values(Qe), zc = Object.values(ut), Ac = Object.values(Gt), Lc = Object.values(ze), Pc = Object.values(ge), Rs = (t) => {
  const e = `instr-${Ot()}`, n = $c.includes(t), r = zc.includes(t), o = Ac.includes(t), s = Lc.includes(t), i = Pc.includes(t), c = t === ge.LIMIT, l = n || r || s || c ? ["?", "?", "?"] : o || i ? ["?", "?"] : ["?"];
  return {
    type: z.INSTRUCTION,
    instructionType: t,
    id: e,
    parameters: l,
    errors: []
  };
}, Cn = () => ({
  id: `rung-${Ot()}`,
  circuit: jn(),
  comment: "",
  errors: []
});
function Rn(t, e) {
  if (e.id === t) return {
    parentCircuitId: t,
    index: null
  };
  for (let n = 0; n < e.elements.length; n++) {
    const r = e.elements[n];
    if (r.type === z.BRANCH)
      for (const o of r.circuits) {
        const s = Rn(t, o);
        if (s.parentCircuitId !== null) return s;
      }
    else if (r.type === z.INSTRUCTION && r.id === t)
      return {
        parentCircuitId: e.id,
        index: n
      };
  }
  return {
    parentCircuitId: null,
    index: null
  };
}
function vt(t, e) {
  if (e.id === t)
    return !0;
  for (const n of e.elements)
    if (n.type === z.BRANCH) {
      for (const r of n.circuits)
        if (r.id === t || vt(t, r))
          return !0;
    } else if (n.id === t)
      return !0;
  return !1;
}
function rn(t, e) {
  return e.findIndex((n) => vt(t, n.circuit));
}
function Os(t, e) {
  for (const n of e.elements) {
    if (n.type === z.INSTRUCTION && n.id === t)
      return n;
    if (n.type === z.BRANCH)
      for (const r of n.circuits) {
        const o = Os(t, r);
        if (o) return o;
      }
  }
  return null;
}
function Fn(t, e) {
  return Os(t, e.circuit);
}
const Es = (t) => {
  for (const e of t)
    for (const n of e.elements)
      if (n.type === z.BRANCH) {
        if (Es(n.circuits))
          return !0;
      } else if (Object.values(Cs).some((r) => r === n.instructionType))
        return !0;
  return !1;
};
function Ds(t) {
  let e = -1;
  return t.elements.slice().reverse().some((n, r) => {
    if (n.type === z.BRANCH)
      return Es(n.circuits) ? !1 : (e = t.elements.length - r - 1, !0);
    if (!Object.values(Cs).some((o) => o === n.instructionType))
      return e = t.elements.length - r - 1, !0;
  }), e;
}
const Uc = () => typeof navigator < "u" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
function Pt(t, e) {
  return Uc() ? t : e;
}
const Mc = (t) => {
  const e = `${t.type.toLowerCase()}-${Ot()}`;
  return {
    ...t,
    id: e,
    circuits: t.circuits.map((n) => on(n))
  };
}, Zc = (t) => {
  const e = `${t.type.toLowerCase()}-${Ot()}`;
  return {
    ...t,
    id: e,
    errors: []
  };
}, on = (t) => {
  const e = `${t.type.toLowerCase()}-${Ot()}`;
  return {
    ...t,
    id: e,
    elements: t.elements.map((n) => n.type === z.BRANCH ? Mc(n) : Zc(n)),
    errors: []
  };
}, or = typeof window < "u" && typeof window.document < "u" && typeof window.document.createElement < "u";
function ln(t) {
  const e = Object.prototype.toString.call(t);
  return e === "[object Window]" || // In Electron context the Window object serializes to [object global]
  e === "[object global]";
}
function Fr(t) {
  return "nodeType" in t;
}
function et(t) {
  var e, n;
  return t ? ln(t) ? t : Fr(t) && (e = (n = t.ownerDocument) == null ? void 0 : n.defaultView) != null ? e : window : window;
}
function Vr(t) {
  const {
    Document: e
  } = et(t);
  return t instanceof e;
}
function On(t) {
  return ln(t) ? !1 : t instanceof et(t).HTMLElement;
}
function ks(t) {
  return t instanceof et(t).SVGElement;
}
function an(t) {
  return t ? ln(t) ? t.document : Fr(t) ? Vr(t) ? t : On(t) || ks(t) ? t.ownerDocument : document : document : document;
}
const Ct = or ? oc : ue;
function sr(t) {
  const e = le(t);
  return Ct(() => {
    e.current = t;
  }), Xe(function() {
    for (var n = arguments.length, r = new Array(n), o = 0; o < n; o++)
      r[o] = arguments[o];
    return e.current == null ? void 0 : e.current(...r);
  }, []);
}
function Bc() {
  const t = le(null), e = Xe((r, o) => {
    t.current = setInterval(r, o);
  }, []), n = Xe(() => {
    t.current !== null && (clearInterval(t.current), t.current = null);
  }, []);
  return [e, n];
}
function _n(t, e) {
  e === void 0 && (e = [t]);
  const n = le(t);
  return Ct(() => {
    n.current !== t && (n.current = t);
  }, e), n;
}
function En(t, e) {
  const n = le();
  return Ee(
    () => {
      const r = t(n.current);
      return n.current = r, r;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...e]
  );
}
function Vn(t) {
  const e = sr(t), n = le(null), r = Xe(
    (o) => {
      o !== n.current && e?.(o, n.current), n.current = o;
    },
    //eslint-disable-next-line
    []
  );
  return [n, r];
}
function Gn(t) {
  const e = le();
  return ue(() => {
    e.current = t;
  }, [t]), e.current;
}
let Sr = {};
function ir(t, e) {
  return Ee(() => {
    if (e)
      return e;
    const n = Sr[t] == null ? 0 : Sr[t] + 1;
    return Sr[t] = n, t + "-" + n;
  }, [t, e]);
}
function $s(t) {
  return function(e) {
    for (var n = arguments.length, r = new Array(n > 1 ? n - 1 : 0), o = 1; o < n; o++)
      r[o - 1] = arguments[o];
    return r.reduce((s, i) => {
      const c = Object.entries(i);
      for (const [l, a] of c) {
        const u = s[l];
        u != null && (s[l] = u + t * a);
      }
      return s;
    }, {
      ...e
    });
  };
}
const Qt = /* @__PURE__ */ $s(1), Hn = /* @__PURE__ */ $s(-1);
function jc(t) {
  return "clientX" in t && "clientY" in t;
}
function Gr(t) {
  if (!t)
    return !1;
  const {
    KeyboardEvent: e
  } = et(t.target);
  return e && t instanceof e;
}
function Fc(t) {
  if (!t)
    return !1;
  const {
    TouchEvent: e
  } = et(t.target);
  return e && t instanceof e;
}
function Jn(t) {
  if (Fc(t)) {
    if (t.touches && t.touches.length) {
      const {
        clientX: e,
        clientY: n
      } = t.touches[0];
      return {
        x: e,
        y: n
      };
    } else if (t.changedTouches && t.changedTouches.length) {
      const {
        clientX: e,
        clientY: n
      } = t.changedTouches[0];
      return {
        x: e,
        y: n
      };
    }
  }
  return jc(t) ? {
    x: t.clientX,
    y: t.clientY
  } : null;
}
const Sn = /* @__PURE__ */ Object.freeze({
  Translate: {
    toString(t) {
      if (!t)
        return;
      const {
        x: e,
        y: n
      } = t;
      return "translate3d(" + (e ? Math.round(e) : 0) + "px, " + (n ? Math.round(n) : 0) + "px, 0)";
    }
  },
  Scale: {
    toString(t) {
      if (!t)
        return;
      const {
        scaleX: e,
        scaleY: n
      } = t;
      return "scaleX(" + e + ") scaleY(" + n + ")";
    }
  },
  Transform: {
    toString(t) {
      if (t)
        return [Sn.Translate.toString(t), Sn.Scale.toString(t)].join(" ");
    }
  },
  Transition: {
    toString(t) {
      let {
        property: e,
        duration: n,
        easing: r
      } = t;
      return e + " " + n + "ms " + r;
    }
  }
}), wo = "a,frame,iframe,input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),*[tabindex]";
function Vc(t) {
  return t.matches(wo) ? t : t.querySelector(wo);
}
const Gc = {
  display: "none"
};
function Hc(t) {
  let {
    id: e,
    value: n
  } = t;
  return fe.createElement("div", {
    id: e,
    style: Gc
  }, n);
}
function Jc(t) {
  let {
    id: e,
    announcement: n,
    ariaLiveType: r = "assertive"
  } = t;
  const o = {
    position: "fixed",
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    margin: -1,
    border: 0,
    padding: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    clipPath: "inset(100%)",
    whiteSpace: "nowrap"
  };
  return fe.createElement("div", {
    id: e,
    style: o,
    role: "status",
    "aria-live": r,
    "aria-atomic": !0
  }, n);
}
function Kc() {
  const [t, e] = ye("");
  return {
    announce: Xe((r) => {
      r != null && e(r);
    }, []),
    announcement: t
  };
}
const zs = /* @__PURE__ */ Rt(null);
function Wc(t) {
  const e = bt(zs);
  ue(() => {
    if (!e)
      throw new Error("useDndMonitor must be used within a children of <DndContext>");
    return e(t);
  }, [t, e]);
}
function Xc() {
  const [t] = ye(() => /* @__PURE__ */ new Set()), e = Xe((r) => (t.add(r), () => t.delete(r)), [t]);
  return [Xe((r) => {
    let {
      type: o,
      event: s
    } = r;
    t.forEach((i) => {
      var c;
      return (c = i[o]) == null ? void 0 : c.call(i, s);
    });
  }, [t]), e];
}
const Yc = {
  draggable: `
    To pick up a draggable item, press the space bar.
    While dragging, use the arrow keys to move the item.
    Press space again to drop the item in its new position, or press escape to cancel.
  `
}, qc = {
  onDragStart(t) {
    let {
      active: e
    } = t;
    return "Picked up draggable item " + e.id + ".";
  },
  onDragOver(t) {
    let {
      active: e,
      over: n
    } = t;
    return n ? "Draggable item " + e.id + " was moved over droppable area " + n.id + "." : "Draggable item " + e.id + " is no longer over a droppable area.";
  },
  onDragEnd(t) {
    let {
      active: e,
      over: n
    } = t;
    return n ? "Draggable item " + e.id + " was dropped over droppable area " + n.id : "Draggable item " + e.id + " was dropped.";
  },
  onDragCancel(t) {
    let {
      active: e
    } = t;
    return "Dragging was cancelled. Draggable item " + e.id + " was dropped.";
  }
};
function Qc(t) {
  let {
    announcements: e = qc,
    container: n,
    hiddenTextDescribedById: r,
    screenReaderInstructions: o = Yc
  } = t;
  const {
    announce: s,
    announcement: i
  } = Kc(), c = ir("DndLiveRegion"), [l, a] = ye(!1);
  if (ue(() => {
    a(!0);
  }, []), Wc(Ee(() => ({
    onDragStart(d) {
      let {
        active: p
      } = d;
      s(e.onDragStart({
        active: p
      }));
    },
    onDragMove(d) {
      let {
        active: p,
        over: h
      } = d;
      e.onDragMove && s(e.onDragMove({
        active: p,
        over: h
      }));
    },
    onDragOver(d) {
      let {
        active: p,
        over: h
      } = d;
      s(e.onDragOver({
        active: p,
        over: h
      }));
    },
    onDragEnd(d) {
      let {
        active: p,
        over: h
      } = d;
      s(e.onDragEnd({
        active: p,
        over: h
      }));
    },
    onDragCancel(d) {
      let {
        active: p,
        over: h
      } = d;
      s(e.onDragCancel({
        active: p,
        over: h
      }));
    }
  }), [s, e])), !l)
    return null;
  const u = fe.createElement(fe.Fragment, null, fe.createElement(Hc, {
    id: r,
    value: o.draggable
  }), fe.createElement(Jc, {
    id: c,
    announcement: i
  }));
  return n ? nr(u, n) : u;
}
var Ae;
(function(t) {
  t.DragStart = "dragStart", t.DragMove = "dragMove", t.DragEnd = "dragEnd", t.DragCancel = "dragCancel", t.DragOver = "dragOver", t.RegisterDroppable = "registerDroppable", t.SetDroppableDisabled = "setDroppableDisabled", t.UnregisterDroppable = "unregisterDroppable";
})(Ae || (Ae = {}));
function Kn() {
}
function Io(t, e) {
  return Ee(
    () => ({
      sensor: t,
      options: e ?? {}
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, e]
  );
}
function el() {
  for (var t = arguments.length, e = new Array(t), n = 0; n < t; n++)
    e[n] = arguments[n];
  return Ee(
    () => [...e].filter((r) => r != null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...e]
  );
}
const wt = /* @__PURE__ */ Object.freeze({
  x: 0,
  y: 0
});
function tl(t, e) {
  return Math.sqrt(Math.pow(t.x - e.x, 2) + Math.pow(t.y - e.y, 2));
}
function nl(t, e) {
  const n = Jn(t);
  if (!n)
    return "0 0";
  const r = {
    x: (n.x - e.left) / e.width * 100,
    y: (n.y - e.top) / e.height * 100
  };
  return r.x + "% " + r.y + "%";
}
function rl(t, e) {
  let {
    data: {
      value: n
    }
  } = t, {
    data: {
      value: r
    }
  } = e;
  return n - r;
}
function ol(t, e) {
  let {
    data: {
      value: n
    }
  } = t, {
    data: {
      value: r
    }
  } = e;
  return r - n;
}
function sl(t) {
  let {
    left: e,
    top: n,
    height: r,
    width: o
  } = t;
  return [{
    x: e,
    y: n
  }, {
    x: e + o,
    y: n
  }, {
    x: e,
    y: n + r
  }, {
    x: e + o,
    y: n + r
  }];
}
function il(t, e) {
  if (!t || t.length === 0)
    return null;
  const [n] = t;
  return n[e];
}
function cl(t, e) {
  const n = Math.max(e.top, t.top), r = Math.max(e.left, t.left), o = Math.min(e.left + e.width, t.left + t.width), s = Math.min(e.top + e.height, t.top + t.height), i = o - r, c = s - n;
  if (r < o && n < s) {
    const l = e.width * e.height, a = t.width * t.height, u = i * c, d = u / (l + a - u);
    return Number(d.toFixed(4));
  }
  return 0;
}
const ll = (t) => {
  let {
    collisionRect: e,
    droppableRects: n,
    droppableContainers: r
  } = t;
  const o = [];
  for (const s of r) {
    const {
      id: i
    } = s, c = n.get(i);
    if (c) {
      const l = cl(c, e);
      l > 0 && o.push({
        id: i,
        data: {
          droppableContainer: s,
          value: l
        }
      });
    }
  }
  return o.sort(ol);
};
function al(t, e) {
  const {
    top: n,
    left: r,
    bottom: o,
    right: s
  } = e;
  return n <= t.y && t.y <= o && r <= t.x && t.x <= s;
}
const ul = (t) => {
  let {
    droppableContainers: e,
    droppableRects: n,
    pointerCoordinates: r
  } = t;
  if (!r)
    return [];
  const o = [];
  for (const s of e) {
    const {
      id: i
    } = s, c = n.get(i);
    if (c && al(r, c)) {
      const a = sl(c).reduce((d, p) => d + tl(r, p), 0), u = Number((a / 4).toFixed(4));
      o.push({
        id: i,
        data: {
          droppableContainer: s,
          value: u
        }
      });
    }
  }
  return o.sort(rl);
};
function dl(t, e, n) {
  return {
    ...t,
    scaleX: e && n ? e.width / n.width : 1,
    scaleY: e && n ? e.height / n.height : 1
  };
}
function As(t, e) {
  return t && e ? {
    x: t.left - e.left,
    y: t.top - e.top
  } : wt;
}
function fl(t) {
  return function(n) {
    for (var r = arguments.length, o = new Array(r > 1 ? r - 1 : 0), s = 1; s < r; s++)
      o[s - 1] = arguments[s];
    return o.reduce((i, c) => ({
      ...i,
      top: i.top + t * c.y,
      bottom: i.bottom + t * c.y,
      left: i.left + t * c.x,
      right: i.right + t * c.x
    }), {
      ...n
    });
  };
}
const pl = /* @__PURE__ */ fl(1);
function Ls(t) {
  if (t.startsWith("matrix3d(")) {
    const e = t.slice(9, -1).split(/, /);
    return {
      x: +e[12],
      y: +e[13],
      scaleX: +e[0],
      scaleY: +e[5]
    };
  } else if (t.startsWith("matrix(")) {
    const e = t.slice(7, -1).split(/, /);
    return {
      x: +e[4],
      y: +e[5],
      scaleX: +e[0],
      scaleY: +e[3]
    };
  }
  return null;
}
function hl(t, e, n) {
  const r = Ls(e);
  if (!r)
    return t;
  const {
    scaleX: o,
    scaleY: s,
    x: i,
    y: c
  } = r, l = t.left - i - (1 - o) * parseFloat(n), a = t.top - c - (1 - s) * parseFloat(n.slice(n.indexOf(" ") + 1)), u = o ? t.width / o : t.width, d = s ? t.height / s : t.height;
  return {
    width: u,
    height: d,
    top: a,
    right: l + u,
    bottom: a + d,
    left: l
  };
}
const ml = {
  ignoreTransform: !1
};
function Dn(t, e) {
  e === void 0 && (e = ml);
  let n = t.getBoundingClientRect();
  if (e.ignoreTransform) {
    const {
      transform: a,
      transformOrigin: u
    } = et(t).getComputedStyle(t);
    a && (n = hl(n, a, u));
  }
  const {
    top: r,
    left: o,
    width: s,
    height: i,
    bottom: c,
    right: l
  } = n;
  return {
    top: r,
    left: o,
    width: s,
    height: i,
    bottom: c,
    right: l
  };
}
function _o(t) {
  return Dn(t, {
    ignoreTransform: !0
  });
}
function gl(t) {
  const e = t.innerWidth, n = t.innerHeight;
  return {
    top: 0,
    left: 0,
    right: e,
    bottom: n,
    width: e,
    height: n
  };
}
function vl(t, e) {
  return e === void 0 && (e = et(t).getComputedStyle(t)), e.position === "fixed";
}
function yl(t, e) {
  e === void 0 && (e = et(t).getComputedStyle(t));
  const n = /(auto|scroll|overlay)/;
  return ["overflow", "overflowX", "overflowY"].some((o) => {
    const s = e[o];
    return typeof s == "string" ? n.test(s) : !1;
  });
}
function Hr(t, e) {
  const n = [];
  function r(o) {
    if (e != null && n.length >= e || !o)
      return n;
    if (Vr(o) && o.scrollingElement != null && !n.includes(o.scrollingElement))
      return n.push(o.scrollingElement), n;
    if (!On(o) || ks(o) || n.includes(o))
      return n;
    const s = et(t).getComputedStyle(o);
    return o !== t && yl(o, s) && n.push(o), vl(o, s) ? n : r(o.parentNode);
  }
  return t ? r(t) : n;
}
function Ps(t) {
  const [e] = Hr(t, 1);
  return e ?? null;
}
function xr(t) {
  return !or || !t ? null : ln(t) ? t : Fr(t) ? Vr(t) || t === an(t).scrollingElement ? window : On(t) ? t : null : null;
}
function Us(t) {
  return ln(t) ? t.scrollX : t.scrollLeft;
}
function Ms(t) {
  return ln(t) ? t.scrollY : t.scrollTop;
}
function Ar(t) {
  return {
    x: Us(t),
    y: Ms(t)
  };
}
var Ue;
(function(t) {
  t[t.Forward = 1] = "Forward", t[t.Backward = -1] = "Backward";
})(Ue || (Ue = {}));
function Zs(t) {
  return !or || !t ? !1 : t === document.scrollingElement;
}
function Bs(t) {
  const e = {
    x: 0,
    y: 0
  }, n = Zs(t) ? {
    height: window.innerHeight,
    width: window.innerWidth
  } : {
    height: t.clientHeight,
    width: t.clientWidth
  }, r = {
    x: t.scrollWidth - n.width,
    y: t.scrollHeight - n.height
  }, o = t.scrollTop <= e.y, s = t.scrollLeft <= e.x, i = t.scrollTop >= r.y, c = t.scrollLeft >= r.x;
  return {
    isTop: o,
    isLeft: s,
    isBottom: i,
    isRight: c,
    maxScroll: r,
    minScroll: e
  };
}
const bl = {
  x: 0.2,
  y: 0.2
};
function wl(t, e, n, r, o) {
  let {
    top: s,
    left: i,
    right: c,
    bottom: l
  } = n;
  r === void 0 && (r = 10), o === void 0 && (o = bl);
  const {
    isTop: a,
    isBottom: u,
    isLeft: d,
    isRight: p
  } = Bs(t), h = {
    x: 0,
    y: 0
  }, v = {
    x: 0,
    y: 0
  }, m = {
    height: e.height * o.y,
    width: e.width * o.x
  };
  return !a && s <= e.top + m.height ? (h.y = Ue.Backward, v.y = r * Math.abs((e.top + m.height - s) / m.height)) : !u && l >= e.bottom - m.height && (h.y = Ue.Forward, v.y = r * Math.abs((e.bottom - m.height - l) / m.height)), !p && c >= e.right - m.width ? (h.x = Ue.Forward, v.x = r * Math.abs((e.right - m.width - c) / m.width)) : !d && i <= e.left + m.width && (h.x = Ue.Backward, v.x = r * Math.abs((e.left + m.width - i) / m.width)), {
    direction: h,
    speed: v
  };
}
function Il(t) {
  if (t === document.scrollingElement) {
    const {
      innerWidth: s,
      innerHeight: i
    } = window;
    return {
      top: 0,
      left: 0,
      right: s,
      bottom: i,
      width: s,
      height: i
    };
  }
  const {
    top: e,
    left: n,
    right: r,
    bottom: o
  } = t.getBoundingClientRect();
  return {
    top: e,
    left: n,
    right: r,
    bottom: o,
    width: t.clientWidth,
    height: t.clientHeight
  };
}
function js(t) {
  return t.reduce((e, n) => Qt(e, Ar(n)), wt);
}
function _l(t) {
  return t.reduce((e, n) => e + Us(n), 0);
}
function Sl(t) {
  return t.reduce((e, n) => e + Ms(n), 0);
}
function Fs(t, e) {
  if (e === void 0 && (e = Dn), !t)
    return;
  const {
    top: n,
    left: r,
    bottom: o,
    right: s
  } = e(t);
  Ps(t) && (o <= 0 || s <= 0 || n >= window.innerHeight || r >= window.innerWidth) && t.scrollIntoView({
    block: "center",
    inline: "center"
  });
}
const xl = [["x", ["left", "right"], _l], ["y", ["top", "bottom"], Sl]];
class Jr {
  constructor(e, n) {
    this.rect = void 0, this.width = void 0, this.height = void 0, this.top = void 0, this.bottom = void 0, this.right = void 0, this.left = void 0;
    const r = Hr(n), o = js(r);
    this.rect = {
      ...e
    }, this.width = e.width, this.height = e.height;
    for (const [s, i, c] of xl)
      for (const l of i)
        Object.defineProperty(this, l, {
          get: () => {
            const a = c(r), u = o[s] - a;
            return this.rect[l] + u;
          },
          enumerable: !0
        });
    Object.defineProperty(this, "rect", {
      enumerable: !1
    });
  }
}
class gn {
  constructor(e) {
    this.target = void 0, this.listeners = [], this.removeAll = () => {
      this.listeners.forEach((n) => {
        var r;
        return (r = this.target) == null ? void 0 : r.removeEventListener(...n);
      });
    }, this.target = e;
  }
  add(e, n, r) {
    var o;
    (o = this.target) == null || o.addEventListener(e, n, r), this.listeners.push([e, n, r]);
  }
}
function Tl(t) {
  const {
    EventTarget: e
  } = et(t);
  return t instanceof e ? t : an(t);
}
function Tr(t, e) {
  const n = Math.abs(t.x), r = Math.abs(t.y);
  return typeof e == "number" ? Math.sqrt(n ** 2 + r ** 2) > e : "x" in e && "y" in e ? n > e.x && r > e.y : "x" in e ? n > e.x : "y" in e ? r > e.y : !1;
}
var at;
(function(t) {
  t.Click = "click", t.DragStart = "dragstart", t.Keydown = "keydown", t.ContextMenu = "contextmenu", t.Resize = "resize", t.SelectionChange = "selectionchange", t.VisibilityChange = "visibilitychange";
})(at || (at = {}));
function So(t) {
  t.preventDefault();
}
function Nl(t) {
  t.stopPropagation();
}
var ve;
(function(t) {
  t.Space = "Space", t.Down = "ArrowDown", t.Right = "ArrowRight", t.Left = "ArrowLeft", t.Up = "ArrowUp", t.Esc = "Escape", t.Enter = "Enter", t.Tab = "Tab";
})(ve || (ve = {}));
const Vs = {
  start: [ve.Space, ve.Enter],
  cancel: [ve.Esc],
  end: [ve.Space, ve.Enter, ve.Tab]
}, Cl = (t, e) => {
  let {
    currentCoordinates: n
  } = e;
  switch (t.code) {
    case ve.Right:
      return {
        ...n,
        x: n.x + 25
      };
    case ve.Left:
      return {
        ...n,
        x: n.x - 25
      };
    case ve.Down:
      return {
        ...n,
        y: n.y + 25
      };
    case ve.Up:
      return {
        ...n,
        y: n.y - 25
      };
  }
};
class Gs {
  constructor(e) {
    this.props = void 0, this.autoScrollEnabled = !1, this.referenceCoordinates = void 0, this.listeners = void 0, this.windowListeners = void 0, this.props = e;
    const {
      event: {
        target: n
      }
    } = e;
    this.props = e, this.listeners = new gn(an(n)), this.windowListeners = new gn(et(n)), this.handleKeyDown = this.handleKeyDown.bind(this), this.handleCancel = this.handleCancel.bind(this), this.attach();
  }
  attach() {
    this.handleStart(), this.windowListeners.add(at.Resize, this.handleCancel), this.windowListeners.add(at.VisibilityChange, this.handleCancel), setTimeout(() => this.listeners.add(at.Keydown, this.handleKeyDown));
  }
  handleStart() {
    const {
      activeNode: e,
      onStart: n
    } = this.props, r = e.node.current;
    r && Fs(r), n(wt);
  }
  handleKeyDown(e) {
    if (Gr(e)) {
      const {
        active: n,
        context: r,
        options: o
      } = this.props, {
        keyboardCodes: s = Vs,
        coordinateGetter: i = Cl,
        scrollBehavior: c = "smooth"
      } = o, {
        code: l
      } = e;
      if (s.end.includes(l)) {
        this.handleEnd(e);
        return;
      }
      if (s.cancel.includes(l)) {
        this.handleCancel(e);
        return;
      }
      const {
        collisionRect: a
      } = r.current, u = a ? {
        x: a.left,
        y: a.top
      } : wt;
      this.referenceCoordinates || (this.referenceCoordinates = u);
      const d = i(e, {
        active: n,
        context: r.current,
        currentCoordinates: u
      });
      if (d) {
        const p = Hn(d, u), h = {
          x: 0,
          y: 0
        }, {
          scrollableAncestors: v
        } = r.current;
        for (const m of v) {
          const g = e.code, {
            isTop: I,
            isRight: T,
            isLeft: b,
            isBottom: x,
            maxScroll: S,
            minScroll: C
          } = Bs(m), O = Il(m), N = {
            x: Math.min(g === ve.Right ? O.right - O.width / 2 : O.right, Math.max(g === ve.Right ? O.left : O.left + O.width / 2, d.x)),
            y: Math.min(g === ve.Down ? O.bottom - O.height / 2 : O.bottom, Math.max(g === ve.Down ? O.top : O.top + O.height / 2, d.y))
          }, E = g === ve.Right && !T || g === ve.Left && !b, _ = g === ve.Down && !x || g === ve.Up && !I;
          if (E && N.x !== d.x) {
            const w = m.scrollLeft + p.x, y = g === ve.Right && w <= S.x || g === ve.Left && w >= C.x;
            if (y && !p.y) {
              m.scrollTo({
                left: w,
                behavior: c
              });
              return;
            }
            y ? h.x = m.scrollLeft - w : h.x = g === ve.Right ? m.scrollLeft - S.x : m.scrollLeft - C.x, h.x && m.scrollBy({
              left: -h.x,
              behavior: c
            });
            break;
          } else if (_ && N.y !== d.y) {
            const w = m.scrollTop + p.y, y = g === ve.Down && w <= S.y || g === ve.Up && w >= C.y;
            if (y && !p.x) {
              m.scrollTo({
                top: w,
                behavior: c
              });
              return;
            }
            y ? h.y = m.scrollTop - w : h.y = g === ve.Down ? m.scrollTop - S.y : m.scrollTop - C.y, h.y && m.scrollBy({
              top: -h.y,
              behavior: c
            });
            break;
          }
        }
        this.handleMove(e, Qt(Hn(d, this.referenceCoordinates), h));
      }
    }
  }
  handleMove(e, n) {
    const {
      onMove: r
    } = this.props;
    e.preventDefault(), r(n);
  }
  handleEnd(e) {
    const {
      onEnd: n
    } = this.props;
    e.preventDefault(), this.detach(), n();
  }
  handleCancel(e) {
    const {
      onCancel: n
    } = this.props;
    e.preventDefault(), this.detach(), n();
  }
  detach() {
    this.listeners.removeAll(), this.windowListeners.removeAll();
  }
}
Gs.activators = [{
  eventName: "onKeyDown",
  handler: (t, e, n) => {
    let {
      keyboardCodes: r = Vs,
      onActivation: o
    } = e, {
      active: s
    } = n;
    const {
      code: i
    } = t.nativeEvent;
    if (r.start.includes(i)) {
      const c = s.activatorNode.current;
      return c && t.target !== c ? !1 : (t.preventDefault(), o?.({
        event: t.nativeEvent
      }), !0);
    }
    return !1;
  }
}];
function xo(t) {
  return !!(t && "distance" in t);
}
function To(t) {
  return !!(t && "delay" in t);
}
class Kr {
  constructor(e, n, r) {
    var o;
    r === void 0 && (r = Tl(e.event.target)), this.props = void 0, this.events = void 0, this.autoScrollEnabled = !0, this.document = void 0, this.activated = !1, this.initialCoordinates = void 0, this.timeoutId = null, this.listeners = void 0, this.documentListeners = void 0, this.windowListeners = void 0, this.props = e, this.events = n;
    const {
      event: s
    } = e, {
      target: i
    } = s;
    this.props = e, this.events = n, this.document = an(i), this.documentListeners = new gn(this.document), this.listeners = new gn(r), this.windowListeners = new gn(et(i)), this.initialCoordinates = (o = Jn(s)) != null ? o : wt, this.handleStart = this.handleStart.bind(this), this.handleMove = this.handleMove.bind(this), this.handleEnd = this.handleEnd.bind(this), this.handleCancel = this.handleCancel.bind(this), this.handleKeydown = this.handleKeydown.bind(this), this.removeTextSelection = this.removeTextSelection.bind(this), this.attach();
  }
  attach() {
    const {
      events: e,
      props: {
        options: {
          activationConstraint: n,
          bypassActivationConstraint: r
        }
      }
    } = this;
    if (this.listeners.add(e.move.name, this.handleMove, {
      passive: !1
    }), this.listeners.add(e.end.name, this.handleEnd), e.cancel && this.listeners.add(e.cancel.name, this.handleCancel), this.windowListeners.add(at.Resize, this.handleCancel), this.windowListeners.add(at.DragStart, So), this.windowListeners.add(at.VisibilityChange, this.handleCancel), this.windowListeners.add(at.ContextMenu, So), this.documentListeners.add(at.Keydown, this.handleKeydown), n) {
      if (r != null && r({
        event: this.props.event,
        activeNode: this.props.activeNode,
        options: this.props.options
      }))
        return this.handleStart();
      if (To(n)) {
        this.timeoutId = setTimeout(this.handleStart, n.delay), this.handlePending(n);
        return;
      }
      if (xo(n)) {
        this.handlePending(n);
        return;
      }
    }
    this.handleStart();
  }
  detach() {
    this.listeners.removeAll(), this.windowListeners.removeAll(), setTimeout(this.documentListeners.removeAll, 50), this.timeoutId !== null && (clearTimeout(this.timeoutId), this.timeoutId = null);
  }
  handlePending(e, n) {
    const {
      active: r,
      onPending: o
    } = this.props;
    o(r, e, this.initialCoordinates, n);
  }
  handleStart() {
    const {
      initialCoordinates: e
    } = this, {
      onStart: n
    } = this.props;
    e && (this.activated = !0, this.documentListeners.add(at.Click, Nl, {
      capture: !0
    }), this.removeTextSelection(), this.documentListeners.add(at.SelectionChange, this.removeTextSelection), n(e));
  }
  handleMove(e) {
    var n;
    const {
      activated: r,
      initialCoordinates: o,
      props: s
    } = this, {
      onMove: i,
      options: {
        activationConstraint: c
      }
    } = s;
    if (!o)
      return;
    const l = (n = Jn(e)) != null ? n : wt, a = Hn(o, l);
    if (!r && c) {
      if (xo(c)) {
        if (c.tolerance != null && Tr(a, c.tolerance))
          return this.handleCancel();
        if (Tr(a, c.distance))
          return this.handleStart();
      }
      if (To(c) && Tr(a, c.tolerance))
        return this.handleCancel();
      this.handlePending(c, a);
      return;
    }
    e.cancelable && e.preventDefault(), i(l);
  }
  handleEnd() {
    const {
      onAbort: e,
      onEnd: n
    } = this.props;
    this.detach(), this.activated || e(this.props.active), n();
  }
  handleCancel() {
    const {
      onAbort: e,
      onCancel: n
    } = this.props;
    this.detach(), this.activated || e(this.props.active), n();
  }
  handleKeydown(e) {
    e.code === ve.Esc && this.handleCancel();
  }
  removeTextSelection() {
    var e;
    (e = this.document.getSelection()) == null || e.removeAllRanges();
  }
}
const Rl = {
  cancel: {
    name: "pointercancel"
  },
  move: {
    name: "pointermove"
  },
  end: {
    name: "pointerup"
  }
};
class Hs extends Kr {
  constructor(e) {
    const {
      event: n
    } = e, r = an(n.target);
    super(e, Rl, r);
  }
}
Hs.activators = [{
  eventName: "onPointerDown",
  handler: (t, e) => {
    let {
      nativeEvent: n
    } = t, {
      onActivation: r
    } = e;
    return !n.isPrimary || n.button !== 0 ? !1 : (r?.({
      event: n
    }), !0);
  }
}];
const Ol = {
  move: {
    name: "mousemove"
  },
  end: {
    name: "mouseup"
  }
};
var Lr;
(function(t) {
  t[t.RightClick = 2] = "RightClick";
})(Lr || (Lr = {}));
class Js extends Kr {
  constructor(e) {
    super(e, Ol, an(e.event.target));
  }
}
Js.activators = [{
  eventName: "onMouseDown",
  handler: (t, e) => {
    let {
      nativeEvent: n
    } = t, {
      onActivation: r
    } = e;
    return n.button === Lr.RightClick ? !1 : (r?.({
      event: n
    }), !0);
  }
}];
const Nr = {
  cancel: {
    name: "touchcancel"
  },
  move: {
    name: "touchmove"
  },
  end: {
    name: "touchend"
  }
};
class Ks extends Kr {
  constructor(e) {
    super(e, Nr);
  }
  static setup() {
    return window.addEventListener(Nr.move.name, e, {
      capture: !1,
      passive: !1
    }), function() {
      window.removeEventListener(Nr.move.name, e);
    };
    function e() {
    }
  }
}
Ks.activators = [{
  eventName: "onTouchStart",
  handler: (t, e) => {
    let {
      nativeEvent: n
    } = t, {
      onActivation: r
    } = e;
    const {
      touches: o
    } = n;
    return o.length > 1 ? !1 : (r?.({
      event: n
    }), !0);
  }
}];
var vn;
(function(t) {
  t[t.Pointer = 0] = "Pointer", t[t.DraggableRect = 1] = "DraggableRect";
})(vn || (vn = {}));
var Wn;
(function(t) {
  t[t.TreeOrder = 0] = "TreeOrder", t[t.ReversedTreeOrder = 1] = "ReversedTreeOrder";
})(Wn || (Wn = {}));
function El(t) {
  let {
    acceleration: e,
    activator: n = vn.Pointer,
    canScroll: r,
    draggingRect: o,
    enabled: s,
    interval: i = 5,
    order: c = Wn.TreeOrder,
    pointerCoordinates: l,
    scrollableAncestors: a,
    scrollableAncestorRects: u,
    delta: d,
    threshold: p
  } = t;
  const h = kl({
    delta: d,
    disabled: !s
  }), [v, m] = Bc(), g = le({
    x: 0,
    y: 0
  }), I = le({
    x: 0,
    y: 0
  }), T = Ee(() => {
    switch (n) {
      case vn.Pointer:
        return l ? {
          top: l.y,
          bottom: l.y,
          left: l.x,
          right: l.x
        } : null;
      case vn.DraggableRect:
        return o;
    }
  }, [n, o, l]), b = le(null), x = Xe(() => {
    const C = b.current;
    if (!C)
      return;
    const O = g.current.x * I.current.x, N = g.current.y * I.current.y;
    C.scrollBy(O, N);
  }, []), S = Ee(() => c === Wn.TreeOrder ? [...a].reverse() : a, [c, a]);
  ue(
    () => {
      if (!s || !a.length || !T) {
        m();
        return;
      }
      for (const C of S) {
        if (r?.(C) === !1)
          continue;
        const O = a.indexOf(C), N = u[O];
        if (!N)
          continue;
        const {
          direction: E,
          speed: _
        } = wl(C, N, T, e, p);
        for (const w of ["x", "y"])
          h[w][E[w]] || (_[w] = 0, E[w] = 0);
        if (_.x > 0 || _.y > 0) {
          m(), b.current = C, v(x, i), g.current = _, I.current = E;
          return;
        }
      }
      g.current = {
        x: 0,
        y: 0
      }, I.current = {
        x: 0,
        y: 0
      }, m();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      e,
      x,
      r,
      m,
      s,
      i,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(T),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(h),
      v,
      a,
      S,
      u,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(p)
    ]
  );
}
const Dl = {
  x: {
    [Ue.Backward]: !1,
    [Ue.Forward]: !1
  },
  y: {
    [Ue.Backward]: !1,
    [Ue.Forward]: !1
  }
};
function kl(t) {
  let {
    delta: e,
    disabled: n
  } = t;
  const r = Gn(e);
  return En((o) => {
    if (n || !r || !o)
      return Dl;
    const s = {
      x: Math.sign(e.x - r.x),
      y: Math.sign(e.y - r.y)
    };
    return {
      x: {
        [Ue.Backward]: o.x[Ue.Backward] || s.x === -1,
        [Ue.Forward]: o.x[Ue.Forward] || s.x === 1
      },
      y: {
        [Ue.Backward]: o.y[Ue.Backward] || s.y === -1,
        [Ue.Forward]: o.y[Ue.Forward] || s.y === 1
      }
    };
  }, [n, e, r]);
}
function $l(t, e) {
  const n = e != null ? t.get(e) : void 0, r = n ? n.node.current : null;
  return En((o) => {
    var s;
    return e == null ? null : (s = r ?? o) != null ? s : null;
  }, [r, e]);
}
function zl(t, e) {
  return Ee(() => t.reduce((n, r) => {
    const {
      sensor: o
    } = r, s = o.activators.map((i) => ({
      eventName: i.eventName,
      handler: e(i.handler, r)
    }));
    return [...n, ...s];
  }, []), [t, e]);
}
var xn;
(function(t) {
  t[t.Always = 0] = "Always", t[t.BeforeDragging = 1] = "BeforeDragging", t[t.WhileDragging = 2] = "WhileDragging";
})(xn || (xn = {}));
var Pr;
(function(t) {
  t.Optimized = "optimized";
})(Pr || (Pr = {}));
const No = /* @__PURE__ */ new Map();
function Al(t, e) {
  let {
    dragging: n,
    dependencies: r,
    config: o
  } = e;
  const [s, i] = ye(null), {
    frequency: c,
    measure: l,
    strategy: a
  } = o, u = le(t), d = g(), p = _n(d), h = Xe(function(I) {
    I === void 0 && (I = []), !p.current && i((T) => T === null ? I : T.concat(I.filter((b) => !T.includes(b))));
  }, [p]), v = le(null), m = En((I) => {
    if (d && !n)
      return No;
    if (!I || I === No || u.current !== t || s != null) {
      const T = /* @__PURE__ */ new Map();
      for (let b of t) {
        if (!b)
          continue;
        if (s && s.length > 0 && !s.includes(b.id) && b.rect.current) {
          T.set(b.id, b.rect.current);
          continue;
        }
        const x = b.node.current, S = x ? new Jr(l(x), x) : null;
        b.rect.current = S, S && T.set(b.id, S);
      }
      return T;
    }
    return I;
  }, [t, s, n, d, l]);
  return ue(() => {
    u.current = t;
  }, [t]), ue(
    () => {
      d || h();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n, d]
  ), ue(
    () => {
      s && s.length > 0 && i(null);
    },
    //eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(s)]
  ), ue(
    () => {
      d || typeof c != "number" || v.current !== null || (v.current = setTimeout(() => {
        h(), v.current = null;
      }, c));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c, d, h, ...r]
  ), {
    droppableRects: m,
    measureDroppableContainers: h,
    measuringScheduled: s != null
  };
  function g() {
    switch (a) {
      case xn.Always:
        return !1;
      case xn.BeforeDragging:
        return n;
      default:
        return !n;
    }
  }
}
function Wr(t, e) {
  return En((n) => t ? n || (typeof e == "function" ? e(t) : t) : null, [e, t]);
}
function Ll(t, e) {
  return Wr(t, e);
}
function Pl(t) {
  let {
    callback: e,
    disabled: n
  } = t;
  const r = sr(e), o = Ee(() => {
    if (n || typeof window > "u" || typeof window.MutationObserver > "u")
      return;
    const {
      MutationObserver: s
    } = window;
    return new s(r);
  }, [r, n]);
  return ue(() => () => o?.disconnect(), [o]), o;
}
function cr(t) {
  let {
    callback: e,
    disabled: n
  } = t;
  const r = sr(e), o = Ee(
    () => {
      if (n || typeof window > "u" || typeof window.ResizeObserver > "u")
        return;
      const {
        ResizeObserver: s
      } = window;
      return new s(r);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n]
  );
  return ue(() => () => o?.disconnect(), [o]), o;
}
function Ul(t) {
  return new Jr(Dn(t), t);
}
function Co(t, e, n) {
  e === void 0 && (e = Ul);
  const [r, o] = ye(null);
  function s() {
    o((l) => {
      if (!t)
        return null;
      if (t.isConnected === !1) {
        var a;
        return (a = l ?? n) != null ? a : null;
      }
      const u = e(t);
      return JSON.stringify(l) === JSON.stringify(u) ? l : u;
    });
  }
  const i = Pl({
    callback(l) {
      if (t)
        for (const a of l) {
          const {
            type: u,
            target: d
          } = a;
          if (u === "childList" && d instanceof HTMLElement && d.contains(t)) {
            s();
            break;
          }
        }
    }
  }), c = cr({
    callback: s
  });
  return Ct(() => {
    s(), t ? (c?.observe(t), i?.observe(document.body, {
      childList: !0,
      subtree: !0
    })) : (c?.disconnect(), i?.disconnect());
  }, [t]), r;
}
function Ml(t) {
  const e = Wr(t);
  return As(t, e);
}
const Ro = [];
function Zl(t) {
  const e = le(t), n = En((r) => t ? r && r !== Ro && t && e.current && t.parentNode === e.current.parentNode ? r : Hr(t) : Ro, [t]);
  return ue(() => {
    e.current = t;
  }, [t]), n;
}
function Bl(t) {
  const [e, n] = ye(null), r = le(t), o = Xe((s) => {
    const i = xr(s.target);
    i && n((c) => c ? (c.set(i, Ar(i)), new Map(c)) : null);
  }, []);
  return ue(() => {
    const s = r.current;
    if (t !== s) {
      i(s);
      const c = t.map((l) => {
        const a = xr(l);
        return a ? (a.addEventListener("scroll", o, {
          passive: !0
        }), [a, Ar(a)]) : null;
      }).filter((l) => l != null);
      n(c.length ? new Map(c) : null), r.current = t;
    }
    return () => {
      i(t), i(s);
    };
    function i(c) {
      c.forEach((l) => {
        const a = xr(l);
        a?.removeEventListener("scroll", o);
      });
    }
  }, [o, t]), Ee(() => t.length ? e ? Array.from(e.values()).reduce((s, i) => Qt(s, i), wt) : js(t) : wt, [t, e]);
}
function Oo(t, e) {
  e === void 0 && (e = []);
  const n = le(null);
  return ue(
    () => {
      n.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    e
  ), ue(() => {
    const r = t !== wt;
    r && !n.current && (n.current = t), !r && n.current && (n.current = null);
  }, [t]), n.current ? Hn(t, n.current) : wt;
}
function jl(t) {
  ue(
    () => {
      if (!or)
        return;
      const e = t.map((n) => {
        let {
          sensor: r
        } = n;
        return r.setup == null ? void 0 : r.setup();
      });
      return () => {
        for (const n of e)
          n?.();
      };
    },
    // TO-DO: Sensors length could theoretically change which would not be a valid dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    t.map((e) => {
      let {
        sensor: n
      } = e;
      return n;
    })
  );
}
function Fl(t, e) {
  return Ee(() => t.reduce((n, r) => {
    let {
      eventName: o,
      handler: s
    } = r;
    return n[o] = (i) => {
      s(i, e);
    }, n;
  }, {}), [t, e]);
}
function Ws(t) {
  return Ee(() => t ? gl(t) : null, [t]);
}
const Eo = [];
function Vl(t, e) {
  e === void 0 && (e = Dn);
  const [n] = t, r = Ws(n ? et(n) : null), [o, s] = ye(Eo);
  function i() {
    s(() => t.length ? t.map((l) => Zs(l) ? r : new Jr(e(l), l)) : Eo);
  }
  const c = cr({
    callback: i
  });
  return Ct(() => {
    c?.disconnect(), i(), t.forEach((l) => c?.observe(l));
  }, [t]), o;
}
function Xs(t) {
  if (!t)
    return null;
  if (t.children.length > 1)
    return t;
  const e = t.children[0];
  return On(e) ? e : t;
}
function Gl(t) {
  let {
    measure: e
  } = t;
  const [n, r] = ye(null), o = Xe((a) => {
    for (const {
      target: u
    } of a)
      if (On(u)) {
        r((d) => {
          const p = e(u);
          return d ? {
            ...d,
            width: p.width,
            height: p.height
          } : p;
        });
        break;
      }
  }, [e]), s = cr({
    callback: o
  }), i = Xe((a) => {
    const u = Xs(a);
    s?.disconnect(), u && s?.observe(u), r(u ? e(u) : null);
  }, [e, s]), [c, l] = Vn(i);
  return Ee(() => ({
    nodeRef: c,
    rect: n,
    setRef: l
  }), [n, c, l]);
}
const Hl = [{
  sensor: Hs,
  options: {}
}, {
  sensor: Gs,
  options: {}
}], Jl = {
  current: {}
}, Mn = {
  draggable: {
    measure: _o
  },
  droppable: {
    measure: _o,
    strategy: xn.WhileDragging,
    frequency: Pr.Optimized
  },
  dragOverlay: {
    measure: Dn
  }
};
class yn extends Map {
  get(e) {
    var n;
    return e != null && (n = super.get(e)) != null ? n : void 0;
  }
  toArray() {
    return Array.from(this.values());
  }
  getEnabled() {
    return this.toArray().filter((e) => {
      let {
        disabled: n
      } = e;
      return !n;
    });
  }
  getNodeFor(e) {
    var n, r;
    return (n = (r = this.get(e)) == null ? void 0 : r.node.current) != null ? n : void 0;
  }
}
const Kl = {
  activatorEvent: null,
  active: null,
  activeNode: null,
  activeNodeRect: null,
  collisions: null,
  containerNodeRect: null,
  draggableNodes: /* @__PURE__ */ new Map(),
  droppableRects: /* @__PURE__ */ new Map(),
  droppableContainers: /* @__PURE__ */ new yn(),
  over: null,
  dragOverlay: {
    nodeRef: {
      current: null
    },
    rect: null,
    setRef: Kn
  },
  scrollableAncestors: [],
  scrollableAncestorRects: [],
  measuringConfiguration: Mn,
  measureDroppableContainers: Kn,
  windowRect: null,
  measuringScheduled: !1
}, Ys = {
  activatorEvent: null,
  activators: [],
  active: null,
  activeNodeRect: null,
  ariaDescribedById: {
    draggable: ""
  },
  dispatch: Kn,
  draggableNodes: /* @__PURE__ */ new Map(),
  over: null,
  measureDroppableContainers: Kn
}, kn = /* @__PURE__ */ Rt(Ys), qs = /* @__PURE__ */ Rt(Kl);
function Wl() {
  return {
    draggable: {
      active: null,
      initialCoordinates: {
        x: 0,
        y: 0
      },
      nodes: /* @__PURE__ */ new Map(),
      translate: {
        x: 0,
        y: 0
      }
    },
    droppable: {
      containers: new yn()
    }
  };
}
function Xl(t, e) {
  switch (e.type) {
    case Ae.DragStart:
      return {
        ...t,
        draggable: {
          ...t.draggable,
          initialCoordinates: e.initialCoordinates,
          active: e.active
        }
      };
    case Ae.DragMove:
      return t.draggable.active == null ? t : {
        ...t,
        draggable: {
          ...t.draggable,
          translate: {
            x: e.coordinates.x - t.draggable.initialCoordinates.x,
            y: e.coordinates.y - t.draggable.initialCoordinates.y
          }
        }
      };
    case Ae.DragEnd:
    case Ae.DragCancel:
      return {
        ...t,
        draggable: {
          ...t.draggable,
          active: null,
          initialCoordinates: {
            x: 0,
            y: 0
          },
          translate: {
            x: 0,
            y: 0
          }
        }
      };
    case Ae.RegisterDroppable: {
      const {
        element: n
      } = e, {
        id: r
      } = n, o = new yn(t.droppable.containers);
      return o.set(r, n), {
        ...t,
        droppable: {
          ...t.droppable,
          containers: o
        }
      };
    }
    case Ae.SetDroppableDisabled: {
      const {
        id: n,
        key: r,
        disabled: o
      } = e, s = t.droppable.containers.get(n);
      if (!s || r !== s.key)
        return t;
      const i = new yn(t.droppable.containers);
      return i.set(n, {
        ...s,
        disabled: o
      }), {
        ...t,
        droppable: {
          ...t.droppable,
          containers: i
        }
      };
    }
    case Ae.UnregisterDroppable: {
      const {
        id: n,
        key: r
      } = e, o = t.droppable.containers.get(n);
      if (!o || r !== o.key)
        return t;
      const s = new yn(t.droppable.containers);
      return s.delete(n), {
        ...t,
        droppable: {
          ...t.droppable,
          containers: s
        }
      };
    }
    default:
      return t;
  }
}
function Yl(t) {
  let {
    disabled: e
  } = t;
  const {
    active: n,
    activatorEvent: r,
    draggableNodes: o
  } = bt(kn), s = Gn(r), i = Gn(n?.id);
  return ue(() => {
    if (!e && !r && s && i != null) {
      if (!Gr(s) || document.activeElement === s.target)
        return;
      const c = o.get(i);
      if (!c)
        return;
      const {
        activatorNode: l,
        node: a
      } = c;
      if (!l.current && !a.current)
        return;
      requestAnimationFrame(() => {
        for (const u of [l.current, a.current]) {
          if (!u)
            continue;
          const d = Vc(u);
          if (d) {
            d.focus();
            break;
          }
        }
      });
    }
  }, [r, e, o, i, s]), null;
}
function Qs(t, e) {
  let {
    transform: n,
    ...r
  } = e;
  return t != null && t.length ? t.reduce((o, s) => s({
    transform: o,
    ...r
  }), n) : n;
}
function ql(t) {
  return Ee(
    () => ({
      draggable: {
        ...Mn.draggable,
        ...t?.draggable
      },
      droppable: {
        ...Mn.droppable,
        ...t?.droppable
      },
      dragOverlay: {
        ...Mn.dragOverlay,
        ...t?.dragOverlay
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t?.draggable, t?.droppable, t?.dragOverlay]
  );
}
function Ql(t) {
  let {
    activeNode: e,
    measure: n,
    initialRect: r,
    config: o = !0
  } = t;
  const s = le(!1), {
    x: i,
    y: c
  } = typeof o == "boolean" ? {
    x: o,
    y: o
  } : o;
  Ct(() => {
    if (!i && !c || !e) {
      s.current = !1;
      return;
    }
    if (s.current || !r)
      return;
    const a = e?.node.current;
    if (!a || a.isConnected === !1)
      return;
    const u = n(a), d = As(u, r);
    if (i || (d.x = 0), c || (d.y = 0), s.current = !0, Math.abs(d.x) > 0 || Math.abs(d.y) > 0) {
      const p = Ps(a);
      p && p.scrollBy({
        top: d.y,
        left: d.x
      });
    }
  }, [e, i, c, r, n]);
}
const lr = /* @__PURE__ */ Rt({
  ...wt,
  scaleX: 1,
  scaleY: 1
});
var Lt;
(function(t) {
  t[t.Uninitialized = 0] = "Uninitialized", t[t.Initializing = 1] = "Initializing", t[t.Initialized = 2] = "Initialized";
})(Lt || (Lt = {}));
const ea = /* @__PURE__ */ sc(function(e) {
  var n, r, o, s;
  let {
    id: i,
    accessibility: c,
    autoScroll: l = !0,
    children: a,
    sensors: u = Hl,
    collisionDetection: d = ll,
    measuring: p,
    modifiers: h,
    ...v
  } = e;
  const m = fs(Xl, void 0, Wl), [g, I] = m, [T, b] = Xc(), [x, S] = ye(Lt.Uninitialized), C = x === Lt.Initialized, {
    draggable: {
      active: O,
      nodes: N,
      translate: E
    },
    droppable: {
      containers: _
    }
  } = g, w = O != null ? N.get(O) : null, y = le({
    initial: null,
    translated: null
  }), R = Ee(() => {
    var Ne;
    return O != null ? {
      id: O,
      // It's possible for the active node to unmount while dragging
      data: (Ne = w?.data) != null ? Ne : Jl,
      rect: y
    } : null;
  }, [O, w]), k = le(null), [A, P] = ye(null), [$, X] = ye(null), L = _n(v, Object.values(v)), B = ir("DndDescribedBy", i), U = Ee(() => _.getEnabled(), [_]), H = ql(p), {
    droppableRects: K,
    measureDroppableContainers: Z,
    measuringScheduled: j
  } = Al(U, {
    dragging: C,
    dependencies: [E.x, E.y],
    config: H.droppable
  }), M = $l(N, O), G = Ee(() => $ ? Jn($) : null, [$]), q = zt(), Y = Ll(M, H.draggable.measure);
  Ql({
    activeNode: O != null ? N.get(O) : null,
    config: q.layoutShiftCompensation,
    initialRect: Y,
    measure: H.draggable.measure
  });
  const W = Co(M, H.draggable.measure, Y), ae = Co(M ? M.parentElement : null), ie = le({
    activatorEvent: null,
    active: null,
    activeNode: M,
    collisionRect: null,
    collisions: null,
    droppableRects: K,
    draggableNodes: N,
    draggingNode: null,
    draggingNodeRect: null,
    droppableContainers: _,
    over: null,
    scrollableAncestors: [],
    scrollAdjustedTranslate: null
  }), Ie = _.getNodeFor((n = ie.current.over) == null ? void 0 : n.id), se = Gl({
    measure: H.dragOverlay.measure
  }), Oe = (r = se.nodeRef.current) != null ? r : M, Ge = C ? (o = se.rect) != null ? o : W : null, ft = !!(se.nodeRef.current && se.rect), Et = Ml(ft ? null : W), Ye = Ws(Oe ? et(Oe) : null), Me = Zl(C ? Ie ?? M : null), He = Vl(Me), Je = Qs(h, {
    transform: {
      x: E.x - Et.x,
      y: E.y - Et.y,
      scaleX: 1,
      scaleY: 1
    },
    activatorEvent: $,
    active: R,
    activeNodeRect: W,
    containerNodeRect: ae,
    draggingNodeRect: Ge,
    over: ie.current.over,
    overlayNodeRect: se.rect,
    scrollableAncestors: Me,
    scrollableAncestorRects: He,
    windowRect: Ye
  }), pt = G ? Qt(G, E) : null, ee = Bl(Me), de = Oo(ee), ne = Oo(ee, [W]), oe = Qt(Je, de), ce = Ge ? pl(Ge, Je) : null, Le = R && ce ? d({
    active: R,
    collisionRect: ce,
    droppableRects: K,
    droppableContainers: U,
    pointerCoordinates: pt
  }) : null, tt = il(Le, "id"), [$e, ht] = ye(null), mt = ft ? Je : Qt(Je, ne), It = dl(mt, (s = $e?.rect) != null ? s : null, W), Ke = le(null), gt = Xe(
    (Ne, Pe) => {
      let {
        sensor: nt,
        options: _t
      } = Pe;
      if (k.current == null)
        return;
      const Ze = N.get(k.current);
      if (!Ze)
        return;
      const Be = Ne.nativeEvent, rt = new nt({
        active: k.current,
        activeNode: Ze,
        event: Be,
        options: _t,
        // Sensors need to be instantiated with refs for arguments that change over time
        // otherwise they are frozen in time with the stale arguments
        context: ie,
        onAbort(_e) {
          if (!N.get(_e))
            return;
          const {
            onDragAbort: V
          } = L.current, re = {
            id: _e
          };
          V?.(re), T({
            type: "onDragAbort",
            event: re
          });
        },
        onPending(_e, ct, V, re) {
          if (!N.get(_e))
            return;
          const {
            onDragPending: je
          } = L.current, lt = {
            id: _e,
            constraint: ct,
            initialCoordinates: V,
            offset: re
          };
          je?.(lt), T({
            type: "onDragPending",
            event: lt
          });
        },
        onStart(_e) {
          const ct = k.current;
          if (ct == null)
            return;
          const V = N.get(ct);
          if (!V)
            return;
          const {
            onDragStart: re
          } = L.current, Ce = {
            activatorEvent: Be,
            active: {
              id: ct,
              data: V.data,
              rect: y
            }
          };
          zn(() => {
            re?.(Ce), S(Lt.Initializing), I({
              type: Ae.DragStart,
              initialCoordinates: _e,
              active: ct
            }), T({
              type: "onDragStart",
              event: Ce
            }), P(Ke.current), X(Be);
          });
        },
        onMove(_e) {
          I({
            type: Ae.DragMove,
            coordinates: _e
          });
        },
        onEnd: it(Ae.DragEnd),
        onCancel: it(Ae.DragCancel)
      });
      Ke.current = rt;
      function it(_e) {
        return async function() {
          const {
            active: V,
            collisions: re,
            over: Ce,
            scrollAdjustedTranslate: je
          } = ie.current;
          let lt = null;
          if (V && je) {
            const {
              cancelDrop: fn
            } = L.current;
            lt = {
              activatorEvent: Be,
              active: V,
              collisions: re,
              delta: je,
              over: Ce
            }, _e === Ae.DragEnd && typeof fn == "function" && await Promise.resolve(fn(lt)) && (_e = Ae.DragCancel);
          }
          k.current = null, zn(() => {
            I({
              type: _e
            }), S(Lt.Uninitialized), ht(null), P(null), X(null), Ke.current = null;
            const fn = _e === Ae.DragEnd ? "onDragEnd" : "onDragCancel";
            if (lt) {
              const yr = L.current[fn];
              yr?.(lt), T({
                type: fn,
                event: lt
              });
            }
          });
        };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [N]
  ), Dt = Xe((Ne, Pe) => (nt, _t) => {
    const Ze = nt.nativeEvent, Be = N.get(_t);
    if (
      // Another sensor is already instantiating
      k.current !== null || // No active draggable
      !Be || // Event has already been captured
      Ze.dndKit || Ze.defaultPrevented
    )
      return;
    const rt = {
      active: Be
    };
    Ne(nt, Pe.options, rt) === !0 && (Ze.dndKit = {
      capturedBy: Pe.sensor
    }, k.current = _t, gt(nt, Pe));
  }, [N, gt]), Tt = zl(u, Dt);
  jl(u), Ct(() => {
    W && x === Lt.Initializing && S(Lt.Initialized);
  }, [W, x]), ue(
    () => {
      const {
        onDragMove: Ne
      } = L.current, {
        active: Pe,
        activatorEvent: nt,
        collisions: _t,
        over: Ze
      } = ie.current;
      if (!Pe || !nt)
        return;
      const Be = {
        active: Pe,
        activatorEvent: nt,
        collisions: _t,
        delta: {
          x: oe.x,
          y: oe.y
        },
        over: Ze
      };
      zn(() => {
        Ne?.(Be), T({
          type: "onDragMove",
          event: Be
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oe.x, oe.y]
  ), ue(
    () => {
      const {
        active: Ne,
        activatorEvent: Pe,
        collisions: nt,
        droppableContainers: _t,
        scrollAdjustedTranslate: Ze
      } = ie.current;
      if (!Ne || k.current == null || !Pe || !Ze)
        return;
      const {
        onDragOver: Be
      } = L.current, rt = _t.get(tt), it = rt && rt.rect.current ? {
        id: rt.id,
        rect: rt.rect.current,
        data: rt.data,
        disabled: rt.disabled
      } : null, _e = {
        active: Ne,
        activatorEvent: Pe,
        collisions: nt,
        delta: {
          x: Ze.x,
          y: Ze.y
        },
        over: it
      };
      zn(() => {
        ht(it), Be?.(_e), T({
          type: "onDragOver",
          event: _e
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tt]
  ), Ct(() => {
    ie.current = {
      activatorEvent: $,
      active: R,
      activeNode: M,
      collisionRect: ce,
      collisions: Le,
      droppableRects: K,
      draggableNodes: N,
      draggingNode: Oe,
      draggingNodeRect: Ge,
      droppableContainers: _,
      over: $e,
      scrollableAncestors: Me,
      scrollAdjustedTranslate: oe
    }, y.current = {
      initial: Ge,
      translated: ce
    };
  }, [R, M, Le, ce, N, Oe, Ge, K, _, $e, Me, oe]), El({
    ...q,
    delta: E,
    draggingRect: ce,
    pointerCoordinates: pt,
    scrollableAncestors: Me,
    scrollableAncestorRects: He
  });
  const kt = Ee(() => ({
    active: R,
    activeNode: M,
    activeNodeRect: W,
    activatorEvent: $,
    collisions: Le,
    containerNodeRect: ae,
    dragOverlay: se,
    draggableNodes: N,
    droppableContainers: _,
    droppableRects: K,
    over: $e,
    measureDroppableContainers: Z,
    scrollableAncestors: Me,
    scrollableAncestorRects: He,
    measuringConfiguration: H,
    measuringScheduled: j,
    windowRect: Ye
  }), [R, M, W, $, Le, ae, se, N, _, K, $e, Z, Me, He, H, j, Ye]), $t = Ee(() => ({
    activatorEvent: $,
    activators: Tt,
    active: R,
    activeNodeRect: W,
    ariaDescribedById: {
      draggable: B
    },
    dispatch: I,
    draggableNodes: N,
    over: $e,
    measureDroppableContainers: Z
  }), [$, Tt, R, W, I, B, N, $e, Z]);
  return fe.createElement(zs.Provider, {
    value: b
  }, fe.createElement(kn.Provider, {
    value: $t
  }, fe.createElement(qs.Provider, {
    value: kt
  }, fe.createElement(lr.Provider, {
    value: It
  }, a)), fe.createElement(Yl, {
    disabled: c?.restoreFocus === !1
  })), fe.createElement(Qc, {
    ...c,
    hiddenTextDescribedById: B
  }));
  function zt() {
    const Ne = A?.autoScrollEnabled === !1, Pe = typeof l == "object" ? l.enabled === !1 : l === !1, nt = C && !Ne && !Pe;
    return typeof l == "object" ? {
      ...l,
      enabled: nt
    } : {
      enabled: nt
    };
  }
}), ta = /* @__PURE__ */ Rt(null), Do = "button", na = "Draggable";
function $n(t) {
  let {
    id: e,
    data: n,
    disabled: r = !1,
    attributes: o
  } = t;
  const s = ir(na), {
    activators: i,
    activatorEvent: c,
    active: l,
    activeNodeRect: a,
    ariaDescribedById: u,
    draggableNodes: d,
    over: p
  } = bt(kn), {
    role: h = Do,
    roleDescription: v = "draggable",
    tabIndex: m = 0
  } = o ?? {}, g = l?.id === e, I = bt(g ? lr : ta), [T, b] = Vn(), [x, S] = Vn(), C = Fl(i, e), O = _n(n);
  Ct(
    () => (d.set(e, {
      id: e,
      key: s,
      node: T,
      activatorNode: x,
      data: O
    }), () => {
      const E = d.get(e);
      E && E.key === s && d.delete(e);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, e]
  );
  const N = Ee(() => ({
    role: h,
    tabIndex: m,
    "aria-disabled": r,
    "aria-pressed": g && h === Do ? !0 : void 0,
    "aria-roledescription": v,
    "aria-describedby": u.draggable
  }), [r, h, m, g, v, u.draggable]);
  return {
    active: l,
    activatorEvent: c,
    activeNodeRect: a,
    attributes: N,
    isDragging: g,
    listeners: r ? void 0 : C,
    node: T,
    over: p,
    setNodeRef: b,
    setActivatorNodeRef: S,
    transform: I
  };
}
function ra() {
  return bt(qs);
}
const oa = "Droppable", sa = {
  timeout: 25
};
function Xr(t) {
  let {
    data: e,
    disabled: n = !1,
    id: r,
    resizeObserverConfig: o
  } = t;
  const s = ir(oa), {
    active: i,
    dispatch: c,
    over: l,
    measureDroppableContainers: a
  } = bt(kn), u = le({
    disabled: n
  }), d = le(!1), p = le(null), h = le(null), {
    disabled: v,
    updateMeasurementsFor: m,
    timeout: g
  } = {
    ...sa,
    ...o
  }, I = _n(m ?? r), T = Xe(
    () => {
      if (!d.current) {
        d.current = !0;
        return;
      }
      h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
        a(Array.isArray(I.current) ? I.current : [I.current]), h.current = null;
      }, g);
    },
    //eslint-disable-next-line react-hooks/exhaustive-deps
    [g]
  ), b = cr({
    callback: T,
    disabled: v || !i
  }), x = Xe((N, E) => {
    b && (E && (b.unobserve(E), d.current = !1), N && b.observe(N));
  }, [b]), [S, C] = Vn(x), O = _n(e);
  return ue(() => {
    !b || !S.current || (b.disconnect(), d.current = !1, b.observe(S.current));
  }, [S, b]), ue(
    () => (c({
      type: Ae.RegisterDroppable,
      element: {
        id: r,
        key: s,
        disabled: n,
        node: S,
        rect: p,
        data: O
      }
    }), () => c({
      type: Ae.UnregisterDroppable,
      key: s,
      id: r
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r]
  ), ue(() => {
    n !== u.current.disabled && (c({
      type: Ae.SetDroppableDisabled,
      id: r,
      key: s,
      disabled: n
    }), u.current.disabled = n);
  }, [r, s, n, c]), {
    active: i,
    rect: p,
    isOver: l?.id === r,
    node: S,
    over: l,
    setNodeRef: C
  };
}
function ia(t) {
  let {
    animation: e,
    children: n
  } = t;
  const [r, o] = ye(null), [s, i] = ye(null), c = Gn(n);
  return !n && !r && c && o(c), Ct(() => {
    if (!s)
      return;
    const l = r?.key, a = r?.props.id;
    if (l == null || a == null) {
      o(null);
      return;
    }
    Promise.resolve(e(a, s)).then(() => {
      o(null);
    });
  }, [e, r, s]), fe.createElement(fe.Fragment, null, n, r ? ic(r, {
    ref: i
  }) : null);
}
const ca = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1
};
function la(t) {
  let {
    children: e
  } = t;
  return fe.createElement(kn.Provider, {
    value: Ys
  }, fe.createElement(lr.Provider, {
    value: ca
  }, e));
}
const aa = {
  position: "fixed",
  touchAction: "none"
}, ua = (t) => Gr(t) ? "transform 250ms ease" : void 0, da = /* @__PURE__ */ tr((t, e) => {
  let {
    as: n,
    activatorEvent: r,
    adjustScale: o,
    children: s,
    className: i,
    rect: c,
    style: l,
    transform: a,
    transition: u = ua
  } = t;
  if (!c)
    return null;
  const d = o ? a : {
    ...a,
    scaleX: 1,
    scaleY: 1
  }, p = {
    ...aa,
    width: c.width,
    height: c.height,
    top: c.top,
    left: c.left,
    transform: Sn.Transform.toString(d),
    transformOrigin: o && r ? nl(r, c) : void 0,
    transition: typeof u == "function" ? u(r) : u,
    ...l
  };
  return fe.createElement(n, {
    className: i,
    style: p,
    ref: e
  }, s);
}), fa = (t) => (e) => {
  let {
    active: n,
    dragOverlay: r
  } = e;
  const o = {}, {
    styles: s,
    className: i
  } = t;
  if (s != null && s.active)
    for (const [c, l] of Object.entries(s.active))
      l !== void 0 && (o[c] = n.node.style.getPropertyValue(c), n.node.style.setProperty(c, l));
  if (s != null && s.dragOverlay)
    for (const [c, l] of Object.entries(s.dragOverlay))
      l !== void 0 && r.node.style.setProperty(c, l);
  return i != null && i.active && n.node.classList.add(i.active), i != null && i.dragOverlay && r.node.classList.add(i.dragOverlay), function() {
    for (const [l, a] of Object.entries(o))
      n.node.style.setProperty(l, a);
    i != null && i.active && n.node.classList.remove(i.active);
  };
}, pa = (t) => {
  let {
    transform: {
      initial: e,
      final: n
    }
  } = t;
  return [{
    transform: Sn.Transform.toString(e)
  }, {
    transform: Sn.Transform.toString(n)
  }];
}, ha = {
  duration: 250,
  easing: "ease",
  keyframes: pa,
  sideEffects: /* @__PURE__ */ fa({
    styles: {
      active: {
        opacity: "0"
      }
    }
  })
};
function ma(t) {
  let {
    config: e,
    draggableNodes: n,
    droppableContainers: r,
    measuringConfiguration: o
  } = t;
  return sr((s, i) => {
    if (e === null)
      return;
    const c = n.get(s);
    if (!c)
      return;
    const l = c.node.current;
    if (!l)
      return;
    const a = Xs(i);
    if (!a)
      return;
    const {
      transform: u
    } = et(i).getComputedStyle(i), d = Ls(u);
    if (!d)
      return;
    const p = typeof e == "function" ? e : ga(e);
    return Fs(l, o.draggable.measure), p({
      active: {
        id: s,
        data: c.data,
        node: l,
        rect: o.draggable.measure(l)
      },
      draggableNodes: n,
      dragOverlay: {
        node: i,
        rect: o.dragOverlay.measure(a)
      },
      droppableContainers: r,
      measuringConfiguration: o,
      transform: d
    });
  });
}
function ga(t) {
  const {
    duration: e,
    easing: n,
    sideEffects: r,
    keyframes: o
  } = {
    ...ha,
    ...t
  };
  return (s) => {
    let {
      active: i,
      dragOverlay: c,
      transform: l,
      ...a
    } = s;
    if (!e)
      return;
    const u = {
      x: c.rect.left - i.rect.left,
      y: c.rect.top - i.rect.top
    }, d = {
      scaleX: l.scaleX !== 1 ? i.rect.width * l.scaleX / c.rect.width : 1,
      scaleY: l.scaleY !== 1 ? i.rect.height * l.scaleY / c.rect.height : 1
    }, p = {
      x: l.x - u.x,
      y: l.y - u.y,
      ...d
    }, h = o({
      ...a,
      active: i,
      dragOverlay: c,
      transform: {
        initial: l,
        final: p
      }
    }), [v] = h, m = h[h.length - 1];
    if (JSON.stringify(v) === JSON.stringify(m))
      return;
    const g = r?.({
      active: i,
      dragOverlay: c,
      ...a
    }), I = c.node.animate(h, {
      duration: e,
      easing: n,
      fill: "forwards"
    });
    return new Promise((T) => {
      I.onfinish = () => {
        g?.(), T();
      };
    });
  };
}
let ko = 0;
function va(t) {
  return Ee(() => {
    if (t != null)
      return ko++, ko;
  }, [t]);
}
const ya = /* @__PURE__ */ fe.memo((t) => {
  let {
    adjustScale: e = !1,
    children: n,
    dropAnimation: r,
    style: o,
    transition: s,
    modifiers: i,
    wrapperElement: c = "div",
    className: l,
    zIndex: a = 999
  } = t;
  const {
    activatorEvent: u,
    active: d,
    activeNodeRect: p,
    containerNodeRect: h,
    draggableNodes: v,
    droppableContainers: m,
    dragOverlay: g,
    over: I,
    measuringConfiguration: T,
    scrollableAncestors: b,
    scrollableAncestorRects: x,
    windowRect: S
  } = ra(), C = bt(lr), O = va(d?.id), N = Qs(i, {
    activatorEvent: u,
    active: d,
    activeNodeRect: p,
    containerNodeRect: h,
    draggingNodeRect: g.rect,
    over: I,
    overlayNodeRect: g.rect,
    scrollableAncestors: b,
    scrollableAncestorRects: x,
    transform: C,
    windowRect: S
  }), E = Wr(p), _ = ma({
    config: r,
    draggableNodes: v,
    droppableContainers: m,
    measuringConfiguration: T
  }), w = E ? g.setRef : void 0;
  return fe.createElement(la, null, fe.createElement(ia, {
    animation: _
  }, d && O ? fe.createElement(da, {
    key: O,
    id: d.id,
    ref: w,
    as: c,
    activatorEvent: u,
    adjustScale: e,
    className: l,
    transition: s,
    rect: E,
    style: {
      zIndex: a,
      ...o
    },
    transform: N
  }, n) : null));
}), $o = "end-rung";
function ba(t) {
  const e = Q.c(17), {
    index: n
  } = t, {
    state: r,
    actions: o
  } = ke();
  let s;
  e[0] !== r.selection.selectedIds ? (s = r.selection.selectedIds.includes($o), e[0] = r.selection.selectedIds, e[1] = s) : s = e[1];
  const i = s, c = {
    accepts: ["RUNG", "TOOL_RUNG"],
    index: n
  }, {
    setNodeRef: l,
    isOver: a,
    active: u
  } = Xr({
    id: "end-rung-drop",
    data: c
  });
  let d;
  e: {
    if (!u) {
      d = !1;
      break e;
    }
    const C = u.data.current;
    if (!c.accepts.includes(C.type)) {
      d = !1;
      break e;
    }
    if (C.type === "RUNG") {
      d = C.index < n - 1;
      break e;
    }
    d = !0;
  }
  const p = d;
  let h;
  e[2] !== o || e[3] !== i ? (h = (C) => {
    C.stopPropagation(), !(i && C.button === 2) && o.select($o, z.RUNG);
  }, e[2] = o, e[3] = i, e[4] = h) : h = e[4];
  const v = h, m = a ? "rounded-full bg-green-400" : "bg-slate-400";
  let g;
  e[5] !== p || e[6] !== m ? (g = p && /* @__PURE__ */ f("div", { className: `absolute left-10 h-3 w-3 border border-slate-500 ${m}` }), e[5] = p, e[6] = m, e[7] = g) : g = e[7];
  const I = i ? "bg-selected" : "bg-transparent";
  let T;
  e[8] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (T = /* @__PURE__ */ F("div", { className: "flex h-14 w-12 flex-none", children: [
    /* @__PURE__ */ f("div", { className: "w-2" }),
    /* @__PURE__ */ f("p", { className: "my-auto select-none text-sm text-slate-500", children: "(End)" })
  ] }), e[8] = T) : T = e[8];
  let b;
  e[9] !== I ? (b = /* @__PURE__ */ f("div", { className: I, children: T }), e[9] = I, e[10] = b) : b = e[10];
  let x;
  e[11] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (x = /* @__PURE__ */ F("div", { className: "flex w-full border-l border-slate-400", children: [
    /* @__PURE__ */ f("div", { className: "relative flex min-w-full shrink-0", children: /* @__PURE__ */ f("div", { className: "relative flex h-14 w-full flex-col justify-center", children: /* @__PURE__ */ f("div", { className: "h-px w-full bg-slate-400" }) }) }),
    /* @__PURE__ */ f("div", { className: "border-l border-slate-400 pr-1" })
  ] }), e[11] = x) : x = e[11];
  let S;
  return e[12] !== v || e[13] !== l || e[14] !== g || e[15] !== b ? (S = /* @__PURE__ */ F("div", { ref: l, className: "relative flex cursor-default pr-2", onMouseDown: v, children: [
    g,
    b,
    x
  ] }), e[12] = v, e[13] = l, e[14] = g, e[15] = b, e[16] = S) : S = e[16], S;
}
const ar = (...t) => t.filter(Boolean).join(" "), ei = he.createContext(null), Yr = () => {
  const t = he.useContext(ei);
  if (!t)
    throw new Error("ContextMenu components must be used within <ContextMenu />");
  return t;
}, qr = (t) => {
  const e = Q.c(20), {
    children: n
  } = t, r = he.useId(), [o, s] = he.useState(!1);
  let i;
  e[0] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (i = {
    x: 0,
    y: 0
  }, e[0] = i) : i = e[0];
  const [c, l] = he.useState(i), a = he.useRef(null), u = he.useRef(null);
  let d;
  e[1] !== r ? (d = (S) => {
    l(S), s(!0), window.dispatchEvent(new CustomEvent("ladder-contextmenu-open", {
      detail: {
        id: r
      }
    }));
  }, e[1] = r, e[2] = d) : d = e[2];
  const p = d;
  let h;
  e[3] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (h = () => s(!1), e[3] = h) : h = e[3];
  const v = h;
  let m, g;
  e[4] !== r || e[5] !== o ? (m = () => {
    const S = (C) => {
      o && C instanceof CustomEvent && C.detail?.id && C.detail.id !== r && v();
    };
    return window.addEventListener("ladder-contextmenu-open", S), () => {
      window.removeEventListener("ladder-contextmenu-open", S);
    };
  }, g = [o, v, r], e[4] = r, e[5] = o, e[6] = m, e[7] = g) : (m = e[6], g = e[7]), he.useEffect(m, g);
  let I;
  e[8] !== o ? (I = () => {
    if (!o)
      return;
    const S = (N) => {
      N.target instanceof Node && (a.current?.contains(N.target) || u.current?.contains(N.target) || v());
    }, C = (N) => {
      N.key === "Escape" && v();
    }, O = () => v();
    return document.addEventListener("mousedown", S, !0), document.addEventListener("keydown", C), window.addEventListener("resize", O), window.addEventListener("scroll", O, !0), () => {
      document.removeEventListener("mousedown", S, !0), document.removeEventListener("keydown", C), window.removeEventListener("resize", O), window.removeEventListener("scroll", O, !0);
    };
  }, e[8] = o, e[9] = I) : I = e[9];
  let T;
  e[10] !== r || e[11] !== o ? (T = [o, v, r], e[10] = r, e[11] = o, e[12] = T) : T = e[12], he.useEffect(I, T);
  let b;
  e[13] !== o || e[14] !== p || e[15] !== c ? (b = {
    open: o,
    position: c,
    contentRef: a,
    triggerRef: u,
    openAt: p,
    close: v
  }, e[13] = o, e[14] = p, e[15] = c, e[16] = b) : b = e[16];
  let x;
  return e[17] !== n || e[18] !== b ? (x = /* @__PURE__ */ f(ei.Provider, { value: b, children: n }), e[17] = n, e[18] = b, e[19] = x) : x = e[19], x;
}, ur = he.forwardRef(({
  asChild: t,
  onContextMenu: e,
  className: n,
  children: r,
  ...o
}, s) => {
  const {
    openAt: i,
    triggerRef: c
  } = Yr(), l = (u) => {
    u.preventDefault(), e?.(u), i({
      x: u.clientX,
      y: u.clientY
    });
  }, a = (u) => {
    c.current = u, typeof s == "function" ? s(u) : s && (s.current = u);
  };
  if (t && he.isValidElement(r)) {
    const u = r, d = u.props, p = u.ref, h = d?.onContextMenu, v = (m) => {
      a(m), p && (typeof p == "function" ? p(m) : p && typeof p == "object" && "current" in p && Object.assign(p, {
        current: m
      }));
    };
    return he.cloneElement(u, {
      ...o,
      onContextMenu: (m) => {
        h?.(m), l(m);
      },
      className: ar(d?.className, n),
      ref: v
    });
  }
  return /* @__PURE__ */ f("div", { ref: a, className: n, onContextMenu: l, ...o, children: r });
});
ur.displayName = "ContextMenuTrigger";
const dr = he.forwardRef((t, e) => {
  const n = Q.c(23);
  let r, o, s;
  n[0] !== t ? ({
    className: r,
    style: s,
    ...o
  } = t, n[0] = t, n[1] = r, n[2] = o, n[3] = s) : (r = n[1], o = n[2], s = n[3]);
  const {
    open: i,
    position: c,
    contentRef: l
  } = Yr(), [a, u] = he.useState(c);
  let d, p;
  n[4] !== l || n[5] !== i || n[6] !== c ? (d = () => {
    if (!i || !l.current)
      return;
    const b = l.current.getBoundingClientRect(), x = window.innerWidth, S = window.innerHeight, C = Math.min(c.x, Math.max(8, x - b.width - 8)), O = Math.min(c.y, Math.max(8, S - b.height - 8));
    u({
      x: C,
      y: O
    });
  }, p = [i, c, l], n[4] = l, n[5] = i, n[6] = c, n[7] = d, n[8] = p) : (d = n[7], p = n[8]), he.useLayoutEffect(d, p);
  let h;
  n[9] !== l || n[10] !== e ? (h = (b) => {
    l.current = b, typeof e == "function" ? e(b) : e && (e.current = b);
  }, n[9] = l, n[10] = e, n[11] = h) : h = n[11];
  const v = h;
  if (!i)
    return null;
  const m = wa;
  let g;
  n[12] !== r ? (g = ar("fixed z-50 min-w-72 overflow-hidden rounded-sm border border-zinc-300 bg-white p-1 font-sans text-sm text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.22)]", r), n[12] = r, n[13] = g) : g = n[13];
  let I;
  n[14] !== a.x || n[15] !== a.y || n[16] !== s ? (I = {
    left: a.x,
    top: a.y,
    ...s
  }, n[14] = a.x, n[15] = a.y, n[16] = s, n[17] = I) : I = n[17];
  let T;
  return n[18] !== o || n[19] !== v || n[20] !== g || n[21] !== I ? (T = nr(/* @__PURE__ */ f("div", { ref: v, role: "menu", tabIndex: -1, className: g, style: I, onMouseDown: m, onContextMenu: m, ...o }), document.body), n[18] = o, n[19] = v, n[20] = g, n[21] = I, n[22] = T) : T = n[22], T;
});
dr.displayName = "ContextMenuContent";
const xt = he.forwardRef((t, e) => {
  const n = Q.c(27);
  let r, o, s, i, c, l, a;
  n[0] !== t ? ({
    className: o,
    inset: i,
    onClick: c,
    disabled: s,
    shortcut: a,
    children: r,
    ...l
  } = t, n[0] = t, n[1] = r, n[2] = o, n[3] = s, n[4] = i, n[5] = c, n[6] = l, n[7] = a) : (r = n[1], o = n[2], s = n[3], i = n[4], c = n[5], l = n[6], a = n[7]);
  const {
    close: u
  } = Yr();
  let d;
  n[8] !== u || n[9] !== s || n[10] !== c ? (d = (T) => {
    s || (c?.(T), u());
  }, n[8] = u, n[9] = s, n[10] = c, n[11] = d) : d = n[11];
  const p = d, h = i && "pl-7";
  let v;
  n[12] !== o || n[13] !== h ? (v = ar("group flex w-full cursor-default items-center rounded-sm px-2 py-0 text-left text-sm leading-7 text-zinc-700 transition-none outline-none select-none hover:bg-sky-700 hover:text-white focus-visible:bg-sky-700 focus-visible:text-white disabled:pointer-events-none disabled:opacity-50", h, o), n[12] = o, n[13] = h, n[14] = v) : v = n[14];
  let m;
  n[15] !== r ? (m = /* @__PURE__ */ f("span", { className: "flex-1", children: r }), n[15] = r, n[16] = m) : m = n[16];
  let g;
  n[17] !== a ? (g = a && /* @__PURE__ */ f("span", { className: "ml-auto pl-5 text-sm text-zinc-500 opacity-80 group-hover:text-inherit group-hover:opacity-100", children: a }), n[17] = a, n[18] = g) : g = n[18];
  let I;
  return n[19] !== s || n[20] !== p || n[21] !== l || n[22] !== e || n[23] !== v || n[24] !== m || n[25] !== g ? (I = /* @__PURE__ */ F("button", { ref: e, type: "button", role: "menuitem", disabled: s, className: v, onClick: p, ...l, children: [
    m,
    g
  ] }), n[19] = s, n[20] = p, n[21] = l, n[22] = e, n[23] = v, n[24] = m, n[25] = g, n[26] = I) : I = n[26], I;
});
xt.displayName = "ContextMenuItem";
const Qr = he.forwardRef((t, e) => {
  const n = Q.c(9);
  let r, o;
  n[0] !== t ? ({
    className: r,
    ...o
  } = t, n[0] = t, n[1] = r, n[2] = o) : (r = n[1], o = n[2]);
  let s;
  n[3] !== r ? (s = ar("-mx-1 my-1 h-px bg-zinc-300", r), n[3] = r, n[4] = s) : s = n[4];
  let i;
  return n[5] !== o || n[6] !== e || n[7] !== s ? (i = /* @__PURE__ */ f("div", { ref: e, role: "separator", className: s, ...o }), n[5] = o, n[6] = e, n[7] = s, n[8] = i) : i = n[8], i;
});
Qr.displayName = "ContextMenuSeparator";
function wa(t) {
  return t.stopPropagation();
}
function Ia(t) {
  const e = Q.c(6), {
    circuitId: n,
    rungData: r
  } = t, {
    actions: o
  } = ke();
  let s;
  e[0] !== o || e[1] !== n || e[2] !== r ? (s = () => {
    const l = Ut(r.circuit), {
      newRungData: a
    } = Nt(n, r);
    o.modifyRung(a);
    const u = new Set(Ut(a.circuit)), d = new Set(l.filter((h) => !u.has(h))), p = d.size > 0 ? tn(l, d) : null;
    p ? o.select(p, z.INSTRUCTION) : o.select(r.circuit.id, z.RUNG);
  }, e[0] = o, e[1] = n, e[2] = r, e[3] = s) : s = e[3];
  const i = s;
  let c;
  return e[4] !== i ? (c = /* @__PURE__ */ f(dr, { "data-width-48": !0, children: /* @__PURE__ */ f(xt, { inset: !0, onClick: i, children: "Delete Branch Level" }) }), e[4] = i, e[5] = c) : c = e[5], c;
}
function ti(t) {
  const e = Q.c(38), {
    rungData: n
  } = t, {
    state: r,
    actions: o
  } = ke(), s = le(r);
  let i, c;
  e[0] !== r ? (i = () => {
    s.current = r;
  }, c = [r], e[0] = r, e[1] = i, e[2] = c) : (i = e[1], c = e[2]), ue(i, c);
  const {
    selectedIds: l,
    selectedType: a
  } = r.selection, u = a === z.RUNG && l.length > 1, d = l.length;
  let p;
  e[3] !== n.id ? (p = () => s.current.rungIds.indexOf(n.id), e[3] = n.id, e[4] = p) : p = e[4];
  const h = p;
  let v;
  e[5] !== n.circuit ? (v = () => {
    const L = s.current, {
      selectedIds: B,
      selectedType: U
    } = L.selection, H = U === z.RUNG && B.length > 1, K = U === z.INSTRUCTION && B.length > 1;
    if (H) {
      const Z = [];
      for (const j of L.rungIds) {
        const M = L.rungs[j];
        !M || !B.includes(M.circuit.id) || Z.push(nn(M.circuit));
      }
      navigator.clipboard.writeText(Z.join(";") + ";");
    } else if (K) {
      const Z = [];
      for (const j of B)
        for (const M of L.rungIds) {
          const G = L.rungs[M];
          if (!G || !vt(j, G.circuit))
            continue;
          const q = Fn(j, G);
          q && Z.push(In(q));
          break;
        }
      navigator.clipboard.writeText(Z.join(""));
    } else
      navigator.clipboard.writeText(nn(n.circuit) + ";");
  }, e[5] = n.circuit, e[6] = v) : v = e[6];
  const m = v;
  let g;
  e[7] !== o || e[8] !== m || e[9] !== n.id ? (g = () => {
    m();
    const L = s.current, {
      selectedIds: B,
      selectedType: U
    } = L.selection, H = U === z.RUNG && B.length > 1, K = U === z.INSTRUCTION && B.length > 1;
    if (H) {
      const Z = new Set(B), j = L.rungIds.map((W) => L.rungs[W]?.circuit.id).filter(Boolean), M = tn(j, Z), G = L.rungIds.filter((W) => {
        const ae = L.rungs[W];
        return !ae || !Z.has(ae.circuit.id);
      }), q = {};
      for (const W of G)
        L.rungs[W] && (q[W] = L.rungs[W]);
      const Y = M ? {
        selectedIds: [M],
        selectedType: z.RUNG,
        anchorId: M
      } : void 0;
      o.setRungs(q, G, Y);
    } else if (K) {
      const Z = new Set(B);
      let j = null;
      for (const q of L.rungIds) {
        const Y = L.rungs[q];
        if (Y && Ut(Y.circuit).some((W) => Z.has(W))) {
          j = rr(Y.circuit, Z);
          break;
        }
      }
      const M = {
        ...L.rungs
      };
      for (const q of B)
        for (const Y of L.rungIds) {
          const W = M[Y];
          if (!W || !vt(q, W.circuit))
            continue;
          const {
            newRungData: ae
          } = Nt(q, W);
          M[Y] = ae;
          break;
        }
      const G = j ? {
        selectedIds: [j.id],
        selectedType: j.type,
        anchorId: j.id
      } : void 0;
      o.setRungs(M, L.rungIds, G);
    } else
      o.deleteRung(n.id);
  }, e[7] = o, e[8] = m, e[9] = n.id, e[10] = g) : g = e[10];
  const I = g;
  let T;
  e[11] !== o || e[12] !== h ? (T = async () => {
    let L;
    try {
      L = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const {
      state: B
    } = wn(L);
    if (B.rungIds.length === 0)
      return;
    const U = h(), H = B.rungIds.map((K) => B.rungs[K]).filter(Boolean).map(_a);
    H.length > 0 && o.pasteRungs(H, U + 1);
  }, e[11] = o, e[12] = h, e[13] = T) : T = e[13];
  const b = T;
  let x;
  e[14] !== o || e[15] !== n.id ? (x = () => {
    const L = s.current, {
      selectedIds: B,
      selectedType: U
    } = L.selection;
    if (U === z.RUNG && B.length > 1) {
      const K = new Set(B), Z = L.rungIds.map((Y) => L.rungs[Y]?.circuit.id).filter(Boolean), j = tn(Z, K), M = L.rungIds.filter((Y) => {
        const W = L.rungs[Y];
        return !W || !K.has(W.circuit.id);
      }), G = {};
      for (const Y of M)
        L.rungs[Y] && (G[Y] = L.rungs[Y]);
      const q = j ? {
        selectedIds: [j],
        selectedType: z.RUNG,
        anchorId: j
      } : void 0;
      o.setRungs(G, M, q);
    } else
      o.deleteRung(n.id);
  }, e[14] = o, e[15] = n.id, e[16] = x) : x = e[16];
  const S = x, C = u ? `Copy ${d} Rungs` : "Copy Rung", O = u ? `Cut ${d} Rungs` : "Cut Rung", N = u ? `Delete ${d} Rungs` : "Delete Rung";
  let E;
  e[17] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (E = Pt("⌘C", "Ctrl+C"), e[17] = E) : E = e[17];
  let _;
  e[18] !== C || e[19] !== m ? (_ = /* @__PURE__ */ f(xt, { inset: !0, onClick: m, shortcut: E, children: C }), e[18] = C, e[19] = m, e[20] = _) : _ = e[20];
  let w;
  e[21] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (w = Pt("⌘X", "Ctrl+X"), e[21] = w) : w = e[21];
  let y;
  e[22] !== O || e[23] !== I ? (y = /* @__PURE__ */ f(xt, { inset: !0, onClick: I, shortcut: w, children: O }), e[22] = O, e[23] = I, e[24] = y) : y = e[24];
  let R;
  e[25] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (R = Pt("⌘V", "Ctrl+V"), e[25] = R) : R = e[25];
  let k;
  e[26] !== b ? (k = /* @__PURE__ */ f(xt, { inset: !0, onClick: b, shortcut: R, children: "Paste After" }), e[26] = b, e[27] = k) : k = e[27];
  let A;
  e[28] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (A = /* @__PURE__ */ f(Qr, {}), e[28] = A) : A = e[28];
  let P;
  e[29] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (P = Pt("⌫", "Del"), e[29] = P) : P = e[29];
  let $;
  e[30] !== N || e[31] !== S ? ($ = /* @__PURE__ */ f(xt, { inset: !0, onClick: S, shortcut: P, children: N }), e[30] = N, e[31] = S, e[32] = $) : $ = e[32];
  let X;
  return e[33] !== y || e[34] !== k || e[35] !== $ || e[36] !== _ ? (X = /* @__PURE__ */ F(dr, { "data-width-48": !0, children: [
    _,
    y,
    k,
    A,
    $
  ] }), e[33] = y, e[34] = k, e[35] = $, e[36] = _, e[37] = X) : X = e[37], X;
}
function _a(t) {
  const e = Cn();
  return e.circuit = on(t.circuit), e;
}
function Cr(t) {
  const e = Q.c(8), {
    full: n,
    circuitId: r,
    index: o,
    rungId: s,
    wider: i
  } = t, c = {
    accepts: ["INSTRUCTION", "TOOL_INSTRUCTION", "TOOL_BRANCH"],
    circuitId: r,
    rungId: s,
    index: o
  }, {
    setNodeRef: l,
    isOver: a,
    active: u
  } = Xr({
    id: `wire-${r}-${o}`,
    data: c
  });
  let d;
  e: {
    if (!u) {
      d = !1;
      break e;
    }
    const x = u.data.current;
    if (!c.accepts.includes(x.type)) {
      d = !1;
      break e;
    }
    if (x.type === "INSTRUCTION") {
      const S = x, C = S.circuitId === r, O = S.index === o || S.index === o + 1;
      if (C && O) {
        d = !1;
        break e;
      }
    }
    d = !0;
  }
  const p = d, h = a ? "rounded-full bg-green-400" : "bg-slate-400", g = `relative flex h-15 ${i ? "min-w-8" : "min-w-4"} flex-col justify-center ${n ? "w-full" : "w-4"}`;
  let I;
  e[0] !== p || e[1] !== h ? (I = p && /* @__PURE__ */ f("div", { className: `absolute left-[calc(50%-4px)] h-2 w-2 border border-slate-500 ${h}` }), e[0] = p, e[1] = h, e[2] = I) : I = e[2];
  let T;
  e[3] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (T = /* @__PURE__ */ f("div", { className: "h-px w-full bg-slate-400" }), e[3] = T) : T = e[3];
  let b;
  return e[4] !== l || e[5] !== g || e[6] !== I ? (b = /* @__PURE__ */ F("div", { ref: l, className: g, children: [
    I,
    T
  ] }), e[4] = l, e[5] = g, e[6] = I, e[7] = b) : b = e[7], b;
}
const ni = (...t) => t.filter((e, n, r) => !!e && e.trim() !== "" && r.indexOf(e) === n).join(" ").trim();
const Sa = (t) => t.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const xa = (t) => t.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (e, n, r) => r ? r.toUpperCase() : n.toLowerCase()
);
const zo = (t) => {
  const e = xa(t);
  return e.charAt(0).toUpperCase() + e.slice(1);
};
var Ta = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
const Na = (t) => {
  for (const e in t)
    if (e.startsWith("aria-") || e === "role" || e === "title")
      return !0;
  return !1;
};
const Ca = tr(
  ({
    color: t = "currentColor",
    size: e = 24,
    strokeWidth: n = 2,
    absoluteStrokeWidth: r,
    className: o = "",
    children: s,
    iconNode: i,
    ...c
  }, l) => zr(
    "svg",
    {
      ref: l,
      ...Ta,
      width: e,
      height: e,
      stroke: t,
      strokeWidth: r ? Number(n) * 24 / Number(e) : n,
      className: ni("lucide", o),
      ...!s && !Na(c) && { "aria-hidden": "true" },
      ...c
    },
    [
      ...i.map(([a, u]) => zr(a, u)),
      ...Array.isArray(s) ? s : [s]
    ]
  )
);
const Ra = (t, e) => {
  const n = tr(
    ({ className: r, ...o }, s) => zr(Ca, {
      ref: s,
      iconNode: e,
      className: ni(
        `lucide-${Sa(zo(t))}`,
        `lucide-${t}`,
        r
      ),
      ...o
    })
  );
  return n.displayName = zo(t), n;
};
const Oa = [
  ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
  ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
], Ea = Ra("copy", Oa), Da = 300, ka = 160, $a = 120, Ln = 8, za = 6;
function ri(t) {
  return t.code ? t.code.startsWith("ST-") ? "ST Compiler" : t.code.startsWith("LD-") ? "LD Compiler" : "Compiler" : "Compiler";
}
function Aa(t) {
  return t.map((e) => {
    const n = ri(e);
    return e.code ? `${e.message} ${n}(${e.code})` : `${e.message} ${n}`;
  }).join(`
`);
}
function La(t) {
  const e = Q.c(28), {
    errors: n,
    children: r
  } = t, [o, s] = he.useState(!1);
  let i;
  e[0] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (i = {
    x: 0,
    y: 0
  }, e[0] = i) : i = e[0];
  const [c, l] = he.useState(i), [a, u] = he.useState(0), d = he.useRef(null), p = he.useRef(null), h = he.useRef(null), v = he.useRef(null), m = he.useRef(null), g = he.useRef(!1), I = he.useRef(!1), T = n.length > 0;
  let b;
  e[1] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (b = () => {
    h.current && (clearTimeout(h.current), h.current = null);
  }, e[1] = b) : b = e[1];
  const x = b;
  let S;
  e[2] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (S = () => {
    v.current && (clearTimeout(v.current), v.current = null), m.current && (clearTimeout(m.current), m.current = null);
  }, e[2] = S) : S = e[2];
  const C = S;
  let O;
  e[3] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (O = () => {
    C(), v.current = setTimeout(() => {
      v.current = null, !(g.current || I.current) && (u(0), m.current = setTimeout(() => {
        m.current = null, !(g.current || I.current) && s(!1);
      }, $a));
    }, ka);
  }, e[3] = O) : O = e[3];
  const N = O;
  let E;
  e[4] !== T || e[5] !== o ? (E = () => {
    if (!T || !d.current)
      return;
    g.current = !0, C();
    const j = d.current.getBoundingClientRect();
    if (l({
      x: j.left + j.width / 2,
      y: j.top
    }), o) {
      u(1);
      return;
    }
    x(), h.current = setTimeout(() => {
      h.current = null, g.current && (s(!0), requestAnimationFrame(() => u(1)));
    }, Da);
  }, e[4] = T, e[5] = o, e[6] = E) : E = e[6];
  const _ = E;
  let w;
  e[7] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (w = () => {
    g.current = !1, x(), N();
  }, e[7] = w) : w = e[7];
  const y = w;
  let R, k;
  e[8] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (R = () => () => {
    x(), C();
  }, k = [], e[8] = R, e[9] = k) : (R = e[8], k = e[9]), he.useEffect(R, k);
  let A, P;
  e[10] !== c || e[11] !== o ? (P = () => {
    if (!o || !p.current)
      return;
    const j = p.current, M = j.getBoundingClientRect(), G = window.innerWidth;
    let q = c.x - M.width / 2;
    q < Ln && (q = Ln), q + M.width > G - Ln && (q = G - M.width - Ln), j.style.left = `${q}px`, j.style.top = `${c.y - M.height - za}px`;
  }, A = [o, c], e[10] = c, e[11] = o, e[12] = A, e[13] = P) : (A = e[12], P = e[13]), he.useLayoutEffect(P, A);
  let $;
  e[14] !== n ? ($ = async () => {
    const j = Aa(n);
    if (j)
      try {
        await navigator.clipboard.writeText(j);
      } catch {
      }
  }, e[14] = n, e[15] = $) : $ = e[15];
  const X = $;
  let L;
  e[16] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (L = () => {
    I.current = !0, C(), u(1);
  }, e[16] = L) : L = e[16];
  const B = L;
  let U;
  e[17] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (U = () => {
    I.current = !1, N();
  }, e[17] = U) : U = e[17];
  const H = U;
  let K;
  e[18] !== n || e[19] !== X || e[20] !== T || e[21] !== a || e[22] !== o ? (K = o && T && nr(/* @__PURE__ */ f("div", { ref: p, role: "tooltip", onPointerDown: Za, onMouseDown: Ma, onClick: Ua, onMouseEnter: B, onMouseLeave: H, className: "pointer-events-auto fixed z-50 max-w-[520px] min-w-[240px] overflow-hidden rounded-[3px] border border-[#c8c8c8] bg-[#f3f3f3] font-sans text-[13px] leading-[18px] text-[#333333] shadow-[0_2px_8px_rgba(0,0,0,0.16)] transition-opacity duration-100 ease-out", style: {
    opacity: a
  }, children: /* @__PURE__ */ F("div", { className: "group flex items-start justify-between gap-3 px-3 py-2", children: [
    /* @__PURE__ */ f("div", { className: "font-mono text-sm leading-[21px]", children: n.map(Pa) }),
    /* @__PURE__ */ f("button", { type: "button", onClick: X, "aria-label": "Copy", className: "flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] text-[#424242] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5 focus-visible:opacity-100 focus-visible:outline-hidden", children: /* @__PURE__ */ f(Ea, { className: "h-4 w-4" }) })
  ] }) }), document.body), e[18] = n, e[19] = X, e[20] = T, e[21] = a, e[22] = o, e[23] = K) : K = e[23];
  let Z;
  return e[24] !== r || e[25] !== _ || e[26] !== K ? (Z = /* @__PURE__ */ F("div", { ref: d, onMouseEnter: _, onMouseLeave: y, className: "inline-flex", children: [
    r,
    K
  ] }), e[24] = r, e[25] = _, e[26] = K, e[27] = Z) : Z = e[27], Z;
}
function Pa(t, e) {
  return /* @__PURE__ */ F("div", { children: [
    t.message,
    " ",
    /* @__PURE__ */ F("span", { className: "opacity-60", children: [
      ri(t),
      t.code ? `(${t.code})` : ""
    ] })
  ] }, e);
}
function Ua(t) {
  t.stopPropagation();
}
function Ma(t) {
  t.stopPropagation();
}
function Za(t) {
  t.stopPropagation();
}
function fr(t) {
  const e = Q.c(14), {
    label: n,
    centerClassName: r,
    borderColor: o,
    textColor: s
  } = t, i = r === void 0 ? "w-2" : r, c = `w-2 rounded-tl-full rounded-bl-full border border-r-0 ${o}`;
  let l;
  e[0] !== c ? (l = /* @__PURE__ */ f("div", { className: c }), e[0] = c, e[1] = l) : l = e[1];
  const a = `flex items-center justify-center ${i}`;
  let u;
  e[2] !== n || e[3] !== s ? (u = n && /* @__PURE__ */ f("span", { className: `select-none text-sm ${s}`, children: n }), e[2] = n, e[3] = s, e[4] = u) : u = e[4];
  let d;
  e[5] !== a || e[6] !== u ? (d = /* @__PURE__ */ f("div", { className: a, children: u }), e[5] = a, e[6] = u, e[7] = d) : d = e[7];
  const p = `w-2 rounded-tr-full rounded-br-full border border-l-0 ${o}`;
  let h;
  e[8] !== p ? (h = /* @__PURE__ */ f("div", { className: p }), e[8] = p, e[9] = h) : h = e[9];
  let v;
  return e[10] !== l || e[11] !== d || e[12] !== h ? (v = /* @__PURE__ */ F(St, { children: [
    l,
    d,
    h
  ] }), e[10] = l, e[11] = d, e[12] = h, e[13] = v) : v = e[13], v;
}
function oi(t) {
  const e = Q.c(11), {
    type: n,
    borderColor: r,
    textColor: o
  } = t, s = `w-1 border-y border-r ${r}`;
  let i;
  e[0] !== s ? (i = /* @__PURE__ */ f("div", { className: s }), e[0] = s, e[1] = i) : i = e[1];
  let c;
  e[2] !== o || e[3] !== n ? (c = n === be.XIO ? /* @__PURE__ */ f("div", { className: "flex w-3 items-center justify-center", children: /* @__PURE__ */ f("span", { className: `-mt-0.5 select-none text-sm/6 ${o}`, children: "/" }) }) : /* @__PURE__ */ f("div", { className: "w-3" }), e[2] = o, e[3] = n, e[4] = c) : c = e[4];
  const l = `w-1 border-y border-l ${r}`;
  let a;
  e[5] !== l ? (a = /* @__PURE__ */ f("div", { className: l }), e[5] = l, e[6] = a) : a = e[6];
  let u;
  return e[7] !== i || e[8] !== c || e[9] !== a ? (u = /* @__PURE__ */ F(St, { children: [
    i,
    c,
    a
  ] }), e[7] = i, e[8] = c, e[9] = a, e[10] = u) : u = e[10], u;
}
function si(t) {
  const e = Q.c(2), {
    textColor: n
  } = t, r = `select-none text-sm ${n}`;
  let o;
  return e[0] !== r ? (o = /* @__PURE__ */ f("div", { className: "flex items-center justify-center px-0.5", children: /* @__PURE__ */ f("span", { className: r, children: "[ONS]" }) }), e[0] = r, e[1] = o) : o = e[1], o;
}
const Ba = {
  [we.OTL]: "L",
  [we.OTU]: "U"
};
function ja(t) {
  return t in be;
}
function Fa(t) {
  return t in we;
}
function Va(t) {
  const e = Q.c(38), {
    isSelected: n,
    type: r,
    onMouseDown: o,
    isEnergized: s
  } = t, i = n ? "bg-white" : "bg-slate-400", c = n ? "border-white" : "border-slate-400", l = n ? "text-white" : "text-slate-400", a = `h-px w-full ${i}`;
  let u;
  e[0] !== a ? (u = /* @__PURE__ */ f("div", { className: "absolute top-0 -right-0.5 bottom-0 left-0 flex items-center", children: /* @__PURE__ */ f("div", { className: a }) }), e[0] = a, e[1] = u) : u = e[1];
  let d;
  e[2] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (d = /* @__PURE__ */ f("div", { className: "w-1/2" }), e[2] = d) : d = e[2];
  const p = `my-1 w-1/2 ${s ? "bg-green-400" : ""}`;
  let h;
  e[3] !== p ? (h = /* @__PURE__ */ f("div", { className: p }), e[3] = p, e[4] = h) : h = e[4];
  let v;
  e[5] !== o || e[6] !== u || e[7] !== h ? (v = /* @__PURE__ */ F("div", { onMouseDown: o, className: "relative col-start-1 row-start-2 flex h-5 min-w-[16px] py-0.5", children: [
    u,
    d,
    h
  ] }), e[5] = o, e[6] = u, e[7] = h, e[8] = v) : v = e[8];
  let m;
  e[9] !== o || e[10] !== l || e[11] !== r ? (m = r === be.ONS && /* @__PURE__ */ f("div", { onMouseDown: o, className: "relative col-start-2 row-start-2 flex h-5 py-0.5", children: /* @__PURE__ */ f(si, { textColor: l }) }), e[9] = o, e[10] = l, e[11] = r, e[12] = m) : m = e[12];
  let g;
  e[13] !== c || e[14] !== o || e[15] !== l || e[16] !== r ? (g = ja(r) && r !== be.ONS && /* @__PURE__ */ f("div", { onMouseDown: o, className: "relative col-start-2 row-start-2 flex h-5 py-0.5", children: /* @__PURE__ */ f(oi, { type: r, borderColor: c, textColor: l }) }), e[13] = c, e[14] = o, e[15] = l, e[16] = r, e[17] = g) : g = e[17];
  let I;
  e[18] !== c || e[19] !== o || e[20] !== l || e[21] !== r ? (I = Fa(r) && /* @__PURE__ */ F("div", { onMouseDown: o, className: "relative col-start-2 row-start-2 flex h-5 py-0.5", children: [
    /* @__PURE__ */ f("div", { className: "w-0.5" }),
    /* @__PURE__ */ f(fr, { label: Ba[r], borderColor: c, textColor: l }),
    /* @__PURE__ */ f("div", { className: "w-0.5" })
  ] }), e[18] = c, e[19] = o, e[20] = l, e[21] = r, e[22] = I) : I = e[22];
  const T = `h-px w-full ${i}`;
  let b;
  e[23] !== T ? (b = /* @__PURE__ */ f("div", { className: "absolute top-0 right-0 bottom-0 -left-0.5 flex items-center", children: /* @__PURE__ */ f("div", { className: T }) }), e[23] = T, e[24] = b) : b = e[24];
  const x = `my-1 w-1/2 ${s ? "bg-green-400" : ""}`;
  let S;
  e[25] !== x ? (S = /* @__PURE__ */ f("div", { className: x }), e[25] = x, e[26] = S) : S = e[26];
  let C;
  e[27] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (C = /* @__PURE__ */ f("div", { className: "w-1/2" }), e[27] = C) : C = e[27];
  let O;
  e[28] !== o || e[29] !== b || e[30] !== S ? (O = /* @__PURE__ */ F("div", { onMouseDown: o, className: "relative col-start-3 row-start-2 flex h-5 min-w-[16px] py-0.5", children: [
    b,
    S,
    C
  ] }), e[28] = o, e[29] = b, e[30] = S, e[31] = O) : O = e[31];
  let N;
  return e[32] !== O || e[33] !== v || e[34] !== m || e[35] !== g || e[36] !== I ? (N = /* @__PURE__ */ F(St, { children: [
    v,
    m,
    g,
    I,
    O
  ] }), e[32] = O, e[33] = v, e[34] = m, e[35] = g, e[36] = I, e[37] = N) : N = e[37], N;
}
function D(t, e, n) {
  function r(c, l) {
    if (c._zod || Object.defineProperty(c, "_zod", {
      value: {
        def: l,
        constr: i,
        traits: /* @__PURE__ */ new Set()
      },
      enumerable: !1
    }), c._zod.traits.has(t))
      return;
    c._zod.traits.add(t), e(c, l);
    const a = i.prototype, u = Object.keys(a);
    for (let d = 0; d < u.length; d++) {
      const p = u[d];
      p in c || (c[p] = a[p].bind(c));
    }
  }
  const o = n?.Parent ?? Object;
  class s extends o {
  }
  Object.defineProperty(s, "name", { value: t });
  function i(c) {
    var l;
    const a = n?.Parent ? new s() : this;
    r(a, c), (l = a._zod).deferred ?? (l.deferred = []);
    for (const u of a._zod.deferred)
      u();
    return a;
  }
  return Object.defineProperty(i, "init", { value: r }), Object.defineProperty(i, Symbol.hasInstance, {
    value: (c) => n?.Parent && c instanceof n.Parent ? !0 : c?._zod?.traits?.has(t)
  }), Object.defineProperty(i, "name", { value: t }), i;
}
class en extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
}
class ii extends Error {
  constructor(e) {
    super(`Encountered unidirectional transform during encode: ${e}`), this.name = "ZodEncodeError";
  }
}
const ci = {};
function Mt(t) {
  return ci;
}
function li(t) {
  const e = Object.values(t).filter((r) => typeof r == "number");
  return Object.entries(t).filter(([r, o]) => e.indexOf(+r) === -1).map(([r, o]) => o);
}
function Ur(t, e) {
  return typeof e == "bigint" ? e.toString() : e;
}
function pr(t) {
  return {
    get value() {
      {
        const e = t();
        return Object.defineProperty(this, "value", { value: e }), e;
      }
    }
  };
}
function eo(t) {
  return t == null;
}
function to(t) {
  const e = t.startsWith("^") ? 1 : 0, n = t.endsWith("$") ? t.length - 1 : t.length;
  return t.slice(e, n);
}
function Ga(t, e) {
  const n = (t.toString().split(".")[1] || "").length, r = e.toString();
  let o = (r.split(".")[1] || "").length;
  if (o === 0 && /\d?e-\d?/.test(r)) {
    const l = r.match(/\d?e-(\d?)/);
    l?.[1] && (o = Number.parseInt(l[1]));
  }
  const s = n > o ? n : o, i = Number.parseInt(t.toFixed(s).replace(".", "")), c = Number.parseInt(e.toFixed(s).replace(".", ""));
  return i % c / 10 ** s;
}
const Ao = /* @__PURE__ */ Symbol("evaluating");
function pe(t, e, n) {
  let r;
  Object.defineProperty(t, e, {
    get() {
      if (r !== Ao)
        return r === void 0 && (r = Ao, r = n()), r;
    },
    set(o) {
      Object.defineProperty(t, e, {
        value: o
        // configurable: true,
      });
    },
    configurable: !0
  });
}
function Ht(t, e, n) {
  Object.defineProperty(t, e, {
    value: n,
    writable: !0,
    enumerable: !0,
    configurable: !0
  });
}
function Bt(...t) {
  const e = {};
  for (const n of t) {
    const r = Object.getOwnPropertyDescriptors(n);
    Object.assign(e, r);
  }
  return Object.defineProperties({}, e);
}
function Lo(t) {
  return JSON.stringify(t);
}
function Ha(t) {
  return t.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const ai = "captureStackTrace" in Error ? Error.captureStackTrace : (...t) => {
};
function Tn(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
const Ja = pr(() => {
  if (typeof navigator < "u" && navigator?.userAgent?.includes("Cloudflare"))
    return !1;
  try {
    const t = Function;
    return new t(""), !0;
  } catch {
    return !1;
  }
});
function sn(t) {
  if (Tn(t) === !1)
    return !1;
  const e = t.constructor;
  if (e === void 0 || typeof e != "function")
    return !0;
  const n = e.prototype;
  return !(Tn(n) === !1 || Object.prototype.hasOwnProperty.call(n, "isPrototypeOf") === !1);
}
function ui(t) {
  return sn(t) ? { ...t } : Array.isArray(t) ? [...t] : t;
}
const Ka = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function cn(t) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function jt(t, e, n) {
  const r = new t._zod.constr(e ?? t._zod.def);
  return (!e || n?.parent) && (r._zod.parent = t), r;
}
function J(t) {
  const e = t;
  if (!e)
    return {};
  if (typeof e == "string")
    return { error: () => e };
  if (e?.message !== void 0) {
    if (e?.error !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    e.error = e.message;
  }
  return delete e.message, typeof e.error == "string" ? { ...e, error: () => e.error } : e;
}
function Wa(t) {
  return Object.keys(t).filter((e) => t[e]._zod.optin === "optional" && t[e]._zod.optout === "optional");
}
const Xa = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function Ya(t, e) {
  const n = t._zod.def, r = n.checks;
  if (r && r.length > 0)
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  const s = Bt(t._zod.def, {
    get shape() {
      const i = {};
      for (const c in e) {
        if (!(c in n.shape))
          throw new Error(`Unrecognized key: "${c}"`);
        e[c] && (i[c] = n.shape[c]);
      }
      return Ht(this, "shape", i), i;
    },
    checks: []
  });
  return jt(t, s);
}
function qa(t, e) {
  const n = t._zod.def, r = n.checks;
  if (r && r.length > 0)
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  const s = Bt(t._zod.def, {
    get shape() {
      const i = { ...t._zod.def.shape };
      for (const c in e) {
        if (!(c in n.shape))
          throw new Error(`Unrecognized key: "${c}"`);
        e[c] && delete i[c];
      }
      return Ht(this, "shape", i), i;
    },
    checks: []
  });
  return jt(t, s);
}
function Qa(t, e) {
  if (!sn(e))
    throw new Error("Invalid input to extend: expected a plain object");
  const n = t._zod.def.checks;
  if (n && n.length > 0) {
    const s = t._zod.def.shape;
    for (const i in e)
      if (Object.getOwnPropertyDescriptor(s, i) !== void 0)
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
  }
  const o = Bt(t._zod.def, {
    get shape() {
      const s = { ...t._zod.def.shape, ...e };
      return Ht(this, "shape", s), s;
    }
  });
  return jt(t, o);
}
function eu(t, e) {
  if (!sn(e))
    throw new Error("Invalid input to safeExtend: expected a plain object");
  const n = Bt(t._zod.def, {
    get shape() {
      const r = { ...t._zod.def.shape, ...e };
      return Ht(this, "shape", r), r;
    }
  });
  return jt(t, n);
}
function tu(t, e) {
  const n = Bt(t._zod.def, {
    get shape() {
      const r = { ...t._zod.def.shape, ...e._zod.def.shape };
      return Ht(this, "shape", r), r;
    },
    get catchall() {
      return e._zod.def.catchall;
    },
    checks: []
    // delete existing checks
  });
  return jt(t, n);
}
function nu(t, e, n) {
  const o = e._zod.def.checks;
  if (o && o.length > 0)
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  const i = Bt(e._zod.def, {
    get shape() {
      const c = e._zod.def.shape, l = { ...c };
      if (n)
        for (const a in n) {
          if (!(a in c))
            throw new Error(`Unrecognized key: "${a}"`);
          n[a] && (l[a] = t ? new t({
            type: "optional",
            innerType: c[a]
          }) : c[a]);
        }
      else
        for (const a in c)
          l[a] = t ? new t({
            type: "optional",
            innerType: c[a]
          }) : c[a];
      return Ht(this, "shape", l), l;
    },
    checks: []
  });
  return jt(e, i);
}
function ru(t, e, n) {
  const r = Bt(e._zod.def, {
    get shape() {
      const o = e._zod.def.shape, s = { ...o };
      if (n)
        for (const i in n) {
          if (!(i in s))
            throw new Error(`Unrecognized key: "${i}"`);
          n[i] && (s[i] = new t({
            type: "nonoptional",
            innerType: o[i]
          }));
        }
      else
        for (const i in o)
          s[i] = new t({
            type: "nonoptional",
            innerType: o[i]
          });
      return Ht(this, "shape", s), s;
    }
  });
  return jt(e, r);
}
function Xt(t, e = 0) {
  if (t.aborted === !0)
    return !0;
  for (let n = e; n < t.issues.length; n++)
    if (t.issues[n]?.continue !== !0)
      return !0;
  return !1;
}
function Yt(t, e) {
  return e.map((n) => {
    var r;
    return (r = n).path ?? (r.path = []), n.path.unshift(t), n;
  });
}
function Pn(t) {
  return typeof t == "string" ? t : t?.message;
}
function Zt(t, e, n) {
  const r = { ...t, path: t.path ?? [] };
  if (!t.message) {
    const o = Pn(t.inst?._zod.def?.error?.(t)) ?? Pn(e?.error?.(t)) ?? Pn(n.customError?.(t)) ?? Pn(n.localeError?.(t)) ?? "Invalid input";
    r.message = o;
  }
  return delete r.inst, delete r.continue, e?.reportInput || delete r.input, r;
}
function no(t) {
  return Array.isArray(t) ? "array" : typeof t == "string" ? "string" : "unknown";
}
function Nn(...t) {
  const [e, n, r] = t;
  return typeof e == "string" ? {
    message: e,
    code: "custom",
    input: n,
    inst: r
  } : { ...e };
}
const di = (t, e) => {
  t.name = "$ZodError", Object.defineProperty(t, "_zod", {
    value: t._zod,
    enumerable: !1
  }), Object.defineProperty(t, "issues", {
    value: e,
    enumerable: !1
  }), t.message = JSON.stringify(e, Ur, 2), Object.defineProperty(t, "toString", {
    value: () => t.message,
    enumerable: !1
  });
}, fi = D("$ZodError", di), pi = D("$ZodError", di, { Parent: Error });
function ou(t, e = (n) => n.message) {
  const n = {}, r = [];
  for (const o of t.issues)
    o.path.length > 0 ? (n[o.path[0]] = n[o.path[0]] || [], n[o.path[0]].push(e(o))) : r.push(e(o));
  return { formErrors: r, fieldErrors: n };
}
function su(t, e = (n) => n.message) {
  const n = { _errors: [] }, r = (o) => {
    for (const s of o.issues)
      if (s.code === "invalid_union" && s.errors.length)
        s.errors.map((i) => r({ issues: i }));
      else if (s.code === "invalid_key")
        r({ issues: s.issues });
      else if (s.code === "invalid_element")
        r({ issues: s.issues });
      else if (s.path.length === 0)
        n._errors.push(e(s));
      else {
        let i = n, c = 0;
        for (; c < s.path.length; ) {
          const l = s.path[c];
          c === s.path.length - 1 ? (i[l] = i[l] || { _errors: [] }, i[l]._errors.push(e(s))) : i[l] = i[l] || { _errors: [] }, i = i[l], c++;
        }
      }
  };
  return r(t), n;
}
const ro = (t) => (e, n, r, o) => {
  const s = r ? Object.assign(r, { async: !1 }) : { async: !1 }, i = e._zod.run({ value: n, issues: [] }, s);
  if (i instanceof Promise)
    throw new en();
  if (i.issues.length) {
    const c = new (o?.Err ?? t)(i.issues.map((l) => Zt(l, s, Mt())));
    throw ai(c, o?.callee), c;
  }
  return i.value;
}, oo = (t) => async (e, n, r, o) => {
  const s = r ? Object.assign(r, { async: !0 }) : { async: !0 };
  let i = e._zod.run({ value: n, issues: [] }, s);
  if (i instanceof Promise && (i = await i), i.issues.length) {
    const c = new (o?.Err ?? t)(i.issues.map((l) => Zt(l, s, Mt())));
    throw ai(c, o?.callee), c;
  }
  return i.value;
}, hr = (t) => (e, n, r) => {
  const o = r ? { ...r, async: !1 } : { async: !1 }, s = e._zod.run({ value: n, issues: [] }, o);
  if (s instanceof Promise)
    throw new en();
  return s.issues.length ? {
    success: !1,
    error: new (t ?? fi)(s.issues.map((i) => Zt(i, o, Mt())))
  } : { success: !0, data: s.value };
}, iu = /* @__PURE__ */ hr(pi), mr = (t) => async (e, n, r) => {
  const o = r ? Object.assign(r, { async: !0 }) : { async: !0 };
  let s = e._zod.run({ value: n, issues: [] }, o);
  return s instanceof Promise && (s = await s), s.issues.length ? {
    success: !1,
    error: new t(s.issues.map((i) => Zt(i, o, Mt())))
  } : { success: !0, data: s.value };
}, cu = /* @__PURE__ */ mr(pi), lu = (t) => (e, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return ro(t)(e, n, o);
}, au = (t) => (e, n, r) => ro(t)(e, n, r), uu = (t) => async (e, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return oo(t)(e, n, o);
}, du = (t) => async (e, n, r) => oo(t)(e, n, r), fu = (t) => (e, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return hr(t)(e, n, o);
}, pu = (t) => (e, n, r) => hr(t)(e, n, r), hu = (t) => async (e, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return mr(t)(e, n, o);
}, mu = (t) => async (e, n, r) => mr(t)(e, n, r), gu = /^[cC][^\s-]{8,}$/, vu = /^[0-9a-z]+$/, yu = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/, bu = /^[0-9a-vA-V]{20}$/, wu = /^[A-Za-z0-9]{27}$/, Iu = /^[a-zA-Z0-9_-]{21}$/, _u = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/, Su = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/, Po = (t) => t ? new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${t}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/, xu = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/, Tu = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function Nu() {
  return new RegExp(Tu, "u");
}
const Cu = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, Ru = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/, Ou = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/, Eu = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, Du = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/, hi = /^[A-Za-z0-9_-]*$/, ku = /^\+[1-9]\d{6,14}$/, mi = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))", $u = /* @__PURE__ */ new RegExp(`^${mi}$`);
function gi(t) {
  const e = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof t.precision == "number" ? t.precision === -1 ? `${e}` : t.precision === 0 ? `${e}:[0-5]\\d` : `${e}:[0-5]\\d\\.\\d{${t.precision}}` : `${e}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function zu(t) {
  return new RegExp(`^${gi(t)}$`);
}
function Au(t) {
  const e = gi({ precision: t.precision }), n = ["Z"];
  t.local && n.push(""), t.offset && n.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  const r = `${e}(?:${n.join("|")})`;
  return new RegExp(`^${mi}T(?:${r})$`);
}
const Lu = (t) => {
  const e = t ? `[\\s\\S]{${t?.minimum ?? 0},${t?.maximum ?? ""}}` : "[\\s\\S]*";
  return new RegExp(`^${e}$`);
}, Pu = /^-?\d+$/, vi = /^-?\d+(?:\.\d+)?$/, Uu = /^(?:true|false)$/i, Mu = /^undefined$/i, Zu = /^[^A-Z]*$/, Bu = /^[^a-z]*$/, st = /* @__PURE__ */ D("$ZodCheck", (t, e) => {
  var n;
  t._zod ?? (t._zod = {}), t._zod.def = e, (n = t._zod).onattach ?? (n.onattach = []);
}), yi = {
  number: "number",
  bigint: "bigint",
  object: "date"
}, bi = /* @__PURE__ */ D("$ZodCheckLessThan", (t, e) => {
  st.init(t, e);
  const n = yi[typeof e.value];
  t._zod.onattach.push((r) => {
    const o = r._zod.bag, s = (e.inclusive ? o.maximum : o.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    e.value < s && (e.inclusive ? o.maximum = e.value : o.exclusiveMaximum = e.value);
  }), t._zod.check = (r) => {
    (e.inclusive ? r.value <= e.value : r.value < e.value) || r.issues.push({
      origin: n,
      code: "too_big",
      maximum: typeof e.value == "object" ? e.value.getTime() : e.value,
      input: r.value,
      inclusive: e.inclusive,
      inst: t,
      continue: !e.abort
    });
  };
}), wi = /* @__PURE__ */ D("$ZodCheckGreaterThan", (t, e) => {
  st.init(t, e);
  const n = yi[typeof e.value];
  t._zod.onattach.push((r) => {
    const o = r._zod.bag, s = (e.inclusive ? o.minimum : o.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    e.value > s && (e.inclusive ? o.minimum = e.value : o.exclusiveMinimum = e.value);
  }), t._zod.check = (r) => {
    (e.inclusive ? r.value >= e.value : r.value > e.value) || r.issues.push({
      origin: n,
      code: "too_small",
      minimum: typeof e.value == "object" ? e.value.getTime() : e.value,
      input: r.value,
      inclusive: e.inclusive,
      inst: t,
      continue: !e.abort
    });
  };
}), ju = /* @__PURE__ */ D("$ZodCheckMultipleOf", (t, e) => {
  st.init(t, e), t._zod.onattach.push((n) => {
    var r;
    (r = n._zod.bag).multipleOf ?? (r.multipleOf = e.value);
  }), t._zod.check = (n) => {
    if (typeof n.value != typeof e.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    (typeof n.value == "bigint" ? n.value % e.value === BigInt(0) : Ga(n.value, e.value) === 0) || n.issues.push({
      origin: typeof n.value,
      code: "not_multiple_of",
      divisor: e.value,
      input: n.value,
      inst: t,
      continue: !e.abort
    });
  };
}), Fu = /* @__PURE__ */ D("$ZodCheckNumberFormat", (t, e) => {
  st.init(t, e), e.format = e.format || "float64";
  const n = e.format?.includes("int"), r = n ? "int" : "number", [o, s] = Xa[e.format];
  t._zod.onattach.push((i) => {
    const c = i._zod.bag;
    c.format = e.format, c.minimum = o, c.maximum = s, n && (c.pattern = Pu);
  }), t._zod.check = (i) => {
    const c = i.value;
    if (n) {
      if (!Number.isInteger(c)) {
        i.issues.push({
          expected: r,
          format: e.format,
          code: "invalid_type",
          continue: !1,
          input: c,
          inst: t
        });
        return;
      }
      if (!Number.isSafeInteger(c)) {
        c > 0 ? i.issues.push({
          input: c,
          code: "too_big",
          maximum: Number.MAX_SAFE_INTEGER,
          note: "Integers must be within the safe integer range.",
          inst: t,
          origin: r,
          inclusive: !0,
          continue: !e.abort
        }) : i.issues.push({
          input: c,
          code: "too_small",
          minimum: Number.MIN_SAFE_INTEGER,
          note: "Integers must be within the safe integer range.",
          inst: t,
          origin: r,
          inclusive: !0,
          continue: !e.abort
        });
        return;
      }
    }
    c < o && i.issues.push({
      origin: "number",
      input: c,
      code: "too_small",
      minimum: o,
      inclusive: !0,
      inst: t,
      continue: !e.abort
    }), c > s && i.issues.push({
      origin: "number",
      input: c,
      code: "too_big",
      maximum: s,
      inclusive: !0,
      inst: t,
      continue: !e.abort
    });
  };
}), Vu = /* @__PURE__ */ D("$ZodCheckMaxLength", (t, e) => {
  var n;
  st.init(t, e), (n = t._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !eo(o) && o.length !== void 0;
  }), t._zod.onattach.push((r) => {
    const o = r._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    e.maximum < o && (r._zod.bag.maximum = e.maximum);
  }), t._zod.check = (r) => {
    const o = r.value;
    if (o.length <= e.maximum)
      return;
    const i = no(o);
    r.issues.push({
      origin: i,
      code: "too_big",
      maximum: e.maximum,
      inclusive: !0,
      input: o,
      inst: t,
      continue: !e.abort
    });
  };
}), Gu = /* @__PURE__ */ D("$ZodCheckMinLength", (t, e) => {
  var n;
  st.init(t, e), (n = t._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !eo(o) && o.length !== void 0;
  }), t._zod.onattach.push((r) => {
    const o = r._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    e.minimum > o && (r._zod.bag.minimum = e.minimum);
  }), t._zod.check = (r) => {
    const o = r.value;
    if (o.length >= e.minimum)
      return;
    const i = no(o);
    r.issues.push({
      origin: i,
      code: "too_small",
      minimum: e.minimum,
      inclusive: !0,
      input: o,
      inst: t,
      continue: !e.abort
    });
  };
}), Hu = /* @__PURE__ */ D("$ZodCheckLengthEquals", (t, e) => {
  var n;
  st.init(t, e), (n = t._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !eo(o) && o.length !== void 0;
  }), t._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.minimum = e.length, o.maximum = e.length, o.length = e.length;
  }), t._zod.check = (r) => {
    const o = r.value, s = o.length;
    if (s === e.length)
      return;
    const i = no(o), c = s > e.length;
    r.issues.push({
      origin: i,
      ...c ? { code: "too_big", maximum: e.length } : { code: "too_small", minimum: e.length },
      inclusive: !0,
      exact: !0,
      input: r.value,
      inst: t,
      continue: !e.abort
    });
  };
}), gr = /* @__PURE__ */ D("$ZodCheckStringFormat", (t, e) => {
  var n, r;
  st.init(t, e), t._zod.onattach.push((o) => {
    const s = o._zod.bag;
    s.format = e.format, e.pattern && (s.patterns ?? (s.patterns = /* @__PURE__ */ new Set()), s.patterns.add(e.pattern));
  }), e.pattern ? (n = t._zod).check ?? (n.check = (o) => {
    e.pattern.lastIndex = 0, !e.pattern.test(o.value) && o.issues.push({
      origin: "string",
      code: "invalid_format",
      format: e.format,
      input: o.value,
      ...e.pattern ? { pattern: e.pattern.toString() } : {},
      inst: t,
      continue: !e.abort
    });
  }) : (r = t._zod).check ?? (r.check = () => {
  });
}), Ju = /* @__PURE__ */ D("$ZodCheckRegex", (t, e) => {
  gr.init(t, e), t._zod.check = (n) => {
    e.pattern.lastIndex = 0, !e.pattern.test(n.value) && n.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: n.value,
      pattern: e.pattern.toString(),
      inst: t,
      continue: !e.abort
    });
  };
}), Ku = /* @__PURE__ */ D("$ZodCheckLowerCase", (t, e) => {
  e.pattern ?? (e.pattern = Zu), gr.init(t, e);
}), Wu = /* @__PURE__ */ D("$ZodCheckUpperCase", (t, e) => {
  e.pattern ?? (e.pattern = Bu), gr.init(t, e);
}), Xu = /* @__PURE__ */ D("$ZodCheckIncludes", (t, e) => {
  st.init(t, e);
  const n = cn(e.includes), r = new RegExp(typeof e.position == "number" ? `^.{${e.position}}${n}` : n);
  e.pattern = r, t._zod.onattach.push((o) => {
    const s = o._zod.bag;
    s.patterns ?? (s.patterns = /* @__PURE__ */ new Set()), s.patterns.add(r);
  }), t._zod.check = (o) => {
    o.value.includes(e.includes, e.position) || o.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: e.includes,
      input: o.value,
      inst: t,
      continue: !e.abort
    });
  };
}), Yu = /* @__PURE__ */ D("$ZodCheckStartsWith", (t, e) => {
  st.init(t, e);
  const n = new RegExp(`^${cn(e.prefix)}.*`);
  e.pattern ?? (e.pattern = n), t._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.patterns ?? (o.patterns = /* @__PURE__ */ new Set()), o.patterns.add(n);
  }), t._zod.check = (r) => {
    r.value.startsWith(e.prefix) || r.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: e.prefix,
      input: r.value,
      inst: t,
      continue: !e.abort
    });
  };
}), qu = /* @__PURE__ */ D("$ZodCheckEndsWith", (t, e) => {
  st.init(t, e);
  const n = new RegExp(`.*${cn(e.suffix)}$`);
  e.pattern ?? (e.pattern = n), t._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.patterns ?? (o.patterns = /* @__PURE__ */ new Set()), o.patterns.add(n);
  }), t._zod.check = (r) => {
    r.value.endsWith(e.suffix) || r.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: e.suffix,
      input: r.value,
      inst: t,
      continue: !e.abort
    });
  };
}), Qu = /* @__PURE__ */ D("$ZodCheckOverwrite", (t, e) => {
  st.init(t, e), t._zod.check = (n) => {
    n.value = e.tx(n.value);
  };
});
class ed {
  constructor(e = []) {
    this.content = [], this.indent = 0, this && (this.args = e);
  }
  indented(e) {
    this.indent += 1, e(this), this.indent -= 1;
  }
  write(e) {
    if (typeof e == "function") {
      e(this, { execution: "sync" }), e(this, { execution: "async" });
      return;
    }
    const r = e.split(`
`).filter((i) => i), o = Math.min(...r.map((i) => i.length - i.trimStart().length)), s = r.map((i) => i.slice(o)).map((i) => " ".repeat(this.indent * 2) + i);
    for (const i of s)
      this.content.push(i);
  }
  compile() {
    const e = Function, n = this?.args, o = [...(this?.content ?? [""]).map((s) => `  ${s}`)];
    return new e(...n, o.join(`
`));
  }
}
const td = {
  major: 4,
  minor: 3,
  patch: 6
}, Se = /* @__PURE__ */ D("$ZodType", (t, e) => {
  var n;
  t ?? (t = {}), t._zod.def = e, t._zod.bag = t._zod.bag || {}, t._zod.version = td;
  const r = [...t._zod.def.checks ?? []];
  t._zod.traits.has("$ZodCheck") && r.unshift(t);
  for (const o of r)
    for (const s of o._zod.onattach)
      s(t);
  if (r.length === 0)
    (n = t._zod).deferred ?? (n.deferred = []), t._zod.deferred?.push(() => {
      t._zod.run = t._zod.parse;
    });
  else {
    const o = (i, c, l) => {
      let a = Xt(i), u;
      for (const d of c) {
        if (d._zod.def.when) {
          if (!d._zod.def.when(i))
            continue;
        } else if (a)
          continue;
        const p = i.issues.length, h = d._zod.check(i);
        if (h instanceof Promise && l?.async === !1)
          throw new en();
        if (u || h instanceof Promise)
          u = (u ?? Promise.resolve()).then(async () => {
            await h, i.issues.length !== p && (a || (a = Xt(i, p)));
          });
        else {
          if (i.issues.length === p)
            continue;
          a || (a = Xt(i, p));
        }
      }
      return u ? u.then(() => i) : i;
    }, s = (i, c, l) => {
      if (Xt(i))
        return i.aborted = !0, i;
      const a = o(c, r, l);
      if (a instanceof Promise) {
        if (l.async === !1)
          throw new en();
        return a.then((u) => t._zod.parse(u, l));
      }
      return t._zod.parse(a, l);
    };
    t._zod.run = (i, c) => {
      if (c.skipChecks)
        return t._zod.parse(i, c);
      if (c.direction === "backward") {
        const a = t._zod.parse({ value: i.value, issues: [] }, { ...c, skipChecks: !0 });
        return a instanceof Promise ? a.then((u) => s(u, i, c)) : s(a, i, c);
      }
      const l = t._zod.parse(i, c);
      if (l instanceof Promise) {
        if (c.async === !1)
          throw new en();
        return l.then((a) => o(a, r, c));
      }
      return o(l, r, c);
    };
  }
  pe(t, "~standard", () => ({
    validate: (o) => {
      try {
        const s = iu(t, o);
        return s.success ? { value: s.data } : { issues: s.error?.issues };
      } catch {
        return cu(t, o).then((i) => i.success ? { value: i.data } : { issues: i.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  }));
}), so = /* @__PURE__ */ D("$ZodString", (t, e) => {
  Se.init(t, e), t._zod.pattern = [...t?._zod.bag?.patterns ?? []].pop() ?? Lu(t._zod.bag), t._zod.parse = (n, r) => {
    if (e.coerce)
      try {
        n.value = String(n.value);
      } catch {
      }
    return typeof n.value == "string" || n.issues.push({
      expected: "string",
      code: "invalid_type",
      input: n.value,
      inst: t
    }), n;
  };
}), xe = /* @__PURE__ */ D("$ZodStringFormat", (t, e) => {
  gr.init(t, e), so.init(t, e);
}), nd = /* @__PURE__ */ D("$ZodGUID", (t, e) => {
  e.pattern ?? (e.pattern = Su), xe.init(t, e);
}), rd = /* @__PURE__ */ D("$ZodUUID", (t, e) => {
  if (e.version) {
    const r = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    }[e.version];
    if (r === void 0)
      throw new Error(`Invalid UUID version: "${e.version}"`);
    e.pattern ?? (e.pattern = Po(r));
  } else
    e.pattern ?? (e.pattern = Po());
  xe.init(t, e);
}), od = /* @__PURE__ */ D("$ZodEmail", (t, e) => {
  e.pattern ?? (e.pattern = xu), xe.init(t, e);
}), sd = /* @__PURE__ */ D("$ZodURL", (t, e) => {
  xe.init(t, e), t._zod.check = (n) => {
    try {
      const r = n.value.trim(), o = new URL(r);
      e.hostname && (e.hostname.lastIndex = 0, e.hostname.test(o.hostname) || n.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid hostname",
        pattern: e.hostname.source,
        input: n.value,
        inst: t,
        continue: !e.abort
      })), e.protocol && (e.protocol.lastIndex = 0, e.protocol.test(o.protocol.endsWith(":") ? o.protocol.slice(0, -1) : o.protocol) || n.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid protocol",
        pattern: e.protocol.source,
        input: n.value,
        inst: t,
        continue: !e.abort
      })), e.normalize ? n.value = o.href : n.value = r;
      return;
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "url",
        input: n.value,
        inst: t,
        continue: !e.abort
      });
    }
  };
}), id = /* @__PURE__ */ D("$ZodEmoji", (t, e) => {
  e.pattern ?? (e.pattern = Nu()), xe.init(t, e);
}), cd = /* @__PURE__ */ D("$ZodNanoID", (t, e) => {
  e.pattern ?? (e.pattern = Iu), xe.init(t, e);
}), ld = /* @__PURE__ */ D("$ZodCUID", (t, e) => {
  e.pattern ?? (e.pattern = gu), xe.init(t, e);
}), ad = /* @__PURE__ */ D("$ZodCUID2", (t, e) => {
  e.pattern ?? (e.pattern = vu), xe.init(t, e);
}), ud = /* @__PURE__ */ D("$ZodULID", (t, e) => {
  e.pattern ?? (e.pattern = yu), xe.init(t, e);
}), dd = /* @__PURE__ */ D("$ZodXID", (t, e) => {
  e.pattern ?? (e.pattern = bu), xe.init(t, e);
}), fd = /* @__PURE__ */ D("$ZodKSUID", (t, e) => {
  e.pattern ?? (e.pattern = wu), xe.init(t, e);
}), pd = /* @__PURE__ */ D("$ZodISODateTime", (t, e) => {
  e.pattern ?? (e.pattern = Au(e)), xe.init(t, e);
}), hd = /* @__PURE__ */ D("$ZodISODate", (t, e) => {
  e.pattern ?? (e.pattern = $u), xe.init(t, e);
}), md = /* @__PURE__ */ D("$ZodISOTime", (t, e) => {
  e.pattern ?? (e.pattern = zu(e)), xe.init(t, e);
}), gd = /* @__PURE__ */ D("$ZodISODuration", (t, e) => {
  e.pattern ?? (e.pattern = _u), xe.init(t, e);
}), vd = /* @__PURE__ */ D("$ZodIPv4", (t, e) => {
  e.pattern ?? (e.pattern = Cu), xe.init(t, e), t._zod.bag.format = "ipv4";
}), yd = /* @__PURE__ */ D("$ZodIPv6", (t, e) => {
  e.pattern ?? (e.pattern = Ru), xe.init(t, e), t._zod.bag.format = "ipv6", t._zod.check = (n) => {
    try {
      new URL(`http://[${n.value}]`);
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: n.value,
        inst: t,
        continue: !e.abort
      });
    }
  };
}), bd = /* @__PURE__ */ D("$ZodCIDRv4", (t, e) => {
  e.pattern ?? (e.pattern = Ou), xe.init(t, e);
}), wd = /* @__PURE__ */ D("$ZodCIDRv6", (t, e) => {
  e.pattern ?? (e.pattern = Eu), xe.init(t, e), t._zod.check = (n) => {
    const r = n.value.split("/");
    try {
      if (r.length !== 2)
        throw new Error();
      const [o, s] = r;
      if (!s)
        throw new Error();
      const i = Number(s);
      if (`${i}` !== s)
        throw new Error();
      if (i < 0 || i > 128)
        throw new Error();
      new URL(`http://[${o}]`);
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: n.value,
        inst: t,
        continue: !e.abort
      });
    }
  };
});
function Ii(t) {
  if (t === "")
    return !0;
  if (t.length % 4 !== 0)
    return !1;
  try {
    return atob(t), !0;
  } catch {
    return !1;
  }
}
const Id = /* @__PURE__ */ D("$ZodBase64", (t, e) => {
  e.pattern ?? (e.pattern = Du), xe.init(t, e), t._zod.bag.contentEncoding = "base64", t._zod.check = (n) => {
    Ii(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64",
      input: n.value,
      inst: t,
      continue: !e.abort
    });
  };
});
function _d(t) {
  if (!hi.test(t))
    return !1;
  const e = t.replace(/[-_]/g, (r) => r === "-" ? "+" : "/"), n = e.padEnd(Math.ceil(e.length / 4) * 4, "=");
  return Ii(n);
}
const Sd = /* @__PURE__ */ D("$ZodBase64URL", (t, e) => {
  e.pattern ?? (e.pattern = hi), xe.init(t, e), t._zod.bag.contentEncoding = "base64url", t._zod.check = (n) => {
    _d(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: n.value,
      inst: t,
      continue: !e.abort
    });
  };
}), xd = /* @__PURE__ */ D("$ZodE164", (t, e) => {
  e.pattern ?? (e.pattern = ku), xe.init(t, e);
});
function Td(t, e = null) {
  try {
    const n = t.split(".");
    if (n.length !== 3)
      return !1;
    const [r] = n;
    if (!r)
      return !1;
    const o = JSON.parse(atob(r));
    return !("typ" in o && o?.typ !== "JWT" || !o.alg || e && (!("alg" in o) || o.alg !== e));
  } catch {
    return !1;
  }
}
const Nd = /* @__PURE__ */ D("$ZodJWT", (t, e) => {
  xe.init(t, e), t._zod.check = (n) => {
    Td(n.value, e.alg) || n.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: n.value,
      inst: t,
      continue: !e.abort
    });
  };
}), _i = /* @__PURE__ */ D("$ZodNumber", (t, e) => {
  Se.init(t, e), t._zod.pattern = t._zod.bag.pattern ?? vi, t._zod.parse = (n, r) => {
    if (e.coerce)
      try {
        n.value = Number(n.value);
      } catch {
      }
    const o = n.value;
    if (typeof o == "number" && !Number.isNaN(o) && Number.isFinite(o))
      return n;
    const s = typeof o == "number" ? Number.isNaN(o) ? "NaN" : Number.isFinite(o) ? void 0 : "Infinity" : void 0;
    return n.issues.push({
      expected: "number",
      code: "invalid_type",
      input: o,
      inst: t,
      ...s ? { received: s } : {}
    }), n;
  };
}), Cd = /* @__PURE__ */ D("$ZodNumberFormat", (t, e) => {
  Fu.init(t, e), _i.init(t, e);
}), Rd = /* @__PURE__ */ D("$ZodBoolean", (t, e) => {
  Se.init(t, e), t._zod.pattern = Uu, t._zod.parse = (n, r) => {
    if (e.coerce)
      try {
        n.value = !!n.value;
      } catch {
      }
    const o = n.value;
    return typeof o == "boolean" || n.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input: o,
      inst: t
    }), n;
  };
}), Od = /* @__PURE__ */ D("$ZodUndefined", (t, e) => {
  Se.init(t, e), t._zod.pattern = Mu, t._zod.values = /* @__PURE__ */ new Set([void 0]), t._zod.optin = "optional", t._zod.optout = "optional", t._zod.parse = (n, r) => {
    const o = n.value;
    return typeof o > "u" || n.issues.push({
      expected: "undefined",
      code: "invalid_type",
      input: o,
      inst: t
    }), n;
  };
}), Ed = /* @__PURE__ */ D("$ZodUnknown", (t, e) => {
  Se.init(t, e), t._zod.parse = (n) => n;
}), Dd = /* @__PURE__ */ D("$ZodNever", (t, e) => {
  Se.init(t, e), t._zod.parse = (n, r) => (n.issues.push({
    expected: "never",
    code: "invalid_type",
    input: n.value,
    inst: t
  }), n);
});
function Uo(t, e, n) {
  t.issues.length && e.issues.push(...Yt(n, t.issues)), e.value[n] = t.value;
}
const kd = /* @__PURE__ */ D("$ZodArray", (t, e) => {
  Se.init(t, e), t._zod.parse = (n, r) => {
    const o = n.value;
    if (!Array.isArray(o))
      return n.issues.push({
        expected: "array",
        code: "invalid_type",
        input: o,
        inst: t
      }), n;
    n.value = Array(o.length);
    const s = [];
    for (let i = 0; i < o.length; i++) {
      const c = o[i], l = e.element._zod.run({
        value: c,
        issues: []
      }, r);
      l instanceof Promise ? s.push(l.then((a) => Uo(a, n, i))) : Uo(l, n, i);
    }
    return s.length ? Promise.all(s).then(() => n) : n;
  };
});
function Xn(t, e, n, r, o) {
  if (t.issues.length) {
    if (o && !(n in r))
      return;
    e.issues.push(...Yt(n, t.issues));
  }
  t.value === void 0 ? n in r && (e.value[n] = void 0) : e.value[n] = t.value;
}
function Si(t) {
  const e = Object.keys(t.shape);
  for (const r of e)
    if (!t.shape?.[r]?._zod?.traits?.has("$ZodType"))
      throw new Error(`Invalid element at key "${r}": expected a Zod schema`);
  const n = Wa(t.shape);
  return {
    ...t,
    keys: e,
    keySet: new Set(e),
    numKeys: e.length,
    optionalKeys: new Set(n)
  };
}
function xi(t, e, n, r, o, s) {
  const i = [], c = o.keySet, l = o.catchall._zod, a = l.def.type, u = l.optout === "optional";
  for (const d in e) {
    if (c.has(d))
      continue;
    if (a === "never") {
      i.push(d);
      continue;
    }
    const p = l.run({ value: e[d], issues: [] }, r);
    p instanceof Promise ? t.push(p.then((h) => Xn(h, n, d, e, u))) : Xn(p, n, d, e, u);
  }
  return i.length && n.issues.push({
    code: "unrecognized_keys",
    keys: i,
    input: e,
    inst: s
  }), t.length ? Promise.all(t).then(() => n) : n;
}
const $d = /* @__PURE__ */ D("$ZodObject", (t, e) => {
  if (Se.init(t, e), !Object.getOwnPropertyDescriptor(e, "shape")?.get) {
    const c = e.shape;
    Object.defineProperty(e, "shape", {
      get: () => {
        const l = { ...c };
        return Object.defineProperty(e, "shape", {
          value: l
        }), l;
      }
    });
  }
  const r = pr(() => Si(e));
  pe(t._zod, "propValues", () => {
    const c = e.shape, l = {};
    for (const a in c) {
      const u = c[a]._zod;
      if (u.values) {
        l[a] ?? (l[a] = /* @__PURE__ */ new Set());
        for (const d of u.values)
          l[a].add(d);
      }
    }
    return l;
  });
  const o = Tn, s = e.catchall;
  let i;
  t._zod.parse = (c, l) => {
    i ?? (i = r.value);
    const a = c.value;
    if (!o(a))
      return c.issues.push({
        expected: "object",
        code: "invalid_type",
        input: a,
        inst: t
      }), c;
    c.value = {};
    const u = [], d = i.shape;
    for (const p of i.keys) {
      const h = d[p], v = h._zod.optout === "optional", m = h._zod.run({ value: a[p], issues: [] }, l);
      m instanceof Promise ? u.push(m.then((g) => Xn(g, c, p, a, v))) : Xn(m, c, p, a, v);
    }
    return s ? xi(u, a, c, l, r.value, t) : u.length ? Promise.all(u).then(() => c) : c;
  };
}), zd = /* @__PURE__ */ D("$ZodObjectJIT", (t, e) => {
  $d.init(t, e);
  const n = t._zod.parse, r = pr(() => Si(e)), o = (p) => {
    const h = new ed(["shape", "payload", "ctx"]), v = r.value, m = (b) => {
      const x = Lo(b);
      return `shape[${x}]._zod.run({ value: input[${x}], issues: [] }, ctx)`;
    };
    h.write("const input = payload.value;");
    const g = /* @__PURE__ */ Object.create(null);
    let I = 0;
    for (const b of v.keys)
      g[b] = `key_${I++}`;
    h.write("const newResult = {};");
    for (const b of v.keys) {
      const x = g[b], S = Lo(b), O = p[b]?._zod?.optout === "optional";
      h.write(`const ${x} = ${m(b)};`), O ? h.write(`
        if (${x}.issues.length) {
          if (${S} in input) {
            payload.issues = payload.issues.concat(${x}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${S}, ...iss.path] : [${S}]
            })));
          }
        }
        
        if (${x}.value === undefined) {
          if (${S} in input) {
            newResult[${S}] = undefined;
          }
        } else {
          newResult[${S}] = ${x}.value;
        }
        
      `) : h.write(`
        if (${x}.issues.length) {
          payload.issues = payload.issues.concat(${x}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${S}, ...iss.path] : [${S}]
          })));
        }
        
        if (${x}.value === undefined) {
          if (${S} in input) {
            newResult[${S}] = undefined;
          }
        } else {
          newResult[${S}] = ${x}.value;
        }
        
      `);
    }
    h.write("payload.value = newResult;"), h.write("return payload;");
    const T = h.compile();
    return (b, x) => T(p, b, x);
  };
  let s;
  const i = Tn, c = !ci.jitless, a = c && Ja.value, u = e.catchall;
  let d;
  t._zod.parse = (p, h) => {
    d ?? (d = r.value);
    const v = p.value;
    return i(v) ? c && a && h?.async === !1 && h.jitless !== !0 ? (s || (s = o(e.shape)), p = s(p, h), u ? xi([], v, p, h, d, t) : p) : n(p, h) : (p.issues.push({
      expected: "object",
      code: "invalid_type",
      input: v,
      inst: t
    }), p);
  };
});
function Mo(t, e, n, r) {
  for (const s of t)
    if (s.issues.length === 0)
      return e.value = s.value, e;
  const o = t.filter((s) => !Xt(s));
  return o.length === 1 ? (e.value = o[0].value, o[0]) : (e.issues.push({
    code: "invalid_union",
    input: e.value,
    inst: n,
    errors: t.map((s) => s.issues.map((i) => Zt(i, r, Mt())))
  }), e);
}
const Ti = /* @__PURE__ */ D("$ZodUnion", (t, e) => {
  Se.init(t, e), pe(t._zod, "optin", () => e.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0), pe(t._zod, "optout", () => e.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0), pe(t._zod, "values", () => {
    if (e.options.every((o) => o._zod.values))
      return new Set(e.options.flatMap((o) => Array.from(o._zod.values)));
  }), pe(t._zod, "pattern", () => {
    if (e.options.every((o) => o._zod.pattern)) {
      const o = e.options.map((s) => s._zod.pattern);
      return new RegExp(`^(${o.map((s) => to(s.source)).join("|")})$`);
    }
  });
  const n = e.options.length === 1, r = e.options[0]._zod.run;
  t._zod.parse = (o, s) => {
    if (n)
      return r(o, s);
    let i = !1;
    const c = [];
    for (const l of e.options) {
      const a = l._zod.run({
        value: o.value,
        issues: []
      }, s);
      if (a instanceof Promise)
        c.push(a), i = !0;
      else {
        if (a.issues.length === 0)
          return a;
        c.push(a);
      }
    }
    return i ? Promise.all(c).then((l) => Mo(l, o, t, s)) : Mo(c, o, t, s);
  };
}), Ad = /* @__PURE__ */ D("$ZodDiscriminatedUnion", (t, e) => {
  e.inclusive = !1, Ti.init(t, e);
  const n = t._zod.parse;
  pe(t._zod, "propValues", () => {
    const o = {};
    for (const s of e.options) {
      const i = s._zod.propValues;
      if (!i || Object.keys(i).length === 0)
        throw new Error(`Invalid discriminated union option at index "${e.options.indexOf(s)}"`);
      for (const [c, l] of Object.entries(i)) {
        o[c] || (o[c] = /* @__PURE__ */ new Set());
        for (const a of l)
          o[c].add(a);
      }
    }
    return o;
  });
  const r = pr(() => {
    const o = e.options, s = /* @__PURE__ */ new Map();
    for (const i of o) {
      const c = i._zod.propValues?.[e.discriminator];
      if (!c || c.size === 0)
        throw new Error(`Invalid discriminated union option at index "${e.options.indexOf(i)}"`);
      for (const l of c) {
        if (s.has(l))
          throw new Error(`Duplicate discriminator value "${String(l)}"`);
        s.set(l, i);
      }
    }
    return s;
  });
  t._zod.parse = (o, s) => {
    const i = o.value;
    if (!Tn(i))
      return o.issues.push({
        code: "invalid_type",
        expected: "object",
        input: i,
        inst: t
      }), o;
    const c = r.value.get(i?.[e.discriminator]);
    return c ? c._zod.run(o, s) : e.unionFallback ? n(o, s) : (o.issues.push({
      code: "invalid_union",
      errors: [],
      note: "No matching discriminator",
      discriminator: e.discriminator,
      input: i,
      path: [e.discriminator],
      inst: t
    }), o);
  };
}), Ld = /* @__PURE__ */ D("$ZodIntersection", (t, e) => {
  Se.init(t, e), t._zod.parse = (n, r) => {
    const o = n.value, s = e.left._zod.run({ value: o, issues: [] }, r), i = e.right._zod.run({ value: o, issues: [] }, r);
    return s instanceof Promise || i instanceof Promise ? Promise.all([s, i]).then(([l, a]) => Zo(n, l, a)) : Zo(n, s, i);
  };
});
function Mr(t, e) {
  if (t === e)
    return { valid: !0, data: t };
  if (t instanceof Date && e instanceof Date && +t == +e)
    return { valid: !0, data: t };
  if (sn(t) && sn(e)) {
    const n = Object.keys(e), r = Object.keys(t).filter((s) => n.indexOf(s) !== -1), o = { ...t, ...e };
    for (const s of r) {
      const i = Mr(t[s], e[s]);
      if (!i.valid)
        return {
          valid: !1,
          mergeErrorPath: [s, ...i.mergeErrorPath]
        };
      o[s] = i.data;
    }
    return { valid: !0, data: o };
  }
  if (Array.isArray(t) && Array.isArray(e)) {
    if (t.length !== e.length)
      return { valid: !1, mergeErrorPath: [] };
    const n = [];
    for (let r = 0; r < t.length; r++) {
      const o = t[r], s = e[r], i = Mr(o, s);
      if (!i.valid)
        return {
          valid: !1,
          mergeErrorPath: [r, ...i.mergeErrorPath]
        };
      n.push(i.data);
    }
    return { valid: !0, data: n };
  }
  return { valid: !1, mergeErrorPath: [] };
}
function Zo(t, e, n) {
  const r = /* @__PURE__ */ new Map();
  let o;
  for (const c of e.issues)
    if (c.code === "unrecognized_keys") {
      o ?? (o = c);
      for (const l of c.keys)
        r.has(l) || r.set(l, {}), r.get(l).l = !0;
    } else
      t.issues.push(c);
  for (const c of n.issues)
    if (c.code === "unrecognized_keys")
      for (const l of c.keys)
        r.has(l) || r.set(l, {}), r.get(l).r = !0;
    else
      t.issues.push(c);
  const s = [...r].filter(([, c]) => c.l && c.r).map(([c]) => c);
  if (s.length && o && t.issues.push({ ...o, keys: s }), Xt(t))
    return t;
  const i = Mr(e.value, n.value);
  if (!i.valid)
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(i.mergeErrorPath)}`);
  return t.value = i.data, t;
}
const Pd = /* @__PURE__ */ D("$ZodRecord", (t, e) => {
  Se.init(t, e), t._zod.parse = (n, r) => {
    const o = n.value;
    if (!sn(o))
      return n.issues.push({
        expected: "record",
        code: "invalid_type",
        input: o,
        inst: t
      }), n;
    const s = [], i = e.keyType._zod.values;
    if (i) {
      n.value = {};
      const c = /* @__PURE__ */ new Set();
      for (const a of i)
        if (typeof a == "string" || typeof a == "number" || typeof a == "symbol") {
          c.add(typeof a == "number" ? a.toString() : a);
          const u = e.valueType._zod.run({ value: o[a], issues: [] }, r);
          u instanceof Promise ? s.push(u.then((d) => {
            d.issues.length && n.issues.push(...Yt(a, d.issues)), n.value[a] = d.value;
          })) : (u.issues.length && n.issues.push(...Yt(a, u.issues)), n.value[a] = u.value);
        }
      let l;
      for (const a in o)
        c.has(a) || (l = l ?? [], l.push(a));
      l && l.length > 0 && n.issues.push({
        code: "unrecognized_keys",
        input: o,
        inst: t,
        keys: l
      });
    } else {
      n.value = {};
      for (const c of Reflect.ownKeys(o)) {
        if (c === "__proto__")
          continue;
        let l = e.keyType._zod.run({ value: c, issues: [] }, r);
        if (l instanceof Promise)
          throw new Error("Async schemas not supported in object keys currently");
        if (typeof c == "string" && vi.test(c) && l.issues.length) {
          const d = e.keyType._zod.run({ value: Number(c), issues: [] }, r);
          if (d instanceof Promise)
            throw new Error("Async schemas not supported in object keys currently");
          d.issues.length === 0 && (l = d);
        }
        if (l.issues.length) {
          e.mode === "loose" ? n.value[c] = o[c] : n.issues.push({
            code: "invalid_key",
            origin: "record",
            issues: l.issues.map((d) => Zt(d, r, Mt())),
            input: c,
            path: [c],
            inst: t
          });
          continue;
        }
        const u = e.valueType._zod.run({ value: o[c], issues: [] }, r);
        u instanceof Promise ? s.push(u.then((d) => {
          d.issues.length && n.issues.push(...Yt(c, d.issues)), n.value[l.value] = d.value;
        })) : (u.issues.length && n.issues.push(...Yt(c, u.issues)), n.value[l.value] = u.value);
      }
    }
    return s.length ? Promise.all(s).then(() => n) : n;
  };
}), Ud = /* @__PURE__ */ D("$ZodEnum", (t, e) => {
  Se.init(t, e);
  const n = li(e.entries), r = new Set(n);
  t._zod.values = r, t._zod.pattern = new RegExp(`^(${n.filter((o) => Ka.has(typeof o)).map((o) => typeof o == "string" ? cn(o) : o.toString()).join("|")})$`), t._zod.parse = (o, s) => {
    const i = o.value;
    return r.has(i) || o.issues.push({
      code: "invalid_value",
      values: n,
      input: i,
      inst: t
    }), o;
  };
}), Md = /* @__PURE__ */ D("$ZodLiteral", (t, e) => {
  if (Se.init(t, e), e.values.length === 0)
    throw new Error("Cannot create literal schema with no valid values");
  const n = new Set(e.values);
  t._zod.values = n, t._zod.pattern = new RegExp(`^(${e.values.map((r) => typeof r == "string" ? cn(r) : r ? cn(r.toString()) : String(r)).join("|")})$`), t._zod.parse = (r, o) => {
    const s = r.value;
    return n.has(s) || r.issues.push({
      code: "invalid_value",
      values: e.values,
      input: s,
      inst: t
    }), r;
  };
}), Zd = /* @__PURE__ */ D("$ZodTransform", (t, e) => {
  Se.init(t, e), t._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new ii(t.constructor.name);
    const o = e.transform(n.value, n);
    if (r.async)
      return (o instanceof Promise ? o : Promise.resolve(o)).then((i) => (n.value = i, n));
    if (o instanceof Promise)
      throw new en();
    return n.value = o, n;
  };
});
function Bo(t, e) {
  return t.issues.length && e === void 0 ? { issues: [], value: void 0 } : t;
}
const Ni = /* @__PURE__ */ D("$ZodOptional", (t, e) => {
  Se.init(t, e), t._zod.optin = "optional", t._zod.optout = "optional", pe(t._zod, "values", () => e.innerType._zod.values ? /* @__PURE__ */ new Set([...e.innerType._zod.values, void 0]) : void 0), pe(t._zod, "pattern", () => {
    const n = e.innerType._zod.pattern;
    return n ? new RegExp(`^(${to(n.source)})?$`) : void 0;
  }), t._zod.parse = (n, r) => {
    if (e.innerType._zod.optin === "optional") {
      const o = e.innerType._zod.run(n, r);
      return o instanceof Promise ? o.then((s) => Bo(s, n.value)) : Bo(o, n.value);
    }
    return n.value === void 0 ? n : e.innerType._zod.run(n, r);
  };
}), Bd = /* @__PURE__ */ D("$ZodExactOptional", (t, e) => {
  Ni.init(t, e), pe(t._zod, "values", () => e.innerType._zod.values), pe(t._zod, "pattern", () => e.innerType._zod.pattern), t._zod.parse = (n, r) => e.innerType._zod.run(n, r);
}), jd = /* @__PURE__ */ D("$ZodNullable", (t, e) => {
  Se.init(t, e), pe(t._zod, "optin", () => e.innerType._zod.optin), pe(t._zod, "optout", () => e.innerType._zod.optout), pe(t._zod, "pattern", () => {
    const n = e.innerType._zod.pattern;
    return n ? new RegExp(`^(${to(n.source)}|null)$`) : void 0;
  }), pe(t._zod, "values", () => e.innerType._zod.values ? /* @__PURE__ */ new Set([...e.innerType._zod.values, null]) : void 0), t._zod.parse = (n, r) => n.value === null ? n : e.innerType._zod.run(n, r);
}), Fd = /* @__PURE__ */ D("$ZodDefault", (t, e) => {
  Se.init(t, e), t._zod.optin = "optional", pe(t._zod, "values", () => e.innerType._zod.values), t._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return e.innerType._zod.run(n, r);
    if (n.value === void 0)
      return n.value = e.defaultValue, n;
    const o = e.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((s) => jo(s, e)) : jo(o, e);
  };
});
function jo(t, e) {
  return t.value === void 0 && (t.value = e.defaultValue), t;
}
const Vd = /* @__PURE__ */ D("$ZodPrefault", (t, e) => {
  Se.init(t, e), t._zod.optin = "optional", pe(t._zod, "values", () => e.innerType._zod.values), t._zod.parse = (n, r) => (r.direction === "backward" || n.value === void 0 && (n.value = e.defaultValue), e.innerType._zod.run(n, r));
}), Gd = /* @__PURE__ */ D("$ZodNonOptional", (t, e) => {
  Se.init(t, e), pe(t._zod, "values", () => {
    const n = e.innerType._zod.values;
    return n ? new Set([...n].filter((r) => r !== void 0)) : void 0;
  }), t._zod.parse = (n, r) => {
    const o = e.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((s) => Fo(s, t)) : Fo(o, t);
  };
});
function Fo(t, e) {
  return !t.issues.length && t.value === void 0 && t.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: t.value,
    inst: e
  }), t;
}
const Hd = /* @__PURE__ */ D("$ZodCatch", (t, e) => {
  Se.init(t, e), pe(t._zod, "optin", () => e.innerType._zod.optin), pe(t._zod, "optout", () => e.innerType._zod.optout), pe(t._zod, "values", () => e.innerType._zod.values), t._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return e.innerType._zod.run(n, r);
    const o = e.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((s) => (n.value = s.value, s.issues.length && (n.value = e.catchValue({
      ...n,
      error: {
        issues: s.issues.map((i) => Zt(i, r, Mt()))
      },
      input: n.value
    }), n.issues = []), n)) : (n.value = o.value, o.issues.length && (n.value = e.catchValue({
      ...n,
      error: {
        issues: o.issues.map((s) => Zt(s, r, Mt()))
      },
      input: n.value
    }), n.issues = []), n);
  };
}), Jd = /* @__PURE__ */ D("$ZodPipe", (t, e) => {
  Se.init(t, e), pe(t._zod, "values", () => e.in._zod.values), pe(t._zod, "optin", () => e.in._zod.optin), pe(t._zod, "optout", () => e.out._zod.optout), pe(t._zod, "propValues", () => e.in._zod.propValues), t._zod.parse = (n, r) => {
    if (r.direction === "backward") {
      const s = e.out._zod.run(n, r);
      return s instanceof Promise ? s.then((i) => Un(i, e.in, r)) : Un(s, e.in, r);
    }
    const o = e.in._zod.run(n, r);
    return o instanceof Promise ? o.then((s) => Un(s, e.out, r)) : Un(o, e.out, r);
  };
});
function Un(t, e, n) {
  return t.issues.length ? (t.aborted = !0, t) : e._zod.run({ value: t.value, issues: t.issues }, n);
}
const Kd = /* @__PURE__ */ D("$ZodReadonly", (t, e) => {
  Se.init(t, e), pe(t._zod, "propValues", () => e.innerType._zod.propValues), pe(t._zod, "values", () => e.innerType._zod.values), pe(t._zod, "optin", () => e.innerType?._zod?.optin), pe(t._zod, "optout", () => e.innerType?._zod?.optout), t._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return e.innerType._zod.run(n, r);
    const o = e.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then(Vo) : Vo(o);
  };
});
function Vo(t) {
  return t.value = Object.freeze(t.value), t;
}
const Wd = /* @__PURE__ */ D("$ZodCustom", (t, e) => {
  st.init(t, e), Se.init(t, e), t._zod.parse = (n, r) => n, t._zod.check = (n) => {
    const r = n.value, o = e.fn(r);
    if (o instanceof Promise)
      return o.then((s) => Go(s, n, r, t));
    Go(o, n, r, t);
  };
});
function Go(t, e, n, r) {
  if (!t) {
    const o = {
      code: "custom",
      input: n,
      inst: r,
      // incorporates params.error into issue reporting
      path: [...r._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !r._zod.def.abort
      // params: inst._zod.def.params,
    };
    r._zod.def.params && (o.params = r._zod.def.params), e.issues.push(Nn(o));
  }
}
var Ho;
class Xd {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map();
  }
  add(e, ...n) {
    const r = n[0];
    return this._map.set(e, r), r && typeof r == "object" && "id" in r && this._idmap.set(r.id, e), this;
  }
  clear() {
    return this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map(), this;
  }
  remove(e) {
    const n = this._map.get(e);
    return n && typeof n == "object" && "id" in n && this._idmap.delete(n.id), this._map.delete(e), this;
  }
  get(e) {
    const n = e._zod.parent;
    if (n) {
      const r = { ...this.get(n) ?? {} };
      delete r.id;
      const o = { ...r, ...this._map.get(e) };
      return Object.keys(o).length ? o : void 0;
    }
    return this._map.get(e);
  }
  has(e) {
    return this._map.has(e);
  }
}
function Yd() {
  return new Xd();
}
(Ho = globalThis).__zod_globalRegistry ?? (Ho.__zod_globalRegistry = Yd());
const pn = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function qd(t, e) {
  return new t({
    type: "string",
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Qd(t, e) {
  return new t({
    type: "string",
    format: "email",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Jo(t, e) {
  return new t({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Ci(t, e) {
  return new t({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function ef(t, e) {
  return new t({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v4",
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function tf(t, e) {
  return new t({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v6",
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function nf(t, e) {
  return new t({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v7",
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function rf(t, e) {
  return new t({
    type: "string",
    format: "url",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function of(t, e) {
  return new t({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function sf(t, e) {
  return new t({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function cf(t, e) {
  return new t({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function lf(t, e) {
  return new t({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function af(t, e) {
  return new t({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function uf(t, e) {
  return new t({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function df(t, e) {
  return new t({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function ff(t, e) {
  return new t({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function pf(t, e) {
  return new t({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function hf(t, e) {
  return new t({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function mf(t, e) {
  return new t({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function gf(t, e) {
  return new t({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function vf(t, e) {
  return new t({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function yf(t, e) {
  return new t({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function bf(t, e) {
  return new t({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: !1,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function wf(t, e) {
  return new t({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: !1,
    local: !1,
    precision: null,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function If(t, e) {
  return new t({
    type: "string",
    format: "date",
    check: "string_format",
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function _f(t, e) {
  return new t({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Sf(t, e) {
  return new t({
    type: "string",
    format: "duration",
    check: "string_format",
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function xf(t, e) {
  return new t({
    type: "number",
    checks: [],
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Tf(t, e) {
  return new t({
    type: "number",
    coerce: !0,
    checks: [],
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Nf(t, e) {
  return new t({
    type: "number",
    check: "number_format",
    abort: !1,
    format: "safeint",
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Cf(t, e) {
  return new t({
    type: "boolean",
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Rf(t, e) {
  return new t({
    type: "undefined",
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Of(t) {
  return new t({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function Ef(t, e) {
  return new t({
    type: "never",
    ...J(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Ko(t, e) {
  return new bi({
    check: "less_than",
    ...J(e),
    value: t,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function Rr(t, e) {
  return new bi({
    check: "less_than",
    ...J(e),
    value: t,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function Wo(t, e) {
  return new wi({
    check: "greater_than",
    ...J(e),
    value: t,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function Or(t, e) {
  return new wi({
    check: "greater_than",
    ...J(e),
    value: t,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function Xo(t, e) {
  return new ju({
    check: "multiple_of",
    ...J(e),
    value: t
  });
}
// @__NO_SIDE_EFFECTS__
function Ri(t, e) {
  return new Vu({
    check: "max_length",
    ...J(e),
    maximum: t
  });
}
// @__NO_SIDE_EFFECTS__
function Yn(t, e) {
  return new Gu({
    check: "min_length",
    ...J(e),
    minimum: t
  });
}
// @__NO_SIDE_EFFECTS__
function Oi(t, e) {
  return new Hu({
    check: "length_equals",
    ...J(e),
    length: t
  });
}
// @__NO_SIDE_EFFECTS__
function Df(t, e) {
  return new Ju({
    check: "string_format",
    format: "regex",
    ...J(e),
    pattern: t
  });
}
// @__NO_SIDE_EFFECTS__
function kf(t) {
  return new Ku({
    check: "string_format",
    format: "lowercase",
    ...J(t)
  });
}
// @__NO_SIDE_EFFECTS__
function $f(t) {
  return new Wu({
    check: "string_format",
    format: "uppercase",
    ...J(t)
  });
}
// @__NO_SIDE_EFFECTS__
function zf(t, e) {
  return new Xu({
    check: "string_format",
    format: "includes",
    ...J(e),
    includes: t
  });
}
// @__NO_SIDE_EFFECTS__
function Af(t, e) {
  return new Yu({
    check: "string_format",
    format: "starts_with",
    ...J(e),
    prefix: t
  });
}
// @__NO_SIDE_EFFECTS__
function Lf(t, e) {
  return new qu({
    check: "string_format",
    format: "ends_with",
    ...J(e),
    suffix: t
  });
}
// @__NO_SIDE_EFFECTS__
function un(t) {
  return new Qu({
    check: "overwrite",
    tx: t
  });
}
// @__NO_SIDE_EFFECTS__
function Pf(t) {
  return /* @__PURE__ */ un((e) => e.normalize(t));
}
// @__NO_SIDE_EFFECTS__
function Uf() {
  return /* @__PURE__ */ un((t) => t.trim());
}
// @__NO_SIDE_EFFECTS__
function Mf() {
  return /* @__PURE__ */ un((t) => t.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function Zf() {
  return /* @__PURE__ */ un((t) => t.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function Bf() {
  return /* @__PURE__ */ un((t) => Ha(t));
}
// @__NO_SIDE_EFFECTS__
function jf(t, e, n) {
  return new t({
    type: "array",
    element: e,
    // get element() {
    //   return element;
    // },
    ...J(n)
  });
}
// @__NO_SIDE_EFFECTS__
function Ff(t, e, n) {
  return new t({
    type: "custom",
    check: "custom",
    fn: e,
    ...J(n)
  });
}
// @__NO_SIDE_EFFECTS__
function Vf(t) {
  const e = /* @__PURE__ */ Gf((n) => (n.addIssue = (r) => {
    if (typeof r == "string")
      n.issues.push(Nn(r, n.value, e._zod.def));
    else {
      const o = r;
      o.fatal && (o.continue = !1), o.code ?? (o.code = "custom"), o.input ?? (o.input = n.value), o.inst ?? (o.inst = e), o.continue ?? (o.continue = !e._zod.def.abort), n.issues.push(Nn(o));
    }
  }, t(n.value, n)));
  return e;
}
// @__NO_SIDE_EFFECTS__
function Gf(t, e) {
  const n = new st({
    check: "custom",
    ...J(e)
  });
  return n._zod.check = t, n;
}
function Ei(t) {
  let e = t?.target ?? "draft-2020-12";
  return e === "draft-4" && (e = "draft-04"), e === "draft-7" && (e = "draft-07"), {
    processors: t.processors ?? {},
    metadataRegistry: t?.metadata ?? pn,
    target: e,
    unrepresentable: t?.unrepresentable ?? "throw",
    override: t?.override ?? (() => {
    }),
    io: t?.io ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    cycles: t?.cycles ?? "ref",
    reused: t?.reused ?? "inline",
    external: t?.external ?? void 0
  };
}
function De(t, e, n = { path: [], schemaPath: [] }) {
  var r;
  const o = t._zod.def, s = e.seen.get(t);
  if (s)
    return s.count++, n.schemaPath.includes(t) && (s.cycle = n.path), s.schema;
  const i = { schema: {}, count: 1, cycle: void 0, path: n.path };
  e.seen.set(t, i);
  const c = t._zod.toJSONSchema?.();
  if (c)
    i.schema = c;
  else {
    const u = {
      ...n,
      schemaPath: [...n.schemaPath, t],
      path: n.path
    };
    if (t._zod.processJSONSchema)
      t._zod.processJSONSchema(e, i.schema, u);
    else {
      const p = i.schema, h = e.processors[o.type];
      if (!h)
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${o.type}`);
      h(t, e, p, u);
    }
    const d = t._zod.parent;
    d && (i.ref || (i.ref = d), De(d, e, u), e.seen.get(d).isParent = !0);
  }
  const l = e.metadataRegistry.get(t);
  return l && Object.assign(i.schema, l), e.io === "input" && qe(t) && (delete i.schema.examples, delete i.schema.default), e.io === "input" && i.schema._prefault && ((r = i.schema).default ?? (r.default = i.schema._prefault)), delete i.schema._prefault, e.seen.get(t).schema;
}
function Di(t, e) {
  const n = t.seen.get(e);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const r = /* @__PURE__ */ new Map();
  for (const i of t.seen.entries()) {
    const c = t.metadataRegistry.get(i[0])?.id;
    if (c) {
      const l = r.get(c);
      if (l && l !== i[0])
        throw new Error(`Duplicate schema id "${c}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      r.set(c, i[0]);
    }
  }
  const o = (i) => {
    const c = t.target === "draft-2020-12" ? "$defs" : "definitions";
    if (t.external) {
      const d = t.external.registry.get(i[0])?.id, p = t.external.uri ?? ((v) => v);
      if (d)
        return { ref: p(d) };
      const h = i[1].defId ?? i[1].schema.id ?? `schema${t.counter++}`;
      return i[1].defId = h, { defId: h, ref: `${p("__shared")}#/${c}/${h}` };
    }
    if (i[1] === n)
      return { ref: "#" };
    const a = `#/${c}/`, u = i[1].schema.id ?? `__schema${t.counter++}`;
    return { defId: u, ref: a + u };
  }, s = (i) => {
    if (i[1].schema.$ref)
      return;
    const c = i[1], { ref: l, defId: a } = o(i);
    c.def = { ...c.schema }, a && (c.defId = a);
    const u = c.schema;
    for (const d in u)
      delete u[d];
    u.$ref = l;
  };
  if (t.cycles === "throw")
    for (const i of t.seen.entries()) {
      const c = i[1];
      if (c.cycle)
        throw new Error(`Cycle detected: #/${c.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
    }
  for (const i of t.seen.entries()) {
    const c = i[1];
    if (e === i[0]) {
      s(i);
      continue;
    }
    if (t.external) {
      const a = t.external.registry.get(i[0])?.id;
      if (e !== i[0] && a) {
        s(i);
        continue;
      }
    }
    if (t.metadataRegistry.get(i[0])?.id) {
      s(i);
      continue;
    }
    if (c.cycle) {
      s(i);
      continue;
    }
    if (c.count > 1 && t.reused === "ref") {
      s(i);
      continue;
    }
  }
}
function ki(t, e) {
  const n = t.seen.get(e);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const r = (i) => {
    const c = t.seen.get(i);
    if (c.ref === null)
      return;
    const l = c.def ?? c.schema, a = { ...l }, u = c.ref;
    if (c.ref = null, u) {
      r(u);
      const p = t.seen.get(u), h = p.schema;
      if (h.$ref && (t.target === "draft-07" || t.target === "draft-04" || t.target === "openapi-3.0") ? (l.allOf = l.allOf ?? [], l.allOf.push(h)) : Object.assign(l, h), Object.assign(l, a), i._zod.parent === u)
        for (const m in l)
          m === "$ref" || m === "allOf" || m in a || delete l[m];
      if (h.$ref && p.def)
        for (const m in l)
          m === "$ref" || m === "allOf" || m in p.def && JSON.stringify(l[m]) === JSON.stringify(p.def[m]) && delete l[m];
    }
    const d = i._zod.parent;
    if (d && d !== u) {
      r(d);
      const p = t.seen.get(d);
      if (p?.schema.$ref && (l.$ref = p.schema.$ref, p.def))
        for (const h in l)
          h === "$ref" || h === "allOf" || h in p.def && JSON.stringify(l[h]) === JSON.stringify(p.def[h]) && delete l[h];
    }
    t.override({
      zodSchema: i,
      jsonSchema: l,
      path: c.path ?? []
    });
  };
  for (const i of [...t.seen.entries()].reverse())
    r(i[0]);
  const o = {};
  if (t.target === "draft-2020-12" ? o.$schema = "https://json-schema.org/draft/2020-12/schema" : t.target === "draft-07" ? o.$schema = "http://json-schema.org/draft-07/schema#" : t.target === "draft-04" ? o.$schema = "http://json-schema.org/draft-04/schema#" : t.target, t.external?.uri) {
    const i = t.external.registry.get(e)?.id;
    if (!i)
      throw new Error("Schema is missing an `id` property");
    o.$id = t.external.uri(i);
  }
  Object.assign(o, n.def ?? n.schema);
  const s = t.external?.defs ?? {};
  for (const i of t.seen.entries()) {
    const c = i[1];
    c.def && c.defId && (s[c.defId] = c.def);
  }
  t.external || Object.keys(s).length > 0 && (t.target === "draft-2020-12" ? o.$defs = s : o.definitions = s);
  try {
    const i = JSON.parse(JSON.stringify(o));
    return Object.defineProperty(i, "~standard", {
      value: {
        ...e["~standard"],
        jsonSchema: {
          input: qn(e, "input", t.processors),
          output: qn(e, "output", t.processors)
        }
      },
      enumerable: !1,
      writable: !1
    }), i;
  } catch {
    throw new Error("Error converting schema to JSON.");
  }
}
function qe(t, e) {
  const n = e ?? { seen: /* @__PURE__ */ new Set() };
  if (n.seen.has(t))
    return !1;
  n.seen.add(t);
  const r = t._zod.def;
  if (r.type === "transform")
    return !0;
  if (r.type === "array")
    return qe(r.element, n);
  if (r.type === "set")
    return qe(r.valueType, n);
  if (r.type === "lazy")
    return qe(r.getter(), n);
  if (r.type === "promise" || r.type === "optional" || r.type === "nonoptional" || r.type === "nullable" || r.type === "readonly" || r.type === "default" || r.type === "prefault")
    return qe(r.innerType, n);
  if (r.type === "intersection")
    return qe(r.left, n) || qe(r.right, n);
  if (r.type === "record" || r.type === "map")
    return qe(r.keyType, n) || qe(r.valueType, n);
  if (r.type === "pipe")
    return qe(r.in, n) || qe(r.out, n);
  if (r.type === "object") {
    for (const o in r.shape)
      if (qe(r.shape[o], n))
        return !0;
    return !1;
  }
  if (r.type === "union") {
    for (const o of r.options)
      if (qe(o, n))
        return !0;
    return !1;
  }
  if (r.type === "tuple") {
    for (const o of r.items)
      if (qe(o, n))
        return !0;
    return !!(r.rest && qe(r.rest, n));
  }
  return !1;
}
const Hf = (t, e = {}) => (n) => {
  const r = Ei({ ...n, processors: e });
  return De(t, r), Di(r, t), ki(r, t);
}, qn = (t, e, n = {}) => (r) => {
  const { libraryOptions: o, target: s } = r ?? {}, i = Ei({ ...o ?? {}, target: s, io: e, processors: n });
  return De(t, i), Di(i, t), ki(i, t);
}, Jf = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
}, Kf = (t, e, n, r) => {
  const o = n;
  o.type = "string";
  const { minimum: s, maximum: i, format: c, patterns: l, contentEncoding: a } = t._zod.bag;
  if (typeof s == "number" && (o.minLength = s), typeof i == "number" && (o.maxLength = i), c && (o.format = Jf[c] ?? c, o.format === "" && delete o.format, c === "time" && delete o.format), a && (o.contentEncoding = a), l && l.size > 0) {
    const u = [...l];
    u.length === 1 ? o.pattern = u[0].source : u.length > 1 && (o.allOf = [
      ...u.map((d) => ({
        ...e.target === "draft-07" || e.target === "draft-04" || e.target === "openapi-3.0" ? { type: "string" } : {},
        pattern: d.source
      }))
    ]);
  }
}, Wf = (t, e, n, r) => {
  const o = n, { minimum: s, maximum: i, format: c, multipleOf: l, exclusiveMaximum: a, exclusiveMinimum: u } = t._zod.bag;
  typeof c == "string" && c.includes("int") ? o.type = "integer" : o.type = "number", typeof u == "number" && (e.target === "draft-04" || e.target === "openapi-3.0" ? (o.minimum = u, o.exclusiveMinimum = !0) : o.exclusiveMinimum = u), typeof s == "number" && (o.minimum = s, typeof u == "number" && e.target !== "draft-04" && (u >= s ? delete o.minimum : delete o.exclusiveMinimum)), typeof a == "number" && (e.target === "draft-04" || e.target === "openapi-3.0" ? (o.maximum = a, o.exclusiveMaximum = !0) : o.exclusiveMaximum = a), typeof i == "number" && (o.maximum = i, typeof a == "number" && e.target !== "draft-04" && (a <= i ? delete o.maximum : delete o.exclusiveMaximum)), typeof l == "number" && (o.multipleOf = l);
}, Xf = (t, e, n, r) => {
  n.type = "boolean";
}, Yf = (t, e, n, r) => {
  if (e.unrepresentable === "throw")
    throw new Error("Undefined cannot be represented in JSON Schema");
}, qf = (t, e, n, r) => {
  n.not = {};
}, Qf = (t, e, n, r) => {
}, ep = (t, e, n, r) => {
  const o = t._zod.def, s = li(o.entries);
  s.every((i) => typeof i == "number") && (n.type = "number"), s.every((i) => typeof i == "string") && (n.type = "string"), n.enum = s;
}, tp = (t, e, n, r) => {
  const o = t._zod.def, s = [];
  for (const i of o.values)
    if (i === void 0) {
      if (e.unrepresentable === "throw")
        throw new Error("Literal `undefined` cannot be represented in JSON Schema");
    } else if (typeof i == "bigint") {
      if (e.unrepresentable === "throw")
        throw new Error("BigInt literals cannot be represented in JSON Schema");
      s.push(Number(i));
    } else
      s.push(i);
  if (s.length !== 0) if (s.length === 1) {
    const i = s[0];
    n.type = i === null ? "null" : typeof i, e.target === "draft-04" || e.target === "openapi-3.0" ? n.enum = [i] : n.const = i;
  } else
    s.every((i) => typeof i == "number") && (n.type = "number"), s.every((i) => typeof i == "string") && (n.type = "string"), s.every((i) => typeof i == "boolean") && (n.type = "boolean"), s.every((i) => i === null) && (n.type = "null"), n.enum = s;
}, np = (t, e, n, r) => {
  if (e.unrepresentable === "throw")
    throw new Error("Custom types cannot be represented in JSON Schema");
}, rp = (t, e, n, r) => {
  if (e.unrepresentable === "throw")
    throw new Error("Transforms cannot be represented in JSON Schema");
}, op = (t, e, n, r) => {
  const o = n, s = t._zod.def, { minimum: i, maximum: c } = t._zod.bag;
  typeof i == "number" && (o.minItems = i), typeof c == "number" && (o.maxItems = c), o.type = "array", o.items = De(s.element, e, { ...r, path: [...r.path, "items"] });
}, sp = (t, e, n, r) => {
  const o = n, s = t._zod.def;
  o.type = "object", o.properties = {};
  const i = s.shape;
  for (const a in i)
    o.properties[a] = De(i[a], e, {
      ...r,
      path: [...r.path, "properties", a]
    });
  const c = new Set(Object.keys(i)), l = new Set([...c].filter((a) => {
    const u = s.shape[a]._zod;
    return e.io === "input" ? u.optin === void 0 : u.optout === void 0;
  }));
  l.size > 0 && (o.required = Array.from(l)), s.catchall?._zod.def.type === "never" ? o.additionalProperties = !1 : s.catchall ? s.catchall && (o.additionalProperties = De(s.catchall, e, {
    ...r,
    path: [...r.path, "additionalProperties"]
  })) : e.io === "output" && (o.additionalProperties = !1);
}, ip = (t, e, n, r) => {
  const o = t._zod.def, s = o.inclusive === !1, i = o.options.map((c, l) => De(c, e, {
    ...r,
    path: [...r.path, s ? "oneOf" : "anyOf", l]
  }));
  s ? n.oneOf = i : n.anyOf = i;
}, cp = (t, e, n, r) => {
  const o = t._zod.def, s = De(o.left, e, {
    ...r,
    path: [...r.path, "allOf", 0]
  }), i = De(o.right, e, {
    ...r,
    path: [...r.path, "allOf", 1]
  }), c = (a) => "allOf" in a && Object.keys(a).length === 1, l = [
    ...c(s) ? s.allOf : [s],
    ...c(i) ? i.allOf : [i]
  ];
  n.allOf = l;
}, lp = (t, e, n, r) => {
  const o = n, s = t._zod.def;
  o.type = "object";
  const i = s.keyType, l = i._zod.bag?.patterns;
  if (s.mode === "loose" && l && l.size > 0) {
    const u = De(s.valueType, e, {
      ...r,
      path: [...r.path, "patternProperties", "*"]
    });
    o.patternProperties = {};
    for (const d of l)
      o.patternProperties[d.source] = u;
  } else
    (e.target === "draft-07" || e.target === "draft-2020-12") && (o.propertyNames = De(s.keyType, e, {
      ...r,
      path: [...r.path, "propertyNames"]
    })), o.additionalProperties = De(s.valueType, e, {
      ...r,
      path: [...r.path, "additionalProperties"]
    });
  const a = i._zod.values;
  if (a) {
    const u = [...a].filter((d) => typeof d == "string" || typeof d == "number");
    u.length > 0 && (o.required = u);
  }
}, ap = (t, e, n, r) => {
  const o = t._zod.def, s = De(o.innerType, e, r), i = e.seen.get(t);
  e.target === "openapi-3.0" ? (i.ref = o.innerType, n.nullable = !0) : n.anyOf = [s, { type: "null" }];
}, up = (t, e, n, r) => {
  const o = t._zod.def;
  De(o.innerType, e, r);
  const s = e.seen.get(t);
  s.ref = o.innerType;
}, dp = (t, e, n, r) => {
  const o = t._zod.def;
  De(o.innerType, e, r);
  const s = e.seen.get(t);
  s.ref = o.innerType, n.default = JSON.parse(JSON.stringify(o.defaultValue));
}, fp = (t, e, n, r) => {
  const o = t._zod.def;
  De(o.innerType, e, r);
  const s = e.seen.get(t);
  s.ref = o.innerType, e.io === "input" && (n._prefault = JSON.parse(JSON.stringify(o.defaultValue)));
}, pp = (t, e, n, r) => {
  const o = t._zod.def;
  De(o.innerType, e, r);
  const s = e.seen.get(t);
  s.ref = o.innerType;
  let i;
  try {
    i = o.catchValue(void 0);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  n.default = i;
}, hp = (t, e, n, r) => {
  const o = t._zod.def, s = e.io === "input" ? o.in._zod.def.type === "transform" ? o.out : o.in : o.out;
  De(s, e, r);
  const i = e.seen.get(t);
  i.ref = s;
}, mp = (t, e, n, r) => {
  const o = t._zod.def;
  De(o.innerType, e, r);
  const s = e.seen.get(t);
  s.ref = o.innerType, n.readOnly = !0;
}, $i = (t, e, n, r) => {
  const o = t._zod.def;
  De(o.innerType, e, r);
  const s = e.seen.get(t);
  s.ref = o.innerType;
}, gp = /* @__PURE__ */ D("ZodISODateTime", (t, e) => {
  pd.init(t, e), Re.init(t, e);
});
function vp(t) {
  return /* @__PURE__ */ wf(gp, t);
}
const yp = /* @__PURE__ */ D("ZodISODate", (t, e) => {
  hd.init(t, e), Re.init(t, e);
});
function bp(t) {
  return /* @__PURE__ */ If(yp, t);
}
const wp = /* @__PURE__ */ D("ZodISOTime", (t, e) => {
  md.init(t, e), Re.init(t, e);
});
function Ip(t) {
  return /* @__PURE__ */ _f(wp, t);
}
const _p = /* @__PURE__ */ D("ZodISODuration", (t, e) => {
  gd.init(t, e), Re.init(t, e);
});
function Sp(t) {
  return /* @__PURE__ */ Sf(_p, t);
}
const xp = (t, e) => {
  fi.init(t, e), t.name = "ZodError", Object.defineProperties(t, {
    format: {
      value: (n) => su(t, n)
      // enumerable: false,
    },
    flatten: {
      value: (n) => ou(t, n)
      // enumerable: false,
    },
    addIssue: {
      value: (n) => {
        t.issues.push(n), t.message = JSON.stringify(t.issues, Ur, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (n) => {
        t.issues.push(...n), t.message = JSON.stringify(t.issues, Ur, 2);
      }
      // enumerable: false,
    },
    isEmpty: {
      get() {
        return t.issues.length === 0;
      }
      // enumerable: false,
    }
  });
}, dt = D("ZodError", xp, {
  Parent: Error
}), Tp = /* @__PURE__ */ ro(dt), Np = /* @__PURE__ */ oo(dt), Cp = /* @__PURE__ */ hr(dt), Rp = /* @__PURE__ */ mr(dt), Op = /* @__PURE__ */ lu(dt), Ep = /* @__PURE__ */ au(dt), Dp = /* @__PURE__ */ uu(dt), kp = /* @__PURE__ */ du(dt), $p = /* @__PURE__ */ fu(dt), zp = /* @__PURE__ */ pu(dt), Ap = /* @__PURE__ */ hu(dt), Lp = /* @__PURE__ */ mu(dt), Te = /* @__PURE__ */ D("ZodType", (t, e) => (Se.init(t, e), Object.assign(t["~standard"], {
  jsonSchema: {
    input: qn(t, "input"),
    output: qn(t, "output")
  }
}), t.toJSONSchema = Hf(t, {}), t.def = e, t.type = e.type, Object.defineProperty(t, "_def", { value: e }), t.check = (...n) => t.clone(Bt(e, {
  checks: [
    ...e.checks ?? [],
    ...n.map((r) => typeof r == "function" ? { _zod: { check: r, def: { check: "custom" }, onattach: [] } } : r)
  ]
}), {
  parent: !0
}), t.with = t.check, t.clone = (n, r) => jt(t, n, r), t.brand = () => t, t.register = ((n, r) => (n.add(t, r), t)), t.parse = (n, r) => Tp(t, n, r, { callee: t.parse }), t.safeParse = (n, r) => Cp(t, n, r), t.parseAsync = async (n, r) => Np(t, n, r, { callee: t.parseAsync }), t.safeParseAsync = async (n, r) => Rp(t, n, r), t.spa = t.safeParseAsync, t.encode = (n, r) => Op(t, n, r), t.decode = (n, r) => Ep(t, n, r), t.encodeAsync = async (n, r) => Dp(t, n, r), t.decodeAsync = async (n, r) => kp(t, n, r), t.safeEncode = (n, r) => $p(t, n, r), t.safeDecode = (n, r) => zp(t, n, r), t.safeEncodeAsync = async (n, r) => Ap(t, n, r), t.safeDecodeAsync = async (n, r) => Lp(t, n, r), t.refine = (n, r) => t.check($h(n, r)), t.superRefine = (n) => t.check(zh(n)), t.overwrite = (n) => t.check(/* @__PURE__ */ un(n)), t.optional = () => es(t), t.exactOptional = () => wh(t), t.nullable = () => ts(t), t.nullish = () => es(ts(t)), t.nonoptional = (n) => Nh(t, n), t.array = () => Li(t), t.or = (n) => Ui([t, n]), t.and = (n) => ph(t, n), t.transform = (n) => ns(t, yh(n)), t.default = (n) => Sh(t, n), t.prefault = (n) => Th(t, n), t.catch = (n) => Rh(t, n), t.pipe = (n) => ns(t, n), t.readonly = () => Dh(t), t.describe = (n) => {
  const r = t.clone();
  return pn.add(r, { description: n }), r;
}, Object.defineProperty(t, "description", {
  get() {
    return pn.get(t)?.description;
  },
  configurable: !0
}), t.meta = (...n) => {
  if (n.length === 0)
    return pn.get(t);
  const r = t.clone();
  return pn.add(r, n[0]), r;
}, t.isOptional = () => t.safeParse(void 0).success, t.isNullable = () => t.safeParse(null).success, t.apply = (n) => n(t), t)), zi = /* @__PURE__ */ D("_ZodString", (t, e) => {
  so.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (r, o, s) => Kf(t, r, o);
  const n = t._zod.bag;
  t.format = n.format ?? null, t.minLength = n.minimum ?? null, t.maxLength = n.maximum ?? null, t.regex = (...r) => t.check(/* @__PURE__ */ Df(...r)), t.includes = (...r) => t.check(/* @__PURE__ */ zf(...r)), t.startsWith = (...r) => t.check(/* @__PURE__ */ Af(...r)), t.endsWith = (...r) => t.check(/* @__PURE__ */ Lf(...r)), t.min = (...r) => t.check(/* @__PURE__ */ Yn(...r)), t.max = (...r) => t.check(/* @__PURE__ */ Ri(...r)), t.length = (...r) => t.check(/* @__PURE__ */ Oi(...r)), t.nonempty = (...r) => t.check(/* @__PURE__ */ Yn(1, ...r)), t.lowercase = (r) => t.check(/* @__PURE__ */ kf(r)), t.uppercase = (r) => t.check(/* @__PURE__ */ $f(r)), t.trim = () => t.check(/* @__PURE__ */ Uf()), t.normalize = (...r) => t.check(/* @__PURE__ */ Pf(...r)), t.toLowerCase = () => t.check(/* @__PURE__ */ Mf()), t.toUpperCase = () => t.check(/* @__PURE__ */ Zf()), t.slugify = () => t.check(/* @__PURE__ */ Bf());
}), Pp = /* @__PURE__ */ D("ZodString", (t, e) => {
  so.init(t, e), zi.init(t, e), t.email = (n) => t.check(/* @__PURE__ */ Qd(Up, n)), t.url = (n) => t.check(/* @__PURE__ */ rf(Mp, n)), t.jwt = (n) => t.check(/* @__PURE__ */ bf(eh, n)), t.emoji = (n) => t.check(/* @__PURE__ */ of(Zp, n)), t.guid = (n) => t.check(/* @__PURE__ */ Jo(Yo, n)), t.uuid = (n) => t.check(/* @__PURE__ */ Ci(hn, n)), t.uuidv4 = (n) => t.check(/* @__PURE__ */ ef(hn, n)), t.uuidv6 = (n) => t.check(/* @__PURE__ */ tf(hn, n)), t.uuidv7 = (n) => t.check(/* @__PURE__ */ nf(hn, n)), t.nanoid = (n) => t.check(/* @__PURE__ */ sf(Bp, n)), t.guid = (n) => t.check(/* @__PURE__ */ Jo(Yo, n)), t.cuid = (n) => t.check(/* @__PURE__ */ cf(jp, n)), t.cuid2 = (n) => t.check(/* @__PURE__ */ lf(Fp, n)), t.ulid = (n) => t.check(/* @__PURE__ */ af(Vp, n)), t.base64 = (n) => t.check(/* @__PURE__ */ gf(Yp, n)), t.base64url = (n) => t.check(/* @__PURE__ */ vf(qp, n)), t.xid = (n) => t.check(/* @__PURE__ */ uf(Gp, n)), t.ksuid = (n) => t.check(/* @__PURE__ */ df(Hp, n)), t.ipv4 = (n) => t.check(/* @__PURE__ */ ff(Jp, n)), t.ipv6 = (n) => t.check(/* @__PURE__ */ pf(Kp, n)), t.cidrv4 = (n) => t.check(/* @__PURE__ */ hf(Wp, n)), t.cidrv6 = (n) => t.check(/* @__PURE__ */ mf(Xp, n)), t.e164 = (n) => t.check(/* @__PURE__ */ yf(Qp, n)), t.datetime = (n) => t.check(vp(n)), t.date = (n) => t.check(bp(n)), t.time = (n) => t.check(Ip(n)), t.duration = (n) => t.check(Sp(n));
});
function ot(t) {
  return /* @__PURE__ */ qd(Pp, t);
}
const Re = /* @__PURE__ */ D("ZodStringFormat", (t, e) => {
  xe.init(t, e), zi.init(t, e);
}), Up = /* @__PURE__ */ D("ZodEmail", (t, e) => {
  od.init(t, e), Re.init(t, e);
}), Yo = /* @__PURE__ */ D("ZodGUID", (t, e) => {
  nd.init(t, e), Re.init(t, e);
}), hn = /* @__PURE__ */ D("ZodUUID", (t, e) => {
  rd.init(t, e), Re.init(t, e);
});
function Ai(t) {
  return /* @__PURE__ */ Ci(hn, t);
}
const Mp = /* @__PURE__ */ D("ZodURL", (t, e) => {
  sd.init(t, e), Re.init(t, e);
}), Zp = /* @__PURE__ */ D("ZodEmoji", (t, e) => {
  id.init(t, e), Re.init(t, e);
}), Bp = /* @__PURE__ */ D("ZodNanoID", (t, e) => {
  cd.init(t, e), Re.init(t, e);
}), jp = /* @__PURE__ */ D("ZodCUID", (t, e) => {
  ld.init(t, e), Re.init(t, e);
}), Fp = /* @__PURE__ */ D("ZodCUID2", (t, e) => {
  ad.init(t, e), Re.init(t, e);
}), Vp = /* @__PURE__ */ D("ZodULID", (t, e) => {
  ud.init(t, e), Re.init(t, e);
}), Gp = /* @__PURE__ */ D("ZodXID", (t, e) => {
  dd.init(t, e), Re.init(t, e);
}), Hp = /* @__PURE__ */ D("ZodKSUID", (t, e) => {
  fd.init(t, e), Re.init(t, e);
}), Jp = /* @__PURE__ */ D("ZodIPv4", (t, e) => {
  vd.init(t, e), Re.init(t, e);
}), Kp = /* @__PURE__ */ D("ZodIPv6", (t, e) => {
  yd.init(t, e), Re.init(t, e);
}), Wp = /* @__PURE__ */ D("ZodCIDRv4", (t, e) => {
  bd.init(t, e), Re.init(t, e);
}), Xp = /* @__PURE__ */ D("ZodCIDRv6", (t, e) => {
  wd.init(t, e), Re.init(t, e);
}), Yp = /* @__PURE__ */ D("ZodBase64", (t, e) => {
  Id.init(t, e), Re.init(t, e);
}), qp = /* @__PURE__ */ D("ZodBase64URL", (t, e) => {
  Sd.init(t, e), Re.init(t, e);
}), Qp = /* @__PURE__ */ D("ZodE164", (t, e) => {
  xd.init(t, e), Re.init(t, e);
}), eh = /* @__PURE__ */ D("ZodJWT", (t, e) => {
  Nd.init(t, e), Re.init(t, e);
}), io = /* @__PURE__ */ D("ZodNumber", (t, e) => {
  _i.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (r, o, s) => Wf(t, r, o), t.gt = (r, o) => t.check(/* @__PURE__ */ Wo(r, o)), t.gte = (r, o) => t.check(/* @__PURE__ */ Or(r, o)), t.min = (r, o) => t.check(/* @__PURE__ */ Or(r, o)), t.lt = (r, o) => t.check(/* @__PURE__ */ Ko(r, o)), t.lte = (r, o) => t.check(/* @__PURE__ */ Rr(r, o)), t.max = (r, o) => t.check(/* @__PURE__ */ Rr(r, o)), t.int = (r) => t.check(qo(r)), t.safe = (r) => t.check(qo(r)), t.positive = (r) => t.check(/* @__PURE__ */ Wo(0, r)), t.nonnegative = (r) => t.check(/* @__PURE__ */ Or(0, r)), t.negative = (r) => t.check(/* @__PURE__ */ Ko(0, r)), t.nonpositive = (r) => t.check(/* @__PURE__ */ Rr(0, r)), t.multipleOf = (r, o) => t.check(/* @__PURE__ */ Xo(r, o)), t.step = (r, o) => t.check(/* @__PURE__ */ Xo(r, o)), t.finite = () => t;
  const n = t._zod.bag;
  t.minValue = Math.max(n.minimum ?? Number.NEGATIVE_INFINITY, n.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null, t.maxValue = Math.min(n.maximum ?? Number.POSITIVE_INFINITY, n.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null, t.isInt = (n.format ?? "").includes("int") || Number.isSafeInteger(n.multipleOf ?? 0.5), t.isFinite = !0, t.format = n.format ?? null;
});
function Zr(t) {
  return /* @__PURE__ */ xf(io, t);
}
const th = /* @__PURE__ */ D("ZodNumberFormat", (t, e) => {
  Cd.init(t, e), io.init(t, e);
});
function qo(t) {
  return /* @__PURE__ */ Nf(th, t);
}
const nh = /* @__PURE__ */ D("ZodBoolean", (t, e) => {
  Rd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => Xf(t, n, r);
});
function rh(t) {
  return /* @__PURE__ */ Cf(nh, t);
}
const oh = /* @__PURE__ */ D("ZodUndefined", (t, e) => {
  Od.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => Yf(t, n);
});
function sh(t) {
  return /* @__PURE__ */ Rf(oh, t);
}
const ih = /* @__PURE__ */ D("ZodUnknown", (t, e) => {
  Ed.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => Qf();
});
function Qo() {
  return /* @__PURE__ */ Of(ih);
}
const ch = /* @__PURE__ */ D("ZodNever", (t, e) => {
  Dd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => qf(t, n, r);
});
function lh(t) {
  return /* @__PURE__ */ Ef(ch, t);
}
const ah = /* @__PURE__ */ D("ZodArray", (t, e) => {
  kd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => op(t, n, r, o), t.element = e.element, t.min = (n, r) => t.check(/* @__PURE__ */ Yn(n, r)), t.nonempty = (n) => t.check(/* @__PURE__ */ Yn(1, n)), t.max = (n, r) => t.check(/* @__PURE__ */ Ri(n, r)), t.length = (n, r) => t.check(/* @__PURE__ */ Oi(n, r)), t.unwrap = () => t.element;
});
function Li(t, e) {
  return /* @__PURE__ */ jf(ah, t, e);
}
const uh = /* @__PURE__ */ D("ZodObject", (t, e) => {
  zd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => sp(t, n, r, o), pe(t, "shape", () => e.shape), t.keyof = () => dn(Object.keys(t._zod.def.shape)), t.catchall = (n) => t.clone({ ...t._zod.def, catchall: n }), t.passthrough = () => t.clone({ ...t._zod.def, catchall: Qo() }), t.loose = () => t.clone({ ...t._zod.def, catchall: Qo() }), t.strict = () => t.clone({ ...t._zod.def, catchall: lh() }), t.strip = () => t.clone({ ...t._zod.def, catchall: void 0 }), t.extend = (n) => Qa(t, n), t.safeExtend = (n) => eu(t, n), t.merge = (n) => tu(t, n), t.pick = (n) => Ya(t, n), t.omit = (n) => qa(t, n), t.partial = (...n) => nu(Mi, t, n[0]), t.required = (...n) => ru(Zi, t, n[0]);
});
function Ve(t, e) {
  const n = {
    type: "object",
    shape: t ?? {},
    ...J(e)
  };
  return new uh(n);
}
const Pi = /* @__PURE__ */ D("ZodUnion", (t, e) => {
  Ti.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => ip(t, n, r, o), t.options = e.options;
});
function Ui(t, e) {
  return new Pi({
    type: "union",
    options: t,
    ...J(e)
  });
}
const dh = /* @__PURE__ */ D("ZodDiscriminatedUnion", (t, e) => {
  Pi.init(t, e), Ad.init(t, e);
});
function co(t, e, n) {
  return new dh({
    type: "union",
    options: e,
    discriminator: t,
    ...J(n)
  });
}
const fh = /* @__PURE__ */ D("ZodIntersection", (t, e) => {
  Ld.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => cp(t, n, r, o);
});
function ph(t, e) {
  return new fh({
    type: "intersection",
    left: t,
    right: e
  });
}
const hh = /* @__PURE__ */ D("ZodRecord", (t, e) => {
  Pd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => lp(t, n, r, o), t.keyType = e.keyType, t.valueType = e.valueType;
});
function mh(t, e, n) {
  return new hh({
    type: "record",
    keyType: t,
    valueType: e,
    ...J(n)
  });
}
const Br = /* @__PURE__ */ D("ZodEnum", (t, e) => {
  Ud.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (r, o, s) => ep(t, r, o), t.enum = e.entries, t.options = Object.values(e.entries);
  const n = new Set(Object.keys(e.entries));
  t.extract = (r, o) => {
    const s = {};
    for (const i of r)
      if (n.has(i))
        s[i] = e.entries[i];
      else
        throw new Error(`Key ${i} not found in enum`);
    return new Br({
      ...e,
      checks: [],
      ...J(o),
      entries: s
    });
  }, t.exclude = (r, o) => {
    const s = { ...e.entries };
    for (const i of r)
      if (n.has(i))
        delete s[i];
      else
        throw new Error(`Key ${i} not found in enum`);
    return new Br({
      ...e,
      checks: [],
      ...J(o),
      entries: s
    });
  };
});
function dn(t, e) {
  const n = Array.isArray(t) ? Object.fromEntries(t.map((r) => [r, r])) : t;
  return new Br({
    type: "enum",
    entries: n,
    ...J(e)
  });
}
const gh = /* @__PURE__ */ D("ZodLiteral", (t, e) => {
  Md.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => tp(t, n, r), t.values = new Set(e.values), Object.defineProperty(t, "value", {
    get() {
      if (e.values.length > 1)
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      return e.values[0];
    }
  });
});
function We(t, e) {
  return new gh({
    type: "literal",
    values: Array.isArray(t) ? t : [t],
    ...J(e)
  });
}
const vh = /* @__PURE__ */ D("ZodTransform", (t, e) => {
  Zd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => rp(t, n), t._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new ii(t.constructor.name);
    n.addIssue = (s) => {
      if (typeof s == "string")
        n.issues.push(Nn(s, n.value, e));
      else {
        const i = s;
        i.fatal && (i.continue = !1), i.code ?? (i.code = "custom"), i.input ?? (i.input = n.value), i.inst ?? (i.inst = t), n.issues.push(Nn(i));
      }
    };
    const o = e.transform(n.value, n);
    return o instanceof Promise ? o.then((s) => (n.value = s, n)) : (n.value = o, n);
  };
});
function yh(t) {
  return new vh({
    type: "transform",
    transform: t
  });
}
const Mi = /* @__PURE__ */ D("ZodOptional", (t, e) => {
  Ni.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => $i(t, n, r, o), t.unwrap = () => t._zod.def.innerType;
});
function es(t) {
  return new Mi({
    type: "optional",
    innerType: t
  });
}
const bh = /* @__PURE__ */ D("ZodExactOptional", (t, e) => {
  Bd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => $i(t, n, r, o), t.unwrap = () => t._zod.def.innerType;
});
function wh(t) {
  return new bh({
    type: "optional",
    innerType: t
  });
}
const Ih = /* @__PURE__ */ D("ZodNullable", (t, e) => {
  jd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => ap(t, n, r, o), t.unwrap = () => t._zod.def.innerType;
});
function ts(t) {
  return new Ih({
    type: "nullable",
    innerType: t
  });
}
const _h = /* @__PURE__ */ D("ZodDefault", (t, e) => {
  Fd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => dp(t, n, r, o), t.unwrap = () => t._zod.def.innerType, t.removeDefault = t.unwrap;
});
function Sh(t, e) {
  return new _h({
    type: "default",
    innerType: t,
    get defaultValue() {
      return typeof e == "function" ? e() : ui(e);
    }
  });
}
const xh = /* @__PURE__ */ D("ZodPrefault", (t, e) => {
  Vd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => fp(t, n, r, o), t.unwrap = () => t._zod.def.innerType;
});
function Th(t, e) {
  return new xh({
    type: "prefault",
    innerType: t,
    get defaultValue() {
      return typeof e == "function" ? e() : ui(e);
    }
  });
}
const Zi = /* @__PURE__ */ D("ZodNonOptional", (t, e) => {
  Gd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => up(t, n, r, o), t.unwrap = () => t._zod.def.innerType;
});
function Nh(t, e) {
  return new Zi({
    type: "nonoptional",
    innerType: t,
    ...J(e)
  });
}
const Ch = /* @__PURE__ */ D("ZodCatch", (t, e) => {
  Hd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => pp(t, n, r, o), t.unwrap = () => t._zod.def.innerType, t.removeCatch = t.unwrap;
});
function Rh(t, e) {
  return new Ch({
    type: "catch",
    innerType: t,
    catchValue: typeof e == "function" ? e : () => e
  });
}
const Oh = /* @__PURE__ */ D("ZodPipe", (t, e) => {
  Jd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => hp(t, n, r, o), t.in = e.in, t.out = e.out;
});
function ns(t, e) {
  return new Oh({
    type: "pipe",
    in: t,
    out: e
    // ...util.normalizeParams(params),
  });
}
const Eh = /* @__PURE__ */ D("ZodReadonly", (t, e) => {
  Kd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => mp(t, n, r, o), t.unwrap = () => t._zod.def.innerType;
});
function Dh(t) {
  return new Eh({
    type: "readonly",
    innerType: t
  });
}
const kh = /* @__PURE__ */ D("ZodCustom", (t, e) => {
  Wd.init(t, e), Te.init(t, e), t._zod.processJSONSchema = (n, r, o) => np(t, n);
});
function $h(t, e = {}) {
  return /* @__PURE__ */ Ff(kh, t, e);
}
function zh(t) {
  return /* @__PURE__ */ Vf(t);
}
function lo(t) {
  return /* @__PURE__ */ Tf(io, t);
}
const Ah = -2147483648, Lh = 2147483647, Ph = -3402823e32, Uh = 3402823e32, Bi = lo().transform((t) => t ? 1 : 0).refine((t) => t === 0 || t === 1, "BOOL must be 0 or 1"), ji = lo().refine(Number.isFinite, "DINT must be finite").transform((t) => Math.trunc(t)).refine((t) => t >= Ah && t <= Lh, "DINT must be within 32-bit range"), Fi = lo().refine(Number.isFinite, "REAL must be finite").refine((t) => t >= Ph && t <= Uh, "REAL must be within allowable range");
co("type", [Ve({
  type: We("BOOL"),
  value: Bi
}), Ve({
  type: We("DINT"),
  value: ji
}), Ve({
  type: We("REAL"),
  value: Fi
})]);
const ao = (t) => t === 0 ? void 0 : t, vr = (t) => {
  const e = Object.fromEntries(Object.entries(t).filter(([, n]) => n !== void 0));
  return Object.keys(e).length === 0 ? void 0 : e;
}, me = Bi.transform(ao).optional(), yt = ji.transform(ao).optional(), Vi = Fi.transform(ao).optional(), Gi = Ve({
  PRE: yt,
  ACC: yt,
  EN: me,
  TT: me,
  DN: me
}).transform(vr), Hi = Ve({
  PRE: yt,
  ACC: yt,
  CU: me,
  CD: me,
  DN: me,
  OV: me,
  UN: me
}).transform(vr), Ji = Ve({
  EnableIn: me,
  TimerEnable: me,
  PRE: yt,
  Reset: me,
  EnableOut: me,
  ACC: yt,
  EN: me,
  TT: me,
  DN: me,
  Status: yt,
  InstructFault: me,
  PresetInv: me
}).transform(vr), Ki = Ve({
  EnableIn: me,
  CUEnable: me,
  CDEnable: me,
  PRE: yt,
  Reset: me,
  EnableOut: me,
  ACC: yt,
  CU: me,
  CD: me,
  DN: me,
  OV: me,
  UN: me
}).transform(vr), Mh = /* @__PURE__ */ new Set(["if", "then", "else", "elsif", "end_if", "case", "of", "end_case", "for", "to", "by", "do", "end_for", "while", "end_while", "repeat", "until", "end_repeat", "exit", "continue", "bool", "int", "dint", "real", "string", "sint", "uint", "lint", "time", "date", "byte", "word", "dword", "array", "timer", "fbd_timer", "fbd_counter", "true", "false", "and", "or", "xor", "not", "mod", "var", "end_var", "var_input", "var_output", "var_in_out", "var_temp", "var_external", "var_global", "var_access", "constant", "retain", "non_retain", "function", "end_function", "function_block", "end_function_block", "program", "end_program", "action", "end_action", "step", "end_step", "initial_step", "transition", "end_transition", "at", "with"]), Wi = ot().min(1, "Name is required").max(40, "Name must be 40 characters or fewer").regex(/^[A-Za-z_]/, "Name must start with a letter or underscore").regex(/^[A-Za-z0-9_]+$/, "Only letters, digits, and underscore are allowed").refine((t) => !Mh.has(t.toLowerCase()), {
  message: "Name cannot be a reserved keyword"
}), Zh = ot().trim().min(1, "Name is required").max(40, "Name must be 40 characters or fewer").regex(/^[A-Za-z_]/, "Name must start with a letter or underscore").regex(/^[A-Za-z0-9_]+$/, "Only letters, digits, and underscore are allowed");
dn(["BOOL", "DINT", "REAL", "TIMER", "COUNTER", "FBD_TIMER", "FBD_COUNTER"]).meta({
  type: "DataType"
});
const Bh = dn(["input", "output", "local"]);
dn(["Decimal", "Binary", "Hex", "Float"]);
ot().transform((t) => t.trim()).refine((t) => t === "" || /^\d+$/.test(t), "Array size must be a number").transform((t) => t === "" ? null : parseInt(t, 10)).refine((t) => t === null || t >= 1, "Array size must be a positive number").refine((t) => t === null || t <= 128, "Array size cannot exceed 128");
const uo = ot().transform((t) => {
  const e = t.trim();
  return e === "" ? void 0 : e;
}).optional(), Jt = Ve({
  id: Ai().default(() => Ot()),
  name: Wi,
  usage: Bh,
  description: uo
}), jh = Zr().int().min(1).max(128), Fh = Ve({
  id: Ai().default(() => Ot()),
  name: Wi,
  usage: We("local"),
  description: uo,
  defaultValue: sh(),
  dimension: jh
}), Vh = (t) => mh(ot(), Ve({
  description: uo,
  defaultValue: t
})).optional(), Kt = (t, e) => Fh.extend({
  dataType: We(t),
  elements: Vh(e)
}), Gh = Jt.extend({
  dataType: We("BOOL"),
  defaultValue: me
}), Hh = Kt("BOOL", me), Jh = Jt.extend({
  dataType: We("DINT"),
  defaultValue: yt
}), Kh = Kt("DINT", yt), Wh = Jt.extend({
  dataType: We("REAL"),
  defaultValue: Vi
}), Xh = Kt("REAL", Vi), Yh = Jt.extend({
  dataType: We("TIMER"),
  usage: We("local"),
  defaultValue: Gi.optional()
}), qh = Kt("TIMER", Gi), Qh = Jt.extend({
  dataType: We("COUNTER"),
  usage: We("local"),
  defaultValue: Hi.optional()
}), em = Kt("COUNTER", Hi), tm = Jt.extend({
  dataType: We("FBD_TIMER"),
  usage: We("local"),
  defaultValue: Ji.optional()
}), nm = Kt("FBD_TIMER", Ji), rm = Jt.extend({
  dataType: We("FBD_COUNTER"),
  usage: We("local"),
  defaultValue: Ki.optional()
}), om = Kt("FBD_COUNTER", Ki), sm = co("dataType", [Gh, Jh, Wh, Yh, Qh, tm, rm]), im = co("dataType", [Hh, Kh, Xh, qh, em, nm, om]), cm = (t) => {
  if (!t.elements) return t;
  const e = t.dimension, n = Object.entries(t.elements).filter(([o, s]) => {
    const i = Number(o);
    if (!(Number.isInteger(i) && i >= 0 && i < e)) return !1;
    const l = s.description !== void 0, a = s.defaultValue !== void 0;
    return l || a;
  });
  if (n.length === 0)
    return {
      ...t,
      elements: void 0
    };
  const r = Object.fromEntries(n.map(([o, s]) => [o, s]));
  return {
    ...t,
    elements: r
  };
}, lm = Ui([im, sm]).transform((t) => "elements" in t ? cm(t) : t), am = dn(["st", "ld"]);
dn(["Prescan", "EnableInFalse", "Logic"]);
const um = Ve({
  javascript: ot(),
  compiledAt: ot(),
  sourceMap: ot().optional()
}), Er = Ve({
  type: am,
  content: ot(),
  description: ot().optional(),
  compiled: um.optional()
}), dm = Ve({
  Logic: Er,
  Prescan: Er.optional(),
  EnableInFalse: Er.optional()
}), fm = Ve({
  created: ot().optional(),
  modified: ot().optional()
}), pm = Ve({
  content: ot(),
  config: Ve({
    timeout: Zr().positive(),
    maxIterations: Zr().positive(),
    enableDebugMode: rh()
  }).optional()
});
Ve({
  name: Zh,
  description: ot(),
  tags: Li(lm),
  routines: dm,
  metadata: fm.optional(),
  testing: pm.optional()
});
const hm = [{
  key: "PRE",
  type: "DINT"
}, {
  key: "ACC",
  type: "DINT"
}, {
  key: "EN",
  type: "BOOL"
}, {
  key: "TT",
  type: "BOOL"
}, {
  key: "DN",
  type: "BOOL"
}], mm = [{
  key: "PRE",
  type: "DINT"
}, {
  key: "ACC",
  type: "DINT"
}, {
  key: "CU",
  type: "BOOL"
}, {
  key: "CD",
  type: "BOOL"
}, {
  key: "DN",
  type: "BOOL"
}, {
  key: "OV",
  type: "BOOL"
}, {
  key: "UN",
  type: "BOOL"
}], gm = [{
  key: "EnableIn",
  type: "BOOL"
}, {
  key: "TimerEnable",
  type: "BOOL"
}, {
  key: "PRE",
  type: "DINT"
}, {
  key: "Reset",
  type: "BOOL"
}, {
  key: "EnableOut",
  type: "BOOL"
}, {
  key: "ACC",
  type: "DINT"
}, {
  key: "EN",
  type: "BOOL"
}, {
  key: "TT",
  type: "BOOL"
}, {
  key: "DN",
  type: "BOOL"
}, {
  key: "Status",
  type: "DINT"
}, {
  key: "InstructFault",
  type: "BOOL"
}, {
  key: "PresetInv",
  type: "BOOL"
}], vm = [{
  key: "EnableIn",
  type: "BOOL"
}, {
  key: "CUEnable",
  type: "BOOL"
}, {
  key: "CDEnable",
  type: "BOOL"
}, {
  key: "PRE",
  type: "DINT"
}, {
  key: "Reset",
  type: "BOOL"
}, {
  key: "EnableOut",
  type: "BOOL"
}, {
  key: "ACC",
  type: "DINT"
}, {
  key: "CU",
  type: "BOOL"
}, {
  key: "CD",
  type: "BOOL"
}, {
  key: "DN",
  type: "BOOL"
}, {
  key: "OV",
  type: "BOOL"
}, {
  key: "UN",
  type: "BOOL"
}], ym = Array.from({
  length: 32
}, (t, e) => ({
  key: String(e),
  type: "BOOL"
}));
function bm(t) {
  const e = t.match(/^([a-zA-Z_]\w*)(?:\[(\d+)\])?$/);
  return e ? {
    tagName: e[1],
    indexText: e[2] ?? null
  } : null;
}
function wm(t) {
  switch (t) {
    case "TIMER":
      return hm;
    case "COUNTER":
      return mm;
    case "FBD_TIMER":
      return gm;
    case "FBD_COUNTER":
      return vm;
    default:
      return [];
  }
}
function Im(t) {
  return t === "DINT" ? ym : wm(t);
}
const _m = 8, Dr = 20;
function Sm(t, e) {
  const n = e.indexOf(".");
  if (n !== -1) {
    const o = e.slice(0, n), s = e.slice(n + 1).toUpperCase(), i = bm(o);
    if (!i) return [];
    const c = t.find((u) => u.name.toLowerCase() === i.tagName.toLowerCase());
    if (!c) return [];
    const l = Im(c.dataType), a = i.indexText === null ? c.name : `${c.name}[${i.indexText}]`;
    return l.filter((u) => !s || u.key.toUpperCase().startsWith(s)).map((u) => ({
      name: `${a}.${u.key}`,
      dataType: u.type,
      usage: c.usage
    }));
  }
  const r = e.toLowerCase();
  return r ? t.filter((o) => o.name.toLowerCase().startsWith(r)) : t;
}
function xm(t) {
  const e = Q.c(16), {
    name: n,
    matchLength: r,
    selected: o
  } = t;
  if (r === 0) {
    let d;
    return e[0] !== n ? (d = /* @__PURE__ */ f("span", { children: n }), e[0] = n, e[1] = d) : d = e[1], d;
  }
  const s = o ? "#bbe7ff" : "#0066bf";
  let i;
  e[2] !== s ? (i = {
    color: s
  }, e[2] = s, e[3] = i) : i = e[3];
  let c;
  e[4] !== r || e[5] !== n ? (c = n.slice(0, r), e[4] = r, e[5] = n, e[6] = c) : c = e[6];
  let l;
  e[7] !== i || e[8] !== c ? (l = /* @__PURE__ */ f("span", { className: "font-bold", style: i, children: c }), e[7] = i, e[8] = c, e[9] = l) : l = e[9];
  let a;
  e[10] !== r || e[11] !== n ? (a = n.slice(r), e[10] = r, e[11] = n, e[12] = a) : a = e[12];
  let u;
  return e[13] !== l || e[14] !== a ? (u = /* @__PURE__ */ F("span", { children: [
    l,
    a
  ] }), e[13] = l, e[14] = a, e[15] = u) : u = e[15], u;
}
const Xi = tr(function(e, n) {
  const r = Q.c(31), {
    tags: o,
    inputValue: s,
    anchorElement: i,
    onSelect: c
  } = e, [l, a] = ye(0), u = le(null);
  let d;
  r[0] !== s || r[1] !== o ? (d = Sm(o, s), r[0] = s, r[1] = o, r[2] = d) : d = r[2];
  const p = d, h = p.length > 0 ? Math.min(l, p.length - 1) : 0;
  let v, m;
  r[3] !== h ? (v = () => {
    if (!u.current)
      return;
    u.current.children[h]?.scrollIntoView({
      block: "nearest"
    });
  }, m = [h], r[3] = h, r[4] = v, r[5] = m) : (v = r[4], m = r[5]), ue(v, m);
  let g, I;
  if (r[6] !== p || r[7] !== h || r[8] !== c ? (g = () => ({
    handleKeyDown(y) {
      if (p.length === 0)
        return !1;
      if (y.key === "ArrowDown")
        return y.preventDefault(), a((R) => (R + 1) % p.length), !0;
      if (y.key === "ArrowUp")
        return y.preventDefault(), a((R) => (R - 1 + p.length) % p.length), !0;
      if (y.key === "Tab") {
        y.preventDefault();
        const R = p[h];
        return R && c(R.name, !1), !0;
      }
      if (y.key === "Enter") {
        y.preventDefault();
        const R = p[h];
        return R && c(R.name, !0), !0;
      }
      return y.key === "Escape" ? (y.preventDefault(), !0) : !1;
    }
  }), I = [p, h, c], r[6] = p, r[7] = h, r[8] = c, r[9] = g, r[10] = I) : (g = r[9], I = r[10]), cc(n, g, I), p.length === 0 || !i)
    return null;
  let T;
  r[11] !== i ? (T = i.getBoundingClientRect(), r[11] = i, r[12] = T) : T = r[12];
  const b = T, x = Tm, S = Nm, C = b.bottom + 2;
  let O;
  r[13] !== b.left || r[14] !== C ? (O = {
    position: "fixed",
    top: C,
    left: b.left,
    zIndex: 9999
  }, r[13] = b.left, r[14] = C, r[15] = O) : O = r[15];
  let N;
  r[16] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (N = {
    maxHeight: _m * Dr,
    background: "#f3f3f3",
    border: "1px solid #c8c8c8",
    borderRadius: 3
  }, r[16] = N) : N = r[16];
  let E;
  if (r[17] !== p || r[18] !== h || r[19] !== s || r[20] !== c) {
    let y;
    r[22] !== h || r[23] !== s || r[24] !== c ? (y = (R, k) => {
      const A = k === h;
      return /* @__PURE__ */ F("div", { className: "flex min-w-96 cursor-pointer items-center whitespace-nowrap", style: {
        height: Dr,
        padding: "0 10px 0 4px",
        fontSize: 13,
        lineHeight: `${Dr}px`,
        background: A ? "#0060c0" : void 0,
        color: A ? "#fff" : "#000"
      }, onMouseDown: S, onClick: () => c(R.name, !0), onMouseEnter: () => a(k), children: [
        /* @__PURE__ */ f("span", { className: "flex-1 truncate", children: /* @__PURE__ */ f(xm, { name: R.name, matchLength: s.length, selected: A }) }),
        /* @__PURE__ */ F("span", { style: {
          fontSize: 11,
          opacity: 0.7,
          marginLeft: 12
        }, children: [
          R.dataType,
          " · ",
          R.usage
        ] })
      ] }, R.name);
    }, r[22] = h, r[23] = s, r[24] = c, r[25] = y) : y = r[25], E = p.map(y), r[17] = p, r[18] = h, r[19] = s, r[20] = c, r[21] = E;
  } else
    E = r[21];
  let _;
  r[26] !== E ? (_ = /* @__PURE__ */ f("div", { ref: u, className: "overflow-y-auto font-mono", style: N, children: E }), r[26] = E, r[27] = _) : _ = r[27];
  let w;
  return r[28] !== _ || r[29] !== O ? (w = nr(/* @__PURE__ */ f("div", { style: O, onMouseDown: x, onContextMenu: x, children: _ }), document.body), r[28] = _, r[29] = O, r[30] = w) : w = r[30], w;
});
function Tm(t) {
  return t.stopPropagation();
}
function Nm(t) {
  return t.preventDefault();
}
function Yi(t) {
  const e = Q.c(35), {
    isSelected: n,
    isInstructionSelected: r,
    parameter: o,
    errorSeverity: s,
    isEditing: i,
    onEditingChange: c,
    onParameterChange: l,
    onMouseDown: a
  } = t, u = i === void 0 ? !1 : i, d = o || "?", [p, h] = ye(d), [v, m] = ye(null), g = le(!1), I = le(null), T = gs(), b = s === "error" ? "text-red-500" : s === "warning" ? "text-amber-600" : "text-black";
  let x;
  e[0] !== r || e[1] !== n || e[2] !== a ? (x = function() {
    g.current = r && n, a?.();
  }, e[0] = r, e[1] = n, e[2] = a, e[3] = x) : x = e[3];
  const S = x;
  let C;
  e[4] !== d || e[5] !== c ? (C = function() {
    g.current && (h(d), c?.(!0));
  }, e[4] = d, e[5] = c, e[6] = C) : C = e[6];
  const O = C;
  let N;
  e[7] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (N = function(B) {
    let {
      value: U
    } = B.target;
    U = U.replace(/\s/g, "_"), U = U.replace(/[^a-zA-Z0-9_.[[\]]/g, ""), h(U);
  }, e[7] = N) : N = e[7];
  const E = N;
  let _;
  e[8] !== p || e[9] !== c || e[10] !== l ? (_ = function() {
    c?.(!1), l?.(p);
  }, e[8] = p, e[9] = c, e[10] = l, e[11] = _) : _ = e[11];
  const w = _;
  let y;
  e[12] !== c || e[13] !== l ? (y = function(B, U) {
    h(B), U && (c?.(!1), l?.(B));
  }, e[12] = c, e[13] = l, e[14] = y) : y = e[14];
  const R = y;
  let k;
  e[15] !== w ? (k = function(B) {
    I.current?.handleKeyDown(B) || B.key === "Enter" && w();
  }, e[15] = w, e[16] = k) : k = e[16];
  const A = k;
  let P;
  e[17] !== d || e[18] !== O || e[19] !== S || e[20] !== u || e[21] !== b ? (P = !u && /* @__PURE__ */ f("div", { onMouseDown: S, onClick: O, className: "col-start-1 col-end-4 row-start-1 flex flex-col justify-center", children: /* @__PURE__ */ f("p", { className: `px-1 text-center text-sm ${b}`, children: d }) }), e[17] = d, e[18] = O, e[19] = S, e[20] = u, e[21] = b, e[22] = P) : P = e[22];
  let $;
  e[23] !== v || e[24] !== w || e[25] !== R || e[26] !== A || e[27] !== S || e[28] !== p || e[29] !== u || e[30] !== T ? ($ = u && /* @__PURE__ */ F("div", { ref: m, onMouseDown: S, className: "col-start-1 col-end-4 row-start-1 flex justify-center", children: [
    /* @__PURE__ */ f("input", { className: "min-w-[1ch] max-w-96 bg-transparent px-1 text-center text-sm outline-none ring-0 field-sizing-content focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0", value: p, onChange: E, autoFocus: !0, onFocus: Cm, onBlur: w, onKeyDown: A }),
    T.length > 0 && /* @__PURE__ */ f(Xi, { ref: I, tags: T, inputValue: p, anchorElement: v, onSelect: R })
  ] }), e[23] = v, e[24] = w, e[25] = R, e[26] = A, e[27] = S, e[28] = p, e[29] = u, e[30] = T, e[31] = $) : $ = e[31];
  let X;
  return e[32] !== P || e[33] !== $ ? (X = /* @__PURE__ */ F(St, { children: [
    P,
    $
  ] }), e[32] = P, e[33] = $, e[34] = X) : X = e[34], X;
}
function Cm(t) {
  return t.target.select();
}
function Rm(t) {
  const e = Q.c(28), {
    isSelected: n,
    instructionData: r,
    type: o,
    rungId: s,
    isEnergized: i,
    errorSeverity: c
  } = t, {
    actions: l
  } = ke(), a = jr(), [u, d] = ye(null), [p, h] = ye(!1), v = n || p, m = n && !p && u === !0, g = n && !p && u === !1, I = r.parameters[0] ?? "";
  let T;
  e[0] !== I || e[1] !== a ? (T = I ? a?.getTag(I) : null, e[0] = I, e[1] = a, e[2] = T) : T = e[2];
  const b = T, x = b ? o === "XIO" ? b.value === 0 : o === "ONS" ? !1 : b.value === 1 : !1, S = o === "ONS" ? i : x || i;
  let C;
  e[3] !== l || e[4] !== r || e[5] !== s ? (C = function(P) {
    l.modifyInstruction({
      ...r,
      parameters: [P]
    }, s);
  }, e[3] = l, e[4] = r, e[5] = s, e[6] = C) : C = e[6];
  const O = C;
  let N;
  e[7] !== v || e[8] !== g || e[9] !== m ? (N = v && /* @__PURE__ */ F(St, { children: [
    /* @__PURE__ */ f("div", { className: "col-start-1 col-end-4 row-start-1", children: /* @__PURE__ */ f("div", { className: `h-full w-full ${m ? "bg-selected" : "border-x-2 border-t-2 border-selected"}` }) }),
    /* @__PURE__ */ f("div", { className: "relative col-start-1 col-end-4 row-start-2", children: /* @__PURE__ */ f("div", { className: `absolute -bottom-px -top-px left-0 right-0 ${g ? "bg-selected" : "border-x-2 border-b-2 border-selected"}` }) })
  ] }), e[7] = v, e[8] = g, e[9] = m, e[10] = N) : N = e[10];
  let E;
  e[11] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (E = () => d(!0), e[11] = E) : E = e[11];
  const _ = c ?? (r.errors.length > 0 ? "error" : void 0);
  let w;
  e[12] !== O || e[13] !== p || e[14] !== n || e[15] !== I || e[16] !== _ || e[17] !== m ? (w = /* @__PURE__ */ f(Yi, { onMouseDown: E, isSelected: m, isInstructionSelected: n, parameter: I, errorSeverity: _, isEditing: p, onEditingChange: h, onParameterChange: O }), e[12] = O, e[13] = p, e[14] = n, e[15] = I, e[16] = _, e[17] = m, e[18] = w) : w = e[18];
  let y;
  e[19] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (y = () => d(!1), e[19] = y) : y = e[19];
  let R;
  e[20] !== S || e[21] !== g || e[22] !== o ? (R = /* @__PURE__ */ f(Va, { onMouseDown: y, isSelected: g, type: o, isEnergized: S }), e[20] = S, e[21] = g, e[22] = o, e[23] = R) : R = e[23];
  let k;
  return e[24] !== N || e[25] !== w || e[26] !== R ? (k = /* @__PURE__ */ F("div", { className: "inline-grid grid-cols-[min-content_minmax(min-content,1.25rem)_min-content] grid-rows-[1.25rem_1.25rem]", children: [
    N,
    w,
    R
  ] }), e[24] = N, e[25] = w, e[26] = R, e[27] = k) : k = e[27], k;
}
function Om(t) {
  return !t || t === "?" ? !0 : /^-?\d+(\.\d+)?$/.test(t);
}
function rs(t) {
  const n = Number(t).toString();
  if (!n.includes(".")) return n + ".0";
  const [r, o] = n.split(".");
  return o.length > 6 ? r + "." + o.slice(0, 6) : n;
}
function Wt(t) {
  const e = Q.c(42), {
    instructionData: n,
    isSelected: r,
    rungId: o,
    title: s,
    subtitle: i,
    subtitleStatus: c,
    rows: l,
    rowStatuses: a,
    errorSeverity: u,
    singleLine: d
  } = t;
  let p;
  e[0] !== a ? (p = a === void 0 ? {} : a, e[0] = a, e[1] = p) : p = e[1];
  const h = p, {
    actions: v
  } = ke(), m = jr(), g = gs(), [I, T] = ye(null), [b, x] = ye(null), [S, C] = ye(""), O = le(!1), N = le(r), E = le(null), [_, w] = ye(null), y = le(null);
  let R, k;
  e[2] !== b || e[3] !== S ? (R = () => {
    b !== null && (E.current = {
      rowIndex: b,
      value: S
    });
  }, k = [b, S], e[2] = b, e[3] = S, e[4] = R, e[5] = k) : (R = e[4], k = e[5]), ue(R, k);
  let A, P;
  e[6] !== v || e[7] !== n || e[8] !== r || e[9] !== l || e[10] !== o ? (A = () => {
    if (N.current && !r && E.current) {
      const {
        rowIndex: de,
        value: ne
      } = E.current, oe = l[de], ce = [...n.parameters];
      ce[oe.paramIndex] = ne, v.modifyInstruction({
        ...n,
        parameters: ce
      }, o), E.current = null;
    }
    N.current = r;
  }, P = [r, l, n, v, o], e[6] = v, e[7] = n, e[8] = r, e[9] = l, e[10] = o, e[11] = A, e[12] = P) : (A = e[11], P = e[12]), ue(A, P);
  const $ = r ? I : null, X = r ? b : null;
  let L;
  e[13] !== n ? (L = function(ne) {
    return n.parameters[ne] ?? "";
  }, e[13] = n, e[14] = L) : L = e[14];
  const B = L;
  let U;
  e[15] !== m ? (U = function(ne) {
    if (!m || Om(ne))
      return null;
    const oe = m.getTag(ne);
    return oe === null || oe.value == null || typeof oe.value == "object" ? null : oe.definition.dataType === "REAL" ? rs(oe.value) : String(oe.value);
  }, e[15] = m, e[16] = U) : U = e[16];
  const H = U;
  let K;
  e[17] !== B || e[18] !== n || e[19] !== m ? (K = function(ne) {
    if (ne.runtimeMember) {
      const oe = n.parameters[0];
      if (oe && oe !== "?") {
        const ce = m?.getTag(`${oe}.${ne.runtimeMember}`);
        if (ce)
          return ce.definition.dataType === "REAL" ? rs(ce.value) : String(ce.value);
      }
      return "?";
    }
    return B(ne.paramIndex) || "?";
  }, e[17] = B, e[18] = n, e[19] = m, e[20] = K) : K = e[20];
  const Z = K, j = function(ne, oe) {
    oe && (O.current = r && $ === ne, T(ne));
  }, M = function(ne, oe) {
    if (oe && O.current) {
      const ce = B(l[ne].paramIndex);
      C(ce || ""), x(ne);
    }
  };
  let G;
  e[21] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (G = function(ne, oe) {
    let {
      value: ce
    } = ne.target;
    oe === "number" ? ce = ce.replace(/[^0-9]/g, "") : (ce = ce.replace(/\s/g, "_"), ce = ce.replace(/[^a-zA-Z0-9_.[[\]]/g, "")), C(ce);
  }, e[21] = G) : G = e[21];
  const q = G, Y = function(ne) {
    x(null), E.current = null;
    const oe = l[ne], ce = [...n.parameters];
    ce[oe.paramIndex] = S, v.modifyInstruction({
      ...n,
      parameters: ce
    }, o);
  };
  let W;
  e[22] !== v || e[23] !== n || e[24] !== l || e[25] !== o ? (W = function(ne, oe, ce) {
    if (ce) {
      x(null), E.current = null;
      const Le = l[ne], tt = [...n.parameters];
      tt[Le.paramIndex] = oe, v.modifyInstruction({
        ...n,
        parameters: tt
      }, o);
    } else
      C(oe);
  }, e[22] = v, e[23] = n, e[24] = l, e[25] = o, e[26] = W) : W = e[26];
  const ae = W, ie = function(ne, oe) {
    y.current?.handleKeyDown(ne) || ne.key === "Enter" && Y(oe);
  }, Ie = r ? "bg-selected" : "bg-slate-300", se = u === "error" ? "border-red-500" : u === "warning" ? "border-amber-600" : "border-slate-400", Oe = u === "error" ? "text-red-600" : u === "warning" ? "text-amber-600" : "", Ge = "mb-2 inline-grid grid-cols-[auto_auto] self-start", ft = `flex h-5 items-center justify-start border px-2 ${Ie} ${se}`, Et = `text-sm ${Oe}`;
  let Ye;
  e[27] !== Et || e[28] !== s ? (Ye = /* @__PURE__ */ f("p", { className: Et, children: s }), e[27] = Et, e[28] = s, e[29] = Ye) : Ye = e[29];
  let Me;
  e[30] !== ft || e[31] !== Ye ? (Me = /* @__PURE__ */ f("div", { className: ft, children: Ye }), e[30] = ft, e[31] = Ye, e[32] = Me) : Me = e[32];
  let He;
  e[33] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (He = /* @__PURE__ */ f("div", {}), e[33] = He) : He = e[33];
  let Je;
  e[34] !== i || e[35] !== c ? (Je = i && /* @__PURE__ */ F(St, { children: [
    /* @__PURE__ */ f("div", { className: "flex h-5 items-center justify-between gap-3 border-x border-slate-400 bg-white px-2", children: /* @__PURE__ */ f("p", { className: "text-sm text-slate-500", children: i }) }),
    c ? /* @__PURE__ */ F("div", { className: "flex items-center", children: [
      /* @__PURE__ */ f("div", { className: "h-px min-w-2 flex-1 bg-slate-400" }),
      /* @__PURE__ */ F("span", { className: "text-sm text-slate-500", children: [
        "(",
        c,
        ")"
      ] }),
      /* @__PURE__ */ f("div", { className: "h-px min-w-2 flex-1 bg-slate-400" })
    ] }) : /* @__PURE__ */ f("div", {})
  ] }), e[34] = i, e[35] = c, e[36] = Je) : Je = e[36];
  const pt = l.map((de, ne) => {
    const oe = B(de.paramIndex), ce = Z(de), Le = de.runtimeMember ? null : H(oe), tt = $ === ne, $e = X === ne, ht = ne === l.length - 1, mt = h[ne + 1], It = $e && de.valueType === "string" && g.length > 0;
    return /* @__PURE__ */ F(bn, { children: [
      /* @__PURE__ */ F("div", { ref: $e ? w : void 0, className: `flex min-h-5 items-start justify-between gap-3 border-x bg-white px-2 ${ht ? "border-b" : ""} border-slate-400 ${de.editable ? "cursor-text" : ""}`, onMouseDown: () => j(ne, de.editable), onClick: () => M(ne, de.editable), children: [
        /* @__PURE__ */ f("p", { className: "text-sm text-slate-500", children: de.label }),
        /* @__PURE__ */ F("div", { className: "flex flex-col items-end", children: [
          $e ? /* @__PURE__ */ f("input", { className: "field-sizing-content max-w-40 min-w-[1ch] bg-white p-0 text-right text-sm outline-none focus:ring-0 focus:outline-none", value: S, onChange: (Ke) => q(Ke, de.valueType), autoFocus: !0, onFocus: Em, onBlur: () => Y(ne), onKeyDown: (Ke) => ie(Ke, ne) }) : /* @__PURE__ */ f("p", { className: `min-w-12 text-right text-sm text-black tabular-nums ${tt ? "bg-selected" : ""}`, children: ce }),
          !d && /* @__PURE__ */ f("p", { className: "text-right text-sm tabular-nums", "aria-hidden": Le === null, children: /* @__PURE__ */ f("span", { className: Le !== null ? "text-slate-500" : "invisible", children: Le ?? " " }) })
        ] })
      ] }),
      It && /* @__PURE__ */ f(Xi, { ref: y, tags: g, inputValue: S, anchorElement: _, onSelect: (Ke, gt) => ae(ne, Ke, gt) }),
      mt ? /* @__PURE__ */ F("div", { className: "flex items-center", children: [
        /* @__PURE__ */ f("div", { className: "h-px min-w-2 flex-1 bg-slate-400" }),
        /* @__PURE__ */ F("span", { className: "text-sm text-slate-500", children: [
          "(",
          mt,
          ")"
        ] }),
        /* @__PURE__ */ f("div", { className: "h-px min-w-2 flex-1 bg-slate-400" })
      ] }) : /* @__PURE__ */ f("div", {})
    ] }, de.label);
  });
  let ee;
  return e[37] !== Me || e[38] !== He || e[39] !== Je || e[40] !== pt ? (ee = /* @__PURE__ */ F("div", { className: Ge, children: [
    Me,
    He,
    Je,
    pt
  ] }), e[37] = Me, e[38] = He, e[39] = Je, e[40] = pt, e[41] = ee) : ee = e[41], ee;
}
function Em(t) {
  return t.target.select();
}
const Dm = [{
  label: "Source A",
  paramIndex: 0,
  editable: !0,
  valueType: "string"
}, {
  label: "Source B",
  paramIndex: 1,
  editable: !0,
  valueType: "string"
}];
function km(t) {
  const e = Q.c(6), {
    instructionData: n,
    isSelected: r,
    rungId: o,
    type: s,
    errorSeverity: i
  } = t;
  let c;
  return e[0] !== i || e[1] !== n || e[2] !== r || e[3] !== o || e[4] !== s ? (c = /* @__PURE__ */ f(Wt, { instructionData: n, isSelected: r, rungId: o, title: s, rows: Dm, errorSeverity: i }), e[0] = i, e[1] = n, e[2] = r, e[3] = o, e[4] = s, e[5] = c) : c = e[5], c;
}
const $m = [{
  label: "Low Limit",
  paramIndex: 0,
  editable: !0,
  valueType: "string"
}, {
  label: "Test",
  paramIndex: 1,
  editable: !0,
  valueType: "string"
}, {
  label: "High Limit",
  paramIndex: 2,
  editable: !0,
  valueType: "string"
}];
function zm(t) {
  const e = Q.c(5), {
    instructionData: n,
    isSelected: r,
    rungId: o,
    errorSeverity: s
  } = t;
  let i;
  return e[0] !== s || e[1] !== n || e[2] !== r || e[3] !== o ? (i = /* @__PURE__ */ f(Wt, { instructionData: n, isSelected: r, rungId: o, title: "LIMIT", rows: $m, errorSeverity: s }), e[0] = s, e[1] = n, e[2] = r, e[3] = o, e[4] = i) : i = e[4], i;
}
const Am = [{
  label: "Counter",
  paramIndex: 0,
  editable: !0,
  valueType: "string"
}, {
  label: "Preset",
  paramIndex: 1,
  editable: !1,
  valueType: "number",
  runtimeMember: "PRE"
}, {
  label: "Accum",
  paramIndex: 2,
  editable: !1,
  valueType: "number",
  runtimeMember: "ACC"
}];
function Lm(t) {
  const e = Q.c(9), {
    instructionData: n,
    isSelected: r,
    rungId: o,
    type: s,
    errorSeverity: i
  } = t, c = s === ut.CTU ? "CU" : "CD";
  let l;
  e[0] !== c ? (l = {
    1: c,
    2: "DN"
  }, e[0] = c, e[1] = l) : l = e[1];
  let a;
  return e[2] !== i || e[3] !== n || e[4] !== r || e[5] !== o || e[6] !== l || e[7] !== s ? (a = /* @__PURE__ */ f(Wt, { instructionData: n, isSelected: r, rungId: o, title: s, rows: Am, rowStatuses: l, singleLine: !0, errorSeverity: i }), e[2] = i, e[3] = n, e[4] = r, e[5] = o, e[6] = l, e[7] = s, e[8] = a) : a = e[8], a;
}
const Pm = [{
  label: "Source A",
  paramIndex: 0,
  editable: !0,
  valueType: "string"
}, {
  label: "Source B",
  paramIndex: 1,
  editable: !0,
  valueType: "string"
}, {
  label: "Dest",
  paramIndex: 2,
  editable: !0,
  valueType: "string"
}];
function Um(t) {
  const e = Q.c(6), {
    instructionData: n,
    isSelected: r,
    rungId: o,
    type: s,
    errorSeverity: i
  } = t;
  let c;
  return e[0] !== i || e[1] !== n || e[2] !== r || e[3] !== o || e[4] !== s ? (c = /* @__PURE__ */ f(Wt, { instructionData: n, isSelected: r, rungId: o, title: s, rows: Pm, errorSeverity: i }), e[0] = i, e[1] = n, e[2] = r, e[3] = o, e[4] = s, e[5] = c) : c = e[5], c;
}
const Mm = [{
  label: "Source",
  paramIndex: 0,
  editable: !0,
  valueType: "string"
}, {
  label: "Dest",
  paramIndex: 1,
  editable: !0,
  valueType: "string"
}];
function Zm(t) {
  const e = Q.c(6), {
    instructionData: n,
    isSelected: r,
    rungId: o,
    type: s,
    errorSeverity: i
  } = t;
  let c;
  return e[0] !== i || e[1] !== n || e[2] !== r || e[3] !== o || e[4] !== s ? (c = /* @__PURE__ */ f(Wt, { instructionData: n, isSelected: r, rungId: o, title: s, rows: Mm, errorSeverity: i }), e[0] = i, e[1] = n, e[2] = r, e[3] = o, e[4] = s, e[5] = c) : c = e[5], c;
}
const Bm = [{
  label: "Unknown",
  paramIndex: 0,
  editable: !1,
  valueType: "string"
}];
function jm(t) {
  const e = Q.c(11), {
    isSelected: n,
    tag: r,
    type: o,
    errorSeverity: s
  } = t;
  let i;
  e[0] !== r ? (i = [r], e[0] = r, e[1] = i) : i = e[1];
  let c;
  e[2] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (c = [], e[2] = c) : c = e[2];
  let l;
  e[3] !== i || e[4] !== o ? (l = {
    type: z.INSTRUCTION,
    instructionType: o,
    id: "",
    parameters: i,
    errors: c
  }, e[3] = i, e[4] = o, e[5] = l) : l = e[5];
  const a = l;
  let u;
  return e[6] !== s || e[7] !== a || e[8] !== n || e[9] !== o ? (u = /* @__PURE__ */ f(Wt, { instructionData: a, isSelected: n, rungId: "", title: o, rows: Bm, errorSeverity: s }), e[6] = s, e[7] = a, e[8] = n, e[9] = o, e[10] = u) : u = e[10], u;
}
function Fm(t) {
  const e = Q.c(29), {
    isSelected: n,
    instructionData: r,
    type: o,
    rungId: s,
    errorSeverity: i
  } = t, {
    actions: c
  } = ke(), [l, a] = ye(!1), [u, d] = ye(!1), p = r.parameters[0] ?? "", h = n && !l && !u, v = n && !l && !u, m = i ?? (r.errors.length > 0 ? "error" : void 0), g = v ? "bg-white" : "bg-slate-400", I = m === "error" ? "border-red-500" : m === "warning" ? "border-amber-600" : v ? "border-white" : "border-slate-400", T = m === "error" ? "text-red-500" : m === "warning" ? "text-amber-600" : v ? "text-white" : "text-slate-400";
  let b;
  e[0] !== c || e[1] !== r || e[2] !== s ? (b = function($) {
    c.modifyInstruction({
      ...r,
      parameters: [$]
    }, s);
  }, e[0] = c, e[1] = r, e[2] = s, e[3] = b) : b = e[3];
  const x = b;
  let S;
  e[4] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (S = function() {
    a(!1);
  }, e[4] = S) : S = e[4];
  const C = S;
  let O;
  e[5] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (O = () => a(!0), e[5] = O) : O = e[5];
  let N;
  e[6] !== m || e[7] !== x || e[8] !== u || e[9] !== n || e[10] !== l || e[11] !== p ? (N = /* @__PURE__ */ f(Yi, { onMouseDown: O, isSelected: l, isInstructionSelected: n, parameter: p, errorSeverity: m, isEditing: u, onEditingChange: d, onParameterChange: x }), e[6] = m, e[7] = x, e[8] = u, e[9] = n, e[10] = l, e[11] = p, e[12] = N) : N = e[12];
  let E;
  e[13] !== h ? (E = h && /* @__PURE__ */ f("div", { className: "col-start-1 col-end-4 row-start-2 bg-selected" }), e[13] = h, e[14] = E) : E = e[14];
  const _ = `h-px w-full ${g}`;
  let w;
  e[15] !== _ ? (w = /* @__PURE__ */ f("div", { onMouseDown: C, className: "relative col-start-1 row-start-2 flex h-5 min-w-[16px] py-0.5", children: /* @__PURE__ */ f("div", { className: "absolute bottom-0 left-0 right-0 top-0 flex items-center", children: /* @__PURE__ */ f("div", { className: _ }) }) }), e[15] = _, e[16] = w) : w = e[16];
  let y;
  e[17] !== I || e[18] !== T || e[19] !== o ? (y = /* @__PURE__ */ f("div", { onMouseDown: C, className: "relative col-start-2 row-start-2 flex h-5 py-0.5", children: /* @__PURE__ */ f(fr, { label: o, centerClassName: "min-w-5", borderColor: I, textColor: T }) }), e[17] = I, e[18] = T, e[19] = o, e[20] = y) : y = e[20];
  const R = `h-px w-full ${g}`;
  let k;
  e[21] !== R ? (k = /* @__PURE__ */ f("div", { onMouseDown: C, className: "relative col-start-3 row-start-2 flex h-5 min-w-[16px] py-0.5", children: /* @__PURE__ */ f("div", { className: "absolute bottom-0 left-0 right-0 top-0 flex items-center", children: /* @__PURE__ */ f("div", { className: R }) }) }), e[21] = R, e[22] = k) : k = e[22];
  let A;
  return e[23] !== k || e[24] !== N || e[25] !== E || e[26] !== w || e[27] !== y ? (A = /* @__PURE__ */ F("div", { className: "inline-grid grid-cols-[min-content_minmax(min-content,1.25rem)_min-content] grid-rows-[1.25rem_1.25rem]", children: [
    N,
    E,
    w,
    y,
    k
  ] }), e[23] = k, e[24] = N, e[25] = E, e[26] = w, e[27] = y, e[28] = A) : A = e[28], A;
}
const Vm = [{
  label: "Timer",
  paramIndex: 0,
  editable: !0,
  valueType: "string"
}, {
  label: "Preset",
  paramIndex: 1,
  editable: !1,
  valueType: "number",
  runtimeMember: "PRE"
}, {
  label: "Accum",
  paramIndex: 2,
  editable: !1,
  valueType: "number",
  runtimeMember: "ACC"
}];
function Gm(t) {
  const e = Q.c(7), {
    instructionData: n,
    isSelected: r,
    rungId: o,
    type: s,
    errorSeverity: i
  } = t;
  let c;
  e[0] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (c = {
    1: "EN",
    2: "DN"
  }, e[0] = c) : c = e[0];
  let l;
  return e[1] !== i || e[2] !== n || e[3] !== r || e[4] !== o || e[5] !== s ? (l = /* @__PURE__ */ f(Wt, { instructionData: n, isSelected: r, rungId: o, title: s, rows: Vm, rowStatuses: c, singleLine: !0, errorSeverity: i }), e[1] = i, e[2] = n, e[3] = r, e[4] = o, e[5] = s, e[6] = l) : l = e[6], l;
}
function fo(t) {
  const e = Q.c(53), {
    instructionData: n,
    isSelected: r,
    rungId: o,
    isEnergized: s,
    errorSeverity: i
  } = t, c = s === void 0 ? !1 : s, {
    parameters: l,
    instructionType: a
  } = n, u = l?.[0] ?? "?";
  switch (a) {
    case be.XIC:
    case be.XIO:
    case be.ONS:
    case we.OTE:
    case we.OTL:
    case we.OTU: {
      let d;
      return e[0] !== i || e[1] !== n || e[2] !== a || e[3] !== c || e[4] !== r || e[5] !== o ? (d = /* @__PURE__ */ f(Rm, { type: a, instructionData: n, isSelected: r, rungId: o, isEnergized: c, errorSeverity: i }), e[0] = i, e[1] = n, e[2] = a, e[3] = c, e[4] = r, e[5] = o, e[6] = d) : d = e[6], d;
    }
    case Qe.TON:
    case Qe.TOF:
    case Qe.RTO: {
      let d;
      return e[7] !== i || e[8] !== n || e[9] !== a || e[10] !== r || e[11] !== o ? (d = /* @__PURE__ */ f(Gm, { type: a, instructionData: n, isSelected: r, rungId: o, errorSeverity: i }), e[7] = i, e[8] = n, e[9] = a, e[10] = r, e[11] = o, e[12] = d) : d = e[12], d;
    }
    case ut.CTU:
    case ut.CTD: {
      let d;
      return e[13] !== i || e[14] !== n || e[15] !== a || e[16] !== r || e[17] !== o ? (d = /* @__PURE__ */ f(Lm, { type: a, instructionData: n, isSelected: r, rungId: o, errorSeverity: i }), e[13] = i, e[14] = n, e[15] = a, e[16] = r, e[17] = o, e[18] = d) : d = e[18], d;
    }
    case Vt.RES: {
      let d;
      return e[19] !== i || e[20] !== n || e[21] !== a || e[22] !== r || e[23] !== o ? (d = /* @__PURE__ */ f(Fm, { type: a, instructionData: n, isSelected: r, rungId: o, errorSeverity: i }), e[19] = i, e[20] = n, e[21] = a, e[22] = r, e[23] = o, e[24] = d) : d = e[24], d;
    }
    case Gt.MOV: {
      let d;
      return e[25] !== i || e[26] !== n || e[27] !== a || e[28] !== r || e[29] !== o ? (d = /* @__PURE__ */ f(Zm, { type: a, instructionData: n, isSelected: r, rungId: o, errorSeverity: i }), e[25] = i, e[26] = n, e[27] = a, e[28] = r, e[29] = o, e[30] = d) : d = e[30], d;
    }
    case ze.ADD:
    case ze.SUB:
    case ze.MUL:
    case ze.DIV: {
      let d;
      return e[31] !== i || e[32] !== n || e[33] !== a || e[34] !== r || e[35] !== o ? (d = /* @__PURE__ */ f(Um, { type: a, instructionData: n, isSelected: r, rungId: o, errorSeverity: i }), e[31] = i, e[32] = n, e[33] = a, e[34] = r, e[35] = o, e[36] = d) : d = e[36], d;
    }
    case ge.EQ:
    case ge.NE:
    case ge.GT:
    case ge.GE:
    case ge.LT:
    case ge.LE: {
      let d;
      return e[37] !== i || e[38] !== n || e[39] !== a || e[40] !== r || e[41] !== o ? (d = /* @__PURE__ */ f(km, { type: a, instructionData: n, isSelected: r, rungId: o, errorSeverity: i }), e[37] = i, e[38] = n, e[39] = a, e[40] = r, e[41] = o, e[42] = d) : d = e[42], d;
    }
    case ge.LIMIT: {
      let d;
      return e[43] !== i || e[44] !== n || e[45] !== r || e[46] !== o ? (d = /* @__PURE__ */ f(zm, { instructionData: n, isSelected: r, rungId: o, errorSeverity: i }), e[43] = i, e[44] = n, e[45] = r, e[46] = o, e[47] = d) : d = e[47], d;
    }
    default: {
      let d;
      return e[48] !== i || e[49] !== a || e[50] !== r || e[51] !== u ? (d = /* @__PURE__ */ f(jm, { tag: u, type: a, isSelected: r, errorSeverity: i }), e[48] = i, e[49] = a, e[50] = r, e[51] = u, e[52] = d) : d = e[52], d;
    }
  }
}
function Hm(t) {
  if (!t) return null;
  if (t.type === z.INSTRUCTION)
    return {
      id: t.id,
      type: z.INSTRUCTION
    };
  const e = t.circuits[0];
  return e ? {
    id: e.id,
    type: z.CIRCUIT
  } : null;
}
function Jm(t) {
  const e = Q.c(45), {
    instructionId: n,
    instructionData: r,
    rungData: o
  } = t, {
    state: s,
    actions: i
  } = ke(), c = dc(), l = le(s);
  let a, u;
  e[0] !== s ? (a = () => {
    l.current = s;
  }, u = [s], e[0] = s, e[1] = a, e[2] = u) : (a = e[1], u = e[2]), ue(a, u);
  const {
    selectedIds: d,
    selectedType: p
  } = s.selection, h = p === z.INSTRUCTION && d.length > 1, v = d.length;
  let m;
  e[3] !== n || e[4] !== o ? (m = () => {
    const U = l.current, {
      selectedIds: H,
      selectedType: K
    } = U.selection;
    if (K === z.INSTRUCTION && H.length > 1) {
      const j = [];
      for (const M of H)
        for (const G of U.rungIds) {
          const q = U.rungs[G];
          if (!q || !vt(M, q.circuit))
            continue;
          const Y = Fn(M, q);
          Y && j.push(In(Y));
          break;
        }
      navigator.clipboard.writeText(j.join(""));
    } else {
      const j = Fn(n, o);
      if (!j)
        return;
      navigator.clipboard.writeText(In(j));
    }
  }, e[3] = n, e[4] = o, e[5] = m) : m = e[5];
  const g = m;
  let I;
  e[6] !== i || e[7] !== g || e[8] !== n || e[9] !== o ? (I = () => {
    g();
    const U = l.current, {
      selectedIds: H,
      selectedType: K
    } = U.selection;
    if (K === z.INSTRUCTION && H.length > 1) {
      const j = {
        ...U.rungs
      };
      for (const M of H)
        for (const G of U.rungIds) {
          const q = j[G];
          if (!q || !vt(M, q.circuit))
            continue;
          const {
            newRungData: Y
          } = Nt(M, q);
          j[G] = Y;
          break;
        }
      i.setRungs(j, U.rungIds);
    } else {
      const {
        newRungData: j
      } = Nt(n, o);
      i.modifyRung(j);
    }
  }, e[6] = i, e[7] = g, e[8] = n, e[9] = o, e[10] = I) : I = e[10];
  const T = I;
  let b;
  e[11] !== i || e[12] !== n || e[13] !== o ? (b = async () => {
    let U;
    try {
      U = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const {
      state: H
    } = wn(U);
    if (H.rungIds.length === 0)
      return;
    if (U.includes(";")) {
      const ie = l.current;
      let Ie = -1;
      for (let se = 0; se < ie.rungIds.length; se++)
        if (ie.rungs[ie.rungIds[se]]?.id === o.id) {
          Ie = se;
          break;
        }
      Ie === -1 && (Ie = ie.rungIds.length - 1);
      for (let se = 0; se < H.rungIds.length; se++) {
        const Oe = H.rungs[H.rungIds[se]];
        if (!Oe)
          continue;
        const Ge = Cn();
        Ge.circuit = on(Oe.circuit), i.addRung(Ge, Ie + 1 + se);
      }
      return;
    }
    const Z = H.rungs[H.rungIds[0]];
    if (!Z)
      return;
    const M = on(Z.circuit).elements;
    if (M.length === 0)
      return;
    const {
      parentCircuitId: G,
      index: q
    } = Rn(n, o.circuit);
    if (!G || q === null)
      return;
    let Y = {
      ...o
    };
    for (let ie = 0; ie < M.length; ie++)
      Y = Ft(M[ie], G, q + 1 + ie, Y);
    i.modifyRung(Y);
    const W = M[M.length - 1], ae = Hm(W);
    ae && i.select(ae.id, ae.type);
  }, e[11] = i, e[12] = n, e[13] = o, e[14] = b) : b = e[14];
  const x = b;
  let S;
  e[15] !== i || e[16] !== n || e[17] !== o ? (S = () => {
    const U = l.current, {
      selectedIds: H,
      selectedType: K
    } = U.selection;
    if (K === z.INSTRUCTION && H.length > 1) {
      const j = new Set(H);
      let M = null;
      for (const Y of U.rungIds) {
        const W = U.rungs[Y];
        if (W && Ut(W.circuit).some((ae) => j.has(ae))) {
          M = rr(W.circuit, j);
          break;
        }
      }
      const G = {
        ...U.rungs
      };
      for (const Y of H)
        for (const W of U.rungIds) {
          const ae = G[W];
          if (!ae || !vt(Y, ae.circuit))
            continue;
          const {
            newRungData: ie
          } = Nt(Y, ae);
          G[W] = ie;
          break;
        }
      const q = M ? {
        selectedIds: [M.id],
        selectedType: M.type,
        anchorId: M.id
      } : void 0;
      i.setRungs(G, U.rungIds, q);
    } else
      i.deleteInstruction(n, o.id);
  }, e[15] = i, e[16] = n, e[17] = o, e[18] = S) : S = e[18];
  const C = S, O = h ? `Copy ${v} Instructions` : "Copy Instruction", N = h ? `Cut ${v} Instructions` : "Cut Instruction", E = h ? `Delete ${v} Instructions` : "Delete Instruction";
  let _;
  e[19] !== r || e[20] !== c || e[21] !== o ? (_ = c && c({
    instructionData: r,
    rungData: o
  }), e[19] = r, e[20] = c, e[21] = o, e[22] = _) : _ = e[22];
  let w;
  e[23] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (w = Pt("⌘C", "Ctrl+C"), e[23] = w) : w = e[23];
  let y;
  e[24] !== O || e[25] !== g ? (y = /* @__PURE__ */ f(xt, { inset: !0, onClick: g, shortcut: w, children: O }), e[24] = O, e[25] = g, e[26] = y) : y = e[26];
  let R;
  e[27] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (R = Pt("⌘X", "Ctrl+X"), e[27] = R) : R = e[27];
  let k;
  e[28] !== N || e[29] !== T ? (k = /* @__PURE__ */ f(xt, { inset: !0, onClick: T, shortcut: R, children: N }), e[28] = N, e[29] = T, e[30] = k) : k = e[30];
  let A;
  e[31] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (A = Pt("⌘V", "Ctrl+V"), e[31] = A) : A = e[31];
  let P;
  e[32] !== x ? (P = /* @__PURE__ */ f(xt, { inset: !0, onClick: x, shortcut: A, children: "Paste After" }), e[32] = x, e[33] = P) : P = e[33];
  let $;
  e[34] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? ($ = /* @__PURE__ */ f(Qr, {}), e[34] = $) : $ = e[34];
  let X;
  e[35] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (X = Pt("⌫", "Del"), e[35] = X) : X = e[35];
  let L;
  e[36] !== E || e[37] !== C ? (L = /* @__PURE__ */ f(xt, { inset: !0, onClick: C, shortcut: X, children: E }), e[36] = E, e[37] = C, e[38] = L) : L = e[38];
  let B;
  return e[39] !== k || e[40] !== P || e[41] !== L || e[42] !== _ || e[43] !== y ? (B = /* @__PURE__ */ F(dr, { "data-width-48": !0, children: [
    _,
    y,
    k,
    P,
    $,
    L
  ] }), e[39] = k, e[40] = P, e[41] = L, e[42] = _, e[43] = y, e[44] = B) : B = e[44], B;
}
function Km(t) {
  const e = Q.c(46), {
    circuitId: n,
    instructionData: r,
    index: o,
    rungData: s
  } = t, {
    state: i,
    actions: c
  } = ke(), {
    errors: l
  } = Cc(r.id, s.id);
  let a;
  e[0] !== r.id || e[1] !== i.selection.selectedIds ? (a = i.selection.selectedIds.includes(r.id), e[0] = r.id, e[1] = i.selection.selectedIds, e[2] = a) : a = e[2];
  const u = a;
  let d;
  e[3] !== n || e[4] !== o || e[5] !== r || e[6] !== s.id ? (d = {
    type: "INSTRUCTION",
    circuitId: n,
    index: o,
    instructionData: r,
    rungId: s.id
  }, e[3] = n, e[4] = o, e[5] = r, e[6] = s.id, e[7] = d) : d = e[7];
  const p = d;
  let h;
  e[8] !== p || e[9] !== r.id ? (h = {
    id: r.id,
    data: p
  }, e[8] = p, e[9] = r.id, e[10] = h) : h = e[10];
  const {
    attributes: v,
    listeners: m,
    setNodeRef: g,
    isDragging: I
  } = $n(h);
  let T;
  e[11] !== c || e[12] !== r.id || e[13] !== u || e[14] !== i.selection.selectedIds.length ? (T = ($) => {
    if ($.stopPropagation(), u && $.button === 2)
      return;
    const X = $.shiftKey ? "range" : $.metaKey || $.ctrlKey ? "toggle" : "replace";
    X === "replace" && u && i.selection.selectedIds.length <= 1 || c.select(r.id, z.INSTRUCTION, X);
  }, e[11] = c, e[12] = r.id, e[13] = u, e[14] = i.selection.selectedIds.length, e[15] = T) : T = e[15];
  const b = T;
  let x;
  e[16] !== m || e[17] !== b ? (x = ($) => {
    (m ? m.onMouseDown : void 0)?.($), b($);
  }, e[16] = m, e[17] = b, e[18] = x) : x = e[18];
  const S = x;
  let C;
  e[19] !== m ? (C = m ? {
    ...m
  } : void 0, C && delete C.onMouseDown, e[19] = m, e[20] = C) : C = e[20];
  const O = I ? "opacity-50" : "opacity-100", N = `Ladder instruction ${r.instructionType}`, E = `flex shrink-0 cursor-default focus:outline-hidden ${O}`, _ = l[0]?.severity;
  let w;
  e[21] !== r || e[22] !== u || e[23] !== s.id || e[24] !== _ ? (w = /* @__PURE__ */ f(fo, { instructionData: r, isSelected: u, rungId: s.id, errorSeverity: _ }), e[21] = r, e[22] = u, e[23] = s.id, e[24] = _, e[25] = w) : w = e[25];
  let y;
  e[26] !== v || e[27] !== C || e[28] !== S || e[29] !== g || e[30] !== N || e[31] !== E || e[32] !== w ? (y = /* @__PURE__ */ f("div", { "aria-label": N, ref: g, ...v, ...C, className: E, onMouseDown: S, children: w }), e[26] = v, e[27] = C, e[28] = S, e[29] = g, e[30] = N, e[31] = E, e[32] = w, e[33] = y) : y = e[33];
  let R;
  e[34] !== l || e[35] !== y ? (R = /* @__PURE__ */ f(La, { errors: l, children: y }), e[34] = l, e[35] = y, e[36] = R) : R = e[36];
  let k;
  e[37] !== b || e[38] !== R ? (k = /* @__PURE__ */ f(ur, { className: "flex shrink-0", onContextMenu: b, children: R }), e[37] = b, e[38] = R, e[39] = k) : k = e[39];
  let A;
  e[40] !== r || e[41] !== s ? (A = /* @__PURE__ */ f(Jm, { instructionId: r.id, instructionData: r, rungData: s }), e[40] = r, e[41] = s, e[42] = A) : A = e[42];
  let P;
  return e[43] !== k || e[44] !== A ? (P = /* @__PURE__ */ F(qr, { children: [
    k,
    A
  ] }), e[43] = k, e[44] = A, e[45] = P) : P = e[45], P;
}
function qi(t) {
  const e = Q.c(48), {
    branchContinuation: n,
    circuitData: r,
    rungData: o,
    isBranch: s
  } = t, {
    state: i,
    actions: c
  } = ke();
  let l;
  e[0] !== r.id || e[1] !== i.selection.selectedIds ? (l = i.selection.selectedIds.includes(r.id), e[0] = r.id, e[1] = i.selection.selectedIds, e[2] = l) : l = e[2];
  const a = l, u = r.elements.length < 1;
  let d;
  e[3] !== r ? (d = Ds(r), e[3] = r, e[4] = d) : d = e[4];
  const p = d, h = s && n;
  let v;
  e[5] !== c || e[6] !== r.id || e[7] !== s || e[8] !== a || e[9] !== i.selection.selectedIds.length ? (v = (_) => {
    if (_.stopPropagation(), a && _.button === 2)
      return;
    const w = s ? z.CIRCUIT : z.RUNG, y = _.shiftKey ? "range" : _.metaKey || _.ctrlKey ? "toggle" : "replace";
    y === "replace" && a && i.selection.selectedIds.length <= 1 || c.select(r.id, w, y);
  }, e[5] = c, e[6] = r.id, e[7] = s, e[8] = a, e[9] = i.selection.selectedIds.length, e[10] = v) : v = e[10];
  const m = v;
  let g;
  e[11] !== h ? (g = h && /* @__PURE__ */ f("div", { className: "absolute bottom-[-1.875em] left-0 top-[1.875em] w-px bg-slate-400" }), e[11] = h, e[12] = g) : g = e[12];
  let I;
  e[13] !== s || e[14] !== a ? (I = a && s && /* @__PURE__ */ f("div", { className: "absolute -left-2 top-3 h-8 w-4 bg-selected" }), e[13] = s, e[14] = a, e[15] = I) : I = e[15];
  const T = p === -1;
  let b;
  e[16] !== r.id || e[17] !== o.id || e[18] !== T || e[19] !== u ? (b = /* @__PURE__ */ f(Cr, { full: T, circuitId: r.id, index: -1, wider: u, rungId: o.id }), e[16] = r.id, e[17] = o.id, e[18] = T, e[19] = u, e[20] = b) : b = e[20];
  let x;
  if (e[21] !== r.elements || e[22] !== r.id || e[23] !== p || e[24] !== o) {
    let _;
    e[26] !== r.id || e[27] !== p || e[28] !== o ? (_ = (w, y) => {
      const R = y === p;
      if (w.type === z.BRANCH)
        return /* @__PURE__ */ F(bn, { children: [
          /* @__PURE__ */ f("div", { className: "flex shrink-0 flex-col", children: w.circuits.map((k, A) => /* @__PURE__ */ f(qi, { branchContinuation: A < w.circuits.length - 1, circuitData: k, isBranch: !0, rungData: o }, k.id)) }),
          /* @__PURE__ */ f(Cr, { full: R, circuitId: r.id, index: y, rungId: o.id })
        ] }, w.id);
      if (w.type === z.INSTRUCTION)
        return /* @__PURE__ */ F(bn, { children: [
          /* @__PURE__ */ f(Km, { circuitId: r.id, instructionData: w, index: y, rungData: o }),
          /* @__PURE__ */ f(Cr, { full: R, circuitId: r.id, index: y, rungId: o.id })
        ] }, w.id);
    }, e[26] = r.id, e[27] = p, e[28] = o, e[29] = _) : _ = e[29], x = r.elements.map(_), e[21] = r.elements, e[22] = r.id, e[23] = p, e[24] = o, e[25] = x;
  } else
    x = e[25];
  let S;
  e[30] !== h ? (S = h && /* @__PURE__ */ f("div", { className: "absolute bottom-[-1.875em] right-0 top-[1.875em] w-px bg-slate-400" }), e[30] = h, e[31] = S) : S = e[31];
  let C;
  e[32] !== g || e[33] !== I || e[34] !== b || e[35] !== x || e[36] !== S ? (C = /* @__PURE__ */ f(ur, { className: "flex min-w-full shrink-0", children: /* @__PURE__ */ F("div", { className: "relative flex min-w-full shrink-0", children: [
    g,
    I,
    b,
    x,
    S
  ] }) }), e[32] = g, e[33] = I, e[34] = b, e[35] = x, e[36] = S, e[37] = C) : C = e[37];
  let O;
  e[38] !== r.id || e[39] !== s || e[40] !== o ? (O = s ? /* @__PURE__ */ f(Ia, { circuitId: r.id, rungData: o }) : /* @__PURE__ */ f(ti, { rungData: o }), e[38] = r.id, e[39] = s, e[40] = o, e[41] = O) : O = e[41];
  let N;
  e[42] !== C || e[43] !== O ? (N = /* @__PURE__ */ F(qr, { children: [
    C,
    O
  ] }), e[42] = C, e[43] = O, e[44] = N) : N = e[44];
  let E;
  return e[45] !== m || e[46] !== N ? (E = /* @__PURE__ */ f("div", { className: "flex min-w-full shrink-0", onMouseDown: m, onContextMenu: m, children: N }), e[45] = m, e[46] = N, e[47] = E) : E = e[47], E;
}
var Qi = {
  color: void 0,
  size: void 0,
  className: void 0,
  style: void 0,
  attr: void 0
}, os = fe.createContext && /* @__PURE__ */ fe.createContext(Qi), Wm = ["attr", "size", "title"];
function Xm(t, e) {
  if (t == null) return {};
  var n = Ym(t, e), r, o;
  if (Object.getOwnPropertySymbols) {
    var s = Object.getOwnPropertySymbols(t);
    for (o = 0; o < s.length; o++)
      r = s[o], !(e.indexOf(r) >= 0) && Object.prototype.propertyIsEnumerable.call(t, r) && (n[r] = t[r]);
  }
  return n;
}
function Ym(t, e) {
  if (t == null) return {};
  var n = {};
  for (var r in t)
    if (Object.prototype.hasOwnProperty.call(t, r)) {
      if (e.indexOf(r) >= 0) continue;
      n[r] = t[r];
    }
  return n;
}
function Qn() {
  return Qn = Object.assign ? Object.assign.bind() : function(t) {
    for (var e = 1; e < arguments.length; e++) {
      var n = arguments[e];
      for (var r in n)
        Object.prototype.hasOwnProperty.call(n, r) && (t[r] = n[r]);
    }
    return t;
  }, Qn.apply(this, arguments);
}
function ss(t, e) {
  var n = Object.keys(t);
  if (Object.getOwnPropertySymbols) {
    var r = Object.getOwnPropertySymbols(t);
    e && (r = r.filter(function(o) {
      return Object.getOwnPropertyDescriptor(t, o).enumerable;
    })), n.push.apply(n, r);
  }
  return n;
}
function er(t) {
  for (var e = 1; e < arguments.length; e++) {
    var n = arguments[e] != null ? arguments[e] : {};
    e % 2 ? ss(Object(n), !0).forEach(function(r) {
      qm(t, r, n[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(n)) : ss(Object(n)).forEach(function(r) {
      Object.defineProperty(t, r, Object.getOwnPropertyDescriptor(n, r));
    });
  }
  return t;
}
function qm(t, e, n) {
  return e = Qm(e), e in t ? Object.defineProperty(t, e, { value: n, enumerable: !0, configurable: !0, writable: !0 }) : t[e] = n, t;
}
function Qm(t) {
  var e = eg(t, "string");
  return typeof e == "symbol" ? e : e + "";
}
function eg(t, e) {
  if (typeof t != "object" || !t) return t;
  var n = t[Symbol.toPrimitive];
  if (n !== void 0) {
    var r = n.call(t, e);
    if (typeof r != "object") return r;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (e === "string" ? String : Number)(t);
}
function ec(t) {
  return t && t.map((e, n) => /* @__PURE__ */ fe.createElement(e.tag, er({
    key: n
  }, e.attr), ec(e.child)));
}
function tg(t) {
  return (e) => /* @__PURE__ */ fe.createElement(ng, Qn({
    attr: er({}, t.attr)
  }, e), ec(t.child));
}
function ng(t) {
  var e = (n) => {
    var {
      attr: r,
      size: o,
      title: s
    } = t, i = Xm(t, Wm), c = o || n.size || "1em", l;
    return n.className && (l = n.className), t.className && (l = (l ? l + " " : "") + t.className), /* @__PURE__ */ fe.createElement("svg", Qn({
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0"
    }, n.attr, r, i, {
      className: l,
      style: er(er({
        color: t.color || n.color
      }, n.style), t.style),
      height: c,
      width: c,
      xmlns: "http://www.w3.org/2000/svg"
    }), s && /* @__PURE__ */ fe.createElement("title", null, s), t.children);
  };
  return os !== void 0 ? /* @__PURE__ */ fe.createElement(os.Consumer, null, (n) => e(n)) : e(Qi);
}
function rg(t) {
  return tg({ attr: { viewBox: "0 0 24 24" }, child: [{ tag: "path", attr: { d: "M12.884 2.532c-.346-.654-1.422-.654-1.768 0l-9 17A.999.999 0 0 0 3 21h18a.998.998 0 0 0 .883-1.467L12.884 2.532zM13 18h-2v-2h2v2zm-2-4V9h2l.001 5H11z" }, child: [] }] })(t);
}
function og(t) {
  const e = Q.c(2), {
    rungData: n
  } = t, {
    errors: r
  } = ke(), o = r.filter((u) => u.rungId === n.id), s = o.some(ig), i = o.some(sg);
  if (!s && !i)
    return null;
  const l = `h-full w-full ${s ? "text-red-600" : "text-amber-600"}`;
  let a;
  return e[0] !== l ? (a = /* @__PURE__ */ f("div", { className: "my-auto ml-2 flex h-5 w-5 items-center justify-center", children: /* @__PURE__ */ f(rg, { className: l }) }), e[0] = l, e[1] = a) : a = e[1], a;
}
function sg(t) {
  return t.severity === "warning";
}
function ig(t) {
  return t.severity === "error";
}
function cg(t) {
  const e = Q.c(54), {
    rungId: n,
    index: r
  } = t, {
    state: o,
    actions: s
  } = ke(), i = jr(), c = o.rungs[n];
  let l;
  e[0] !== c || e[1] !== o.selection ? (l = c ? o.selection.selectedIds.includes(c.circuit.id) : !1, e[0] = c, e[1] = o.selection, e[2] = l) : l = e[2];
  const a = l, u = i?.isRunning ?? !1, d = u ? "border-green-400" : "border-slate-400", p = u ? "after:content-[''] after:absolute after:inset-y-0 after:left-0 after:w-1.5 after:-translate-x-1/2 after:bg-green-400" : "";
  let h;
  e[3] !== r || e[4] !== c ? (h = {
    type: "RUNG",
    index: r,
    rungData: c
  }, e[3] = r, e[4] = c, e[5] = h) : h = e[5];
  const v = h, m = `rung-drag-${n}`, g = !c;
  let I;
  e[6] !== v || e[7] !== m || e[8] !== g ? (I = {
    id: m,
    data: v,
    disabled: g
  }, e[6] = v, e[7] = m, e[8] = g, e[9] = I) : I = e[9];
  const {
    attributes: T,
    listeners: b,
    setNodeRef: x,
    isDragging: S
  } = $n(I), C = {
    accepts: ["RUNG", "TOOL_RUNG"],
    index: r
  }, {
    setNodeRef: O,
    isOver: N,
    active: E
  } = Xr({
    id: `rung-drop-${n}`,
    data: C
  });
  let _;
  e: {
    if (!E) {
      _ = !1;
      break e;
    }
    const se = E.data.current;
    if (!C.accepts.includes(se.type)) {
      _ = !1;
      break e;
    }
    if (se.type === "RUNG") {
      _ = se.index > r || se.index < r - 1;
      break e;
    }
    _ = !0;
  }
  const w = _;
  let y;
  e[10] !== s || e[11] !== a || e[12] !== c || e[13] !== o.selection ? (y = (se) => {
    if (se.stopPropagation(), a && se.button === 2)
      return;
    const Oe = se.shiftKey ? "range" : se.metaKey || se.ctrlKey ? "toggle" : "replace";
    Oe === "replace" && a && o.selection.selectedIds.length <= 1 || s.select(c.circuit.id, z.RUNG, Oe);
  }, e[10] = s, e[11] = a, e[12] = c, e[13] = o.selection, e[14] = y) : y = e[14];
  const R = y;
  if (!c)
    return null;
  const k = N ? "rounded-full bg-green-400" : "bg-slate-400", P = `relative flex cursor-default ${S ? "opacity-50" : "opacity-100"} pr-2`;
  let $;
  e[15] !== w || e[16] !== k ? ($ = w && /* @__PURE__ */ f("div", { className: `absolute left-10 h-3 w-3 border border-slate-500 ${k}` }), e[15] = w, e[16] = k, e[17] = $) : $ = e[17];
  const X = `${a ? "bg-selected" : "bg-transparent"}`;
  let L;
  e[18] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (L = /* @__PURE__ */ f("div", { className: "w-2" }), e[18] = L) : L = e[18];
  const B = r >= 0 && r;
  let U;
  e[19] !== B ? (U = /* @__PURE__ */ f("p", { className: "text-md my-auto select-none text-black", children: B }), e[19] = B, e[20] = U) : U = e[20];
  let H;
  e[21] !== c ? (H = /* @__PURE__ */ f(og, { rungData: c }), e[21] = c, e[22] = H) : H = e[22];
  let K;
  e[23] !== U || e[24] !== H ? (K = /* @__PURE__ */ F("div", { className: "flex h-14 w-12 flex-none", children: [
    L,
    U,
    H
  ] }), e[23] = U, e[24] = H, e[25] = K) : K = e[25];
  let Z;
  e[26] !== T || e[27] !== b || e[28] !== x || e[29] !== X || e[30] !== K ? (Z = /* @__PURE__ */ f(ur, { className: "flex h-full", children: /* @__PURE__ */ f("div", { ref: x, ...T, ...b, className: X, children: K }) }), e[26] = T, e[27] = b, e[28] = x, e[29] = X, e[30] = K, e[31] = Z) : Z = e[31];
  let j;
  e[32] !== c ? (j = /* @__PURE__ */ f(ti, { rungData: c }), e[32] = c, e[33] = j) : j = e[33];
  let M;
  e[34] !== Z || e[35] !== j ? (M = /* @__PURE__ */ F(qr, { children: [
    Z,
    j
  ] }), e[34] = Z, e[35] = j, e[36] = M) : M = e[36];
  let G;
  e[37] !== R || e[38] !== M ? (G = /* @__PURE__ */ f("div", { onMouseDown: R, onContextMenu: R, children: M }), e[37] = R, e[38] = M, e[39] = G) : G = e[39];
  const q = `relative flex w-full overflow-visible border-l ${d} ${p}`;
  let Y;
  e[40] !== c ? (Y = /* @__PURE__ */ f(qi, { circuitData: c.circuit, rungData: c }), e[40] = c, e[41] = Y) : Y = e[41];
  const W = `relative overflow-visible border-l ${d} pr-1 ${p}`;
  let ae;
  e[42] !== W ? (ae = /* @__PURE__ */ f("div", { className: W }), e[42] = W, e[43] = ae) : ae = e[43];
  let ie;
  e[44] !== q || e[45] !== Y || e[46] !== ae ? (ie = /* @__PURE__ */ F("div", { className: q, children: [
    Y,
    ae
  ] }), e[44] = q, e[45] = Y, e[46] = ae, e[47] = ie) : ie = e[47];
  let Ie;
  return e[48] !== O || e[49] !== G || e[50] !== ie || e[51] !== P || e[52] !== $ ? (Ie = /* @__PURE__ */ F("div", { ref: O, className: P, children: [
    $,
    G,
    ie
  ] }), e[48] = O, e[49] = G, e[50] = ie, e[51] = P, e[52] = $, e[53] = Ie) : Ie = e[53], Ie;
}
function is(t) {
  const {
    selectedIds: e
  } = t.selection;
  if (e.length === 0) return "";
  const n = [];
  for (const r of e)
    for (const o of t.rungIds) {
      const s = t.rungs[o];
      if (!s || !vt(r, s.circuit)) continue;
      const i = Fn(r, s);
      i && n.push(In(i));
      break;
    }
  return n.join("");
}
function cs(t) {
  const {
    selectedIds: e
  } = t.selection;
  if (e.length === 0) return "";
  const n = [];
  for (const r of t.rungIds) {
    const o = t.rungs[r];
    o && e.includes(o.circuit.id) && n.push(nn(o.circuit));
  }
  return n.length > 0 ? n.join(";") + ";" : "";
}
function po(t, e) {
  if (e.id === t) return e;
  for (const n of e.elements)
    if (n.type === z.BRANCH)
      for (const r of n.circuits) {
        const o = po(t, r);
        if (o) return o;
      }
  return null;
}
function ls(t) {
  const {
    selectedIds: e
  } = t.selection;
  if (e.length === 0) return "";
  const n = [];
  for (const r of e)
    for (const o of t.rungIds) {
      const s = t.rungs[o];
      if (!s || !vt(r, s.circuit)) continue;
      const i = po(r, s.circuit);
      i && n.push(nn(i));
      break;
    }
  return n.join("");
}
function lg(t) {
  if (!t) return null;
  if (t.type === z.INSTRUCTION)
    return {
      id: t.id,
      type: z.INSTRUCTION
    };
  const e = t.circuits[0];
  return e ? {
    id: e.id,
    type: z.CIRCUIT
  } : null;
}
function ag(t, e, n) {
  const r = t.rungIds.map((o) => t.rungs[o]).filter(Boolean).map((o) => {
    const s = Cn();
    return s.circuit = on(o.circuit), s;
  });
  r.length > 0 && n.pasteRungs(r, e);
}
function ug(t) {
  return t instanceof HTMLElement ? t.isContentEditable ? !0 : t.closest("input, textarea, [contenteditable='true'], [role='textbox']") !== null : !1;
}
function Cg() {
  const t = Q.c(50), {
    state: e,
    actions: n
  } = ke(), r = le(null);
  let o;
  t[0] !== e.selection.selectedIds.length ? (o = () => {
    const _ = r.current;
    e.selection.selectedIds.length > 0 && _ && !_.contains(document.activeElement) && _.focus();
  }, t[0] = e.selection.selectedIds.length, t[1] = o) : o = t[1];
  let s;
  t[2] !== e.selection.selectedIds ? (s = [e.selection.selectedIds], t[2] = e.selection.selectedIds, t[3] = s) : s = t[3], ue(o, s);
  const i = fg;
  let c;
  t[4] !== e ? (c = (_) => {
    _.preventDefault();
    const {
      selectedType: w
    } = e.selection;
    let y = "";
    w === z.INSTRUCTION ? y = is(e) : w === z.RUNG ? y = cs(e) : w === z.CIRCUIT && (y = ls(e)), y && navigator.clipboard.writeText(y);
  }, t[4] = e, t[5] = c) : c = t[5];
  const l = c;
  let a;
  t[6] !== n || t[7] !== e.rungIds || t[8] !== e.rungs || t[9] !== e.selection ? (a = () => {
    const {
      selectedIds: _
    } = e.selection, w = new Set(_), y = e.rungIds.map(($) => e.rungs[$]?.circuit.id).filter(Boolean), R = tn(y, w), k = e.rungIds.filter(($) => {
      const X = e.rungs[$];
      return !X || !w.has(X.circuit.id);
    }), A = {};
    for (const $ of k)
      e.rungs[$] && (A[$] = e.rungs[$]);
    const P = R ? {
      selectedIds: [R],
      selectedType: z.RUNG,
      anchorId: R
    } : void 0;
    n.setRungs(A, k, P);
  }, t[6] = n, t[7] = e.rungIds, t[8] = e.rungs, t[9] = e.selection, t[10] = a) : a = t[10];
  const u = a;
  let d;
  t[11] !== n || t[12] !== e.rungIds || t[13] !== e.rungs || t[14] !== e.selection ? (d = () => {
    const {
      selectedIds: _
    } = e.selection, w = {
      ...e.rungs
    };
    let y = null;
    for (const k of _)
      for (const A of e.rungIds) {
        const P = w[A];
        if (!P || !vt(k, P.circuit))
          continue;
        y || (y = P.circuit.id);
        const {
          newRungData: $
        } = Nt(k, P);
        w[A] = $;
        break;
      }
    const R = y ? {
      selectedIds: [y],
      selectedType: z.RUNG,
      anchorId: y
    } : void 0;
    n.setRungs(w, e.rungIds, R);
  }, t[11] = n, t[12] = e.rungIds, t[13] = e.rungs, t[14] = e.selection, t[15] = d) : d = t[15];
  const p = d;
  let h;
  t[16] !== n || t[17] !== e.rungIds || t[18] !== e.rungs || t[19] !== e.selection ? (h = () => {
    const {
      selectedIds: _
    } = e.selection, w = new Set(_);
    let y = null;
    for (const A of e.rungIds) {
      const P = e.rungs[A];
      if (P && Ut(P.circuit).some(($) => w.has($))) {
        y = rr(P.circuit, w);
        break;
      }
    }
    const R = {
      ...e.rungs
    };
    for (const A of _)
      for (const P of e.rungIds) {
        const $ = R[P];
        if (!$ || !vt(A, $.circuit))
          continue;
        const {
          newRungData: X
        } = Nt(A, $);
        R[P] = X;
        break;
      }
    const k = y ? {
      selectedIds: [y.id],
      selectedType: y.type,
      anchorId: y.id
    } : void 0;
    n.setRungs(R, e.rungIds, k);
  }, t[16] = n, t[17] = e.rungIds, t[18] = e.rungs, t[19] = e.selection, t[20] = h) : h = t[20];
  const v = h;
  let m;
  t[21] !== p || t[22] !== v || t[23] !== u || t[24] !== e ? (m = (_) => {
    _.preventDefault();
    const {
      selectedIds: w,
      selectedType: y
    } = e.selection;
    if (w.length !== 0) {
      if (y === z.INSTRUCTION) {
        const R = is(e);
        R && navigator.clipboard.writeText(R), v();
      } else if (y === z.RUNG) {
        const R = cs(e);
        R && navigator.clipboard.writeText(R), u();
      } else if (y === z.CIRCUIT) {
        const R = ls(e);
        R && navigator.clipboard.writeText(R), p();
      }
    }
  }, t[21] = p, t[22] = v, t[23] = u, t[24] = e, t[25] = m) : m = t[25];
  const g = m;
  let I;
  t[26] !== p || t[27] !== v || t[28] !== u || t[29] !== e.selection ? (I = (_) => {
    _.preventDefault();
    const {
      selectedIds: w,
      selectedType: y
    } = e.selection;
    w.length !== 0 && (y === z.INSTRUCTION ? v() : y === z.RUNG ? u() : y === z.CIRCUIT && p());
  }, t[26] = p, t[27] = v, t[28] = u, t[29] = e.selection, t[30] = I) : I = t[30];
  const T = I;
  let b;
  t[31] !== n || t[32] !== e.rungIds || t[33] !== e.rungs || t[34] !== e.selection ? (b = async (_) => {
    _.preventDefault();
    let w;
    try {
      w = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const {
      state: y
    } = wn(w);
    if (y.rungIds.length === 0)
      return;
    const R = e.selection.selectedIds.at(-1) ?? null, {
      selectedType: k
    } = e.selection, A = w.includes(";"), P = e.rungIds.map(($) => e.rungs[$]).filter(Boolean);
    if (!A && R) {
      const $ = y.rungs[y.rungIds[0]];
      if (!$)
        return;
      const L = on($.circuit).elements;
      if (L.length === 0)
        return;
      const B = rn(R, P);
      if (B === -1)
        return;
      const U = P[B];
      let H, K;
      if (k === z.INSTRUCTION) {
        const {
          parentCircuitId: G,
          index: q
        } = Rn(R, U.circuit);
        if (!G || q === null)
          return;
        H = G, K = q + 1;
      } else {
        if (!po(R, U.circuit))
          return;
        H = R, K = 0;
      }
      let Z = {
        ...U
      };
      for (let G = 0; G < L.length; G++)
        Z = Ft(L[G], H, K + G, Z);
      n.modifyRung(Z);
      const j = L[L.length - 1], M = lg(j);
      M && n.select(M.id, M.type);
    } else {
      let $ = e.rungIds.length;
      if (R) {
        const X = rn(R, P);
        X !== -1 && ($ = X + 1);
      }
      ag(y, $, n);
    }
  }, t[31] = n, t[32] = e.rungIds, t[33] = e.rungs, t[34] = e.selection, t[35] = b) : b = t[35];
  const x = b;
  let S;
  t[36] !== n || t[37] !== l || t[38] !== g || t[39] !== T || t[40] !== x ? (S = (_) => {
    if (ug(_.target))
      return;
    const w = _.metaKey || _.ctrlKey, y = _.key.toLowerCase(), R = w && y === "z" && !_.shiftKey, k = w && y === "z" && _.shiftKey, A = _.ctrlKey && !_.metaKey && y === "y";
    R ? (_.preventDefault(), n.undo()) : k || A ? (_.preventDefault(), n.redo()) : w && y === "a" ? (_.preventDefault(), n.selectAll()) : w && y === "c" ? l(_) : w && y === "x" ? g(_) : w && y === "v" ? x(_) : (y === "delete" || y === "backspace") && T(_);
  }, t[36] = n, t[37] = l, t[38] = g, t[39] = T, t[40] = x, t[41] = S) : S = t[41];
  const C = S;
  let O;
  t[42] !== e.rungIds ? (O = e.rungIds.map(dg), t[42] = e.rungIds, t[43] = O) : O = t[43];
  let N;
  t[44] !== e.rungIds.length ? (N = /* @__PURE__ */ f(ba, { index: e.rungIds.length }), t[44] = e.rungIds.length, t[45] = N) : N = t[45];
  let E;
  return t[46] !== C || t[47] !== O || t[48] !== N ? (E = /* @__PURE__ */ F("div", { ref: r, className: "h-full select-none overflow-auto bg-white pt-2 focus:outline-hidden", tabIndex: 0, onContextMenu: i, onKeyDown: C, children: [
    O,
    N
  ] }), t[46] = C, t[47] = O, t[48] = N, t[49] = E) : E = t[49], E;
}
function dg(t, e) {
  return /* @__PURE__ */ f(cg, { rungId: t, index: e }, t);
}
function fg(t) {
  t.preventDefault();
}
function kr(t) {
  const e = Q.c(3), {
    full: n
  } = t, o = `flex h-15 min-w-4 flex-col justify-center ${n ? "w-full" : "w-4"}`;
  let s;
  e[0] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (s = /* @__PURE__ */ f("div", { className: "h-px w-full bg-slate-400" }), e[0] = s) : s = e[0];
  let i;
  return e[1] !== o ? (i = /* @__PURE__ */ f("div", { className: o, children: s }), e[1] = o, e[2] = i) : i = e[2], i;
}
function tc(t) {
  const e = Q.c(20), {
    circuitData: n,
    rungData: r,
    isBranch: o,
    branchContinuation: s
  } = t;
  let i;
  e[0] !== n ? (i = Ds(n), e[0] = n, e[1] = i) : i = e[1];
  const c = i, l = o && s;
  let a;
  e[2] !== l ? (a = l && /* @__PURE__ */ f("div", { className: "absolute bottom-[-1.875em] left-0 top-[1.875em] w-px bg-slate-400" }), e[2] = l, e[3] = a) : a = e[3];
  const u = c === -1;
  let d;
  e[4] !== u ? (d = /* @__PURE__ */ f(kr, { full: u }), e[4] = u, e[5] = d) : d = e[5];
  let p;
  if (e[6] !== n.elements || e[7] !== c || e[8] !== r) {
    let m;
    e[10] !== c || e[11] !== r ? (m = (g, I) => {
      const T = I === c;
      return g.type === z.BRANCH ? /* @__PURE__ */ F(bn, { children: [
        /* @__PURE__ */ f("div", { className: "flex shrink-0 flex-col", children: g.circuits.map((b, x) => /* @__PURE__ */ f(tc, { branchContinuation: x < g.circuits.length - 1, circuitData: b, isBranch: !0, rungData: r }, b.id)) }),
        /* @__PURE__ */ f(kr, { full: T })
      ] }, g.id) : /* @__PURE__ */ F(bn, { children: [
        /* @__PURE__ */ f("div", { className: "flex shrink-0", children: /* @__PURE__ */ f(fo, { instructionData: g, isSelected: !1, rungId: r.id }) }),
        /* @__PURE__ */ f(kr, { full: T })
      ] }, g.id);
    }, e[10] = c, e[11] = r, e[12] = m) : m = e[12], p = n.elements.map(m), e[6] = n.elements, e[7] = c, e[8] = r, e[9] = p;
  } else
    p = e[9];
  let h;
  e[13] !== l ? (h = l && /* @__PURE__ */ f("div", { className: "absolute bottom-[-1.875em] right-0 top-[1.875em] w-px bg-slate-400" }), e[13] = l, e[14] = h) : h = e[14];
  let v;
  return e[15] !== a || e[16] !== d || e[17] !== p || e[18] !== h ? (v = /* @__PURE__ */ f("div", { className: "flex min-w-full shrink-0", children: /* @__PURE__ */ F("div", { className: "relative flex min-w-full shrink-0", children: [
    a,
    d,
    p,
    h
  ] }) }), e[15] = a, e[16] = d, e[17] = p, e[18] = h, e[19] = v) : v = e[19], v;
}
function pg(t) {
  const e = Q.c(11), {
    rungData: n,
    index: r
  } = t;
  let o;
  e[0] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (o = /* @__PURE__ */ f("div", { className: "w-2" }), e[0] = o) : o = e[0];
  let s;
  e[1] !== r ? (s = /* @__PURE__ */ F("div", { className: "flex h-14 w-12 flex-none items-center", children: [
    o,
    /* @__PURE__ */ f("p", { className: "text-md text-black", children: r })
  ] }), e[1] = r, e[2] = s) : s = e[2];
  let i;
  e[3] !== n ? (i = /* @__PURE__ */ f(tc, { circuitData: n.circuit, rungData: n }), e[3] = n, e[4] = i) : i = e[4];
  let c;
  e[5] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (c = /* @__PURE__ */ f("div", { className: "relative overflow-visible border-l border-slate-400 pr-1" }), e[5] = c) : c = e[5];
  let l;
  e[6] !== i ? (l = /* @__PURE__ */ F("div", { className: "relative flex w-full overflow-visible border-l border-slate-400", children: [
    i,
    c
  ] }), e[6] = i, e[7] = l) : l = e[7];
  let a;
  return e[8] !== s || e[9] !== l ? (a = /* @__PURE__ */ F("div", { className: "flex pr-2", children: [
    s,
    l
  ] }), e[8] = s, e[9] = l, e[10] = a) : a = e[10], a;
}
function Zn(t) {
  const e = Q.c(14), {
    type: n,
    isEnabled: r
  } = t, o = r ? "border-slate-700" : "border-slate-400", s = r ? "bg-slate-700" : "bg-slate-400", i = r ? "text-slate-700" : "text-slate-400";
  if (n === be.ONS) {
    let h;
    return e[0] !== i ? (h = /* @__PURE__ */ f("div", { className: "flex h-4 items-center", children: /* @__PURE__ */ f(si, { textColor: i }) }), e[0] = i, e[1] = h) : h = e[1], h;
  }
  const c = `my-auto -mr-0.5 h-px w-1.5 ${s}`;
  let l;
  e[2] !== c ? (l = /* @__PURE__ */ f("div", { className: c }), e[2] = c, e[3] = l) : l = e[3];
  let a;
  e[4] !== o || e[5] !== i || e[6] !== n ? (a = /* @__PURE__ */ f(oi, { type: n, borderColor: o, textColor: i }), e[4] = o, e[5] = i, e[6] = n, e[7] = a) : a = e[7];
  const u = `my-auto -ml-0.5 h-px w-1.5 ${s}`;
  let d;
  e[8] !== u ? (d = /* @__PURE__ */ f("div", { className: u }), e[8] = u, e[9] = d) : d = e[9];
  let p;
  return e[10] !== l || e[11] !== a || e[12] !== d ? (p = /* @__PURE__ */ F("div", { className: "flex h-4", children: [
    l,
    a,
    d
  ] }), e[10] = l, e[11] = a, e[12] = d, e[13] = p) : p = e[13], p;
}
const hg = {
  [we.OTL]: "L",
  [we.OTU]: "U"
};
function Bn(t) {
  const e = Q.c(12), {
    type: n,
    isEnabled: r
  } = t, o = r ? "border-slate-700" : "border-slate-400", s = r ? "bg-slate-700" : "bg-slate-400", i = r ? "text-slate-700" : "text-slate-400", c = `my-auto h-px w-1.5 ${s}`;
  let l;
  e[0] !== c ? (l = /* @__PURE__ */ f("div", { className: c }), e[0] = c, e[1] = l) : l = e[1];
  const a = hg[n];
  let u;
  e[2] !== o || e[3] !== a || e[4] !== i ? (u = /* @__PURE__ */ f(fr, { label: a, borderColor: o, textColor: i }), e[2] = o, e[3] = a, e[4] = i, e[5] = u) : u = e[5];
  const d = `my-auto h-px w-1.5 ${s}`;
  let p;
  e[6] !== d ? (p = /* @__PURE__ */ f("div", { className: d }), e[6] = d, e[7] = p) : p = e[7];
  let h;
  return e[8] !== l || e[9] !== u || e[10] !== p ? (h = /* @__PURE__ */ F("div", { className: "flex h-4", children: [
    l,
    u,
    p
  ] }), e[8] = l, e[9] = u, e[10] = p, e[11] = h) : h = e[11], h;
}
function nc(t) {
  const e = Q.c(3), {
    label: n,
    isEnabled: r
  } = t, s = `text-sm leading-none ${r ? "text-slate-700" : "text-slate-400"}`;
  let i;
  return e[0] !== n || e[1] !== s ? (i = /* @__PURE__ */ f("div", { className: "flex min-w-8 items-center justify-center px-1 py-0.5", children: /* @__PURE__ */ f("span", { className: s, children: n }) }), e[0] = n, e[1] = s, e[2] = i) : i = e[2], i;
}
function rc(t) {
  const e = Q.c(11), {
    isEnabled: n
  } = t, r = n ? "border-slate-700" : "border-slate-400", o = n ? "bg-slate-700" : "bg-slate-400", s = n ? "text-slate-700" : "text-slate-400", i = `my-auto h-px w-1.5 ${o}`;
  let c;
  e[0] !== i ? (c = /* @__PURE__ */ f("div", { className: i }), e[0] = i, e[1] = c) : c = e[1];
  let l;
  e[2] !== r || e[3] !== s ? (l = /* @__PURE__ */ f(fr, { label: "RES", centerClassName: "min-w-5", borderColor: r, textColor: s }), e[2] = r, e[3] = s, e[4] = l) : l = e[4];
  const a = `my-auto h-px w-1.5 ${o}`;
  let u;
  e[5] !== a ? (u = /* @__PURE__ */ f("div", { className: a }), e[5] = a, e[6] = u) : u = e[6];
  let d;
  return e[7] !== c || e[8] !== l || e[9] !== u ? (d = /* @__PURE__ */ F("div", { className: "flex h-4", children: [
    c,
    l,
    u
  ] }), e[7] = c, e[8] = l, e[9] = u, e[10] = d) : d = e[10], d;
}
function Rg(t) {
  const e = Q.c(26), {
    children: n
  } = t, {
    state: r,
    actions: o
  } = ke(), [s, i] = ye(null);
  let c;
  e[0] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (c = {
    activationConstraint: {
      distance: 5
    }
  }, e[0] = c) : c = e[0];
  let l;
  e[1] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (l = {
    activationConstraint: {
      delay: 250,
      tolerance: 5
    }
  }, e[1] = l) : l = e[1];
  const a = el(Io(Js, c), Io(Ks, l));
  let u;
  e[2] !== o || e[3] !== r.rungs ? (u = (N, E) => {
    const {
      circuitId: _,
      rungId: w,
      index: y
    } = E;
    if (!(!_ || !w))
      e: switch (N.type) {
        case "INSTRUCTION": {
          const R = N, k = R.circuitId === _, A = R.index === y || R.index === y + 1;
          if (k && A)
            return;
          const P = R.circuitId === _ && y >= R.index ? y : y + 1;
          o.moveInstruction(R.instructionData.id, R.rungId, _, w, P);
          break e;
        }
        case "TOOL_INSTRUCTION": {
          const R = N, k = y + 1, A = r.rungs[w];
          if (!A)
            return;
          const P = Rs(R.instructionType), $ = Ft(P, _, k, A);
          o.modifyRung($), o.select(P.id, z.INSTRUCTION);
          break e;
        }
        case "TOOL_BRANCH": {
          const R = y + 1;
          o.addBranch(Ns(), _, R, w);
        }
      }
  }, e[2] = o, e[3] = r.rungs, e[4] = u) : u = e[4];
  const d = u;
  let p;
  e[5] !== o ? (p = (N, E) => {
    const {
      index: _
    } = E;
    e: switch (N.type) {
      case "RUNG": {
        const w = N;
        if (!(w.index > _ || w.index < _ - 1))
          return;
        const y = _ > w.index ? _ - 1 : _;
        o.moveRung(w.index, y);
        break e;
      }
      case "TOOL_RUNG": {
        const w = Cn();
        o.addRung(w, _);
      }
    }
  }, e[5] = o, e[6] = p) : p = e[6];
  const h = p;
  let v;
  e[7] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (v = (N) => {
    const E = N.active.data.current;
    i(E ?? null);
  }, e[7] = v) : v = e[7];
  const m = v;
  let g;
  e[8] !== h || e[9] !== d ? (g = (N) => {
    i(null);
    const {
      active: E,
      over: _
    } = N;
    if (!_)
      return;
    const w = E.data.current, y = _.data.current;
    if (!w || !y || !y.accepts?.includes(w.type))
      return;
    const R = _.id;
    if (R.startsWith("wire-")) {
      d(w, y);
      return;
    }
    if (R.startsWith("rung-drop-") || R === "end-rung-drop") {
      h(w, y);
      return;
    }
  }, e[8] = h, e[9] = d, e[10] = g) : g = e[10];
  const I = g;
  let T;
  e[11] !== s ? (T = () => {
    if (!s)
      return null;
    const N = mg;
    switch (s.type) {
      case "TOOL_INSTRUCTION":
        return N(s.instructionType);
      case "INSTRUCTION": {
        const E = s;
        return /* @__PURE__ */ f(fo, { instructionData: E.instructionData, isSelected: !1, rungId: E.rungId });
      }
      case "RUNG": {
        const E = s;
        return /* @__PURE__ */ f(pg, { rungData: E.rungData, index: E.index });
      }
      case "TOOL_RUNG":
        return /* @__PURE__ */ f("div", { className: "flex h-6 w-8 border-x-2 border-blue-600", children: /* @__PURE__ */ f("div", { className: "my-auto h-0.5 w-full bg-blue-600" }) });
      case "TOOL_BRANCH":
        return /* @__PURE__ */ f("div", { className: "flex h-6 w-8 border-x border-slate-700", children: /* @__PURE__ */ f("div", { className: "my-auto h-px w-full bg-blue-600", children: /* @__PURE__ */ f("div", { className: "m-auto mt-px flex h-2.5 w-5 border-x-2 border-b-2 border-blue-600" }) }) });
      default:
        return null;
    }
  }, e[11] = s, e[12] = T) : T = e[12];
  const b = T;
  let x;
  e[13] !== s ? (x = s && /* @__PURE__ */ f("style", { children: "* { cursor: default; }" }), e[13] = s, e[14] = x) : x = e[14];
  let S;
  e[15] !== s || e[16] !== b ? (S = s ? /* @__PURE__ */ f("div", { style: {
    opacity: 0.5
  }, children: b() }) : null, e[15] = s, e[16] = b, e[17] = S) : S = e[17];
  let C;
  e[18] !== S ? (C = /* @__PURE__ */ f(ya, { dropAnimation: null, children: S }), e[18] = S, e[19] = C) : C = e[19];
  let O;
  return e[20] !== n || e[21] !== I || e[22] !== a || e[23] !== C || e[24] !== x ? (O = /* @__PURE__ */ F(ea, { sensors: a, collisionDetection: ul, onDragStart: m, onDragEnd: I, autoScroll: !1, children: [
    x,
    n,
    C
  ] }), e[20] = n, e[21] = I, e[22] = a, e[23] = C, e[24] = x, e[25] = O) : O = e[25], O;
}
function mg(t) {
  return t === be.XIC || t === be.XIO || t === be.ONS ? /* @__PURE__ */ f(Zn, { type: t, isEnabled: !0 }) : t === we.OTE || t === we.OTL || t === we.OTU ? /* @__PURE__ */ f(Bn, { type: t, isEnabled: !0 }) : t === Vt.RES ? /* @__PURE__ */ f(rc, { isEnabled: !0 }) : /* @__PURE__ */ f(nc, { label: t, isEnabled: !0 });
}
function as() {
  const t = Q.c(32), {
    state: e,
    actions: n
  } = ke();
  let r;
  if (t[0] !== e.rungIds || t[1] !== e.rungs) {
    let R;
    t[3] !== e.rungs ? (R = (k) => e.rungs[k], t[3] = e.rungs, t[4] = R) : R = t[4], r = e.rungIds.map(R), t[0] = e.rungIds, t[1] = e.rungs, t[2] = r;
  } else
    r = t[2];
  const o = r, s = e.rungIds.length > 0;
  let i;
  t[5] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (i = {
    type: "TOOL_BRANCH"
  }, t[5] = i) : i = t[5];
  const c = i, l = !s;
  let a;
  t[6] !== l ? (a = {
    id: "tool-branch",
    data: c,
    disabled: l
  }, t[6] = l, t[7] = a) : a = t[7];
  const {
    attributes: u,
    listeners: d,
    setNodeRef: p,
    isDragging: h
  } = $n(a), v = s ? "border-slate-700" : "border-slate-400", m = s ? "border-blue-600" : "border-slate-400", g = s ? "bg-blue-600" : "bg-slate-400", I = s ? "hover:bg-blue-200" : "";
  let T;
  t[8] !== n || t[9] !== o || t[10] !== e.rungIds[0] || t[11] !== e.rungIds.length || t[12] !== e.selection ? (T = function() {
    if (e.rungIds.length === 0)
      return;
    const k = e.selection.selectedIds.at(-1) || e.rungIds[0], A = k ? rn(k, o) : 0, P = A < 0 ? 0 : A, $ = o[P];
    if (!$)
      return;
    const X = $.circuit, L = X.id, {
      parentCircuitId: B,
      index: U
    } = Rn(k, X), H = B || L, K = U === null ? 0 : U + 1;
    n.addBranch(Ns(), H, K, $.id);
  }, t[8] = n, t[9] = o, t[10] = e.rungIds[0], t[11] = e.rungIds.length, t[12] = e.selection, t[13] = T) : T = t[13];
  const b = T;
  let x;
  t[14] !== b || t[15] !== s ? (x = () => s && b(), t[14] = b, t[15] = s, t[16] = x) : x = t[16];
  const S = `my-1 cursor-default p-1 text-xl text-black focus:outline-hidden ${I} ${h ? "opacity-50" : ""}`, C = `flex h-6 w-8 border-x ${v}`, O = `my-auto h-px w-full ${g}`, N = `m-auto mt-px flex h-2.5 w-5 border-x-2 border-b-2 ${m}`;
  let E;
  t[17] !== N ? (E = /* @__PURE__ */ f("div", { className: N }), t[17] = N, t[18] = E) : E = t[18];
  let _;
  t[19] !== E || t[20] !== O ? (_ = /* @__PURE__ */ f("div", { className: O, children: E }), t[19] = E, t[20] = O, t[21] = _) : _ = t[21];
  let w;
  t[22] !== _ || t[23] !== C ? (w = /* @__PURE__ */ f("div", { className: C, children: _ }), t[22] = _, t[23] = C, t[24] = w) : w = t[24];
  let y;
  return t[25] !== u || t[26] !== d || t[27] !== p || t[28] !== w || t[29] !== x || t[30] !== S ? (y = /* @__PURE__ */ f("button", { "aria-label": "Add branch", onClick: x, ref: p, ...u, ...d, className: S, children: w }), t[25] = u, t[26] = d, t[27] = p, t[28] = w, t[29] = x, t[30] = S, t[31] = y) : y = t[31], y;
}
function us() {
  const t = Q.c(38), {
    state: e,
    actions: n
  } = ke();
  let r;
  if (t[0] !== e.rungIds || t[1] !== e.rungs) {
    let R;
    t[3] !== e.rungs ? (R = (k) => e.rungs[k], t[3] = e.rungs, t[4] = R) : R = t[4], r = e.rungIds.map(R).filter(gg), t[0] = e.rungIds, t[1] = e.rungs, t[2] = r;
  } else
    r = t[2];
  const o = r, s = e.selection.selectedType === z.CIRCUIT, i = s ? "arrowhead-active" : "arrowhead-disabled", c = s ? "#2d65e5" : "#a0aec0", l = s ? "border-slate-700" : "border-slate-400", a = s ? "bg-slate-700" : "bg-slate-400", u = s ? "hover:bg-blue-200" : "";
  let d;
  t[5] !== n || t[6] !== o || t[7] !== e.selection.selectedIds || t[8] !== e.selection.selectedType ? (d = function() {
    const k = e.selection.selectedIds.at(-1) ?? null;
    if (e.selection.selectedType !== z.CIRCUIT || !k)
      return;
    const A = jn(), P = rn(k, o);
    if (P < 0)
      return;
    const $ = o[P];
    $ && n.addBranchLevel(A, k, $.id);
  }, t[5] = n, t[6] = o, t[7] = e.selection.selectedIds, t[8] = e.selection.selectedType, t[9] = d) : d = t[9];
  const p = d;
  let h;
  t[10] !== p || t[11] !== s ? (h = () => s && p(), t[10] = p, t[11] = s, t[12] = h) : h = t[12];
  const v = `my-1 cursor-default p-1 text-xl text-black focus:outline-hidden ${u}`, m = `flex h-6 w-8 border-x ${l}`, g = `my-auto h-px w-full ${a}`, I = `m-auto mt-px flex h-2.5 w-5 border-x border-b ${l}`, T = s ? "#2d65e5" : "#a0aec0";
  let b;
  t[13] !== T ? (b = /* @__PURE__ */ f("polygon", { fill: T, points: "0 0, 2 1.5, 0 3" }), t[13] = T, t[14] = b) : b = t[14];
  let x;
  t[15] !== i || t[16] !== b ? (x = /* @__PURE__ */ f("defs", { children: /* @__PURE__ */ f("marker", { id: i, markerWidth: "2", markerHeight: "3", refX: "0", refY: "1.5", orient: "auto-start-reverse", children: b }) }), t[15] = i, t[16] = b, t[17] = x) : x = t[17];
  const S = `url(#${i})`, C = `url(#${i})`;
  let O;
  t[18] !== c || t[19] !== S || t[20] !== C ? (O = /* @__PURE__ */ f("line", { x1: "4", y1: "5", x2: "16", y2: "5", stroke: c, strokeWidth: "2", markerStart: S, markerEnd: C }), t[18] = c, t[19] = S, t[20] = C, t[21] = O) : O = t[21];
  let N;
  t[22] !== O || t[23] !== x ? (N = /* @__PURE__ */ F("svg", { width: "20", height: "10", viewBox: "0 0 20 10", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [
    x,
    O
  ] }), t[22] = O, t[23] = x, t[24] = N) : N = t[24];
  let E;
  t[25] !== N || t[26] !== I ? (E = /* @__PURE__ */ f("div", { className: I, children: N }), t[25] = N, t[26] = I, t[27] = E) : E = t[27];
  let _;
  t[28] !== E || t[29] !== g ? (_ = /* @__PURE__ */ f("div", { className: g, children: E }), t[28] = E, t[29] = g, t[30] = _) : _ = t[30];
  let w;
  t[31] !== _ || t[32] !== m ? (w = /* @__PURE__ */ f("div", { className: m, children: _ }), t[31] = _, t[32] = m, t[33] = w) : w = t[33];
  let y;
  return t[34] !== w || t[35] !== h || t[36] !== v ? (y = /* @__PURE__ */ f("button", { "aria-label": "Add branch level", onClick: h, className: v, children: w }), t[34] = w, t[35] = h, t[36] = v, t[37] = y) : y = t[37], y;
}
function gg(t) {
  return !!t;
}
function te(t) {
  const e = Q.c(34), {
    type: n
  } = t, {
    state: r,
    actions: o
  } = ke();
  let s;
  if (e[0] !== r.rungIds || e[1] !== r.rungs) {
    let w;
    e[3] !== r.rungs ? (w = (y) => r.rungs[y], e[3] = r.rungs, e[4] = w) : w = e[4], s = r.rungIds.map(w), e[0] = r.rungIds, e[1] = r.rungs, e[2] = s;
  } else
    s = e[2];
  const i = s, c = r.rungIds.length > 0;
  let l;
  e[5] !== n ? (l = (w) => {
    switch (n) {
      case be.XIO:
        return /* @__PURE__ */ f(Zn, { type: be.XIO, isEnabled: w });
      case be.XIC:
        return /* @__PURE__ */ f(Zn, { type: be.XIC, isEnabled: w });
      case be.ONS:
        return /* @__PURE__ */ f(Zn, { type: be.ONS, isEnabled: w });
      case we.OTE:
        return /* @__PURE__ */ f(Bn, { type: we.OTE, isEnabled: w });
      case we.OTL:
        return /* @__PURE__ */ f(Bn, { type: we.OTL, isEnabled: w });
      case we.OTU:
        return /* @__PURE__ */ f(Bn, { type: we.OTU, isEnabled: w });
      case Vt.RES:
        return /* @__PURE__ */ f(rc, { isEnabled: w });
      case Qe.TON:
      case Qe.TOF:
      case Qe.RTO:
      case ut.CTU:
      case ut.CTD:
      case Gt.MOV:
      case ze.ADD:
      case ze.SUB:
      case ze.MUL:
      case ze.DIV:
      case ge.EQ:
      case ge.NE:
      case ge.GT:
      case ge.GE:
      case ge.LT:
      case ge.LE:
        return /* @__PURE__ */ f(nc, { label: n, isEnabled: w });
      default:
        return null;
    }
  }, e[5] = n, e[6] = l) : l = e[6];
  const a = l, u = c ? "hover:bg-blue-200" : "";
  let d;
  e[7] !== n ? (d = {
    type: "TOOL_INSTRUCTION",
    instructionType: n
  }, e[7] = n, e[8] = d) : d = e[8];
  const p = d, h = `tool-instruction-${n}`, v = !c;
  let m;
  e[9] !== p || e[10] !== h || e[11] !== v ? (m = {
    id: h,
    data: p,
    disabled: v
  }, e[9] = p, e[10] = h, e[11] = v, e[12] = m) : m = e[12];
  const {
    attributes: g,
    listeners: I,
    setNodeRef: T,
    isDragging: b
  } = $n(m);
  let x;
  e[13] !== o || e[14] !== i || e[15] !== r.rungIds[0] || e[16] !== r.rungIds.length || e[17] !== r.selection || e[18] !== n ? (x = function() {
    if (r.rungIds.length === 0)
      return;
    const y = r.selection.selectedIds.at(-1) || r.rungIds[0], R = Rs(n), k = y ? rn(y, i) : 0, A = k < 0 ? 0 : k, P = i[A];
    if (!P)
      return;
    const $ = P.circuit, {
      parentCircuitId: X,
      index: L
    } = Rn(y, $), B = L === null ? 0 : L + 1, U = $.id, K = Ft(R, X || U, B, P);
    o.modifyRung(K), o.select(R.id, z.INSTRUCTION);
  }, e[13] = o, e[14] = i, e[15] = r.rungIds[0], e[16] = r.rungIds.length, e[17] = r.selection, e[18] = n, e[19] = x) : x = e[19];
  const S = x, C = `Add instruction ${n}`;
  let O;
  e[20] !== S || e[21] !== c ? (O = () => c && S(), e[20] = S, e[21] = c, e[22] = O) : O = e[22];
  const N = `my-1 cursor-default select-none p-1 text-xl focus:outline-hidden ${u} ${b ? "opacity-50" : ""}`;
  let E;
  e[23] !== c || e[24] !== a ? (E = a(c), e[23] = c, e[24] = a, e[25] = E) : E = e[25];
  let _;
  return e[26] !== g || e[27] !== I || e[28] !== T || e[29] !== N || e[30] !== E || e[31] !== C || e[32] !== O ? (_ = /* @__PURE__ */ f("button", { "aria-label": C, onClick: O, ref: T, ...g, ...I, className: N, children: E }), e[26] = g, e[27] = I, e[28] = T, e[29] = N, e[30] = E, e[31] = C, e[32] = O, e[33] = _) : _ = e[33], _;
}
function ds() {
  const t = Q.c(21), {
    state: e,
    actions: n
  } = ke();
  let r;
  if (t[0] !== e.rungIds || t[1] !== e.rungs) {
    let S;
    t[3] !== e.rungs ? (S = (C) => e.rungs[C], t[3] = e.rungs, t[4] = S) : S = t[4], r = e.rungIds.map(S), t[0] = e.rungIds, t[1] = e.rungs, t[2] = r;
  } else
    r = t[2];
  const o = r;
  let s;
  t[5] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (s = {
    type: "TOOL_RUNG"
  }, t[5] = s) : s = t[5];
  const i = s;
  let c;
  t[6] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (c = {
    id: "tool-rung",
    data: i,
    disabled: !1
  }, t[6] = c) : c = t[6];
  const {
    attributes: l,
    listeners: a,
    setNodeRef: u,
    isDragging: d
  } = $n(c), p = "border-blue-600", h = "bg-blue-600", v = "hover:bg-blue-200";
  let m;
  t[7] !== n || t[8] !== o || t[9] !== e.rungIds.length || t[10] !== e.selection.selectedIds ? (m = function() {
    const C = Cn(), O = e.selection.selectedIds.at(-1) ?? null, N = O ? rn(O, o) : e.rungIds.length;
    n.addRung(C, N + 1);
  }, t[7] = n, t[8] = o, t[9] = e.rungIds.length, t[10] = e.selection.selectedIds, t[11] = m) : m = t[11];
  const g = m;
  let I;
  t[12] !== g ? (I = () => g(), t[12] = g, t[13] = I) : I = t[13];
  const T = `my-1 cursor-default p-1 text-xl text-black focus:outline-hidden ${v} ${d ? "opacity-50" : ""}`;
  let b;
  t[14] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (b = /* @__PURE__ */ f("div", { className: `flex h-6 w-8 border-x-2 ${p}`, children: /* @__PURE__ */ f("div", { className: `my-auto h-0.5 w-full ${h}` }) }), t[14] = b) : b = t[14];
  let x;
  return t[15] !== l || t[16] !== a || t[17] !== u || t[18] !== I || t[19] !== T ? (x = /* @__PURE__ */ f("button", { "aria-label": "Add rung", onClick: I, ref: u, ...l, ...a, className: T, children: b }), t[15] = l, t[16] = a, t[17] = u, t[18] = I, t[19] = T, t[20] = x) : x = t[20], x;
}
const $r = (...t) => t.filter(Boolean).join(" "), vg = [{
  id: "bit",
  label: "Bit"
}, {
  id: "timer-counter",
  label: "Timer/Counter"
}, {
  id: "math",
  label: "Math"
}, {
  id: "compare",
  label: "Compare"
}];
function Og(t) {
  const e = Q.c(58), {
    className: n,
    orientation: r
  } = t, o = r === void 0 ? "horizontal" : r, [s, i] = ye("bit"), c = o === "horizontal", l = c ? "flex-row" : "flex-col items-center", a = bg, u = yg;
  if (!c) {
    let N;
    e[0] !== n || e[1] !== l ? (N = $r("flex gap-2", l, n), e[0] = n, e[1] = l, e[2] = N) : N = e[2];
    let E, _, w, y, R, k, A, P, $, X, L, B, U, H, K, Z, j, M, G, q, Y, W, ae, ie, Ie, se;
    e[3] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (q = /* @__PURE__ */ f(ds, {}), Y = /* @__PURE__ */ f(as, {}), W = /* @__PURE__ */ f(us, {}), ae = /* @__PURE__ */ f(te, { type: be.XIC }), ie = /* @__PURE__ */ f(te, { type: be.XIO }), Ie = /* @__PURE__ */ f(te, { type: be.ONS }), se = /* @__PURE__ */ f(te, { type: we.OTE }), E = /* @__PURE__ */ f(te, { type: we.OTL }), _ = /* @__PURE__ */ f(te, { type: we.OTU }), w = /* @__PURE__ */ f(te, { type: Vt.RES }), y = /* @__PURE__ */ f(te, { type: Qe.TON }), R = /* @__PURE__ */ f(te, { type: Qe.TOF }), k = /* @__PURE__ */ f(te, { type: Qe.RTO }), A = /* @__PURE__ */ f(te, { type: ut.CTU }), P = /* @__PURE__ */ f(te, { type: ut.CTD }), $ = /* @__PURE__ */ f(te, { type: Gt.MOV }), X = /* @__PURE__ */ f(te, { type: ze.ADD }), L = /* @__PURE__ */ f(te, { type: ze.SUB }), B = /* @__PURE__ */ f(te, { type: ze.MUL }), U = /* @__PURE__ */ f(te, { type: ze.DIV }), H = /* @__PURE__ */ f(te, { type: ge.EQ }), K = /* @__PURE__ */ f(te, { type: ge.NE }), Z = /* @__PURE__ */ f(te, { type: ge.GT }), j = /* @__PURE__ */ f(te, { type: ge.GE }), M = /* @__PURE__ */ f(te, { type: ge.LT }), G = /* @__PURE__ */ f(te, { type: ge.LE }), e[3] = E, e[4] = _, e[5] = w, e[6] = y, e[7] = R, e[8] = k, e[9] = A, e[10] = P, e[11] = $, e[12] = X, e[13] = L, e[14] = B, e[15] = U, e[16] = H, e[17] = K, e[18] = Z, e[19] = j, e[20] = M, e[21] = G, e[22] = q, e[23] = Y, e[24] = W, e[25] = ae, e[26] = ie, e[27] = Ie, e[28] = se) : (E = e[3], _ = e[4], w = e[5], y = e[6], R = e[7], k = e[8], A = e[9], P = e[10], $ = e[11], X = e[12], L = e[13], B = e[14], U = e[15], H = e[16], K = e[17], Z = e[18], j = e[19], M = e[20], G = e[21], q = e[22], Y = e[23], W = e[24], ae = e[25], ie = e[26], Ie = e[27], se = e[28]);
    let Oe;
    return e[29] !== N ? (Oe = /* @__PURE__ */ F("div", { className: N, onContextMenu: a, onMouseDown: u, children: [
      q,
      Y,
      W,
      ae,
      ie,
      Ie,
      se,
      E,
      _,
      w,
      y,
      R,
      k,
      A,
      P,
      $,
      X,
      L,
      B,
      U,
      H,
      K,
      Z,
      j,
      M,
      G
    ] }), e[29] = N, e[30] = Oe) : Oe = e[30], Oe;
  }
  let d;
  e[31] !== n ? (d = $r("flex flex-col", n), e[31] = n, e[32] = d) : d = e[32];
  let p, h, v;
  e[33] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (p = /* @__PURE__ */ f(ds, {}), h = /* @__PURE__ */ f(as, {}), v = /* @__PURE__ */ f(us, {}), e[33] = p, e[34] = h, e[35] = v) : (p = e[33], h = e[34], v = e[35]);
  let m;
  e[36] !== s ? (m = s === "bit" && /* @__PURE__ */ F(St, { children: [
    /* @__PURE__ */ f(te, { type: be.XIC }),
    /* @__PURE__ */ f(te, { type: be.XIO }),
    /* @__PURE__ */ f(te, { type: be.ONS }),
    /* @__PURE__ */ f(te, { type: we.OTE }),
    /* @__PURE__ */ f(te, { type: we.OTL }),
    /* @__PURE__ */ f(te, { type: we.OTU })
  ] }), e[36] = s, e[37] = m) : m = e[37];
  let g;
  e[38] !== s ? (g = s === "timer-counter" && /* @__PURE__ */ F(St, { children: [
    /* @__PURE__ */ f(te, { type: Qe.TON }),
    /* @__PURE__ */ f(te, { type: Qe.TOF }),
    /* @__PURE__ */ f(te, { type: Qe.RTO }),
    /* @__PURE__ */ f(te, { type: ut.CTU }),
    /* @__PURE__ */ f(te, { type: ut.CTD }),
    /* @__PURE__ */ f(te, { type: Vt.RES })
  ] }), e[38] = s, e[39] = g) : g = e[39];
  let I;
  e[40] !== s ? (I = s === "math" && /* @__PURE__ */ F(St, { children: [
    /* @__PURE__ */ f(te, { type: Gt.MOV }),
    /* @__PURE__ */ f(te, { type: ze.ADD }),
    /* @__PURE__ */ f(te, { type: ze.SUB }),
    /* @__PURE__ */ f(te, { type: ze.MUL }),
    /* @__PURE__ */ f(te, { type: ze.DIV })
  ] }), e[40] = s, e[41] = I) : I = e[41];
  let T;
  e[42] !== s ? (T = s === "compare" && /* @__PURE__ */ F(St, { children: [
    /* @__PURE__ */ f(te, { type: ge.EQ }),
    /* @__PURE__ */ f(te, { type: ge.NE }),
    /* @__PURE__ */ f(te, { type: ge.GT }),
    /* @__PURE__ */ f(te, { type: ge.GE }),
    /* @__PURE__ */ f(te, { type: ge.LT }),
    /* @__PURE__ */ f(te, { type: ge.LE })
  ] }), e[42] = s, e[43] = T) : T = e[43];
  let b;
  e[44] !== m || e[45] !== g || e[46] !== I || e[47] !== T ? (b = /* @__PURE__ */ F("div", { className: "flex flex-row items-center gap-2 pl-2", children: [
    p,
    h,
    v,
    m,
    g,
    I,
    T
  ] }), e[44] = m, e[45] = g, e[46] = I, e[47] = T, e[48] = b) : b = e[48];
  let x;
  e[49] === /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel") ? (x = {
    paddingLeft: "9.5rem"
  }, e[49] = x) : x = e[49];
  let S;
  e[50] !== s ? (S = vg.map((N) => /* @__PURE__ */ f("button", { type: "button", className: $r("cursor-default px-3 py-1 text-xs font-medium transition-colors focus:outline-hidden", s === N.id ? "bg-slate-300 text-slate-900" : "text-slate-600 hover:bg-slate-200"), onClick: () => i(N.id), children: N.label }, N.id)), e[50] = s, e[51] = S) : S = e[51];
  let C;
  e[52] !== S ? (C = /* @__PURE__ */ f("div", { className: "flex border-y bg-slate-100", style: x, children: S }), e[52] = S, e[53] = C) : C = e[53];
  let O;
  return e[54] !== b || e[55] !== C || e[56] !== d ? (O = /* @__PURE__ */ F("div", { className: d, onContextMenu: a, onMouseDown: u, children: [
    b,
    C
  ] }), e[54] = b, e[55] = C, e[56] = d, e[57] = O) : O = e[57], O;
}
function yg(t) {
  t.preventDefault();
}
function bg(t) {
  t.preventDefault();
}
export {
  Rm as BasicInstruction,
  Yi as BasicTagName,
  us as BranchLevelTool,
  as as BranchTool,
  qi as Circuit,
  we as Coils,
  be as Contacts,
  xt as ContextMenuItem,
  Qr as ContextMenuSeparator,
  Lm as CounterInstruction,
  ut as Counters,
  ba as EndRung,
  La as ErrorTooltip,
  Ng as INPUTS,
  te as InstructionTool,
  Cg as LadderDiagram,
  Rg as LadderDndProvider,
  ps as LadderEditorContext,
  Sg as LadderEditorProvider,
  vs as LadderMenuExtrasContext,
  z as LadderObjectType,
  hs as LadderSimulationContext,
  ms as LadderTagCatalogContext,
  Og as LadderToolbar,
  Zm as MovInstruction,
  Gt as MoveLogical,
  Cs as OUTPUTS,
  jm as Placeholder,
  Fm as ResetInstruction,
  Vt as Resets,
  cg as Rung,
  ds as RungTool,
  Gm as TimerInstruction,
  Qe as Timers,
  Cr as Wire,
  bs as addBranchLevelToCircuit,
  Ft as addElementToCircuit,
  on as addIdsToCircuit,
  Ut as collectInstructionIds,
  Ns as createBranchObject,
  jn as createCircuitObject,
  Rs as createInstructionObject,
  Cn as createRungObject,
  Nt as cutElementById,
  vt as findIdInCircuit,
  Ds as findLastNonOutputIndex,
  Rn as findParentCircuit,
  rn as findRungIndexById,
  Sc as getElementIdsForRung,
  fc as modifyInstruction,
  wn as parseLadderDsl,
  Nc as serializeLadderState,
  Cc as useInstruction,
  ke as useLadderEditor,
  dc as useLadderMenuExtras,
  jr as useLadderSimulation,
  gs as useLadderTagCatalog,
  xg as useRung,
  Tg as useSelection
};
//# sourceMappingURL=index.js.map
