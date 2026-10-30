# Inventário do pacote Desenhado

Tudo o que o app desenha hoje e que o Desenhado precisa cobrir, na ordem das ondas que o
usuário pediu em 28/10/2026: **chão e caminhos → telhados → árvores e plantas → móveis e
objetos → penhasco e paredes**. Cada onda é dividida em **lotes de 5**; o usuário aprova um
lote por vez, com a folha do lote (`scripts/folha_do_lote.gd`). O último lote de uma onda
pode ter menos de 5, para um lote nunca misturar duas ondas.

Levantado no código em 28/10/2026 (branch `feat/desenhado`, app 0.5.5). As fontes estão
no fim. Até a 0.5.13, **79 itens em 17 lotes** (29/10: a onda 4 passou de 8 materiais para os 31
móveis desenhados que pegam cor, porque o caminho "só materiais" foi reprovado; no mesmo
dia o app ganhou 6 móveis, a lareira, a fornalha de ferreiro, a bigorna, o balde de água,
os troncos e o feno, e a onda 4 foi a 37 itens, lotes 9 a 16; a onda 5 virou o lote 17 e
os números 75 a 79). Depois da 0.5.13 a onda 5b (as portas) virou o lote 18 e os números 80 a
82: são **82 itens em 18 lotes**. Os números vão de 1 a 82; com o **37b** (o tronco caído, que entrou no
lote 8 depois da numeração) são **83 pastas** em `exportado/`, fora o `material-madeira`
do caminho reprovado (onda 4).

**Estado (29/10/2026, fim da onda 5): tudo entregue.** A última coluna de cada tabela diz o
commit que entregou a pasta `exportado/<id>/` na branch `feat/desenhado`; quando ela foi
refeita depois, também o da versão de hoje (o último que mexeu nela:
`git log -1 -- exportado/<id>`). Nada disto está no app ainda: o que a integração precisa
está em `README.md`, "Para integrar no app".

O **id** é o do app sempre que o app já tem um (`idDoApp` no `config.json`), para a
integração achar a pasta `exportado/<id>/` pelo mesmo nome. Item que o app pinta com cor
chapada (sem textura) ganha um id novo e `idDoApp: null`.

O **que entregar** remete ao contrato: "chão" = o contrato de chão de `CONTRATO.md`
(base-1..3 + atlas + `textura.json`). Telhado (seção 8), carimbo e trecho (seção 9) e
móvel desenhado (seção 10) e o traço da onda 5 (seção 11, de 29/10) têm contrato.

## Onda 1: chão e caminhos (18 itens, lotes 1 a 4)

Hoje: 16 texturas embutidas pintadas pela ferramenta **Texturas** (grupo Terreno), mais o
**Caminho** e o chão de sala, que são cor chapada.

### Lote 1: o que mais cobre o mapa real do usuário, mais o par terra e caminho

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega | Estado |
|---|---|---|---|---|---|
| 1 | `grama` | Campo (forma Verde) | ferramenta Texturas, campo aberto; no mapa real, a maior área contínua (janela de 40 x 40 casas toda de grama) | chão; capim em risquinhos e florzinhas raras no atlas, como o protótipo do Fogo. **Piloto já existe** (`texturas/grama/`, não é final) | entregue `4f5ac945` |
| 2 | `grama-amarela` | Campo (forma Amarelo) | Texturas; 49 pinceladas no mapa real | chão; a mesma família do `grama`, seca e mais quente; os dois lado a lado não podem brigar | entregue `c74ecfff` |
| 3 | `floresta` | Floresta | Texturas; a textura mais usada do mapa real (cerca de 450 casas) | chão visto de cima com copas; copa é forma grande e calma (**nada de escama**, foi a crítica de 28/10); copas no atlas com `celulaCasas: 2` | entregue `c9f9be73`, versão atual `e548220f` |
| 4 | `terra` | Terra | Texturas (ladrilho de 512 px hoje); estrada e chão batido | chão; manchas largas, poucos seixos no atlas | entregue `679b11e8` |
| 5 | `caminho` | Caminho (ferramenta) | ferramenta Caminho: hoje é um traço de cor chapada `#8a6a45` (`stores/mapStore.ts:1917`) | chão (`idDoApp: null`); tem de ficar bom numa faixa de 1 a 3 casas de largura, com borda que o app recorta pelo traço | entregue `f5d2a648` |

