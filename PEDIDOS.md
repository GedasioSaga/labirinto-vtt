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
