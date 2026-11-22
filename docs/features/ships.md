# Naves

Doze slots fixos. Vazios aparecem. Arrastar troca dois índices e o tamanho do array não muda.

## Como usar

Aplicar pergunta se cria no primeiro vazio ou cobre um slot. Por cima: Re-skin ou Trocar. Re-skin começa com modelo e classe. Inventário começa desmarcado. Trocar e slot novo deixam a carga vazia e podem levar tecnologias.

## Arquivos

- `src/lib/nms/extract/ships.ts`
- `src/lib/nms/reorder.ts`
- `src/lib/nms/ship-type.ts`
- `src/components/items/apply-to-save-dialog.tsx`

## Decisões

Reordenar leva customização e casco junto. Slots 0–5 mapeiam índices 3–8 de `CharacterCustomisationData`; 6–11 mapeiam 17–22. Arquivar Corvette e nave customizada leva peças, cores e casco no envelope v1. Arquivo antigo, só `ShipOwnership`, não herda o visual de outra nave.

`SENTINELSHIP` é Interceptor e `BIOSHIP` é Living Ship. Ainda não no código: mudar o tipo no arquivar reescreve a tag automática.

## Armadilhas

Não mover só `ShipOwnership`. Não compactar a lista. Sem atalho de teclado.

## Testes

`tests/nms/ships.test.ts`, `tests/nms/reorder.test.ts`, `tests/nms/apply-depth.test.ts`, `tests/nms/ship-type.test.ts`, `tests/nms/save-hg-vulture.integration.test.ts`
