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

**Revisão da MT5 (correção, 23/10/2026).** Medido pelo revisor de correção, sob carga (fria / morna a 3x): 59 / 35, 58 / 33 e 53 / 17 ms (no lugar de 40,4 / 32,5, 29,7 / 15,5 e 37,0 / 13,2 acima; a ordem é a do relatório dele, sebe curva de 4 casas, tapete longo 1 x 4 e arco). O que mudou: (1) o atalho da árvore volta o modo do Carimbo para "carimbo" (com a Borracha como última escolha, o clique apagava árvores); (2) o arco limita a escala do atravessado pelo lado curto (`ky = min(kx, curto / 18)`): de 2 a 4 casas, deitado e em pé, toda peça fica dentro da pegada (teste), e os de 3 x 0,5 e 4 x 0,5 passam nos limites; (3) o clique em objeto girado volta o ponto para o referencial do objeto (`propInteraction.ts`), em qualquer giro; (4) arte do designer: a sebe é UMA massa ondulada (tom 0,80, um contorno de 0,2, sem chanfro) com as copas (1,0) recortadas por ela e o realce (1,16) em 60%, ruído de ±0,1, e o escuro levantado dela é o verde-escuro `#2f4a35` (`Cena.corDoPiso`), não o marrom da nogueira (19 a 26% dos pixels marrons antes, menos de 1% agora, teste); a placa de seta tem rabo de andorinha e cabeça larga, só o prego, e o GIRO É PINTADO (o quarto de volta entra na chave, `q90`/`q180`/`q270`; sem giro a chave é a de antes; a tela gira só o resto, `giroDaImagem`): a sombra fica para baixo à direita nos 4 giros (teste); o arco tem os postes 11 x 11 por cima da trave (■━━■, topo em `polar`), a trave de -41 a 41, a placa de 18 x 7 pendurada com o vão de 2 e as correntinhas à mostra; a jardineira tem flores de 5 pétalas numa forma só, chanfro 0,3 R, miolo amarelo e folhas 1,6 : 1; o tapete longo ganhou 2 fios claros na divisa de cada casa (teste); o menu do Objeto saiu em 3 partes (Dentro de casa 12, Rua e jardim 10 e o atalho com a legenda "carimbo", Feira 3) e 5 ícones foram redesenhados (sebe, placa, arco, jardineira, árvore redonda em viewBox 24 e traço 1,6). Tempo a 3x no Chromium depois da revisão (`e2e/task-meio-termo-pecas-lote2.spec.ts`, agora com a SEMENTE DO APP, de `chaveDoMovel`, e não a 7), fria / morna de 5: sebe 17,0 / 8,6 ms; sebe curva de 4 casas 44,0 / 38,8 ms (era 59,6 / 44,9 e passou a 48,5 com a massa ondulada; o atalho do anel na massa e no pé, com os mesmos pixels, a trouxe de volta); jardineira 20,0 / 6,9 ms; arco do portão 38,1 / 11,4 ms; placa de seta girada 90 13,8 / 7,5 ms; tapete longo 33,4 / 21,7 ms (teto morno 50 ms). Chunk rasterDosMoveis no vite build: 60,08 kB (22,88 kB gzip). Limite registrado: o giro pintado vale só para a placa; os outros móveis girados ainda giram a imagem inteira (a sombra gira junto).

**Fora desta fatia:** a árvore redonda não está na folha de contato (é carimbo, desenhado em canvas do navegador; aparece no e2e do painel); placa de seta sem texto; flores da sebe e da jardineira fixas (sem material); cliente antigo que abre peça do lote 2 perde o tipo (mesmo risco aceito na MT4).

### MT6 medido (telhado de palha, 23/10/2026, worktree `feat/meio-termo`)

**O que entrou.** `'palha'` é o 3º modelo em `lib/telhado/paletas.ts`, com 6 cores: Palha `#d6b56a` (a padrão, o token do estilo), Palha clara `#d2bf8c`, Feno `#b39a5e`, Sapé `#9a8155`, Palha velha `#a39478` e Palha com musgo `#7d7a5a`; a cor livre funciona como nos outros modelos. O ramo novo em `texturas/telhado.ts` desenha fileiras de 7 px com a borda em espinha: um V a cada 12 px, com o bico 3,2 px mais perto da cumeeira. O fio tem uma onda sutil, de dois senos (RMS 0,45 px), cuja fase muda com a altura. O bico também anda com a altura, para as colunas não formarem grade. Cada metade do V pega a luz de um lado, os fios descem inclinados a cada 2,6 px, a borda do beiral é franjada (recua de 0 a 1,6 px e a imagem sai recortada) e o claro vai para o neutro, como uma ponta queimada de sol. `EstiloDoTelhado.tsx` mostra "Palha" com a miniatura sem código novo, porque lê `MODELOS_DO_TETO`. `mapFile` já validava o modelo por essa lista: a palha atravessa o arquivo sem mudança no leitor (só o comentário mudou). Não passa pela chave de obra (é modelo novo). Os testes que usavam `'palha'` como modelo desconhecido passaram a usar `'sape'`.

**Medido** (`telhadoPalha.test.ts`, `telhadoPalha.sementes.test.ts`, `telhadoPalha.rede.test.ts`, `telhadoSemMudanca.test.ts`, `e2e/task-meio-termo-telhado-palha.spec.ts`):

