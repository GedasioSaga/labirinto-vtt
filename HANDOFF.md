## Objetivo

**Goal da noite de 22-23/09/2026** (conta 20x, modo automático, loop): "melhorar o programa no geral,
adicionar 50 features, resolver todos os bugs, refinar o programa no máximo." Pedidos da mesma noite
(literais em `PEDIDOS.md`): gauntlet com passeio descobrindo bugs e features; workflows para as features do
HANDOFF; um workflow só para os problemas do HANDOFF; simulação de 7 jogadores em várias cidades, casas,
cômodos e quartos; e a cidade-torre de 11+ andares (imagem `docs/pedidos/2026-09-22-cidade-vertical.png`)
gerada de verdade e jogada com 7 fichas.

## Estado atual (23/09/2026, 09h15 — TUDO PARADO a pedido do usuário)

O usuário mandou parar às 09h ("Pare com chrome headless shell, ele está destruindo a minha CPU"). Todos os
workflows foram encerrados, o loop foi desligado e os processos de Chrome sem janela e de vite/Playwright
foram mandados matar (o comando ainda rodava quando a sessão foi interrompida — **conferir antes de
qualquer coisa**, ver Próximos passos 1).

**Resultado honesto da noite: nenhuma feature nova ficou pronta no app.** O que ficou pronto foi
infraestrutura de teste, réguas (testes que definem cada feature), três listas de features e a torre de 12
andares gerada. Causa: 9 frentes em paralelo afogaram a máquina (20 CPUs, ~100 processos node, comandos
simples levando mais de 2 min); as jornadas estouravam o tempo por carga, cada frente concluía que o portão
estava quebrado e ia consertar o mesmo portão; isso aconteceu duas vezes (05h e 09h).

**Branch de integração:** `auto/acervo` @ `165b58c` (nada foi enviado ao GitHub).

### Juntado em `auto/acervo` nesta noite

| commit | o quê |
|---|---|
| `cf42909` | relatório da noite de 21/09 e registro do pedido de 22/09 |
| `45c8a4b` | registro do pedido da cidade vertical + imagem |
| `0e1fc70` | portão: vagas de Playwright na máquina inteira (`PORTAO_VAGAS`, padrão 3) e teto de 45 min por Playwright |
| `613ad24` | lista da simulação de 7 jogadores (`docs/backlog-simulacao-7-jogadores-2026-09-22.md`) |
| `4e0988d` | réguas firmes sob carga, caixa de pedidos lida pela linha, acervo com testemunha de foto, guarda g5 cobre a queda repassada |
| `f0a9bd5` | portão: unidade (vitest) com vaga e 4 workers, reprise de runner, `jornadas-entregues` na volta comum, g24 pelo disco, piso 2850, g35 (régua só muda em branch de réguas), webServer 120 s |
| `eb2d05e` | 17 réguas vermelhas (fila antiga + G15), registradas e seladas |
| `165b58c` | `reunir-o-grupo` de volta ao critério (falha 2 de 5 sozinha) e global-timeout do Playwright |

### O que cada workflow fez

Transcrições e resultados de cada run: `~/.claude/projects/C--dev-labirinto/c8383ce5-cdff-4233-a3f3-e956f550d741/subagents/workflows/<run>/journal.jsonl`.
Scratchpad da sessão: `C:/Users/gedasio.filho/AppData/Local/Temp/claude/C--dev-labirinto/c8383ce5-cdff-4233-a3f3-e956f550d741/scratchpad/`.

