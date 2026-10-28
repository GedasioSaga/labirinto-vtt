# Objeto Fogo (protótipo)

Pedido do mestre, 27/10/2026, literal:

> "Eu também quero um objeto que seja uma chama com animação de fogueira, para representar que alguma coisa está pegando fogo."

Nada no `client/` foi mexido. O app só muda depois do sim do mestre.

- Protótipo: `prototipo.html`, uma página só, sem montagem. Abra direto no navegador.
- Base: a chama da fogueira aprovada em 14/10 (`docs/design/mobilia-cozinha-fogueira/ESPEC.md`, `client/src/pixi/chamasDasFogueiras.ts`) e o fogo da transição "Trilha do pinheiral: em chamas" (`client/src/animacoes/transicao/_fogoDoPinheiral.ts`), adaptado à vista de cima.

## O que o protótipo mostra

Um pedaço de mapa visto de cima, no estilo Meio-Termo: uma casa aberta com assoalho de madeira e móveis, uma casa com telhado, grama com tufos e flores, um caminho de terra, a praça de pedra com uma barraca, árvores e a ficha do jogador na porta. O fogo do controle Tamanho fica dentro da casa, sobre a cama e o assoalho.

Controles:

- **Tamanho:** Chama (1 casa), Fogueira (2 casas), Incêndio (4 por 3 casas).
- **Zoom:** Perto (200%), Normal (100%, 48 px por casa), Longe (50%).
- **Desenho da chama:**
  - Labareda nova: pintada pelo código, 16 quadros.
  - Igual à fogueira de hoje: a mesma curva e as mesmas cores do móvel Fogueira, várias línguas.
- **Espalhar 20 fogos:** mais 20 fogos pelo mapa (13 Chamas, 5 Fogueiras e 2 Incêndios), no telhado, na barraca, na praça, no caminho e na grama.
- **Ver como o jogador:** névoa com a visão da ficha. Fogo fora da visão não é desenhado.
- **Menos movimento**, na barra de cima. Segue o sistema até a pessoa mexer no botão.

Embaixo do mapa, uma linha diz quantos fogos existem, quantos estão na tela (só esses animam), quantos o jogador vê e quanto tempo levou para desenhar os fogos no quadro (p95 dos últimos 120 quadros, medido no canvas 2D do protótipo).

## O desenho

**Vista de cima, chama em pé.** É a mesma regra da fogueira aprovada: o chão e o que queima são vistos de cima, e as línguas de fogo ficam em pé na tela, com fagulhas e fumaça subindo para cima da tela. Girar o objeto não deita o fogo.

| Parte | Como é | Parada ou mexe |
|---|---|---|
| Chão queimado | Fuligem de borda irregular (`#2a201b` a `#4d3b2f`), pontos de cinza clara, brasas no pé de cada língua (as cores `BRASA_VIVA` e `BRASA_QUENTE` da fogueira) e, nos tamanhos maiores, toras ou vigas carbonizadas | parada |
| Brilho no chão | Disco de luz no tom do miolo (`#f0c98a`) que passa para o laranja do fogo (`#e39446`). Pisca na transparência (0,84 a 1 da base) e na escala (3%) | mexe |
| Labaredas | Contorno `#7c3622`, borda `#a04a2c`, laranja `#c4683a`, fogo `#e39446`, miolo `#f0c98a`, ponta `#f6dca8`. Cada língua tem o seu passo, e a escala pulsa como na chama aprovada (ciclo de 2,4 s, só harmônicos inteiros) | mexe |
| Fagulhas | O círculo e a vida da fogueira aprovada (0,9 s; sobe desacelerando; acende rápido e apaga devagar), saindo das línguas mais altas | mexe |
| Fumaça | Nuvens cinza-quente (`#5d5650` a `#78706a`) com borda corroída. Nascem na ponta da língua, sobem, crescem, vão com o vento e somem | mexe |

Mistura de cor sempre normal: nada de brilho somado (aditivo), que vira neon sobre a praça clara e quebra o lote do Pixi.

**A labareda nova** usa a receita do fogo do pinheiral:

- a forma afina para cima e é corroída por um ruído que sobe;
- a volta de 16 quadros fecha sem salto, porque o quadro *t* mistura dois campos de ruído deslocados de uma volta inteira;
- há 2 desenhos (um mais estreito, outro mais largo e repartido), cada um com 16 quadros;
- a 16 quadros por segundo, a volta dura 1 s;
- por cima da troca de quadro, a escala contínua da chama aprovada deixa o movimento liso.

### Tamanhos

| Tamanho | Pegada | Línguas | Fagulhas | Fumaça | Brilho (raio) |
|---|---|---|---|---|---|
| Chama | 1 casa | 3 | 3 | 1 fio, 3 nuvens | 1 casa |
| Fogueira | 2 casas | 5 | 5 | 1 fio, 4 nuvens | 1,75 por 1,55 casa |
| Incêndio | 4 por 3 casas | 11 | 9 | 2 fios, 4 nuvens cada | 3 por 2,5 casas |

