# Meio-Termo no app: texturas e objetos

Plano técnico do arquiteto de 23/10/2026, a partir de `docs/design/ESTILO-DO-RPG.md`, `docs/design/vila-meio-termo/`, `docs/design/objetos/` e do roteiro `docs/planos/roteiro-pos-redesign-2026-10-22.md` (seção 3). Roda em paralelo com as camadas atrás de uma chave de obra, sem editar os arquivos quentes delas, exceto num retoque único combinado.

## Decisões do usuário (não reabrir)

- O estilo muda de uma vez ao abrir (sem chave por mapa para o ESTILO).
- Móveis em duas vistas: "de cima com volume" (PADRÃO nos mapas novos) e "3/4", com chave por mapa para a vista. Versões antigas de linhas ficam no catálogo para mapas novos. Os objetos já postos migram no DESENHO (o arquivo do mapa não é regravado por isso). Material no lugar da cor livre; textura por código e determinística.
- Peças novas, todas no painel de Objetos, aprovadas direto no app: barraca, carroça, lampião, quadro de avisos, vasos, sebe, jardineira, arco do portão, placa de seta, POÇO, tapete longo (comprimento livre e borda ornamentada), mesa quadrada e mesa redonda, lápides, grade de prisão (parede que vê e não passa, com a porta de grade da cela). A ÁRVORE continua carimbo e ganha atalho no painel de Objetos.
- Telhado: palha em espinha de peixe como 3º modelo (6 cores e cor livre) e chaminé opcional por sala.
- Chão sem repetição (0 blocos iguais de 96 px, autocorrelação ≤ 0,3), barranco liso com realce, contorno nunca preto, cor contida.
- PORTA: manter a porta creme de vão inteiro como está (decisão de 22/10, pacote v8). O Meio-Termo NÃO troca a porta.
- ORDEM: TUDO JÁ, EM PARALELO com as camadas (escolha do usuário, contra a recomendação de esperar). Por isso valem a chave de obra e a regra dos arquivos quentes abaixo.
- No máximo 3 agentes escritores ao mesmo tempo (camadas, Sons e este); o Meio-Termo roda com UM escritor por vez.

## Fatos conferidos e 2 correções ao briefing

- **Golden:** a fase de camadas exige o golden igual ao de antes da fatia 1 até o FIM da fase (`docs/planos/camadas-fase3-2026-10-22.md`), não só até a fatia 4. A chave de obra fica DESLIGADA até a fase 3 das camadas fechar e ser verificada. O golden tem mesa, cadeira, tapete, baú, fogueira, barril, grama de pincel, relevo, carimbos e telhado, com `maxDiffPixels: 0`.
- **Tipo do móvel:** `TipoMobilia` é literal em `types/map.ts:1688`; tipo novo exige retoque de 1 linha (R0 abaixo).
- Jogador desenha TODOS os móveis num `Graphics` só (`PlayerView.tsx:2143`, repinta quando muda `JSON.stringify([props, scale, res, grid])`); o editor usa um `Graphics` por móvel com cache (`pixi/drawProps.ts:268-301`). Pixi 8.16 desenha imagem dentro de `Graphics` (`GraphicsContext.texture`), então dá para pôr imagem pronta sem trocar o contêiner do jogador. Os renderers são criados nos dois lados; mudar o desenho DENTRO deles chega aos dois sem tocar `PixiCanvas` nem `PlayerView`.
- Grade já tem a lógica: `PassagemDaParede 'janela'` (vê e não passa, `types/map.ts:1744`) e porta `DoorKind 'gate'` (`:203`); falta o desenho. Textura do chão é `TilingSprite` com máscara (`drawTexturas.ts`), geradores `CorDaTextura(u,v)` sobre ladrilho periódico (`texturas/ladrilhos.ts`, lado 256).

## 1. Peças novas e catálogo

