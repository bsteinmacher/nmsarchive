import { notFound } from "next/navigation";
import { ArchiveHome } from "@/components/items/archive-home";
import { CATEGORIES, isCategory } from "@/types/nms";

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

export default async function ArchiveCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isCategory(category)) notFound();
  return <ArchiveHome category={category} />;
}
