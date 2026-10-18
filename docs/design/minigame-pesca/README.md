# Minigame de pesca: protótipo jogável (18/10/2026)

Protótipo do segundo minigame do **pino de minigame** (ícone de controle), a pesca, com mecânica inspirada na barra de pesca do Stardew Valley. Página avulsa, só design: nada disto está no app ainda. É para o usuário jogar antes de qualquer código em `client/`.

## O que tem nesta pasta

| Caminho | O que é |
|---|---|
| `prototipo/index.html` | O protótipo, num arquivo só (sem doctype: o publicador embrulha), 91 KB. "Ver como: Jogador \| Mestre", no topo, troca a visão. |
| `provas/gerar-provas.cjs` | Roda os 16 testes e gera todas as provas: `node docs/design/minigame-pesca/provas/gerar-provas.cjs` (Edge sem janela, Playwright do repo; `--sem-conferir` pula o `conferir-som`). |
| `provas/pagina-de-teste.html` | O invólucro com doctype, charset e viewport usado nos testes. Gerado; o `index.html` não muda. |
| `provas/testes.json` | Resultado de cada teste, com os números (robô por peixe, desempenho, som). |
| `provas/folha-contato.png` | 15 quadros do ciclo no Normal (lance, espera, fisgada, puxada, pegou), lago e coluna lado a lado, tempo embaixo de cada um. |
| `provas/grafico-movimento.png` | Peixe, barra e medidor amostrados a cada 0,1 s: o mesmo robô, o mesmo peixe e a mesma semente no Normal e no Extremo. |
| `provas/onda-som.png` | Envoltória de todos os sons num ciclo, com o instante de cada um na mesma linha do tempo. |
| `provas/som/` | `sons-da-pesca.wav`, espectrograma, medidas e `conferir-som.txt`; o adaptador `sons-da-pesca.ts` é gerado do bloco `SOM` do protótipo. |
| `provas/*.png` (4 prints) | Jogador em 1440 e 390 px na puxada, resultado em 1440, mestre em 1440. |

Nada de sprite, som, nome ou texto do Stardew: os 10 peixes são pixel art gerada em código a partir de parâmetros (corpo, cauda, barbatana, padrão, extra), os nomes são originais e os sons são sintetizados em WebAudio.

## O que o protótipo tem

- **Convite:** Bento, o barqueiro (retrato em pixel art; nome e fala editáveis pelo mestre), cartões Normal e Extremo, prêmio, consequência, o seu cesto, "Ir pescar", som ligado ou desligado (guardado em `localStorage` com `try/catch`, junto com a dificuldade).
- **Lance:** segura e solta. A força vai e volta de 0 a 100% (ciclo de 1,4 s no Normal, 1,0 s no Extremo); a coluna vira um medidor com as faixas Perto, Médio e Longe, e a dica diz o que cada faixa rende. A boia voa em arco e cai com respingo.
- **Espera:** a boia balança; beliscadas falsas mergulham a boia e fazem um "plic". Apertar antes do "!" recolhe a linha vazia e volta ao lance.
- **Fisgada:** "!" sobre o pescador e na coluna, a boia afunda, e o medidor ao lado vira a janela que se esgota em vermelho. Passou a janela, o peixe foge.
- **Puxada:** coluna de água com a barra verde (sobe enquanto segura, cai com a gravidade, quica leve no fundo), o peixe genérico se mexendo pelo comportamento dele (o nome só aparece no resultado), o medidor de captura que enche com o peixe dentro e esvazia fora, e às vezes um baú. Catraca do molinete a cada trecho de barra subido. No lago, a sombra do peixe puxa a boia.
- **Resultado:** peixe em pixel art numa placa de água, nome, raridade, tamanho em cm, qualidade em estrelas, lance, tempo da puxada, reação, baú e prêmio ou consequência. No pegou, o peixe salta da água para a mão do pescador.
- **Entrada:** `event.code` (Espaço, Seta para cima, W), clique ou toque em qualquer parte da coluna ou do lago (`pointerdown`/`pointerup` com captura, `touch-action: none`), controle pela Gamepad API lido a cada quadro (A ou RT segura; A também começa no convite e no resultado; Start pausa). Esc ou Start pausam; aba escondida pausa sozinha.
- **Mestre:** painel do pino (jogo Dança ou Pesca, quem desafia, fala, nome do lago, dificuldade permitida, prêmio, consequência), recorte do mapa no estilo da casa (chão chapado, linhas finas, portas pequenas) com o pino na margem, e placar ao vivo de você, Iara e Tomé (lançando, esperando, fisgou, puxando com o %, pegou X, escapou, fugiu; cesto e maior peixe) com "Pausar para todos" e "Encerrar para todos" (que viram "Continuar" e "Reabrir"). Com Dança marcada, o convite do jogador fecha com o motivo escrito: a dança tem protótipo próprio.

