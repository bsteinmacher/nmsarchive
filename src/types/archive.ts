export type ArchivedItemTag = { slug: string; label: string };

export type ArchivedItemExtra = {
  baseType?: string;
  biome?: string;
  element?: string;
  level?: string;
  traits?: string;
  objects?: string;
  slots?: string;
  tech?: string;
  supercharged?: string;
  planet?: string;
  planetType?: string;
  galaxy?: string;
};

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
  extra?: ArchivedItemExtra;
  /** Seed derivado do payload (companions: identidade genética). */
  identitySeed?: string;
  tags: ArchivedItemTag[];
  screenshotPath: string | null;
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

export type ArchiveTypeGroup = {
  id: string;
  label: string;
  types: string[];
};

export type ArchiveFilterOptions = {
  classes: string[];
  types: string[];
  typeGroups: ArchiveTypeGroup[];
  galaxies: number[];
  tags: ArchivedItemTag[];
};
