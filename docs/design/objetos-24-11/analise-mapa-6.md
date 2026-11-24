# Mapa de referência 6: Templo na selva

Análise de 24/11/2026. Imagem de referência: mapa da MapXilla, 1776 x 2072 px. Olhei por região, em recortes ampliados: o templo no topo, a calçada e as ilhas no meio, a selva com a trilha embaixo, as ruínas à direita e os detalhes (cabana, pedestal e píer).

Comparei com o que o app tem hoje. O `CATALOGO.md` desta pasta ainda não existe, então a fonte foram os registros:

- objetos: `lib/mobilia/pecasNovas.ts` e `lib/mobilia.ts:73`;
- construções: `lib/mobilia/construcoes.ts`;
- chão: `texturas/embutidas.ts`;
- carimbos: `carimbos/novos/` e os 12 embutidos;
- água: `lib/agua/dados.ts`;
- ponte: `lib/mobilia/ponte.ts`, com as formas madeira, pedra e corda;
- materiais: `texturas/meioTermo/materiais.ts`.

Legenda:

- **novo**: o app não tem;
- **versão**: o app tem a peça, mas falta esta forma ou este material;
- **existe**: já dá para montar com o que há.

Complexidade:

- **complexo**: forma orgânica, muitas partes, luz ou brilho, água ou construção grande;
- **simples**: móvel ou peça de forma direta.

## O que tem no mapa, por região

1. **Topo, o templo.** Uma pirâmide em quatro degraus concêntricos. Cada degrau é uma borda de pedra coberta de folhagem, com água parada entre eles. No alto fica uma plataforma de laje com uma escadinha que desce para uma entrada escura. Duas palmeiras grandes crescem ali, com as raízes à mostra por cima da pedra.
2. **Centro.** Uma escadaria longa de arenito desce do templo. Ela cruza um patamar em forma de cruz e vira uma calçada elevada entre dois tanques retangulares de água turquesa, com borda de pedra, até uma praça de laje embaixo.
3. **Ilhas de rocha cinza dos lados.** Têm alicerces de casas em ruína (contorno de muro baixo em L), blocos de cantaria soltos e pedregulhos. Quatro pontes de laje de pedra, com mureta, cruzam os riachos na diagonal. Pequenas cascatas descem das bordas, e há pedras de passo na água.
4. **Embaixo, no eixo.** Um rio desce em cascata de degraus, com espuma branca. Quatro pontes de pedra largas, sobre pilares, cruzam a cascata; uma delas está quebrada, com um buraco.
5. **Embaixo, à esquerda.** Pontes de tábua, uma delas quebrada, e uma trilha de terra batida com borda de areia e cascalho. As margens são barrancos de pedra.
6. **Direita.** Um campo de grama com alicerces em ruína e um pedestal redondo de pedra, com um entalhe hexagonal no topo, parecido com a base de um ídolo ou um marco.
7. **Canto inferior esquerdo.** Uma cabana pequena com telhado de lajes de pedra escura e esverdeada, coberta pelas palmeiras.
8. **Canto inferior direito.** A ponta de um píer de madeira, quase toda escondida pela marca do autor.
9. **Selva em volta.** Palmeiras de folha larga, árvores de copa redonda (verde e verde-azulado), arbustos escuros com frutinhas, raízes e galhos secos, um tronco caído e um toco.

---

## 1. OBJETOS

