import { createContext as e, forwardRef as t, memo as n, useCallback as r, useContext as i, useEffect as a, useImperativeHandle as o, useMemo as s, useReducer as c, useRef as l, useState as u, useSyncExternalStore as d } from "react";
import { Fragment as f, jsx as p, jsxs as m } from "react/jsx-runtime";
import h from "@tabler/icons-react/dist/esm/icons/IconZoomOut.mjs";
import g from "@tabler/icons-react/dist/esm/icons/IconZoomIn.mjs";
import _ from "@tabler/icons-react/dist/esm/icons/IconChevronDown.mjs";
import v from "@tabler/icons-react/dist/esm/icons/IconArrowBackUp.mjs";
import y from "@tabler/icons-react/dist/esm/icons/IconArrowForwardUp.mjs";
import b from "@tabler/icons-react/dist/esm/icons/IconPencil.mjs";
import x from "@tabler/icons-react/dist/esm/icons/IconTypography.mjs";
import S from "@tabler/icons-react/dist/esm/icons/IconDownload.mjs";
import C from "@tabler/icons-react/dist/esm/icons/IconLayoutSidebar.mjs";
import w from "@tabler/icons-react/dist/esm/icons/IconRotate.mjs";
import T from "@tabler/icons-react/dist/esm/icons/IconRotateClockwise.mjs";
import E from "@tabler/icons-react/dist/esm/icons/IconChevronUp.mjs";
import ee from "@tabler/icons-react/dist/esm/icons/IconRubberStamp.mjs";
import te from "@tabler/icons-react/dist/esm/icons/IconPhotoPlus.mjs";
import * as D from "pdfjs-dist";
import ne from "@tabler/icons-react/dist/esm/icons/IconTrash.mjs";
import O from "@tabler/icons-react/dist/esm/icons/IconCopy.mjs";
import re from "@tabler/icons-react/dist/esm/icons/IconDroplet.mjs";
import { PDFDocument as k, StandardFonts as A, degrees as j, rgb as ie } from "pdf-lib";
import { resolvedWorkerUrl as M } from "./workerUrl.js";
//#region src/PDFViewer/hooks/useLatestRef.js
function N(e) {
	let t = l(e);
	return a(() => {
		t.current = e;
	}, [e]), t;
}
//#endregion
//#region src/PDFViewer/utils/id.js
var P = 0;
function ae(e = "ann") {
	return P += 1, typeof crypto < "u" && typeof crypto.randomUUID == "function" ? `${e}-${crypto.randomUUID()}` : `${e}-${Date.now().toString(36)}-${P.toString(36)}`;
}
var oe = Object.freeze({
	nw: {
		x: 0,
		y: 0
	},
	n: {
		x: .5,
		y: 0
	},
	ne: {
		x: 1,
		y: 0
	},
	e: {
		x: 1,
		y: .5
	},
	se: {
		x: 1,
		y: 1
	},
	s: {
		x: .5,
		y: 1
	},
	sw: {
		x: 0,
		y: 1
	},
	w: {
		x: 0,
		y: .5
	}
}), F = (e) => e * Math.PI / 180;
function I({ x: e, y: t }, n) {
	let r = z(n ?? 0);
	if (!r) return {
		x: e,
		y: t
	};
	let i = F(r), a = Math.cos(i), o = Math.sin(i);
	return {
		x: e * a - t * o,
		y: e * o + t * a
	};
}
function se(e, t) {
	return I(e, -t);
}
function ce({ x: e, y: t, width: n, height: r }) {
	return {
		x: e + n / 2,
		y: t + r / 2
	};
}
function le(e) {
	let t = oe[e];
	return t ? {
		signX: t.x === .5 ? 0 : t.x === 1 ? 1 : -1,
		signY: t.y === .5 ? 0 : t.y === 1 ? 1 : -1
	} : {
		signX: 0,
		signY: 0
	};
}
function ue({ rect: e, rotation: t = 0, handle: n, delta: r, lockAspectRatio: i = !1, minSize: a = 16 }) {
	let { signX: o, signY: s } = le(n);
	if (o === 0 && s === 0) return e;
	let { width: c, height: l } = e, u = o === 0 ? c : Math.max(a, c + o * r.x), d = s === 0 ? l : Math.max(a, l + s * r.y);
	if (i && c > 0 && l > 0) {
		let e = c / l;
		o !== 0 && s !== 0 ? Math.abs(u / c - 1) >= Math.abs(d / l - 1) ? d = u / e : u = d * e : o === 0 ? u = d * e : d = u / e, u < a && (u = a, d = u / e), d < a && (d = a, u = d * e);
	}
	let f = I({
		x: o * (u - c) / 2,
		y: s * (d - l) / 2
	}, t), p = ce(e);
	return {
		x: p.x + f.x - u / 2,
		y: p.y + f.y - d / 2,
		width: u,
		height: d
	};
}
function L(e, t) {
	return {
		...e,
		x: e.x + t.x,
		y: e.y + t.y
	};
}
function R({ width: e, height: t }, n = 0) {
	let r = F(z(n)), i = Math.abs(Math.cos(r)), a = Math.abs(Math.sin(r));
	return {
		x: (e * i + t * a) / 2,
		y: (e * a + t * i) / 2
	};
}
function de(e, t = 0, n) {
	if (!n?.width || !n?.height) return e;
	let r = R(e, t), i = ce(e), a = (e, t, n) => t * 2 > n ? n / 2 : Math.min(Math.max(e, t), n - t), o = a(i.x, r.x, n.width), s = a(i.y, r.y, n.height);
	return o === i.x && s === i.y ? e : {
		...e,
		x: o - e.width / 2,
		y: s - e.height / 2
	};
}
function fe(e, t = 0, n) {
	if (!n) return e;
	let r = R(e, t), i = ce(e), a = (e, t, n, r) => {
		let i = n == null ? null : n + t, a = r == null ? null : r - t;
		if (i != null && a != null && i > a) return (i + a) / 2;
		let o = e;
		return i != null && (o = Math.max(o, i)), a != null && (o = Math.min(o, a)), o;
	}, o = a(i.x, r.x, n.left, n.right), s = a(i.y, r.y, n.top, n.bottom);
	return o === i.x && s === i.y ? e : {
		...e,
		x: o - e.width / 2,
		y: s - e.height / 2
	};
}
function pe({ rect: e, rotation: t = 0, handle: n, limits: r, lockAspectRatio: i = !1, minSize: a = 16 }) {
	if (!r) return e;
	let { signX: o, signY: s } = le(n), c = R(e, t), l = ce(e), u = (e, t, n, r, i) => {
		if (e > 0) return n == null ? Infinity : n - (i - r);
		if (e < 0) return t == null ? Infinity : i + r - t;
		let a = t == null ? Infinity : i - t, o = n == null ? Infinity : n - i;
		return Math.min(a, o) * 2;
	}, d = u(o, r.left, r.right, c.x, l.x), f = u(s, r.top, r.bottom, c.y, l.y), p = c.x * 2 > d ? d / (c.x * 2) : 1, m = c.y * 2 > f ? f / (c.y * 2) : 1;
	if (p >= 1 && m >= 1) return e;
	let h = i ? Math.min(p, m) : p, g = i ? Math.min(p, m) : m, _ = Math.max(a, e.width * h), v = Math.max(a, e.height * g), y = I({
		x: o * (_ - e.width) / 2,
		y: s * (v - e.height) / 2
	}, t);
	return {
		x: l.x + y.x - _ / 2,
		y: l.y + y.y - v / 2,
		width: _,
		height: v
	};
}
function me(e, t) {
	return (Math.atan2(t.x - e.x, e.y - t.y) * 180 / Math.PI + 360) % 360;
}
function he(e, t = 15) {
	return z(t ? Math.round(e / t) * t : e);
}
function z(e) {
	return (e % 360 + 360) % 360;
}
function B(e, t, n = 0) {
	let r = ce(e), i = I(t, n);
	return {
		x: r.x + i.x,
		y: r.y + i.y
	};
}
function ge(e, t, n = 0) {
	return n ? e.map((e) => {
		let r = I({
			x: e.x - t.x,
			y: e.y - t.y
		}, n);
		return {
			x: t.x + r.x,
			y: t.y + r.y
		};
	}) : e;
}
//#endregion
//#region src/PDFViewer/utils/coords.js
function V(e) {
	let t = Number(e) || 0;
	return (Math.round(t / 90) * 90 % 360 + 360) % 360;
}
function _e(e, t = 0) {
	let n = V(t), r = e?.width ?? 0, i = e?.height ?? 0;
	return n === 90 || n === 270 ? {
		width: i,
		height: r
	} : {
		width: r,
		height: i
	};
}
function H({ x: e, y: t, width: n, height: r }, i) {
	return {
		x: e * i,
		y: t * i,
		width: n * i,
		height: r * i
	};
}
function ve({ x: e, y: t }, { pageWidth: n, pageHeight: r, rotate: i = 0 }) {
	switch (V(i)) {
		case 90: return {
			x: t,
			y: e
		};
		case 180: return {
			x: n - e,
			y: t
		};
		case 270: return {
			x: n - t,
			y: r - e
		};
		default: return {
			x: e,
			y: r - t
		};
	}
}
function ye(e, t, n = 0) {
	let { width: r, height: i } = e, a = z(n), o = ve(B(e, {
		x: -r / 2,
		y: i / 2
	}, a), t);
	return {
		x: o.x,
		y: o.y,
		rotate: z(V(t.rotate) - a)
	};
}
function be({ pageWidth: e, pageHeight: t, rotate: n = 0 }) {
	let r = V(n), i = ve({
		x: 0,
		y: 0
	}, {
		pageWidth: e,
		pageHeight: t,
		rotate: r
	});
	return {
		x: i.x,
		y: i.y,
		rotate: r
	};
}
function U(e) {
	if (!e || e.length === 0) return {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	};
	let t = Infinity, n = Infinity, r = -Infinity, i = -Infinity;
	for (let a of e) a.x < t && (t = a.x), a.x > r && (r = a.x), a.y < n && (n = a.y), a.y > i && (i = a.y);
	return {
		x: t,
		y: n,
		width: r - t,
		height: i - n
	};
}
function xe(e, t) {
	return Math.max(0, Math.min(e.right, t.right) - Math.max(e.left, t.left)) * Math.max(0, Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top));
}
//#endregion
//#region src/PDFViewer/reducers/annotationReducer.js
var W = Object.freeze({
	IMAGE: "image",
	TEXT: "text",
	INK: "ink"
}), G = Object.freeze({
	byId: {},
	order: []
}), Se = {
	pageIndex: 0,
	x: 50,
	y: 50,
	rotation: 0,
	opacity: 1
};
function Ce({ assetId: e = "default", width: t = 150, height: n = 60, ...r } = {}) {
	return {
		...Se,
		...r,
		id: r.id ?? ae(W.IMAGE),
		type: W.IMAGE,
		assetId: e,
		width: t,
		height: n
	};
}
function we({ text: e = "", fontSize: t = 16, color: n = "#000000", fontFamily: r = "Helvetica", width: i = 250, height: a = 50, ...o } = {}) {
	return {
		...Se,
		...o,
		id: o.id ?? ae(W.TEXT),
		type: W.TEXT,
		text: e,
		fontSize: t,
		color: n,
		fontFamily: r,
		width: i,
		height: a
	};
}
function K({ points: e = [], color: t = "#000000", strokeWidth: n = 2, ...r } = {}) {
	let i = U(e);
	return {
		...Se,
		...r,
		id: r.id ?? ae(W.INK),
		type: W.INK,
		points: e,
		color: t,
		strokeWidth: n,
		...i
	};
}
var q = Object.freeze({
	ADD: "annotation/add",
	UPDATE: "annotation/update",
	DELETE: "annotation/delete",
	DELETE_MANY: "annotation/deleteMany",
	DUPLICATE: "annotation/duplicate",
	BRING_TO_FRONT: "annotation/bringToFront",
	SEND_TO_BACK: "annotation/sendToBack",
	REPLACE_ALL: "annotation/replaceAll"
}), Te = (e) => ({
	type: q.ADD,
	annotation: e
}), Ee = (e, t) => ({
	type: q.UPDATE,
	id: e,
	patch: t
}), De = (e) => ({
	type: q.DELETE,
	id: e
}), Oe = (e, t, n) => ({
	type: q.DUPLICATE,
	id: e,
	offset: t,
	bounds: n
});
function ke(e) {
	if (!Array.isArray(e)) return G;
	let t = {}, n = [];
	for (let r of e) {
		if (!r || typeof r != "object") continue;
		let { id: e, pageIndex: i } = r;
		typeof e != "string" || !e || !Number.isInteger(i) || i < 0 || t[e] || (t[e] = r, n.push(e));
	}
	return {
		byId: t,
		order: n
	};
}
function Ae(e) {
	return e.type === W.INK ? {
		...e,
		...U(e.points)
	} : e;
}
function je(e = G, t) {
	switch (t.type) {
		case q.ADD: {
			let n = Ae(t.annotation);
			return !n?.id || e.byId[n.id] ? e : {
				byId: {
					...e.byId,
					[n.id]: n
				},
				order: [...e.order, n.id]
			};
		}
		case q.UPDATE: {
			let n = e.byId[t.id];
			if (!n) return e;
			let r = Ae({
				...n,
				...t.patch
			});
			return Object.keys(t.patch ?? {}).every((e) => Object.is(n[e], r[e])) ? e : {
				...e,
				byId: {
					...e.byId,
					[t.id]: r
				}
			};
		}
		case q.DELETE: {
			if (!e.byId[t.id]) return e;
			let n = { ...e.byId };
			return delete n[t.id], {
				byId: n,
				order: e.order.filter((e) => e !== t.id)
			};
		}
		case q.DELETE_MANY: {
			let n = new Set(t.ids ?? []);
			if (n.size === 0) return e;
			let r = [...n].filter((t) => e.byId[t]);
			if (r.length === 0) return e;
			let i = { ...e.byId };
			for (let e of r) delete i[e];
			return {
				byId: i,
				order: e.order.filter((e) => !n.has(e))
			};
		}
		case q.DUPLICATE: {
			let n = e.byId[t.id];
			if (!n) return e;
			let r = t.offset ?? 12, i = r, a = r;
			if (t.bounds && n.type !== W.INK) {
				let e = de({
					x: n.x + r,
					y: n.y + r,
					width: n.width,
					height: n.height
				}, n.rotation ?? 0, t.bounds);
				i = e.x - n.x, a = e.y - n.y;
			}
			let o = {
				...n,
				id: ae(n.type),
				x: n.x + i,
				y: n.y + a
			};
			return o.type === W.INK && (o.points = n.points.map((e) => ({
				x: e.x + i,
				y: e.y + a
			}))), {
				byId: {
					...e.byId,
					[o.id]: o
				},
				order: [...e.order, o.id]
			};
		}
		case q.BRING_TO_FRONT: return !e.byId[t.id] || e.order.at(-1) === t.id ? e : {
			...e,
			order: [...e.order.filter((e) => e !== t.id), t.id]
		};
		case q.SEND_TO_BACK: return !e.byId[t.id] || e.order[0] === t.id ? e : {
			...e,
			order: [t.id, ...e.order.filter((e) => e !== t.id)]
		};
		case q.REPLACE_ALL: return t.state ?? G;
		default: return e;
	}
}
function Me(e) {
	return e.order.map((t) => e.byId[t]);
}
function Ne(e, t) {
	let n = [];
	for (let r of e.order) {
		let i = e.byId[r];
		i?.pageIndex === t && n.push(i);
	}
	return n;
}
Object.values(W);
//#endregion
//#region src/PDFViewer/reducers/withHistory.js
var J = Object.freeze({
	UNDO: "history/undo",
	REDO: "history/redo",
	BEGIN_TRANSACTION: "history/beginTransaction",
	COMMIT_TRANSACTION: "history/commitTransaction",
	CANCEL_TRANSACTION: "history/cancelTransaction",
	CLEAR: "history/clear",
	RESET: "history/reset",
	ADOPT: "history/adopt"
}), Pe = () => ({ type: J.UNDO }), Fe = () => ({ type: J.REDO }), Ie = () => ({ type: J.BEGIN_TRANSACTION }), Le = () => ({ type: J.COMMIT_TRANSACTION }), Re = () => ({ type: J.CANCEL_TRANSACTION }), ze = (e, t) => ({
	type: J.RESET,
	present: e,
	documentId: t
}), Y = (e) => ({
	type: J.ADOPT,
	documentId: e
});
function Be(e, t) {
	return {
		past: [],
		present: e,
		future: [],
		txDepth: 0,
		txBase: null,
		documentId: t
	};
}
var Ve = (e) => e.past.length > 0, He = (e) => e.future.length > 0;
function Ue(e, t, n) {
	let r = e.length >= n ? e.slice(e.length - n + 1) : e.slice();
	return r.push(t), r;
}
function We(e, { limit: t = 100 } = {}) {
	return function(n, r) {
		let { past: i, present: a, future: o, txDepth: s, txBase: c } = n;
		switch (r.type) {
			case J.UNDO: return s > 0 || i.length === 0 ? n : {
				...n,
				past: i.slice(0, -1),
				present: i[i.length - 1],
				future: [a, ...o]
			};
			case J.REDO: return s > 0 || o.length === 0 ? n : {
				...n,
				past: Ue(i, a, t),
				present: o[0],
				future: o.slice(1)
			};
			case J.BEGIN_TRANSACTION: return {
				...n,
				txDepth: s + 1,
				txBase: s === 0 ? a : c
			};
			case J.COMMIT_TRANSACTION: {
				if (s === 0) return n;
				let e = s - 1;
				return e > 0 ? {
					...n,
					txDepth: e
				} : c === a ? {
					...n,
					txDepth: 0,
					txBase: null
				} : {
					...n,
					past: Ue(i, c, t),
					present: a,
					future: [],
					txDepth: 0,
					txBase: null
				};
			}
			case J.CANCEL_TRANSACTION: return s === 0 ? n : {
				...n,
				present: c,
				txDepth: 0,
				txBase: null
			};
			case J.CLEAR: return {
				...n,
				past: [],
				future: []
			};
			case J.RESET: return Be(r.present, r.documentId);
			case J.ADOPT: return n.documentId === r.documentId ? n : {
				...n,
				documentId: r.documentId
			};
			default: {
				let o = e(a, r);
				return o === a ? n : s > 0 ? {
					...n,
					present: o
				} : {
					...n,
					past: Ue(i, a, t),
					present: o,
					future: [],
					txDepth: 0,
					txBase: null
				};
			}
		}
	};
}
//#endregion
//#region src/PDFViewer/context/AnnotationContext.jsx
var Ge = e(null), Ke = e(null), qe = We(je), Je = !1;
function Ye(e, t) {
	return e === t || e == null ? !1 : t == null ? (Je || (Je = !0, console.warn(`[@armsolusi/pdf-viewer] \`documentId\` went from ${JSON.stringify(e)} to ${t} — the annotations for it have been kept.\nPass a stable id for as long as the document is open. If it comes from data you fetch, render <PDFViewer> only once you have it rather than letting the id blink.`)), !1) : !0;
}
function Xe({ children: e, documentId: t, initialAnnotations: n }) {
	let [r, i] = c(qe, G, (e) => Be(e, t)), o = Ye(r.documentId, t), l = s(() => o ? ke(n) : null, [o, n]), u = o ? l : r.present;
	a(() => {
		r.documentId !== t && i(o ? ze(l, t) : Y(t));
	}, [
		r.documentId,
		t,
		o,
		l
	]);
	let d = N(u), f = N(t), m = s(() => ({
		add: (e) => i(Te(e)),
		update: (e, t) => i(Ee(e, t)),
		remove: (e) => i(De(e)),
		duplicate: (e, t, n) => i(Oe(e, t, n)),
		replaceAll: (e) => i(ze(ke(e), f.current)),
		undo: () => i(Pe()),
		redo: () => i(Fe()),
		beginGesture: () => i(Ie()),
		endGesture: () => i(Le()),
		abortGesture: () => i(Re()),
		getSnapshot: () => d.current
	}), [d, f]), h = s(() => ({
		annotations: u,
		canUndo: !o && Ve(r),
		canRedo: !o && He(r)
	}), [
		r,
		u,
		o
	]);
	return /* @__PURE__ */ p(Ke.Provider, {
		value: m,
		children: /* @__PURE__ */ p(Ge.Provider, {
			value: h,
			children: e
		})
	});
}
function Ze(e, t) {
	let n = i(e);
	if (!n) throw Error(`${t} must be used inside <PDFViewer>`);
	return n;
}
function Qe() {
	return Ze(Ge, "useAnnotationState");
}
function $e() {
	return Ze(Ke, "useAnnotationActions");
}
function et(e) {
	let { annotations: t } = Qe();
	return s(() => Ne(t, e), [t, e]);
}
//#endregion
//#region src/PDFViewer/context/ToolContext.jsx
var tt = e(null);
function nt({ children: e }) {
	let [t, n] = u(!1), [i, a] = u("#000000"), [o, c] = u(2), [d, f] = u(1), [m, h] = u(null), g = l(null), _ = r((e) => {
		g.current = e, h(e);
	}, []), v = l(null), y = l(!1), b = s(() => ({
		isDrawMode: t,
		setIsDrawMode: n,
		inkColor: i,
		setInkColor: a,
		inkThickness: o,
		setInkThickness: c,
		inkOpacity: d,
		setInkOpacity: f,
		activeId: m,
		setActiveId: _,
		activeIdRef: g,
		cancelStrokeRef: v,
		isDraggingRef: y
	}), [
		t,
		i,
		o,
		d,
		m,
		_
	]);
	return /* @__PURE__ */ p(tt.Provider, {
		value: b,
		children: e
	});
}
function rt() {
	let e = i(tt);
	if (!e) throw Error("useTools must be used inside <PDFViewer>");
	return e;
}
//#endregion
//#region src/PDFViewer/labels.js
var it = Object.freeze({
	toggleThumbnails: "Toggle page thumbnails",
	thumbnailSidebar: "Page thumbnails",
	previousPage: "Previous page",
	nextPage: "Next page",
	pageNumber: "Page number",
	goToPage: "Go to page {page}",
	zoomIn: "Zoom in (Ctrl +)",
	zoomOut: "Zoom out (Ctrl -)",
	zoomLevel: "Zoom level",
	zoomAutomatic: "Automatic Zoom",
	zoomActualSize: "Actual Size",
	zoomPageFit: "Page Fit",
	zoomPageWidth: "Page Width",
	rotateLeft: "Rotate left (hold Shift for every page)",
	rotateRight: "Rotate right (hold Shift for every page)",
	undo: "Undo (Ctrl+Z)",
	redo: "Redo (Ctrl+Y)",
	draw: "Freehand draw",
	drawSettings: "Drawing settings",
	colour: "Colour",
	thickness: "Thickness",
	opacity: "Opacity",
	strokeThickness: "Stroke thickness",
	strokeOpacity: "Stroke opacity",
	addStamp: "Add stamp",
	chooseStamp: "Choose stamp image",
	noStampConfigured: "No stamp image configured",
	addImage: "Add your own image",
	chooseImage: "Choose an image you added",
	uploadImage: "Upload another image…",
	addText: "Add a text box",
	textPlaceholder: "Type here…",
	fontSize: "Font size",
	font: "Font",
	textColour: "Text colour",
	duplicate: "Duplicate (Ctrl+D)",
	delete: "Delete (Del)",
	download: "Download",
	loading: "Loading document…",
	loadFailed: "This document could not be opened.",
	retry: "Try again",
	noDocument: "No document loaded."
});
function at(e) {
	if (!e || typeof e != "object") return it;
	let t = { ...it };
	for (let [n, r] of Object.entries(e)) typeof r == "string" && n in it && (t[n] = r);
	return t;
}
function ot(e, t) {
	return typeof e == "string" ? e.replace(/\{(\w+)\}/g, (e, n) => n in t ? String(t[n]) : e) : "";
}
//#endregion
//#region src/PDFViewer/context/LabelContext.jsx
var st = e(it);
function ct({ labels: e, children: t }) {
	let n = s(() => at(e), [e]);
	return /* @__PURE__ */ p(st.Provider, {
		value: n,
		children: t
	});
}
function lt() {
	return i(st);
}
var ut = {
	shell: "_shell_1pk9g_1",
	body: "_body_1pk9g_53"
}, dt = 8;
function ft() {
	let [e, t] = u("start");
	return [r((e) => {
		if (!e) return;
		let n = e.offsetParent;
		if (!n) return;
		let r = (e.closest(".rpvs-viewer") ?? document.documentElement).getBoundingClientRect(), i = n.getBoundingClientRect(), { width: a } = e.getBoundingClientRect(), o = i.left + a > r.right - dt, s = i.right - a >= r.left + dt;
		t(o && s ? "end" : "start");
	}, []), e];
}
var pt = (e) => e === "end" ? "alignEnd" : "alignStart", mt = .1, ht = (e) => Math.min(10, Math.max(mt, e));
function gt(e, t, n) {
	if (e === "actual-size") return 1;
	if (!t?.length || !n?.width || !n?.height) return null;
	let r = Math.max(...t.map((e) => e.width)), i = Math.max(...t.map((e) => e.height)), a = (n.width - 40) / r, o = (n.height - 40) / i;
	switch (e) {
		case "page-width": return a;
		case "page-fit": return Math.min(a, o);
		case "auto": return Math.min(a, 1.25);
		default: return null;
	}
}
function _t({ pageSizes: e, container: t, containerRef: n }) {
	let [i, o] = u(1), [s, c] = u("auto"), d = l(null), f = l(i), p = r((e) => {
		o((t) => ht(typeof e == "function" ? e(t) : e)), c("custom");
	}, []), m = r(() => p((e) => e + .2), [p]), h = r(() => p((e) => e - .2), [p]);
	a(() => {
		if (s === "custom" || !e.length) return;
		let t = () => {
			let t = n.current;
			if (!t) return;
			let r = gt(s, e, {
				width: t.clientWidth,
				height: t.clientHeight
			});
			r && o(ht(r));
		};
		return t(), window.addEventListener("resize", t), () => window.removeEventListener("resize", t);
	}, [
		s,
		e,
		t,
		n
	]), a(() => {
		let e = f.current;
		f.current = i;
		let r = n.current;
		if (!t || !r || i === e) return;
		let a = d.current;
		if (d.current = null, a?.pageIndex !== void 0) {
			let e = r.querySelector(`.pdf-page-container[data-page-index="${a.pageIndex}"]`);
			if (e) {
				let t = e.getBoundingClientRect(), n = t.left + t.width * a.normX, i = t.top + t.height * a.normY;
				r.scrollLeft += n - a.targetClientX, r.scrollTop += i - a.targetClientY;
				return;
			}
		}
		let o = r.getBoundingClientRect(), s = i / e;
		r.scrollTop = (r.scrollTop + o.height / 2) * s - o.height / 2, r.scrollWidth > r.clientWidth && (r.scrollLeft = (r.scrollLeft + o.width / 2) * s - o.width / 2);
	}, [
		i,
		t,
		n
	]);
	let g = r((e, t, n) => {
		let r = n?.closest?.(".pdf-page-container");
		if (!r) {
			d.current = null;
			return;
		}
		let i = r.getBoundingClientRect();
		d.current = {
			pageIndex: r.dataset.pageIndex,
			normX: (e - i.left) / i.width,
			normY: (t - i.top) / i.height,
			targetClientX: e,
			targetClientY: t
		};
	}, []);
	return a(() => {
		if (!t) return;
		let e = n.current;
		if (!e) return;
		let r = (e) => {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			let t = e.deltaY / 100;
			e.deltaMode === 1 ? t = e.deltaY / 3 : e.deltaMode === 2 && (t = e.deltaY), g(e.clientX, e.clientY, e.target), p((e) => e * 1.2 ** -t);
		};
		return e.addEventListener("wheel", r, { passive: !1 }), () => e.removeEventListener("wheel", r);
	}, [
		t,
		n,
		p,
		g
	]), {
		scale: i,
		setScale: p,
		zoomMode: s,
		setZoomMode: c,
		zoomIn: m,
		zoomOut: h,
		anchorAtPointer: g
	};
}
var X = {
	iconButton: "_iconButton_1nstj_17",
	chipButton: "_chipButton_1nstj_79 _iconButton_1nstj_17",
	primaryButton: "_primaryButton_1nstj_111 _iconButton_1nstj_17",
	active: "_active_1nstj_153",
	divider: "_divider_1nstj_175",
	alignStart: "_alignStart_1nstj_199",
	alignEnd: "_alignEnd_1nstj_207",
	popover: "_popover_1nstj_215",
	fieldLabel: "_fieldLabel_1nstj_239",
	range: "_range_1nstj_255",
	numberInput: "_numberInput_1nstj_267",
	select: "_select_1nstj_291",
	colorWell: "_colorWell_1nstj_317",
	srOnly: "_srOnly_1nstj_371"
}, vt = {
	nav: "_nav_361nw_1",
	input: "_input_361nw_19",
	total: "_total_361nw_51"
};
//#endregion
//#region src/PDFViewer/components/PageNavigation.jsx
function yt({ pageCount: e, activePageIndex: t, onGoToPage: n }) {
	let r = lt(), [i, a] = u(""), [o, s] = u(!1), c = o ? i : String(t + 1);
	if (!e) return null;
	let l = () => {
		s(!1);
		let t = Number.parseInt(i, 10);
		Number.isNaN(t) || n(Math.max(1, Math.min(e, t)) - 1);
	}, d = t > 0, f = t < e - 1;
	return /* @__PURE__ */ m("div", {
		className: vt.nav,
		children: [
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: () => n(t - 1),
				disabled: !d,
				className: X.iconButton,
				title: r.previousPage,
				"aria-label": r.previousPage,
				children: /* @__PURE__ */ p(E, {
					size: 16,
					stroke: 2
				})
			}),
			/* @__PURE__ */ p("input", {
				type: "text",
				inputMode: "numeric",
				value: c,
				"aria-label": r.pageNumber,
				onFocus: (e) => {
					a(String(t + 1)), s(!0), e.target.select();
				},
				onChange: (e) => a(e.target.value.replace(/[^0-9]/g, "")),
				onBlur: l,
				onKeyDown: (e) => {
					e.key === "Enter" ? e.currentTarget.blur() : e.key === "Escape" && (s(!1), e.currentTarget.blur());
				},
				className: vt.input
			}),
			/* @__PURE__ */ m("span", {
				className: vt.total,
				children: ["/ ", e]
			}),
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: () => n(t + 1),
				disabled: !f,
				className: X.iconButton,
				title: r.nextPage,
				"aria-label": r.nextPage,
				children: /* @__PURE__ */ p(_, {
					size: 16,
					stroke: 2
				})
			})
		]
	});
}
var Z = {
	wrap: "_wrap_1c1i2_1",
	main: "_main_1c1i2_13",
	caret: "_caret_1c1i2_25",
	menu: "_menu_1c1i2_41 _popover_1nstj_215",
	item: "_item_1c1i2_53",
	thumb: "_thumb_1c1i2_93",
	itemLabel: "_itemLabel_1c1i2_111",
	separator: "_separator_1c1i2_123",
	hiddenInput: "_hiddenInput_1c1i2_135"
};
//#endregion
//#region src/PDFViewer/components/SplitMenu.jsx
function bt({ icon: e, onPrimary: t, disabled: n = !1, label: r, title: i, menuLabel: o, items: s = [], onSelect: c, footer: d = null }) {
	let [h, g] = u(!1), v = l(null), [y, b] = ft();
	a(() => {
		if (!h) return;
		let e = (e) => {
			v.current?.contains(e.target) || g(!1);
		}, t = (e) => {
			e.key === "Escape" && g(!1);
		};
		return document.addEventListener("pointerdown", e), document.addEventListener("keydown", t), () => {
			document.removeEventListener("pointerdown", e), document.removeEventListener("keydown", t);
		};
	}, [h]);
	let x = s.length > 0 || d !== null;
	return /* @__PURE__ */ m("div", {
		ref: v,
		className: Z.wrap,
		children: [
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: t,
				disabled: n,
				className: `${X.chipButton} ${x ? Z.main : ""}`,
				title: i ?? r,
				"aria-label": r,
				children: e
			}),
			x && /* @__PURE__ */ p("button", {
				type: "button",
				onClick: () => g((e) => !e),
				className: `${X.chipButton} ${Z.caret}`,
				"aria-label": o,
				"aria-expanded": h,
				title: o,
				children: /* @__PURE__ */ p(_, {
					size: 14,
					stroke: 2
				})
			}),
			h && x && /* @__PURE__ */ m("div", {
				ref: y,
				className: `${Z.menu} ${X[pt(b)]}`,
				children: [s.map((e) => /* @__PURE__ */ m("button", {
					type: "button",
					onClick: () => {
						g(!1), c?.(e.id);
					},
					className: Z.item,
					children: [e.src && /* @__PURE__ */ p("img", {
						src: e.src,
						alt: "",
						className: Z.thumb
					}), /* @__PURE__ */ p("span", {
						className: Z.itemLabel,
						children: e.label
					})]
				}, e.id)), d && /* @__PURE__ */ m(f, { children: [s.length > 0 && /* @__PURE__ */ p("div", { className: Z.separator }), d] })]
			})
		]
	});
}
//#endregion
//#region src/PDFViewer/components/StampMenu.jsx
function xt({ assets: e, onAddStamp: t, disabled: n }) {
	let r = lt();
	return /* @__PURE__ */ p(bt, {
		icon: /* @__PURE__ */ p(ee, {
			size: 16,
			stroke: 2
		}),
		onPrimary: () => t(),
		disabled: n || e.length === 0,
		label: r.addStamp,
		title: e.length === 0 ? r.noStampConfigured : r.addStamp,
		menuLabel: r.chooseStamp,
		items: e.length > 1 ? e : [],
		onSelect: t
	});
}
//#endregion
//#region src/PDFViewer/components/ImageMenu.jsx
function St({ uploaded: e, onAddStamp: t, onUpload: n, disabled: r }) {
	let i = lt(), a = l(null), o = () => a.current?.click();
	return /* @__PURE__ */ m(f, { children: [/* @__PURE__ */ p(bt, {
		icon: /* @__PURE__ */ p(te, {
			size: 16,
			stroke: 2
		}),
		onPrimary: o,
		disabled: r,
		label: i.addImage,
		menuLabel: i.chooseImage,
		items: e,
		onSelect: t,
		footer: e.length > 0 ? /* @__PURE__ */ p("button", {
			type: "button",
			onClick: o,
			className: Z.item,
			children: i.uploadImage
		}) : null
	}), /* @__PURE__ */ p("input", {
		ref: a,
		type: "file",
		accept: "image/png,image/jpeg",
		className: Z.hiddenInput,
		onChange: (e) => {
			let t = e.target.files?.[0];
			e.target.value = "", t && n(t);
		}
	})] });
}
var Q = {
	toolbar: "_toolbar_mlb2g_1",
	group: "_group_mlb2g_33",
	groupCenter: "_groupCenter_mlb2g_49 _group_mlb2g_33",
	inset: "_inset_mlb2g_61",
	zoomSelectWrap: "_zoomSelectWrap_mlb2g_79",
	zoomSelect: "_zoomSelect_mlb2g_79",
	zoomCaret: "_zoomCaret_mlb2g_137",
	split: "_split_mlb2g_155",
	splitMain: "_splitMain_mlb2g_167",
	splitCaret: "_splitCaret_mlb2g_179",
	drawPanel: "_drawPanel_mlb2g_195 _popover_1nstj_215",
	drawPanelSection: "_drawPanelSection_mlb2g_207",
	colorRow: "_colorRow_mlb2g_215",
	colorSwatch: "_colorSwatch_mlb2g_227",
	colorValue: "_colorValue_mlb2g_247",
	hideOnNarrow: "_hideOnNarrow_mlb2g_267",
	hideOnMedium: "_hideOnMedium_mlb2g_279"
}, Ct = [
	.5,
	.75,
	1,
	1.25,
	1.5,
	2,
	3,
	4,
	5,
	8,
	10
], wt = .2;
function Tt({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: e.api.toggleThumbnails,
		"aria-pressed": e.showThumbnails,
		className: X.iconButton,
		title: e.labels.toggleThumbnails,
		"aria-label": e.labels.toggleThumbnails,
		children: /* @__PURE__ */ p(C, {
			size: 16,
			stroke: 2
		})
	});
}
function Et({ ctx: e }) {
	return /* @__PURE__ */ p("div", {
		className: Q.hideOnNarrow,
		children: /* @__PURE__ */ p(yt, {
			pageCount: e.pageCount,
			activePageIndex: e.activePageIndex,
			onGoToPage: e.api.goToPage
		})
	});
}
function Dt({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: () => e.api.setScale((e) => Math.max(mt, e - wt)),
		className: X.iconButton,
		title: e.labels.zoomOut,
		"aria-label": e.labels.zoomOut,
		children: /* @__PURE__ */ p(h, {
			size: 16,
			stroke: 2
		})
	});
}
function Ot({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: () => e.api.setScale((e) => Math.min(10, e + wt)),
		className: X.iconButton,
		title: e.labels.zoomIn,
		"aria-label": e.labels.zoomIn,
		children: /* @__PURE__ */ p(g, {
			size: 16,
			stroke: 2
		})
	});
}
function kt({ ctx: e }) {
	let { scale: t, zoomMode: n, labels: r, api: i } = e, a = n === "custom" && !Ct.includes(t);
	return /* @__PURE__ */ m("div", {
		className: Q.zoomSelectWrap,
		children: [/* @__PURE__ */ m("select", {
			value: n === "custom" ? t.toString() : n,
			onChange: (e) => {
				let t = e.target.value;
				[
					"auto",
					"page-fit",
					"page-width",
					"actual-size"
				].includes(t) ? i.setZoomMode(t) : i.setScale(Number.parseFloat(t));
			},
			className: Q.zoomSelect,
			"aria-label": r.zoomLevel,
			children: [
				/* @__PURE__ */ p("option", {
					value: "auto",
					children: r.zoomAutomatic
				}),
				/* @__PURE__ */ p("option", {
					value: "actual-size",
					children: r.zoomActualSize
				}),
				/* @__PURE__ */ p("option", {
					value: "page-fit",
					children: r.zoomPageFit
				}),
				/* @__PURE__ */ p("option", {
					value: "page-width",
					children: r.zoomPageWidth
				}),
				/* @__PURE__ */ p("option", {
					disabled: !0,
					children: "──────────"
				}),
				Ct.map((e) => /* @__PURE__ */ m("option", {
					value: e,
					children: [Math.round(e * 100), "%"]
				}, e)),
				a && /* @__PURE__ */ m("option", {
					value: t.toString(),
					hidden: !0,
					children: [Math.round(t * 100), "%"]
				})
			]
		}), /* @__PURE__ */ p("span", {
			className: Q.zoomCaret,
			children: /* @__PURE__ */ p(_, {
				size: 14,
				stroke: 2
			})
		})]
	});
}
function At({ ctx: e }) {
	return /* @__PURE__ */ m("div", {
		className: Q.inset,
		children: [
			/* @__PURE__ */ p(Dt, { ctx: e }),
			/* @__PURE__ */ p(kt, { ctx: e }),
			/* @__PURE__ */ p(Ot, { ctx: e })
		]
	});
}
function jt({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: (t) => e.api.rotatePages(-90, t.shiftKey ? "all" : "page"),
		className: X.iconButton,
		title: e.labels.rotateLeft,
		"aria-label": e.labels.rotateLeft,
		children: /* @__PURE__ */ p(w, {
			size: 16,
			stroke: 2
		})
	});
}
function Mt({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: (t) => e.api.rotatePages(90, t.shiftKey ? "all" : "page"),
		className: X.iconButton,
		title: e.labels.rotateRight,
		"aria-label": e.labels.rotateRight,
		children: /* @__PURE__ */ p(T, {
			size: 16,
			stroke: 2
		})
	});
}
function Nt({ ctx: e }) {
	return /* @__PURE__ */ m("div", {
		className: `${Q.group} ${Q.hideOnMedium}`,
		children: [/* @__PURE__ */ p(jt, { ctx: e }), /* @__PURE__ */ p(Mt, { ctx: e })]
	});
}
function Pt({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: e.api.undo,
		disabled: !e.canUndo,
		className: X.iconButton,
		title: e.labels.undo,
		"aria-label": e.labels.undo,
		children: /* @__PURE__ */ p(v, {
			size: 16,
			stroke: 2
		})
	});
}
function Ft({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: e.api.redo,
		disabled: !e.canRedo,
		className: X.iconButton,
		title: e.labels.redo,
		"aria-label": e.labels.redo,
		children: /* @__PURE__ */ p(y, {
			size: 16,
			stroke: 2
		})
	});
}
function It({ ctx: e }) {
	return /* @__PURE__ */ m(f, { children: [/* @__PURE__ */ p(Pt, { ctx: e }), /* @__PURE__ */ p(Ft, { ctx: e })] });
}
function Lt({ ctx: e }) {
	let { isDrawMode: t, setIsDrawMode: n, inkColor: r, setInkColor: i, inkThickness: a, setInkThickness: o, inkOpacity: s, setInkOpacity: c } = rt(), [l, d] = u(!1), [f, h] = ft(), { labels: g } = e;
	return /* @__PURE__ */ m("div", {
		className: Q.split,
		children: [
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: () => n(!t),
				"aria-pressed": t,
				className: `${X.chipButton} ${Q.splitMain} ${t ? X.active : ""}`,
				title: g.draw,
				"aria-label": g.draw,
				children: /* @__PURE__ */ p(b, {
					size: 16,
					stroke: 2
				})
			}),
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: () => d((e) => !e),
				"aria-expanded": l,
				className: `${X.chipButton} ${Q.splitCaret} ${t ? X.active : ""}`,
				"aria-label": g.drawSettings,
				title: g.drawSettings,
				children: /* @__PURE__ */ p(_, {
					size: 14,
					stroke: 2
				})
			}),
			l && /* @__PURE__ */ m("div", {
				ref: f,
				className: `${Q.drawPanel} ${X[pt(h)]}`,
				children: [
					/* @__PURE__ */ m("div", {
						className: Q.drawPanelSection,
						children: [/* @__PURE__ */ p("label", {
							className: X.fieldLabel,
							htmlFor: "rpvs-ink-color",
							children: /* @__PURE__ */ p("span", { children: g.colour })
						}), /* @__PURE__ */ m("div", {
							className: Q.colorRow,
							children: [/* @__PURE__ */ p("input", {
								id: "rpvs-ink-color",
								type: "color",
								value: r,
								onChange: (e) => i(e.target.value),
								className: Q.colorSwatch
							}), /* @__PURE__ */ p("span", {
								className: Q.colorValue,
								children: r
							})]
						})]
					}),
					/* @__PURE__ */ m("div", {
						className: Q.drawPanelSection,
						children: [/* @__PURE__ */ m("label", {
							className: X.fieldLabel,
							children: [/* @__PURE__ */ p("span", { children: g.thickness }), /* @__PURE__ */ m("span", { children: [a, "px"] })]
						}), /* @__PURE__ */ p("input", {
							type: "range",
							min: "1",
							max: "15",
							value: a,
							onChange: (e) => o(Number.parseInt(e.target.value, 10)),
							className: X.range,
							"aria-label": g.strokeThickness
						})]
					}),
					/* @__PURE__ */ m("div", {
						className: Q.drawPanelSection,
						children: [/* @__PURE__ */ m("label", {
							className: X.fieldLabel,
							children: [/* @__PURE__ */ p("span", { children: g.opacity }), /* @__PURE__ */ m("span", { children: [Math.round(s * 100), "%"] })]
						}), /* @__PURE__ */ p("input", {
							type: "range",
							min: "10",
							max: "100",
							value: s * 100,
							onChange: (e) => c(Number.parseInt(e.target.value, 10) / 100),
							className: X.range,
							"aria-label": g.strokeOpacity
						})]
					})
				]
			})
		]
	});
}
function Rt({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: () => e.api.addTextStamp(),
		className: X.chipButton,
		title: e.labels.addText,
		"aria-label": e.labels.addText,
		children: /* @__PURE__ */ p(x, {
			size: 16,
			stroke: 2
		})
	});
}
function zt({ ctx: e }) {
	return /* @__PURE__ */ p(xt, {
		assets: e.configuredAssets,
		onAddStamp: e.api.addImageStamp
	});
}
function Bt({ ctx: e }) {
	return /* @__PURE__ */ p(St, {
		uploaded: e.uploadedAssets,
		onAddStamp: e.api.addImageStamp,
		onUpload: e.api.uploadStamp
	});
}
function Vt({ ctx: e }) {
	return e.onDownload ? /* @__PURE__ */ p("button", {
		type: "button",
		onClick: e.onDownload,
		disabled: !e.canDownload,
		className: X.primaryButton,
		title: e.labels.download,
		"aria-label": e.labels.download,
		children: /* @__PURE__ */ p(S, {
			size: 16,
			stroke: 2
		})
	}) : null;
}
//#endregion
//#region src/PDFViewer/components/toolbar/registry.js
var Ht = Object.freeze({
	thumbnails: {
		zone: "left",
		Component: Tt
	},
	pageNav: {
		zone: "left",
		Component: Et
	},
	zoom: {
		zone: "center",
		Component: At
	},
	zoomOut: {
		zone: "center",
		Component: Dt
	},
	zoomSelect: {
		zone: "center",
		Component: kt
	},
	zoomIn: {
		zone: "center",
		Component: Ot
	},
	rotate: {
		zone: "center",
		Component: Nt
	},
	rotateLeft: {
		zone: "center",
		Component: jt
	},
	rotateRight: {
		zone: "center",
		Component: Mt
	},
	history: {
		zone: "right",
		Component: It
	},
	undo: {
		zone: "right",
		Component: Pt
	},
	redo: {
		zone: "right",
		Component: Ft
	},
	draw: {
		zone: "right",
		Component: Lt
	},
	addText: {
		zone: "right",
		Component: Rt
	},
	stamp: {
		zone: "right",
		Component: zt
	},
	image: {
		zone: "right",
		Component: Bt
	},
	download: {
		zone: "right",
		Component: Vt
	}
}), Ut = Object.freeze(["thumbnails", "pageNav"]), Wt = Object.freeze(["zoom", "rotate"]), Gt = Object.freeze([
	"history",
	"divider",
	"draw",
	"addText",
	"stamp",
	"image",
	"download"
]), Kt = Object.freeze(["divider", "spacer"]);
function qt(e = {}, { registry: t = Ht, onUnknown: n, onFixed: r } = {}) {
	let { displayActions: i, customToolbarActions: a } = e ?? {}, o = /* @__PURE__ */ new Map();
	for (let e of Array.isArray(a) ? a : []) e?.id && o.set(e.id, e);
	let s = Array.isArray(i) && i.length > 0 ? i : [...Gt, ...o.keys()], c = [], l = [], u = [];
	for (let e of s) {
		if (typeof e != "string") continue;
		if (Kt.includes(e)) {
			u.push({
				id: e,
				kind: e
			});
			continue;
		}
		let n = o.get(e);
		if (n) {
			u.push({
				id: e,
				kind: "custom",
				action: n
			});
			continue;
		}
		let r = t[e];
		if (!r) {
			c.push(e);
			continue;
		}
		if (r.zone !== "right") {
			l.push(e);
			continue;
		}
		u.push({
			id: e,
			kind: "builtin",
			Component: r.Component
		});
	}
	return c.length > 0 && n?.(c), l.length > 0 && r?.(l), {
		left: Jt(Ut, t),
		center: Jt(Wt, t),
		right: Yt(Xt(u))
	};
}
function Jt(e, t) {
	return e.filter((e) => t[e]).map((e) => ({
		id: e,
		key: e,
		kind: "builtin",
		Component: t[e].Component
	}));
}
function Yt(e) {
	return e.map((e, t) => ({
		...e,
		key: `${e.id}#${t}`
	}));
}
function Xt(e) {
	let t = (e) => Kt.includes(e.kind), n = [];
	for (let r of e) t(r) && (n.length === 0 || t(n.at(-1))) || n.push(r);
	for (; n.length > 0 && t(n.at(-1));) n.pop();
	return n;
}
//#endregion
//#region src/PDFViewer/components/Toolbar.jsx
function Zt({ toolbar: e, ctx: t }) {
	let n = lt(), r = s(() => qt(e, {
		onUnknown: tn,
		onFixed: nn
	}), [e]), i = s(() => ({
		...t,
		labels: n
	}), [t, n]);
	return /* @__PURE__ */ m("div", {
		className: Q.toolbar,
		children: [
			/* @__PURE__ */ p("div", {
				className: Q.group,
				children: Qt(r.left, i)
			}),
			/* @__PURE__ */ p("div", {
				className: Q.groupCenter,
				children: Qt(r.center, i)
			}),
			/* @__PURE__ */ p("div", {
				className: Q.group,
				children: Qt(r.right, i)
			})
		]
	});
}
function Qt(e, t) {
	return e.map((e) => {
		switch (e.kind) {
			case "divider": return /* @__PURE__ */ p("span", { className: X.divider }, e.key);
			case "spacer": return /* @__PURE__ */ p("span", { style: { flex: 1 } }, e.key);
			case "custom": return /* @__PURE__ */ p($t, { action: e.action }, e.key);
			default: {
				let { Component: n } = e;
				return /* @__PURE__ */ p(n, { ctx: t }, e.key);
			}
		}
	});
}
function $t({ action: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: e.onClick,
		disabled: e.disabled,
		"aria-pressed": e.active,
		className: `${X.chipButton} ${e.active ? X.active : ""}`,
		title: e.tooltip || e.label,
		"aria-label": e.label,
		children: e.icon ?? e.label
	});
}
var en = /* @__PURE__ */ new Set();
function tn(e) {
	rn(e, (e) => `Unknown toolbar action "${e}" in config.toolbar.displayActions. Use a built-in action id, or the id of an entry in config.toolbar.customToolbarActions.`);
}
function nn(e) {
	rn(e, (e) => `Toolbar action "${e}" is one of the fixed navigation controls, so config.toolbar.displayActions cannot place it — that list configures the right-hand action row only. Use config.renderToolbar to rearrange the whole bar.`);
}
function rn(e, t) {
	for (let n of e) en.has(n) || (en.add(n), console.warn(`[@armsolusi/pdf-viewer] ${t(n)}`));
}
var $ = {
	box: "_box_11ca3_1",
	boxSelected: "_boxSelected_11ca3_37",
	boxTransforming: "_boxTransforming_11ca3_45",
	content: "_content_11ca3_71",
	outline: "_outline_11ca3_81",
	outlineSelected: "_outlineSelected_11ca3_111",
	handle: "_handle_11ca3_123",
	rotateHandle: "_rotateHandle_11ca3_147",
	toolbarAnchor: "_toolbarAnchor_11ca3_193",
	toolbarHidden: "_toolbarHidden_11ca3_221"
}, an = 28;
function on({ rect: e, rotation: t = 0, frameRotation: n = 0, selected: i = !1, lockAspectRatio: a = !1, resizable: o = !0, rotatable: s = !1, opacity: c = 1, className: d = "", onSelect: h, onActivate: g, onTransformStart: _, onCommit: v, constrainDraft: y, isDraggingRef: b, children: x, toolbar: S }) {
	let C = l(null), w = l(null), T = l(null), [E, ee] = u(!1), [te, D] = u(!1), ne = r((e, t) => {
		let r = (n + t) * Math.PI / 180, i = (Math.abs(e.width * Math.sin(r)) + Math.abs(e.height * Math.cos(r))) / 2 + an;
		return `rotate(${-(n + t)}deg) translateY(${i}px) translate(-50%, -50%)`;
	}, [n]), O = r((e, t) => {
		let n = C.current;
		n && (n.style.left = `${e.x}px`, n.style.top = `${e.y}px`, n.style.width = `${e.width}px`, n.style.height = `${e.height}px`, n.style.transform = `rotate(${t}deg)`, w.current && (w.current.style.transform = ne(e, t)));
	}, [ne]), re = r((n) => {
		if (n.button != null && n.button !== 0) return;
		let r = n.target?.dataset?.handle, i = n.target?.dataset?.rotate === "true", a = n.target?.closest?.("[data-no-drag]");
		if (!r && !i && a) {
			h?.();
			return;
		}
		n.preventDefault(), n.stopPropagation(), h?.(), _?.();
		let o = C.current;
		if (!o) return;
		let s = o.getBoundingClientRect();
		T.current = {
			kind: i ? "rotate" : r ? "resize" : "move",
			handle: r,
			pointerId: n.pointerId,
			startX: n.clientX,
			startY: n.clientY,
			startRect: e,
			startRotation: t,
			centre: {
				x: s.left + s.width / 2,
				y: s.top + s.height / 2
			},
			current: {
				rect: e,
				rotation: t
			}
		}, T.current.startAngle = me(T.current.centre, {
			x: n.clientX,
			y: n.clientY
		}), n.currentTarget.setPointerCapture(n.pointerId), b && (b.current = !0), ee(!0), i && D(!0);
	}, [
		e,
		t,
		h,
		_,
		b
	]), k = r((e) => {
		let t = T.current;
		if (!t || t.pointerId !== e.pointerId) return;
		e.preventDefault();
		let r = {
			x: e.clientX - t.startX,
			y: e.clientY - t.startY
		};
		if (t.kind === "rotate") {
			let n = me(t.centre, {
				x: e.clientX,
				y: e.clientY
			}), r = t.startRotation + (n - t.startAngle), i = e.shiftKey ? he(r) : z(r);
			t.current = {
				rect: t.startRect,
				rotation: i
			};
		} else if (t.kind === "resize") {
			let e = se(r, n + t.startRotation), i = ue({
				rect: t.startRect,
				rotation: t.startRotation,
				handle: t.handle,
				delta: e,
				lockAspectRatio: a
			});
			t.current = {
				rect: y?.(i, t.startRotation, "resize", {
					handle: t.handle,
					lockAspectRatio: a
				}) ?? i,
				rotation: t.startRotation
			};
		} else {
			let e = se(r, n), i = L(t.startRect, e);
			t.current = {
				rect: y?.(i, t.startRotation, "move") ?? i,
				rotation: t.startRotation
			};
		}
		O(t.current.rect, t.current.rotation);
	}, [
		n,
		a,
		O,
		y
	]), A = r((e) => {
		let t = T.current;
		if (!t || t.pointerId !== e.pointerId) return;
		T.current = null, b && (b.current = !1), ee(!1), D(!1);
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {}
		let { rect: n, rotation: r } = t.current;
		(n.x !== t.startRect.x || n.y !== t.startRect.y || n.width !== t.startRect.width || n.height !== t.startRect.height || r !== t.startRotation) && v?.(n, r, C.current);
	}, [v, b]);
	return /* @__PURE__ */ m("div", {
		ref: C,
		className: [
			$.box,
			i && $.boxSelected,
			E && $.boxTransforming,
			d
		].filter(Boolean).join(" "),
		style: {
			left: e.x,
			top: e.y,
			width: e.width,
			height: e.height,
			transform: `rotate(${t}deg)`
		},
		"data-transforming": E ? "true" : void 0,
		onPointerDown: re,
		onPointerMove: k,
		onPointerUp: A,
		onPointerCancel: A,
		onDoubleClick: g,
		onDragStart: (e) => e.preventDefault(),
		onMouseDown: (e) => e.stopPropagation(),
		children: [
			/* @__PURE__ */ p("div", { className: `${$.outline} ${i ? $.outlineSelected : ""}` }),
			/* @__PURE__ */ p("div", {
				className: $.content,
				style: { opacity: c },
				children: x
			}),
			i && o && /* @__PURE__ */ p(f, { children: Object.entries(oe).map(([e, t]) => /* @__PURE__ */ p("span", {
				"data-handle": e,
				"aria-hidden": "true",
				className: $.handle,
				style: {
					left: `${t.x * 100}%`,
					top: `${t.y * 100}%`,
					cursor: sn[e]
				}
			}, e)) }),
			i && s && /* @__PURE__ */ p("span", {
				"data-rotate": "true",
				"aria-hidden": "true",
				className: $.rotateHandle
			}),
			i && S && /* @__PURE__ */ p("div", {
				ref: w,
				className: `${$.toolbarAnchor} ${te ? $.toolbarHidden : ""}`,
				style: { transform: ne(e, t) },
				children: S
			})
		]
	});
}
var sn = {
	nw: "nwse-resize",
	n: "ns-resize",
	ne: "nesw-resize",
	e: "ew-resize",
	se: "nwse-resize",
	s: "ns-resize",
	sw: "nesw-resize",
	w: "ew-resize"
}, cn = {
	bar: "_bar_10zcc_1",
	button: "_button_10zcc_29",
	divider: "_divider_10zcc_63",
	opacity: "_opacity_10zcc_79",
	opacityIcon: "_opacityIcon_10zcc_93",
	opacityRange: "_opacityRange_10zcc_103",
	opacityValue: "_opacityValue_10zcc_115"
};
//#endregion
//#region src/PDFViewer/components/annotations/AnnotationToolbar.jsx
function ln({ annotation: e, onEdit: t, onDuplicate: n, onDelete: r, children: i }) {
	let a = lt(), o = e.opacity ?? 1;
	return /* @__PURE__ */ m("div", {
		"data-no-drag": !0,
		className: cn.bar,
		children: [
			i,
			i && /* @__PURE__ */ p("span", { className: cn.divider }),
			/* @__PURE__ */ m("label", {
				className: cn.opacity,
				title: a.opacity,
				children: [
					/* @__PURE__ */ p(re, {
						size: 14,
						stroke: 2,
						className: cn.opacityIcon
					}),
					/* @__PURE__ */ p("input", {
						type: "range",
						min: "10",
						max: "100",
						value: Math.round(o * 100),
						onChange: (n) => t(e.id, { opacity: Number(n.target.value) / 100 }),
						className: cn.opacityRange,
						"aria-label": a.opacity
					}),
					/* @__PURE__ */ m("span", {
						className: cn.opacityValue,
						children: [Math.round(o * 100), "%"]
					})
				]
			}),
			/* @__PURE__ */ p("span", { className: cn.divider }),
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: (t) => {
					t.stopPropagation(), n(e.id);
				},
				className: cn.button,
				title: a.duplicate,
				"aria-label": a.duplicate,
				children: /* @__PURE__ */ p(O, {
					size: 16,
					stroke: 2
				})
			}),
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: (t) => {
					t.stopPropagation(), r(e.id);
				},
				className: cn.button,
				title: a.delete,
				"aria-label": a.delete,
				children: /* @__PURE__ */ p(ne, {
					size: 16,
					stroke: 2
				})
			})
		]
	});
}
var un = { image: "_image_yaeh2_1" };
//#endregion
//#region src/PDFViewer/components/annotations/ImageStamp.jsx
function dn({ annotation: e, screenRect: t, frameRotation: n, src: r, isActive: i, onSelect: a, onCommit: o, onEdit: s, onDuplicate: c, onDelete: l, constrainDraft: u, isDraggingRef: d }) {
	return /* @__PURE__ */ p(on, {
		rect: t,
		rotation: e.rotation ?? 0,
		frameRotation: n,
		selected: i,
		lockAspectRatio: !0,
		rotatable: !0,
		opacity: e.opacity ?? 1,
		constrainDraft: u,
		isDraggingRef: d,
		onSelect: () => a(e.id),
		onCommit: (t, n, r) => o(e.id, t, n, r),
		toolbar: /* @__PURE__ */ p(ln, {
			annotation: e,
			onEdit: s,
			onDuplicate: c,
			onDelete: l
		}),
		children: /* @__PURE__ */ p("img", {
			src: r,
			className: un.image,
			draggable: !1,
			alt: "Stamp"
		})
	});
}
var fn = n(dn), pn = Object.freeze([
	{
		label: "Helvetica",
		value: "Helvetica",
		css: "Helvetica, Arial, sans-serif"
	},
	{
		label: "Times",
		value: "Times",
		css: "\"Times New Roman\", Times, serif"
	},
	{
		label: "Courier",
		value: "Courier",
		css: "\"Courier New\", Courier, monospace"
	}
]), mn = {
	helvetica: A.Helvetica,
	arial: A.Helvetica,
	"sans-serif": A.Helvetica,
	times: A.TimesRoman,
	"times new roman": A.TimesRoman,
	timesroman: A.TimesRoman,
	serif: A.TimesRoman,
	courier: A.Courier,
	"courier new": A.Courier,
	monospace: A.Courier
};
function hn(e) {
	if (typeof e != "string" || !e.trim()) return A.Helvetica;
	for (let t of e.split(",")) {
		let e = t.trim().replace(/^["']|["']$/g, "").toLowerCase();
		if (mn[e]) return mn[e];
	}
	return A.Helvetica;
}
function gn(e) {
	let t = hn(e);
	return pn.find((e) => hn(e.value) === t) ?? pn[0];
}
function _n(e) {
	return gn(e).value;
}
function vn(e) {
	return gn(e).css;
}
function yn(e, t, n, r) {
	let i = (typeof e == "string" ? e : "").split("\n");
	if (!(r > 0)) return i;
	let a = [];
	for (let e of i) {
		if (e === "") {
			a.push("");
			continue;
		}
		let i = "";
		for (let o of e.split(/(\s+)/)) {
			if (o === "") continue;
			let e = i + o;
			if (t.widthOfTextAtSize(e, n) <= r || i === "") {
				i = e;
				continue;
			}
			a.push(i.trimEnd()), i = /^\s+$/.test(o) ? "" : o;
		}
		a.push(i.trimEnd());
	}
	return a;
}
//#endregion
//#region src/PDFViewer/utils/color.js
var bn = Object.freeze({
	r: 0,
	g: 0,
	b: 0
});
function xn(e) {
	if (typeof e != "string") return bn;
	let t = e.trim().replace(/^#/, ""), n;
	if (/^[0-9a-f]{3}$/i.test(t)) n = t.split("").map((e) => e + e).join("");
	else if (/^[0-9a-f]{6}$/i.test(t)) n = t;
	else return bn;
	return {
		r: parseInt(n.slice(0, 2), 16) / 255,
		g: parseInt(n.slice(2, 4), 16) / 255,
		b: parseInt(n.slice(4, 6), 16) / 255
	};
}
function Sn(e) {
	let { r: t, g: n, b: r } = xn(e);
	return ie(t, n, r);
}
var Cn = 1.2, wn = { [W.INK]: 0 }, Tn = (e) => wn[e.type] ?? 1;
function En(e) {
	return e.map((e, t) => ({
		annotation: e,
		index: t
	})).sort((e, t) => Tn(e.annotation) - Tn(t.annotation) || e.index - t.index).map((e) => e.annotation);
}
async function Dn(e, t, n) {
	let r = new Set(t.filter((e) => e.type === W.IMAGE).map((e) => e.assetId).filter(Boolean)), i = /* @__PURE__ */ new Map();
	for (let t of r) {
		let r = n?.[t];
		if (!r) continue;
		let a = typeof r == "string" ? r : r.src, o = r?.bytes ?? (a ? await An(t, a) : null);
		o && i.set(t, kn(o, r, a) ? await e.embedPng(o) : await e.embedJpg(o));
	}
	return i;
}
var On = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
];
function kn(e, t, n) {
	let r = new Uint8Array(e instanceof ArrayBuffer ? e : e.buffer ?? e, 0, 8);
	return r.length >= 8 ? On.every((e, t) => r[t] === e) : t?.mimeType ? t.mimeType === "image/png" : typeof n == "string" ? n.startsWith("data:image/png") || n.split("?")[0].toLowerCase().endsWith(".png") : !1;
}
async function An(e, t) {
	let n;
	try {
		n = await fetch(t);
	} catch (n) {
		throw Error(`Could not read the stamp image "${e}" from ${t}. If it is on another domain, that server must send CORS headers — a browser will display such an image but refuses to let script read its bytes. Hosting the image in your own app avoids this entirely.`, { cause: n });
	}
	if (!n.ok) throw Error(`Could not read the stamp image "${e}" from ${t} (${n.status} ${n.statusText}).`);
	return n.arrayBuffer();
}
async function jn(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of t) {
		if (r.type !== W.TEXT) continue;
		let t = hn(r.fontFamily);
		n.has(t) || n.set(t, await e.embedFont(t));
	}
	return n;
}
function Mn(e, t, n, { images: r }) {
	let i = r.get(t.assetId);
	if (!i) return;
	let { x: a, y: o, rotate: s } = ye(t, n, t.rotation ?? 0);
	e.drawImage(i, {
		x: a,
		y: o,
		width: t.width,
		height: t.height,
		rotate: j(s),
		opacity: t.opacity ?? 1
	});
}
function Nn(e, t, n, { fonts: r }) {
	let i = t.text ?? "";
	if (!i) return;
	let a = t.fontSize || 16, o = r.get(hn(t.fontFamily));
	if (!o) return;
	let s = t.rotation ?? 0, c = a * Cn, l = yn(i, o, a, Math.max(0, (t.width ?? 0) - 8)), u = (c - a) / 2, d = o.heightAtSize(a, { descender: !1 }), f = z(V(n.rotate) - s);
	l.forEach((r, i) => {
		if (!r) return;
		let l = ve(B(t, {
			x: -t.width / 2 + 4,
			y: -t.height / 2 + 4 + u + d + i * c
		}, s), n);
		e.drawText(r, {
			x: l.x,
			y: l.y,
			size: a,
			font: o,
			color: Sn(t.color),
			rotate: j(f),
			opacity: t.opacity ?? 1
		});
	});
}
function Pn(e, t, n) {
	let r = t.points ?? [];
	if (r.length < 2) return;
	let i = `M ${ge(r, ce(U(r)), t.rotation ?? 0).map((e) => `${e.x},${e.y}`).join(" L ")}`, { x: a, y: o, rotate: s } = be(n);
	e.drawSvgPath(i, {
		x: a,
		y: o,
		rotate: j(s),
		borderColor: Sn(t.color),
		borderWidth: t.strokeWidth ?? 2,
		borderOpacity: t.opacity ?? 1,
		borderLineCap: 1
	});
}
var Fn = {
	[W.IMAGE]: Mn,
	[W.TEXT]: Nn,
	[W.INK]: Pn
};
async function In(e, t, n = {}, { pageRotations: r = {}, rotateExportedPages: i = !0 } = {}) {
	let a = await k.load(e), o = a.getPages(), s = o.map((e) => V(e.getRotation().angle)), c = En(t.filter((e) => e && e.pageIndex >= 0 && e.pageIndex < o.length)), [l, u] = await Promise.all([Dn(a, c, n), jn(a, c)]);
	for (let e of c) {
		let t = o[e.pageIndex], { width: n, height: r } = t.getSize(), i = {
			pageWidth: n,
			pageHeight: r,
			rotate: s[e.pageIndex]
		};
		Fn[e.type]?.(t, e, i, {
			images: l,
			fonts: u
		});
	}
	i && o.forEach((e, t) => {
		let n = V(r[t] ?? 0);
		n && e.setRotation(j(V(s[t] + n)));
	});
	let d = await a.save();
	return new Blob([d], { type: "application/pdf" });
}
var Ln = {
	textarea: "_textarea_ganlz_1",
	textareaEditing: "_textareaEditing_ganlz_49"
};
function Rn({ annotation: e, screenRect: t, frameRotation: n, scale: r, isActive: i, autoFocus: o, onSelect: s, onCommit: c, onEdit: d, onDuplicate: f, onDelete: h, onGestureStart: g, onGestureEnd: _, constrainDraft: v, isDraggingRef: y }) {
	let b = lt(), x = e.fontSize || 16, S = l(null), [C, w] = u(o), [T, E] = u(i);
	return T !== i && (E(i), i || w(!1)), a(() => {
		C ? S.current?.focus() : S.current?.blur();
	}, [C]), /* @__PURE__ */ p(on, {
		onActivate: () => w(!0),
		onTransformStart: () => w(!1),
		rect: t,
		rotation: e.rotation ?? 0,
		frameRotation: n,
		selected: i,
		rotatable: !0,
		opacity: e.opacity ?? 1,
		constrainDraft: v,
		isDraggingRef: y,
		onSelect: () => s(e.id),
		onCommit: (t, n, r) => c(e.id, t, n, r),
		toolbar: /* @__PURE__ */ m(ln, {
			annotation: e,
			onEdit: d,
			onDuplicate: f,
			onDelete: h,
			children: [
				/* @__PURE__ */ p("input", {
					type: "number",
					value: x,
					min: 8,
					max: 72,
					onChange: (t) => {
						let n = Number.parseInt(t.target.value, 10);
						Number.isNaN(n) || d(e.id, { fontSize: Math.min(72, Math.max(8, n)) });
					},
					className: X.numberInput,
					title: b.fontSize
				}),
				/* @__PURE__ */ p("select", {
					value: _n(e.fontFamily),
					onChange: (t) => d(e.id, { fontFamily: t.target.value }),
					className: X.select,
					title: b.font,
					children: pn.map((e) => /* @__PURE__ */ p("option", {
						value: e.value,
						children: e.label
					}, e.value))
				}),
				/* @__PURE__ */ p("div", {
					className: X.colorWell,
					title: b.textColour,
					children: /* @__PURE__ */ p("input", {
						type: "color",
						value: e.color || "#000000",
						onChange: (t) => d(e.id, { color: t.target.value })
					})
				})
			]
		}),
		children: /* @__PURE__ */ p("textarea", {
			ref: S,
			...C ? { "data-no-drag": !0 } : {},
			readOnly: !C,
			value: e.text,
			placeholder: b.textPlaceholder,
			onChange: (t) => d(e.id, { text: t.target.value }),
			onFocus: g,
			onBlur: () => {
				_?.(), w(!1);
			},
			onKeyDown: (e) => {
				e.key === "Escape" && (e.stopPropagation(), w(!1));
			},
			className: `${Ln.textarea} ${C ? Ln.textareaEditing : ""}`,
			style: {
				fontSize: `${x * r}px`,
				color: e.color || "#000000",
				fontFamily: vn(e.fontFamily),
				lineHeight: Cn,
				padding: `${4 * r}px`
			}
		})
	});
}
var zn = n(Rn);
//#endregion
//#region src/PDFViewer/utils/inkSimplify.js
function Bn(e, t, n) {
	let r = t.x, i = t.y, a = n.x - r, o = n.y - i;
	if (a !== 0 || o !== 0) {
		let t = ((e.x - r) * a + (e.y - i) * o) / (a * a + o * o);
		t > 1 ? (r = n.x, i = n.y) : t > 0 && (r += a * t, i += o * t);
	}
	return a = e.x - r, o = e.y - i, a * a + o * o;
}
function Vn(e, t) {
	let n = new Uint8Array(e.length);
	n[0] = 1, n[e.length - 1] = 1;
	let r = [[0, e.length - 1]];
	for (; r.length;) {
		let [i, a] = r.pop();
		if (a - i < 2) continue;
		let o = 0, s = -1;
		for (let t = i + 1; t < a; t += 1) {
			let n = Bn(e[t], e[i], e[a]);
			n > o && (o = n, s = t);
		}
		o > t && s !== -1 && (n[s] = 1, r.push([i, s], [s, a]));
	}
	let i = [];
	for (let t = 0; t < e.length; t += 1) n[t] && i.push(e[t]);
	return i;
}
var Hn = .6;
function Un(e, t = Hn) {
	return !e || e.length <= 2 ? e ? [...e] : [] : t <= 0 ? [...e] : Vn(e, t * t);
}
var Wn = {
	layer: "_layer_174pc_1",
	layerDrawing: "_layerDrawing_174pc_33",
	strokeHit: "_strokeHit_174pc_43",
	stroke: "_stroke_174pc_43",
	deleteBadge: "_deleteBadge_174pc_61"
}, Gn = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/><path d=\"m15 5 4 4\"/></svg>') 0 24, crosshair", Kn = (e) => e.length ? `M ${e.map((e) => `${e.x},${e.y}`).join(" L ")}` : "";
function qn({ pageIndex: e, pageWidth: t, pageHeight: n, strokes: i, isDrawMode: a, inkColor: o, inkThickness: s, inkOpacity: c, activeId: d, onSelect: f, onCommit: h, onDelete: g, cancelStrokeRef: _ }) {
	let v = l(null), y = l(null), b = l([]), x = l(""), [S, C] = u(!1), w = r((e) => {
		let t = v.current;
		if (!t) return {
			x: 0,
			y: 0
		};
		let n = t.createSVGPoint();
		n.x = e.clientX, n.y = e.clientY;
		let r = t.getScreenCTM();
		if (!r) return {
			x: 0,
			y: 0
		};
		let i = n.matrixTransform(r.inverse());
		return {
			x: i.x,
			y: i.y
		};
	}, []), T = r(() => {
		b.current = [], x.current = "", y.current?.setAttribute("d", "");
	}, []), E = r(() => {
		b.current.length !== 0 && (T(), C(!1));
	}, [T]), ee = r((e) => {
		if (!a) {
			f(null);
			return;
		}
		e.preventDefault(), e.stopPropagation(), v.current?.setPointerCapture(e.pointerId);
		let t = w(e);
		b.current = [t], x.current = `M ${t.x},${t.y}`, y.current?.setAttribute("d", x.current), C(!0), _ && (_.current = E);
	}, [
		a,
		f,
		w,
		_,
		E
	]), te = r((e) => {
		if (!a || b.current.length === 0) return;
		e.preventDefault();
		let t = w(e);
		b.current.push(t), x.current += ` L ${t.x},${t.y}`, y.current?.setAttribute("d", x.current);
	}, [a, w]), D = r((t) => {
		if (b.current.length === 0) return;
		t.preventDefault();
		try {
			v.current?.releasePointerCapture(t.pointerId);
		} catch {}
		let n = Un(b.current);
		T(), C(!1), _ && (_.current = null), n.length > 1 && h(K({
			pageIndex: e,
			points: n,
			color: o,
			strokeWidth: s,
			opacity: c
		}));
	}, [
		T,
		h,
		e,
		o,
		s,
		c,
		_
	]);
	return /* @__PURE__ */ m("svg", {
		ref: v,
		"data-testid": "ink-layer",
		className: `${Wn.layer} ${a ? Wn.layerDrawing : ""}`,
		style: { cursor: a ? Gn : "auto" },
		viewBox: `0 0 ${t} ${n}`,
		preserveAspectRatio: "none",
		onPointerDown: ee,
		onPointerMove: te,
		onPointerUp: D,
		onPointerCancel: E,
		children: [i.map((e) => /* @__PURE__ */ p(Yn, {
			stroke: e,
			selected: d === e.id && !a,
			interactive: !a,
			onSelect: f,
			onDelete: g
		}, e.id)), /* @__PURE__ */ p("path", {
			ref: y,
			fill: "none",
			stroke: o,
			strokeWidth: s,
			strokeLinecap: "round",
			strokeLinejoin: "round",
			opacity: S ? c : 0,
			pointerEvents: "none"
		})]
	});
}
var Jn = 12;
function Yn({ stroke: e, selected: t, interactive: n, onSelect: r, onDelete: i }) {
	let a = Kn(e.points);
	return a ? /* @__PURE__ */ m("g", { children: [
		t && /* @__PURE__ */ p("path", {
			d: a,
			fill: "none",
			stroke: "#0ea5e9",
			strokeWidth: e.strokeWidth + 4,
			strokeLinecap: "round",
			strokeLinejoin: "round",
			opacity: "0.3",
			pointerEvents: "none"
		}),
		n && /* @__PURE__ */ p("path", {
			d: a,
			fill: "none",
			stroke: "transparent",
			strokeWidth: e.strokeWidth + Jn,
			strokeLinecap: "round",
			strokeLinejoin: "round",
			className: Wn.strokeHit,
			onPointerDown: (t) => {
				t.stopPropagation(), r(e.id);
			},
			onMouseDown: (e) => e.stopPropagation()
		}),
		/* @__PURE__ */ p("path", {
			d: a,
			fill: "none",
			stroke: e.color,
			strokeWidth: e.strokeWidth,
			strokeLinecap: "round",
			strokeLinejoin: "round",
			opacity: e.opacity ?? 1,
			pointerEvents: "none"
		}),
		t && e.points.length > 0 && /* @__PURE__ */ m("g", {
			transform: `translate(${e.points[0].x - 12}, ${e.points[0].y - 12})`,
			className: Wn.deleteBadge,
			onPointerDown: (t) => {
				t.stopPropagation(), i(e.id);
			},
			onMouseDown: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ p("circle", {
				cx: "12",
				cy: "12",
				r: "10",
				fill: "#ef4444"
			}), /* @__PURE__ */ p("path", {
				d: "M8 8 L16 16 M16 8 L8 16",
				stroke: "white",
				strokeWidth: "2",
				strokeLinecap: "round"
			})]
		})
	] }) : null;
}
var Xn = n(qn), Zn = e(null);
function Qn({ value: e, children: t }) {
	return /* @__PURE__ */ p(Zn.Provider, {
		value: e,
		children: t
	});
}
function $n() {
	let e = i(Zn);
	if (!e) throw Error("useViewer must be used inside <PDFViewer>");
	return e;
}
//#endregion
//#region src/PDFViewer/utils/pageHitTest.js
function er(e, t = document) {
	let n = Array.from(t.querySelectorAll(".pdf-page-container")), r = null, i = 0, a = null, o = Infinity, s = {
		x: (e.left + e.right) / 2,
		y: (e.top + e.bottom) / 2
	};
	for (let t of n) {
		let n = t.getBoundingClientRect(), c = Number.parseInt(t.dataset.pageIndex, 10), l = xe(e, n);
		l > i && (i = l, r = {
			pageIndex: c,
			pageRect: n
		});
		let u = s.x - (n.left + n.right) / 2, d = s.y - (n.top + n.bottom) / 2, f = u * u + d * d;
		f < o && (o = f, a = {
			pageIndex: c,
			pageRect: n
		});
	}
	return r ?? a;
}
var tr = {
	page: "_page_5v7l2_1",
	placeholder: "_placeholder_5v7l2_36",
	rotator: "_rotator_5v7l2_48",
	raster: "_raster_5v7l2_53",
	canvas: "_canvas_5v7l2_60",
	layer: "_layer_5v7l2_64"
}, nr = 300;
function rr({ pageNumber: e, registerPage: t, shouldRender: n = !0 }) {
	let i = e - 1, { pdfDoc: o, pageSizes: c, pageRotations: d, scale: f, stampAssets: h } = $n(), { isDrawMode: g, inkColor: _, inkThickness: v, inkOpacity: y, activeId: b, setActiveId: x, cancelStrokeRef: S, isDraggingRef: C } = rt(), w = $e(), T = et(i), E = l(null), ee = l(null), te = l(null), ne = l(null), [O, re] = u(f), [k, A] = u(f), j = c[i] ?? {
		width: 0,
		height: 0
	}, ie = c.length;
	a(() => {
		if (f === O) return;
		let e = setTimeout(() => re(f), nr);
		return () => clearTimeout(e);
	}, [f, O]), a(() => {
		if (!o || !n) return;
		let t = null, r = !1;
		return (async () => {
			let n = await o.getPage(e);
			if (r || !E.current) return;
			let i = n.getViewport({ scale: O }), a = window.devicePixelRatio || 1, s = Math.floor(i.width * a), c = Math.floor(i.height * a), l = document.createElement("canvas");
			l.width = s, l.height = c, t = n.render({
				canvasContext: l.getContext("2d", { alpha: !1 }),
				transform: a === 1 ? null : [
					a,
					0,
					0,
					a,
					0,
					0
				],
				viewport: i
			});
			try {
				if (await t.promise, r || !E.current) return;
				let a = E.current;
				a.width = s, a.height = c, a.style.width = `${Math.floor(i.width)}px`, a.style.height = `${Math.floor(i.height)}px`, a.getContext("2d", { alpha: !1 }).drawImage(l, 0, 0), A(O);
				let o = await n.getTextContent();
				if (r || !ee.current) return;
				ee.current.innerHTML = "", await new D.TextLayer({
					textContentSource: o,
					container: ee.current,
					viewport: i
				}).render();
				let u = await n.getAnnotations();
				if (r || !te.current || u.length === 0) return;
				te.current.innerHTML = "";
				let d = {
					getDestinationHash: () => "",
					getAnchorUrl: () => "",
					navigateTo: () => {},
					setDocument: () => {},
					executeNamedAction: () => {},
					cachePageRef: () => {},
					isPageVisible: () => !0,
					isPageCached: () => !0,
					page: e
				}, f = i.clone({ dontFlip: !0 });
				await new D.AnnotationLayer({
					page: n,
					viewport: f,
					div: te.current,
					annotations: u,
					linkService: d,
					downloadManager: null,
					renderInteractiveForms: !0
				}).render({
					annotations: u,
					div: te.current,
					page: n,
					viewport: f,
					linkService: d,
					renderInteractiveForms: !0
				});
			} catch (e) {
				e?.name !== "RenderingCancelledException" && console.error("[@armsolusi/pdf-viewer] Page render failed:", e);
			}
		})(), () => {
			r = !0, t?.cancel();
		};
	}, [
		o,
		e,
		O,
		n
	]);
	let M = r((e, t, n, r) => {
		let a = t.width / f, o = t.height / f, s = {
			rotation: n,
			width: a,
			height: o
		}, l = r ? er(r.getBoundingClientRect()) : null;
		if (l && l.pageIndex !== i) {
			let e = r.getBoundingClientRect(), t = d[l.pageIndex] ?? 0, i = c[l.pageIndex] ?? {
				width: 0,
				height: 0
			}, u = I({
				x: e.left + e.width / 2 - (l.pageRect.left + l.pageRect.width / 2),
				y: e.top + e.height / 2 - (l.pageRect.top + l.pageRect.height / 2)
			}, -t), p = {
				x: u.x / f + i.width / 2,
				y: u.y / f + i.height / 2
			}, m = de({
				x: p.x - a / 2,
				y: p.y - o / 2,
				width: a,
				height: o
			}, n, i);
			s.pageIndex = l.pageIndex, s.x = m.x, s.y = m.y;
		} else {
			let e = de({
				x: t.x / f,
				y: t.y / f,
				width: a,
				height: o
			}, n, c[i]);
			s.x = e.x, s.y = e.y;
		}
		w.update(e, s);
	}, [
		w,
		f,
		i,
		d,
		c
	]), N = s(() => !j.width || !j.height ? null : {
		left: 0,
		right: j.width * f,
		top: i === 0 ? 0 : null,
		bottom: i === ie - 1 ? j.height * f : null
	}, [
		j.width,
		j.height,
		f,
		i,
		ie
	]), P = r((e, t, n, { handle: r, lockAspectRatio: i } = {}) => N ? n === "resize" ? pe({
		rect: e,
		rotation: t,
		handle: r,
		limits: N,
		lockAspectRatio: i
	}) : fe(e, t, N) : e, [N]), ae = r((e, t) => w.update(e, t), [w]), oe = r((e) => w.duplicate(e, void 0, c[i]), [
		w,
		c,
		i
	]), F = r((e) => w.add(e), [w]), se = r((e) => {
		w.remove(e), x(null);
	}, [w, x]), { strokes: ce, objects: le } = s(() => ({
		strokes: T.filter((e) => e.type === W.INK),
		objects: T.filter((e) => e.type !== W.INK)
	}), [T]), ue = k > 0 ? f / k : 1, L = d[i] ?? 0, R = _e(j, L);
	return /* @__PURE__ */ p("div", {
		ref: r((e) => {
			ne.current = e, t?.(i, e);
		}, [t, i]),
		className: `pdf-page-container ${tr.page}`,
		"data-page-index": i,
		style: {
			width: R.width ? R.width * f : "auto",
			height: R.height ? R.height * f : "auto"
		},
		onMouseDown: () => x(null),
		children: n ? /* @__PURE__ */ m("div", {
			className: tr.rotator,
			style: {
				width: j.width * f,
				height: j.height * f,
				left: (R.width * f - j.width * f) / 2,
				top: (R.height * f - j.height * f) / 2,
				transform: L ? `rotate(${L}deg)` : void 0
			},
			children: [/* @__PURE__ */ m("div", {
				className: tr.raster,
				style: {
					transform: `scale(${ue})`,
					width: j.width * k,
					height: j.height * k
				},
				children: [
					/* @__PURE__ */ p("canvas", {
						ref: E,
						className: tr.canvas
					}),
					/* @__PURE__ */ p("div", {
						ref: ee,
						className: `textLayer ${tr.layer}`,
						style: {
							"--scale-factor": k,
							"--total-scale-factor": k
						}
					}),
					/* @__PURE__ */ p("div", {
						ref: te,
						className: `annotationLayer ${tr.layer}`,
						style: {
							"--scale-factor": k,
							"--total-scale-factor": k
						}
					}),
					/* @__PURE__ */ p(Xn, {
						pageIndex: i,
						pageWidth: j.width,
						pageHeight: j.height,
						strokes: ce,
						isDrawMode: g,
						inkColor: _,
						inkThickness: v,
						inkOpacity: y,
						activeId: b,
						onSelect: x,
						onCommit: F,
						onDelete: se,
						cancelStrokeRef: S
					})
				]
			}), le.map((e) => e.type === W.TEXT ? /* @__PURE__ */ p(zn, {
				annotation: e,
				screenRect: H(e, f),
				frameRotation: L,
				scale: f,
				isActive: b === e.id,
				autoFocus: b === e.id && e.text === "",
				onSelect: x,
				onCommit: M,
				onEdit: ae,
				onDuplicate: oe,
				onDelete: se,
				onGestureStart: w.beginGesture,
				onGestureEnd: w.endGesture,
				constrainDraft: P,
				isDraggingRef: C
			}, e.id) : /* @__PURE__ */ p(fn, {
				annotation: e,
				screenRect: H(e, f),
				frameRotation: L,
				src: h[e.assetId]?.src,
				isActive: b === e.id,
				onSelect: x,
				onCommit: M,
				onEdit: ae,
				onDuplicate: oe,
				onDelete: se,
				constrainDraft: P,
				isDraggingRef: C
			}, e.id))]
		}) : /* @__PURE__ */ p("div", {
			className: tr.placeholder,
			children: e
		})
	});
}
var ir = { scroller: "_scroller_1iebb_1" };
//#endregion
//#region src/PDFViewer/components/Document.jsx
function ar({ registerPage: e, renderWindow: t }) {
	let { pdfDoc: n, documentKey: r, setScrollContainer: i } = $n(), { setActiveId: a } = rt();
	return /* @__PURE__ */ p("div", {
		ref: i,
		className: ir.scroller,
		onMouseDown: (e) => {
			e.target === e.currentTarget && a(null);
		},
		children: n && Array.from({ length: n.numPages }, (n, i) => /* @__PURE__ */ p(or, {
			pageNumber: i + 1,
			registerPage: e,
			shouldRender: t.has(i)
		}, `${r}:${i}`))
	});
}
var or = n(rr), sr = {
	sidebar: "_sidebar_1h8kf_1",
	list: "_list_1h8kf_21",
	item: "_item_1h8kf_41",
	tile: "_tile_1h8kf_55",
	tileActive: "_tileActive_1h8kf_85",
	canvas: "_canvas_1h8kf_109",
	number: "_number_1h8kf_117",
	numberActive: "_numberActive_1h8kf_127"
}, cr = 116;
function lr({ activePageIndex: e, onGoToPage: t }) {
	let n = lt(), { pdfDoc: r, pageSizes: i, pageRotations: a } = $n();
	return r ? /* @__PURE__ */ p("aside", {
		className: sr.sidebar,
		"aria-label": n.thumbnailSidebar,
		children: /* @__PURE__ */ p("ul", {
			className: sr.list,
			children: Array.from({ length: r.numPages }, (n, o) => /* @__PURE__ */ p(dr, {
				pdfDoc: r,
				pageIndex: o,
				pageSize: i[o],
				userRotation: a[o] ?? 0,
				isActive: o === e,
				onSelect: t
			}, o))
		})
	}) : null;
}
function ur({ pdfDoc: e, pageIndex: t, pageSize: n, userRotation: r, isActive: i, onSelect: o }) {
	let s = lt(), c = l(null), d = l(null), [f, h] = u(!1), g = _e(n ?? {
		width: 0,
		height: 0
	}, r), _ = g.width ? g.height / g.width : 1.414, v = Math.round(cr * _);
	return a(() => {
		let e = c.current;
		if (!e || f) return;
		let t = new IntersectionObserver((e) => {
			e.some((e) => e.isIntersecting) && h(!0);
		}, { rootMargin: "200px" });
		return t.observe(e), () => t.disconnect();
	}, [f]), a(() => {
		if (!f || !e) return;
		let n = null, i = !1;
		return (async () => {
			try {
				let a = await e.getPage(t + 1);
				if (i || !d.current) return;
				let o = V(a.rotate + r), s = a.getViewport({
					scale: 1,
					rotation: o
				}), c = a.getViewport({
					scale: cr / s.width,
					rotation: o
				}), l = window.devicePixelRatio || 1, u = d.current;
				u.width = Math.floor(c.width * l), u.height = Math.floor(c.height * l), u.style.width = `${Math.floor(c.width)}px`, u.style.height = `${Math.floor(c.height)}px`, n = a.render({
					canvasContext: u.getContext("2d", { alpha: !1 }),
					transform: l === 1 ? null : [
						l,
						0,
						0,
						l,
						0,
						0
					],
					viewport: c
				}), await n.promise;
			} catch (e) {
				e?.name !== "RenderingCancelledException" && console.error("[@armsolusi/pdf-viewer] Thumbnail render failed:", e);
			}
		})(), () => {
			i = !0, n?.cancel();
		};
	}, [
		f,
		e,
		t,
		r
	]), /* @__PURE__ */ m("li", {
		ref: c,
		className: sr.item,
		children: [/* @__PURE__ */ p("button", {
			type: "button",
			onClick: () => o(t),
			"aria-current": i ? "page" : void 0,
			"aria-label": ot(s.goToPage, { page: t + 1 }),
			className: `${sr.tile} ${i ? sr.tileActive : ""}`,
			style: {
				width: cr,
				height: v
			},
			children: /* @__PURE__ */ p("canvas", {
				ref: d,
				className: sr.canvas
			})
		}), /* @__PURE__ */ p("span", {
			className: `${sr.number} ${i ? sr.numberActive : ""}`,
			children: t + 1
		})]
	});
}
var dr = n(ur), fr = {
	state: "_state_1sssu_1",
	skeleton: "_skeleton_1sssu_29",
	pulse: "_pulse_1sssu_1",
	title: "_title_1sssu_77",
	hint: "_hint_1sssu_91",
	retry: "_retry_1sssu_107",
	srOnly: "_srOnly_1sssu_137 _srOnly_1nstj_371"
};
//#endregion
//#region src/PDFViewer/components/feedback/DocumentStatus.jsx
function pr({ label: e }) {
	return /* @__PURE__ */ m("div", {
		className: fr.state,
		role: "status",
		children: [/* @__PURE__ */ p("div", { className: fr.skeleton }), /* @__PURE__ */ p("p", {
			className: fr.hint,
			children: e
		})]
	});
}
function mr({ error: e, onRetry: t, label: n, retryLabel: r }) {
	return /* @__PURE__ */ m("div", {
		className: fr.state,
		role: "alert",
		children: [
			/* @__PURE__ */ p("p", {
				className: fr.title,
				children: n
			}),
			e?.message && /* @__PURE__ */ p("p", {
				className: fr.hint,
				children: e.message
			}),
			t && /* @__PURE__ */ p("button", {
				type: "button",
				onClick: t,
				className: fr.retry,
				children: r
			})
		]
	});
}
function hr({ label: e }) {
	return /* @__PURE__ */ p("div", {
		className: fr.state,
		children: /* @__PURE__ */ p("p", {
			className: fr.hint,
			children: e
		})
	});
}
//#endregion
//#region src/PDFViewer/utils/worker.js
var gr = !1, _r = "/.vite/deps/", vr = "/@armsolusi/pdf-viewer/dist/", yr = "pdf.worker.min.js";
function br(e) {
	let t = `${_r}${yr}`;
	return e?.includes(t) ? e.replace(t, `${vr}${yr}`) : e;
}
var xr = br(M);
function Sr({ workerSrc: e, workerPort: t } = {}) {
	if (t) {
		D.GlobalWorkerOptions.workerPort !== t && (D.GlobalWorkerOptions.workerPort = t);
		return;
	}
	if (e) {
		D.GlobalWorkerOptions.workerSrc !== e && (D.GlobalWorkerOptions.workerSrc = e);
		return;
	}
	if (!(D.GlobalWorkerOptions.workerSrc || D.GlobalWorkerOptions.workerPort)) {
		if (xr) {
			D.GlobalWorkerOptions.workerSrc = xr;
			return;
		}
		gr || (gr = !0, console.warn("[@armsolusi/pdf-viewer] The bundled pdf.js worker could not be resolved, so the document will fail to load. This should not happen; please report it. As a workaround, pass a worker URL yourself:\n\n  import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'   // Vite\n  <PDFViewer src={url} config={{ workerSrc }} />"));
	}
}
function Cr(e) {
	let t = e?.message ?? "";
	return /fake worker|worker/i.test(t) ? `${t}\n\nThe pdf.js worker shipped with @armsolusi/pdf-viewer could not be loaded. Open that URL directly and check two things:

  1. Does it return the file, or a 404? If it 404s and you are on the Vite dev server, add optimizeDeps: { exclude: ['@armsolusi/pdf-viewer'] } to vite.config.js.
  2. What Content-Type does it come back with? It must be a JavaScript type. Servers that answer application/octet-stream — nginx does this for extensions it does not recognise — make the browser refuse to run it.

Failing both, serve a copy yourself and pass it as config.workerSrc.` : t;
}
//#endregion
//#region src/PDFViewer/utils/source.js
async function wr(e) {
	if (!e) throw Error("No PDF source provided");
	if (typeof e == "string") {
		let t = await fetch(e);
		if (!t.ok) throw Error(`Failed to fetch PDF (${t.status} ${t.statusText})`);
		return new Uint8Array(await t.arrayBuffer());
	}
	if (e instanceof Uint8Array) return e;
	if (e instanceof ArrayBuffer) return new Uint8Array(e);
	if (typeof Blob < "u" && e instanceof Blob) return new Uint8Array(await e.arrayBuffer());
	if (ArrayBuffer.isView(e)) return new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
	throw Error("Unsupported PDF source: expected a URL string, File, Blob, ArrayBuffer or Uint8Array");
}
function Tr(e) {
	return e.slice();
}
function Er(e) {
	return e;
}
var Dr = 32, Or = {
	status: "idle",
	pdfDoc: null,
	pageSizes: [],
	sourceBytes: null,
	error: null,
	documentKey: null
}, kr = 1;
function Ar(e) {
	try {
		let t = e?.destroy?.();
		t && typeof t.catch == "function" && t.catch(() => {});
	} catch {}
}
var jr = {
	LOADED: "cache/loaded",
	FAILED: "cache/failed",
	TOUCHED: "cache/touched",
	EVICTED: "cache/evicted"
}, Mr = {
	documents: /* @__PURE__ */ new Map(),
	failure: null
};
function Nr(e, t) {
	switch (t.type) {
		case jr.TOUCHED: {
			let n = e.documents.get(t.key);
			if (!n) return e;
			let r = new Map(e.documents);
			return r.delete(t.key), r.set(t.key, n), {
				...e,
				documents: r
			};
		}
		case jr.LOADED: {
			let n = new Map(e.documents);
			n.delete(t.key), n.set(t.key, t.entry);
			let r = [];
			for (let e of n.keys()) {
				if (n.size - r.length <= Math.max(1, t.limit)) break;
				r.push(e);
			}
			for (let e of r) n.delete(e);
			return {
				documents: n,
				failure: e.failure?.key === t.key ? null : e.failure,
				evicted: r.map((t) => e.documents.get(t)).filter(Boolean)
			};
		}
		case jr.FAILED: return {
			...e,
			failure: {
				key: t.key,
				error: t.error
			},
			evicted: void 0
		};
		case jr.EVICTED: {
			if (!e.documents.has(t.key)) return e;
			let n = new Map(e.documents);
			return n.delete(t.key), {
				...e,
				documents: n,
				evicted: void 0
			};
		}
		default: return e;
	}
}
function Pr(e, { workerSrc: t, workerPort: n, cacheSize: i = 3, onLoadError: o } = {}) {
	let [u, d] = c(Nr, Mr), [f, p] = c((e) => e + 1, 0), m = N(o), h = e ? Er(e) : null, g = h === null ? null : u.documents.get(h), _ = h !== null && u.failure?.key === h ? u.failure.error : null, v = N(u.documents), y = l(null);
	a(() => {
		if (n) return;
		Sr({
			workerSrc: t,
			workerPort: n
		});
		let e = new D.PDFWorker();
		return e.promise?.catch(() => {}), y.current = e, () => {
			y.current = null, e.destroy();
		};
	}, [t, n]), a(() => () => {
		for (let e of v.current.values()) Ar(e.pdfDoc);
	}, [v]);
	let b = r(() => {
		h !== null && d({
			type: jr.EVICTED,
			key: h
		}), p();
	}, [h]);
	a(() => {
		if (u.evicted?.length) for (let e of u.evicted) Ar(e.pdfDoc);
	}, [u.evicted]), a(() => {
		if (!e || h === null) return;
		if (u.documents.has(h)) {
			d({
				type: jr.TOUCHED,
				key: h
			});
			return;
		}
		Sr({
			workerSrc: t,
			workerPort: n
		});
		let r = !1, a = null, o = !1;
		return (async () => {
			let t = null;
			try {
				let n = await wr(e);
				if (r || (a = D.getDocument({
					data: Tr(n),
					...y.current ? { worker: y.current } : {}
				}), t = await a.promise, r)) return;
				let s = await Fr(t, () => r);
				if (r || !s) return;
				d({
					type: jr.LOADED,
					key: h,
					limit: i,
					entry: {
						pdfDoc: t,
						pageSizes: s,
						sourceBytes: n,
						scrollTop: 0,
						documentKey: `doc-${kr++}`
					}
				}), o = !0, t = null;
			} catch (e) {
				if (r || e?.name === "RenderingCancelledException") return;
				e.message = Cr(e), console.error("[@armsolusi/pdf-viewer] Failed to load document:", e), d({
					type: jr.FAILED,
					key: h,
					error: e
				}), m.current?.(e);
			} finally {
				t && Ar(t);
			}
		})(), () => {
			r = !0, o || Ar(a);
		};
	}, [
		h,
		e,
		t,
		n,
		i,
		f,
		m
	]);
	let x = r((e) => {
		let t = v.current.get(h);
		t && (t.scrollTop = e);
	}, [h, v]), S = r(() => v.current.get(h)?.scrollTop ?? 0, [h, v]);
	return s(() => {
		let t = {
			rememberScroll: x,
			getRememberedScroll: S
		};
		return e ? g ? {
			status: "ready",
			pdfDoc: g.pdfDoc,
			pageSizes: g.pageSizes,
			sourceBytes: g.sourceBytes,
			documentKey: g.documentKey,
			error: null,
			reload: b,
			...t
		} : _ ? {
			...Or,
			status: "error",
			error: _,
			reload: b,
			...t
		} : {
			...Or,
			status: "loading",
			reload: b,
			...t
		} : {
			...Or,
			reload: b,
			...t
		};
	}, [
		e,
		g,
		_,
		b,
		x,
		S
	]);
}
async function Fr(e, t) {
	let n = [];
	for (let r = 1; r <= e.numPages; r += Dr) {
		let i = Math.min(r + Dr - 1, e.numPages), a = [];
		for (let e = r; e <= i; e += 1) a.push(e);
		let o = await Promise.all(a.map(async (t) => {
			let n = await e.getPage(t), r = n.getViewport({ scale: 1 });
			return {
				width: r.width,
				height: r.height,
				rotate: V(n.rotate)
			};
		}));
		if (t()) return null;
		n.push(...o);
	}
	return n;
}
function Ir({ pageCount: e, container: t, containerRef: n }) {
	let [i, o] = u(0), [c, d] = u(() => /* @__PURE__ */ new Set([0])), f = l(0), p = l(/* @__PURE__ */ new Map()), m = l(null), h = r(() => {
		let e = n.current;
		if (!e) return;
		let t = e.getBoundingClientRect();
		if (!t.height) return;
		let r = null, i = null, a = 0;
		for (let [e, n] of p.current) {
			let o = n.getBoundingClientRect(), s = Math.min(o.bottom, t.bottom) - Math.max(o.top, t.top);
			if (s <= 0) continue;
			let c = s / t.height;
			(c > a || c === a && e > i) && (a = c, i = e), c >= .25 && (r === null || e > r) && (r = e);
		}
		let s = r ?? i;
		s === null || s === f.current || (f.current = s, o(s));
	}, [n]), g = r((e, t) => {
		let n = p.current, r = n.get(e);
		r && m.current && m.current.unobserve(r), t ? (n.set(e, t), m.current?.observe(t)) : n.delete(e), h();
	}, [h]);
	return a(() => {
		let e = n.current;
		if (!t || !e) return;
		let r = /* @__PURE__ */ new Set(), i = new IntersectionObserver((e) => {
			for (let t of e) {
				let e = Number.parseInt(t.target.dataset.pageIndex, 10);
				Number.isNaN(e) || (t.isIntersecting ? r.add(e) : r.delete(e));
			}
			d(new Set(r)), h();
		}, {
			root: e,
			threshold: 0
		});
		m.current = i;
		for (let e of p.current.values()) i.observe(e);
		let a = 0, o = () => {
			a ||= requestAnimationFrame(() => {
				a = 0, h();
			});
		};
		return t.addEventListener("scroll", o, { passive: !0 }), h(), () => {
			t.removeEventListener("scroll", o), a && cancelAnimationFrame(a), i.disconnect(), m.current = null;
		};
	}, [
		t,
		n,
		e,
		h
	]), {
		activePageIndex: i,
		activePageRef: f,
		renderWindow: s(() => {
			if (e === 0) return /* @__PURE__ */ new Set();
			if (c.size === 0) return /* @__PURE__ */ new Set([0]);
			let t = [...c], n = Math.max(0, Math.min(...t) - 2), r = Math.min(e - 1, Math.max(...t) + 2), i = /* @__PURE__ */ new Set();
			for (let e = n; e <= r; e += 1) i.add(e);
			return i;
		}, [c, e]),
		registerPage: g,
		scrollToPage: r((t) => {
			let r = Math.max(0, Math.min(e - 1, t)), i = p.current.get(r), a = n.current;
			if (!i || !a) return;
			let s = i.getBoundingClientRect().top, c = a.getBoundingClientRect().top;
			a.scrollTop += s - c - 16, f.current = r, o(r);
		}, [e, n])
	};
}
//#endregion
//#region src/PDFViewer/hooks/usePinchZoom.js
var Lr = 24, Rr = (e, t) => Math.hypot(e.x - t.x, e.y - t.y), zr = (e, t) => ({
	x: (e.x + t.x) / 2,
	y: (e.y + t.y) / 2
});
function Br({ container: e, containerRef: t, setScale: n, anchorAtPointer: r, cancelStrokeRef: i, isDraggingRef: o }) {
	let s = N(n), c = N(r), u = l(/* @__PURE__ */ new Map()), d = l(null);
	a(() => {
		if (!e) return;
		let n = t.current;
		if (!n) return;
		let r = u.current, a = () => {
			d.current = null;
		}, l = () => {
			if (r.size !== 2 || o?.current) return;
			i?.current?.();
			let [e, t] = [...r.values()], n = Rr(e, t);
			n < Lr || (d.current = {
				startDistance: n,
				startScale: null
			});
		}, f = (e) => {
			e.pointerType === "touch" && (r.set(e.pointerId, {
				x: e.clientX,
				y: e.clientY
			}), l());
		}, p = (e) => {
			if (e.pointerType !== "touch" || !r.has(e.pointerId)) return;
			r.set(e.pointerId, {
				x: e.clientX,
				y: e.clientY
			});
			let t = d.current;
			if (!t || r.size < 2) return;
			e.preventDefault();
			let [n, i] = [...r.values()], a = Rr(n, i);
			if (a < Lr) return;
			let o = zr(n, i), l = document.elementFromPoint(o.x, o.y);
			l && c.current?.(o.x, o.y, l);
			let u = a / t.startDistance;
			s.current?.((e) => (t.startScale === null && (t.startScale = e), t.startScale * u));
		}, m = (e) => {
			e.pointerType === "touch" && (r.delete(e.pointerId), r.size < 2 && a());
		};
		return n.addEventListener("pointerdown", f, { passive: !0 }), n.addEventListener("pointermove", p, { passive: !1 }), n.addEventListener("pointerup", m, { passive: !0 }), n.addEventListener("pointercancel", m, { passive: !0 }), n.addEventListener("pointerleave", m, { passive: !0 }), () => {
			n.removeEventListener("pointerdown", f), n.removeEventListener("pointermove", p), n.removeEventListener("pointerup", m), n.removeEventListener("pointercancel", m), n.removeEventListener("pointerleave", m), r.clear(), a();
		};
	}, [
		e,
		t,
		s,
		c,
		i,
		o
	]);
}
//#endregion
//#region src/PDFViewer/hooks/useKeyboardShortcuts.js
function Vr(e) {
	let t = e?.tagName;
	return t === "INPUT" || t === "TEXTAREA" || e?.isContentEditable === !0;
}
function Hr(e) {
	let t = N(e);
	a(() => {
		let e = (e) => {
			let n = t.current;
			if (e.ctrlKey || e.metaKey) switch (e.key) {
				case "=":
				case "+":
					e.preventDefault(), n.onZoomIn?.();
					return;
				case "-":
					e.preventDefault(), n.onZoomOut?.();
					return;
				case "0":
					e.preventDefault(), n.onZoomReset?.();
					return;
				case "z":
					if (Vr(e.target)) return;
					e.preventDefault(), e.shiftKey ? n.onRedo?.() : n.onUndo?.();
					return;
				case "y":
					if (Vr(e.target)) return;
					e.preventDefault(), n.onRedo?.();
					return;
				case "d":
					if (Vr(e.target)) return;
					n.onDuplicate?.() && e.preventDefault();
					return;
				case "c":
					if (Vr(e.target) || !window.getSelection()?.isCollapsed) return;
					n.onCopy?.();
					return;
				case "v":
					if (Vr(e.target)) return;
					n.onPaste?.() && e.preventDefault();
					return;
				default: return;
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				if (Vr(e.target) || !n.onDelete?.()) return;
				e.preventDefault();
				return;
			}
			e.key === "Escape" && n.onEscape?.();
		};
		return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
	}, [t]);
}
//#endregion
//#region src/PDFViewer/hooks/useStampAssets.js
var Ur = "specimen", Wr = Object.freeze({
	SPECIMEN: "specimen",
	STAMP: "stamp"
}), Gr = Object.freeze({
	CONFIG: "config",
	UPLOAD: "upload"
});
function Kr({ specimenAsset: e, stampAssets: t }) {
	let [n, i] = u({}), o = l([]);
	a(() => {
		let e = o.current;
		return () => {
			for (let t of e) URL.revokeObjectURL(t);
			e.length = 0;
		};
	}, []);
	let c = s(() => qr(t, e), [t, e]), d = s(() => ({
		...c,
		...n
	}), [c, n]), f = r(async (e) => {
		if (!e) return null;
		let t = await e.arrayBuffer(), n = URL.createObjectURL(e);
		o.current.push(n);
		let r = ae("asset");
		return i((i) => ({
			...i,
			[r]: {
				id: r,
				kind: Wr.STAMP,
				source: Gr.UPLOAD,
				label: e.name,
				src: n,
				bytes: t,
				mimeType: e.type
			}
		})), r;
	}, []);
	return {
		assets: d,
		list: s(() => Object.entries(d).map(([e, t]) => ({
			id: e,
			kind: t.kind ?? Wr.STAMP,
			source: t.source ?? Gr.CONFIG,
			label: t.label ?? e,
			src: t.src
		})), [d]),
		addUploadedAsset: f
	};
}
function qr(e, t) {
	let n = {}, r = (e, t) => {
		!e || !t?.src || (n[e] = {
			...t,
			id: e,
			kind: t.kind === Wr.SPECIMEN ? Wr.SPECIMEN : Wr.STAMP,
			source: Gr.CONFIG,
			label: t.label ?? e
		});
	};
	if (Array.isArray(e)) for (let t of e) r(t?.id, t);
	else if (e && typeof e == "object") for (let [t, n] of Object.entries(e)) n && r(t, typeof n == "string" ? { src: n } : n);
	if (t) {
		let e = n[Ur];
		n[Ur] = e ? {
			...e,
			kind: Wr.SPECIMEN
		} : {
			id: Ur,
			kind: Wr.SPECIMEN,
			source: Gr.CONFIG,
			label: "Signature",
			src: t
		};
	}
	return n;
}
//#endregion
//#region src/PDFViewer/utils/viewerState.js
function Jr({ annotations: e = [], assets: t = {} } = {}) {
	let n = {
		specimen: 0,
		stamp: 0,
		image: 0,
		text: 0,
		ink: 0,
		total: 0
	};
	for (let r of e) switch (r?.type) {
		case W.IMAGE:
			n.image += 1, n.total += 1, t[r.assetId]?.kind === Wr.SPECIMEN ? n.specimen += 1 : n.stamp += 1;
			break;
		case W.TEXT:
			n.text += 1, n.total += 1;
			break;
		case W.INK:
			n.ink += 1, n.total += 1;
			break;
		default: break;
	}
	return {
		hasSpecimen: n.specimen > 0,
		hasAnnotation: n.ink > 0 || n.text > 0,
		counts: n
	};
}
function Yr(e, t) {
	if (e === t) return !0;
	if (!e || !t) return !1;
	let n = Object.keys(e);
	return n.length === Object.keys(t).length && n.every((n) => e[n] === t[n]);
}
//#endregion
//#region src/PDFViewer/viewer/createViewerStore.js
var Xr = Object.freeze({
	status: "idle",
	error: null,
	pageCount: 0,
	activePageIndex: 0,
	scale: 1,
	zoomMode: "auto",
	hasSpecimen: !1,
	hasAnnotation: !1,
	counts: Object.freeze({
		specimen: 0,
		stamp: 0,
		image: 0,
		text: 0,
		ink: 0,
		total: 0
	}),
	canUndo: !1,
	canRedo: !1,
	isDrawMode: !1,
	selectedId: null,
	showThumbnails: !1
});
function Zr(e, t) {
	if (Object.is(e, t)) return !0;
	if (!Qr(e) || !Qr(t)) return !1;
	let n = Object.keys(e);
	return n.length === Object.keys(t).length && n.every((n) => Object.is(e[n], t[n]));
}
var Qr = (e) => typeof e == "object" && !!e && !Array.isArray(e);
function $r(e = Xr) {
	let t = e, n = /* @__PURE__ */ new Set();
	return {
		getState: () => t,
		subscribe(e) {
			return n.add(e), () => n.delete(e);
		},
		setState(e) {
			if (!e || !Object.keys(e).some((n) => !Zr(t[n], e[n]))) return !1;
			t = {
				...t,
				...e
			};
			for (let e of [...n]) e();
			return !0;
		}
	};
}
//#endregion
//#region src/PDFViewer/viewer/usePdfViewer.js
var ei = Object.freeze([
	"reload",
	"getFlattenedPDF",
	"getAnnotations",
	"setAnnotations",
	"addTextStamp",
	"addImageStamp",
	"uploadStamp",
	"duplicateSelected",
	"deleteSelected",
	"undo",
	"redo",
	"zoomIn",
	"zoomOut",
	"setScale",
	"setZoomMode",
	"goToPage",
	"rotatePages",
	"setDrawMode",
	"setInk",
	"toggleThumbnails"
]);
function ti() {
	let [e] = u(ni);
	return e;
}
function ni() {
	let e = $r(), t = { current: null }, n = {
		__attach(e) {
			return t.current = e, () => {
				t.current === e && (t.current = null);
			};
		},
		__store: e,
		getState: e.getState,
		subscribe: e.subscribe
	};
	for (let e of ei) n[e] = (...n) => t.current?.[e]?.(...n);
	return n;
}
//#endregion
//#region src/PDFViewer/PDFViewerInner.jsx
var ri = 150, ii = /* @__PURE__ */ new Set();
function ai(e, t) {
	ii.has(e) || (ii.add(e), console.warn(`[@armsolusi/pdf-viewer] The stamp image for "${e}" failed to load: ${t}\nCheck the URL resolves from the browser. A path beginning with "/" is resolved against the origin, ignoring your bundler's base — under a base such as "/my-app/", use \`\${import.meta.env.BASE_URL}my-image.png\` instead of "/my-image.png".`));
}
function oi({ src: e, documentId: t, config: n = {}, viewerRef: i, viewer: c }) {
	let { specimenAsset: d, stampAssets: f, onSpecimenChange: h, onAnnotationsChange: g, onAnnotationsSnapshot: _, onDownload: v, onLoadError: y, canDownload: b = !0, allowMultipleStamps: x = !0, maxStamps: S = null, rotateExportedPages: C = !0, toolbar: w, renderToolbar: T, workerSrc: E, workerPort: ee, documentCacheSize: te } = n, [D, ne] = u(null), O = l(null), re = r((e) => {
		O.current = e, ne(e);
	}, []), [k, A] = u(!1), [j, ie] = u({}), { pdfDoc: M, pageSizes: P, sourceBytes: oe, status: F, error: I, reload: se, documentKey: ce, rememberScroll: le, getRememberedScroll: ue } = Pr(e, {
		workerSrc: E,
		workerPort: ee,
		cacheSize: te,
		onLoadError: y
	}), L = M?.numPages ?? 0, { activePageIndex: R, activePageRef: fe, renderWindow: pe, registerPage: me, scrollToPage: he } = Ir({
		pageCount: L,
		container: D,
		containerRef: O
	});
	a(() => {
		if (!D) return;
		let e = () => le(D.scrollTop);
		return D.addEventListener("scroll", e, { passive: !0 }), () => D.removeEventListener("scroll", e);
	}, [D, le]), a(() => {
		let e = O.current;
		!e || !M || (e.scrollTop = ue());
	}, [
		M,
		D,
		ue
	]);
	let z = _t({
		pageSizes: s(() => P.map((e, t) => _e(e, j[t] ?? 0)), [P, j]),
		container: D,
		containerRef: O
	}), B = rt(), ge = lt();
	Br({
		container: D,
		containerRef: O,
		setScale: z.setScale,
		anchorAtPointer: z.anchorAtPointer,
		cancelStrokeRef: B.cancelStrokeRef,
		isDraggingRef: B.isDraggingRef
	});
	let H = $e(), { annotations: ve, canUndo: ye, canRedo: be } = Qe(), { assets: U, list: xe, addUploadedAsset: W } = Kr({
		specimenAsset: d,
		stampAssets: f
	}), { hasSpecimen: G, hasAnnotation: Se, counts: K } = s(() => Jr({
		annotations: Me(ve),
		assets: U
	}), [ve, U]), q = s(() => (xe.find((e) => e.kind === Wr.SPECIMEN) ?? xe[0])?.id, [xe]), Te = s(() => ({
		pdfDoc: M,
		documentKey: ce,
		pageSizes: P,
		pageRotations: j,
		status: F,
		error: I,
		scale: z.scale,
		setScrollContainer: re,
		stampAssets: U
	}), [
		M,
		ce,
		P,
		j,
		F,
		I,
		z.scale,
		U,
		re
	]), Ee = r((e, t = "page") => {
		ie((n) => {
			let r = { ...n }, i = t === "all" ? Array.from({ length: L }, (e, t) => t) : [fe.current];
			for (let t of i) r[t] = V((r[t] ?? 0) + e);
			return r;
		});
	}, [L, fe]), De = N(h), Oe = N(g), ke = N(_), Ae = l(null), je = l(null);
	a(() => {
		Ae.current !== G && (Ae.current = G, De.current?.(G)), Yr(je.current, K) || (je.current = K, Oe.current?.(K));
	}, [
		G,
		K,
		De,
		Oe
	]), a(() => {
		let e = ke.current;
		e && e(Me(ve), { documentId: t });
	}, [
		ve,
		t,
		ke
	]);
	let Ne = r(async (e) => {
		if (!M || !x && K.image >= 1 || x && S !== null && K.image >= S) return null;
		let t = e ?? q, n = t ? U[t] : null;
		if (!n?.src) return null;
		let r = 60, i = new Image();
		i.src = n.src, await new Promise((e) => {
			i.onload = () => e(!0), i.onerror = () => e(!1);
		}) || ai(t, n.src), i.width && i.height && (r = ri * (i.height / i.width));
		let a = Ce({
			assetId: t,
			pageIndex: fe.current,
			width: ri,
			height: r
		});
		return H.add(a), B.setActiveId(a.id), a.id;
	}, [
		M,
		x,
		S,
		K.image,
		U,
		q,
		H,
		fe,
		B
	]), J = r(async (e) => {
		let t = await W(e);
		t && await Ne(t);
	}, [W, Ne]), Pe = r(({ text: e = "", fontSize: t = 16, color: n = "#000000", fontFamily: r = "Helvetica" } = {}) => {
		let i = we({
			pageIndex: fe.current,
			text: e,
			fontSize: t,
			color: n,
			fontFamily: r
		});
		return H.add(i), B.setActiveId(i.id), i.id;
	}, [
		H,
		fe,
		B
	]), Fe = l(null), Ie = r((e) => {
		let t = e ?? B.activeIdRef.current;
		if (!t) return !1;
		let n = H.getSnapshot().byId[t];
		return H.duplicate(t, void 0, n ? P[n.pageIndex] : void 0), !0;
	}, [
		H,
		B,
		P
	]), Le = r(() => {
		let e = B.activeIdRef.current;
		if (!e) return !1;
		let t = H.getSnapshot().byId[e];
		return t ? (Fe.current = t, !0) : !1;
	}, [H, B]), Re = r(() => {
		let e = Fe.current;
		if (!e) return !1;
		let t = fe.current, n = 16, r = 16;
		if (!Array.isArray(e.points)) {
			let i = de({
				x: e.x + 16,
				y: e.y + 16,
				width: e.width,
				height: e.height
			}, e.rotation ?? 0, P[t]);
			n = i.x - e.x, r = i.y - e.y;
		}
		let i = {
			...e,
			id: void 0,
			pageIndex: t,
			x: e.x + n,
			y: e.y + r
		};
		Array.isArray(e.points) && (i.points = e.points.map((e) => ({
			x: e.x + n,
			y: e.y + r
		})));
		let a = {
			...i,
			id: ae(e.type)
		};
		return H.add(a), B.setActiveId(a.id), !0;
	}, [
		H,
		fe,
		B,
		P
	]), ze = r(() => {
		let e = B.activeIdRef.current;
		return e ? (H.remove(e), B.setActiveId(null), !0) : !1;
	}, [H, B]);
	Hr({
		onZoomIn: () => z.setScale((e) => e * 1.1),
		onZoomOut: () => z.setScale((e) => e * .9),
		onZoomReset: () => z.setZoomMode("auto"),
		onUndo: H.undo,
		onRedo: H.redo,
		onDelete: ze,
		onDuplicate: Ie,
		onCopy: Le,
		onPaste: Re,
		onEscape: () => B.setActiveId(null)
	});
	let Y = s(() => ({
		reload: se,
		getAnnotations: () => Me(H.getSnapshot()),
		setAnnotations: (e) => H.replaceAll(e),
		getFlattenedPDF: async () => {
			if (!oe) throw Error("No document loaded");
			return In(oe, Me(H.getSnapshot()), U, {
				pageRotations: j,
				rotateExportedPages: C
			});
		},
		addTextStamp: Pe,
		addImageStamp: Ne,
		uploadStamp: J,
		duplicateSelected: Ie,
		deleteSelected: ze,
		undo: H.undo,
		redo: H.redo,
		zoomIn: () => z.setScale((e) => e * 1.1),
		zoomOut: () => z.setScale((e) => e * .9),
		setScale: z.setScale,
		setZoomMode: z.setZoomMode,
		goToPage: he,
		rotatePages: Ee,
		setDrawMode: B.setIsDrawMode,
		setInk: ({ color: e, thickness: t, opacity: n } = {}) => {
			e !== void 0 && B.setInkColor(e), t !== void 0 && B.setInkThickness(t), n !== void 0 && B.setInkOpacity(n);
		},
		toggleThumbnails: () => A((e) => !e)
	}), [
		se,
		H,
		oe,
		U,
		j,
		C,
		Pe,
		Ne,
		J,
		Ie,
		ze,
		z,
		he,
		Ee,
		B
	]);
	o(i, () => ({
		addTextStamp: Y.addTextStamp,
		addImageStamp: Y.addImageStamp,
		undo: Y.undo,
		redo: Y.redo,
		getAnnotations: Y.getAnnotations,
		setAnnotations: Y.setAnnotations,
		getFlattenedPDF: Y.getFlattenedPDF
	}), [Y]);
	let Be = ti(), Ve = c ?? Be;
	a(() => Ve.__attach(Y), [Ve, Y]);
	let He = s(() => ({
		status: F,
		error: I,
		pageCount: L,
		activePageIndex: R,
		scale: z.scale,
		zoomMode: z.zoomMode,
		hasSpecimen: G,
		hasAnnotation: Se,
		counts: K,
		canUndo: ye,
		canRedo: be,
		isDrawMode: B.isDrawMode,
		selectedId: B.activeId,
		showThumbnails: k
	}), [
		F,
		I,
		L,
		R,
		z.scale,
		z.zoomMode,
		G,
		Se,
		K,
		ye,
		be,
		B.isDrawMode,
		B.activeId,
		k
	]);
	a(() => {
		Ve.__store.setState(He);
	}, [Ve, He]);
	let Ue = s(() => xe.filter((e) => e.source !== Gr.UPLOAD), [xe]), We = s(() => xe.filter((e) => e.source === Gr.UPLOAD), [xe]), Ge = s(() => ({
		...He,
		api: Y,
		configuredAssets: Ue,
		uploadedAssets: We,
		onDownload: v,
		canDownload: b
	}), [
		He,
		Y,
		Ue,
		We,
		v,
		b
	]);
	return /* @__PURE__ */ p(Qn, {
		value: Te,
		children: /* @__PURE__ */ m("div", {
			className: `rpvs-viewer ${ut.shell}`,
			children: [T ? T({
				viewer: Ve,
				state: He,
				labels: ge
			}) : w !== !1 && /* @__PURE__ */ p(Zt, {
				toolbar: w,
				ctx: Ge
			}), /* @__PURE__ */ m("div", {
				className: ut.body,
				children: [
					F === "ready" && k && /* @__PURE__ */ p(lr, {
						activePageIndex: R,
						onGoToPage: he
					}),
					F === "error" && /* @__PURE__ */ p(mr, {
						error: I,
						onRetry: se,
						label: ge.loadFailed,
						retryLabel: ge.retry
					}),
					F === "loading" && /* @__PURE__ */ p(pr, { label: ge.loading }),
					F === "idle" && /* @__PURE__ */ p(hr, { label: ge.noDocument }),
					F === "ready" && /* @__PURE__ */ p(ar, {
						registerPage: me,
						renderWindow: pe
					})
				]
			})]
		})
	});
}
//#endregion
//#region src/PDFViewer/index.jsx
var si = t(function({ src: e, documentId: t, config: n, viewer: r }, i) {
	return /* @__PURE__ */ p(ct, {
		labels: n?.labels,
		children: /* @__PURE__ */ p(Xe, {
			documentId: t,
			initialAnnotations: n?.initialAnnotations,
			children: /* @__PURE__ */ p(nt, { children: /* @__PURE__ */ p(oi, {
				src: e,
				documentId: t,
				config: n ?? {},
				viewerRef: i,
				viewer: r
			}) })
		})
	});
}), ci = (e) => e;
function li(e, t = ci) {
	let n = r((t) => e?.subscribe(t) ?? ui, [e]), i = r(() => t(e?.getState() ?? Xr), [e, t]);
	return d(n, i, i);
}
function ui() {}
//#endregion
//#region src/PDFViewer/utils/flattenPdf.js
async function di({ src: e, annotations: t = [], stampAssets: n, specimenAsset: r, pageRotations: i = {}, rotateExportedPages: a = !0 } = {}) {
	if (!e) throw Error("flattenPdf: `src` is required");
	return In(await wr(e), t, qr(n, r), {
		pageRotations: i,
		rotateExportedPages: a
	});
}
//#endregion
export { W as ANNOTATION_TYPES, it as DEFAULT_LABELS, Gt as DEFAULT_TOOLBAR_ACTIONS, si as PDFViewer, di as flattenPdf, ti as usePdfViewer, li as useViewerState };
