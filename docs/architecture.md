# Arquitetura

O arquivo pessoal é o produto. O save aberto é onde se copia um item para o arquivo e se devolve ao jogo.

Código e testes vencem este texto. A UI da Fase 1 foi escrita antes do banco; o centro do app hoje é o arquivo.

**Fixture de teste:** `.others/save2.hg` (+ `mf_save2.hg`). Pasta gitignored. Nunca commitar.

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
┌──────────────────┐   save.hg (File)    ┌──────────────────────┐
│ Browser          │ ──────────────────► │ Web Worker           │
│ Arquivo pessoal  │ ◄── JSON / slots ── │ lz4 + mapping.json   │
│ + save aberto    │                     └──────────────────────┘
└────────┬─────────┘
         │ POST só do item arquivado
         ▼
┌──────────────────┐                     ┌──────────────────────┐
│ tRPC API         │ ◄── ArchivedItem ── │ Prisma / SQLite      │
│ (Next.js)        │                     │ arquivo pessoal      │
└──────────────────┘                     └──────────────────────┘
```

Fluxo mental (o que o usuário está fazendo):

1. **Guardar:** abrir `save.hg` → escolher um slot (nave, MT, pet…) → Arquivar no SQLite (e/ou baixar `.nmsitem`).
2. **Usar:** no arquivo, escolher um item → aplicar num slot vazio (ou substituir) do save aberto → gravar no mesmo `.hg` (com backup local) ou baixar, se o arquivo foi aberto avulso.
3. O JSON do save vive em memória + IndexedDB. **Não** vai para a API.
4. O servidor só conhece itens arquivados, metadados de saves (nome, versão, hash, **não** o blob) e o log de operações.

O save aberto é sessão. O arquivo é o que sobrevive a fechar o browser / outro save.

### 1.3 Licenças — não copiar GoatFungus nem libNOM

| Projeto | Licença | Uso permitido |
|---|---|---|
| [goatfungus/NMSSaveEditor](https://github.com/goatfungus/NMSSaveEditor) | **Closed source** (autor confirmou em 2018) | Inspiração de UX. **Não** decompilar o `.jar`. |
| [zencq/NomNom](https://github.com/zencq/NomNom) + [libNOM.io](https://github.com/zencq/libNOM.io) + [libNOM.map](https://github.com/zencq/libNOM.map) | **GPL-3.0** | Referência de comportamento. Copiar código GPL contaminaria o app. |
| [NMSCD/NMS-Save-Decoder](https://github.com/NMSCD/NMS-Save-Decoder) | GPL-3.0 | Mesma restrição. A *ideia* (LZ4 + mapping) é formato público. |
| [monkeyman192/MBINCompiler](https://github.com/monkeyman192/MBINCompiler) `mapping.json` | Dados de mapeamento publicados em cada release | Baixar em runtime/build. Não vendorar o compilador. |
| Formato LZ4 `0xFEEDA1E5` | Documentado em gists públicos (Chase-san / Robert Maupin) e crates Rust | Reimplementar. |

**Licença do NMS Archive:** MIT (ou Apache-2.0). Parser escrito do zero. `mapping.json` baixado do GitHub Releases do MBINCompiler, cacheado em `data/mapping.json`.

### 1.4 Escopo explícito vs. o que *não* é

Fazemos: PC Steam / GOG (`save*.hg`).  
Não fazemos no MVP: Xbox WGS, PS4 SaveWizard, Switch `manifest*.dat`, formato vanilla `2000`. Cross-save da Hello Games (patch 5.25+) já permite editar no PC e devolver à outra plataforma.

**Inventário de itens/substâncias:** não é categoria do arquivo. Sem export, sem import, sem `.nmsitem` de stack de `FUEL1`. Os grids existem no JSON do save e podem aparecer como contexto (ex.: inventário de uma nave arquivada já vai no payload da nave), mas não há página “Inventário” para catalogar recursos.

**Traje (exosuit):** arquivável só o *layout* — quantos slots estão liberados e onde estão as tecnologias (e supercharged, se estiver no mesmo envelope). Não arquivar o conteúdo de substâncias/produtos do exosuit. Se o probe mostrar que isso não se separa limpo do grid, a categoria fica só no save aberto (read-only) até dá.

### 1.5 Arquitetura de informação (archive first)

A sidebar da Fase 1 lista categorias do *save* no topo e o arquivo embaixo. Isso inverte o produto. Alvo a partir da Fase 2:

```
NMS Archive
├── Arquivo pessoal          ← home `/`
│     Naves / Multi-tools / Cargueiras / Fragatas /
│     Companions / Wonders / Traje (layout) /
│     Bases / Deep Space / Space Station
│     (filtro por categoria; a lista de categorias VIVE aqui)
├── Save aberto              ← sessão, não o destino
│     Dashboard (abrir .hg, moedas, galáxia, baixar)
│     Naves / Multi-tools / Companions / … no save
│     (slots vazios visíveis; daqui se arquiva e se aplica)
└── Configurações
```

Até a Fase 2 existir de verdade, `/` pode continuar no dashboard do save — mas o copy e os grupos da sidebar já devem dizer “Save aberto” vs “Arquivo”, não “Categorias” genéricas que parecem o produto.

Rotas de categoria do save: `/{category}` (já existem). Rotas do arquivo: `/archive` e `/archive/[category]` (Fase 2). Não duplicar a mesma tabela nos dois lugares com o mesmo título.

### 1.6 Skills de UI no Cursor (já instaladas)

Coleção [jakubkrehel/skills](https://github.com/jakubkrehel/skills) instalada **no usuário** (`~/.agents/skills/`), não no git deste repo. O Cursor descobre sozinho. Agents: **usar** em telas, copy e a11y; **não** usar no parser LZ4/mapping/Prisma.

| Skill | Quando |
|---|---|
| `better-ui`, `better-layout`, `better-accessibility` | Tabela de naves, dialogs, dropzone, hit areas |
| `better-writing` | Empty states, Arquivo vs Save aberto, erros |
| `interface-review` | Passada no fim de uma fase de UI (1b, 2, 4) |
| `better-colors`, `better-typography` | Só se o tema/shadcn pedir; não converter o design system no meio de uma fase |
| `break`, `variant` | Iterar um componente isolado |

Invocar pelo nome (`/better-ui`, `/interface-review`) ou aplicar quando a tarefa for claramente visual. Não atrasar aceite funcional por polish.

### 1.7 Como o arquivo é persistido

Não é um JSON no disco por categoria, nem um JSON gigante com tudo. Há **três camadas**, cada uma com um item como unidade:

| Camada | O que é | Unidade |
|---|---|---|
| **SQLite** (`data/nmsarchive.db`, tabela `ArchivedItem`) | O arquivo pessoal que sobrevive ao fechar o browser | **1 linha por item** |
| **`.nmsitem`** | Export/import portátil (JSON UTF-8) | **1 arquivo por item**. “Exportar todos” = `.zip` de vários `.nmsitem` |
| **Screenshot** | WebP em `data/screenshots/<uuid>.webp` | 1 arquivo de imagem por item (opcional); o banco só guarda o path |

A linha `ArchivedItem` carrega:

- Colunas escalares: `category`, `name`, `seed`, `description`, `galaxy`, `coordinates`, …
- `metadata` (**JSON na coluna**): `gameVersion`, `className`, `shipType`, `filename`, `extra` (ex.: `baseType`, contagem de `Objects`) e o **`payload` cru** do slot do save (já desofuscado).
- Tags: tabela de junção `ItemTag` → `Tag` (não um array JSON).
- `sourceSaveId`: metadados do save de origem (hash, nome, versão) — **nunca o `.hg`**.

O save aberto **não** entra nisso. Ele vive no IndexedDB do browser (JSON mapeado + bytes originais do `.hg`). Fechar o app não apaga o SQLite; apaga só a sessão se o usuário limpar o save.

Implicação para COSMOS e para o [Colossal Archive](#18-colossal-archive-depois-deste-projeto): o contrato estável é **um item = um envelope + um payload**. Deep Space e Space Station são o mesmo objeto `PersistentPlayerBases[i]`; o que muda é o `category` da UI / do envelope e o `extra.baseType`. Não criar um JSON “de bases” nem um dump do save.

### 1.8 Colossal Archive (depois deste projeto)

Hub público para jogadores enviarem descobertas (seed / model / print) para outros usarem. **Fora do escopo de implementação agora.** Este arquivo pessoal é o laboratório do formato.

O que o NMS Archive atual **já** precisa acertar para o hub não nascer torto:

1. **Unidade de partilha = `.nmsitem` (um item).** O hub ingere o mesmo envelope. Nunca um save `.hg`, nunca um dump SQLite.
2. **Identidade partilhável** já existe: `category` + `seed` + `payload` + screenshot opcional + `galaxy` / glifos. Não inventar um segundo schema.
3. **Facetas de base** vêm de `payload.BaseType.PersistentBaseTypes` (e/ou `metadata.extra.baseType`). Deep Space e Space Station precisam de slugs próprios no menu (`deepspace`, `spacestation`) para o hub indexar sem abrir o JSON.
4. **Save nunca sobe.** A regra §1.2 continua no hub: só o item. Screenshot é o “print”; seed/model estão no payload.
5. **Não** colocar auth multi-tenant, upload público, moderação ou Postgres neste repo até a Fase 6. Envelope `.nmsitem` v1 permanece; campos de hub (`author`, `shareId`) só quando o hub existir — não reservar colunas vazias agora.

Quando este projeto pessoal estiver estável (Fase 5 + 4b), a Fase 6 descreve o hub. Até lá, qualquer decisão de categoria/payload deve perguntar: “isto ainda cabe num `.nmsitem` de um item?”.

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

Valores de `category` arquivável (constante TS, não enum Prisma):

```ts
export const CATEGORIES = [
  "ship",
  "multitool",
  "freighter",
  "frigate",
  "companion",
  "wonder",
  "exosuit", // layout: slots + posições de tech — não o conteúdo
  "base", // planeta + nave/corvette; sem interior de cargueira, Deep Space nem Station
  "deepspace", // COSMOS: PersistentBaseTypes = PlayerSpaceBase
  "spacestation", // COSMOS: PersistentBaseTypes = PlayerSpaceStationBase; cap 20 no insert
] as const;

