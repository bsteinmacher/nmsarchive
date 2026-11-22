# Multi-ferramentas

O array do save é `Multitools[]`, não `WeaponOwnership`. Slots vazios aparecem e o array não cresce.

## Como usar

O dropdown de tipo oferece Pistol, Rifle, Experimental, Alien, Exotic / Royal, Sentinel, Atlantid e Voltaic Staff. O valor gravado fica em inglês. Trocar o dropdown reescreve a tag. `Atlas Staff` e `Staff` viram `Voltaic Staff`.

Re-skin começa com modelo e classe. Trocar leva tecnologias e esvazia o store.

## Arquivos

- `src/lib/nms/extract/multitools.ts`
- `src/lib/nms/multitool-type.ts`

## Decisões

Aplicar e reordenar o slot ativo levam a arma na mão. O visual da staff inclui `CustomisationData`.

## Armadilhas

Não ler `WeaponOwnership` como a lista de multi-tools.

## Testes

`tests/nms/adapters.test.ts`, `tests/nms/apply-depth.test.ts`, `tests/lib/auto-tags.test.ts`
