# Plano — mapas conectados (P11): entrar na casa, subir a escada, tokens em cenas diferentes

Data: 16/09/2026 · Autor: arquiteto-solucoes · Status: PROPOSTA (não implementar antes de responder o §8)

Pedido do usuário (PEDIDOS.md, item 7 da fila): *"Quando eu conseguir entrar na casa como eu mudo o mapa
para dentro da casa? e se só um token for para dentro da casa? como faz?"* Junto vem a escada que "leva ao
andar" (mapa vinculado).

---

## 0. O que JÁ existe (lido antes de propor — não reinventar)

| Peça | Onde | Estado hoje |
|---|---|---|
| Portal por peça | `client/src/types/map.ts:255` (`Prop.linkedMapPath`), `client/src/components/PortalControls.tsx` | Uma peça guarda o caminho absoluto de outro `map.json`; botões "Novo andar em branco / Escolher mapa existente / Entrar no andar / Desvincular" |
| Entrar/voltar | `client/src/App.tsx:732-800` (`handleCreateLinkedMap`, `handleEnterLinkedMap`, `handleGoBack`, `persistMap`) | Salva o mapa atual, carrega o ligado no MESMO store, guarda `previousMapPath` para o botão "Voltar" da ActionBar |
| Um mapa por vez | `client/src/stores/mapStore.ts:1267` (`loadMap`) | `loadMap` zera seleção e histórico; existe UM `map` em memória |
| Arquivo em disco | `client/src/lib/mapFileIO.ts` | `%APPDATA%/maps/<map.id>/map.json`, um mapa por pasta; `listSavedMaps`, `duplicateMap`, `renameMap`, `deleteMap`, `assertPathWithinRoot` |
| Migração de formato | `client/src/lib/mapFile.ts:26-91` | Sem número de versão: `deserializeMapFields` preenche campo faltante com default (`concealZones ?? []`, `lockedLayers ?? []`, `scenarioLink ?? null`) |
| Névoa / memória do jogador | `client/src/net/hostSession.ts:108-166` (`PlayerMemory`, `memoryKey`, `memoryFor`) | UMA memória por jogador; a chave junta id, largura, altura e grade do mapa; mapa diferente APAGA a memória anterior |
| Snapshot | `client/src/net/hostSession.ts:174-189`, `client/src/net/protocol.ts:93-94` | Mestre manda o `MapData` INTEIRO já filtrado (`client/src/lib/fogFilter.ts`); o jogador troca o mapa da tela sem cerimônia (`client/src/player/playerConnection.ts:264-284`) |
| Fonte do mapa no host | `client/src/App.tsx:217` (`getMap: () => useMapStore.getState().map`), `client/src/net/hostBridge.ts:277,299` | O host serve SEMPRE o mapa que o mestre está editando |
| Movimento autoritativo | `client/src/lib/moveValidation.ts`, `client/src/lib/collision.ts` | Valida dono, limites, parede, chão; devolve `{ok, x, y}` |
| Escada | `client/src/types/map.ts:309-340`, `client/src/pixi/drawStairs.ts`, `client/src/components/StairControls.tsx` | Sobe/desce + seta; SEM campo de destino |

Três conclusões que mudam o desenho:

1. O jogador já recebe um `MapData` completo por snapshot, então **trocar a cena de um jogador é só mandar
   o snapshot de outro mapa**. Nenhuma engenharia de "troca de cena" no cliente é necessária para
   funcionar — só um aviso na tela e limpeza do movimento otimista pendente.
2. O host enxerga **um** mapa (`getMap()`). Esse é o gargalo real: sem mais de um mapa vivo em memória,
   token em cena diferente é impossível.
3. A memória de exploração é substituída ao trocar de mapa (`hostSession.ts:157-166`). Sem corrigir,
   **sair da casa apaga tudo que o jogador já tinha explorado lá fora**. Correção pequena, valor alto.

---

## 1. Modelo de dados — um arquivo por cena + índice de aventura

**Escolhido:** um `map.json` por cena (como hoje) MAIS um `adventure.json` que lista as cenas.

