# Riscos

## 7. Riscos e mitigações

### 7.1 Hello Games muda o JSON no próximo patch

**Risco principal do projeto.** Sintomas: chaves novas ofuscadas (aparecem em `unknownKeys`), arrays movidos, campos de nave/corvette, novos `PersistentBaseTypes` (COSMOS: `PlayerSpaceBase`, `PlayerSpaceStationBase` — o mapping antigo ainda leu o save 6785 com 0 unknown keys porque o **valor** do enum é plaintext).

Mitigações:

- Parser estruturalmente tolerante (`unknown` + adapters com `?.`).
- `mapping.json` atualizável sem release (Settings → “Atualizar mapping”).
- Fixture de save por versão major; CI só com o sintético.
- Campo `gameVersion` no `.nmsitem` e no `Save`.
- Feature flags por adapter: se `ShipOwnership` não existir, a página mostra “categoria indisponível neste save” em vez de crash.

### 7.2 Import entre versões diferentes

O que quebra de verdade:

| Situação | Efeito |
|---|---|
| Nave de Worlds II → save pré-Outlaws | Falta `Inventory_Cargo`; o jogo pode ignorar ou corromper o slot |
| Tecnologia/item ID novo num save antigo | Item some ou vira cubo vermelho |
| Supercharged slots (`SpecialSlots`) num save que não conhece | Slots extras ignorados ou crash de UI |
| Corvette → save sem Voyagers | Array desconhecido; potencialmente ignorado |
| `Units` acima de ~4,29 bi | Teto uint32 (0–4.294.967.295). Avisar se o valor sair disso; `number` JS cobre o intervalo |
| Tamanho de inventário acima do vanilla | GoatFungus avisa que o jogo *pode quebrar* |
| Base `Objects[]` entre updates | Peças de construção removidas / IDs mudados = base fantasma |

Política do NMS Archive:

1. Comparar `gameVersion` do `.nmsitem` com o save aberto.
2. Diff de chaves de primeiro nível do `payload` vs. um slot vazio do save destino.
3. Modal: lista de chaves só-na-origem / só-no-destino. O usuário confirma.
4. Nunca expandir arrays além do length atual (não criar o 13º slot de nave).
5. Backup IndexedDB do JSON *antes* do merge (`session.history`, 5 versões).

### 7.3 LZ4 errado na escrita

Sintoma: o jogo recusa o save ou “save corrupted”.

Mitigações:

- Round-trip test: decode(encode(json)) === json (bytes do JSON, não do `.hg`).
- Respeitar `uncompressedSize <= 0x80000`.
- Escrever reservado = 0.
- Sempre oferecer o `.hg` original para download (“baixar original”) a partir do IndexedDB.

### 7.4 Mapping desatualizado

Sintoma: dashboard vazio (`PlayerStateData` ainda se chama `6f=`).

Mitigação: detector `isObfuscated` (raiz sem `Version` ou sem `BaseContext`). Bloquear a UI com CTA para atualizar mapping. Permitir upload manual de `mapping.json`.

### 7.5 Saves enormes / UI travada

Saves com muitas bases: JSON de dezenas de MB.

Mitigação: Worker obrigatório; não estruturar o JSON na thread da UI; `JSON.parse` no worker; passar *só* o summary + arrays das categorias via `postMessage` (structured clone). O JSON completo fica no worker ou num `IDB` store, acessado por request.

### 7.6 Unicode quebrado em IDs procedimentais

GoatFungus: IDs de produtos/tech procedimentais não são Unicode bem formado. **Confirmado** no save local: UTF-8 estrito falha; `JSON.parse` após Latin-1 funciona.

Mitigação: o pipeline de leitura/escrita usa Latin-1 ponta a ponta. A UI pode mostrar UTF-8 lossy. Teste de regressão: round-trip de `.others/save2.hg` deve preservar os bytes inválidos (hash do JSON Latin-1 igual). Não sanitizar IDs.

### 7.7 GPL / closed source

Mitigação: parser original; review de PRs contra copypaste de NomNom/libNOM. Não commitar `mapping.json` se a licença do MBINCompiler exigir attribution — preferir download. Incluir NOTICE apontando MBINCompiler e o gist LZ4.

### 7.8 `mf_save.hg` / checksum

Mitigação: testar save reescrito *sem* `mf_save` no jogo atual (item 1.7). Sem evidência de rejeição, a Fase 5 **não** porta XXTEA: o download é só `save.hg`; o README pede para deixar o `mf_save` original na pasta. Se o 1.7 falhar por metadata, aí sim portar XXTEA (algoritmo público; o crate `nms-save` documenta rounds diferentes por formato 2001/2002/2003/2004).

### 7.9 Segurança da instância self-hosted

Não é um SaaS multi-tenant no desenho atual. Mesmo assim:

- Sem auth no MVP (localhost). Docker bind `127.0.0.1:3000`.
- Upload de screenshot: magic-bytes + conversão server-side, não servir `.svg` arbitrário.
- Path traversal em `screenshotPath` / backups: só basename UUID.

### 7.10 Cap de Space Station

O “20 por save” **não está no JSON**. Se o jogo mudar o teto, o insert do arquivo fica errado. Mitigação: constante nomeada (`SPACE_STATION_BASE_LIMIT = 20`) + copy na UI; fácil de ajustar. Deep Space sem constante de cap até aparecer evidência.

---

