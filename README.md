# NMS Archive

Arquivo pessoal de descobertas de **No Man's Sky**: naves, multi-ferramentas, cargueiras, fragatas, companions, wonders, bases e o layout do traje. Você abre um save para **copiar para o arquivo** e **devolver** o que guardou — o save não é o produto.

O plano está em [`PLAN.md`](./PLAN.md).

## Status

Fase 1 feita (parser LZ4 + mapping no cliente, dashboard do save, naves, `.nmsitem`). Próximo: Fase 1b (Ship Type, slots vazios, reordenar, moedas, galáxia 1–256) e depois Fase 2 (SQLite = home do arquivo).

O save completo **nunca** vai para o servidor.

## O que não entra no arquivo

- Inventário de itens/substâncias: sem export/import.
- Traje: só quantidade de slots liberados e posição das tecnologias, se o JSON deixar separar.

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

Vitest cobre LZ4, mapping e, se existir, `.others/save2.hg` (gitignored). Sem esse arquivo o teste de integração é skip. Use esse save para explorar o app.

## Save no browser

1. Escolha `save.hg` (Steam/GOG). O parse roda num Web Worker.
2. JSON desofuscado fica em memória + IndexedDB.
3. Exporta `.nmsitem` / importa no primeiro slot vazio (sem expandir o array).
4. “Baixar save” recomprime com LZ4 block (`0xFEEDA1E5`). Há backup do original.

Galáxia no JSON é `0–255` (Euclid = 0). Na UI vamos mostrar `1–256`.

O endpoint `/api/mapping` só cacheia o `mapping.json` do [MBINCompiler](https://github.com/monkeyman192/MBINCompiler/releases/latest). Não aceita upload de save.

JSON do jogo é decodificado em **Latin-1** no round-trip (IDs procedimentais quebram UTF-8). A UI pode mostrar UTF-8 lossy.

## Docker

```bash
mkdir -p data
docker compose up --build
```

O app escuta em `127.0.0.1:3000`. O SQLite fica em `./data`.

## Saves locais

Coloque `save*.hg` / `mf_save*.hg` pessoais em `.others/`. Fixture de referência: `save2.hg`. A pasta está no `.gitignore` e **não sobe para o GitHub**.

## Licença

MIT — parser próprio. Não incorpora código GPL do NomNom/libNOM nem o binário closed-source do NMSSaveEditor.