Rejeitado — *um arquivo só com todos os mapas*: gravar vira O(aventura) a cada traço (o mapa real do
usuário já tem milhares de peças de chão e desenhos), um JSON corrompido leva a aventura inteira junto, e
quebraria `listSavedMaps` / `duplicateMap` / exportar-um-mapa, que já funcionam.
Rejeitado — *só caminho absoluto entre mapas, como o `linkedMapPath` de hoje*: não sobrevive a
exportar/importar nem a trocar de máquina, e não dá lista de cenas para a UI.

```ts
// NOVO arquivo: <pasta da aventura>/adventure.json
interface AdventureFile {
  version: 1
  id: string                 // adv_<uuid>
  name: string
  startSceneId: string       // cena que abre ao carregar a aventura
  scenes: SceneEntry[]
}
interface SceneEntry {
  id: string                 // === MapData.id da cena (não inventar um segundo id)
  name: string               // espelho de MapData.name, para listar sem abrir cada arquivo
  file: string               // caminho RELATIVO à pasta da aventura: "scenes/<id>/map.json"
}
```

```ts
// MapData ganha UM campo, aditivo (client/src/types/map.ts)
portals: Portal[]

interface Portal extends PlayerSecret {    // PlayerSecret = `secret?`, igual a Stair/Prop
  id: string
  label: string                            // "Entrar na casa", "Subir"
  // Onde se pisa: ancorado numa entidade que já existe, ou área livre no chão.
  anchor:
    | { kind: 'wall'; wallId: string }      // porta
    | { kind: 'stair'; stairId: string }    // escada "leva ao andar"
    | { kind: 'area'; x: number; y: number; w: number; h: number; rotation?: number }
  // Onde aparece quem CHEGA nesta cena por este portal (px de mundo).
  entry: { x: number; y: number }
  // null = portal criado e ainda não ligado.
  target: { sceneId: string; portalId: string } | null
  mode: 'auto' | 'prompt' | 'master'       // pisou e foi | pisou e pergunta | só o mestre manda
  locked: boolean
  hidden?: boolean
}
```

Por que entidade nova e não um campo em `Wall`/`Stair`/`Prop`: o portal precisa de **ponto de chegada** e
**destino**, e `Wall` não tem onde guardar isso; e a mesma lógica não pode existir em três cópias. O
`anchor` por id mantém o visual preso à porta/escada que já está desenhada.

### Migração e compatibilidade (regra: mapa antigo abre igual)

- `client/src/lib/mapFile.ts` — acrescenta `portals: parsed.portals ?? []`, exatamente o padrão já usado
  para `concealZones` e `lockedLayers`. Nenhum mapa salvo quebra.
- `MapData` ganha `schemaVersion?: number` (ausente === 1; esta rodada grava 2). Serve só para uma mensagem
  clara no futuro ("este mapa foi salvo por uma versão mais nova"), **não** como portão que recusa arquivo —
  o estilo de migração por default campo a campo continua.
- `Prop.linkedMapPath` CONTINUA existindo e funcionando (`PortalControls` intacto). Ao converter mapas
  soltos em aventura (entrega 1), cada prop com `linkedMapPath !== null` vira um `Portal` com
  `anchor: 'area'` no retângulo do prop e `mode: 'master'`, e o campo é zerado. Quem nunca criar aventura
  mantém o comportamento de hoje para sempre.
- Mapa avulso (`%APPDATA%/maps/<id>/map.json`) aberto direto continua abrindo: o app o embrulha numa
  **aventura implícita de 1 cena, só em memória**; o `adventure.json` só é gravado quando surgir a 2ª cena.

---

## 2. Passagem — como o mestre liga dois mapas em 3 cliques

Fluxo alvo (porta da casa):

1. Selecionar a porta (ou a escada, ou desenhar a área) — o rail mostra a seção **"Leva a..."**
   (`client/src/components/PortalControls.tsx` reaproveitado e renomeado).