O pino é o mesmo `<symbol id="pinoControle">` da dança (cabeça de latão `#f2c14e`, contorno `#1b1208`, traço de 1,7), como em `client/src/pixi/drawPins.ts`.

## Números finais

A coluna de água vai de 0 (fundo) a 1 (topo); velocidades em coluna por segundo. A simulação é passo fixo de 1/120 s (bloco `SIM`, puro, sem DOM) e a semente é mulberry32 sobre `id do pino | dificuldade | número do lance`.

| | Normal | Extremo |
|---|---|---|
| Barra verde | 24% da coluna | 15% da coluna |
| Subida segurando / gravidade | +3,0 / −2,3 por s² | +3,4 / −2,9 por s² |
| Velocidade máxima da barra | 1,4 | 1,7 |
| Quique no fundo | 40% da velocidade (só acima de 0,3) | igual |
| Peixe: velocidade máxima base | 0,6 | 0,75 |
| Peixe: mola até o alvo | 20 | 38 |
| Peixe: novo alvo a cada | 0,9 a 1,8 s | 0,4 a 1,1 s |
| Peixe: trancos erráticos | 0,3 por s | 1,0 por s (+3 no lendário) |
| Medidor: começa / enche / esvazia | 30% / +15% por s / −11% por s | **50%** / +22% por s / **−22% por s** (era 30% / −30%; mudado em 18/10/2026, ver abaixo) |
| Janela da fisgada | 0,9 s | 0,5 s |
| Espera até morder | 1,5 a 4,0 s (+20% no lance mais longo) | 1,8 a 5,0 s (+20%) |
| Beliscadas falsas | 0 ou 1 | 0 a 3 |
| Baú: chance / aparece / dura / enche | 20% / 1,2 a 3,5 s / 6 s / 1,4 s na barra | 30% / 1,0 a 3,0 s / 4 s / 1,8 s na barra |
| Cardápio | 6 peixes | os 6 + 3 raros + 1 lendário |
| Robô que segue o peixe (240 puxadas) | pega 100%, 92 perfeitas, 6 s por peixe | pega 37%, 14 perfeitas, 9,6 s por peixe |

- **Comportamentos** (multiplicam intervalo, mola e velocidade): misto 1 / 1 / 1, alvo a até ±0,45 de onde está; disparado 2,0 / 2,2 / 1,1, para e dispara para um ponto a mais de 0,3; suave 1,2 / 0,5 / 0,55, alvo que segue um seno; afunda e flutua 1 / 1 / 1, alvo puxado para o fundo ou para o topo, com 18% de chance de subir ou descer.
- **Baú:** enquanto ele está dentro da barra, o medidor não cai (mas só sobe com o peixe dentro). Só vem junto se o peixe vier: pegou o baú e o peixe escapou, ele vai embora.
- **Captura perfeita:** o peixe nunca saiu da barra. Dá +1 estrela.
- **Qualidade (1 a 4 estrelas):** 1 + lance Médio (≥ 40%) + lance Longe (≥ 80%) + captura perfeita.
- **Sorteio do peixe pela distância (d de 0 a 1):** comum 10 × (1,3 − 0,6d), incomum 6 × (0,7 + 0,6d), raro 2,5 × (0,3 + 1,4d), lendário 2 × (d − 0,6) / 0,4 só acima de 0,6. Tamanho: mínimo + faixa × sorteio^(1,6 − 0,9d), então longe sai maior.
- **Simulados:** Iara vê o peixe com 0,13 s de atraso e reage à fisgada em 0,34 s; Tomé, 0,22 s e 0,46 s (±0,08 por lance; no Extremo, Tomé às vezes perde a janela). Com "O jogador escolhe", Iara pesca no Extremo e Tomé no Normal.

| Peixe | Comportamento | Raridade | Tamanho | Onde | Robô no Extremo |
|---|---|---|---|---|---|
| Carpa-runa | misto | comum | 24 a 58 cm | os dois | 96% |
| Enguia de caverna | suave | comum | 40 a 95 cm | os dois | 33% |
| Lume-de-poça | flutua | comum | 7 a 16 cm | os dois | 29% |
| Piaba-ossuda | disparado | comum | 10 a 22 cm | os dois | 17% |
| Bagre-de-pedra | afunda | incomum | 35 a 90 cm | os dois | 17% |
| Truta-do-fosso | misto (×1,2) | incomum | 20 a 46 cm | os dois | 96% |
| Linguado-espectro | afunda (×1,15) | raro | 28 a 55 cm | só Extremo | 42% |
| Lampreia-de-cobre | disparado | raro | 45 a 100 cm | só Extremo | 4% |
| Esturjão-de-cristal | suave (×0,95) | raro | 70 a 150 cm | só Extremo | 21% |
| Coroa-do-Abismo | misto (×2,1, trancos +3) | lendário | 140 a 210 cm | só Extremo | 13% |

