# A vila, antes e depois (protótipo)

Pedido de 21/10/2026: "Me desenha um protótipo de como seria a melhor versão dessa vila, fique à vontade." O ponto de partida é o print do mapa de hoje (1198 x 761, 7 casas, praça de paralelepípedo, quadrado verde-limão no centro). Nada no `client/` foi mexido; isto é para aprovar antes.

- Protótipo: `prototipo/index.html` (página avulsa, autocontida, para publicar como Artifact). É montado por `node docs/design/vila/prototipo/montar.cjs`, que cola no `fonte.html`:
  - o telhado do app (`client/src/texturas/telhado.ts` e `client/src/lib/telhado/*`), empacotado pelo esbuild da raiz (`entrada.js`);
  - o pintor de objetos aprovado em 20/10 (`docs/design/objetos/prototipo/objetos.js`), lido de lá sem cópia; o montador só abre as formas e os materiais em `Objetos._i`;
  - `vila.js` (o desenho da vila, a colisão, o caminho e o robô) e `pagina.js` (câmera, pino, controles).
- Provas: `node docs/design/vila/provas/gerar-provas.cjs` (da raiz do repo). Monta o protótipo, roda as provas no Chromium do Playwright e grava `testes.json` e os 5 prints.

## O que foi decidido e por quê

Mesma ocupação e mesmas cores de telhado do print, para comparar. O botão **Antes / Depois** troca entre uma recriação do mapa de hoje e a versão nova, com a mesma câmera. Os telhados são os aprovados (telha colonial e madeira), desenhados pelo código do app.

1. **Portas.**
   - Cada porta tem batente escuro, folha de tábua com dobradiças e maçaneta, e um degrau de pedra. Ocupa 36 x 24 px no zoom 100% (hoje são 5 x 5) e é desenhada por cima do telhado, como no app.
   - A folha é de madeira clara nos telhados escuros e de nogueira no telhado claro do estábulo, para destacar sem estourar.
   - As três casas de baixo (empório, templo e estábulo) tinham a porta virada para fora da praça. Agora ela fica no lado norte.
   - O vão na parede tem 34 px para um pino de 24 px. Com 30 px, o robô não achou caminho em 3 das 7 portas (ver "Provas"); isso vale para o app também.
2. **Cada casa tem uma função**, com uma placa clara presa ao lado da porta e um ícone chapado: Taverna (caneca), Casa da Guilda (brasão), Ferraria (bigorna), Boticário (frasco), Empório (balança), Templo (sino), Estábulo (ferradura). O botão **Nomes** escreve o nome em cima do telhado. Os ícones foram desenhados aqui, sem copiar nenhum jogo.
3. **Centro.** O quadrado verde-limão virou um poço: borda de 12 pedras de granito com chanfro, água escura com sombra da borda e um brilho fraco, travessa de madeira com corda e um balde. Em volta, um anel de laje clara. Sem brilho que vaza.
4. **Praça com cena**: 31 peças. Hierarquia: poço, depois feira, depois o resto.
   - Feira: 3 barracas de toldo (lã vinho, ocre e musgo), com bancada de frutas, caixas, barris e o baú. O retângulo marrom solto do print virou esse baú.
   - Canto da fogueira, no gramado entre a ferraria e o estábulo: fogueira e dois troncos de banco.
   - Também: carroça carregada, 2 bancos no anel do poço, 3 lampiões, quadro de avisos, 4 vasos nas portas e 8 árvores nas bordas.
   - Nenhuma peça fica na frente de porta nem em cima de caminho; isso é prova automática.
5. **Caminhos e borda.**
   - Um caminho de laje clara sai de cada porta (2 quadrados) e chega na praça.
   - A vila acaba num muro baixo e fino de pedra (8 px), com pilares nas aberturas, sebes de tufos e uma linha de árvores.
   - Fora do muro, mato e terra chapados, mais escuros; nada de vazio preto.
   - Duas saídas, cada uma com placa de direção e o rótulo "outro mapa": a Estrada do Sul, que sai pelo portão e vira para o canto de baixo, e a Trilha do Bosque, ao norte. No fim de cada uma, a página avisa que ali o mestre liga o outro mapa.
   - Nada de linha diagonal solta, entalhe preto, hachura ou parede grossa.