No app, a proposta é a pegada sair do tamanho do objeto, como nos outros móveis. As línguas seriam distribuídas pela área, com a semente no id, e os três tamanhos seriam só os tamanhos de partida no painel. Esticar o Incêndio para 4 por 4 casas daria mais línguas, não línguas maiores.

### Menos movimento

- A chama para numa pose, com cada língua num quadro diferente.
- As fagulhas somem.
- A fumaça fica parada em 1 a 2 nuvens por fio.
- Só o brilho muda, respirando de leve (ciclo de 4 s, entre 0,93 e 1 da transparência). O protótipo desenha a 10 quadros por segundo nesse modo.

Se o mestre preferir tudo parado, o relógio desliga de vez, como faz a fogueira.

### Zoom Longe

- Abaixo de 30 px por casa as fagulhas somem, porque ficariam do tamanho de um pixel.
- A fumaça usa metade das nuvens.
- O resto fica igual.

## Como implementar no Pixi

### Dado

- Um tipo novo de móvel, `fogo`, em `PARTES_DO_MENU_DE_OBJETO` (`client/src/lib/toolVariants.ts`), na parte "Rua e jardim", logo depois de `fogueira`.
- O tamanho de partida (1x1, 2x2, 4x3) é uma escolha no painel. Não há material: "Cor" e "Cor da linha" não mudam o fogo, como na chama da fogueira.
- Nome e lugar dependem das perguntas 2 e 3, lá embaixo.

### Parte parada

- O chão queimado, as brasas e as toras são uma imagem do móvel, pintada uma vez, no mesmo caminho dos móveis do Meio-Termo (um `montarFogo` em `client/src/texturas/meioTermo/moveis/`, como `fogueira.ts`).
- Ela nunca é repintada por causa da animação.

### Parte que mexe

Um módulo novo, `client/src/pixi/fogosDoMapa.ts`, copiado do jeito de `chamasDasFogueiras.ts`:

- **Uma folha só de textura**, gerada pelo código uma vez por sessão: os 2 desenhos de 16 quadros (128 por 192 px cada), mais o brilho, a fagulha e as 2 nuvens de fumaça.
  - São 2048 por 384 px para as labaredas, cerca de 3 MB na placa de vídeo.
  - No protótipo, cada quadro leva poucos ms para pintar. A pintura é feita em fatias de 12 ms, então não trava a tela. No app, isso pode ir para um Worker com `OffscreenCanvas`, ou ser gerado no build como PNG. As duas formas seguem a regra 6 do estilo (textura por código, determinística).
  - Cada quadro vira uma `Texture` com `frame` sobre a mesma fonte.
- **Árvore por fogo:** um `Container` sem giro, com sprites das línguas, o sprite do brilho, as fagulhas e as nuvens.
  - Três subcamadas na camada dos fogos (brilhos, chamas, fumaça): a fumaça de um fogo não fica embaixo da chama do vizinho.
  - A camada dos fogos é um `isRenderGroup` próprio: quando um fogo entra ou sai da tela, só ela refaz as instruções, não o mapa inteiro.
- **Por quadro, só números.**
  - Língua: trocar a textura quando o quadro muda (16 vezes por segundo) e `scale.set` da pose.
  - Brilho: `alpha` e `scale`.
  - Fagulha e nuvem: `position`, `alpha` e, na nuvem, `scale`.
  - Nada de `clear()`, nada de `visible` por quadro. Fagulha apagada fica com alpha 0, como na fogueira.
  - A pose e a fase são as da fogueira: `escreverPose` e `faseDaFogueira`, exportadas e reaproveitadas.
- **Só anima o que está na tela.**
  - A cada passada de desenho do mapa (andar, dar zoom), os fogos cujo retângulo (com fumaça e brilho) fica fora da câmera saem da lista do relógio e ficam `renderable = false`.
  - Isso só muda quando a câmera anda, nunca por quadro.
  - O relógio (`app.ticker`) só fica inscrito com pelo menos um fogo na tela e movimento normal.
- **Sem shader, sem filtro de tela cheia, sem mistura aditiva.** Todos os sprites saem da mesma fonte de textura e da mesma mistura de cor. O Pixi junta os fogos em poucas chamadas de desenho, em geral uma.

### Custo estimado por fogo

Estimativa pelo desenho do protótipo. Não foi medido no app.

| Tamanho | Sprites que mexem | Números trocados por quadro |
|---|---|---|
| Chama | 10 | cerca de 30 |
| Fogueira | 15 | cerca de 45 |
| Incêndio | 29 | cerca de 90 |

**20 fogos na tela** (a mistura do botão):

- cerca de 300 sprites e 900 números por quadro;
- uma fonte de textura só;
- a área que a placa de vídeo mais pinta é o brilho do Incêndio (6 por 5 casas).