| # | workflow (run) | árvore | o que fez | como terminou |
|---|---|---|---|---|
| 1 | Simulação de 7 jogadores (`wf_91d2e451-a88`, 14 agentes, 4h50) | só leitura + 2 árvores de simulação no scratchpad | Mapa de capacidades do app (22), receita para simular 7 jogadores no navegador, 8 cenários lidos no código (vila com casas e quartos, mansão de dois andares, cidade portuária, capital com distritos, viagem entre cidades, castelo, investigação em hospedaria, sessão longa) e 2 mesas jogadas de verdade no app com 7 páginas de jogador. 159 achados brutos → 70 itens (9 descartados por já existirem) + 15 faltantes do crítico | **Concluído.** Lista em `docs/backlog-simulacao-7-jogadores-2026-09-22.md` (também `C:/dev/backlog-simulacao-7-jogadores.{md,json}`); diários por cenário em `scratchpad/simulacao/diario-*.md` |
| 2 | Passeio contínuo + G14 (`wf_bc76160b-d69`, ~143 agentes) | `C:/dev/labirinto-lane-passeio` (branch `auto/portao-passeio`), integração `C:/dev/labirinto-integ-passeio/cf42909b` | Pré-voo; auditoria do portão; varredura modo `tudo` (10 lentes, refutadores por achado); lane de features; passeio em 13 fatias com 4 sessões (mestre montando vila com casas e quartos, cenas, 7 fichas, tela do jogador no celular); 53 sugestões de passeio viraram propostas (a maioria "fora do escopo de interface": precisa de decisão de produto); peça `portao` consertou o portão da lane (commits `512188f`, `7a35603`) | **Parado às 09h05.** G14 (visão geral das cenas) **não foi construída**. `docs/varredura-2026-09-22.md` ficou sem commit na árvore do passeio |
| 3 | G10 viajar junto, 1ª tentativa (`wf_d456fce8-00e`) | `.claude/worktrees/agent-a2f81b1641883db60` | Auditoria da Fase 0: portão não confiável (regressão sem as jornadas entregues; tudo vermelho por carga) → começou a consertar o portão | Parado às 05h. Conserto guardado em stash e em `scratchpad/portao-das-lanes/g10.patch` |
| 4 | G12 pausa por cena, 1ª (`wf_93542a64-95c`) | `.claude/worktrees/agent-a87f0e0e42de339f3` | Idem; mediu a régua `pausa-por-cena` com 4 passed e 1 failed (teste 3 por tempo) | Parado às 05h; stash + `g12.patch` |
| 5 | G13 companheiros, 1ª (`wf_68ff9248-30e`) | `.claude/worktrees/agent-adea6b44cd5ebd85a` | Auditoria provou 2 furos reais: `unidade` saía verde com arquivo de teste apagado; uma lane regravava o selo da própria régua | Parado às 05h; stash + `g13.patch`. Furos consertados depois no portão (`f0a9bd5`) |
| 6 | Defeitos do HANDOFF, 1ª (`wf_f55ed4cb-f1e`, 34 agentes) | `C:/dev/labirinto-lane-defeitos` | Varredura modo `bugs` achou **10 defeitos CONFIRMADOS** (lista abaixo). A peça `portao` travou: vitest estourou sob carga ("Failed to start forks worker", só 105 de 189 arquivos rodaram) | **BLOQUEADO**; resultado completo em `scratchpad/defeitos-resultado.json`, ledger em `scratchpad/gauntlet-noite-22set-defeitos-handoff.jsonl` |
| 7 | Réguas da fila antiga + G15 (`wf_7693edb0-d4e`, 18 agentes) | `C:/dev/labirinto-reguas` (branch `auto/reguas-22set`) | 17 réguas vermelhas escritas por testadores (controle positivo verde, feature vermelha), registradas em `JORNADAS_DO_CRITERIO` e seladas | **Concluído.** Commit `1c69e31`, juntado em `eb2d05e`. Resumo em `C:/dev/reguas-fila-antiga.json` |
| 8 | Problemas do HANDOFF que são do juiz (`wf_2e447bad-c68`) | `C:/dev/labirinto-lane-infra` | `enterEditor` com teto próprio de abertura; tetos medidos por teste nos gestos longos; caixa de pedidos lida pela linha exata; disco falso do acervo com uma foto por caminho; g5 enxergando despacho fora do `__emitTauri`; auditoria dos 10 achados `SEM_REFUTACAO` de 18/09 (6 de pé, 4 já consertados) | **Concluído.** Commit `c157ea6` (teto de 300 s no teste 4 da caixa de pedidos aplicado pelo orquestrador), juntado em `4e0988d` |
| 9 | Cidade-torre de 12 andares (`wf_c998d8d5-b3c`, 53 agentes) | `C:/dev/labirinto-torre` (branch `auto/torre-11-andares`) | Bíblia do mundo (`torre/docs/biblia.md`, 84 KB); gerador sobre o código do app (`torre/gen/`, API em `torre/gen/API.md`); 12 andares gerados por 12 agentes; montagem validada com o leitor do próprio app; carga medida no app; mesa real com 7 jogadores em 7 andares; 4 rodadas de jogo com diário (`torre/docs/diario.md`) e estado (`torre/docs/estado.json`) | **Parado às 09h05**, na 4ª rodada, antes das etapas "Imaginar" e "Consolidar". Gerador commitado em `67033e0`. Detalhes abaixo |
| 10 | Réguas P5/P4 da simulação (`wf_a1f09d55-ea6`) | `C:/dev/labirinto-reguas-a` (branch `auto/reguas-lote-a`) | Onda 1 (8 réguas) registrada, selada e commitada; onda 2 (8 specs) escrita e **não commitada**; ondas 3-5 não rodaram | **Parado.** Onda 1 em `3e1c7ff` (não juntada em acervo) |
| 11 | Agente do portão (subagente) | `C:/dev/labirinto-portao-vagas` (branch `auto/portao-vagas`) | Vagas de Playwright e de unidade; teto 45 min com morte da árvore de processos; webServer 120 s; g24/g35; regressões **uma spec por vez** com vaga e teto de 20 min; fila por ordem de chegada | Commits `5563b3a`, `a4fade3`, `2e15a45`, `bf1e87c`, `60f1c6d`, `8fb190f` juntados até `165b58c`. **`1f178a3` e `8823982` ainda NÃO juntados.** Pausado pelo usuário no meio de uma volta de `jornadas-entregues` |
| 12 | 2ª rodada, 7 lanes sobre o portão novo: G10 (`wf_dd11fc31-da5`), G12 (`wf_f3cf73c0-576`), G13 (`wf_5bbbbff9-0c9`), defeitos com 11 peças (`wf_c8bb9c36-4c5`), editor (`wf_6653a774-0f1`), ficha (`wf_f738e362-0ef`), mesa (`wf_296cf2ed-090`) | árvores de cada lane (`C:/dev/labirinto-lane-{editor,ficha,mesa,defeitos}` e as 3 de `.claude/worktrees`) | As 5 que terminaram a auditoria concluíram de novo "portão não confiável" e começaram a consertar o portão cada uma na sua árvore; nenhuma escreveu código de feature | **Parado às 09h.** Laudos em `scratchpad/portao-das-lanes/laudos-fase0-0923.txt`; conserto parcial guardado em stash e em `editor.patch`/`g10b.patch` |
| 13 | Merges de base (agentes `operario`) | G10/G12/G13 | Trouxeram `auto/acervo` para as 3 branches, sem conflito: `b08dd87`, `979b047`, `e232a78`; depois `fe88903`, `4f7a355`, `9924070` | Concluído. G13 tem 2 testes de unidade vermelhos do `party.update` a decidir (`hostBridge.test.ts:291`, `mandarPara.test.ts:143`) |

