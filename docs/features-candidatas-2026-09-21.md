# Fila de features candidatas — 21/09/2026

Levantada depois de entregues as cinco features do `PEDIDOS.md` e os três defeitos do acervo. Fontes:
`PEDIDOS.md`, `docs/passeio-2026-09-20.md`, `HANDOFF.md` e o código de `client/src/components/`,
`client/src/pixi/`, `client/src/player/`, `client/src/net/`, `client/src/lib/`, `client/src/stores/`.

Ordenada por dor alta e tamanho pequeno primeiro. Nada aqui foi implementado.

| ordem | feature | dor de quem usa | evidência | tam |
|---|---|---|---|---|
| 1 | Medir distância na tela do jogador | O jogador não sabe se alcança o inimigo e pergunta ao mestre a cada turno | Ferramenta Medir só do mestre (`components/labels.ts:35`); nada em `player/*` nem no protocolo (`net/protocol.ts:104-128`) | P |
| 2 | Quadrados percorridos aparecem ao arrastar o token | Mestre e jogador arrastam no olhômetro e brigam sobre "cabia no movimento?" | `pixi/drawMeasurementIndicator.ts:36` só é acionado pela ferramenta `measure`, nunca no arrasto (`pixi/tokenInteraction.ts`) | P |
| 3 | Cor do token escolhida pelo mestre (aliado/inimigo/neutro) | Com 8 tokens azuis idênticos ninguém sabe quem é monstro no meio da luta | Cor fixa em código: `pixi/drawTokens.ts:17`; `Token` não tem campo de cor (`types/map.ts:314-344`) | P |
| 4 | Tamanho do token em quadrados no painel (1/2/3) | Dragão e rato ficam do mesmo tamanho; só dá para puxar o canto, sem número | `Token.size` existe (`types/map.ts:320`), mas o painel só tem foto e nome | P |
| 5 | Tela de atalhos (tecla `?`) com o que cada letra faz | Digitar `SAIDA` no rótulo trocou de ferramenta cinco vezes e nada avisou | Passeio, achados 2 e 13; atalho só em tooltip solto (`components/Toolbar.tsx:229`) | P |
| 6 | Token anda suave na tela do jogador (sem teleporte) | O mestre arrasta e, do outro lado, a ficha pisca de um ponto ao outro | `pixi/tokensRenderer.ts:338` faz `position.set` direto; nenhum tween no render | P |
| 7 | Jogador aponta com laser (segurar e arrastar) | O jogador só dá um ping pontual; para explicar "por aqui até ali" precisa falar | `laser` é só mestre→jogador (`net/protocol.ts:111`); do jogador só existe `signal` de um ponto | P |
| 8 | Copiar e colar objeto, inclusive entre mapas | Reaproveitar uma sala pronta de outro mapa hoje é redesenhar tudo | `lib/keymap.ts:195` só tem `duplicate` (Ctrl+D); sem copiar/colar | P |
| 9 | Salvamento automático com recuperação ao reabrir | Uma hora de masmorra sumiu e o app abriu "Nenhum mapa salvo ainda" | Passeio, achado 1; `stores/sessionStore.ts` só marca `isDirty` | M |
| 10 | Tocha: luz presa ao token, que anda junto | Cada passo do grupo obriga o mestre a arrastar a luz à mão | `Light` não tem vínculo com token (`types/map.ts:144-159`) | M |
| 11 | Pincel de revelar/esconder um pedaço do mapa | Revelar é tudo-ou-nada; não dá para abrir só o corredor recém-andado | `ConcealZone.revealed` é booleano da zona inteira (`types/map.ts:253-258`) | M |
| 12 | Marcador de condição no token (envenenado, caído, dormindo) | O mestre anota no papel quem está caído porque a tela não mostra | `pixi/tokensRenderer.ts:199-338` não desenha estado; `Token` não tem o campo | M |
| 13 | Recado curto entre mestre e jogador na própria tela | Jogador remoto precisa de outro app para perguntar "posso abrir a porta?" | Sem mensagem de texto no protocolo; sem chat em `player/*` | M |
| 14 | Barra de vida discreta no token | Ninguém sabe quanto falta para o monstro cair sem o mestre narrar | Sem campo de vida em `Token` e sem desenho correspondente | M |
| 15 | Mestre espelha a tela do jogador antes de mostrar | O mestre desenha o segredo e não confere o que vazou para o outro lado | `components/RoomPanel.tsx:301-304` só oferece Revelar/Ocultar plano | M |
| 16 | Exportar o mapa como imagem PNG | Para imprimir ou postar no grupo, hoje só dá uma pasta que ninguém abre | `components/ActionBar.tsx:101` copia arquivos; nenhum `extract` do canvas | M |
| 17 | Lista de objetos do mapa com busca e "ir até lá" | Com 30 salas, achar "Cripta" é rolar o mapa no olho | `components/LayersPanel.tsx:16` só mostra contagem por camada | M |
| 18 | Agrupar objetos e mover a construção inteira | Mover uma casa exige selecionar parede por parede | Sem noção de grupo em `lib/selectionModel.ts` nem `lib/entityClone.ts` | M |
| 19 | Alinhar e distribuir os itens selecionados | Cinco pilares "quase" alinhados deixam o mapa torto | `lib/alignmentGuides.ts` é só guia de encaixe durante o arrasto | M |
| 20 | Ordem de iniciativa, com a vez destacada nos dois lados | A mesa perde o fio de quem joga agora | Nenhuma ocorrência de iniciativa/turno em `client/src` | G |
| 21 | Dado rolado na sala, resultado visível a todos | Rolagem em app separado mata o clima e ninguém confere | Nenhum sistema de dados; protocolo sem mensagem de rolagem | G |

## Descartadas, e por quê

- **Dez dos treze achados do passeio** são DEFEITO (`gesto_sem_resposta`, `expectativa`), não feature:
  gesto que não responde, menu que vaza clique, acervo que não lista o que acabou de criar. Vão para a
  fila de conserto.
- **Achado 1 do passeio** (salvar/exportar com `reading invoke`) é defeito de ambiente já catalogado em
  `PEDIDOS.md:247-255`; só a parte "não perder o trabalho" sobrevive como feature — é a candidata 9.
- **Mapas conectados, caminho com cor própria, sala livre, pincel e balde**: já entregues ou em voo.
- **Fundo de pergaminho, hachura, textura de pedra**: batem de frente com o minimapa Resident Evil
  aprovado. **Mapa escuro com tocha** o próprio usuário tirou de escopo (`PEDIDOS.md:373`).

## Se só desse para fazer uma

A **nº 1**, medir distância na tela do jogador: é o caso "existe no mestre e não chega ao jogador", o
cálculo já está pronto e puro em `client/src/lib/measurement.ts`, e a prova é uma jornada de ponteiro
na tela do jogador com asserção no texto da régua.