### Lote 2

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega | Estado |
|---|---|---|---|---|---|
| 6 | `chao-de-floresta` | Chão de floresta | Texturas (512 px) | chão; folhas caídas e raízes como formas largas, sem pontilhado | entregue `a6fb7111` |
| 7 | `bosque` | Bosque | Texturas (512 px; copas espalhadas) | chão com copas grandes no atlas (`celulaCasas: 2`), clareiras pelo agrupamento | entregue `f4895c2c`, versão atual `1b0a112b` |
| 8 | `pinheiros` | Pinheiros | Texturas | chão com copas de pinheiro vistas de cima (`celulaCasas: 2`) | entregue `2f704cea` |
| 9 | `pantano` | Pântano | Texturas (512 px; poças e juncos) | chão; poças e juncos no atlas; água em `#40707e` contida | entregue `00835e9a` |
| 10 | `areia` | Areia | Texturas; praia | chão; ondulação larga e calma, conchas raras | entregue `94c59c24` |

### Lote 3

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega | Estado |
|---|---|---|---|---|---|
| 11 | `duna` | Duna | Texturas | chão; cristas largas de duna, sem listra regular | entregue `188754e6` |
| 12 | `pedra` | Serra | Texturas; terreno de rocha | chão; lajes de rocha grandes, fendas poucas | entregue `a5f96a0d` |
| 13 | `neve` | Neve | Texturas | chão; branco quente da paleta (nunca branco puro), sombras azuladas suaves | entregue `568ce55c` |
| 14 | `lajotas` | Lajotas de pedra (forma Clara) | Texturas, piso interno; o ladrilho do app tem 8 casas (`casas: 8`) | chão **com estrutura**: as juntas são iguais nas variantes, só a superfície muda (CONTRATO.md) | entregue `0d34d4fd` |
| 15 | `lajotas-escuras` | Lajotas de pedra (forma Escura) | Texturas, piso interno | chão com estrutura; a mesma geometria da `lajotas`, tom escuro | entregue `a5178598` |

### Lote 4 (3 itens, fecha a onda 1)

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega | Estado |
|---|---|---|---|---|---|
| 16 | `calcamento` | Calçamento | Texturas, rua; ladrilho de 1024 px e 8 casas hoje | chão com estrutura (pedras assentadas); período de 8 casas | entregue `b08f7945` |
| 17 | `conves` | Convés | Texturas, piso de navio; 1024 px e 8 casas hoje | chão com estrutura (tábuas na grade da casa) | entregue `b624efe6` |
| 18 | `piso` | Chão de sala (peças de chão e regiões) | ferramenta de chão por peças e sala: hoje cor chapada que o mestre escolhe (`FloorPiece.fillColor`, `Region.fillColor`) | chão neutro e claro que **aceita a cor do mestre** (tingível). Decidir com o usuário no lote 4 se entra assim | entregue `81c58018` |

## Onda 2: telhados (5 itens, lote 5)

Hoje o telhado é pintado por sala, em CPU, ao longo do beiral (`texturas/telhado.ts`), em
3 modelos com 6 cores cada mais "Outra cor" (`lib/telhado/paletas.ts`). O Desenhado entrega
o material **no espaço do telhado** (u ao longo do beiral, v da cumeeira ao beiral) e
tingível pelas cores do mestre. Contrato próprio antes da onda.

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega | Estado |
|---|---|---|---|---|---|
| 19 | `telhado-telhas` | Telhas | Sala > Modelo do telhado (padrão: barro `#8a5a46`) | material de telha em fileiras paralelas ao beiral, tingível; sem escama miúda | entregue `7bc60b0a` |
| 20 | `telhado-madeira` | Madeira | Sala > Modelo do telhado | tábuas da cumeeira ao beiral, tingível | entregue `e7d3e40e` |
| 21 | `telhado-palha` | Palha | Sala > Modelo do telhado | palha em fileiras largas, borda do beiral; calma (hoje tem espinha de peixe miúda) | entregue `f0e2afc7` |
| 22 | `chamine` | Chaminé | Sala > Chaminé (só Meio-Termo) | chaminé de pedra vista de cima, 1 objeto | entregue `a548346c` |
| 23 | `cumeeira-amarrada` | (cumeeira da palha) | automática no telhado de palha (Meio-Termo) | a faixa da cumeeira com amarras, repetível ao longo da cumeeira | entregue `234a4d7f` |