### Cidade-torre — o que existe e o que foi medido

- **Gerada:** 99 cenas, 25.805 locais, 57 MB (`torre/saida/aventura`, fora do git, regenerável em ~1,5 min);
  escala 0,1 com 7.699 locais em `torre/saida/aventura-media`. 1.022 saídas de pino (511 pares), 214 para
  outro andar, 83 chegadas ocultas. Sete jogadores em sete andares: Ana 0, Bruno 2, Caio 4, Duda 5, Enzo 7,
  Fabi 9, Gui 11. Como rodar: `torre/docs/montagem.md`.
- **Carga no app** (GPU real, escala cheia): abre em 6,2 s; primeira troca para `a09-blocos` (2.828 salas,
  6,8 MB) 5,0 s; zoom com longtask de 1,4 s; arrastar sala com quadro p95 de 1.267 ms; selecionar 1,45 s;
  desfazer 1,5 s; memória sobe de 60 para 197 MB depois de 5 trocas.
- **Causas apontadas pelo perfil:** `drawRoomNames.childRoomsOf` é O(N²) e roda em todo redesenho
  (`client/src/pixi/drawRoomNames.ts:341-371`); arrastar sala redesenha o mapa inteiro a cada movimento
  (`PixiCanvas.tsx:1114-1165`); zoom refaz paredes, regiões, escadas e luzes a cada passo
  (`PixiCanvas.tsx:1401-1414`); selecionar e desfazer redesenham tudo; abrir a aventura desserializa as 99
  cenas antes de mostrar (`mapFileIO.ts:603-620`); objetos Pixi de cenas visitadas nunca são destruídos.
- **Mesa real de 7 jogadores** na torre: todos entraram, andaram, entraram em casa e cruzaram cômodos (74
  arrastos, 57 aceitos); viagens entre andares funcionaram na sonda com 2 jogadores. Defeitos achados:
  cada passo de qualquer jogador reenvia o mapa inteiro aos 7 (`hostSession.ts:1006-1016`); o jogador
  recebe quase todas as paredes do andar (`fogFilter.ts:703-709`); ao chegar num andar novo a tela fica
  preta porque a ficha nasce fora da tela e o zoom trava em 10% (`PlayerView.tsx:848-855`,
  `world.ts:14`); pino encostado na própria ficha não abre; a torre gerada não aparece em "Carregar Mapa
  existente" (`mapFileIO.ts:290` só lista pasta com `map.json`); toque na porta vira "Sinal" quando a tela
  engasga (`PlayerView.tsx:1089-1100`); "Mandar para… > Chegada" repete textos iguais; montar a mesa em 7
  andares exige 7 trocas de cena só para atribuir fichas.

### Defeitos conhecidos, ainda abertos

