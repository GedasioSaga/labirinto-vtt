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

### 26/09/2026, 12h35 — passar rente à quina e congelar fichas

> "Uma coisa, eu quero que vocÊ adcione uma feature especial para os jogadores, veja, para eles passarem uma quina,
> eles tem que fazer isso aqui [Image #1], e bom, eu gostaria que desse para eles fazerem tipo isso [Image #2], eu
> gostaria poder congelar os tokens do jogadores."

Imagem 1: a ficha contorna a quina em "L" (anda reto, depois vira). Imagem 2: a ficha passa na diagonal raspando a
ponta da parede. Causa: `client/src/lib/collision.ts` conta encostar na ponta do segmento como colisão.

Fila (logo depois de `modo-por-saida`, antes de `zona-oculta-sem-buraco-3` e `parede-parcial`):
1. `passar-rente-a-quina`: movimento que só toca a ponta livre de uma parede passa; continua bloqueado atravessar
   a emenda de duas paredes que se encontram no mesmo ponto (canto de sala) e passar por porta fechada.
2. `congelar-ficha`: o mestre congela/descongela a ficha de um jogador (e todas de uma vez); o servidor da sala
   recusa movimento de ficha congelada; o jogador vê que está congelado; o mestre ainda move a ficha.

> "coloca as duas novas na 0.4.3 também"

A 0.4.3 espera `modo-por-saida`, `passar-rente-a-quina` e `congelar-ficha` (lote de 6 features desde a 0.4.2).

### 26/09/2026, 12h50 — inventário do jogador estilo Resident Evil 3

> "Sabe o que seria legal tambem: 1- No UX/UI, na parte de jogador ele ter acesso a um inventario estilo esse:?
> [Image #3], do lado direito ficaria os itens que ele tem, no esquerdo a foto dele, em uma parte ficaria condição
> dele, se ele ta bem ou mal."

Imagem: tela de itens do RE3 (retrato da Jill no canto, faixa "Condition: Caution" com eletrocardiograma, arma
equipada, grade de itens à direita com quantidade, item grande no centro com descrição e pergunta Sim/Não).
Existe hoje: `mochila` (itens da ficha), moedas (troca-de-itens) e vida (`vida.atual/max`, que pode ficar escondida
do jogador). Fila: `inventario-estilo-re` depois de `congelar-ficha`, fora da 0.4.3.

> "Pode ser só na versaão 0.4.4, sem pressa."

`inventario-estilo-re` fica para a 0.4.4 (a fábrica publica o resto da fila no fim do run).

### 27/09/2026, madrugada — acervo em pastas e rotina de NPC fluida (0.4.4)

> "Uma feature que eu quero na 0.4.4: [Image #1] Nessa parte de Tokens, quero que de para ajeitar os tokens em Npcs,
> Veiculos, Jogadores e qualquer outra categoria em pastas, assim fica mais facil, eu gostaria tambem que desse mais uma
> refinada no sistema de rotina no npc que eu tenho que apertar para o npc se mexer, eu imagino uma macro sabe? algo bem
> fluido ao invés para o jogador parecer que o token ta teleportando."

Imagem: seção "ACERVO DE TOKENS" do painel do mestre, lista longa de cartões (Cervo, Vagn, Ryoko, Cavaleiro sem
Al..., Devorador de Al..., Aira, Polvora, Leo, Jimboy, Dorian...), cada um com foto redonda e "×".

Fila da 0.4.4 (depois de `inventario-estilo-re`):
1. `acervo-em-pastas`: o mestre organiza o acervo de tokens em pastas (NPCs, Veículos, Jogadores e pastas que ele
   mesmo cria); mover token entre pastas, recolher pasta, pasta persiste com o acervo.
2. `rotina-npc-fluida`: a rotina do NPC vira uma "macro" que roda sozinha (sem o mestre apertar a cada passo) e o
   jogador vê o token deslizar pelo caminho, sem teleporte.
Depois: `zona-oculta-sem-buraco-3`, `parede-parcial`.

### 27/09/2026, madrugada — lista de Cenas ilegível

> "[Image #2] da para melohrar essa ux e ui ? não consigo ler nada ?"

Imagem: seção CENAS do painel, nomes cortados em "S...", "Bar...", "Cav...", "C..." porque a contagem de tokens e os
botões (lápis, seta, quadrado, "...") comem a largura e o recuo das subcenas come mais; botões "+ Nova cena", "Visão
geral", "Corte da torre" quebram em 2-3 linhas. Vira a próxima peça de UX: `cenas-legiveis` (antes da moldura).

### 27/09/2026, madrugada — mais devagar

> "Ta indo muito rápido, precisar ser mais lento, vai com mais calma"

Ritmo novo: 1 agente por vez (não 2). Termina o que está rodando (conserto do inventário, peça cenas-legiveis) sem
disparar nada novo em paralelo; cada item passa pelo usuário antes do próximo começar.

### 27/09/2026, fim da tarde — botão "Espiar pela porta" gigante

> "[Image #4] Espiar pela porta? quando eu coloque iessa porta eu não vi nenhuma opção de poder espiar pela porta e porque quando o jogador se aproxima fica tão... grande?"

Imagem: tela do jogador com um cartão escuro alto e vazio, só "Espiar pela porta" no topo. Causa: o botão
(`PeekDoorButton.tsx`) e o quadro da espiada (`PlayerPeek.tsx`) usavam a mesma classe `.pp-peek`; a regra do quadro
(`top: 12px`, `width: 300px`, coluna) somava com a do botão (`bottom: 112px`) e esticava o botão numa placa de
300x720 px sobre o mapa. Conserto já feito no design do jogador da 0.4.4 (`e3648446`, classe própria `.pp-espiar`).
Sobre a opção: espiar não tem liga/desliga do mestre; qualquer porta fechada (trancada também) pode ser espiada
quando a ficha do jogador encosta nela. Se o mestre quiser escolher porta por porta, vira pedido novo.

### 27/09/2026, fim da tarde — gaveta "Painel" do jogador cortada

> "[Image #5] Tem que melhorar isso aqui tambem viu."

Imagem: gaveta do jogador aberta (abas Painel, Minha ficha, Inventário). A gaveta (~275 px) é mais estreita que a
fileira de abas (~355 px); os campos Nome, Foto ("Nenhum ... escolhido"), Por quem e Onde passam da borda direita
e ficam cortados. Entra no design do jogador da 0.4.4 (`ux-hud-jogador`).

### 27/09/2026, fim da tarde — cartão do pino do jogador estranho

> "[Image #6] ux/ui disso ta estranho."

Imagem: cartão do pino no jogador: ícone de porta sozinho no topo, "O mestre ainda não escreveu nada sobre este
ponto.", "Pedir para passar" (pílula latão, largura cheia), "Barrar a passagem" (pílula de contorno que passa da borda
esquerda do cartão e não alinha com a de cima), "Fechar" sozinho à direita. Causa visível: "Barrar a passagem" usa as
classes do Fechar (`pp-pincard__close pp-pincard__close--inline`, `PlayerPinCard.tsx:802`). Entra no design do
jogador da 0.4.4 (`ux-hud-jogador`), mandado ao designer.

### 27/09/2026, fim da tarde — "Passar o ferrolho" confuso

> "[Image #8] como assim passar ferrolho?"

Imagem: pílula "Passar o ferrolho" no jogador. O botão tranca, do lado da ficha, uma porta que o mestre não trancou
(o outro lado não abre); quem trancou vê o botão de desfazer. "Passar" lê como "atravessar" e "ferrolho" é palavra
rara. Vira rótulo simples sem "ferrolho" (ex.: "Trancar deste lado" / "Destrancar"), sem colidir com o "Trancada"
do mestre. Mandado ao designer do HUD do jogador (0.4.4).

### 27/09/2026, fim da tarde — mestre escolhe, porta por porta, se dá para espiar

> "pronto, eu quero que na parte do meu controle eu poça colocar a porta para ter essa opção."

Hoje espiar não tem liga/desliga: toda porta fechada (trancada também) pode ser espiada quando a ficha encosta.
Pedido: nas propriedades da porta, no painel do mestre, uma opção "Jogador pode espiar". Decisão: a opção vem
LIGADA por padrão (campo ausente = pode espiar), para não quebrar mapa salvo nem mesa em andamento; o mestre
desliga na porta que quiser. O host recusa a espiada em porta desligada (não confiar só no botão do jogador), e o
botão "Espiar pela porta" some para o jogador nessa porta. A regra é do mestre: não vai no recorte do jogador além
do necessário para esconder o botão. Fila: logo depois do design do jogador da 0.4.4, antes do release 0.4.4.

### 27/09/2026, fim da tarde — pino só com a imagem, sem a haste

> "[Image #9] esses pinos, coloca opção de aparecer sem aparte de baixo só a imagem."

Imagem: pino do mapa (círculo amarelo com "!" e a haste escura embaixo). Pedido: opção no pino para aparecer só o
círculo com a imagem, sem a haste. Opção do mestre por pino, ausente = com haste (mapas salvos não mudam). Fila:
depois da opção "Jogador pode espiar" (os dois mexem em `types/map.ts` e `lib/mapFile.ts`).

### 27/09/2026, fim da tarde — parede livre e opção de arredondar

> "[Image #11]coloque a opção parede para podermos fazer uma parede tipo sala livre e bote a opção de arredondar [Image #10]"

Imagem 11: botão da ferramenta de sala (ícone de pentágono) com a setinha de variações. Imagem 10: grade com uma
sala quadrada e uma forma redonda ao lado. Pedido: (1) na ferramenta de sala livre, uma variação "Parede", para
traçar ponto a ponto uma parede solta, do jeito da sala livre, sem criar sala; (2) opção de arredondar (cantos/
traçado curvo). Fila: depois do pino.

### 27/09/2026, fim da tarde — avisos "camada travada" empilhados, parede não seleciona

> "[Image #12] que bug é esse? não posso nem selecionar a parede?"

Imagem: 6 avisos iguais, "A camada Paredes está travada", um embaixo do outro. Causa: a camada Paredes estava
travada pelo cadeado da lista Camadas (travar só acontece por ali), e cada clique numa parede empilhava um aviso
novo, sem jeito rápido de desfazer. Consertado em `241efd5e`: aviso repetido renova no lugar (um só na tela) e o
aviso de camada travada ganhou o botão "Destravar", que só destrava.

### 27/09/2026, fim da tarde — cartão do jogador no Grupo (mestre) bagunçado

> "[Image #13] Melhora esse design..."

Imagem (cópia em `C:/dev/hud-evidencia/pedido-13-cartao-grupo.png`): cartão de um jogador na seção Grupo do
painel do mestre (`components/PartySection.tsx`). Cabeçalho "Saga · Uptown · Remover Vagn" com o nome da ficha
cortado; "Bolsa vazia" solta ao lado de "Moedas…"; 9 ações ("Propor troca…", "Ir lá", "Seguir", "Ver tela",
"Mandar para…", "Dar item…", "Recado", "Dar o que o grupo viu", "Emprestar como ajudante…" e um "…") em linhas
quebradas ao acaso, parte como botão e parte como texto solto, sem grupo nem ordem. Pedido: redesenhar o cartão
(design do mestre). Fila: próximo designer livre, arquivos `PartySection.tsx` e as regras dele no `main.css`.

### 27/09/2026, fim da tarde — escada parece seta, não escada

> "[Image #14] Essa escada, gostaria mudasse o design dela para parecer uma escada mesmo aqui parece só uams seta apontando"

Imagem (cópia em `C:/dev/hud-evidencia/pedido-14-escada.png`): a escada do mapa desenhada como chevrons dourados
empilhados (`pixi/drawStairs.ts`), que leem como "seta para baixo". Pedido: desenho que pareça escada de verdade.
Direção: a do minimapa RE (degraus como linhas finas paralelas dentro do retângulo da escada, traço fino, sem
hachura nem parede grossa, ver memória do estilo RE); o sentido sobe/desce continua legível sem virar seta.
Mesmo desenho no mestre e no jogador. Fila: próximo designer livre, depois do cartão do Grupo.

### 27/09/2026, noite — chat dos jogadores: da sala e global

> "Na parte direita dos jogadores para os jogadores que estiverem na mesma sala eu quero que você crie um chat para eles conversarem, esse chat deve da para pagar um jogador com @, enviar imagem e videos e ficarem salvos no local, e tambem faça um chat global."

Pedido: chat na lateral direita da tela do jogador (`player.html`). Dois canais: um só para quem está na mesma
sala e um global. Marcar jogador com @, mandar imagem e vídeo, histórico salvo no local. Mexe no protocolo e no
que o jogador recebe: passa por revisão de segurança (tamanho e tipo de arquivo, texto hostil, quem recebe o
quê). Detalhes em aberto perguntados ao usuário antes do plano. Fila: depois dos 3 agentes em curso, antes da
escada.

Respostas do usuário (27/09, noite):
- "Mesma sala" = mesma cena/mapa: conversa quem está no mesmo mapa aberto, qualquer cômodo. Global = todos da mesa.
- Mestre lê tudo (chat de cada cena, só leitura) e escreve no global.
- Histórico (texto, imagens, vídeos) salvo no PC do mestre, numa pasta junto da mesa; jogador que volta vê de novo.
- Limite: imagem 5 MB, vídeo 25 MB.
- "@" = marcar um jogador (quem é marcado ganha destaque/aviso).

Segunda rodada de respostas (27/09, noite, depois do plano em `docs/plano-chat.md`):
- Vídeo `.mov` do iPhone: aceitar.
- Quem chega numa cena vê as últimas 200 mensagens dela.
- Mestre: envia imagem/vídeo no global, pode ser marcado com @mestre, pode apagar mensagem ou mídia.
- Disco: sem limite por mesa.

### 27/09/2026, noite — quando o limite voltar: fila, bugs, depois design/animação/otimização

> "O que você vai fazer é o seguinte, jaja o limite do programa vai estourar contudo quando voltar, você vai continuar fazendo as features que eu disse e ajeitar os bugs e depois disso vai esquecer as features em outras branchs e vai focar a noite toda em design, animação e optimização, tudo na main."

Ordem, tudo direto na main (feature por feature, commit por feature testada, push + instalador a cada 5):
1. Terminar as features pedidas: cartão do Grupo, chat (fatias A-D de `docs/plano-chat.md`), escada, pino sem haste.
2. Consertar os bugs abertos: ferrolho do jogador some sem aviso (`hostSession.ts:3200`), checagem morta em
   `fogFilter.ts:4577` e comentário 4549-4550, `closeIfLocked` dentro de `withoutLock`, sobras do HUD do jogador
   (gaveta em 390, barra estoura em 320, `role=status` duplicado, texto velho do ferrolho).
3. Depois: features que vivem em outras branches (lotes antigos 0.4.5/0.4.6: g13, pilar, pinlock, dropFrozen,
   iniciativa, ficha suave, zona oculta, pincel) ficam de fora. A noite toda vai para design, animação e
   otimização, na main.
Noite = esta sessão conduzida pelo main thread; o noite-runner continua encerrado.

### Perguntas abertas para o usuário (28/09, madrugada; nada disto foi feito sem resposta)

- Chat: a história da cena mostra a quem chega depois quem falou ali (mantido: "quem chega vê as últimas 200"). Ok assim?
- Chat: jogador que se chama "Mestre" pode ser confundido com `@mestre`. Proibir esse nome, ou marcar " (jogador)"?
- Chat: o painel fica no topo esquerdo, e o plano dizia à direita. Mover?
- Jogador sem ficha no mapa: o botão "Inventário" fica apagado com "sem ficha no mapa"?
- `e2e/task-jornada-companheiros-do-jogador.spec.ts` põe Bruno a 161 px da escada (o alcance é 75 px). O teste não foi editado (regra); precisa de ajuste seu.
### 28/09/2026, tarde: chão travável e chão por camada

> "Perfeito agora o seguinte, você vai constuir essas seguintes features, mas só construir, usando opus 5.5 , não vai usar gauntlet, vocÊ só vai fazer. 1-[Image #16] o chão, eu quero que de para travar o chão para ele não mudar de lugar e gostaria de poder colocar o chão por camada, exemplo [Image #17] um chão é mar e outro é chão normal. Faz isso rápido, só constroi."

- Imagem 16: botão da ferramenta Chão na barra. Imagem 17: um chão verde em cima e um chão azul (mar) embaixo, lado a lado.
- Fila: (1) travar peça de chão para ela não sair do lugar; (2) chão por camada: peças de chão com cores diferentes empilhadas (mar embaixo, chão normal por cima).
- Sem gauntlet, só Opus, rápido.

> "Aproveita e faça um sistema simples de camada por chão quero pode escolher o chão que fica em cima de qual."

- Mesmo lote: lista "Camadas do chão" no painel, com subir/descer por peça para escolher qual chão fica por cima.

### 28/09/2026, tarde: chão fora do mapa e balde de tinta

> "Ok perfeito, agora o faça o seuginte, [Image #18] o chão ele está ultrapassando o limite do mapa que eu coloca no incio da configuração e as vezes o chão fica em cima das salas o que não é para acontecer, resolve rápido"

- Imagem 18: visão do jogador com faixa verde e cantos azuis (Mar) fora do mapa, e um quadrado verde girado com escada perto do token.
- (1) Chão para no limite do mapa: feito em `2017c7e7` (editor, jogador, miniatura).
- (2) Chão por cima das salas: não reproduzido. O quadrado verde da imagem é a sala "Cemiterio" (`#224d05`), não chão; o chão já é desenhado por baixo das salas no editor, no jogador e na miniatura. Aguardando um print de onde acontece.

> "[Image #19] outra coisa, acho que da para criar a ferramenta balde de tinta para pintar essa situação de uma vez, crie rápido"

- Feito: o balde do Chão (forma "Balde") para em parede, linha de mapa, borda de sala e borda do mapa, e pinta a área de uma vez (commit `feat(floor): paint bucket stops at walls, lines, rooms and the map edge`).

### 28/09/2026, tarde: versão 0.4.6

> "Perfeito, cria o 0.4.6"

- Release 0.4.6 com as 4 features do chão desde a 0.4.5 (travar peça, camadas, borda do mapa, balde). Escada espiral parcial fica fora.

### 28/09/2026, tarde: balde no Pincel

> "Acho que você não entendeu, não era para fazer na forma de chão mas sim na forma de pincel, pode fazer ali no pincel ?"

- O balde de tinta vai para o Pincel do botão Desenho: modo "Balde" enche de uma vez uma área fechada com a cor do desenho. O Balde do Chão continua (pedido de 15/09/2026).
- Feito em `6f17294d`.

### 28/09/2026, fim de tarde: título das salas e guia de alinhamento

> "Pronto as proximas feature são essas: [Image #21] eu quero poder tirar o fundo do titulos, dimunir a fonte do titulo, escolher a cor do titulo e ecolocar na horizontal ou vertical. [Image #22] e nisso que diz se ta alinhado com os outros, as vezes é inconvenhiente pois trava o movimento então veja se eu aperta ctrl e mover ele não fica nisso ele se move livre."

- Imagem 21: título "Ancora Prateada" numa pílula bege com texto escuro, sobre fundo marrom.
- Imagem 22: peça selecionada (quadrado com alças e alça de girar) com as linhas amarelas de alinhamento com as outras peças.
- Fila: (1) título: tirar o fundo, diminuir a fonte, escolher a cor, horizontal ou vertical; (2) segurar Ctrl ao arrastar desliga o alinhamento e a peça anda livre.
- Feito: título em `cd645400`, Ctrl livre em `a9a163c2`.

### 28/09/2026, fim de tarde: Ctrl para selecionar área em cima de sala

> "Por enquanto só quero mais uma coisa [Image #23] sabe essa parte de selecionar tudo, em cima do caminho e em cima de sala não funciona e eu eu quero a mesma coisa, caso eu aperte ctrl ele eu vou poder selicionar tudo mesmo em cima de sala."

- Imagem 23: retângulo tracejado de seleção de área, começando no escuro e cobrindo uma área azul (sala/caminho).
- Fila: (1) com Ctrl segurado, arrastar em cima de sala ou caminho abre a seleção de área em vez de mover a peça.
- Feito: Ctrl abre o laço em cima de sala em `346316c5`.

### 28/09/2026, fim de tarde: release 0.4.7

> "Perfeito, agora pode lançar a versão 0.4.7"

- Fila: (1) bump 0.4.7, portão (tsc, suíte, gitleaks), build, fumaça, tag, push, release com .exe e .msi. Escada espiral parcial fica fora.
- Feito: release v0.4.7 publicada (https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.4.7).

### 28/09/2026, noite: chão cobrindo a visão e objetos iniciais

> "[Image #24] Ajeita esse bug é para ficar assim [Image #25]. E outra coisa, ta na hora tambem de adicionar alguns objetos aqui uma lista de objetos iniciais que seriam interessantes(Barril, Caixa, Baú, Cama, Mesa, Cadeira)"

- Imagem 24 (bug, `scratchpad/bug-chao-antes.png`): token Saga acima de uma porta entre dois pilares redondos. Abaixo da linha da porta tudo fica preto; só o cone de visão mostra o chão pintado (verde e azul). A metade de baixo dos pilares, o nome "Porto" e a memória cinza da névoa somem.
- Imagem 25 (esperado, `scratchpad/bug-chao-esperado.png`): mesma cena sem o chão pintado. Pilares inteiros, cone de visão cinza claro, área explorada em cinza escuro, nome "Porto" visível.
- Fila: (1) chão pintado não cobre sala, pilar, nome nem a memória da névoa; (2) objetos iniciais: Barril, Caixa, Baú, Cama, Mesa, Cadeira.
- Feito: objetos iniciais em `82612a94`.
- Feito: chão cobrindo a visão em `cb32ed47`.
- 28/09/2026, noite: "Eu quero que você publique essa versão logo mesmo não tendo 4-5 features faça a versã 0.4.7.1"
- Feito: release v0.4.7.1 em https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.4.7.1
- 28/09/2026, noite: "Ok, vamos fazer uma mudança, eu quero que os objetos fiquem aqui [Image #27] numa parte só deles, e eu quero que eles tenham propriedades deles e que a gente possoa mudar de cor, sim verdade e seria legal para alguns itens tipo cadeira ou bau ter uma versão de frente e uma de lado, eu imagino propriedades como preencher, mudar de cor e afins." (Image #27 = barra de ferramentas de baixo.)
  - Fila: (1) ferramenta Objetos na barra, fora do painel da sala; (2) propriedades do objeto: preencher, cor e afins; (3) versão de frente e de lado para cadeira e baú.
- 28/09/2026, noite: "Aproveita tambem e ajeita esse bug aqui [Image #28] fica assim a sombra e quando eu me aproximo fica normal [Image #29]" (Image #28 = borda da sombra/névoa em degraus, serrilhada, longe do token; Image #29 = perto do token "Saga" a borda fica lisa.)
  - Fila: bug da borda da sombra serrilhada longe do jogador (entra junto da fila de Objetos, em paralelo, arquivos separados).
- 28/09/2026, noite: "Quando terminar lance a versão 1.4.7.2, lembre-se não use gauntlet-loop"
  - Leitura: "1.4.7.2" tratado como 0.4.7.2 (sequência da 0.4.7.1; pular para 1.x seria salto de versão maior). Release depois das 3 partes de Objetos + bug da sombra. Sem gauntlet.

### 30/09/2026 a 01/10/2026: animação, UX/UI e otimização (ultracode, sem gauntlet)

> "Usando o ultracode eu quero que você trabalhe na main evoluindo as animações, refinando, e melhorando ux/ui, primeiro gere uma lista do que você acredita que pode ser melhorada de maneira rápida. Não use gauntlet-loop. contudo pode usar paralelismo."

- Goal da sessão: "Contruir animações fluidas e bem feitas, melhorar o ux/ui para jogadores e mestres, refinar e optimizar o programa."
- Lista rápida (25 itens M1-M25 em 5 lotes A-E): `scratchpad/lista-ux.json` da sessão 556fad7c. Lista de desempenho (P1-Pn) em andamento.

> "Algumas ideias para você colocar nessa listas para fazer: 1- alguns sons baixo para dar imerssão, tipo, tocar um sound effect ao pegar um item ou ir para um cenário, tipo resident evil https://youtu.be/j3m8SkSc2XA (Um video dos sons) 2-Sabe uma coisa, as propriedades das ferramentas as vezes ficam cheias demais, as propriedades no caso, um exemplo, olha o tanto de prioridade aqui [Image #1], sabe acho que da para ajeitar tudo isso, a parte de tokens tambem [Image #2] da para fazer um ux/ui mais bonito e perfeito para ficar tudo harmonico 3-Uma coisa tambem que ajudaria muito é aquelas features de medição do Figma e Excalidraw, [Image #3] tipo fiz o meu melhor mas muito coisa parece está desalinhada, poderia analisar depois e ver melhorias para isso ? 4-[Image #4] e seria legal ter um botão que desmonta as salas, ou uma parede só da salas tipo, a imagem é um correr e do na tem um sala eu queria que fosse uma estrutura só sabe ? 5-[Image #5] depois que eu faço uma linha seria legal eu poder alinhar ela mesmo depois de feita apertando alt, para ela ficar em angulos retos"

- Imagem 1: painel da direita com a seção Parede (Parede interna, Espessura Fina/Média/Grossa, Grossura 2 px com texto longo), Avançado, Seleção (Adicionar token, Nada selecionado) e mais 7 seções recolhidas (Cenas, Pinos, Agenda, Estado do mundo, Objetos do mapa, Locais, Acervo de tokens). Cheio demais.
- Imagem 2: Acervo de tokens com pastas NPCs (9), Veículos (0), Jogadores (4: Vagn, Ryoko, Aira, Jimboy) e "Sem pasta" (Saga); cada linha com ícone de pasta e x. Quer visual mais bonito e harmônico.
- Imagem 3: salas redondas e retangulares ligadas a uma sala central por corredores de duas linhas, com ângulos e larguras desencontrados. Quer guias de medição/alinhamento como Figma e Excalidraw.
- Imagem 4: "Sala 3" selecionada, com as duas linhas de um corredor entrando nela. Quer corredor e sala virando uma estrutura só (desmontar a sala em paredes ou juntar numa parede só).
- Imagem 5: uma linha inclinada solta. Quer selecionar a linha pronta, apertar Alt e ela se endireitar em ângulo reto.
- Imagens da sessão: `C:/Users/gedasio.filho/AppData/Local/Temp/claude/C--dev-labirinto/556fad7c-d96f-40fa-8a7d-f1d953372ad4/images/1.png` a `5.png`.
- Fila (depois dos lotes A-E e da lista de desempenho): (5) Alt endireita linha pronta; (2) painel de propriedades e Acervo de tokens enxutos e harmônicos; (3) guias de medição e alinhamento estilo Figma/Excalidraw; (1) sons baixos de imersão (pegar item, trocar de cena), sintetizados, com volume e mudo; (4) desmontar sala / sala + corredor numa estrutura só.

> 01/10/2026: "Depois que terminar tudo, crie o instalador, e push para o github, e então pare até eu dar novas features ou pedir novas analises. Lembre-se não use gauntlet-loop, pode usar o ultracode, paralelismo e afins se a construção deixar mas não precisa se forçar a usar caso não de para usar."

- Leitura: "tudo" = lotes A-E, otimizações P1-P14 mantidas e os 5 pedidos acima. No fim: instalador (.exe/.msi), push da main, release/tag; depois parar e esperar.

> 01/10/2026: "Não to vendo nenhuma animação será que é configuração do meu computador?"

- Diagnóstico: o Windows está com "Efeitos de animação" desligado (SystemParametersInfo SPI_GETCLIENTAREAANIMATION = False). O WebView2 repassa isso como `prefers-reduced-motion: reduce`, e todas as animações novas respeitam essa preferência, então nada anima.
- Fila: opção no app "Animações: Seguir o Windows / Sempre ligadas / Reduzidas" (persistida), que manda no CSS (`data-movimento` no html) e nas animações em JS (helper único no lugar dos matchMedia soltos). Entra no polimento final, depois que as trilhas liberarem main.css, pixi e player.

> 01/10/2026: "Uma pergunta, como eu desmonto a sala?" / "mas fica aonde exatamente? não to achando" / "[Image #6] ainda não consigo ver, mesmo com o que você disse [Image #7]"

- Imagem 6: painel da Sala 3 sem a linha "Abrir para o corredor" (termina em "Criar sala dentro"). Imagem 7: duas paredes chegando na diagonal no canto de cima à esquerda de uma sala retangular.
- Causa (no mapa dele): as linhas são paredes e encostam, mas os corredores têm 6,1 a 7,2 células de largura; a regra aceitava no máximo 4. Nenhum corredor reconhecido, linha escondida.
- Fila: teto de largura proporcional à sala; linha aparece apagada com o motivo quando há parede encostando mas não vira corredor. Em andamento (`wf_c22a7d2a-d63`).

> 01/10/2026: "Vamos fazer o seguinte termina o B e C3, e por enquanto pronto, salva no Pedidos/Handoff o que falta, para trabalharmos outro dia."

- Feito: trilhas B (guias + fantasma do Alt) e C3 (HUD do jogador, sobras dos sons, perf do revisit). Polimento fase 1 parado antes de editar. Release adiada.
- Fila para o próximo dia (detalhe em HANDOFF.md, "FECHAMENTO DO DIA"): (1) opção Animações; (2) polimento: avisos x barra, cabeçalho, ficha do acervo no topo, Ctrl+Z vazio, "Abrir para o corredor" no topo do painel, tolerância 3/4 de célula; (3) medida das guias legível com zoom afastado; (4) reconferir o HUD do jogador e confirmar 3 mudanças de comportamento; (5) sobras menores; (6) ouvir os sons no Tauri e no celular; (7) instalador, push e release.

> 01/10/2026: "pode fazer o push e fazer o instalador coloca como versão 0.4.8"

- Feito: release v0.4.8 (`b4ad2774`), https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.4.8, com .exe e .msi. A fila do próximo dia (itens 1-6) continua.

> 01/10/2026: "Eu quero fazer algo simples com os pinos: 1- [Image #1] No escolher imagem, eu quero poder da Ctrl + C e Ctrl + V para colocar a imagem ou só arrastar a imagem para ficar mais facil de escolher, então coloque as três opções: 1. A de copiar e colar 2. Arrastar imagem 3. escolher normalmente"

- Feito (`d485e232`, testado no navegador; arrastar do Explorer no exe ainda não conferido): área "Arraste uma imagem para cá / ou clique aqui e cole com Ctrl+V" acima de "Escolher imagem..." (`components/PinImageDrop.tsx`); `dragDropEnabled: false` no tauri.conf.

> 01/10/2026: "Perfeito, agora eu quero que você faça o seguinte com os tokens: 1-[Image #2] eu quero que você nessa parte de patrulha, eu quero que você faça estilo macro, o Token tem um caminho que eu coloco e ele vai andando sozinho com base nas propriedades que eu botar, segundos, de tempo em tempos coisa assim, e outra coisa se essa ficha é de NPC e eu coloco essa ficha para vigiar e o Jogador entra no radar, a ficha corre em direção ao jogador. e outra coisa, certas fichas eu quero que elas tenham varias imagens como se fosse transformações e que seja facil mudar, tanto fichas npc quanto jogadores, essas fichas especiais bote para salvar e editar."

- Imagem 2: seção "Patrulha" do painel do token, com "Avançar patrulha" (manual), a dica "Marque pelo menos 2 pontos" e "Marcar ponto aqui".
- Três features, uma por vez: (A) patrulha automática por tempo (macro); (B) vigiar: NPC vê jogador no radar e corre até ele; (C) transformações: várias imagens por ficha, troca fácil, NPC e jogador, salvas no acervo e editáveis.

- Plano aprovado (grilling, 01/10/2026) para (A) patrulha automática, em 3 entregas:
  1. Motor: "Patrulhar sozinha"/"Parar"; anda casa a casa (findTokenPath, como a rotina); velocidade da ficha (padrão 2 casas/s); circuito ou vai-e-volta; espera 2 s por ponto; pausa geral na barra (só aparece com NPC andando) + Shift+P, congela patrulha E rotina; ao reabrir mapa volta parada (config salva).
  2. Macro por ponto: lista ordenável de passos (pode repetir): esperar X s, olhar para direção (gira ficha e cone de vigia), velocidade até o próximo, falar, sumir/aparecer (sumida continua andando), esperar o mestre ("Seguir"). Ponto novo nasce com "Esperar 2 s".
  3. Balão de fala no mestre e no jogador (só quem enxerga a ficha), dura até a ficha voltar a andar.
  - "Trocar imagem" entra como passo depois da feature C. Ordem: A, depois B (vigia já existe: `TokenWatch`), depois C.
  - Regra do usuário: no máximo 1 agente por vez, Opus high.
- Entrega 1 (motor) feita e testada no navegador: anda casa a casa com A* (`lib/caminhoEmGrade.ts`), contorna parede, sem caminho fica parada e tenta de novo a cada 1 s; velocidade e ronda salvas; "Pausar NPCs" + Shift+P. Pendência anotada: a ROTINA ainda teleporta através de parede sem porta (usa o caminho antigo).
- Entrega 2 (macro por ponto) feita e testada no navegador: falar, olhar, esperar, sumir, aparecer e esperar o mestre ("Seguir") rodando em ordem; anel no ponto aberto; linha do passo em duas linhas para caber na coluna. Fala não é gravada no arquivo. Rotina também deixou de atravessar parede (`36207197`).

> 03/10/2026: "Eu quero fazer uma coisa, [Image #1] o conta gotas ta bugado e não ta funcionando, pode ajudar ? outra coisa o Token que eu tranformo em veiculo, o jogadores não estão conseguindo subir nele nem controlar o token."

- Imagem 1: botão de conta-gotas + amostra de cor do seletor de cor nativo.
- Causa: (1) o conta-gotas do seletor nativo não funciona no WebView2 (só no Chrome); (2) veículo: só o mestre embarca alguém, e mover a própria ficha desce do veículo (item 1 do "fica para depois" do plano do veículo).
- Decidido (grilling, 03/10/2026): (A) conta-gotas próprio que pega a cor de um ponto do mapa, ao lado de cada cor; (B) veículo: botão "Subir" automático quando encostado (recusa se cheio), primeiro a bordo é o motorista e o movimento dele leva o veículo e todos, botão "Descer", andar a bordo não derruba ninguém. Ordem: A, depois B.
- (A) conta-gotas feito (`8ab6197c`): pipeta ao lado das 12 cores do editor, pega a cor do pixel do mapa (sem seleção/guias), Esc cancela, Ctrl+Z desfaz; testado no navegador (Chromium), não conferido no exe. (B) veículo em andamento.
- (B) veículo feito (`e6f2e521`): jogador sobe ("Subir no veículo"), primeiro a bordo dirige e leva todos, passageiro não anda ("A bordo: desça para andar"), "Descer", sucessão do motorista; e2e com 2 jogadores no Chromium. Pendências: Subir não conhece a vez da iniciativa; viagem do motorista não leva o veículo; mestre no Tauri não conferido.

> 03/10/2026: "Resolva as pendencias."
- Pendências do veículo: (1) "Subir" fora da vez na iniciativa; (2) viagem do motorista leva o veículo inteiro.
- Feito (`412b339c`): fora da vez "Subir"/"Descer" somem; viagem do motorista leva o veículo e todos; passageiro recebe "A bordo: desça para viajar". Sobras: cartão do pino mostra "Passar" à passageira; atalho na mesma cena pode pôr passageiro na parede; diário mostra o nome do veículo; colega a bordo lê "O mestre levou você".

> 03/10/2026: "corrija essas sobras e na parte de colocar iamgem de token eu quero que você permita eu arrastar uma imagem e colocar uma imagem igual ao que eu faço com os pinos [Image #2]"
- Imagem 2: seção "IMAGEM DO TOKEN" do painel (nome do arquivo, "Trocar imagem...", "Remover imagem (voltar ao círculo)").
- Fila: (1) 4 sobras do veículo; (2) área de arrastar/colar imagem no token, como `components/PinImageDrop.tsx`.
- Feito: sobras do veículo (`c537f629`) e arrastar/colar imagem no token (`ea129299`, só PNG/JPG/WebP/GIF até 25 MB; testado no navegador, não no exe). Sobras: colega a bordo não aparece no cartão "entrou em" do mestre; atalho na mesma cena sem aviso a quem vai a bordo.

> 03/10/2026: "Eu não consigo ver o chat dos meus jogadores, pode colocar a opção de ver o chat"
- Causa: fatia D do `docs/plano-chat.md` (leitura do mestre) nunca foi feita. Decisões já tomadas em 27/09: mestre lê tudo (cena só leitura), escreve no global, `@mestre` destaca, mestre apaga mensagem.
- Feito: painel "Chat" do mestre (`f7661cbf`) e apagar mensagem (`b02ce36a`); e2e com mestre + 2 jogadores em cenas diferentes. Histórico em disco (fatia B) e mídia (fatia C) nunca foram feitos: o chat some ao fechar a sala.

> 03/10/2026: "Sim" (fazer o chat ficar salvo depois de fechar a sala = fatia B do plano-chat)
- Feito (`643e17e6`): chat salvo em `%APPDATA%/chat/<id da aventura>/` (global.jsonl + um por cena), últimas 200 voltam ao reabrir, apagar sai do arquivo; e2e passou. Não conferido no disco real do Tauri. Sobras: arquivo só cresce; apagar aventura não apaga o chat dela.

> 03/10/2026: "Eu quero melhorar o ux/ui, eu quero que algumas coisas fique na parte direita da tela, a parte de Jogo [Image #4] eu quero que fique a direita na tela, e tenha abas, e uma dessas abas vai ser o chat, onde vou poder ver e abaixo na parte direita mas abaixo do jogo e do chat eu quero as Cenas [Image #5]."
- Imagem 4: aba Jogo (Sala, Rede local, Iniciativa, Relógio da campanha, Cena externa). Imagem 5: seção Aventura > Cenas (filtro + árvore).
- Decidido (grilling, 03/10/2026): coluna direita com abas Jogo | Chat em cima e Cenas embaixo; divisor arrastável (lembra a altura; Cenas recolhível); coluna escondível por botão + atalho (lembra); botão Chat solto sai, não lidas/@mestre vão na aba Chat e no botão de reabrir a coluna. Esquerda fica só Mapa.
- Feito (`6389e5d6`): coluna direita Jogo | Chat + Cenas; usuário testou no app ("ta tudo certo"). Agente parado no meio da revisão dos 184 e2e (46 ajustados); e2e inteiro não rodado.

> 03/10/2026: "Perfeito agora vamos ajeitar coisas menores: 1-Quando eu estou com a Sala selecionada aparece categorias que não são da Sala como o chão do mapa [Image #6] 2-Outra coisa quando eu uso o [Image #7] chão e coloco em uma lugar muito grande o chão simplemente trava o FPS vai lá para baixo e é uma luta para trocar de cor e até fecha o programa."
- Imagem 6: seção "Chão do mapa" (Cor do chão com pipeta, Contorno, Avançado) aparecendo com a Sala selecionada. Imagem 7: ferramenta "Chão (I)".
- Fila: (1) painel da Sala só com o que é da Sala; (2) chão grande trava FPS / troca de cor lenta / fecha o app.
- Feito: (1) painel só com seções do item (`835a7d9e`); (2) chão grande (`a85d509a`): pintar 15 s→0,75 s, 3 cores 89 s→0,5 s e 1 passo no Ctrl+Z. Sobras: arrastar chão gigante ainda ~1,3 s por passo; crash não reproduzido no Tauri; e2e pincel-balde quebrado pelo botão "Chão" duplicado (provável efeito do item 1, só no teste).

> 03/10/2026: "Pronto, agora vamos falar sobre as ferramentas de pincel, eu quero que vocÊ crie camadas para ela uma fica em cima da outra e outra coisa as paredes é para sempre fica em cima da parte de pincel, até no balde, entendeu ?"
- Decidido (grilling, 03/10/2026): camada ativa (lista Camada 1, 2…; pincel/balde pintam só nela; de cima cobre a de baixo; renomear, esconder, travar, subir/descer); balde: só paredes/portas/contorno de sala seguram; apagar só na camada ativa; paredes, portas e contorno de sala sempre acima de toda tinta de chão. Ordem: (1) paredes por cima; (2) camadas.
- Feito: (A) `2fa2f9d3` paredes/portas/escadas acima do traço e do balde da ferramenta DESENHO (a tinta do Chão já ficava embaixo); (B) `332d499a` camadas do pincel/balde da ferramenta CHÃO (camada ativa). Dúvida aberta: o usuário pode ter falado do pincel/balde do Desenho. e2e camada-travada falha (provável efeito do 835a7d9e: seção Camadas some com token selecionado).

> 06/10/2026: "Eu quero que você melhore a tela inicial, usando o emil-design-eng junto ao mcp figma, redesenhe, e melhore, colocando animações, design e tudo, você só irá usar opus medium e adciona uma pagina chamada Roleplay, mas ainda não coloca nada dentro, coloca que ta em construção."
- Fila: (1) redesenho da tela inicial (Figma primeiro, depois código, com animações no estilo Emil); (2) página Roleplay vazia com aviso "em construção". Agentes só Opus medium.
- Feito (`30521390`): tela inicial nova (Figma "Labirinto — Tela inicial", arquivo CkZ8IjLikhulUnZ3bnZw73) e página Roleplay "em construção". Conferido no navegador (Chromium isolado): entrada, labirinto, setas, Roleplay, Esc volta, tela estreita. Não conferido no exe. e2e não rodou: falta o navegador do Playwright 1234 na máquina.

> 06/10/2026: "Muito bom, Agora ao apertar Criar Mapas eu quero uma animação de transição, me de algumas opções."
- Fila: transição animada ao clicar "Criar Mapas" (menu → formulário Novo Dungeon Map). Opções apresentadas ao usuário antes de construir.
- Escolhido: "Abrir a porta" (cartão cresce e vira o painel do formulário). Feito com View Transitions API; só no clique de Criar Mapas, sem animação com "reduzir movimento". Conferido no navegador (Chromium isolado, quadros desacelerados); não no exe.

> 06/10/2026: "Perfeito, agora eu quero que vocÊ faça uma animação para mim, separada do programa só para eu ver sua capacidade: https://youtu.be/oqgkMT576Rk, são animações do resident evil abrindo a porta serve como um loading, eu quero que vocÊ faça uma dessa, salão preto e animação da porta abrindo, pode fazer igual a resident evil, pois é só um teste."
- Fora do app: página avulsa (3D) com salão preto e porta abrindo, estilo loading do Resident Evil. Não mexe no código do Labirinto.
- Feito: página avulsa em 3D (three.js), publicada em https://claude.ai/artifact/RHovPQHnASoRT1zB3dPnmn. Porta de madeira num salão escuro, maçaneta gira, fresta com tranco, porta abre devagar, câmera atravessa e some no preto; repete a cada ~8 s. Som sintetizado (botão) e Modo PS1. Fora do código do app. O vídeo do YouTube não foi assistido (sem acesso); feito pela referência conhecida do jogo.

> 06/10/2026: "Perfeito, pode fazer agora descendo uma esacada estilo residente evil ?"
- Fora do app: segunda página avulsa em 3D, loading descendo uma escada no estilo Resident Evil.
- Feito: https://claude.ai/artifact/LtWCh7rBBaiJ3vU1ew52AT. Escada de madeira com passadeira vinho e varetas de latão, corrimão, quadro na parede; câmera desce degrau a degrau (olho acompanha cada degrau), luz fria lá embaixo, fade e repete a cada ~9 s. Som: passos sincronizados por degrau, rangido de vez em quando, vento e zumbido. Modo PS1.

> 06/10/2026: "hmmm, não foi assim que eu imaginei tente algo assim [Image #2], passos profundos."
- Imagem 2: lance largo de degraus de pedra/concreto escuros, de frente, laterais sumindo no preto, sem paredes nem tapete.
- Refazer a página da escada nesse estilo: degraus largos de pedra, passos pesados e lentos.
- Feito (versão 2, mesmo link LtWCh7rBBaiJ3vU1ew52AT): escadaria larga de pedra escura como na imagem, laterais somem no preto, câmera baixa sobe 8 degraus em passos lentos (~1 s cada) que afundam no impacto e balançam de lado. Som: baque grave de bota em pedra com eco. A imagem mostra subida, então a câmera sobe; versão descendo não feita.

> 06/10/2026: "Pronto, o que eu quero é nos Pinos de viagem e em certas escada, eu quero ter a opção de colocar uma animação de Transição, que vai ser essas transições especiais que eu vou mandar vocÊ fazendo, a você faz tipo uma galeria onde eu possa escolher ver e tal, pode ser ?"
- Feature no app: pinos de viagem e escadas ganham opção "Transição especial" escolhida numa galeria (porta, escada de pedra, e as próximas que o usuário pedir), com prévia. Em grilling.
- Decidido (grilling, 06/10/2026): só quem passou vê; animação completa por padrão, mestre pode escolher a duração (segundos) por pino/escada; botão "Pular" no jogador; no painel do pino de viagem e da escada (com outro piso) uma seção "Transição" com miniaturas + nome e botão expandir que abre a animação inteira numa janela no meio; 3D ao vivo com three.js (instalar pacote `three`).
- Feito: motor 3D + porta e escadaria portadas (`24ce02b3`); galeria "Transição" no painel do pino de viagem e da escada com outro piso, miniatura, expandir, duração (`1075770b`); jogador vê em tela cheia ao atravessar o pino ou tocar a escada, com "Pular", som pelo "Som da mesa" (este commit). Conferido: unit (todas), tsc, prévia e tela do jogador num Chromium isolado. Não conferido: travessia real mestre+jogador na rede e no exe; e2e não roda nesta máquina.
- Publicado: v0.4.12 (`18fa6fba`), https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.4.12.

> 06/10/2026: "Pronto, eu quero mais uma animação, não tem a animação de escada subindo ? então faz a mesma coisa só que descendo, e outra coisa, não consigo colocar animação da escada, faça com que eu possa."
- Fila: (1) bug: galeria de transição não aparece para a escada; (2) nova transição "escadaria de pedra descendo" (mesmo estilo da subindo).
- Feito: galeria aparece em toda escada, inclusive a que leva a outra cena (`8c0123f5`); nova transição "Escadaria descendo" (a de subir virou "Escadaria subindo"), com patamar sem riscos (este commit). Conferido em quadros num Chromium isolado; não no exe.

> 06/10/2026: "Quero que faça mais uma coisa para mim na parte da aba de jogo quero que tire esse parte pistas [Image #3], quero que tire essa parte de Iniciativa [Image #4], que tire essa parte de relogio [Image #5] e por ultimo tire o [Image #6]."
- Imagens: seções "Pistas (33)", "Iniciativa", "Relógio da campanha" (+1 hora / Próximo período) e "Confronto" (Confronto nesta cena) da aba Jogo do mestre.
- Fila: esconder as 4 seções da aba Jogo.
- Feito: Pistas, Iniciativa, Relógio da campanha e Confronto escondidos da aba Jogo por flag em `lib/features.ts` (religa trocando para true). Dados e host seguem iguais. Teste unitário prova as 4 escondidas; não visto no exe (a aba Jogo só existe no app instalado). e2e que usam essas seções vão quebrar (não rodam nesta máquina).
- Publicado: v0.4.13 (`69d79a36`), https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.4.13.

> 06/10/2026: "Perfeito, agora eu quero só fazer um teste [Image #7] consegue fazer uma animação da pessoas só olhando de um lado para o outro? não coloque no programa eu quero ver se vocÊ consegue."
- Imagem 7: túnel de esgoto em abóbada de tijolo, canal de água no meio, calçadas dos dois lados, nichos em arco na parede direita, névoa azul, fundo escuro.
- Fora do app: página avulsa 3D, câmera parada olhando para a esquerda e para a direita.
- Feito: https://claude.ai/artifact/N9PrimznbwR7kPfzWzbwwW. Túnel em abóbada de tijolo, canal de água com ondinhas andando, calçadas, nichos em arco à direita, névoa azul; câmera parada respira e olha frente, esquerda, frente, direita (nichos), em ~14 s. Som: pingos com eco, água correndo. Fora do app.

> 06/10/2026: "Perfeito proximo exemplo que eu quero que vocÊ faça olhando de cima para baixo [Image #8]"
- Imagem 8: fortaleza branca em andares redondos, telhados azuis, torres com telhadinho vermelho, canhões, selva em volta, escadaria até o portão (base marinha estilo anime).
- Fora do app: página avulsa 3D, câmera começa olhando o topo e desce o olhar até a escadaria.
- Feito: https://claude.ai/artifact/U3WazRc3txoczxPRGpSKmA. Fortaleza branca em 4 andares redondos, telhados azuis, torres com telhadinho vermelho, canhões, palácio no topo, portão em arco, escadaria com muretas e bastiões, selva low-poly, morros e nuvens; olhar desce do topo até a escadaria em ~12 s. Som: vento e pássaros. Sem o letreiro e o símbolo da imagem.

> 06/10/2026: "Perfeito, agora pega esse mesma foto [Image #9] não precisa fazer 3d, só efeito de imagem, olha de baixo para cima, uma animação de imagem 2d"
- Fora do app: página avulsa 2D com a própria imagem: panorâmica de baixo (escadaria) para cima (palácio), com efeitos de imagem.
- Feito: https://claude.ai/artifact/P3Q1PzNpkRaYVBCasrq7ie. Panorâmica 2D sobre a própria imagem: começa perto na escadaria, sobe devagar (grua) até o palácio e afasta o zoom; raios de sol, névoa que anda mais rápido que a foto, pólen e folhinhas em 3 profundidades; ~13 s em volta. Som: vento e pássaros.

> 06/10/2026: "pode fazer a animação do tamanho da foto ? só para eu ver como fica?"
- Mesma animação 2D num quadro do tamanho da foto (805x608), sem ampliar para a tela cheia; botão para alternar com a tela cheia.
- Feito (versão 2, mesmo link P3Q1PzNpkRaYVBCasrq7ie): abre num quadro do tamanho da foto (805x608); começa com zoom na escadaria e termina mostrando a foto inteira, sem ampliar além do original; botão alterna com tela cheia.

> 06/10/2026: "Perfeito, esse tipo de animação, eu quero que de para colocar nos pinos de exclamação [Image #10], coloque como Animação do Cenário, pois os pinos de exclamação eu uso para apresentar cenário."
- Imagem 10: pino "!" amarelo.
- Feature: "Animação do Cenário" (2D sobre imagem, como a da fortaleza) nos pinos de exclamação. Em grilling.
- Decidido (grilling): usa a imagem do pino; o mestre escolhe por pino "Só da primeira vez" / "Sempre" / "Não, só o cartão"; galeria de movimentos (sobe, desce, esquerda→direita, direita→esquerda, aproximar) com prévia e duração; névoa, raios, partículas e som ligáveis um a um.
- Feito: motor 2D (`a2e58bc4`), seção "Animação do Cenário" no painel do pino "!" (`1cca09df`), jogador vê ao abrir o cartão com "Pular" e "Ver animação", primeira vez lembrada no navegador do jogador (este commit). Conferido: tsc, testes das áreas (116), prévia e tela do jogador num Chromium isolado. Suíte inteira rodou, mas a saída não foi lida (usuário pediu para terminar). Não conferido no exe.
- Publicado: v0.4.14 (`d75125fe`), https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.4.14.

> 07/10/2026: "Vamos ajustar algumas coisas em cada um do objetos, parede, não faz sentindo ter [Image #1] nenhuma dessas categorias quando parede está selecionada, então coloque na configuração do mapa [Image #2] um opção de ligar delisgar essas categorias quando uma ferramenta que não tem nada haver com as categorias estiver selecionada, ou seja só vai aparecer quando nada tiver selecionado. No lugar na parede coloque propriedades úteis, eu quero: 1-Mesmo sendo uma parede, quero que tenho uma opção de passar pela parede mesmo que seja solida 2-Uma opção de trocar a cor da parede."
- Imagem 1: barra lateral com "Aventura > Pinos", "Esta cena > Objetos do mapa", "Locais".
- Imagem 2: janela "Configurações do mapa" (Grade, Alinhar grade, Medição).
- Fila: (1) opção nas Configurações do mapa para esconder essas categorias quando uma ferramenta sem relação (ex.: Parede) está ativa; (2) painel da parede com "Atravessável" (passa mesmo sólida) e "Cor da parede".
- Feito: opção "Esconder Aventura e Esta cena ao usar ferramenta" na janela Configurações do mapa (seção Painel lateral, nasce ligada, vale para todos os mapas); ligada, Pinos/Cenas/Objetos do mapa/Marcas/Locais só aparecem com Selecionar e nada selecionado. Painel da parede: "Deixa passar (a ficha atravessa)", "Deixa ver (a visão atravessa)" e "Cor da parede" (com "Padrão"). A que deixa passar sai tracejada só no editor do mestre; o jogador vê parede comum. Conferido: tsc, testes das áreas (1050), clique real num Chromium isolado. Não conferido no exe nem com jogador na rede.

> 07/10/2026: "Em configuração no mapa, você pode tirar isso: [Image #3]. E pode adicionar o seguinte 1-[Image #4] na configuração geral podemos colocar o nivel da visão deles, mas eu quero configurar isso por cena então em cenas coloque um botão de configura para eu pode configurar isso e além disso coloque do lado um exemplo um pequeno painel que mostra o rada do que o jogador vai ver."
- Imagem 3: seção "Andar do prédio" (Prédio, Andar) da janela Configurações do mapa.
- Imagem 4: seção "Visão dos jogadores" (Visão nesta cena em quadrados, Cena escura).
- Fila: (1) tirar "Andar do prédio" da janela; (2) "Visão dos jogadores" sai da janela e vira botão de configurar em cada cena da lista Cenas, com prévia ao lado do raio que o jogador vê.
- Feito: "Andar do prédio" escondido da janela por flag (`FEATURES.andarDoPredio`, prédio/andar guardados continuam valendo). "Visão dos jogadores" saiu da janela e foi para a engrenagem "Configurar" em cada linha da lista Cenas: janela com "Visão nesta cena" e "Cena escura" e, ao lado, um radar (ficha no meio, grade, círculo do alcance; cena escura mostra só a casa da ficha e o alcance tracejado). Cena aberta grava no Ctrl+Z; cena de fundo grava no cache dela. Conferido: tsc, testes das áreas (239), clique real num Chromium isolado na cena aberta. Não conferido: configurar uma cena de fundo na tela, exe.

> 07/10/2026: "Nas salas não precisamos mais disso [Image #6] no lugar coloque: 1- Numa sala eu quero pode pintar uma parte de uma cor e outra parte outro, coloque uma opção que possamos fazer isso."
- Imagem 6: painel da Sala, "Gatilho" (Nenhum/Armadilha/Alarme) e "Perigo" (Pôr fogo/Pôr água).
- Fila: (1) esconder Gatilho e Perigo do painel da Sala; (2) opção para pintar partes da sala em cores diferentes.
- Decidido: linha divisória (não pincel).
- Feito: Gatilho e Perigo escondidos do painel da Sala por flag (`FEATURES.gatilhoDeArea`, `FEATURES.perigoDaSala`; a Região comum continua com o Gatilho). No lugar, bloco "Duas cores": "Pintar parte da sala de outra cor", Segunda cor, Divisão (Em pé/Deitada/Diagonal) e "Onde corta" (5–95%). Vale no editor e na tela do jogador (mesmo desenho). Conferido: tsc, testes (1464 de componentes + recorte), clique real num Chromium isolado. Não conferido no exe.

> 07/10/2026: "[Image #7] aqui coloque um icone de expandir e quando tocado no icone vai aparecer todas as cenas, separada por categorias e as cenas que ficam dentro de outras cenas como subgrupo [Image #8] vão aparecer embaixo da cena principal e assim por diante, o que vai aparecer vai ser a miniatura do mapa, mas ainda sim visivel."
- Imagem 7: cabeçalho do painel esquerdo (Labirinto, + Token, engrenagem).
- Imagem 8: lista Cenas com "Cena 2" dentro de "Mapa sem título".
- Fila: ícone de expandir no cabeçalho; abre todas as cenas em miniatura, agrupadas pela cena de cima, sub-cenas embaixo da principal, em níveis.
- Feito: ícone de expandir ("Ver todas as cenas") no cabeçalho, entre "+ Token" e a engrenagem. Abre a Visão geral grande (até 1280 px) com miniaturas: cada cena de fora que tem cenas dentro vira um grupo com título; as de dentro aparecem embaixo, recuadas, em "Dentro de X", e assim por diante; cenas sem nada dentro vão para "Outras cenas". A "Visão geral" da lista de Cenas também ficou agrupada. Clicar abre a cena. Conferido: tsc, testes (27 da visão geral + painel), aventura com 3 níveis num Chromium isolado. Não conferido no exe.

> 07/10/2026: "[Image #9] quero que você olhe para essa parte pense em para um redesigner melhor imaginando 10 jogadores e como eu administraria isso, e me de algumas opções graficas, use a skill emil-design-eng e tudo que você imaginar de util aqui [Image #10] para fazer as opções e use o mcp do figma"
- Imagem 9: aba Jogo, seção "Grupo" (Congelar todos; cartão do jogador Saga com Ir lá/Seguir/Ver tela/Recado/…, Mochila e bolsa, Visão e mapa, Fator de visão).
- Imagem 10: lista das skills do Emil (emil-design-eng, animate, break-ui, apple-design...).
- Fila: só opções de design (Figma), nada no app até o usuário escolher.
- Feito (só design, nada no app): Figma https://www.figma.com/design/p35KYAhPUFn9A2kO969rXD, página "Grupo · 10 jogadores", 6 quadros: 0 Resumo e recomendação; A Rol compacto (linha de 36 px que abre a ficha no lugar); B Por cena (agrupado por onde estão + ação em lote); C Retratos (grade 3 por linha + ficha ao lado); D Atenção primeiro (caixa "Precisa de você" + grupo em fichinhas); E Mesa ampliada (tabela pelo ícone de expandir). Dados de piores casos e só pendências que existem hoje (passagem, sem ficha, ficha longe, espera). Recomendação: D em cima + A embaixo + E. Aguardando o usuário escolher.

> 07/10/2026: "Eu gostei muito da 1 e da 2, a 1 o design compacto ta perfeito e a organização da 2 ta perfeito."
- Decisão: juntar A (linha compacta que abre a ficha no lugar) com B (agrupado por cena). Em plano/grilling antes de construir.
- Fatia 1 feita: Grupo agrupado por cena (cena aberta primeiro, ordem da lista de Cenas), título de cena sempre visível e recolhível com Ir à cena / Congelar a cena / Pausar a cena; topo com busca e chip "Pedindo N" + flocos Congelar/Descongelar todos; grupo "Chegando" com o cartão aberto; linha compacta (avatar com ponto de presença, nome, personagem, selos passagem/ficha longe/fora/congelado); ficha que abre no lugar com 5 ações (Ir lá, Seguir, Tela, Recado, Mandar) e abas Mochila · Visão · Ficha; quem acabou de ganhar ficha desce já aberto na aba Ficha. Conferido: tsc (app e e2e), suíte inteira (11925), prévia com 10 jogadores num Chromium isolado. Não conferido: exe, sala de verdade; e2e não roda aqui (vários specs do Grupo devem precisar abrir a linha antes de clicar).
- Fatia 2 feita: pedido de passagem respondido na ficha do jogador no Grupo ("✋ Passagem → <cena>" com os mesmos botões do aviso: Deixar ir/Não; pino trancado: Liberar uma vez/Não; barrada: Passa (quebra a barra)/A barra aguenta). Responder pela ficha fecha o aviso flutuante. Conferido: tsc, suíte inteira (11929), teste da ponte (aviso some, negação vai só a quem pediu), prévia no Chromium isolado. Não conferido no exe nem com jogador de verdade.

> 07/10/2026: "Da commit, push e o instalador."
- Publicado: v0.4.15 (`05f98c45`), https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.4.15. Contagem zerada (0 de 5).

> 08/10/2026: "eu quero fazer algumas atualizações sobre a parte de pincel 1- [Image #2] acho que da para refinar o pincel na parte de balde para não ficar assim 2-Eu quero que o pincel ele sempre fique abaixo de paredes e salas, no caso ele pode pintar o comodo da sala porém ele fica embaixo das paredes, o que acontece é que atualmente [Image #3] nessa situação tem uma parede e tem a pintura por baixo a parede até fica por cima mas eu não consigo por nada selecionar a parede porque o pincel ta por todo lado, quero que ajeite isso eu quero pode selecionar a parede como prioridade 3-[Image #5] No pincel eu quero pode editar ele, igual acontece na sala livre que depois que criamos podemos modificar e tal. 4-[Image #6]mas propriedades do pincel eu quero que tenha a opção criar paredes ao redor e ter a opção de criar parede invisivel(que não da para passar), e as paredes quero que der para trocar de cor e que de para colocar opção de ver e não passar, e de poder não ver. Você vai trabalhar da seguinte forma, pode usar paralelismo, maximo 3 agentes, ambos em opus as tarefas dificeis você coloca em xhigh e as mais faceis só em high, e sempre que você fizer algo de design, ux/ui você colocar effort max, mas só para aquele em específico."
- Imagens 1-3: pintura verde do balde com borda em escadinha ao longo de parede diagonal; a escadinha vaza para fora da linha.
- Imagem 5: traço livre do Pincel selecionado (amarelo) ao lado de outro traço.
- Imagem 6: painel "Desenho" (Oculto para jogadores, Cor, Espessura, Ponta da linha).
- Fila: (1) balde sem escadinha; (2) pincel sempre abaixo de paredes/salas no desenho e na seleção (parede tem prioridade); (3) editar o traço do pincel depois de criado, como a sala livre; (4) "Paredes ao redor" no painel do pincel: parede visível ou invisível, cor, "vê mas não passa" ou "não vê nem passa".
- Modo de trabalho: até 3 agentes em paralelo, todos Opus; difícil = xhigh, fácil = high, design/UX = max só naquele agente.
- Decidido (grilling 08/10): (2) vale para todo desenho do botão Desenho (Pincel, Linha, Curva, Círculo, Elipse, Retângulo, Polígono); texto fica por cima; ordem na tela = chão da sala < desenhos < borda da sala < paredes; clique = Parede > Desenho > Sala. (3) alças nos pontos-chave do traço (arrastar entorta suave, bolinha no meio cria ponto, duplo clique apaga); pintura do balde ganha alça em cada canto. (4) paredes presas ao desenho, com botão "Soltar paredes" (viram paredes normais); traço = contorno dos dois lados da grossura; balde = contorno da área; invisível = jogador não vê mas bate, mestre vê tracejada; passagem "Não vê nem passa" ou "Vê mas não passa"; cor trocável. Recomendador de setup: usuário não quis nenhuma recomendação.
- Ondas: 1) balde + camadas/clique + painel visual em paralelo; 2) edição com alças; 3) paredes ao redor (lógica + ligar o painel).
- Feito (1) `d6796cbb`: contorno do balde por marching squares no eixo da barreira + Douglas-Peucker de um lado; diagonal vira uma aresta, tinta não passa da linha; respeita espessura da parede. Sala com diagonal 352 -> 5 vértices; tempo igual ou menor. Conferido: 74 testes, tsc, imagens antes/depois. Não conferido no exe.
- Feito (2) `5c2b945c`: desenhos do botão Desenho entre o fundo e a borda da sala, abaixo de paredes/portas/escadas (editor e jogador); Texto e Caminho por cima. Clique: ficha > objeto > luz > texto/caminho > parede/porta > escada > desenho > sala; borracha mantém a ordem antiga. Conferido: 135 testes da área, app no Chromium isolado. Não conferido no exe.
- Feito (3) `1f764a53`: alças nos pontos-chave do traço (tolerância 4 px, até 60 alças), arrastar entorta suave, bolinha do meio cria ponto, duplo clique apaga; polígono (balde e forma) com alça por vértice no lugar da caixa; 1 Ctrl+Z por gesto. Conferido: 380 testes da área, app no Chromium isolado. Não conferido no exe.
- Feito (4a) `92675854`: geometria do contorno do desenho para as paredes + parede invisível tracejada fraca para o mestre.
- Feito (4b) `daf9a2d1`: seção "Paredes" no painel do desenho (Paredes ao redor, Visível/Invisível, Cor, Não vê nem passa / Vê mas não passa, "N paredes presas", Soltar paredes). Paredes finas, presas por `Wall.desenhoId`, refeitas num ponto central da store (mover, alças, borracha, desfazer, colar, cena). Clique na presa seleciona o desenho. Invisível muda a passagem para "Vê mas não passa" (dá para voltar). Conferido: suíte inteira (12133 testes, depois do ajuste `ff28a298` no teste do jogador), tsc app e e2e, app no Chrome com perfil temporário (16 prints), tela do jogador sem as invisíveis. Não conferido no exe.
- Achado para a fila (não pedido): `filterMapForPlayer` cresce quadrático com o número de paredes (495 paredes 12 ms, 990 48 ms, 1980 187 ms); vale para qualquer parede, não só as presas.
- Contagem desde a v0.4.15: 4 de 5 (balde, camadas, edição, paredes ao redor).

