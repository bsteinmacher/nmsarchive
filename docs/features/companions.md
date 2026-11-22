# Companions

Slots fixos. A identidade não é `CreatureSeed`: vários pets vêm `0x0` ou repetem a semente. O selo “No save · slot” usa as sementes genéticas mais `CreatureID`.

## Como usar

Arquivar traz as tags automáticas: classe, elemento, espécie, `Level N`, bioma. Elemento e bioma ficam em inglês (`Ice`, `Frozen Biome`). Espécie `UI_…` guarda só o miolo. A classe sai do rank que a pessoa anota. Ataque, agilidade e vida são anotação do arquivo e não voltam no save.

Reordenar também move `UnlockedPetSlots`, acessórios e `PetBattleTeam`.

## Ainda não no código

Ao aplicar, a pessoa escolhe o nível até 30. Exportar `.nmsitem` grava o nível mínimo do jogo. Conferir `PetBattlerTreatsEaten` na hora, sem chutar 0 ou 1. Arquivar continua no nível atual. O motor já sabe zerar o nível; a tela não oferece a escolha.

## Arquivos

- `src/lib/nms/extract/companions.ts`
- `src/lib/archive-match.ts`
- `src/lib/nms/extract/names.ts`

## Testes

`tests/lib/archive-match.test.ts`, `tests/nms/adapters.test.ts`, `tests/lib/auto-tags.test.ts`, `tests/lib/companion-species.test.ts`, `tests/nms/companion-battle.test.ts`, `tests/nms/apply-depth.test.ts`
