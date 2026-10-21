# Vila meio-termo

Protótipo HTML avulso da mesma vila do Labirinto, no meio do caminho entre
"Textura" (`docs/design/vila/`, commit `fb945938`, achado realista demais) e
"Estilo Mother" (`docs/design/vila-estilo-mother/`, commit `6ea4d57b`, achado
cartoon demais). Abra `prototipo/index.html` (autocontido, sem imagem externa;
a fonte Barlow da moldura vem do Google Fonts). Abre em **Meio-termo**; o
seletor tem 4 modos com a mesma câmera: Hoje, Textura, Estilo Mother, Meio-termo.

Nada em `client/`. Os dois protótipos anteriores não foram tocados: o
`montar.cjs` lê os arquivos deles e aplica 31 trocas exatas e contadas (falha se
alguma não casar).

## Arquivos

- `prototipo/fonte.html` — a moldura (mesma do Estilo Mother, com 4 modos).
- `prototipo/meio.js` — o Meio-termo: paleta, chão, telhados, chaminés, porta polida.
- `prototipo/montar.cjs` — monta `index.html` a partir dos 3 protótipos + `meio.js`.
- `prototipo/index.html` — o arquivo para abrir (304 KB).
- `provas/gerar-provas.cjs` — roda as 41 provas e tira os 6 prints; resultado em `provas/testes.json`.

## Paleta (tokens)

38 cores base, todas no bloco `<PALETA>` de `meio.js`. Realce, sombra, contorno
e traço saem delas (190 tons ao todo). O contorno é a própria cor escurecida
para 60% da luz (no Mother era 50%), nunca abaixo de luminância 0,06, e com
72% da espessura do traço do Mother.

| Token | Cor | De onde veio |
|---|---|---|
| `grama` | `#8cbf80` (realce `#a2cc92`, sombra `#76ac6d`) | entre o oliva da Textura e o menta do Mother |
| `praca` | `#dcd0b6` (realce `#ebe2cd`, sombra `#bcae94`) | pedra clara e quente, entre o cinza da Textura e o branco-azulado do Mother |
| `terra` | `#dda56c` | a trilha do Mother, menos laranja |
| `barranco` | `#aa745c` | o barranco liso do Mother, mais terroso |
| `telhaAzul` / `telhaAzulClara` / `telhaTerracota` / `telhaVerde` / `telhaMadeira` | `#43639a` / `#7189a6` / `#b56e50` / `#7f9a64` / `#867a6a` | cores do app, levadas meio caminho até as do Mother |
| `palha` | `#d6b56a` | a palha do Mother, menos amarela |
| `pedra` | `#c3c0b2` | chaminés e lajes |
| `carvalho` / `nogueira` / `pinho` / `ferro` / `latao` | `#a07b51` / `#775739` / `#b9995f` / `#5d6164` / `#b89552` | materiais da Textura, mais claros e quentes |
| `rosa` / `amarelo` / `violeta` / `branco` / `laranja` | `#e8a2c4` / `#f0d266` / `#a87fcb` / `#f3efe2` / `#e6793f` | flores do Mother |

## O que veio de cada lado, e por quê

**Da Textura (o que você gostou do detalhe):** barril, caixa, baú, banco, poço,
fogueira, troncos, carroça, barracas, mesa, quadro e lampião. São os mesmos
desenhos do `objetos.js`/`vila.js`, pintados com os materiais da paleta do meio
(mais claros e quentes), para não parecerem recortados de outro jogo em cima do
chão claro. Qualquer pixel quase preto que sobrasse desses desenhos é levantado
para o contorno de nogueira.

**Do Estilo Mother:** as lajes de pedra da porta até a praça, as jardineiras, o
campo florido em volta do poço (o poço é o da Textura, sentado na ilha de grama
do Mother), a árvore (a da Textura saiu), o arco do portão com a flor, as placas
de seta com balão nas saídas, o barranco liso (sem hachura, sem parede grossa),
a trilha de terra, e o chão de grama com tufos e flores.

**O chão não se repete:** é pintado inteiro por código, sem ladrilho. Manchas de
ruído em 3 escalas (230, 80 e 27 px) fazem a cor da grama variar; tufos e flores
caem por um sorteio por célula com deslocamento; a praça é assentada pedra a
pedra, fileira por fileira, cada pedra com largura e tom sorteados. Um grão fino
(ruído em meia resolução, `soft-light`) passa por cima de tudo, para a madeira, a
pedra e a telha terem textura sem virar foto.

**Telhados:** os do app, com o código de telhado sem mudança (taverna, guilda,
boticário, empório e templo em telha colonial; ferraria em madeira) e a palha em
espinha do Mother no estábulo. **Chaminé nos 7 telhados:** quadrada, de pedra,
com face lateral, juntas, boca de metal e sombra suave no telhado. Fica na água
de trás, no lado longe da porta, a 11 px de lado no zoom 100%, então nunca cobre
porta nem placa.

## A porta (Resident Evil, só polida)

Mesmo tamanho (36 x 24 px no zoom 100%), mesmo lugar, mesma placa com ícone ao
lado, sem arco. O que mudou (veja `provas/detalhe-porta.png`, antes e depois a
300% no mesmo print):

- batente de nogueira com chanfro de luz em cima e sombra embaixo;
- folha em 3 tábuas, com veio ondulado, um nó e juntas finas; a tábua do meio é
  pinho claro (nogueira no estábulo, cujo telhado de palha já é claro);