> 08/10/2026: "Perfeito, a proxima feature é a visão de Jogador [Image #10] para eu ver o que o jogador está vendo ou teste para ver se tudo está certo, testar animações e tal, ok ?"
- Imagem 10: aba Jogo, seção "Sala" com o botão "Abrir sala" e a nota "Rede local".
- Fila: (5) "Visão de jogador" na aba Jogo: o mestre vê o que o jogador vê e testa (névoa, segredos, animações) sem precisar de outro aparelho. Já existe "Ver tela" na ficha do Grupo, mas só com jogador conectado e só olhando.
- Decidido (grilling 08/10, rodada 1): dois modos na mesma visão, "só olhar" e "jogar para testar"; é teste, nada fica no jogo de verdade ao sair; abre em janela separada; o mestre escolhe qualquer ficha do mapa e vê pelos olhos dela.
- Decidido (rodada 2): a janela acompanha na hora o que o mestre muda no editor (o que o teste mudou fica por cima); a névoa começa do que o dono da ficha já viu (sem dono, do zero), com "Esquecer tudo" na janela; no modo Jogar, pedido de passagem aparece no editor marcado "teste" e o mestre responde lá; a ficha é escolhida numa lista (retrato, nome, busca) que abre no botão, com a ficha selecionada no mapa primeiro.
- Decidido (rodada 3): no Olhar a câmera é livre como a do jogador (arrastar e zoom; a ficha não anda e nada é clicado); todos os pedidos do teste (passagem, porta trancada, esconder-se, chamar o mestre, compra) aparecem no editor num grupo "Pedidos do teste"; o editor mostra um fantasma translúcido da ficha onde ela está no teste; uma janela de teste por vez ("Trocar ficha" troca dentro dela).
- Plano do arquiteto (08/10): host de teste na janela principal (segunda ponte com transporte falso + camada de teste por cima do mundo vivo; nada escreve nas stores); janela = página `visao-jogador.html` com o cliente real do jogador sobre um canal (BroadcastChannel); janela aberta por comando Rust próprio; memória do dono pelo caminho de "Retomar a mesa". Fatias: 1 Olhar ao vivo; 2 memória do dono + Esquecer tudo; 3 Jogar + camada; 4 pedidos "teste" + desempenho. Fora da v1: cabine de transporte no teste; chat, dado e laser do teste no editor. Plano completo em `scratchpad/visao-jogador/plano.md` da sessão.
- Decidido (rodada 4, com as telas em maquete; Figma pediu login de novo): barra fina de 40 px logo abaixo do título normal do Windows (mantém o encaixe do Windows); no Olhar, tentar uma ação do jogador mostra "No Olhar, a ficha só vê" com "Passar para Jogar"; o "Ver tela" do Grupo vira atalho para a nova janela no Olhar com a ficha daquele jogador; trocar ficha mantém o mundo do teste e troca só a névoa. Plano e telas aprovados: começar pela entrega 1.
- Feito (entrega 1) `208d8ea8`: botão "Visão de jogador" na aba Jogo (sala fechada e aberta), lista de fichas da cena (busca sem acento, selecionada primeiro), janela separada do Tauri com a tela real do jogador no modo Olhar (câmera livre, ação vira recado), barra abaixo do título do Windows, ao vivo com o editor. Host de teste na janela principal com transporte local; nada grava nas stores (teste de integração: zero toasts, zero setState). Conferido: tsc app e e2e; suíte inteira 12224 de 12225 (o que falhou é `hostSession.custoCom7`, medição de tempo sob carga: sozinho passa em 1,8 s; não foi tocado); app Tauri de verdade dirigido por CDP: segunda janela abre, mostra o mapa, recebe a ficha nova do mestre na hora, "Fechar" da barra e X do Windows fecham e o painel volta; fechar a principal pergunta se quer salvar e, respondido, as duas fecham e o app sai. Prints em `scratchpad/visao/p1/`. Não conferido: exe instalado (só `tauri dev`).
- Feito (entrega 2) `9e9d0d7d`: o teste começa com o que o dono já explorou (explorado e portas vistas, só o térreo), com raio e fator do dono; com a sala aberta lê da ponte real só por leitura, fechada lê a mesa e o explorado gravados; sem dono, do zero. "Esquecer tudo" zera a memória do jogador de teste. "Trocar ficha" lê a memória do novo dono. "Ver tela" do Grupo abre a janela de teste no Olhar na ficha do jogador (o espelho antigo dentro do editor saiu); agora aparece também para jogador desconectado com ficha em cena. Cômodos lembrados, marcas e barras de pino não vêm (a mesa não grava). Conferido: tsc app e e2e, testes da área (net/visaoDeTeste, hostBridge 362, PlayerView 161, Grupo 47). Não conferido no app real.
- Feito (entrega 3, núcleo) `61c29e40`: modo Jogar na barra e no recado ("Passar para Jogar"); a ponte de teste lê "mundo vivo + camada de teste" (transformações por `MapData.id`, reaplicadas sobre o editor ao vivo, passos seguidos da mesma ficha fundidos); andar, porta, itens, ficha, cadeado, marcas, piso, veículo e caravana escrevem só na camada. Fechar limpa; Trocar ficha mantém o mundo do teste. Troca de cena, destrancar, esconder e passagem "pede" recusadas no teste até a entrega 4. Teste de vazamento zero com o cliente real do jogador no Jogar (zero setState, mapa idêntico); provado que acusa vazamento ao trocar os escritores pelos reais. Conferido: tsc app e e2e, 50 testes da visão, hostBridge 362, consumidores de `hostPlayerChanges` 95. Não conferido no app real. A caravana no mapa-mundi não anda pelo jogador (a sessão já recusa; só pelo mestre).
- Feito (entrega 3, fantasma) `a614122b`: no editor, cópia translúcida da ficha onde ela está no teste (0,6 de opacidade, anel tracejado claro, pílula "Teste", ligação pontilhada até a ficha real; desliza 240 ms; some em 170 ms; movimento reduzido só muda opacidade). Não se clica, arrasta, apaga nem exporta. Conferido: 51 testes novos, 323 da área do canvas, prints em `scratchpad/visao/fantasma/`. Só aparece na cena onde a ficha real está.
- Feito (entrega 4) `57816ce0`: todos os pedidos do teste (passagem no pino, pino trancado, porta trancada, esconder-se, chamar o mestre, compra) chegam ao editor como "Teste · …" na caixa própria "Pedidos do teste", fora da caixa real e do "Deixar todos"; os botões respondem só à ponte de teste; fechar ou trocar ficha dispensa os pendentes. Troca de cena só no teste (núcleo puro `lib/travessiaDaFicha.ts`, `transferToken` virou invólucro com o mesmo comportamento). Broadcast de teste a cada 150 ms e parado com a janela minimizada: arrastar parede 1 s num mapa de 990 paredes custava ~450 ms do editor, ficou ~240 ms (0 minimizada); o pico de um recorte continua 50-80 ms (causa: `filterMapForPlayer` quadrático, já na fila).
- Feito (acabamento) `72ed9671`: cartão "Pedidos do teste" neutro e tracejado (sem latão); fantasma também na cena de destino quando a ficha viajou no teste; o teste fecha ao trocar de aventura. Diagrama `docs/diagrams/visao-de-jogador.html` + `docs/diagrams/INDEX.md`.
- Conferido no app Tauri de verdade (tauri dev, dirigido por CDP, prints em `scratchpad/visao/p1/final/`): Jogar, Ana andou até o pino só no teste (editor com a Ana real parada e o fantasma "Teste" ligado por pontos); pino pediu "Chegue mais perto" antes e "Pedir" depois; no editor apareceu "Pedidos do teste (1) · Teste · Ana quer passar por Porta da cripta → Cripta"; "Deixar ir" levou a Ana para a Cripta na janela ("Você chegou"); jogo real intacto (Ana em 320,320 na cena de origem, Cripta com 0 fichas); fantasma apareceu na Cripta ao abrir a cena no editor; fechar o teste apagou o fantasma. Não conferido: transição 3D especial (o pino de teste não tinha uma configurada), exe instalado.
- Achados para a fila (não pedidos): moldura de latão do pedido REAL não aparece hoje (`.lb-panel` vence `Toast.css:144`; conserto `.lb-panel.lb-toast--instrucao`); anel de foco cortado na borda esquerda da caixa de avisos; fantasma não sabe o piso (em cena com andares aparece no piso em edição).
- Contagem desde a v0.4.15: 5 de 5 (balde, camadas, edição, paredes ao redor, visão de jogador) → push + instalador.

