# Contrato do chão Desenhado (v1)

O que cada textura de chão entrega, como o app vai montar o chão a partir disso, por que
isso não se repete e quanto pode pesar. A implementação de referência da montagem é
`comum/compor.gdshader`: a mesa de prova monta a folha com ela, a partir dos arquivos
exportados. Quando o app integrar o Desenhado, ele faz a mesma conta; se fizer igual, o
que a folha mostra é o que o mestre vê.

As seções 1 a 6 valem para a **onda 1** (chão e caminhos). A **onda 2** (telhado, faixa e
objeto) está na seção 8, de 28/10/2026; a **onda 3** (carimbo e trecho), na seção 9; a
**onda 4** (os móveis desenhados à mão que pegam cor; o caminho "só materiais" foi
reprovado no mesmo dia), na seção 10, de 29/10/2026. O traço ainda não tem contrato
(seção 7).

## 1. A decisão contra repetição, em 5 linhas

1. **Base calma** de 8 x 8 casas (512 px, 64 px por casa), sem nenhum marco que o olho reconheça.
2. **3 variantes** da mesma base (2 em material com estrutura), misturadas pelo `ruidoDoMundo` do app numa escala longa: sem período.
3. **Tom do mundo**: o chão inteiro clareia e escurece devagar (outro `ruidoDoMundo`, amplitude até 0,06).
4. **Detalhes num atlas** (até 16 de 1 casa, ou 4 de 2 casas, a 128 px por casa), espalhados pelo mundo com o `hash` do app numa grade de meia célula, com moitas e clareiras (e, se a textura pedir, afastados para dois não caírem um em cima do outro).
5. A folha prova: 40 x 40 casas a 50% e 100% (no chão de um mapa real) e o número de repetição.

### O que mudou em relação à direção sugerida, e por quê

- **Espalhar com `hash()` no mundo, não com `espalhar.ts`.** O `espalhar.ts` do app joga
  dardos num ladrilho que é um toro: os pontos repetem com o ladrilho. Para o Desenhado o
  detalhe tem de cair sem período nenhum, então a conta usa o `hash(ix, iy, semente)` de
  `texturas/ruido.ts` por célula do mundo. O `espalhar.ts` avisa que uma grade de um ponto
  por célula "se lê como fileira"; aqui a célula é meia casa, o ponto cai em qualquer
  lugar dela, no máximo 85% das células têm detalhe e a densidade é puxada pelo ruído do
  mundo, o que desmancha a fileira (a folha piloto confirma).
- **O detalhe saiu da base.** A mistura de variantes só esconde a repetição se a base não
  tiver marco: misturar duas bases com tufo daria tufo pela metade (fantasma). Por isso tufo,
  flor e pedra moram no atlas.
- **Duas resoluções.** A base fica a 64 px por casa (é calma; a 300% ela só amolece). O
  atlas fica a 128 px por casa, porque leva o contorno e tem de aguentar 300%.
- **Células de 2 casas** (`celulaCasas: 2`) para copa, poça e outras formas grandes, que
  não cabem numa casa.
- **Material com estrutura** (lajota, tábua, calçamento, convés): a geometria (juntas,
  tábuas) é **a mesma nas variantes**; só a superfície (tom de cada peça, mancha, desgaste)
  muda. Senão a mistura mostra duas grades de juntas sobrepostas.

## 2. Arquivos por textura

Pasta `exportado/<id>/` (gerada pelo `scripts/exportar_uma.gd`, nunca à mão):

| Arquivo | Tamanho | Conteúdo |
|---|---|---|
| `base-1.png`, `base-2.png`, `base-3.png` | 512 x 512 px, RGB | as variantes da base; 8 x 8 casas a 64 px por casa; repetem sem emenda nos dois sentidos (com `periodoCasas: 16`: 1024 x 1024 e 1 variante só) |
| `detalhes.png` | 512 x 512 px, RGBA, alfa reto | o atlas: 4 x 4 células de 128 px (1 casa) ou 2 x 2 de 256 px (2 casas); a cor dos pixels transparentes já vem estendida da borda (sem franja no filtro) |
| `textura.json` | | todos os parâmetros que o app lê, explícitos (seção 3) |

Pasta `texturas/<id>/` (do designer): `textura.gdshader` e `config.json`.

## 3. Parâmetros (`textura.json`)

```
contrato      1
id, nome      o id do Desenhado e o nome que o mestre vê
idDoApp       o id do catálogo do app que esta textura cobre (null se o app não tem)
casaPx        64 (px de imagem por casa na base; o app escala para o grid do mapa)
base          { arquivos: [...], ladoPx: 512, periodoCasas: 8 }
mistura       { semente, escala, faixa, corte }
tom           { semente, escala, amplitude }
detalhes      { arquivo, ladoPx: 512, colunas, linhas, pxPorCasa: 128, celulaCasas,
                gradeDoMundoPx, semente, quantos, pesos[], densidade, agrupamento,
                escalaMin, escalaMax, variacaoDeTom, e os opcionais da seção 4:
                afastarCasas, passoCasas, grupos { gradeCasas, chance, raioMin,
                raioMax }, espelhar }
corMedia      "#rrggbb" da base-1 (miniatura, zoom muito pequeno, estilo Simples)
memoria       { gpuBytes, discoBytes, tetoGpuBytes, tetoDiscoBytes }
emendas       a medida de emenda de cada base (1 = a borda igual ao miolo)
```

As sementes saem da `semente` do `config.json` (mistura = s·101 + 11, tom = s·101 + 37,
detalhes = s·101 + 73) e vão escritas por extenso no `textura.json`: o app não deriva nada.

## 4. A montagem (o app faz exatamente isto)

`x, y` em px do mundo, 64 px por casa. `ruidoDoMundo` e `hash` são as funções do app
(`texturas/meioTermo/ruidoDoMundo.ts`, `texturas/ruido.ts`), portadas para o Godot em
`comum/mundo.gdshaderinc`.

```
b1, b2, b3 = base-1..3 em (x mod 512, y mod 512)
n = ruidoDoMundo(x / mistura.escala, y / mistura.escala, mistura.semente)
2 variantes: cor = mix(b1, b2, smoothstep(-faixa, faixa, n))
3 variantes: w1 = 1 - smoothstep(-corte - faixa, -corte + faixa, n)
             w3 = smoothstep(corte - faixa, corte + faixa, n)
             cor = b1·w1 + b3·w3 + b2·(1 - w1 - w3)
cor *= 1 + tom.amplitude · ruidoDoMundo(x / tom.escala, y / tom.escala, tom.semente)

detalhes (c = celulaCasas, passo = 32·c px):
  para cada célula (gx, gy) = floor(x / passo), floor(y / passo), em ordem de gy e depois gx:
    r(k) = hash(gx, gy, detalhes.semente + k)
    a = ruidoDoMundo((gx + 0,5)·passo, (gy + 0,5)·passo, detalhes.semente + 50)
    p = clamp(densidade · c² / 4 · (1 + agrupamento · 2 · a), 0, 0,85)
    se r(0) < p:
      centro = ((gx + r(1))·passo, (gy + r(2))·passo)
      i      = o detalhe sorteado por r(3) com os pesos
      escala = mix(escalaMin, escalaMax, r(4))
      tom    = 1 + variacaoDeTom · (2·r(5) - 1)
      desenha a célula i do atlas centrada no centro, com 64·c·escala px de lado,
      cor multiplicada por tom, por cima do que já está (alfa reto)
```

O app pode assar isto em pedaços (como o `chaoNoMundo.ts` já faz com pedaços de 256 px) em
vez de calcular por pixel na placa; o resultado tem de ser o mesmo. As duas contas
concordam até ~1e-6 (o app conta em double, o Godot em float).

### Afastamento (opcional: `detalhes.afastarCasas`)

O sorteio acima pode pôr dois detalhes quase um em cima do outro (dois centros a poucos px):
em copa de árvore isso lê como uma árvore só, deformada. Com `afastarCasas` no
`textura.json`, as células, o detalhe, a escala e o tom são os mesmos; só o centro anda,
em 2 rodadas. Sem o campo, nada muda: a conta é a de cima, byte a byte (provado em 28/10
nas 4 texturas do lote 1 sem o campo: exportação e folha idênticas).

```
dmin = afastarCasas · 64 px        (0 < afastarCasas <= um passo da grade, em casas:
                                    c / 2, ou passoCasas quando ele existe)
c0(g) = o centro de cima, só nas células que têm detalhe (r(0) < p)
vizinhas de g = as 8 células em volta que também têm detalhe
empurrão(a, b, g, h): v = a - b, d = |v|
    se d >= dmin: 0
    direção = v / d, ou normalize(g - h) se d < 0,001 (centros iguais)
    devolve direção · (dmin - d) / 2           (cada um anda a metade do que falta)
limite(v) = v encurtado para no máximo dmin / 2
rodada 1: c1(g) = c0(g) + limite(soma dos empurrão(c0(g), c0(h), g, h))
rodada 2: c2(g) = c0(g) + limite(c1(g) - c0(g) + soma dos empurrão(c1(g), c1(h), g, h))
desenha em c2(g), na mesma ordem (gy e depois gx)
```