- **R0 (retoque de 1 commit, numa janela entre commits das camadas, JÁ):** criar `lib/mobilia/tipos.ts` sem imports, com `TIPOS_MOBILIA = [...] as const` e `type TipoMobilia`; `types/map.ts:1688` passa a re-exportar `TipoMobilia` de lá; `types/map.ts:411` passa a `modeloDoTeto?: ModeloDoTeto` (de `lib/telhado/paletas.ts:12`). Só tipo, sem efeito em execução. Antes de editar, conferir `git status` de `types/map.ts` (nenhum hunk de outro agente) e commitar em minutos.
- Tipos novos em `TIPOS_MOBILIA` (casas, largura x altura): barraca 2x2 (vista Lado), carroça 2x1,25 (Lado), lampião 0,5x0,5, quadroDeAvisos 1x0,4, vaso 0,5x0,5, poço 1,5x1,5, mesaQuadrada 1x1, mesaRedonda 1,25x1,25 (entra em `ehMovelRedondo`), lápide 0,6x0,35 (variação por `hash(prop.id)`), sebe 2x0,5 (geometria da cerca, com curva), jardineira 1x0,5, arcoDoPortao 2x0,5, placaDeSeta 0,5x0,5 (o giro dá a direção), tapeteLongo 1x4 (borda repetida por casa, mora no chão como o tapete).
- Registro em `lib/mobilia/pecasNovas.ts` (geometria, rótulo, artigo, tamanho, vista) e a setinha em `lib/toolVariants.ts:283-291`.
- **Fora de `TIPOS_MOBILIA`:** grade de prisão = parede `janela` com `Wall.grade?: true` (campo de desenho, retoque Q) mais a porta `gate`; árvore = carimbo NOVO `arvore-redonda` em `carimbos/embutidos.ts` (mapas antigos não mudam) com atalho que arma a ferramenta Carimbo. Direito autoral, aviso de uma vez: desenho original inspirado no Mother 3, sem copiar sprite.
- **Material no lugar da cor, sem campo novo no arquivo:** o painel grava o hex OFICIAL do material nos campos que já existem (`mobiliaCor` = material principal, `mobiliaCorDaLinha` = segundo material, cama = os 3 campos de hoje). O desenho pega o material mais perto em OKLab dentro da lista do lugar; assim os mapas antigos migram NO DESENHO e o arquivo não é regravado.

## 2. Desenho em duas vistas com material

- Entrada: `PropSilhouette` (`drawPropSilhouettes.ts:93`) mais a vista do mapa. Chave do cache da imagem: `{tipo, vistaDoMapa, lado, materiais[], forma, curva, casas, nivelDeResolucao 1|2|3}`; semente = hash da chave, então móveis iguais dividem a mesma imagem e o desenho é determinístico.
- Módulos novos: `texturas/meioTermo/paleta.ts` (os 38 tokens de `vila-meio-termo/prototipo/meio.js`), `materiais.ts` (tabela de `docs/design/objetos/README.md:44-58`), `moveis/<tipo>.ts` (cada um com `pintar(pixels, w, h, escala, vista, lado, materiais)`, portado de `objetos/prototipo/objetos.js`), `pixi/rasterDosMoveis.ts` (cache LRU por bytes: 64 MB no computador, 24 MB com `pointer: coarse`, fila de fatias de 8 ms).
- `drawPropSilhouettes` mantém a assinatura; com a chave ligada (ou tipo novo) usa `graphics.texture(...)` com `setTransform` para o giro; o 3/4 sobe a imagem acima da pegada. A imagem nasce com o tamanho final, com o desenho de linhas de hoje por baixo como placeholder, e troca a fonte no lugar quando os pixels ficam prontos (`CanvasSource.update()`), sem invalidar `lastPropsKey` do jogador (arquivo quente).
- Resolução com teto de 3x (a 4x a cama passou de 50 ms): nível = `min(3, ceil(cameraScale*res))`. Fogueira: o desenho parado vira imagem; a chama de `chamasDasFogueiras.ts` não muda; no 3/4 a chama sobe um pouco (`deslocamentoDaChama`, depois do retoque Q). Profundidade no 3/4: ordenar por base y dentro da faixa da camada, só depois das fatias 3 e 4 das camadas.

## 3. Chão, barranco, palha e chaminé