**10 confirmados pela varredura de 22/09** (relatório em `C:/dev/labirinto-lane-defeitos/docs/varredura-2026-09-22.md`, commitado na branch `auto/lane-defeitos`):
1. `App.tsx:1368` — `handleSave` marca como salvo depois do `await`: edição feita durante a gravação fica marcada como salva sem estar no disco.
2. `adventureStore.ts:612` — `flush()` zera `dirty` e `structureDirty` depois do `await` e descarta mudanças feitas nas cenas de fundo enquanto o disco gravava.
3. `tokenPhoto.ts:32` — o cliente aceita foto de até 512.000 caracteres, mas o servidor Rust fecha o socket acima de 64 KiB: foto grande derruba o jogador.
4. `App.tsx:417` — movimento, porta e edição de ficha feitos pelo jogador entram no histórico de desfazer do mestre.
5. `tokenLibrary.ts:359` — salvar, apagar e renomear no acervo não são serializados; uma gravação atropela a outra.
6. `hostBridge.ts:534` — o aviso de código errado (`announceBadCode`) nunca dispara no app real.
7. `mapFileIO.persistencia.test.ts:77` — o caminho de gravação que roda em produção no Windows (rename recusado, plano B) não tem teste.
8. `measurement.ts:176` — casas decimais da escala sem limite: `toLocaleString` lança `RangeError` em todo movimento ao medir.
9. (portão) jornadas das features entregues não rodavam na volta comum — **consertado** em `f0a9bd5`.
10. (duplicado do 2 em outra lente).

**Outros:** `reunir-o-grupo` falha 2 de 5 rodando sozinha ("o canvas do mestre não tem caixa") — regressão
possível da G5; `jornadas-entregues` sob carga teve vermelhos em `girar-sala`, `medir-na-tela-do-jogador`,
`subtrair-abre-buraco` e `modos-do-pino` (causa não investigada; `girar-sala` deu 7/7 sozinha mais cedo);
os defeitos da torre acima; e a lista C do anexo (girar sala fora da grade, alça que não acompanha o zoom,
um Ctrl+Z por letra no rótulo, ícone do marcador que não chega ao cartão do jogador, "Ir lá" que não
desliga o seguir, aviso "Abra a sala antes de torná-la pública" que some sozinho, `task-room-tool.spec.ts`
esperando "Sala" e recebendo "Sala 1").

**Achados das auditorias da 2ª rodada que são do portão** (a fazer, uma vez só): identidade do recibo de
`regressao-em-dia` é o hash de `git status --porcelain` e não enxerga mudança de conteúdo (falso-verde
reproduzido); recibos por passo compartilhados entre lanes e julgamento que ignora repetições; furo na g5
que deixa passar transporte inventado; `servidor-limpo` não mede nada; estilo não é medido na tela do
jogador.

### Retomada de 23/09, manhã (depois da pausa): fábrica de features sem Chrome comendo CPU

- **CPU:** o vilão era o `chrome-headless-shell`, que desenha WebGL por software (SwiftShader). Agora
  `client/playwright.config.ts` usa o Chromium completo no headless novo, com ANGLE D3D11, e o WebGL vai
  para a GPU Intel UHD (probe: "ANGLE (Intel, Intel(R) UHD Graphics … Direct3D11)"). Também caiu de 4 para
  2 workers por suíte (`6f139b1`). O `ux-driver` do passeio (`~/.claude/scripts/ux-driver.cjs`) usa o
  mesmo modo. As réguas de pixel passaram na GPU: marcador 2/2, girar-sala 7/7, estilo-minimapa VERDE.
  O tsc do projeto entra na fila de vagas (`7fe5b20`). As 8 réguas da onda 1 foram juntadas (`cbaafd6`).
- **Torre:** workflow retomado (`wf_c998d8d5-b3c`, retomada do mesmo run, agentes prontos voltam do
  cache), a partir do mestre da 4ª rodada. Tudo o que ele tinha produzido está salvo em
  `auto/torre-11-andares` `662195f`: `torre/workflow/` com o script, o journal e um README de como
  continuar, e `torre/docs/achados.md` com 260 achados.
- **Fábrica** (script `scratchpad/fabrica-features.js`):
  - construtor em worktree próprio, teste vitest vermelho primeiro, nunca navegador;
  - revisor independente;
  - prova (tsc, unidade e a régua da peça) na fila de vagas;
  - integração serial numa branch por grupo;
  - regressão do grupo no fim.
- **6 workflows em paralelo**, 3 peças por vez em cada:

| grupo | run | árvore de integração | peças |
|---|---|---|---|
| rede | `wf_64189329-f33` | `C:/dev/labirinto-int-rede` (`auto/int-rede`) | 22 (G10, G12, G13, G15, recados, pedidos, reconexão, retomar mesa…) |
| jogador | `wf_0b3b3b42-010` | `C:/dev/labirinto-int-jogador` | 19 (laser, zoom no celular, painel, silhueta, texto do cômodo, cadernos, dado…) |
| visão | `wf_e2994310-83e` | `C:/dev/labirinto-int-visao` | 22 (pincel, espelhar, tocha, sala secreta, porta secreta, cena escura, esconder-se…) |
| editor | `wf_6e46f2c0-0bd` | `C:/dev/labirinto-int-editor` | 21 (G14, copiar/colar, atalhos, lista de objetos, PNG, agrupar, alinhar, cenas em pastas…) |
| mundo | `wf_8c9146eb-bf4` | `C:/dev/labirinto-int-mundo` | 15 (vida, condição, iniciativa, salvamento automático, item, TV, caravana, patrulha, gatilho, alavanca, relógio…) |
| defeitos | `wf_65ff5965-8c6` | `C:/dev/labirinto-int-defeitos` | 23 (os 8 defeitos da varredura, desempenho da torre, defeitos da mesa, lista C, reunir-o-grupo) |

  Cada peça termina num destes estados: INTEGRADA, SECA, TETO_CONSERTOS, PROVA_AMBIENTE, NAO_INTEGROU ou
  SEM_BUILD. O merge de cada `auto/int-<grupo>` em `auto/acervo` é feito pelo orquestrador no fim.
  **Troca consciente em relação ao gauntlet:** para caber na CPU, a comparação cega A/B com fotos foi
  substituída por um revisor independente, mais a régua verde e os testes vitest que falham antes.

