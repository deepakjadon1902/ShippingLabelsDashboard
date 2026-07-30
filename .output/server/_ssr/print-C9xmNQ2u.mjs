import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as stringType, t as objectType } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/print-C9xmNQ2u.js
var $$splitComponentImporter = () => import("./print-B5FvWkxr.mjs");
var searchSchema = objectType({ ids: stringType().optional() });
var Route = createFileRoute("/print")({
	head: () => ({ meta: [
		{ title: "Print Labels — ShippingLabelsDashboard" },
		{
			name: "description",
			content: "Select labels and print them on A4 in flexible grid layouts."
		},
		{
			property: "og:title",
			content: "Print Labels — ShippingLabelsDashboard"
		},
		{
			property: "og:description",
			content: "Print your saved shipping labels on A4."
		}
	] }),
	validateSearch: (search) => searchSchema.parse(search),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
