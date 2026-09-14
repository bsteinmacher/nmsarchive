# NMS Archive

Ferramenta web open-source para catalogar, armazenar e transferir naves, multi-ferramentas, cargueiras, fragatas, pets, wonders e bases entre saves de **No Man's Sky**.

O plano está em [`PLAN.md`](./PLAN.md).

## Status

Fase 1 — parser LZ4 + mapping no cliente, dashboard do save, naves, export/import `.nmsitem` e download de `save.hg`. O save completo **nunca** vai para o servidor.

## Desenvolvimento

```bash
cp .env.example .env
mkdir -p data
npx prisma migrate dev
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

```bash
npm test
```

Vitest cobre o codec LZ4, o walk do `mapping.json` e, se existir, o fixture local `.others/save2.hg` (gitignored). Sem esse arquivo o teste de integração é skip.

## Save no browser

1. Escolha `save.hg` (Steam/GOG). O parse roda num Web Worker.
2. JSON desofuscado fica em memória + IndexedDB.
3. Exporta `.nmsitem` / importa no primeiro slot vazio de `ShipOwnership` (sem expandir o array).
4. “Baixar save” recomprime com LZ4 block (`0xFEEDA1E5`). Há backup do original.

O endpoint `/api/mapping` só cacheia o `mapping.json` do [MBINCompiler](https://github.com/monkeyman192/MBINCompiler/releases/latest). Não aceita upload de save.

JSON do jogo é decodificado em **Latin-1** no round-trip (IDs procedimentais quebram UTF-8). A UI pode mostrar UTF-8 lossy.

## Docker

```bash
mkdir -p data
docker compose up --build
```

O app escuta em `127.0.0.1:3000`. O SQLite fica em `./data`.

## Saves locais

Coloque `save*.hg` / `mf_save*.hg` pessoais em `.others/`. A pasta está no `.gitignore` e **não sobe para o GitHub**.

## Licença

MIT — parser próprio. Não incorpora código GPL do NomNom/libNOM nem o binário closed-source do NMSSaveEditor.
