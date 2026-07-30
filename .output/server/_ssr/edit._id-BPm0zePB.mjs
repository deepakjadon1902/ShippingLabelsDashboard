import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/edit._id-BPm0zePB.js
var $$splitComponentImporter = () => import("./edit._id-CEekXCRE.mjs");
var Route = createFileRoute("/edit/$id")({
	head: () => ({ meta: [
		{ title: "Edit Label — ShippingLabelsDashboard" },
		{
			name: "description",
			content: "Edit an existing shipping label."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