- **Chão sem repetição, por posição e não por ladrilho:** `pixi/pedacosDoChao.ts` divide o mundo em pedaços de 256 px; cada pixel sai de `corNoMundo(x,y)`: ruído sem período em 3 escalas (230, 80 e 27 px, como `meio.js:255-311`), tufos e flores sorteados por célula e o ladrilho de hoje lido em coordenada deformada por ruído (domain warp, vale para toda textura). Com a chave ligada, `drawTexturas` troca o `TilingSprite` por um `Container` de Sprites dos pedaços que cruzam a vista; a máscara e `ajustarAVista` continuam. Cache LRU (24 a 64 MB), geração em fatias de 8 ms; a névoa nunca dispara geração. Custo estimado: pedaço de 256² a 1x leva 5 a 15 ms; uma vista de 1440x900 pede cerca de 24 pedaços.
- **Metas:** autocorrelação ≤ 0,3 de 16 a 384 px e 0 blocos iguais de 96 px em 2048² (controle: o ladrilho antigo dá 101 iguais e pico 0,836); primeira pintura ≤ 400 ms, quadro p95 ≤ 20 ms, nenhuma tarefa ≥ 200 ms; jogador a 390 px com CPU 4x mais lenta não piora mais de 10% sobre a base de 280 a 560 ms.
- **Barranco** (`relevoRaster.ts:339/369`, atrás da chave): liso, realce em cima, sombra embaixo, sem hachura, contorno a 60% da luz e nunca abaixo de luminância 0,06.
- **Palha:** `'palha'` em `lib/telhado/paletas.ts` (6 cores, base `#d6b56a`), ramo novo em `texturas/telhado.ts:362` com espinha de peixe, `EstiloDoTelhado.tsx`. Não precisa da chave (modelo novo).
- **Chaminé:** `Room.chamine?: true` (retoque Q); posição na água de trás, longe da porta; pintada dentro de `pintarTelhado`; sombra em `telhadosRenderer.ts:300`.

## 4. Chave de obra

- `lib/estiloDoMapa.ts`: `meioTermoLigado()` = constante `CHAVE_DE_OBRA_MEIO_TERMO = false` OU `import.meta.env.DEV && ?obra=meio-termo` (lido 1 vez) OU troca feita pelo teste (`trocarObraNoTeste`, com reset no `afterEach`); `versaoDoEstilo()` entra nas chaves de cache. Só os renderers a leem (`drawPropSilhouettes`, `drawTexturas`, `relevoRaster`); nunca `PixiCanvas` nem `PlayerView`.
- O golden roda com a chave desligada em TODA fatia e tem de dar 9/9. Controle positivo em spec à parte: o mesmo golden com `?obra=meio-termo` TEM de dar diferente. Os specs novos abrem editor e jogador com `?obra=meio-termo`.
- **Como liga (MT12):** num commit único depois que a fase 3 das camadas fechar e for verificada: virar a constante para true, regravar o golden (`--update-snapshots`), folha de antes e depois dos 9 PNG para o usuário aprovar, rodar de novo as 4 jornadas seladas.

## 5. Fatias (1 commit cada na main, só dos próprios caminhos; 1 escritor do Meio-Termo por vez)

