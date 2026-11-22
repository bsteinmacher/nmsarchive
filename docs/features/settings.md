# Settings

Blocos em cards retráteis que começam fechados. O cabeçalho inteiro abre e fecha. Settings fica na sidebar, acima de Theme.

## O que tem

- Tags: criar, renomear e apagar, com confirmação na exclusão.
- Pasta do jogo e backups do SQLite.
- Histórico permanente de operações. A coluna da sessão, no save aberto, não é este histórico.
- Idioma. Hoje só existe `pt-BR`. O seletor ainda está solto acima dos cards; a decisão é colocá-lo num card fechado, como os outros.

## Arquivos

- `src/app/settings/page.tsx`
- `src/components/settings/tags-panel.tsx`
- `src/components/layout/collapsible-card.tsx`
- `src/i18n/locales.ts`

## Testes

`tests/server/archive.test.ts` cobre criar tag. Não há teste de interface do seletor de idioma.
