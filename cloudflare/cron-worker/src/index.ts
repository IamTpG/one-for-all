// Pings the app's cron endpoint on a Cloudflare Cron Trigger. Vercel's Hobby
// plan only allows a daily cron, but the fetch schedule and translation
// backfill (see src/app/api/cron/tick in the app) need to be checked every
// few minutes. All the actual work stays on Vercel; this just wakes it up.

interface Env {
  APP_URL: string;
  CRON_SECRET: string;
}

const REQUEST_TIMEOUT_MS = 55_000;

export default {
  async scheduled(controller, env): Promise<void> {
    if (!env.CRON_SECRET) throw new Error("CRON_SECRET is not set");
    // The bearer secret only ever goes over https, except to localhost for `wrangler dev`.
    const secureEnough = env.APP_URL?.startsWith("https://") || env.APP_URL?.startsWith("http://localhost");
    if (!secureEnough || env.APP_URL.includes("your-app")) {
      throw new Error(`APP_URL is not configured: ${env.APP_URL}`);
    }

    const url = `${env.APP_URL.replace(/\/+$/, "")}/api/cron/tick`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await res.text();

    // Throwing marks this run as failed in the Workers dashboard/logs.
    if (!res.ok) throw new Error(`tick ${res.status} at ${controller.scheduledTime}: ${body.slice(0, 300)}`);
    console.log(`tick ok: ${body.slice(0, 300)}`);
  },
} satisfies ExportedHandler<Env>;
