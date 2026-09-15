# NMS Archive — Plano de Desenvolvimento

Arquivo pessoal de descobertas de **No Man's Sky**: naves, multi-ferramentas, cargueiras, fragatas, companions, wonders, bases (e o layout do traje). O save aberto é a **ponte** — copiar para o arquivo e devolver ao jogo — não o produto.

A UI da Fase 1 ainda parece um save editor; isso é provisório (não há banco de arquivo ainda). A partir da Fase 2 o centro é o archive. O parser/editor de `.hg` continua necessário e pode até ganhar atalhos (moedas, reordenar slots), mas não deve roubar a navegação.

Este documento é a fonte da verdade para implementação no Cursor. Siga as fases na ordem. Não implemente a Fase N+1 antes de validar a Fase N com um `save.hg` real.

**Fixture de teste:** `.others/save2.hg` (+ `mf_save2.hg`). Pasta gitignored. Nunca commitar.

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
2. **Usar:** no arquivo, escolher um item → aplicar num slot vazio (ou substituir) do save aberto → baixar `save.hg` novo.
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
│     Companions / Wonders / Traje (layout) / Bases
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
| `Units`, `Nanites`, `Specials` | Moedas (`Specials` = Quicksilver). Units no jogo: **0 a 4.294.967.295** (uint32, ~4,29 bi). Dashboard: lápis pequeno **por moeda**, dialog edita só aquele campo. Menu único de moedas/galáxia fica para depois (não é o arquivo). |
| `UniverseAddress.RealityIndex` | Índice **0–255** no save. A comunidade fala **1–256**. Euclid = `0` = “galáxia 1”. Ver §2.7.2 |
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
| Mapping | MBINCompiler `7.1.0.1`, 1471 entradas, **0 unknown keys** |
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

### 2.7.2 Galáxias: 0–255 no save, 1–256 na boca do jogador

`UniverseAddress.RealityIndex` é `uint8` de facto: **0 a 255**. Guias, wikis e jogadores numeram **1 a 256**. Euclid é a primeira = índice `0`.

| Camada | Valor |
|---|---|
| JSON / `.nmsitem` / Prisma `galaxy` | `RealityIndex` cru (0–255). Round-trip com o jogo. |
| UI | `display = index + 1`, mais o nome quando houver |

Não somar +1 na hora de gravar. Helper único: `formatGalaxy(index)` → `"1 · Euclid"`; `parseGalaxyDisplay(n)` só se a UI oferecer 1–256.

Nomes: existem 256 galáxias; a lista completa (wiki / fandom) entra depois em `src/lib/nms/galaxies.ts` (arquivo **versionado**, não em `data/` gitignored). Até a lista estar cheia, índice conhecido usa o nome; o resto mostra `Galáxia {index+1}`.

### 2.7.3 Ship Type (não Filename na tabela)

A coluna `Filename` na lista de naves não dá para ler. Mostrar **Ship Type** derivado de `Resource.Filename` (substring, maiúsculas):

| Marcador no path | Tipo na UI |
|---|---|
| `FIGHTERSPECIALSWITCH` / `FIGHTER` | Fighter |
| `DROPSHIP` | Hauler |
| `SHUTTLE` | Shuttle |
| `SCIENTIFIC` | Explorer |
| `BIOSHIP` | Living Ship |
| `SENTINELSHIP` | Interceptor |
| `SAILSHIP` / `WRACER` / `SOLAR` | Solar |
| `BIGGS` / `GOLDENVECTOR` / `EXOTIC` | Exotic |
| `CORVETTE` | Corvette |
| (sem match) | basename curto (`FIGHTER_PROC`, …) — nunca o path `MODELS/COMMON/...` |

Filename completo continua no dialog de detalhe e no payload arquivado. `lib/nms/ship-type.ts`. Multi-tools e companions terão um “tipo” análogo na Fase 3 (classe da MT / espécie do pet), não path.

### 2.7.4 Traje: só slots e posições de tech

Envelope de inventário (§2.7) já traz o que importa para o layout:

- Slots liberados: `Width`, `Height`, `ValidSlotIndices`
- Supercharged: `SpecialSlots[].Index` (+ tipo)
- Tecnologias: `Inventory_TechOnly.Slots[]` com `Id` + `Index {X,Y}` (e o mesmo se a tech viver no grid geral)

Payload `.nmsitem` de `exosuit` = esses campos dos três grids (`Inventory`, `Inventory_TechOnly`, `Inventory_Cargo`) **sem** copiar `Slots` de Substance/Product. Importar = aplicar width/height/valid indices/posições de tech no save destino; não encher o traje de recursos.