## Onda 3: árvores e plantas (14 itens e o 37b, lotes 6 a 8)

Hoje: ferramenta **Carimbos** (`carimbos/catalogo.ts`), desenho em Canvas 2D assado uma vez,
8 giros x 8 sementes, sombra projetada pela silhueta; mais 3 móveis que são planta. O
Desenhado entrega **sprites** (imagem com alfa por semente). Contrato: CONTRATO.md seção 9
(28/10/2026): carimbo de 1 a 4 sprites vistos de cima (o giro escolhe a forma, a imagem não
gira, a sombra é do app); o vaso é carimbo de destino `movel`; a sebe e a jardineira são
**trecho** (um período repetível com relevo, a luz do app). Piloto: `arvore`.

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega | Estado |
|---|---|---|---|---|---|
| 24 | `arvore` | Árvore | Carimbos | sprite de copa vista de cima, lobos grandes e calmos (a crítica de 28/10 nasceu aqui) | entregue `1dd9268a`, versão atual `ae88ab4b` |
| 25 | `arvore-redonda` | Árvore redonda | Carimbos | sprite | entregue `b4c27cb6` |
| 26 | `pinheiro` | Pinheiro | Carimbos | sprite | entregue `efac9ad5` |
| 27 | `pinheiro-nevado` | Pinheiro com neve | Carimbos | sprite (o pinheiro com neve por cima) | entregue `55e9daac` |
| 28 | `arbusto` | Arbusto | Carimbos | sprite, sombra baixa | entregue `3ae8a2e4` |

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega | Estado |
|---|---|---|---|---|---|
| 29 | `palmeira` | Palmeira | Carimbos | sprite | entregue `a82acfbf` |
| 30 | `juncos` | Juncos | Carimbos | sprite, sombra baixa | entregue `dd231366` |
| 31 | `sebe` | Sebe | Objetos (móvel `sebe`, 2 x 0,5 casa, esticável e curva) | trecho repetível ao longo da sebe | entregue `eba81d6e` |
| 32 | `jardineira` | Jardineira | Objetos (móvel, 1 x 0,5 casa) | trecho reto (`curva: false`): o móvel esticado repete o período | entregue `e567d83c` |
| 33 | `vaso` | Vaso de planta | Objetos (móvel, 0,5 x 0,5 casa) | sprite (carimbo de destino `movel`) | entregue `72fd9f30` |

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega | Estado |
|---|---|---|---|---|---|
| 34 | `pedras` | Pedras | Carimbos (não é planta, mas mora no mesmo catálogo) | sprite, sombra baixa | entregue `36dc5083` |
| 35 | `poca` | Poça | Carimbos | sprite sem sombra | entregue `a38bd08d` |
| 36 | `girassol` | Girassol | Carimbos, vem do pacote do GitHub | sprite | entregue `dbf39a26` |
| 37 | `girassois` | Girassóis | Carimbos, vem do pacote do GitHub | sprite | entregue `34b749c4` |
| 37b | `tronco-caido` | Tronco caído | Carimbos (entrou no app em 28/10, `82d858eb` na main: tamanho 10, sombra `deitada`) | sprite deitado no chão, 4 formas que seguem o giro (`espelho: "nenhum"`); sombra `deslocada` 0,09, que dá a `deitada` de hoje | entregue `7e4f0590` |

## Onda 4: os móveis desenhados que pegam cor (37 itens, lotes 9 a 16)

Hoje: 40 tipos de móvel (`lib/mobilia/tipos.ts`, com os 8 de casa de 28/10 e os 6 de 29/10:
lareira, fornalha, bigorna e balde no commit `b2a03426` da main, troncos e feno no
`17cc4871`) montados peça por peça em `texturas/meioTermo/moveis/`, com 24 materiais em 8
classes (`meioTermo/materiais.ts`); os 3 que são planta (sebe, jardineira, vaso) foram para
a onda 3. Ficam **37**.

