## Objetivo

**Goal ativo desde a noite de 22/09/2026 (conta 20x, modo automático, loop):** "melhorar o programa no
geral, adicionar 50 features, resolver todos os bugs, refinar o programa no máximo." Pedidos da mesma
noite (literais em `PEDIDOS.md`): gauntlet com passeio descobrindo bugs e features; workflows para as
features do HANDOFF; um workflow só para os problemas do HANDOFF; simulação de 7 jogadores em várias
cidades/casas/cômodos/quartos; e a cidade-torre de 11+ andares (imagem em
`docs/pedidos/2026-09-22-cidade-vertical.png`) gerada de verdade e jogada com 7 fichas.

### Noite de 22-23/09 — lanes (estado às 03:35)

| lane | onde | estado |
|---|---|---|
| passeio contínuo + G14 visão geral | `C:/dev/labirinto-lane-passeio`, integração `C:/dev/labirinto-integ-passeio` | rodando (71 agentes) |
| G10 viajar junto | `.claude/worktrees/agent-a2f81b1641883db60` (merge da base `b08dd87`) | rodando |
| G12 pausa por cena | `.claude/worktrees/agent-a87f0e0e42de339f3` (merge da base `979b047`) | rodando |
| G13 companheiros | `.claude/worktrees/agent-adea6b44cd5ebd85a` (merge da base `e232a78`; 2 testes de unidade vermelhos do `party.update`) | rodando |
| defeitos do HANDOFF | `C:/dev/labirinto-lane-defeitos` | **BLOQUEADO**: `unidade` (vitest) estourou sob carga; relançar depois do conserto do portão com as 6 peças + 10 achados CONFIRMADOS da varredura (`C:/dev/labirinto-lane-defeitos/docs/varredura-2026-09-22.md`; resultado em scratchpad `defeitos-resultado.json`) |
| réguas fila antiga + G15 | `C:/dev/labirinto-reguas` (branch `auto/reguas-22set`) | rodando |
| réguas P5/P4 da simulação (37) | `C:/dev/labirinto-reguas-a` (branch `auto/reguas-lote-a`), ondas de 8 | rodando |
| cidade-torre de 12 andares | `C:/dev/labirinto-torre` (branch `auto/torre-11-andares`) | rodando |
| portão: vagas + unidade | `C:/dev/labirinto-portao-vagas` | vagas juntadas (`0e1fc70`); unidade em conserto |

Juntado em `auto/acervo` nesta noite: vagas de Playwright na máquina + teto de 45 min (`0e1fc70`), réguas
firmes sob carga + g5 (`4e0988d`), backlog da simulação (`613ad24`, `docs/backlog-simulacao-7-jogadores-2026-09-22.md`,
70 itens + 15 faltantes).

### Goal anterior (madrugada de 22/09/2026)

Goal ativo desde a madrugada de 22/09/2026: **"cria 15 features levando em consideração um ambiente com
4 - 7 jogadores cada uma querendo ir para um lugar, além disso resolver todos os bugs."** Antes dele, na
mesma sessão: o pino de viagem em 3 entregas, girar sala e medir na tela do jogador. O trabalho parou
em 22/09 às 08:10, no limite de uso da janela, a pedido do usuário: **o que falta está abaixo, para
fazer depois.** Conta 5x — ritmo contido; parar em 83% do limite semanal.

## Estado atual (22/09/2026, manhã)

**Branch de integração:** `auto/acervo` @ `5faf6cd` (nada foi enviado ao GitHub). Cada entrega nasceu
numa branch `auto/r4-<id>`, provada no worktree dela, e foi mesclada aqui com `--no-ff`. O detalhe de
cada entrega (commit, prova, decisão) está em `PEDIDOS.md`, seções "Andamento".

### Entregue, provado no commit juntado e integrado