Inventário genérico de itens **não** é categoria. Fora do `CATEGORIES`.

### 2.7.5 Slots vazios e reordenar

`ShipOwnership`, `Multitools` e `Pets` têm tamanho fixo no jogo. A lista do save aberto **mostra todos os slots**: preenchido com nome/tipo/classe, vazio com o texto **“Slot {n} vazio”** (n = índice 1-based na UI, 0-based no array).

Não filtrar vazios na tabela (a Fase 1 fez isso — corrigir na 1b). Export/arquivar/import só em slot preenchido; import ainda cai no primeiro vazio e **não** expande o array.

Reordenar (drag-and-drop na lista): trocar elementos do array, length constante. Slots vazios participam (arrastar a Horizon Vector NX para a 2ª posição, o que estava lá vai para o lugar antigo). **Só arrastar** — sem atalho de setas no teclado (confundiu na 1b). Ao mover, atualizar ponteiros do jogo se existirem. Probe no `save2.hg`: `PrimaryShip`, `CorvetteEditAssociatedShipIndex`; array paralelo `ShipUsesLegacyColours` (length 12) reordena junto. `CurrentShip` é Resource, não índice. Não compactar. Primitive: `reorderSlots(arr, from, to)`.

Primeiro em naves (1b); o mesmo gesto em multi-tools e companions na Fase 3.

### 2.8 Biblioteca recomendada: nenhuma pronta — parser próprio

Não há `nms-save-parser` maduro no npm. A melhor abordagem em TypeScript/Node:

```
lib/nms/
  detect.ts          // plaintext vs LZ4 vs lixo
  lz4-blocks.ts      // encode/decode 0xFEEDA1E5
  mapping.ts         // fetch + cache + walk
  json.ts            // Latin-1 + NUL trailing; UTF-8 só para UI
  extract/ships.ts   // adapters por categoria; listar vazios também
  ship-type.ts       // Filename → Fighter / Hauler / …
  galaxies.ts        // nomes 1–256; RealityIndex 0–255
  write.ts           // merge + reobfuscate + compress + moedas + reorder
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
  "base",
] as const;

/** Naves, MTs e pets: lista com vazios + drag-and-drop. */
export const REORDERABLE_CATEGORIES = ["ship", "multitool", "companion"] as const;
```

Não existe `"inventory"`. Recursos/substâncias não vão para o arquivo.

`action` em `OperationLog`: `export`, `import`, `archive`, `delete`, `backup`, `restore`, `mapping_update`, `currency_edit`, `reorder`.

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
│   │   ├── page.tsx              # Fase 1: dashboard do save (provisório). Fase 2: home do arquivo
│   │   ├── save/page.tsx         # dashboard do save aberto (mover na Fase 2)
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
- `galaxy`: `RealityIndex` **0–255** (igual ao save). A UI soma +1 só para mostrar.
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
6. Layout: dois grupos na sidebar — **Arquivo** e **Save aberto** (links mortos ok na 0). Não tratar as categorias do save como se fossem o arquivo.
7. Docker: Node 22 Alpine, volume `./data`.

**Aceite:** `docker compose up` abre `http://localhost:3000` com shell dark e `prisma migrate` criando `data/nmsarchive.db`.

**Complexidade:** S (0,5–1 dia).

---

### Fase 1 — MVP (carregar save, listar naves, export/import local)

**Status: feita** (parser + testes + dashboard + `/ship` + `.nmsitem` + download `.hg`). Falta 1.7 in-game. **Fase 1b feita** — ver bloco abaixo.

**Objetivo original:** round-trip `save.hg` → JSON → naves na UI → export `.nmsitem` → import para outro slot vazio → download de `save.hg` novo. Sem banco de arquivo pessoal ainda (download do `.nmsitem` basta).

**Fixture local:** testes de integração leem `.others/save2.hg` se existir (skip se a pasta não estiver lá). Nunca commitar. É o save de referência de todo o projeto.

**Aceite (já coberto no Vitest, in-game ainda manual):**

- Save Steam/GOG atual abre e mostra naves com seed e classe.
- Export → import em slot vazio → o jogo carrega a nave (teste manual — **1.7**).
- Save recodificado sem mudanças visuais no JSON (diff das chaves mapeadas vazio, ignorando whitespace).

**Complexidade:** L (parser era o risco).

---

### Fase 1b — Save aberto usável (antes de virar o arquivo)

**Status: feita** (checklist 1b.1–1b.5). Falta só 1.7 in-game (Fase 1).

A Fase 1 entregou um editor de naves. Isto alinhou o save session com o que o arquivo vai precisar, sem ainda o SQLite de itens.

