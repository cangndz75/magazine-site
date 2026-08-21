import { and, eq, isNull, sql } from "drizzle-orm";
import {
  CONTENT_AUDIT_ACTOR_KIND,
  STAFF_MFA_FACTOR_KIND,
  STAFF_MFA_FACTOR_STATUS,
  STAFF_SECURITY_AUDIT_EVENT_TYPE,
  STAFF_STATUS,
  buildTotpOtpauthUri,
  decryptMfaSecret,
  decideMfaChallengeAttempt,
  decideTotpReplay,
  encryptMfaSecret,
  generateRecoveryCodes,
  generateSessionToken,
  generateTotpSecret,
  hashRecoveryCode,
  hashSessionToken,
  mfaAuditOmitsSecrets,
  MFA_CHALLENGE_TTL_MS,
  nextMfaChallengeFailure,
  normalizeRecoveryCode,
  normalizeTotpCode,
  recoveryCodesMatch,
  STAFF_MFA_ERROR,
  StaffMfaError,
  toSafeStaffMfaProjection,
  verifyTotpCode,
  type SafeStaffMfaProjection,
  type StaffMfaErrorCode,
  type StaffSecurityAuditEventType,
} from "@magazine/domain";
import { getDb } from "./client";
import {
  staffLoginChallenges,
  staffMfaFactors,
  staffMfaRecoveryCodes,
  staffMfaSecrets,
  staffSecurityAuditEvents,
  staffUsers,
} from "./schema/staff";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function assertSafeAuditChangeSet(
  changeSet: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!mfaAuditOmitsSecrets(changeSet)) {
    throw new StaffMfaError(
      STAFF_MFA_ERROR.CRYPTO_ERROR,
      "Audit change set must not include secrets.",
    );
  }
  return changeSet;
}

async function appendMfaAudit(
  tx: Tx,
  input: {
    subjectStaffUserId: string;
    actorStaffUserId: string | null;
    eventType: StaffSecurityAuditEventType;
    changeSet: Record<string, unknown> | null;
  },
) {
  await tx.insert(staffSecurityAuditEvents).values({
    subjectStaffUserId: input.subjectStaffUserId,
    eventType: input.eventType,
    actorKind:
      input.actorStaffUserId === null
        ? CONTENT_AUDIT_ACTOR_KIND.SYSTEM
        : CONTENT_AUDIT_ACTOR_KIND.STAFF,
    actorStaffUserId: input.actorStaffUserId,
    changeSet: assertSafeAuditChangeSet(input.changeSet),
  });
}

export async function invalidateLoginChallengesForStaff(
  executor: ReturnType<typeof getDb> | Tx,
  staffUserId: string,
  now: Date = new Date(),
): Promise<number> {
  const rows = await executor
    .update(staffLoginChallenges)
    .set({ consumedAt: now })
    .where(
      and(
        eq(staffLoginChallenges.staffUserId, staffUserId),
        isNull(staffLoginChallenges.consumedAt),
      ),
    )
    .returning({ id: staffLoginChallenges.id });
  return rows.length;
}

export async function staffHasActiveMfa(staffUserId: string): Promise<boolean> {
  const db = getDb();
  const [factor] = await db
    .select({ id: staffMfaFactors.id })
    .from(staffMfaFactors)
    .where(
      and(
        eq(staffMfaFactors.staffUserId, staffUserId),
        eq(staffMfaFactors.status, STAFF_MFA_FACTOR_STATUS.ACTIVE),
      ),
    )
    .limit(1);
  return Boolean(factor);
}

export async function getSelfServiceMfaStatus(
  staffUserId: string,
): Promise<SafeStaffMfaProjection> {
  const db = getDb();
  const [factor] = await db
    .select({
      id: staffMfaFactors.id,
      kind: staffMfaFactors.kind,
      status: staffMfaFactors.status,
      confirmedAt: staffMfaFactors.confirmedAt,
      disabledAt: staffMfaFactors.disabledAt,
    })
    .from(staffMfaFactors)
    .where(eq(staffMfaFactors.staffUserId, staffUserId))
    .limit(1);

  if (!factor) {
    return toSafeStaffMfaProjection(null);
  }

  const [unused] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(staffMfaRecoveryCodes)
    .where(
      and(
        eq(staffMfaRecoveryCodes.factorId, factor.id),
        isNull(staffMfaRecoveryCodes.usedAt),
      ),
    );

  return toSafeStaffMfaProjection({
    kind: factor.kind,
    status: factor.status,
    confirmedAt: factor.confirmedAt,
    disabledAt: factor.disabledAt,
    unusedRecoveryCodeCount: unused?.value ?? 0,
  });
}