**Decisão do usuário de 29/10 ("Desenho à mão que pega cor"):** cada móvel é redesenhado à
mão como as árvores da onda 3, em cinza com as partes marcadas, e o app tinge cada parte
com o material que o mestre escolheu. O caminho de antes ("Materiais primeiros", só a
superfície das 8 classes) foi tentado e **reprovado** no mesmo dia: *"Não parece que teve
muita mudança ainda parece o mesmo atual e não desenhado"* (CONTRATO 10, 10.11). A vista
3/4 fica no Atual; a Frente/Lado entra. O contrato é a seção 10 do `CONTRATO.md`; a pasta
é `texturas/movel-<nome>/`, com `idDoApp` = o tipo do app.

Colunas: a **pegada** é a do app (casas, largura x fundo; o mestre pode mudar nos que
esticam); **estica** diz como (ponta + meio liso + ponta, CONTRATO 10.6); **lado** é a pegada
da vista Lado da ferramenta Frente/Lado (`TIPOS_COM_VISTA`), quando tem.

| # | Pasta (`idDoApp`) | Nome que o mestre vê | Pegada | Estica | Lado | Lote | Estado |
|---|---|---|---|---|---|---|---|
| 38 | `movel-mesa` (`mesa`) | Mesa | 2 x 1 | ao longo, pelo lado maior | não | 9 (piloto) | entregue `68882cff` |
| 39 | `movel-cadeira` (`cadeira`) | Cadeira | 0,5 x 0,5 | não | 0,5 x 0,75 | 9 (piloto) | entregue `68882cff` |
| 40 | `movel-barril` (`barril`) | Barril | 0,7 x 0,7 | não | não | 9 (piloto) | entregue `68882cff` |
| 41 | `movel-mesa-quadrada` (`mesaQuadrada`) | Mesa quadrada | 1 x 1 | sim | não | 10 | entregue `5f7c87af` |
| 42 | `movel-mesa-redonda` (`mesaRedonda`) | Mesa redonda | 1,25 x 1,25 | sim (vira oval) | não | 10 | entregue `2c6c7653` |
| 43 | `movel-caixa` (`caixa`) | Caixa | 0,8 x 0,8 | não | não | 10 | entregue `884a3c4a` |
| 44 | `movel-bau` (`bau`) | Baú | 1 x 0,6 | não | 0,6 x 0,6 | 10 | entregue `2c231f44` |
| 45 | `movel-armario` (`armario`) | Armário | 1 x 0,5 | não | 1 x 1,5 | 10 | entregue `65cd5b03` |
| 46 | `movel-catre` (`catre`) | Cama | 1 x 2 | não | não | 11 | entregue `2033ebd8` |
| 47 | `movel-aparador` (`aparador`) | Aparador | 2 x 0,5 | ao longo | 2 x 0,9 | 11 | entregue `880aa84b` |
| 48 | `movel-balcao` (`balcao`) | Balcão | 2 x 0,6 | ao longo | não | 11 | entregue `86038efa` |
| 49 | `movel-quadro-de-avisos` (`quadroDeAvisos`) | Quadro de avisos | 1 x 0,4 | não | não | 11 | entregue `f8056650` |
| 50 | `movel-placa-de-seta` (`placaDeSeta`) | Placa de seta | 0,5 x 0,5 | não | não | 11 | entregue `0f7ba7c7` |
| 51 | `movel-cerca` (`cerca`) | Cerca | 2 x 0,25 | ao longo, e a curva | não | 12 | entregue `7528d3e0` |
| 52 | `movel-arco-do-portao` (`arcoDoPortao`) | Arco do portão | 2 x 0,5 | ao longo | não | 12 | entregue `01a825ec`, versão atual `0ce75f87` |
| 53 | `movel-poco` (`poco`) | Poço | 1,5 x 1,5 | não | não | 12 | entregue `f7d3f3f7` |
| 54 | `movel-carroca` (`carroca`) | Carroça | 2 x 1,25 | não | 2 x 1,25 | 12 | entregue `03c2c423` |
| 55 | `movel-barraca` (`barraca`) | Barraca | 2 x 2 | não | 2 x 2 | 12 | entregue `4604cc2f`, versão atual `880565a2` |
| 56 | `movel-tapete` (`tapete`) | Tapete | 3 x 2 (redondo 2 x 2) | nos dois, pelo lado maior (o redondo vira oval) | 3 x 0,25 (redondo 2 x 0,25) | 13 | entregue `b5481cff` |
| 57 | `movel-tapete-longo` (`tapeteLongo`) | Tapete longo | 1 x 4 | ao longo | não | 13 | entregue `672246c8` |
| 58 | `movel-sofa` (`sofa`) | Sofá | 2 x 1 | ao longo | não | 13 | entregue `1a737c85` |
| 59 | `movel-poltrona` (`poltrona`) | Poltrona | 1 x 1 | não | não | 13 | entregue `9500764b` |
| 60 | `movel-lampiao` (`lampiao`) | Lampião | 0,5 x 0,5 | não | não | 13 | entregue `1899c6a3` |
| 61 | `movel-fogao` (`fogao`) | Fogão | 1 x 1 | não | não | 14 | entregue `73b696ff` |
| 62 | `movel-geladeira` (`geladeira`) | Geladeira | 1 x 0,75 | não | não | 14 | entregue `1a99468b`, versão atual `12b89b81` |
| 63 | `movel-pia` (`pia`) | Pia | 1 x 0,6 | não | não | 14 | entregue `501bf131` |
| 64 | `movel-pratos` (`pratos`) | Pratos (Prato cheio, Prato vazio ou Pilha) | 0,5 x 0,5 | não | não | 14 | entregue `ab709856` |
| 65 | `movel-privada` (`privada`) | Privada | 0,5 x 0,6 | não | não | 14 | entregue `79c73ad4` |
| 66 | `movel-fogueira` (`fogueira`) | Fogueira | 1 x 1 | não | 1 x 1,25 | 15 | entregue `2a243369` |
| 67 | `movel-fogo` (`fogo`) | Fogo | 1 x 1 | nos dois (área) | não | 15 | entregue `9c85d7c1` |
| 68 | `movel-lareira` (`lareira`) | Lareira (fogo Aceso ou Apagado) | 2 x 1 | não | não | 15 | entregue `5abd033a` |
| 69 | `movel-fornalha` (`fornalha`) | Fornalha de ferreiro (fogo Aceso ou Apagado) | 1,5 x 1,5 | não | não | 15 | entregue `32810319` |
| 70 | `movel-lapide` (`lapide`) | Lápide | 0,6 x 0,35 | não | não | 15 | entregue `b49ba046`, versão atual `977f3111` |
| 71 | `movel-bigorna` (`bigorna`) | Bigorna | 1 x 0,5 | não | não | 16 | entregue `b1fb9df0` |
| 72 | `movel-balde` (`balde`) | Balde de água | 0,5 x 0,5 (redondo) | não | não | 16 | entregue `c2f11d48` |
| 73 | `movel-troncos` (`troncos`) | Troncos (Toras ou Lenha) | Toras 2 x 1, Lenha 1,5 x 0,5 | ao longo (Toras: as toras crescem; Lenha: uma acha a mais por comprimento, o meio que repete) | não | 16 | entregue `6d69c162` |
| 74 | `movel-feno` (`feno`) | Feno (Fardos ou Monte) | Fardos 1,5 x 1, Monte 1 x 1 | não | não | 16 | entregue `a1d91d77`, versão atual `31bf2b54` |