/** Naves, MTs e pets: lista com vazios + drag-and-drop. */
export const REORDERABLE_CATEGORIES = ["ship", "multitool", "companion"] as const;
```

Não existe `"inventory"`. Recursos/substâncias não vão para o arquivo.

`deepspace` e `spacestation` são categorias de **UI e de envelope**. O JSON do save continua num único `PersistentPlayerBases[]`. Prisma `category` é `String` — sem migration. Itens já arquivados como `"base"` com `extra.baseType` COSMOS devem ser listados nos menus novos (mesmo truque do `FreighterBase` em Cargueiras).

`action` em `OperationLog`: `export`, `import`, `archive`, `delete`, `backup`, `restore`, `mapping_update`, `currency_edit`, `reorder`.

Backup automático do SQLite: copiar `data/nmsarchive.db` → `data/backups/nmsarchive-YYYYMMDD-HHmmss.db` **antes** de qualquer mutation de import/arquivo. Guardar 20 mais recentes. Config em `AppSetting`.

---

## 4. Estrutura de pastas

```
nmsarchive/
├── docs/
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
│   └── icons/                    # UI do jogo (PNG); ver §4.1
│       └── class/                # s.png a.png b.png c.png
├── tests/
│   ├── fixtures/                 # save sintético versionado; .hg real NÃO entra no git
│   └── nms/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Fase 2: home do arquivo
│   │   ├── save/page.tsx         # dashboard do save aberto
│   │   ├── archive/page.tsx
│   │   ├── archive/[category]/page.tsx
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