O deslocamento total fica em dmin / 2 no máximo, e com escala até 1,5 o detalhe deslocado
ainda cabe nas 5 x 5 células em volta do pixel. A referência é `com_detalhes_afastados()` em
`comum/compor.gdshader`. **O app precisa da mesma conta na integração**, com as mesmas 2
rodadas, as mesmas 8 vizinhas e o mesmo limite: senão as copas caem em outro lugar.
Assando em pedaços fica barato (cada centro é calculado uma vez por pedaço).

Medida na floresta (simulação com o hash e o ruído do app, 6.400 células): sem
afastamento, 26% das copas têm uma vizinha a menos de 0,4 da soma dos dois raios
(quase em cima); com `afastarCasas` 0,875, sobra 0,1%, com o mesmo número de copas (0,59
por casa) e as mesmas moitas e clareiras. A cobertura sobe de 0,69 para 0,72, porque as
copas param de se esconder umas atrás das outras.

Por que não uma grade sacudida (um ponto por célula de passo próprio, com folga): na mesma
simulação, com a mesma quantidade de copas a folga fica pequena e a grade lê como
fileira; com folga para desmanchar a fileira, a mata fica 13 a 22% mais rala.

### Passo, grupos e espelho (opcionais: `detalhes.passoCasas`, `detalhes.grupos`, `detalhes.espelhar`)

Nasceram com o Bosque (lote 2, 28/10): árvore grande e solta, em bosquete redondo, não cabe
na grade de meia célula (1 ponto por casa com `celulaCasas: 2`, então a copa de 2 casas cai
em cima da vizinha), e o ruído do mundo só dá grupo em fileira curva ou em continente. Os
três são independentes e cada um só muda a conta quando está no `textura.json`. Sem eles,
a saída é byte a byte a de antes: provado em 28/10 nas 7 texturas aprovadas (grama,
grama-amarela, terra, caminho, floresta, chao-de-floresta e areia), exportação (base-1..3,
detalhes.png, textura.json) e folha (area50, area100, perto300, resumo.json) idênticas,
antes e depois da troca e contra o `exportado/` commitado.

```
passoCasas (c/2 < passoCasas <= 4):
    passo = 64 · passoCasas px                 (no lugar de 32·c)
    p = clamp(densidade · passoCasas² · (1 + agrupamento · 2 · a), 0, 0,85)
    densidade · passoCasas² <= 0,85; afastarCasas <= passoCasas;
    escalaMax <= min(2, 3 · passoCasas / c)    (o laço de 5 x 5 células ainda alcança)
    o resto (r(k), centro, i, escala, tom, afastamento) é o de cima, com este passo

grupos { gradeCasas (4 a 32), chance (0 a 1), raioMin, raioMax (0,1 a 0,5; min <= max) }:
    G = gradeCasas · 64 px; cc = centro da célula de detalhe ((gx + 0,5)·passo, ...)
    m = 0
    para cada b nas 3 x 3 células da grade G em volta de floor(cc / G):
        se hash(b.x, b.y, detalhes.semente + 60) < chance:
            o = (b + 0,2 + 0,6 · (hash(b.x, b.y, semente + 61), hash(b.x, b.y, semente + 62))) · G
            r = mix(raioMin, raioMax, hash(b.x, b.y, semente + 63)) · G
            m = max(m, 1 - smoothstep(0,55 · r, r, |cc - o|))
    a = 2 · m - 1                              (no lugar do ruidoDoMundo da linha de a)

espelhar (true):
    q = a posição do pixel na célula do atlas, (pixel - centro) / escala
    se hash(gx, gy, detalhes.semente + 6) < 0,5: q = (q.y, q.x)   (espelho na diagonal)
```

O espelho é na diagonal de propósito: a luz vem de cima à esquerda, na diagonal, e a sombra
do atlas anda na mesma diagonal, então a peça espelhada continua com a luz certa. Assim 4
peças viram 8 formas. A referência é `aglomerado_em()` e `espelhado()` em
`comum/compor.gdshader`. **O app precisa da mesma conta na integração** (o passo, o
aglomerado dos grupos e o espelho), senão as árvores caem em outro lugar e com outra forma.

Medida no Bosque (simulação com o hash e o ruído do app, semente 31, passoCasas 1,8 e
afastarCasas 1,8): 0,09 copa por casa, cobertura 0,27, 46% do chão a mais de 1 casa de
uma copa, e 1% das copas com vizinha a menos de 0,6 da soma dos raios (5% abaixo de 0,7:
copas que se encostam dentro do bosquete, sem uma cobrir a outra).

## 5. Teto de memória

A otimização 0.5.3 baixou a memória de textura do mapa real de 481 para 204 MB (commit
`a47e0ac9`, medida pelo `client/desempenho/mapa-grande.spec.ts`, caso
`real-mt-1440-dpr15`; o portão é `docs/desempenho/limites.json`: 200 MB). O Desenhado não
pode desfazer isso:

| Onde | Teto | Piloto `grama` |
|---|---|---|
| Placa de vídeo, a mais que o Atual | **0 MB** na medida do mesmo caso (tolerância 2 MB). Os pedaços do chão continuam no mesmo cache de 64 MB (`pixi/pedacosDoChao.ts`); o ladrilho de espera do `TilingSprite` é a base-1 reduzida a 256 px (0,25 MiB, o mesmo da maioria das texturas de hoje). | não integrado |
| Memória comum (base, variantes e atlas decodificados, para pintar os pedaços) | **6 MiB por textura** (RGBA + mipmaps), **48 MiB por mapa** | 5,33 MiB |
| Disco (PNGs de `exportado/<id>/`) | **1,5 MiB por textura** | 0,70 MiB |

O exportador recusa (sai com 1) a textura que passa do teto por textura. O teto por mapa
é do app, na integração.

## 6. Critério de pronto de uma textura

1. `exportar_uma.gd --textura=<id> --folha` sai com 0 (shader compila, config válido, tetos ok).
2. Emenda de cada base entre 0,8 e 1,25. Exceção: material cuja borda do ladrilho cai de
   propósito numa junta (lajota, tábua); diga isso na entrega.
3. Repetição "completo" da folha **>= 0,80** (só a base-1 dá 0: cópia exata; o piloto dá
   0,87). Abaixo disso a base tem marco demais ou as variantes são parecidas demais.
4. Olho na folha, nos três zooms (ESTILO.md seção 5): sem repetição visível na área
   de 40 x 40, sem pontilhado a 50%, sem serrilhado a 300%.

## 7. O que ainda não tem contrato

- ~~**Telhados (onda 2)**~~: escrito em 28/10, seção 8.
- ~~**Sprites da onda 3**~~: escrito em 28/10, seção 9 (carimbo e trecho; o vaso, a
  jardineira e a sebe entram aqui).
- ~~**Móveis (onda 4)**~~: decidido em 29/10 ("Desenho à mão que pega cor", depois de o
  "Materiais primeiros" ser reprovado): cada móvel desenhado em cinza com as partes
  marcadas; escrito na seção 10. O vaso continua carimbo de destino `movel` (9.6).
- **Traço (onda 5)**: penhasco e parede repetíveis ao longo de um traço.
- **Entrega ao app**: o pacote de animações de hoje só aceita `.js` de até 2 MiB
  (`desktop/src-tauri/src/net/animacoes.rs`); PNG precisa de outro canal ou de ir junto do
  app. Decisão da fase de integração.

## 8. Telhados, faixa e objeto (onda 2, 28/10/2026)

Como o app pinta telhado hoje (`client/src/texturas/telhado.ts`, `lib/telhado/aguas.ts`):
cada sala tem um polígono; `aguas.ts` acha, para cada ponto, a **água** dona (a borda mais
perto), a **altura** desde a ponta do beiral e a posição **ao longo** da borda; a imagem
do telhado é pintada **uma vez por sala** na CPU, a 1 px por px do mapa (até 1024 x 1024
px, `escalaDaTexturaDoTelhado`), e é ela que some quando o pino entra. A cor do mestre é o
tom da água em luz neutra (`lib/telhado/paletas.ts`: Telhas, Madeira, Palha, 6 cores cada
mais cor livre). O Desenhado troca só o desenho dentro dessa imagem: o resto (águas,
sombra no chão, sumir ao entrar, cache por sala, modelo e cor) continua igual.

### 8.1 A decisão em 6 linhas

1. **O material de uma água, não o telhado.** Cada telhado entrega uma base quadrada (P x P
   px, 64 px por casa) no espaço da água: x = u ao longo do beiral, y sobe da ponta do
   beiral (a linha de baixo da imagem) para a cumeeira. Repete nos dois sentidos.
2. **O app gira e recorta pela conta que já tem:** u = `aoLongo + regua[agua]` e v =
   `altura` (a de `aguaNoPonto`, 0 na ponta do beiral), e lê a base em (u mod P, P - v mod
   P). As fileiras ficam paralelas ao beiral em toda água, de qualquer forma de sala.
3. **Tingível pela conta do chão de sala** (PROPOSTA-TINGIR.md): a base é valor em cinza,
   0,5 = a cor do mestre; a luz da água, a ponta do beiral e o rincão entram no MESMO valor,
   e a rampa OKLab da cor troca o valor pela cor no fim.
4. **A luz lateral vem num canal próprio** (G = lado): a capa da telha acende o lado virado
   para a luz em cada água, sem pintar a luz na imagem (que ficaria errada nas águas giradas).
