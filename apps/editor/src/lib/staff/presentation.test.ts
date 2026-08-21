import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ADMIN_ERROR, STAFF_ROLE, STAFF_SECURITY_AUDIT_EVENT_TYPE } from "@magazine/domain";
import {
  presentStaffAdminFailure,
  staffRenderedOutputLeaksSecrets,
  staffRoleLabel,
  staffSecurityAuditEventLabel,
} from "./presentation";

describe("staff presentation", () => {
  it("maps known admin errors to Turkish messages", () => {
    const conflict = presentStaffAdminFailure(STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT);
    assert.equal(conflict.isConflict, true);
    assert.match(conflict.message, /yenileyip tekrar deneyin/i);

    const lastSuper = presentStaffAdminFailure(STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN);
    assert.equal(lastSuper.isConflict, false);
    assert.match(lastSuper.message, /Süper Admin/i);
  });

  it("labels canonical roles in Turkish", () => {
    assert.equal(staffRoleLabel(STAFF_ROLE.SUPER_ADMIN), "Süper Admin");
    assert.equal(staffRoleLabel(STAFF_ROLE.EDITOR), "Editör");
    assert.equal(staffRoleLabel(STAFF_ROLE.AUTHOR), "Yazar");
  });

  it("labels security audit events without leaking secrets", () => {
    const label = staffSecurityAuditEventLabel(
      STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_PASSWORD_RESET_REQUIRED,
    );
    assert.match(label, /Parola/i);
    assert.equal(label.includes("otpauth"), false);
  });

  it("flags sensitive staff render patterns", () => {
    assert.equal(staffRenderedOutputLeaksSecrets("passwordHash"), true);
    assert.equal(staffRenderedOutputLeaksSecrets("tokenHash"), true);
    assert.equal(staffRenderedOutputLeaksSecrets("displayName"), false);
  });

  it("falls back for unknown errors", () => {
    const generic = presentStaffAdminFailure("UNKNOWN_CODE");
    assert.match(generic.message, /tamamlanamadı/i);
  });
});
