import { auth } from "../../../../src/lib/auth";

export default defineEventHandler(async (event) => {
	const response = await auth.handler(toWebRequest(event));

	// Copy Better Auth's response headers into the h3 event so they merge
	// with headers set by middleware (e.g. CORS plugin).
	for (const [key, value] of response.headers) {
		appendResponseHeader(event, key, value);
	}

	setResponseStatus(event, response.status);
	return response.text();
});
