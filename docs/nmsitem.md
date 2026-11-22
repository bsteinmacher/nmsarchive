# Envelope `.nmsitem`

A política de quando subir a versão está em [`CHANGELOG.md`](../CHANGELOG.md).

## 5. Formato `.nmsitem`

Arquivo JSON UTF-8, extensão `.nmsitem` (também aceitar `.json` no import). Um arquivo = um item. Export “todos” = `.zip` de vários `.nmsitem`.

```json
{
  "nmsitem": 1,
  "exportedAt": "2026-09-14T18:00:00.000Z",
  "gameVersion": 46002,
  "category": "ship",
  "name": "The Golden Vector",
  "seed": "0x1",
  "description": "Pre-order exotic, Euclid.",
  "tags": ["exotic", "pre-order", "S-class"],
  "coordinates": "107A05555AAA",
  "galaxy": 0,
  "payload": { }
}
```

- `nmsitem`: versão do *schema do arquivo*, não do jogo. Quebrar só se o envelope mudar.
- `payload`: objeto cru da categoria **já desofuscado** (o mesmo que iria em `ShipOwnership[i]` ou `PersistentPlayerBases[i]`).
- Bases COSMOS: `category` é `"deepspace"` ou `"spacestation"`; o payload é o objeto da base (inclui `BaseType`, `Objects[]`, endereço). `extra.baseType` no SQLite duplica o enum para filtro sem abrir o payload.
- Validação de seed: `/^0x[0-9a-fA-F]+$/` e, para naves, `payload.Resource.Seed[1]` deve bater com `seed` (ou ser documentado o mismatch).
- `galaxy`: `RealityIndex` **0–255** (igual ao save). A UI soma +1 só para mostrar.
- Ao importar para um save de `gameVersion` diferente: warning modal, não bloqueio silencioso. Ver §7.

Este envelope é o que o [Colossal Archive](#18-colossal-archive-depois-deste-projeto) vai ingerir. Não criar um formato paralelo “de hub” neste projeto.

Não tentar compatibilidade binária com os `.json` de export do GoatFungus/NomNom no MVP. Na Fase 3, um adaptador “importar JSON de outro editor” pode mapear campos conhecidos.

---