5. **Cumeeira e espigão levam uma faixa** (a peça de cumeeira, repetível ao longo da
   emenda); o rincão é só a sombra do app. A cumeeira amarrada da palha é uma faixa avulsa.
6. **A chaminé é um objeto** visto de cima, com a sombra pintada, não tingido, posto onde o
   app já põe (`posicaoDaChamine`). Sem período, sem repetição: uma imagem.

### 8.2 Arquivos por tipo

O `config.json` ganha `"tipo"`: `"telhado"`, `"faixa"` ou `"objeto"` (o chão não leva o
campo e segue as seções 1 a 6 sem mudança nenhuma; conferido em 28/10: as 18 texturas
aprovadas reexportadas saíram byte a byte iguais).

| Tipo | Arquivo | Tamanho | Conteúdo |
|---|---|---|---|
| telhado | `base-1.png` .. `base-N.png` (N = 1 a 3) | P x P px, P = 256 ou 512 (`periodoCasas` 4 ou 8), 64 px por casa | RGB: **R = valor** (0,5 = a cor do mestre), **G = 0,5 + 0,5 · lado** (inclinação ao longo do beiral, +1 = virada para +u), B = 0. Mesma geometria nas variantes (fileiras e colunas), outra superfície |
| telhado (opcional), faixa | `faixa.png` | (2 · comprimentoPx) x (4 · meiaLarguraPx) px, 128 px por casa | RGBA: R = valor, G = 0,5 + 0,5 · lado ATRAVESSANDO a emenda, A = alfa reto; x ao longo (repete a cada comprimentoPx), y de -meia (linha 0) a +meia |
| objeto | `objeto.png` | ladoPx x ladoPx, 128 px por casa | RGBA, cor reta e alfa reto, com a sombra; NÃO é tingido |
| todos | `textura.json` | | os parâmetros abaixo, explícitos |

Shaders: `comum/telhado.gdshaderinc` (o cabeçalho; explica as funções),
`comum/rodape_telhado.gdshaderinc` (telhado e faixa) e `comum/rodape_objeto.gdshaderinc`.

### 8.3 Parâmetros (`textura.json` do telhado)

```
contrato 1, tipo "telhado", id, nome, idDoApp ("telhas" | "madeira" | "palha": o modelo do app)
casaPx     64
base       { arquivos, ladoPx: P, periodoCasas, canais, orientacao }
mistura    { semente, escala, faixa, corte }   a mistura das variantes no MUNDO (x, y), seção 4
tom        { semente, escala, amplitude }      o tom do mundo, seção 4 (amplitude até 0,06)
tingir     { conta: "luz-oklab", neutro 0,5, ganhoL 0,48, escuroAte 0,10, claroDesde 0,94 }
luz        { agua: 0,18, lado: 0,12 }          em valor (0,1 de valor = 0,048 de luz OKLab)
beiral     { escuro: 0,22, alturaPx: 2,2, franjaPx: 0, franjaPassoPx: 4,6 }
rincao     { escuro: 0,10, larguraPx: 1,7 }
faixa      { arquivo: "faixa.png", pxPorCasa 128, comprimentoPx, meiaLarguraPx,
             onde: ["cumeeira", "espigao"], ... } | { de: "<id de uma faixa>" } | null
valorMedio a média de R na base-1 (o exportador avisa fora de 0,5 ± 0,03)
memoria, emendas
```

A faixa avulsa (`tipo: "faixa"`) leva `modelo` (o telhado em que vai), `faixa`, `tingir` e
`luz.lado`. O objeto leva `objeto { arquivo, pxPorCasa 128, ladoPx, corpoPx, ancoraPx }`:
`corpoPx` é o lado do corpo na imagem e `ancoraPx` o centro dele.

### 8.4 A montagem (o app faz exatamente isto)

A referência é `ferramentas/telhado.ts` (`campoDoTelhado`, `rampaDaCor`, `tingirCampo`,
`porObjeto`): TypeScript que importa as águas, a chaminé e o ruído do PRÓPRIO app. Para
cada pixel (x, y) da imagem do telhado (a mesma caixa e a mesma varredura de linha de
`comecarTelhado`, 1 px por px do mapa):

```
amostrarAgua(geo, x, y, dentro, BEIRAL_PX + 0,5) -> a (água), dist, aoLongo, b (vizinha), ate, rincao
v = dist + BEIRAL_PX                  (0 na ponta do beiral)
u = aoLongo + regua[a]                (bordas alinhadas dividem a régua)
luzDaAgua[a]  = -(n_a · LUZ)          LUZ = (-1, -0,45) normalizado, a luz do app
luzAoLongo[a] =  (d_a · LUZ)
valor(a, u, v):
    (vi, li) = base-i em (u mod P, P - (v mod P)), bilinear, repete; li = 2·G - 1
    w = os pesos das variantes por ruidoDoMundo(x / mistura.escala, y / mistura.escala, mistura.semente) (seção 4)
    V = soma(w·vi) · (1 + tom.amplitude · ruidoDoMundo(x / tom.escala, y / tom.escala, tom.semente))
    devolve V + luz.lado · soma(w·li) · luzAoLongo[a] + luz.agua · luzDaAgua[a]
G = valor(a, u, v)
se b >= 0 e ate < 0,5:  G = G·(0,5 + ate) + valor(b, t[b] + regua[b], s[b] + BEIRAL_PX)·(0,5 - ate)
se rincao:              G -= rincao.escuro · (1 - suave(0,4; rincao.larguraPx; ate))
vb = v - franja(u)      (franja = 0 sem beiral.franjaPx; senão a fórmula da palha do app)
se vb < alturaPx:       G -= beiral.escuro · (1 - suave(0; alturaPx; vb))
faixa (b >= 0, não rincão, ate < meiaLarguraPx, e o tipo da emenda em faixa.onde;
       cumeeira = ehCumeeira(geo, a, b), o resto é espigão):
    s = posicaoAoLongoDoCume(geo, a, b, x, y);  c = +ate na água de índice menor, -ate na outra
    (gf, lf, af) = faixa.png em (s mod comprimentoPx, c + meia) · 2 px por px do mapa
    luzAtravessada = normalize(n_maior - n_menor) · LUZ
    G += (gf + luz.lado · lf · luzAtravessada - G) · af
cor = rampa[cor do mestre][arredonda(G · 255)]       (PROPOSTA-TINGIR.md; uma rampa por cor)
alfa = clamp(vb + 0,5; 0; 1)
```

Depois, com a chaminé ligada, `porObjeto` põe o `objeto.png` por cima, centro do corpo em
`posicaoDaChamine(geo)`, escalado para o corpo ter o `lado` que ela dá (11 a 20 px do mapa):
1 px do mapa = `corpoPx / lado` px da imagem, bilinear, "por cima" com alfa reto.

O custo é o de hoje (uma pintura por sala e por troca de modelo ou cor, guardada no mesmo
cache); a conta por pixel troca o desenho procedural por 2 ou 3 leituras bilineares e 2
ruídos do mundo, mais a faixa perto das emendas. Pintar em fatias (a palha já faz) dá os
mesmos bytes. A rampa é uma tabela de 256 cores por cor.

### 8.5 Tingir

A conta é a da PROPOSTA-TINGIR.md, sem mudar nada, com G no lugar de g. O que muda é a
faixa de G: o chão usa de 0,43 a 0,59; o telhado usa mais (a sombra da fileira, a luz da
água, a ponta do beiral), e com `ganhoL` 0,48 G de 0,2 a 0,8 dá luz de -0,14 a +0,14. A
média do telhado fica a menos de 0,004 da cor escolhida nas 3 cores da folha do piloto
(o Atual fica a 0,010 a 0,015). A palha de hoje clareia para o neutro (`pincel.neutro`);
a rampa OKLab segura o croma enquanto sobe a luz, o que deve dar um efeito parecido (não
conferido: o designer da palha olha na folha).

### 8.6 Cumeeira, espigão e rincão

- **Cumeeira** (águas opostas) e **espigão** (águas vizinhas, quina de fora): a faixa da
  textura, se ela tiver e se `faixa.onde` pedir. Sem faixa: só a mistura de área das duas
  águas na emenda (sem serrilha).
- **Rincão** (quina de dentro): a sombra do app (`rincao.escuro`, `rincao.larguraPx`),
  nunca faixa (é um vale, não uma peça por cima).
- **Palha**: a faixa vem da `cumeeira-amarrada` (`"faixa": { "de": "cumeeira-amarrada" }`),
  só na cumeeira, como hoje. Telhas: a faixa é a do próprio telhado (telha de cumeeira).
- Onde três emendas se encontram (cumeeira e dois espigões), cada pixel fica com a emenda
  mais perto: as faixas se encontram em meia-esquadria, sem sobrepor.

### 8.7 Objeto e faixa repetível

- **Objeto** (a chaminé): uma imagem, sem período nem variante. A luz não gira (a
  chaminé fica sempre de pé na tela), por isso a sombra pode vir pintada. Não é tingido.
- **Faixa repetível** (a cumeeira amarrada, a telha de cumeeira): período só ao longo
  (`comprimentoPx`), tingida pela cor do telhado em que está, com o lado atravessando.
  Período de 16 a 512 px do mapa; meia largura de 2 a 12 px.

### 8.8 Teto de memória