6. **Volume.** Cada telhado faz uma sombra macia no chão, para baixo à direita (a luz de cima à esquerda de sempre). No lado da sombra (sul e leste) aparece uma fresta de parede de 3 px além do beiral. A sombra some junto com o telhado.
7. **Grade** de 28 px, ligada ao abrir e discreta; o pino ocupa um quadrado.
8. **Pino.**
   - Anda com setas ou WASD. No clique ou no toque, vai até o ponto tocado pelo caminho mais curto. Os botões da lista "As casas" levam o pino até dentro de cada casa.
   - O pino colide com casa, peça, sebe e muro, e só passa pelas portas e pelas aberturas do muro.
   - **O opcional entrou**: ao cruzar a porta, o telhado some em 300 ms (o comportamento do protótipo do telhado) e aparece a casa por dentro, com assoalho, paredes finas e os móveis do pintor de objetos. Cada função tem os seus: mesas e barris na taverna, forja e bancada na ferraria, baias no estábulo e assim por diante.
9. **Movimento.** Só o telhado se mexe, quando o pino entra ou sai, e a câmera acompanha o pino. Com movimento reduzido, o telhado só desbota (não sobe) e a câmera vai direto, sem deslizar. Nada se mexe sozinho.
10. **Textura pelo código, sem sorteio.** Paralelepípedo, laje, pedra do muro, grama, mato, terra, assoalho e palha são ladrilhos pintados por pixel. Tudo sai de `hash` (o mesmo de objetos.js), então a mesma entrada dá a mesma imagem (é prova). As variações são de poucos por cento, e nenhum veio é reto.

## Provas (21/10/2026)

As metas foram escritas antes de codar. Resultado: **29 de 29** em `provas/testes.json`. O navegador foi o Chromium headless desta máquina, e os tempos variam alguns ms entre rodadas.

- **(a) Robô que anda como gente**: 35 de 35, nas 5 sementes fixas e nas 7 casas.
  - O robô vê a própria posição com 250 ms de atraso, decide a cada 80-160 ms e erra a direção (desvio de 16°). Aperta só as 8 direções do teclado, às vezes hesita, e refaz o caminho quando empaca.
  - Ele sai do pino e precisa entrar pela porta, até 26 px para dentro.
  - Tempo mediano de 3,6 s, pior de 6,4 s. Empacou e refez o caminho 1 vez.
  - O A* acha caminho até dentro das 7 casas.
  - Na primeira versão, com o vão de 30 px, 3 portas ficaram sem caminho (taverna, ferraria, estábulo). O vão subiu para 34 px.
- **(b) Portas**: as 7 com 36 x 24 px no zoom 100% (meta: 18 x 24).
  - Nenhuma peça cobre a porta nem fica até 30 px na frente dela.
  - Os 9 caminhos (7 de porta e 2 estradas) estão livres na largura inteira.
  - A folha de cada porta aparece por cima do telhado, conferida pela cor do pixel: diferença 0 nas 7.
  - No celular, o mapa abre em 75%, e a porta fica com 27 x 18 px na tela.
- **(c) Travada**, com teclas, roda do mouse e arrasto de verdade:
  - intervalo entre quadros p95 de 16,8 ms (meta: 20), com o maior de 33 ms;
  - desenhar o mapa leva p95 de 15 ms;
  - a maior tarefa longa da sessão inteira (abrir, gerar 2x, andar, zoom) foi de 57 ms (meta: menos de 200).