- **Arquivo e rede.** Antes desta fatia o arquivo tirava a palha (vermelho conferido). Agora salvar e reabrir mantém a palha e a cor, o recorte do jogador (passado por JSON) leva a palha, e o painel grava `'palha'`. O mapa antigo (sem modelo, com telha, com madeira ou com cor livre) sai do arquivo com os mesmos bytes.
- **Telha e madeira byte a byte.** Digitais FNV de 8 casos (retângulo, L e miniatura, de 1x a 3x, cores da paleta e cor livre), tiradas em `ee3ba7b2`. O golden das camadas passou sem regravar, junto com as 3 jornadas seladas (27 testes).
- **Cor, por telhado** (a peça). Limites: saturação HSV p95 até 0,62 (o limite das peças desde a MT2), croma OKLab p95 até 0,1118 (o token palha, 0,1016, mais 10%) e croma médio até 0,006 acima da cor escolhida. Na sala de 280 x 160 a 1x, a Palha deu saturação 0,522 e croma p95 0,1016; as outras 5 cores deram croma de 0,043 a 0,084. Antes do "claro para o neutro", a Palha dava croma p95 0,1158 e reprovava. Na varredura de 1000 salas sorteadas (grades de 40 a 70, retângulo ou L, as 6 cores, pintadas na escala do app e a 3x), o pior caso deu saturação 0,527 e croma p95 0,1016, e o croma médio ficou sempre abaixo do da cor (−0,002).
- **Fios.** A 4x, a borda medida nos pixels fica a 0,09 px da borda ondulada e a 0,46 px da reta. A onda tem RMS de 0,45 px, e fileiras vizinhas têm desenhos diferentes (mais de 0,5 px de diferença).
- **Mutações, todas vermelhas:** onda zerada, pintor sem a onda, grade (sem deriva e com a mesma onda em toda fileira), franja zerada, claro sem ir para o neutro e palha fora da lista de modelos.
- **Tempo no Chromium (Vite dev), fria / mediana morna de 5, em 3 rodadas.** A palha de 6 x 4 casas de 64 a 3x deu 52,2 / 45,9, 58,8 / 48,1 e 62,3 / 52,3 ms; esta última rodada, que reprovou, é anterior ao ajuste sem `if` no sinal da luz. A telha do mesmo tamanho deu 45,0 / 35,9 e 42,3 / 37,3 ms. A palha de 10 x 8 casas a 3x deu 148 / 140 ms (2,9 milhões de pixels; o app não pinta telhado a 3x). Na sala de 20 x 14 casas na escala do app (0,94x, cerca de 1 milhão de pixels), a mediana morna deu 52,3 e 56,4 ms na palha e 41,7 e 42,9 ms na telha. **A palha está no limite dos 50 ms**: sob carga, a de 6 x 4 a 3x pode passar do teto. A meta do cabeçalho do pintor (1024², 50 ms) a telha cumpre e a palha não cumpre por 2 a 6 ms; o e2e registra essa sala com o teto da fria e com a palha até 1,4 vez a telha.
- **Jogador a 390 px** (`mt6-jogador-390.png`): no miolo da sala, 76% dos pixels mudam entre telha e palha da mesma cor; a sala de controle muda 0%. O matiz é o da palha: a média `#ab9258` é a palha escurecida pela luz da cena.

**Divergências do protótipo** (`vila-estilo-mother/prototipo/mother.js:944-1038`, V de traço reto a cada 9 x 5 px):

- O fio ondula, em vez do V de traço reto (o plano pede fio não reto). O V é maior (12 x 7 px, com bico de 3,2 px), para não virar hachura no zoom normal.
- A franja é a borda da imagem recuando, em vez de meias-luas de traço.
- Sem a cumeeira amarrada do protótipo (faixa de 3,4 px com amarras a cada 9 px): a palha usa a faixa clara de 2,4 px dos outros modelos. Uma faixa mais larga pediria mudar a folga do bloco rápido, que vale para todos os modelos.
- Sem contorno da própria cor no beiral: o pintor do app não tem contorno em nenhum modelo.
- A cor: o token é o do Meio-Termo (`#d6b56a`), não o do Mother (`#f8d850`). **Divergência real, medida na revisão:** o protótipo aprovado também pinta com `#d6b56a` (`vila-meio-termo/prototipo/meio.js:58` e `:88`), mas o RESULTADO dele é mais saturado: a média de um miolo do estábulo em `desktop-1440.png` é `#cb9940` (croma OKLab 0,121), e a média da palha do app a 1x é `#d3b56e` (croma 0,096); distância OKLab 0,075. O app é mais pálido. A cor não foi mudada (o teto de croma 0,1118 protege a regra 5 do estilo): é decisão do usuário, na folha de contato (as duas amostras lado a lado).

**Limites e o que ficou de fora** (os dois primeiros itens de antes foram resolvidos na revisão, abaixo):

- ~~O telhado não é pintado em fatias de 8 ms~~: a palha passou a ser pintada em fatias (revisão).
- ~~O e2e do jogador manda o mapa reaberto inteiro~~: passou a mandar o recorte real (revisão). A causa da espera era o recorte sem a planta lembrada (`planOfWholeMap`): o método da fatia 6 das Camadas resolveu.
- Ficaram de fora a chaminé (MT10), o diagrama e a linha do INDEX.

**Risco aceito: cliente antigo com a palha.** O arquivo do mapa não tem versão. Um app de antes da MT6 que abre um mapa com sala de palha não conhece o modelo: `mapFile` dele descarta o `'palha'` (o modelo vira ausente) e a sala aparece como TELHA na cor da palha (a cor passa, por ser `#rrggbb` válido). Se esse app salvar, o modelo some do arquivo para sempre e a sala fica telha amarela também no app novo. Mesmo risco da MT4 e da MT5; o atualizador reduz a janela, não a fecha.

**Item próprio, FORA da MT6 (bug do jogador, anterior):** no print do jogador a 390 px há uma caixa escura deslocada para cima e para a esquerda sobre a sala A. Ela aparece também na foto de controle, com TELHA, então não vem da palha. É um defeito visível do jogador, não investigado; precisa de fatia própria.

### Revisão da MT6 (correção, 23/10/2026, worktree `feat/meio-termo`)

Duas revisões independentes (design; correção, testes e desempenho). O que mudou:

- **Palha em fatias de 8 ms** (`pixi/telhadosRenderer.ts`, `FATIA_DA_PINTURA_MS`): a textura de até 1 milhão de pixels saía numa tarefa só. Agora `comecarTelhado` / `pintarLinhas` (em `texturas/telhado.ts`) pintam linha a linha com os MESMOS bytes de pintar de uma vez (teste em pedaços de 1 a 7 linhas, palha e telha), e o renderer pinta a palha uma fatia por tarefa. Telha e madeira continuam numa tarefa só, pelo caminho de antes, byte a byte (as 8 digitais de `telhadoSemMudanca.test.ts` não mudaram) e com `pintarCorrida` de volta ao laço de antes da MT6; a palha ganhou corrida própria (`pintarCorridaDaPalha`), com as fases da deriva e das ondas andando por soma.
- **Números do designer contra o "tricô"**: tom por feixe 0,09 → 0,05; luz por braço do V 0,05 → 0,02; fio `(ul − braço × 0,5 × v) × 2,4` a 0,05 → `(ul − braço × 0,15 × v) × 3,2` a 0,1 (~2 px entre fios, quase retos). Autocorrelação da luz a 3x na água de baixo (a medida do designer): 0,324 → 0,198 a 1 fileira e 0,674 → 0,365 a 1 passo, presa em teste (`<= 0,25` e `<= 0,45`). Cor: Palha dourada saturação p95 0,523, croma p95 0,1016 (limites 0,62 e 0,1118). Rejeitado (registro do designer): V raso de 2,0 com deriva 3,5 (vira cabelo ondulado). Franja, onda, as 6 cores, o claro para o neutro e os limites ficaram.
- **Painel a 1280**: "Modelo do telhado" em grade (miniatura em cima, nome embaixo), sem o `gap: 8px`; os 3 nomes aparecem inteiros (o e2e confere `scrollWidth <= clientWidth` e a caixa do nome dentro do botão; antes só a caixa do botão, verde com "Madei" cortado: com o painel antigo o novo teste deu vermelho, "Telhas" 163,3 px contra 160,2 da borda). A cor padrão chama "Palha dourada".
- **Testes que não pegavam nada**: a espinha agora é medida NOS PIXELS com valores fixos (`telhadoPalha.espinha.test.ts`: altura do V de 2,5 a 4 px, medido 3,16; o salto da luz do braço com sinais opostos no fundo e no bico, −6,6 e +5,7 em 255; a diferença de tom entre feixes vizinhos na costura, 3,8; o espalhamento do fundo do V de fileira em fileira, 1,17 px; o fio fino, RMS 14,7) e 6 digitais FNV da palha estão presas (`telhadoPalha.test.ts`, inclusive a sala de 20 x 14 casas na escala do app). As 7 mutações do revisor ficam vermelhas: V zerado, V invertido, deriva zerada, tom por feixe zerado, fio zerado e luz por braço zerada (cada uma em pelo menos um teste de pixel, além da digital), e o fio de antes da revisão reprova a autocorrelação.
- **Varredura de cor**: mais 60 salas grandes (1100 a 2200 por 950 a 1700 px), pintadas na escala do app abaixo de 1x (0,53x a 0,99x: V de ~6 px, fio de ~1 px, serrilhado): pior saturação p95 0,526, pior croma p95 0,1016. As 1000 de antes: 0,529 e 0,1016.
- **e2e** (`task-meio-termo-telhado-palha.spec.ts`): o jogador recebe o recorte real (acima); a sala A é comparada com a TELHA e com a MADEIRA na mesma cor (pintar a palha como madeira dava 0,000 de mudança e agora reprova); o tempo é a mediana de 9, intercalada com telha e madeira na mesma página, com a palha grande até 1,15 vez a madeira (o `< 100` saiu); e um teste novo mede, na CPU 4x (CDP `Emulation.setCPUThrottlingRate`), a textura de 20 x 14 casas pelo renderer de verdade.
- **Folha de contato refeita** (`mt6-folha-de-contato.png`): sem os quadros de 3x (o app nunca pinta telhado acima de 1x); no lugar, a imagem de 1x ampliada 3 vezes com filtro linear, como no zoom de 300%; a palha no chão de terra do Meio-Termo; e as amostras de cor do protótipo e do app. **Conferido de novo com o chão da MT7:** contra a terra `#dda56c`, ΔE OKLab 0,042 e luz 1,10:1 (o par mais fraco, como o designer mediu: 0,041 e 1,09:1).

**Tempo medido (Chromium 1243, Vite dev, máquina com suítes de outros agentes rodando), mediana morna de 9 intercalada na mesma página:** palha 6 x 4 casas a 3x 42,2 e 40,4 ms em duas rodadas isoladas (telha 40,6 e 40,0; madeira 42,0 e 44,0; teto 50 ms). Antes da revisão a palha dava 45,9 a 52,3 contra 35,9 a 37,3 da telha (1,28 vez); agora 1,01 a 1,04 vez. O último corte (na água de beiral deitado a altura não muda na corrida, então a deriva é lida uma vez; mesmos bytes) foi o que a trouxe para o nível da telha: antes dele, uma rodada isolada sob carga deu 54,8 ms (telha 45,4, madeira 57,5) e reprovou; o teto absoluto depende da carga da máquina. Sala de 20 x 14 casas na escala do app (0,94x, ~1 milhão de pixels): palha 44,8 e 47,9 ms, madeira 51,2 e 49,7 (teto: 1,15 vez a madeira). Fria (a primeira da página): 54,6 a 77,1 ms (teto 100). **CPU 4x** (CDP, a textura de 20 x 14 casas pelo renderer de verdade, 3 rodadas): a palha não teve NENHUMA tarefa longa (>= 50 ms) e ficou pronta em 0,9 a 1,0 s; a telha e a madeira, numa tarefa só como antes, deram uma tarefa de 289 a 356 ms e de 278 a 314 ms. Isso passa dos 200 ms da casa, vem de antes da palha e ficou FORA desta revisão (a regra era não mudar o tempo nem o caminho delas): para decidir, pôr telha e madeira no mesmo caminho em fatias (os bytes não mudam, o teste em pedaços já cobre a telha). **Bundle** (vite build): main 1.791,64 kB (560,20 kB gzip); nenhum import dinâmico novo.

**Cumeeira amarrada: FORA agora, REABRE na MT10** (com a chaminé): pintar por cima, depois do laço, só nos pixels a até 3,4 px do cume, sem mexer na folga do bloco rápido (que vale para todos os modelos). **Divergências do protótipo ACEITAS** na revisão: fio ondulado, V de 12 x 7 px, franja pelo recuo da borda e sem contorno.

**Para o usuário decidir, na folha:** (1) a palha no zoom de 300% ainda lê como tricô? (2) a cor do app (`#d3b56e`, mais pálida) ou a do resultado do protótipo (`#cb9940`, croma 0,121, acima do teto de 0,1118 da regra 5)? (3) a palha na terra (ΔE 0,042) basta ou pede borda/sombra mais forte?

