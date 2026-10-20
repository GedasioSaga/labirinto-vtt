# Telhado da sala (protótipo)

Pedido de 18/10/2026 (literal em `PEDIDOS.md`): de fora, o pino vê o telhado; quando entra pela porta, o telhado some e a sala aparece; quando sai, o telhado volta.

- Protótipo: `prototipo/index.html` (página avulsa; publicada como Artifact para aprovar).
- Provas: `node docs/design/telhado/provas/gerar-provas.cjs` (da raiz do repo). Monta o pacote do telhado (`prototipo/montar.cjs`) e gera `testes.json`, `folha-contato.png`, `grafico-movimento.png`, `folha-modelos.png`, `folha-zoom.png` e 3 prints de layout.

## Como funciona

- Visão de cima, igual ao mapa (escolha do usuário). Cada sala tem um telhado próprio que passa 8 px da parede (beiral) e faz sombra no chão.
- Sala: telhado de 4 águas em barro, com chaminé em cima da lareira. Depósito: 2 águas em ardósia. Cada água tem um tom (luz vinda de cima à esquerda); não tem desenho de telha, porque listra fina vira hachura. (Versão de 18/10; desde 19/10 o desenho é telha ou madeira, ver "Modelos e cores".)
- O telhado começa a sumir quando o centro do pino cruza a linha da parede (na porta). Some em 300 ms (escolha do usuário: "some suave, ~0,3 s") com ease-out e sobe 6 px / 3,5% enquanto some. Na saída ele volta pelo mesmo caminho. Se o pino entra e sai na hora, o telhado vira no meio, sem pular.
- O telhado é desenhado uma vez numa imagem própria, e essa imagem é que vai sumindo. Assim, no meio da transição, não aparecem as emendas entre as águas.
- Fichas dentro da sala (o mordomo) ficam escondidas pelo telhado para quem está fora.
- Visão do mestre: telhados a 32%, como vidro fosco; o mestre sempre vê o que tem dentro.
- Com movimento reduzido, o telhado só desbota (não sobe) e o fogo da lareira fica parado.

## Provas (18/10/2026)

22 de 22 em `provas/testes.json`: só a porta deixa passar, o telhado fica fechado enquanto o pino está fora, some em 225 ms depois de cruzar a porta (meta: <= 300 ms), volta em 225 ms, nunca pisca, entrar e sair na hora não pula (maior salto 0,29 por amostra de 25 ms), o mordomo fica escondido de fora e aparece de dentro e na visão do mestre (conferido pela cor do pixel), quadro p95 16,8 ms andando pela trilha, nenhuma tarefa longa, sem rolagem para o lado em 390 px, sem erro no console.

Não conferido: celular de verdade e o app real. Não tem som.

## Em aberto para levar ao app

1. Mestre: telhado a 32% (como aqui), só o contorno, ou sem telhado?
2. Casa com várias salas: abrir só a sala onde o pino está ou a casa inteira?
3. Jogador fora vê os pinos dos outros jogadores que estão dentro? Hoje, não: cada jogador vê pelo próprio pino.
4. ~~Mestre escolhe o tipo e a cor?~~ Respondido em 19/10: telha ou madeira, 6 cores cada mais cor livre (ver abaixo).
5. Como o telhado convive com a névoa do app.

## Modelos e cores, 19/10/2026

Decisão do usuário (literal em `PEDIDOS.md`): dois modelos, cada um com cor que o mestre troca.

- **Telha colonial ondulada**: fileiras de telha curva paralelas ao beiral, com sombra embaixo de cada fileira. Cores: barro `#8a5a46` (padrão de todo teto sem modelo escolhido), terracota escura `#6a3f33`, ardósia `#656b72`, verde musgo `#606a50`, azul colonial `#4a5868`, preto `#35373b`.
- **Madeira em tábuas compridas**: tábuas da cumeeira ao beiral, com larguras variadas, veio, emenda de topo e fresta escura. Cores: carvalho `#8b6b47`, nogueira `#5f4532`, pinho claro `#a3875f`, cinza envelhecido `#7b776e`, vermelho celeiro `#733d33`, verde `#4d5f4f`.
- **Cor livre**: "Outra cor…" abre o seletor do sistema. A amostra lembra a última cor livre, e tocar nela de novo aplica essa cor.
- **Formas**: sala retangular tem 4 águas; forma livre (a casa em L) tem as águas calculadas, com cumeeira, espigão e rincão. A cumeeira e o espigão ficam um pouco mais claros, e o rincão mais escuro.
- **Código do app** (Fase 1, nada ligado ao app ainda): `client/src/lib/telhado/aguas.ts` (águas de qualquer polígono), `client/src/lib/telhado/paletas.ts` e `client/src/texturas/telhado.ts` (`pintarTelhado(poligono, modelo, cor, escala)`, sem sorteio: a mesma entrada dá a mesma imagem). O protótipo usa esse mesmo código, empacotado pelo `prototipo/montar.cjs`.
- **Folhas**: `provas/folha-modelos.png` (2 modelos × 6 cores × retângulo e L, no zoom normal) e `provas/folha-zoom.png` (casa em L a 50%, 100% e 200%).

Números (Chromium headless, esta máquina):

- **Provas**: 33 de 33. São as 22 antigas e 11 novas: os controles mudam o teto de verdade (clique, seta e cor livre, conferido pela cor do pixel), uma casa não mexe nas outras, a sala começa em telha barro.
- **Tempo para gerar o telhado de uma sala de 1024 × 1024**: mediana de 5 medições, meta de 50 ms.
  - Pior caso: retângulo de madeira, entre 43,0 e 46,3 ms nas 3 rodadas.
  - Retângulo de telha: 35 a 39 ms. L: 29 a 34 ms. Octógono: 33 a 41 ms.
  - A margem é curta na madeira. Se uma máquina mais fraca passar da meta, a saída é gerar em fatias entre quadros. Ainda não foi preciso.
- **Telhados do mapa (300 × 260 px)**: 1 a 8 ms cada; cada combinação de sala, modelo e cor fica guardada.
- **Andando**: quadro p95 16,7 ms.
- **Trocando de cor andando** (24 trocas, uma a cada 250 ms): quadro p95 16,8 ms, maior quadro 16,8 ms, troca mais cara 6 ms, nenhuma tarefa longa.
- **Testes de unidade**: 38 (`cd client; npx vitest run src/lib/telhado src/texturas/telhado`). Cobrem:
  - as águas do retângulo, do L, do T, do U e do octógono, sem degrau entre águas;
  - a luz de cada água;
  - a média de cor perto da cor escolhida;
  - cor e polígono inválidos.

Não conferido:

- O app de verdade: Fase 2 (dado e painel) e Fase 3 (desenho e transição), depois da aprovação.
- Celular de verdade.
- As cores foram julgadas só na minha tela.
- O seletor de cor nativo não abre no navegador sem tela; a prova manda o evento direto.
- Zoom abaixo de 50%: a fresta da madeira pode serrilhar. Na Fase 3, gerar na escala do zoom ou filtrar.
- Formas muito agudas (ângulo menor que ~30°) não foram testadas.
- Desvio do plano: na quina de dentro, a água que vence é a mais alta, e não a mais baixa como o plano dizia. Com "a mais baixa", o rincão inverte e abre um degrau, e 5 testes falham.
- O teste da textura foi escrito junto com o código, sem nascer vermelho. Foi conferido por mutação: com a luz da água zerada, 1 teste falha.