> 08/10/2026 (na hora do instalador): "Pera, vocÊ está fazendo tudo no programa principal né? não mandei fazer em clone de nada" — sim, tudo na main de `C:\dev\labirinto`; a cópia limpa era só para o instalador não levar a escada espiral sem commit. Perguntado como gerar: "termina a escada primeiro".
- Fila: terminar a escada espiral (4 arquivos sem commit desde 28/09: `lib/stairs.ts`, `lib/stairs.espiral.test.ts`, `pixi/drawStairs.ts`, `pixi/drawStairs.test.ts`; backup `scratchpad/escada/escada-antes-de-terminar.patch`), commitar, e só então push + instalador v0.4.16.
- Feito: escada espiral `1b146e6f` (mesmo estilo da escada reta: patamar e degraus no ritmo da reta, editor e jogador). O agente foi parado no meio da conferência pelo custo ("430k de tokens para uma escada ?"); o que ficou passou em 112 testes da escada e no tsc, e foi visto num print do app.
- Publicado: v0.4.16 (`1eef834f`), https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.4.16. Contagem zerada (0 de 5).

> 08/10/2026: "Eu quero adicionar uma featura a todas as salas, tem certas salas que eu quero está dentro mas quero que de para ver o que está fora, ae cria uma botão que da essa propriedade para sala."
- Hoje: a visão é por linha de visão; de dentro da sala as paredes dela bloqueiam e só se vê fora pela porta. Já existe "Deixa ver" por parede (uma a uma), nada por sala.
- Fila: botão no painel da Sala que dá a propriedade "de dentro, vê o que está fora".
- Decidido (grilling 08/10): duas chaves no painel da Sala, "De dentro, vê lá fora" e "De fora, vê aqui dentro" ("Os dois lados coloque para eu pode configuar"); só a visão atravessa (paredes continuam barrando a ficha); alcance = raio normal do jogador; paredes com a mesma cara para o jogador, selo na sala no editor; teto fechado vence (a chave "De fora" fica apagada com o motivo).
- Feito: `RoomMeta.dentroVeFora` / `RoomMeta.foraVeDentro` (só `true` volta do disco; não saem para o jogador). Atravessam o olhar as paredes com `Wall.regionId` da sala, portas incluídas (porta secreta também, para a sombra não entregar a passagem); parede solta desenhada por cima continua bloqueando. Visão por ficha com cache; sem sala usando, mesmo caminho de antes (990 paredes: ~1,5 ms; 20 salas ligadas +0,35 ms). Guardas NPC e luzes não mudam. Painel: as duas chaves depois de "Sala escura"; com teto, "De fora" apagada com a dica. Editor: "👁" no nome da sala. Conferido: tsc app e e2e; 969 testes da área (21 novos); app Tauri real pela Visão de jogador: Ana dentro da sala, sem a chave só vê a sala, com "De dentro, vê lá fora" vê o goblin lá fora; painel com a chave ligada. Não conferido: "De fora, vê aqui dentro" no app (só nos testes), exe instalado. Limitação: de dentro de sala transparente, olhar pela janela de um prédio de teto fechado não atravessa o muro da sala.
- Contagem desde a v0.4.16: 1 de 5.