No protótipo (canvas 2D, Chromium headless desta máquina), desenhar 19 fogos na tela levou p95 de 0,5 a 0,6 ms por quadro. A maior tarefa longa da sessão inteira, contando a pintura do fundo, foi de 116 ms. O Pixi deve sair mais barato que o canvas 2D, porque só troca números e desenha num lote, mas isso precisa ser medido no app.

**Mapa 200 por 200:** fogo fora da câmera custa zero por quadro, porque não está no relógio. O custo cresce com os fogos na tela, não com o tamanho do mapa.

### Alternativas que ficaram de fora

| Alternativa | Por que não |
|---|---|
| Shader por fogo (o ruído do pinheiral na placa de vídeo) | Mais liso, mas cada malha com uniforms próprios quebra o lote (uma chamada por fogo). Precisaria de uma versão WGSL se o renderer for WebGPU. O custo por pixel cresce no zoom Perto. Dá para fazer depois, se a folha de quadros não agradar. |
| Filtro (calor ondulando, deslocamento) | Custa a tela inteira, e o pedido proíbe. |
| Mistura aditiva | Vira neon sobre a praça clara e quebra o lote junto com os sprites normais. |
| Vetor, igual à fogueira de hoje | É o mais barato de todos (sem textura nova) e já está no app. É menos vivo. Está no protótipo como opção ("Igual à fogueira de hoje"). |

## Para o jogador

Aparece igual ao que o mestre vê, respeitando a névoa:

- A tela do jogador cria os fogos a partir dos objetos que a visão já recortou, como `sincronizarChamas` faz com as fogueiras. Fogo na névoa nunca é criado: não desenha, não brilha e não custa nada.
- A fumaça de um fogo visível que passa da borda da visão fica coberta pela névoa, como no protótipo.
- O passo de cada fogo sai do id. As duas telas pulsam igual sem sincronizar nada pela rede.
- "Oculto para jogadores" funciona como em qualquer móvel: no editor o fogo aparece apagado (fantasma); no jogador, não aparece.
- Exportar imagem: o fogo sai na pose parada, como a chama da fogueira sem relógio.

No protótipo a visão é um círculo. No app ela é recortada pelas paredes.

## Sobreposição com o móvel Fogueira

O móvel Fogueira, na mesma parte "Rua e jardim", já tem chama animada (roda de pedras, lenha em X e uma língua de fogo). O objeto Fogo não o substitui: é fogo solto, para pôr em cima de qualquer coisa. Mas os dois se cruzam, e o tamanho do meio pedido também se chama Fogueira. A decisão é do mestre (pergunta 2).

## Perguntas para o mestre

1. **Desenho da chama:** a labareda nova (pintada, mais viva) ou igual à fogueira de hoje (a mesma chama do móvel Fogueira, só que várias)?
2. **Nome e lugar no menu:** a proposta é "Fogo", na parte "Rua e jardim", logo depois da Fogueira, com os três tamanhos no painel. O tamanho do meio também se chama Fogueira, igual ao móvel. Troco o nome dele (por exemplo "Fogaréu") ou prefere outro arranjo, como o fogo virar um jeito do próprio móvel Fogueira, sem a roda de pedras?
3. **Telhado:** o fogo fica embaixo do telhado, como os móveis, ou por cima, para a casa queimar vista de fora? O protótipo desenha por cima.
4. **Noite:** o fogo também acende uma luz no mapa de luz (`pixi/mapaDeLuz.ts`), como um lampião, ou basta o brilho do desenho?
5. **Chão queimado:** faz parte do fogo (some quando ele sai) ou vira uma opção?
6. **Menos movimento:** o brilho respira devagar, como está, ou fica totalmente parado (relógio desligado)?
7. **Som:** um crepitar baixo perto do fogo? Não está no protótipo. Fica para depois, se quiser.

## Conferido e não conferido

Conferido em 27/10/2026, no Chromium headless do Playwright desta máquina, a 1280 px:

- a página abre sem erro nem aviso no console;
- todos os controles foram clicados (tamanhos, zooms, desenhos, 20 fogos, jogador, menos movimento), e a página continuou sem erro;
- sem rolagem para o lado;
- nenhuma tarefa longa passou de 200 ms (a maior foi de 116 ms).

Dois prints só para o designer, que não entram no repositório:

- Normal com os 20 fogos: o chão queimado, as toras e a fuligem leem bem.
- Perto no Incêndio: as labaredas saíam finas e pontudas, como uma fileira de cones.

Depois desses prints, a labareda ficou 30% mais larga e com o pé menos estreito, e o brilho e a fumaça ficaram mais fortes. **Essa versão final não foi vista por ninguém.** A conferência de console rodou de novo nela, sem print, e passou.

Não conferido:

- o desenho "Igual à fogueira de hoje", Perto e Longe em tela 2x, a tela do jogador e o menos movimento, a olho;
- o custo no Pixi (só estimado);
- a placa de vídeo e o WebView2 de verdade;
- o app em si (nada foi integrado);
- celular (fora do foco por decisão do usuário, 24/10).