O telhado montado ocupa na placa de vídeo o mesmo que hoje: a mesma imagem por sala, do
mesmo tamanho (até 1024 x 1024), no mesmo cache. **A mais que o Atual: 0 MB.** Os arquivos
lidos para pintar ficam na memória comum: o mesmo teto do chão, **6 MiB por item** (RGBA +
mipmaps, conta conservadora) e **1,5 MiB em disco**; o piloto `telhado-telhas` dá 2,71 MiB e
0,32 MiB. Por mapa: no máximo 3 telhados, 1 faixa e 1 objeto, uns 9 MiB com bases de 512
px; entram na conta dos 48 MiB por mapa junto com os chãos (a conta por mapa é do app, na
integração).

### 8.9 Critério de pronto de um telhado

1. `exportar_uma.gd --textura=<id> --folha` sai com 0; valor médio da base-1 em 0,5 ± 0,03.
2. Emenda de cada base entre 0,8 e 1,25 (a borda da base é uma borda de fileira e de coluna:
   o número sobe; explique se passar).
3. A repetição "completo" do chão não vale (material com estrutura, a mesma decisão do
   orquestrador para os pisos de 28/10). Vale o olho na folha: o telhado grande (28 x 8
   casas) a 50% sem repetição reconhecível, as 3 cores sem estourar nem sumir, nada de
   escama, bolinha nem "wwww" a 25% e a 50%, sem serrilha a 300%.
4. A média de cada cor a menos de 0,01 de luz OKLab da cor escolhida (está na folha).

### 8.10 A mesa de prova dos telhados

`--folha` num item da onda 2 monta outra mesa (`comum/mesa_telhado.gd` arruma, o
`ferramentas/telhado.ts` monta): a cena A (18 x 10 casas: a casa retangular de 7 x 5 e a
casa em L de 7 x 8, com cumeeira, espigão e rincão) em 3 cores (a padrão do modelo e duas
da paleta do app, uma escura) a 100%, 50% e 25%, o close a 300% no encontro do rincão com
as duas cumeeiras do L, o telhado grande (28 x 8 casas) a 50% e os arquivos (valor e lado
em cinza). O Atual é o `pintarTelhado` de hoje nas mesmas casas, com a chaminé quando o
item é objeto e a cumeeira amarrada quando o modelo é palha. Chão chapado e a sombra do
app (6, 8 px, 25%). Faixa e objeto saem por cima do telhado `sob` do config (padrão:
`telhado-palha` e `telhado-telhas`), ou de um telhado liso quando ele ainda não existe.
Folha do lote: `scripts/folha_do_lote_telhados.gd` (PARA-OS-DESIGNERS.md).

## 9. Carimbos e trechos (onda 3, 28/10/2026)

Como o app pinta carimbo hoje (`client/src/carimbos/`, `lib/carimbos.ts`,
`pixi/drawCarimbos.ts`): cada embutido é um desenho em Canvas 2D `(g, giro, semente)` num
quadro "em pé" (o pé na origem, o tronco embaixo), assado em 256 texels em 8 variantes
(`varianteDoGiro = round(giro / 45) mod 8`); o sprite nunca gira na tela, então a luz não
gira. A sombra é a silhueta cisalhada (`matrizDaSombra`, direção 7, 11), cor `[10, 28, 40]`,
alfa 0,28 numa camada só. O tamanho no mundo é `tamanhoNatural = max(tamanho x unidade,
0,8 casa) x escolha` (escolha de 40% a 250%), com `unidade = max(L, A) x grid / 1242`. A
sebe e a jardineira são móveis do Meio-Termo (`texturas/meioTermo/moveis/`); a sebe curva
por `Prop.mobiliaCurva` (até ±180 graus, arco de `geometriaDaCerca`).

### 9.1 A decisão em 6 linhas

1. **Carimbo = 1 a 4 sprites RGBA com alfa**, cor reta, sem sombra, vistos de cima ou em pé
   (o tronco embaixo, como os de hoje: `espelho: "nenhum"`), com o pé (Carimbo.x, y) em
   `ancoraPx`. O tamanho é o de hoje: 1 unidade = `Carimbo.tamanho`.
2. **A imagem nunca gira.** O giro do mestre escolhe a forma: k = `varianteDoGiro(giro)`,
   arquivo = k mod N, espelho na diagonal (a imagem transposta, o meio dela fixo) quando
   floor(k / N) é ímpar. LUZ está na diagonal: o espelho não muda a luz. Até 8 formas com 4
   arquivos. Com `espelho: "nenhum"` (28/10, a árvore: transposto, o desenho em pé deitaria)
   nunca espelha: arquivo = k mod N, até 4 formas.
3. **A sombra é do app**, pela silhueta: `deslocada` = andada `deslocamento x tamanho` na
   direção (7, 11); `em-pe` (só carimbo, 28/10) = deitada no chão a partir do pé, como
   `matrizDaSombra('em-pe')` de hoje (o alto cai `comprimento` x altura na direção, 0,78);
   desfocada `borrao x tamanho`, numa camada só, `#0a1c28` a 0,25. `nenhuma` = do chão.
4. **Âncora no pé de hoje:** `ancoraPx = meio da imagem - centroDoAtual x unidadePx`; a
   copa fica onde a copa de hoje fica e o objeto não anda quando o mapa troca de estilo.
5. **Sebe e jardineira = trecho**: um período de L px ao longo, com a ponta do começo, em
   cor (sem luz) e relevo (para onde inclina). O app deita o trecho na reta ou no arco e
   acende pela LUZ depois (9.5); a ponta do fim é a do começo espelhada.
6. **Teto:** na placa, até o que o Atual pesa hoje (8 x 256² RGBA com mipmap = 2,67 MiB por
   carimbo); em disco, 1,5 MiB por item. O vaso é carimbo de destino `movel`.

### 9.2 Arquivos e config por tipo

| Tipo | `config.json` | Arquivos em `exportado/<id>/` |
|---|---|---|
| `carimbo` | `destino` (`carimbo` = ferramenta Carimbos; `movel` = ferramenta Objetos), `tamanhoDoApp` (o `tamanho` de `embutidos.ts` ou do `.json` do pacote; obrigatório no destino carimbo), `variacoes` 1 a 4, `sprite.ladoPx` 32 a 512, `sprite.unidadePx` 16 a 512 (px da imagem numa unidade), `sprite.ancoraPx`, `espelho` (`diagonal`, o padrão, ou `nenhum`: o desenho em pé), `sombra` | `carimbo-1.png` .. `carimbo-N.png` (ladoPx²), `textura.json` |
| `trecho` | `curva` (a sebe: true; a jardineira: false), `casas` (o tamanho padrão do móvel), `trecho.comprimentoPx` 16 a 256 (L), `trecho.meiaLarguraPx` 4 a 48, `trecho.pontaPx` 0 a 64, `luz.forca` 0 a 1, `sombra` | `trecho.png`, `trecho-relevo.png` ((ponta + L) x 2 por 4 x meia, 128 px por casa), `textura.json` |

`sombra`: `jeito` (`deslocada` ou `nenhuma`; no carimbo, também `em-pe`), `deslocamento` 0 a
0,5 e `borrao` 0 a 0,2, os dois em unidades do tamanho (no trecho, da largura 2 x meia); no
`em-pe`, `comprimento` 0,2 a 1,2 (o padrão é 0,78, o de hoje) no lugar do deslocamento.
Sem `espelho` e sem `em-pe` o `textura.json` sai igual, byte a byte, ao de antes de 28/10.
Shader: `comum/carimbo.gdshaderinc` (as assinaturas e as unidades de q) e
`comum/rodape_carimbo.gdshaderinc`. Modelos: `texturas/_modelo-carimbo/`,
`texturas/_modelo-trecho/`; piloto (e o primeiro em pé): `texturas/arvore/`.

### 9.3 Parâmetros (`textura.json`)

Tudo explícito, montado por `comum/contrato_carimbo.gd` (`parametros`): `tipo`, `idDoApp`,
`sombra` (jeito, direção, deslocamento ou, no `em-pe`, comprimento, borrão, alfa, cor e a
conta em texto), `memoria`
(bytes na placa e em disco, com os tetos). No carimbo: `destino`, `sprite` (arquivos,
ladoPx, unidadePx, ancoraPx), `formas` (variações, o espelho e a conta), `tamanhoDoApp`,
`corMedia` (a miniatura e o zoom muito pequeno). No trecho: `curva`, `casas`, `trecho`
(arquivos, pxPorCasa 128, tamanho da imagem, comprimento, meia, ponta, canais e
orientação) e `luz` (força e direção).

### 9.4 A montagem do carimbo (o app faz exatamente isto)