- dobradiças de ferro com rebite e maçaneta de latão com espelho e brilho;
- soleira de 2 pedras com junta, realce e sombra;
- um pingo de luz quente na soleira, para o olho achar a entrada.

## Provas (41 de 41, rodada final)

Rodadas com `node docs/design/vila-meio-termo/provas/gerar-provas.cjs` no
Chromium headless do Playwright (1440 x 1100, tela 1x; celular 390 px, tela 2x).

| Prova | Meta | Medido |
|---|---|---|
| (a) robô com 250 ms de atraso e erro de direção, sementes 1-5 | 35/35 | **35/35**; mediana 3,6 s, pior 6,4 s; empacou 1 vez e refez o caminho |
| (b) portas no zoom 100% | ≥ 18 x 24 px | 7/7 com 36 x 24 (ou 24 x 36); nada cobre porta nem caminho (7/7 portas, 11 caminhos); folha visível sobre o telhado: diferença de cor 0 nas 7 (meta ≤ 40) |
| (c) quadro andando e com zoom | p95 ≤ 20 ms; nenhuma tarefa ≥ 200 ms | p95 **16,7 ms** (página lida: 16,8 ms); maior tarefa **99 ms** (página lida: 85 ms) |
| (d) primeira pintura | ≤ 400 ms | **287 ms** no computador, **247 ms** no celular |
| (e) erros no console | 0 | **0** |
| (f) rolagem lateral em 390 px | nenhuma | conteúdo 390 px, janela 390 px |
| (g) trocar de modo e voltar | mesma imagem | digital 2604645175 antes e depois de passar por Hoje, Textura e Mother |
| (h) contorno nunca preto; cores base | luminância ≥ 0,03; ≤ 40 | 0 de 1.158.522 pixels abaixo (mais escuro 0,042); contorno mais escuro 0,060; **38** cores base |
| (i) grama em blocos de 96 x 96 | 0 iguais; autocorrelação sem pico (≤ 0,3 de 16 a 384 px) | 0 iguais em 165 (grama e chão inteiro); pico **0,005**. Controle: o ladrilho da Textura repetido dá 101 iguais e pico 0,836 em 256 px |
| (j) croma médio OKLCH do mapa inteiro | estritamente entre | Textura **0,0380** < Meio **0,0701** < Mother **0,0863** |
| (j) energia de borda média (Sobel na luz OKLab) | estritamente entre | Textura **0,1514** < Meio **0,1733** < Mother **0,1848** |
| (k) árvore, poço com campo, jardineira, arco, placa de seta, chaminé | todos presentes | 8 árvores (48-61% da caixa), 2 jardineiras (90%), arco 55%, 2 placas (45%, 48%), poço 68%; campo do poço 91% verde com 193 pixels de flor; 7 chaminés (83-100% da caixa diferente do telhado sem ela) |

Também passam: colisão (barranco, parede, porta), telhado que some em 300 ms ao
entrar e volta ao sair, clique e toque levam o pino, botão da casa leva o pino
para dentro, Grade e Nomes, zoom, setas e WASD, as setas do teclado no seletor de
modos, e "mesma entrada, mesma imagem" em duas aberturas.

O que as provas mudaram no caminho: a primeira rodada deu 38/41. A borda do Meio
passava a do Mother (0,195 contra 0,185), porque o rejunte da praça e o grão
estavam fortes; o rejunte e o aro de luz das pedras ficaram mais macios e o grão
caiu pela metade. A prova da chaminé procurava "cor de pedra" e errava nas
telhas cinzentas; agora compara com o mesmo telhado pintado sem a chaminé. E o
chão em 2x saía numa tarefa só de 214-341 ms; agora sai em 4 faixas, uma por vez,
na fila de fundo (a maior levou 99 ms).

## O que eu não conferi

- Não abri num navegador de verdade com placa de vídeo, nem no celular de
  verdade: tudo foi no Chromium headless.
- Não olhei o tema escuro da moldura nesta rodada (o CSS segue o mesmo contrato
  do Estilo Mother). O mapa não muda com o tema.
- Dos 6 prints, olhei o lado a lado, a porta, a árvore com jardineira, o poço e o
  celular; o `desktop-1440.png` foi gerado mas não aberto por mim.
- A praça, medida sozinha, tem um ritmo de fileira (autocorrelação 0,36 a 20 px):
  é a altura das fileiras de pedra, como num calçamento de verdade, e não um
  ladrilho repetido. A meta de não repetir vale para a grama, e lá o pico é 0,005.
- "Ficou no meio e ficou bonito" é julgamento seu. Os dois números da prova (j)
  dizem que o Meio está entre os dois em cor e em quantidade de traço, não que
  está no ponto certo.

## O que ficou de fora

- Nada foi para o app. Se um dos modos for aprovado, levar para `client/` é outra
  tarefa (a palha do estábulo e a chaminé não existem no código de telhado do app).
- A árvore da Textura não aparece no Meio-termo (você pediu para tirar).
- O som e a animação de ambiente não fazem parte deste protótipo.

## Perguntas para você

1. O meio está onde você queria, ou ainda puxa para um lado (mais realista ou mais cartoon)?
2. A árvore do Mother serve aqui, perto dos objetos da Textura?
3. A porta polida serve, ou quer mais (ou menos) acabamento?
4. As chaminés estão no tamanho certo, ou pequenas demais?
5. Qual modo vai para o app: Textura, Estilo Mother ou Meio-termo?
6. Teve algo de que você não gostou?
