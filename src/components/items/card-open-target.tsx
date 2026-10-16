"use client";

export function CardOpenTarget({
  label,
  onOpen,
}: {
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      className="absolute inset-0 z-[1] rounded-xl"
      onClick={onOpen}
    />
  );
}