Para um `Carimbo {x, y, tamanho, giro}` (x, y = o pé; tamanho em px do mundo):

    s = tamanho / unidadePx                 // escala da imagem para o mundo
    k = varianteDoGiro(giro)                // 0..7, a conta de hoje
    arquivo = carimbo-(k mod N + 1).png
    espelho = floor(k / N) é ímpar            // formas.espelho "nenhum": nunca
    sem espelho: setTransform(s, 0, 0, s, x - s·ancora.x, y - s·ancora.y)
    com espelho: setTransform(0, s, s, 0, x - s·ancora.x, y - s·ancora.y)   // (u, v) -> (v, u)
    sombra: a silhueta do mesmo desenho, na mesma transformação, numa camada só para todos,
            andada deslocamento·tamanho na direção (7, 11) normalizada e desfocada
            borrao·tamanho (desvio do blur() do Canvas); a camada pintada com #0a1c28 a 0,25
    sombra em-pe: a mesma camada, mas a silhueta deitada a partir do pé, como
            matrizDaSombra('em-pe'): com [a, b, c, d, e, f] a transformação do corpo sem o
            pé (sem espelho [s, 0, 0, s, -s·ancora.x, -s·ancora.y]; com, [0, s, s, 0, ...]),
            (dx, dy) = (7, 11) normalizada e l = comprimento:
            setTransform(a - l·dx·b, -l·dy·b, c - l·dx·d, -l·dy·d, x + e - l·dx·f, y - l·dy·f)
            // o ponto a altura h acima do pé cai h·l na direção: o pé fica, o alto deita
    corpos por cima, em ordem de y (o pé mais embaixo por último)

Com espelho, o ponto (u, v) da imagem vai para (x + s·(v - ancora.x), y + s·(u - ancora.y));
sem espelho, para (x + s·(u - ancora.x), y + s·(v - ancora.y)). Os pontos da diagonal da
imagem (u = v), o meio dela incluído, caem no mesmo lugar nos dois: o objeto desenhado no
MEIO da imagem não anda quando espelha (no primeiro piloto da árvore, vista de cima, a
âncora era `[173,6; 360,2]` numa imagem de 352, o pé 184 px abaixo do meio, e a copa ficava
acima do pé nas 8 formas). Por isso o desenho é centrado no meio da imagem e só a âncora diz
onde fica o pé. O app nunca escala a imagem num eixo só. Zoom muito pequeno: a cor média
(`corMedia`). Mipmap ligado.

O desenho em pé (`espelho: "nenhum"`, 28/10) tem o tronco embaixo e o pé na âncora;
transposto, ele deitaria de lado, por isso nunca espelha e tem até 4 formas (o giro k e o
k + N dão o mesmo desenho). A árvore refeita é assim: `[173,9; 336,9]` numa imagem de 352,
`unidadePx` 262, a copa onde a de hoje fica, com a sombra `em-pe` de hoje.

### 9.5 A montagem do trecho (a luz que o app aplica)

Para cada ponto da tela perto do eixo do trecho (a reta, ou o arco de `geometriaDaCerca`
com a corda e a volta do móvel), o app acha s (ao longo, 0 no começo do eixo, até o
comprimento total T), c (atravessando, + do lado n) e t (a direção de andar no ponto), com
n = (-t.y, t.x). Fora de |c| <= meia e de -ponta <= s <= T + ponta, nada.

    se s < 0:        xi = (ponta + s)·2,         ladoAo = +1      // a ponta do começo
    se s > T:        xi = (ponta + T - s)·2,     ladoAo = -1      // a do fim, espelhada
    senão:           xi = (ponta + s mod L)·2,   ladoAo = +1      // o período repete
    yi = (c + meia)·2
    cor = trecho.png em (xi, yi), bilinear;  r = trecho-relevo.png no mesmo ponto
    N = (2·r.R - 1)·ladoAo·t + (2·r.G - 1)·n                     // a normal deitada na tela
    luz = dot(N, LUZ),  LUZ = (-0,7071; -0,7071)
    luz >= 0: cor = mix(cor, realce_de(cor), luz·forca)          // realce_de do cabeçalho
    luz <  0: cor = cor·(1 - 0,3·forca·(-luz))
    sombra: a mesma conta do carimbo, com o tamanho = a largura (2·meia)

A jardineira (`curva: false`) usa a mesma conta numa reta: o móvel esticado repete o
período e não estica a imagem. A emenda a cada L tem de ser invisível (é o que a folha
mostra nos trechos longos). A conta está escrita, igual, em `ferramentas/carimbo_pagina.ts`
(`camadaDeTrechos`): é a referência para a integração.

### 9.6 Vaso, jardineira e sebe (o destino de cada um)

- **Vaso** (0,5 x 0,5 casa, redondo): carimbo de destino `movel`; 1 unidade = 1 casa; o
  giro do móvel escolhe a forma como no carimbo (a imagem não gira; o vaso é redondo).
- **Jardineira** (1 x 0,5): trecho reto (`curva: false`), `casas: [1, 0.5]`.
- **Sebe** (2 x 0,5, esticável e curva): trecho com `curva: true`, `casas: [2, 0.5]`.

### 9.7 Teto de memória

Carimbo: `variacoes x ladoPx² x 4 x 4/3` <= 2,67 MiB na placa (4 arquivos de 352 px = 2,52
MiB, o piloto) e os PNGs <= 1,5 MiB em disco. Trecho: duas imagens pequenas (o modelo usa
0,09 MiB). O exportador mede e falha acima do teto. O portão do app (200 MB em
`docs/desempenho/limites.json`) não muda: o Desenhado troca o assado de hoje, não soma.

### 9.8 A mesa de prova dos carimbos

`--folha` num item da onda 3 monta outra mesa (`comum/mesa_carimbo.gd` arruma, o
`ferramentas/carimbo.ts` abre o Chromium do Playwright, `ferramentas/carimbo_pagina.ts`
monta no Canvas 2D, o motor dos carimbos de hoje). Chão: a grama aprovada (`exportado/grama`).

- **Sozinho** (a forma 1) a 25, 50, 100 e 300%, Desenhado e Atual.
- **As formas:** as 2N do Desenhado (N com `espelho: "nenhum"`) e as 8 do Atual (um
  desenho assado a cada 45 graus).
- **Bosque:** 51 objetos soltos pelo `criarSpray` do app (sorteio de semente fixa, 4 traços
  de densidade 0,35 a 1 e 3 soltos, escolha de 60 a 160%) em 24 x 24 casas, a 50% e 25%, e
  o recorte de 8 x 8 casas da mata fechada a 100%; o Atual com os mesmos objetos.
- **Trecho:** sozinho, as 8 formas (girado de 45 em 45 graus, as curvas de 90, -90 e 180
  graus, um curto) e 9 trechos retos, girados, curvos, curtos e longos. Sem Atual (o móvel
  de hoje é do Meio-Termo; a folha diz).
- A folha mostra o `centroDoAtual` (o meio da área do desenho de hoje, em unidades do pé) e
  o tamanho a 100% no mapa de referência (a árvore: 154,6 px, 2,42 casas).

Folha do lote: `scripts/folha_do_lote_carimbos.gd` (PARA-OS-DESIGNERS.md).

### 9.9 Critério de pronto de um carimbo ou trecho

1. `exportar_uma.gd --textura=<id> --folha` sai com 0 e a memória cabe no teto.
2. **Nada de escama, bolinha nem pontilhado** a 25%, 50% e 100% (a crítica do usuário de
   28/10: "tá muito detalhado, cheio de bolinhas, fica estranho"). Forma grande e calma,
   poucas massas largas, luz em cima à esquerda, contorno como o protótipo do Fogo.
3. No bosque a 50%, ninguém acha o mesmo objeto repetido; na mata fechada, as massas se
   separam pela sombra, não viram bolhas iguais.
4. O objeto a 100% fica onde o Atual fica (a âncora pela conta de 9.1, item 4).
5. Trecho: sem emenda visível a cada L, a luz sempre de cima à esquerda em toda forma, e a
   ponta do fim igual à do começo.

## 10. Móvel desenhado que pega cor (onda 4, 29/10/2026)

**O caminho de antes, tentado e reprovado.** Na manhã de 29/10 a onda 4 começou pelo
caminho "só materiais" (commit `c26dabef`): o Desenhado trocava só a superfície das 8
classes de material e o motor de hoje continuava desenhando a forma, o chanfro e a luz. O
piloto da madeira foi reprovado pelo usuário no mesmo dia, literal: *"Não parece que teve
muita mudança ainda parece o mesmo atual e não desenhado"*. A forma é o que faz o
Desenhado; trocar a pele não basta. O que sobrou de útil daquele caminho está na 10.11.

**A decisão do usuário (29/10, "Desenho à mão que pega cor"):** cada móvel é redesenhado à
mão, como as árvores da onda 3 (contorno, formas calmas, luz em poucas massas), numa
imagem em **cinza com as partes marcadas** (o tampo, as pernas, o assento, os aros); o app
tinge cada parte com o material que o mestre escolheu. Móvel que estica tem ponta + meio
repetível. A vista 3/4 (`MapData.vistaDosMoveis`) fica **fora** (continua no Atual); a
Frente/Lado entra.

### 10.1 A decisão em 6 linhas

1. **Um móvel = imagens por forma**: valor em cinza (0,5 = o tom do material) e as partes
   (R, G, B = o peso dos lugares 1, 2 e 3), a 128 px por casa, a pegada mais
   `margemCasas` de borda, com o meio da pegada no meio da imagem (a âncora).
2. **O app tinge por parte** com a rampa OKLab da família (10.5): a luz anda, o matiz fica;
   o contorno é a mesma rampa no escuro (50% da luz do tom), então ele é "na própria cor".
3. **A luz fica em cima à esquerda em todo giro.** O app hoje gira a imagem inteira (a luz
   gira junto). No Desenhado o quarto de volta k = round(giro / 90) mod 4 vem **pintado** e
   a tela gira só o resto (de -45 a 45 graus). Desenhar 1, 2 ou 4 viradas (10.4); as que
   faltam saem por transposição, que guarda a luz porque ela está na diagonal.
