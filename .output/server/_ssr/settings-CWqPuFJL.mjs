import { n as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { a as CardTitle, i as CardHeader, n as Card, o as Input, r as CardContent, t as Button } from "./card-CB_WnOUQ.mjs";
import { t as Label } from "./label-Bt-7Y7Jq.mjs";
import { t as Textarea } from "./textarea-BfEq5a4_.mjs";
import { g as CircleX, m as KeyRound, v as CircleCheck } from "../_libs/lucide-react.mjs";
import { s as getTrackingCredsStatus } from "./labels-B6x_q4OQ.mjs";
import { n as useSenderProfiles, t as ShippingLabel } from "./shipping-label-DNNuY6Pe.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Badge } from "./badge-BcnkvaDn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-CWqPuFJL.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CredRow({ label, configured, note }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start justify-between gap-4 py-3 border-b last:border-b-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "h-4 w-4 mt-1 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-medium",
				children: label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-muted-foreground mt-0.5",
				children: note
			})] })]
		}), configured ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
			className: "bg-green-100 text-green-900 border-green-200 gap-1",
			variant: "outline",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-3 w-3" }), " Configured"]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
			className: "bg-red-100 text-red-900 border-red-200 gap-1",
			variant: "outline",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "h-3 w-3" }), " Missing"]
		})]
	});
}
function FieldRow({ label, value, saved, onChange, onSave, multiline, placeholder }) {
	const dirty = value !== saved;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
			className: "text-xs",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex gap-2 items-start",
			children: [multiline ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				rows: 3,
				value,
				placeholder,
				onChange: (e) => onChange(e.target.value),
				className: "flex-1"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value,
				placeholder,
				onChange: (e) => onChange(e.target.value),
				className: "flex-1"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: dirty ? "default" : "outline",
				disabled: !dirty,
				onClick: onSave,
				children: "Save"
			})]
		})]
	});
}
function SenderEditor({ title, value, onChange, onSaveField, saved }) {
	function set(key, v) {
		onChange({
			...value,
			[key]: v
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, {
		className: "text-base",
		children: title
	}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "Company name",
				value: value.name,
				saved: saved.name,
				onChange: (v) => set("name", v),
				onSave: () => onSaveField("name")
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "Full address",
				multiline: true,
				value: value.address,
				saved: saved.address,
				onChange: (v) => set("address", v),
				onSave: () => onSaveField("address")
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "Phone",
				value: value.phone,
				saved: saved.phone,
				onChange: (v) => set("phone", v),
				onSave: () => onSaveField("phone")
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "Website",
				value: value.website,
				saved: saved.website,
				onChange: (v) => set("website", v),
				onSave: () => onSaveField("website")
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "Google Review link",
				value: value.review_url,
				saved: saved.review_url,
				placeholder: "https://g.page/r/xxxxxxxx/review",
				onChange: (v) => set("review_url", v),
				onSave: () => onSaveField("review_url")
			})
		]
	})] });
}
function SettingsPage() {
	const { data, isLoading } = useQuery({
		queryKey: ["tracking-creds"],
		queryFn: getTrackingCredsStatus
	});
	const [profiles, saveProfiles] = useSenderProfiles();
	const [draft, setDraft] = (0, import_react.useState)(profiles);
	const [previewIdx, setPreviewIdx] = (0, import_react.useState)(0);
	const previewSender = draft[previewIdx];
	const previewLabel = {
		id: "preview",
		created_at: (/* @__PURE__ */ new Date()).toISOString(),
		receiver_name: "Ramesh Kumar",
		receiver_address_line1: "12, Radha Nagar, Near Iskcon Temple",
		receiver_address_line2: "Opp. Central Park",
		receiver_city: "Vrindavan",
		receiver_state: "Uttar Pradesh",
		receiver_pincode: "281121",
		receiver_mobile_1: "9876543210",
		receiver_mobile_2: null,
		courier_name: "Delhivery",
		tracking_id: "1234567890",
		order_reference: "SRG-0001",
		status: "Pending",
		notes: null,
		sender_name: previewSender.name || null,
		sender_address: previewSender.address || null,
		sender_phone: previewSender.phone || null,
		sender_website: previewSender.website || null,
		sender_review_url: previewSender.review_url || null
	};
	function handleSave() {
		saveProfiles(draft);
		toast.success("Sender profiles saved");
	}
	function handleReset() {
		setDraft(profiles);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "p-4 md:p-6 max-w-5xl mx-auto space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-2xl font-semibold",
				children: "Settings"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground mt-1",
				children: "Manage sender return-address profiles and courier tracking API keys."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-end justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-lg font-semibold",
							children: "Sender profiles"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: "Edit any field and click its Save button. Past labels keep their snapshot."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: handleReset,
								children: "Discard changes"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								onClick: handleSave,
								children: "Save all"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 md:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SenderEditor, {
							title: "Profile 1",
							value: draft[0],
							saved: profiles[0],
							onChange: (v) => setDraft([v, draft[1]]),
							onSaveField: (key) => {
								const next = [{
									...profiles[0],
									[key]: draft[0][key]
								}, profiles[1]];
								saveProfiles(next);
								toast.success(`Profile 1 · ${key} saved`);
							}
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SenderEditor, {
							title: "Profile 2",
							value: draft[1],
							saved: profiles[1],
							onChange: (v) => setDraft([draft[0], v]),
							onSaveField: (key) => {
								const next = [profiles[0], {
									...profiles[1],
									[key]: draft[1][key]
								}];
								saveProfiles(next);
								toast.success(`Profile 2 · ${key} saved`);
							}
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, {
						className: "text-base",
						children: "Sample label preview"
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
						className: "space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: previewIdx === 0 ? "default" : "outline",
									onClick: () => setPreviewIdx(0),
									children: "Preview with Profile 1"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: previewIdx === 1 ? "default" : "outline",
									onClick: () => setPreviewIdx(1),
									children: "Preview with Profile 2"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-full max-w-md",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShippingLabel, {
									label: previewLabel,
									size: "compact"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Save profiles above to lock in changes. The preview updates live as you edit."
							})
						]
					})] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Live tracking credentials" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardContent, { children: isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Checking…"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CredRow, {
					label: "Delhivery API token",
					configured: !!data?.delhivery,
					note: "Direct API. Used for labels where Courier = Delhivery."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CredRow, {
					label: "DTDC API token",
					configured: !!data?.dtdc,
					note: "Direct API. Used for labels where Courier = DTDC."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CredRow, {
					label: "TrackingMore API key",
					configured: !!data?.trackingmore,
					note: "Unified tracker for Shadowfax, Xpressbees, Ecom Express, India Post, Shree Maruti."
				})
			] }) })] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "How to update or rotate keys" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
				className: "text-sm space-y-2 text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					"To add, replace or rotate any of the keys above, just tell the assistant in chat — e.g.",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "\"update my Delhivery API token\"" }),
					" — and a secure prompt will open for you to paste the value. Keys are stored on the server and used only by the twice-daily refresh job and the manual \"Refresh\" buttons on the dashboard."
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					"Automatic refresh runs at ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "09:00 IST" }),
					" and ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "18:00 IST" }),
					" ",
					"daily. Only labels whose status is not Delivered or RTO are processed."
				] })]
			})] })
		]
	});
}
//#endregion
export { SettingsPage as component };