| Item | Tipo | Base no app | Complexidade | Nota |
|---|---|---|---|---|
| Ponte de laje de pedra com mureta | existe | `ponte` (forma Pedra) | simples | Atende às pontes diagonais das ilhas. |
| Ponte de pedra quebrada (laje com buraco) | versão | `ponte` (forma Pedra) | simples | Quarta forma da ponte, ou uma opção "quebrada". |
| Ponte de tábuas quebrada (tábuas faltando) | versão | `ponte` (forma Madeira) | simples | Aparece duas vezes à esquerda. |
| Ponte larga sobre pilares de pedra (passa por cima de cascata) | versão | `ponte` (forma Pedra) | complexo | Mais larga, com pilares visíveis e a água correndo entre eles. |
| Píer de madeira | existe | `pier` | simples | Canto inferior direito. |
| Calçada de pedra sobre a água (píer de laje) | versão | `pier` | simples | O píer em pedra de arenito. É o caminho entre os tanques. |
| Muro em ruína, desmoronado em L | versão | `muroBaixoDePedra` | simples | Muro com falhas, blocos caídos e cantos; os alicerces estão por todo o mapa. |
| Blocos de cantaria soltos | existe | `escombrosDePedra` | simples | |
| Pedestal redondo de pedra entalhado (marco hexagonal) | versão | `altarRedondo` | simples | Disco baixo com entalhe geométrico no estilo maia. |
| Coluna de templo maia com glifos e musgo | versão | `colunaQuebrada` / `pilar` | simples | Combina com o tema; não aparece no mapa. |
| Estela maia (laje de pé com glifos) | novo | — | simples | Tema; parente do obelisco, mas baixa e chata. |
| Cabeça colossal de pedra (olmeca) com musgo | novo | — | complexo | Tema; rosto orgânico. |
| Ídolo dourado no pedestal | novo | `pedestalComLivro` (parecido) | complexo | Tema: o "tesouro do templo", com brilho. |
| Estátua de jaguar ou serpente emplumada | versão | `estatua` | complexo | Tema: a estátua em pose de bicho de templo. |
| Totem tribal de madeira entalhada | novo | — | simples | Tema. |
| Tocha de bambu (tiki) | versão | `tochaDePe` | simples | Tema; acende como a tocha de pé. |
| Braseiro de pedra escalonado | versão | `braseiro` | simples | Tema; o braseiro de ferro em pedra. |
| Altar de sacrifício escalonado | versão | `lajeDeSacrificio` | simples | Tema; a laje sobre degraus de pedra. |
| Laje de pressão (armadilha de templo) | versão | `armadilhaDeEspinhos` | simples | Tema: placa de pedra que afunda. |
| Baú de pedra do templo | versão | `bau` | simples | Tema; o baú em pedra entalhada. |
| Canoa escavada em tronco | versão | `bote` | simples | Tema: rio na selva. |
| Urnas e vasos de barro pintado | versão | `anforasDeBarro` | simples | Tema; vasos com padrão geométrico. |
| Rede de dormir entre palmeiras | existe | `redeDeDormir` | simples | |
| Crânios e ossos | existe | `cranio`, `ossos` | simples | |

## 2. CONSTRUÇÕES