export async function beginTotpEnrollment(input: {
  staffUserId: string;
  email: string;
  issuer: string;
  encryptionKey: Buffer;
  now?: Date;
}): Promise<{
  factorId: string;
  secret: string;
  otpauthUri: string;
}> {
  const db = getDb();
  const secret = generateTotpSecret();
  const ciphertext = encryptMfaSecret(secret, input.encryptionKey);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ status: staffUsers.status })
      .from(staffUsers)
      .where(eq(staffUsers.id, input.staffUserId))
      .for("update");
    if (!user || user.status !== STAFF_STATUS.ACTIVE) {
      throw new StaffMfaError(STAFF_MFA_ERROR.FORBIDDEN);
    }

    const [existing] = await tx
      .select({
        id: staffMfaFactors.id,
        status: staffMfaFactors.status,
      })
      .from(staffMfaFactors)
      .where(eq(staffMfaFactors.staffUserId, input.staffUserId))
      .limit(1);

    if (existing?.status === STAFF_MFA_FACTOR_STATUS.ACTIVE) {
      throw new StaffMfaError(STAFF_MFA_ERROR.MFA_ALREADY_ACTIVE);
    }

    let factorId: string;
    if (existing) {
      factorId = existing.id;
      await tx
        .update(staffMfaFactors)
        .set({
          kind: STAFF_MFA_FACTOR_KIND.TOTP,
          status: STAFF_MFA_FACTOR_STATUS.PENDING,
          confirmedAt: null,
          disabledAt: null,
        })
        .where(eq(staffMfaFactors.id, factorId));
      await tx.delete(staffMfaSecrets).where(eq(staffMfaSecrets.factorId, factorId));
      await tx
        .delete(staffMfaRecoveryCodes)
        .where(eq(staffMfaRecoveryCodes.factorId, factorId));
    } else {
      const [created] = await tx
        .insert(staffMfaFactors)
        .values({
          staffUserId: input.staffUserId,
          kind: STAFF_MFA_FACTOR_KIND.TOTP,
          status: STAFF_MFA_FACTOR_STATUS.PENDING,
        })
        .returning({ id: staffMfaFactors.id });
      if (!created) {
        throw new StaffMfaError(STAFF_MFA_ERROR.CRYPTO_ERROR);
      }
      factorId = created.id;
    }

    await tx.insert(staffMfaSecrets).values({
      factorId,
      secretCiphertext: ciphertext,
      lastVerifiedTotpStep: null,
    });

    await appendMfaAudit(tx, {
      subjectStaffUserId: input.staffUserId,
      actorStaffUserId: input.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_ENROLLMENT_STARTED,
      changeSet: { factorId },
    });

    return {
      factorId,
      secret,
      otpauthUri: buildTotpOtpauthUri({
        issuer: input.issuer,
        accountName: input.email,
        secret,
      }),
    };
  });
}

export async function confirmTotpEnrollment(input: {
  staffUserId: string;
  factorId: string;
  totpCode: string;
  encryptionKey: Buffer;
  now?: Date;
}): Promise<{ recoveryCodes: string[] }> {
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const [factor] = await tx
      .select()
      .from(staffMfaFactors)
      .where(
        and(
          eq(staffMfaFactors.id, input.factorId),
          eq(staffMfaFactors.staffUserId, input.staffUserId),
        ),
      )
      .for("update");

    if (!factor || factor.status !== STAFF_MFA_FACTOR_STATUS.PENDING) {
      throw new StaffMfaError(STAFF_MFA_ERROR.MFA_ENROLLMENT_NOT_PENDING);
    }

    const [secretRow] = await tx
      .select()
      .from(staffMfaSecrets)
      .where(eq(staffMfaSecrets.factorId, factor.id))
      .for("update");
    if (!secretRow) {
      throw new StaffMfaError(STAFF_MFA_ERROR.MFA_ENROLLMENT_NOT_PENDING);
    }

    const plaintext = decryptMfaSecret(secretRow.secretCiphertext, input.encryptionKey);
    const verification = verifyTotpCode({
      secret: plaintext,
      code: input.totpCode,
      now,
    });
    if (!verification.valid) {
      throw new StaffMfaError(STAFF_MFA_ERROR.INVALID_TOTP_CODE);
    }

    const replay = decideTotpReplay({
      candidateStep: verification.step,
      lastVerifiedStep: secretRow.lastVerifiedTotpStep,
    });
    if (!replay.ok) {
      throw new StaffMfaError(replay.code);
    }

    await tx
      .update(staffMfaFactors)
      .set({
        status: STAFF_MFA_FACTOR_STATUS.ACTIVE,
        confirmedAt: now,
        disabledAt: null,
      })
      .where(eq(staffMfaFactors.id, factor.id));

    await tx
      .update(staffMfaSecrets)
      .set({ lastVerifiedTotpStep: verification.step })
      .where(eq(staffMfaSecrets.factorId, factor.id));

    await tx
      .delete(staffMfaRecoveryCodes)
      .where(eq(staffMfaRecoveryCodes.factorId, factor.id));

    const recoveryCodes = generateRecoveryCodes();
    await tx.insert(staffMfaRecoveryCodes).values(
      recoveryCodes.map((code) => ({
        factorId: factor.id,
        codeHash: hashRecoveryCode(code),
      })),
    );

    await appendMfaAudit(tx, {
      subjectStaffUserId: input.staffUserId,
      actorStaffUserId: input.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_ENABLED,
      changeSet: { factorId: factor.id },
    });

    return { recoveryCodes };
  });
}

