# Explorador: Criar Mapas e Carregar Mapa (editor de mapa)

Data: 26/11/2026. Só leitura de código, nada foi alterado nem testado rodando.
Ponto de partida: os passeios em docs/qualidade-de-vida/relatorio-mestre.md e relatorio-jogador.md.
Gravidade: G = grande (perde trabalho ou trava), M = média (atrapalha sempre), P = pequena.

Arquivos principais lidos: client/src/App.tsx, client/src/pixi/PixiCanvas.tsx (10.585 linhas),
client/src/lib/keymap.ts, client/src/screens/NewDungeonMap.tsx, client/src/screens/LoadMapScreen.tsx,
client/src/pixi/world.ts, client/src/pixi/terrenoDoChao.ts, client/src/pixi/drawTexturas.ts,
client/src/pixi/desenhoSobPedido.ts, client/src/stores/mapStore.ts, client/src/stores/miniaturasDasCenas.ts,
client/src/lib/mapFileIO.ts, client/src/components/livro/EscolhaDoObjeto.tsx, client/src/components/labels.ts.

---

## Bugs certos

### 1. "Voltar ao início" prende o mestre no mapa quando salvar falha (G)
- Onde: client/src/App.tsx:3317-3330 (handleGoHome).
- Sintoma: clicar em Voltar ao início (ícone ou Arquivo) tenta salvar; se salvar falha, aparece o erro e o app fica no mapa. Não existe "sair sem salvar". No navegador salvar sempre falha, então não há saída sem recarregar a página.
- Causa: setScreen("menu") só roda dentro do try, depois do persistMap(). No catch só sai o aviso. Também salva mesmo com o mapa sem mudança nenhuma (não olha isDirty).
- Efeito colateral: as rotinas e patrulhas dos NPCs são paradas ANTES de salvar (linhas 3321-3322). Se salvar falha, o mestre fica no mapa com os NPCs parados sem saber por quê.
- Conserto: com o mapa sem mudança, sair direto. Com mudança, abrir o UnsavedChangesDialog que já existe no mesmo arquivo (App.tsx:528, com Salvar e continuar / Descartar / Cancelar) em vez de salvar calado. Parar as rotinas só depois de decidir sair.

### 2. Esc não larga a ferramenta (Objeto e todas as outras) (M)
- Onde: client/src/pixi/PixiCanvas.tsx:10134-10149 (case "cancel" do runShortcut); client/src/lib/keymap.ts:388.
- Sintoma: com Objeto na mão, Esc não volta para Selecionar; o próximo clique continua pondo móvel.
- Causa: o "cancel" só limpa rascunho, marquee e a escolha do painel (clearDrafts, soltarTerrenoNoEsc, soltarPainelNoEsc). Nenhuma linha chama setActiveTool("select"). Além disso, com o foco na busca "Procurar objeto", o Esc é engolido pelo próprio campo (EscolhaDoObjeto.tsx:190-195 chama consumir e só apaga a busca ou tira o foco).
- Conserto: no "cancel", quando não havia nada para cancelar (sem rascunho, sem seleção, sem marquee), trocar para Selecionar. É a convenção dos editores (Figma, Excalidraw): primeiro Esc cancela o gesto, segundo Esc larga a ferramenta.

### 3. Clicar num token com a ferramenta Objeto põe um móvel em cima do token (M)
- Onde: client/src/pixi/PixiCanvas.tsx:7139 (ramo mobilia/construcao) e :2204-2208 (objetoPrendeOCliqueDePor).
- Sintoma: clicar no Marinheiro com Objeto criou um Balcão em cima dele.
- Causa: objetoPrendeOCliqueDePor só devolve true quando o que está embaixo é um OBJETO (alvo.kind === "prop"). Token, pino, porta etc. não seguram o clique. A ferramenta Token já faz o certo (linha 7084: clique num token segue o fluxo normal).
- Conserto: tratar token (e pino) embaixo do clique como "o mestre quer este": selecionar em vez de pôr. Ctrl+clique continua pondo por cima, como hoje.