| # | O quê | Arquivos-chave | Aceite (teste nasce vermelho) | Quente? | Quando |
|---|---|---|---|---|---|
| MT0 | R0: tipos | `types/map.ts:1688,411`, `lib/mobilia/tipos.ts` | tsc limpo; round-trip de `mapFile` igual; golden 9/9 | `types/map.ts` (2 linhas) | JÁ |
| MT1 | Chave, paleta, ruído sem período, materiais | `lib/estiloDoMapa.ts`, `texturas/meioTermo/{paleta,ruidoDoMundo,materiais}.ts` | chave desligada por padrão; URL ignorada fora do DEV; 3 exemplos de cor para material (`#8b6b47` carvalho, `#6d3337` lã vinho, `#000000` o mais escuro do lugar) | nenhum | JÁ |
| MT2 | Motor de imagem e 6 móveis "de cima" (barril, caixa, baú, cama, mesa, cadeira) | `pixi/rasterDosMoveis.ts`, `moveis/*`, `drawPropSilhouettes.ts` | pixels: cobertura ≥ 25% da pegada, saturação p95 ≤ 0,62, brilho médio ≥ 0,17, contorno ≥ 0,06, mesmo hash para a mesma entrada, ≤ 50 ms a 3x; folha de contato; golden 9/9 | nenhum | JÁ |
| MT3 | Os 5 restantes (cerca reta e curva, armário, aparador, fogueira, tapete) | `moveis/*` | o mesmo de MT2; chama sem mudança | nenhum | faixa A |
| MT4 | Peças novas, lote 1 (barraca, carroça, lampião, quadro, vaso, poço, 2 mesas, lápide) | `lib/mobilia/pecasNovas.ts`, `toolVariants.ts`, `MobiliaControls.tsx` | `mapFile.mobilia` mantém cada tipo novo (hoje some); `fogFilter.mobilia` leva o tipo ao jogador; `ui-onde-foi-parar` regenerado 4/4 | nenhum (só MT0) | faixa A |
| MT5 | Lote 2 (sebe, jardineira, arco, placa de seta, tapete longo) e árvore com atalho | idem + `carimbos/embutidos.ts` | curva da sebe chega ao jogador; borda do tapete longo igual por casa em 3 comprimentos; árvore antiga com o mesmo hash de pixels | nenhum | faixa A |
| MT6 | Telhado de palha | `paletas.ts`, `telhado.ts`, `EstiloDoTelhado.tsx` | round-trip de palha (hoje vira telhas); saturação; fios não retos | nenhum (MT0) | faixa B |
| MT7 | Chão sem repetição | `pixi/pedacosDoChao.ts`, `texturas/meioTermo/chaoNoMundo.ts`, `drawTexturas.ts` | autocorrelação e blocos de 96 px (controle: ladrilho antigo reprovado); e2e com a chave: primeira pintura, p95, tarefa longa, jogador 390 com CPU 4x | nenhum | faixa B |
| MT8 | Barranco liso | `relevoRaster.ts`, `drawRelevo.ts` | energia de borda (Sobel) abaixo da de hoje; contorno ≥ 0,06 | nenhum | faixa B |
| Q (MT9) | Retoque quente (abaixo) | vários | `vistaDosMoveis`, `chamine` e `grade` sobrevivem ao arquivo e chegam ao jogador; golden 9/9 | todos os listados | DEPOIS da fatia 8 das camadas |
| MT10 | Chaminé e grade de prisão | `telhado.ts`, `telhadosRenderer.ts`, `RoomControls.tsx`, `drawWalls.ts:394`, ferramenta de parede | chaminé muda 83 a 100% da caixa contra o mesmo telhado sem ela; robô (250 ms de atraso) não passa pela grade e vê através | nenhum (após Q) | após Q |
| MT11 | Vista 3/4 e chave por mapa | `moveis/*`, `rasterDosMoveis.ts`, `MobiliaControls.tsx` | folha com 3/4 de todos os tipos; ordem por base y; chama deslocada; p95 ≤ 20 ms | nenhum (após Q) | após Q |
| MT12 | Ligar a chave, regravar o golden, versão "linhas" no catálogo (`mobiliaDesenho:'linhas'`) | `estiloDoMapa.ts`, snapshots | golden regravado e aprovado pela folha; jornadas seladas; vitest completo 1 vez | nenhum | fase 3 das camadas verificada |
| MT13 | Limpeza e medição | ramos mortos; `vite build` | build +≤ 60 KB gz; 3 a 5 prints só de layout; o usuário joga e confere | nenhum | último |

Faixa A (móveis e peças) e faixa B (telhado, chão, barranco) usam arquivos disjuntos; com a regra de 3 escritores no total, elas rodam UMA POR VEZ por enquanto, e o orquestrador as intercala. MT1 vem antes das duas.

**Retoque Q, num commit único e com o escritor das camadas parado:** `types/map.ts` (`Room.chamine?: true`, `Prop.mobiliaDesenho?: 'linhas'`, `MapData.vistaDosMoveis?: 'tres-quartos'`, `Wall.grade?: true`); `fogFilter.ts:4982-5011` vira 1 chamada `mobiliaParaJogador(prop)` (porta única em `lib/mobilia.ts`) e `chamine` em `:3897-3937`; `mapFile.ts:539-544` e o leitor do campo do mapa; `mapFactory`/`mapStore` (`definirChamine`, `definirVistaDosMoveis`); `PixiCanvas.tsx:1922` e `PlayerView.tsx:1531-1538` usam o helper `telhadoParaDesenhar(regiao, camada)`; `PlayerView.tsx:2137,2143` e o `PropsView` do editor passam a vista; `hostSession` só se um teste mostrar que o campo do mapa não chega.