4. **Estica por ponta + meio liso + ponta**: o designer deixa tudo o que muda ao longo nas
   pontas; o meio é a mesma coluna em todo x (o exportador mede: até 2/255), e o app estica
   o meio sem emenda. Quem vive esticado pode pedir o **meio que repete** (10.6): um módulo
   a cada `periodoCasas`, em vez do meio liso; quem tem uma peça no meio que não pode
   esticar nem repetir (a placa do arco do portão) pede o **centro fixo** (`centroCasas`,
   10.6).
5. **A sombra no chão é do app**: a silhueta já virada e esticada, andada na direção
   (7, 11), desfocada, cor `#0a1c28` a 25% (a dos carimbos, 9.1), numa camada só com a
   deles. O designer só escolhe o quanto ela anda e o borrão.
6. **Teto:** 3 MiB de memória decodificada **por vista** (RGBA com mipmap, todas as formas
   da vista), 0,5 MiB em disco por móvel, 24 MiB os 31 juntos (só os tipos e as vistas que o
   mapa usa carregam). Por vista desde o lote 12 (decisão do orquestrador): o app carrega só
   a vista que o móvel usa (a Frente/Lado do mestre), então a carroça, com 2,92 MiB em cada
   uma das 2 vistas, cabe. No `textura.json`, `memoria.memoriaBytes` é a soma de todas as
   formas e `memoria.tetoMemoriaBytes` é o teto de uma vista (a integração soma as formas
   da vista pelo `larguraPx` x `alturaPx`). Piloto: mesa 0,40, cadeira 0,99, barril 0,11 MiB.

### 10.2 Arquivos e config

`texturas/movel-<nome>/config.json` (modelo em `texturas/_modelo-movel/`):

| Campo | O quê |
|---|---|
| `tipo` | `"movel"`; `id` = `movel-<nome>`; `idDoApp` = o tipo em `MOVEL_TIPOS` (`mesa`, `cadeira`...) |
| `lugares` | de 1 a 3, na ordem de `LUGARES_DE_MATERIAL[idDoApp]` do app (a mesa de prova confere) |
| `corFixa` | `true` se tem parte de cor própria (lençol, louça, água, chama): imagem `-cor` |
| `variantes` | opcional: `[{ nome, quando: { <lugar>: <opção> } }]`, quando uma opção muda o desenho (o assento de palha ou de madeira); a primeira é o padrão. `quando: { "forma": "redondo" }` bate com a forma do objeto (`Prop.forma`, só o tapete; ausente = `"retangular"`), e `vistas` (opcional) dá à variante a pegada e o esticar próprios numa vista (o tapete redondo, 10.6) |
| `vistas.frente` / `vistas.lado` | `casas` [w, h] (a pegada do app), `viradas` 1, 2 ou 4, `esticar` opcional `{ eixo: "x" ou "xy", pontasCasas [começo, fim], pontasCasasY, ladoMaior, periodoCasas, centroCasas, centroCasasY }` (`periodoCasas` opcional, só no `x`: o meio que repete; `centroCasas` opcional, no `x` ou no `xy` e sem `periodoCasas`: o centro fixo; `centroCasasY` opcional, só no `xy`: o centro fixo atravessado; 10.6) |
| `sombra` | `{ jeito: "deslocada" ou "nenhuma", deslocamentoCasas até 0,4, borraoCasas até 0,2 }` |
| `margemCasas`, `onda`, `lote`, `semente` | a borda (padrão 0,0625), o lote, a semente |
| `pecas` | opcional, só a cerca: `{ mouraoCasas: [x, y], raioCasas, colunaCasas, viradaDaLuz }`, de onde a conta tira o mourão e a ligação na forma 0 (10.12) |

Em `exportado/movel-<nome>/`, por forma `<vista>-<variante>-<virada>`: `.png` (R = G = B o
valor, A a cobertura, alfa reto), `-partes.png` (R, G, B = lugares 1, 2, 3; o que sobra é a
cor fixa ou o lugar 1) e `-cor.png` só com `corFixa`; mais o `textura.json`. Shader:
`comum/movel.gdshaderinc` + `void pintar_movel(vec2 q, float px, int vis, int qual, int
vir, int sem, inout vec4 av, inout vec4 ac)` + `comum/rodape_movel.gdshaderinc` (o
cabeçalho explica cada argumento).

### 10.3 Parâmetros (`textura.json`)

`contrato`, `tipo: "movel"`, `idDoApp`, `pxPorCasa: 128`, `margemCasas`, `lugares`,
`corFixa`, `variantes` (a que tem vistas próprias as leva, no mesmo formato de `vistas`),
`vistas` (com `viradas` e `esticar`; no meio que repete, também
`periodoCasas`, `modulos` e o texto `meio` da conta; no centro fixo, `centroCasas` (e
`centroCasasY` no dos dois eixos) e o texto `meio`), `viradas` (o texto da regra
de 10.4), `formas` (nome, vista, variante, virada, casas, arquivos; `variacaoDoMeio` no
meio liso, mais `variacaoDoMeioY` no `xy` com `centroCasasY`, `costuraDoModulo` no que repete), `sombra` (jeito,
direção, deslocamento, borrão, alfa, cor e a conta), `tingir` (a rampa de 10.5) e
`memoria` (bytes decodificados e em disco). Com `pecas` no config (a cerca), também `pecas`,
com o texto `conta` (10.12); sem ele, a chave não existe e o resto sai igual.

### 10.4 Girado, Frente/Lado e 3/4

- **Quarto de volta pintado.** k = round(giro / 90) mod 4; a tela gira o resto. `viradas`:
  **1** (simétrico de lado a lado e de cima a baixo: a mesa, o barril): k par = a forma 0,
  k ímpar = a forma 0 transposta. **2** (simétrico de lado a lado: a cadeira de frente):
  k 0 e 2 desenhadas, k 1 = a 2 transposta, k 3 = a 0 transposta. **4**: as quatro
  desenhadas (a cadeira de lado). A transposta guarda a luz porque LUZ = (-0,71, -0,71).
- **No shader**, desenhe no referencial do móvel (`movel_de(q, vir)`) e acenda no da tela
  (`LUZ`, `para_a_luz`, as massas de `desenhar_caixa` e `desenhar_elipse`).
- **`ladoMaior`**: a mesa de 1 x 2 sem giro é a de 2 x 1 com um quarto de volta a mais.
- **Frente/Lado** (`TIPOS_COM_VISTA`: cadeira, baú, armário, aparador, fogueira, tapete,
  barraca, carroça): a vista Lado é outra forma, com a pegada de lado do app
  (`vistas.lado.casas`), as mesmas regras de virada.
- **3/4 fica no Atual**: com `vistaDosMoveis` ligada o app desenha o móvel como hoje.

### 10.5 Tingir sem estourar

Por parte, o tom do material do lugar (`MATERIAIS[id].tom`) vira uma rampa de 256 cores em
OKLab: abaixo de 0,5, L x fator pelos nós `[0, 0,42] [0,10, 0,50] [0,24, 0,64] [0,36, 0,78]
[0,5, 1]` e o croma cresce até 25%; acima, L anda para o branco pelos nós `[0,5, 0] [0,62,
0,12] [0,76, 0,26] [1, 0,45]`, com 12% do matiz para o amarelo `#f0d266` e o croma até
+20% na luz. Valor abaixo de 0,10 e acima de 0,94 só escurece e clareia; a cor fora da tela
é trazida de volta cortando o croma (busca binária). Os níveis da família, os mesmos para
todo designer: `V_CONTORNO 0,10`, `V_FUNDO 0,24`, `V_SOMBRA 0,36`, `V_MEIO 0,50`,
`V_LUZ 0,62`, `V_REALCE 0,76`. O contorno da família tem 0,042 casa (2,7 px a 100%), mais
fino na peça estreita (`contorno_para`). Os 5 tons de madeira continuam separados: menor
distância OKLab na mesa 0,040 no Desenhado, 0,041 no Atual.

`mesma` (o assento "da mesma madeira") vira a variante de madeira e o lugar 2 é tingido
com o tom do lugar 1; `varas`, `corda` e afins só escolhem a variante.

**A pedra com menos croma no escuro (lote 12, o poço).** Com o `cromaNaSombra` da família
(+0,25) o arenito chegava ao contorno em (74, 51, 0), azul zero: a borda da pedra lia como
ocre saturado. Para os materiais de classe `pedra` (`MATERIAIS[id].classe === 'pedra'` no
app: granito, arenito, ardósia e barro), a rampa do lugar usa `cromaNaSombra` **-0,6** no
lugar de +0,25 (o croma cai para 65% no contorno); o resto da rampa é o da família. O que
a integração copia de `ferramentas/movel.ts`: `CROMA_NA_SOMBRA_DA_PEDRA`, `rampaDaOpcao`
(a troca por lugar, pela opção do lugar) e a chave da rampa pronta com o tom e o
`cromaNaSombra` (dois lugares de mesmo tom e classe diferente não dividem a rampa). O
`tingir` do `textura.json` continua o da família, igual em todo móvel (os exportados não
mudam). Medido: arenito, contorno (70, 52, 16), fundo (98, 76, 36), sombra (128, 102, 56),
meio e luz iguais; granito e ardósia quase não mudam (croma de 0,015 a 0,018); a madeira
fica como era.

