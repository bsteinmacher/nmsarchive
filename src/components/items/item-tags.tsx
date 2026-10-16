export function ItemTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li
          key={tag}
          className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}