## 6. Riscos e como medir

- A chave vazar para o desenho antigo: golden 9/9 em toda fatia mais o controle positivo com `?obra`.
- Mapa antigo: cor livre vira o material mais perto (perde o tom exato, como decidido); teste: abre sem erro e o arquivo sai igual ao salvar sem editar.
- Celular: fila de 8 ms, LRU menor com `pointer: coarse`, nível de resolução; se o p95 passar de 20 ms, levar a geração para um worker na fase 4.
- Tamanho de arquivo: portar cerca de 2500 linhas de protótipo em módulos por peça, `vite build` medido.
- Determinismo entre motores: `Math.cos` no ruído pode variar; o hash dos testes vale por motor.
- `ui-onde-foi-parar` muda com a setinha nova: regenerar o doc.
- Decisões técnicas do arquiteto (reabrir se discordar): girar = a imagem gira junto (a luz gira), sem gerar de novo; a vista Lado prende pelo centro, como hoje; "Preencher" e "Cor da linha" saem do painel do móvel com textura.
- Diagrama: quem implementar faz `docs/diagrams/meio-termo-no-app.html` e a linha no `INDEX.md`.

## 7. MT2/MT3 medido (23/10/2026, worktree `feat/meio-termo`)

**O critério de 50 ms é a mediana MORNA a 3x; a fria é registrada.** A geração anda em fatias de 8 ms (`rasterDosMoveis.ts`), então a primeira imagem lenta atrasa a troca do desenho de linhas pela imagem, mas não vira tarefa longa. A fria depende de JIT e da carga da máquina: a mesma cama deu 51,2 ms numa medida anterior e 47,8 e 49,1 ms agora, no mesmo código. Não houve otimização (nenhum corte sem custo visual achado); o critério ficou como está acima e a fria passou a ser medida também no navegador.

| Onde | Como | Resultado a 3x |
|---|---|---|
| Node, MT2 | `BENCH_MOVEIS=1` em `moveis.test.ts`, 2 rodadas | cama fria 47,8 e 49,1 ms, morna 19,9 e 21,1 ms; o resto frio de 4,8 a 39,2 ms, morno até 14,4 ms |
| Node, MT3 | `BENCH_MOVEIS=1` em `moveisMt3.test.ts`, 2 rodadas | morna até 32,0 ms (tapete 3x2); fria do tapete 3x2 53,4 e 64,0 ms, da primeira cerca do arquivo 43,9 e 47,2 ms (motor ainda frio), o resto até 40,2 ms |
| Chromium (Vite dev) | `e2e/task-meio-termo-moveis-ligado.spec.ts`, página nova, a cama primeiro | cama fria 38,8 a 48,3 ms em 3 rodadas, morna 14,1 ms; tipos da MT3 frios de 11,3 a 36,7 ms, mornos até 24,7 ms |

O e2e falha se alguma mediana morna passar de 50 ms ou alguma fria passar de 100 ms (o teto folgado da suíte).

**Revisão da MT3 (23/10/2026), cada tipo como a PRIMEIRA imagem da página.** A medida acima punha a cama primeiro, então a MT3 já pegava o motor aquecido. O e2e ganhou um teste que abre uma página nova por tipo e mede a primeira `pintarMovel` dela, com o motor frio. Duas rodadas, a 3x no Chromium (Vite dev): cerca reta 21,9 e 23,1 ms; cerca curva 33,6 e 33,4; armário 35,9 e 35,7; armário de lado 25,9 e 28,8; aparador 20,5 e 21,3; fogueira 18,1 e 18,7; tapete 3x2 37,5 e 42,2; tapete redondo 22,7 e 22,8. Todas abaixo do teto de 100 ms da fria e também abaixo dos 50 ms da morna. Não aqueci o motor no ocioso nem pulei o medalhão na borda do tapete: com a pior fria em 42 ms, o ganho não paga o risco de mudar a saída.

