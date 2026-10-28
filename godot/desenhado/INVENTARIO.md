# Inventário do pacote Desenhado

Tudo o que o app desenha hoje e que o Desenhado precisa cobrir, na ordem das ondas que o
usuário pediu em 28/10/2026: **chão e caminhos → telhados → árvores e plantas → móveis e
objetos → penhasco e paredes**. Cada onda é dividida em **lotes de 5**; o usuário aprova um
lote por vez, com a folha do lote (`scripts/folha_do_lote.gd`). O último lote de uma onda
pode ter menos de 5, para um lote nunca misturar duas ondas.

Levantado no código em 28/10/2026 (branch `feat/desenhado`, app 0.5.5). As fontes estão
no fim. **65 itens em 14 lotes.**

O **id** é o do app sempre que o app já tem um (`idDoApp` no `config.json`), para a
integração achar a pasta `exportado/<id>/` pelo mesmo nome. Item que o app pinta com cor
chapada (sem textura) ganha um id novo e `idDoApp: null`.

O **que entregar** remete ao contrato: "chão" = o contrato de chão de `CONTRATO.md`
(base-1..3 + atlas + `textura.json`). Telhado, sprite de planta e móvel ainda **não** têm
contrato: ele é escrito antes da onda começar (ver o fim do `CONTRATO.md`).

## Onda 1: chão e caminhos (18 itens, lotes 1 a 4)

Hoje: 16 texturas embutidas pintadas pela ferramenta **Texturas** (grupo Terreno), mais o
**Caminho** e o chão de sala, que são cor chapada.

### Lote 1: o que mais cobre o mapa real do usuário, mais o par terra e caminho

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega |
|---|---|---|---|---|
| 1 | `grama` | Campo (forma Verde) | ferramenta Texturas, campo aberto; no mapa real, a maior área contínua (janela de 40 x 40 casas toda de grama) | chão; capim em risquinhos e florzinhas raras no atlas, como o protótipo do Fogo. **Piloto já existe** (`texturas/grama/`, não é final) |
| 2 | `grama-amarela` | Campo (forma Amarelo) | Texturas; 49 pinceladas no mapa real | chão; a mesma família do `grama`, seca e mais quente; os dois lado a lado não podem brigar |
| 3 | `floresta` | Floresta | Texturas; a textura mais usada do mapa real (cerca de 450 casas) | chão visto de cima com copas; copa é forma grande e calma (**nada de escama**, foi a crítica de 28/10); copas no atlas com `celulaCasas: 2` |
| 4 | `terra` | Terra | Texturas (ladrilho de 512 px hoje); estrada e chão batido | chão; manchas largas, poucos seixos no atlas |
| 5 | `caminho` | Caminho (ferramenta) | ferramenta Caminho: hoje é um traço de cor chapada `#8a6a45` (`stores/mapStore.ts:1917`) | chão (`idDoApp: null`); tem de ficar bom numa faixa de 1 a 3 casas de largura, com borda que o app recorta pelo traço |

### Lote 2

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega |
|---|---|---|---|---|
| 6 | `chao-de-floresta` | Chão de floresta | Texturas (512 px) | chão; folhas caídas e raízes como formas largas, sem pontilhado |
| 7 | `bosque` | Bosque | Texturas (512 px; copas espalhadas) | chão com copas grandes no atlas (`celulaCasas: 2`), clareiras pelo agrupamento |
| 8 | `pinheiros` | Pinheiros | Texturas | chão com copas de pinheiro vistas de cima (`celulaCasas: 2`) |
| 9 | `pantano` | Pântano | Texturas (512 px; poças e juncos) | chão; poças e juncos no atlas; água em `#40707e` contida |
| 10 | `areia` | Areia | Texturas; praia | chão; ondulação larga e calma, conchas raras |

### Lote 3

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega |
|---|---|---|---|---|
| 11 | `duna` | Duna | Texturas | chão; cristas largas de duna, sem listra regular |
| 12 | `pedra` | Serra | Texturas; terreno de rocha | chão; lajes de rocha grandes, fendas poucas |
| 13 | `neve` | Neve | Texturas | chão; branco quente da paleta (nunca branco puro), sombras azuladas suaves |
| 14 | `lajotas` | Lajotas de pedra (forma Clara) | Texturas, piso interno; o ladrilho do app tem 8 casas (`casas: 8`) | chão **com estrutura**: as juntas são iguais nas variantes, só a superfície muda (CONTRATO.md) |
| 15 | `lajotas-escuras` | Lajotas de pedra (forma Escura) | Texturas, piso interno | chão com estrutura; a mesma geometria da `lajotas`, tom escuro |

