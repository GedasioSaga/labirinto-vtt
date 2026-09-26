# Pedidos do usuário e fila de features

Lista viva. Todo pedido feito no meio do caminho entra em **Pedidos recebidos** com data e as
palavras do usuário, e depois vai para a **Fila** na posição combinada. Uma feature por vez:
plano curto → portão (tsc, vitest, playwright) → exe → olhar de usuário → teste do usuário
(bom/ruim/estranho) → commit.

## Em andamento
- Exe com as portas gerado (commit `d456fb9`, exe 15/09 20:51); conferindo no exe antes de entregar.
  Depois começa o item 2b (memória do jogador: sala visitada fica lembrada inteira, com paredes,
  sem escadinha).
- Disco: apagados com autorização `~/.cache/puppeteer` e `~/.cache/codex-runtimes`; a pasta
  temporária `scratchpad/target-f2` também foi apagada. Livre ~2,8 GB. `C:\dev\learno` (29,9 GB) e
  `Projeto Genesis` (6,8 GB) são do usuário e não foram tocados.

## Fila nova (ordem aprovada em 15/09/2026, depois da lista de 11 itens) — VALE ESTA
1. Defeitos já em conserto: Ctrl+Z no rascunho de Área apaga Sala; campo de nome engole arrasto.
2. Defeitos da lista (diagnóstico em andamento): P4 visão do jogador (uma sala visível e a outra
   não), P8 iluminação estranha/não funciona, P10 não consegue entrar na casa (porta).
   Diagnóstico (debugador, 15/09/2026, mapa real do usuário, prints em `scratchpad/diag-usuario/`):
   - **P4 visão:** memória do explorado guarda células de 1/4 de quadrado (`lib/exploration.ts:17`,
     `:196-227`) desenhadas como retângulos (`player/PlayerView.tsx:318-322`): borda do raio (700,
     `net/hostBridge.ts:78`) vira escadinha; sala sai para o jogador se qualquer amostra foi vista
     (`lib/fogFilter.ts:413`); paredes da sala somem sob a névoa. A sala esquerda ficou cortada
     porque um canto estava a 778 px (>700); a direita coube inteira. Regra + bug de acabamento.
   - **P8 luz:** só halo decorativo fraco (alpha ~0,28) que atravessa parede
     (`pixi/drawLights.ts:16-20,77`); o jogador NUNCA desenha luz (enviada em `fogFilter.ts:395`, sem
     uso em `player/`); visão não depende de luz; não existe escuridão (`types/map.ts:110`).
   - **P10 porta:** parede sem porta e porta fechada bloqueiam (certo); criar porta = ferramenta
     Porta (D) clicando na parede, ou painel "Virar porta"; dica fraca (só com a ferramenta ativa).
     Bugs: jogador não consegue abrir porta (sem mensagem no protocolo, `net/protocol.ts:40-60`);
     "Virar porta" transforma o lado inteiro da sala em porta (`App.tsx:609`); trancada ignorada
     pela colisão e UI permite aberta+trancada (`lib/collision.ts:33`); passar pela porta em
     diagonal falha (só o traço do centro, `collision.ts:37-39`).
   - **P5 escada:** já tem Sobe/Desce no painel (`components/StairControls.tsx:51`) e seta na ponta
     (`pixi/drawStairs.ts:35-46`); falta ficar claro e ter "leva ao andar" (mapa vinculado).
   Decisões do usuário (15/09/2026) para consertar, NESTA ordem, depois dos 2 defeitos em conserto:
   a. **Porta:**
      - jogador abre porta fechada e destrancada encostada no token (validado no host; o mestre
        vê); trancada só o mestre abre e SEMPRE bloqueia;
      - consertar "Virar porta" transformando o lado inteiro em porta;
      - aberta+trancada não pode;
      - passagem em diagonal pela porta;
      - dica da Sala dizendo como criar porta (D).
   b. **Memória do jogador:** entrou ou viu o interior de uma sala, ela fica lembrada INTEIRA,
      escurecida, com paredes e portas visíveis, sem escadinha; sala nunca visitada continua
      escondida.
   c. **Luz decorativa certa:** barrada por parede, mais visível e desenhada na tela do jogador.
      "Mapa escuro" com tocha fica para depois (fila).
3. Ganhos rápidos:
   - P1 seleção com mouse — decisão: com Selecionar, arrastar em área vazia desenha retângulo e
     seleciona tudo dentro, SEM Shift; mover a vista vira botão do meio ou Espaço;
   - P3 espessura livre de parede (acompanha o zoom, para muralha);
   - P5 escada com direção (sobe/desce) e visual de escada.
4. Jogador: P6 redesenhar telas do jogador (desconectado, entrar); P8b foto do token; P9 jogador
   renomeia o próprio token.
5. Pincel de blocos + balde (P2 piscina) — plano `~/.claude/plans/pincel-de-blocos.md`; caminhos
   coloridos com cor por caminho (P7).
6. Sala de formato livre.
7. P11 mapas conectados (entrar na casa abre o mapa de dentro; tokens em mapas diferentes) —
   desenhar com o usuário antes.
8. Resto da fila antiga abaixo (ajustes de desenho, leitura de mapa, propriedades, pendências).

## Fila antiga (15/09/2026, antes da lista de 11 itens)
1. **Consertar 2 defeitos achados desenhando os mapas do Zelda**
   - Ctrl+Z durante o rascunho de Área (Região) apaga a última Sala e mantém o rascunho.
   - Com zoom afastado, o campo de nome da Sala recém-criada engole o próximo arrasto (a próxima
     Sala não é criada).
2. **Pincel de blocos na grade** — arrastar pintando quadradinhos de chão; apagar também.
   Decisões do usuário (15/09/2026):
   - pinta **chão com a borda como parede** (os blocos viram um chão único; a borda externa ganha
     linha fina clara e bloqueia token e visão);
   - tamanho **1, 2 ou 3 blocos + balde** (preencher área fechada de uma vez);
   - **botão direito apaga**, esquerdo pinta.
3. **Sala de formato livre** — clicar os cantos; sai com paredes e aceita portas e sub-salas.
4. **Pequenos ajustes de desenho**
   - desfazer o último ponto com Backspace;
   - grudar na grade ligado por padrão, com nome claro;
   - ímã de vértice proporcional à grade;
   - Área nova com cor diferente da de baixo;
   - tecla F (enquadrar) sem esconder atrás do painel e da barra.
5. **Leitura de mapa de jogo** (sugestão, confirmar antes)
   - linha de passagem pontilhada (ferramenta);
   - marcadores com ícone (estrela, item, ponto de interesse);
   - etiqueta de lugar (pílula com linha apontando);
   - saída/abertura sem parede.
6. **Propriedades** (sugestão, confirmar antes)
   - parede: espessura que acompanha o zoom, cor, sólida/pontilhada;
   - Sala: nome numerado automático ("Sala 2"), nome na maior área livre, recalcular sub-salas ao
     redimensionar a mãe;
   - porta: tamanho ajustável e tipos visíveis;
   - peça de chão: mover e inserir cantos.
7. **Fatia 3 do plano: caminhos coloridos** — faixa larga de outra cor por cima do chão, sem parede.
8. **Pendências antigas**
   - conferir no olho a tela do jogador com o visual novo;
   - painel: tirar "Nada selecionado" e montar bloco por objeto;
   - QR da sala aponta para o IP da VPN (`desktop/src-tauri/src/commands.rs:264`);
   - push e release no GitHub só com pedido explícito.

## Aguardando teste do usuário
- **2 defeitos de desenho** — commit `ce848d4` (15/09/2026): Ctrl+Z/Backspace no rascunho de Área
  tira só o último ponto (não apaga Sala); campo de nome da Sala nova não engole mais o arrasto.
- **Salas dentro de sala** — commit `c8a990b` (15/09/2026, ponto de salvamento antes das features
  novas): roteiro de 8 itens enviado no chat; se algo sair ruim, vira conserto na fila.

## Feito
- 15/09/2026 `3ef5007` — visual minimapa Resident Evil + cópia de Sala com paredes (aprovado: "Perfeito").
- 15/09/2026 `2c39cd2` — nitidez do canvas (texto, linhas, grade).

## Pedidos recebidos (registro literal)
- 15/09/2026 — "Mas que diabos é isso? eu não quero esse tipo de mapa, tem que ser aqueles mapas
  simples igual resident evil" → visual RE (feito).
- 15/09/2026 — "pode escolher a cor do chão. Dentro das propriedades ou sala poder criar salas
  dentro de sala" → salas dentro de sala (aguardando teste).
- 15/09/2026 — "eu gostaria de poder fazer o chão de uma cor e fazer caminhos de outras cor" →
  caminhos coloridos (fila 7).
