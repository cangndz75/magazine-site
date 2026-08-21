function isUnsafeInternalPath(value: string): boolean {
  if (!value.startsWith("/")) {
    return true;
  }

  if (value.startsWith("//") || value.startsWith("/\\")) {
    return true;
  }

  if (value.includes("\\") || value.includes("://")) {
    return true;
  }

  return false;
}

function decodePathLayer(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Allows only same-app relative paths.
 * Validation runs on the raw string and after URI decoding so encoded
 * protocol-relative forms such as /%2f%2fevil.example cannot bypass checks.
 * The helper does not trust a decoded value as the redirect target; it only
 * uses decoding to reject unsafe encodings, then returns the original string
 * when that original form is also safe.
 */
export function safeInternalPath(value: string | null): string {
  if (!value) {
    return "/";
  }

  if (isUnsafeInternalPath(value)) {
    return "/";
  }

  let current = value;
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodePathLayer(current);
    if (decoded === null) {
      return "/";
    }
    if (decoded === current) {
      break;
    }
    if (isUnsafeInternalPath(decoded)) {
      return "/";
    }
    current = decoded;
  }

  return value;
}