2. Clicar **"Leva a..."** — abre a lista das cenas da aventura mais **"Nova cena em branco"**.
3. Escolher. O app faz, numa ação só:
   - cria a cena B se preciso (`mapFactory.createEmptyMap`, mesmo w/h/grid de A);
   - cria `portalA` em A, com `entry` uma célula do lado de FORA do anchor (sentido oposto à normal da
     parede) — o token que volta não pode nascer dentro da parede;
   - cria `portalB` em B (área de uma célula, `label: "Sair"`), com o `entry` dele em B;
   - amarra os dois: `portalA.target = {B, portalB.id}` e `portalB.target = {A, portalA.id}`. **Mão dupla
     por construção**, não por caixinha que o usuário esquece de marcar.
4. Ajuste fino opcional: arrastar no canvas o losango que marca o ponto de chegada.

Desligar remove OS DOIS lados (senão sobra portal órfão apontando para portal inexistente). Invariante ao
carregar: `target` apontando para cena/portal inexistente vira `null` mais aviso no toast ("O portal
'Entrar na casa' perdeu o destino") — nunca exceção.

Arquivos que mudam: `client/src/types/map.ts` (tipo), `client/src/lib/mapFactory.ts` (`addPortal`,
`linkPortals`, `unlinkPortal`), `client/src/stores/mapStore.ts` (actions com `withHistory`),
`client/src/components/PortalControls.tsx` (UI), `client/src/pixi/drawPortals.ts` (novo: seta/losango
discreto no estilo de minimapa já definido), `client/src/pixi/PixiCanvas.tsx` (hit-test e arrasto do ponto
de chegada).

---

## 3. Token em outra cena

**Onde o token fica:** dentro do `MapData.tokens` da cena em que está, com o MESMO `id`. Atravessar =
remover de A e inserir em B no `portalB.entry`. Rejeitado: registro global de tokens com campo `sceneId` —
obrigaria a reescrever `fogFilter`, `moveValidation`, `drawTokens`, seleção e histórico.

**Quem guarda as cenas vivas:** store novo `client/src/stores/adventureStore.ts`:

```ts
interface AdventureState {
  adventure: AdventureFile | null
  activeSceneId: string | null
  cache: Record<string, MapData>          // cenas carregadas que NÃO estão em edição
  dirty: Set<string>                      // cenas de fundo alteradas e ainda não gravadas
  getScene(sceneId): MapData | undefined          // ativa => useMapStore.getState().map
  updateScene(sceneId, fn: (m) => MapData): void  // ativa => action do mapStore; fundo => cache + dirty
  switchScene(sceneId): Promise<void>             // grava a ativa, carrega a nova, troca
  flush(): Promise<void>                          // grava todas as cenas sujas
}
```

Regra dura: **mudança em cena de fundo NÃO entra no histórico (undo/redo) da cena ativa.** O Ctrl+Z do
mestre só desfaz o que ele desenhou na cena aberta.

**O que o mestre vê:** a cena aberta, uma só. Não abrir dois mapas lado a lado — é o caminho mais caro
(dois `PixiCanvas`, duas câmeras, dois inspetores) e não é o que o pedido exige. Em vez disso:

- lista de **Cenas** no rail, com contador de tokens por cena ("Casa · 1");
- no painel "Jogo", cada jogador mostra onde está: "Grog — Casa do Ferreiro";
- toast quando um token atravessa: "Grog entrou em Casa do Ferreiro", com botão **"Ir lá"**.

**O que o jogador de fora vê:** nada de dentro. Ele recebe o snapshot da cena DELE; o token que entrou
simplesmente não está mais na lista de tokens daquela cena. É consequência do modelo, não código extra.

**Névoa e memória por cena (correção obrigatória):** em `client/src/net/hostSession.ts:142`,
`Map<playerId, PlayerMemory>` passa a `Map<playerId, Map<sceneKey, PlayerMemory>>`, e `memoryFor` busca ou
cria por chave em vez de descartar a anterior. Teto de 8 cenas lembradas por jogador, descartando a menos
usada (`MAX_EXPLORED_CELLS` já limita cada bitset). `hidePlan` e `revealPlan` passam a valer só para a cena
atual do jogador.

---

## 4. Protocolo (`client/src/net/protocol.ts`) — tudo aditivo, `PROTOCOL_VERSION` continua 1

**Mestre para jogador**

- `snapshot` e `delta` ganham `sceneId: string` e `sceneName: string`. Cliente antigo ignora campo extra.
- NOVA: `{ type: 'scene.changed'; sceneId: string; sceneName: string; reason: 'portal' | 'master' }`,
  enviada ANTES do primeiro snapshot da cena nova. O jogador usa para limpar os movimentos otimistas
  pendentes (`client/src/player/playerConnection.ts:475`), recentrar a câmera no token e mostrar
  "Você entrou em: Casa do Ferreiro". Cliente antigo cai no `default` do switch e ignora — continua
  funcionando, só sem o aviso.

**Jogador para mestre: NADA de novo.** É essa a resposta para "o que impede um jogador de se teletransportar
sozinho": **não existe mensagem em que o jogador nomeie uma cena ou um portal.** Ele só manda
`token.move {x, y}`, como hoje. O host valida em `validateTokenMove` e, se o trajeto aceito terminar dentro
de um `Portal` com `mode: 'auto'`, **o host decide** transferir. Um cliente adulterado consegue, no máximo,
pedir para andar até um lugar onde ele já poderia andar.

Ordem exata no host ao aceitar a travessia (`hostSession.handleMove`):

1. `validateTokenMove` na cena de origem; recusou, acaba aqui e nada muda.
2. Atingiu portal? Checar `locked === false`, `target !== null`, cena destino existe, `mode !== 'master'`.
3. Validar a CHEGADA: o ponto `entry` está dentro do mapa destino e sobre o chão (reusa `moveValidation`
   com `from` e `to` iguais ao `entry`). Falhou, recusa e o token fica onde estava.
4. Aplicar `applyTransfer { tokenId, fromSceneId, toSceneId, x, y }` — campo novo de `HostResult`, irmão de
   `applyMove` e `applyDoor`, executado pelo `hostBridge` via `adventureStore.updateScene`.
5. Mandar ao dono: `token.move.accepted` (x/y já da cena nova), depois `scene.changed`, depois o `snapshot`
   da cena B.
6. `broadcast` normal para todos; quem ficou na cena A vê o token sumir.

O modo `'prompt'` (entrega 3) acrescenta `{ type: 'portal.enter'; portalId }` no sentido jogador para
mestre, validado EXATAMENTE como `door.toggle` já é hoje (`hostSession.ts:296-321`: existe, visível agora e
não só lembrado, destrancado, token do jogador encostado, um pedido a cada 250 ms).

`client/src/lib/fogFilter.ts` — o recorte do jogador NUNCA manda `portal.target` (revelaria o nome e a
existência de uma cena) nem portal `hidden`/`secret`; manda só `{id, anchor, label, locked}` do que está
visível, no mesmo ponto em que já zera `linkedMapPath` (`fogFilter.ts:403`) e `scenarioLink` (`:385`).

---

## 5. Tela do mestre

**Escolhido:** seção retrátil **"Cenas"** no topo da aba **Mapa** do rail, com o `CollapsibleSection` que já
existe: lista `nome · contador de tokens`, cena ativa destacada, `+ Nova cena`, e botão direito para
renomear/duplicar/apagar. Trocar de cena = um clique.

Rejeitado — *terceira aba no `RailTabs`* ("Mapa | Jogo | Cenas"): mexe em `client/src/components/RailTabs.tsx`,
na navegação por teclado das abas e em três testes, para ganhar o mesmo.
Rejeitado — *abas no topo*: a `ActionBar` já tem mais de oito botões
(`client/src/components/ActionBar.tsx:93-104`) — é exatamente o "estorvar a barra atual" que o pedido proíbe.

O botão **"Voltar"** da `ActionBar` (`client/src/App.tsx:1330`) continua igual, agora voltando à cena
anterior da aventura: mesma semântica, fonte de dado nova (`adventureStore` em vez de `previousMapPath`).
Miniatura de verdade na lista fica para a entrega 3 — `client/src/components/MapPreview.tsx` hoje desenha só
a grade, não o conteúdo do mapa.

---

## 6. Fatiamento

### Entrega 1 — Cenas e portais no editor (mestre sozinho, sem rede)

`adventureStore` + `adventure.json` + `Portal` no schema + seção "Cenas" no rail + "Leva a..." de mão dupla
+ arrastar token do mestre para o portal transfere de cena. A rede continua exatamente como hoje (serve a
cena ativa). Agent: `programador`.

**Critério de pronto (verificável por terceiro):** abrir o app; criar o mapa A; desenhar uma porta;
selecionar a porta, "Leva a...", "Nova cena em branco"; a lista de Cenas passa a mostrar duas cenas;
arrastar um token para cima da porta — o token some de A, a lista mostra "1" na cena B e, clicando em B, o
token está na entrada; fechar o app e reabrir a aventura — as duas cenas, o portal e o token continuam onde
estavam; abrir um `map.json` salvo ANTES desta entrega — abre igual, sem erro, e o "Entrar no andar" de um
prop antigo continua funcionando. Portão: `rtk proxy npx tsc --noEmit` limpo, `vitest` e `playwright`
verdes.

### Entrega 2 — Jogador entra na casa (o que o pedido literalmente pede)

Memória de exploração por cena; `broadcast` por cena (host resolve o mapa por `sceneId`, não mais por "o que
o mestre está vendo"); `scene.changed` e `sceneId` no snapshot; travessia autoritativa no `handleMove`;
painel do mestre mostrando a cena de cada jogador; toast "Grog entrou em X". Agent: `programador`, com
`revisor(segurança)` no `handleMove` e no `fogFilter` antes do commit.

**Critério de pronto:** sala em LAN com dois navegadores. J1 e J2 com token na rua, os dois veem a rua. J1
anda até a porta da casa: J1 passa a ver só o interior; J2 continua vendo a rua, SEM o token de J1 e SEM
nada do interior. J1 sai pela mesma porta: volta à rua e o que ele já tinha explorado da rua CONTINUA
lembrado (não escureceu tudo de novo). O mestre vê "J1 — Casa" no painel Jogo. Um cliente adulterado que
mande `token.move` para coordenadas do interior sem estar no portal é recusado — teste de unidade em
`client/src/net/hostSession.test.ts`.

### Entrega 3 — Conforto

Escada com "leva ao andar" no `StairControls` (mesmo portal, `anchor: 'stair'`); modo `'prompt'`
("Entrar na casa?") com `portal.enter`; mestre manda token para a cena X pelo menu de contexto; portal
trancado e portal secreto; miniatura real na lista de cenas. Agent: `programador` (portal/escada) e
`programador-frontend` (miniatura e diálogo).

**Critério de pronto:** o usuário cria uma escada, aponta "leva ao andar" para a cena de cima e sobe com um
token; um portal em modo "perguntar" mostra o diálogo ao jogador e só troca de cena depois do "Sim"; portal
trancado recusa com aviso na tela do jogador.

---

## 7. Riscos e o que pode quebrar do que já funciona

| Risco | Como quebra | Detecção / mitigação |
|---|---|---|
| Undo desfaz a cena errada | `mapStore` tem um histórico só; a transferência mexe numa cena de fundo | `updateScene` em cena de fundo NÃO passa por `withHistory`. Teste: transferir token, Ctrl+Z, conferir que só o último traço da cena ativa foi desfeito |
| Trabalho perdido em cena de fundo | `client/src/stores/sessionStore.ts` só assina `mapStore.map`, então cena de fundo alterada não marca "sujo" | `dirty: Set<sceneId>` no `adventureStore`; `isDirty` global = mapa ativo sujo OU set não vazio; `flush()` antes de fechar, trocar de cena e exportar |
| Memória de exploração crescendo sem fim | bitset por jogador vezes cena | Teto de 8 cenas por jogador, descartando a menos usada; `MAX_EXPLORED_CELLS` já limita cada bitset |
| Vazamento pela névoa | `portal.target` no snapshot revelaria nome e existência de cena secreta | Recorte explícito em `fogFilter.ts`, com teste em `fogFilter.test.ts` no mesmo molde do `linkedMapPath` |
| Movimento otimista atravessa a cena | `pending` do `playerConnection` aplicaria posição velha no mapa novo | Limpar `pending` em `scene.changed`; teste em `client/src/player/playerConnection.test.ts` |
| Portal órfão | apagar cena, parede ou escada deixa `target` apontando para o nada | Ao apagar cena ou anchor, limpar os dois lados; ao carregar, `target` inválido vira `null` mais toast |
| Caminho absoluto quebra ao exportar | já é bug do `linkedMapPath` de hoje | `SceneEntry.file` RELATIVO; `handleExportFolder`/`handleImportFolder` (`client/src/App.tsx:927`) passam a levar a pasta da aventura inteira |
| Path traversal | `sceneId`/`file` vêm de arquivo externo e viram segmento de caminho | Reusar `mapFileIO.assertPathWithinRoot` em cada `SceneEntry.file` resolvido; nunca confiar no conteúdo do `adventure.json` |
| Sala em LAN durante a troca de cena do mestre | `getMap()` muda debaixo do host e todos os jogadores pulariam de mapa | Host passa a resolver por `sceneId`; trocar de cena no editor não move jogador nenhum |

**Testes que provavelmente quebram** (rodar `vitest` e `playwright` antes e depois; a maioria só precisa do
campo novo no objeto esperado):

- Unidade: `client/src/lib/mapFile.test.ts` (round-trip ganha `portals`), `client/src/lib/mapFactory.test.ts`,
  `client/src/lib/fogFilter.test.ts` (campo novo recortado), `client/src/lib/mapExport.test.ts`,
  `client/src/net/hostSession.test.ts` e `client/src/net/hostBridge.test.ts` (assinatura de `broadcast` e
  `handleMessage`, memória por cena), `client/src/player/playerConnection.test.ts` (`scene.changed`),
  `client/src/stores/mapStore.test.ts`, `client/src/stores/propsSubscription.test.ts`.
- E2E: `client/e2e/task-alignment-door-curve-portal.spec.ts` (o mais certo — mexe direto na UI de portal),
  `client/e2e/task-panel-sections.spec.ts` (seção "Cenas" nova no rail),
  `client/e2e/task-fluxo-consertos.spec.ts` (usa `snapshot()` e portal),
  `client/e2e/task-player-map.spec.ts` e `client/e2e/task-player-page.spec.ts` (forma do snapshot),
  `client/e2e/task-player-door.spec.ts` (entrega 2, mesmo caminho do `handleMove`),
  `client/e2e/task-stair-tool.spec.ts` (entrega 3).

---

## 8. Perguntas ao usuário (decisão de produto — o arquiteto não decide sozinho)

1. **Aventura como pasta com as cenas dentro, ou mapas soltos como hoje?**
   Recomendo: pasta de aventura com caminho relativo — é o que faz exportar e mandar para outra máquina
   funcionar. Alternativa: continuar com caminho absoluto (mais simples agora, quebra ao mover os arquivos).
2. **Token pisou no portal: passa direto ou pergunta antes?**
   Recomendo: passa direto (`auto`) — é o que "entrar na casa" parece que deve fazer; o "perguntar" fica
   como opção por portal na entrega 3. Alternativa: sempre perguntar (mais seguro contra passo errado, mas
   um clique a mais toda vez).
3. **Quem ficou de fora vê o token que entrou sumir, ou ele fica parado na porta?**
   Recomendo: sumir — é o que acontece na ficção (o personagem entrou) e sai de graça no modelo.
   Alternativa: deixar uma "sombra" na porta (código só para isso, e mente sobre onde o personagem está).
4. **Quando um jogador entra na casa, o editor do mestre segue junto?**
   Recomendo: não — toast "Grog entrou em Casa do Ferreiro" com botão "Ir lá", e o mestre troca quando
   quiser; seguindo sozinho, ele perderia o que estava desenhando a cada passo de jogador. Alternativa:
   seguir automaticamente quando houver só um jogador em jogo.

---

## Próximo passo

Responder as 4 perguntas do §8. Fechadas elas, a **entrega 1** vai para o agent `programador` (opus@high),
com input: este documento, §1 (schema e migração), §2 (portal e ligação) e §3 (`adventureStore`), e portão
`rtk proxy npx tsc --noEmit` mais `vitest` e `playwright`. A parte de rede da **entrega 2** (memória por
cena, `scene.changed`, travessia autoritativa) vai para o `programador` num segundo lote, com
`revisor(segurança)` sobre `handleMove` e `fogFilter` antes do commit.