### MT7 (chão sem repetição, 24/10/2026, worktree `feat/mt7`)

**O que entrou.** `texturas/meioTermo/chaoNoMundo.ts` (puro): cada pixel do chão sai do LADRILHO DE HOJE da textura lido numa coordenada torcida (domain warp, ruído sem período em 2 escalas de 1 e 0,37 lado do ladrilho, amplitude 0,15 lado), mais as MANCHAS do protótipo (3 escalas de 230, 80 e 27 px; claro +18% para o branco, escuro −13%, os números do realce e da sombra da grama) e o GRÃO (células de 2 x 2 px, força 22, em luz suave). Semente = FNV do id da textura (`sementeDoChao`, a mesma no app e nos testes). `pixi/pedacosDoChao.ts`: pedaços de 256 x 256 px, nível de detalhe pela vista (o menor nível com até 48 pedaços na vista; 64 na imagem exportada), com mipmap; fila de fatias de 8 ms (um passo de 8 linhas por vez, no mínimo um por fatia); cache LRU por bytes (64 MB no computador, 24 MB com `pointer: coarse`, CPU + placa + mipmap), o pedaço em uso nunca sai e o que sai é destruído (`destroy(true)`); quem sai da vista antes de começar sai da fila; a névoa não pede pedaço (só `ajustarAVista` e a pintura). `drawTexturas.ts`: com a chave LIGADA, cada camada vira um grupo (o `TilingSprite` de hoje por baixo como placeholder + os pedaços por cima) com a mesma máscara; o placeholder some (`renderable`) quando os pedaços da vista chegam; trocar de nível mantém os pedaços de antes por baixo até os novos chegarem; a imagem exportada espera os pedaços. Com a chave DESLIGADA o palco é o de antes (o único acréscimo no caminho desligado é a marca `performance.mark('texturas:no-palco')`, sem pixel).

**Medido** (`chaoNoMundo.test.ts`, 2048 x 2048 px pintados pedaço a pedaço, mapa de 30 x 20 casas de 64, ladrilho de 192 px nas 3 texturas, o pior caso: o de antes repete a cada 2 blocos):

| Bioma | Blocos de 96 iguais (depois / antes) | Pico da autocorrelação 16-384 px (depois / antes) | Sem torção (mutação) | Saturação p95 (depois / antes) | Croma médio | Menor luz OKLab |
|---|---|---|---|---|---|---|
| Grama | 0 / 346 de 441 | 0,005 / 0,798 (192 px) | 0,390 | 0,521 / 0,526 | 0,1360 / 0,1421 | 0,616 / 0,678 |
| Terra | 0 / 351 | 0,004 / 0,846 | 0,460 | 0,449 / 0,445 | 0,0604 / 0,0635 | 0,492 / 0,554 |
| Floresta | 0 / 356 | 0,044 / 0,811 | 0,741 | 0,815 / 0,816 | 0,0836 / 0,0863 | 0,254 / 0,282 |

Controle positivo: o ladrilho de antes REPROVA nas mesmas medidas (346 a 356 blocos iguais, pico 0,80 a 0,85). Mutação: sem a torção (só manchas e grão) o pico volta a 0,39 a 0,74 e reprova: é a torção que tira a repetição, não o grão. Emenda entre pedaços: salto médio de luz 4,56 na emenda contra 3,12 dentro (teto 1,5 vez). Mesmos bytes em fatias de linhas e de uma vez; sem `Math.random` (espião); o nível 2 tem a mesma cor média do nível 0 (menos de 3 em 255). Pedaço de 256 x 256 no nível 0 em Node: mediana 3,0 ms, pior 4,9 ms.

**e2e** (`e2e/task-meio-termo-chao.spec.ts`, jogador de verdade com o mapa do arquivo, o recorte real e a rede; 1440 x 900, CPU 1x, Chromium 1243, Vite dev, 3 rodadas intercaladas): primeira pintura desligada 2170/1071/1070 ms (mediana 1071), ligada 1131/1084/1081 ms (mediana 1084, +1,2%); chão pronto 1131 a 1177 ms (cerca de 50 ms depois da primeira pintura); arrastar e afastar por ~3 s: quadro p95 16,9 ms desligada e 16,8 ligada; maior tarefa longa 67 ms na abertura ligada, 0 no passeio. 54% do chão do mapa muda de luz (> 6) com a chave contra 0% entre duas aberturas desligadas. Golden das camadas (estrito, sem regravar) e as 3 jornadas seladas passaram (27 testes); `src/pixi` inteiro 138 arquivos / 1955 testes verdes; `tsc` do app e do e2e limpos.

**Divergências do protótipo (motivo):**

- O protótipo pinta a grama do zero (cor base + manchas + carimbos de tufo e flor + grão). O app lê o ladrilho da textura que o mestre escolheu (todas as do catálogo e as importadas) numa coordenada torcida: a textura continua a do mestre, só não repete.
- Sem tufos e flores sorteados por célula: o ladrilho da grama do app já tem os tufos, e flor em toda textura pintada (inclusive floresta e neve) pede a decisão de em quais texturas ela cai. FORA desta fatia.
- As manchas valem para todas as texturas naturais com a proporção da grama (18% / 13%), não só para a grama.
- Luz suave simplificada no grão (`c + d·c·(1−c)`), mesma força 22.
- As texturas assentadas em casas (convés, lajotas, calçamento) não torcem (a junta fica reta e na grade): a repetição delas é a grade das juntas, como o ritmo de fileira da praça do protótipo (0,36 a 20 px); manchas e grão variam o tom. A autocorrelação delas não foi medida.

**Limites e riscos:**

