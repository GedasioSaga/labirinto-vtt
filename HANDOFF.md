## Objetivo

Noite de 20-21/09/2026, pedido do usuário: passear pelo programa para descobrir bug e feature,
consertar os bugs e entregar pelo menos 20 features novas e utilizáveis, em modo autônomo, com o
gauntlet-loop conduzindo. Conta 5x — ritmo contido de propósito.

## Estado atual (21/09/2026, manhã)

**Branch de integração:** `auto/acervo`. Base congelada: `auto/base-pecas-21set` = `5bc2117`.
Cada entrega nasceu numa branch `auto/r3-<id>`, provada no worktree dela e mesclada aqui.

### Entregue, provado e integrado — 13

| # | o que muda para quem usa | régua que virou verde |
|---|---|---|
| 1 | traço pontilhado e tracejado na ferramenta Linha | `linha-pontilhada` |
| 2 | etiqueta em pílula no nome da sala, legível em chão claro e escuro | `etiqueta-pilula` |
| 3 | vão aberto na parede: nem parede, nem porta | `saida-sem-parede` |
| 4 | ícone escolhível no marcador (baú, armadilha, chave, perigo, escada, água) | `marcador-com-icone` |
| 5 | ferramenta Caminho, com cor própria por caminho | `caminho-com-cor-propria` |
| 6 | aviso que ensina não some sozinho; só a pessoa dispensa | `salvar-sem-foto-avisa` |
| 7 | trocar a foto da ficha troca o que aparece na tela | `acervo-foto-certa` |
| 8 | apagar item avisa quando o arquivo resiste, com o nome que sobrou | `apagar-limpa-disco` |
| 9 | digitar depois de criar o rótulo escreve no rótulo, e não troca de ferramenta | `texto-recebe-o-que-se-digita` |
| 10 | cor por ficha (aliado, inimigo, neutro), que chega ao jogador | `cor-do-token` |
| 11 | alça de redimensionar visível: chip amarelo que recorta o contorno | `selecao-mostra-alcas` |
| 12 | quadrados percorridos aparecem enquanto a ficha é arrastada | `quadrados-ao-arrastar-token` |
| 13 | tamanho da ficha em quadrados (1, 2, 3), assentando na grade | `tamanho-do-token-em-quadrados` |

Sete são feature nova; seis são defeito que alguém encontraria usando.

### Como cada uma foi provada

Régua escrita **antes** da obra, nascendo vermelha, com controle positivo ao lado; builder proibido de
tocar em `client/e2e/` e em `scripts/`; portão barato (`tipos-src`, `tipos-e2e`, `unidade`,
`jornadas-intactas`, `particao`) verde; regressão do vizinho conferida; e o diff revisado antes do
merge. **50 jornadas seladas** no portão.

Três achados de builder que valem registro, porque desmentiram o diagnóstico de origem:
- o **duplo clique fecha** a forma hoje — o defeito é a janela fixa de ~500 ms do Chromium, que ignora
  o duplo clique mais lento que o Windows ainda aceita;
- a **alça existe**, mas era um quadrado de 7 px na mesma cor do contorno: dos 100 px que o canto
  ganhava ao ser selecionado, 96 eram as duas linhas se cruzando;
- havia **duas cópias** do mesmo desenho de alça, e é por isso que a de Sala ficou invisível sem a de
  Token acusar nada.

### Consertos no juiz (a maior parte da madrugada)

- `12ae80e` — o portão julgava a rodada de 18/09, não esta: saía VERDE com as jornadas de hoje
  vermelhas.
- `5bc2117` — 755 linhas de guarda novas, inclusive a que impedia **o próprio portão de encher o
  disco** (consumia ~1 GB a cada 25 min até reprovar tudo por falta de espaço).
