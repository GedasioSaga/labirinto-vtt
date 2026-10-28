# Guia de estilo do Desenhado

Regras curtas. Valem para **todas** as texturas e ondas. Quando uma regra daqui e o seu
gosto discordarem, vale a regra; quando a regra não cobrir o caso, vale a pergunta: "isto
ficaria bonito numa campina de 40 x 40 casas, vista a 35%?"

## 1. O que o usuário pediu (28/10/2026)

Crítica ao protótipo (uma copa de árvore cheia de escamas redondas): *"tá muito detalhado,
cheio de bolinhas, fica estranho, faz algo mais bonito."* Virou regra para tudo:

1. **Nada de micro-detalhe repetido**: nada de bolinhas, escamas, pontilhado, tracinho em
   grade. Se um elemento aparece mais de 20 vezes por casa, ele não deveria existir.
2. **Formas maiores e calmas.** Uma copa é 3 a 5 lobos grandes, não 40 bolinhas.
3. **Pinceladas poucas e firmes**, todas na mesma direção geral, nunca hachura cruzada e
   nunca em fileira (fileira vira listra).
4. **Sombra suave**: borda esfumada, alfa até 0,25, deslocada para baixo e para a direita.
5. **Contorno como no protótipo do Fogo**: a própria cor escurecida, nunca preto (seção 4).
6. **Cores contidas, sem listra, nada estourado.** Nenhum tom fora da paleta; nenhuma
   faixa regular; nada mais saturado que a cor base da paleta.
7. *"A textura tem que ser boa, feita com calma e cuidado, e ambientes grandes não podem
   parecer repetidos."* Este é o critério principal: a folha mostra 40 x 40 casas e é ali
   que a textura é julgada, não no close.

Referências aprovadas: a grama do protótipo do Fogo
(`docs/design/objeto-fogo/prototipo.html`, `pintarGrama` e `pintarTufos`: risquinhos de
capim de 3 traços e florzinhas de 4 pétalas, "grama bonitinha e desenhada") e a vila do
Meio-Termo (`docs/design/vila-meio-termo/`).

## 2. Onde mora o detalhe

| Camada | O que leva | O que NÃO leva |
|---|---|---|
| **Base** (base-1..3) | o campo de cor: manchas largas (2 a 4 casas), poucas pinceladas, grão de papel leve | qualquer coisa que o olho reconheça e possa achar de novo 8 casas adiante: tufo, flor, pedra, mancha escura pequena, trinca |
| **Atlas** (detalhes) | os marcos: tufo, flor, seixo, folha caída, copa, poça | textura de fundo |

O app espalha o atlas pelo mundo sem período (CONTRATO.md). Um marco na base vira uma
repetição a cada 8 casas que o olho acha em segundos.

## 3. Paleta base

A paleta do Meio-Termo, 38 cores (`client/src/texturas/meioTermo/paleta.ts`;
`docs/design/vila-meio-termo/README.md`). As de uso mais comum já estão como constantes em
`shaders/base.gdshaderinc`:

| Uso | Constante (hex) |
|---|---|
| grama | `GRAMA` `#8cbf80`, `GRAMA_REALCE` `#a2cc92`, `GRAMA_SOMBRA` `#76ac6d`, `TUFO` `#689c5f` |
| terra e caminho | `TERRA` `#dda56c`, `TERRA_SOMBRA` `#c78d58`, `SEIXO` `#c4915f` |
| praça e pedra | `PRACA` `#dcd0b6`, `PRACA_REALCE` `#ebe2cd`, `PRACA_SOMBRA` `#bcae94`, `PEDRA` `#c3c0b2` |
| madeira | `CARVALHO` `#a07b51`, `NOGUEIRA` `#775739`, `PINHO` `#b9995f` |
| folha e copa | `FOLHA` `#55ae74`, `FOLHA_ESCURA` `#469a63`, `FOLHA_CONTORNO` `#356f49` |
| flores | `ROSA` `#e8a2c4`, `AMARELO` `#f0d266`, `BRANCO` `#f3efe2`, `VIOLETA` `#a87fcb`, miolo `MIOLO` `#c98f3a` |
| sombra | `SOMBRA` (marrom, 52/36/24), `SOMBRA_VERDE` (sobre grama) |

