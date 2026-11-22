---
name: registrar
description: Grava decisões e armadilhas de um chat do NMS Archive nas rules, em docs/ e, se o comportamento já existe no código, num teste. Use quando a pessoa disser /registrar, "registra essa sessão" ou pedir para guardar o que ficou decidido neste chat.
disable-model-invocation: true
---

# Registrar

Roda no fim de um chat que mudou regra, comportamento ou armadilha. Não registra opinião solta nem tarefa ainda não aceita.

## Passos

1. Ler o diff da branch e o que a pessoa decidiu neste chat.
2. Classificar cada item:
   - invariante curto vai para `.cursor/rules/core.mdc`
   - formato de save, slot ou apply vai para `save-format.mdc`
   - interface vai para `ui.mdc`
   - tag ou categoria vai para `tags-and-categories.mdc`
   - idioma vai para `i18n.mdc`
   - comportamento de uma área vai para `docs/features/`
   - decisão com motivo vai para `docs/decisions.md`
   - bug que pode voltar vira teste só se o código já se comporta assim
3. Editar a página que já existe. Não abrir página nova para um fato que cabe numa seção.
4. Manter `core.mdc` curto. Detalhe mora na rule da pasta ou em `docs/`.
5. Se a pessoa vê a mudança, acrescentar uma linha no `CHANGELOG.md`.
6. Mostrar a lista do que entrou, com o arquivo, para a pessoa cortar o que não quiser.

## Limites

Código e testes vencem `docs/`, que vencem o resumo das rules. Se o chat e o código discordam, escrever o conflito e não escolher no escuro.

Decisão que o código ainda não faz entra em `docs/decisions.md` na seção "Ainda não no código" e na rule, com essa marca. Não escrever teste que exige o comportamento novo antes dele existir.
