# Mapa de batalha isométrico (protótipo)

Pedido do usuário em 22/10/2026: "Mapa isométrico da batalha do Final Fantasy Tactics ... Veja se você consegue fazer, não precisa ser em pixel art."

É um protótipo avulso, fora do app: nada em `client/`. Os prints do jogo que o usuário mandou serviram só para estilo e geometria e não estão no repositório. Personagens, mapas, textos e texturas são originais e saem todos do código.

- Página: `prototipo/index.html`, montada por `prototipo/montar.cjs` a partir de `fonte.html` + `nucleo.js` + `pintor.js` + `pagina.js`. É um fragmento sem `<!doctype>`, igual aos outros protótipos: o Artifact põe o esqueleto em volta. A única coisa que vem de fora é a fonte Barlow.
- Provas: `node docs/design/batalha-isometrica/provas/gerar-provas.cjs [node|navegador|tudo]`. As metas estão em `provas/metas.json`, escrito antes da primeira linha do protótipo. O resultado sai em `provas/testes.json`.

## O que dá para fazer

- Dois mapas de 24 x 24 com alturas de 0 a 4: **Vila do deserto** (praça elevada, escadas, casas de arenito de 1 a 3 andares, oásis, feira) e **Baía das ruínas** (praia, penhasco de 2 níveis que só se sobe por duas escadas encadeadas, ruína no alto, água animada).
- Câmera: gira 90° (Q/E ou botões), dá zoom (roda do mouse, pinça, botões; nítido de 45% a 300%) e anda arrastando. No canto aparecem a coordenada, a altura e o terreno do bloco sob o ponteiro.
- 8 unidades originais (aventureira de espada, mago de chapéu, arqueiro, curandeira, ladino, guarda de armadura, lobo, golem), 4 de cada lado. Cada uma tem sombra, respiração parada, passada em 4 quadros, salto em arco quando a altura muda, frente e costas, e se espelha para os lados.
- **Modo batalha**: liga a grade, que segue as alturas. Ao tocar numa unidade aparecem em azul, com borda branca e pulso suave, os blocos que ela alcança. A diagonal custa 1 e não corta quina. O degrau máximo vem de 1 (dá para mudar para 2 ou 3). Ninguém entra em bloco ocupado, na água ou em objeto. Ao apontar um destino aparecem o caminho e "N blocos". Ao tocar, a unidade anda bloco a bloco e mostra "andou N blocos". Também dá para arrastar a unidade: um fantasma dela encaixa no bloco de destino antes de soltar.
- Ferramentas: **Régua** (blocos e quanto sobe ou desce), **Círculo** (raio e blocos atingidos), **Cone** (8 direções, comprimento), **Visão** (diz o que barra, parede ou desnível, e em que altura a linha passa) e **Caminho andado** (o último percurso de cada unidade, numerado).
- **Dia / Tarde / Noite**, sem relógio. À tarde o sol fica baixo e as sombras saem longas e quentes. À noite a luz fica azulada, as janelas acendem e os lampiões e braseiros iluminam o chão em volta.
- Tema claro e escuro, tela de 390 px sem rolagem lateral, toque (tocar seleciona, tocar no destino faz andar, pinça dá zoom) e teclado: as setas andam o cursor pelos blocos, Enter confirma e Esc cancela.

## Decisões e porquê