- **Primeira pintura acima de 400 ms também com a chave desligada** (~1,07 s neste mapa de 3 texturas, ladrilhos gerados em fatias, de antes da MT7): o teto do e2e é 400 ms OU 10% sobre a desligada. Com o placeholder, a MT7 não atrasa a primeira pintura; o chão sem repetição chega ~50 ms depois.
- **NÃO VERIFICADO EM CELULAR** (ordem do usuário de 24/10/2026: foco só no PC; o teste a 390 px com CPU 4x saiu do aceite). O teto menor de bytes com `pointer: coarse` existe, mas não foi medido.
- O nível de detalhe sai da vista em px do mundo (o renderer não recebe o tamanho da tela): numa tela pequena com o mapa afastado o pedaço pode ter mais pixels que a tela (o mipmap evita o serrilhado; gasta mais).
- O teto do cache é macio para os pedaços em uso (a vista inteira fica, mesmo acima dele).
- A prévia do pincel (enquanto o traço não termina) continua com o ladrilho repetido; ao soltar, a camada vira pedaços.
- Semente por textura, não por mapa: a mesma textura na mesma posição sai igual em dois mapas.
- Importadas: o caminho é o mesmo (pixels lidos da tela do ladrilho), sem e2e próprio.
- Bundle (`vite build`): o código novo cai no chunk compartilhado `LivroDeRegras` (1.286.990 B, 427.831 B gzip); o main ficou com 1.791,64 kB, o mesmo da MT6.

**Para o usuário decidir, na folha** (`docs/design/objetos/provas/mt7-folha-de-contato.png`, 15 quadros: 3 biomas, antes e depois a 100% e a 25%, e depois a 300%; print `mt7-jogador-1440.png`): (1) as manchas claras a 25% (terra) parecem névoa? baixar o claro de 18% para ~12% é um número; (2) flor e tufo sorteados na grama entram (e em quais texturas)?

### MT8 medido (barranco liso, 24/10/2026, worktree `feat/mt8`)

**O que entrou.** `texturas/meioTermo/barranco.ts` (puro, sem sorteio): a cor da parede do penhasco depende só da fração da altura (0 = lábio, 1 = pé). Realce `#c28b71` cheio até 8% e some até 42%, base `#aa745c`, sombra `#915f4a` de 50% a 95%, sempre em smoothstep. O contorno sai pela receita do protótipo (`mother.js`, `tons`, `escuroDoContorno: 0.6` do Meio-Termo): matiz 6° mais quente, saturação +0,12, 60% da luz HSL, subindo de 0,01 em 0,01 até a luminância 0,07. Deu `#743d2e`, luminância 0,0725, OKLab L 0,425. `pixi/relevoRaster.ts` lê `meioTermoLigado()` uma vez por geração. Com a chave ligada, troca só a cor das MESMAS faixas (mesmas pausas a cada 8 faixas) e pinta uma faixa a mais, o contorno do pé, com 1,2 px do protótipo (no mínimo 1 texel), por cima das faixas e antes de apagar a terra. Onde a parede é mais baixa que o contorno (ponta da rampa), ela vira contorno inteira. Nenhuma tela nova, nenhuma textura nova (teto 2048² e `destroy(true)` de antes). `drawRelevo.ts` não mudou: a chave é lida na geração, e a URL não muda no meio da sessão.

**Medido.** Energia de borda = Sobel na luz, média do miolo da parede (pixel com os 8 vizinhos de parede); teto POR ALTURA, porque a parede curta tem o mesmo perfil em menos texels. Teto fixo nos dois testes: Baixo 0,035, Médio 0,02, Alto 0,009.

| Onde | Liso (Baixo / Médio / Alto) | Antigo (Baixo / Médio / Alto) |
|---|---|---|
| Tela falsa (`relevoRaster.test.ts`) | 0,0213 / 0,0100 / 0,0069 | 0,0564 / 0,0330 / 0,0190 |
| Chromium, textura 2048 x 935 (`task-meio-termo-barranco`) | 0,0219 / 0,0099 / 0,0047 | 0,0481 / 0,0274 / 0,0135 |

- **Contorno e piso:** o menor pixel de borda e o menor pixel da parede inteira dão 0,0725 nos dois motores, também com o antialias do Chromium sobre a sombra no mar. O antigo dá 0,0577 a 0,0594 e reprova no piso de 0,06.
- **Contraste do pé:** pé contra a parede 4 texels acima, em OKLab: 0,11 a 0,17, com o mínimo de 0,06. O antigo Baixo também passa (0,135 a 0,209), então esse critério não entra no controle positivo; o antigo reprova na energia e no piso.
- **Cor:** saturação HSV p95 de 0,490 a 0,603 (teto 0,62). O Baixo é o mais alto, porque o contorno pesa mais numa parede curta.
- **Chave desligada:** 3 digitais FNV dos floats da textura, tiradas numa cópia do `relevoRaster.ts` de `2d376778`: 3111649189, 1344256651 e 813745873 (Médio no mestre; 3 alturas com borracha; jogador com a visão cortando a costa). Iguais depois da MT8. O golden estrito das camadas passou sem regravar, junto com as 3 jornadas seladas (31 testes no e2e, com os 4 do barranco).
- **Sem `Math.random`** (espião), a mesma textura duas vezes, e com a chave ligada nenhuma tela a mais que desligada; toda tela de trabalho é descartada.
- **Mutações, todas vermelhas:**
  - sem o contorno do pé: o teste "ligada" (contraste);
  - chave ignorada (liso sempre): a digital e o controle positivo;
  - contorno escuro sem piso: os 2 testes de tom e o "ligada";
  - realce em degrau (some em 8,1% em vez de 42%): o perfil liso.
  O vermelho de origem também foi conferido: "ligada" contra o código de antes reprova (0,0564 no Baixo).
- **Tempo (Chromium 1243, Vite dev, PC, CPU 1x; mapa de 3000 x 2000 de mundo, costa com as 3 alturas, intercalado):**
  - textura morna 59 e 63 ms com o liso contra 60 e 62 ms com o antigo; fria 40 a 43 contra 39 a 42 ms;
  - etapa da parede 48,2 a 52,1 contra 48,1 a 49,2 ms;
  - nenhuma tarefa longa (≥ 50 ms) nas 6 gerações. A geração já cede a vez entre as etapas e a cada 8 faixas, então não precisou de fatia nova de 8 ms.
- **Jogador no PC (1440 x 900, recorte real e rede):**
  - relevo pronto 280 a 281 ms depois do clique contra 260 a 271 ms com o antigo;
  - quadro p95 16,9 e 17,0 contra 16,9 ms;
  - nenhuma tarefa longa durante a geração do relevo; a maior da página, 62 a 69 ms, aparece nas duas.