- `84b66c1` — dois defeitos provados por mutação: três peças declaravam `scripts/portao.cjs`, o que
  reprovava toda peça no instantâneo; e um comentário dentro de `pecas` derrubava o portão com
  `TypeError`. Portão que estoura não reprova nem aprova: some.
- `33618c9` — peça de rodada já fechada saiu do manifesto; o alvo morto dela reprovava conserto vivo.

### Descoberta

- `docs/passeio-2026-09-20.md` — 13 achados de um passeio de usuário cego, que cobriu todos os itens
  de todos os menus. Dez são defeito, três viraram régua e dois já estão consertados.
- `docs/features-candidatas-2026-09-21.md` — 21 features candidatas, cada uma com a dor de quem usa e
  o arquivo:linha que prova que falta. Quatro já foram entregues desta lista.

## Fila de trabalho futuro

Tudo o que ficou de fora desta rodada, num lugar só. Cada linha já tem endereço; nenhuma precisa de
investigação para começar. **Ordem sugerida: primeiro os defeitos de gesto (são rápidos e enganam
quem usa), depois as features de tamanho P, depois as M.**

### A. Features — fila principal

Detalhe completo, com a dor de quem usa e a evidência de cada uma, em
`docs/features-candidatas-2026-09-21.md`. Três já saíram (cor da ficha, tamanho em quadrados,
quadrados ao arrastar); **restam 18**:

| tam | feature | onde mora |
|---|---|---|
| P | **Medir distância na tela do jogador** — a de maior valor da lista: o cálculo já existe pronto e puro, só não atravessa | `lib/measurement.ts`, `player/`, `net/protocol.ts` |
| P | Tela de atalhos (tecla `?`) dizendo o que cada letra faz | `components/Toolbar.tsx:229` |
| P | Token anda suave na tela do jogador, sem teleporte | `pixi/tokensRenderer.ts:338` |
| P | Jogador aponta com laser (segurar e arrastar), não só um ping | `net/protocol.ts:69-73,111` |
| P | Copiar e colar objeto, inclusive entre mapas | `lib/keymap.ts:195` |
| M | Salvamento automático com recuperação ao reabrir | `stores/sessionStore.ts` |
| M | Tocha: luz presa ao token, que anda junto | `types/map.ts:144-159`, `pixi/drawLights.ts:102` |
| M | Pincel de revelar/esconder um pedaço do mapa | `types/map.ts:253-258`, `net/hostBridge.ts:77-79` |
| M | Marcador de condição no token (envenenado, caído, dormindo) | `pixi/tokensRenderer.ts:199-338` |
| M | Recado curto entre mestre e jogador na própria tela | `net/protocol.ts:104-128`, `player/` |
| M | Barra de vida discreta no token | `types/map.ts:314-344` |
| M | Mestre espelha a tela do jogador antes de mostrar | `components/RoomPanel.tsx:301-304` |
| M | Exportar o mapa como imagem PNG | `components/ActionBar.tsx:101`, `lib/mapExport.ts` |
| M | Lista de objetos do mapa com busca e "ir até lá" | `components/LayersPanel.tsx:16` |
| M | Agrupar objetos e mover a construção inteira | `lib/selectionModel.ts`, `lib/entityClone.ts` |
| M | Alinhar e distribuir os itens selecionados | `lib/alignmentGuides.ts` |
| G | Ordem de iniciativa, com a vez destacada nos dois lados | não existe nada ainda |
| G | Dado rolado na sala, resultado visível a todos | não existe nada ainda |

### B. Defeitos do passeio ainda sem conserto — 8

Descrição completa e repro em `docs/passeio-2026-09-20.md`.

1. **Salvar / Exportar / Início falham** com `Cannot read properties of undefined (reading invoke)` e o
   trabalho some ao reabrir. É o mesmo defeito de ambiente de `PEDIDOS.md:247-255` (plugin do Tauri
   fora do webview). Mesmo que a causa seja de ambiente, a pessoa vê erro técnico na tela.
