# Minigame de dança: protótipo jogável (12/10/2026)

Protótipo do **pino de minigame** (ícone de controle) com o primeiro minigame, a dança em "setas no ritmo". Página avulsa, só design: nada disto está no app ainda. É para o usuário jogar antes de qualquer código em `client/`.

## O que tem nesta pasta

| Caminho | O que é |
|---|---|
| `prototipo/index.html` | O protótipo, num arquivo só (sem doctype: o publicador embrulha). "Ver como: Jogador \| Mestre", no topo, troca a visão. |
| `provas/gerar-provas.cjs` | Roda os 17 testes e gera todas as provas: `node docs/design/minigame-danca/provas/gerar-provas.cjs` (Edge sem janela, Playwright do repo). |
| `provas/pagina-de-teste.html` | O invólucro com doctype, charset e viewport usado nos testes. Gerado; o `index.html` não muda. |
| `provas/testes.json` | Resultado de cada teste, com os números. |
| `provas/folha-poses.png`, `folha-porta.png`, `folha-julgamento.png` | Folhas de contato com o tempo embaixo de cada quadro. |
| `provas/grafico-movimento.png` | Estado amostrado a cada 0,1 s sem desenhar: porta, dançarino, holofote e julgamento. |
| `provas/onda-som.png` | Envoltória da faixa demo e dos sons de acerto e erro, com as setas do Expert na mesma linha do tempo. |
| `provas/som/` | `.wav` da faixa e dos sons, espectrogramas e medidas do `scripts/conferir-som.cjs`, e os adaptadores `.ts` (gerados do bloco `SOM` do protótipo). |
| `provas/*.png` (4 prints) | Jogador em 1440 e 390 px no meio da música, mestre em 1440, resultado com a porta aberta. |

A música e o GIF da referência (`Minigames/Dança/`) **não** foram copiados: o dançarino é pixel art original desenhado em código e a faixa demo é original, sintetizada em WebAudio.

## O que o protótipo tem

- **Convite:** Dona Ziza (retrato em pixel art, nome e fala editáveis pelo mestre), cartões Diversão e Expert, nota mínima, prêmio, música, "Entrar na pista", "Ajustar atraso", teclas (Setas e WASD ou Setas e DFJK) e "Som do acerto".
- **Ajustar atraso:** metrônomo de 4 batidas para entrar e 8 para medir, régua com cada toque, média aparada vira o ajuste; ajuste à mão de 5 em 5 ms; guardado em `localStorage` (com `try/catch`).
- **Pista:** 4 trilhas (← ↓ ↑ →), receptores embaixo, setas descendo coloridas pela divisão do tempo (latão = semínima, azul = colcheia, violeta = semicolcheia), linhas de batida, julgamento, combo, pontos, precisão, barra da música, vida no Expert, pausa (Esc, botão ou Start do controle; continua com 3, 2, 1). Contagem 3, 2, 1 sobre a contagem da faixa.
- **Palco:** porta de pedra ao fundo com 4 runas que acendem conforme a música anda (se a nota está passando), você de costas no centro sob o holofote, Iara e Tomé (simulados) menores ao lado. Cada acerto faz a pose da seta; duas setas juntas fazem a pose combinada; errar tropeça (na Diversão, só um "ops"). Combo 10, 25 e 50 abrem o holofote; a partir de 25 o chão acende na batida.
- **Resultado:** nota S a D (ou "Falhou"), precisão, combo máximo, pontos, contagem Perfeito/Bom/Ok/Errou, seguradas no Expert, prêmio ou consequência, a mesa inteira e a porta abrindo (2,4 s) quando passa.
- **Entrada:** teclado (`event.code`, então vale em qualquer layout), 4 botões grandes na tela (`pointerdown`, `touch-action: none`) e controle pela Gamepad API lido a cada quadro (direcional, analógico, losango de botões, LB/RB). O instante do toque vem de `event.timeStamp` (ou `gamepad.timestamp`) e é levado para o relógio do áudio por `getOutputTimestamp()`; sem ele, `currentTime − outputLatency`.
- **Mestre:** painel do pino (quem desafia, fala, música demo ou importada, dificuldade permitida, nota mínima, porta ligada, prêmio, consequência), recorte do mapa com o pino novo ligado à porta, os 5 tipos de pino lado a lado, e placar ao vivo (você e os 2 simulados: precisão, combo, vida no Expert) com "Pausar para todos" e "Encerrar para todos".
- **Música importada:** decodifica, acha BPM e primeira batida offline (fluxo de energia em 3 faixas, autocorrelação, ajuste fino por DFT, fase), mostra a confiança, deixa conferir com metrônomo, bater o tempo (8 toques, reta por mínimos quadrados) e ajustar ±0,1 BPM e ±10 ms.

O pino novo segue o desenho dos atuais (`client/src/pixi/drawPins.ts`): cabeça de latão `#f2c14e`, contorno `#1b1208`, símbolo em traço de 1,7. As coordenadas do controle, no formato de `PIN_LEVER_SYMBOL`, estão no `<symbol id="pinoControle">` do protótipo.

## Números finais

