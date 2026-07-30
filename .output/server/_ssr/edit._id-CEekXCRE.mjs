import { n as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { a as CardTitle, i as CardHeader, n as Card, o as Input, r as CardContent, t as Button } from "./card-CB_WnOUQ.mjs";
import { t as Label } from "./label-Bt-7Y7Jq.mjs";
import { t as Textarea } from "./textarea-BfEq5a4_.mjs";
import { C as ArrowLeft } from "../_libs/lucide-react.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-DhunDVl1.mjs";
import { a as getLabel, f as updateLabel, n as STATUSES, t as COMMON_COURIERS } from "./labels-B6x_q4OQ.mjs";
import { n as useSenderProfiles, t as ShippingLabel } from "./shipping-label-DNNuY6Pe.mjs";
import { _ as useNavigate, g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Route } from "./edit._id-BPm0zePB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/edit._id-CEekXCRE.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var OTHER = "__other__";
var SENDER_KEEP = "__keep__";
function EditLabelPage() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const [profiles] = useSenderProfiles();
	const { data, isLoading, error } = useQuery({
		queryKey: ["labels", id],
		queryFn: () => getLabel(id)
	});
	const [form, setForm] = (0, import_react.useState)(null);
	const [courierSelection, setCourierSelection] = (0, import_react.useState)("");
	const [customCourier, setCustomCourier] = (0, import_react.useState)("");
	const [senderChoice, setSenderChoice] = (0, import_react.useState)(SENDER_KEEP);
	(0, import_react.useEffect)(() => {
		if (data) {
			setForm({
				receiver_name: data.receiver_name,
				receiver_address_line1: data.receiver_address_line1,
				receiver_address_line2: data.receiver_address_line2 ?? "",
				receiver_city: data.receiver_city,
				receiver_state: data.receiver_state,
				receiver_pincode: data.receiver_pincode,
				receiver_mobile_1: data.receiver_mobile_1,
				receiver_mobile_2: data.receiver_mobile_2 ?? "",
				courier_name: data.courier_name,
				tracking_id: data.tracking_id,
				order_reference: data.order_reference ?? "",
				status: data.status,
				notes: data.notes ?? "",
				sender_name: data.sender_name ?? "",
				sender_address: data.sender_address ?? "",
				sender_phone: data.sender_phone ?? "",
				sender_website: data.sender_website ?? "",
				sender_review_url: data.sender_review_url ?? ""
			});
			if (COMMON_COURIERS.includes(data.courier_name)) setCourierSelection(data.courier_name);
			else {
				setCourierSelection(OTHER);
				setCustomCourier(data.courier_name);
			}
		}
	}, [data]);
	const mutation = useMutation({
		mutationFn: (input) => updateLabel(id, input),
		onSuccess: () => {
			toast.success("Label updated");
			navigate({ to: "/" });
		},
		onError: (e) => toast.error(e.message)
	});
	const activeCourier = courierSelection === OTHER ? customCourier : courierSelection;
	const overrideSender = senderChoice === "0" || senderChoice === "1" ? profiles[senderChoice === "1" ? 1 : 0] : null;
	const previewLabel = (0, import_react.useMemo)(() => {
		if (!form) return null;
		return {
			id,
			created_at: data?.created_at ?? (/* @__PURE__ */ new Date()).toISOString(),
			...form,
			courier_name: activeCourier || "—",
			tracking_id: form.tracking_id || "—",
			receiver_address_line2: form.receiver_address_line2 || null,
			receiver_mobile_2: form.receiver_mobile_2 || null,
			order_reference: form.order_reference || null,
			notes: form.notes || null,
			sender_name: (overrideSender?.name ?? form.sender_name) || null,
			sender_address: (overrideSender?.address ?? form.sender_address) || null,
			sender_phone: (overrideSender?.phone ?? form.sender_phone) || null,
			sender_website: (overrideSender?.website ?? form.sender_website) || null,
			sender_review_url: (overrideSender?.review_url ?? form.sender_review_url) || null
		};
	}, [
		form,
		id,
		data,
		activeCourier,
		overrideSender
	]);
	if (isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "p-6 text-muted-foreground",
		children: "Loading…"
	});
	if (error) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "p-6 text-destructive",
		children: error.message
	});
	if (!data || !form || !previewLabel) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "p-6 text-muted-foreground",
		children: "Label not found."
	});
	function set(key, value) {
		setForm((f) => f ? {
			...f,
			[key]: value
		} : f);
	}
	function handleSubmit(e) {
		e.preventDefault();
		if (!form) return;
		if (!activeCourier.trim()) {
			toast.error("Courier is required");
			return;
		}
		const senderFields = overrideSender ? {
			sender_name: overrideSender.name?.trim() || null,
			sender_address: overrideSender.address?.trim() || null,
			sender_phone: overrideSender.phone?.trim() || null,
			sender_website: overrideSender.website?.trim() || null,
			sender_review_url: overrideSender.review_url?.trim() || null
		} : {
			sender_name: form.sender_name?.trim() || null,
			sender_address: form.sender_address?.trim() || null,
			sender_phone: form.sender_phone?.trim() || null,
			sender_website: form.sender_website?.trim() || null,
			sender_review_url: form.sender_review_url?.trim() || null
		};
		mutation.mutate({
			...form,
			courier_name: activeCourier.trim(),
			receiver_address_line2: form.receiver_address_line2?.trim() || null,
			receiver_mobile_2: form.receiver_mobile_2?.trim() || null,
			order_reference: form.order_reference?.trim() || null,
			notes: form.notes?.trim() || null,
			...senderFields
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-4 md:p-6 max-w-7xl mx-auto space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			asChild: true,
			variant: "ghost",
			size: "sm",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-4 w-4 mr-1" }), " Back"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-6 md:grid-cols-[minmax(0,1fr)_420px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Edit label" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardContent, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: handleSubmit,
				className: "space-y-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Sender profile",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
								value: senderChoice,
								onValueChange: setSenderChoice,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem, {
										value: SENDER_KEEP,
										children: ["Keep original ", data.sender_name ? `(${data.sender_name})` : "(none)"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem, {
										value: "0",
										children: ["Switch to: ", profiles[0].name || "Profile 1"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem, {
										value: "1",
										children: ["Switch to: ", profiles[1].name || "Profile 2"]
									})
								] })]
							})
						}),
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
						}),
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
								value: customCourier,
								placeholder: "Enter courier name",
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
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: mutation.isPending,
						children: mutation.isPending ? "Saving…" : "Save changes"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "outline",
						onClick: () => navigate({
							to: "/print",
							search: { ids: id }
						}),
						children: "Print this label"
					})]
				})]
			}) })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-medium text-muted-foreground",
					children: "Live preview"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-full max-w-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShippingLabel, {
						label: previewLabel,
						size: "compact"
					})
				})]
			})]
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
export { EditLabelPage as component };