## As 101 features da lista (todas por fazer)

Estado: **[branch]** trabalho começado numa branch · **[régua]** régua vermelha selada em `auto/acervo` ·
**[régua-a1]** régua commitada em `auto/reguas-lote-a` (`3e1c7ff`), não juntada · **[régua-a2]** spec escrito
em `C:/dev/labirinto-reguas-a`, não commitado · sem marca = só na lista. Objetivo, aceite e arquivos dos
itens 22-86: `docs/backlog-simulacao-7-jogadores-2026-09-22.md` (id entre parênteses).

**Grupo espalhado, em andamento**
1. **[branch]** Viajar junto: quem está perto de quem pediu passagem vai junto (G10, `auto/r4-viajar-junto` @ `fe88903`; régua já deu 5 passed).
2. **[branch]** Pausa por cena: o mestre congela o movimento de um grupo (G12, `auto/r4-pausa-por-cena` @ `4f7a355`).
3. **[branch]** Companheiros na tela do jogador: "aqui" / "em outro lugar" (G13, `auto/r4-companheiros` @ `9924070`).
4. **[régua]** Visão geral das cenas: miniaturas com as fichas (G14; régua `task-jornada-visao-geral-das-cenas`).

**Fila antiga + G15, com régua pronta** (`client/e2e/task-jornada-<id>.spec.ts`)
5. **[régua]** Diário de viagens "22:10 Ana: Salão → Cripta", com Desfazer (`diario-de-viagens`, G15).
6. **[régua]** Salvamento automático com Recuperar ao reabrir (`salvamento-automatico`; = `copia-de-recuperacao`).
7. **[régua]** Copiar, colar e recortar objeto, inclusive entre mapas (`copiar-e-colar`).
8. **[régua]** Laser do jogador (`laser-do-jogador`).
9. **[régua]** Tela de atalhos, tecla ? (`tela-de-atalhos`).
10. **[régua]** Tocha presa na ficha, e visão no escuro (`tocha-presa-na-ficha`; = `luz-na-ficha`).
11. **[régua]** Pincel de revelar e esconder um pedaço do mapa (`pincel-revelar-esconder`).
12. **[régua]** Espelhar a tela de um jogador (`espelhar-tela-do-jogador`; = `ver-como-jogador`).
13. **[régua]** Lista de objetos do mapa com busca e "ir até lá" (`lista-de-objetos`).
14. **[régua]** A ficha anda suave na tela do jogador (`ficha-anda-suave-no-jogador`).
15. **[régua]** Barra de vida na ficha (`barra-de-vida`).
16. **[régua]** Dado rolado na sala, visível a todos (`dado-na-sala`).
17. **[régua]** Exportar o mapa como imagem PNG (`exportar-png`).
18. **[régua]** Condição na ficha: envenenado, caído, dormindo (`condicao-na-ficha`; = `estado-na-ficha`).
19. **[régua]** Ordem de iniciativa, só quem está na vez move (`iniciativa`; = `iniciativa-e-vez`).
20. **[régua]** Agrupar objetos, Ctrl+G (`agrupar-objetos`).
21. **[régua]** Alinhar e distribuir itens (`alinhar-e-distribuir`).

**Simulação de 7 jogadores — prioridade 5**
22. **[régua-a1]** Atribuir ficha: primeiro as livres, sem tirar a de quem joga (`atribuir-livres-primeiro`).
23. **[régua-a1]** Quem passa pelo mesmo pino chega em casas vizinhas, sem empilhar (`chegada-em-casa-livre`).
24. **[régua-a1]** Zoom no celular: pinça e botões + e − (`zoom-no-celular`).
25. **[régua-a1]** Painel do jogador recolhe e a câmera abre na própria ficha (`mapa-livre-do-painel`).
26. Móveis e objetos aparecem para o jogador como silhueta (`objetos-como-silhueta`).
27. **[régua-a2]** Recado para um jogador só (`recado-para-um-jogador`).
28. Texto do cômodo que o jogador lê ao entrar, e nota do mestre (`sala-texto-ao-entrar`).
29. Pista visível só para os jogadores escolhidos (`pino-so-para-escolhidos`).
30. **[régua-a2]** Porta trancada: "Pedir ao mestre" vira pedido (`porta-trancada-vira-pedido`).
31. **[régua-a2]** A conexão caída volta sozinha e o mestre vê quem caiu (`reconexao-automatica`).
32. **[régua-a2]** Voltar por aba nova não vira "Ana (2)" (`voltar-e-a-mesma-pessoa`).
33. Retomar a mesa: cada jogador reencontra a própria ficha (`retomar-mesa-donos`).
34. **[régua-a2]** Caderno do jogador com os recados guardados (`caderno-recados`).