1. **Tabela de naves:** colunas `Slot | Nome | Classe | Ship Type | Seed | Ações`. Sem Filename na tabela (fica no dialog). Slots vazios visíveis (“Slot {n} vazio”). `lib/nms/ship-type.ts`.
2. **Reordenar naves** por drag-and-drop; `ShipOwnership` troca de índice; length fixo; vazios participam. Sem setas no teclado. Teste sintético + `save2.hg`. Ponteiros: `PrimaryShip`, `CorvetteEditAssociatedShipIndex` + `ShipUsesLegacyColours`.
3. **Moedas no dashboard:** lápis pequeno **em cada** Units / Nanites / Quicksilver; dialog edita só aquele campo (`PlayerStateData.Units|Nanites|Specials`). Units 0–4.294.967.295. IndexedDB + “Baixar save” (Recomprimido LZ4). Menu único de moedas/galáxia = depois, não nesta fase.
4. **Galáxia na UI:** `display = index+1` (`src/lib/nms/galaxies.ts`). JSON / `.nmsitem` guardam 0–255. Euclid = 1. Save de ref. `save2.hg` = RealityIndex 255 → “256 · Odyalutai”.
5. Sidebar: “Arquivo pessoal” (`/archive` placeholder) vs “Save aberto” (Dashboard `/` + categorias). Home **não** é `/archive` até a Fase 2.

**Aceite (verificado no browser + Vitest):** 12 linhas no `save2.hg` (10 + 2 vazios); arrastar preenchida ↔ vazio; lápis por moeda grava no JSON; Euclid seria 1 (teste unitário); save2 mostra 256.

**Prompt Cursor:**

> Implemente a Fase 1b do PLAN.md: Ship Type no lugar de Filename, slots vazios na lista, drag-and-drop de naves, dialog de Units/Nanites/Quicksilver, galáxia 1–256 na UI. Fixture `.others/save2.hg`. Não comece a Fase 2.

**Complexidade:** S–M (1–2 dias).

---

### Fase 2 — Banco e arquivo pessoal (o produto)

**Objetivo:** o que você guarda sobrevive ao fechar o browser. A home passa a ser o arquivo.

1. Rodar o schema Prisma (§3) — já existe; ligar os routers.
2. Routers tRPC: `saves.createMetadata` (hash SHA-256 do arquivo original, calculado no cliente), `items.archive`, `items.list`, `items.get`, `items.update` (descrição/tags), `items.delete`.
3. Backup do `.db` no `items.archive` e em qualquer import que mutacione o banco.
4. `OperationLog` em todas as mutations.
5. **IA:** `/` = arquivo (grade + filtro por categoria). `/archive/[category]` se ajudar a URL. Dashboard do save vai para `/save`. Sidebar: Arquivo (com as categorias arquiváveis) em cima; Save aberto embaixo, só com sessão.
6. No dialog da nave *do save*: “Arquivar” (descrição obrigatória) e “Aplicar no save” no dialog do *arquivo*. Comparar mesmo `seed` + `category`.
7. Settings: path do DB (informativo), botão backup/restore, atualizar `mapping.json`.

Sim, o arquivo tem lista de categorias — é a navegação principal. As categorias no save aberto são outra superfície (slots, reorder, copiar de/para o arquivo).

**Aceite:** arquivar 3 naves, restart do Docker, as 3 continuam no `/`; log mostra as operações; um `.db` backup aparece em `data/backups/`; a home não é mais o dropzone.

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

1. Multi-tools (`Multitools[]`, não `WeaponOwnership`) — clone de ships: vazios visíveis, reorder, tipo/classe na tabela.
2. Companions (`Pets[]`) — idem: vazios + drag; `CustomName`, `CreatureSeed`, `Descriptors`, `Biome`.
3. Traje — **só layout** (§2.7.4). Sem categoria inventário.
4. Cargueira — Resource + 3 inventários (o inventário *da cargueira* viaja no payload dela, não como item solto).
5. Fragatas — array de frota; seed + traits.
6. Bases (`PersistentPlayerBases`) — payload pesado (`Objects[]`); `.nmsitem` grande; avisar na UI.
7. Wonders — **Personal Wonders** (`WonderCustomRecords[i]` + `WonderCustomRecordsExtraData[i]`). Records automáticos = listagem secundária / read-only.
8. Extra se o probe mostrar: Corvettes, Squadron.

**Não fazer:** adapter `inventory` de substâncias/produtos do exosuit.

UI do *save:* `app/(categories)/[category]/page.tsx` + colunas por adapter.  
UI do *arquivo:* `/archive` + `/archive/[category]` (Fase 2), mesmas categorias arquiváveis.