> 08/10/2026: "Vamos fazer um sistema completo de Fichas e Sistema de Rpg, veja eu tenho varios sistemas para cada um do meu rpg eu imagino poder vincular a uma mapa o seguinte [Image #11] e como primeiro Sistema eu quero o de one piece, você pode tirar o sistema da que C:\dev\projeto-rpg-v2, contudo não vamos fazer sistema de batalha ou seja não vai ter nada de iniciativa, batalha e tal, o Sistemas vai funcionar para o Jogadores verem o tipo de fichas dele ou seja nesse de one piece [Image #12] a ficha vai ser desse tamanho e tal, e os jogadores eles vão poder editar a ficha, criar e modificar, e eu imagino tendo o livro de regras e tal, junto ao inventário, fora isso precisamos de um sistema de itens, hoje é feito com pinos mas eu quero um sistema só disso, eu quero poder colocar os itens no ambiente, na forma de pino mas um pino de item especifico para item ou em imagem, e é bom ter um local para salvar os itens e as imagens dos itens tem que ficar salvos no inventario quando eles pegaram."
- Imagem 11: rascunho de uma grade de cartões ("Sistema de Rpg 1", "Sistema de Rpg2", vazios) e um "+" para criar outro.
- Imagem 12: ficha do One Piece no projeto-rpg-v2: selos Humano/Gatuno; cartão com retrato, nome Alexei + selo JOGADOR, "Idade/Raça/Ofício/Rifle", HP 600 / SP 60 / ESCUDO 12, ATRIBUTOS (Força, Agilidade, Percepção, Resistência, Intuição com R1/R2/R3); abas Habilidades/Perícias/Vantagens/Desvantagens/Transformações com cartões (Armadilhar: texto, Ação, Efeito, Custo, Tempo e linhas extras).
- Fila: (A) sistemas de RPG por aventura/mapa (grade com "+"), o primeiro é One Piece tirado de `C:\dev\projeto-rpg-v2`, SEM batalha/iniciativa; ficha do sistema que o jogador cria e edita, livro de regras, inventário. (B) sistema de itens próprio: catálogo salvo com imagem, item no mapa como pino de item ou imagem, item pego vai com a imagem para o inventário.
- Decidido (grilling 08/10): sistema ligado à AVENTURA (biblioteca de sistemas do app em grade com "+"); "+" adiciona outro sistema ("Eu iamgino poder editar tudo, mas sei que é dificil" → arquivo de sistema agora, editor completo na última entrega); jogador edita a própria ficha, mestre todas, sem aprovação; ficha é do PERSONAGEM, ligada ao token (`Token.characterId`, hoje sem uso); catálogo de itens = biblioteca do app; pegar item direto OU pedir ao mestre, como propriedade de cada item ("cada item ter propriedades é claro, como os pinos"); mochila de hoje vira o inventário da ficha; ficha do jogador em tela cheia por um botão "Ficha"; importar só os JOGADORES do projeto-rpg-v2 ("os npcs não vai precisar, Os npcs podem ter ficha mas foque nos jogadores"); livro de regras lido do banco do projeto-rpg-v2 (tabela de notas de regras; sem tocar em segredos).
- Plano aprovado (ordem): 1 sistemas + ficha no mestre (One Piece pronto, grade, fichas na aventura ligadas ao token, importar jogadores); 2 ficha do jogador em tela cheia (criar/editar, rede); 3 livro de regras (catálogos + capítulos do banco); 4 biblioteca de itens com imagens (rota de mídia, inventário unificado); 5 itens no mapa (pino de item ou imagem, propriedades, pegar/pedir, imagem preservada); 6 editor de sistemas.
- Fatos: One Piece = 8 atributos com rank R1-R13 por tabela própria (`domain/rank.rs`), HP/SP/Escudo digitados, abas Habilidades (Ação/Efeito/Custo/Tempo/Dano + campos extras), Perícias (multi-atributo), Vantagens/Desvantagens, Transformações (modificadores + habilidades); catálogos na migration 0013; raças (6) e ofícios (10) fixos; regras em prosa só no banco (tabela `nota`). Mapas detalhados em `scratchpad/rpg/` da sessão aff6ff7e.
- Feito (entrega 1) `13b66166`: sistema como dado (`lib/sistemaDeRpg.ts`), One Piece embutido (`lib/sistemaOnePiece.ts`, tabelas de rank de `rank.rs` conferidas), biblioteca em `<appData>/sistemas`, `adventure.json` com `sistemaDeRpg` + `personagens`; no editor, "Sistema de RPG" (grade + "+" importa arquivo) e "Personagens" (lista, criar, importar, apagar), ficha no visual do print com Editar/Salvar, token ligado pelo painel ("Personagem" + "Abrir ficha"). Importados os 9 jogadores do banco real (Aira, Alexei, Guilherme, Harvey Solferino, Jimboy Segundo, May D. Ark, Ryoko D. Violet, Siegfried, Vagn Kane) para `scratchpad/rpg/jogadores-projeto-rpg-v2.json` (só tabelas de personagem; cópia do banco apagada). Conferido: 62 testes novos, 928 da área, tsc app e e2e, 3 prints. Não conferido: diálogos de arquivo e gravação no appData dentro do Tauri real. Mapa solto não tem a seção (sem adventure.json). Contagem desde a v0.4.16: 2 de 5.
- Feito (entrega 2) `2ade40e6`: botão "Ficha" na barra do jogador abre a ficha em tela cheia (2 colunas no PC, empilhada abaixo de 760 px; abaixo de 380 px os botões viram só ícone): criar, editar, salvar, retrato reduzido no aparelho. Mensagens novas validadas no host (só personagem de token que é do jogador; tetos de tamanho; 20 pedidos a cada 10 s; recusa sempre ok:false); cada jogador só recebe a própria ficha; sistema enviado uma vez por conexão; retrato fora do mapa; abas grandes em pacotes de até 64 KiB. Edição do mestre chega ao jogador na hora; aviso ao mestre quando o jogador cria ficha. Visão de jogador: ficha editada na janela de teste não muda a real (teste de vazamento). Conferido: 89 testes novos, 3083 das áreas tocadas, tsc app e e2e, 2 prints com host de mentira (1280 e 320 px). Não conferido: celular de verdade, Tauri real. Conflito mestre x jogador: vale a última gravação. Contagem desde a v0.4.16: 3 de 5.
- Feito (entrega 3) `827ad84e`: livro de regras no sistema (capítulos com marcação leve sem HTML; catálogos). One Piece: 14 capítulos e 47 perícias, 30 vantagens, 47 desvantagens, 6 raças, 10 ofícios (lidos do banco: só notas de regras e tabelas de catálogo; cópia apagada). Livro vai ao jogador sob demanda em partes de até 48 KiB; `rpg.sistema` caiu de 127 KB para 3 KB. Mestre: "Livro de regras" na zona Aventura e "Livro" na ficha; jogador: "Livro" dentro da Ficha. Busca sem acento, catálogos com filtro, "Escolher do livro" ao editar Perícias/Vantagens/Desvantagens. Conferido: 101 testes novos, 346 da área, tsc app e e2e, 2 prints. Contagem desde a v0.4.16: 4 de 5.