| Item | Tipo | Base no app | Complexidade | Nota |
|---|---|---|---|---|
| Pirâmide em degraus (zigurate maia) com escadaria central | novo | — | complexo | A peça principal do mapa: grande, com vários níveis. Não existe estrutura parecida. |
| Pirâmide alagada (água e folhagem entre os degraus) | versão | a pirâmide nova acima | complexo | É exatamente o que o mapa mostra; tem água e vegetação. |
| Topo do templo com entrada escura e escada descendo | novo | `alcapao` (parecido) | complexo | O santuário no alto da pirâmide: laje, escadinha e vão escuro. |
| Cabana com telhado de lajes de pedra (santuário pequeno) | novo | — | simples | Canto inferior esquerdo. |
| Cabana de palha sobre palafitas | novo | — | complexo | Tema da selva; não aparece no mapa. |
| Cascata em degraus (queda d'água com espuma) | novo | — | complexo | Eixo de baixo e bordas das ilhas. A ferramenta Água não faz desnível. |
| Tanque retangular com borda de pedra (espelho d'água) | novo | — | simples | Os dois tanques ao lado da calçada. Hoje dá com Água mais Muro, mas sem a borda de lajes. |
| Alicerce de casa em ruína (planta baixa de muros caídos) | novo | `muroBaixoDePedra` + `escombrosDePedra` | simples | O contorno inteiro de uma casa como uma peça só. Hoje é montado peça a peça. |
| Ilha ou planalto de rocha com borda de barranco | existe | ferramentas Barranco e Penhasco | complexo | O relevo das ilhas cinzentas. |
| Escadaria de pedra larga | existe | ferramenta Escada (pedra) | simples | Falta o arenito (ver TEXTURAS). |

## 3. TEXTURAS

| Item | Tipo | Base no app | Complexidade | Nota |
|---|---|---|---|---|
| Laje de templo em arenito claro, rachada | versão | `laje-de-templo` (Pisos de pedra) | simples | A calçada, o patamar e a praça. Tom bege areia, com rachaduras. |
| Grama de selva | existe | `grama` (Campo, Verde) | simples | |
| Trilha de terra batida | existe | `terra` | simples | |
| Borda de areia com cascalho | existe | `areia`, `cascalho` | simples | |
| Rocha cinza de planalto com pedrisco | existe | `pedra` (Serra), `rocha-de-caverna` | simples | O chão das ilhas. |
| Chão de selva (folhagem densa) | existe | `chao-de-floresta`, `floresta` | simples | |
| Pedra de templo com musgo | existe | `pedra-musgo` | simples | |
| Água turquesa (tanques e rios) | existe | ferramenta Água, cor Turquesa | simples | |
| Água corrente com espuma (corredeira) | versão | ferramenta Água (tipo Rio) | complexo | Um tipo ou efeito de rio com espuma branca e degraus. É água animada. |
| Parede de pedra de templo entalhada (arenito com glifos) | novo | `pedra-musgo` (parede) é a mais perto | complexo | Material de parede novo; entra no fim de `MATERIAIS_DA_PAREDE`. |
| Escada de arenito | versão | escada `pedra-cascalho` / `pedra-pedregulhos` | simples | Os degraus da escadaria central são lisos e bege. |
| Telhado de lajes de pedra com musgo | versão | telhado `ardosia` | simples | O telhado da cabana: lajes grandes, verde-escuras. |

## 4. CARIMBOS

| Item | Tipo | Base no app | Complexidade | Nota |
|---|---|---|---|---|
| Palmeira | existe | `palmeira` | simples | |
| Palmeira de selva (folha larga, sem coco) | versão | `palmeira` | complexo | As palmeiras do mapa: copa cheia, folhas largas e serrilhadas. |
| Palmeira com raízes à mostra (sobre pedra) | versão | `palmeira` | complexo | As duas do topo do templo, com raízes descendo pela laje. |
| Árvore de copa redonda | existe | `arvore-redonda` | simples | |
| Árvore de copa verde-azulada escura | versão | `arvore-redonda` | simples | Metade das copas do mapa tem esse tom. |
| Arbusto escuro com frutinhas | existe | `arbustoComFrutinhas`, `arbustoAzulado` | simples | |
| Raiz retorcida e galhos secos | existe | `raizRetorcida`, `galhosCaidos` | simples | |
| Tronco caído | existe | `tronco-caido` | simples | |
| Toco | existe | `toco-seco` | simples | |
| Pedras, seixos e rochedo com musgo | existe | `pedras`, `seixos`, `rochedoComMusgo` | simples | |
| Pedras de passo na água | existe | `pedrasDePasso` | simples | |
| Musgo | existe | `musgo` | simples | |
| Samambaia, bananeira e bambuzal | existe | `samambaia`, `bananeira`, `bambuzal` | simples | Combinam com o tema. |
| Vitória-régia | existe | `vitoriaRegia` | simples | Combina com os tanques. |
| Moita tropical de folha larga (costela-de-adão) | novo | — | complexo | A folhagem baixa que cobre as bordas dos degraus. |
| Cipós pendurados (trepadeira caindo da pedra) | novo | — | complexo | Tema; desce pelas bordas do templo. |
| Bromélias e orquídeas | novo | — | complexo | Tema: flores da selva. |
| Espuma de cachoeira (pé da queda d'água) | novo | — | complexo | Carimbo de água branca para pôr no pé das cascatas sem a construção nova. |
| Blocos de cantaria caídos (carimbo) | versão | `pedras` | simples | Blocos quadrados cortados, diferentes das pedras redondas. Hoje só existem como objeto (`escombrosDePedra`). |

---

## Resumo

- **Novo mais pedido pelo mapa:** a pirâmide em degraus, alagada, com o topo e a entrada. É uma construção grande, complexa e sem nada parecido no app.
- **Novo pelo tema:** estela maia, cabeça colossal, ídolo dourado, totem, cabana de palha e o telhado de pedra. Nos carimbos: moita tropical, cipós e bromélias.
- **Versões que valem pouco esforço:**
  - ponte quebrada (pedra e tábua);
  - píer de pedra;
  - muro em ruína;
  - laje de templo em arenito;
  - escada de arenito;
  - tocha tiki;
  - braseiro de pedra;
  - palmeira de selva.
- **Água:** cascata, corredeira e espuma não existem. É o maior vazio para mapas de selva, e é tudo complexo.
- **Já dá para montar hoje:** a selva toda, a trilha, as ilhas de rocha (com Barranco ou Penhasco), os tanques (com Água turquesa) e as pontes de pedra comuns.