**Esticam 12:** mesa, mesa quadrada, mesa redonda, aparador, balcão, cerca, arco do portão,
tapete, tapete longo, sofá, fogo e troncos. **Têm vista de lado 8:** cadeira, baú, armário,
aparador, fogueira, tapete, barraca e carroça (nenhum dos 6 de 29/10: `TIPOS_COM_VISTA` de
`lib/mobilia.ts:132`). A **curva da cerca** decide-se no lote 12 (forma própria ou não,
CONTRATO 10.6).

**Formas do painel** (`Prop.mobiliaForma`; no Desenhado, variantes com
`quando: { "forma": ... }`, como o tapete redondo, CONTRATO 10.2): os pratos (cheio, vazio,
pilha; `lib/mobilia.ts`, `FORMAS_DOS_PRATOS`), a lareira e a fornalha (aceso, apagado; a
chama animada é do app, não entra na imagem: `lib/mobilia/fogoDeCasa.ts`), os troncos
(toras, lenha) e o feno (fardos, monte), estes dois com a pegada própria de cada forma
(`lib/mobilia/pilhas.ts`, `CASAS_DA_FORMA_DA_PILHA`: a variante leva `vistas` próprias,
como o redondo do tapete). O mapa só grava a forma que não é a primeira; ausente = a
primeira.