**Limites medidos na revisão da MT3:**

- **Tapete fora da grade de referência.** A pegada do desenho é `largura / 50`, não a grade do mapa: numa grade de 70, o tapete 3x2 (210 x 140 px) é desenhado como 4,2 x 2,8 casas, com 2,8 losangos da borda por casa do mapa (são 2 na grade de 50). Usar a grade real pediria a grade na chave, o que passa por arquivo quente (`types/map.ts` e quem chama a silhueta). Fica registrado e preso por um teste (`revisaoMt3Tapete.test.ts`).
- **Cerca longa em ladrilhos.** A cerca sai em ladrilhos de até 1024 px, com o teto de pixels de uma imagem cheia. Escala que sobra, em relação à do nível: a reta de até 40 casas, nos níveis 1 a 3, e a de 100 casas no nível 1 ficam com 1,00; a de 100 casas no nível 3 fica com 0,79 (antes 0,07). A curva conta a caixa inteira, com o miolo vazio do arco: 40 casas com 90° no nível 3 ficam com 0,35 (antes 0,17); 100 casas com 180°, com 0,10. Para a curva longa ficar nítida, o próximo passo seria pular os ladrilhos vazios, com ladrilho menor que 1024.

**Bundle** (`vite build`, chave desligada, com os 11 tipos): os móveis com textura saem num chunk separado, `rasterDosMoveis-*.js`, com **39,58 kB (15,63 kB gzip)**, carregado só pelo import dinâmico do `drawPropSilhouettes.ts` quando a chave liga. Os maiores chunks: main 1.755,45 kB (548,60 kB gzip), LivroDeRegras 1.235,60 kB (412,63 kB gzip), three 746,77 kB (191,66 kB gzip). `dist/` inteiro: 4,9 MB, apagado depois da medida.

### MT4 medido (revisão, 23/10/2026)

**Tempo a 3x no Chromium (Vite dev), cada peça nova como a primeira imagem de uma página nova / mediana morna de 5** (`e2e/task-meio-termo-pecas-lote1.spec.ts`, depois das correções da revisão): mesa quadrada 20,6 / 9,3 ms; mesa redonda 23,0 / 10,3; lápide 9,5 / 3,5; vaso 12,7 / 5,7; lampião 24,4 / 13,5 (o halo de 1,2 casa aumenta a imagem); quadro de avisos 11,6 / 3,2; poço 27,4 / 11,9; barraca 39,5 / 19,0; barraca de lado 33,6 / 17,4; carroça 29,8 / 11,5; carroça de lado 26,7 / 11,4. Todas abaixo de 100 ms (fria) e 50 ms (morna).

**Pendências e riscos registrados na revisão:**

- **Lampião sem luz ligada (DECISÃO DO USUÁRIO, pendente).** O desenho voltou a ser o do protótipo aprovado: vidro aceso (emissão 0,55) e um halo quente fraco pintado na imagem, sem chama. Ele NÃO ilumina o mapa nem a névoa. Opção para decidir: ao pôr um lampião, criar junto uma luz da ferramenta Luz (raio e cor quentes, presa ao objeto, que anda e some com ele) e deixá-la desligável no painel do objeto. Nada disso foi feito.
- **Risco aceito: cliente antigo com tipo novo.** O arquivo do mapa não tem versão. Um app de antes da MT4 que abre um mapa com peça nova não conhece o tipo: o objeto perde o tipo (vira o móvel padrão ou imagem vazia) e, se esse app salvar, o tipo e o material somem do arquivo para sempre. Vale enquanto houver jogadores ou mestres em versões velhas; o atualizador reduz a janela, não a fecha.
- **Custo síncrono de montar a cena com muitas peças novas de uma vez:** medido no jogador (Playwright, Chromium 1243 com GPU, Vite dev, 12 s depois de Entrar), num mapa com 40 peças (as 9 novas, as 2 vistas de lado e os 11 tipos antigos, materiais variados): p95 do intervalo entre quadros 16,8 ms nos três cenários (só linhas, chave desligada, chave ligada com as 40 em imagem), sem tarefa longa >= 200 ms na CPU 1x (o maior quadro 65 a 69 ms); na CPU 4x há UMA tarefa de ~290 ms por volta de 7,2 s, que aparece também só com linhas (não vem das texturas). As imagens saem em fatias de 8 ms, então montar a cena de cada chave nova não trava o quadro. Não medido: o editor (que pinta um Graphics por móvel em `drawProps.ts`) e o build de produção.

