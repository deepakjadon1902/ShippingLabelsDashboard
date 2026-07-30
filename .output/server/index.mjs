globalThis.__nitro_main__ = import.meta.url;
import { a as FastResponse, n as HTTPError, r as defineLazyEventHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { t as HookableCore } from "./_libs/hookable.mjs";
//#region #nitro-vite-setup
function lazyService(loader) {
	let promise, mod;
	return { fetch(req) {
		if (mod) return mod.fetch(req);
		if (!promise) promise = loader().then((_mod) => mod = _mod.default || _mod);
		return promise.then((mod) => mod.fetch(req));
	} };
}
var services = { ["ssr"]: lazyService(() => import("./_ssr/ssr.mjs")) };
globalThis.__nitro_vite_envs__ = services;
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/app-logo.svg": {
		"type": "image/svg+xml",
		"etag": "\"373-vgxdkTk2tZXFGjadMFdK5/635Vk\"",
		"mtime": "2026-07-24T11:11:57.539Z",
		"size": 883,
		"path": "../public/app-logo.svg"
	},
	"/favicon.svg": {
		"type": "image/svg+xml",
		"etag": "\"1a2-FTagp2kLDdVyOc9MLQYvnHgDm5o\"",
		"mtime": "2026-07-24T07:26:14.265Z",
		"size": 418,
		"path": "../public/favicon.svg"
	},
	"/assets/arrow-left-C-zI0duC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-P0Z8G8fh6cbtsyH8vNzKqc9w0/s\"",
		"mtime": "2026-07-25T12:22:07.735Z",
		"size": 153,
		"path": "../public/assets/arrow-left-C-zI0duC.js"
	},
	"/assets/badge-qpqy_YbB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"364-h/AMlOPoLT/Nx/Uf2gNg+0y9nRU\"",
		"mtime": "2026-07-25T12:22:07.736Z",
		"size": 868,
		"path": "../public/assets/badge-qpqy_YbB.js"
	},
	"/assets/card-DzYo5CXc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d7fb-Zh5metIddNjSUpkSxGAXd6AjhTk\"",
		"mtime": "2026-07-25T12:22:07.737Z",
		"size": 55291,
		"path": "../public/assets/card-DzYo5CXc.js"
	},
	"/assets/create-DkNfMTQ9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b52-XOGt4GG4b8G1XxY4LakhH85iUZA\"",
		"mtime": "2026-07-25T12:22:07.738Z",
		"size": 6994,
		"path": "../public/assets/create-DkNfMTQ9.js"
	},
	"/assets/dist-BMEreXQz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13e0-mewCqmQJ5DAhgES3ss2cieJidYg\"",
		"mtime": "2026-07-25T12:22:07.739Z",
		"size": 5088,
		"path": "../public/assets/dist-BMEreXQz.js"
	},
	"/assets/dist-CkmR_tH6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dc30-S9fOy1gGD7kPBy/VUolTF/11YI8\"",
		"mtime": "2026-07-25T12:22:07.740Z",
		"size": 56368,
		"path": "../public/assets/dist-CkmR_tH6.js"
	},
	"/assets/dist-J9U9CttS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f15-C74Te8BCIo0vUdaa60hZln3av0s\"",
		"mtime": "2026-07-25T12:22:07.740Z",
		"size": 32533,
		"path": "../public/assets/dist-J9U9CttS.js"
	},
	"/assets/edit._id-BAp0RPiw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"36e-mxHULJHvN4Q+lJL8mxzVSH45uEk\"",
		"mtime": "2026-07-25T12:22:07.741Z",
		"size": 878,
		"path": "../public/assets/edit._id-BAp0RPiw.js"
	},
	"/assets/edit._id-IbV-Q8cw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d36-xYD81G5SfT2E71Hqlohz/oLY02w\"",
		"mtime": "2026-07-25T12:22:07.743Z",
		"size": 7478,
		"path": "../public/assets/edit._id-IbV-Q8cw.js"
	},
	"/assets/label-CH1vFQQM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"265-OPVKp2pGF45RwBfqre6O2IrL9+M\"",
		"mtime": "2026-07-25T12:22:07.744Z",
		"size": 613,
		"path": "../public/assets/label-CH1vFQQM.js"
	},
	"/assets/labels-CRJiN1Kj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4d8-heIMLXfWWJG4bl6RkYmut9q8sR0\"",
		"mtime": "2026-07-25T12:22:07.747Z",
		"size": 1240,
		"path": "../public/assets/labels-CRJiN1Kj.js"
	},
	"/assets/index-B6h3gact.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4dd51-9+AmarzMctxi2i+/NBOyySvZaUs\"",
		"mtime": "2026-07-25T12:22:07.734Z",
		"size": 318801,
		"path": "../public/assets/index-B6h3gact.js"
	},
	"/assets/link-BKVYG5jV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5af6-rO5bZoG0CgO1evairMKiPrICxcw\"",
		"mtime": "2026-07-25T12:22:07.749Z",
		"size": 23286,
		"path": "../public/assets/link-BKVYG5jV.js"
	},
	"/assets/preload-helper-CjdC3fXJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1847-GgRWLOH5Ik6krKaH5JeFMfrxMUA\"",
		"mtime": "2026-07-25T12:22:07.756Z",
		"size": 6215,
		"path": "../public/assets/preload-helper-CjdC3fXJ.js"
	},
	"/assets/print-BfBHgzKt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a51-m9wR/QTAIulGe5Iuj+ASqsHYnwo\"",
		"mtime": "2026-07-25T12:22:07.756Z",
		"size": 10833,
		"path": "../public/assets/print-BfBHgzKt.js"
	},
	"/assets/print-Ds0DFHVa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e02b-EpteRnMEjVInTqIKDjnq3GyrJ/Y\"",
		"mtime": "2026-07-25T12:22:07.757Z",
		"size": 57387,
		"path": "../public/assets/print-Ds0DFHVa.js"
	},
	"/assets/printer-BPZOdJpC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"133-eRHfn+QeVSHFqGIbUCs8xSg6lzU\"",
		"mtime": "2026-07-25T12:22:07.758Z",
		"size": 307,
		"path": "../public/assets/printer-BPZOdJpC.js"
	},
	"/assets/search-oBIdphpu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a2-MlVkmaaFtJnqsJjkr3+EI4vWUFI\"",
		"mtime": "2026-07-25T12:22:07.762Z",
		"size": 162,
		"path": "../public/assets/search-oBIdphpu.js"
	},
	"/assets/select-DW7WLy9h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72b1-2gAzGBCX4Em/Y7Nt5o5ckVQyIFQ\"",
		"mtime": "2026-07-25T12:22:07.762Z",
		"size": 29361,
		"path": "../public/assets/select-DW7WLy9h.js"
	},
	"/assets/settings-D2PN8zY5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c93-oUFGcXVpmqLwLNrxperEjSrq2qc\"",
		"mtime": "2026-07-25T12:22:07.763Z",
		"size": 7315,
		"path": "../public/assets/settings-D2PN8zY5.js"
	},
	"/assets/shipping-label-BuxDRQdL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16850-vQDsJRnDDSBb7ouS/4T6eSd47aQ\"",
		"mtime": "2026-07-25T12:22:07.764Z",
		"size": 92240,
		"path": "../public/assets/shipping-label-BuxDRQdL.js"
	},
	"/assets/styles-BSfhMU4Q.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"1392e-QNnk9jc1Q9Var5y/pi7LjKy2bEw\"",
		"mtime": "2026-07-25T12:22:07.768Z",
		"size": 80174,
		"path": "../public/assets/styles-BSfhMU4Q.css"
	},
	"/assets/routes-D_fsx5Ci.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9b02-TR/61BlMALxBge55Nm43w33VPtk\"",
		"mtime": "2026-07-25T12:22:07.760Z",
		"size": 39682,
		"path": "../public/assets/routes-D_fsx5Ci.js"
	},
	"/assets/textarea-gQoo6Vml.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1df-+A6H0yaLDht13mIcPUBERTGDClk\"",
		"mtime": "2026-07-25T12:22:07.764Z",
		"size": 479,
		"path": "../public/assets/textarea-gQoo6Vml.js"
	},
	"/assets/useMutation-BuSMxZiS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1593-/6401w/RlVgKgScEKA/dcG929fA\"",
		"mtime": "2026-07-25T12:22:07.765Z",
		"size": 5523,
		"path": "../public/assets/useMutation-BuSMxZiS.js"
	},
	"/assets/useQuery-CAfqI-nZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3f9c-CJPLVLMn6WoRExClC/lDiIcWCPQ\"",
		"mtime": "2026-07-25T12:22:07.766Z",
		"size": 16284,
		"path": "../public/assets/useQuery-CAfqI-nZ.js"
	},
	"/assets/useNavigate-CnGbuhCc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d8-tHePa0atGeU2wp7pmrvOlSW4OBE\"",
		"mtime": "2026-07-25T12:22:07.766Z",
		"size": 216,
		"path": "../public/assets/useNavigate-CnGbuhCc.js"
	}
};
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_MGvLg9 = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_MGvLg9
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
[].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new FastResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function useNitroHooks() {
	const nitroApp = useNitroApp();
	const hooks = nitroApp.hooks;
	if (hooks) return hooks;
	return nitroApp.hooks = new HookableCore();
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/presets/cloudflare/runtime/_module-handler.mjs
function createHandler(hooks) {
	const nitroApp = useNitroApp();
	const nitroHooks = useNitroHooks();
	return {
		async fetch(request, env, context) {
			globalThis.__env__ = env;
			augmentReq(request, {
				env,
				context
			});
			const ctxExt = {};
			const url = new URL(request.url);
			if (hooks.fetch) {
				const res = await hooks.fetch(request, env, context, url, ctxExt);
				if (res) return res;
			}
			return await nitroApp.fetch(request);
		},
		scheduled(controller, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:scheduled", {
				controller,
				env,
				context
			}) || Promise.resolve());
		},
		email(message, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:email", {
				message,
				event: message,
				env,
				context
			}) || Promise.resolve());
		},
		queue(batch, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:queue", {
				batch,
				event: batch,
				env,
				context
			}) || Promise.resolve());
		},
		tail(traces, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:tail", {
				traces,
				env,
				context
			}) || Promise.resolve());
		},
		trace(traces, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:trace", {
				traces,
				env,
				context
			}) || Promise.resolve());
		}
	};
}
function augmentReq(cfReq, ctx) {
	const req = cfReq;
	req.ip = cfReq.headers.get("cf-connecting-ip") || void 0;
	req.runtime ??= { name: "cloudflare" };
	req.runtime.cloudflare = {
		...req.runtime.cloudflare,
		...ctx
	};
	req.waitUntil = ctx.context?.waitUntil.bind(ctx.context);
}
//#endregion
//#region node_modules/nitro/dist/presets/cloudflare/runtime/cloudflare-module.mjs
var cloudflare_module_default = createHandler({ fetch(cfRequest, env, context, url) {
	if (env.ASSETS && isPublicAssetURL(url.pathname)) return env.ASSETS.fetch(cfRequest);
} });
//#endregion
export { cloudflare_module_default as default };