- **Canvas 2D, sem Pixi.** O protótipo tinha de ser um arquivo só, sem dependência. O trabalho pesado fica em camadas prontas fora da tela, uma por giro, período e escala (1; 1,5; 2; 3), pintadas aos poucos em fatias de 18 ms. Por isso nenhuma tarefa trava. A cada quadro só se desenham as unidades, os objetos, a água e as marcas.
- **Projeção 2:1** (bloco de 64 x 32 px, 24 px por nível). As colunas são pintadas por (u + v) e depois por u. A escada vira 3 degraus. Cada objeto é desenhado em ordem de profundidade, e por cima dele volta **só a parte das colunas que está à frente do plano dele**. A primeira versão repunha a coluna inteira, e a prova (b) achou 0,13% de pixels errados: pedaços de coluna que estavam atrás do objeto e o cobriam. Isso foi corrigido.
- **Girar é instantâneo**, sem animação: é uma ação de teclado que se repete muito. O mesmo ponto do mundo fica no centro da tela. O sol é fixo no mundo, então ao girar a face iluminada muda de lado, como num diorama.
- **Estilo Meio-Termo** (`docs/design/ESTILO-DO-RPG.md`): contorno fino no tom escuro da própria cor, nunca preto, com piso de luminância de 0,065; sombra macia; grão leve; cores quentes e contidas. As texturas são procedurais e determinísticas: calçada, arenito, grama, musgo, terra, laje, telhado, rocha com estratos e água com espuma. Sem hachura de linhas finas e sem parede grossa.
- **Movimento**: 260 ms por bloco reto e 340 ms na diagonal. O salto agacha 70 ms, fica no ar 240 + 70 x desnível ms e pousa em 90 ms. Com movimento reduzido não há agachar, amortecer, balanço das palmeiras, pulso nem brilho correndo na água, e o arco fica baixo.
- **Medidas**: a régua usa diagonal = 1, igual ao padrão do app (`chessboard` em `client/src/lib/measurement.ts`). O círculo pega o centro do bloco até raio + ½ (raio 1 = 9, raio 2 = 21, raio 3 = 37). O cone tem meio ângulo de 26,57°, ou seja, a largura cresce junto com a distância. A visão sai do olho, 1,5 nível acima dos pés, até o peito do alvo, 1 nível acima.

## Provas (metas escritas antes do código)

| Prova | Meta | Resultado |
|---|---|---|
| (a) Clique: bloco, tela e de volta ao bloco, contra o raio da câmera; 2 mapas x 4 giros x 3 zooms | 100% | **100%** dos 13.824 casos (11.752 blocos voltam a si mesmos; os 2.072 escondidos devolvem quem os cobre, igual ao raio) e **100%** de 60.000 pontos ao acaso |
| (b) Ordem de pintura: buffer de identificadores (o algoritmo do pintor) contra o z-buffer analítico; 2 mapas x 4 giros | divergência de no máximo 0,1% | **0%** em 1.371.982 pixels amostrados (250.187 deles em objetos). Antes da correção: 0,13% |
| (c) Alcance contra uma relaxação escrita na prova, em 200 mapas ao acaso | 100% | **200/200** mapas iguais (19.882 blocos); os 6.078 caminhos desenhados são válidos passo a passo |
| (d) Robô: reage em 250 ms, erra o clique em até ½ bloco, sementes 1 a 5, 10 comandos cada (1 em 3 por arraste), um giro de câmera por semente | 100% chegam; contagem mostrada igual ao caminho | **50/50** chegam; **50/50** com "andou N blocos" igual ao caminho e à distância; 15 por arraste; prévia "N blocos" certa em 50/50 (uma rodada anterior achou 49/50: a prévia não aparecia se o ponteiro já estava parado no destino na hora de selecionar. Corrigido) |
| (e) Medição com respostas conhecidas (régua, círculo, cone, visão barrada por parede e por desnível) | 100% | **15/15** |
| Movimento: tempos e salto | 260/340 ms; ápice acima dos dois blocos; pouso exato; avanço que nunca volta; 300 a 650 ms | **11/11**. Subir 1 nível: 470 ms, ápice 2,25, pouso exato. Descer 3 níveis: 610 ms |
| (f) Desempenho: 30 x 30, 16 unidades andando, câmera girando a cada 1,5 s | p95 do quadro de no máximo 20 ms; nenhuma tarefa de 200 ms ou mais; primeira pintura em no máximo 500 ms | 3 rodadas, cada uma numa página nova, vale a pior: p95 de **16,8 / 16,8 / 16,7 ms** (p50 16,7; pior quadro 33,4 ms), **0** tarefas longas, primeira pintura de **242 a 249 ms**, de 13 a 16 unidades andando ao mesmo tempo. Antes, cada objeto coberto copiava a camada inteira, e uma rodada deu p95 de 33 ms. Agora só o retângulo do objeto é copiado |
| (g) Página: console e celular | 0 erros; 390 px sem rolagem lateral | **0** erros; 390 = 390; o toque seleciona e o toque no destino faz andar 3 blocos |
| (h) Cor | contorno com luminância de pelo menos 0,06; pixel de dia e de tarde com pelo menos 0,03 e de noite com pelo menos 0,008; nenhum preto puro; no máximo 48 cores base | **46** cores base; contorno mínimo **0,066**; pixel mínimo: dia 0,060, tarde 0,032, noite 0,010 (baía 0,011); **0** preto puro |
| (i) Origem | nenhuma imagem no protótipo; nenhum print de referência no repo | **0** arquivos de imagem, **0** `data:image`, **0** `<img>`; 31 referências conferidas por hash e **0** cópias |