### 4. F (Enquadrar tudo) ignora os painéis e ignora quase todo o conteúdo do mapa (M)
- Onde: client/src/pixi/PixiCanvas.tsx:1836-1850 (fitToContent) e client/src/pixi/world.ts:222-256 (contentBounds).
- Sintoma: F deixa o mapa atrás dos painéis; com só chão e um token, o zoom vai a 163% e corta o mapa.
- Causa A (painéis): com conteúdo, o enquadramento usa a tela inteira (linha 1840). Só o mapa VAZIO usa freeArea com os obstáculos dos painéis (linhas 1847-1849).
- Causa B (o que conta): contentBounds só soma paredes, regiões, tokens, objetos, escadas, luzes e desenhos. Fica de fora: peças de chão (map.floor), texturas, água, carimbos, pinos, linhas e marcadores, abismo, barranco, penhasco. Um mapa feito só de Chão + 1 token enquadra só o token.
- Conserto: usar freeArea nos dois ramos (o código do ramo vazio já serve) e somar ao contentBounds as caixas de floor, carimbos, pinos, aguas, texturas e lines. Opcional: limitar ao retângulo do mapa.

### 5. Nome do mapa novo nasce preenchido com "Mapa sem título" (P)
- Onde: client/src/screens/NewDungeonMap.tsx:23 e :105-110.
- Sintoma: quem digita o nome fica com "Mapa sem tituloCripta de teste".
- Causa: o texto padrão é o VALOR do campo (useState com "Mapa sem título"), sem autoFocus e sem selecionar o texto. O padrão já existe de novo na linha 75 (name.trim() ou "Mapa sem título").
- Conserto: estado inicial vazio e placeholder "Mapa sem título". O fallback da linha 75 já cobre o campo vazio.

### 6. "Procurar no disco..." falha calado (P/M)
- Onde: client/src/screens/LoadMapScreen.tsx:276-279 (handleBrowse).
- Sintoma: no navegador o botão não faz nada visível; no app, uma falha do seletor some igual.
- Causa: await pickMapJsonToOpen() sem try/catch. O open() do plugin de diálogo lança fora do Tauri ("Cannot read properties of undefined (reading invoke)"), e a rejeição vira unhandled rejection.
- Conserto: try/catch com reportMapFileError("abrir o seletor de arquivo", err), como as outras ações desta tela.

### 7. Arrastar um móvel da lista para o mapa não existe (M, falta de recurso que parece bug)
- Onde: client/src/components/livro/EscolhaDoObjeto.tsx (as opções são role="radio", sem draggable nem onDragStart).
- Sintoma: arrastar da lista não mostra fantasma, não cria nada e nem deixa o móvel escolhido (o clique não acontece porque o botão foi solto fora dele).
- Causa: não há arrasto na lista de objetos. O Acervo de tokens tem (App.tsx:4924, onDropOnMap), então são duas regras diferentes para "pôr uma coisa da lista no mapa".
- Conserto: ou implementar o arrasto (reaproveitando o caminho do onDropOnMap do acervo + porMovelNoPonto), ou ao menos escolher o móvel no pointerdown para o mestre só precisar clicar no mapa depois.

### 8. App do mestre sem rede de segurança para erro de tela (M)
- Onde: client/src/main.tsx (o App é montado sem ErrorBoundary; só o jogador tem, em client/src/player/ErrorBoundary.tsx).
- Sintoma possível: qualquer erro durante o desenho do React apaga a tela inteira (tela branca) e o trabalho não salvo some.
- Causa: falta um ErrorBoundary no App do mestre.
- Conserto: um ErrorBoundary em volta do editor com "Salvar uma cópia de emergência" e "Voltar". Ver também o incerto 2 (a tela branca do passeio).

### 9. Miniaturas das cenas nunca são soltas da memória (P)
- Onde: client/src/stores/miniaturasDasCenas.ts:49 (const feitas) e :153-158 (por).
- Sintoma: nenhum visível no começo; numa sessão longa trocando de aventura, a memória cresce.
- Causa: o Map "feitas" guarda, por cena, a URL da imagem (URL.createObjectURL) e o MapData inteiro da última conferência. Não existe feitas.delete nem feitas.clear em lugar nenhum: cena apagada e aventura fechada continuam presas (o objeto mapa e o blob).
- Conserto: limpar (com URL.revokeObjectURL) as cenas que saíram da aventura, e tudo ao trocar de aventura ou voltar ao início.

