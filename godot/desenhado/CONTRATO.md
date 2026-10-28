# Contrato do chão Desenhado (v1)

O que cada textura de chão entrega, como o app vai montar o chão a partir disso, por que
isso não se repete e quanto pode pesar. A implementação de referência da montagem é
`comum/compor.gdshader`: a mesa de prova monta a folha com ela, a partir dos arquivos
exportados. Quando o app integrar o Desenhado, ele faz a mesma conta; se fizer igual, o
que a folha mostra é o que o mestre vê.

Vale para a **onda 1** (chão e caminhos). Telhado, sprite e móvel têm contrato próprio,
escrito antes da onda deles (fim deste arquivo).

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
                escalaMin, escalaMax, variacaoDeTom, afastarCasas (opcional, seção 4) }
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
dmin = afastarCasas · 64 px        (0 < afastarCasas <= c / 2: até um passo da grade)
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

- **Telhados (onda 2)**: material no espaço do telhado (u ao longo do beiral, v da cumeeira
  ao beiral), tingível pelas 6 cores de cada modelo. Escrever antes da onda 2.
- **Sprites (ondas 3 e 4)**: árvore, planta e móvel como imagem com alfa, com sementes e
  vistas. Escrever antes da onda 3, junto com a decisão dos móveis (sprite por móvel ou só
  os 24 materiais).
- **Traço (onda 5)**: penhasco e parede repetíveis ao longo de um traço.
- **Entrega ao app**: o pacote de animações de hoje só aceita `.js` de até 2 MiB
  (`desktop/src-tauri/src/net/animacoes.rs`); PNG precisa de outro canal ou de ir junto do
  app. Decisão da fase de integração.
