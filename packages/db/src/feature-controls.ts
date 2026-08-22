import { asc, desc, eq } from "drizzle-orm";
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
import { staffUsers } from "./schema/staff";
import {
  featureControlAuditEvents,
  featureControls,
} from "./schema/feature-controls";

export type FeatureControlActor = {
  staffUserId: string;
  roles: readonly StaffRole[];
};

export type ResolvedFeatureControlWithActor = ResolvedFeatureControl & {
  updatedByDisplayName: string | null;
};

export type FeatureControlAuditProjection = {
  controlKey: FeatureControlKey;
  controlType: ResolvedFeatureControl["type"];
  oldEnabled: boolean;
  newEnabled: boolean;
  occurredAt: string;
  actorStaffUserId: string;
  actorDisplayName: string;
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
): Promise<ResolvedFeatureControlWithActor[]> {
  authorizeActor(actor);
  const rows = await getDb()
    .select({
      control: featureControls,
      updatedByDisplayName: staffUsers.displayName,
    })
    .from(featureControls)
    .leftJoin(
      staffUsers,
      eq(staffUsers.id, featureControls.updatedByStaffUserId),
    )
    .orderBy(asc(featureControls.key));
  const byKey = new Map(rows.map((row) => [row.control.key, row]));
  return FEATURE_CONTROL_DEFINITIONS.map((definition) => {
    const row = byKey.get(definition.key);
    const resolved = resolveFeatureControl(
      definition.key,
      row?.control ?? null,
    );
    return {
      ...resolved,
      updatedByDisplayName: row?.updatedByDisplayName ?? null,
    };
  });
}

export async function listRecentFeatureControlAuditEvents(
  actor: FeatureControlActor,
  limit = 15,
): Promise<FeatureControlAuditProjection[]> {
  authorizeActor(actor);
  const rows = await getDb()
    .select({
      controlKey: featureControlAuditEvents.controlKey,
      controlType: featureControlAuditEvents.controlType,
      oldEnabled: featureControlAuditEvents.oldEnabled,
      newEnabled: featureControlAuditEvents.newEnabled,
      occurredAt: featureControlAuditEvents.occurredAt,
      actorStaffUserId: featureControlAuditEvents.actorStaffUserId,
      actorDisplayName: staffUsers.displayName,
    })
    .from(featureControlAuditEvents)
    .innerJoin(
      staffUsers,
      eq(staffUsers.id, featureControlAuditEvents.actorStaffUserId),
    )
    .orderBy(desc(featureControlAuditEvents.occurredAt))
    .limit(limit);

  return rows.map((row) => ({
    controlKey: row.controlKey as FeatureControlKey,
    controlType: row.controlType as ResolvedFeatureControl["type"],
    oldEnabled: row.oldEnabled,
    newEnabled: row.newEnabled,
    occurredAt:
      row.occurredAt instanceof Date
        ? row.occurredAt.toISOString()
        : new Date(row.occurredAt).toISOString(),
    actorStaffUserId: row.actorStaffUserId,
    actorDisplayName: row.actorDisplayName,
  }));
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
