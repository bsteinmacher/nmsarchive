import { notFound } from "next/navigation";
import { ArchiveHomePage } from "@/components/items/archive-home-page";
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
  return <ArchiveHomePage category={category} />;
}