Cor da paleta que não está em `base.gdshaderinc` (barranco `#aa745c`, palha `#d6b56a`,
ardósia `#5f6a66`, água `#40707e`, musgo `#6f7d4b`, granito `#9a968b`, telhas
`#43639a` / `#7189a6` / `#b56e50` / `#7f9a64` / `#867a6a`): declare como `const vec3` **no
seu** `textura.gdshader`, com o hex de `paleta.ts` no comentário. Nunca edite a base.

Faixas de valor:

- Mancha da base: a luminância varia no máximo ±8% em torno da cor base.
- Grão de papel: até 3% (o `grao()` da base já está nessa faixa).
- `tom.amplitude` do `config.json`: até 0,06 em chão natural, até 0,04 em piso com estrutura.
- Cor média da textura (o exportador grava `corMedia`) perto da cor base da paleta: é ela
  que se vê a 35% e na miniatura.

## 4. Tons, luz e contorno

- **Luz** de cima à esquerda. Sombra para baixo e para a direita, deslocada 1 a 2 px do
  mundo, alfa até 0,25, borda esfumada.
- **Realce e sombra** pela receita do Meio-Termo (`meioTermo/tons.ts`): realce = luz +0,09
  com o matiz puxado 12% para o amarelo; sombra = luz −0,12 e saturação +0,05.
  Aproximação pronta no cabeçalho: `realce_de(c)`, `sombra_de(c)`.
- **Contorno** = a própria cor a 60% da luz, nunca abaixo de luminância 0,06, nunca preto:
  `contorno_de(c)`.
- **Espessura do contorno** (em px do mundo, 64 px = 1 casa): 1,5 a 2 px em seixo, pedra,
  copa e poça (2 px = 0,032 casa, o traço do protótipo do Fogo). Tufo de capim não tem
  contorno: o próprio traço é o desenho. **A base nunca tem contorno.**
- Borda sempre suavizada com `cobre(d, px)`: nada de serrilhado em zoom nenhum.

## 5. Os três zooms

O app vai de 10% a 400%; o usuário usa de 35% a 300%. A folha da textura mostra a área a
50% e a 100% e o close a 300%; a folha do lote mostra a área a 25%. O 35% fica entre as
duas: se a 50% o detalhe já parece pimenta, a 35% vira pó.

| Zoom | 1 casa na tela | O que tem de funcionar |
|---|---|---|
| **35%** | 22 px | Só o campo de cor e os grupos (moitas e clareiras) se leem. Detalhe menor que 1/4 de casa vira pó: não pode virar pontilhado sujo. Nada na base com ciclo menor que 4 px (vira moiré ou lama no mipmap). |
| **100%** | 64 px | O zoom de trabalho. Tufo e flor nítidos, contorno de 1,5 a 2 px, nenhuma emenda, nenhuma repetição na área grande. |
| **300%** | 192 px | A base aparece 3 vezes maior: não pode depender de nitidez de pixel (só manchas e pinceladas largas). O atlas tem 128 px por casa e aparece 1,5 vez maior: sem traço de 1 px de imagem, sem borda dura. |

## 6. Densidade dos detalhes

- Chão natural: `densidade` de 0,3 a 0,8 detalhe por casa; `agrupamento` de 0,7 a 1 (moitas
  e clareiras). O protótipo do Fogo tinha 3 tufos por casa: de perto é bonito, a 35% vira
  pontilhado. Prefira menos e agrupado. Medido no piloto `grama` (28/10): com 0,9 tufo
  pequeno e escuro por casa, a área a 50% virou pimenta espalhada por igual; com 0,45,
  metade dos detalhes sendo touceiras (um tufo grande e 1 ou 2 menores) e o tufo perto do
  tom do chão, ficou um campo com moitas e clareiras.
- Detalhe de 2 peças iguais lado a lado (par simétrico) vira carimbo: o olho acha o mesmo
  par de novo. Numa touceira, um grande e os outros menores, para os lados.
- Flor: no máximo 15% dos detalhes (pelos `pesos`), e só onde a referência tem flor.
- Piso com estrutura (lajota, tábua, calçamento): detalhe raro (0 a 0,3 por casa): mancha,
  musgo na junta, tábua gasta.
- Copa e outras formas grandes: `celulaCasas: 2`.
