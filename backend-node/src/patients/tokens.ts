import { utcDatePrefix } from "../http/utc";

export const TOKEN_SUFFIX_PREFIX = "-P";

/** Django `format_token_for_display`: stored `YYYYMMDD-P0001` → API `P0001`. */
export function formatTokenForDisplay(storedToken: string | null | undefined): string {
  if (!storedToken) {
    return "";
  }
  if (storedToken.includes(TOKEN_SUFFIX_PREFIX)) {
    const suffix = storedToken.split(TOKEN_SUFFIX_PREFIX, 2)[1] ?? "";
    return suffix.startsWith("P") ? suffix : `P${suffix}`;
  }
  return storedToken;
}

export function nextStoredToken(existingTokens: readonly string[], now: Date = new Date()): string {
  const datePrefix = utcDatePrefix(now);
  const suffixPrefix = `${datePrefix}${TOKEN_SUFFIX_PREFIX}`;
  let maxNum = 0;
  for (const token of existingTokens) {
    if (!token) {
      continue;
    }
    if (token.startsWith(suffixPrefix)) {
      const seqPart = token.slice(suffixPrefix.length);
      if (/^\d+$/.test(seqPart)) {
        maxNum = Math.max(maxNum, Number.parseInt(seqPart, 10));
      }
    } else if (token.startsWith("P") && /^\d+$/.test(token.slice(1))) {
      maxNum = Math.max(maxNum, Number.parseInt(token.slice(1), 10));
    }
  }
  return `${suffixPrefix}${String(maxNum + 1).padStart(4, "0")}`;
}