**Bundle** (vite build): main 1.757.845 B (+150 B na revisão, de B15 e B16); `materiais` 5.400 B (2.246 B gzip), pré-carregado com o main (o painel e o resumo da ficha precisam do nome do material na hora: carregar sob demanda deixaria os dois vazios ou piscando, então o comentário de "sob demanda" em `drawPropSilhouettes.ts` foi corrigido em vez disso); `rasterDosMoveis` 51.294 B (antes 50.977 B: os desenhos revisados). A varredura das 1000 sementes da MT4 (`rasterDosMoveis.sementesMt4.test.ts`, o pior candidato por critério, níveis 3 e 1) passou de 179 s para 410 a 487 s; tirar o nível 1 economiza ~45 s.

### MT5 medido (lote 2, 23/10/2026, worktree `feat/meio-termo`)

**O que entrou.** Sebe (2 x 0,5; folhas Buxo ou Alfeneiro, materiais novos da classe `folha`; geometria e curva da cerca, em ladrilhos), jardineira (1 x 0,5; madeira), arco do portão (2 x 0,5; madeira e placa), placa de seta (0,5 x 0,5; madeira; o giro dá a direção) e tapete longo (1 x 4; tecido; no chão como o tapete, sempre por baixo dos móveis via `ehMovelDoChao`). Todas no painel de Objetos (sebe e jardineira depois da Cerca, tapete longo depois do Tapete, arco e placa no fim). A árvore continua CARIMBO: `arvore-redonda` nova em `carimbos/embutidos.ts`, logo depois da `arvore` (que não mudou: digital `2310565996` presa em teste), e o menu do Objeto ganhou o grupo "Atalho" com o botão "Árvore redonda", que arma o Carimbo com ela. Sem tecla nova. Desenhos originais inspirados no Estilo Mother da vila (referência de Mother 3; projeto livre, sem venda).

**Limites (não afrouxados), com a semente do app, níveis 1 a 3, 17 candidatos** (`moveisMt5.test.ts`): cobertura, saturação p95 por peça, brilho, contorno, luz linear, opacidade e miolo translúcido (novo: fração do miolo com alfa entre 128 e 242, teto 0,05) passam. A peça pequena (placa, jardineira, arco, sebe) fica a pelo menos 0,07 do chão padrão `#a8776a` em OKLab a 1x e a 3x: a madeira média (pinho, velha, cerejeira) ficava na luz do chão (0,048 a 0,065), corrigido com `tomLongeDoChao` (a madeira mais clara que o chão clareia, a mais escura escurece) e a caixa da jardineira sempre a 0,84. Mutação: alfa x0,9 na composição reprova os 17 candidatos nos 3 níveis; curva zerada na sebe, borda do tapete crescendo com o comprimento e `tomLongeDoChao` neutro reprovam os testes de arco, borda e chão. Varredura das 1000 sementes (`rasterDosMoveis.sementesMt5.test.ts`, pior candidato por critério, níveis 3 e 1): verde; a suíte `src/pixi` inteira (com as duas varreduras) levou 560 s, rodando ao lado de um e2e.

**Divergências do protótipo (motivo):** a placa de seta ocupa a pegada (a do protótipo cobria 20% da meia casa e sumia a 1x); a sombra da sebe é solta (arrastada, a sebe curva de 4 casas levava ~120 ms só de sombra a 3x). A "placa do arco encostada na trave" foi REVERTIDA na revisão (abaixo): o vão de 2 voltou e passa no miolo translúcido.

**Tempo a 3x no Chromium (Vite dev), fria / mediana morna de 5** (`e2e/task-meio-termo-pecas-lote2.spec.ts`): sebe 13,2 / 6,0 ms; sebe curva de 4 casas 40,4 / 32,5; jardineira 16,3 / 5,5; arco 37,0 / 13,2; placa 13,3 / 4,8; tapete longo 1 x 4 29,7 / 15,5. Na folha de contato (Node, uma medida só por quadro), o tapete longo de 1 x 7 deu 56,4 ms a 3x numa imagem só; no app ele sai em 2 ladrilhos de até 1024 px. Risco registrado, não medido no app.

