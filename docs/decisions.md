# Decisões

Registradas em 2026-11-22 a partir dos chats do projeto e conferidas no código. O detalhe de cada uma está na rule correspondente. Código e testes vencem esta lista.

## Em vigor no código

- O arquivo pessoal é o produto. O save aberto copia um item para o arquivo e devolve ao jogo.
- O `.hg` completo não vai ao servidor. O envelope `.nmsitem` permanece na versão 1.
- Sem código de GoatFungus ou libNOM, e sem compatibilidade binária com os exports deles.
- Sem editor de recompensa de conta. Fase 6 e Colossal Archive ficam fora deste repositório.
- Um item é uma linha no SQLite e um arquivo `.nmsitem`. Inventário de substâncias não é categoria. O traje é só layout.
- Saves em `.others/` não entram no git.
- Round-trip Latin-1, LZ4 block `0xFEEDA1E5`, chave desconhecida preservada, `mf_save.hg` não é regenerado.
- A pasta do jogo abre o save mais recente, faz backup com carimbo até o segundo e grava no mesmo arquivo.
- Naves, multi-tools e companions têm array fixo, sem reordenar pelo teclado. Reordenar nave leva customização e casco.
- A tela mostra uma cargueira. A frota extra permanece no JSON. A base interior aparece em Cargueiras.
- Fragatas têm teto 30, não nascem com vazios e não reordenam: o jogo ordena sozinho.
- Companion se identifica pelas sementes genéticas mais `CreatureID`.
- Expedição é outro `PlayerStateData`. Galáxia gravada é `0–255`.
- Apply pergunta se cria ou cobre, e se é re-skin ou trocar. Trocar e slot novo deixam a carga vazia. No re-skin a pessoa marca as partes; inventário começa desmarcado.
- Esquadrão tem quatro slots e não tem re-skin. Deep Space não tem teto. Space Station tem teto 20. Os dois são seções dentro de Bases, não itens do menu.
- Tags automáticas em inglês, na ordem por categoria, classe no formato `S Class`. Galáxia só em base planetária, hoje no formato `1 · Euclid`.
- Interface: rodapé de diálogo fixo, exclusão por confirmação, card inteiro clicável, barra da sessão à direita, Voltar como ação de fechar save sujo.
- Textos-fonte em inglês. O catálogo visível hoje é só `pt-BR`. en-US, espanhol e talvez russo ainda serão feitos.
- Deploy de hoje: Docker em `127.0.0.1`. Como o app chega aos usuários ainda não está decidido.
- Sem ícone ou imagem da Hello Games. Classe, moeda e tipo ficam em texto. O chrome usa `lucide-react`. Screenshot enviada pela pessoa fica em `data/screenshots/`.
- Permadeath e expedição pedem uma cópia própria do save.

## Ainda não no código

- Tag de galáxia só com o nome (`Euclid`), também em deep space e space station, nunca na base da cargueira.
- Sem tag `N objects`.
- Ao aplicar companion, escolher o nível até 30. O `.nmsitem` exportado grava o nível mínimo do jogo, conferido em `PetBattlerTreatsEaten`, sem chutar 0 ou 1. Arquivar continua no nível atual.
- Trocar o tipo da nave no arquivar reescreve a tag, como o dropdown da multi-tool.
- Cada parte de Cargueiras e de Bases fica num card.
- O seletor de idioma entra num card de Settings, fechado como os outros.
- O botão Excluir fica no mesmo lugar em todos os diálogos, com texto e contorno vermelhos.
- Calculadora da fragata em si, mais para a frente. A calculadora de tempo de expedição não volta.