- **Bundle:** `vite build` com o main em 1.809,86 kB (565,25 kB gzip). Não foi comparado com a main sem a MT8. `barranco.ts` só importa `ruido.ts` e `paleta.ts`, que já estavam no grafo do main.
- **Fora da medida:** celular. Por ordem do usuário de 24/10/2026, só PC: sem 390 px e sem CPU 4x.

**Divergências do protótipo (motivo):**

- **Realce contínuo no lábio**, em vez dos traços partidos do protótipo (`faixaDoBarranco`, ligados por `hash(arco / 26)`). O comprimento de arco da fita muda com o recorte da névoa do jogador, então os traços piscariam e andariam enquanto ele explora.
- **Pé reto, seguindo a costa e a rampa**, em vez do zigue-zague de 9 px. O zigue-zague mudaria a altura da parede e a sombra no mar (a silhueta), o que é geometria, não cor. Fica para outra fatia se o usuário pedir.
- **Sem a grama felpuda por cima.** A terra do app pode ter qualquer cor ou textura; tufo e flor são assunto do chão (a MT7 deixou isso FORA também).
- **Contorno só no pé e nas pontas da rampa**, como o caminho do contorno do protótipo (que não passa pela beira de cima). Onde a costa volta para trás, a fita é cortada e a ponta fica sem contorno.
- **Piso do contorno a 0,07**, não 0,06, para o antialias do Chromium sobre a sombra no mar não puxar o pixel do pé para baixo da regra. Os 60% da luz dão 0,068; o piso sobe para 62% (cerca de 3 em 255).
- **Cor:** os tokens `barranco` do Meio-Termo (`#aa745c`), tom de terracota, no lugar da areia das 6 faixas de antes (lábio `#e0c088`). No jogador o "mar" do app é o fundo escuro, não o azul do protótipo; o barranco se lê bem nos dois (print `mt8-jogador-1440.png`).

**Limites:**

- **Serrilhado na diagonal a 300%.** A textura do relevo tem até 1 texel por px de mundo (0,68 neste mapa), então na emenda em rampa a 300% o contorno mostra os degraus dos texels. O antigo mostra os mesmos degraus nas faixas escuras.
- **Saturação no limite no Baixo:** 0,603 contra o teto de 0,62. Uma parede ainda mais curta, perto do mínimo de 1 texel de contorno, chega mais perto do teto. Não medido abaixo do Baixo.
- **A chave lida por geração:** trocar a chave no meio da sessão (só o teste faz isso) só muda o barranco na próxima geração do relevo.

**Para o usuário decidir, na folha** (`docs/design/objetos/provas/mt8-folha-de-contato.png`, 12 quadros: antes e depois a 50%, 100% e 300%, as emendas Médio-Alto e Baixo-Médio, e Baixo, Médio e Alto a 300%; tempo = mediana de 3 gerações):

1. A terracota do Meio-Termo no lugar da areia agrada, ou o barranco deve puxar para a cor da terra/praia?
2. O realce do lábio está forte o bastante a 100%? Hoje ele quase só aparece a 300%.
3. O contorno do pé, fino, basta, ou o pé pede o zigue-zague do protótipo?

### Mesas (24/10/2026, worktree `feat/mesas`)

**Pedido literal** (sobre as folhas): "tudo está bom, exceto a mesa, está faltando a versão redonda e versão quadrada pode ser melhor, a mesa parece um móvel não uma mesa, o resto tá bom."

**A redonda não faltava no app.** `mesaRedonda` está no catálogo (`TIPOS_NO_CATALOGO`, logo depois de `mesa` e `mesaQuadrada`), no menu do Objeto (parte "Dentro de casa", radio "Mesa redonda" em `docs/ui-onde-foi-parar.md:221`), sai sempre em imagem (peça nova da MT4) e aceita as 5 madeiras. Faltava NA FOLHA: a da MT2 só tinha a retangular nas 3 madeiras, e a da MT4 mostrava a redonda só em carvalho, com o tampo cobrindo a pegada e as pernas escondidas embaixo (só a sombra delas), lendo como tampa de barril. Nada mudou no catálogo nem no menu (teste em `pixi/drawPropSilhouettes.mesas.test.ts`), então `ui-onde-foi-parar` não foi regenerado.

**O que entrou** (`texturas/meioTermo/moveis/mesaComPernas.ts`, usado por `mesa.ts`, `mesaQuadrada.ts` e `mesaRedonda.ts`; o desenho de antes ficou em `mesasAntigas.testkit.ts`, só para teste):

- Tampo recuado 0,075 casa da pegada (redonda: 0,03), tábuas de 0,2 casa ao longo do lado maior (redonda: em faixas), quina de 0,04 casa, chanfro de 1,6 px e contorno 0,06; a BORDA CLARA soma luz de 0,2 na quina, caindo até zero em 0,055 casa (a quina gasta pega luz).
- ESPESSURA: o mesmo contorno, tom 0,66, deslocado 0,032 casa para baixo e 0,008 para a direita (a face da tábua grossa).
- PERNAS à mostra: quadradas de 0,12 casa nas quinas da pegada, tom 0,64, aparecendo em L fora do tampo (retangular e quadrada); na redonda, 4 pernas redondas de raio 0,06 casa nas diagonais, com o centro 0,011 casa além da borda. Cada perna tem o contato no chão (0,34) e o rastro arrastado até a altura do tampo (0,30, borrão 0,9 px), que aparece como um risco diagonal ao lado das quinas.
- SOMBRA DE BAIXO (0,40, logo em volta do tampo, 0,025 casa além dele com borrão do mesmo tamanho) mais pesada que a SOMBRA DO TAMPO (solta, 0,22, borrão firme de 1,8 px, deslocada pela altura de meia casa).
- Medidas POR CASA: de 2 x 1 para 3 x 1 a tábua, a perna, o recuo e a borda são os mesmos (só o comprimento cresce); pegada menor que 1 casa encolhe tudo junto. A semente de cada tipo continua (50, 60, 70).

