import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { STAFF_ROLE, STAFF_SCOPE_MODE, STAFF_STATUS } from "@magazine/domain";
import {
  STAFF_BOOTSTRAP_ERROR,
  StaffBootstrapError,
  bootstrapInitialStaff,
} from "../staff-provisioning";
import {
  cleanupStaffAuthTables,
  closeIntegrationConnections,
  ensureEditorContentTestDatabase,
  getRacerPool,
} from "./harness";
import {
  hashPassword,
  verifyPassword,
} from "../../../../apps/editor/src/lib/auth/password-core";

type StaffState = {
  users: {
    id: string;
    email: string;
    display_name: string;
    status: string;
    scope_mode: string;
  }[];
  credentials: { staff_user_id: string; password_hash: string }[];
  roles: { staff_user_id: string; role: string }[];
  categoryScopes: { staff_user_id: string; category_id: string }[];
};

describe("staff initial bootstrap PostgreSQL integration", () => {
  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    await cleanupStaffAuthTables();
  });

  afterEach(async () => {
    await dropForcedCredentialFailure();
    await cleanupStaffAuthTables();
  });

  after(async () => {
    await closeIntegrationConnections();
  });

  it("creates the initial active SUPER_ADMIN with ALL scope atomically", async () => {
    const password = "correct-horse-battery";
    const passwordHash = await hashPassword(password);

    const created = await bootstrapInitialStaff({
      email: " FIRST.ADMIN@Example.TEST ",
      displayName: " First Admin ",
      passwordHash,
    });

    const state = await readStaffState();
    assert.equal(state.users.length, 1);
    assert.equal(state.credentials.length, 1);
    assert.equal(state.roles.length, 1);
    assert.equal(state.categoryScopes.length, 0);
    assert.equal(created.email, "first.admin@example.test");
    assert.equal(created.role, STAFF_ROLE.SUPER_ADMIN);
    assert.equal(created.scopeMode, STAFF_SCOPE_MODE.ALL);
    assert.equal(state.users[0]?.email, "first.admin@example.test");
    assert.equal(state.users[0]?.display_name, "First Admin");
    assert.equal(state.users[0]?.status, STAFF_STATUS.ACTIVE);
    assert.equal(state.users[0]?.scope_mode, STAFF_SCOPE_MODE.ALL);
    assert.equal(state.roles[0]?.role, STAFF_ROLE.SUPER_ADMIN);
    assert.equal(await verifyPassword(state.credentials[0]!.password_hash, password), true);
    assert.equal(
      await verifyPassword(state.credentials[0]!.password_hash, "wrong-password"),
      false,
    );
  });

  it("refuses to bootstrap when staff already exists", async () => {
    const firstHash = await hashPassword("correct-horse-battery");
    await bootstrapInitialStaff({
      email: "first.admin@example.test",
      displayName: "First Admin",
      passwordHash: firstHash,
    });

    const secondHash = await hashPassword("another-correct-secret");
    await assert.rejects(
      () =>
        bootstrapInitialStaff({
          email: "second.admin@example.test",
          displayName: "Second Admin",
          passwordHash: secondHash,
        }),
      (error: unknown) =>
        error instanceof StaffBootstrapError &&
        error.code === STAFF_BOOTSTRAP_ERROR.EXISTING_STAFF,
    );

    const state = await readStaffState();
    assert.equal(state.users.length, 1);
    assert.equal(state.credentials.length, 1);
    assert.equal(state.roles.length, 1);
    assert.equal(state.users[0]?.email, "first.admin@example.test");
  });

  it("rolls back the staff user when credential insertion fails", async () => {
    await createForcedCredentialFailure();

    await assert.rejects(
      () =>
        bootstrapInitialStaff({
          email: "first.admin@example.test",
          displayName: "First Admin",
          passwordHash: "$argon2id$forced-test-hash",
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);

        const cause = (error as Error & {
          cause?: unknown;
        }).cause;

        assert.ok(cause instanceof Error);
        assert.equal(
          cause.message,
          "BOOTSTRAP_FORCED_CREDENTIAL_FAILURE",
        );

        return true;
      },
    );

    const state = await readStaffState();
    assert.equal(state.users.length, 0);
    assert.equal(state.credentials.length, 0);
    assert.equal(state.roles.length, 0);
  });

  it("serializes concurrent bootstrap attempts so only one initial staff user exists", async () => {
    const firstHash = await hashPassword("correct-horse-battery");
    const secondHash = await hashPassword("another-correct-secret");

    const attempts = await Promise.allSettled([
      bootstrapInitialStaff({
        email: "first.admin@example.test",
        displayName: "First Admin",
        passwordHash: firstHash,
      }),
      bootstrapInitialStaff({
        email: "second.admin@example.test",
        displayName: "Second Admin",
        passwordHash: secondHash,
      }),
    ]);

    const fulfilled = attempts.filter((item) => item.status === "fulfilled");
    const rejected = attempts.filter((item) => item.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(
      rejected.every(
        (item) =>
          item.status === "rejected" &&
          item.reason instanceof StaffBootstrapError &&
          item.reason.code === STAFF_BOOTSTRAP_ERROR.EXISTING_STAFF,
      ),
      true,
    );

    const state = await readStaffState();
    assert.equal(state.users.length, 1);
    assert.equal(state.credentials.length, 1);
    assert.equal(state.roles.length, 1);
  });
});

async function readStaffState(): Promise<StaffState> {
  const pool = getRacerPool();
  const [users, credentials, roles, categoryScopes] = await Promise.all([
    pool.query<StaffState["users"][number]>(
      "SELECT id, email, display_name, status, scope_mode FROM staff_users ORDER BY email",
    ),
    pool.query<StaffState["credentials"][number]>(
      "SELECT staff_user_id, password_hash FROM staff_password_credentials ORDER BY staff_user_id",
    ),
    pool.query<StaffState["roles"][number]>(
      "SELECT staff_user_id, role FROM staff_user_roles ORDER BY staff_user_id, role",
    ),
    pool.query<StaffState["categoryScopes"][number]>(
      "SELECT staff_user_id, category_id FROM staff_user_category_scopes ORDER BY staff_user_id, category_id",
    ),
  ]);

  return {
    users: users.rows,
    credentials: credentials.rows,
    roles: roles.rows,
    categoryScopes: categoryScopes.rows,
  };
}

async function createForcedCredentialFailure(): Promise<void> {
  const pool = getRacerPool();
  await pool.query(`
    CREATE OR REPLACE FUNCTION bootstrap_forced_credential_failure()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'BOOTSTRAP_FORCED_CREDENTIAL_FAILURE';
    END;
    $$;
  `);
  await pool.query(`
    CREATE TRIGGER bootstrap_forced_credential_failure
    BEFORE INSERT ON staff_password_credentials
    FOR EACH ROW
    EXECUTE FUNCTION bootstrap_forced_credential_failure();
  `);
}

async function dropForcedCredentialFailure(): Promise<void> {
  const pool = getRacerPool();
  await pool.query(
    "DROP TRIGGER IF EXISTS bootstrap_forced_credential_failure ON staff_password_credentials",
  );
  await pool.query("DROP FUNCTION IF EXISTS bootstrap_forced_credential_failure()");
}