| entrega | commit juntado |
|---|---|
| Pino de viagem — 1: várias cenas no editor (seção Cenas, câmera por cena, portal antigo migrado) | `ad71dd8` |
| Pino de viagem — 2: pino de viagem no editor, mão dupla | `9905eb4` |
| Pino de viagem — 3: cada jogador no seu mapa, pedido e aprovação (+ 4 achados de segurança corrigidos) | `1aadbfa` |
| Girar sala (alça, campo Rotação, Shift 15°) | `28177f4` |
| Medir distância na tela do jogador | `ee664e0` |
| G1 painel do grupo (Ir lá, Mandar para…) | `ef8ba5d` |
| G2 passagem do pino: pede / livre / trancada | `6d1a4ea` |
| G3 lista Cenas com quem está em cada cena e selo de pedido | `c7f6da9` |
| G4 caixa "Pedidos (N)" com Deixar todos | `fe9c7d4` + conserto `d103891` |
| G5 reunir o grupo num pino | `ce26606` |
| G6 chamado de cena de fundo ("X chamou em C" + Ir lá) | `037c2f3` |
| G7 seguir jogador | `0f22d79` |
| G8 encruzilhada (várias saídas nomeadas) + revisão de segurança | `ca26a31` + `40a3aea` |
| G9 mão única com chegada oculta | `352f7ef` |
| G11 recado por cena (régua consertada em `6eed3f5`) | `aac82f1` |

**Grupo espalhado: 10 de 15 provadas no commit juntado** (G1–G9 e G11).

### Defeitos consertados nesta sessão (cada um com teste vermelho antes)

Dica "Sala livre ()" (`87d89b0`); Subtrair com Pincel de blocos e borracha que não avisava sobre chão
(`d96cf5b`); salvar fora do app com erro técnico, corredor aberto que sumia, atalho parado com foco no
painel (+ `?` troca o tipo do pino), acervo vazio sem explicação e sem arrastar (`00a3cf8`); "Remover
<ficha>" mostrando o id e nome da cena vazando ao jogador (`ef8ba5d`); sinal de cena de fundo desenhado
no lugar errado (`037c2f3`); avisos do jogador sumindo antes de serem lidos (`d103891`).

### Decisões tomadas no automático — para o usuário revisar

- Passagem livre tem uma batida de 450 ms com "Passando…" antes de trocar a cena.
- O véu do cartão do jogador não bloqueia mais o mapa: tocar num botão do painel fecha o cartão e aciona
  o botão; a roda fora do cartão dá zoom.
- "Você chegou", "O mestre levou você…" e "O mestre reuniu o grupo" ficam até o jogador mexer a ficha
  (teto de 60 s).
- O botão "Recado" da lista Cenas é só o glifo ✉ (nome acessível "Recado para <cena>"). O motivo era
  uma colisão da régua, já corrigida em `6eed3f5` — dá para voltar ao texto "Recado" se preferir.
- A pilha de avisos vem antes do trilho no DOM (posição na tela igual): foi o que fez a régua da caixa de
  pedidos achar a linha certa. É contorno de uma busca frouxa da régua; ver dívida em C.

## Próximos passos

Em ordem. Cada item já tem endereço; nenhum precisa de investigação para começar.

1. ~~G11 — provar no commit juntado~~: feito, `recado-por-cena` VERDE e `chegada-oculta` VERDE em `5faf6cd`.
2. **G10 viajar junto — quase pronta.** Branch `auto/r4-viajar-junto` @ `81fb0fc` (commit `wip`),
   worktree `.claude/worktrees/agent-a2f81b1641883db60`. A régua `task-jornada-viajar-junto` já deu
   **5 passed**; falta: vizinhas (`caixa-de-pedidos`, `viagem-do-jogador`, `reunir-o-grupo`,
   `--so=jornadas-e2e`), reescrever a mensagem do commit (tirar o `wip`), mesclar e provar no juntado.
   Arquivos novos: `lib/travelTogether.ts` e 3 testes.
3. **G12 pausa por cena — no meio.** Branch `auto/r4-pausa-por-cena` @ `802089a` (`wip`), worktree
   `.claude/worktrees/agent-a87f0e0e42de339f3`. Parou no typecheck; a régua
   `task-jornada-pausa-por-cena` ainda não rodou. Retomar o builder com o prompt da G12 (ver `PEDIDOS.md`,
   G12) a partir desse commit.