> 08/10/2026: "Perfeito, eu vi aqui e até importei, mas quero fazer uma coisa, quer oque os jogadores sejam capazes de modificar os personagens e eu tambem." → perguntado o que mudar: "No caso modificar tipo, aumentar status, quantidade de mana, quantidade de vida."
- Decidido: HP e SP viram atual/máximo com −/+ e campo de dano/cura direto no quadro (sem Editar/Salvar); atributos com −/+ direto e rank recalculado; vale para o mestre e para o jogador na ficha dele; registro discreto (histórico na ficha + aviso pequeno no editor), sem aprovação.
> 08/10/2026: "Lembre-se que tem uma diferença entre aumentar o status e aumentar o modificador."
- Decidido: atributo = status BASE + MODIFICADOR separados (−/+ em cada um, histórico diz qual); rank calculado sobre base + modificador; transformação ganha "Ativar" e, ativa, soma os modificadores dela; HP e SP também têm modificador separado do máximo (máximo efetivo = base + modificador).

> 08/10/2026: "Para os jogadores quero tambem fazer algumas melhorias, para você fazer depois: 1-[Image #14] quero que de para para aumentar o tamanho da imagem, coloca uma botão que expande para o jogador ver tudo 2-[Image #15] quando um jogador clicar em um token [Image #16] coloca nessa parte a imagem do jogador do lado da ação que ele quer fazer e eu quero só a Falar, Ação(Que é agir com ou contra o token como beijar ou lutar), e por ultimo entregar item. 3-Quero que no chat [Image #17] apareça a miniatura da foto do Token. 4-[Image #18] nessa parte, eu quero só Sinalizar, Andar até aqui, chama o mestre aqui. 5-[Image #19] Na parte de anotações isso tem que ficar fixo ao jogador para tudo que ele já viu mesmo em outro mapa, as [Image #20], as pistas podem ser por mapas, e você pode tirar os Recados, não precisamos disso, contudo Minhas Notas tem que ficar salvo, minhas pistas você pode passar para Lugares. 6-[Image #21] tira isso aqui, não é necessário 7-[Image #22] nessa parte coloque o botão Marcações e onde é possivel abrir e vai ficar "Marcar Destino", "Anotar", "Deixar Marca Aqui..." 8-[Image #23] tira o Centralizar no meu personagem uma vez que já tem o botão minha ficha."
- Imagem 14: cartão do pino "Ponto de interesse" com a imagem (torre da Marinha) pequena no alto. Imagem 15: tokens May e Alexei. Imagem 16: menu ao tocar na May: Falar, Oferecer, Pedir ajuda, Empurrar, Outro. Imagem 17: mensagem do chat "Alexei 19:47 Olá" sem foto. Imagem 18: menu do toque longo: Sinalizar, Procurar, Escutar, Espiar, Revistar, Andar até aqui. Imagem 19: aba Caderno (Minhas pistas, Recados, Minhas notas, Levar para casa). Imagem 20: Minhas pistas. Imagem 21: Bilhete ("Escrever bilhete") e Encontro (Por quem, Onde, Até, "Esperar aqui"). Imagem 22: lista Marcar destino, Anotar, Medir, Laser, Mostrar meu mapa a…, Deixar marca aqui…, Volto já. Imagem 23: "Centralizar no meu personagem".
- Fila (depois): (1) botão de expandir a imagem do pino; (2) menu do token: retrato do jogador ao lado e só Falar, Ação (agir com/contra: beijar, lutar) e Entregar item; (3) miniatura da foto do token no chat; (4) menu do toque longo só Sinalizar, Andar até aqui, Chamar o mestre aqui; (5) Caderno: Minhas notas fixas ao jogador e salvas (todos os mapas), pistas por mapa e movidas para Lugares, Recados sai; (6) tirar Bilhete e Encontro; (7) botão "Marcações" que abre Marcar destino, Anotar, Deixar marca aqui…; (8) tirar "Centralizar no meu personagem".
- Decidido: as 8 melhorias do jogador vêm DEPOIS de todo o sistema de RPG (ajustes rápidos, biblioteca de itens, itens no mapa, editor de sistemas). "Ação" no menu do token: o jogador escreve o que faz ("beijar", "atacar com a espada"); vai como pedido ao mestre e aparece para o outro jogador.
- Feito (ajustes rápidos) `d138d61c`: atributo com base + modificador (rank sobre o total, transformações ativas somam), HP/SP atual/máximo com modificador no máximo, Escudo com −/+, "Ativar" nas transformações, dano/cura digitado ("-50", "+30", "50" = valor exato), histórico de 100 linhas (mesmo campo e mesma pessoa em 5 s viram uma), aviso ao mestre por jogador e ficha; jogador agrupa cliques (400 ms) abaixo do limite. Conferido: 68 testes novos, 300 da área, tsc app e e2e, 2 prints (1100 e 375 px). Não conferido: Tauri e LAN. Custo anotado: cada clique do mestre reenvia a ficha inteira (com retrato) ao dono; a rota de mídia da entrega de itens tira o retrato desse envio. Contagem desde a v0.4.16: 5 de 5 → push + instalador.
- Publicado: v0.4.17 (`eb4f3a55`), https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.4.17 (ver através das paredes da sala, sistemas de RPG entregas 1-3, ajustes rápidos). Suíte 12685/12685, tsc app e e2e, gitleaks v0.4.16..HEAD sem achados, exe 0.4.17 abre. Contagem zerada (0 de 5). Próximo: biblioteca de itens.
- Decidido (biblioteca de itens, 08/10): campos nome, imagem, descrição, categoria, preço e quantidade (empilha); inventário da ficha em grade de imagens (tocar abre o item grande com Usar/Dar/Largar); catálogo como "Uma categoria abaixo dos tokens, a forma de colocar imagem é a mesma pode ser por copia e cola, pode ser arrastando a imagem e pode ser selecionando no computador."

