import { n as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { a as CardTitle, i as CardHeader, n as Card, o as Input, r as CardContent, t as Button } from "./card-CB_WnOUQ.mjs";
import { t as Label } from "./label-Bt-7Y7Jq.mjs";
import { t as Textarea } from "./textarea-BfEq5a4_.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DhunDVl1.mjs";
import { d as registerTrackingMoreForLabel, n as STATUSES, r as createLabel, t as COMMON_COURIERS } from "./labels-B6x_q4OQ.mjs";
import { n as useSenderProfiles, t as ShippingLabel } from "./shipping-label-DNNuY6Pe.mjs";
import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/create-OEwMMRQt.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var OTHER = "__other__";
var emptyForm = {
	receiver_name: "",
	receiver_address_line1: "",
	receiver_address_line2: "",
	receiver_city: "",
	receiver_state: "",
	receiver_pincode: "",
	receiver_mobile_1: "",
	receiver_mobile_2: "",
	courier_name: "",
	tracking_id: "",
	order_reference: "",
	status: "Pending",
	notes: "",
	sender_name: "",
	sender_address: "",
	sender_phone: "",
	sender_website: "",
	sender_review_url: ""
};
function CreateLabelPage() {
	const navigate = useNavigate();
	const [profiles] = useSenderProfiles();
	const [form, setForm] = (0, import_react.useState)(emptyForm);
	const [courierSelection, setCourierSelection] = (0, import_react.useState)("");
	const [customCourier, setCustomCourier] = (0, import_react.useState)("");
	const [senderIdx, setSenderIdx] = (0, import_react.useState)("0");
	const [saved, setSaved] = (0, import_react.useState)(null);
	const activeCourier = courierSelection === OTHER ? customCourier : courierSelection;
	const activeSender = profiles[senderIdx === "1" ? 1 : 0];
	const isValid = (0, import_react.useMemo)(() => {
		return form.receiver_name.trim() && form.receiver_address_line1.trim() && form.receiver_city.trim() && form.receiver_state.trim() && form.receiver_pincode.trim() && form.receiver_mobile_1.trim() && activeCourier.trim() && form.tracking_id.trim();
	}, [form, activeCourier]);
	const previewLabel = {
		id: "preview",
		created_at: (/* @__PURE__ */ new Date()).toISOString(),
		...form,
		courier_name: activeCourier || "—",
		tracking_id: form.tracking_id || "—",
		receiver_address_line2: form.receiver_address_line2 || null,
		receiver_mobile_2: form.receiver_mobile_2 || null,
		order_reference: form.order_reference || null,
		notes: form.notes || null,
		sender_name: activeSender.name || null,
		sender_address: activeSender.address || null,
		sender_phone: activeSender.phone || null,
		sender_website: activeSender.website || null,
		sender_review_url: activeSender.review_url || null
	};
	const mutation = useMutation({
		mutationFn: (input) => createLabel(input),
		onSuccess: (data) => {
			setSaved(data);
			toast.success("Label saved");
			if ([
				"Shadowfax",
				"Xpressbees",
				"Ecom Express",
				"India Post",
				"Delhivery",
				"DTDC",
				"Shree Maruti Courier"
			].includes(data.courier_name)) registerTrackingMoreForLabel(data.id).catch(() => {});
		},
		onError: (e) => toast.error(e.message)
	});
	function handleSubmit(e) {
		e.preventDefault();
		if (!isValid) {
			toast.error("Please fill all required fields");
			return;
		}
		mutation.mutate({
			...form,
			courier_name: activeCourier.trim(),
			receiver_address_line2: form.receiver_address_line2?.trim() || null,
			receiver_mobile_2: form.receiver_mobile_2?.trim() || null,
			order_reference: form.order_reference?.trim() || null,
			notes: form.notes?.trim() || null,
			sender_name: activeSender.name?.trim() || null,
			sender_address: activeSender.address?.trim() || null,
			sender_phone: activeSender.phone?.trim() || null,
			sender_website: activeSender.website?.trim() || null,
			sender_review_url: activeSender.review_url?.trim() || null
		});
	}
	function set(key, value) {
		setForm((f) => ({
			...f,
			[key]: value
		}));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-4 md:p-6 max-w-7xl mx-auto grid gap-6 md:grid-cols-[minmax(0,1fr)_420px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "New shipping label" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardContent, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: handleSubmit,
			className: "space-y-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "From (Sender)",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, {
						label: "Sender profile *",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: senderIdx,
							onValueChange: setSenderIdx,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: "0",
								children: profiles[0].name || "Profile 1"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: "1",
								children: profiles[1].name || "Profile 2"
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground mt-1",
							children: "Edit these profiles in Settings. The chosen profile is snapshotted onto this label."
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
					title: "Receiver",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Full name *",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: form.receiver_name,
								onChange: (e) => set("receiver_name", e.target.value),
								required: true
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Address line 1 *",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: form.receiver_address_line1,
								onChange: (e) => set("receiver_address_line1", e.target.value),
								required: true
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Address line 2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: form.receiver_address_line2 ?? "",
								onChange: (e) => set("receiver_address_line2", e.target.value)
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 md:grid-cols-3 gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "City *",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: form.receiver_city,
										onChange: (e) => set("receiver_city", e.target.value),
										required: true
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "State *",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: form.receiver_state,
										onChange: (e) => set("receiver_state", e.target.value),
										required: true
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Pincode *",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: form.receiver_pincode,
										onChange: (e) => set("receiver_pincode", e.target.value),
										required: true
									})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Mobile 1 *",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: form.receiver_mobile_1,
									onChange: (e) => set("receiver_mobile_1", e.target.value),
									required: true
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Mobile 2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: form.receiver_mobile_2 ?? "",
									onChange: (e) => set("receiver_mobile_2", e.target.value)
								})
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
					title: "Shipment",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, {
							label: "Courier *",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
								value: courierSelection,
								onValueChange: setCourierSelection,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Select courier" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [COMMON_COURIERS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
									value: c,
									children: c
								}, c)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
									value: OTHER,
									children: "Other (type manually)"
								})] })]
							}), courierSelection === OTHER && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-2",
								placeholder: "Enter courier name",
								value: customCourier,
								onChange: (e) => setCustomCourier(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Tracking / AWB *",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: form.tracking_id,
									onChange: (e) => set("tracking_id", e.target.value),
									required: true
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Order reference",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: form.order_reference ?? "",
									onChange: (e) => set("order_reference", e.target.value)
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Status",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
								value: form.status,
								onValueChange: (v) => set("status", v),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
									value: s,
									children: s
								}, s)) })]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Notes",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								rows: 2,
								value: form.notes ?? "",
								onChange: (e) => set("notes", e.target.value)
							})
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: mutation.isPending,
						children: mutation.isPending ? "Saving…" : "Save label"
					}), saved && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "outline",
						onClick: () => navigate({
							to: "/print",
							search: { ids: saved.id }
						}),
						children: "Print this label"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "ghost",
						onClick: () => {
							setForm(emptyForm);
							setCourierSelection("");
							setCustomCourier("");
							setSaved(null);
						},
						children: "Create another"
					})] })]
				})
			]
		}) })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-medium text-muted-foreground",
					children: "Live preview"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-full max-w-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShippingLabel, {
						label: previewLabel,
						size: "compact"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "The tracking QR encodes the AWB. The smaller QR (top-left) encodes the sender's Google Review link."
				})
			]
		})]
	});
}
function Section({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "text-sm font-semibold uppercase tracking-wide text-muted-foreground",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-3",
			children
		})]
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
			className: "text-xs",
			children: label
		}), children]
	});
}
//#endregion
export { CreateLabelPage as component };