**Prioridade 4**
35. **[régua-a1]** Só a própria ficha arrasta (`so-a-propria-ficha-arrasta`).
36. **[régua-a1]** Nome público da ficha de NPC, sem vazar o real (`nome-publico-da-ficha`).
37. **[régua-a1]** Zona oculta não aparece como quadrado preto (`zona-oculta-sem-buraco`).
38. **[régua-a1]** A visão do jogador não atravessa porta trancada de sala secreta (`sala-secreta-nao-vaza`).
39. O Ctrl+Z do mestre não desfaz o que o jogador fez (`ctrl-z-nao-desfaz-jogador`; = defeito 4).
40. O explorado não some depois de 8 cenas (`exploracao-nao-se-perde`).
41. Aviso ao fechar o app com jogadores na sala (`aviso-ao-fechar-com-sala-aberta`).
42. **[régua-a2]** Recado de cena escolhendo quem recebe (`recado-para-escolhidos`).
43. "Minhas pistas": caderno de cartões lidos, que dá para mostrar a um colega (`caderno-pistas`).
44. Porta secreta que parece parede até o mestre revelar (`porta-secreta`).
45. Cômodo já visto fica lembrado; o não visto nem aparece (`comodo-lembrado`).
46. Grupo mostra em que cômodo está cada ficha (`grupo-mostra-sala`).
47. Pedido de passagem com "Ver" e "Não, porque…" (`pedido-ver-e-nao-com-motivo`).
48. **[régua-a2]** Chamar o mestre: mão levantada em fila (`chamar-o-mestre`).
49. **[régua-a2]** Toque longo: Procurar, Escutar, Espiar, Revistar (`acoes-no-ponto`).
50. Pegar item para a mochila; o mestre vê quem tem o quê (`item-pegavel`).
51. Retomar a mesa com o mapa explorado de cada jogador (`retomar-mesa-exploracao`).
52. "Visto por": quais jogadores enxergam uma ficha (`visto-por`).
53. Levar NPC ou monstro para outra cena (`levar-npc-para-outra-cena`).
54. Revelar planta para vários e dar ao atrasado o que o grupo viu (`revelar-planta-e-grupo`).
55. Raio de visão por cena (`visao-por-cena`).
56. Cenas em pastas: região > cidade > bairro > casa (`cenas-em-pastas`).
57. Duplicar, apagar e reordenar cena (`duplicar-e-apagar-cena`).
58. A escada desenhada leva ao outro andar (`escada-leva-a-outro-andar`).

**Prioridade 3**
59. Pino de viagem trancado aceita "Pedir ao mestre" (`pino-trancado-vira-pedido`).
60. "Mostrar agora a…": o cartão abre direto na tela do escolhido (`mostrar-pista-agora`).
61. Revelar ficha secreta ou zona só para quem descobriu (`revelar-ficha-e-zona-para-escolhidos`).
62. Painel de pistas: quem recebeu e quem leu (`painel-de-pistas-do-mestre`).
63. Pino com nome só do mestre e lista de pinos buscável (`pino-com-nome-e-lista`).
64. Pino marco que todos veem, e pino que só se lê de perto (`pino-marco-e-so-de-perto`).
65. Chave na mochila abre a porta (`chave-abre-porta`).
66. Aba Jogo compacta com 7 jogadores (`aba-jogo-compacta`).
67. Chegadas agrupadas num aviso só, e a cena que espera há mais tempo (`atencao-do-mestre`).
68. "Reunir o grupo" mostra onde cada um está (`reunir-grupo-por-cena`).
69. Montaria e familiar viajam com o dono (`montaria-viaja-junto`).
70. Porta, zona oculta e segredo em lote (`gestos-rapidos-do-editor`).
71. Busca nos seletores "Mandar para…" e "Leva a…" (`busca-nos-seletores-de-cena`).
72. "Leva a…" cria a cena nova ali mesmo (`cena-nova-pelo-leva-a`).
73. "Onde estou": nome público da cena (`nome-da-cena-para-jogador`).
74. Cena ou sala escura: só se vê onde há luz (`cena-escura`).
75. Janela e grade deixam ver sem passar; espiar prédio com teto (`janela-grade-e-espiar`).
76. Porta que só abre de um lado (`porta-de-um-lado`).
77. Esconder-se: a ficha some para os outros jogadores (`esconder-se`).
78. "Andar até aqui" pelas ruas conhecidas (`andar-ate-aqui`).
79. Sinal na cor da ficha e marca "vamos para cá" (`marca-olhem-aqui`).
80. Quadrados no arrasto, passo máximo e fichas que ocupam espaço (`movimento-contado`).

