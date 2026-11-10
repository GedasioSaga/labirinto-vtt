# Unificação do combate (10/11/2026)

Pedido do mestre (literal no PEDIDOS.md, "Pedido de 10/11/2026 madrugada — unificar o combate"): criar o plano e aplicar; a lista de design do print 20 inteira; ajeitar os riscos; teste e correção só no final; publicar ao terminar. Autonomia total: as decisões abaixo são do Claude, e o mestre pode mudar qualquer uma.

Diagrama: [combate-tres-entradas](../diagrams/combate-tres-entradas.html).

## O problema

A Arena de Testes, a batalha no mapa e o site usam o mesmo motor (`client/src/lib/batalha`) e a mesma fábrica (`criarBatalhaStore`, `client/src/stores/batalhaFabrica.ts`). O que diverge é a cola de cada entrada:

| O que | Hoje | Alvo |
|---|---|---|
| Tela de mira | duas: a do mestre sabe vida e lado; a do jogador (Arena, LAN, site) não | uma só, com os mesmos dados em toda entrada |
| Motivo da recusa | o verdadeiro só para o mestre no mapa; frase genérica na Arena e no site | o motivo verdadeiro em toda tela |
| Pedidos ligados | 8 na Arena, 13 na LAN, 6 no site | a mesma lista; o que uma entrada não puder ter fica escrito aqui |
| Quem é aliado | pelo menos duas regras (peças x à mão) | uma função só |
| Robô do site | só bate | usa cura, buff, passiva, concentrar e forma |
| Regra no servidor do site | o servidor refaz dano, custo e selo por conta própria | o servidor chama o mesmo caminho do app |

Caso que disparou o plano: a Bolha do Tree na Arena. A cura funciona; a mira abre marcada no próprio Tree, a Bolha cura HP e não Escudo, e a Arena troca o motivo ("ninguém marcado está ferido") por "sem conexão com o mestre".

## Decisões

1. Não reescrever o motor nem juntar as três entradas: são usos diferentes (ensaio, sessão, treino à distância). Unifica-se a cola.
2. A Bolha continua curando só HP. O que muda é a frase: a recusa diz o motivo e, quando for o caso, que o Escudo segurou o golpe.
3. A mira abre: em golpe, só inimigos de pé; em ajuda, os feridos do lado de quem usa. O resto fica atrás de "mostrar todos". Nunca abre marcada em alvo que a regra vai recusar.
4. O corte do golpe e a faixa "Vez de" mantêm a duração (pedido de 30/10), mas não travam: o menu do próximo entra por baixo e o clique que pula também age.
5. Sons do combate sintetizados, baixos, com botão de mudo; ligados por padrão.
6. Câmera: só traz para a vista a ficha da vez quando ela está fora da tela ou na borda; sem zoom; o mestre desliga no painel da batalha.
7. Identidade: borda rasgada, pergaminho e latão. O que hoje segue de perto a referência (tiras vermelho e preto, corte com retrato redondo) caminha para cartaz de procurado e diário de bordo.
8. O segundo motor (Dragon Ball Tales, `lib/dbt/batalha`) fica fora deste plano.

## Raias (em paralelo, arquivos separados)

**U — cola do app (Fable 5.2 xhigh).** Dono de `lib/batalha/**`, `stores/batalhaFabrica.ts`, `stores/batalhaStore.ts`, `stores/arenaStore.ts`, `stores/mesaDaAventura.ts`, `lib/arena/**`, `net/batalhaNoHost.ts`, e dos arquivos que MONTAM os dados da tela: `components/batalha/dadosDoMenu.ts`, `BatalhaDoJogador.tsx`, `BatalhaDoMestre.tsx`, `components/arena/TelaDaArena.tsx`.
- U1 dados da mira iguais em toda entrada (lado real, vida, ferido, caído) e alvo inicial conforme a decisão 3. PRIMEIRO, porque a raia D depende disto.
- U2 motivo verdadeiro da recusa chegando à tela na Arena e na LAN (inclusive NPC controlado).
- U3 uma regra só de "quem pode ajudar quem" (peças e à mão).
- U4 Arena com os mesmos pedidos do mapa: área na grade, "o mestre decide", invocação, ajustar, contador.
- U5 mecânicas presas à ficha (`ficha:<id>`) valendo nas cópias da Arena e do site.
- U6 cura cuja fórmula não fecha não cobra e avisa (`batalhaFabrica.ts:2740`).

**R — site e riscos (Fable 5.2 xhigh).** Dono de `lib/treino/**`, `lobby/nuvem/src/**`, `lobby-site/**`.
- R1 o servidor devolve o motivo verdadeiro da recusa e a tela do site mostra.
- R2 o robô usa cura, buff, passiva, concentrar e forma, com alvo aliado.
- R3 o servidor deixa de refazer a regra: o pedido do site passa pelo mesmo caminho de validação e execução do app.
- R4 jogadas que faltam no site: passiva e lembrete, dano de selo por vez, evoluir, trocar armas.
- R5 compatibilidade: o Worker novo aceita o site anterior aberto (N-1).

