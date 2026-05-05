const origins = (process.env.TRUSTED_ORIGINS ?? "").split(",").filter(Boolean);

export default defineEventHandler((event) => {
	const origin = getRequestHeader(event, "origin");

	if (origin && origins.includes(origin)) {
		setResponseHeaders(event, {
			"Access-Control-Allow-Origin": origin,
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
		});
	}

	if (event.method === "OPTIONS") {
		setResponseStatus(event, 204);
		return "";
	}
});