> 08/10/2026: "Ok, eu quero que vocÊ faça o seguinte então: 1- [Image #26] eu quero que você coloque uma forma de organizar em pastas e que essas pastas de para configurar o Sistema Universal e os Jogares principais, tendo que importar só uma vez, claro que caso eu quero eu quero poder configurar separadamente, então coloque as duas opções 2-Essa parte de Sistema de Rpg, fica dentro de Configuração do mapa [Image #27] 3- Livro de regras personagens ficam em [Image #28] 4-[Image #29] Eu quero poder ter uma opção de escolher qual mapa quando eu aperto para entrar é o padrão, eu botei aqui o subterraneio mas eu queria colocar [Image #30] o reino de goa como padrão quando eu clicar em entrar. 5-Isso aqui é grande mas vamos lá, eu quero uma sistema de Login, para os jogadores, pode ser com o google, você pode ver isso aqui C:\dev\projeto-rpg-v2 e C:\Users\gedasio.filho\OneDrive - Vertis Capital\Área de Trabalho\Tudo\Projeto Obsidian, cada Login eu vou pode alocar os personagens deles, assim quando haver sessão vai ficar mais facil de eles entrarem, vai ficar mais facil de eles editarem as fichas deles, e tal, eu quero que eles possam entrar com o google que é simples e fica facil."
- Imagem 26: tela "Carregar Mapa" com 5 mapas (Arquipélago do Ventos: Parte Selvagem, Sky Lagoon, Tasmaturi Village, Reino de Goa, Resident Evil 3), Renomear/Duplicar/Excluir, "Procurar no disco…". Imagem 27: "Configurações do mapa" (Grade, Alinhar grade, Medição, Movimento dos jogadores…). Imagem 28: aba Jogo, seção Sala (Abrir sala, Visão de jogador, Rede local). Imagem 29: lista de Cenas com "Subterraneo" (marcada) dentro de "Reino de Goa", e Barco Abandonado/Caverna dentro. Imagem 30: "Reino de Goa" acima de "Subterraneo".
- Contexto: o mapa "Arquipélago" do usuário abre como mapa solto, e a seção de RPG não aparecia (erro meu: a decisão era "mapa solto também pode escolher").
- Fila: (1) pastas em "Carregar Mapa" com Sistema universal e Jogadores principais configurados na pasta (importar uma vez), e opção de configurar só no mapa; (2) "Sistema de RPG" dentro de Configurações do mapa; (3) "Livro de regras" e "Personagens" na aba Jogo, junto da Sala; (4) escolher a cena padrão ao entrar (Reino de Goa, não Subterrâneo); (5) login dos jogadores com Google, mestre aloca personagens por login.
- Decidido: pasta com UMA cópia compartilhada (sistema + fichas da pasta valem para todos os mapas dela; mapa pode "Configurar só neste mapa"); login PRÓPRIO do app (nome + PIN que o mestre cria para cada jogador; sem Google); os 5 pedidos entram DEPOIS do RPG (itens no mapa e editor de sistemas). O conserto do mapa solto sem seção de RPG (erro meu) entra logo depois da biblioteca de itens.