export async function regenerateRecoveryCodes(input: {
  staffUserId: string;
  encryptionKey: Buffer;
}): Promise<{ recoveryCodes: string[] }> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [factor] = await tx
      .select({ id: staffMfaFactors.id })
      .from(staffMfaFactors)
      .where(
        and(
          eq(staffMfaFactors.staffUserId, input.staffUserId),
          eq(staffMfaFactors.status, STAFF_MFA_FACTOR_STATUS.ACTIVE),
        ),
      )
      .for("update");
    if (!factor) {
      throw new StaffMfaError(STAFF_MFA_ERROR.MFA_NOT_ENROLLED);
    }

    await tx
      .delete(staffMfaRecoveryCodes)
      .where(eq(staffMfaRecoveryCodes.factorId, factor.id));

    const recoveryCodes = generateRecoveryCodes();
    await tx.insert(staffMfaRecoveryCodes).values(
      recoveryCodes.map((code) => ({
        factorId: factor.id,
        codeHash: hashRecoveryCode(code),
      })),
    );

    await appendMfaAudit(tx, {
      subjectStaffUserId: input.staffUserId,
      actorStaffUserId: input.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_RECOVERY_CODES_REGENERATED,
      changeSet: { factorId: factor.id, codeCount: recoveryCodes.length },
    });

    return { recoveryCodes };
  });
}

export async function selfDisableMfa(input: {
  staffUserId: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const db = getDb();

  await db.transaction(async (tx) => {
    const [factor] = await tx
      .select({ id: staffMfaFactors.id, status: staffMfaFactors.status })
      .from(staffMfaFactors)
      .where(eq(staffMfaFactors.staffUserId, input.staffUserId))
      .for("update");

    if (
      !factor ||
      (factor.status !== STAFF_MFA_FACTOR_STATUS.ACTIVE &&
        factor.status !== STAFF_MFA_FACTOR_STATUS.PENDING)
    ) {
      throw new StaffMfaError(STAFF_MFA_ERROR.MFA_NOT_ENROLLED);
    }

    await tx
      .update(staffMfaFactors)
      .set({
        status: STAFF_MFA_FACTOR_STATUS.DISABLED,
        disabledAt: now,
      })
      .where(eq(staffMfaFactors.id, factor.id));
    await tx.delete(staffMfaSecrets).where(eq(staffMfaSecrets.factorId, factor.id));
    await tx
      .delete(staffMfaRecoveryCodes)
      .where(eq(staffMfaRecoveryCodes.factorId, factor.id));
    await invalidateLoginChallengesForStaff(tx, input.staffUserId, now);

    await appendMfaAudit(tx, {
      subjectStaffUserId: input.staffUserId,
      actorStaffUserId: input.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_MFA_DISABLED,
      changeSet: {
        previousStatus: factor.status,
        nextStatus: STAFF_MFA_FACTOR_STATUS.DISABLED,
        selfService: true,
      },
    });
  });
}

export async function createLoginChallenge(input: {
  staffUserId: string;
  now?: Date;
}): Promise<{ challengeToken: string }> {
  const now = input.now ?? new Date();
  const db = getDb();
  const challengeToken = generateSessionToken();
  const tokenHash = hashSessionToken(challengeToken);
  const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_MS);

  await db.transaction(async (tx) => {
    await invalidateLoginChallengesForStaff(tx, input.staffUserId, now);
    await tx.insert(staffLoginChallenges).values({
      staffUserId: input.staffUserId,
      tokenHash,
      createdAt: now,
      expiresAt,
    });
  });

  return { challengeToken };
}