**Aceite:** cada categoria arquivável lista no save, arquiva, aplica num slot, exporta `.nmsitem`. Naves/MT/pets reordenam. Traje round-trip só de slots+tech. Inventário de itens inexistente na nav.

**Complexidade:** L (5–8 dias, bases/wonders puxam).

---

### Fase 4 — Screenshots, tags, filtros

1. Upload de screenshot (webp, max 1 MB) → `data/screenshots/<id>.webp`.
2. Tags com autocomplete (`Tag.slug`).
3. Filtros no **arquivo**: classe, Ship Type (§2.7.3), tags, galáxia (**display 1–256**, filtro no índice 0–255), texto livre (nome + descrição).
4. Grade com thumb; tabela sem thumb.
5. Comparação visual: item do save vs. arquivado (diff raso de seed/class/Ship Type + JSON diff colapsável).

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
| `Units` acima de ~4,29 bi | Teto uint32 (0–4.294.967.295). Avisar se o valor sair disso; `number` JS cobre o intervalo |
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
| 0 | Scaffold Next + Prisma + Docker + shell UI | S | 0,5–1 | — **feita** |
| 1 | Parser + naves + .nmsitem round-trip | L | 4–7 | save real, mapping.json — **feita** (falta 1.7 in-game) |
| 1b | Ship Type, slots vazios, reorder naves, moedas, galáxia 1–256 | S–M | 1–2 | Fase 1 |
| 2 | SQLite arquivo pessoal + home = archive | M | 2–3 | Fase 1b |
| 3 | Demais categorias (sem inventário; traje = layout; reorder MT/pets) | L | 5–8 | Fase 2, probe |
| 4 | Screenshots, tags, filtros, compare | M | 2–3 | Fase 2–3 |
| 5 | Docker polido, docs, lista de galáxias, XXTEA se preciso | S–M | 1–2 | Fase 2 |

**Caminho crítico:** round-trip da nave no jogo (1.7), depois o arquivo (Fase 2). Sem archive persistente o app continua parecendo um editor.

**Ordem de implementação (checklist linear):**

```
[x] 0.1 create-next-app + shadcn + dark + sidebar
[x] 0.2 prisma schema + migrate + tRPC hello
[x] 0.3 Dockerfile
[x] 1.1 lz4-blocks + teste sintético
[x] 1.2 mapping walk + teste com JSON ofuscado mínimo
[x] 1.3 worker + zustand/IDB
[x] 1.4 dashboard summary
[x] 1.5 extract ships + página
[x] 1.6 .nmsitem export/import + download .hg
[ ] 1.7 teste manual in-game
[x] 1b.1 Ship Type + slots vazios na tabela
[x] 1b.2 reorder naves (drag)
[x] 1b.3 dialog Units / Nanites / QS
[x] 1b.4 galáxia display 1–256
[x] 1b.5 sidebar Arquivo vs Save aberto
[ ] 2.1 routers items/saves/logs
[ ] 2.2 backup sqlite hook
[ ] 2.3 home = arquivo + categorias do archive
[ ] 2.4 mover dashboard para /save
[ ] 3.x adapters (multitool + companion c/ reorder → traje layout → … → wonder)
[ ] 4.x tags/screenshots/filtros
[ ] 5.x docs + compose + mapping updater + galaxies.ts completo
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
- Lista de galáxias NMS (256 nomes, 1-based na wiki): preencher `src/lib/nms/galaxies.ts` na Fase 5 / quando couber
- Skills de UI (Cursor, usuário): [jakubkrehel/skills](https://github.com/jakubkrehel/skills) — ver §1.6

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

`lz4-blocks.ts` deve expor `decodeHg(buf: Uint8Array): Uint8Array` e `encodeHg(jsonBytes: Uint8Array): Uint8Array` (bytes Latin-1, não necessariamente UTF-8).

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

A Fase 0 e a 1 já estão no repo. Cole no Cursor:

> Implemente a Fase 1b do PLAN.md: na lista de naves, Ship Type no lugar de Filename e slots vazios visíveis; drag-and-drop para reordenar ShipOwnership; no dashboard, ícone para editar Units/Nanites/Quicksilver; galáxia na UI como 1–256 (índice 0–255 no JSON). Fixture `.others/save2.hg`. Não persista o save no servidor. Não comece a Fase 2. Skills de UI já estão no usuário (`~/.agents/skills/`, §1.6): use better-ui / better-layout / better-writing / better-accessibility nesta fase; interface-review no fim. Não use essas skills no parser.

Depois da 1b (e do round-trip in-game da nave), aí sim a Fase 2 — home = arquivo pessoal.