Os lugares de cada móvel são os de `LUGARES_DE_MATERIAL` (até 3; a mesa de prova confere).
Onde cada classe de material aparece, para o designer saber que partes marcar:

| Classe | Móveis de antes | Os 8 móveis novos (28/10) | Os 6 de 29/10 |
|---|---|---|---|
| madeira | mesa, mesa quadrada, mesa redonda, cadeira, cama (catre), barril, caixa, baú, armário, aparador, cerca (mourões), arco do portão (e a placa), placa de seta, quadro de avisos, poço, barraca (balcão e esteios), carroça | geladeira, pia, balcão, privada, sofá, poltrona (madeira); pratos (a caneca, nogueira fixa) | lareira (o consolo), fornalha (o fole), bigorna (o toco), balde |
| metal | barril e carroça (aros), baú (ferragens), armário e aparador (puxadores), lampião, cerca (arame entre os mourões) | fogão (corpo e puxadores), geladeira (ferragens), balcão (barra de pé), privada (puxador) | bigorna, balde (aros) |
| tecido | cama (cobertor, travesseiro), tapete, tapete longo, barraca (toldo) | sofá, poltrona (estofado) | nenhum |
| pedra | fogueira (pedras), lápide, poço (pedras) | pia (pedra) | lareira, fornalha |
| palha | cadeira (assento) | nenhum | nenhum (o feno é palha fixa, sem escolha) |
| corda | cerca (corda entre os mourões) | nenhum | nenhum (a corda do feno é fixa) |
| casca | fogueira (lenha) | nenhum | troncos (a lenha: carvalho, pinho ou bétula) |

Ficam em **cor própria** (imagem `-cor`, `corFixa`): os pregos, o lençol, a franja do
tapete, os papéis do quadro, a água do poço e da pia, o vidro do lampião, a louça e a
comida dos pratos e da privada, as brasas e a chama, as frutas e os sacos da barraca e da
carroça; dos 6 de 29/10, a brasa, a cinza e a lenha da lareira, o carvão, a brasa e o couro
do fole da fornalha, a casca do toco da bigorna, a água do balde e a palha e a corda do feno
(sem lugar nenhum, como os pratos). Sem pregos em bolinha: o prego, se fica, é uma massa
pequena e calma ou some.

| Lote | Itens |
|---|---|
| 9 | `movel-mesa` · `movel-cadeira` · `movel-barril` (o piloto, para o usuário aprovar a direção) |
| 10 | `movel-mesa-quadrada` · `movel-mesa-redonda` · `movel-caixa` · `movel-bau` · `movel-armario` |
| 11 | `movel-catre` · `movel-aparador` · `movel-balcao` · `movel-quadro-de-avisos` · `movel-placa-de-seta` |
| 12 | `movel-cerca` · `movel-arco-do-portao` · `movel-poco` · `movel-carroca` · `movel-barraca` |
| 13 | `movel-tapete` · `movel-tapete-longo` · `movel-sofa` · `movel-poltrona` · `movel-lampiao` |
| 14 | `movel-fogao` · `movel-geladeira` · `movel-pia` · `movel-pratos` · `movel-privada` |
| 15 | `movel-fogueira` · `movel-fogo` · `movel-lareira` · `movel-fornalha` · `movel-lapide` |
| 16 | `movel-bigorna` · `movel-balde` · `movel-troncos` · `movel-feno` (fecha a onda 4) |

O caminho reprovado (`texturas/material-madeira/`, commit `c26dabef`) continua no repo, sem
uso (CONTRATO 10.11).