**Compatibilidade.** Nenhum id, ordem, campo de arquivo ou caminho de chave mudou: a `mesa` (um dos 11 de antes) só sai na imagem nova com a chave de obra ligada; desligada, continua no desenho de linhas (teste: nenhuma imagem pedida). A quadrada e a redonda saem sempre em imagem, como na MT4. As digitais da chave desligada e o golden não passam por estes arquivos.

**Medido** (`moveis/mesas.test.ts`, 63 testes; semente do APP via `chaveDoMovel`): nas 3 formas x 3 madeiras, nos níveis 1 e 3, (1) a parte de cada perna fora do tampo é 100% opaca e 0,09 a 0,18 mais escura que o miolo; (2) a faixa logo fora do tampo em cima e à esquerda é chão (100%) com alfa médio de 75 a 89 em 255, acima da sombra do tampo (54 a 56); a sombra do tampo à direita tem a largura prevista pela altura (7,8 a 8,4 px contra 7,0 a 7,6, tolerância de 1,5 px mais 1 pixel); (3) a faixa da borda é 0,018 a 0,038 mais clara que o miolo. CONTROLE POSITIVO: a mesa de antes, com a mesma semente e o mesmo material, reprova nas três provas em todos os 18 casos (a perna é a travessa, da cor do tampo; a faixa fora do tampo é peça; a borda é mais escura que o miolo). Mais 4 tamanhos (3 x 1, 1 x 2, 4 x 2, redonda 2 x 1,25) passam. Não estica: 2 x 1 e 3 x 1 têm as mesmas 4 frestas e a mesma área de perna; a de 4 x 2 tem 8, e a tábua vista nos pixels é a de 0,2 casa nas duas (a de antes, na 4 x 2, tinha mais de 1,5 vez isso). Limites da MT2 (cobertura, saturação p95 <= 0,62, brilho, contorno, preto levantado, opacidade) nos níveis 1 a 3, com a semente do app: verdes. Sem `Math.random` (espião), mesma digital duas vezes. **Mutações, todas vermelhas:** sem pernas (23 testes), sem sombra de baixo (23), chave ignorada no `drawPropSilhouettes` (o teste da chave desligada).

**Tempo a 3x no Chromium 1243 (Vite dev, PC), semente do app, cada mesa como a primeira imagem de uma página nova (fria) / mediana morna de 5** (`e2e/task-meio-termo-mesas.spec.ts`, rodada final): retangular 24,9 a 26,9 / 10,4 a 10,9 ms; quadrada 16,5 a 18,3 / 6,0 a 6,9 ms; redonda 20,8 a 22,7 / 9,6 a 10,2 ms (rodada anterior: 23,5 a 24,0 / 9,9 a 10,7; 16,7 / 6,1 a 6,5; 21,3 a 23,2 / 9,9 a 11,0). O e2e reprova a fria OU a morna acima de 50 ms. Na MT4, a quadrada e a redonda davam 20,6 / 9,3 e 23,0 / 10,3 ms. Tarefas longas: a maior da página de medida foi de 60 a 88 ms (a abertura da página). No jogador com as 9 mesas e a de 3 x 1 e a chave ligada, do Entrar à tela parada a maior tarefa longa foi 66 ms; o controle, o mesmo mapa sem móveis, deu 63 ms. Na primeira rodada, antes de separar a abertura da página do Entrar, apareceu UMA tarefa de 200 ms sem atribuição (a medida contava a página inteira, com o main do Vite frio); com a separação e o controle ela não voltou. Na folha (Node, uma medida por quadro, com a máquina rodando suítes de outros agentes), o primeiro quadro do arquivo deu 48,6 ms a 3x (motor frio) e os outros de 7,5 a 26,1 ms.

**Rodadas finais, verdes:** `tsc --noEmit` do app e do e2e (exit 0); `vitest related` dos 4 arquivos de desenho (138 arquivos, 1679 testes, com as varreduras de sementes da MT4 e da MT5); e2e com 1 worker, 33 de 33: `task-meio-termo-mesas` (novo, não selado), `task-meio-termo-moveis-ligado`, `task-camadas-golden` estrito (nenhum PNG regravado) e as 3 jornadas seladas (`task-jornada-camada-travada`, `task-layers-visibility`, `task-jornada-atalho-com-foco-no-painel`).

**Divergências do protótipo** (`objetos.js:1111-1141`, a mesa entre duas travessas de topo): sem as travessas (eram o que fazia a mesa ler como banco ou caixa); o tampo não cobre a pegada inteira (o clique continua pegando a pegada inteira); pernas à mostra nas quinas, como pernas abertas, em vez de só a sombra delas; a espessura, a borda clara e a sombra de baixo não existiam lá; a tábua é por casa, não a altura / 4,2.

**Limites:**

- A luz é fixa (de cima à esquerda): girar a mesa gira a imagem com a sombra junto, como os outros móveis (só a placa de seta tem o giro pintado).
- Fora da grade de referência (50 px) vale o limite do tapete: numa grade de 70 a tábua e a perna saem com o tamanho de 50 px de mundo (0,2 x 50 = 10 px de tábua), ou seja, mais tábuas por casa do mapa.
- A retangular deitada em pé (1 x 2) corre as tábuas em pé; a redonda oval (2 x 1,25) tem as pernas nas diagonais da elipse.
- NÃO VERIFICADO EM CELULAR (ordem do usuário de 24/10/2026: só PC). Não medido: o editor (um `Graphics` por móvel) e o build de produção.

**Para o usuário ver, na folha** (`docs/design/objetos/provas/mt-mesas-folha-de-contato.png`, 12 quadros: as 3 formas nas 3 madeiras e a de 3 x 1, cada um com ANTES e DEPOIS no nível 1 e no nível 3, o tempo do depois embaixo): (1) lê como mesa a 1x (o quadro pequeno)? (2) as pernas à mostra nas quinas, como pernas abertas, servem, ou prefere a mesa com a frente aparecendo (as duas pernas da frente embaixo do tampo, como em vista 3/4)? (3) a borda clara está forte ou fraca?

### MT9 medido (retoque Q, 24/10/2026, worktree `feat/mt9`)

