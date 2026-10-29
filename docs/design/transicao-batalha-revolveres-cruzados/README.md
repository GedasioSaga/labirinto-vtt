# Abertura de batalha: Revólveres cruzados (protótipo)

A pistola roxa de dois canos e o revólver de aço sobem de baixo da tela, de pé e com os canos para cima. Recuam um
pouco, batem um no outro e param em X com um tranco metálico. Os dois engatilham, há um silêncio curto e os dois
atiram, primeiro o aço e logo depois a roxa, com clarão, coice, faíscas e fumaça. Em seguida acende o nome da
batalha em ouro rosé, a fumaça engole a cena e a tela abre para o mapa. Não há sangue, e com o nome vazio a
abertura toca sem nome.

Os dois desenhos são próprios, pintados em canvas no código. Não copiam as imagens de referência e não têm
logotipo, medalhão, letra nem número gravado. A roxa é laca roxa com ouro rosé, uma rosa, volutas e uma corrente
com pingente. O aço é envelhecido, com cano longo, tambor de 6 e cabo de madeira quadriculada. As imagens de
referência não entram no repositório.

## Como abrir

Abra `prototipo.html` direto no navegador. Ele precisa de internet, porque o three@0.186.1 vem da CDN, a mesma
versão do app. Os controles da página trocam a abertura (as três que já estão no app entram para comparar), o
nome e o movimento reduzido. A seção "Para decidir" lista o que precisa do seu ok.

## Roteiro (segundos)

| t | o que acontece |
| --- | --- |
| 0 a 0,14 | entra do preto: céu de fim de tarde e silhueta de mesa |
| 0,18 a 0,5 | as armas sobem de baixo da tela e ficam de pé |
| 0,5 a 0,62 | impulso: recuam um pouco |
| 0,62 a 0,78 | golpe acelerando, com rastro |
| 0,78 | tranco: o clank, faíscas e um tremor curto da câmera |
| 1,04 e 1,2 | o aço engatilha (o tambor gira) e depois a roxa |
| 1,3 | silêncio |
| 1,46 e 1,53 | tiro do aço e tiro da roxa |
| 1,86 a 2,24 | o nome acende |
| 2,95 a 3,6 | a fumaça engole a cena |
| 3,58 a 3,8 | fecha; o motor do app abre o mapa em 260 ms |

No movimento reduzido as armas surgem já cruzadas, sem golpe, rastro nem tremor, e os tiros clareiam pouco
(roteiro `ROTEIRO_REDUZIDO`).

## Arquivos

- `src/animacoes/batalha/revolveres-cruzados.ts` e `.json`: a cena e os metadados. A pasta `src/` espelha
  `client/src`, então os imports `../../transicoes/...` resolvem para o código do app, sem cópia (o `tsconfig.json`
  faz isso com `rootDirs` e o `montar.cjs` com um plugin do esbuild).
- `fonte.html`: a página. `prototipo.html` é gerado a partir dela, não edite à mão.
- `montar.cjs`: monta o `prototipo.html`.

## Como refazer e conferir

Da raiz do repositório:

```
node docs/design/transicao-batalha-revolveres-cruzados/montar.cjs
rtk proxy npx tsc --noEmit -p docs/design/transicao-batalha-revolveres-cruzados
```

Para medir o som, copie o `.ts` e o `.json` para um espelho com `animacoes/batalha/` e `transicoes/` e rode
`node scripts/conferir-som.cjs <espelho>/animacoes/batalha/revolveres-cruzados.ts --saida <pasta>`.

## Provas (29/10/2026)

As provas ficaram fora do repositório: folhas de contato, gráfico do movimento a cada 0,1 s, desempenho e o `.wav`.

- Desempenho, Edge com ANGLE D3D11 numa RTX 3050. Com a página aquecida, o primeiro quadro leva de 13 a 24 ms,
  não há tarefa longa e o p95 do quadro é 16,8 ms.
- Desempenho na partida fria, com perfil novo e o cache de shader vazio, a GPU tem uns 0,4 s de trabalho frio.
  Em 2 de 3 medições isso caiu no primeiro quadro, com a cortina ainda preta: uma tarefa longa de 208 e outra de
  255 ms. Na outra medição, a compilação levou 413 ms antes do relógio, sem tarefa longa.
- Som (conferir-som): -20,5 LUFS, contra a mediana de -18,6 das aprovadas. O pico verdadeiro é -1,7 dBTP, sem
  corte, sem clique e com DC de -0,07%. Medir não é ouvir: o veredito é seu, de ouvido.

## Depois do ok

A cena vai para `client/src/animacoes/batalha/` e entra em `aprovadas.json` e no pacote, que o usuário publica.