## Onda 5: penhasco e paredes (5 itens, lote 17)

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega | Estado |
|---|---|---|---|---|---|
| 75 | `penhasco` | Penhasco (Baixo, Médio, Alto) | ferramenta Penhasco; no Meio-Termo é o barranco liso (`meioTermo/barranco.ts`, tons `#aa745c`) | traço, parte face (CONTRATO 11): 5 módulos de 2 a 3,25 casas em 3 alturas, cor e relevo; a terra em 3 faixas e o pé em zigue-zague, pedrões só no Médio e no Alto. **Feito no lote 17** | entregue `63dcd020` |
| 76 | `penhasco-borda` | (lábio e faixas do relevo) | as 6 faixas do relevo (`lib/relevo.ts:138-145`) | traço, parte borda (CONTRATO 11.11): 4 linhas de 16 casas, grama, terra e neve que debruçam na beira e a espuma no pé. **Feito no lote 17** | entregue `63dcd020` |
| 77 | `parede` | Parede | ferramenta Parede: hoje traço de uma cor (`#d8d2c4` ou a cor do mestre) | material de parede vista de cima, tingível pela cor do mestre, repetível ao longo do traço. **Feito no lote 17** (CONTRATO 11.15: 3 alvenarias pela espessura, contorno do app em dois passes) | entregue `fd47add0` |
| 78 | `janela` | Janela | na parede (hoje traço duplo) | trecho de janela no traço. **Feito no lote 17** (módulo de 1 casa repetido: vidro claro no meio da espessura, peitoril e ombreiras) | entregue `71e4aac0` |
| 79 | `grade-de-prisao` | Grade de prisão | na parede (só Meio-Termo) | trecho de grade no traço. **Feito no lote 17** (módulo de 1 casa: trilho e 3 barras redondas por casa, ferro escuro da rampa) | entregue `912477ce` |

## Onda 5b: as portas (3 itens, lote 18)

Pedido do usuário em 29/10/2026 ("Desenhar as portas"): a parede do Desenhado é grossa (fina 12,
média 20, grossa 32 px) e a porta ainda era o retângulo fino do Atual por cima. As 3 formas são as
`DoorKind` do app (`pixi/drawDoors.ts`, vão de 32, 64 e 96 px pela `DOOR_LENGTH_BY_KIND`); cada uma
tem 4 módulos de 1 casa, um por estado (CONTRATO 11.16).

| # | id | Nome que o mestre vê | Onde aparece | O que o Desenhado entrega | Estado |
|---|---|---|---|---|---|
| 80 | `porta` | Porta | na parede, `door.kind` normal (hoje a barra creme `#d9d2c0` de 4 px de tela, a vermelha `#e2645a` trancada) | trecho de porta no traço: o vão (ombreiras e soleira), a folha fechada, o batente da aberta e os 3 traços da secreta, nas 3 alturas. **Feito no lote 18** | entregue no lote 18 |
| 81 | `porta-dupla` | Porta dupla | idem, `door.kind` double | as duas folhas que se encontram no meio (a junta é o contorno das duas). **Feito no lote 18** | entregue no lote 18 |
| 82 | `porta-portao` | Portão | idem, `door.kind` gate | o quadro vazado com uma travessa larga a cada 18 px (a travessa repete, os mourões das pontas ficam). **Feito no lote 18** | entregue no lote 18 |

## Fontes no código (para conferir)

- Texturas de chão: `client/src/texturas/embutidas.ts:1084-1103` (lista), `catalogo.ts`, `ladrilhos.ts:12` (256 px padrão).
- Onde o mestre escolhe e onde fica no mapa: `components/TexturasControls.tsx:267`; `MapData.texturas` (`types/map.ts:2345`).
- Caminho e chão de sala: `stores/mapStore.ts:1917`; `pixi/drawFloor.ts:65`; `pixi/drawRegions.ts:331`.
- Telhados: `texturas/telhado.ts`, `lib/telhado/paletas.ts:34-66`, `texturas/meioTermo/chamine.ts`, `meioTermo/cumeeiraAmarrada.ts`.
- Carimbos: `carimbos/embutidos.ts:553-561`, `carimbos/catalogo.ts:27`.
- Móveis: `lib/mobilia/tipos.ts:18`, `lib/mobilia.ts:57,104,132` (os nomes, as pegadas e `TIPOS_COM_VISTA`), `lib/mobilia/pecasNovas.ts:59-100`, `lib/mobilia/pilhas.ts` e `lib/mobilia/fogoDeCasa.ts` (as formas dos troncos, do feno e do fogo de casa), `texturas/meioTermo/moveis/` (a tabela `TEXTURA` em `motor.ts:450`).
- Materiais dos móveis: `texturas/meioTermo/materiais.ts:92-121` (os 24) e `:146-195` (`LUGARES_DE_MATERIAL`).
- Penhasco e paredes: `lib/relevo.ts:138-195`, `texturas/meioTermo/barranco.ts`, `pixi/drawWalls.ts:58,332`.
- Mapa real usado nas contas (só leitura, fora do repo): um mapa do usuário de 200 x 200 casas, 228 passos de textura.