**D — tela do combate (Opus 5.5 xhigh).** Dono de `components/batalha/MenuDaVez.tsx`, `ListaDeTecnicas.tsx`, `MiraDoGolpe.tsx`, `CaixaDeReacao.tsx`, a faixa da ordem, `EfeitosDaBatalha.tsx`, os CSS da batalha, os sons novos (`lib/sons`), o efeito de impacto e a câmera no Pixi. A lista do print 20:
- D1 apertar a tira em 80 ms; passar o mouse acende.
- D2 foco e teclado de verdade; teclas 1 a 5; memória da última tira; sem ação restante, pousa em "Encerrar vez".
- D3 corte e faixa de vez sem travar (decisão 4).
- D4 impacto proporcional ao dano: tremor em 3 tamanhos, ficha pisca e recua, crítico maior, queda tombando.
- D5 seis sons sintetizados e o mudo.
- D6 faixa da ordem que não esconde carta: com 7 ou mais, compacta e avisa quantas há fora da vista.
- D7 movimento em repouso no menu (pequeno) e câmera (decisão 6).
- D8 POR ÚLTIMO, depois da U1: a mira nova: papel rasgado, Lançar e Voltar em rodapé fixo, alvos rolando por dentro, "mostrar todos", ajustes atrás de um botão; a reação e a faixa na mesma linguagem; nada de seletor nativo branco.

## O que a varredura achou (10/11, executado nas três colas; tabela inteira em tmp/pedidos-2026-11-10/varredura-combate/varredura.md, fora do git)

19 fichas, 231 cartões. Gravação: por peças 4 (só o Tree e o Frog), à mão 53, texto lido pelo app 38, só texto 136. Das cerca de 93 técnicas executáveis, 73 funcionam em cada entrada; o resto se agrupa assim:

| Padrão | Atinge | Onde | Raia |
|---|---|---|---|
| Recusa com frase errada | toda recusa (18 na Arena, 24 no site) | Arena, site | U2, R1 |
| A Arena trata toda ficha como "você": a mira abre em quem age, sem vida; a área não marca | todas | Arena | U1, U4 |
| Cura de ficha de jogador não vale em NPC aliado, e a frase diz "outro lado" (`golpe.ts:927`, `equipes.ts:96`) | Revigorar, Medicina | todas | U3 |
| Cura recusada com HP cheio e Escudo quebrado | 4 curas | todas | U2 (frase; a regra fica) |
| Regra presa ao id da ficha some na cópia (`mecanicasAMao.ts:469, 686, 1102`; `copias.ts:25`; `mesaEmMemoria.ts:235`) | Ryoko, 5 do Siegfried | Arena, site | U5 |
| Site sem lembretes, passivas, Evoluir e Invocar: Sangrando tira 0, forma custa 0 SP | 6 técnicas e todo "por turno" | site | R4 |
| Robô não cura, não dá buff nem golpe sem dano | toda técnica de ajuda | site | R2 |
| Técnica que pede dano digitado é recusada no site (`duelo.ts:408`) | Explosão | site | R3 |
| Armadura Humana usada na vez cobra e não faz nada | Vagn | todas | U7 |
| "Área" que não existe (Chuva do Vagn: 1 alvo à mão) | Vagn | todas | U7 |

Dado da ficha, para o mestre corrigir (o app não escreve nas fichas dele): A Caçada Começa pede 200 SP e o Alexei tem 120; Sai Dai Rin pede 105 e o Jimboy tem 60; o Harvey tem 1 Kit Médico e a ficha diz 3; Luz do Sol dá 40 e o campo diz 40 + Espírito; a Espadada do Frog mostra 80 / Simples no cartão e as peças dão 100 / Completa; Crepúsculo sangra "até tirar" e a ficha diz 2 turnos; o Boomerang do Vincent ainda dá 10 de dano e não atordoa (falta montar o efeito da arma por peças, que existe desde a 0.5.43).

Por decisão antiga, e fica: "por turno" é lembrete com Aplicar ou pular.

## Fase final (só depois das três raias)

1. Teste de contrato: a mesma técnica rodada nas três entradas (parte das sondas da varredura de 10/11: `colaArena`, `colaMapa`, `colaSite`). Nada é "consertado" sem passar nas três.
2. A varredura das técnicas reais repetida: a lista do que falha, ficha por ficha, antes e depois.
3. Auditoria contra o pedido literal, correção, tsc, suíte, jornadas da batalha.
4. Travada e som medidos (p95 do quadro, tarefa longa, pico e volume dos sons).
5. Publicar: o app e, por causa da raia R, o Worker e o site do Lobby.

## Fica para depois

- Botão "Conferir ficha" para o mestre (roda cada técnica nas três entradas e mostra verde ou vermelho com o motivo). Usa o teste de contrato da fase final; entra na versão seguinte.
- Fichas do mapa com retrato ou iniciais.
- Vez do bando (invocados) no menu do centro.

## Critério de pronto

- A Bolha do Tree na Arena: a mira abre no ferido, ou abre vazia dizendo que ninguém está ferido; a recusa diz o motivo verdadeiro.
- O teste de contrato verde para cura em aliado, cura no outro lado, técnica de dano, área, selo por vez e passiva, nas três entradas (ou a exceção escrita neste plano).
- Em 1366×768 o botão Lançar está na tela com 7 combatentes; o menu responde ao teclado desde o começo da vez.
- Nenhuma trava de menu depois do golpe nem na troca de vez; nenhuma tarefa longa de 200 ms ou mais.
- O robô do site cura um aliado ferido numa luta de teste.
- Versão publicada no GitHub com `latest.json`, Worker e site enviados.