---

## Bugs incertos (precisa reproduzir)

### 1. Chão Retângulo só aparece na ação seguinte (M)
- Onde: client/src/pixi/PixiCanvas.tsx:8418-8425 (soltar o retângulo), :2768-2787 (paintFloor), client/src/pixi/terrenoDoChao.ts:73-104, client/src/pixi/drawTexturas.ts:608-638.
- O que se sabe: a peça nasce com o material da ferramenta (comTerreno). Peça com material NÃO é desenhada na camada lisa (pecasLisas); vai para o "terreno", que espera 150 ms, manda a conta do contorno para um worker, espera o ladrilho carregar e só então monta na vitrine. Tudo isso é assíncrono, fora do gesto.
- Suspeita: o desenho sob pedido (desenhoSobPedido.ts) tem um pulso de 500 ms que deveria pegar o resultado. Se a vitrine compõe pelo app.ticker sem marcar pedido, ou se o worker responde depois de uma geração nova, o resultado fica esperando o próximo redesenho. Não consegui fechar a cadeia lendo; precisa de um teste com o worker real.
- Como confirmar: desenhar um retângulo com material, esperar 2 s sem mexer, ler el.dataset.terrenoMs (o aoGerar grava) e ver se a camada terrenoDoChao tem filhos.

### 2. Tela branca e volta ao início ao criar cena (G se for do app, nada se for do Vite)
- O passeio aconteceu com outro agente editando arquivos na main ao mesmo tempo. Branco seguido de tela inicial é a cara de recarga completa do Vite (HMR), não de erro do app (erro do React deixaria branco, sem voltar ao início).
- O que é certo e vale consertar mesmo assim: no navegador não há aviso ao recarregar com trabalho não salvo (o único beforeunload é do site do Lobby, client/src/lobby-site/telas/Site.tsx:85) e não há rascunho automático. No app instalado o aviso ao fechar existe (App.tsx:2252).

### 3. Balde do Chão não muda nada dentro de uma sala (M)
- Onde: client/src/pixi/PixiCanvas.tsx:6024-6027 e :7286-7289; client/src/stores/mapStore.ts:3253-3259; client/src/lib/camadasDoPincel.ts:193-212.
- O que se sabe: o Balde enche a área fechada na CAMADA DE TINTA ativa, com a cor da camada (corDaCamada). Não usa material (por isso o bloco Material some: TerrenoControls.tsx:103 esconde de propósito para blocos e balde). Se a cor da camada for a mesma do chão do mapa, ou se o preenchimento da sala for pintado por cima do chão (o chão mora na faixa "salas", junto das regiões), o resultado é invisível. O aviso "Nada para encher aqui" só sai quando a área é vazia, não quando a pintura ficou escondida.
- Como confirmar: encher dentro de uma sala com cor de camada bem diferente e ver se aparece.

### 4. Ctrl+Z não desfaz logo depois de pôr um objeto (P)
- Onde: client/src/App.tsx:2080 (o Ctrl+Z do mapa não roda com o foco num campo de texto, de propósito: keymap.ts:366-371).
- O passeio diz que o foco ficou na busca "Procurar objeto" mesmo depois de clicar no mapa. O Pixi não chama preventDefault no pointerdown de mouse comum, então o clique no canvas deveria tirar o foco do campo. Não achei quem segura o foco; precisa reproduzir. Se confirmar: tirar o foco do campo (blur) no pointerdown do canvas.

### 5. Esc dentro de um campo do painel também cancela coisas no mapa (P)
- Onde: client/src/lib/keymap.ts:388 (o Esc passa por cima da trava de campo editável) e PixiCanvas.tsx:10134-10149.
- Campo que não consome o Esc (sem stopPropagation) deixa o Esc chegar ao mapa: solta a escolha do painel (soltarPainelNoEsc) no mesmo toque que deveria só desfazer a digitação. Os campos que eu li consomem; não varri todos.

