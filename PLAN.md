# NMS Archive — Plano de Desenvolvimento

Editor/gerenciador web de saves de **No Man's Sky**: arquivo pessoal de naves, multi-ferramentas, cargueiras, fragatas, pets, wonders e bases, com import/export entre saves.

Este documento é a fonte da verdade para implementação no Cursor. Siga as fases na ordem. Não implemente a Fase N+1 antes de validar a Fase N com um `save.hg` real.

---

## Sumário

1. [Decisão de arquitetura](#1-decisão-de-arquitetura)
2. [Pesquisa técnica (saves `.hg`)](#2-pesquisa-técnica-saves-hg)
3. [Schema Prisma](#3-schema-prisma)
4. [Estrutura de pastas](#4-estrutura-de-pastas)
5. [Formato `.nmsitem`](#5-formato-nmsitem)
6. [Fases de desenvolvimento](#6-fases-de-desenvolvimento)
7. [Riscos e mitigações](#7-riscos-e-mitigações)
8. [Roadmap e complexidade](#8-roadmap-e-complexidade)
9. [Referências](#9-referências)

---

## 1. Decisão de arquitetura

### 1.1 Stack (confirmada)

| Camada | Tecnologia |
|---|---|
| UI | Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| API | tRPC sobre Route Handler (`app/api/trpc/[trpc]/route.ts`) |
| DB | SQLite via Prisma |
| Parse do save | TypeScript próprio + LZ4 *block* (WASM) + `mapping.json` do MBINCompiler |
| Estado do save aberto | Cliente (Zustand + IndexedDB) — **nunca persistir o `.hg` no servidor** |
| Deploy | Docker self-hosted; Vercel só se o SQLite for substituído (não é o alvo inicial) |

tRPC em vez de API Routes soltas: o contrato `ArchivedItem` / `NmsItemFile` precisa ser compartilhado entre UI, parser e banco. Prisma + tRPC elimina duplicação de tipos.

### 1.2 O save nunca sobe para o servidor

Requisito de segurança: *nunca armazenar o save completo no servidor*. A arquitetura que garante isso de verdade:

```
┌─────────────┐     save.hg (File)      ┌──────────────────────┐
│   Browser   │ ──────────────────────► │ Web Worker           │
│  Dashboard  │ ◄── JSON desofuscado ── │ lz4 + mapping.json   │
└──────┬──────┘                         └──────────────────────┘
       │ itens extraídos (.nmsitem)
       ▼
┌─────────────┐                         ┌──────────────────────┐
│  tRPC API   │ ◄── só o item ───────── │ Prisma / SQLite      │
│  (Next.js)  │                         │ arquivo pessoal      │
└─────────────┘                         └──────────────────────┘
```

1. O usuário escolhe `save.hg` (e opcionalmente `mf_save.hg`).
2. Um Web Worker descomprime LZ4, aplica `mapping.json` e devolve JSON legível.
3. O JSON vive em memória + IndexedDB (sobrevive a F5). **Não** vai para a API.
4. Exportar para o arquivo pessoal: POST só do objeto da categoria.
5. Importar do arquivo pessoal: GET do item → merge no JSON local → recomprime → download de um novo `save.hg`.

O servidor só conhece itens arquivados, metadados de saves (nome, versão, hash, **não** o blob) e o log de operações.

### 1.3 Licenças — não copiar GoatFungus nem libNOM

| Projeto | Licença | Uso permitido |
|---|---|---|
| [goatfungus/NMSSaveEditor](https://github.com/goatfungus/NMSSaveEditor) | **Closed source** (autor confirmou em 2018) | Inspiração de UX. **Não** decompilar o `.jar`. |
| [zencq/NomNom](https://github.com/zencq/NomNom) + [libNOM.io](https://github.com/zencq/libNOM.io) + [libNOM.map](https://github.com/zencq/libNOM.map) | **GPL-3.0** | Referência de comportamento. Copiar código GPL contaminaria o app. |
| [NMSCD/NMS-Save-Decoder](https://github.com/NMSCD/NMS-Save-Decoder) | GPL-3.0 | Mesma restrição. A *ideia* (LZ4 + mapping) é formato público. |
| [monkeyman192/MBINCompiler](https://github.com/monkeyman192/MBINCompiler) `mapping.json` | Dados de mapeamento publicados em cada release | Baixar em runtime/build. Não vendorar o compilador. |
| Formato LZ4 `0xFEEDA1E5` | Documentado em gists públicos (Chase-san / Robert Maupin) e crates Rust | Reimplementar. |

**Licença do NMS Archive:** MIT (ou Apache-2.0). Parser escrito do zero. `mapping.json` baixado do GitHub Releases do MBINCompiler, cacheado em `data/mapping.json`.

### 1.4 Escopo explícito do MVP vs. o que *não* é

Fazemos: PC Steam / GOG (`save*.hg`).  
Não fazemos no MVP: Xbox WGS, PS4 SaveWizard, Switch `manifest*.dat`, formato vanilla `2000`. Cross-save da Hello Games (patch 5.25+) já permite editar no PC e devolver à outra plataforma.

---

## 2. Pesquisa técnica (saves `.hg`)

### 2.1 Correção importante: **não é AES**

O mito “AES com chave fixa” vale, no máximo, para o formato antigo **`2000`** (vanilla) e para *wrappers* de console. Saves modernos de PC **não são criptografados**.

Pipeline real (formato **2002+**, Frontiers 3.60 até o jogo atual):

```
save.hg
  │
  ├─ começa com `{` (0x7B)     → JSON puro (raro; saves exportados/debug)
  └─ começa com 0xE5A1EDFE     → blocos LZ4 sequenciais (caso normal)
         magic u32 LE = 0xFEEDA1E5
         → concatenar blocos descomprimidos
         → JSON UTF-8, frequentemente com um byte NUL no final
         → chaves ofuscadas ("F2P" em vez de "Version")
         → aplicar mapping.json do MBINCompiler
         → JSON legível
```

O arquivo irmão `mf_save*.hg` (metadados / checksum) usa **XXTEA** + SHA-256, não AES. O jogo frequentemente **carrega o save mesmo com `mf_save` ausente ou inválido**. No MVP, gravamos só `save.hg`. Na Fase 5, opcionalmente regeneramos `mf_save`.

Referência de formatos (libNOM.io):

| Código | Época do jogo |
|---|---|
| `2000` | Vanilla — criptografado; **fora do escopo**. Ver [MetaIdea/nms-savetool](https://github.com/MetaIdea/nms-savetool) |
| `2001` | Foundation 1.10 → Prisms 3.53 |
| `2002` | Frontiers 3.60 → Adrift 4.72 (extensão no Waypoint 4.00) |
| `2003` | Worlds Part I 5.00 → The Cursed 5.29 |
| `2004` | Worlds Part II 5.50+ (extensão em 5.53) — **alvo atual** |

### 2.2 Layout de um bloco LZ4

Cada bloco tem header de **16 bytes**, little-endian:

| Offset | Tipo | Campo |
|---|---|---|
| 0 | `u32` | Magic `0xFEEDA1E5` |
| 4 | `u32` | `compressedSize` |
| 8 | `u32` | `uncompressedSize` (máx. `0x80000` = 512 KiB) |
| 12 | `u32` | reservado (`0`) |
| 16 | `u8[]` | payload LZ4 **block** (não frame) |

Ao gravar: fatiar o JSON em chunks de no máximo `0x80000`, comprimir cada um com LZ4 block (`store_size=false`), prefixar o header.

**Pacotes npm a evitar:** `lz4js` no modo alto nível fala *frame* LZ4, não *block*. Usar codec de **block** com tamanho de saída conhecido (o header já traz `uncompressedSize`).

Sugestão de implementação:

- Browser / Worker: WASM (`lz4-wasm` / `lz4-block-codec` do gorhill) ou porta TS mínima do decoder de bloco.
- Testes Node: a mesma função, sem bindings nativos, para o parser ser idêntico em worker e Vitest.

### 2.3 Ofuscação de chaves

A partir do formato 2002 as chaves JSON são hashes curtos (ex.: `"F2P"` → `"Version"`, `"6f="` → `"PlayerStateData"`).

`mapping.json` do MBINCompiler:

```json
{
  "libMBIN_version": "6.x.x",
  "Mapping": [
    { "Key": "F2P", "Value": "Version" }
  ]
}
```

URL estável:

```
https://github.com/monkeyman192/MBINCompiler/releases/latest/download/mapping.json
```

Regras:

- Construir `Map<string,string>` uma vez. **Não** fazer `.find()` por chave (o decoder Deno do NMSCD é O(n²) e é lento em saves grandes).
- Walk recursivo em objetos/arrays.
- Chave desconhecida: **manter como está** e registrar em `unknownKeys: string[]`. Isso é o que torna o parser tolerante a patches.
- JSON do jogo pode ter IDs procedimentais com encoding Unicode quebrado (confirmado no save local: ~61 bytes inválidos). Decode **Latin-1** para round-trip; UTF-8 lossy só para display. Remover um NUL trailing se houver. Não “consertar” strings de ID.
- Detectar se já está mapeado: presença de `Version` (número) na raiz.

Ao gravar o `.hg`, **reofuscar** (Value → Key) antes de comprimir. O jogo espera as chaves curtas.

### 2.4 WASM no browser?

Não existe um parser NMS “oficial” em WASM pronto para drop-in. Opções reais:

| Abordagem | Veredito |
|---|---|
| TS + WASM só do LZ4 | **Escolhida.** Controle total, MIT, roda no Worker. |
| Compilar [nms-save](https://docs.rs/nms-save) (Rust) para WASM | Excelente qualidade, mas o crate modela só um subconjunto (Copilot). Útil como *oráculo* de testes, não como runtime. |
| Chamar libNOM via processo .NET | Frágil no Docker, GPL, mata o requisito “parse no cliente”. |

### 2.5 Como GoatFungus e NomNom fazem

**GoatFungus (Java, closed source)**  
Binários em GitHub, sem código. Features públicas relevantes: export/import de naves, multi-tools e fragatas; backup automático; editor JSON cru. O autor descreveu (issue #1207, 2025) que o único formato consistente entre plataformas é o JSON descomprimido, e que IDs procedimentais quebram Unicode padrão.

**NomNom (C#, GPL-3.0)**  
Stack: `libNOM.io` (I/O multiplataforma, LZ4 via `K4os.Compression.LZ4`) + `libNOM.map` (ofuscação, baixa `mapping.json` do MBINCompiler). Getter/setter por JSONPath *ou* por índices numéricos (resiste a rename de chaves). Backup na primeira escrita. Não copiar código; copiar *comportamento*:

- Detectar plataforma pelo diretório (`st_<SteamID>`, `DefaultUser`, …).
- Slot = par `save.hg` / `mf_save.hg`.
- Nunca escrever sem backup local (no nosso caso: backup do JSON no IndexedDB + backup do SQLite antes de importar *para o arquivo*).

### 2.6 Caminhos de save (PC)

| Loja | Pasta |
|---|---|
| Steam (Windows) | `%AppData%\HelloGames\NMS\st_<SteamID>\save*.hg` |
| Steam (Linux / Proton) | `~/.local/share/Steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/Application Data/HelloGames/NMS/st_<SteamID>/` |
| GOG | `%AppData%\HelloGames\NMS\DefaultUser\` |
| Microsoft Store | WGS sob `Packages\HelloGames.NoMansSky_*` — **fora do MVP** |

O app é upload manual. Não precisamos varrer o disco no browser (sem File System Access API). Na Fase 5, um modo Docker/Electron pode sugerir o path.

### 2.7 JSON interno (chaves legíveis)

Raiz típica (saves recentes):

```json
{
  "Version": 6783,
  "Platform": "Win|Final",
  "ActiveContext": "Main",
  "CommonStateData": {
    "SaveName": "...",
    "TotalPlayTime": 0
  },
  "BaseContext": {
    "GameMode": 5,
    "PlayerStateData": { }
  }
}
```

`ExpeditionContext` é opcional — o save de referência em `.others/` não tem essa chave. `TotalPlayTime` / `TimeAlive` estão em **segundos**. `Platform` no save atual é `Win|Final`, não `PC`.

`PlayerStateData` — confirmado no save local (mapping MBINCompiler 7.1.0.1, 0 chaves curtas desconhecidas):

| Campo | Uso |
|---|---|
| `SaveSummary` | Resumo (“In the X system”) |
| `Units`, `Nanites`, `Specials` | Moedas (`Specials` = Quicksilver). `Units` pode ser **negativo** (overflow i32). |
| `UniverseAddress.RealityIndex` | Índice da galáxia (0 = Euclid) |
| `UniverseAddress.GalacticAddress` | VoxelX/Y/Z, SolarSystemIndex, PlanetIndex |
| `Inventory`, `Inventory_TechOnly`, `Inventory_Cargo` | Exosuit |
| `ShipOwnership[]` | Naves ativas (12 slots; vazio = `Resource.Filename == ""`) |
| `ArchivedShipOwnership[]` | Arquivo in-game de naves (18 slots no save de ref.) |
| `Multitools[]` | Multi-tools. **`WeaponOwnership` não existe** neste formato |
| `ArchivedMultitools[]` | Arquivo in-game de multi-tools |
| `ActiveMultioolIndex` | Índice da MT ativa (typo do jogo: falta um `t`) |
| `CurrentFreighter` | Resource da cargueira atual (`Filename` + `Seed`) |
| `FreighterInventory` (+ `_TechOnly`, `_Cargo`) | Inventários da cargueira atual |
| `FreighterFleet[]` | Outras cargueiras (Resource + 3 inventários cada) |
| `FleetFrigates[]` | Fragatas da frota |
| `Pets[]` | Companions |
| `PersistentPlayerBases[]` | Bases (`BaseType.PersistentBaseTypes`) |
| `WonderCustomRecords[]` + `WonderCustomRecordsExtraData[]` | **Personal Wonders** — as 12 que o jogador escolhe (nome + tipo). Não existe chave `PersonalWonders` no JSON |
| `WonderPlanetRecords[]`, `WonderCreatureRecords[]`, `WonderFloraRecords[]`, `WonderMineralRecords[]`, `WonderTreasureRecords[]`, `WonderWeirdBasePartRecords[]` | Records automáticos do jogo (melhores stats descobertos), não os escolhidos |
| `VehicleOwnership[]` | Exocraft |
| `SquadronPilots[]` | Esquadrão |
| `Health`, `TimeAlive` | Stats do jogador |

Inventário (todas as categorias usam o mesmo envelope):

```json
{
  "Slots": [
    {
      "Type": { "InventoryType": "Substance" },
      "Id": "FUEL1",
      "Amount": 250,
      "MaxAmount": 250,
      "DamageFactor": 0,
      "Index": { "X": 0, "Y": 0 }
    }
  ],
  "ValidSlotIndices": [{ "X": 0, "Y": 0 }],
  "SpecialSlots": [
    { "Type": { "InventorySpecialSlotType": "TechBonus" }, "Index": { "X": 0, "Y": 0 } }
  ],
  "Class": { "InventoryClass": "S" },
  "StackSizeGroup": { "InventoryStackSizeGroup": "Ship" },
  "BaseStatValues": [],
  "Width": 7,
  "Height": 5,
  "IsCool": false,
  "Name": "",
  "Version": 1
}
```

Nave (objeto de `ShipOwnership` — campos estáveis desde Outlaws):

```json
{
  "Name": "My Ship",
  "Resource": {
    "Filename": "MODELS/COMMON/SPACECRAFT/FIGHTERS/FIGHTER_PROC.SCENE.MBIN",
    "Seed": [true, "0xABCDEF0123456789"],
    "AltId": "",
    "ProceduralTexture": { "Samplers": [] }
  },
  "Seed": [false, "0x0"],
  "Inventory": {},
  "Inventory_Cargo": {},
  "Inventory_TechOnly": {},
  "InventoryLayout": { "Slots": 10, "Seed": [true, "0x1"], "Level": 1 },
  "Location": 0,
  "Position": [0, 0, 0, -1],
  "Direction": [0, 0, 0, -1]
}
```

Seed no save é quase sempre o tuple `[boolean, "0xHEX"]`. No arquivo pessoal e no `.nmsitem`, normalizar para string hex minúscula com prefixo `0x`.

O parser **não** deve tipar o save inteiro. Tipar só o que extraímos. O resto fica `unknown` / `Record<string, unknown>`.

### 2.7.1 Probe do save local (`.others/save2.hg`)

Pasta **gitignored**. Não commitar. Fixture de desenvolvimento: `save2.hg` (LZ4, 13 blocos, ~1.5 MB → ~6.4 MB JSON) + `mf_save2.hg` (432 bytes, XXTEA).

| Dado | Valor |
|---|---|
| Magic | `0xFEEDA1E5` |
| `Version` | `6783` |
| `Platform` | `Win\|Final` |
| `GameMode` | `5` (Permadeath) |
| Mapping | MBINCompiler `7.1.0.1`, 1462 entradas, **0 unknown keys** |
| NUL trailing | sim |
| UTF-8 inválido | **sim** (~61 bytes `0x80`+ no meio do JSON) |

Contagens (só estrutura; sem nomes/seeds pessoais neste doc):

- Naves: 10 preenchidas / 12 slots (`FIGHTER_PROC`, `WRACER`, `DROPSHIP_PROC`, `BIGGS`, `SENTINELSHIP_PROC`, `BIOSHIP_PROC`, `SHUTTLE_PROC`, `FIGHTERSPECIALSWITCH`)
- Multi-tools: 6 em `Multitools` (não em `WeaponOwnership`)
- Cargueira atual: `PIRATEFREIGHTER.SCENE.MBIN`, inventário classe S 10×12
- `FreighterFleet`: 8
- `FleetFrigates`: 17 — chaves `ResourceSeed`, `FrigateClass`, `InventoryClass`, `TraitIDs`, `Stats`, `CustomName`, …
- Pets: 30
- Bases: 68 (`HomePlanetBase` 65, `PlayerShipBase` 2, `FreighterBase` 1)
- **Personal Wonders** (escolha do jogador): `WonderCustomRecords` (12) + `WonderCustomRecordsExtraData` (12, em paralelo). Cada extra tem `CustomName` e `ActualType.WonderType` (`Creature`, `Flora`, …). No save de ref.: 10 Creature + 2 Flora, todos nomeados. Não há chave `PersonalWonders` no mapping.
- Records automáticos (não escolhidos): `WonderCreatureRecords` (15), `WonderFloraRecords` (8), `WonderMineralRecords` (8), `WonderPlanetRecords` (11), `WonderTreasureRecords` (13), `WonderWeirdBasePartRecords` (11) — cada item é `{ GenerationID, WonderStatValue, SeenInFrontend }`
- Corvette: campos `CorvetteDraftShipSeed`, `CorvetteEditAssociatedShipIndex`, `CorvetteStorageInventory` (não há array separado de corvettes neste save)
- Sem `ExpeditionContext`

**Implicação para `json.ts`:** não decodificar como UTF-8 lossy (`�`) na hora de **gravar**. Tratar os bytes como Latin-1 (1 byte = 1 char), `JSON.parse`, e reencodar Latin-1. Assim os IDs procedimentais quebrados sobrevivem o round-trip. UTF-8 com `fatal: false` serve só para *exibir* na UI.

### 2.8 Biblioteca recomendada: nenhuma pronta — parser próprio

Não há `nms-save-parser` maduro no npm. A melhor abordagem em TypeScript/Node:

```
lib/nms/
  detect.ts          // plaintext vs LZ4 vs lixo
  lz4-blocks.ts      // encode/decode 0xFEEDA1E5
  mapping.ts         // fetch + cache + walk
  json.ts            // Latin-1 + NUL trailing; UTF-8 só para UI
  extract/ships.ts   // adapters por categoria
  write.ts           // merge + reobfuscate + compress
  glyphs.ts          // endereço → 12 glifos
```

Isso é ~300–500 linhas no núcleo, testável com um fixture `.hg` (não commitar save real — usar `.hg` anonimizado em `tests/fixtures/` no `.gitignore`, e um fixture sintético minúsculo versionado).

---

## 3. Schema Prisma

Arquivo: `prisma/schema.prisma`.

SQLite não tem enum nativo nem array. Enums viram `String` com constraint na aplicação; tags viram tabela de junção (filtro `WHERE tag = ?` é o caso de uso). Screenshot: **path no disco**, não BLOB (SQLite + imagens grandes é armadilha).

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

/// Metadados de um save que o usuário carregou. Sem o JSON/blob.
model Save {
  id            String   @id @default(uuid())
  fileName      String
  platform      String
  gameVersion   Int?
  formatHint    String?
  playerName    String?
  saveName      String?
  galaxy        Int?
  playTimeSec   BigInt?
  sha256        String
  slotHint      String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  items         ArchivedItem[]
  operations    OperationLog[]

  @@index([sha256])
}

model ArchivedItem {
  id            String   @id @default(uuid())
  category      String
  name          String
  seed          String
  description   String
  metadata      Json
  screenshotPath String?
  coordinates   String?
  galaxy        Int?
  sourceSaveId  String?
  sourceSave    Save?    @relation(fields: [sourceSaveId], references: [id], onDelete: SetNull)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tags          ItemTag[]
  operations    OperationLog[]

  @@index([category])
  @@index([seed])
  @@index([galaxy])
}

model Tag {
  id     String    @id @default(uuid())
  slug   String    @unique
  label  String
  items  ItemTag[]
}

model ItemTag {
  itemId String
  tagId  String
  item   ArchivedItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  tag    Tag          @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([itemId, tagId])
  @@index([tagId])
}

model OperationLog {
  id         String   @id @default(uuid())
  action     String
  category   String?
  itemId     String?
  item       ArchivedItem? @relation(fields: [itemId], references: [id], onDelete: SetNull)
  saveId     String?
  save       Save?         @relation(fields: [saveId], references: [id], onDelete: SetNull)
  detail     Json?
  createdAt  DateTime @default(now())

  @@index([action])
  @@index([createdAt])
}

model AppSetting {
  key   String @id
  value Json
}
```

O bloco acima é o mesmo do [Apêndice B](#apêndice-b--schema-prisma-canônico). Use aquele ao gerar o arquivo.

Valores de `category` (constante TS, não enum Prisma, para evoluir sem migration a cada categoria):

```ts
export const CATEGORIES = [
  "ship",
  "multitool",
  "freighter",
  "frigate",
  "companion",
  "wonder",
  "exosuit",
  "inventory",
  "base",
] as const;
```

`action` em `OperationLog`: `export`, `import`, `archive`, `delete`, `backup`, `restore`, `mapping_update`.

Backup automático do SQLite: copiar `data/nmsarchive.db` → `data/backups/nmsarchive-YYYYMMDD-HHmmss.db` **antes** de qualquer mutation de import/arquivo. Guardar 20 mais recentes. Config em `AppSetting`.

---

## 4. Estrutura de pastas

```
nmsarchive/
├── PLAN.md
├── README.md
├── package.json
├── next.config.ts
├── tsconfig.json
├── docker-compose.yml
├── Dockerfile
├── .env.example                  # DATABASE_URL=file:./data/nmsarchive.db
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── .others/                      # gitignored — save pessoal (save2.hg, mf_save2.hg)
├── data/                         # gitignored (db, mapping cache, backups, screenshots)
├── public/
├── tests/
│   ├── fixtures/                 # save sintético versionado; .hg real NÃO entra no git
│   └── nms/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # dashboard do save aberto
│   │   ├── archive/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── (categories)/
│   │   │   └── [category]/page.tsx
│   │   └── api/trpc/[trpc]/route.ts
│   ├── components/
│   │   ├── layout/app-sidebar.tsx
│   │   ├── save/upload-dropzone.tsx
│   │   ├── items/item-grid.tsx
│   │   ├── items/item-detail-dialog.tsx
│   │   └── theme/theme-provider.tsx
│   ├── server/
│   │   ├── trpc/
│   │   │   ├── router.ts
│   │   │   ├── routers/items.ts
│   │   │   ├── routers/saves.ts
│   │   │   ├── routers/logs.ts
│   │   │   └── routers/settings.ts
│   │   └── db.ts                 # PrismaClient singleton
│   ├── lib/
│   │   ├── nms/
│   │   │   ├── detect.ts
│   │   │   ├── lz4-blocks.ts
│   │   │   ├── mapping.ts
│   │   │   ├── json.ts
│   │   │   ├── glyphs.ts
│   │   │   ├── player.ts         # dashboard summary
│   │   │   ├── write.ts
│   │   │   ├── extract/
│   │   │   │   ├── types.ts
│   │   │   │   ├── index.ts      # registry de adapters
│   │   │   │   ├── ships.ts
│   │   │   │   ├── multitools.ts
│   │   │   │   └── ...
│   │   │   └── worker.ts         # entry do Web Worker
│   │   ├── nmsitem.ts            # serialize/parse .nmsitem
│   │   ├── utils.ts
│   │   └── validations.ts        # zod
│   ├── stores/
│   │   └── save-session.ts       # zustand persist → IndexedDB
│   └── types/
│       └── nms.ts
```

Alias `@/*` → `src/*`.

---

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
- `payload`: objeto cru da categoria **já desofuscado** (o mesmo que iria em `ShipOwnership[i]`).
- Validação de seed: `/^0x[0-9a-fA-F]+$/` e, para naves, `payload.Resource.Seed[1]` deve bater com `seed` (ou ser documentado o mismatch).
- Ao importar para um save de `gameVersion` diferente: warning modal, não bloqueio silencioso. Ver §7.

Não tentar compatibilidade binária com os `.json` de export do GoatFungus/NomNom no MVP. Na Fase 3, um adaptador “importar JSON de outro editor” pode mapear campos conhecidos.

---

## 6. Fases de desenvolvimento

Cada fase termina com um critério de aceite testável. Prompts sugeridos para o Cursor estão no final de cada fase.

### Fase 0 — Scaffold (antes do MVP)

**Objetivo:** app sobe, dark mode, sidebar vazia, SQLite migra.

1. `create-next-app` (App Router, TS, Tailwind, ESLint, App no `src/`).
2. shadcn/ui: `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `table`, `tabs`, `textarea`, `tooltip`, `sonner`, `sidebar`.
3. `next-themes` — default `dark`.
4. Prisma + SQLite; `postinstall` = `prisma generate`.
5. tRPC 11 + `@tanstack/react-query`.
6. Layout: sidebar de categorias (links mortos ok) + área principal.
7. Docker: Node 22 Alpine, volume `./data`.

**Aceite:** `docker compose up` abre `http://localhost:3000` com shell dark e `prisma migrate` criando `data/nmsarchive.db`.

**Complexidade:** S (0,5–1 dia).

---

### Fase 1 — MVP (carregar save, listar naves, export/import local)

**Objetivo:** round-trip `save.hg` → JSON → naves na UI → export `.nmsitem` → import para outro slot vazio → download de `save.hg` novo. Sem banco de arquivo pessoal ainda (download do `.nmsitem` basta).

Ordem de arquivos:

1. `lib/nms/detect.ts` + `lz4-blocks.ts` + testes com fixture sintético (JSON pequeno comprimido à mão).
2. `lib/nms/mapping.ts` — fetch MBINCompiler, cache `data/mapping.json`, walk com `Map`.
3. `lib/nms/json.ts` + `player.ts` (summary).
4. Web Worker + `stores/save-session.ts`.
5. Dropzone na home: selecionar `save.hg` → dashboard (nome, galáxia, horas, units/nanites/QS, contagem de naves).
6. `extract/ships.ts`: filtrar slots com `Resource.Filename` não vazio.
7. Página `/ships`: tabela (nome, class, seed, filename).
8. Dialog de detalhe: JSON tree + botão “Exportar .nmsitem”.
9. “Exportar todas”.
10. “Importar .nmsitem”: achar primeiro slot vazio em `ShipOwnership`; se não houver, erro claro (não expandir o array no MVP — o jogo tem limite de slots).
11. “Baixar save.hg”: reobfuscar + LZ4.

**Fixture local:** testes de integração leem `.others/save2.hg` se existir (skip se a pasta não estiver lá). Nunca commitar esse arquivo.

**Probe:** já feito neste PLAN (§2.7.1). Revalidar só se o jogo patchar e o mapping quebrar.

**Aceite:**

- Save Steam/GOG atual abre e mostra naves com seed e classe.
- Export → import em slot vazio → o jogo carrega a nave (teste manual).
- Save recodificado sem mudanças visuais no JSON (diff das chaves mapeadas vazio, ignorando whitespace).

**Prompt Cursor (quando for implementar):**

> Implemente a Fase 1 do PLAN.md: parser LZ4+mapping no Web Worker, dashboard, listagem de ShipOwnership, export/import .nmsitem e download do save.hg. Não persista o save no servidor. Comece pelos testes de lz4-blocks com fixture sintético. Use `.others/save2.hg` como teste de integração local (a pasta é gitignored). Decode JSON em Latin-1 para o round-trip.

**Complexidade:** L (4–7 dias, o parser é o risco).

---

### Fase 2 — Banco e arquivo pessoal

**Objetivo:** itens sobrevivem ao fechar o browser.

1. Rodar o schema Prisma (§3).
2. Routers tRPC: `saves.createMetadata` (hash SHA-256 do arquivo original, calculado no cliente), `items.archive`, `items.list`, `items.get`, `items.update` (descrição/tags), `items.delete`.
3. Backup do `.db` no `items.archive` e em qualquer import que mutacione o banco.
4. `OperationLog` em todas as mutations.
5. Página `/archive` + filtro por categoria.
6. No dialog da nave: “Arquivar” (pede descrição obrigatória) e “Comparar com arquivo” (mesmo `seed` + `category`).
7. Settings: path do DB (informativo), botão backup/restore, atualizar `mapping.json`.

**Aceite:** arquivar 3 naves, restart do Docker, as 3 continuam lá; log mostra as operações; um `.db` backup aparece em `data/backups/`.

**Complexidade:** M (2–3 dias).

---

### Fase 3 — Todas as categorias

Cada categoria é um **adapter** com a mesma interface:

```ts
export type CategoryAdapter<TPayload = unknown> = {
  category: Category;
  label: string;
  list(player: PlayerStateData): ExtractedItem<TPayload>[];
  insert(player: PlayerStateData, payload: TPayload): InsertResult;
  summarize(payload: TPayload): { name: string; seed: string; extra: Record<string, string> };
};
```

Ordem sugerida (da mais estável para a mais volátil):

1. Multi-tools (`WeaponOwnership`) — quase clone de ships.
2. Exosuit (os 3 inventários) — um “item” composto, ou três; decidir no adapter: **um item `exosuit` com os três grids no payload**.
3. Inventário genérico (produtos/substâncias do exosuit) — overlap com 2; na UI, aba “Itens” vs “Tecnologias”.
4. Cargueira — Resource + 3 inventários; validar chaves no probe da Fase 1.
5. Fragatas — array de frota; seed + traits.
6. Pets (`Pets[]`) — `CustomName`, `CreatureSeed`, `Descriptors`, `Biome`.
7. Bases (`PersistentPlayerBases`) — payload pesado (`Objects[]`); exportar pode gerar `.nmsitem` grande. Avisar na UI.
8. Wonders — categoria principal = **Personal Wonders** (`WonderCustomRecords[i]` + `WonderCustomRecordsExtraData[i]`). Records automáticos (`WonderPlanetRecords` etc.) são listagem secundária / read-only no MVP da categoria, porque o jogador não “escolhe” esses slots.
9. Extra se o probe mostrar: Corvettes, Squadron.

UI: `app/(categories)/[category]/page.tsx` genérico + colunas configuráveis por adapter.

**Aceite:** cada categoria lista, exporta um, exporta todos, importa, arquiva, compara.

**Complexidade:** L (5–8 dias, bases/wonders puxam).

---

### Fase 4 — Screenshots, tags, filtros

1. Upload de screenshot (webp, max 1 MB) → `data/screenshots/<id>.webp`.
2. Tags com autocomplete (`Tag.slug`).
3. Filtros: classe (S/A/B/C extraída de `payload.Inventory.Class.InventoryClass`), tipo (substring de `Resource.Filename`: FIGHTER, HAULER, EXOTIC, …), tags, galáxia, texto livre (nome + descrição).
4. Grade com thumb; tabela sem thumb.
5. Comparação visual: item do save vs. arquivado (diff raso de seed/class/filename + JSON diff colapsável).

**Aceite:** filtrar `S-class` + tag `exotic` retorna o conjunto certo; screenshot aparece no dialog.

**Complexidade:** M (2–3 dias).

---

### Fase 5 — Deploy e documentação

1. `Dockerfile` multi-stage + `docker-compose.yml` (porta 3000, volume `data`).
2. Healthcheck `/api/health`.
3. README: captura de save, backup, aviso de risco, “não use em Ironman/expedição sem cópia”.
4. Regenerar `mf_save.hg` (XXTEA) se testes mostrarem que o jogo da versão atual rejeita save sem metadata — senão documentar que é opcional.
5. Script `scripts/update-mapping.ts`.
6. Changelog + política de versão do `.nmsitem`.
7. Vercel: **não recomendado** com SQLite em filesystem efêmero. Se um dia for, migrar para Postgres (`provider = "postgresql"` — o schema já está portável).

**Aceite:** clone limpo, `docker compose up --build`, upload de save, arquivar item, restart, item permanece.

**Complexidade:** S–M (1–2 dias + XXTEA se necessário).

---

## 7. Riscos e mitigações

### 7.1 Hello Games muda o JSON no próximo patch

**Risco principal do projeto.** Sintomas: chaves novas ofuscadas (aparecem em `unknownKeys`), arrays movidos, campos de nave/corvette.

Mitigações:

- Parser estruturalmente tolerante (`unknown` + adapters com `?.`).
- `mapping.json` atualizável sem release (Settings → “Atualizar mapping”).
- Fixture de save por versão major; CI só com o sintético.
- Campo `gameVersion` no `.nmsitem` e no `Save`.
- Feature flags por adapter: se `ShipOwnership` não existir, a página mostra “categoria indisponível neste save” em vez de crash.

### 7.2 Import entre versões diferentes

O que quebra de verdade:

| Situação | Efeito |
|---|---|
| Nave de Worlds II → save pré-Outlaws | Falta `Inventory_Cargo`; o jogo pode ignorar ou corromper o slot |
| Tecnologia/item ID novo num save antigo | Item some ou vira cubo vermelho |
| Supercharged slots (`SpecialSlots`) num save que não conhece | Slots extras ignorados ou crash de UI |
| Corvette → save sem Voyagers | Array desconhecido; potencialmente ignorado |
| `Units` overflow i32 | Já acontece *in-game*; ao editar, preferir `BigInt`/`number` e não clamar |
| Tamanho de inventário acima do vanilla | GoatFungus avisa que o jogo *pode quebrar* |
| Base `Objects[]` entre updates | Peças de construção removidas / IDs mudados = base fantasma |

Política do NMS Archive:

1. Comparar `gameVersion` do `.nmsitem` com o save aberto.
2. Diff de chaves de primeiro nível do `payload` vs. um slot vazio do save destino.
3. Modal: lista de chaves só-na-origem / só-no-destino. O usuário confirma.
4. Nunca expandir arrays além do length atual (não criar o 13º slot de nave).
5. Backup IndexedDB do JSON *antes* do merge (`session.history`, 5 versões).

### 7.3 LZ4 errado na escrita

Sintoma: o jogo recusa o save ou “save corrupted”.

Mitigações:

- Round-trip test: decode(encode(json)) === json (bytes do JSON, não do `.hg`).
- Respeitar `uncompressedSize <= 0x80000`.
- Escrever reservado = 0.
- Sempre oferecer o `.hg` original para download (“baixar original”) a partir do IndexedDB.

### 7.4 Mapping desatualizado

Sintoma: dashboard vazio (`PlayerStateData` ainda se chama `6f=`).

Mitigação: detector `isObfuscated` (raiz sem `Version` ou sem `BaseContext`). Bloquear a UI com CTA para atualizar mapping. Permitir upload manual de `mapping.json`.

### 7.5 Saves enormes / UI travada

Saves com muitas bases: JSON de dezenas de MB.

Mitigação: Worker obrigatório; não estruturar o JSON na thread da UI; `JSON.parse` no worker; passar *só* o summary + arrays das categorias via `postMessage` (structured clone). O JSON completo fica no worker ou num `IDB` store, acessado por request.

### 7.6 Unicode quebrado em IDs procedimentais

GoatFungus: IDs de produtos/tech procedimentais não são Unicode bem formado. **Confirmado** no save local: UTF-8 estrito falha; `JSON.parse` após Latin-1 funciona.

Mitigação: o pipeline de leitura/escrita usa Latin-1 ponta a ponta. A UI pode mostrar UTF-8 lossy. Teste de regressão: round-trip de `.others/save2.hg` deve preservar os bytes inválidos (hash do JSON Latin-1 igual). Não sanitizar IDs.

### 7.7 GPL / closed source

Mitigação: parser original; review de PRs contra copypaste de NomNom/libNOM. Não commitar `mapping.json` se a licença do MBINCompiler exigir attribution — preferir download. Incluir NOTICE apontando MBINCompiler e o gist LZ4.

### 7.8 `mf_save.hg` / checksum

Mitigação: testar save reescrito *sem* `mf_save` no jogo atual. Se falhar, portar XXTEA (algoritmo público; o crate `nms-save` documenta rounds diferentes por formato 2001/2002/2003/2004). Não bloquear o MVP nisso.

### 7.9 Segurança da instância self-hosted

Não é um SaaS multi-tenant no desenho atual. Mesmo assim:

- Sem auth no MVP (localhost). Docker bind `127.0.0.1:3000`.
- Upload de screenshot: magic-bytes + conversão server-side, não servir `.svg` arbitrário.
- Path traversal em `screenshotPath` / backups: só basename UUID.

---

## 8. Roadmap e complexidade

Estimativas para **um** dev usando Cursor, com um `save.hg` real à mão. Não incluem “descobrir o formato” (já feito neste PLAN).

| Fase | Entrega | Tamanho | Dias | Dependências |
|---|---|---|---|---|
| 0 | Scaffold Next + Prisma + Docker + shell UI | S | 0,5–1 | — |
| 1 | Parser + naves + .nmsitem round-trip | L | 4–7 | save real, mapping.json |
| 2 | SQLite arquivo pessoal + logs + backup DB | M | 2–3 | Fase 1 |
| 3 | Demais categorias via adapters | L | 5–8 | probe da Fase 1 |
| 4 | Screenshots, tags, filtros, compare | M | 2–3 | Fase 2–3 |
| 5 | Docker polido, docs, XXTEA se preciso | S–M | 1–2 | Fase 2 |

**Caminho crítico:** Fase 1. Se o round-trip da nave falhar no jogo, não adianta UI de arquivo.

**Ordem de implementação (checklist linear):**

```
[ ] 0.1 create-next-app + shadcn + dark + sidebar
[ ] 0.2 prisma schema + migrate + tRPC hello
[ ] 0.3 Dockerfile
[ ] 1.1 lz4-blocks + teste sintético
[ ] 1.2 mapping walk + teste com JSON ofuscado mínimo
[ ] 1.3 worker + zustand/IDB
[ ] 1.4 dashboard summary
[ ] 1.5 extract ships + página
[ ] 1.6 .nmsitem export/import + download .hg
[ ] 1.7 teste manual in-game
[ ] 2.1 routers items/saves/logs
[ ] 2.2 backup sqlite hook
[ ] 2.3 UI arquivo + comparar seed
[ ] 3.x adapters (multitool → … → wonder)
[ ] 4.x tags/screenshots/filtros
[ ] 5.x docs + compose + mapping updater
```

---

## 9. Referências

- Formato LZ4 dos saves: [gist Chase-san/Robert Maupin](https://gist.github.com/Chase-san/16076aaa90429ea6170550926b70f48b)
- Decoder TS+Python: [NMSCD/NMS-Save-Decoder](https://github.com/NMSCD/NMS-Save-Decoder)
- Mapping: [MBINCompiler releases / mapping.json](https://github.com/monkeyman192/MBINCompiler/releases/latest)
- I/O multiplataforma (referência, GPL): [libNOM.io](https://github.com/zencq/libNOM.io)
- Ofuscação (referência, GPL): [libNOM.map](https://github.com/zencq/libNOM.map)
- Editor de referência (GPL): [NomNom](https://github.com/zencq/NomNom)
- Editor de referência (closed): [NMSSaveEditor](https://github.com/goatfungus/NMSSaveEditor)
- Parser Rust (bom modelo mental): [nms-save](https://docs.rs/nms-save) / [oxur/nms-copilot](https://github.com/oxur/nms-copilot)
- Formato 2000 (legacy): [MetaIdea/nms-savetool](https://github.com/MetaIdea/nms-savetool)
- Estrutura JSON de naves/inventário: [pljeroen/nmstoolkit](https://github.com/pljeroen/nmstoolkit), issues GoatFungus (#1030 naves, #533/#1308 pets)
- LZ4 block WASM: [gorhill lz4-wasm](https://gorhill.github.io/lz4-wasm/)

---

## Apêndice A — Núcleo do decoder (rascunho)

Não é o código final; é o contrato que a Fase 1 deve respeitar.

```ts
const MAGIC = 0xfeeda1e5;
const HEADER = 16;
const MAX_CHUNK = 0x80000;

export function detect(buf: Uint8Array): "json" | "lz4" | "unknown" {
  if (buf.length >= 1 && buf[0] === 0x7b) return "json";
  if (buf.length >= 4) {
    const magic = new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0, true);
    if (magic === MAGIC) return "lz4";
  }
  return "unknown";
}

export type Mapping = { Key: string; Value: string };

export function applyMapping(
  node: unknown,
  map: Map<string, string>,
  unknownKeys: Set<string>,
): unknown {
  if (Array.isArray(node)) {
    return node.map((n) => applyMapping(n, map, unknownKeys));
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const mapped = map.get(k);
      if (!mapped && !map.has(k)) {
        // chave já legível ou nova
        if (k.length <= 4 && k !== mapped) unknownKeys.add(k);
      }
      out[mapped ?? k] = applyMapping(v, map, unknownKeys);
    }
    return out;
  }
  return node;
}
```

`lz4-blocks.ts` deve expor `decodeHg(buf: Uint8Array): Uint8Array` e `encodeHg(jsonUtf8: Uint8Array): Uint8Array`.

## Apêndice B — Schema Prisma canônico

Copiar este bloco para `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Save {
  id          String   @id @default(uuid())
  fileName    String
  platform    String
  gameVersion Int?
  formatHint  String?
  playerName  String?
  saveName    String?
  galaxy      Int?
  playTimeSec BigInt?
  sha256      String
  slotHint    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  items       ArchivedItem[]
  operations  OperationLog[]

  @@index([sha256])
}

model ArchivedItem {
  id             String   @id @default(uuid())
  category       String
  name           String
  seed           String
  description    String
  metadata       Json
  screenshotPath String?
  coordinates    String?
  galaxy         Int?
  sourceSaveId   String?
  sourceSave     Save?    @relation(fields: [sourceSaveId], references: [id], onDelete: SetNull)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  tags           ItemTag[]
  operations     OperationLog[]

  @@index([category])
  @@index([seed])
  @@index([galaxy])
}

model Tag {
  id    String    @id @default(uuid())
  slug  String    @unique
  label String
  items ItemTag[]
}

model ItemTag {
  itemId String
  tagId  String
  item   ArchivedItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  tag    Tag          @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([itemId, tagId])
  @@index([tagId])
}

model OperationLog {
  id        String        @id @default(uuid())
  action    String
  category  String?
  itemId    String?
  item      ArchivedItem? @relation(fields: [itemId], references: [id], onDelete: SetNull)
  saveId    String?
  save      Save?         @relation(fields: [saveId], references: [id], onDelete: SetNull)
  detail    Json?
  createdAt DateTime      @default(now())

  @@index([action])
  @@index([createdAt])
}

model AppSetting {
  key   String @id
  value Json
}
```

## Apêndice C — Próximo prompt

Quando for começar a implementar, cole no Cursor:

> Execute a Fase 0 e em seguida a Fase 1 do `PLAN.md`. Não pule o parser: quero testes de `lz4-blocks` e `mapping` antes da UI. O save completo não pode ir para o servidor. Use shadcn/ui, dark mode default, tRPC e Prisma/SQLite como no plano. Atualize o README com instruções de dev.

Depois do round-trip in-game da nave, aí sim pedir a Fase 2.
