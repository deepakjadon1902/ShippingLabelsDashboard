import { n as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { a as CardTitle, c as cn, i as CardHeader, n as Card, o as Input, r as CardContent, t as Button } from "./card-CB_WnOUQ.mjs";
import { t as Label } from "./label-Bt-7Y7Jq.mjs";
import { C as ArrowLeft, S as Check, a as Search, c as Printer } from "../_libs/lucide-react.mjs";
import { n as CheckboxIndicator, t as Checkbox$1 } from "../_libs/@radix-ui/react-checkbox+[...].mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DhunDVl1.mjs";
import { c as listLabels } from "./labels-B6x_q4OQ.mjs";
import { r as useWebsiteName, t as ShippingLabel } from "./shipping-label-DNNuY6Pe.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as Route } from "./print-C9xmNQ2u.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/print-B5FvWkxr.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Checkbox = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox$1, {
	ref,
	className: cn("grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckboxIndicator, {
		className: cn("grid place-content-center text-current"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-4 w-4" })
	})
}));
Checkbox.displayName = Checkbox$1.displayName;
var LAYOUTS = {
	single: {
		key: "single",
		title: "1 per page (Large)",
		description: "Full A4 — big QR, big barcode, big text",
		perPage: 1,
		pageClass: "print-page-single",
		size: "full"
	},
	half2: {
		key: "half2",
		title: "2 per page (Half page each)",
		description: "Top and bottom half — each label fills its half",
		perPage: 2,
		pageClass: "print-grid-half2",
		size: "half"
	},
	grid4: {
		key: "grid4",
		title: "4 per page (2×2 grid)",
		description: "Classic 4-up grid",
		perPage: 4,
		pageClass: "print-grid-4",
		size: "compact"
	},
	grid8: {
		key: "grid8",
		title: "8 per page (2×4 grid)",
		description: "Compact 2 columns by 4 rows",
		perPage: 8,
		pageClass: "print-grid-8",
		size: "mini"
	}
};
function chunk(arr, n) {
	const out = [];
	for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
	return out;
}
function PrintPage() {
	const { ids } = Route.useSearch();
	const { data: labels = [], isLoading } = useQuery({
		queryKey: ["labels"],
		queryFn: listLabels
	});
	const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [search, setSearch] = (0, import_react.useState)("");
	const [layoutKey, setLayoutKey] = (0, import_react.useState)("grid4");
	const [websiteName, setWebsiteNameValue] = useWebsiteName();
	(0, import_react.useEffect)(() => {
		if (ids) setSelected(new Set(ids.split(",").filter(Boolean)));
	}, [ids]);
	const filtered = (0, import_react.useMemo)(() => {
		const s = search.trim().toLowerCase();
		if (!s) return labels;
		return labels.filter((l) => l.receiver_name.toLowerCase().includes(s) || l.tracking_id.toLowerCase().includes(s) || (l.order_reference ?? "").toLowerCase().includes(s));
	}, [labels, search]);
	const selectedLabels = (0, import_react.useMemo)(() => labels.filter((l) => selected.has(l.id)), [labels, selected]);
	function toggle(id) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}
	function toggleAll() {
		if (selected.size === filtered.length) setSelected(/* @__PURE__ */ new Set());
		else setSelected(new Set(filtered.map((l) => l.id)));
	}
	const canPrint = selectedLabels.length > 0;
	const effectiveLayout = selectedLabels.length === 1 && layoutKey === "grid4" ? LAYOUTS.single : LAYOUTS[layoutKey];
	const pages = (0, import_react.useMemo)(() => chunk(selectedLabels, effectiveLayout.perPage), [selectedLabels, effectiveLayout.perPage]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "no-print p-4 md:p-6 max-w-7xl mx-auto space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2 justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "ghost",
					size: "sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-4 w-4 mr-1" }), " Back"]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2 items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
						value: layoutKey,
						onValueChange: (v) => setLayoutKey(v),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
							className: "w-[260px]",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: Object.values(LAYOUTS).map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
							value: l.key,
							children: l.title
						}, l.key)) })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => window.print(),
						disabled: !canPrint,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "h-4 w-4 mr-1" }),
							"Print ",
							selectedLabels.length > 0 ? `(${selectedLabels.length})` : ""
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
				className: "pt-6 flex flex-wrap items-end gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 min-w-[260px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "site",
						className: "text-xs uppercase tracking-wider text-muted-foreground",
						children: "Website name (shown on every label footer)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "site",
						value: websiteName,
						onChange: (e) => setWebsiteNameValue(e.target.value),
						placeholder: "shriradhagovindstore.com"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						"\"Thank you for your order — ",
						websiteName || "your site",
						"\" appears on every label."
					]
				})]
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, {
					className: "flex flex-row items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Select labels to print" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: toggleAll,
						children: selected.size === filtered.length && filtered.length > 0 ? "Clear" : "Select all"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
					className: "space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "pl-8",
							placeholder: "Search name, tracking ID, order ref…",
							value: search,
							onChange: (e) => setSearch(e.target.value)
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-md border max-h-[520px] overflow-y-auto divide-y",
						children: isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-6 text-center text-muted-foreground text-sm",
							children: "Loading…"
						}) : filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-6 text-center text-muted-foreground text-sm",
							children: "No labels found."
						}) : filtered.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex items-start gap-3 p-3 hover:bg-muted/40 cursor-pointer",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Checkbox, {
									checked: selected.has(l.id),
									onCheckedChange: () => toggle(l.id),
									className: "mt-1"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-medium truncate",
										children: l.receiver_name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-xs text-muted-foreground",
										children: [
											l.courier_name,
											" • ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-mono",
												children: l.tracking_id
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted-foreground whitespace-nowrap",
									children: new Date(l.created_at).toLocaleDateString()
								})
							]
						}, l.id))
					})]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardTitle, { children: [
					"Preview · ",
					effectiveLayout.title,
					" (",
					selectedLabels.length,
					" selected)"
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardContent, { children: selectedLabels.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm text-muted-foreground text-center py-12",
					children: "Pick one or more labels on the left to preview and print."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-4 max-h-[640px] overflow-y-auto",
					children: pages.map((page, pi) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "border rounded-md bg-white p-3 shadow-sm",
						style: { aspectRatio: "210 / 297" },
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewGrid, {
							layout: effectiveLayout,
							page
						})
					}, pi))
				}) })] })]
			})
		]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "print-area",
		"aria-hidden": true,
		children: pages.map((page, pi) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "print-page " + effectiveLayout.pageClass,
			children: effectiveLayout.key === "single" ? page.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShippingLabel, {
				label: l,
				size: "full"
			}, l.id)) : page.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "print-cell",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShippingLabel, {
					label: l,
					size: effectiveLayout.size
				})
			}, l.id))
		}, pi))
	})] });
}
function PreviewGrid({ layout, page }) {
	if (layout.key === "single") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-full",
		children: page.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShippingLabel, {
			label: l,
			size: "full"
		}, l.id))
	});
	if (layout.key === "half2") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		style: {
			display: "grid",
			gridTemplateRows: "1fr 1fr",
			gap: "4mm",
			height: "100%"
		},
		children: page.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-w-0 min-h-0 flex",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShippingLabel, {
				label: l,
				size: "half"
			})
		}, l.id))
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		style: {
			display: "grid",
			gridTemplateColumns: "1fr 1fr",
			gap: "3mm",
			alignContent: "start"
		},
		children: page.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-w-0",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShippingLabel, {
				label: l,
				size: layout.size
			})
		}, l.id))
	});
}
//#endregion
export { PrintPage as component };
