export type ArchivedItemTag = { slug: string; label: string };

export type ArchivedItemSummary = {
  id: string;
  category: string;
  name: string;
  seed: string;
  description: string;
  galaxy: number | null;
  coordinates: string | null;
  gameVersion: number | null;
  className: string;
  shipType: string;
  filename: string;
  tags: ArchivedItemTag[];
  createdAt: Date;
  updatedAt: Date;
};

export type ArchivedItemDetail = ArchivedItemSummary & {
  payload: unknown;
  metadata: {
    gameVersion: number;
    className?: string;
    shipType?: string;
    filename?: string;
    extra?: Record<string, string>;
    payload: unknown;
  };
  sourceSaveId: string | null;
};