### 6. "Voltar ao início" clicado duas vezes salva duas vezes ao mesmo tempo (P)
- Onde: client/src/App.tsx:3317. Não há trava de "já salvando". Dois persistMap em paralelo gravam o mesmo arquivo; writeTextFileSafely usa .tmp + rename, então o pior caso deve ser só trabalho dobrado, mas não verifiquei a aventura (flush).

### 7. Quadradinho no lugar do contador das abas (P, fora do editor)
- Onde: client/src/components/livro/PaginaJogos.tsx:204 e paginaJogos.css:19 (a fonte "utility" é Bahnschrift, DIN, Segoe; theme.ts:93).
- O código mostra um número. Quadrado vazio é a fonte sem o caractere; provável que o navegador do passeio não tenha nenhuma das fontes da lista. Não dá para afirmar só lendo.

### 8. Mover mapa de pasta pode deixar a linha presa em "ocupada" (P)
- Onde: client/src/screens/LoadMapScreen.tsx:341-351 (moverPara). setBusyId(null) não está num finally; se trabalhoDoMapaAberto lançar, a linha fica travada. mapaMudouDePasta não lança (tem try por dentro); o outro não verifiquei a fundo.

---

## Coisas erradas (duplicação, código morto, duas regras)

Não repeti o que já está em docs/levantamento-mecanicas-duplicadas.md (itens 6, 19 e 25 já falam do que conta como chão).

1. Três baldes diferentes (M). Balde do Chão (PixiCanvas.tsx:7286, enche camada de tinta), Balde do Pincel (PixiCanvas.tsx:7198, baldeDeTintaNoPonto, vira desenho cheio) e Balde das Texturas (TexturasControls.tsx:30). Mesmo nome e mesmo ícone, três resultados e três regras de "área fechada". O mestre não tem como saber qual usar.
2. A ferramenta Chão tem duas regras dentro dela (M). Retângulo, Elipse, Polígono e Caminho levam MATERIAL (comTerreno); Blocos e Balde pintam CAMADA DE TINTA e escondem o material (TerrenoControls.tsx:103). É a causa da surpresa "o Material sumiu".
3. Ferramenta Caminho antiga ainda no código (P). Saiu da barra em 12/11 (labels.ts:268-270) e não tem letra (keymap.ts:227), e não achei nenhum setActiveTool com "path". Mesmo assim o PixiCanvas ainda carrega o gesto dela (pathDraftPoints e finishPath, 18 referências) e o Enter fecha o traço dela (PixiCanvas.tsx:10091). Provável código morto; apagar exige conferir se algum teste ou mapa antigo ainda liga a ferramenta.
4. Quatro jeitos de pôr um objeto (P). Objeto (mobilia), Imagem (prop), Construção e Carimbos, cada um com seu clique. O Objeto e a Construção dividem o ramo (PixiCanvas.tsx:7139), a Imagem tem outro (:7157) com regra de seletor de arquivo, e o Carimbos outro módulo (carimboNoEditor.ts).
5. Duas regras de "o clique cai em quem" (M). Ferramenta Token respeita o token embaixo (PixiCanvas.tsx:7084); Objeto só respeita objeto (:2204). Ver bug certo 3.
6. Duas regras de enquadrar (M). Mapa vazio enquadra na área livre dos painéis; mapa com conteúdo enquadra na tela inteira (PixiCanvas.tsx:1836-1850). O "Ir até lá" usa obstáculos (:1879-1881). Ver bug certo 4.
7. Duas listas de "o que é conteúdo do mapa" (P). contentBounds (world.ts:222) para enquadrar e hitTestMap/selectEntitiesInArea para Ctrl+A. Uma esquece o chão, a outra não. Uma função só para "caixa de cada coisa do mapa" serviria às duas.
8. Duas portas de "pôr da lista no mapa" (P). Acervo de tokens tem arrasto para o mapa (App.tsx:4924); lista de objetos só clique (bug certo 7).
9. O nome padrão do mapa novo está escrito duas vezes (P). NewDungeonMap.tsx:23 e :75.
10. "Voltar ao início" não usa a pergunta de trabalho não salvo que já existe (M). O UnsavedChangesDialog (App.tsx:528) atende "Abrir outro mapa"; o "Voltar ao início" tem caminho próprio que salva calado (bug certo 1).