**Prioridade 2**
81. Objeto com rótulo curto ou imagem para o jogador (`objeto-com-imagem-ou-rotulo`).
82. Criar andar de cima ou de baixo a partir do prédio, e escada em espiral (`criar-andar-de-cima`).
83. "Lugares": pontos conhecidos e lugares onde já esteve (`lugares-no-painel-do-jogador`).
84. Anotação pessoal do jogador no próprio mapa (`anotacao-pessoal`).
85. Cartão de pino compacto e rótulo do cômodo legível (`cartao-e-rotulo-legiveis`).
86. Medir o custo do mestre com 7 jogadores numa máquina limpa (`medir-host-com-7-jogadores`).

**Faltantes apontados pelo crítico da simulação** (sem id; texto em `C:/dev/backlog-simulacao-7-jogadores.json`, campo `faltando`)
87. Tela da mesa para TV ou projetor.
88. Ficha do grupo (caravana) no mapa-mundi.
89. Pino de viagem preso a uma ficha (navio, carroça, elevador).
90. Rota de patrulha do NPC.
91. Gatilho de área: armadilha ou alarme.
92. Alavanca que abre uma porta ligada.
93. Mapa do prédio por andares para o jogador (1º andar, 2º andar, subsolo).
94. Texto de chegada da cena.
95. Emprestar a ficha de quem saiu para outro jogador.
96. A tela do celular não apaga durante a sessão.
97. Ruído no mapa: o jogador ouve a direção, não a posição.
98. Relógio da campanha, com dia e noite.
99. Cena grande no celular sem travar.
100. Quem chega no meio da sessão escolhe a própria ficha.
101. Teste secreto do mestre para jogadores escolhidos.

**Também propostas nesta noite, fora da numeração:** as 53 sugestões do passeio (quase todas pedem decisão
de produto; as de interface pura: duplo clique renomeia cena e ficha, nome inteiro da cena na lista, filtro
na lista Cenas, saltar pela inicial, "Criar sala dentro" mostrar que está armado, pino oculto esmaecido no
mapa do mestre, validação explicada no botão Entrar do jogador, abas Mapa/Jogo com vazio explicado no
navegador) — resultados no journal de `wf_bc76160b-d69`; e as features da torre (busca de local pelo nome,
ver o andar inteiro, lista Cenas agrupada por andar, torre aparecer em "Carregar Mapa existente").

## Próximos passos

Em ordem. **Regra aprendida esta noite:** no máximo 2-3 frentes com Playwright ao mesmo tempo, e o portão
auditado e consertado UMA vez antes de soltar qualquer frente (memória `lanes-paralelas-e-portao`).

1. **Conferir a máquina:** nenhum `chrome-headless-shell.exe` e nenhum node de vite/Playwright/vitest de
   `C:/dev/labirinto*` vivo; `%TEMP%/portao-labirinto/vagas` vazio (vaga órfã se retoma sozinha, mas
   conferir).
2. **Juntar o que falta do portão:** `auto/portao-vagas` `1f178a3` (regressões uma spec por vez) e
   `8823982` (fila por ordem de chegada) em `auto/acervo`; depois, num agente só, os 5 achados de portão da
   2ª rodada (seção "Defeitos conhecidos").
3. **Réguas da simulação:** commitar a onda 2 (8 specs em `C:/dev/labirinto-reguas-a`), selar, juntar
   `auto/reguas-lote-a` em acervo.
4. **Uma feature por vez, na ordem de valor:** G10 viajar junto (quase pronta) → defeitos 1-8 da varredura
   (salvar perde trabalho é o pior) → desempenho da torre (`drawRoomNames` O(N²) primeiro) → as 17 com régua
   pronta → P5 da simulação.
5. Stashes das lanes paradas (`git stash list`, mensagens "portao da lane …"): descartar depois que o
   conserto único do portão estiver juntado; os patches ficam em `scratchpad/portao-das-lanes/`.
6. Torre: falta abrir a aventura no exe e rodar as etapas "Imaginar" e "Consolidar" do workflow
   (`wf_c998d8d5-b3c` pode ser retomado com `resumeFromRunId`; as rodadas prontas voltam do cache).

## Critério de pronto

Por entrega: a régua dela VERDE **no commit juntado em `auto/acervo`** (não só na branch); `tipos-src`,
`tipos-e2e`, `unidade`, `jornadas-intactas` e `particao` VERDES; as réguas vizinhas de risco VERDES; todos
os arquivos mudados dentro de `client/src/`. Feature que mexe no que o jogador recebe (`fogFilter`,
`hostSession`, `protocol`) passa por `revisor` na dimensão segurança antes do merge. O goal da noite pede
50 features: **0 de 50 provadas até 23/09 09h.**

