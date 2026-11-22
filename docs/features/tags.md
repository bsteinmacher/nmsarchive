# Tags

Automáticas primeiro, manuais depois, em pílulas. A segunda linha “Class A - Type …” não aparece no card. Ao editar de novo, as automáticas voltam para a frente.

## Ordem

- Nave, cargueira, fragata, esquadrão: classe, tipo, tag da categoria (`Ship`, `Freighter`, `Frigate`, `Squadron`).
- Companion: classe, elemento, espécie, `Level N`, bioma com sufixo.
- Multi-tool: classe, tipo, `Multi-tool`.

A classe é `S Class`, inclusive `SSS Class`. O filtro em All e Companions oferece SSS, SS, S, A, B, C e Qualquer. Nas outras categorias, S, A, B, C. O valor filtrado é a letra.

Tags de jogo ficam em inglês. A tela traduz o rótulo do tipo via `gameTermLabel`. A tag em si não passa por essa tradução.

## Arquivos

- `src/lib/auto-tags.ts`
- `src/lib/archive-url.ts`
- `src/components/settings/tags-panel.tsx`

## Armadilhas

Não gravar “Tóxico” e “Toxic” ao mesmo tempo. Não pôr tag de galáxia em nave. Não criar a tag `N objects`.

## Testes

`tests/lib/auto-tags.test.ts`, `tests/lib/companion-species.test.ts`
