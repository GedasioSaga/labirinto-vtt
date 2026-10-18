# Provas da pesca no app (18/10/2026)

Pela regra de teste de jogos: camadas automáticas primeiro, o usuário joga por último (e é esse teste que decide). Tudo aqui usa o **código do app** (`client/src/minigames/pesca/tela/motor.ts`, `sim.ts`, `som.ts`, carregados pelo Vite na vitrine), não o protótipo.

```
node docs/design/minigame-pesca/provas-app/gerar-provas-app.cjs            (tudo, ~3 min, Edge sem janela)
node docs/design/minigame-pesca/provas-app/gerar-provas-app.cjs --sem-conferir
```

Saída: `medidas.json` (todos os números), `grafico-movimento.png`, `folha-contato.png`, `onda-som.png`, `som/*.wav` e `som/conferir-som.txt`. Os 4 prints de layout (`01`..`04`) são de antes e o script não mexe neles.

## Robô que joga como gente

Reação de 250 ± 60 ms (nunca abaixo de 120 ms) na fisgada e na leitura do peixe, erro de ± 0,03 da coluna na posição lida, olho que relê a cada 0,15 s, mão a 60 Hz, força do lance sorteada entre 35% e 95%. Semente fixa; 240 lances por dificuldade pelo `MotorDaPesca`, com o peixe sorteado pelo lance como no jogo. Metas escritas antes de rodar.

| | Normal | Extremo |
|---|---|---|
| Meta | >= 70% pegos | entre 15% e 40% |
| **Pegos** | **99,6%** (bateu) | **12,1% (fora da meta)** |
| Escapou na puxada | 0,4% | 87,9% |
| Fugiu (perdeu a fisgada) | 0% (janela 0,9 s; reação máx. 0,41 s) | 0% (janela 0,5 s; reação máx. 0,42 s) |
| Perfeitos | 34 | 8 |
| Puxada média até pegar | 7,7 s | 8,3 s |

No Extremo, Piaba, Lume, Enguia, Lampreia, Esturjão, Linguado e Coroa saíram com 0 pegos; Carpa 21/42, Truta 6/25, Bagre 2/16. **Os números do jogo não foram mexidos** (o usuário aprovou jogando). Para decidir, o mesmo jogador no Extremo com outra mão:

| Variação | Pegos no Extremo |
|---|---|
| reação 200 ± 50 ms | 17,9% |
| reação 150 ± 40 ms | 27,9% |
| 250 ± 60 ms sem erro de leitura | 14,6% |
| 120 ms fixa, sem erro (o robô do protótipo) | 41,7% |

Ou seja: o Extremo só entra na faixa para quem reage em ~200 ms ou menos. Se o usuário achar o Extremo injusto ao jogar, o ajuste é de número (tamanho da barra, perda do medidor), não de desenho.

## Gráfico do movimento

`grafico-movimento.png`: peixe, barra e medidor a cada 0,1 s, com a faixa de "segurando o botão": a primeira puxada Normal (Enguia, pegou em 6,8 s), a primeira Extremo (Lampreia, escapou em 2,4 s) e a primeira Extremo que pegou (Truta, 7,0 s). Conferido em **todos** os passos de puxada dos 480 lances (401 mil passos): peixe sempre em 0,03..0,97; barra nunca acima do topo nem abaixo do fundo; medidor sobe a cada passo com o peixe dentro e nunca sobe com ele fora. Mesma semente = mesmos lances.

## Folha de contato

`folha-contato.png`: 14 quadros da vitrine em tempo real (lance parado, força 40% e 76%, voo, espera, "!", puxada 37/60/82%, pegou, peixe na mão, resultado, cesto), com o relógio do jogo embaixo. O jogo congela no quadro de cada print, então o tempo é o do jogo. O quadro "puxada 6,5 s" não existiu: a puxada acabou antes.

## Som (medir não é ouvir)

`onda-som.png`: em cima, os sons que o motor pediu na puxada Normal do gráfico, na **mesma linha do tempo** do gráfico (15 dentes de catraca e o "pegou"); embaixo, todos os sons na sequência de provas do `som.ts`. Medido no barramento do jogo (GANHO 1,7), volume 1:

- Nenhum corte e nenhum clique em nenhum som; a sequência tem pico verdadeiro −2,6 dBTP e −19,2 LUFS.
- `scripts/conferir-som.cjs` no adaptador `som/sons-da-pesca-app.ts`: **aprovado nas medidas**.
- **Achado:** o `splash` na força máxima (lance de 100%) chega a **−0,91 dBTP**, 0,09 dB acima do limite de −1 dBTP do `conferir-som`. Só no lance mais longo; não mexi no som.
- Ouça `som/*.wav` (um por som, `sequencia.wav` e `puxada-normal-do-grafico.wav`): nenhuma medida diz se cansa.

## Travada

Vitrine `?tela=jogo&lances=3`, 1440x900, com som, 3 lances em tempo real sem prints: **p95 do quadro 16,8 ms** na puxada (1.611 quadros), trabalho do quadro p95 0,5 ms (máx. 1,4 ms), **nenhuma tarefa longa** (nem acima de 50 ms). Edge sem janela; não é o aparelho do jogador.

## Falta o usuário

Jogar 3 rodadas em cada dificuldade e responder: foi justo ou deu raiva (em que momento)? Algo lento, rápido ou estranho? Algum som cansou?
