# NMS Archive

Ferramenta web open-source para catalogar, armazenar e transferir naves, multi-ferramentas, cargueiras, fragatas, pets, wonders e bases entre saves de **No Man's Sky**.

O plano está em [`PLAN.md`](./PLAN.md).

## Status

Fase 0 — scaffold (Next.js, shadcn/ui, Prisma/SQLite, tRPC, Docker). Parser de `.hg` entra na Fase 1.

## Desenvolvimento

```bash
cp .env.example .env
mkdir -p data
npx prisma migrate dev
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

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
