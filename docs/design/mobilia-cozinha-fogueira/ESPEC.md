# Armário de cozinha, aparador e fogueira: especificação

Protótipo aprovado pelo usuário em 14/10/2026, com três ajustes (marcados **Ajuste na aprovação** abaixo): o nome inteiro "Armário de cozinha", a chama sempre em pé e a borda da chama mais escura. Fonte visual: `prototipo.html`, nesta pasta (anterior aos ajustes). No app: `client/src/lib/mobilia.ts` (catálogo e glifos) e `client/src/pixi/chamasDasFogueiras.ts` (a chama).

## Convenções (as mesmas de `client/src/lib/mobilia.ts`)

- Centro do objeto na origem, sem giro, y para baixo. "Cima" (−y) é o lado da parede: o fundo do móvel, igual ao encosto da cadeira e à cabeceira da cama.
- `w` = largura e `h` = altura do objeto em px de mundo. Fração da largura: `x = f·w`. Fração da altura **a partir de cima**: `y(t) = (t − 0,5)·h`.
- `m = min(w, h)`.
- Silhueta e glifo saem num traço só: fio de 1 px de tela na cor `edge` (padrão `WALL_COLOR` #d8d2c4 a 50%), fundo na cor `fill` (padrão #000 a 35%). "Cor", "Cor da linha" e "Preencher" valem como nos outros móveis.
- `tora(P1, P2, esp)`: retângulo de `P1` a `P2` com espessura `esp`, em 4 traços. Normal `n = (−dy, dx)/|P2 − P1| · esp/2`; cantos `P1+n, P2+n, P2−n, P1−n`.
- `toraCentrada(comp, esp, θ)`: `tora(−v, +v, esp)` com `v = (cos θ, sin θ)·comp/2`.

## Catálogo

| id (`TipoMobilia`) | Rótulo | Com artigo | Redondo | Vazado | Tem vista Lado |
|---|---|---|---|---|---|
| `armario` | Armário de cozinha | um armário de cozinha | não | não | sim |
| `aparador` | Aparador | um aparador | não | não | sim |
| `fogueira` | Fogueira | uma fogueira | **sim** (`ehMovelRedondo`) | não | sim |

**Ajuste na aprovação:** o primeiro sai com o nome inteiro, "Armário de cozinha", sem encurtar ("Armário" sozinho não diz que é o da cozinha). Entram no fim de `TIPOS_MOBILIA` (depois da cerca) e em `TIPOS_COM_VISTA`. O teste da barra que conta a cerca como 7º item precisa ser atualizado.

## Tamanho padrão, em casas (largura × altura, sem giro)

| Peça | Cima (`TAMANHO_EM_CASAS`) | Lado (`TAMANHO_DE_LADO_EM_CASAS`) |
|---|---|---|
| Armário | 1 × 0,5 | 1 × 1,5 |
| Aparador | 2 × 0,5 | 2 × 0,9 |
| Fogueira | 1 × 1 | 1 × 1,25 |

A fogueira de Lado é mais alta que larga para a chama e as fagulhas ficarem dentro do objeto (a fagulha mais alta chega a `y = −0,47·h`).

## Armário de cozinha

### Cima (1 × 0,5)

Contorno: retângulo. **Ajuste na aprovação:** fica o degrau, como no protótipo.

| Traço | De | Até | O que é |
|---|---|---|---|
| degrau | (−w/2, y(0,45)) | (w/2, y(0,45)) | frente do armário de cima, mais raso que a base (como num guarda-louça) |
| puxador esq. | (−0,25w, h/2) | (−0,25w, y(0,82)) | puxador da porta de baixo, na frente |
| puxador dir. | (0,25w, h/2) | (0,25w, y(0,82)) | idem |

### Lado (1 × 1,5): a frente do móvel

Contorno: retângulo.

| Traço | Geometria | O que é |
|---|---|---|
| portinha | retângulo x ∈ [−0,34w, 0,34w], y ∈ [y(0,06), y(0,25)] | porta do armário de cima |
| fim do armário de cima | (−w/2, y(0,30)) → (w/2, y(0,30)) | |
| laterais do nicho | x = ±0,42w, de y(0,30) a y(0,56) | prateleira aberta (sem porta) |
| bancada | (−w/2, y(0,56)) → (w/2, y(0,56)) | fundo do nicho / tampo da base |
| divisão das gavetas | (−w/2, y(0,75)) → (w/2, y(0,75)) | duas gavetas empilhadas |
| puxadores | x ∈ [−0,08w, 0,08w] em y(0,655) e em y(0,845) | um por gaveta |
| rodapé | (−w/2, y(0,94)) → (w/2, y(0,94)) | |

12 traços (a portinha conta 4). Sem pães, sem pratos: só o móvel.

## Aparador

### Cima (2 × 0,5)

Contorno: retângulo.

| Traço | De | Até | O que é |
|---|---|---|---|
| frente | (−w/2, y(0,72)) | (w/2, y(0,72)) | borda do tampo sobre as portas |
| encontro das portas | (0, y(0,72)) | (0, h/2) | projetado na frente, como o fecho do baú |

### Lado (2 × 0,9): a frente do móvel

Contorno (sentido horário), com o tampo sobrando dos lados (`corpo = w/2 − 0,035w`, `tampo = y(0,14)`):
(−w/2, −h/2), (w/2, −h/2), (w/2, tampo), (corpo, tampo), (corpo, h/2), (−corpo, h/2), (−corpo, tampo), (−w/2, tampo).

| Traço | Geometria |
|---|---|
| encontro das portas | (0, tampo) → (0, y(0,88)) |
| rodapé | (−corpo, y(0,88)) → (corpo, y(0,88)) |
| puxadores | x = ±0,045w, de y(0,38) a y(0,60) |

## Fogueira

### Cima (1 × 1, redonda)

Contorno: a elipse da silhueta (`ehMovelRedondo`), como o barril. O fundo é a "Cor" (chão de cinza dentro da roda).

| Traço | Geometria |
|---|---|
| borda de dentro da roda | elipse `0,7w × 0,7h`, 24 lados (`pontosDaElipse`) |
| juntas das pedras | 8 raios no ângulo `a = (k + 0,5)·45°`, k = 0..7, de (0,35w·cos a, 0,35h·sin a) a (0,5w·cos a, 0,5h·sin a) |
| lenha | `toraCentrada(0,56m, 0,08m, +35°)` e `toraCentrada(0,56m, 0,08m, −35°)` |
| chama | base em (0, 0,18m), altura em repouso `H = 0,40m` (ver "Chama sempre em pé") |

### Lado (1 × 1,25)

Contorno: só as pedras (o resto do retângulo fica sem fundo, como a cadeira em L). Com `vale = y(0,95)` e picos `t = [0,81; 0,79; 0,82; 0,80]`:
(−w/2, h/2), (−w/2, vale), depois 4 domos (pedra `i`, centro `cx = −w/2 + (i + 0,5)·w/4`, raio `w/8`, para `j = 1..8`: `a = π + π·j/8`, `x = cx + (w/8)·cos a`, `y = vale + (vale − y(picoᵢ))·sin a`), e (w/2, h/2).

| Traço | Geometria |
|---|---|
| lenha | `tora((−0,26w, y(0,79)), (0,26w, y(0,56)), 0,07w)` e `tora((0,26w, y(0,79)), (−0,26w, y(0,56)), 0,07w)`; cruzam em y(0,675), escondidas pela base da chama |
| chama | base em (0, y(0,68)), altura em repouso `H = 0,464h` (ver "Chama sempre em pé") |

### Chama sempre em pé (**ajuste na aprovação**)

Quando a fogueira gira, pedras e lenha giram com o objeto; a chama e as fagulhas **não** giram: ficam em pé na tela e as fagulhas sobem para cima da tela, nas duas vistas. No app (`chamaDaFogueira` em `lib/mobilia.ts`), a base da chama é `centro + giro(âncora) + (0, desvio)`:

| Vista | âncora (gira com o objeto) | desvio (para baixo na tela, não gira) |
|---|---|---|
| Cima | (0, 0): o centro, onde a lenha cruza | 0,18m |
| Lado | (0, y(0,68)): sobre o X da lenha | 0 |

Sem giro, dá a base da tabela acima. De cima, o centro não sai do lugar com o giro, então a chama fica sempre no meio da roda; de lado, a base anda com a lenha.

## Distinção entre os glifos de cima

| Glifo | Lê como |
|---|---|
| mesa | retângulo recuado nos 4 lados |
| caixa | X de canto a canto |
| baú | linha alta (0,35) + fecho que desce do meio dela |
| cadeira | uma linha alta (0,28) |
| **armário** | linha no meio (0,45) + 2 riscos curtos subindo da frente, sem tocar a linha |
| **aparador** | linha baixa (0,72) + risco do meio descendo até a frente (T invertido na frente), pegada 4:1 |
| **fogueira** | redonda como o barril, mas com roda dentada (8 juntas), lenha em X e a chama laranja |

## A chama

### Forma (unidade H = 1, origem na base, ponta em (0, −1))

Borda, curvas de Bézier cúbicas (pontos de controle, ponto final):
1. de (0, −1): (0,13, −0,75), (0,40, −0,52) → (0,36, −0,25)
2. (0,33, −0,06), (0,18, 0) → (0, 0)
3. (−0,18, 0), (−0,33, −0,06) → (−0,36, −0,25)
4. (−0,40, −0,52), (−0,13, −0,75) → (0, −1)

Miolo: a mesma curva com escala (0,50; 0,56) e deslocada `y − 0,04` (ponta em −0,60, base em −0,04).

Fagulha: círculo de raio `max(1,2 px de tela; 0,022 do lado menor do objeto)` — 0,022 casa no tamanho padrão (1 casa de lado menor nas duas vistas). No app a régua é o lado menor, e não a casa, porque o desenho do móvel não recebe a grade; esticada, a fagulha cresce junto com a chama.

### Cores (próprias; "Cor" e "Cor da linha" não mudam a chama)

| Parte | Hex | Alpha |
|---|---|---|
| chama (borda) | `#a04a2c` (era `#d0703c` no protótipo) | 1 |
| miolo | `#f0c98a` | animado (0,72 a 0,996) |
| fagulha | `#f6dca8` | animado (0 a 0,84) |

**Ajuste na aprovação:** a borda ficou um tom mais escura e mais quente que `#d0703c`, sem saturar mais, para ter contraste também sobre o chão na vista Lado. Medido (WCAG, mesma conta do protótipo):

| | `#d0703c` (antes) | `#a04a2c` (agora) |
|---|---|---|
| matiz / saturação / luminosidade (HSL) | 21,1° / 0,61 / 0,53 | 15,5° / 0,57 / 0,40 |
| borda sobre o chão padrão (#a8776a), vista Lado | 1,10:1 | **1,57:1** |
| borda sobre o fundo padrão da fogueira (#6d4d45), vista de cima | 2,17:1 | 1,25:1 |
| miolo sobre a borda | 2,21:1 | 3,82:1 |

A chama é mais vermelha que a porta do mapa (`#d08c3a`), para não ser lida como porta. O miolo segue com 4,8:1 sobre o fundo padrão da fogueira e 2,4:1 sobre o chão padrão. De cima a borda perde contraste sobre o fundo escuro (1,25:1), mas ali quem dá a leitura é o miolo claro, agora com o dobro do contraste contra a borda; de Lado a borda passa a separar a chama do chão.

Ordem de desenho: fundo → contorno e glifo → borda da chama → miolo → fagulhas.

### `poseDaChama(tempoMs, fase, reduzir) → { escalaX, escalaY, alpha, fagulhas: [{ x, y, alpha }] }`

Função pura. O código exato que roda no protótipo está nele (bloco `<script id="nucleo">`, também mostrado na página).

- Ciclo: `CICLO_DA_CHAMA_MS = 2400`. `u = frac(tempoMs / 2400 + fase)`. Só harmônicos inteiros do ciclo: não há salto na virada.
- `escalaY = 1 + 0,07·sin(2π·2u) + 0,035·sin(2π·5u + 1,3) + 0,015·sin(2π·9u + 0,4)`, faixa medida [0,905; 1,104]. Pulso principal de 1,2 s; o mais rápido é 3,75 Hz.
- `escalaX = 1 − 0,4·(escalaY − 1) + 0,02·sin(2π·3u + 2,1)`, faixa medida [0,954; 1,058] (quando sobe, afina).
- `alpha` (do **miolo**; a borda fica opaca) `= min(1; 0,86 + 0,10·sin(2π·4u + 0,9) + 0,04·sin(2π·7u + 2,6))`, faixa medida [0,720; 0,996].
- Faixas medidas a cada 1 ms num ciclo inteiro (fase 0).
- A escala da chama tem o pivô na base.
- Fagulhas: sempre 3 entradas (alpha 0 quando apagada), em unidades de H, origem na base da chama, **fora** da escala da chama.

| | F1 | F2 | F3 |
|---|---|---|---|
| `inicio` (fração do ciclo) | 0 | 0,36 | 0,68 |
| `x0` | −0,10 | 0,12 | 0,02 |
| `deriva` | −0,06 | 0,07 | −0,03 |
| `onda` (rad) | 0 | 2,1 | 4,2 |

Vida: `VIDA_DA_FAGULHA = 0,375` do ciclo (900 ms). `p = frac(u − inicio) / 0,375`; `p ≥ 1` → apagada.
- `y = −(0,9 + 0,5·(1 − (1 − p)²))`: nasce logo abaixo da ponta e sobe até 1,4 H, desacelerando.
- `x = x0 + deriva·p + 0,035·sin(2π·1,5p + onda)`.
- `alpha = min(1; p/0,12)·(1 − p)^1,4`.
- No máximo 2 fagulhas visíveis ao mesmo tempo, quase sempre 1.

**Pose fixa** (`reduzir = true`): `escalaX = 1`, `escalaY = 1`, `alpha = 0,90`, as 3 fagulhas com alpha 0. É o mesmo objeto sempre (`POSE_FIXA`).

**Fase**: hash do id do objeto levado a [0, 1) (ex.: FNV-1a de 32 bits / 2³²). Duas fogueiras não pulsam juntas, e a mesma fogueira tem a mesma fase no editor e na tela do jogador (o relógio é o de cada tela; não precisa sincronizar).

## Transporte para o Pixi

No app: `client/src/pixi/chamasDasFogueiras.ts`.

- **Desenhar uma vez.** `GraphicsContext` da borda, do miolo e da fagulha, compartilhados por todas as fogueiras da tela. Desenhados a 256 unidades por H (não em H = 1): o Pixi divide a curva com tolerância de ~0,5 unidade, e em H = 1 a chama sairia um losango. Nada de `clear()` por quadro, e o desenho do móvel (`drawPropSilhouettes`) nunca é repintado por causa da chama.
- **Árvore por fogueira** (com a chama sempre em pé): `Container` (posição = base da chama na tela, **sem** `rotation`) → `borda` e `miolo` (`Graphics` com o contexto compartilhado, `scale = H/256 × pose`) e 3 fagulhas (`Graphics` do círculo; a escala do raio é recalculada só quando o zoom ou o tamanho mudam). No editor o nó fica logo acima do desenho do móvel, com o mesmo alpha (fantasma do "Oculto no editor", "Oculto para jogadores"); no jogador, numa camada logo acima das silhuetas.
- **Por quadro, só números**: `borda.scale.set(sx, sy)`, `miolo.scale.set(sx, sy)`, `miolo.alpha = alpha`, e em cada fagulha `position.set(x·H, y·H)` e `alpha`. **Sem `visible` por quadro:** no Pixi 8, trocar `visible` marca `structureDidChange` no grupo de render e refaz as instruções do mapa inteiro; fagulha apagada fica com alpha 0 (custa três círculos).
- **Ticker**: o callback entra quando o mapa (no jogador, a visão) tem ≥ 1 fogueira e sai com 0 fogueiras ou com Menos movimento. Os dois apps renderizam a cada quadro do ticker; não há render sob demanda.
- **Menos movimento**: `matchMedia('(prefers-reduced-motion: reduce)')`, relido como nas nuvens: a cada passada de desenho do mapa e, com a chama viva, uma vez por segundo. Ligado, aplica a `POSE_FIXA` uma vez e tira o callback do ticker; desligado de novo, a próxima passada religa.
- **Névoa**: a chama e as fagulhas ficam na mesma camada (ou máscara) dos móveis. Fogueira escondida pela névoa esconde a chama junto.
- **Testes sugeridos** (sem tela): `poseDaChama(t)` igual a `poseDaChama(t + 2400)` em escala, alpha e alpha das fagulhas (a posição de fagulha apagada pode diferir por arredondamento no instante em que ela morre: compare `alpha·y`, não `y`); faixas de escala e alpha; `reduzir` devolve a pose fixa; sempre 3 fagulhas; fogueiras com ids diferentes têm fases diferentes; glifos de cada tipo e vista com tamanho não desenhável devolvem `[]`.
