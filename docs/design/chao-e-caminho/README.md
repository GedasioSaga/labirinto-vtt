# Chão e caminho: protótipo

Pedido do mestre de 12/11/2026: juntar o Chão e o Caminho numa coisa só, com textura bonita, como os caminhos de pedra da imagem de referência. Este protótipo mostra a proposta antes de qualquer mudança no app.

**Abrir:** dois cliques em `prototipo-chao-e-caminho.html`. Funciona sem internet. Leva uns 3 segundos preparando os materiais.

## O que dá para fazer

- **Arrastar no mapa** traça um caminho; com **Área** (tecla A), arrastar em volta e soltar fecha uma área.
- **Material:** Calçamento, Terra batida, Cascalho, Areia, Tábuas, Grama (pintar grama por cima apaga) e Liso (a cor de hoje).
- **Largura** de meia casa a quatro (teclas `[` e `]`) e **Borda** de reta a irregular.
- **Desenho** (teclas 1 a 4): Hoje, Proposta, Só o caminho, Trilha na textura. Segure **H** para ver o de hoje sem tirar a mão.
- **Mostrar o limite** (tecla L): a linha tracejada é por onde o jogador vê e anda com "Fora do Chão: Bloqueado".
- **Mapa:** Desfazer (Ctrl+Z), Voltar ao exemplo, Limpar tudo; roda do mouse aproxima; botão direito (ou Espaço) arrasta o mapa; Esc cancela o traço.
- **Fluidez do último traço:** o painel mostra o tempo entre quadros enquanto você arrasta.

O exemplo já traz uma estrada de pedra com bifurcação, uma trilha de terra cruzando, uma praça, uma passarela de tábuas até a areia e um caminho de cascalho.

## Para conferir

1. Tecla 1 (Hoje) e 2 (Proposta): no Hoje a praça e a areia somem embaixo da grama (só o contorno laranja), e os caminhos são faixas lisas em zigue-zague.
2. Na Proposta, aproxime a bifurcação: as pedras da beira saem inteiras no capim e os dois caminhos de pedra viram um.
3. Trace um caminho de Terra cruzando a estrada de pedra; depois um de Calçamento saindo de outro de Calçamento.
4. Tecla L: o limite segue a forma limpa, não as pedras soltas.

## De onde vêm as coisas

- Cores e medidas da interface: `client/src/theme.ts` (as mesmas dos protótipos da Luz e das Sombras).
- Cores dos materiais: `client/src/texturas/embutidas.ts` (Campo Verde, Terra, Areia, Lajotas claras) e `client/src/texturas/meioTermo/paleta.ts` (pedra, madeira); grão de papel de `texturas/meioTermo/chaoNoMundo.ts`.
- Largura do caminho de 0,5 a 4 casas: `client/src/lib/drawingFactory.ts`. Beira esfumada da Texturas (alternativa 4): `client/src/lib/planoDasTexturas.ts`.
- Proposta, alternativas e escolhas: `tmp/novos-2026-11-12/chao-e-caminho/PROPOSTA.md`. Como é hoje, o que está ruim e como levar para o app: `tmp/novos-2026-11-12/chao-e-caminho/ACHADOS.md`.

## Provas (`provas/`)

`geral.png` (Proposta), `hoje.png`, `caminho.png` (Só o caminho), `textura.png` (Trilha na textura), `perto.png` (bifurcação e cruzamento a 246%), `depois.png` (com um caminho de terra e uma área de cascalho traçados pelo mouse e o limite ligado); `relato.txt` com os tempos medidos.

Medido no Chromium headless deste PC (não num PC comum), traçando um caminho de 3 casas na Proposta, em três rodadas: mediana de 8,4 ms entre quadros, p95 16,7 ms, trabalho do protótipo de 13,9 a 15,2 ms no pior quadro, nenhuma tarefa de 50 ms ou mais enquanto se desenha. Ao abrir, a maior tarefa ficou entre 148 e 152 ms (abaixo de 200). O `relato.txt` guarda a última rodada.

## Limites do protótipo

Só PC, só a visão do mestre (sem névoa do jogador), Canvas 2D na CPU (o app usaria Pixi com a imagem pronta por pedaço). O mundo tem 36 x 24 casas de 40 px; a 246% a textura fica um pouco macia.