4. **G13 companheiros na tela do jogador — no meio.** Branch `auto/r4-companheiros` @ `0f155de` (`wip`),
   worktree `.claude/worktrees/agent-adea6b44cd5ebd85a`. Régua `task-jornada-companheiros-do-jogador`
   selada e vermelha; nada rodado ainda. Rodar Playwright com **1 worker** (com 2 a página cai).
5. **G14 visão geral das cenas — não começou.** Régua `task-jornada-visao-geral-das-cenas` selada
   (`5faf6cd`); o builder caiu no limite antes de mexer em arquivo. Começar do zero a partir de
   `auto/acervo`. Estilo minimapa Resident Evil; miniatura em canvas 2D/SVG, não Pixi por miniatura.
6. **G15 diário de viagens — régua não escrita.** No painel Jogo, "22:10 Ana: Salão → Cripta", com
   **Desfazer** na última viagem de cada jogador. Mesmo ritual: régua vermelha pelo `testador` (molde:
   `task-jornada-painel-do-grupo.spec.ts`), registrar em `JORNADAS_DO_CRITERIO`, `--selar`, builder.
7. **G12, G13 e G10 mexem em `net/hostSession.ts` e no jogador**: juntar uma de cada vez e rodar o portão
   barato + as réguas vizinhas depois de cada merge (as junções desta noite tiveram conflito real em
   `App.tsx`, `hostSession.ts` e `playerConnection.ts`).
8. **Varredura curta (§2j) nunca rodou** sobre o que foi feito nesta sessão — rodar sobre `client/src/net`,
   `client/src/player`, `client/src/lib/pinTravel.ts` e `client/src/stores/adventureStore.ts`.
9. **Testar no desktop e em LAN**, com jogadores de verdade: nada desta sessão foi aberto no exe.
   Roteiro: duas cenas, pino de viagem ligado, dois jogadores no navegador de outra máquina, pedir,
   deixar ir, mandar para, reunir, recado, seguir.

### Fila antiga (de antes do goal do grupo), ainda aberta

**Features** (`docs/features-candidatas-2026-09-21.md`; "Medir na tela do jogador" e o "Recado" já
saíram): tela de atalhos (tecla `?` sem pino selecionado está livre), token anda suave na tela do
jogador, laser do jogador, copiar e colar objeto, salvamento automático, tocha presa ao token, pincel de
revelar/esconder, marcador de condição, barra de vida, espelhar a tela do jogador, exportar PNG, lista
de objetos com busca, agrupar objetos, alinhar e distribuir, iniciativa, dado na sala.

**Defeitos do passeio de 20/09** (`docs/passeio-2026-09-20.md`): todos consertados, **menos o B2
("clique no menu atravessa")**, que não se reproduziu em 10 de 11 menus com clique real e pixel
antes/depois. O menu Desenho (a varredura travou no 8º item) e o da Borracha ficaram sem varrer.

### C. Achados de passagem, ainda de pé

- **Busca frouxa na régua da caixa de pedidos**: `getByText(/Bruno[^]*quer passar.../)` casa um
  contêiner com texto de vários filhos; a ordem do DOM decide. Trocar por localizar a linha e ler dentro
  dela.
- **Girar sala**: ±90° numa sala com lados de paridades diferentes em quadrados sai meio quadrado fora
  da grade (pivô no centro); sala travada ainda mostra chips de canto.
- **Medir do jogador**: não tem o seletor de grude do mestre; o `aria-live` que começa escondido pode não
  anunciar a primeira medida.
- **Seguir jogador**: o "Ir lá" do aviso de chegada não desliga o seguir (não sabe de qual jogador é).
- **g5 do portão**: a régua das cenas com gente repassa a queda do socket por uma função com outro nome
  (`__labSocketCaiu`), que a guarda não enxerga. É transporte legítimo, mas a guarda deveria cobrir.
- **Irmão do aviso que ensina**: `net/hostBridge.ts` empurra "Abra a sala antes de torná-la pública"
  como erro comum que some sozinho.
