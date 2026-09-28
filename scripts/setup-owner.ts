/**
 * First-run setup: creates the company organization and its first OWNER (spec §126).
 * No passwords are ever hard-coded: the owner receives an invite e-mail (or a
 * one-time link with --print-link) and sets the password personally.
 *
 *   npm run setup:owner -- \
 *     --email maris@example.com --name "Māris Bērziņš" \
 *     --company "MJ Forest" --slug mj-forest \
 *     [--second-email julija@example.com --second-name "Jūlija …" --second-role owner|admin] \
 *     [--print-link]
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_APP_URL
 * (read from the shell, .env.local or .env). Safe to re-run (idempotent).
 */
import { adminClient, die, ensureUser, isEmail, loadEnvFiles, parseFlags, splitName, str, type Admin } from "./lib/cli";

loadEnvFiles();
const flags = parseFlags();

if (flags.help || flags.h) {
  console.log("Usage: npm run setup:owner -- --email <e-mail> --name \"<Vārds Uzvārds>\" --company \"<Company>\" [--slug <slug>] [--second-email … --second-name … --second-role owner|admin] [--print-link]");
  process.exit(0);
}

const email = str(flags, "email")?.toLowerCase();
const name = str(flags, "name");
const company = str(flags, "company") ?? "MJ Forest Guru";
const slug = (str(flags, "slug") ?? company).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
const printLink = flags["print-link"] === true;

if (!email || !isEmail(email)) die("--email <owner e-mail> is required");
if (!name || name.length < 2) die("--name \"<first last>\" is required");
if (!/^[a-z0-9-]{2,64}$/.test(slug)) die(`Invalid --slug "${slug}" (a-z, 0-9, -)`);

async function addMember(admin: Admin, orgId: string, userId: string, role: "owner" | "admin", fullName: string, invitedBy: string) {
  const { data: member } = await admin.from("organization_members").select("status").eq("organization_id", orgId).eq("user_id", userId).maybeSingle();
  if (member) {
    console.log(`  • already a member (${member.status})`);
    return;
  }
  const { first, last } = splitName(fullName);
  const { error } = await admin.rpc("add_organization_member", {
    p_org: orgId, p_user: userId, p_role_key: role, p_first_name: first, p_last_name: last, p_invited_by: invitedBy,
  });
  if (error) die(`add_organization_member failed: ${error.message}`);
  console.log(`  ✓ added as ${role}`);
}

async function main() {
  const admin = adminClient();
  console.log(`\nMJ Forest Guru — owner setup\n  organization: ${company} (${slug})\n  owner:        ${name} <${email}>\n`);

  const owner = await ensureUser(admin, email!, name!, { printLink });
  const { first, last } = splitName(name!);

  const { data: existingOrg, error: orgErr } = await admin.from("organizations").select("id, is_demo").eq("slug", slug).maybeSingle();
  if (orgErr) die(`Could not read organizations: ${orgErr.message}`);

  let orgId: string;
  if (existingOrg) {
    if (existingOrg.is_demo) die(`Organization "${slug}" is a DEMO organization — choose another --slug for production.`);
    orgId = existingOrg.id;
    console.log(`  • organization "${slug}" already exists`);
    await addMember(admin, orgId, owner.id, "owner", name!, owner.id);
  } else {
    const { data, error } = await admin.rpc("bootstrap_organization", {
      p_name: company, p_slug: slug, p_owner_user: owner.id, p_owner_first_name: first, p_owner_last_name: last, p_is_demo: false,
    });
    if (error || !data) die(`bootstrap_organization failed: ${error?.message ?? "no id returned"}`);
    orgId = data;
    console.log(`  ✓ organization created with default roles, countries (LV/SE/IS), lookups and safety templates`);
  }

  const secondEmail = str(flags, "second-email")?.toLowerCase();
  if (secondEmail) {
    if (!isEmail(secondEmail)) die("--second-email is not a valid e-mail");
    const secondName = str(flags, "second-name") ?? secondEmail.split("@")[0];
    const secondRole = (str(flags, "second-role") ?? "owner") as "owner" | "admin";
    if (!["owner", "admin"].includes(secondRole)) die("--second-role must be owner or admin");
    console.log(`\n  second ${secondRole}: ${secondName} <${secondEmail}>`);
    const second = await ensureUser(admin, secondEmail, secondName, { printLink });
    await addMember(admin, orgId, second.id, secondRole, secondName, owner.id);
  }

  console.log(`\n✓ Done. Organization id: ${orgId}`);
  console.log("  Next: open the link from the e-mail, set a password, sign in — the setup wizard starts automatically.\n");
}

main().catch((e: unknown) => die(e instanceof Error ? e.message : String(e)));
