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