> 08/10/2026: "Dessa vez não pare para dar push a cada 5 features e tal, você só vai fazer isso quando terminar tudo."
- Regra para esta fila: commit por feature na main, sem push nem instalador até terminar tudo (RPG, conserto do mapa solto, os 5 pedidos, as 8 melhorias); no fim, um push + instalador.
- Decidido (última rodada, 08/10): ordem = RPG (biblioteca de itens → conserto do mapa solto → itens no mapa → editor de sistemas) → as 8 melhorias do jogador → os 5 pedidos (pastas, locais, cena padrão, login); item no chão como imagem se comporta como objeto do mapa (arrasta e redimensiona; jogador vê na visão e toca para Pegar/Pedir); login nome + PIN só na primeira vez (aparelho lembrado, "Sair" troca de conta); autonomia: decido os detalhes que faltam seguindo as escolhas já feitas, anoto cada decisão aqui, só paro em algo arriscado ou que mude arquivo do usuário. Sem push/instalador até o fim.
- Feito (entrega 4, biblioteca de itens) `5ce8a5ee`: "Itens" abaixo dos tokens (imagem por colar/soltar/escolher, nome, descrição, categorias editáveis, preço, empilhável, "Dar a…"); mídia por hash em `<appData>/midia` servida em `/media/<sha256>.<ext>` (id estrito, 2 MB, conteúdo confere com tipo e hash, mesmo 404 para toda recusa); retratos e imagens de cartão viram referência de mídia (para de reenviar retrato a cada clique); mochila = inventário da ficha em grade de imagens com quantidade. Conferido: 72 testes novos, 539 da área, clippy, tsc app e e2e. Não conferido: Tauri real. Decisão minha (risco achado): retrato convertido para mídia do appData não viajaria com a aventura copiada para outro PC → próxima tarefa guarda a mídia usada também na pasta da aventura.
- Feito (conserto do mapa solto + locais, pedidos 2 e 3 de 08/10) `848aa133`: "Sistema de RPG" em Configurações do mapa ("Escolher/Trocar sistema…" abre a grade); "Livro de regras" e "Personagens" na aba Jogo, abaixo da Sala; nada mais na zona Aventura. No mapa solto aparecem; escolher sistema pergunta "Para guardar sistema e fichas, este mapa vira uma aventura (o mapa continua igual). Transformar?"; sim vira aventura com uma cena só (o mapa aberto, mesmo arquivo e id); Salvar grava o adventure.json na pasta do mapa. Conferido: 13 testes novos, 125 da área, tsc app e e2e. Não conferido no app instalado.
- Feito (mídia vai junto) `8d8b8393`: ao salvar, a mídia usada vai para `<aventura>/midia/` (mapa solto: `<nome>.midia/` ao lado do arquivo); ao abrir, volta para o appData com tamanho e hash conferidos; nada é apagado; imagem faltando vira aviso. Exportar/importar pasta passou a copiar subpastas (antes quebrava com `scenes/`). Conferido: 20 testes novos (ida e volta "salva no PC A, apaga appData, abre no PC B"), tsc app e e2e. Não conferido no Tauri real.
- Feito (entrega 6, editor de sistemas) `70971270`: grade com "+" (Em branco, Copiar de…, Importar arquivo…) e Editar/Duplicar/Exportar/Apagar em cada cartão (One Piece: edita uma cópia sua); editor com Geral, Escolhas, Recursos, Atributos (prévia "valor 60 → R2"), Abas, Catálogos, Livro e prévia da ficha; Salvar valida tudo e mostra os erros por seção; fichas existentes não perdem dado (id trava, removido fica guardado). Edição chega aos jogadores pela sala. Decisões minhas: sistema em branco abre com um atributo; cópia "Nome (cópia)"; Salvar mantém aberta a janela. Conferido: 60 testes novos, 144 do RPG, tsc app e e2e. Não conferido: visual do editor (só testes), disco do Tauri real.
- Feito (entrega 5, itens no mapa) `75883549`: arrastar item da grade "Itens" para o mapa → imagem no chão (objeto: move, redimensiona, gira, oculta) ou, com Alt/sem imagem, pino de item (ícone de saco); painel com nome, "Pega sem pedir ao mestre", quantidade, trocar imagem/pino. Jogador toca → cartão com imagem grande e "Ver inteira" (melhoria 1 da lista do jogador feita aqui), "Pegar"/"Pedir para pegar"; longe, botão apagado. Item pego mantém imagem e dados e empilha; largar devolve inteiro (imagem se tem, pino se não). Lojas sem mudança (decisão: vender item do acervo pede editor de loja). "Uma vez só" não virou campo (pegar já tira do mapa). Conferido: 61 testes novos, 647 + 540 da área, tsc app e e2e. Não conferido no app real (arrasto até o canvas, imagem no canvas do mestre).
- Feito (8 melhorias do jogador, itens 2-8) `ab60c122`: menu do token com retrato e só Falar / Ação (escrita, até 120) / Entregar item, mestre responde Deixar/Não e o dono do outro token recebe aviso; foto do token no chat (jogador e mestre); toque longo só Sinalizar, Andar até aqui, Chamar o mestre aqui (com local; grupo "Chamados"); Minhas notas fixas ao jogador em todos os mapas, salvas no disco do mestre por nome (`lb-mesa-notas:<mesa>`) e devolvidas ao reentrar; Recados fora; pistas em Lugares por lugar; Bilhete e Encontro fora; botão "Marcações"; "Centralizar no meu personagem" fora. Decisões minhas: aviso ao outro só no Deixar (Falar e Ação); notas antigas só do localStorage não são importadas (não dá para saber de quem são); "Chamar o mestre aqui" numa sala oferece as pistas escondidas dela. Conferido: 1626 testes da área, tsc app e e2e, build. Não conferido: navegador, Tauri, LAN. Pendências: código de bilhete/espera/recados ainda no protocolo e no lado do mestre (sem tela do jogador); e2e `task-jornada-mapa-livre-do-painel.spec.ts` ainda clica o botão removido.
- Feito (pastas, cena inicial e login — pedidos 1, 4 e 5 de 08/10) `024b2b29`: pastas no Carregar Mapa (criar, renomear, recolher, apagar sem apagar mapas, mover por arrasto ou "Mover para pasta…"); pasta com "Sistema universal" e "Jogadores principais" numa cópia só (`<appData>/pastas/<id>/rpg.json` + `midia/`); "Configurar só neste mapa"/"Usar o da pasta" em Configurações do mapa; "Definir como cena inicial" no menu da cena (marca ⌂), aventura abre nela; contas dos jogadores (nome + PIN, PBKDF2 600 mil iterações, aparelho lembrado, "Sair", bloqueio progressivo, mestre aloca personagens, fichas entregues no login, "Só com conta" opcional). Decisões minhas: pasta sem sistema só organiza; trocar sistema num mapa que herda troca o da pasta; "Só com conta" vale para o app todo (arquivo das contas). Conferido: 32 + 56 testes novos, áreas vizinhas, tsc app e e2e. Não conferido no app real.
- Publicado: v0.4.18 (`00d590f3`), https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.4.18 — fim da fila longa (itens, mapa solto e novos lugares, mídia na pasta, editor de sistemas, itens no mapa, 8 melhorias do jogador, pastas, cena inicial, contas). Suíte inteira 13021/13023 antes do conserto do teste do caderno (`432339cd`); a outra falha é medição de tempo sob carga (`paredesDoDesenho` <30 ms), sozinha verde. tsc app e e2e limpos; gitleaks v0.4.17..HEAD sem achados; exe 0.4.18 abre. Conferência visual no app de dev (só leitura): Carregar Mapa com "+ Nova pasta"/"Mover…", aba Jogo com Personagens e Contas, grade de sistemas pelas Configurações do mapa, tela do jogador com "Marcações" e sem "Centralizar". Não conferido: criar pasta/conta/item no app real (evitei gravar na pasta de dados do usuário), LAN com celular.

> 09/10/2026: "Ok, o que não está funcionando: 1- [Image #31] mesmo eu criando um personagem e vinculando ele a um token, não consigo ver a ficha [Image #32] 2- no chat é só para aparece a miniatura quando fala [Image #33] como o mestre [Image #34]." Depois: "3-[Image #35] quando eu clico em outro token é a imagem do token que tem que aparece não a minha nesse caso da imagem deveria aparece a imagem dela [Image #36]" e "4- [Image #37] não consigo arrastar o item para o mapa e nem faze-lo virar pino". Depois: "Pronto, já faz o instalador."
- Imagem 31: ficha do mestre "Saga" (Jogador) ligada ao token Saga da cena. Imagem 32: jogador vê "Sem ficha por enquanto". Imagem 33: fala do jogador "Saga" com a foto do token enorme. Imagem 34: fala do mestre com a bolinha "M". Imagem 35: menu do token Rigel com a foto da Saga. Imagem 36: token Rigel no mapa. Imagem 37: poção sendo arrastada sobre o mapa sem cair.
- Feito: `fc47638d` peça vinda da biblioteca de Tokens nasce NPC e o host escondia a ficha; personagem do tipo Jogador ligado a ela agora vai ao dono (tipo NPC continua do mestre). `38950cb1` miniatura de 20px em toda fala do chat (comentário colado no seletor a prendia à fala do mestre). `8fb2cb21` menu do token mostra a foto do token tocado. `e65636a1` arrasto do item ao mapa (o arrasto nativo da imagem cancelava o gesto).
- Decidido: v0.4.19 com estes 4 consertos (pedido do usuário, antes de completar 5).

> 09/10/2026: "1-Ao fechar o invetario com um jogador no celular isso acontece [Image #38] 2-[Image #39] Eu como mestre quero poder apertar o botão direito no token que o jogador controla e aparecer umas opções como Congelar e Enviar uma mensagem."
- Imagem 38: celular (Chrome Android, túnel trycloudflare), depois de fechar o Inventário a área do mapa fica toda branca, com um ícone de imagem quebrada no canto; barra e botões normais. Imagem 39: clique direito no token "Alexei" no editor abre o menu do navegador (Salvar imagem como / Copiar imagem).
- Feito: `0d241876` o contexto WebGL do mapa do jogador perdido (celular com pouca memória, mapa escondido atrás do inventário) remonta o Pixi inteiro; mais de 3 perdas em 60 s mostram "O mapa parou de ser desenhado". Não confirmado no celular real.
- Feito: menu de clique direito no token que um jogador da sala controla: título com o nome, "Congelar"/"Descongelar" (mesmo caminho do painel do token, Ctrl+Z desfaz) e "Enviar mensagem…" (o "Recado" só para ele: chega como cartão "Só para você"; caiu, recebe ao voltar). Decisões minhas: só token com jogador na sala tem o menu (os outros seguem como antes); com 2 jogadores no mesmo token, "Mensagem para <nome>…" para cada; o menu ganha da porta e da parede embaixo do token; o botão direito nele não seleciona nem começa traço.

> 09/10/2026: "Agora sobre animações das portas, escadas e as animações das imagens do Pino, eu gostaria que o programa ele visse pelo github sabe? porque eu vou pedir para você fazer varias animações e não seria legal a cada uma fazer um instalador novo."
- Respostas (grilling): "Eu quero o 1 e 2, eu quero que o programa se atualize sozinho, mas quero que animações sejam mais rapidas." = pacote de animações baixado do GitHub E atualização automática do app; procurar "Ao abrir e no botão"; vêm pelo GitHub: transições de viagem, porta abrindo no mapa, imagem do pino animada; versão nova do app "Pergunta antes"; chave de assinatura "Sem senha, no seu PC" (fora do repo); animação nova publicada "Logo que você aprovar" (o app segue no ritmo de 5 consertos).
- Feito (09/10): A `225e9d6c` atualizador (v0.4.20, última instalação manual); C `49683695` porta animada; D `c4779110` estilos do cenário do pino; B `d426387d`+`65883485`+`d389b8ad`+`b369ea20` pacote assinado (Rust baixa/verifica/serve, TS registra nos 3 registros, `scripts/pacote-animacoes.cjs` publica). v0.4.21 sai pelo atualizador; pacote vazio (versão 1) publicado na release pré-lançamento `animacoes`.
- Animação nova daqui em diante: protótipo (Artifact) para aprovar → `client/src/animacoes/<tipo>/<id>.ts` + `<id>.json` → `node scripts/pacote-animacoes.cjs --publicar`.

> 09/10/2026: "Perfeito, a você já faz animação dessa porta abrindo [Image #40] é um portão, fundo preto e na animação coloque como se fosse dificil abrir esse portão. Lembre-se estilo resident evil 2 antigo. E mes mostra antes de enviar."
- Imagem 40: portão de duas folhas azul-acinzentado, tábuas verticais, bandeira em arco com grade, emblema azul-escuro (curvas tipo gaivota) cruzando as folhas.
- Decidido: é uma TRANSIÇÃO especial (tela cheia ao atravessar pino/escada), id `portao-pesado`, "Portão pesado"; vai pelo pacote do GitHub SÓ depois que o usuário aprovar o protótipo (página publicada).

> 09/10/2026: "faz duas animações uma de subindo a escada e a outra de descer a escada estilo resident evil, a ecada vai ser de madeira, vai ser estilo a de pedra só que diferen da de pedra que já existe coloca paredes de madeira do lado."
- Decidido: duas transições do pacote, `escada-madeira` ("Escada de madeira subindo") e `escada-madeira-descendo` ("Escada de madeira descendo"), mesma cena com sentido trocado (molde da escadaria de pedra), paredes de madeira dos dois lados; um designer só para as duas, em paralelo com o portão; protótipo para aprovar antes de publicar.
- Protótipo v1: https://claude.ai/artifact/MW2Khu5m6TCx3sLECcUTPX (09/10, tarde).
- > 09/10/2026, depois do protótipo: "Da escada de madeira, deixa só de passadas não coloca o som de ficar rangindo." — tirar o rangido nos dois sentidos, só passadas. Feito no protótipo v2 (mesmo link).
- > 09/10/2026: "A escada eu aprovo, pode subir para o github" — escada de madeira APROVADA: `aprovadas.json` e pacote do GitHub.

