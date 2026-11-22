# Formato do save

Pesquisa e layout do `.hg`. O código em `src/lib/nms/` vence este texto.

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

O arquivo irmão `mf_save*.hg` (metadados / checksum) usa **XXTEA** + SHA-256, não AES. O jogo frequentemente **carrega o save mesmo com `mf_save` ausente ou inválido**. Gravamos só `save.hg`. A Fase 5 **não** regenera `mf_save`: não há teste in-game (1.7) mostrando que o jogo atual rejeita save sem metadata.

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
- Nunca escrever sem backup local (no nosso caso: cópia do `.hg` na pasta de backup antes de gravar de volta + backup do JSON no IndexedDB + backup do SQLite antes de importar *para o arquivo*).

### 2.6 Caminhos de save (PC)

| Loja | Pasta |
|---|---|
| Steam (Windows) | `%AppData%\HelloGames\NMS\st_<SteamID>\save*.hg` |
| Steam (Linux / Proton) | `~/.local/share/Steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/Application Data/HelloGames/NMS/st_<SteamID>/` |
| GOG | `%AppData%\HelloGames\NMS\DefaultUser\` |
| Microsoft Store | WGS sob `Packages\HelloGames.NoMansSky_*` — **fora do MVP** |

O processo local (`npm run dev` ou o servidor neste computador) descobre a pasta Steam/GOG, lembra a escolha em `data/local-game.json` e lê/grava só `save*.hg` dentro dela. A rota `/api/game-folder` aceita só `localhost` / `127.0.0.1`. O JSON mapeado continua no IndexedDB. Arquivo avulso, sem pasta, ainda baixa uma cópia.

Cada slot é um par: índice ímpar = save do jogador (`save.hg`, `save3.hg`, …), par = automático (`save2.hg`, `save4.hg`, …). `save.hg` conta como índice 1. A UI lista os slots que existem e abre o arquivo com `lastModified` mais recente; trocar de slot escolhe de novo o mais recente do par. Gravar escreve nesse mesmo arquivo. Antes, copia os bytes que estão no disco para `Documentos/NMS Archive` com nome `save4-YYYY-MM-DD-HH-MM-SS.hg`.

O README documenta os paths Steam/GOG.

### 2.7 JSON interno (chaves legíveis)

Raiz típica (saves recentes):

```json
{
  "Version": 6785,
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
| `PersistentPlayerBases[]` | Todas as bases do jogador, **um array só**. O tipo está em `BaseType.PersistentBaseTypes`. COSMOS não criou arrays novos: Deep Space = `PlayerSpaceBase`, Space Station = `PlayerSpaceStationBase`. Ver §2.7.6 |
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

Pasta **gitignored**. Não commitar. Fixture de desenvolvimento: `save2.hg` (LZ4, 14 blocos, ~1.5 MB → ~6.4 MB JSON) + `mf_save2.hg` (432 bytes, XXTEA).

| Dado | Valor |
|---|---|
| Magic | `0xFEEDA1E5` |
| `Version` | `6785` (COSMOS; era `6783` no probe pré-COSMOS) |
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
- Bases: **71** no mesmo `PersistentPlayerBases[]` — `HomePlanetBase` 65, `PlayerShipBase` 2, `FreighterBase` 1, **`PlayerSpaceBase` 2 (Deep Space)**, **`PlayerSpaceStationBase` 1 (Space Station)**. Não há array separado nem chave nova de jogador para COSMOS. Ver §2.7.6.
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

Nomes: existem 256 galáxias; a lista completa está em `src/lib/nms/galaxies.ts` (arquivo **versionado**, não em `data/` gitignored). Índice 0–255 usa o nome; fora da faixa a UI mostra `Galáxia {index+1}`.

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

### 2.7.6 Bases COSMOS: Deep Space e Space Station

Patch **Cosmos 7.0** (set/2026): bases orbitais livres e estação espacial reivindicada. Confirmado no `save2.hg` atual (`Version` 6785, mapping MBINCompiler `7.1.0.1`, **0 unknown keys**).

Não existem `DeepSpaceBases[]` / `SpaceStations[]`. Continuam em `PersistentPlayerBases[]`. O discriminante é o enum já mapeado:

```json
"BaseType": { "PersistentBaseTypes": "PlayerSpaceBase" }
```

Enum `GcPersistentBaseTypes` (MBINCompiler `development`, COSMOS) — só os valores de **jogador** importam para o arquivo:

| `PersistentBaseTypes` | O que é | Menu | Limite |
|---|---|---|---|
| `HomePlanetBase` | Base planetária | **Bases** | Orçamento geral de bases do jogo (não há cap no JSON) |
| `PlayerShipBase` | Base de nave / corvette | **Bases** (tipo “Nave”) | idem |
| `FreighterBase` | Interior da cargueira | **Cargueiras** (já separado na Fase 3) | 1 típica; o save de ref. tem 1 |
| `PlayerSpaceBase` | Deep Space / orbital (Deep-Space Base Computer) | **Deep Space** (novo) | **Sem cap separado no JSON.** Entra no mesmo array; a hipótese de trabalho é que conta como base “normal”. Não inventar limite. |
| `PlayerSpaceStationBase` | Space Station reivindicada | **Space Station** (novo) | **Até 20 por save** (relato de jogo; não há campo de cap no JSON — o array só cresce). Enforce no `insert`. |

Outros valores do enum (`Friends*`, `External*`, `Civilian*`, `GeneratedPlanetBase`, `UITempShipBase`, `ShipBaseScratch`) **não** ganham menu. Se aparecerem no save, caem em **Bases** com o `typeKey` cru como rótulo.

Fixture COSMOS (`.others/save2.hg`, sem nomes neste doc):

- 2× `PlayerSpaceBase` (índices 68 e 70 do array; dezenas de `Objects`)
- 1× `PlayerSpaceStationBase` (índice 69; ~200 `Objects` — `.nmsitem` grande, mesmo aviso das bases planetárias)
- Totais: 71 bases vs. 68 no probe pré-COSMOS. Os 3 novos foram **append** no fim do array, não slots pré-alocados.

Não há chave nova em `PlayerStateData` tipo `OwnedSpaceStations` / `DeepSpaceBaseCount`. Chaves com “Space”/“Station” no player (`SpacePoiDiscoveries`, `AtlasStationAdressData`, …) **não** são estas bases.

#### Como implementar (Fase 4b) — copiar o padrão `FreighterBase`

Já existe o split: `listBases` lista tudo; a UI de **Cargueiras** mostra só `FreighterBase`; **Bases** esconde o interior. Deep Space e Space Station são o mesmo gesto.

1. Slugs novos em `CATEGORIES`: `"deepspace"`, `"spacestation"` (depois de `"base"`). Labels: **Deep Space** e **Space Station**. Rotas `/deepspace`, `/spacestation`, `/archive/deepspace`, `/archive/spacestation` saem de graça com o `[category]` atual.
2. `extract/bases.ts`: constantes `PlayerSpaceBase` / `PlayerSpaceStationBase`; `listDeepSpaceBases` / `listSpaceStationBases` filtrando o array; **Bases** deixa de listar esses tipos (e continua sem `FreighterBase`).
3. `index` do slot = índice em `PersistentPlayerBases` (preciso para replace). `slotLabel` = 1-based **dentro do tipo** (como “Interior” nas cargueiras). Não fabricar 20 linhas vazias de estação.
4. `insert`: primeiro vazio **daquele** `PersistentBaseTypes`; senão **append**. Space Station: recusar se já houver 20 preenchidas. Deep Space: append sem cap inventado. Não reutilizar slot vazio de planeta para meter uma estação.
5. Arquivar: `category` do envelope = `deepspace` | `spacestation` (melhor para o hub). `payload` = o objeto inteiro da base. `metadata.extra.baseType` = o enum. Itens velhos arquivados como `base` + `baseType` COSMOS devem **aparecer** nos menus novos (`archive-service` / `archiveUiCategory`, igual ao interior da cargueira).
6. Aplicar: se o payload for `PlayerSpaceBase` / `PlayerSpaceStationBase`, usar o adapter certo mesmo que o `.nmsitem` antigo diga `category: "base"`.
7. Testes: sintéticos de filtro/insert/cap 20; integração `save2.hg` — 2 deep space, 1 station, `listBases` sem esses tipos, `Version` 6785. Sem nomes pessoais no assert.

**Não fazer nesta fase:** arrays novos no save, categoria `inventory`, separar `PlayerShipBase` (corvette continua em Bases), Friends/External/Civilian menus, regenerar `mf_save`.

---

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

