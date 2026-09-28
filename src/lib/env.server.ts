import "server-only";

/** Server-only secrets. Importing this file from a client component fails the build. */
export const serverEnv = {
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  maponApiKey: process.env.MAPON_API_KEY ?? "",
  maponBaseUrl: (process.env.MAPON_API_URL ?? "https://mapon.com/api/v1").replace(/\/$/, ""),
  cronSecret: process.env.CRON_SECRET ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "MJ Forest Guru <no-reply@mjforestguru.com>",
  allowDemoSeed: process.env.ALLOW_DEMO_SEED === "true",
};

export const hasServiceRole = () => Boolean(serverEnv.serviceRoleKey);
