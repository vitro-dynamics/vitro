# @app/logger

Thin [consola](https://github.com/unjs/consola) wrapper. Pretty output in dev, structured JSON in production.

## Usage

```ts
import { createLogger } from "@app/logger";

const log = createLogger("api:webhooks:stripe");

log.info("Webhook received", { type: "invoice.payment_failed" });
log.warn("Rate limit approaching", { remaining: 5 });
log.error("Send failed", { err: err.message });
```

Every server-side module that emits logs creates its own tagged logger at the top of the file. Tag format: `area:subarea` (e.g. `api:auth`, `tasks:email`, `api:events`).

No `console.log` in production code.

## Output

**Development** — colored, indented CLI output with timestamps.

**Production** — one JSON object per line on stdout:

```json
{"time":"2026-05-05T18:23:01.123Z","level":"info","tag":"api:webhooks:stripe","msg":"Webhook received","data":{"type":"invoice.payment_failed"}}
```

Railway's log viewer parses this for structured search and filtering.

## Log levels

Controlled by the `LOG_LEVEL` environment variable.

| Env | Default | Accepted values |
|---|---|---|
| development | `debug` | `silent` `fatal` `error` `warn` `info` `debug` `trace` `verbose` |
| production | `info` | same |

## API

```ts
import { createLogger, logger } from "@app/logger";
import type { ConsolaInstance } from "@app/logger";

createLogger(tag: string): ConsolaInstance   // tagged logger — use this
logger                                        // root instance (untagged)
```