### Lote 4 (3 itens, fecha a onda 1)

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega |
|---|---|---|---|---|
| 16 | `calcamento` | Calçamento | Texturas, rua; ladrilho de 1024 px e 8 casas hoje | chão com estrutura (pedras assentadas); período de 8 casas |
| 17 | `conves` | Convés | Texturas, piso de navio; 1024 px e 8 casas hoje | chão com estrutura (tábuas na grade da casa) |
| 18 | `piso` | Chão de sala (peças de chão e regiões) | ferramenta de chão por peças e sala: hoje cor chapada que o mestre escolhe (`FloorPiece.fillColor`, `Region.fillColor`) | chão neutro e claro que **aceita a cor do mestre** (tingível). Decidir com o usuário no lote 4 se entra assim |

## Onda 2: telhados (5 itens, lote 5)

Hoje o telhado é pintado por sala, em CPU, ao longo do beiral (`texturas/telhado.ts`), em
3 modelos com 6 cores cada mais "Outra cor" (`lib/telhado/paletas.ts`). O Desenhado entrega
o material **no espaço do telhado** (u ao longo do beiral, v da cumeeira ao beiral) e
tingível pelas cores do mestre. Contrato próprio antes da onda.

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega |
|---|---|---|---|---|
| 19 | `telhado-telhas` | Telhas | Sala > Modelo do telhado (padrão: barro `#8a5a46`) | material de telha em fileiras paralelas ao beiral, tingível; sem escama miúda |
| 20 | `telhado-madeira` | Madeira | Sala > Modelo do telhado | tábuas da cumeeira ao beiral, tingível |
| 21 | `telhado-palha` | Palha | Sala > Modelo do telhado | palha em fileiras largas, borda do beiral; calma (hoje tem espinha de peixe miúda) |
| 22 | `chamine` | Chaminé | Sala > Chaminé (só Meio-Termo) | chaminé de pedra vista de cima, 1 objeto |
| 23 | `cumeeira-amarrada` | (cumeeira da palha) | automática no telhado de palha (Meio-Termo) | a faixa da cumeeira com amarras, repetível ao longo da cumeeira |

## Onda 3: árvores e plantas (14 itens, lotes 6 a 8)

Hoje: ferramenta **Carimbos** (`carimbos/catalogo.ts`), desenho em Canvas 2D assado uma vez,
8 giros x 8 sementes, sombra projetada pela silhueta; mais 3 móveis que são planta. O
Desenhado entrega **sprites** (imagem com alfa por semente). Contrato: CONTRATO.md seção 9
(28/10/2026): carimbo de 1 a 4 sprites vistos de cima (o giro escolhe a forma, a imagem não
gira, a sombra é do app); o vaso é carimbo de destino `movel`; a sebe e a jardineira são
**trecho** (um período repetível com relevo, a luz do app). Piloto: `arvore`.

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega |
|---|---|---|---|---|
| 24 | `arvore` | Árvore | Carimbos | sprite de copa vista de cima, lobos grandes e calmos (a crítica de 28/10 nasceu aqui) |
| 25 | `arvore-redonda` | Árvore redonda | Carimbos | sprite |
| 26 | `pinheiro` | Pinheiro | Carimbos | sprite |
| 27 | `pinheiro-nevado` | Pinheiro com neve | Carimbos | sprite (o pinheiro com neve por cima) |
| 28 | `arbusto` | Arbusto | Carimbos | sprite, sombra baixa |

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega |
|---|---|---|---|---|
| 29 | `palmeira` | Palmeira | Carimbos | sprite |
| 30 | `juncos` | Juncos | Carimbos | sprite, sombra baixa |
| 31 | `sebe` | Sebe | Objetos (móvel `sebe`, 2 x 0,5 casa, esticável e curva) | trecho repetível ao longo da sebe |
| 32 | `jardineira` | Jardineira | Objetos (móvel, 1 x 0,5 casa) | trecho reto (`curva: false`): o móvel esticado repete o período |
| 33 | `vaso` | Vaso de planta | Objetos (móvel, 0,5 x 0,5 casa) | sprite (carimbo de destino `movel`) |

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega |
|---|---|---|---|---|
| 34 | `pedras` | Pedras | Carimbos (não é planta, mas mora no mesmo catálogo) | sprite, sombra baixa |
| 35 | `poca` | Poça | Carimbos | sprite sem sombra |
| 36 | `girassol` | Girassol | Carimbos, vem do pacote do GitHub | sprite |
| 37 | `girassois` | Girassóis | Carimbos, vem do pacote do GitHub | sprite |

## Onda 4: móveis e objetos (23 itens, lotes 9 a 13)