2. **Clique no menu atravessa** e crava vértice no mapa embaixo do item. Uma busca já foi feita e
   **não achou a causa no texto do código**: `ToolVariantMenu.tsx:117` não tem `stopPropagation`, e o
   popover está no stacking context certo (`main.css:901-918`). Próxima frente: medir as coordenadas
   em tempo de execução — o popover pode nascer fora da área realmente clicada
   (`ToolVariantMenu.tsx:304-324`).
3. **Subtrair não faz nada** (Opções de Chão → OPERAÇÃO), e em área meio vazia pinta chão novo em vez
   de abrir buraco.
4. **Borracha "Objeto inteiro" ignora chão em silêncio** — o mesmo clique apaga desenho normalmente,
   então a pessoa acha que errou o alvo e repete.
5. **`W` e `?` não funcionam com foco no painel** — o atalho só volta depois de um clique no mapa.
   (O conserto do rótulo de texto tocou perto disso, mas deixou este caso de fora de propósito.)
6. **Corredor de chão aberto some sem aviso** ao trocar de forma no menu.
7. **ACERVO DE TOKENS fica vazio** mesmo depois de "Adicionar token" — e, como nunca tem item, não há
   o que arrastar de lá para o mapa.
8. **Dica mostra `Sala livre ()`**, parêntese vazio, sugerindo um atalho que não existe.

### C. Achados que os builders devolveram de passagem

Cada um foi medido por quem entregou a peça vizinha, e deixado de fora de propósito para não misturar
escopo:

- **Irmão do aviso que ensina**: `net/hostBridge.ts:517` empurra "Abra a sala antes de torná-la
  pública" como erro comum, e some aos 7 s. É instrução pela mesma régua do conserto desta noite; não
  foi mexido porque `hostBridge.test.ts` fixa o tipo ali.
- **Alça não acompanha o zoom**: a camada de alças não é redesenhada quando a câmera muda de escala —
  a assinatura em `pixi/PixiCanvas.tsx:1230` redesenha parede, região, escada e luz, mas não chama
  `redrawEditHandles()`. Por isso a alça ficou em px de mundo (encolhe com o mapa); alça de tamanho
  constante na tela pede uma linha ali.
- **4 testes vermelhos que ninguém vê**: `e2e/task-room-tool.spec.ts` falha em 4 testes por
  `room.name` vir "Sala 1" onde o spec espera "Sala". **É pré-existente e esse arquivo não está na
  regressão do portão**, então o vermelho não trava nada — e por isso ninguém olha.
- **Ícone do marcador não chega ao cartão do jogador**: `player/PlayerPinCard.tsx` ainda mostra `!`/`?`
  na pastilha. O ícone chega ao mapa do jogador, só não ao cartão.
- **Painel do marcador**: a escolha de ícone entrou como seção própria ("ÍCONE NO MAPA") em vez de
  ficar ao lado do tipo `!`/`?`, porque `components/PinControls.tsx` era alvo exclusivo de outra peça.
  Vale reunir as duas coisas num lugar só.
- **Ficha de lado par**: o assentamento na linha da grade tem prova de unidade (`seatTokenCenter`),
  não de tela — nenhuma jornada arrasta ficha de 2 quadrados.
- **Digitar no rótulo custa um Ctrl+Z por letra**: cada tecla entra no histórico. É o mesmo
  comportamento que o campo do painel já tinha, mas fica registrado como dívida.
- **Escape hatch herdado**: `lib/tokenLibrary.ts:serializarIndice` faz `ignorados as ItemDoAcervo[]`
  sobre `unknown[]`. Não quebra hoje (os itens só entram em `JSON.stringify`), mas toda gravação do
  acervo passa por ali.

### D. Dívidas de decisão — precisam de você, não de código

