import { getPlayerState } from "../player";
import { asArray, asRecord, asString, normalizeSeed } from "../value";
import { clonePlayer } from "./array";
import { displayId, nestedEnum } from "./names";
import type { CategoryAdapter, ExtractedSlot, InsertResult } from "./types";

export type WonderPayload = {
  record: unknown;
  extra: unknown;
};

const AUTO_SOURCES: readonly {
  key: string;
  label: string;
}[] = [
  { key: "WonderCreatureRecords", label: "Creature" },
  { key: "WonderFloraRecords", label: "Flora" },
  { key: "WonderMineralRecords", label: "Mineral" },
  { key: "WonderPlanetRecords", label: "Planet" },
  { key: "WonderTreasureRecords", label: "Treasure" },
  { key: "WonderWeirdBasePartRecords", label: "Weird" },
];

function isWonderPayload(payload: unknown): payload is WonderPayload {
  const rec = asRecord(payload);
  return Boolean(rec && "record" in rec && "extra" in rec);
}

export function wonderSeedFromPayload(payload: unknown): string {
  const rec = asRecord(payload);
  const record = asRecord(rec?.record) ?? rec;
  return normalizeSeed(record?.GenerationID);
}

export function isEmptyWonderSlot(record: unknown, extra: unknown): boolean {
  const name = asString(asRecord(extra)?.CustomName)?.trim();
  const seed = normalizeSeed(asRecord(record)?.GenerationID);
  return !name && seed === "0x0";
}

export function listWonders(json: unknown): ExtractedSlot<WonderPayload>[] {
  const player = getPlayerState(json);
  if (!player) return [];
  const records = asArray(player.WonderCustomRecords);
  const extras = asArray(player.WonderCustomRecordsExtraData);
  if (!records || !extras) return [];

  const personal = records.map((record, index): ExtractedSlot<WonderPayload> => {
    const extra = extras[index] ?? {};
    const extraRec = asRecord(extra) ?? {};
    const empty = isEmptyWonderSlot(record, extra);
    const itemType = nestedEnum(extraRec.ActualType, "WonderType");
    const custom = asString(extraRec.CustomName)?.trim();
    return {
      category: "wonder",
      index,
      name: empty ? `Slot ${index + 1} vazio` : custom || itemType || `Wonder ${index + 1}`,
      seed: empty ? "" : wonderSeedFromPayload({ record, extra }),
      className: "",
      itemType: empty ? "" : itemType,
      filename: "",
      empty,
      extra: empty ? {} : { itemType, kind: "personal" },
      payload: { record, extra },
    };
  });

  const automatic: ExtractedSlot<WonderPayload>[] = [];
  for (const source of AUTO_SOURCES) {
    const rows = asArray(player[source.key]) ?? [];
    rows.forEach((record, i) => {
      const rec = asRecord(record) ?? {};
      const seed = normalizeSeed(rec.GenerationID);
      automatic.push({
        category: "wonder",
        index: 1000 + automatic.length,
        name: `${source.label} ${i + 1}`,
        seed,
        className: "",
        itemType: source.label,
        filename: "",
        empty: false,
        readonly: true,
        group: "automatic",
        extra: {
          itemType: source.label,
          kind: "automatic",
          source: source.key,
          stat: String(rec.WonderStatValue ?? ""),
        },
        payload: { record, extra: { ActualType: { WonderType: source.label } } },
      });
    });
  }

  return [...personal, ...automatic];
}

export function insertWonder(
  mappedJson: unknown,
  payload: unknown,
): InsertResult {
  if (!isWonderPayload(payload)) {
    return { ok: false, error: "Payload de wonder inválido (record + extra)." };
  }
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const records = asArray(cloned.player.WonderCustomRecords);
  const extras = asArray(cloned.player.WonderCustomRecordsExtraData);
  if (!records || !extras) {
    return {
      ok: false,
      error: "WonderCustomRecords ausente neste save.",
    };
  }
  const index = records.findIndex((record, i) =>
    isEmptyWonderSlot(record, extras[i]),
  );
  if (index < 0) {
    return {
      ok: false,
      error:
        "Não há slot vazio de Personal Wonder. O arquivo não expande o array.",
    };
  }
  records[index] = structuredClone(payload.record);
  extras[index] = structuredClone(payload.extra);
  return { ok: true, json: cloned.json, index };
}

export function replaceWonder(
  mappedJson: unknown,
  index: number,
  payload: unknown,
): InsertResult {
  if (!isWonderPayload(payload)) {
    return { ok: false, error: "Payload de wonder inválido (record + extra)." };
  }
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const records = asArray(cloned.player.WonderCustomRecords);
  const extras = asArray(cloned.player.WonderCustomRecordsExtraData);
  if (!records || !extras) {
    return {
      ok: false,
      error: "WonderCustomRecords ausente neste save.",
    };
  }
  if (!Number.isInteger(index) || index < 0 || index >= records.length) {
    return { ok: false, error: "Índice de slot fora do array." };
  }
  records[index] = structuredClone(payload.record);
  extras[index] = structuredClone(payload.extra);
  return { ok: true, json: cloned.json, index };
}

export function clearWonder(
  mappedJson: unknown,
  index: number,
): InsertResult {
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const records = asArray(cloned.player.WonderCustomRecords);
  const extras = asArray(cloned.player.WonderCustomRecordsExtraData);
  if (!records || !extras) {
    return {
      ok: false,
      error: "WonderCustomRecords ausente neste save.",
    };
  }
  if (!Number.isInteger(index) || index < 0 || index >= records.length) {
    return { ok: false, error: "Índice de slot fora do array." };
  }
  const emptyRecord = records.find(
    (record, i) => i !== index && isEmptyWonderSlot(record, extras[i]),
  );
  const emptyExtra = extras.find(
    (extra, i) => i !== index && isEmptyWonderSlot(records[i], extra),
  );
  records[index] = structuredClone(emptyRecord ?? {});
  extras[index] = structuredClone(emptyExtra ?? {});
  return { ok: true, json: cloned.json, index };
}

export const wondersAdapter: CategoryAdapter<WonderPayload> = {
  category: "wonder",
  label: "Wonders",
  columns: [
    { id: "itemType", header: "Type" },
    { id: "seed", header: "Seed" },
  ],
  list: listWonders,
  insert: insertWonder,
  replace: replaceWonder,
  clear: clearWonder,
  summarize(payload) {
    const extra = asRecord(payload.extra);
    const name = asString(extra?.CustomName)?.trim() || "Wonder";
    const itemType = nestedEnum(extra?.ActualType, "WonderType");
    return {
      name,
      seed: wonderSeedFromPayload(payload),
      extra: { itemType },
    };
  },
  seedFromPayload: wonderSeedFromPayload,
  missingMessage:
    "Este save não tem WonderCustomRecords. Não existe chave PersonalWonders.",
};
