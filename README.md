# NMS Archive

Arquivo pessoal de descobertas de **No Man's Sky**: naves, multi-ferramentas, cargueiras, fragatas, companions, wonders, bases planetárias, Deep Space, Space Station e o layout do traje. Você abre um save para **copiar para o arquivo** e **devolver** o que guardou — o save não é o produto.

O plano está em [`PLAN.md`](./PLAN.md). Política de versão do envelope `.nmsitem` e histórico: [`CHANGELOG.md`](./CHANGELOG.md).

## Status

Fase 5 feita (Docker, healthcheck, docs, mapping updater, lista de galáxias). Falta 1.7 (teste in-game). Fase 6 / Colossal Archive **não** entra neste repo.

O save completo **nunca** vai para o servidor.

## Aviso de risco

Editar save pode corromper o slot. Sempre copie `save.hg` (e o `mf_save*.hg` da pasta, se existir) **antes** de devolver um arquivo gerado pelo app.

**Não use em Ironman / Permadeath / expedição sem essa cópia.** O jogo pode recusar o save ou avançar a expedição com dados errados. O app não é um editor oficial da Hello Games.

## O que não entra no arquivo

- Inventário de itens/substâncias: sem export/import.
- Traje: só quantidade de slots liberados e posição das tecnologias.

## Onde está o save (PC)

O app não varre o disco — você escolhe o `save*.hg` no browser.

| Loja | Pasta |
|---|---|
| Steam (Windows) | `%AppData%\HelloGames\NMS\st_<SteamID>\` |
| Steam (Linux / Proton) | `~/.local/share/Steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/Application Data/HelloGames/NMS/st_<SteamID>/` |
| GOG | `%AppData%\HelloGames\NMS\DefaultUser\` |

Xbox, PlayStation e Switch ficam fora do MVP. Cross-save da Hello Games (patch 5.25+) permite editar no PC e devolver à outra plataforma.

### Captura e devolução

1. Feche o jogo (ou pelo menos saia para o menu) para o arquivo no disco não estar em escrita.
2. Copie `save.hg` para um backup seu. O `mf_save.hg` do mesmo slot pode ir junto, mas o NMS Archive **não lê nem regenera** esse metadata.
3. Em `/save`, escolha o `save.hg`. O parse roda num Web Worker; o JSON fica em memória + IndexedDB.
4. Arquive itens no SQLite e/ou baixe `.nmsitem`. Aplique de volta num slot vazio (sem expandir o array).
5. “Baixar save” gera um `save.hg` novo (LZ4 block `0xFEEDA1E5`). Há também o download do original.
6. Substitua só o `save.hg` na pasta do jogo. Deixe o `mf_save.hg` antigo no lugar, se existir — o jogo atual costuma carregar mesmo com metadata ausente ou velho.

Galáxia no JSON é `0–255` (Euclid = 0). Na UI aparece `1–256` com o nome (`1 · Euclid`, `256 · Odyalutai`).

JSON do jogo é decodificado em **Latin-1** no round-trip (IDs procedimentais quebram UTF-8). A UI pode mostrar UTF-8 lossy.

O endpoint `/api/mapping` só cacheia o `mapping.json` do [MBINCompiler](https://github.com/monkeyman192/MBINCompiler/releases/latest). Não aceita upload de save.

## Backup do arquivo pessoal

O produto vive em SQLite (`data/nmsarchive.db`), não no save aberto.

- Antes de arquivar ou importar para o banco, o app copia `data/nmsarchive.db` → `data/backups/nmsarchive-YYYYMMDD-HHmmss.db` (guarda as 20 mais recentes).
- Em **Configurações**: backup manual, restore de um arquivo da lista, ou upload de um `.db`.
- Screenshots WebP ficam em `data/screenshots/`. Um restore do `.db` não traz as imagens se essa pasta não foi copiada.

O save aberto é sessão do browser (IndexedDB). Fechar o app não apaga o SQLite; limpar o save na UI não apaga o arquivo pessoal.

## Docker

```bash
mkdir -p data
DOCKER_UID=$(id -u) DOCKER_GID=$(id -g) docker compose up --build
```

O app escuta só em [http://127.0.0.1:3000](http://127.0.0.1:3000) (não em `0.0.0.0` no host). O volume `./data` persiste o SQLite, backups, screenshots e o cache do `mapping.json`.

O processo no container usa o UID do host (padrão `1000`) para **não** mudar o dono de `./data`. Se você já rodou um compose antigo e o `npm run dev` falhar com *readonly database*, recupere:

```bash
sudo chown -R "$(id -u):$(id -g)" data
```

Healthcheck: `GET /api/health` (200 se o banco responde; 503 se o SQLite falhar).

Clone limpo: `docker compose up --build` → abrir um save em `/save` → arquivar um item → `docker compose restart` → o item continua em `/`.

## mapping.json

Depois de um patch do jogo, se o dashboard vier vazio ou aparecerem chaves curtas:

```bash
npm run mapping:update
```

Isso baixa o `mapping.json` mais recente do MBINCompiler para `data/mapping.json`. Na UI: Configurações → **Atualizar mapping.json**, depois abra o save de novo.

## Envelope `.nmsitem`

Um arquivo = um item. Campo `nmsitem` é a versão do **schema do arquivo** (hoje `1`), não a versão do jogo (`gameVersion`). Só incrementa se o envelope quebrar. Detalhe em [`CHANGELOG.md`](./CHANGELOG.md).

## Vercel

**Não recomendado.** O arquivo pessoal é SQLite em disco (`./data`). No filesystem efêmero da Vercel o banco some a cada deploy. Self-host com Docker. Se um dia for para a Vercel, migrar Prisma para Postgres (`provider = "postgresql"` — o schema já está portável).

## Desenvolvimento

```bash
cp .env.example .env
mkdir -p data
npx prisma migrate dev
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — a home é o **arquivo pessoal**. O dashboard do save ficou em `/save`.

```bash
npm test
```

Vitest cobre LZ4, mapping e, se existir, `.others/save2.hg` (gitignored). Sem esse arquivo o teste de integração é skip.

## Saves locais de fixture

Coloque `save*.hg` / `mf_save*.hg` pessoais em `.others/`. Fixture de referência: `save2.hg`. A pasta está no `.gitignore` e **não sobe para o GitHub**.

## Licença

MIT — parser próprio. Ver [`LICENSE`](./LICENSE) e [`NOTICE`](./NOTICE). Não incorpora código GPL do NomNom/libNOM nem o binário closed-source do NMSSaveEditor.
