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
import D from "@tabler/icons-react/dist/esm/icons/IconPhotoPlus.mjs";
import * as O from "pdfjs-dist";
import te from "@tabler/icons-react/dist/esm/icons/IconTrash.mjs";
import ne from "@tabler/icons-react/dist/esm/icons/IconCopy.mjs";
import k from "@tabler/icons-react/dist/esm/icons/IconDroplet.mjs";
import { PDFDocument as A, StandardFonts as j, degrees as M, rgb as re } from "pdf-lib";
import { resolvedWorkerUrl as N } from "./workerUrl.js";
//#region src/PDFViewer/hooks/useLatestRef.js
function P(e) {
	let t = l(e);
	return a(() => {
		t.current = e;
	}, [e]), t;
}
//#endregion
//#region src/PDFViewer/utils/id.js
var ie = 0;
function F(e = "ann") {
	return ie += 1, typeof crypto < "u" && typeof crypto.randomUUID == "function" ? `${e}-${crypto.randomUUID()}` : `${e}-${Date.now().toString(36)}-${ie.toString(36)}`;
}
var ae = Object.freeze({
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
}), oe = (e) => e * Math.PI / 180;
function se({ x: e, y: t }, n) {
	let r = B(n ?? 0);
	if (!r) return {
		x: e,
		y: t
	};
	let i = oe(r), a = Math.cos(i), o = Math.sin(i);
	return {
		x: e * a - t * o,
		y: e * o + t * a
	};
}
function I(e, t) {
	return se(e, -t);
}
function L({ x: e, y: t, width: n, height: r }) {
	return {
		x: e + n / 2,
		y: t + r / 2
	};
}
function ce(e) {
	let t = ae[e];
	return t ? {
		signX: t.x === .5 ? 0 : t.x === 1 ? 1 : -1,
		signY: t.y === .5 ? 0 : t.y === 1 ? 1 : -1
	} : {
		signX: 0,
		signY: 0
	};
}
function le({ rect: e, rotation: t = 0, handle: n, delta: r, lockAspectRatio: i = !1, minSize: a = 16 }) {
	let { signX: o, signY: s } = ce(n);
	if (o === 0 && s === 0) return e;
	let { width: c, height: l } = e, u = o === 0 ? c : Math.max(a, c + o * r.x), d = s === 0 ? l : Math.max(a, l + s * r.y);
	if (i && c > 0 && l > 0) {
		let e = c / l;
		o !== 0 && s !== 0 ? Math.abs(u / c - 1) >= Math.abs(d / l - 1) ? d = u / e : u = d * e : o === 0 ? u = d * e : d = u / e, u < a && (u = a, d = u / e), d < a && (d = a, u = d * e);
	}
	let f = se({
		x: o * (u - c) / 2,
		y: s * (d - l) / 2
	}, t), p = L(e);
	return {
		x: p.x + f.x - u / 2,
		y: p.y + f.y - d / 2,
		width: u,
		height: d
	};
}
function R(e, t) {
	return {
		...e,
		x: e.x + t.x,
		y: e.y + t.y
	};
}
function z(e, t) {
	return (Math.atan2(t.x - e.x, e.y - t.y) * 180 / Math.PI + 360) % 360;
}
function ue(e, t = 15) {
	return B(t ? Math.round(e / t) * t : e);
}
function B(e) {
	return (e % 360 + 360) % 360;
}
function de(e, t, n = 0) {
	let r = L(e), i = se(t, n);
	return {
		x: r.x + i.x,
		y: r.y + i.y
	};
}
function fe(e, t, n = 0) {
	return n ? e.map((e) => {
		let r = se({
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
function pe(e, t = 0) {
	let n = V(t), r = e?.width ?? 0, i = e?.height ?? 0;
	return n === 90 || n === 270 ? {
		width: i,
		height: r
	} : {
		width: r,
		height: i
	};
}
function me({ x: e, y: t, width: n, height: r }, i) {
	return {
		x: e * i,
		y: t * i,
		width: n * i,
		height: r * i
	};
}
function H({ x: e, y: t }, { pageWidth: n, pageHeight: r, rotate: i = 0 }) {
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
function he(e, t, n = 0) {
	let { width: r, height: i } = e, a = B(n), o = H(de(e, {
		x: -r / 2,
		y: i / 2
	}, a), t);
	return {
		x: o.x,
		y: o.y,
		rotate: B(V(t.rotate) - a)
	};
}
function ge({ pageWidth: e, pageHeight: t, rotate: n = 0 }) {
	let r = V(n), i = H({
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
function _e(e, t) {
	return Math.max(0, Math.min(e.right, t.right) - Math.max(e.left, t.left)) * Math.max(0, Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top));
}
//#endregion
//#region src/PDFViewer/reducers/annotationReducer.js
var W = Object.freeze({
	IMAGE: "image",
	TEXT: "text",
	INK: "ink"
}), ve = Object.freeze({
	byId: {},
	order: []
}), ye = {
	pageIndex: 0,
	x: 50,
	y: 50,
	rotation: 0,
	opacity: 1
};
function be({ assetId: e = "default", width: t = 150, height: n = 60, ...r } = {}) {
	return {
		...ye,
		...r,
		id: r.id ?? F(W.IMAGE),
		type: W.IMAGE,
		assetId: e,
		width: t,
		height: n
	};
}
function xe({ text: e = "", fontSize: t = 16, color: n = "#000000", fontFamily: r = "Helvetica", width: i = 250, height: a = 50, ...o } = {}) {
	return {
		...ye,
		...o,
		id: o.id ?? F(W.TEXT),
		type: W.TEXT,
		text: e,
		fontSize: t,
		color: n,
		fontFamily: r,
		width: i,
		height: a
	};
}
function Se({ points: e = [], color: t = "#000000", strokeWidth: n = 2, ...r } = {}) {
	let i = U(e);
	return {
		...ye,
		...r,
		id: r.id ?? F(W.INK),
		type: W.INK,
		points: e,
		color: t,
		strokeWidth: n,
		...i
	};
}
var G = Object.freeze({
	ADD: "annotation/add",
	UPDATE: "annotation/update",
	DELETE: "annotation/delete",
	DELETE_MANY: "annotation/deleteMany",
	DUPLICATE: "annotation/duplicate",
	BRING_TO_FRONT: "annotation/bringToFront",
	SEND_TO_BACK: "annotation/sendToBack",
	REPLACE_ALL: "annotation/replaceAll"
}), Ce = (e) => ({
	type: G.ADD,
	annotation: e
}), we = (e, t) => ({
	type: G.UPDATE,
	id: e,
	patch: t
}), Te = (e) => ({
	type: G.DELETE,
	id: e
}), Ee = (e, t) => ({
	type: G.DUPLICATE,
	id: e,
	offset: t
});
function De(e) {
	return e.type === W.INK ? {
		...e,
		...U(e.points)
	} : e;
}
function Oe(e = ve, t) {
	switch (t.type) {
		case G.ADD: {
			let n = De(t.annotation);
			return !n?.id || e.byId[n.id] ? e : {
				byId: {
					...e.byId,
					[n.id]: n
				},
				order: [...e.order, n.id]
			};
		}
		case G.UPDATE: {
			let n = e.byId[t.id];
			if (!n) return e;
			let r = De({
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
		case G.DELETE: {
			if (!e.byId[t.id]) return e;
			let n = { ...e.byId };
			return delete n[t.id], {
				byId: n,
				order: e.order.filter((e) => e !== t.id)
			};
		}
		case G.DELETE_MANY: {
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
		case G.DUPLICATE: {
			let n = e.byId[t.id];
			if (!n) return e;
			let r = t.offset ?? 12, i = {
				...n,
				id: F(n.type),
				x: n.x + r,
				y: n.y + r
			};
			return i.type === W.INK && (i.points = n.points.map((e) => ({
				x: e.x + r,
				y: e.y + r
			}))), {
				byId: {
					...e.byId,
					[i.id]: i
				},
				order: [...e.order, i.id]
			};
		}
		case G.BRING_TO_FRONT: return !e.byId[t.id] || e.order.at(-1) === t.id ? e : {
			...e,
			order: [...e.order.filter((e) => e !== t.id), t.id]
		};
		case G.SEND_TO_BACK: return !e.byId[t.id] || e.order[0] === t.id ? e : {
			...e,
			order: [t.id, ...e.order.filter((e) => e !== t.id)]
		};
		case G.REPLACE_ALL: return t.state ?? ve;
		default: return e;
	}
}
function ke(e) {
	return e.order.map((t) => e.byId[t]);
}
function Ae(e, t) {
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
var K = Object.freeze({
	UNDO: "history/undo",
	REDO: "history/redo",
	BEGIN_TRANSACTION: "history/beginTransaction",
	COMMIT_TRANSACTION: "history/commitTransaction",
	CANCEL_TRANSACTION: "history/cancelTransaction",
	CLEAR: "history/clear"
}), je = () => ({ type: K.UNDO }), Me = () => ({ type: K.REDO }), Ne = () => ({ type: K.BEGIN_TRANSACTION }), q = () => ({ type: K.COMMIT_TRANSACTION }), Pe = () => ({ type: K.CANCEL_TRANSACTION });
function Fe(e) {
	return {
		past: [],
		present: e,
		future: [],
		txDepth: 0,
		txBase: null
	};
}
var Ie = (e) => e.past.length > 0, Le = (e) => e.future.length > 0;
function Re(e, t, n) {
	let r = e.length >= n ? e.slice(e.length - n + 1) : e.slice();
	return r.push(t), r;
}
function ze(e, { limit: t = 100 } = {}) {
	return function(n, r) {
		let { past: i, present: a, future: o, txDepth: s, txBase: c } = n;
		switch (r.type) {
			case K.UNDO: return s > 0 || i.length === 0 ? n : {
				...n,
				past: i.slice(0, -1),
				present: i[i.length - 1],
				future: [a, ...o]
			};
			case K.REDO: return s > 0 || o.length === 0 ? n : {
				...n,
				past: Re(i, a, t),
				present: o[0],
				future: o.slice(1)
			};
			case K.BEGIN_TRANSACTION: return {
				...n,
				txDepth: s + 1,
				txBase: s === 0 ? a : c
			};
			case K.COMMIT_TRANSACTION: {
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
					past: Re(i, c, t),
					present: a,
					future: [],
					txDepth: 0,
					txBase: null
				};
			}
			case K.CANCEL_TRANSACTION: return s === 0 ? n : {
				...n,
				present: c,
				txDepth: 0,
				txBase: null
			};
			case K.CLEAR: return {
				...n,
				past: [],
				future: []
			};
			default: {
				let o = e(a, r);
				return o === a ? n : s > 0 ? {
					...n,
					present: o
				} : {
					past: Re(i, a, t),
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
var Be = e(null), Ve = e(null), He = ze(Oe);
function Ue({ children: e }) {
	let [t, n] = c(He, ve, Fe), r = P(t.present), i = s(() => ({
		add: (e) => n(Ce(e)),
		update: (e, t) => n(we(e, t)),
		remove: (e) => n(Te(e)),
		duplicate: (e, t) => n(Ee(e, t)),
		undo: () => n(je()),
		redo: () => n(Me()),
		beginGesture: () => n(Ne()),
		endGesture: () => n(q()),
		abortGesture: () => n(Pe()),
		getSnapshot: () => r.current
	}), [r]), a = s(() => ({
		annotations: t.present,
		canUndo: Ie(t),
		canRedo: Le(t)
	}), [t]);
	return /* @__PURE__ */ p(Ve.Provider, {
		value: i,
		children: /* @__PURE__ */ p(Be.Provider, {
			value: a,
			children: e
		})
	});
}
function We(e, t) {
	let n = i(e);
	if (!n) throw Error(`${t} must be used inside <PDFViewer>`);
	return n;
}
function Ge() {
	return We(Be, "useAnnotationState");
}
function Ke() {
	return We(Ve, "useAnnotationActions");
}
function qe(e) {
	let { annotations: t } = Ge();
	return s(() => Ae(t, e), [t, e]);
}
//#endregion
//#region src/PDFViewer/context/ToolContext.jsx
var Je = e(null);
function Ye({ children: e }) {
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
	return /* @__PURE__ */ p(Je.Provider, {
		value: b,
		children: e
	});
}
function Xe() {
	let e = i(Je);
	if (!e) throw Error("useTools must be used inside <PDFViewer>");
	return e;
}
//#endregion
//#region src/PDFViewer/labels.js
var Ze = Object.freeze({
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
function Qe(e) {
	if (!e || typeof e != "object") return Ze;
	let t = { ...Ze };
	for (let [n, r] of Object.entries(e)) typeof r == "string" && n in Ze && (t[n] = r);
	return t;
}
function $e(e, t) {
	return typeof e == "string" ? e.replace(/\{(\w+)\}/g, (e, n) => n in t ? String(t[n]) : e) : "";
}
//#endregion
//#region src/PDFViewer/context/LabelContext.jsx
var et = e(Ze);
function tt({ labels: e, children: t }) {
	let n = s(() => Qe(e), [e]);
	return /* @__PURE__ */ p(et.Provider, {
		value: n,
		children: t
	});
}
function J() {
	return i(et);
}
var nt = {
	shell: "_shell_ncnjo_1",
	body: "_body_ncnjo_23"
}, rt = 8;
function it() {
	let [e, t] = u("start");
	return [r((e) => {
		if (!e) return;
		let n = e.offsetParent;
		if (!n) return;
		let r = (e.closest(".rpvs-viewer") ?? document.documentElement).getBoundingClientRect(), i = n.getBoundingClientRect(), { width: a } = e.getBoundingClientRect(), o = i.left + a > r.right - rt, s = i.right - a >= r.left + rt;
		t(o && s ? "end" : "start");
	}, []), e];
}
var at = (e) => e === "end" ? "alignEnd" : "alignStart", ot = .1, st = (e) => Math.min(10, Math.max(ot, e));
function ct(e, t, n) {
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
function lt({ pageSizes: e, container: t, containerRef: n }) {
	let [i, o] = u(1), [s, c] = u("auto"), d = l(null), f = l(i), p = r((e) => {
		o((t) => st(typeof e == "function" ? e(t) : e)), c("custom");
	}, []), m = r(() => p((e) => e + .2), [p]), h = r(() => p((e) => e - .2), [p]);
	a(() => {
		if (s === "custom" || !e.length) return;
		let t = () => {
			let t = n.current;
			if (!t) return;
			let r = ct(s, e, {
				width: t.clientWidth,
				height: t.clientHeight
			});
			r && o(st(r));
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
var Y = {
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
}, ut = {
	nav: "_nav_361nw_1",
	input: "_input_361nw_19",
	total: "_total_361nw_51"
};
//#endregion
//#region src/PDFViewer/components/PageNavigation.jsx
function dt({ pageCount: e, activePageIndex: t, onGoToPage: n }) {
	let r = J(), [i, a] = u(""), [o, s] = u(!1), c = o ? i : String(t + 1);
	if (!e) return null;
	let l = () => {
		s(!1);
		let t = Number.parseInt(i, 10);
		Number.isNaN(t) || n(Math.max(1, Math.min(e, t)) - 1);
	}, d = t > 0, f = t < e - 1;
	return /* @__PURE__ */ m("div", {
		className: ut.nav,
		children: [
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: () => n(t - 1),
				disabled: !d,
				className: Y.iconButton,
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
				className: ut.input
			}),
			/* @__PURE__ */ m("span", {
				className: ut.total,
				children: ["/ ", e]
			}),
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: () => n(t + 1),
				disabled: !f,
				className: Y.iconButton,
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
var X = {
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
function ft({ icon: e, onPrimary: t, disabled: n = !1, label: r, title: i, menuLabel: o, items: s = [], onSelect: c, footer: d = null }) {
	let [h, g] = u(!1), v = l(null), [y, b] = it();
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
		className: X.wrap,
		children: [
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: t,
				disabled: n,
				className: `${Y.chipButton} ${x ? X.main : ""}`,
				title: i ?? r,
				"aria-label": r,
				children: e
			}),
			x && /* @__PURE__ */ p("button", {
				type: "button",
				onClick: () => g((e) => !e),
				className: `${Y.chipButton} ${X.caret}`,
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
				className: `${X.menu} ${Y[at(b)]}`,
				children: [s.map((e) => /* @__PURE__ */ m("button", {
					type: "button",
					onClick: () => {
						g(!1), c?.(e.id);
					},
					className: X.item,
					children: [e.src && /* @__PURE__ */ p("img", {
						src: e.src,
						alt: "",
						className: X.thumb
					}), /* @__PURE__ */ p("span", {
						className: X.itemLabel,
						children: e.label
					})]
				}, e.id)), d && /* @__PURE__ */ m(f, { children: [s.length > 0 && /* @__PURE__ */ p("div", { className: X.separator }), d] })]
			})
		]
	});
}
//#endregion
//#region src/PDFViewer/components/StampMenu.jsx
function pt({ assets: e, onAddStamp: t, disabled: n }) {
	let r = J();
	return /* @__PURE__ */ p(ft, {
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
function mt({ uploaded: e, onAddStamp: t, onUpload: n, disabled: r }) {
	let i = J(), a = l(null), o = () => a.current?.click();
	return /* @__PURE__ */ m(f, { children: [/* @__PURE__ */ p(ft, {
		icon: /* @__PURE__ */ p(D, {
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
			className: X.item,
			children: i.uploadImage
		}) : null
	}), /* @__PURE__ */ p("input", {
		ref: a,
		type: "file",
		accept: "image/png,image/jpeg",
		className: X.hiddenInput,
		onChange: (e) => {
			let t = e.target.files?.[0];
			e.target.value = "", t && n(t);
		}
	})] });
}
var Z = {
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
}, ht = [
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
], gt = .2;
function _t({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: e.api.toggleThumbnails,
		"aria-pressed": e.showThumbnails,
		className: Y.iconButton,
		title: e.labels.toggleThumbnails,
		"aria-label": e.labels.toggleThumbnails,
		children: /* @__PURE__ */ p(C, {
			size: 16,
			stroke: 2
		})
	});
}
function vt({ ctx: e }) {
	return /* @__PURE__ */ p("div", {
		className: Z.hideOnNarrow,
		children: /* @__PURE__ */ p(dt, {
			pageCount: e.pageCount,
			activePageIndex: e.activePageIndex,
			onGoToPage: e.api.goToPage
		})
	});
}
function yt({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: () => e.api.setScale((e) => Math.max(ot, e - gt)),
		className: Y.iconButton,
		title: e.labels.zoomOut,
		"aria-label": e.labels.zoomOut,
		children: /* @__PURE__ */ p(h, {
			size: 16,
			stroke: 2
		})
	});
}
function bt({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: () => e.api.setScale((e) => Math.min(10, e + gt)),
		className: Y.iconButton,
		title: e.labels.zoomIn,
		"aria-label": e.labels.zoomIn,
		children: /* @__PURE__ */ p(g, {
			size: 16,
			stroke: 2
		})
	});
}
function xt({ ctx: e }) {
	let { scale: t, zoomMode: n, labels: r, api: i } = e, a = n === "custom" && !ht.includes(t);
	return /* @__PURE__ */ m("div", {
		className: Z.zoomSelectWrap,
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
			className: Z.zoomSelect,
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
				ht.map((e) => /* @__PURE__ */ m("option", {
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
			className: Z.zoomCaret,
			children: /* @__PURE__ */ p(_, {
				size: 14,
				stroke: 2
			})
		})]
	});
}
function St({ ctx: e }) {
	return /* @__PURE__ */ m("div", {
		className: Z.inset,
		children: [
			/* @__PURE__ */ p(yt, { ctx: e }),
			/* @__PURE__ */ p(xt, { ctx: e }),
			/* @__PURE__ */ p(bt, { ctx: e })
		]
	});
}
function Ct({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: (t) => e.api.rotatePages(-90, t.shiftKey ? "all" : "page"),
		className: Y.iconButton,
		title: e.labels.rotateLeft,
		"aria-label": e.labels.rotateLeft,
		children: /* @__PURE__ */ p(w, {
			size: 16,
			stroke: 2
		})
	});
}
function wt({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: (t) => e.api.rotatePages(90, t.shiftKey ? "all" : "page"),
		className: Y.iconButton,
		title: e.labels.rotateRight,
		"aria-label": e.labels.rotateRight,
		children: /* @__PURE__ */ p(T, {
			size: 16,
			stroke: 2
		})
	});
}
function Tt({ ctx: e }) {
	return /* @__PURE__ */ m("div", {
		className: `${Z.group} ${Z.hideOnMedium}`,
		children: [/* @__PURE__ */ p(Ct, { ctx: e }), /* @__PURE__ */ p(wt, { ctx: e })]
	});
}
function Et({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: e.api.undo,
		disabled: !e.canUndo,
		className: Y.iconButton,
		title: e.labels.undo,
		"aria-label": e.labels.undo,
		children: /* @__PURE__ */ p(v, {
			size: 16,
			stroke: 2
		})
	});
}
function Dt({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: e.api.redo,
		disabled: !e.canRedo,
		className: Y.iconButton,
		title: e.labels.redo,
		"aria-label": e.labels.redo,
		children: /* @__PURE__ */ p(y, {
			size: 16,
			stroke: 2
		})
	});
}
function Ot({ ctx: e }) {
	return /* @__PURE__ */ m(f, { children: [/* @__PURE__ */ p(Et, { ctx: e }), /* @__PURE__ */ p(Dt, { ctx: e })] });
}
function kt({ ctx: e }) {
	let { isDrawMode: t, setIsDrawMode: n, inkColor: r, setInkColor: i, inkThickness: a, setInkThickness: o, inkOpacity: s, setInkOpacity: c } = Xe(), [l, d] = u(!1), [f, h] = it(), { labels: g } = e;
	return /* @__PURE__ */ m("div", {
		className: Z.split,
		children: [
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: () => n(!t),
				"aria-pressed": t,
				className: `${Y.chipButton} ${Z.splitMain} ${t ? Y.active : ""}`,
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
				className: `${Y.chipButton} ${Z.splitCaret} ${t ? Y.active : ""}`,
				"aria-label": g.drawSettings,
				title: g.drawSettings,
				children: /* @__PURE__ */ p(_, {
					size: 14,
					stroke: 2
				})
			}),
			l && /* @__PURE__ */ m("div", {
				ref: f,
				className: `${Z.drawPanel} ${Y[at(h)]}`,
				children: [
					/* @__PURE__ */ m("div", {
						className: Z.drawPanelSection,
						children: [/* @__PURE__ */ p("label", {
							className: Y.fieldLabel,
							htmlFor: "rpvs-ink-color",
							children: /* @__PURE__ */ p("span", { children: g.colour })
						}), /* @__PURE__ */ m("div", {
							className: Z.colorRow,
							children: [/* @__PURE__ */ p("input", {
								id: "rpvs-ink-color",
								type: "color",
								value: r,
								onChange: (e) => i(e.target.value),
								className: Z.colorSwatch
							}), /* @__PURE__ */ p("span", {
								className: Z.colorValue,
								children: r
							})]
						})]
					}),
					/* @__PURE__ */ m("div", {
						className: Z.drawPanelSection,
						children: [/* @__PURE__ */ m("label", {
							className: Y.fieldLabel,
							children: [/* @__PURE__ */ p("span", { children: g.thickness }), /* @__PURE__ */ m("span", { children: [a, "px"] })]
						}), /* @__PURE__ */ p("input", {
							type: "range",
							min: "1",
							max: "15",
							value: a,
							onChange: (e) => o(Number.parseInt(e.target.value, 10)),
							className: Y.range,
							"aria-label": g.strokeThickness
						})]
					}),
					/* @__PURE__ */ m("div", {
						className: Z.drawPanelSection,
						children: [/* @__PURE__ */ m("label", {
							className: Y.fieldLabel,
							children: [/* @__PURE__ */ p("span", { children: g.opacity }), /* @__PURE__ */ m("span", { children: [Math.round(s * 100), "%"] })]
						}), /* @__PURE__ */ p("input", {
							type: "range",
							min: "10",
							max: "100",
							value: s * 100,
							onChange: (e) => c(Number.parseInt(e.target.value, 10) / 100),
							className: Y.range,
							"aria-label": g.strokeOpacity
						})]
					})
				]
			})
		]
	});
}
function At({ ctx: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: () => e.api.addTextStamp(),
		className: Y.chipButton,
		title: e.labels.addText,
		"aria-label": e.labels.addText,
		children: /* @__PURE__ */ p(x, {
			size: 16,
			stroke: 2
		})
	});
}
function jt({ ctx: e }) {
	return /* @__PURE__ */ p(pt, {
		assets: e.configuredAssets,
		onAddStamp: e.api.addImageStamp
	});
}
function Mt({ ctx: e }) {
	return /* @__PURE__ */ p(mt, {
		uploaded: e.uploadedAssets,
		onAddStamp: e.api.addImageStamp,
		onUpload: e.api.uploadStamp
	});
}
function Nt({ ctx: e }) {
	return e.onDownload ? /* @__PURE__ */ p("button", {
		type: "button",
		onClick: e.onDownload,
		disabled: !e.canDownload,
		className: Y.primaryButton,
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
var Pt = Object.freeze({
	thumbnails: {
		zone: "left",
		Component: _t
	},
	pageNav: {
		zone: "left",
		Component: vt
	},
	zoom: {
		zone: "center",
		Component: St
	},
	zoomOut: {
		zone: "center",
		Component: yt
	},
	zoomSelect: {
		zone: "center",
		Component: xt
	},
	zoomIn: {
		zone: "center",
		Component: bt
	},
	rotate: {
		zone: "center",
		Component: Tt
	},
	rotateLeft: {
		zone: "center",
		Component: Ct
	},
	rotateRight: {
		zone: "center",
		Component: wt
	},
	history: {
		zone: "right",
		Component: Ot
	},
	undo: {
		zone: "right",
		Component: Et
	},
	redo: {
		zone: "right",
		Component: Dt
	},
	draw: {
		zone: "right",
		Component: kt
	},
	addText: {
		zone: "right",
		Component: At
	},
	stamp: {
		zone: "right",
		Component: jt
	},
	image: {
		zone: "right",
		Component: Mt
	},
	download: {
		zone: "right",
		Component: Nt
	}
}), Ft = Object.freeze(["thumbnails", "pageNav"]), It = Object.freeze(["zoom", "rotate"]), Lt = Object.freeze([
	"history",
	"divider",
	"draw",
	"addText",
	"stamp",
	"image",
	"download"
]), Rt = Object.freeze(["divider", "spacer"]);
function zt(e = {}, { registry: t = Pt, onUnknown: n, onFixed: r } = {}) {
	let { displayActions: i, customToolbarActions: a } = e ?? {}, o = /* @__PURE__ */ new Map();
	for (let e of Array.isArray(a) ? a : []) e?.id && o.set(e.id, e);
	let s = Array.isArray(i) && i.length > 0 ? i : [...Lt, ...o.keys()], c = [], l = [], u = [];
	for (let e of s) {
		if (typeof e != "string") continue;
		if (Rt.includes(e)) {
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
		left: Bt(Ft, t),
		center: Bt(It, t),
		right: Vt(Ht(u))
	};
}
function Bt(e, t) {
	return e.filter((e) => t[e]).map((e) => ({
		id: e,
		key: e,
		kind: "builtin",
		Component: t[e].Component
	}));
}
function Vt(e) {
	return e.map((e, t) => ({
		...e,
		key: `${e.id}#${t}`
	}));
}
function Ht(e) {
	let t = (e) => Rt.includes(e.kind), n = [];
	for (let r of e) t(r) && (n.length === 0 || t(n.at(-1))) || n.push(r);
	for (; n.length > 0 && t(n.at(-1));) n.pop();
	return n;
}
//#endregion
//#region src/PDFViewer/components/Toolbar.jsx
function Ut({ toolbar: e, ctx: t }) {
	let n = J(), r = s(() => zt(e, {
		onUnknown: qt,
		onFixed: Jt
	}), [e]), i = s(() => ({
		...t,
		labels: n
	}), [t, n]);
	return /* @__PURE__ */ m("div", {
		className: Z.toolbar,
		children: [
			/* @__PURE__ */ p("div", {
				className: Z.group,
				children: Wt(r.left, i)
			}),
			/* @__PURE__ */ p("div", {
				className: Z.groupCenter,
				children: Wt(r.center, i)
			}),
			/* @__PURE__ */ p("div", {
				className: Z.group,
				children: Wt(r.right, i)
			})
		]
	});
}
function Wt(e, t) {
	return e.map((e) => {
		switch (e.kind) {
			case "divider": return /* @__PURE__ */ p("span", { className: Y.divider }, e.key);
			case "spacer": return /* @__PURE__ */ p("span", { style: { flex: 1 } }, e.key);
			case "custom": return /* @__PURE__ */ p(Gt, { action: e.action }, e.key);
			default: {
				let { Component: n } = e;
				return /* @__PURE__ */ p(n, { ctx: t }, e.key);
			}
		}
	});
}
function Gt({ action: e }) {
	return /* @__PURE__ */ p("button", {
		type: "button",
		onClick: e.onClick,
		disabled: e.disabled,
		"aria-pressed": e.active,
		className: `${Y.chipButton} ${e.active ? Y.active : ""}`,
		title: e.tooltip || e.label,
		"aria-label": e.label,
		children: e.icon ?? e.label
	});
}
var Kt = /* @__PURE__ */ new Set();
function qt(e) {
	Yt(e, (e) => `Unknown toolbar action "${e}" in config.toolbar.displayActions. Use a built-in action id, or the id of an entry in config.toolbar.customToolbarActions.`);
}
function Jt(e) {
	Yt(e, (e) => `Toolbar action "${e}" is one of the fixed navigation controls, so config.toolbar.displayActions cannot place it — that list configures the right-hand action row only. Use config.renderToolbar to rearrange the whole bar.`);
}
function Yt(e, t) {
	for (let n of e) Kt.has(n) || (Kt.add(n), console.warn(`[@armsolusi/pdf-viewer] ${t(n)}`));
}
var Q = {
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
}, Xt = 28;
function Zt({ rect: e, rotation: t = 0, frameRotation: n = 0, selected: i = !1, lockAspectRatio: a = !1, resizable: o = !0, rotatable: s = !1, opacity: c = 1, className: d = "", onSelect: h, onActivate: g, onTransformStart: _, onCommit: v, isDraggingRef: y, children: b, toolbar: x }) {
	let S = l(null), C = l(null), w = l(null), [T, E] = u(!1), [ee, D] = u(!1), O = r((e, t) => {
		let r = (n + t) * Math.PI / 180, i = (Math.abs(e.width * Math.sin(r)) + Math.abs(e.height * Math.cos(r))) / 2 + Xt;
		return `rotate(${-(n + t)}deg) translateY(${i}px) translate(-50%, -50%)`;
	}, [n]), te = r((e, t) => {
		let n = S.current;
		n && (n.style.left = `${e.x}px`, n.style.top = `${e.y}px`, n.style.width = `${e.width}px`, n.style.height = `${e.height}px`, n.style.transform = `rotate(${t}deg)`, C.current && (C.current.style.transform = O(e, t)));
	}, [O]), ne = r((n) => {
		if (n.button != null && n.button !== 0) return;
		let r = n.target?.dataset?.handle, i = n.target?.dataset?.rotate === "true", a = n.target?.closest?.("[data-no-drag]");
		if (!r && !i && a) {
			h?.();
			return;
		}
		n.preventDefault(), n.stopPropagation(), h?.(), _?.();
		let o = S.current;
		if (!o) return;
		let s = o.getBoundingClientRect();
		w.current = {
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
		}, w.current.startAngle = z(w.current.centre, {
			x: n.clientX,
			y: n.clientY
		}), n.currentTarget.setPointerCapture(n.pointerId), y && (y.current = !0), E(!0), i && D(!0);
	}, [
		e,
		t,
		h,
		_,
		y
	]), k = r((e) => {
		let t = w.current;
		if (!t || t.pointerId !== e.pointerId) return;
		e.preventDefault();
		let r = {
			x: e.clientX - t.startX,
			y: e.clientY - t.startY
		};
		if (t.kind === "rotate") {
			let n = z(t.centre, {
				x: e.clientX,
				y: e.clientY
			}), r = t.startRotation + (n - t.startAngle), i = e.shiftKey ? ue(r) : B(r);
			t.current = {
				rect: t.startRect,
				rotation: i
			};
		} else if (t.kind === "resize") {
			let e = I(r, n + t.startRotation);
			t.current = {
				rect: le({
					rect: t.startRect,
					rotation: t.startRotation,
					handle: t.handle,
					delta: e,
					lockAspectRatio: a
				}),
				rotation: t.startRotation
			};
		} else {
			let e = I(r, n);
			t.current = {
				rect: R(t.startRect, e),
				rotation: t.startRotation
			};
		}
		te(t.current.rect, t.current.rotation);
	}, [
		n,
		a,
		te
	]), A = r((e) => {
		let t = w.current;
		if (!t || t.pointerId !== e.pointerId) return;
		w.current = null, y && (y.current = !1), E(!1), D(!1);
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {}
		let { rect: n, rotation: r } = t.current;
		(n.x !== t.startRect.x || n.y !== t.startRect.y || n.width !== t.startRect.width || n.height !== t.startRect.height || r !== t.startRotation) && v?.(n, r, S.current);
	}, [v, y]);
	return /* @__PURE__ */ m("div", {
		ref: S,
		className: [
			Q.box,
			i && Q.boxSelected,
			T && Q.boxTransforming,
			d
		].filter(Boolean).join(" "),
		style: {
			left: e.x,
			top: e.y,
			width: e.width,
			height: e.height,
			transform: `rotate(${t}deg)`
		},
		onPointerDown: ne,
		onPointerMove: k,
		onPointerUp: A,
		onPointerCancel: A,
		onDoubleClick: g,
		onDragStart: (e) => e.preventDefault(),
		onMouseDown: (e) => e.stopPropagation(),
		children: [
			/* @__PURE__ */ p("div", { className: `${Q.outline} ${i ? Q.outlineSelected : ""}` }),
			/* @__PURE__ */ p("div", {
				className: Q.content,
				style: { opacity: c },
				children: b
			}),
			i && o && /* @__PURE__ */ p(f, { children: Object.entries(ae).map(([e, t]) => /* @__PURE__ */ p("span", {
				"data-handle": e,
				"aria-hidden": "true",
				className: Q.handle,
				style: {
					left: `${t.x * 100}%`,
					top: `${t.y * 100}%`,
					cursor: Qt[e]
				}
			}, e)) }),
			i && s && /* @__PURE__ */ p("span", {
				"data-rotate": "true",
				"aria-hidden": "true",
				className: Q.rotateHandle
			}),
			i && x && /* @__PURE__ */ p("div", {
				ref: C,
				className: `${Q.toolbarAnchor} ${ee ? Q.toolbarHidden : ""}`,
				style: { transform: O(e, t) },
				children: x
			})
		]
	});
}
var Qt = {
	nw: "nwse-resize",
	n: "ns-resize",
	ne: "nesw-resize",
	e: "ew-resize",
	se: "nwse-resize",
	s: "ns-resize",
	sw: "nesw-resize",
	w: "ew-resize"
}, $t = {
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
function en({ annotation: e, onEdit: t, onDuplicate: n, onDelete: r, children: i }) {
	let a = J(), o = e.opacity ?? 1;
	return /* @__PURE__ */ m("div", {
		"data-no-drag": !0,
		className: $t.bar,
		children: [
			i,
			i && /* @__PURE__ */ p("span", { className: $t.divider }),
			/* @__PURE__ */ m("label", {
				className: $t.opacity,
				title: a.opacity,
				children: [
					/* @__PURE__ */ p(k, {
						size: 14,
						stroke: 2,
						className: $t.opacityIcon
					}),
					/* @__PURE__ */ p("input", {
						type: "range",
						min: "10",
						max: "100",
						value: Math.round(o * 100),
						onChange: (n) => t(e.id, { opacity: Number(n.target.value) / 100 }),
						className: $t.opacityRange,
						"aria-label": a.opacity
					}),
					/* @__PURE__ */ m("span", {
						className: $t.opacityValue,
						children: [Math.round(o * 100), "%"]
					})
				]
			}),
			/* @__PURE__ */ p("span", { className: $t.divider }),
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: (t) => {
					t.stopPropagation(), n(e.id);
				},
				className: $t.button,
				title: a.duplicate,
				"aria-label": a.duplicate,
				children: /* @__PURE__ */ p(ne, {
					size: 16,
					stroke: 2
				})
			}),
			/* @__PURE__ */ p("button", {
				type: "button",
				onClick: (t) => {
					t.stopPropagation(), r(e.id);
				},
				className: $t.button,
				title: a.delete,
				"aria-label": a.delete,
				children: /* @__PURE__ */ p(te, {
					size: 16,
					stroke: 2
				})
			})
		]
	});
}
var tn = { image: "_image_yaeh2_1" };
//#endregion
//#region src/PDFViewer/components/annotations/ImageStamp.jsx
function nn({ annotation: e, screenRect: t, frameRotation: n, src: r, isActive: i, onSelect: a, onCommit: o, onEdit: s, onDuplicate: c, onDelete: l, isDraggingRef: u }) {
	return /* @__PURE__ */ p(Zt, {
		rect: t,
		rotation: e.rotation ?? 0,
		frameRotation: n,
		selected: i,
		lockAspectRatio: !0,
		rotatable: !0,
		opacity: e.opacity ?? 1,
		isDraggingRef: u,
		onSelect: () => a(e.id),
		onCommit: (t, n, r) => o(e.id, t, n, r),
		toolbar: /* @__PURE__ */ p(en, {
			annotation: e,
			onEdit: s,
			onDuplicate: c,
			onDelete: l
		}),
		children: /* @__PURE__ */ p("img", {
			src: r,
			className: tn.image,
			draggable: !1,
			alt: "Stamp"
		})
	});
}
var rn = n(nn), an = Object.freeze([
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
]), on = {
	helvetica: j.Helvetica,
	arial: j.Helvetica,
	"sans-serif": j.Helvetica,
	times: j.TimesRoman,
	"times new roman": j.TimesRoman,
	timesroman: j.TimesRoman,
	serif: j.TimesRoman,
	courier: j.Courier,
	"courier new": j.Courier,
	monospace: j.Courier
};
function sn(e) {
	if (typeof e != "string" || !e.trim()) return j.Helvetica;
	for (let t of e.split(",")) {
		let e = t.trim().replace(/^["']|["']$/g, "").toLowerCase();
		if (on[e]) return on[e];
	}
	return j.Helvetica;
}
function cn(e) {
	let t = sn(e);
	return an.find((e) => sn(e.value) === t) ?? an[0];
}
function ln(e) {
	return cn(e).value;
}
function un(e) {
	return cn(e).css;
}
function dn(e, t, n, r) {
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
var fn = Object.freeze({
	r: 0,
	g: 0,
	b: 0
});
function pn(e) {
	if (typeof e != "string") return fn;
	let t = e.trim().replace(/^#/, ""), n;
	if (/^[0-9a-f]{3}$/i.test(t)) n = t.split("").map((e) => e + e).join("");
	else if (/^[0-9a-f]{6}$/i.test(t)) n = t;
	else return fn;
	return {
		r: parseInt(n.slice(0, 2), 16) / 255,
		g: parseInt(n.slice(2, 4), 16) / 255,
		b: parseInt(n.slice(4, 6), 16) / 255
	};
}
function mn(e) {
	let { r: t, g: n, b: r } = pn(e);
	return re(t, n, r);
}
var hn = 1.2, gn = { [W.INK]: 0 }, _n = (e) => gn[e.type] ?? 1;
function vn(e) {
	return e.map((e, t) => ({
		annotation: e,
		index: t
	})).sort((e, t) => _n(e.annotation) - _n(t.annotation) || e.index - t.index).map((e) => e.annotation);
}
async function yn(e, t, n) {
	let r = new Set(t.filter((e) => e.type === W.IMAGE).map((e) => e.assetId).filter(Boolean)), i = /* @__PURE__ */ new Map();
	for (let t of r) {
		let r = n?.[t];
		if (!r) continue;
		let a = typeof r == "string" ? r : r.src, o = r?.bytes ?? (a ? await bn(t, a) : null);
		if (!o) continue;
		let s = r?.mimeType === "image/png" || typeof a == "string" && a.split("?")[0].toLowerCase().endsWith(".png");
		i.set(t, s ? await e.embedPng(o) : await e.embedJpg(o));
	}
	return i;
}
async function bn(e, t) {
	let n;
	try {
		n = await fetch(t);
	} catch (n) {
		throw Error(`Could not read the stamp image "${e}" from ${t}. If it is on another domain, that server must send CORS headers — a browser will display such an image but refuses to let script read its bytes. Hosting the image in your own app avoids this entirely.`, { cause: n });
	}
	if (!n.ok) throw Error(`Could not read the stamp image "${e}" from ${t} (${n.status} ${n.statusText}).`);
	return n.arrayBuffer();
}
async function xn(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of t) {
		if (r.type !== W.TEXT) continue;
		let t = sn(r.fontFamily);
		n.has(t) || n.set(t, await e.embedFont(t));
	}
	return n;
}
function Sn(e, t, n, { images: r }) {
	let i = r.get(t.assetId);
	if (!i) return;
	let { x: a, y: o, rotate: s } = he(t, n, t.rotation ?? 0);
	e.drawImage(i, {
		x: a,
		y: o,
		width: t.width,
		height: t.height,
		rotate: M(s),
		opacity: t.opacity ?? 1
	});
}
function Cn(e, t, n, { fonts: r }) {
	let i = t.text ?? "";
	if (!i) return;
	let a = t.fontSize || 16, o = r.get(sn(t.fontFamily));
	if (!o) return;
	let s = t.rotation ?? 0, c = a * hn, l = dn(i, o, a, Math.max(0, (t.width ?? 0) - 8)), u = (c - a) / 2, d = o.heightAtSize(a, { descender: !1 }), f = B(V(n.rotate) - s);
	l.forEach((r, i) => {
		if (!r) return;
		let l = H(de(t, {
			x: -t.width / 2 + 4,
			y: -t.height / 2 + 4 + u + d + i * c
		}, s), n);
		e.drawText(r, {
			x: l.x,
			y: l.y,
			size: a,
			font: o,
			color: mn(t.color),
			rotate: M(f),
			opacity: t.opacity ?? 1
		});
	});
}
function wn(e, t, n) {
	let r = t.points ?? [];
	if (r.length < 2) return;
	let i = `M ${fe(r, L(U(r)), t.rotation ?? 0).map((e) => `${e.x},${e.y}`).join(" L ")}`, { x: a, y: o, rotate: s } = ge(n);
	e.drawSvgPath(i, {
		x: a,
		y: o,
		rotate: M(s),
		borderColor: mn(t.color),
		borderWidth: t.strokeWidth ?? 2,
		borderOpacity: t.opacity ?? 1,
		borderLineCap: 1
	});
}
var Tn = {
	[W.IMAGE]: Sn,
	[W.TEXT]: Cn,
	[W.INK]: wn
};
async function En(e, t, n = {}, { pageRotations: r = {}, rotateExportedPages: i = !0 } = {}) {
	let a = await A.load(e), o = a.getPages(), s = o.map((e) => V(e.getRotation().angle)), c = vn(t.filter((e) => e && e.pageIndex >= 0 && e.pageIndex < o.length)), [l, u] = await Promise.all([yn(a, c, n), xn(a, c)]);
	for (let e of c) {
		let t = o[e.pageIndex], { width: n, height: r } = t.getSize(), i = {
			pageWidth: n,
			pageHeight: r,
			rotate: s[e.pageIndex]
		};
		Tn[e.type]?.(t, e, i, {
			images: l,
			fonts: u
		});
	}
	i && o.forEach((e, t) => {
		let n = V(r[t] ?? 0);
		n && e.setRotation(M(V(s[t] + n)));
	});
	let d = await a.save();
	return new Blob([d], { type: "application/pdf" });
}
var Dn = {
	textarea: "_textarea_ganlz_1",
	textareaEditing: "_textareaEditing_ganlz_49"
};
function On({ annotation: e, screenRect: t, frameRotation: n, scale: r, isActive: i, autoFocus: o, onSelect: s, onCommit: c, onEdit: d, onDuplicate: f, onDelete: h, onGestureStart: g, onGestureEnd: _, isDraggingRef: v }) {
	let y = J(), b = e.fontSize || 16, x = l(null), [S, C] = u(o), [w, T] = u(i);
	return w !== i && (T(i), i || C(!1)), a(() => {
		S ? x.current?.focus() : x.current?.blur();
	}, [S]), /* @__PURE__ */ p(Zt, {
		onActivate: () => C(!0),
		onTransformStart: () => C(!1),
		rect: t,
		rotation: e.rotation ?? 0,
		frameRotation: n,
		selected: i,
		rotatable: !0,
		opacity: e.opacity ?? 1,
		isDraggingRef: v,
		onSelect: () => s(e.id),
		onCommit: (t, n, r) => c(e.id, t, n, r),
		toolbar: /* @__PURE__ */ m(en, {
			annotation: e,
			onEdit: d,
			onDuplicate: f,
			onDelete: h,
			children: [
				/* @__PURE__ */ p("input", {
					type: "number",
					value: b,
					min: 8,
					max: 72,
					onChange: (t) => {
						let n = Number.parseInt(t.target.value, 10);
						Number.isNaN(n) || d(e.id, { fontSize: Math.min(72, Math.max(8, n)) });
					},
					className: Y.numberInput,
					title: y.fontSize
				}),
				/* @__PURE__ */ p("select", {
					value: ln(e.fontFamily),
					onChange: (t) => d(e.id, { fontFamily: t.target.value }),
					className: Y.select,
					title: y.font,
					children: an.map((e) => /* @__PURE__ */ p("option", {
						value: e.value,
						children: e.label
					}, e.value))
				}),
				/* @__PURE__ */ p("div", {
					className: Y.colorWell,
					title: y.textColour,
					children: /* @__PURE__ */ p("input", {
						type: "color",
						value: e.color || "#000000",
						onChange: (t) => d(e.id, { color: t.target.value })
					})
				})
			]
		}),
		children: /* @__PURE__ */ p("textarea", {
			ref: x,
			...S ? { "data-no-drag": !0 } : {},
			readOnly: !S,
			value: e.text,
			placeholder: y.textPlaceholder,
			onChange: (t) => d(e.id, { text: t.target.value }),
			onFocus: g,
			onBlur: () => {
				_?.(), C(!1);
			},
			onKeyDown: (e) => {
				e.key === "Escape" && (e.stopPropagation(), C(!1));
			},
			className: `${Dn.textarea} ${S ? Dn.textareaEditing : ""}`,
			style: {
				fontSize: `${b * r}px`,
				color: e.color || "#000000",
				fontFamily: un(e.fontFamily),
				lineHeight: hn,
				padding: `${4 * r}px`
			}
		})
	});
}
var kn = n(On);
//#endregion
//#region src/PDFViewer/utils/inkSimplify.js
function An(e, t, n) {
	let r = t.x, i = t.y, a = n.x - r, o = n.y - i;
	if (a !== 0 || o !== 0) {
		let t = ((e.x - r) * a + (e.y - i) * o) / (a * a + o * o);
		t > 1 ? (r = n.x, i = n.y) : t > 0 && (r += a * t, i += o * t);
	}
	return a = e.x - r, o = e.y - i, a * a + o * o;
}
function jn(e, t) {
	let n = new Uint8Array(e.length);
	n[0] = 1, n[e.length - 1] = 1;
	let r = [[0, e.length - 1]];
	for (; r.length;) {
		let [i, a] = r.pop();
		if (a - i < 2) continue;
		let o = 0, s = -1;
		for (let t = i + 1; t < a; t += 1) {
			let n = An(e[t], e[i], e[a]);
			n > o && (o = n, s = t);
		}
		o > t && s !== -1 && (n[s] = 1, r.push([i, s], [s, a]));
	}
	let i = [];
	for (let t = 0; t < e.length; t += 1) n[t] && i.push(e[t]);
	return i;
}
var Mn = .6;
function Nn(e, t = Mn) {
	return !e || e.length <= 2 ? e ? [...e] : [] : t <= 0 ? [...e] : jn(e, t * t);
}
var Pn = {
	layer: "_layer_174pc_1",
	layerDrawing: "_layerDrawing_174pc_33",
	strokeHit: "_strokeHit_174pc_43",
	stroke: "_stroke_174pc_43",
	deleteBadge: "_deleteBadge_174pc_61"
}, Fn = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/><path d=\"m15 5 4 4\"/></svg>') 0 24, crosshair", In = (e) => e.length ? `M ${e.map((e) => `${e.x},${e.y}`).join(" L ")}` : "";
function Ln({ pageIndex: e, pageWidth: t, pageHeight: n, strokes: i, isDrawMode: a, inkColor: o, inkThickness: s, inkOpacity: c, activeId: d, onSelect: f, onCommit: h, onDelete: g, cancelStrokeRef: _ }) {
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
	]), D = r((e) => {
		if (!a || b.current.length === 0) return;
		e.preventDefault();
		let t = w(e);
		b.current.push(t), x.current += ` L ${t.x},${t.y}`, y.current?.setAttribute("d", x.current);
	}, [a, w]), O = r((t) => {
		if (b.current.length === 0) return;
		t.preventDefault();
		try {
			v.current?.releasePointerCapture(t.pointerId);
		} catch {}
		let n = Nn(b.current);
		T(), C(!1), _ && (_.current = null), n.length > 1 && h(Se({
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
		className: `${Pn.layer} ${a ? Pn.layerDrawing : ""}`,
		style: { cursor: a ? Fn : "auto" },
		viewBox: `0 0 ${t} ${n}`,
		preserveAspectRatio: "none",
		onPointerDown: ee,
		onPointerMove: D,
		onPointerUp: O,
		onPointerCancel: E,
		children: [i.map((e) => /* @__PURE__ */ p(zn, {
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
var Rn = 12;
function zn({ stroke: e, selected: t, interactive: n, onSelect: r, onDelete: i }) {
	let a = In(e.points);
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
			strokeWidth: e.strokeWidth + Rn,
			strokeLinecap: "round",
			strokeLinejoin: "round",
			className: Pn.strokeHit,
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
			className: Pn.deleteBadge,
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
var Bn = n(Ln), Vn = e(null);
function Hn({ value: e, children: t }) {
	return /* @__PURE__ */ p(Vn.Provider, {
		value: e,
		children: t
	});
}
function Un() {
	let e = i(Vn);
	if (!e) throw Error("useViewer must be used inside <PDFViewer>");
	return e;
}
//#endregion
//#region src/PDFViewer/utils/pageHitTest.js
function Wn(e, t = document) {
	let n = Array.from(t.querySelectorAll(".pdf-page-container")), r = null, i = 0;
	for (let t of n) {
		let n = t.getBoundingClientRect(), a = _e(e, n);
		a > i && (i = a, r = {
			pageIndex: Number.parseInt(t.dataset.pageIndex, 10),
			pageRect: n
		});
	}
	return r;
}
var Gn = {
	page: "_page_17pwx_1",
	placeholder: "_placeholder_17pwx_25",
	rotator: "_rotator_17pwx_49",
	raster: "_raster_17pwx_59",
	canvas: "_canvas_17pwx_73",
	layer: "_layer_17pwx_81"
}, Kn = 300;
function qn({ pageNumber: e, registerPage: t, shouldRender: n = !0 }) {
	let i = e - 1, { pdfDoc: o, pageSizes: c, pageRotations: d, scale: f, stampAssets: h } = Un(), { isDrawMode: g, inkColor: _, inkThickness: v, inkOpacity: y, activeId: b, setActiveId: x, cancelStrokeRef: S, isDraggingRef: C } = Xe(), w = Ke(), T = qe(i), E = l(null), ee = l(null), D = l(null), te = l(null), [ne, k] = u(f), [A, j] = u(f), M = c[i] ?? {
		width: 0,
		height: 0
	};
	a(() => {
		if (f === ne) return;
		let e = setTimeout(() => k(f), Kn);
		return () => clearTimeout(e);
	}, [f, ne]), a(() => {
		if (!o || !n) return;
		let t = null, r = !1;
		return (async () => {
			let n = await o.getPage(e);
			if (r || !E.current) return;
			let i = n.getViewport({ scale: ne }), a = window.devicePixelRatio || 1, s = Math.floor(i.width * a), c = Math.floor(i.height * a), l = document.createElement("canvas");
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
				a.width = s, a.height = c, a.style.width = `${Math.floor(i.width)}px`, a.style.height = `${Math.floor(i.height)}px`, a.getContext("2d", { alpha: !1 }).drawImage(l, 0, 0), j(ne);
				let o = await n.getTextContent();
				if (r || !ee.current) return;
				ee.current.innerHTML = "", await new O.TextLayer({
					textContentSource: o,
					container: ee.current,
					viewport: i
				}).render();
				let u = await n.getAnnotations();
				if (r || !D.current || u.length === 0) return;
				D.current.innerHTML = "";
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
				await new O.AnnotationLayer({
					page: n,
					viewport: f,
					div: D.current,
					annotations: u,
					linkService: d,
					downloadManager: null,
					renderInteractiveForms: !0
				}).render({
					annotations: u,
					div: D.current,
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
		ne,
		n
	]);
	let re = r((e, t, n, r) => {
		let a = t.width / f, o = t.height / f, s = {
			rotation: n,
			width: a,
			height: o
		}, l = r ? Wn(r.getBoundingClientRect()) : null;
		if (l && l.pageIndex !== i) {
			let e = r.getBoundingClientRect(), t = d[l.pageIndex] ?? 0, n = c[l.pageIndex] ?? {
				width: 0,
				height: 0
			}, i = se({
				x: e.left + e.width / 2 - (l.pageRect.left + l.pageRect.width / 2),
				y: e.top + e.height / 2 - (l.pageRect.top + l.pageRect.height / 2)
			}, -t), u = {
				x: i.x / f + n.width / 2,
				y: i.y / f + n.height / 2
			};
			s.pageIndex = l.pageIndex, s.x = u.x - a / 2, s.y = u.y - o / 2;
		} else s.x = t.x / f, s.y = t.y / f;
		w.update(e, s);
	}, [
		w,
		f,
		i,
		d,
		c
	]), N = r((e, t) => w.update(e, t), [w]), P = r((e) => w.duplicate(e), [w]), ie = r((e) => w.add(e), [w]), F = r((e) => {
		w.remove(e), x(null);
	}, [w, x]), { strokes: ae, objects: oe } = s(() => ({
		strokes: T.filter((e) => e.type === W.INK),
		objects: T.filter((e) => e.type !== W.INK)
	}), [T]), I = A > 0 ? f / A : 1, L = d[i] ?? 0, ce = pe(M, L);
	return /* @__PURE__ */ p("div", {
		ref: r((e) => {
			te.current = e, t?.(i, e);
		}, [t, i]),
		className: `pdf-page-container ${Gn.page}`,
		"data-page-index": i,
		style: {
			width: ce.width ? ce.width * f : "auto",
			height: ce.height ? ce.height * f : "auto"
		},
		onMouseDown: () => x(null),
		children: n ? /* @__PURE__ */ m("div", {
			className: Gn.rotator,
			style: {
				width: M.width * f,
				height: M.height * f,
				left: (ce.width * f - M.width * f) / 2,
				top: (ce.height * f - M.height * f) / 2,
				transform: L ? `rotate(${L}deg)` : void 0
			},
			children: [/* @__PURE__ */ m("div", {
				className: Gn.raster,
				style: {
					transform: `scale(${I})`,
					width: M.width * A,
					height: M.height * A
				},
				children: [
					/* @__PURE__ */ p("canvas", {
						ref: E,
						className: Gn.canvas
					}),
					/* @__PURE__ */ p("div", {
						ref: ee,
						className: `textLayer ${Gn.layer}`,
						style: {
							"--scale-factor": A,
							"--total-scale-factor": A
						}
					}),
					/* @__PURE__ */ p("div", {
						ref: D,
						className: `annotationLayer ${Gn.layer}`,
						style: {
							"--scale-factor": A,
							"--total-scale-factor": A
						}
					}),
					/* @__PURE__ */ p(Bn, {
						pageIndex: i,
						pageWidth: M.width,
						pageHeight: M.height,
						strokes: ae,
						isDrawMode: g,
						inkColor: _,
						inkThickness: v,
						inkOpacity: y,
						activeId: b,
						onSelect: x,
						onCommit: ie,
						onDelete: F,
						cancelStrokeRef: S
					})
				]
			}), oe.map((e) => e.type === W.TEXT ? /* @__PURE__ */ p(kn, {
				annotation: e,
				screenRect: me(e, f),
				frameRotation: L,
				scale: f,
				isActive: b === e.id,
				autoFocus: b === e.id && e.text === "",
				onSelect: x,
				onCommit: re,
				onEdit: N,
				onDuplicate: P,
				onDelete: F,
				onGestureStart: w.beginGesture,
				onGestureEnd: w.endGesture,
				isDraggingRef: C
			}, e.id) : /* @__PURE__ */ p(rn, {
				annotation: e,
				screenRect: me(e, f),
				frameRotation: L,
				src: h[e.assetId]?.src,
				isActive: b === e.id,
				onSelect: x,
				onCommit: re,
				onEdit: N,
				onDuplicate: P,
				onDelete: F,
				isDraggingRef: C
			}, e.id))]
		}) : /* @__PURE__ */ p("div", {
			className: Gn.placeholder,
			children: e
		})
	});
}
var Jn = { scroller: "_scroller_1iebb_1" };
//#endregion
//#region src/PDFViewer/components/Document.jsx
function Yn({ registerPage: e, renderWindow: t }) {
	let { pdfDoc: n, setScrollContainer: r } = Un(), { setActiveId: i } = Xe();
	return /* @__PURE__ */ p("div", {
		ref: r,
		className: Jn.scroller,
		onMouseDown: (e) => {
			e.target === e.currentTarget && i(null);
		},
		children: n && Array.from({ length: n.numPages }, (n, r) => /* @__PURE__ */ p(Xn, {
			pageNumber: r + 1,
			registerPage: e,
			shouldRender: t.has(r)
		}, r))
	});
}
var Xn = n(qn), Zn = {
	sidebar: "_sidebar_1h8kf_1",
	list: "_list_1h8kf_21",
	item: "_item_1h8kf_41",
	tile: "_tile_1h8kf_55",
	tileActive: "_tileActive_1h8kf_85",
	canvas: "_canvas_1h8kf_109",
	number: "_number_1h8kf_117",
	numberActive: "_numberActive_1h8kf_127"
}, Qn = 116;
function $n({ activePageIndex: e, onGoToPage: t }) {
	let n = J(), { pdfDoc: r, pageSizes: i, pageRotations: a } = Un();
	return r ? /* @__PURE__ */ p("aside", {
		className: Zn.sidebar,
		"aria-label": n.thumbnailSidebar,
		children: /* @__PURE__ */ p("ul", {
			className: Zn.list,
			children: Array.from({ length: r.numPages }, (n, o) => /* @__PURE__ */ p(tr, {
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
function er({ pdfDoc: e, pageIndex: t, pageSize: n, userRotation: r, isActive: i, onSelect: o }) {
	let s = J(), c = l(null), d = l(null), [f, h] = u(!1), g = pe(n ?? {
		width: 0,
		height: 0
	}, r), _ = g.width ? g.height / g.width : 1.414, v = Math.round(Qn * _);
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
					scale: Qn / s.width,
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
		className: Zn.item,
		children: [/* @__PURE__ */ p("button", {
			type: "button",
			onClick: () => o(t),
			"aria-current": i ? "page" : void 0,
			"aria-label": $e(s.goToPage, { page: t + 1 }),
			className: `${Zn.tile} ${i ? Zn.tileActive : ""}`,
			style: {
				width: Qn,
				height: v
			},
			children: /* @__PURE__ */ p("canvas", {
				ref: d,
				className: Zn.canvas
			})
		}), /* @__PURE__ */ p("span", {
			className: `${Zn.number} ${i ? Zn.numberActive : ""}`,
			children: t + 1
		})]
	});
}
var tr = n(er), nr = {
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
function rr({ label: e }) {
	return /* @__PURE__ */ m("div", {
		className: nr.state,
		role: "status",
		children: [/* @__PURE__ */ p("div", { className: nr.skeleton }), /* @__PURE__ */ p("p", {
			className: nr.hint,
			children: e
		})]
	});
}
function ir({ error: e, onRetry: t, label: n, retryLabel: r }) {
	return /* @__PURE__ */ m("div", {
		className: nr.state,
		role: "alert",
		children: [
			/* @__PURE__ */ p("p", {
				className: nr.title,
				children: n
			}),
			e?.message && /* @__PURE__ */ p("p", {
				className: nr.hint,
				children: e.message
			}),
			t && /* @__PURE__ */ p("button", {
				type: "button",
				onClick: t,
				className: nr.retry,
				children: r
			})
		]
	});
}
function ar({ label: e }) {
	return /* @__PURE__ */ p("div", {
		className: nr.state,
		children: /* @__PURE__ */ p("p", {
			className: nr.hint,
			children: e
		})
	});
}
//#endregion
//#region src/PDFViewer/utils/worker.js
var or = !1, sr = "/.vite/deps/", cr = "/@armsolusi/pdf-viewer/dist/", lr = "pdf.worker.min.js";
function ur(e) {
	let t = `${sr}${lr}`;
	return e?.includes(t) ? e.replace(t, `${cr}${lr}`) : e;
}
var dr = ur(N);
function fr({ workerSrc: e, workerPort: t } = {}) {
	if (t) {
		O.GlobalWorkerOptions.workerPort !== t && (O.GlobalWorkerOptions.workerPort = t);
		return;
	}
	if (e) {
		O.GlobalWorkerOptions.workerSrc !== e && (O.GlobalWorkerOptions.workerSrc = e);
		return;
	}
	if (!(O.GlobalWorkerOptions.workerSrc || O.GlobalWorkerOptions.workerPort)) {
		if (dr) {
			O.GlobalWorkerOptions.workerSrc = dr;
			return;
		}
		or || (or = !0, console.warn("[@armsolusi/pdf-viewer] The bundled pdf.js worker could not be resolved, so the document will fail to load. This should not happen; please report it. As a workaround, pass a worker URL yourself:\n\n  import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'   // Vite\n  <PDFViewer src={url} config={{ workerSrc }} />"));
	}
}
function pr(e) {
	let t = e?.message ?? "";
	return /fake worker|worker/i.test(t) ? `${t}\n\nThe pdf.js worker shipped with @armsolusi/pdf-viewer could not be loaded. Open that URL directly and check two things:

  1. Does it return the file, or a 404? If it 404s and you are on the Vite dev server, add optimizeDeps: { exclude: ['@armsolusi/pdf-viewer'] } to vite.config.js.
  2. What Content-Type does it come back with? It must be a JavaScript type. Servers that answer application/octet-stream — nginx does this for extensions it does not recognise — make the browser refuse to run it.

Failing both, serve a copy yourself and pass it as config.workerSrc.` : t;
}
//#endregion
//#region src/PDFViewer/utils/source.js
async function mr(e) {
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
function hr(e) {
	return e.slice();
}
//#endregion
//#region src/PDFViewer/hooks/usePdfDocument.js
var gr = {
	status: "idle",
	pdfDoc: null,
	pageSizes: [],
	sourceBytes: null,
	error: null
};
function _r(e, { workerSrc: t, workerPort: n, onLoadError: i } = {}) {
	let [o, c] = u(gr), [l, d] = u(0), f = P(i), p = r(() => d((e) => e + 1), []);
	a(() => {
		if (!e) return;
		fr({
			workerSrc: t,
			workerPort: n
		});
		let r = !1, i = null, a = null;
		return (async () => {
			try {
				let t = await mr(e);
				if (r || (i = O.getDocument({ data: hr(t) }), a = await i.promise, r)) return;
				let n = [];
				for (let e = 1; e <= a.numPages; e += 1) {
					let t = await a.getPage(e);
					if (r) return;
					let i = t.getViewport({ scale: 1 });
					n.push({
						width: i.width,
						height: i.height,
						rotate: V(t.rotate)
					});
				}
				if (r) return;
				c({
					status: "ready",
					pdfDoc: a,
					pageSizes: n,
					sourceBytes: t,
					error: null
				});
			} catch (e) {
				if (r || e?.name === "RenderingCancelledException") return;
				e.message = pr(e), console.error("[@armsolusi/pdf-viewer] Failed to load document:", e), c({
					...gr,
					status: "error",
					error: e
				}), f.current?.(e);
			}
		})(), () => {
			r = !0, i?.destroy?.(), a && typeof a.destroy == "function" && a.destroy();
		};
	}, [
		e,
		t,
		n,
		l,
		f
	]);
	let m = !!e && o.pdfDoc === null && o.status !== "error";
	return s(() => e ? m ? {
		...gr,
		status: "loading",
		reload: p
	} : {
		...o,
		reload: p
	} : {
		...gr,
		reload: p
	}, [
		e,
		m,
		o,
		p
	]);
}
function vr({ pageCount: e, container: t, containerRef: n }) {
	let [i, o] = u(0), [c, d] = u(() => /* @__PURE__ */ new Set([0])), f = l(0), p = l(/* @__PURE__ */ new Map()), m = l(null), h = r((e, t) => {
		let n = p.current, r = n.get(e);
		r && m.current && m.current.unobserve(r), t ? (n.set(e, t), m.current?.observe(t)) : n.delete(e);
	}, []);
	return a(() => {
		let e = n.current;
		if (!t || !e) return;
		let r = /* @__PURE__ */ new Set(), i = new IntersectionObserver((e) => {
			for (let t of e) {
				let e = Number.parseInt(t.target.dataset.pageIndex, 10);
				Number.isNaN(e) || (t.isIntersecting ? r.add(e) : r.delete(e));
			}
			d(new Set(r));
			let t = 0, n = null;
			for (let r of e) r.isIntersecting && r.intersectionRatio > t && (t = r.intersectionRatio, n = Number.parseInt(r.target.dataset.pageIndex, 10));
			n !== null && !Number.isNaN(n) && (f.current = n, o(n));
		}, {
			root: e,
			threshold: [
				0,
				.1,
				.25,
				.5,
				.75,
				.9,
				1
			]
		});
		m.current = i;
		for (let e of p.current.values()) i.observe(e);
		return () => {
			i.disconnect(), m.current = null;
		};
	}, [
		t,
		n,
		e
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
		registerPage: h,
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
var yr = 24, br = (e, t) => Math.hypot(e.x - t.x, e.y - t.y), xr = (e, t) => ({
	x: (e.x + t.x) / 2,
	y: (e.y + t.y) / 2
});
function Sr({ container: e, containerRef: t, setScale: n, anchorAtPointer: r, cancelStrokeRef: i, isDraggingRef: o }) {
	let s = P(n), c = P(r), u = l(/* @__PURE__ */ new Map()), d = l(null);
	a(() => {
		if (!e) return;
		let n = t.current;
		if (!n) return;
		let r = u.current, a = () => {
			d.current = null;
		}, l = () => {
			if (r.size !== 2 || o?.current) return;
			i?.current?.();
			let [e, t] = [...r.values()], n = br(e, t);
			n < yr || (d.current = {
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
			let [n, i] = [...r.values()], a = br(n, i);
			if (a < yr) return;
			let o = xr(n, i), l = document.elementFromPoint(o.x, o.y);
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
function Cr(e) {
	let t = e?.tagName;
	return t === "INPUT" || t === "TEXTAREA" || e?.isContentEditable === !0;
}
function wr(e) {
	let t = P(e);
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
					if (Cr(e.target)) return;
					e.preventDefault(), e.shiftKey ? n.onRedo?.() : n.onUndo?.();
					return;
				case "y":
					if (Cr(e.target)) return;
					e.preventDefault(), n.onRedo?.();
					return;
				case "d":
					if (Cr(e.target)) return;
					n.onDuplicate?.() && e.preventDefault();
					return;
				case "c":
					if (Cr(e.target) || !window.getSelection()?.isCollapsed) return;
					n.onCopy?.();
					return;
				case "v":
					if (Cr(e.target)) return;
					n.onPaste?.() && e.preventDefault();
					return;
				default: return;
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				if (Cr(e.target) || !n.onDelete?.()) return;
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
var Tr = "specimen", $ = Object.freeze({
	SPECIMEN: "specimen",
	STAMP: "stamp"
}), Er = Object.freeze({
	CONFIG: "config",
	UPLOAD: "upload"
});
function Dr({ specimenAsset: e, stampAssets: t }) {
	let [n, i] = u({}), o = l([]);
	a(() => {
		let e = o.current;
		return () => {
			for (let t of e) URL.revokeObjectURL(t);
			e.length = 0;
		};
	}, []);
	let c = s(() => Or(t, e), [t, e]), d = s(() => ({
		...c,
		...n
	}), [c, n]), f = r(async (e) => {
		if (!e) return null;
		let t = await e.arrayBuffer(), n = URL.createObjectURL(e);
		o.current.push(n);
		let r = F("asset");
		return i((i) => ({
			...i,
			[r]: {
				id: r,
				kind: $.STAMP,
				source: Er.UPLOAD,
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
			kind: t.kind ?? $.STAMP,
			source: t.source ?? Er.CONFIG,
			label: t.label ?? e,
			src: t.src
		})), [d]),
		addUploadedAsset: f
	};
}
function Or(e, t) {
	let n = {}, r = (e, t) => {
		!e || !t?.src || (n[e] = {
			...t,
			id: e,
			kind: t.kind === $.SPECIMEN ? $.SPECIMEN : $.STAMP,
			source: Er.CONFIG,
			label: t.label ?? e
		});
	};
	if (Array.isArray(e)) for (let t of e) r(t?.id, t);
	else if (e && typeof e == "object") for (let [t, n] of Object.entries(e)) n && r(t, typeof n == "string" ? { src: n } : n);
	if (t) {
		let e = n[Tr];
		n[Tr] = e ? {
			...e,
			kind: $.SPECIMEN
		} : {
			id: Tr,
			kind: $.SPECIMEN,
			source: Er.CONFIG,
			label: "Signature",
			src: t
		};
	}
	return n;
}
//#endregion
//#region src/PDFViewer/utils/viewerState.js
function kr({ annotations: e = [], assets: t = {} } = {}) {
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
			n.image += 1, n.total += 1, t[r.assetId]?.kind === $.SPECIMEN ? n.specimen += 1 : n.stamp += 1;
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
function Ar(e, t) {
	if (e === t) return !0;
	if (!e || !t) return !1;
	let n = Object.keys(e);
	return n.length === Object.keys(t).length && n.every((n) => e[n] === t[n]);
}
//#endregion
//#region src/PDFViewer/viewer/createViewerStore.js
var jr = Object.freeze({
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
function Mr(e, t) {
	if (Object.is(e, t)) return !0;
	if (!Nr(e) || !Nr(t)) return !1;
	let n = Object.keys(e);
	return n.length === Object.keys(t).length && n.every((n) => Object.is(e[n], t[n]));
}
var Nr = (e) => typeof e == "object" && !!e && !Array.isArray(e);
function Pr(e = jr) {
	let t = e, n = /* @__PURE__ */ new Set();
	return {
		getState: () => t,
		subscribe(e) {
			return n.add(e), () => n.delete(e);
		},
		setState(e) {
			if (!e || !Object.keys(e).some((n) => !Mr(t[n], e[n]))) return !1;
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
var Fr = Object.freeze([
	"reload",
	"getFlattenedPDF",
	"getAnnotations",
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
function Ir() {
	let [e] = u(Lr);
	return e;
}
function Lr() {
	let e = Pr(), t = { current: null }, n = {
		__attach(e) {
			return t.current = e, () => {
				t.current === e && (t.current = null);
			};
		},
		__store: e,
		getState: e.getState,
		subscribe: e.subscribe
	};
	for (let e of Fr) n[e] = (...n) => t.current?.[e]?.(...n);
	return n;
}
//#endregion
//#region src/PDFViewer/PDFViewerInner.jsx
var Rr = 150, zr = /* @__PURE__ */ new Set();
function Br(e, t) {
	zr.has(e) || (zr.add(e), console.warn(`[@armsolusi/pdf-viewer] The stamp image for "${e}" failed to load: ${t}\nCheck the URL resolves from the browser. A path beginning with "/" is resolved against the origin, ignoring your bundler's base — under a base such as "/my-app/", use \`\${import.meta.env.BASE_URL}my-image.png\` instead of "/my-image.png".`));
}
function Vr({ src: e, config: t = {}, viewerRef: n, viewer: i }) {
	let { specimenAsset: c, stampAssets: d, onSpecimenChange: f, onAnnotationsChange: h, onDownload: g, onLoadError: _, canDownload: v = !0, allowMultipleStamps: y = !0, maxStamps: b = null, rotateExportedPages: x = !0, toolbar: S, renderToolbar: C, workerSrc: w, workerPort: T } = t, [E, ee] = u(null), D = l(null), O = r((e) => {
		D.current = e, ee(e);
	}, []), [te, ne] = u(!1), [k, A] = u({}), { pdfDoc: j, pageSizes: M, sourceBytes: re, status: N, error: ie, reload: ae } = _r(e, {
		workerSrc: w,
		workerPort: T,
		onLoadError: _
	}), oe = j?.numPages ?? 0, { activePageIndex: se, activePageRef: I, renderWindow: L, registerPage: ce, scrollToPage: le } = vr({
		pageCount: oe,
		container: E,
		containerRef: D
	}), R = lt({
		pageSizes: s(() => M.map((e, t) => pe(e, k[t] ?? 0)), [M, k]),
		container: E,
		containerRef: D
	}), z = Xe(), ue = J();
	Sr({
		container: E,
		containerRef: D,
		setScale: R.setScale,
		anchorAtPointer: R.anchorAtPointer,
		cancelStrokeRef: z.cancelStrokeRef,
		isDraggingRef: z.isDraggingRef
	});
	let B = Ke(), { annotations: de, canUndo: fe, canRedo: me } = Ge(), { assets: H, list: he, addUploadedAsset: ge } = Dr({
		specimenAsset: c,
		stampAssets: d
	}), { hasSpecimen: U, hasAnnotation: _e, counts: W } = s(() => kr({
		annotations: ke(de),
		assets: H
	}), [de, H]), ve = s(() => (he.find((e) => e.kind === $.SPECIMEN) ?? he[0])?.id, [he]), ye = s(() => ({
		pdfDoc: j,
		pageSizes: M,
		pageRotations: k,
		status: N,
		error: ie,
		scale: R.scale,
		setScrollContainer: O,
		stampAssets: H
	}), [
		j,
		M,
		k,
		N,
		ie,
		R.scale,
		H,
		O
	]), Se = r((e, t = "page") => {
		A((n) => {
			let r = { ...n }, i = t === "all" ? Array.from({ length: oe }, (e, t) => t) : [I.current];
			for (let t of i) r[t] = V((r[t] ?? 0) + e);
			return r;
		});
	}, [oe, I]), G = P(f), Ce = P(h), we = l(null), Te = l(null);
	a(() => {
		we.current !== U && (we.current = U, G.current?.(U)), Ar(Te.current, W) || (Te.current = W, Ce.current?.(W));
	}, [
		U,
		W,
		G,
		Ce
	]);
	let Ee = r(async (e) => {
		if (!j || !y && W.image >= 1 || y && b !== null && W.image >= b) return null;
		let t = e ?? ve, n = t ? H[t] : null;
		if (!n?.src) return null;
		let r = 60, i = new Image();
		i.src = n.src, await new Promise((e) => {
			i.onload = () => e(!0), i.onerror = () => e(!1);
		}) || Br(t, n.src), i.width && i.height && (r = Rr * (i.height / i.width));
		let a = be({
			assetId: t,
			pageIndex: I.current,
			width: Rr,
			height: r
		});
		return B.add(a), z.setActiveId(a.id), a.id;
	}, [
		j,
		y,
		b,
		W.image,
		H,
		ve,
		B,
		I,
		z
	]), De = r(async (e) => {
		let t = await ge(e);
		t && await Ee(t);
	}, [ge, Ee]), Oe = r(({ text: e = "", fontSize: t = 16, color: n = "#000000", fontFamily: r = "Helvetica" } = {}) => {
		let i = xe({
			pageIndex: I.current,
			text: e,
			fontSize: t,
			color: n,
			fontFamily: r
		});
		return B.add(i), z.setActiveId(i.id), i.id;
	}, [
		B,
		I,
		z
	]), Ae = l(null), K = r((e) => {
		let t = e ?? z.activeIdRef.current;
		return t ? (B.duplicate(t), !0) : !1;
	}, [B, z]), je = r(() => {
		let e = z.activeIdRef.current;
		if (!e) return !1;
		let t = B.getSnapshot().byId[e];
		return t ? (Ae.current = t, !0) : !1;
	}, [B, z]), Me = r(() => {
		let e = Ae.current;
		if (!e) return !1;
		let t = {
			...e,
			id: void 0,
			pageIndex: I.current,
			x: e.x + 16,
			y: e.y + 16
		};
		Array.isArray(e.points) && (t.points = e.points.map((e) => ({
			x: e.x + 16,
			y: e.y + 16
		})));
		let n = {
			...t,
			id: F(e.type)
		};
		return B.add(n), z.setActiveId(n.id), !0;
	}, [
		B,
		I,
		z
	]), Ne = r(() => {
		let e = z.activeIdRef.current;
		return e ? (B.remove(e), z.setActiveId(null), !0) : !1;
	}, [B, z]);
	wr({
		onZoomIn: () => R.setScale((e) => e * 1.1),
		onZoomOut: () => R.setScale((e) => e * .9),
		onZoomReset: () => R.setZoomMode("auto"),
		onUndo: B.undo,
		onRedo: B.redo,
		onDelete: Ne,
		onDuplicate: K,
		onCopy: je,
		onPaste: Me,
		onEscape: () => z.setActiveId(null)
	});
	let q = s(() => ({
		reload: ae,
		getAnnotations: () => ke(B.getSnapshot()),
		getFlattenedPDF: async () => {
			if (!re) throw Error("No document loaded");
			return En(re, ke(B.getSnapshot()), H, {
				pageRotations: k,
				rotateExportedPages: x
			});
		},
		addTextStamp: Oe,
		addImageStamp: Ee,
		uploadStamp: De,
		duplicateSelected: K,
		deleteSelected: Ne,
		undo: B.undo,
		redo: B.redo,
		zoomIn: () => R.setScale((e) => e * 1.1),
		zoomOut: () => R.setScale((e) => e * .9),
		setScale: R.setScale,
		setZoomMode: R.setZoomMode,
		goToPage: le,
		rotatePages: Se,
		setDrawMode: z.setIsDrawMode,
		setInk: ({ color: e, thickness: t, opacity: n } = {}) => {
			e !== void 0 && z.setInkColor(e), t !== void 0 && z.setInkThickness(t), n !== void 0 && z.setInkOpacity(n);
		},
		toggleThumbnails: () => ne((e) => !e)
	}), [
		ae,
		B,
		re,
		H,
		k,
		x,
		Oe,
		Ee,
		De,
		K,
		Ne,
		R,
		le,
		Se,
		z
	]);
	o(n, () => ({
		addTextStamp: q.addTextStamp,
		addImageStamp: q.addImageStamp,
		undo: q.undo,
		redo: q.redo,
		getAnnotations: q.getAnnotations,
		getFlattenedPDF: q.getFlattenedPDF
	}), [q]);
	let Pe = Ir(), Fe = i ?? Pe;
	a(() => Fe.__attach(q), [Fe, q]);
	let Ie = s(() => ({
		status: N,
		error: ie,
		pageCount: oe,
		activePageIndex: se,
		scale: R.scale,
		zoomMode: R.zoomMode,
		hasSpecimen: U,
		hasAnnotation: _e,
		counts: W,
		canUndo: fe,
		canRedo: me,
		isDrawMode: z.isDrawMode,
		selectedId: z.activeId,
		showThumbnails: te
	}), [
		N,
		ie,
		oe,
		se,
		R.scale,
		R.zoomMode,
		U,
		_e,
		W,
		fe,
		me,
		z.isDrawMode,
		z.activeId,
		te
	]);
	a(() => {
		Fe.__store.setState(Ie);
	}, [Fe, Ie]);
	let Le = s(() => he.filter((e) => e.source !== Er.UPLOAD), [he]), Re = s(() => he.filter((e) => e.source === Er.UPLOAD), [he]), ze = s(() => ({
		...Ie,
		api: q,
		configuredAssets: Le,
		uploadedAssets: Re,
		onDownload: g,
		canDownload: v
	}), [
		Ie,
		q,
		Le,
		Re,
		g,
		v
	]);
	return /* @__PURE__ */ p(Hn, {
		value: ye,
		children: /* @__PURE__ */ m("div", {
			className: `rpvs-viewer ${nt.shell}`,
			children: [C ? C({
				viewer: Fe,
				state: Ie,
				labels: ue
			}) : S !== !1 && /* @__PURE__ */ p(Ut, {
				toolbar: S,
				ctx: ze
			}), /* @__PURE__ */ m("div", {
				className: nt.body,
				children: [
					N === "ready" && te && /* @__PURE__ */ p($n, {
						activePageIndex: se,
						onGoToPage: le
					}),
					N === "error" && /* @__PURE__ */ p(ir, {
						error: ie,
						onRetry: ae,
						label: ue.loadFailed,
						retryLabel: ue.retry
					}),
					N === "loading" && /* @__PURE__ */ p(rr, { label: ue.loading }),
					N === "idle" && /* @__PURE__ */ p(ar, { label: ue.noDocument }),
					N === "ready" && /* @__PURE__ */ p(Yn, {
						registerPage: ce,
						renderWindow: L
					})
				]
			})]
		})
	});
}
//#endregion
//#region src/PDFViewer/index.jsx
var Hr = t(function({ src: e, config: t, viewer: n }, r) {
	return /* @__PURE__ */ p(tt, {
		labels: t?.labels,
		children: /* @__PURE__ */ p(Ue, { children: /* @__PURE__ */ p(Ye, { children: /* @__PURE__ */ p(Vr, {
			src: e,
			config: t ?? {},
			viewerRef: r,
			viewer: n
		}) }) })
	});
}), Ur = (e) => e;
function Wr(e, t = Ur) {
	let n = r((t) => e?.subscribe(t) ?? Gr, [e]), i = r(() => t(e?.getState() ?? jr), [e, t]);
	return d(n, i, i);
}
function Gr() {}
//#endregion
export { W as ANNOTATION_TYPES, Ze as DEFAULT_LABELS, Lt as DEFAULT_TOOLBAR_ACTIONS, Hr as PDFViewer, Ir as usePdfViewer, Wr as useViewerState };
