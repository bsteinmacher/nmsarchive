# Roadmap

Fases 0 a 5 estão feitas. Falta o teste manual in-game (item 1.7 do checklist da Fase 1). A Fase 6 não entra neste repositório.

Os números de seção abaixo são os do plano original. §1 e §4 estão em [`architecture.md`](./architecture.md). §2 está em [`save-format.md`](./save-format.md). §5 está em [`nmsitem.md`](./nmsitem.md). §7 está em [`risks.md`](./risks.md).

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

**Status: feita** (checklist 2.1–2.4).

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

**Status: feita** (checklist 3.1–3.8). Fase 4 feita — ver bloco abaixo.

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
6. Bases (`PersistentPlayerBases`) — payload pesado (`Objects[]`); `.nmsitem` grande; avisar na UI. COSMOS (Deep Space / Space Station) = **Fase 4b**, não nesta.
7. Wonders — **Personal Wonders** (`WonderCustomRecords[i]` + `WonderCustomRecordsExtraData[i]`). Records automáticos = listagem secundária / read-only.
8. Extra se o probe mostrar: Corvettes, Squadron.

Probe `save2.hg`: Corvettes não têm array próprio (ficam em `ShipOwnership` com tipo Corvette). `SquadronPilots` existe (4), mas **não** entra em `CATEGORIES` nesta fase.

**Não fazer:** adapter `inventory` de substâncias/produtos do exosuit.

UI do *save:* `app/(categories)/[category]/page.tsx` + colunas por adapter.  
UI do *arquivo:* `/archive` + `/archive/[category]` (Fase 2), mesmas categorias arquiváveis.

**Aceite:** cada categoria arquivável lista no save, arquiva, aplica num slot, exporta `.nmsitem`. Naves/MT/pets reordenam. Traje round-trip só de slots+tech. Inventário de itens inexistente na nav.

**Prompt Cursor:** já executado nesta fase.

**Complexidade:** L (5–8 dias, bases/wonders puxam).

---

### Fase 4 — Screenshots, tags, filtros

**Status: feita** (checklist 4.1–4.5). Fase 4b e Fase 5 feitas — ver blocos abaixo.

1. Upload de screenshot (webp, max 1 MB) → `data/screenshots/<id>.webp`. Path no disco; magic-bytes no servidor (só WebP; JPEG/PNG viram WebP no browser).
2. Tags com autocomplete (`Tag.slug`).
3. Filtros no **arquivo**: classe, Ship Type / tipo do item, tags, galáxia (**display 1–256**, filtro no índice 0–255), texto livre (nome + descrição).
4. Grade com thumb; tabela sem thumb.
5. Comparação visual: item do save vs. arquivado (diff raso de seed/class/tipo + JSON diff colapsável).

**Aceite:** filtrar `S-class` + tag `exotic` retorna o conjunto certo; screenshot aparece no dialog.

**Complexidade:** M (2–3 dias).

---

### Fase 4b — Bases COSMOS (Deep Space + Space Station)

**Status: feita** (checklist 4b.1–4b.5). Fase 5 feita — ver bloco abaixo. Detalhe técnico: §2.7.6. Persistência: §1.7 (não muda o schema Prisma).

**Objetivo:** duas opções novas na sidebar (Arquivo e Save aberto), alimentadas pelo `save2.hg` COSMOS.

1. `CATEGORIES` += `deepspace`, `spacestation`. `CATEGORY_META` + ícones (ex.: `Orbit`, `Satellite`). Sidebar lista as duas **depois de Bases**.
2. Extract: filtrar `PersistentPlayerBases` por `PlayerSpaceBase` / `PlayerSpaceStationBase`. `/base` não mostra esses tipos (nem `FreighterBase`).
3. Save aberto: listar, arquivar, exportar `.nmsitem`, aplicar (append ou vazio do tipo; Station recusa a 21ª).
4. Arquivo: `/archive/deepspace` e `/archive/spacestation`; counts/filtros; itens antigos `category: "base"` + `baseType` COSMOS aparecem aqui.
5. Copy: Deep Space — sem limite confirmado no JSON, mesmo array das bases. Space Station — até 20 por save. Aviso de `.nmsitem` grande se `Objects` for grande (o da fixture tem ~200).
6. Testes: `save2.hg` (2 + 1), sintético do cap 20, `archive-service` como o teste do `FreighterBase`. Atualizar asserts de `Version` 6785 e da contagem de bases no teste de integração.
7. Skills de UI nas telas novas; não no parser.

**Aceite:** abrir o `save2.hg` atual mostra 2 Deep Space e 1 Space Station nos menus novos, zero desses tipos em Bases; arquivar uma de cada sobrevive restart; aplicar Station num save que já tem 20 falha com mensagem clara; `.nmsitem` tem `category` `deepspace` / `spacestation` e o payload com `PersistentBaseTypes`.

**Prompt Cursor:**

> Implemente a Fase 4b do PLAN.md (§2.7.6): duas categorias novas `deepspace` e `spacestation` no menu do Arquivo e do Save aberto. Discriminante: `PersistentPlayerBases[].BaseType.PersistentBaseTypes` = `PlayerSpaceBase` / `PlayerSpaceStationBase`. Fixture `.others/save2.hg` (2 + 1). Cap 20 só em Space Station no insert. Não persista o save no servidor. Não comece a Fase 5 nem o Colossal Archive. Skills de UI (§1.6) nas telas; não no parser.