No Normal o robô pega os 6 em 100%: lá a diferença entre peixes é tempo, não chance.

## Conferido

- `provas/testes.json`: **16 de 16 testes passando**: mesma semente dá a mesma puxada (e outra semente, outra); o robô pega 100% no Normal e 37% no Extremo, com todo peixe do Extremo pegável; 6.000 sorteios do Normal sem raro nem lendário; no Extremo longe saem raros e o lendário, e o lendário nunca sai com lance até 60%; medidor zerado = escapou; teclado (Espaço, Seta para cima, W), toque e controle falso injetado (A, RT, Start); fisgada perdida = "Fugiu"; apertar na espera recolhe a linha; uma pesca inteira no Normal por eventos de teclado em tempo real termina com "Pegou"; mestre (placar, pausar, continuar, encerrar, reabrir, campos mudando o convite e o topo); nenhum erro no console; sem rolagem horizontal em 1440, 1024 e 390 px (lance, puxada, resultado, mestre).
- Desempenho no Edge sem janela, durante a puxada: intervalo entre quadros p50 16,7 ms e p95 16,8 ms, trabalho do quadro p95 0,8 ms (máximo 1,4 ms), nenhuma tarefa longa.
- Som (medido, `provas/som/`): o ciclo inteiro sai com pico de −2,55 dBTP, −19,2 LUFS, 0 amostra cortada, 0 clique; o `conferir-som.cjs` dá **aprovado nas medidas** (mediana das aprovadas −18,6 LUFS). O splash era o pico (−10 dBFS com o resto em −13 a −20): baixou 5 dB antes de subir o ganho geral. Todo ganho de instrumento nasce em 0 (`vca()`). **Medir não é ouvir:** o `.wav` está em `provas/som/` para alguém ouvir.
- Movimento revisado com a skill `review-animations`: a água parava de andar só no movimento reduzido da tocha, não nas ondinhas (corrigido), e o medidor do placar pulava a cada 250 ms (agora tem transição linear de 250 ms). Entradas do resultado em 220 ms com curva de saída forte e escalonamento de 40 ms; pausa por teclado sem animação.
- `tsc --noEmit` do `client/` sem erro (nada em `client/` foi tocado).

**Não conferido:** celular de verdade, Safari e iPhone (desbloqueio do áudio, toque segurado longo), controle físico, leitor de tela, Firefox, e ninguém ouviu os sons. A skill `animate` não foi carregada antes de escrever o movimento (só a revisão depois). Os prints são do Edge sem janela, com fontes do Windows.

## Em aberto (decisão do usuário)

1. Bento, o barqueiro, os 10 nomes de peixe e os textos de prêmio e consequência ficam?
2. O baú só vem se o peixe vier (como na referência). Ou fica com o jogador mesmo se o peixe escapar?
3. "Fugiu" (perdeu a janela) aplica a consequência, igual a "Escapou". Deveria ser mais leve?
4. Puxar antes do "!" só recolhe a linha, sem consequência. Basta?
5. No Extremo, com o robô, metade das brigas acaba em 7,4 s, 90% em 24 s, e 6% passam de 30 s (a mais longa, 68 s). Tamanho certo para a mesa?
6. Na barra aparece um peixe genérico; a espécie só é revelada no resultado. Ou mostrar o peixe de verdade?
7. Com "O jogador escolhe", os simulados fixam Iara no Extremo e Tomé no Normal. No app, cada um escolhe.
8. Não houve desenho no Figma (plugin desligado): este protótipo é a peça de revisão.

Página publicada (privada): https://claude.ai/artifact/JLNZJ5jms8oXrWbFvFoWU4

## Ajuste do Extremo (18/10/2026)

Com o robô que joga como gente (reação 250 ± 60 ms, erro de leitura ± 0,03, regra de teste de jogos), o Extremo do app pegava só 12% e 7 dos 10 peixes nunca saíam: o medidor começava em 30% e esvaziava 30% por segundo, então 1 s fora da barra perdia o peixe. O usuário escolheu "facilitar um pouco". Mudou só o medidor do Extremo: começa em **50%** e esvazia **22% por segundo**. Peixe, barra e velocidade ficaram iguais.

- Robô humano no Extremo: ~28% pegos (provas do protótipo 28,3%; varredura com 80 tentativas por peixe: todos saem às vezes, o mais difícil é a piaba-ossuda com 4%). Normal segue em ~100%.
- Os testes do `provas/gerar-provas.cjs` trocaram o robô rápido (reação 0,12 s, sem erro) pelo robô humano, com as metas Normal >= 70% e Extremo entre 15% e 40%: 16 de 16.
