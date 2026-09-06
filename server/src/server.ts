import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { ensureDefaultSlaPolicies } from './services/slaPolicyAdminService';

async function main() {
  await connectDB();
  // Backfill any missing SLA policy documents (safe/idempotent - see the function's
  // doc comment). This runs on every boot so it takes effect on the next deploy with
  // no manual database action required.
  await ensureDefaultSlaPolicies();
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] DeskFlow Pro API listening on port ${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Failed to start', err);
  process.exit(1);
});
