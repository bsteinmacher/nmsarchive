# Save aberto

`/save` lê um `save*.hg` nesta máquina, mostra os itens e grava de volta no mesmo arquivo.

## Como usar

A pasta do jogo é escolhida uma vez. O app abre o arquivo mais recente. O resumo vem primeiro. Pasta do jogo e arquivo avulso são acordeões que começam fechados; um aberto esconde o outro. O cabeçalho inteiro do card abre e fecha.

Salvar grava neste arquivo, depois de copiar um backup para `Documentos/NMS Archive`. Também dá para baixar “Arquivo editado” ou “Arquivo original”. Fechar com alteração pendente: Voltar é a ação em destaque; Fechar mesmo assim fica à esquerda.

A coluna da direita lista só a atividade desta sessão e abre na primeira alteração.

## Arquivos

- `src/components/save/save-dashboard.tsx`
- `src/components/layout/activity-rail.tsx`
- `src/lib/nms/save-files.ts`, `src/server/game-folder.ts`
- `src/stores/save-session.ts`

## Decisões

O `.hg` completo não sobe ao servidor. Expedição e save principal são dois `PlayerStateData`. A imagem Docker não vê a pasta da Steam.

## Armadilhas

Não oferecer só download quando a pessoa está na pasta do jogo. Não regenerar `mf_save.hg`. Se o arquivo no disco mudou desde a leitura, não sobrescrever.

## Testes

`tests/lib/save-files.test.ts`, `tests/server/game-folder.test.ts`, `tests/nms/expedition-context.test.ts`
