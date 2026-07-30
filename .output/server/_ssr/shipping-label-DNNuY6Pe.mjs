import { n as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { o as getQrPayload } from "./labels-B6x_q4OQ.mjs";
import { t as QRCodeSVG } from "../_libs/qrcode.react.mjs";
import { t as require_react_barcode } from "../_libs/react-barcode.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/shipping-label-DNNuY6Pe.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_react_barcode = /* @__PURE__ */ __toESM(require_react_barcode());
var KEY = "shiplabel:website_name";
var DEFAULT_WEBSITE_NAME = "shriradhagovindstore.com";
function getWebsiteName() {
	if (typeof window === "undefined") return DEFAULT_WEBSITE_NAME;
	return window.localStorage.getItem(KEY) ?? "shriradhagovindstore.com";
}
function setWebsiteName(value) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(KEY, value);
	window.dispatchEvent(new Event("shiplabel:settings"));
}
function useWebsiteName() {
	const [name, setName] = (0, import_react.useState)(DEFAULT_WEBSITE_NAME);
	(0, import_react.useEffect)(() => {
		setName(getWebsiteName());
		const handler = () => setName(getWebsiteName());
		window.addEventListener("shiplabel:settings", handler);
		window.addEventListener("storage", handler);
		return () => {
			window.removeEventListener("shiplabel:settings", handler);
			window.removeEventListener("storage", handler);
		};
	}, []);
	return [name, (v) => {
		setWebsiteName(v);
		setName(v);
	}];
}
var SENDERS_KEY = "shiplabel:sender_profiles";
var DEFAULT_SENDERS = [{
	name: "Shri Radha Govind Store",
	address: "",
	phone: "",
	website: "shriradhagovindstore.com",
	review_url: ""
}, {
	name: "Profile 2",
	address: "",
	phone: "",
	website: "",
	review_url: ""
}];
function getSenderProfiles() {
	if (typeof window === "undefined") return DEFAULT_SENDERS;
	try {
		const raw = window.localStorage.getItem(SENDERS_KEY);
		if (!raw) return DEFAULT_SENDERS;
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed) && parsed.length === 2) return [{
			...DEFAULT_SENDERS[0],
			...parsed[0]
		}, {
			...DEFAULT_SENDERS[1],
			...parsed[1]
		}];
	} catch {}
	return DEFAULT_SENDERS;
}
function setSenderProfiles(profiles) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(SENDERS_KEY, JSON.stringify(profiles));
	window.dispatchEvent(new Event("shiplabel:settings"));
}
function useSenderProfiles() {
	const [profiles, setProfiles] = (0, import_react.useState)(DEFAULT_SENDERS);
	(0, import_react.useEffect)(() => {
		setProfiles(getSenderProfiles());
		const handler = () => setProfiles(getSenderProfiles());
		window.addEventListener("shiplabel:settings", handler);
		window.addEventListener("storage", handler);
		return () => {
			window.removeEventListener("shiplabel:settings", handler);
			window.removeEventListener("storage", handler);
		};
	}, []);
	return [profiles, (p) => {
		setSenderProfiles(p);
		setProfiles(p);
	}];
}
function ShippingLabel({ label, size = "compact" }) {
	const [websiteName] = useWebsiteName();
	const isFull = size === "full";
	const isHalf = size === "half";
	const isMini = size === "mini";
	const qrSize = isFull ? 168 : isHalf ? 118 : isMini ? 62 : 84;
	const reviewQrSize = isFull ? 110 : isHalf ? 78 : isMini ? 44 : 60;
	const barcodeHeight = isFull ? 90 : isHalf ? 60 : isMini ? 32 : 44;
	const barcodeWidth = isFull ? 3 : isHalf ? 2 : isMini ? 1.2 : 1.6;
	const barcodeFontSize = isFull ? 20 : isHalf ? 14 : isMini ? 10 : 12;
	const trackingForBarcode = (label.tracking_id || "").trim();
	const canRenderBarcode = trackingForBarcode.length > 0 && trackingForBarcode !== "-";
	const containerClass = isFull ? "print-label-full text-black bg-white text-lg leading-snug p-6" : isHalf ? "print-label-half text-black bg-white text-[14px] leading-snug p-4" : isMini ? "print-label text-black bg-white text-[10px] leading-tight p-2" : "print-label text-black bg-white text-[11.5px] leading-tight p-2.5";
	const hasSender = !!(label.sender_name || label.sender_address || label.sender_phone || label.sender_website);
	const hasReviewQr = !!(label.sender_review_url && label.sender_review_url.trim());
	const fromLabelSize = isFull ? "text-sm" : isHalf ? "text-[10px]" : isMini ? "text-[7px]" : "text-[9px]";
	const fromNameSize = isFull ? "text-[16px]" : isHalf ? "text-[12px]" : isMini ? "text-[9px]" : "text-[11px]";
	const fromBodySize = isFull ? "text-[13px]" : isHalf ? "text-[10px]" : isMini ? "text-[7.5px]" : "text-[9.5px]";
	const returnNoteSize = isFull ? "text-[11px]" : isHalf ? "text-[9px]" : isMini ? "text-[6.5px]" : "text-[8px]";
	const reviewCaptionSize = isFull ? "text-[11px]" : isHalf ? "text-[8.5px]" : isMini ? "text-[6px]" : "text-[7.5px]";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `${containerClass} border border-dashed border-black flex flex-col w-full overflow-hidden`,
		style: {
			fontFamily: "'Outfit', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
			fontFeatureSettings: "'tnum' 1, 'cv11' 1"
		},
		children: [
			hasSender || hasReviewQr ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between pb-2 mb-2 border-b border-black/25 " + (isMini ? "gap-2" : isFull ? "gap-4" : "gap-3"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 min-w-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `font-semibold tracking-[0.2em] uppercase text-black/60 ${fromLabelSize}`,
							children: "From"
						}),
						label.sender_name ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `font-bold leading-snug ${fromNameSize}`,
							children: label.sender_name
						}) : null,
						label.sender_address ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `leading-snug text-black/85 break-words whitespace-pre-line ${fromBodySize}`,
							children: label.sender_address
						}) : null,
						label.sender_phone ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `leading-snug ${fromBodySize}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-black/60 font-semibold",
								children: "Phone: "
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold",
								children: label.sender_phone
							})]
						}) : null,
						label.sender_website ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `leading-snug ${fromBodySize}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-black/60 font-semibold",
								children: "Web: "
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold",
								children: label.sender_website
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `italic text-black/70 mt-0.5 ${returnNoteSize}`,
							children: "If undelivered, please return to above address."
						})
					]
				}), hasReviewQr ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `bg-white border border-black ${isMini ? "p-0.5" : "p-1"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QRCodeSVG, {
							value: label.sender_review_url.trim(),
							size: reviewQrSize,
							level: "M",
							includeMargin: false
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `text-center mt-0.5 font-medium text-black/80 ${reviewCaptionSize}`,
						children: "Scan to leave us a review"
					})]
				}) : null]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `flex ${isMini ? "gap-2" : isFull ? "gap-6" : isHalf ? "gap-4" : "gap-3"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 min-w-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-semibold tracking-[0.2em] uppercase text-black/60 " + (isFull ? "text-base" : isHalf ? "text-xs" : isMini ? "text-[8px]" : "text-[10px]"),
							children: "To"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-extrabold tracking-tight leading-snug " + (isFull ? "text-[34px]" : isHalf ? "text-[22px]" : isMini ? "text-[13px]" : "text-[16px]"),
							children: label.receiver_name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1 break-words leading-snug text-black/90 " + (isFull ? "text-[20px]" : isHalf ? "text-[14.5px]" : isMini ? "text-[10px]" : "text-[12px]"),
							children: [
								label.receiver_address_line1,
								label.receiver_address_line2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}), label.receiver_address_line2] }) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								label.receiver_city,
								", ",
								label.receiver_state,
								" -",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
									className: "tracking-wide",
									children: label.receiver_pincode
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `mt-1 ${isFull ? "text-[20px]" : isHalf ? "text-[15px]" : isMini ? "text-[10.5px]" : "text-[12.5px]"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "uppercase tracking-wider font-semibold text-black/60 text-[0.85em]",
									children: ["Mob -", " "]
								}),
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-semibold tracking-wide",
									children: [label.receiver_mobile_1, label.receiver_mobile_2 ? `, ${label.receiver_mobile_2}` : ""]
								})
							]
						}),
						label.order_reference ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `mt-0.5 ${isFull ? "text-[20px]" : isHalf ? "text-[15px]" : isMini ? "text-[10.5px]" : "text-[12.5px]"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "uppercase tracking-wider font-semibold text-black/60 text-[0.85em]",
									children: ["Order Ref -", " "]
								}),
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold tracking-wide",
									children: label.order_reference
								})
							]
						}) : null
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `bg-white border border-black ${isMini ? "p-1" : isFull ? "p-2" : "p-1.5"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QRCodeSVG, {
							value: getQrPayload(label.courier_name, label.tracking_id),
							size: qrSize,
							level: "M",
							includeMargin: false
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-center mt-1 font-semibold uppercase tracking-wider " + (isFull ? "text-[13px]" : isHalf ? "text-[10px]" : isMini ? "text-[7px]" : "text-[8px]"),
						children: "Scan QR for Tracking"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `text-center ${isFull ? "mt-4 text-[19px]" : isHalf ? "mt-3 text-[14px]" : isMini ? "mt-2 text-[10px]" : "mt-2 text-[12px]"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-baseline justify-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "uppercase tracking-wider font-semibold text-black/60",
						children: "Courier:"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-bold",
						children: label.courier_name
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-baseline justify-center gap-1.5 mt-0.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "uppercase tracking-wider font-semibold text-black/60",
						children: "AWB:"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `font-bold tracking-wider ${isFull ? "text-[22px]" : isHalf ? "text-[16px]" : isMini ? "text-[11px]" : "text-[14px]"}`,
						children: label.tracking_id
					})]
				})]
			}),
			canRenderBarcode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `flex justify-center items-center ${isFull ? "mt-2" : "mt-1"}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_barcode.default, {
					value: trackingForBarcode,
					format: "CODE128",
					height: barcodeHeight,
					width: barcodeWidth,
					fontSize: barcodeFontSize,
					margin: 0,
					displayValue: true,
					background: "#ffffff",
					lineColor: "#000000",
					textAlign: "center",
					font: "'Outfit', 'Inter', 'Helvetica Neue', Arial, sans-serif"
				})
			}) : null,
			websiteName ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pt-1 border-t border-black/20 text-center font-medium tracking-wide text-black/70 " + (isFull ? "mt-3 text-[14px]" : isHalf ? "mt-2 text-[11px]" : isMini ? "mt-1 text-[7.5px]" : "mt-1 text-[9px]"),
				children: ["Thank you for your order - ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-semibold text-black",
					children: websiteName
				})]
			}) : null
		]
	});
}
//#endregion
export { useSenderProfiles as n, useWebsiteName as r, ShippingLabel as t };
