# Cargueiras e fragatas

## Cargueira

A tela mostra um slot, o `CurrentFreighter`. A base interior aparece nesta página e continua `category: base` no banco. `FreighterFleet` permanece no JSON e não vira slots 2–9.

Re-skin começa com nome, modelo e origem. A classe fica desmarcada. Trocar deixa a carga vazia.

Ainda não no código: cada parte (nave e base interior) dentro de um card.

## Fragatas

Teto de 30. O JSON só tem as fragatas que existem. Aplicar acrescenta no fim. Excluir tira do array. A lista na tela ordena por função, classe e nome. Não há arrastar: o jogo ordena sozinho.

A calculadora de tempo de expedição não volta. A calculadora da fragata em si fica para depois.

Fragatas e esquadrão são itens do menu, não seções dentro de Cargueiras. O esquadrão tem quatro slots fixos, sem re-skin.

## Arquivos

- `src/lib/nms/extract/freighters.ts`
- `src/lib/nms/extract/frigates.ts`
- `src/lib/nms/extract/squadron.ts`
- `src/components/items/save-category-panel.tsx`

## Armadilhas

Não listar a frota como se fossem outras cargueiras. Não reintroduzir reordenar de fragata. Não pré-alocar 30 vazios.

## Testes

`tests/nms/adapters.test.ts`, `tests/nms/apply-depth.test.ts`, `tests/nms/squadron.test.ts`, `src/types/nms.test.ts`