- **Alça não acompanha o zoom** (camada de alças não redesenha com a escala da câmera).
- **4 testes vermelhos fora da regressão**: `e2e/task-room-tool.spec.ts` espera "Sala" e recebe "Sala 1".
- **Ícone do marcador não chega ao cartão do jogador**; **painel do marcador** separa ícone e tipo.
- **Digitar no rótulo custa um Ctrl+Z por letra.**
- **Jornadas instáveis sob carga** (timeout, passam sozinhas): `pincel-balde` casos 3 e 4,
  `escada-legivel`, `floor-pieces`, `gestos-centrais`, `selecao-arrasto`, `ctrl-reto`. Com 4 builders
  rodando Playwright ao mesmo tempo a máquina satura; o cache do vite por porta (`b02b8f4`) já tirou a
  tela branca, o resto é CPU.

### D. Dívidas de decisão — precisam do usuário

- As cinco decisões do automático listadas em "Estado atual".
- **Grade do mapa novo** (`NEW_MAP_SHOW_GRID = false` contra `task-jornada-ferramentas-mudas`).
- **Jornada do acervo não testemunha item→arquivo** (disco falso devolve a mesma foto).
- **10 achados `SEM_REFUTACAO`** da varredura de 18/09 nunca auditados.
- **vite órfão no PID 36740** na porta 1420: enquanto viver, Playwright só roda em worktree.

## Critério de pronto

Por entrega: a régua dela VERDE **no commit juntado em `auto/acervo`** (não só no branch), `tipos-src`,
`tipos-e2e`, `unidade`, `jornadas-intactas` e `particao` VERDES, as réguas vizinhas de risco VERDES, e
todos os arquivos mudados dentro de `client/src/`. Feature que mexe no que o jogador recebe
(`fogFilter`, `hostSession`, `protocol`) passa por `revisor` na dimensão segurança antes do merge.
O goal fecha com 15 features do grupo provadas assim e nenhum defeito conhecido aberto.

## Evidência

- **Commits juntados desta sessão** (`git log --first-parent d7ab205..5faf6cd`): 17 merges, de `9905eb4`
  (pino de viagem) a `aac82f1` (recado por cena), mais 4 consertos diretos (`87d89b0`, `b02b8f4`,
  `d32fbf1`, `40a3aea`).
- **Réguas seladas**: 75 jornadas em `JORNADAS_DO_CRITERIO`, `jornadas-intactas` VERDE em `5faf6cd`.
- **Portão barato em `5faf6cd`**: `tipos-src`, `unidade`, `jornadas-intactas`, `particao` VERDES.
- **Provas no commit juntado** (rodadas num worktree destacado): `painel-do-grupo` 5, `modos-do-pino` 5,
  `viagem-do-jogador` 6, `entrada-jogador` 5, `cenas-com-gente` 5, `caixa-de-pedidos` 4,
  `reunir-o-grupo` 5, `chamado-de-fundo` 5, `seguir-jogador` 5, `encruzilhada` 5,
  `recado-por-cena` 5, `chegada-oculta` 5,
  `pinos-ponto-de-interesse` 4, `marcador-com-icone` 2, `girar-sala` 7, `medir-na-tela-do-jogador` 6,
  `subtrair-abre-buraco` 4, `borracha-diz-o-que-nao-apaga` 3, as 4 réguas de defeito de `00a3cf8`,
  `jornadas-e2e` VERDE.
- **Revisões de segurança**: Entrega 3 (4 achados, corrigidos em `7d30053` com teste e mutação) e G8
  (2 achados, corrigidos em `40a3aea`; mutantes mortos: sem o teto 1 teste, com o spread 5 testes).
- **Bisect da escada** (`escada-legivel` sozinha em 6 junções): verde em 5, vermelha só em `c7f6da9` sob
  carga — instabilidade, não regressão.
- **Não verificado**: nada desta sessão foi aberto no exe desktop nem jogado em LAN;
  G10/G12/G13/G14/G15 não juntadas.
- **Incidentes registrados**: `git worktree remove --force` em worktree com junction apaga parte do
  `node_modules` compartilhado — não usar; o modo plano aberto no meio do trabalho parou um builder
  (a Entrega 3) e foi preciso retomá-lo.