- **Grade do mapa novo**: `NEW_MAP_SHOW_GRID = false` (`lib/mapFactory.ts:30`) contra
  `task-jornada-ferramentas-mudas.spec.ts`, que cobra grade ligada. Um dos dois tem de mudar — hoje
  essa jornada está vermelha por causa disso e é a única dispensada da bar.
- **Jornada do acervo não testemunha o mapeamento item→arquivo**: o disco falso devolve a mesma foto
  para qualquer caminho com `token_`. Achado da varredura de 18/09, ainda de pé.
- **Achados `SEM_REFUTACAO`** da varredura de 18/09 (`docs/varredura-2026-09-18.md`): 10 ficaram fora
  do cap e nunca foram auditados.
- **Testar no exe**: nada desta rodada foi aberto no app empacotado. Dois pontos só o exe resolve — o
  cache do webview na troca de foto da ficha, e o `reading invoke` do salvar/exportar.

### E. Réguas que eu ia escrever e não cheguei a terminar

Quatro jornadas foram encomendadas e interrompidas a seu pedido: `medir-na-tela-do-jogador`,
`copiar-e-colar-objeto`, `menu-nao-vaza-clique`, `subtrair-abre-buraco` e
`borracha-diz-o-que-nao-apaga`. Nenhuma foi escrita — começar por elas é o caminho para as features A
e os defeitos B2, B3 e B4.

**Regra que valeu a noite inteira e deve continuar valendo:** a régua vem antes da obra, nasce
vermelha, tem controle positivo ao lado, e o builder nunca toca nela.

## Critério de pronto

Por entrega: a jornada dela VERDE, `unidade` acima do piso, `tipos-src`, `tipos-e2e`,
`jornadas-intactas` e `particao` VERDES, a jornada do vizinho de risco VERDE, e os arquivos mudados
todos dentro de `client/src/`.

## Evidência

- **Integração das cinco primeiras, medida junta** num worktree com porta própria: `linha-pontilhada`
  (9,0 s), `etiqueta-pilula` (12,9 s), `saida-sem-parede` (21,6 s) e `marcador-com-icone` (11,0 s),
  todas 2 passed ao mesmo tempo; `jornadas-e2e` VERDE (56,3 s) e `jornadas-da-bar` VERDE (77,2 s) —
  este último estava VERMELHO quando a noite começou.
- **Fluidez medida no app de verdade** para a feature 12 (arrasto de ficha, o gesto mais usado):
  `longtask_max_ms=0`, `frame_p95_ms=16.8`, `inp_ms=40`.
- **Provas por mutação**: a feature 7 restaurou o arquivo antigo e a régua ficou vermelha no teste
  exato da troca de foto; o conserto do manifesto plantou uma sonda de texto e o portão saiu de
  `exit 2` com `TypeError` para `exit 0` limpo.
- **Gauntlet**: cinco runs do template, todos com saída BLOQUEADO, nenhum chegou a construir peça. A
  causa está consertada em `84b66c1`; o caminho que entregou foi construir direto, mantendo a mesma
  régua. Ledger em `~/.claude/docs/gauntlet-runs.jsonl`.
- **Incidente meu, registrado**: `git worktree remove --force` em worktree com junction apagou parte
  do `node_modules` compartilhado; `npm ci` falhou com EPERM num `.node` do rollup travado por
  processo vivo; `npm install` restaurou (138 pacotes, 60 binários). Lição: não usar `--force` para
  remover worktree que tenha junction de dependência.
- **Pendência com o usuário**: vite órfão no PID 36740 segurando a porta 1420. O modo automático
  bloqueou o encerramento do processo, então tudo rodou em worktrees, que têm porta própria. Enquanto
  ele viver, nenhum Playwright roda na árvore principal.
- **Não verificado**: nada foi aberto no app empacotado (Tauri). A troca de foto da ficha tem um
  limite que só o exe revela (o cache do webview pode servir bytes velhos da mesma URL), e o
  assentamento da ficha de lado par tem prova de unidade, não de tela.