**O que entrou (só encanamento; a chave de obra continua DESLIGADA e nada muda na tela).** Quatro campos opcionais em `types/map.ts`: `RoomMeta.chamine?: true`, `Prop.mobiliaDesenho?: 'linhas'`, `MapData.vistaDosMoveis?: 'tres-quartos'` e `Wall.grade?: true`. Leitura estrita em `lib/mapFile.ts` (`roomChamineFromFile`, `gradeDoArquivo`, `vistaDosMoveisField`) e em `propMobiliaFromFile` (`normalizarDesenhoDoMovel`): só o valor válido entra, o resto sai sem a chave. Recorte do jogador (`lib/fogFilter.ts`): os campos do móvel passam pela PORTA ÚNICA `mobiliaParaJogador(prop)` em `lib/mobilia.ts` (o bloco que morava em `propForPlayer`, mais o desenho); a chaminé segue o `roof`, como o modelo e a cor; a grade passa por `gradeSoNaJanela`; a vista volta por `vistaDosMoveisParaJogador`. Store: `definirChamine` e `definirVistaDosMoveis` (`lib/mapFactory.ts`, `stores/mapStore.ts`), com desfazer. Desenho: `telhadoParaDesenhar(regiao, camada)` em `pixi/telhadosRenderer.ts` (o item ganhou `chamine?: true`, que o renderer ainda ignora), usado por `PixiCanvas` e `PlayerView`; `drawPropSilhouettes` ganhou o 5º parâmetro opcional `vistaDosMoveis` (assinatura compatível), que o editor (`PropsView.vistaDosMoveis`, repinta ao trocar a vista por uma assinatura da store) e o jogador (vista na chave `lastPropsKey`; chaminé na chave dos telhados) passam. `hostSession` NÃO mudou: o teste do pacote real mostrou os campos chegando (snapshot e delta levam o mapa inteiro).

**Decisões não óbvias (a recomendada, registrada aqui):**

- `mobiliaDesenho: 'linhas'` vale em QUALQUER tipo do catálogo (as peças novas também). Quais tipos o catálogo oferece em linhas é da MT12; a leitura só garante o tipo válido.
- A vista dos móveis só vai ao jogador com ALGUM móvel (tipo do catálogo) no recorte dele: sem móvel à vista, com Objetos escondida dos jogadores, ou só objeto de imagem, o campo nem sai.
- A grade só atravessa numa parede que é `janela` e sem porta; fora disso a parede chega sem ela (inclusive o pedaço de porta secreta, que já perdia a `janela`).
- `definirChamine` não exige o teto ligado (o mestre pode marcar antes); o desenho e o recorte só a usam com o teto. Desligar TIRA o campo.
- Trailer do commit: o sistema mandou `Claude Opus 5.5`, e ele venceu o pedido (`Sonnet 5.5`).

**Medido** (`mapFile.retoqueQuente`, `fogFilter.retoqueQuente`, `net/hostSession.retoqueQuente`, `stores/mapStore.retoqueQuente`, `pixi/retoqueQuente.desenho`: 47 testes):

- **Arquivo.** `maps/L1.json`, `legacy-map.json` e `legacy-room-door.json` abrem sem os campos e salvam byte a byte iguais às cópias congeladas `roundtrip-924c2bdd`; o mapa com os 4 campos faz ida e volta idêntica; 11 valores tortos (`false`, `null`, `0`, `1`, `""`, `"sim"`, `"Linhas"`, `"tres_quartos"`, `{}`, `[]`, `["linhas"]`) saem dos 4 campos e o arquivo sai igual ao do mapa sem eles.
- **Recorte (pacote forjado).** O desenho só no móvel à vista (o de trás da parede não vai, nem o id; torto, sem tipo ou em camada livre escondida, não vai). A vista só com móvel no recorte (sem móvel, só imagem, Objetos escondida ou torta: não vai). A chaminé só com o teto fechado (aberto, desligado, torta, Telhados escondida ou telhado em livre escondida: não vai). A grade só na janela à vista (parede comum, porta secreta, torta, cela de trás da parede ou em livre escondida: não vai). Os recortes congelados `recorte-b934f2a1` continuam iguais (`fogFilter.camadas.test.ts`).
- **Pacote real do host** (`createHostSession` + `broadcast`, passado por JSON): o jogador da Vila recebe os 4 da Vila e nenhum id da Cripta (cena de fundo em 3/4); a Vila "de cima" não recebe o 3/4 da Cripta; a troca da vista pelo mestre chega no broadcast seguinte, nos dois sentidos.
- **Store:** ligar e desligar com desfazer e refazer; desligar tira o campo; o mesmo valor, região comum e id inexistente não gastam histórico.
- **Vermelho de origem:** os 5 arquivos contra o código de antes (só os testes novos): 37 de 47 falham.
- **Mutações, 14 de 14 vermelhas:** recorte sem o desenho, sem a chaminé, sem a vista; grade crua (sem exigir janela); chaminé de teto aberto; `mapFile` aceitando grade, chaminé, vista e desenho inválidos; `mapFile` perdendo a vista; helper de telhado ignorando a camada; helper sem a chaminé; editor sem passar a vista; store sem histórico na chaminé.
- **N2** (`scripts/teste-rapido.cjs --nivel 2 --base main`, Chromium 1243): tsc do app e do e2e 0 erros; vitest rápido + lento 1781 arquivos, 17844 testes, 0 falhas; desempenho 10 arquivos, 202 testes, 0 falhas; e2e 642 passaram e 157 falharam = 154 conhecidas + 3 NOVAS, todas de tempo (`task-jornada-pesca` (a), `task-meio-termo-pecas-lote2` tempo a 3x, `task-meio-termo-telhado-palha` tempo). Os 3 specs rodados sozinhos, com 1 worker: 12 de 12 passaram. Golden estrito 19 de 19 sem regravar e as 3 jornadas seladas (camada travada 2, visibilidade 1, atalho com foco no painel 5) passaram. Aviso da ferramenta: a conhecida `task-camadas-painel` "esconder Desenhos dos jogadores" passou (enxugar a lista é do orquestrador).

**Fora desta fatia:** o desenho da chaminé e da grade (MT10), a vista 3/4 e o painel da vista (MT11), a versão em linhas no catálogo (MT12), a ferramenta de parede que grava a grade (MT10). Não medido: a tela (nada muda nela por construção; o golden confirma) e o celular.
