# Bases

Bases planetárias, Deep Space e Space Station aparecem como seções dentro de Bases. Não são itens soltos do menu. A base da cargueira não aparece aqui: fica em Cargueiras.

## Como usar

Deep Space (`PlayerSpaceBase`) entra por append, sem teto e sem reusar vazio de planeta. Space Station tem teto 20, reusa vazio do próprio tipo e recusa a 21ª.

Base planetária avisa quando `Objects` passa de 50. A coluna de quantidade continua. A lista de bases planetárias esconde interior de cargueira, Deep Space e Space Station.

## Tags

Hoje a tag de galáxia é `1 · Euclid` e só entra em `category === "base"`. A decisão nova, ainda não no código: o texto é só o nome (`Euclid`), também em deep space e space station, nunca na base da cargueira. A tag `N objects` sai.

Ainda não no código: cada seção dentro de um card.

## Arquivos

- `src/lib/nms/extract/bases.ts`
- `src/lib/auto-tags.ts`
- `src/types/nms.ts` (`archiveHref` de deepspace e spacestation aponta para `/base`)

## Testes

`tests/nms/adapters.test.ts`, `tests/lib/auto-tags.test.ts`, `src/types/nms.test.ts`
