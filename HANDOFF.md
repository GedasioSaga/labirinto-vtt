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

## Próximos passos

1. Terminar o que está em obra: duplo clique lento; réguas de medir-no-jogador e copiar/colar.
2. Seguir a fila de `docs/features-candidatas-2026-09-21.md` de cima para baixo.
3. Os 8 achados do passeio ainda sem conserto (menu que vaza clique, Subtrair sem efeito, borracha que
   ignora chão em silêncio, `W` e `?` mortos com foco no painel, acervo que não lista o que acabou de
   nascer, corredor que some sem aviso, dica `Sala livre ()`).
4. Decidir a dívida da grade: `NEW_MAP_SHOW_GRID = false` contra `task-jornada-ferramentas-mudas`.

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