- 15/09/2026 — "Porque a cópia não tem as linhas brancas?" → cópia de Sala com paredes (feito).
- 15/09/2026 — "ignore a coloração, foque no formatos e tente desenhar [os mapas do Zelda]" →
  experimento feito (`Tentativa/zelda/`); gerou os itens 1-6 da fila.
- 15/09/2026 — "pode começar a adicionar as features uma por uma, eu também vou no meio do caminho
  solicitando algumas coisas então anote" → este arquivo.
- 15/09/2026 — Pincel: "Chão com borda como parede", "1,2,3 bloco + balde", "Botão direito apaga";
  Sala conta como chão onde o token anda; balde em área aberta não pinta e avisa; porta na borda
  pintada fica para depois. Plano: `~/.claude/plans/pincel-de-blocos.md`.
- 15/09/2026 — Lista de 11 itens depois de testar o app (com prints de um castelo):
  - P1 "A primeira feature que adoraria é capacidade de selecionar tudo com mouse" → a esclarecer.
  - P2 "queria a capacidade de fazer uma piscina mas não tem balde de tinta, pense em algo útil" →
    balde do pincel + área de água.
  - P3 "isso era para ser uma muralha de castelo mas não consigo engrossar as linhas o quanto eu
    quiser" → espessura livre de parede (fila 6 antecipada).
  - P4 "o jogador consegue ver o bloco da esquerda mas não o da direita" → BUG de visão do jogador
    (investigar).
  - P5 "como eu sei que essa escada vai para cima ou para baixo? como eu sei que isso é uma
    escada... ta meio feio" → escada com direção e visual claro.
  - P6 "cara isso ta extremamente feio" (telas do jogador: "A conexão com o mestre caiu" e
    formulário de entrar) → redesenhar telas do jogador.
  - P7 "Se eu quisesse fazer um caminho de terra e outro de pedra ambos com cor diferente... como
    eu faria?" → caminhos coloridos (fila 7), cada caminho com cor própria.
  - P8 "A iluminação é meio estranha e não funciona" → BUG/UX de luz (investigar).
  - P8b "No token não dá para trocar a foto da parte azul não?" → imagem do token.
  - P9 "Por que como jogador não consigo mudar o nome do meu próprio token?" → jogador renomeia o
    próprio token.
  - P10 "Que estranho, não consigo entrar na casa" → investigar (sala sem porta bloqueia; ver se é
    falta de porta ou bug e como o usuário descobre a porta).
  - P11 "Quando eu conseguir entrar na casa como eu mudo o mapa para dentro da casa? e se só um
    token for para dentro da casa? como faz?" → mapas conectados (entrar num prédio abre o mapa de
    dentro), com tokens em mapas diferentes. Feature grande: desenhar antes.
- 17/09/2026 — o usuário reenviou a MESMA lista de 11 itens (com os mesmos prints) depois de um
  `/clear`, como pauta da sessão. Nenhum pedido novo: vale a "Fila nova" já aprovada acima.
- 17/09/2026 — o usuário reenviou a lista de 11 itens e mandou rodar tudo em loop com paralelismo
  máximo: "Use o gauntlet-loop, junto a 8 passeadores, junto ao maximo de paralelismo que conseguir
  mas ultracode mais workflow, faça 5 agentes trabalhar em cada melhorias. Enquanto os 8 passeios
  testam tudo e vão solicitando novas features que seriam interessantes." Sem pedido novo de
  produto; é instrução de método (autonomia já registrada em memória, 16/09/2026).

## Pedidos recebidos — 17/09/2026 (lista de 11+1, com prints)

Palavras do usuário, literais:

> 1-[print] A primeira feature que adoraria é capacidade de selecionar tudo com mouse
> 2-[print] Eu tambem queria a capacidade de fazer uma picina mas não tem balde de tinta, pense em algo útil
> 3-[print] isso era para ser um muralha de castelo mas não consigo engrossar a linhas o quanto eu quiser
> 4-[print] que estranho o jogador consegue ver o bloco da esquerda mas não o da direita.
> 5-[print] como eu sei que essa escada vai para cima ou para baixo? como eu sei que isso é uma escada... ta meio feio
> 6-[prints] cara isso ta extremamente feio...
> 7-Se eu quisse-se fazer um caminho de terra e outro de pedra ambos com cor diferente... como eu faria ?
> 8-A iluminação é meio estranha e não funciona.
> 8-[print] No token não da para trocar a foto da parte azul não ?
> 9-Porque como jogador não consigo mudar o nome do meu própio token ?
> 10-[print] Que estranho, não consigo entrar na casa,
> 11-Quando eu conseguir entrar na casa como eu mudo o mapa para dentro da casa ? e se só um toke for
> para dentro da casa ? como faz ?.

Modo de trabalho pedido junto: gauntlet-loop + ultracode + Workflow, máximo de paralelismo,
5 agentes por melhoria, construtor trabalhando direto, e passeios CURTOS (2 de cada vez, cada um
olha uma parte, fecha e abre outro) por causa da memória da máquina.


## Plano de ondas para a lista de 17/09/2026 (gauntlet + workflow)

Cada onda é um `Workflow` do template do gauntlet, peças com arquivos particionados (modo união),
jornada vermelha escrita antes por `testador`, dois `critico-cego` por rodada e passeio curto em
paralelo (2 sessões por vez, 10 gestos cada).

- **Onda 1 — EM ANDAMENTO** (run `wf_45d7b916-f86`, bar Dungeon Scrawl):
  1. P3 espessura de parede contínua (muralha de castelo) — jornada `task-jornada-parede-grossa.spec.ts`
  2. P1 selecionar arrastando o mouse sem Shift — jornada `task-jornada-selecao-arrasto.spec.ts`
  3. P5 escada legível (sobe/desce visível sem painel) — jornada `task-jornada-escada-legivel.spec.ts`
- **Onda 2 — jornadas vermelhas JÁ PRONTAS, esperando a onda 1 fechar** (bar do lado do jogador):
  4. P10 entrar na casa: a recusa passa a explicar o motivo e o caminho —
     `task-jornada-entrar-na-casa.spec.ts` (achado: `mapStore.ts:1023` e `:1183` descartam a recusa
     de `resolveTokenMove` sem toast; o texto certo já existe em `components/labels.ts:81`)
  5. P4 visão do jogador sem escadinha, sala lembrada inteira —
     `task-jornada-visao-sala-inteira.spec.ts` (medido: 9-10 degraus de até 19 px na borda lembrada
     contra 0 degraus na borda vista ao vivo; sala encolhe ~6% ao virar memória)
- **Onda 3:** P8b foto no lugar do círculo azul do token + P9 jogador renomeia o próprio token
  (protocolo não tem nenhuma mensagem de editar token hoje: `net/protocol.ts:55-102`).
- **Onda 4:** P2 balde/piscina + P7 caminhos com cor por caminho (não existe flood fill nem pincel;
  `FloorStyle` é global, `Region.fillColor` é por instância — é daí que sai a feature).
- **Onda 5:** P8 luz que é barrada por parede e aparece na tela do jogador (hoje `drawLights.ts` não
  consulta parede nenhuma e `player/PlayerView.tsx` não desenha luz).
- **Onda 6:** P11 mapas conectados (plano em `docs/plano-mapas-conectados.md`; hoje o host serve UM
  mapa só, `App.tsx:217`, e trocar de mapa apaga a memória do jogador, `hostSession.ts:157-166`).
- **P6 "extremamente feio"** não tem alvo nomeado nos prints que chegaram: vai sendo atacado pelos
  achados dos passeios, abaixo.

## Achados dos passeios cegos de 17/09/2026 (usuário decide o que entra)

1. **Ferramenta "Peça" não cria nada e falha calada** — clicar no mapa com ela ativa não produz
   objeto e o console registra `Cannot read properties of undefined (reading invoke)`; a ferramenta
   continua marcada como ativa, então o usuário acha que errou o lugar e insiste.
2. **Mapa novo com grade Quadrado abre sem grade e sem borda do mapa** — a prévia da tela de criação
   mostra a grade, o editor abre preto. (É a jornada vermelha já conhecida do commit `25de80c`.)
3. **Token nasce no centro da vista, em cima de parede** — "Adicionar token" não pergunta onde, e a
   peça nasce atravessando a parede do cômodo interno, sem aviso.
4. **Todo cômodo se chama "Sala"** — dois cômodos aninhados ficam com o mesmo nome e os rótulos
   colados; com 4 ou 5 cômodos vira um amontoado.
5. **Sala Circular nasce facetada** — contorno com cantos retos, parece polígono de poucos lados.
6. **Menu de variante não ativa a ferramenta** — escolher "Interna" em Opções de Parede deixa a
   ferramenta ativa como Selecionar.
7. **Painel com nome errado** — com a Sala Circular ativa, o painel abre com o título "REGIÃO".


### Esclarecimento do item 6 (usuário, 17/09/2026)