export type VerifyLoginChallengeInput = {
  challengeToken: string;
  totpCode?: string;
  recoveryCode?: string;
  encryptionKey: Buffer;
  now?: Date;
};

type VerifyLoginChallengeOutcome =
  | { kind: "success"; staffUserId: string }
  | { kind: "failure"; code: StaffMfaErrorCode };

async function recordChallengeFailure(
  tx: Tx,
  input: {
    challenge: typeof staffLoginChallenges.$inferSelect;
    now: Date;
  },
): Promise<void> {
  const next = nextMfaChallengeFailure({
    failedAttemptCount: input.challenge.failedAttemptCount,
    now: input.now,
  });
  await tx
    .update(staffLoginChallenges)
    .set({
      failedAttemptCount: next.failedAttemptCount,
      lockedAt: next.lockedAt,
    })
    .where(eq(staffLoginChallenges.id, input.challenge.id));
  if (next.lockedAt) {
    await appendMfaAudit(tx, {
      subjectStaffUserId: input.challenge.staffUserId,
      actorStaffUserId: null,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_CHALLENGE_LOCKED,
      changeSet: { challengeId: input.challenge.id },
    });
  }
}

export async function verifyLoginChallenge(
  input: VerifyLoginChallengeInput,
): Promise<{ staffUserId: string }> {
  const now = input.now ?? new Date();
  const hasTotp = Boolean(input.totpCode?.trim());
  const hasRecovery = Boolean(input.recoveryCode?.trim());
  if (hasTotp === hasRecovery) {
    throw new StaffMfaError(STAFF_MFA_ERROR.INVALID_TOTP_CODE);
  }

  const db = getDb();
  const tokenHash = hashSessionToken(input.challengeToken);

  const outcome = await db.transaction(async (tx): Promise<VerifyLoginChallengeOutcome> => {
    const [challenge] = await tx
      .select()
      .from(staffLoginChallenges)
      .where(eq(staffLoginChallenges.tokenHash, tokenHash))
      .for("update");

    if (!challenge) {
      throw new StaffMfaError(STAFF_MFA_ERROR.CHALLENGE_NOT_FOUND);
    }

    const gate = decideMfaChallengeAttempt({
      now,
      expiresAt: challenge.expiresAt,
      consumedAt: challenge.consumedAt,
      lockedAt: challenge.lockedAt,
      failedAttemptCount: challenge.failedAttemptCount,
    });
    if (!gate.ok) {
      throw new StaffMfaError(gate.code);
    }

    const [user] = await tx
      .select({
        status: staffUsers.status,
        passwordResetRequiredAt: staffUsers.passwordResetRequiredAt,
      })
      .from(staffUsers)
      .where(eq(staffUsers.id, challenge.staffUserId))
      .limit(1);

    if (
      !user ||
      user.status !== STAFF_STATUS.ACTIVE ||
      user.passwordResetRequiredAt !== null
    ) {
      throw new StaffMfaError(STAFF_MFA_ERROR.FORBIDDEN);
    }

    const [factor] = await tx
      .select({ id: staffMfaFactors.id })
      .from(staffMfaFactors)
      .where(
        and(
          eq(staffMfaFactors.staffUserId, challenge.staffUserId),
          eq(staffMfaFactors.status, STAFF_MFA_FACTOR_STATUS.ACTIVE),
        ),
      )
      .limit(1);
    if (!factor) {
      throw new StaffMfaError(STAFF_MFA_ERROR.MFA_NOT_ENROLLED);
    }

    let verified = false;
    let usedRecovery = false;

    if (hasTotp && input.totpCode) {
      const normalized = normalizeTotpCode(input.totpCode);
      if (!normalized) {
        await recordChallengeFailure(tx, { challenge, now });
        return { kind: "failure", code: STAFF_MFA_ERROR.INVALID_TOTP_CODE };
      }

      const [secretRow] = await tx
        .select()
        .from(staffMfaSecrets)
        .where(eq(staffMfaSecrets.factorId, factor.id))
        .for("update");
      if (!secretRow) {
        throw new StaffMfaError(STAFF_MFA_ERROR.MFA_NOT_ENROLLED);
      }

      const plaintext = decryptMfaSecret(
        secretRow.secretCiphertext,
        input.encryptionKey,
      );
      const verification = verifyTotpCode({
        secret: plaintext,
        code: normalized,
        now,
      });
      if (!verification.valid) {
        await recordChallengeFailure(tx, { challenge, now });
        return { kind: "failure", code: STAFF_MFA_ERROR.INVALID_TOTP_CODE };
      }

      const replay = decideTotpReplay({
        candidateStep: verification.step,
        lastVerifiedStep: secretRow.lastVerifiedTotpStep,
      });
      if (!replay.ok) {
        throw new StaffMfaError(replay.code);
      }

      await tx
        .update(staffMfaSecrets)
        .set({ lastVerifiedTotpStep: verification.step })
        .where(eq(staffMfaSecrets.factorId, factor.id));
      verified = true;
    }

    if (hasRecovery && input.recoveryCode) {
      const normalized = normalizeRecoveryCode(input.recoveryCode);
      if (!normalized) {
        await recordChallengeFailure(tx, { challenge, now });
        return { kind: "failure", code: STAFF_MFA_ERROR.INVALID_RECOVERY_CODE };
      }

      const rows = await tx
        .select()
        .from(staffMfaRecoveryCodes)
        .where(
          and(
            eq(staffMfaRecoveryCodes.factorId, factor.id),
            isNull(staffMfaRecoveryCodes.usedAt),
          ),
        )
        .for("update");

      const match = rows.find((row) => recoveryCodesMatch(row.codeHash, normalized));
      if (!match) {
        await recordChallengeFailure(tx, { challenge, now });
        return { kind: "failure", code: STAFF_MFA_ERROR.INVALID_RECOVERY_CODE };
      }

      const [consumed] = await tx
        .update(staffMfaRecoveryCodes)
        .set({ usedAt: now })
        .where(
          and(
            eq(staffMfaRecoveryCodes.id, match.id),
            isNull(staffMfaRecoveryCodes.usedAt),
          ),
        )
        .returning({ id: staffMfaRecoveryCodes.id });
      if (!consumed) {
        throw new StaffMfaError(STAFF_MFA_ERROR.INVALID_RECOVERY_CODE);
      }

      usedRecovery = true;
      verified = true;

      await appendMfaAudit(tx, {
        subjectStaffUserId: challenge.staffUserId,
        actorStaffUserId: challenge.staffUserId,
        eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_RECOVERY_CODE_USED,
        changeSet: { factorId: factor.id },
      });
    }

    if (!verified) {
      return { kind: "failure", code: STAFF_MFA_ERROR.INVALID_TOTP_CODE };
    }

    const [consumedChallenge] = await tx
      .update(staffLoginChallenges)
      .set({ consumedAt: now })
      .where(
        and(
          eq(staffLoginChallenges.id, challenge.id),
          isNull(staffLoginChallenges.consumedAt),
        ),
      )
      .returning({ id: staffLoginChallenges.id });
    if (!consumedChallenge) {
      throw new StaffMfaError(STAFF_MFA_ERROR.CHALLENGE_CONSUMED);
    }

    await appendMfaAudit(tx, {
      subjectStaffUserId: challenge.staffUserId,
      actorStaffUserId: challenge.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_LOGIN_SUCCEEDED,
      changeSet: {
        challengeId: challenge.id,
        usedRecovery,
      },
    });

    return { kind: "success", staffUserId: challenge.staffUserId };
  });

  if (outcome.kind === "failure") {
    throw new StaffMfaError(outcome.code);
  }

  return { staffUserId: outcome.staffUserId };
}

export async function loadActiveMfaSecretPlaintext(input: {
  staffUserId: string;
  encryptionKey: Buffer;
}): Promise<string | null> {
  const db = getDb();
  const [factor] = await db
    .select({ id: staffMfaFactors.id })
    .from(staffMfaFactors)
    .where(
      and(
        eq(staffMfaFactors.staffUserId, input.staffUserId),
        eq(staffMfaFactors.status, STAFF_MFA_FACTOR_STATUS.ACTIVE),
      ),
    )
    .limit(1);
  if (!factor) {
    return null;
  }
  const [secretRow] = await db
    .select({ secretCiphertext: staffMfaSecrets.secretCiphertext })
    .from(staffMfaSecrets)
    .where(eq(staffMfaSecrets.factorId, factor.id))
    .limit(1);
  if (!secretRow) {
    return null;
  }
  return decryptMfaSecret(secretRow.secretCiphertext, input.encryptionKey);
}