### 10.6 Esticado

O eixo de `esticar` é o do móvel (x = ao longo); `pontasCasas` são as pontas fixas, contadas
da borda da pegada (a margem da imagem fica antes delas, como na conta do app; até o lote 12
a medida do meio liso esquecia a margem e olhava `margemCasas` a mais de cada lado), e o meio
da imagem estica até a medida pedida. Mais curto que as duas pontas: cada ponta perde
metade do que falta. `xy` estica nos dois (o tapete, a fogueira de área). A curva da cerca
não é forma própria nem trecho: é a **cerca por peças** do lote 12 (10.12).

**O meio que repete (opcional, lote 11, 29/10).** Com o meio liso, quem vive esticado lia
pobre: a 50%, o balcão de 6 casas era uma tábua listrada comprida, sem divisão nenhuma (o
designer da mesa quadrada já tinha avisado: "uma tábua emoldurada comprida"). Com
`esticar.periodoCasas` = P (só `eixo: "x"`):

- **O desenho** leva entre as pontas um número inteiro de módulos de P casas, e as pontas,
  P e a margem caem em px inteiros (x 128; o contrato recusa o resto). A emenda de dois
  módulos, e a de módulo com ponta, cai numa **faixa lisa**: 2 x 4 px em volta de cada
  emenda são a mesma coluna da primeira. O exportador mede (`costuraDoModulo`, até 2/255,
  como o meio liso) e avisa. Ponha a emenda no meio de um vão, de um montante ou de uma
  tábua, nunca numa peça que muda ao longo.
- **A conta** (`faseNoModulo` e `mapearEixo` de `ferramentas/movel.ts`): para um meio de M
  casas, n = round(M / P) módulos, cada um com M / n casas. **A sobra se reparte pelos
  módulos**, que crescem ou encolhem um pouco (de 0,5 a 1,5 P com um módulo só, perto de 1 P
  com muitos), e as pontas ficam intactas: nunca sai meio módulo cortado. Com M < P / 2,
  n = 0 e o meio é a coluna da emenda (lisa). Todo módulo lê o primeiro módulo da imagem.
- Quem não pede continua liso: as ondas 1 a 3 e os móveis dos lotes 9 e 10 reexportados
  saíram byte a byte iguais (46 de 46 por sha256, 29/10).
- Usam: o aparador (pontas 0,140625, P = 0,859375: 2 portas e um par de puxadores por
  módulo, nas duas vistas) e o balcão (pontas 0,5, P = 1: um vão da prateleira e um suporte
  da barra de pé por casa).

**O centro fixo (opcional, lote 12, 29/10).** O arco do portão tem a placa pendurada no
meio, que tem de ficar uma só, inteira e no meio em qualquer comprimento: o meio liso
esticava a placa junto (uma faixa de 3,5 casas no arco de 5) e o que repete punha uma placa
por módulo. Com `esticar.centroCasas` = C (só `eixo: "x"`, nunca com `periodoCasas`):

- **O desenho** é ponta + meio liso + centro + meio liso + ponta. O centro são as C casas do
  meio da imagem (centradas na pegada); entre cada ponta e o centro sobra meio liso (ao
  menos 2 px de cada lado), a mesma coluna em todo x, e as pontas, C e a margem caem em px
  inteiros. O exportador mede o liso só fora do centro (`variacaoDoMeio`, até 2/255), com
  uma coluna de folga em cada borda.
- **A conta** (`mapearEixo(t, T, S, pontas, null, centro)` de `ferramentas/movel.ts`): o
  ponto a menos de C / 2 do meio do móvel lê o centro da imagem na mesma distância (o centro
  não estica); entre a ponta e o centro, cada meio liso estica com a metade do que sobra.
  Mais curto que pontas + C, o centro fica inteiro e cada ponta perde por dentro a metade do
  que falta (some primeiro o meio liso, depois a borda de dentro da ponta; no arco, a 1,4
  casa a placa ainda cabe entre os esteios).
- Quem não pede sai igual: o `textura.json` só ganha `centroCasas` e o texto `meio` de quem
  pede.
- Usa: o arco do portão (pontas 0,46875, C = 0,578125: os esteios nas pontas, a placa com
  as alças no centro, a trave lisa dos dois lados).

**O centro fixo nos dois eixos (opcional, lote 13, 29/10, o tapete).** O tapete estica nos
dois eixos pelo lado maior, e o medalhão do meio tem de ficar inteiro e no meio em todo
tamanho, com a barra correndo lisa nos 4 lados. Com `eixo: "xy"`, `centroCasas` vale ao longo
(como acima) e `esticar.centroCasasY` = Cy vale atravessado, com as `pontasCasasY`:

- **O desenho**, em cada eixo, é ponta + meio liso + centro + meio liso + ponta: o medalhão
  cabe no retângulo C x Cy do meio da imagem; entre a ponta e o centro, só o que é igual ao
  longo daquele eixo (a barra reta e o campo). As pontas de cada eixo, os dois centros e a
  margem caem em px inteiros, e sobra meio liso de ao menos 2 px de cada lado. O exportador
  mede o liso ao longo (`variacaoDoMeio`, fora do centro) e, com `centroCasasY`, também atravessado
  (`variacaoDoMeioY`, as linhas fora do centro do y), os dois até 2/255.
- **A conta** é a mesma do centro fixo, um eixo por vez: o x da imagem por
  `mapearEixo(t, T, S, pontas, null, centro)` e o y por
  `mapearEixo(t, T, S, pontasY, null, centroY)`. Nas viradas 1 e 3 os dois trocam de eixo
  na tela, como as pontas.
- **A vista da variante.** Uma variante pode ter `vistas` próprias: `casas` e `esticar` de
  uma vista que o móvel já tem (as viradas são as dela, e o número de formas não muda). O
  tapete redondo (`quando: { "forma": "redondo" }`) é 2 x 2 de cima sem esticar, e vira
  oval pela escala da pegada (o medalhão acompanha, como no Atual): um disco cortado por
  colunas lisas não fica redondo. De lado, 2 x 0,25 com o meio liso.
- Quem não pede sai igual: só o tapete tem `centroCasasY`, `variacaoDoMeioY` e variante com
  `vistas`.
- Usa: o tapete (frente 3 x 2: pontas 0,5 e C = 1,25 ao longo; pontas 0,5 e Cy = 0,8125
  atravessado; o redondo 2 x 2).

### 10.7 Sombra

A do app (10.1 item 5). Guia: o quanto anda é a altura do móvel (mesa 0,22 casa,
cadeira 0,11, barril 0,14), o borrão é curto (0,02 a 0,03) para ela ler a 50%. A sombra de
**dentro** (a perna debaixo do tampo, a tampa funda do barril) é valor, no desenho.

### 10.8 O que a integração precisa (escrito, não feito)

1. **Estilo na chave** de `pixi/rasterDosMoveis.ts` (senão o móvel de um estilo aparece no
   outro), e **`q<k>` para todo móvel Desenhado**: hoje só `placaDeSeta` pinta o quarto de
   volta (`giroDaImagem`); no Desenhado todos pintam e a tela gira só o resto.
2. **Carregar**: decodificar os PNGs do tipo na primeira vez que o mapa usa, fazer os
   níveis 2 x 2 e as rampas por tom sob demanda; até chegar, pintar com o Atual.
3. **Compor** como `ferramentas/movel.ts` (`comporMovel`): variante, forma da virada,
   tingir por parte, esticar, sombra pela silhueta. É a conta de referência: se o app
   fizer igual, o que a folha mostra é o que o mestre vê.
4. **Fallback**: tipo ainda não desenhado, vista 3/4 ou Modo Simples (desenho "Linhas")
   continuam no Atual, sem aviso.
5. **Entrega**: a mesma questão do resto do pacote (seção 7): o pacote de animações só leva
   `.js`; os PNGs vão junto do app ou por outro canal.
6. **Nada muda no mapa**: o tipo, a pegada, as opções de material, o giro e a vista são os
   de hoje; o mapa salvo abre igual nos dois estilos.
7. **O meio que repete** (10.6): ler `vistas.<vista>.esticar.periodoCasas` e, só no eixo ao
   longo do móvel (o x da tela nas viradas 0 e 2, o y nas 1 e 3), trocar o esticar do meio
   pela fase no módulo, como `mapearEixo(t, T, S, pontas, periodo)`. Vale nas duas vistas
   (o aparador estica também de lado). A leitura bilinear e o mipmap podem passar da emenda
   sem cuidado: a faixa da emenda é lisa. Como o desenho muda com o comprimento, a camada
   pronta é por comprimento pedido (a chave de `rasterDosMoveis.ts` já leva a pegada).
   **O centro fixo** (10.6) é igual: ler `vistas.<vista>.esticar.centroCasas` e, no mesmo
   eixo ao longo, mapear como `mapearEixo(t, T, S, pontas, null, centro)`.
9. **O teto é por vista** (10.1 item 6): carregar só as formas da vista que o móvel usa; a
   soma das vistas carregadas no mapa fica nos 24 MiB.
10. **A pedra** (10.5): o lugar de material de classe `pedra` tinge com `cromaNaSombra`
   -0,6, como `rampaDaOpcao` de `ferramentas/movel.ts`.