**Complexidade:** S–M (1–2 dias).

---

### Fase 5 — Deploy e documentação

**Status: feita** (checklist 5.1–5.7). Não começar a Fase 6.

1. `Dockerfile` multi-stage + `docker-compose.yml` (porta 3000, volume `data`).
2. Healthcheck `/api/health`.
3. README: captura de save, backup, aviso de risco, “não use em Permadeath/expedição sem cópia”.
4. Regenerar `mf_save.hg` (XXTEA) se testes mostrarem que o jogo da versão atual rejeita save sem metadata — senão documentar que é opcional. **Documentado como opcional; não implementado** (1.7 ainda pendente).
5. Script `scripts/update-mapping.ts`.
6. Changelog + política de versão do `.nmsitem`.
7. Vercel: **não recomendado** com SQLite em filesystem efêmero. Se um dia for, migrar para Postgres (`provider = "postgresql"` — o schema já está portável).

**Aceite:** clone limpo, `docker compose up --build`, upload de save, arquivar item, restart, item permanece.

**Complexidade:** S–M (1–2 dias + XXTEA se necessário).

---

### Fase 6 — Colossal Archive (depois; não implementar agora)

Hub para jogadores enviarem descobertas (seed / model / print) para outros aplicarem no próprio save. Ver §1.8.

Esboço quando o arquivo pessoal estiver pronto:

1. Mesmo `.nmsitem` v1 como upload. Rejeitar `.hg`. Screenshot vira o print obrigatório (ou fortemente incentivado) no anúncio.
2. Catálogo público facetado pelas mesmas `CATEGORIES` (incluindo `deepspace` / `spacestation`).
3. Auth, moderação, rate limit, Postgres. Instância **separada** deste app self-hosted — o NMS Archive pessoal não vira SaaS por acidente.
4. Aplicar no save aberto do visitante: mesmo `insert` local; o hub só entrega o arquivo.

**Não fazer agora:** schema extra, URLs `/share`, contas, upload para terceiros.

**Complexidade:** XL (projeto seguinte).

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
| 4 | Screenshots, tags, filtros, compare | M | 2–3 | Fase 2–3 — **feita** |
| 4b | Deep Space + Space Station (COSMOS, dois menus) | S–M | 1–2 | Fase 4, `save2.hg` 6785 — **feita** |
| 5 | Docker polido, docs, lista de galáxias, XXTEA se preciso | S–M | 1–2 | Fase 4b — **feita** (`mf_save` não regenerado) |
| 6 | Colossal Archive (hub público) | XL | projeto seguinte | Fase 5 + envelope `.nmsitem` estável |

**Caminho crítico agora:** Fase 6 só depois deste arquivo pessoal estar estável + 1.7 in-game. Não implementar o hub neste repo.

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
[x] 2.1 routers items/saves/logs
[x] 2.2 backup sqlite hook
[x] 2.3 home = arquivo + categorias do archive
[x] 2.4 mover dashboard para /save
[x] 3.1 adapter multitool + vazios + reorder (`ActiveMultioolIndex`)
[x] 3.2 adapter companion + vazios + reorder (`Pets` + `UnlockedPetSlots` + `PetBattleTeam`)
[x] 3.3 traje = layout (slots + tech + supercharged; sem substâncias)
[x] 3.4 cargueira atual + frota (`FreighterFleet`)
[x] 3.5 fragatas (`FleetFrigates`)
[x] 3.6 bases (`PersistentPlayerBases`; aviso de .nmsitem grande)
[x] 3.7 wonders pessoais (`WonderCustomRecords` + extra); automáticos read-only
[x] 3.8 arquivo `/archive/[category]` + `items.archive` para todas as categorias
[x] 4.1 screenshot upload webp max 1 MB (`data/screenshots/<uuid>.webp`)
[x] 4.2 tags com autocomplete (`Tag.slug`)
[x] 4.3 filtros no arquivo (classe, tipo, tags, galáxia 1–256, texto)
[x] 4.4 grade com thumb / tabela sem thumb
[x] 4.5 compare save vs. arquivado (diff raso + JSON colapsável)
[x] 4b.1 CATEGORIES + sidebar Deep Space / Space Station
[x] 4b.2 extract PlayerSpaceBase / PlayerSpaceStationBase; Bases sem esses tipos
[x] 4b.3 insert append + cap 20 na Station; .nmsitem das duas categorias
[x] 4b.4 archive-service lista/counts (incl. itens velhos category=base)
[x] 4b.5 testes save2.hg (2+1) + sintético do cap
[x] 5.1 Dockerfile multi-stage + compose (127.0.0.1:3000, volume data)
[x] 5.2 healthcheck /api/health
[x] 5.3 README captura/backup/risco (Permadeath/expedição)
[x] 5.4 mf_save: não regenerar (sem evidência in-game de rejeição)
[x] 5.5 scripts/update-mapping.ts
[x] 5.6 CHANGELOG + política .nmsitem v1
[x] 5.7 galaxies.ts 256 nomes; Vercel não recomendado
[ ] 6.x Colossal Archive (projeto seguinte; §1.8)
```

---


## Apêndice C — Próximo prompt

A Fase 5 está no repo. **Não** cole um prompt da Fase 6 neste projeto até o arquivo pessoal estar estável e o 1.7 in-game feito. O hub é um repo separado (§1.8).