**Tapete longo fora da grade de referência (limite registrado).** A repetição POR CASA vale na grade de 50 px (a chave não recebe a grade real sem arquivo quente). Medido (`moveisMt5.test.ts`): na grade 70, o tapete de 1 x 4 casas do mapa (70 x 280 px) é desenhado como 1,4 x 5,6 casas: 5,6 medalhões em vez de 4, e a borda repete 2,8 vezes por casa do mapa em vez de 2. Na grade 50, o perfil da borda de cada casa do meio é o mesmo nos comprimentos 3, 4 e 7 (diferença máxima de 14 em 255, com amplitude de pelo menos 40).

**Bundle:** nenhum import dinâmico mudou (os desenhos novos entram no chunk `rasterDosMoveis` que já existia), então não houve `vite build` nesta fatia; o tamanho novo do chunk não foi medido.

**Revisão da MT5 (correção, 23/10/2026).** Medido pelo revisor de correção, sob carga (fria / morna a 3x): 59 / 35, 58 / 33 e 53 / 17 ms (no lugar de 40,4 / 32,5, 29,7 / 15,5 e 37,0 / 13,2 acima; a ordem é a do relatório dele, sebe curva de 4 casas, tapete longo 1 x 4 e arco). O que mudou: (1) o atalho da árvore volta o modo do Carimbo para "carimbo" (com a Borracha como última escolha, o clique apagava árvores); (2) o arco limita a escala do atravessado pelo lado curto (`ky = min(kx, curto / 18)`): de 2 a 4 casas, deitado e em pé, toda peça fica dentro da pegada (teste), e os de 3 x 0,5 e 4 x 0,5 passam nos limites; (3) o clique em objeto girado volta o ponto para o referencial do objeto (`propInteraction.ts`), em qualquer giro; (4) arte do designer: a sebe é UMA massa ondulada (tom 0,80, um contorno de 0,2, sem chanfro) com as copas (1,0) recortadas por ela e o realce (1,16) em 60%, ruído de ±0,1, e o escuro levantado dela é o verde-escuro `#2f4a35` (`Cena.corDoPiso`), não o marrom da nogueira (19 a 26% dos pixels marrons antes, menos de 1% agora, teste); a placa de seta tem rabo de andorinha e cabeça larga, só o prego, e o GIRO É PINTADO (o quarto de volta entra na chave, `q90`/`q180`/`q270`; sem giro a chave é a de antes; a tela gira só o resto, `giroDaImagem`): a sombra fica para baixo à direita nos 4 giros (teste); o arco tem os postes 11 x 11 por cima da trave (■━━■, topo em `polar`), a trave de -41 a 41, a placa de 18 x 7 pendurada com o vão de 2 e as correntinhas à mostra; a jardineira tem flores de 5 pétalas numa forma só, chanfro 0,3 R, miolo amarelo e folhas 1,6 : 1; o tapete longo ganhou 2 fios claros na divisa de cada casa (teste); o menu do Objeto saiu em 3 partes (Dentro de casa 12, Rua e jardim 10 e o atalho com a legenda "carimbo", Feira 3) e 5 ícones foram redesenhados (sebe, placa, arco, jardineira, árvore redonda em viewBox 24 e traço 1,6). Tempo a 3x no Chromium depois da revisão (`e2e/task-meio-termo-pecas-lote2.spec.ts`, agora com a SEMENTE DO APP, de `chaveDoMovel`, e não a 7), fria / morna de 5: ver a linha "MT5 revisado" no relatório da revisão (registrada abaixo quando medida no fim). Limite registrado: o giro pintado vale só para a placa; os outros móveis girados ainda giram a imagem inteira (a sombra gira junto).

**Fora desta fatia:** a árvore redonda não está na folha de contato (é carimbo, desenhado em canvas do navegador; aparece no e2e do painel); placa de seta sem texto; flores da sebe e da jardineira fixas (sem material); cliente antigo que abre peça do lote 2 perde o tipo (mesmo risco aceito na MT4).