| | Diversão | Expert |
|---|---|---|
| Janelas Perfeito / Bom / Ok | ±60 / ±110 / ±160 ms | ±30 / ±60 / ±100 ms |
| Toque adiantado demais | ignorado | até 160 ms antes = Errou |
| Tempo de queda (topo ao receptor) | 1,9 s | 1,25 s |
| Onde caem setas | só na batida, força ≥ 0,5, no máximo 3 por compasso, intervalo ≥ 450 ms e ≥ 1 batida | semínima com força ≥ 0,3, colcheia ≥ 0,5, semicolcheia ≥ 0,62; intervalo ≥ 100 ms; no máximo 8 semicolcheias seguidas |
| Saltos e seguradas | nunca | salto no começo de seção (prato); segurada onde a nota dura ≥ 1,5 batida |
| Mesma seta seguida | nunca 4; 3 é raro | nunca 4; nunca repete em semicolcheia |
| Vida | não tem; Errou não derruba | começa em 60; Perfeito +2, Bom +1, Ok 0, Errou −9, Soltou −6; zero = Falhou |
| Faixa demo | 61 setas, 1,47 por s (pico 1,75) | 158 setas, 5 saltos, 5 seguradas, 3,7 por s (pico 5) |

- Precisão: Perfeito 100, Bom 75, Ok 40, Errou 0, segurada inteira 100, dividido pelos itens. Notas: S ≥ 95%, A ≥ 88%, B ≥ 78%, C ≥ 65%, D abaixo. Pontos: até 1.000.000.
- Coreografia: semente = id do pino + dificuldade (mulberry32). A faixa demo usa os ataques que ela mesma toca (bumbo, caixa, palma, baixo, tema); a importada usa a grade da batida, puxada pela força do ataque em cada ponto.
- Simulados: Iara erra o tempo com desvio de 21 ms (+4 ms de atraso médio) e perde 2,5% das setas; Tomé, 38 ms (+12 ms) e 7%. Erram mais onde as setas apertam.
- **MP3 da referência:** o detector achou **119,75 BPM**, primeira batida em 0,924 s, confiança alta (41,45 s de áudio). Não arredondou para 120 porque 120 explica a música pior que 119,75.
- Faixa demo: 116 BPM detectados certo (fase errada em 9 ms); cliques sintéticos a 95 e 140 BPM também (fase com erro de até 13 ms).

## Conferido

- `provas/testes.json`: **17 de 17 testes passando**: bordas exatas das janelas nas duas dificuldades; coreografia igual com a mesma semente e diferente com outra; Diversão sem saltos, sem seguradas e dentro da densidade; Expert com saltos e seguradas; toda seta da demo cai num ataque da música; BPM da demo, de cliques sintéticos e do tempo batido; teclado (setas, WASD, DFJK), toque na tela e controle (falso, injetado na Gamepad API); uma Diversão inteira tocada por eventos de teclado termina com S; no Expert sem tocar, a vida zera e encerra com "Falhou"; nenhum erro no console; sem rolagem horizontal em 1440, 1024 e 390 px (convite, pista, resultado, mestre).
- Desempenho no Chrome/Edge sem janela, durante a música: intervalo entre quadros p50 16,7 ms e p95 16,8 ms, trabalho do quadro p95 0,7 ms (máximo 12,8 ms), nenhuma tarefa longa.
- Som (medido, `provas/som/`): faixa demo com pico de −6,3 dBTP, −20,0 LUFS, sem amostra cortada. O estalo que o `conferir-som.cjs` apontava em 7,500 s foi corrigido: o `GainNode` nasce com ganho 1 e, quando o chimbal começava exatamente numa amostra, passava 1 amostra cheia antes do envelope valer. Agora todo ganho de instrumento nasce em 0 (`vca()` no bloco `SOM`), e a faixa demo sai **aprovada nas medidas**, com 0 estalos. Os sons de acerto e erro saem a −35,5 LUFS de propósito (são "toc" curtos por baixo da música); o `conferir-som` reprova por estarem 16,9 LU abaixo das transições, que é a régua errada para eles. **Medir não é ouvir:** os `.wav` estão em `provas/som/` para alguém ouvir.
- `tsc --noEmit` do `client/` sem erro (nada em `client/` foi tocado).

**Não conferido:** celular de verdade, Safari e iPhone (desbloqueio do áudio, `getOutputTimestamp`), latência real de fone Bluetooth, controle físico, leitor de tela, Firefox. Os prints são do Edge sem janela, com fontes do Windows.

## Em aberto (decisão do usuário)

1. A faixa demo e a Dona Ziza (nome e fala) ficam como estão?
2. Notas e nota mínima padrão (hoje B): os cortes S 95, A 88, B 78, C 65 servem?
3. Na Diversão, "Errou" zera o combo (sem vida, som baixo, só um "ops"). Ou deveria só diminuir o combo?
4. A tecla D é → no WASD e ← no DFJK; o jogador escolhe o jeito no convite. Basta?
5. "Som do acerto" começa ligado. Começa desligado?
6. Pausar no meio de uma segurada conta como segurada. Certo?
7. A referência deu 119,75 BPM: o mestre confere com "Conferir com metrônomo" antes de usar.
8. Na visão do mestre a música continua (é o placar ao vivo); as setas do jogador passam sem resposta até voltar. No app, mestre e jogador são aparelhos diferentes.
9. Não houve desenho no Figma: este protótipo é a peça de revisão.

Página publicada (privada): https://claude.ai/artifact/RpB8WCEhAnNpKZXtPcfKz8