### 4.1 Ícones e imagens

O projeto não usa ícone nem imagem da Hello Games. Não criar `public/icons/` para classe, moeda, tipo de nave ou qualquer outro glyph do jogo. Classe, moeda e tipo ficam em texto.

| O quê | Onde | Git |
|---|---|---|
| Screenshot do item arquivado | `data/screenshots/<uuid>.webp` | gitignored |
| Chrome da interface (fechar, tema, grid) | `lucide-react` (componente) | não é arquivo |
| Favicon do App Router | `src/app/favicon.ico` ou `src/app/icon.png` | versionado |

Não usar os SVGs de boilerplate do create-next-app (`vercel.svg`, `file.svg`, `window.svg`).

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
- Lista de galáxias NMS (256 nomes, 1-based na wiki): `src/lib/nms/galaxies.ts`
- Skills de UI (Cursor, usuário): [jakubkrehel/skills](https://github.com/jakubkrehel/skills) — ver §1.6
- Cosmos 7.0 (Deep Space / Space Station): [nomanssky.com/cosmos-update](https://www.nomanssky.com/cosmos-update/)
- Enum `GcPersistentBaseTypes`: [MBINCompiler `GcPersistentBaseTypes.cs`](https://github.com/monkeyman192/MBINCompiler/blob/development/libMBIN/Source/NMS/GameComponents/GcPersistentBaseTypes.cs)

---


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