## Evidência

- `git log --oneline --first-parent cf42909..165b58c` em `auto/acervo`: os 8 merges e registros da tabela
  "Juntado em auto/acervo nesta noite".
- Portão em `165b58c`: `--fase0` → "PORTÃO ÍNTEGRO"; `--autoteste` → "TODAS as guardas reprovam a entrada
  ruim conhecida" (rodados pelo orquestrador depois de cada merge do portão).
- `unidade` no portão novo: "Test Files 189 passed (189) / Tests 2850 passed" (agente do portão, código de
  `2e15a45`). Mutações: apagar `mandarPara.test.ts` → "VERMELHO unidade … SUMIRAM src/stores/mandarPara.test.ts";
  editar e reselar `girar-sala` fora de branch de réguas → "VERMELHO g35".
- Vagas: 5 cópias com `PORTAO_VAGAS=2` → "max ocupadas = 2 (teto 2)", diretório de vagas vazio no fim;
  processo morto → "vaga de Playwright retomada".
- Réguas da fila antiga: 17 VERMELHAS com controle positivo verde; `--fase0` ÍNTEGRO, `jornadas-intactas`
  VERDE com 92 jornadas seladas, `tipos-e2e` VERDE (commit `1c69e31`).
- Torre: `torre/docs/montagem.md` — 99/99 cenas abrem com `deserializeMap`, 99/99 voltam iguais byte a byte,
  0 ids repetidos, 1.022 saídas de pino com par, `tsc` exit 0.
- Simulação: log do run "10 de 10 sessoes devolveram, 159 achados brutos"; "backlog: 70 itens depois de
  tirar 9 que ja existem; faltantes sugeridos: 15".
- **Não verificado:** nenhuma feature desta noite existe; nada foi aberto no exe desktop nem jogado em LAN;
  a torre foi aberta só no navegador de teste, nunca no exe.

---

## Anexo — estado em 22/09/2026, manhã (sessão anterior)

Goal daquela madrugada: "cria 15 features levando em consideração um ambiente com 4 - 7 jogadores cada
uma querendo ir para um lugar, além disso resolver todos os bugs." Parou às 08h10 no limite da janela.

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

Defeitos consertados naquela sessão: dica "Sala livre ()" (`87d89b0`); Subtrair com Pincel de blocos e
borracha que não avisava sobre chão (`d96cf5b`); salvar fora do app com erro técnico, corredor aberto que
sumia, atalho parado com foco no painel, acervo vazio sem explicação (`00a3cf8`); "Remover <ficha>" com id e
nome de cena vazando ao jogador (`ef8ba5d`); sinal de cena de fundo no lugar errado (`037c2f3`); avisos do
jogador sumindo antes de serem lidos (`d103891`).

### Decisões tomadas no automático — para o usuário revisar

- Passagem livre tem uma batida de 450 ms com "Passando…" antes de trocar a cena.
- O véu do cartão do jogador não bloqueia o mapa: tocar num botão do painel fecha o cartão e aciona o botão.
- "Você chegou", "O mestre levou você…" e "O mestre reuniu o grupo" ficam até o jogador mexer a ficha (teto 60 s).
- O botão "Recado" da lista Cenas é só o glifo ✉ (nome acessível "Recado para <cena>").
- A pilha de avisos vem antes do trilho no DOM.

### C. Achados de passagem ainda de pé (de antes desta noite)

Girar sala ±90° fora da grade com lados de paridades diferentes, e sala travada mostrando chips de canto;
medir do jogador sem seletor de grude e com `aria-live` que pode não anunciar a primeira medida; "Ir lá" do
aviso de chegada não desliga o seguir; "Abra a sala antes de torná-la pública" some sozinho
(`net/hostBridge.ts`); alça não acompanha o zoom; `task-room-tool.spec.ts` espera "Sala" e recebe "Sala 1";
ícone do marcador não chega ao cartão do jogador e o painel do marcador separa ícone e tipo; um Ctrl+Z por
letra no rótulo; defeito B2 do passeio de 20/09 ("clique no menu atravessa") não reproduzido, menus Desenho
e Borracha sem varrer. (Busca frouxa da régua da caixa de pedidos, g5 e testemunha do acervo: consertados
nesta noite em `4e0988d`.)

### D. Dívidas de decisão — precisam do usuário

- As decisões do automático acima.
- Grade do mapa novo (`NEW_MAP_SHOW_GRID = false` contra `task-jornada-ferramentas-mudas`).
- G13: o `party.update` a mais nos caminhos de expulsar e "Mandar para…".
- As 53 sugestões do passeio que pedem decisão de produto (hierarquia de cenas, tipos novos de porta e de
  ícone, catálogo de objetos de quarto, notas do mestre no pino).
