import { asc, eq } from "drizzle-orm";
import {
  FEATURE_CONTROL_DEFINITIONS,
  FEATURE_CONTROL_ERROR,
  FEATURE_CONTROL_TYPE,
  FeatureControlError,
  authorizeFeatureControlManage,
  decideFeatureControlUpdate,
  featureIsEnabled,
  getFeatureControlDefinition,
  killSwitchIsActive,
  resolveFeatureControl,
  type FeatureControlKey,
  type FeatureFlagKey,
  type KillSwitchKey,
  type ResolvedFeatureControl,
  type StaffRole,
} from "@magazine/domain";
import { getDb } from "./client";
import {
  featureControlAuditEvents,
  featureControls,
} from "./schema/feature-controls";

export type FeatureControlActor = {
  staffUserId: string;
  roles: readonly StaffRole[];
};

export type UpdateFeatureControlInput = {
  key: FeatureControlKey;
  enabled: boolean;
  expectedUpdatedAt: Date | string;
  description?: string | null;
  actor: FeatureControlActor;
  now?: Date;
};

type FeatureControlRow = typeof featureControls.$inferSelect;
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function getFeatureControl(
  key: FeatureControlKey,
): Promise<ResolvedFeatureControl> {
  const definition = getFeatureControlDefinition(key);
  try {
    const [row] = await getDb()
      .select()
      .from(featureControls)
      .where(eq(featureControls.key, definition.key))
      .limit(1);
    return resolveFeatureControl(definition.key, row ?? null);
  } catch (error) {
    if (error instanceof FeatureControlError) {
      throw error;
    }
    return resolveFeatureControl(definition.key, null);
  }
}

export async function listFeatureControls(
  actor: FeatureControlActor,
): Promise<ResolvedFeatureControl[]> {
  authorizeActor(actor);
  const rows = await getDb()
    .select()
    .from(featureControls)
    .orderBy(asc(featureControls.key));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return FEATURE_CONTROL_DEFINITIONS.map((definition) =>
    resolveFeatureControl(definition.key, byKey.get(definition.key) ?? null),
  );
}

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const control = await getFeatureControl(key);
  return featureIsEnabled(control);
}

export async function isKillSwitchActive(key: KillSwitchKey): Promise<boolean> {
  const control = await getFeatureControl(key);
  return killSwitchIsActive(control);
}

export async function updateFeatureControl(
  input: UpdateFeatureControlInput,
): Promise<ResolvedFeatureControl> {
  authorizeActor(input.actor);
  const definition = getFeatureControlDefinition(input.key);
  const now = input.now ?? new Date();

  return getDb().transaction(async (tx) => {
    const current = await lockOrSeedControl(tx, definition.key);
    const plan = decideFeatureControlUpdate({
      current,
      expectedUpdatedAt: input.expectedUpdatedAt,
      enabled: input.enabled,
      description: input.description,
      now,
    });

    const [updated] = await tx
      .update(featureControls)
      .set({
        enabled: plan.enabled,
        description: plan.description,
        updatedAt: plan.updatedAt,
        updatedByStaffUserId: input.actor.staffUserId,
      })
      .where(eq(featureControls.key, plan.key))
      .returning();

    if (!updated) {
      throw new FeatureControlError(FEATURE_CONTROL_ERROR.WRITE_CONFLICT);
    }

    await tx.insert(featureControlAuditEvents).values({
      controlKey: plan.key,
      controlType: plan.type,
      actorStaffUserId: input.actor.staffUserId,
      occurredAt: plan.updatedAt,
      oldEnabled: current.enabled,
      newEnabled: plan.enabled,
      oldDescription: current.description,
      newDescription: plan.description,
      changeSet: plan.changeSet,
    });

    return resolveFeatureControl(plan.key, updated);
  });
}

export async function getFeatureControlOperationalSummary(): Promise<{
  featureFlagsDisabled: number;
  killSwitchesActive: number;
  updatedAt: string | null;
}> {
  const rows = await getDb().select().from(featureControls);
  const controls = FEATURE_CONTROL_DEFINITIONS.map((definition) =>
    resolveFeatureControl(
      definition.key,
      rows.find((row) => row.key === definition.key) ?? null,
    ),
  );
  return {
    featureFlagsDisabled: controls.filter(
      (control) =>
        control.type === FEATURE_CONTROL_TYPE.FEATURE_FLAG && !control.enabled,
    ).length,
    killSwitchesActive: controls.filter(
      (control) =>
        control.type === FEATURE_CONTROL_TYPE.KILL_SWITCH && control.enabled,
    ).length,
    updatedAt: controls
      .map((control) => control.updatedAt)
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ?? null,
  };
}

async function lockOrSeedControl(
  tx: Tx,
  key: FeatureControlKey,
): Promise<FeatureControlRow> {
  const [locked] = await tx
    .select()
    .from(featureControls)
    .where(eq(featureControls.key, key))
    .for("update");
  if (locked) {
    return locked;
  }

  const definition = getFeatureControlDefinition(key);
  const [inserted] = await tx
    .insert(featureControls)
    .values({
      key: definition.key,
      type: definition.type,
      enabled: definition.defaultEnabled,
      description: definition.description,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) {
    return inserted;
  }

  const [relocked] = await tx
    .select()
    .from(featureControls)
    .where(eq(featureControls.key, key))
    .for("update");
  if (!relocked) {
    throw new FeatureControlError(FEATURE_CONTROL_ERROR.UNKNOWN_KEY);
  }
  return relocked;
}

function authorizeActor(actor: FeatureControlActor): void {
  const authorized = authorizeFeatureControlManage({ roles: actor.roles });
  if (!authorized.ok) {
    throw new FeatureControlError(FEATURE_CONTROL_ERROR.FORBIDDEN);
  }
}
