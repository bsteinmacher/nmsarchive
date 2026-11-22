# Arquivo pessoal

O produto. A home `/` lista o que foi guardado no SQLite. O save aberto não é esta página.

## Como usar

Abrir o app mostra o arquivo. Cada categoria tem grade ou tabela. A escolha permanece ao trocar de categoria (cookie `nmsarchive-view`). Clicar no card abre o detalhe; o botão Ver detalhes também abre. Exportar gera um `.nmsitem` ou devolve o item a um save aberto.

## Arquivos

- `src/app/page.tsx`, `src/app/archive/`
- `src/server/archive-service.ts`
- `src/lib/archive-view.ts`, `src/lib/list-columns.ts`

## Decisões

Um item é uma linha no banco e um arquivo `.nmsitem`. Seed e galaxy não são colunas da tabela. A tabela do arquivo e a do save usam o mesmo visual.

## Armadilhas

Não criar um segundo formato de export. Não persistir o `.hg` aqui.

## Testes

`tests/server/archive.test.ts`, `tests/lib/list-columns.test.ts`, `tests/lib/archive-url.test.ts`, `tests/nms/nmsitem.test.ts`
