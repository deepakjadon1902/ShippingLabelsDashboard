//#region node_modules/.nitro/vite/services/ssr/assets/labels-B6x_q4OQ.js
var COMMON_COURIERS = [
	"Delhivery",
	"Shree Maruti Courier",
	"DTDC",
	"Xpressbees",
	"Ecom Express",
	"Shadowfax",
	"India Post"
];
var STATUSES = [
	"Pending",
	"Shipped",
	"Delivered",
	"RTO"
];
function getQrPayload(_courier, trackingId) {
	return trackingId;
}
var API_BASE_URL = "/api".replace(/\/$/, "");
async function api(path, init) {
	const res = await fetch(`${API_BASE_URL}${path}`, {
		...init,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...init?.headers ?? {}
		}
	});
	if (!res.ok) {
		const payload = await res.json().catch(() => ({}));
		throw new Error(payload.error ?? `Request failed (${res.status})`);
	}
	if (res.status === 204) return void 0;
	return await res.json();
}
async function listLabels() {
	return api("/labels");
}
async function getLabel(id) {
	try {
		return await api(`/labels/${id}`);
	} catch (error) {
		if (error.message === "Label not found") return null;
		throw error;
	}
}
async function createLabel(input) {
	return api("/labels", {
		method: "POST",
		body: JSON.stringify(input)
	});
}
async function updateLabel(id, input) {
	return api(`/labels/${id}`, {
		method: "PATCH",
		body: JSON.stringify(input)
	});
}
async function deleteLabel(id) {
	await api(`/labels/${id}`, { method: "DELETE" });
}
async function getTrackingCredsStatus() {
	return api("/tracking/credentials");
}
async function refreshLabelTracking(id) {
	return api(`/tracking/labels/${id}/refresh`, { method: "POST" });
}
async function refreshAllTracking() {
	return api("/tracking/refresh-all", { method: "POST" });
}
async function registerTrackingMoreForLabel(id) {
	return api(`/tracking/labels/${id}/register`, { method: "POST" });
}
//#endregion
export { getLabel as a, listLabels as c, registerTrackingMoreForLabel as d, updateLabel as f, deleteLabel as i, refreshAllTracking as l, STATUSES as n, getQrPayload as o, createLabel as r, getTrackingCredsStatus as s, COMMON_COURIERS as t, refreshLabelTracking as u };
