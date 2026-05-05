// Importing env.ts executes its Arktype validation at module load time.
// Nitro loads plugins before any route or task handler runs, so this
// guarantees the server exits immediately on misconfiguration rather than
// failing later with a confusing runtime error.
import "../../src/lib/env";

export default defineNitroPlugin(() => {});
