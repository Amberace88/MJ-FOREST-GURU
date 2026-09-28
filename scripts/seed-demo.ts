/**
 * DEMO data (spec §93, §127). Creates a SEPARATE organization flagged is_demo and
 * fills it via the service-role-only RPC public.seed_demo_data. Every generated row
 * carries is_demo = true and the UI shows a DEMO badge. Production organizations are
 * never touched: the database refuses to seed an organization that is not is_demo.
 *
 *   ALLOW_DEMO_SEED=true npm run seed:demo -- --owner-email you@example.com \
 *     [--slug mj-demo] [--name "MJ Forest Guru DEMO"] \
 *     [--as foreman=a@x.lv --as manager=b@x.lv --as mechanic=c@x.lv --as employee=d@x.lv]
 *
 *   ALLOW_DEMO_SEED=true npm run seed:demo -- --remove [--slug mj-demo]   # deletes the demo organization
 *
 * --owner-email must be an EXISTING user (e.g. created with setup:owner). --as links demo
 * employees to existing users so you can sign in as each role. Auth users are never
 * created or deleted by this script.
 */
import { adminClient, die, findUserId, loadEnvFiles, parseFlags, str } from "./lib/cli";

loadEnvFiles();
const flags = parseFlags();

if (process.env.ALLOW_DEMO_SEED !== "true") {
  die("Demo seeding is disabled. Set ALLOW_DEMO_SEED=true (never in production).");
}
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
if (/app\.mjforestguru\.com/i.test(appUrl) && flags["allow-production-url"] !== true) {
  die(`NEXT_PUBLIC_APP_URL points to production (${appUrl}). Demo data belongs in a development/staging project.`);
}

const slug = str(flags, "slug") ?? "mj-demo";
const name = str(flags, "name") ?? "MJ Forest Guru DEMO";
const DEMO_ROLES = ["foreman", "manager", "mechanic", "employee"] as const;
type DemoRole = (typeof DEMO_ROLES)[number];

async function remove() {
  const admin = adminClient();
  const { data: org } = await admin.from("organizations").select("id, is_demo").eq("slug", slug).maybeSingle();
  if (!org) die(`No organization with slug "${slug}".`);
  if (!org.is_demo) die(`Organization "${slug}" is NOT a demo organization — refusing to delete.`);
  const { error } = await admin.from("organizations").delete().eq("id", org.id).eq("is_demo", true);
  if (error) die(`Delete failed: ${error.message}`);
  console.log(`✓ Demo organization "${slug}" and all its data removed (auth users are kept). Storage objects under ${org.id}/ can be removed in the Supabase dashboard.`);
}

async function seed() {
  const ownerEmail = str(flags, "owner-email")?.toLowerCase();
  if (!ownerEmail) die("--owner-email <existing user e-mail> is required");
  const admin = adminClient();
  const ownerId = await findUserId(admin, ownerEmail);
  if (!ownerId) die(`User ${ownerEmail} does not exist. Create it first (npm run setup:owner or an invitation).`);

  const { data: existing } = await admin.from("organizations").select("id, is_demo").eq("slug", slug).maybeSingle();
  let orgId: string;
  if (existing) {
    if (!existing.is_demo) die(`Organization "${slug}" exists and is NOT a demo organization.`);
    orgId = existing.id;
    console.log(`• demo organization "${slug}" exists`);
  } else {
    const { data, error } = await admin.rpc("bootstrap_organization", {
      p_name: name, p_slug: slug, p_owner_user: ownerId, p_owner_first_name: "DEMO", p_owner_last_name: "Īpašnieks", p_is_demo: true,
    });
    if (error || !data) die(`bootstrap_organization failed: ${error?.message ?? "no id"}`);
    orgId = data;
    console.log(`✓ demo organization "${slug}" created (owner ${ownerEmail})`);
  }

  // Optional: link demo employees to real test users so each role can be tried.
  const users: Partial<Record<DemoRole, string>> = {};
  for (const pair of flags._multi.as ?? []) {
    const [role, email] = pair.split("=");
    if (!DEMO_ROLES.includes(role as DemoRole) || !email) die(`--as expects role=email with role in ${DEMO_ROLES.join(", ")}`);
    const uid = await findUserId(admin, email.toLowerCase());
    if (!uid) die(`--as ${role}: user ${email} does not exist`);
    const { error } = await admin.rpc("add_organization_member", { p_org: orgId, p_user: uid, p_role_key: role, p_invited_by: ownerId });
    if (error) die(`add_organization_member(${role}) failed: ${error.message}`);
    users[role as DemoRole] = uid;
    console.log(`✓ ${email} is a ${role} in the demo organization`);
  }

  const { data: counts, error } = await admin.rpc("seed_demo_data", { p_org: orgId, p_users: users });
  if (error) {
    if (/DEMO_SEED_ALREADY_APPLIED/.test(error.message)) die("Demo data already exists — run with --remove first to regenerate.");
    die(`seed_demo_data failed: ${error.message}`);
  }
  console.log("✓ Demo data generated:", JSON.stringify(counts));
  console.log("  All rows are flagged is_demo and shown with a DEMO badge. Remove with: ALLOW_DEMO_SEED=true npm run seed:demo -- --remove");
}

(flags.remove === true ? remove() : seed()).catch((e: unknown) => die(e instanceof Error ? e.message : String(e)));
