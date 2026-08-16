/**
 * Test-only pause/fault injection for editor content integration tests.
 *
 * Production never sets EDITOR_CONTENT_INTEGRATION=1, so hooks stay unset
 * and the call sites are a single undefined check.
 * Do not import setPublishingTestHooks from application routes.
 */
export type PublishingTestHooks = {
  afterContentItemLocked?: (input: {
    contentItemId: string;
  }) => Promise<void>;
  afterVersionRelationsReplaced?: (input: {
    contentVersionId: string;
  }) => Promise<void>;
};

let hooks: PublishingTestHooks | undefined;

function assertIntegrationHooksAllowed(): void {
  const appEnv = process.env.APP_ENV ?? "development";
  if (appEnv === "production" || appEnv === "staging") {
    throw new Error(
      "Publishing test hooks cannot run when APP_ENV is production or staging.",
    );
  }

  if (process.env.EDITOR_CONTENT_INTEGRATION !== "1") {
    throw new Error(
      "Publishing test hooks require EDITOR_CONTENT_INTEGRATION=1 and are not available in normal application configuration.",
    );
  }
}

export function setPublishingTestHooks(
  next: PublishingTestHooks | undefined,
): void {
  assertIntegrationHooksAllowed();
  hooks = next;
}

export function clearPublishingTestHooks(): void {
  hooks = undefined;
}

export async function runAfterContentItemLocked(input: {
  contentItemId: string;
}): Promise<void> {
  const hook = hooks?.afterContentItemLocked;
  if (!hook) {
    return;
  }

  assertIntegrationHooksAllowed();
  await hook(input);
}

export async function runAfterVersionRelationsReplaced(input: {
  contentVersionId: string;
}): Promise<void> {
  const hook = hooks?.afterVersionRelationsReplaced;
  if (!hook) {
    return;
  }

  assertIntegrationHooksAllowed();
  await hook(input);
}
