import { auth } from "../../../src/lib/auth";
import { subscribe } from "../../../src/lib/events";

export default defineEventHandler(async (event) => {
	const session = await auth.api.getSession({ headers: event.headers });
	if (!session) throw createError({ statusCode: 401 });

	const stream = createEventStream(event);

	const unsub = subscribe((e) => {
		if (e.userId && e.userId !== session.user.id) return;
		stream.push({ data: JSON.stringify(e) });
	});

	const keepalive = setInterval(() => stream.push(""), 25_000);

	stream.onClosed(() => {
		unsub();
		clearInterval(keepalive);
	});

	return stream.send();
});