Hoje: 26 tipos (`lib/mobilia/tipos.ts`) montados peça por peça em
`texturas/meioTermo/moveis/` com 24 materiais em 8 classes (`meioTermo/materiais.ts`); os 3
que são planta foram para a onda 3. **Decidir com o usuário antes da onda:** redesenhar
cada móvel como sprite, ou entregar só os materiais (madeira, metal, tecido, pedra, palha,
corda, casca, folha) para o motor de hoje. Tamanhos abaixo em casas (frente).

| Lote | Itens (id: nome que o mestre vê, tamanho) |
|---|---|
| 9 | `mesa`: Mesa 2 x 1 · `mesaQuadrada`: Mesa quadrada 1 x 1 · `mesaRedonda`: Mesa redonda 1,25 x 1,25 · `cadeira`: Cadeira 0,5 x 0,5 · `catre`: Cama 1 x 2 |
| 10 | `barril`: Barril 0,7 x 0,7 · `caixa`: Caixa 0,8 x 0,8 · `bau`: Baú 1 x 0,6 · `armario`: Armário de cozinha 1 x 0,5 · `aparador`: Aparador 2 x 0,5 |
| 11 | `tapete`: Tapete 3 x 2 (ou redondo 2 x 2) · `tapeteLongo`: Tapete longo 1 x 4 · `fogueira`: Fogueira 1 x 1 · `lampiao`: Lampião 0,5 x 0,5 · `fogo`: Fogo (Chama 1 x 1, Fogaréu 2 x 2, Incêndio 4 x 3; a chama animada fica fora da imagem) |
| 12 | `cerca`: Cerca 2 x 0,25 · `arcoDoPortao`: Arco do portão 2 x 0,5 · `placaDeSeta`: Placa de seta 0,5 x 0,5 · `quadroDeAvisos`: Quadro de avisos 1 x 0,4 · `poco`: Poço 1,5 x 1,5 |
| 13 | `barraca`: Barraca de feira 2 x 2 · `carroca`: Carroça 2 x 1,25 · `lapide`: Lápide 0,6 x 0,35 |

Onde aparecem: ferramenta **Objetos** (`components/MobiliaControls.tsx`); 8 tipos têm vista
Frente/Lado e o mapa pode estar em vista 3/4 (`MapData.vistaDosMoveis`), o que multiplica
o que cada sprite precisa cobrir.

## Onda 5: penhasco e paredes (5 itens, lote 14)

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega |
|---|---|---|---|---|
| 61 | `penhasco` | Penhasco (Baixo, Médio, Alto) | ferramenta Penhasco; no Meio-Termo é o barranco liso (`meioTermo/barranco.ts`, tons `#aa745c`) | a face do barranco no espaço do traço (ao longo e para baixo), repetível ao longo |
| 62 | `penhasco-borda` | (lábio e faixas do relevo) | as 6 faixas do relevo (`lib/relevo.ts:138-145`) | a borda de cima e o pé molhado, repetíveis ao longo |
| 63 | `parede` | Parede | ferramenta Parede: hoje traço de uma cor (`#d8d2c4` ou a cor do mestre) | material de parede vista de cima, tingível pela cor do mestre, repetível ao longo do traço |
| 64 | `janela` | Janela | na parede (hoje traço duplo) | trecho de janela no traço |
| 65 | `grade-de-prisao` | Grade de prisão | na parede (só Meio-Termo) | trecho de grade no traço |

## Fontes no código (para conferir)

- Texturas de chão: `client/src/texturas/embutidas.ts:1084-1103` (lista), `catalogo.ts`, `ladrilhos.ts:12` (256 px padrão).
- Onde o mestre escolhe e onde fica no mapa: `components/TexturasControls.tsx:267`; `MapData.texturas` (`types/map.ts:2345`).
- Caminho e chão de sala: `stores/mapStore.ts:1917`; `pixi/drawFloor.ts:65`; `pixi/drawRegions.ts:331`.
- Telhados: `texturas/telhado.ts`, `lib/telhado/paletas.ts:34-66`, `texturas/meioTermo/chamine.ts`, `meioTermo/cumeeiraAmarrada.ts`.
- Carimbos: `carimbos/embutidos.ts:553-561`, `carimbos/catalogo.ts:27`.
- Móveis: `lib/mobilia/tipos.ts:14`, `lib/mobilia.ts:55,102`, `lib/mobilia/pecasNovas.ts:63-95`, `texturas/meioTermo/moveis/`.
- Penhasco e paredes: `lib/relevo.ts:138-195`, `texturas/meioTermo/barranco.ts`, `pixi/drawWalls.ts:58,332`.
- Mapa real usado nas contas (só leitura, fora do repo): um mapa do usuário de 200 x 200 casas, 228 passos de textura.