> O item 6 se refere a quando um jogador vai entrar é simplismente um tela branca feia, se é para
> fazer um site que seja belo.

Ou seja: P6 é a **tela de entrada do jogador** (a página que o jogador abre pelo link/QR antes de
estar conectado). Hoje é uma tela branca sem desenho nenhum. Entra como peça da onda 2, junto com
P10 (entrar na casa) e P4 (visão do jogador), que já têm jornada vermelha pronta.

Causa da tela branca, apurada em 17/09/2026 no app rodando:
- `client/src/player/player.css` NÃO tem regra para `html` nem para `body`; todo o fundo escuro
  vem do `themeCss` injetado por JavaScript em `client/src/player/main.tsx:5,13`. Se o módulo
  falhar antes de injetar, sobra `<div id="root">` vazio e o branco padrão do navegador.
- `client/src/player/ErrorBoundary.tsx` é a rede de segurança e ela mesma é sem tema (`boxStyle`
  com `system-ui`, sem fundo, sem cor, dois botões padrão do navegador) — o comentário do arquivo
  diz que existe justamente para evitar página branca.
- Código de sala inexistente deixa a tela presa em "Conectando…" para sempre: sem prazo, sem erro,
  sem caminho de volta (medido com "ABC123").
Jornada vermelha em escrita: `client/e2e/task-jornada-tela-entrada-jogador.spec.ts`.


### Endereço dos achados dos passeios (batedores, 17/09/2026)

**1. Ferramenta "Peça" (tool id `prop`) — CORREÇÃO DE SEVERIDADE.** O erro `invoke` é do NAVEGADOR,
não do exe: `pickImageFile` (`client/src/lib/imageImport.ts:11-17`) usa o plugin-dialog do Tauri, que
lê `window.__TAURI_INTERNALS__` — esse global só existe dentro do webview Tauri. No exe a ferramenta
provavelmente funciona; foi o passeio pelo navegador que a pegou. O defeito REAL que sobra:
`client/src/pixi/PixiCanvas.tsx:2093-2112` roda a IIFE `void (async () => {...})()` SEM try/catch,
então qualquer falha vira unhandled rejection calada, a ferramenta continua marcada como ativa e
nada aparece na tela. O guarda certo já existe e é usado em `client/src/App.tsx:380` e `:549`
(`isTauri()`), mas esse bloco não usa. Sem teste nenhum: não existe `PixiCanvas.test.tsx`, e
`imageImport.test.ts` mocka `invoke`/`open`, então nunca exercita o caso sem Tauri.

**3. Token nasce no centro da vista, sem checar parede.** `client/src/App.tsx:926-931`
(`handleAddToken`), linha 928: `at ?? (host ? viewportCenterWorld(...) : { x: 0, y: 0 })` — nenhuma
validação antes do `addToken` da linha 930. As funções que sabem responder já existem
(`client/src/lib/collision.ts:40` `moveCrossesWall`, `:99` `resolveTokenMove`), mas só são usadas ao
MOVER token existente, nunca ao criar. Sem cobertura: não existe `App.test.tsx`.

**4. Todo cômodo se chama "Sala" e o rótulo da de fora cai na quina da de dentro.**
`client/src/lib/drawingFactory.ts:53` `DEFAULT_ROOM_NAME = 'Sala'` é constante fixa; usada direto em
`:76,94` (sala retangular) e `:155,167` (circular/polígono), e nenhuma das duas funções recebe a
lista de salas existentes, então não há como gerar "Sala 2". `client/src/pixi/drawRoomNames.ts:27-45`
(`roomLabelAnchor`) ancora no centróide do próprio polígono e NÃO recebe as salas filhas — daí o
rótulo da mãe cair sobre a filha. `:53-58` só soma o deslocamento manual do mestre; não há
anti-colisão automática. `client/src/components/RoomControls.tsx:60-64` mostra "Dentro de: Sala",
ambíguo pelo mesmo motivo. Testes: `drawingFactory.test.ts:188,286` só conferem que o nome sai igual
à constante; não existe teste de unicidade nem de colisão de rótulo.

**6. Menu de variante não ativa a ferramenta — É DE PROPÓSITO, não é bug.**
`client/src/components/ToolVariantMenu.tsx:16-23` documenta o contrato: `doorKind`, `wallKind`,
`regionFillPattern` e `polygonSides` editam a PREFERÊNCIA da próxima entidade; só `drawShape` troca a
ferramenta (`client/src/App.tsx:1210`, único eixo ligado a `setActiveTool`; os outros em `:1200-1201`
só setam preferência). O efeito colateral é que `TOOL_HINTS[activeTool]`
(`client/src/components/Toolbar.tsx:213`) continua explicando a ferramenta antiga. Mudar isso é
DECISÃO DE PRODUTO do usuário, não conserto. Não coberto por teste em nenhuma direção.

**7. Painel abre com título "REGIÃO" com a Sala Circular ativa.**
`client/src/lib/toolProperties.ts:197-203` (`showRegionGroup`) inclui `activeTool === 'roomCircle'` e
adiciona `regionStyle` mesmo sem seleção; já o grupo `room` só nasce com seleção
(`toolProperties.ts:259`). Então `RegionStyleControls` (h2 "Região",
`client/src/components/RegionStyleControls.tsx:166`) renderiza primeiro, e `RoomControls` (h2 "Sala",
`RoomControls.tsx:58`) só entra quando `selectedRegion?.room` existe
(`client/src/components/PropertiesPanel.tsx:185-196`). `toolProperties.test.ts:84,91,97,102` cobrem
os grupos, mas nenhum teste afirma qual título o usuário vê primeiro.


## Quatro frentes em paralelo, cada uma na própria árvore (17/09/2026)

Para os construtores não se atropelarem, cada gauntlet roda num `git worktree` separado, com porta
de vite própria e `node_modules` por junction (nada duplicado em disco). O merge de volta é manual,
branch por branch, depois que cada frente fechar.

| Árvore | Branch | Porta | Bar | Peças |
|---|---|---|---|---|
| `C:\dev\labirinto` | `feat/menu-inicial` | 1420 | Dungeon Scrawl | parede grossa · seleção por arrasto · escada legível (+ peça de portão nascida da Fase 0) |
| `C:\dev\labirinto-jogador` | `feat/tela-jogador` | 1440 | jackbox.tv | tela de entrada do jogador (P6) |
| `C:\dev\labirinto-fog` | `feat/visao-e-porta` | 1450 | demo.foundryvtt.com/join | visão lembrada inteira (P4) · entrar na casa (P10) |
| `C:\dev\labirinto-consertos` | `fix/achados-passeio` | 1430 | a definir na hora do run | os 6 achados dos passeios |

Bars testadas no driver antes de usar: `app.dungeonscrawl.com` abre; `jackbox.tv` abre (tela de
CÓDIGO DA SALA + NOME, o mesmo problema que a nossa); `demo.foundryvtt.com/join` abre (cena PF2E
viva, com névoa, porta e colisão). **Owlbear Rodeo foi DESCARTADA**: cai em verificação da
Cloudflare no navegador automatizado, e bar que o critic não consegue abrir é bar alucinada.

Refactor mecânico feito à mão antes de começar (para as peças ficarem disjuntas):
`ROOM_CIRCLE_SIDES` saiu de `client/src/pixi/PixiCanvas.tsx` para `client/src/lib/roomCircle.ts`
(só no worktree de consertos; `tsc` exit 0 depois).


### Incidente de porta (17/09/2026) — jornada julgando o app errado

A porta 1430, que eu tinha escolhido para o worktree de consertos, **já estava ocupada por outro
projeto** (`C:/dev/learno`). Eu conferi só o código HTTP (`200`) e concluí que era o Labirinto — não
era. Com `reuseExistingServer: true` do playwright, a primeira jornada de consertos rodou contra o
app errado e morreu com "Não deu para abrir o banco de dados": vermelho pelo motivo errado. Quem
pegou foi a própria testadora, comparando `http://localhost:1430/src/main.tsx`, que devolve o
caminho do outro projeto.

Correção: worktree de consertos movido para a porta **1437** (hmr 1438), com `vite.config.ts` e
`playwright.config.ts` do worktree apontando para lá, e vite persistente de pé. Conferido por
identidade, não por código HTTP: `http://localhost:1437/` devolve `<title>Labirinto`. As outras três
árvores foram conferidas do mesmo jeito (1420, 1440, 1450 — todas Labirinto).

Lição que vale para o resto do projeto: **porta respondendo 200 não prova que é o seu app.** Confira
por identidade (título, ou um arquivo de caminho conhecido) antes de deixar qualquer jornada rodar.