O "custo do script" de cada quadro (do início do quadro ao fim do desenho) fica em `testes.json` só como informação. Ele conta desde o vsync, e por isso não é o tempo de CPU.

## Folha de contato, gráfico e prints

- `provas/folha-de-contato.jpg`: andar (2 blocos, 16 quadros) e saltar (sobe 1 nível, 16 quadros), com o tempo e a pose embaixo de cada quadro.
- `provas/grafico-do-salto.svg`: altura dos pés e avanço no tempo, com as fases agacha, no ar e pousa e o ápice marcado.
- `provas/prints/`: são 7 prints:
  - `1-vila-de-dia`
  - `2-baia-de-noite`
  - `3-alcance-azul`
  - `4-cinco-ferramentas`
  - `5-celular-390`
  - `6-quatro-giros`
  - `7-tres-periodos` (a mesma cena de dia, de tarde e de noite)

## O que eu não conferi

- **Celular de verdade e GPU de verdade.** Tudo rodou no Chromium sem tela, nesta máquina. O tamanho de 390 px e o toque foram simulados.
- **Se ficou bonito, e se lembra o FFTA**: quem julga isso é o usuário. As provas só dizem que a geometria, a ordem, as regras e o desempenho estão certos.
- O retângulo de cada objeto contou como cheio na prova (b). O desenho real tem buracos, então essa prova é mais rígida que a tela.
- Os nomes, os textos e os números das unidades são fixos no protótipo. Não passei a tela por dados de pior caso (nome longo, muitas unidades).
- Olhei o tema escuro de noite, com o modo batalha ligado, só no desktop (o print não ficou nas provas). No celular não olhei.

## O que ficou de fora

- Turnos, vida, ataque e iniciativa: o pedido era sem turno e sem vida.
- Editor de mapa: os dois mapas estão escritos em código, em `nucleo.js`.
- Visão e névoa por jogador: a ferramenta Visão mede uma linha, não esconde nada.
- Telhado que some quando uma unidade entra no prédio: o contorno tracejado do cursor mostra o bloco escondido, mas o prédio continua inteiro.
- Rede, salvar e várias pessoas ao mesmo tempo.

## Como isso entraria no app

Hoje o mapa do app não tem altura. `MapData` (`client/src/types/map.ts`) guarda células, paredes, portas, luzes, regiões, tokens, objetos, escadas, piso e névoa. Andares existem (`piso` em `NoPiso`, `Stair.levaAoPiso`), mas não há altura por célula nem por token. O tipo "isométrico" já aparece em `MAP_TYPES` (`client/src/lib/mapTypes.ts`) como "Em breve".

O que muda:

1. **Dados**: um tipo de mapa novo, "Batalha", ao lado de Continente (hoje uma marca `continente?: true`). Ele traz uma grade de alturas de 0 a 4, o material do topo e do lado de cada célula, a escada com a direção dela e a água. Um mapa de 24 x 24 dá menos de 2 KB: cabe com folga no limite de 64 KB por mensagem da rede. O token continua com `x, y` e a altura sai da célula.
2. **Desenho**: o Pixi do app pinta na ordem do `addChild`, sem `sortableChildren` (`PixiCanvas.tsx`, `PlayerView.tsx`). O isométrico precisa da camada estática numa `RenderTexture` por giro, dos objetos ordenados por u + v e da máscara "só a frente da coluna" que este protótipo provou. `nucleo.js` é puro e já testado: vira `src/lib/iso/` em TypeScript, com as provas (a) a (e) como vitest.
3. **Visão e névoa**: hoje a visão é um raio angular contra segmentos de parede em 2D (`lib/visibility.ts`), e o host filtra o que cada jogador recebe (`fogFilter.ts`). Com altura há dois caminhos. No primeiro, o desnível de 2 ou mais vira parede para a visão 2D que já existe; é barato. No segundo, a visão 3D por amostragem (a `visao()` daqui) roda no host, bloco a bloco. O bitset de exploração por célula continua servindo.
4. **Editor**: ferramentas novas de subir e baixar bloco (pincel), escada, água, material do topo e prédio (caixa). O clique isométrico com giro já está pronto (`blocoNoPonto`).
5. **Rede**: `token.move {tokenId, x, y}` validado no host (`lib/moveValidation.ts`) ganha a regra do degrau e do alcance. A animação de andar e saltar roda em cada cliente a partir do caminho, que é determinístico, igual para todos.
6. **Medição**: hoje só há régua linear (`lib/measurement.ts`). Círculo, cone e visão seriam novos.
7. **Câmera**: o zoom já existe (`pixi/world.ts`). Girar de 90 em 90° é novo e exige o clique ciente do giro.

**Faz sentido como tipo de mapa novo?** Sim. Mapa de batalha é pequeno (até 32 x 32), tem editor e regras próprios e não precisa mexer nas masmorras. Custo estimado de **11 a 13 fatias**:

| Fatia | O que entra |
|---|---|
| 1 | Tipo de mapa e modelo de dados |
| 1 | Núcleo isométrico em TypeScript, com as provas |
| 2 | Desenho no Pixi (camada estática, ordem, a frente da coluna, 4 giros) |
| 1 a 2 | Tokens: andar, saltar, alcance azul, clicar e arrastar |
| 2 | Editor de alturas, escadas, água e materiais |
| 1 | Validação no host |
| 1 a 2 | Visão e névoa com altura |
| 1 | Círculo, cone e visão para os jogadores |
| 1 | Dia, Tarde e Noite no isométrico, junto com o Sistema 1 de luz |

## Perguntas para o usuário

1. **Estilo**: o traço Meio-Termo (contorno fino, cores quentes, sombra macia) serve para a batalha? Ou você quer algo mais saturado e mais perto do jogo?
2. **Ângulo**: este é o 2:1 clássico. Prefere mais de cima, com mais chão legível e menos parede?
3. **Altura e degrau**: de 0 a 4 níveis, com degrau 1 de início. O degrau deve ser por unidade (por exemplo, o ladino salta 2 e o golem só 1) ou um valor só para o mapa? Hoje dá para subir no telhado de uma casa de 1 andar com degrau 1, como no jogo. Isso vale?
4. **Círculo**: redondo, como aqui (raio 2 dá 21 blocos), ou quadrado, como a régua com diagonal = 1 (raio 2 daria 25)?
5. **Ferramentas**: quais das cinco os jogadores usam primeiro? O cone fica em 8 direções ou deve girar livre?
6. **Ordem**: o que vem primeiro no app? Um tipo de mapa novo, com editor de alturas? Ou só a vista isométrica de mapas que já existem, sem altura?
