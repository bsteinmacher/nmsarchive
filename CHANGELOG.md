# Changelog

O projeto segue as fases de [`PLAN.md`](./PLAN.md). Este arquivo registra o que mudou para quem atualiza o Docker ou arquivos `.nmsitem`.

## Política de versão do `.nmsitem`

O campo `nmsitem` no JSON é a versão do **envelope**, não do jogo.

| Campo | Significado |
|---|---|
| `nmsitem` | Schema do arquivo. Hoje **`1`**. Incrementar só se o envelope quebrar (campo obrigatório novo, rename, tipo incompatível). |
| `gameVersion` | `Version` do save de origem. Warning no import se diferir; não bloqueia. |
| `category` | Slug estável (`ship`, `deepspace`, `spacestation`, …). Valores novos são aditivos. |
| `payload` | Objeto cru já desofuscado do slot. Pode crescer com patches do jogo sem subir `nmsitem`. |

`1` permanece enquanto: JSON UTF-8, um item por arquivo, `seed` `/^0x[0-9a-fA-F]+$/`, `galaxy` = RealityIndex 0–255, `payload` = objeto do save.

Não há compatibilidade binária com exports do GoatFungus/NomNom. O hub público (Colossal Archive) reutiliza este envelope; não há schema paralelo.

Constante no código: `NMSITEM_SCHEMA_VERSION` em `src/lib/nmsitem.ts`.

## Unreleased

### Fixed

- Companion no arquivo pessoal: o selo **No save · slot** (e o apply quando a lista está cheia) não usa mais só `CreatureSeed`. Vários pets vêm `0x0` ou repetem a mesma semente; a identidade mistura as sementes genéticas do payload. O payload que você já arquivou estava certo — o selo apontava para o primeiro slot com aquele seed. Itens antigos batem pelo payload, sem re-arquivar.

### Changed

- Payload de nave (`category: "ship"`) pode incluir `kind: "ship"` com `ownership` e, opcionalmente, `customisation` (peças/cores) e `hull` (casco `PlayerShipBase` da Corvette). O envelope `.nmsitem` permanece na versão **1**. Arquivos antigos (só o objeto de `ShipOwnership`) continuam importando; o slot destino não herda visual nem casco de outra nave.

### Added

- Companions no arquivo pessoal mostram **Element** e **Biome** (tabela, cards e detalhes). Já estava no extra; a lista não exibia. A busca também casa esses campos.
- Em **Ver detalhes** do save aberto, **Excluir** esvazia o slot (o array do jogo não encolhe). Em nave, também limpa peças/cores e o casco da Corvette. Não apaga o arquivo pessoal.
- Frigates do save aberto reordenam por arrastar, como naves, multi-tools e companions.
- `FleetFrigates` não pré-aloca 30 vazios: o JSON só tem as fragatas existentes (teto **30**). Aplicar acrescenta no fim; Excluir tira do array.

## 0.1.0 — Fase 5

Deploy self-hosted e documentação do arquivo pessoal.

### Added

- Dockerfile multi-stage (Node 22 Alpine, `output: "standalone"`) com entrypoint que aplica `prisma migrate deploy`. O volume `./data` **não** é `chown` para uid 1001 (isso quebrava o SQLite no `npm run dev`).
- `docker-compose.yml` em `127.0.0.1:3000`, volume `./data`, healthcheck em `/api/health`.
- `GET /api/health` (200 se o SQLite responde; 503 caso contrário).
- `npm run mapping:update` (`scripts/update-mapping.ts`) para baixar o `mapping.json` do MBINCompiler.
- Lista completa das 256 galáxias em `src/lib/nms/galaxies.ts`.
- README de captura de save, backup do SQLite, aviso de risco (Ironman/expedição) e política deste envelope.

### Notes

- `mf_save.hg` **não** é regenerado. Não há teste in-game (item 1.7) mostrando que o jogo atual rejeita save sem metadata. O download continua só o `save.hg`; o `mf_save` original pode permanecer na pasta do jogo.
- `prisma` passou a dependência de produção para `migrate deploy` no container.
- O container não deve gravar `data/` como root nem como uid 1001. Compose: `user: ${DOCKER_UID:-1000}:${DOCKER_GID:-1000}`.
- Vercel não é alvo: SQLite em filesystem efêmero some. Ver README.
- Fase 6 / Colossal Archive permanece fora deste repositório.
