import { cookies } from "next/headers";
import { ArchiveHome } from "@/components/items/archive-home";
import {
  ARCHIVE_VIEW_COOKIE,
  parseArchiveViewCookie,
} from "@/lib/archive-view";
import type { Category } from "@/types/nms";

export async function ArchiveHomePage({ category }: { category?: Category }) {
  const jar = await cookies();
  const storedView = parseArchiveViewCookie(jar.get(ARCHIVE_VIEW_COOKIE)?.value);
  return <ArchiveHome category={category} storedView={storedView} />;
}