Detalhe que fecha o incidente: a 1430 estava ocupada pelo outro projeto **no IPv6** (`[::1]:1430`
devolvia `<title>Tauri + React + Typescript`), enquanto o IPv4 era o worktree. O Chromium resolve
`localhost` para IPv6 primeiro, então o teste ia para o app errado enquanto o `curl` do terminal via
o certo. Conferir identidade **nas duas pilhas** antes de confiar numa porta.

Jornada `painel-com-nome-certo` mostrou que o defeito é maior do que o passeio viu: **Sala, Sala
Circular e Polígono Regular** abrem com o título "REGIÃO", pelos dois caminhos de gesto (tecla e
clique). Controles positivos verdes: Região e Parede abrem com o próprio nome.


## 17/09/2026 — juiz cego e portão dispensados pelo usuário

Pedido dele: "pule o juiz cego e o portão, como eu vou estar checando o funcionamento, não é
necessário uso deles." Os quatro gauntlets foram parados no meio; o trabalho dos construtores já
estava escrito em disco e foi preservado. Mantive apenas um `tsc --noEmit` por árvore, rodado por
mim, para não entregar uma tela que nem sobe — exit 0 nas quatro.

NÃO foram rodados, e portanto NÃO há prova de: vitest, bateria e2e de regressão, jornadas das peças,
juízo cego por dois critics, passeio de usuário. O que existe é código que compila e sobe.


## Feito em 17/09/2026 — branch `feat/consolidado-17set` (sem push)

Aprovado pelo usuário no exe ("gostei da maioria das features"). Commits `90a8778`, `a503d06`,
`252244f`, `928b7d6`, consolidados em `29b77a4`. Provado só por `tsc --noEmit` (exit 0) — vitest,
e2e, jornadas e juízo cego foram dispensados pelo usuário, que testou na mão.

- P1 seleção com mouse (arrastar no vazio, sem Shift)
- P3 espessura livre de parede
- P5 escada legível (sentido visível sem painel)
- P4 memória do jogador sem escadinha
- P10 entrar na casa: recusa de movimento que explica
- P6 tela de entrada do jogador (nunca abre branca; `<style>` embutido no player.html)
- 6 achados dos passeios: ferramenta Peça muda, prévia que mentia, token nascendo na parede,
  sala sem nome distinto e circular facetada, barra sem rastro, painel com título errado


## Pedido de 17/09/2026 (registro literal, com prints)

"Vamos seguir com as melhorias do programa use o gauntlet-loop, junto ao ultracode, junto workflow
para: 1. Iluminação — hoje o halo atravessa parede e o jogador nunca desenha luz nenhuma, embora ela
seja enviada a ele. Decisão já tomada: barrada por parede, mais visível, desenhada na tela do
jogador. "Mapa escuro com tocha" fica fora.
2. Token do jogador — foto no lugar do círculo azul fixo, e o jogador mudando nome e foto do próprio
token. net/protocol.ts não tem hoje nenhuma mensagem de editar token.
3. Pincel de blocos com balde, e caminhos com cor por caminho. Não existe flood fill no projeto;
FloorStyle é global e Region.fillColor é por instância — é daí que sai.
4. Sala de formato livre.
5. Mapas conectados, por último e sozinho: docs/plano-mapas-conectados.md. O host serve
6-[print do token do mestre com foto] para mim o token ta com imagem tudo certinho mas para o
jogador, ele não consegue nem colocar imagem nem ver a imagem, isso não é para acontecer, ele é para
poder colocar a imagem e coloque o token para ser assim [print de tokens redondos com moldura]
7-[print da tela] Uma ferramenta que eu gostaria que tivesse são os Pinos seria dois pinos um com
exclamação e outro com interrogação, que seriam ponto de interesse e quando o jogar clicasse na
parte lateral dele iria abrir o que seria o pino poderia abrir a imagem de uma cenári ou um item e
embaixo a descrição e tal."

### Fila desta rodada (ordem do usuário)
1. Luz: barrada por parede, mais visível, desenhada na tela do jogador.
2. Token: foto no lugar do círculo; token redondo com moldura; jogador troca nome e foto do próprio
   token (mensagem nova no protocolo); jogador VÊ a foto (hoje fogFilter zera `image`).
3. Pincel de blocos com balde + caminhos com cor por caminho.
4. Sala de formato livre.
5. Pinos de ponto de interesse (exclamação e interrogação) com imagem e descrição ao clicar.
6. Mapas conectados (por último, sozinho) — `docs/plano-mapas-conectados.md`.

### Mapas conectados — §8 do plano respondido por mim (17/09/2026)
O usuário deu autonomia total para este loop ("não precisa me perguntar"), então respondi as 4
perguntas de produto do `docs/plano-mapas-conectados.md` §8 com a recomendação do próprio plano.
Ele pode vetar qualquer uma:
1. Aventura vira **pasta com as cenas dentro**, caminho relativo (exportar e levar para outra
   máquina funciona).
2. Token que pisa no portal **passa direto**; "perguntar antes" fica como opção por portal, depois.
3. Quem ficou de fora **vê o token sumir** (o personagem entrou mesmo).
4. O editor do mestre **não segue** o jogador: aparece aviso "Fulano entrou em X" com botão "Ir lá".

### Conflito parado para você decidir (17/09/2026): grade no mapa novo
Eu tinha posto na fila um conserto que NÃO é seu pedido: a jornada
`task-jornada-ferramentas-mudas.spec.ts` cobra que o mapa recém-criado abra mostrando a grade
escolhida e o limite do mapa ("escolhi grade Quadrado, o editor abriu preto"). A auditoria mostrou
que isso BATE DE FRENTE com a invariante do minimapa Resident Evil que você aprovou, medida em
`task-portao-estilo-minimapa.spec.ts`: chão chapado, **sem grade impressa**, no mesmo caminho de
formulário. Fechar os dois ao mesmo tempo só sairia com truque (ligar a grade no clique do seletor),
o que é verde sem entregar o comportamento. Então PAREI essa peça.
Decisão sua, quando quiser: (a) mapa novo abre com grade visível e a invariante do minimapa passa a
valer só depois que houver chão desenhado; (b) mapa novo continua sem grade, e o que muda é só o
LIMITE do mapa ficar visível; (c) deixar como está.

## Pedido de 18/09/2026 (registro literal, com prints)

Prints salvos em `docs/pedidos/2026-09-18/`.

