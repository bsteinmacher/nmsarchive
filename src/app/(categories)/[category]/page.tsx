import { notFound } from "next/navigation";
import { CategoryView } from "@/components/items/category-view";
import { CATEGORIES, isCategory } from "@/types/nms";

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isCategory(category)) {
    notFound();
  }

  return <CategoryView category={category} />;
}