- **(d) Primeira pintura**, desde que o HTML chegou: 196 ms no computador e 187 ms no celular 390 px 2x (meta: 400). Ela sai em 1x, em etapas curtas, e o 2x é gerado depois, uma imagem por vez.
- **(e)** Nenhum erro no console, nas 4 páginas.
- **(f)** 390 px sem rolagem para o lado.
- **Controles de verdade**, todos por clique, tecla ou toque real:
  - Antes troca o desenho, e Depois volta ao mesmo (conferido pela digital do canvas). A seta troca Antes/Depois quando o foco está nos botões.
  - Grade e Nomes ligam e desligam. No Antes, Nomes e as casas ficam desabilitados, com o motivo escrito embaixo do mapa.
  - Os botões de zoom mudam o zoom, e 100% volta para 100%.
  - Setas e WASD andam com o pino.
  - A parede segura o pino, e a porta deixa passar.
  - O telhado some 283 ms depois que o pino cruza a parede (meta: até 320) e volta quando ele sai.
  - O clique no chão e o toque no celular levam o pino até o ponto, e o botão da casa leva até dentro dela.
- **Mesma imagem**: duas aberturas com a mesma câmera dão a mesma digital.

Prints (5):

- `provas/desktop-1440.png`: a página inteira.
- `provas/antes-depois.png`: o mapa de hoje e o novo, lado a lado, com a mesma câmera.
- `provas/celular-390.png`
- `provas/detalhe-poco.png` e `provas/detalhe-porta.png`: zoom de 260%, no poço e na porta da taverna.

## O que não foi conferido e o que ficou de fora

- **Medir não é ver.** As cores e o equilíbrio foram julgados só na minha tela e em 5 prints. Não houve celular de verdade nem outra máquina mais fraca.
- **Movimento reduzido**: está no código, mas nenhuma prova automática confere.
- **O aviso no fim das estradas** ("aqui o mestre liga o outro mapa"): está no código, mas nenhuma prova confere.
- **Tema escuro**: troca só a página em volta. O mapa é o mesmo nos dois temas, e não tirei print do escuro.
- **Antes é uma recriação.** O chão, o quadrado verde, o retângulo e as portas de 5 px foram redesenhados pelo código. Os telhados são os de hoje, nas mesmas cores, mas desenhados pelo código novo.
- **O app de verdade**: névoa, vários pinos, a visão do mestre e a edição das peças ficaram de fora, e nada foi ligado no `client/`.
- **Lampião**: lê pouco no zoom 100% (é uma peça de 12 px, com um brilho fraco no chão).
- **O que fica fora da conta de 31 peças**: as 63 árvores de fora do muro, as 2 placas de direção, as 5 sebes e os 53 móveis de dentro das casas.
- **O paralelepípedo** é de pedra irregular (células de Voronoi), não de fileiras retas. Fileira reta e fina vira hachura no zoom baixo.

## Perguntas para aprovar

1. **Poço**: este (borda de pedra em blocos, travessa e balde) ou prefere outro, como um poço com telhadinho de madeira ou um chafariz?
2. **Os ícones leem** no seu zoom (caneca, brasão, bigorna, frasco, balança, sino, ferradura)? Algum troca? E a função de cada casa está certa?
3. **A borda ficou clara?** Muro baixo, sebes e linha de árvores, com duas saídas e placa "outro mapa". Quer um portão de madeira no sul, ou só a abertura?
4. **Quantas peças?** 31 na praça é o ponto, ou quer menos (mais chão livre para os pinos) ou mais? O lampião merece crescer ou virar tocha?
5. **O que vai para o app primeiro?** Proposta, nesta ordem:
   1. portas: tamanho, vão de 34 px e as 3 de baixo viradas para a praça;
   2. placas com ícone e o botão Nomes;
   3. poço e as peças novas (barraca, carroça, banco, lampião, quadro, vaso, árvore, sebe), no painel de objetos;
   4. muro e borda;
   5. sombra do beiral e fresta de parede.
6. **Dentro das casas**: os móveis que aparecem ao entrar servem de ponto de partida para cada função, ou o mestre monta cada casa do zero?