"Eu quero fazer algumas melhorias simples: 1- Eu queria poder escolher se para o jogador a parte de
cima da construção fica visivel ou não, tipo assim [Image #1] 2-Os tokens, eu queria que eu pudesse
salvar Tokens pre prontos, tipos tokens de npcs e afins para colocar para os jogadores 3-[Image #2]
A parte verde é uma Sala e a parte azul é o chão, coloquei o chão para representar o mar e a sala
para representar ilha, eu queria que desse para bloquear a parte da ilha porque no meio da sessão eu
fui clicar em um coisa e eu acabei movendo a ilha então seria legal ter o botão de bloquear
movimentação. 4-[Image #3] Sobre o pino, seria interessante poder mover ele depois de colocado,
[Image #4] e ao invés de aparece no meio da tela, aparede do lado direito e inclusive eu imagino o
jogador tendo no lado direito um pequeno lugar para ver essa coisas."

Mapa dos prints:
- Image #1 = `docs/pedidos/2026-09-18/1-teto-construcao.png` (sala "Sky Lagoon (cópia)" com o
  interior fechado, hachurado, sem deixar ver o que tem dentro)
- Image #2 = `docs/pedidos/2026-09-18/2-ilha-no-mar.png` (sala verde = ilha, chão azul = mar; a ilha
  foi movida sem querer durante a sessão)
- Image #3 = `docs/pedidos/2026-09-18/3-pino.png` (pino de exclamação, amarelo)
- Image #4 = `docs/pedidos/2026-09-18/4-painel-do-pino.png` (painel do pino abrindo no meio da tela)

### Fila desta rodada (ordem do usuário)
1. Teto de construção: o mestre escolhe se o jogador vê ou não a parte de cima da construção.
2. Biblioteca de tokens prontos: salvar tokens de NPC e afins para reusar e colocar para os
   jogadores.
3. Bloquear movimentação de item (a sala/ilha não se move mais por clique acidental) — botão de
   trava.
4. Pino: mover depois de colocado; painel do pino abre no lado direito, não no meio da tela; e o
   jogador ganha um cantinho no lado direito para ver essas coisas.

### Estado das quatro entregas (18/09/2026, noite)

Todas as quatro estão na branch `auto/acervo` (que descende de `auto/teto`), com jornada de usuário
selada no portão para cada uma:

| # | Entrega | Commit | Jornada que prova |
|---|---|---|---|
| 1 | Teto de construção | `34406f8` | `task-jornada-teto-de-construcao.spec.ts` |
| 3 | Travar Sala/Região | `0f4ac20` | `task-jornada-item-travado.spec.ts` |
| 4 | Pino arrastável + cartão na direita | `482fe5e` | `task-jornada-pino-move-e-cartao-direita.spec.ts` |
| 2 | Acervo de tokens prontos | `d805cc2` | `task-jornada-acervo-de-tokens.spec.ts` |

A entrega 2 ficou por último porque o módulo de disco (`client/src/lib/tokenLibrary.ts`) e a jornada
tinham sido escritos na rodada da tarde e nunca ligados a tela nenhuma — o que faltava era a UI e a
fiação.

**Dívida herdada medida nesta noite (não é regressão destas entregas — as duas falham igual na base,
sem as mudanças):**
- `task-jornada-ferramentas-mudas.spec.ts`: "mapa recém-criado com grade quadrada já abre mostrando a
  grade" falha porque `NEW_MAP_SHOW_GRID = false` (`client/src/lib/mapFactory.ts:30`) — decisão de
  visual posterior à jornada. Ou a decisão volta atrás, ou a jornada é reescrita; é chamada do
  usuário.
- `task-jornada-pincel-balde-caminhos.spec.ts` teste 3: "canvas sem bounding box" quando roda dentro
  do portão (passa sozinha). Instabilidade do passo `jornadas-da-bar`, pré-existente.

### Varredura da noite (18/09/2026) sobre o acervo

Relatório: `docs/varredura-2026-09-18.md`. 4 lentes + 1 refutador (modo `curta`, banca de 1 voz),
9 achados confirmados. Consertados no commit `4909d49`:

1. **Perda do acervo inteiro** (repro executado): leitura do `acervo.json` que falhasse por I/O
   virava "acervo vazio", e o salvar/apagar seguinte regravava por cima — 20 NPCs viravam 0, calados.
2. Caminho absoluto no índice: copiar a pasta do acervo para outro PC deixava a estante sem foto.
3. "Colocar no mapa" gastava dois Ctrl+Z, e o Ctrl+Z no meio da cópia matava o Refazer.
4. Token sem `name` estourava com a imagem já gravada, deixando foto órfã.

**Ficou registrado e NÃO consertado** (é chamada sua): a jornada do acervo prova a foto com uma
imagem que o próprio disco falso devolve (`convertFileSrc` do stub responde a mesma foto para
qualquer caminho com `token_`), então ela não testemunha o mapeamento item→arquivo. Os 22 testes de
unidade novos cobrem esse mapeamento; fechar o buraco na jornada pede uma jornada nova, e a atual
está selada.

## Pedido de 21/09/2026, manhã (registro literal)

"Pode continuar as fazer as features, mas eu quero que faça um coisa em especifico primeiro e deois
você volta no automatico: 1-Eu quero que você faça um pino especial que ao clicar o jogador é enviado
para outro mapa, e eu gostaria que pensasse em um forma de ter varios mapas, na mesma sessão."

### Decisões do usuário (21/09/2026, perguntadas uma a uma)

- **Modelo:** cada jogador no seu mapa — o grupo pode se separar.
- **Gatilho:** o jogador pede, o mestre aprova.
- **Chegada:** num pino par no mapa de destino; o mesmo pino leva de volta.
- **Confirmação:** o jogador confirma antes de mandar o pedido.
- **Portal antigo** (peça de cenário com "Entrar no andar"): substituir e remover; o destino dele vira
  um mapa da aventura.
- Continuam valendo as de 17/09: aventura = pasta com as cenas, caminho relativo; quem fica vê o token
  sumir; o editor do mestre não segue o jogador ("Fulano entrou em X" com **Ir lá**).

Plano aprovado: `C:\Users\gedasio.filho\.claude\plans\immutable-inventing-acorn.md`, em três entregas —
(1) aventura com várias cenas no editor; (2) pino de viagem no editor; (3) cada jogador no seu mapa,
com pedido e aprovação. Depois das três, volta a fila automática do `HANDOFF.md`.

### Andamento

| # | Entrega | Commit | Jornada que prova |
|---|---|---|---|
| 1 | Aventura com várias cenas no editor; cada cena lembra a própria câmera; portal antigo removido e migrado | `ad71dd8` + `21f783f` | `task-jornada-varias-cenas.spec.ts` (3 passed), `jornadas-e2e` e `jornadas-da-bar` VERDES |
| 2 | Pino de viagem no editor: tipo 'viagem', ícone de passagem, "Leva a…" com pino de chegada criado na outra cena, mão dupla, clique leva a visão do mestre; destino nunca sai para o jogador | `9905eb4` | `task-jornada-pino-de-viagem.spec.ts` (5 passed), vizinhas `varias-cenas` (3), `pinos-ponto-de-interesse` (4), `marcador-com-icone` (2) e `jornadas-e2e` VERDES |
| 3 | Cada jogador no seu mapa: "Pedir para passar" → confirmação → aviso do mestre com "Deixar ir"/"Não" → "Você chegou"; quem fica vê a ficha sumir; memória de exploração por jogador e cena (teto 8); "X entrou em C" com "Ir lá"; painel Jogo diz a cena de cada um | `1aadbfa` (com `7d30053`) | `task-jornada-viagem-do-jogador.spec.ts` (6 passed), `entrada-jogador` (5), `pino-de-viagem` (5), `varias-cenas` (3), `jornadas-e2e` VERDE; revisão de segurança com 4 achados, todos corrigidos com teste e mutação |

Entrega 1, não verificado ainda: abrir no exe desktop, salvar, fechar, reabrir e conferir `adventure.json`
e `scenes/<id>/map.json` no disco. "Exportar pasta" continua exportando só a cena aberta.

Entrega 2: `jornadas-da-bar` saiu VERMELHA com um teste de `task-jornada-pincel-balde-caminhos.spec.ts`
(o 3 ou o 4) estourando 30 s na foto da tela. Não é da entrega: a mesma regressão, rodada em seguida
no commit de antes dela (`d7ab205`), falhou igual (teste 3, 50 s), e o spec sozinho passa 4 de 4 (35 s).
É instabilidade por carga, com outro Playwright rodando na máquina.

Entrega 3: `jornadas-da-bar` com o mesmo teste 3 do balde estourando o tempo (44,8 s), com outro builder
rodando Playwright ao mesmo tempo; o resto verde. Fora do escopo, anotado para a fila: no painel Jogo,
"Remover <ficha>" mostra o id quando a ficha está numa cena de fundo (a lista vem só da cena aberta).

Não verificado ainda: atravessar com um jogador de verdade no desktop, em LAN.

## Pedido de 21/09/2026, noite (registro literal, com print)

> "Sabe um feature que eu gostaria que você adicionasse agora ? [print de uma sala livre selecionada,
> "Sky Lagoon (cópia)"] a capacidade de rotacionar, eu queria poder rotacionar isso"

### Decisões do usuário (21/09/2026, noite)

| tema | decisão |
|---|---|
| gesto | alça no mapa (bolinha acima da sala selecionada) + campo "Rotação" no painel com −90°/+90° |
| ângulo | livre; Shift trava de 15 em 15° |
| o que gira | igual ao arrastar: sala, sub-salas, paredes e portas; o conteúdo fica |
| alcance | só salas (retangular, livre, circular, polígono) |

Plano aprovado em `~/.claude/plans/immutable-inventing-acorn.md` (seção "Girar sala"). Régua:
`client/e2e/task-jornada-girar-sala.spec.ts` (em escrita). Roda em paralelo com a Entrega 3 do pino.

## Pedido de 22/09/2026, madrugada (registro literal)

> "Eu quero que você continue o modo automatico mas quero que leve em consideração features de um certo
> tipo de natureza agora, veja bem, eu vou ter sempre por volta de 4 a 7 jogadores, eu preciso de uma
> forma facil de pode adiministrar os tokens desses jogadores ambos estando em mapas diferentes entende?
> você fez o pino e tal que muda de lugar ,mas e se um jogador for para um lugar e outro for para outro
> lugar, pensando nisso comece a fazer features para ajudar nisso, como novas formas de pino e tal, mas
> usando  o modo automatico pois vou dormi."

### Fila "grupo espalhado" (decidida por mim no modo automático; revisável de manhã)

O usuário dormiu, então as decisões abaixo são minhas, tomadas pelo padrão já aprovado nas entregas
do pino (o jogador nunca recebe nome de outra cena; o editor do mestre não segue ninguém sozinho).
Uma feature por vez, cada uma com régua vermelha antes da obra.

| # | feature | o que o mestre ganha |
|---|---|---|
| G1 | **Painel do grupo** na aba Jogo: uma linha por jogador com a cor da ficha, nome, online/fora, em que cena está e se tem pedido esperando; **Ir lá** (abre a cena e centra na ficha) e **Mandar para…** (escolhe cena e pino de chegada; a ficha vai sem pedido) | ver e mover os 4-7 jogadores de um lugar só |
| G2 | **Modos do pino de viagem**: "Pede ao mestre" (padrão de hoje), "Passagem livre" (o jogador passa direto, o mestre só é avisado) e "Trancada" (o jogador lê que está trancada) | menos avisos para aprovar; portas que ainda não abrem |
| G3 | **Cenas com gente**: na lista Cenas, cada cena mostra as bolinhas dos jogadores que estão nela e um selo quando há pedido esperando ali | bater o olho e saber onde está todo mundo |
| G4 | **Caixa de pedidos**: com 2 ou mais pedidos ao mesmo tempo, os avisos viram uma caixa só, "Pedidos (3)", com Deixar ir / Não por linha e "Deixar todos" | 7 jogadores pedindo não soterram a tela |
| G5 | **Reunir o grupo aqui**: num pino, o mestre traz as fichas escolhidas de qualquer cena para casas livres em volta dele | juntar o grupo de novo depois que se separou |
| G6 | **Chamado de cena de fundo**: o sinal de um jogador numa cena que não está aberta chega ao mestre como aviso "Ana chamou na Cripta" com **Ir lá** | não perder quem pede atenção longe |

### Goal novo (22/09/2026, madrugada): "cria 15 features levando em consideração um ambiente com 4 - 7 jogadores cada uma querendo ir para um lugar, além disso resolver todos os bugs."

A fila G1-G6 acima cresce para 15 (G7-G15 também decididas por mim, revisáveis):

| # | feature | o que o mestre (ou o jogador) ganha |
|---|---|---|
| G7 | **Seguir jogador**: a câmera do mestre acompanha a ficha de um jogador, inclusive trocando de cena quando ele viaja; desliga ao mexer no mapa | acompanhar quem está explorando sozinho |
| G8 | **Encruzilhada**: um pino de viagem com vários destinos; o jogador escolhe pela descrição de cada saída ("Porta da esquerda", "Escada") | um lugar com várias saídas sem vários pinos empilhados |
| G9 | **Ponto de chegada oculto (mão única)**: pino que só recebe quem chega, invisível ao jogador e sem volta | queda em alçapão, teleporte, passagem que fecha atrás |
| G10 | **Viajar junto**: no aviso do pedido, "Deixar ir com quem está perto" leva também as fichas a até 2 casas | o grupo que anda junto atravessa num clique |
| G11 | **Recado por cena**: o mestre escreve uma narração que aparece só para os jogadores de uma cena | narrar para um grupo sem o outro ler |
| G12 | **Pausa por cena**: o mestre congela o movimento dos jogadores de uma cena, que leem "O mestre está com o outro grupo" | atender um grupo de cada vez |
| G13 | **Companheiros na tela do jogador**: lista do grupo com "aqui" / "em outro lugar" e online/fora, sem nome de cena | o jogador sabe que o amigo não sumiu, só está longe |
| G14 | **Visão geral das cenas**: miniaturas de todas as cenas com as fichas em cima; clicar abre a cena | o mapa da mesa inteira de uma vez |
| G15 | **Diário de viagens**: no painel Jogo, "22:10 Ana: Salão → Cripta", com **Desfazer** na última viagem de cada jogador | saber quem foi para onde e corrigir engano |

Defeitos: a lista B do `HANDOFF.md` (8), o teste do balde que estoura o tempo sob carga, e "Remover <ficha>"
mostrando o id da ficha em cena de fundo. Vão entrando entre as features, cada um com teste que falha antes.

### Andamento (22/09/2026, madrugada)

| entrega | commit | prova |
|---|---|---|
| Girar sala (alça + campo Rotação, Shift 15°) | `28177f4` | `task-jornada-girar-sala.spec.ts` 7 passed; `sala-livre`, `viagem-do-jogador`, `jornadas-e2e` VERDES no commit juntado; fluidez da alça: longtask 52 ms, frame p95 33,5 ms |
| Medir na tela do jogador | `ee664e0` | `task-jornada-medir-na-tela-do-jogador.spec.ts` 6 passed; `entrada-jogador` VERDE no commit juntado |
| Defeito B8: dica "Sala livre ()" | `87d89b0` | teste de unidade vermelho antes ("Sala livre ()", "Caminho ()"), verde depois |
| Cache do vite por porta (causa provável dos timeouts entre worktrees) | `b02b8f4` | — |

Girar sala, deixado de fora e anotado: ±90° numa sala cujos lados têm paridades diferentes em quadrados
deixa a sala meio quadrado fora da grade (efeito do pivô no centro); sala travada ainda mostra chips de canto.
Defeito B2 ("clique no menu atravessa") não reproduziu em 10 de 11 menus, com clique real e pixel antes/depois.

### Andamento do grupo espalhado e dos defeitos (22/09/2026, madrugada)

| entrega | commit | prova no commit juntado |
|---|---|---|
| G2 — passagem do pino: pede / livre / trancada | `6d1a4ea` | `modos-do-pino` 5, `viagem-do-jogador` 6, `pinos-ponto-de-interesse` 4 — VERDES |
| G1 — painel do grupo (Ir lá, Mandar para…) + nome da cena nunca vai ao jogador + "Remover" com nome de ficha de cena de fundo | `ef8ba5d` | `painel-do-grupo` 5, `modos-do-pino` 5 — VERDES |
| Defeitos: Subtrair com Pincel de blocos; borracha avisa sobre chão | `d96cf5b` | `subtrair-abre-buraco` 4, `borracha-diz-o-que-nao-apaga` 3 — VERDES |
| Defeitos: salvar fora do app explica; corredor aberto não some; atalho com foco no painel (+ `?` troca o tipo do pino); acervo diz que guarda ficha com foto e aceita arrastar ao mapa | `00a3cf8` | as 4 réguas VERDES |

Decisões do builder da G2 para o usuário revisar: o véu do cartão do jogador deixou de bloquear o mapa
(tocar num botão do painel fecha o cartão e aciona o botão; a roda fora do cartão dá zoom); a passagem
livre tem uma batida de 450 ms com "Passando…" antes de trocar a cena.

### Andamento do grupo espalhado (22/09/2026, manhã)

| feature | commit juntado | prova no commit juntado |
|---|---|---|
| G3 — lista Cenas com quem está em cada cena e selo de pedido | `c7f6da9` | `cenas-com-gente` 5 — VERDE |
| G6 — chamado de cena de fundo ("X chamou em C" + Ir lá); sinal de fundo deixou de ser desenhado no lugar errado | `037c2f3` | `chamado-de-fundo` 5 — VERDE (em `d32fbf1` e `0f22d79`) |
| G7 — seguir jogador | `0f22d79` | `seguir-jogador` 5, `chamado-de-fundo` 5 — VERDES |
| G8 — encruzilhada (várias saídas nomeadas) + revisão de segurança (teto de 11 saídas extras; pino do jogador montado por lista do que vai) | `ca26a31` + `40a3aea` | `encruzilhada` 5, `modos-do-pino` 5, `seguir-jogador` 5, `pinos-ponto-de-interesse` 4, `marcador-com-icone` 2 — VERDES |
| G4 — caixa de pedidos | `fe9c7d4` | VERMELHA nos casos 3 e 4 no commit juntado; em conserto |
| G5 — reunir o grupo | `ce26606` | VERMELHA nos casos 3 e 4 no commit juntado (mesma causa provável do "Mandar para…"); em conserto |

Consertos de régua feitos pelo orquestrador: caixa de pedidos (filtro `has` ancorado na caixa nunca
casava), seguir jogador (controle andava 6 casas e ficava perto do centro desde que o "Ir lá" centra na
área livre). Consertos de teste: teto próprio para o teste de 300 vértices do SDF (estourava 5 s sob carga).

## Pedido de 22/09/2026, noite (registro literal)

> "Eu quero que você use o gauntlet-loop, para andar pelo programa e descubra novas features e bug, você
> vai usar o passeio para descobrir bugs e features, além disso coloque vários workflows só para
> trabalhar nas features que estão no handoff. Estamos em uma conta 20x, então vá o mais rápido possível
> junto com o máximo de paralelismo, precisa durar a noite inteira, então ligue o modo automático, além
> disso coloque em loop e siga o goal. Coloca um workflow só para resolver os problemas do handoff. Você
> pode analisar tudo mas eu quero que você faça umas simulações de jogo, imagine 7 jogadores jogando, cada
> um com token, e tem jogar com eles, em vários cenários em várias cidades diferentes, querendo andar em
> casa, e dentro das casas tentando andar pelos cômodos e tentando entrar nos quartos e no quarto saber o
> que tem no quarto, é só um exemplo, mas faça features disso, faça as possibilidades."

Goal novo (22/09/2026, noite): **"melhorar o programa no geral, adicionar 50 features, resolver todos os
bugs, refinar o programa no máximo."**

### Lanes da noite (decididas por mim no automático)

| lane | o que faz | onde |
|---|---|---|
| passeio | gauntlet canônico com passeio contínuo (mestre + jogador), modo autônomo: achado vira peça | `C:/dev/labirinto-lane-passeio` |
| simulação | 7 jogadores com ficha em várias cidades, casas, cômodos e quartos: o que tentam, o que o app faz, o que falta → fila de features | workflow de análise, sem escrever no repo |
| G10 / G12 / G13 / G14 | uma lane de gauntlet por feature do grupo espalhado que ficou aberta | worktree de cada uma |
| defeitos do HANDOFF | gauntlet sem GUI sobre a lista C + varredura curta de `net`, `player`, `pinTravel`, `adventureStore` | `C:/dev/labirinto-lane-defeitos` |

Conta 20x: o teto de 4 agentes simultâneos (17/09) está revogado para esta noite; o limite real é a CPU da
máquina (Playwright sob carga estoura tempo).

## Pedido de 22/09/2026, noite, 2º (registro literal, com imagem)

Imagem: `docs/pedidos/2026-09-22-cidade-vertical.png` (cidade-torre vertical: esgoto e canos embaixo,
casas com janelas acesas, baterias de canhão, escadarias e templo, muralha com arcos, cúpula com dois
canhões, fábricas e canos, torre administrativa e o pico).

> "veja essa imagem, isso deve dar mais de 11 andares ou até mais, eu quero que você em um workflow
> separado imagine como eu faria isso no programa, não estou falando dos gráficos, mas imagine 7
> jogadores cada um em um andar, e cada andar tendo milhares de locais para ir? Imagine salas de todos
> os tipos, caminho de todos os tipos, objetos de todos os tipos e features que eu nem consigo imaginar.
> Então nesse workflow separado, crie esses 11 andares e coloque sete tokens jogando e você como mestre
> imagine cada token fazendo ações diferentes e você vai enriquecer mais e mais e mais"

Lane própria: `torre-11-andares` (worktree `C:/dev/labirinto-torre`, branch `auto/torre-11-andares`).
Gera de verdade uma aventura de 11+ andares no formato do app, abre no app, mede, põe 7 fichas em 7
andares e joga em rodadas com o mestre; cada rodada enriquece o mundo e vira feature/defeito.

### Simulação de 7 jogadores (22/09/2026, noite) — resultado

10 mesas simuladas (8 cenários lidos no código + 2 jogadas de verdade no app com 7 páginas de jogador):
vila com casas e quartos, mansão de dois andares, cidade portuária, capital com distritos, viagem entre
cidades, invasão de castelo, investigação numa hospedaria e sessão longa com quedas. 159 achados brutos
viraram **70 itens** (9 descartados por já existirem) + **15 faltantes** apontados pelo crítico.
Lista completa, com objetivo, aceite e arquivos por item: `docs/backlog-simulacao-7-jogadores-2026-09-22.md`.
Os 37 itens de prioridade 5 e 4 estão virando réguas vermelhas (`auto/reguas-lote-a`) e depois lanes de
gauntlet.

### Resultado da noite de 22-23/09/2026 (parada às 09h a pedido do usuário, por CPU)

Nenhuma feature nova ficou pronta no app. Ficaram prontos o portão com vagas, 17 réguas vermelhas juntadas
(+ 8 numa branch), a lista de 101 features, 10 defeitos confirmados e a cidade-torre de 12 andares gerada
(99 cenas, 25.805 locais). Tudo, workflow por workflow, está em `HANDOFF.md`.

### 23/09/2026, tarde — pedidos durante a fábrica de features

> "Pronto, agora você fará o seguinte em paralelo, você vai fazer todas essas features de uma vez, ou
> seja vai colocar em paralelo vários workflows contudo uma coisa que eu tô percebendo é o chrome sem
> tela, que tá destruindo a minha CPU, então se tiver outra forma que não gaste extremamente a minha cpu e
> minha memória ram. E volte o workflow dos 11 andares de onde parou."

> "Então você vai adicionar no programa essas 244 sugestões?" — resposta à pergunta de escopo (tirar as
> repetidas; grandes por último?): **"Tudo, faça em paralelo igual as outras."**

Fila: quando a etapa Consolidar da torre (`wf_c998d8d5-b3c`) entregar o backlog único, cada item
(defeitos, features pequenas e médias e também as grandes: estados da torre, relógio com rotina de NPC,
veículos, corte vertical, correio) vira peça da fábrica em workflows paralelos, como as ondas 1 e 2.

### 23/09/2026, noite — "vou dormir 8 horas"

> "Agora uma coisa, eu vou dormir agora, eu queria acordar com todas ou pelo quase todas essas features
> feitas, eu conto com você, você está numa conta 20x, então gerencie para que dure sem quebrar o limite;
> se quebrar espera o limite voltar e continue e veja, você tem 8 horas, eu vou dormir e acordo em 8
> horas, e eu realmente queria que tivesse commits e tal, no caso não quero que perca progresso, que vá
> adicionando o mais rápido possível, conto com você."

Plano da noite: ondas 2 e 3 da fábrica seguem (283 itens únicos em `docs/features-unicas-2026-09-24.md`);
a junção valida cada grupo e o orquestrador junta em `auto/acervo` a cada passada verde; se o limite de
uso estourar, espera voltar e retoma os workflows do cache (`resumeFromRunId`).

### 24/09/2026, 11h20 — velocidade e as grandes até as 16h

> "Vou precisar ser sincero com você, preciso que aumente o nível de velocidade, tem uma onda que só vai vir
> as features grandes né? faz logo ela, eu quero até as 16:00 elas finalizadas. Mas em paralelo é claro."
> "mas não pare as que estão sendo feitas"

Feito: as 5 grandes que ainda não tinham começado (cabine, correio, rotina de NPC, perigo que alastra, móveis)
foram para um run paralelo, as 5 ao mesmo tempo (`wf_d1c06cc2-0db`, `auto/int-t-grandes-b`); a segunda metade
das listas de defeitos, médias A/B e pequenas da onda 3 ganhou runs paralelos `-b`. Nada em construção parou:
um vigia só para o run antigo quando ele chega na primeira peça que foi para o `-b`.

### 24/09/2026, 14h00 — abrir o programa para testar

> "Pode abrir o programa com as atuais mudanças? só para eu testar? sem atrabalhar os workflows é claro."

Feito: cópia separada `C:/dev/labirinto-ver` (worktree solta em `03cc777`, o último estado provado da 2ª
passada da junção: `auto/acervo` + os grupos jogador e editor), aberta com `npm run tauri:dev` na porta 1420
(`LAB_PORTA=1420`, Rust reaproveitado do `target` da árvore principal). Os workflows não usam essa pasta. As
grandes ainda não estão nela: entram quando a junção só das grandes (`wf_e1417c8d-d57`) sair verde.

### 24/09/2026, 15h10 — link público fica carregando

> "Cria um workflow rápido para resolver isso, link publico fican infinitamente carrendo e não abre."

Em andamento: workflow `wf_933d952b-cd2`. Dois diagnósticos em paralelo (um reproduz ao vivo por um túnel
próprio do cloudflared contra a sala aberta em `C:/dev/labirinto-ver`, outro rastreia o caminho no código),
depois conserto com teste vermelho numa branch `auto/f2-link-publico` saída de `03cc777` e prova
independente (cargo test, clippy, tipos, unidade). Verde ⇒ a cópia de teste passa para o commit do conserto.

### 24/09/2026, 15h30 — abrir já com todas as grandes

> "Ok, então abre o programa agora com todas as features novas, e a que não entrou no programa faça entrar
> logo nessa abertura do programa."

Em andamento: prévia de teste em `C:/dev/labirinto-previa` (branch `auto/previa-grandes`, saiu de `e443364` =
acervo + jogador + editor + mundo provados), com merge de `9b818e0` (4 grandes provadas), `auto/int-t-grandes-b`
(cabine, correio, rotina do NPC, perigo que alastra, mobília) e `auto/f2-pisos-na-mesma-cena` (ainda em
revisão). Workflow `wf_4df0cddf-2ac`. Tipos verdes ⇒ o app de teste reabre dessa árvore. A prévia não vai para
`auto/acervo`: as grandes entram no programa oficial pela junção `wf_e1417c8d-d57`.

### 24/09/2026, 18h00 — juntar as grandes e publicar de 10 em 10

> "Uma coisa sobre junto a branch e ao programa principal eu quero que você já vá juntando todas as features
> grande ao programa principal e a cada 10 e 10 features vocÊ coloque no programa principal, fazendo commits,
> testes e o push"

Autorização explícita de push. "Programa principal" = branch `main` do GitHub (`GedasioSaga/labirinto-vtt`),
que é ancestral de `auto/acervo` (avança por fast-forward, sem force). Plano: publicar já os 4 grupos provados
da 2ª passada (`auto/juntar` `d37de87`: jogador, editor, mundo, rede); depois, em duas pistas paralelas, as
grandes (`auto/juntar-grandes` + correio-2) e os grupos restantes um a um (visão, defeitos, t-*), cada unidade
com merge, tipos, unidade e prova, e publicação serial: `auto/acervo` absorvido na pista, merge `--no-ff` em
`auto/acervo`, fast-forward de `main` e `git push origin main`. Nunca force-push.


### 24/09/2026, 18h40 — publicar o feito + grandes, criar o instalador, depois seguir de 10 em 10

> "Pronto o que eu quero é que vocÊ coloque a features já feitas mas as features grandes, faça o push e essa
> versão você cria o instalador, e então volta a fazer as outras, commitando e fazendo push de 10 em 10
> features adicionadas, e a cada 10 começasse a intregar no programa."

Plano: `wf_ef4eb784-1f6` publica em `main` os grupos já feitos (jogador, editor, mundo, rede, visão, defeitos,
t-*) e as grandes, cada unidade com testes e push. Quando terminar: versão nova, `npm run tauri build`,
instalador `.exe` e `.msi` como tag + GitHub Release (mesmo formato da v0.1.0). Depois: retomar a onda 3 (pausada)
com runs novos só das peças que faltam, publicando em `main` a cada 10 features integradas. A prévia de teste
(`wf_4d2b1c13-1d8`) foi parada: a versão publicada já leva as grandes.

### 24/09/2026, 18h50 — conserto do link público no programa principal

> "pronto, então já coloca no programa principal junto ao instalador"

Feito: `auto/f2-link-publico` (`c76b664`, provado: cargo test, clippy, tipos e unidade verdes) entra em
`auto/acervo` agora, antes do push e do instalador. Defeito só do modo dev (o `dev_fallback` do servidor da sala
recusava pelo túnel os módulos que a página do jogador pede); o release serve a página embutida.

### 25/09/2026, 00h10 — noite automática, push a cada 10 features

> "Tá então depois de publicar essa versão e fazer o instalador, volte ao automatico de features, fazendo cos
> concertos, ideias da torre e o que tiver para fazer, eu vou dormir agora, lembre-se de dar commit e push no
> programa a cada 10 features novas feitas, ou seja cada 10 você adiciona eles no programa, e depois continua
> com mais 10, pelo menos eu vou ter evoluções constantes. Lembre-se usar paralelismo e tudo mais."

Plano: (1) terminar a publicação dos grupos prontos (`wf_3c4bb722-2b5`, um push por grupo); (2) instalador 0.3.0
dessa versão (tag + Release, como a 0.2.0); (3) fábrica contínua numa branch única `auto/int-noite` que sai de
`auto/acervo`: consertos pendentes (visão e ideias da torre), pisos na mesma cena e as peças da onda 3 que
faltam, 3 peças em paralelo (mais que isso trava a fila do modelo, medido em 24/09); a cada 10 peças integradas,
merge em `auto/acervo`, testes, checagem de segredo e push em `main`.

### 25/09/2026, 08h40 — tudo em Opus

> "Porque está fazendo em sonnet? eu quero que faça em OPUS"

Feito na hora: os três scripts dos workflows (`fabrica-v3.js`, `publicar-grupos.js`) trocaram `model: 'sonnet'` por
`model: 'opus'` nas etapas de prova, integração, junção e publicação (construtor, revisor e debugador já eram Opus
pelo agent). Os três runs foram parados e relançados em Opus: publicação de visão + defeitos (`wf_b6ab019e-855`),
junção dos grupos t-* (`wf_6f9b4b28-6a5`) e a fábrica com as 11 peças prontas (`wf_c2bcab30-9ea`). Regra que vale
daqui para frente: nenhuma etapa em Sonnet; Fable continua proibido.

### 25/09/2026, 13h50 — publicar já e fazer o instalador

> "Publica logo e faz o instalador."

Feito: fábrica parada; `wf_e57da219-37b` publica as 10 peças de `auto/int-noite` em `main` (trava, testes, segredo,
push) e gera a 0.3.0 (versão, `tauri:build`, tag `v0.3.0`, Release com `.exe` e `.msi`). As 3 peças perdidas na
queda de internet (escolher fichas no pino, zoom da roda, troca de cena rápida) voltam na próxima fábrica.

### 25/09/2026, 14h00 — versão 0.3.1: aba Jogo espremida

> "Eu quero que voÊ faça só um ajuste criando a versão 0.3.1 só para ajustar em downloads, existe a o foto captira
> de tela 2026-09-2025 135346.png, que é uma foto da aba jogo onde está tudo espremido, eu quero que vocÊ ajeita
> ui/ux dessa parte rápido e deixe mais bonito e jogavel."

Foto: `Downloads/Captura de tela 2026-09-25 135346.png` (painel lateral do mestre, aba Jogo: linha do jogador
cortada, botões amontoados, rolagem horizontal). `wf_8cc61d20-52f`: designer-opus redesenha só layout e estilo
(nomes acessíveis intactos), fotos antes x depois em 340 e 400 px, 2 juízes cegos com ordem invertida, e depois da
0.3.0 publica a 0.3.1 com instalador.

Resultado (25/09, 14h40): 10 features em `main` (`4cc5042`) e a 0.3.0 publicada: https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.3.0
(`Labirinto_0.3.0_x64-setup.exe` e `Labirinto_0.3.0_x64_en-US.msi`, state uploaded; tag em `76b6a3a`).

### 25/09/2026, 22h35 — publicar o que já está feito, depois fábrica de 2 em 2 com analista de UX/UI

> "O que vocÊ vai fazer é o seguinte, você vai rapidamente adicionar essas features já feitas no programa principal,
> vai dar push e vai criar o instalador e depois disso, você vai fazer o seguinte, de 2 features em duas features você
> vai adicionando no programa principalm não precisamos mais de pressa ou seja você vai fazer o seguinte, em um workflow
> você vai trabalhar de 2 em 2 features, acho que está em handoff ou em pedidos.md não sei, mas comece pelo mais
> complexos e depois de terminar todos os complexos vá para os faceis, mas sempre trabalhe só em 2 features ao mesmo
> tempo, toda vez que você adicionar 4 features você da um push e gera um instalador, você vai passando de versão em
> versão, 0.4.1, 0.4.2 e assim por diante, e junto as essas duas features eu quero um analista de ux/ui, porque veja, o
> painel de controle geral de criar mapas ele é bom porém da para melhorar tudo em si, é muito opção para rolar e tal e
> eu acho que da para melhora, use o gauntle-loop e procure um referencia forte."

Fila:
1. Terminar a junção em `auto/juntar` (merge de `auto/int-t-pequenas-b` pela metade), juntar com `main`, provar,
   push e instalador **0.4.0** (autorizado neste pedido).
2. Fábrica de 2 em 2 (complexas primeiro, depois fáceis), sempre 2 peças ao mesmo tempo; a cada 4 integradas:
   push + instalador 0.4.1, 0.4.2, ...
3. Em paralelo às 2 peças: analista de UX/UI do painel lateral de criar mapas (muita rolagem, opções demais),
   gauntlet com referência forte nomeada.

### 25/09/2026, 22h50 — modo automático, simular conta 5x

> "Ligue o modo automatico e leve em consideração que eu quero que você simule está em uma conta 5x, então use o só o
> Opus5.5 a vontade, porém só 2 a 3 subagentes simutaneos, boa sorte."

Regra: só Opus; no máximo 3 agentes ao mesmo tempo no total (fábrica com trava global de 3 vagas: 2 peças + 1 lane
de UX/UI; integração e publicação esperam vaga).

### 26/09/2026, 07h20 — tela branca na 0.4.0

> "erro critico, resolve isso a versão 0.4.0 veio bugada, resolve rápido e faz o instalador da 0.4.1 com esse fix."

Feito: causa `ReferenceError: Cannot access 'Ye' before initialization` no bundle de produção (ciclo de imports:
`fogFilter.ts` calculava constante de topo com `REVEAL_BRUSH_CELL` de `concealBrush.ts`). A constante foi para o
módulo folha `client/src/lib/revealBrushCell.ts` (`d2b841f`^). 0.4.1 publicada com teste de fumaça do build
(verde; com o código da 0.4.0 fica VERMELHO com o mesmo erro). A fábrica passa a numerar a partir de 0.4.2 e roda
a fumaça antes de cada instalador.

### 26/09/2026, manhã — mais devagar

> "vá mais lento, você está gastando muitos tokens, ao invés de 2 features e um ux/ui, bote 1 feature e um ux/ui, e fique checando o limite da sessão atual."

Fábrica retomada com 1 feature por vez + a lane de UX/UI (no máximo 2 agentes ao mesmo tempo); limite da sessão
checado com `npx ccusage@latest blocks --active`.
