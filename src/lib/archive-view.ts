import type { ArchiveView } from "@/lib/archive-url";

export const ARCHIVE_VIEW_COOKIE = "nmsarchive-view";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseArchiveViewCookie(
  value: string | undefined,
): ArchiveView | undefined {
  if (value === "table" || value === "grid") return value;
  return undefined;
}

export function archiveViewCookieAssignment(view: ArchiveView): string {
  return `${ARCHIVE_VIEW_COOKIE}=${view}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function rememberArchiveView(view: ArchiveView) {
  document.cookie = archiveViewCookieAssignment(view);
}