11. **O tapete** (10.6, lote 13): passar a forma do objeto (`Prop.forma`) para a escolha da
   variante (`varianteDoPedido(p, opcoes, forma)`: a chave `forma` de `quando` não é lugar),
   e pegar a vista da variante quando ela tem `vistas` próprias (a pegada e o esticar do
   redondo). No `xy` com `centroCasasY`, mapear o eixo atravessado com o centro, como
   `comporMovel`; a chave de `rasterDosMoveis.ts` já leva a pegada, e passa a levar a forma.
8. **A cerca por peças** (10.12): com `pecas` no `textura.json`, a cerca (reta e curva, em
   todo giro) não passa pelo esticar nem pelo quarto de volta: o rasterizador chama
   `geometriaDaCerca(largura, altura, volta)` (a mesma do desenho em linhas, do clique e da
   seleção), gira os mourões e o arco pelo giro do objeto e compõe como `comporCerca` de
   `ferramentas/movel.ts`; a camada sai já na tela (a tela não gira nada). A chave da camada
   leva a pegada, a volta, o giro e as opções. Sem a geometria (um caminho que não a tenha),
   o `comporMovel` de sempre ainda serve para a reta: a forma 0 é um móvel válido, com o
   meio que repete.

### 10.9 A mesa de prova dos móveis

`--folha` num móvel roda `comum/mesa_movel.gd`: `ferramentas/construir.mjs` empacota
`ferramentas/mesa_movel.ts` (com `movel.ts` e o motor dos móveis do client da main, só
leitura), o `node` pinta e o Godot arruma a folha. Mostra, Desenhado ao lado do Atual:
sozinho e em 3 combinações de material a 100, 50 e 25%, e a 300%; os 5 tons de madeira (no
primeiro lugar de madeira, qualquer que seja a posição dele: o poço tem as pedras antes) com
a medida OKLab; as 4 viradas (e a vista de lado); a esticada em 1,4, 2, 3 e 5 casas e a de
1 x 2; e a **família**, uma clareira de 12 x 12 casas da grama aprovada com árvores,
arbustos, pedras e o tronco caído da onda 3 e uma mesa com 5 cadeiras e 3 barris (o que já
foi desenhado sai Desenhado, o resto Atual). Por último, os arquivos sobre xadrez. Só no
móvel com `pecas` (a cerca), a mesa roda também `ferramentas/mesa_curva.ts` e a folha ganha
a faixa da cerca por peças (10.12), Desenhado ao lado do Atual a 100% e a 50%; na `<prova>`,
`curva100.png`, `curva50.png` e os `atual-curva*`.

    exportar_uma.gd -- --textura=movel-<nome> --folha --prova=<pasta>/movel-<nome>
    folha_do_lote_moveis.gd -- --texturas=<id1>,...,<id5> --prova=<pasta> --saida=<pasta>/lote.png --titulo="Lote 10, móveis" --familia=<id>

Exporte todos os do lote antes das folhas (a família lê o que está em `exportado/`). Em
`<prova>/<id>/`: `folha.png`, `area50.png`, `perto300.png`, `atual-*`, `familia100.png`,
`familia50.png`, `familia300.png`, `resumo.json` e `paineis/`.

### 10.10 Critério de pronto de um móvel

1. `exportar_uma.gd --textura=movel-<nome> --folha` sai com 0: memória no teto de cada
   vista e disco no do móvel, o meio liso (se estica, fora do centro fixo se tem) ou a
   costura do módulo (se repete), os lugares iguais aos do app.
2. **Nada de risquinho, bolinha, prego, nó nem veio fino** (a crítica de 28/10: *"tá muito
   detalhado, cheio de bolinhas, fica estranho"*). Contorno, formas grandes, 2 ou 3 massas
   de luz por peça.
3. **A 50%, ao lado do Atual, se vê que é outro desenho** sem legenda.
4. A luz de cima à esquerda nas 4 viradas; a vista de lado (se tem) lê como o mesmo móvel.
5. Os tons de madeira separados (a menor distância não abaixo da do Atual menos 0,005);
   ferro e latão distinguíveis no mesmo móvel.
6. Família: ao lado das folhas dos lotes 6 a 8, na grama aprovada.

### 10.11 O que ficou do caminho "só materiais"

`texturas/material-madeira/` e o seu exportado (commit `c26dabef`) **continuam no repo,
sem uso**: são o registro do que foi reprovado e ainda exportam (o portão de hash das
ondas 1 a 3 os pula, como pula `movel-*`). Apagar só com o usuário. Do caminho ficaram: a
rampa OKLab (agora por parte, com o contorno), a ideia da mesa de prova que empacota o
motor da main para o Atual, e a lista do que o app guarda por móvel (`LUGARES_DE_MATERIAL`,
as pegadas, `TIPOS_COM_VISTA`, a chave de `rasterDosMoveis.ts`). Os comandos do material
(`folha_do_lote_materiais.gd`, `comum/mesa_material.gd`) seguem funcionando.

### 10.12 A cerca por peças (lote 12, 29/10)

A cerca estica e faz curva (`Prop.mobiliaCurva`, até ±180 graus; os mourões a ~1 casa de
arco, `geometriaDaCerca` de `lib/mobilia.ts`). Dois caminhos já existiam e nenhum servia
inteiro:

- **o trecho da onda 3** (a sebe, 9.5): deita um período na curva e acende pelo relevo, mas
  é cor pronta, sem partes (não tinge os 5 tons de madeira nem a corda e o arame), põe o
  mourão a cada L em vez de onde o app põe (o clique e a seleção leem a geometria), e no arco
  o disco do mourão entorta junto (±10% a ±14% na curva de 2 casas);
- **o meio que repete** (10.6): tinge por parte e a reta fica boa, mas a imagem tem a luz
  pintada; dobrada no arco, a borda acesa gira com a cerca e no fim de um quarto de volta
  está do lado errado.

**A decisão: a cerca sai por peças, na geometria do app, das imagens de sempre.** A forma 0
de cada variante (`frente-<variante>-0`, uma cerca de 2 casas com 3 mourões onde o app os
põe) é ao mesmo tempo o móvel de sempre (o meio que repete, pontas 0,5 e P = 1) e a fonte das
peças, declaradas em `pecas` (config.json e `textura.json`):

- `mouraoCasas` [x, y] e `raioCasas`: o meio de um mourão na forma (casas a partir do canto
  da pegada) e o raio do recorte (o mourão inteiro com o contorno e a borda suave);
- `colunaCasas`: uma coluna da ligação (a emenda do módulo, que já é lisa por contrato);
- `viradaDaLuz` l (0,05 a 1): a faixa em que a luz da ligação passa de uma borda para a outra.

A conta (`comporCerca` de `ferramentas/movel.ts`, a referência para o app):

    geometria = geometriaDaCerca(largura, altura, volta)      // do app, em casas, sem o giro
    mourões e arco girados pelo giro do objeto (o arco: o centro gira, os ângulos somam o giro)
    forma = frente-<variante>-0 tingida (a mesma camada que o comporMovel usa)
    1. a ligação: para cada ponto perto do eixo (o segmento do 1º ao último mourão, ou o arco
       entre eles), t = a direção de andar, n = (-t.y, t.x), c = o quanto o ponto anda em n
       (|c| <= meia altura da forma + margem)
         w   = smoothstep(-l, l, -dot(n, LUZ) / 0,7071)         // LUZ = (-0,7071; -0,7071)
         cor = w · forma(colunaCasas, c) + (1 - w) · forma(colunaCasas, -c)
    2. os mourões, por cima e EM PÉ (nunca giram): o recorte de raio raioCasas em volta de
       mouraoCasas, posto no meio de cada mourão da geometria, a borda suave em meio px
    3. a sombra pela silhueta (10.7), na camada só com a dos outros
    a tela não gira mais nada: resto = 0

Por que fica bom: na cerca deitada w = 1 e a ligação é a forma como foi desenhada; em pé,
w = 0 e a borda acesa vai para a esquerda (é a transposta, a luz no lugar); na curva a luz
troca de borda devagar só onde a cerca anda na direção da luz, onde a vara de verdade fica
igual dos dois lados. O mourão é redondo: em pé, ele guarda a luz em todo giro e em todo
ponto do arco, e cai exatamente onde o clique, a seleção e o desenho em linhas o põem. A
ligação é a mesma coluna em todo o comprimento, então não há emenda a cada mourão; a reta e a
curva de volta pequena saem iguais (a mesma forma, os mesmos mourões). O S são duas cercas de
volta 90 e -90 emendadas no mourão da ponta (o mourão das duas cai no mesmo ponto, igual).

O que o designer da cerca garante no desenho: a ligação simétrica de cima a baixo na forma
(só a luz muda de borda), igual em todo x entre os mourões (é a faixa lisa da costura), e o
mourão redondo, centrado, com nada da ligação além de `raioCasas`.

Opcional por móvel: sem `pecas`, nada muda (o contrato, o `textura.json`, a mesa e a folha
dos outros saem iguais: as ondas 1 a 3 e os 13 móveis dos lotes 9 a 11 reexportados deram 51
de 51 itens e 279 de 279 arquivos iguais por sha256 ao commitado, 29/10). A mesa:
`ferramentas/mesa_curva.ts` (10.9), com o Atual pelo motor de hoje com a mesma volta.
