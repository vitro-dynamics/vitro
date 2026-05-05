import { type ConsolaInstance, createConsola, type LogObject } from "consola";

const isProd = process.env.NODE_ENV === "production";

const LEVELS = {
	silent: -999,
	fatal: 0,
	error: 0,
	warn: 1,
	log: 2,
	info: 3,
	debug: 4,
	trace: 5,
	verbose: 999,
} as const;

const envLevel = process.env.LOG_LEVEL?.toLowerCase() as keyof typeof LEVELS | undefined;
const level = envLevel && envLevel in LEVELS ? LEVELS[envLevel] : isProd ? 3 : 4;

const jsonReporter = {
	log(obj: LogObject) {
		const [first, ...rest] = obj.args;
		const isMessage = typeof first === "string";
		process.stdout.write(
			`${JSON.stringify({
				time: obj.date.toISOString(),
				level: obj.type,
				tag: obj.tag || undefined,
				msg: isMessage ? first : undefined,
				data: isMessage
					? rest.length === 1
						? rest[0]
						: rest.length
							? rest
							: undefined
					: obj.args.length === 1
						? obj.args[0]
						: obj.args,
			})}\n`
		);
	},
};

export const logger: ConsolaInstance = createConsola({
	level,
	reporters: isProd ? [jsonReporter] : undefined,
	formatOptions: {
		date: true,
		colors: !isProd,
	},
});

export function createLogger(tag: string): ConsolaInstance {
	return logger.withTag(tag);
}

export type { ConsolaInstance } from "consola";