> 09/10/2026: "Faz uma animação de escada subindo e descendo [Image #42] só que essas escada ela vai curvando que nem na foto, ela tem essa lateral azul e a escada é feito de uma pedra branca, o fundo é preto, e continua estilo resident evil, faça uma agente só para trabalhar nisso"
- Imagem 42: escadaria curva de pedra branca subindo junto a uma parede de pedra clara, guarda-corpo azul (balaústres e corrimão azuis, pilares azuis com remate redondo), arandelas, porta azul em arco embaixo.
- Decidido: duas transições do pacote, `escada-curva` ("Escada curva subindo") e `escada-curva-descendo` ("Escada curva descendo"), fundo preto, clima RE clássico; um agente dedicado (3ª vaga em paralelo, com o portão e a escada de madeira); protótipo para aprovar antes de publicar.
- Protótipo v1: https://claude.ai/artifact/BubPqruyKWiQbdipJ8BQPQ (09/10, tarde).
- > 09/10/2026: "Quero o Pino A, é o melhor. E gostei da Animação da Escada curva." — escada curva APROVADA: entra em `aprovadas.json` e vai ao pacote do GitHub.

> 09/10/2026 (tarde, com as escadas em andamento): "Sabe outra coisa que eu gostaria que você trabalhasse: 1-[Image #1] consegue ver esse mapa? ele é um mapa de continente, não de cidade ou sala, eu queria poder configurar se o mapa é um mapa normal ou de continenente, o mapa de continente para os jogadores só tem uma diferença é que ao invés do token o jogador vai se mover por esse pino [Image #2] que para cada jogador vai ter uma coloração diferente, esse pino tem uma animação da piramide embaixo dele ficar girando, ele é do shin megami tensei, você pode dar uma boa olhada."
- Imagem 1 (cópia em `C:/dev/hud-evidencia/pedido-continente-mapa.png`): mapa de continente no editor, mar azul-escuro, regiões chapadas (areia, verdes, teal, marrom com vulcões, gelo cinza-azulado), contorno claro fino, um oásis/cratera no meio.
- Imagem 2 (cópia em `C:/dev/hud-evidencia/pedido-continente-pino-smt.png`, 60 px, borrada): marcador azul do mapa-múndi do Shin Megami Tensei; corpo alongado azul em cima e a pirâmide embaixo.
- Decidido (grilling): só fichas de jogador viram pino (NPC continua ficha); mestre e jogador veem igual; tamanho fixo na tela; nome embaixo; sem vida/condições/anel; "Mapa-mundi (caravana)" vira opção "Grupo anda junto" dentro do Continente; cor = Cor da ficha, senão cor automática do jogador. Plano: `~/.claude/plans/sequential-wandering-bird.md`.
- Protótipo do pino (3 variações A Cristal, B Gota, C Pirâmide): https://claude.ai/artifact/5aeGP8FEm6QEV6izTTsRSx — usuário escolheu a **A (Cristal)** em 09/10/2026 ("Quero o Pino A, é o melhor."). Feito: `345f5f9b` (tipo de mapa Continente, pino A no editor e no jogador, caravana dentro do Continente; conferido no navegador com mestre e 2 jogadores, 4 defeitos de toque/arrasto/alças/movimento reduzido consertados). Sai na v0.4.22 pelo atualizador. Não conferido no exe.

> 09/10/2026 (tarde, com o pino do continente em construção): "Sobre a animação do Ponto de Interesse, gostaria de dar uma evoluida nele: Normalmente ele aparece [Image #3] e animação acontece [Image #4], na aparição eu gostaria que tivesse uma animação ele vindo da direita para esquerda parando no meio e enquanto a animação acontece iria abril um painel com o nome do local e descrevendo parte dele[Image #5], esse painel eu gostaria que tivesse duas molduras uma de madeira e outra de metal e a descrição ia sendo escrita em striming com som de uma maquina de escrever a cada letra. poderia montar um exemplo?"
> Logo depois: "No caso [Image #6] esse parte o Nome que só o mestre ve ia virar o nome do local mesmo que ve na descrição e nota do mestre ia sumir."
- Imagem 3 (`C:/dev/hud-evidencia/pedido-poi-aparece.png`): imagem do pino aparecendo, fortaleza branca da Marinha (One Piece) com escadaria na selva, vertical. Imagem 4 (`pedido-poi-animacao.png`): a animação do cenário rodando (a mesma fortaleza mais escura, vista inteira com o canhão no topo). Imagem 5 (`pedido-poi-layout-painel.png`): esboço, "Animação da Imagem" alta à esquerda e painel menor à direita, alinhado em cima, com "Nome da Imagem" e "Descrição da Imagem". Imagem 6 (`pedido-poi-campos-do-pino.png`): campos do pino no editor: "Nome (só mestre)", "Descrição · o jogador lê", "Nota do mestre · só eu leio".
- Entendido: ao aparecer, a imagem entra da direita para a esquerda e para no meio; enquanto a animação do cenário roda, abre ao lado um painel com moldura dupla (madeira + metal), o nome do local em cima e a descrição sendo datilografada letra a letra com som de máquina de escrever. O campo "Nome (só mestre)" passa a ser o nome do local que o jogador vê no painel; o campo "Nota do mestre" sai.
- Exemplo v1: https://claude.ai/artifact/3vGEQKtJ29oxLosP12AFn8 (madeira por fora, metal por dentro; entrada 0,56 s; painel abre 0,82–1,38 s; texto a partir de 1,7 s). Aguardando o usuário.
- > 09/10/2026: "Acho que a revelção de local pode ser mais fluido, faça 3 exemplos, pode ser mais criativos e me mostre." — v2 com 3 variações numa página (A "Corrente contínua", B "Dobradiça", C "Forja"), coreografia sem parada morta, em andamento.
- > 09/10/2026: "Uma regra das animações de ambiente, que estamos trabalhando o tempo maximo é de 4-5 segundos." — a revelação inteira (entrada, painel, câmera e texto completo) termina em ≤ 5 s; texto com orçamento de tempo fixo. Exemplos refeitos com a regra.
- > 09/10/2026 (vendo o v1, imagem 7 em `C:/dev/hud-evidencia/pedido-poi-v1-moldura-na-imagem.png`): "sabe o que seria legal tambem um dos exemplo colocar envolta da imagem um molde tambem, seria e a parte da descrição saisse de trás dele como se fosse um dipositivo de informação." — entra na variação A: moldura em volta da imagem (madeira + metal) e o painel desliza de trás dela como um dispositivo (trilho, trava).
- Exemplos v2 (3 caminhos, tudo parado em 4,6 s): https://claude.ai/artifact/L6iwWV8cfFUD9PXiq53pep — aguardando o usuário escolher.
- > 09/10/2026: "Sobre a revelação do local, eu gostei da foto ter molde, e gostei da animação dobradiça do b, junte os dois. Uma coisa que eu percebi, acho que é um bug, a imagem não apareceu toda na animação como deveria ser, faça aparecer no original." — v3: moldura na imagem (da A) + painel em dobradiça (da B), variação única. Bug: o protótipo usava um print já recortado do começo da panorâmica, então a imagem inteira nunca aparecia; no app a panorâmica termina mostrando a imagem inteira. Feito v3: https://claude.ai/artifact/7oszszLsyKcnZjSzrpzrEq (imagem inteira clareada a partir do print da animação, porque o original não estava no disco). Aguardando o usuário.
- Agora: só um EXEMPLO (protótipo, Artifact) para aprovar. Integração no app depois, com a dúvida: o que fazer com as notas do mestre já escritas em mapas salvos.

> 09/10/2026 (noite): "[Image #8] uma melhoria que eu queria fazer é o seguinte, eu estou gostando muito dos mapas que eu estou fazendo, contudo olhando de longe eles parecem meios chapados, eu não sei o que falta para melhorar, eu quero que você de uma analisada e me de algumas dicas, você não vai mexer no código, crie 3 opções e me mostre os mapas, tipo olha esse mapa [Image #9] ele parece vivo, mesmo que não seja o intuito do programa acho que da para fazer algo legal, então pode fazer 3 exemplos e me mostrar, não mexa no revelção de local."
- Imagem 8 (`C:/dev/hud-evidencia/pedido-mapa-chapado.png`): o mapa de continente dele no app, regiões chapadas com contorno claro fino sobre mar azul-escuro liso. Imagem 9 (`pedido-mapa-referencia-mother3.png`): mapa do Mother 3 (mesmo continente): ilha em diorama com borda de penhasco marrom, florestas de árvores, montanhas 3D, neve, vulcão com lava, mar claro com halo na costa, rótulos em pílulas coloridas.
- Entendido: SÓ análise + dicas + 3 exemplos visuais do mapa dele (protótipos, sem mexer no código do app); a revelação do local fica como está.
- Opção 1 "Relevo sutil": https://claude.ai/artifact/Fg99trk2isQ2BhHK2Maof9 (09/10). Opção 2 "Diorama vivo": https://claude.ai/artifact/NmLiCtUdcVFjJeQYwVSWwa. Opção 3 "Maquete 2.5D": https://claude.ai/artifact/MfLz6onmAThU7cfuR9CA82. Aguardando o usuário escolher o que entra no app.

> 09/10/2026 (noite): "Pronto, para mim a revelação de local ta perfeita pode colocar no programa." (v3 https://claude.ai/artifact/7oszszLsyKcnZjSzrpzrEq)
- Decidido (grilling): notas do mestre já escritas nos pinos = APAGAR (o campo sai e o dado some ao salvar); o nome do pino passa a aparecer para o jogador em TODOS os pinos (título do painel); pino "!" sem imagem = o mesmo painel sozinho; duração: o mestre continua escolhendo por pino (padrão novo ~5 s, regra dos 4-5 s), a datilografia sempre cabe nos 5 s.
- Feito: integração no app (`client/src/cenario/revelacao/`), conferida no navegador (com imagem, sem imagem, celular, prévia do mestre, movimento reduzido). Decisão minha: pino "!" de ITEM sem imagem vai direto ao cartão com Pegar (sem revelação). Aviso: pino com 12 s escolhidos à mão no app antigo passa a 5 s (o 12 era o padrão e não era salvo).
- > 09/10/2026: "Antes de fazer passe pelo conselho." — veredito: Sim, se só a fase 1 ("relevo"), começando por prova curta com regra de parada; fases 2 e 3 fora do roteiro; primeiro terminar a revelação do local. Aguardando o usuário.
> 09/10/2026 (noite): escolha das partes — "No Relevo Sutil o que eu gostei: Luz de cima à esquerda, Sombra no mar, Sombra nas fronteiras, Textura por bioma. No Diorama Vivo o que eu gostei: As nuvens se movendo, os objetos no mapa, pinheiro, as palmeiras no oásis, as pedras na serra de ferro, e as poças no pântano. Na maquete do continente, o que eu gostei: É a Animação de aparição do nome dos lugares, só isso. Sobre o penhasco, eu acho legal, mas como eu faria para uma parte ter penhasco e outra parte do mesmo lugar não, entende?"
- Decidido (grilling 09/10 noite): pincel de penhasco; ferramenta nova "Texturas" (biblioteca, pintar por cima de parte); objetos por carimbo (clique + arrastar espalhando); novos itens = importar imagem própria + pacote do GitHub; nuvens passando sempre com chave. Plano: `~/.claude/plans/relevo-mapa-continente.md` (6 fatias, depois da revelação). Aguardando ok do plano.
> 09/10/2026: "As texturas a maioria vai ser vinda de você então pode fazer cad uma faz com o maximo de cuidado para fazer sentindo e não ficar estourado, quando a revelcao do local no app acabar, pode começar o plano." — PLANO APROVADO; começa depois do commit da revelação. Texturas feitas por Claude: coerentes com o mapa dele, nada estourado (saturação/contraste/brilho contidos).

> 09/10/2026 (noite), em paralelo ao relevo: "Outra coisa, eu quero que você faça isso em paralelo, uma coisa que tá me estressando é o Design|UX/UI disso: [Image #11] [Image #12], [Image #14]. O que acontece: a barra da esquerda tem muita informação e a da direita eu só acho que dá para melhorar, então eu quero que você refaça profissionalmente, você vai olhar propriedade de cada um [Image #13] das ferramentas e dos tokens, e vai refazer profissionalmente; eu quero que você use as skills de design junto MCP do Figma, você vai me lançar 3 designs para eu ver, coloque boas animações também."
- Imagens em `C:/dev/hud-evidencia/`: pedido-ui-barra-esquerda.png (editor: Nada selecionado, Aventura/Pinos, Esta cena: Objetos do mapa, Locais, Território, Chão do mapa, Camadas do chão, Camadas, Acervo de tokens), pedido-ui-barra-direita-sala.png (Sala: Abrir sala, Visão de jogador, Rede local, Livro de regras, Personagens, Contas dos jogadores), pedido-ui-barra-ferramentas.png (barra de ferramentas inferior com ~20 ícones e submenus), pedido-ui-painel-jogador.png (tela do jogador: Painel/Minha ficha/Inventário/Ficha, abas Jogo/Caderno/Lugares/Dados/Chat, botões Sinalizar/Marcações/Medir/Laser/Mostrar meu mapa/Volto já, Visão).
- Entendido: 3 propostas de redesenho profissional (barra esquerda, barra direita, barra de ferramentas com as propriedades de cada ferramenta e de token, painel do jogador), com boas animações, no Figma (MCP) + protótipo navegável; só design para escolher, sem mexer no app ainda.
- Propostas publicadas: 1 Mesa limpa https://claude.ai/artifact/W9AWUsy4NtBzfPTMyuEQDx; 2 Grimório https://claude.ai/artifact/FV4mhCWcNy1Zd4xDxGKuQc; 3 Estúdio https://claude.ai/artifact/BRvqfnYBGtEFvxfvWpcmjr. Aguardando o usuário escolher/misturar. Figma não feito (usuário ainda não autorizou o OAuth).
> 09/10/2026 (noite): escolha das propostas — "Mesa Limpa: Gostei muito do layout do ponto de interesse, gostei da porta aberta, aproveita e coloca animação disso. Grimório: Gostei demais do layout geral, tudo praticamente, só não gostei dos pontos de interesse. Labirinto Estúdio: Gostei da ideia de ter animação do cenário. Pode fazer um design consolidado." — consolidado: base Grimório + ponto de interesse e porta aberta (com animação) da Mesa limpa + animação do cenário do Estúdio. Em andamento.
- Design consolidado: https://claude.ai/artifact/2JApP1xH65fjrhhMsu5zEG. Aguardando o usuário.

> 09/10/2026 (noite): "Perfeito, gostei muito desse Design, o que você vai fazer agora é o seguinte, você vai aplicá-lo no programa, Exatamente como o Design Consolidado está. E você vai adicionar umas features para mim 1- Capacidade de trocar a cor dos pinos e aumentar o tamanho dos pinos 2- Capacidade de mudar o tamanho da escada e curvar ela 3-[Image #16] retirar essa parte de vida, a vida fica só na ficha do Sistema, por enquanto temos só o de One Piece mas é isso."
- Imagem 16 (`C:/dev/hud-evidencia/pedido-tirar-vida-da-ficha.png`): seção "Vida" das propriedades do token (vida atual 18/24 com barra, vida máxima, "Jogadores veem a barra").
- APROVADO o design consolidado https://claude.ai/artifact/2JApP1xH65fjrhhMsu5zEG para aplicar no app EXATAMENTE como está (código do protótipo em scratchpad redesenho-ui/consolidado/publicar; inventário em redesenho-ui/inventario.md).
- Fila: (A) aplicar o design no app, em partes; (B) cor e tamanho dos pinos; (C) tamanho e curva da escada; (D) tirar a seção Vida do token (vida só na ficha do sistema, hoje One Piece). Ordem: DEPOIS das fases do relevo (workflow wf_a4c229c1-736 mexe na barra de ferramentas e painéis; rodar junto daria conflito).
