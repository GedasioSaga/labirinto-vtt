# Minigame de tiro ao alvo: protótipo jogável (18/10/2026)

Terceiro jogo do pino de minigame, depois da dança e da pesca. É uma galeria de feira: alvos de madeira pintados correm em dois trilhos, goblins de papelão surgem atrás de caixotes e barris, ratos atravessam o chão e morcegos de pano passam no alto. O jogador tem um revólver de seis balas, tempo limitado, combo e precisão. Só design: nada aqui toca em `client/`.

## O que tem nesta pasta

- `prototipo/index.html`: o protótipo inteiro num arquivo só, sem doctype (o invólucro das provas acrescenta). Abra num navegador, ou pelo `provas/pagina-de-teste.html` que o script gera. Tem a visão do jogador e a do mestre ("Ver como", no topo).
- `provas/gerar-provas.cjs`: todas as camadas de teste num comando. Ver "Como rodar as provas".
- `provas/testes.json`: o resultado de cada teste, com os números.
- `provas/folha-contato.png`: 15 quadros do ciclo com o tempo embaixo (convite, contagem, "Já!", tiro e acerto, alvo girando e deitado, erro, clique seco, recarga, engatilhar, combo, sino, resultado e, no Extremo, o aldeão acertado e caindo).
- `provas/grafico-movimento.png`: uma rodada Normal e uma Extremo do robô, amostradas a cada 0,1 s: posição dos alvos e da mira, balas no tambor e pontos contra as linhas das medalhas.
- `provas/onda-som.png`: envoltória do catálogo de sons e de uma rodada inteira, na mesma escala de tempo do gráfico.
- `provas/som/`: `sons-do-tiro.wav` (catálogo, 11,2 s), `rodada-normal.wav` (a rodada do gráfico com o som do jogo, 43,5 s), `medidas.json`, o adaptador `sons-do-tiro.ts` gerado do protótipo e a saída do `conferir-som` (`conferir-som.txt`, espectrograma e medidas).
- Prints de layout: `jogador-1440-rodada.png`, `jogador-390-rodada.png`, `resultado-1440.png` e `mestre-1440.png`.

## O que o protótipo tem

- **Ciclo:** convite, contagem de 1,2 s com "Prontos…" e "Já!", rodada, sino do fim, resultado, e "Jogar de novo" ou "Voltar ao convite".
- **Convite:** a feirante Tia Ferrolha (pixel art própria), a fala, a escolha Normal ou Extremo com o que muda em cada uma, a meta, o prêmio, a consequência, as tentativas restantes e os botões de som e de realejo.
- **Arma:** tambor de 6 balas desenhado no painel, que gira uma câmara por tiro. Recarrega com R, botão direito, o botão "Recarregar", ou X no controle. A recarga leva 1,0 s no Normal e 1,6 s no Extremo e repõe as 6 balas. Atirar sem bala dá clique seco e não conta tiro. Atirar durante a recarga também dá clique seco. Entre dois tiros há 0,22 s de cão.
- **Sensação:** coice da arma, clarão do cano e buraco de bala na parede. O alvo de trilho vira no próprio trilho, o pop-up cai atrás do caixote, a moeda sobe e a garrafa vira estilhaços. Um "+pontos" sobe e some. O tremor de tela dura 0,07 s, ou 0,16 s quando o tiro acerta um proibido. Com `prefers-reduced-motion`, o tremor some, o coice fica em um quarto e o "+pontos" não sobe.
- **Pontos:** o valor do alvo vezes o multiplicador de combo (×1, ×1,5, ×2, ×2,5 e ×3 a cada 5 acertos seguidos), vezes ×1,5 no Extremo. Errar zera o combo. Acertar um proibido custa 50 pontos e também zera o combo. Os pontos nunca ficam negativos.
- **Resultado:** medalha bronze, prata ou ouro (ou nenhuma), pontos, precisão, combo máximo, alvos derrubados, recargas e cliques sem bala. Também mostra o prêmio ou a consequência e as tentativas restantes. A barra das medalhas aparece na rodada e no resultado; o convite diz a meta em texto.
- **Mestre:**
  - Painel do pino: jogo (Dança, Pesca ou Tiro), quem desafia, fala, nome da barraca, como começa ("Jogador toca no pino" ou "Mestre chama"), tentativas de 1 a 5, dificuldade permitida, meta, prêmio e consequência.
  - Recorte do mapa da praça com o pino na frente da barraca.
  - Placar ao vivo com você e dois jogadores simulados (Iara no Extremo, Tomé no Normal), mostrando pontos, precisão, balas, tempo e situação.
  - "Pausar para todos" e "Encerrar para todos", que depois vira "Reabrir para todos".
  - Com Dança ou Pesca marcada, o convite de tiro aparece fechado e diz o motivo.
- **Entrada:**
  - Mouse: mira e clique.
  - Toque: toca onde atira; o botão "Recarregar" fica na tela.
  - Teclado: setas miram, Espaço atira, R recarrega e Esc pausa.
  - Controle (Gamepad API): analógico esquerdo mira, RT ou A atira, X recarrega e Start pausa.
- **Som (WebAudio, original):**
  - Tiro, engatilhar, tambor girando (catraca de 12 dentes) e clique seco.
  - Acerto em madeira, vidro e moeda; ricochete no erro; alvo proibido.
  - Sino do fim e realejo curto na contagem, baixo, que pode ser desligado.
  - Tudo passa por uma cadeia de ganho mais compressor, que segura o pico quando os sons se encostam.
- **Tema:** um só, pedra escura e latão, igual ao da pesca. O protótipo não tem tema claro.

## Normal x Extremo

| | Normal | Extremo |
|---|---|---|
| Tempo da rodada | 40 s | 32 s |
| Tamanho dos alvos | 100% | 75% |
| Velocidade (trilhos, rato, morcego) | 1× (trilhos a 24 e 32 px/s) | 1,5× (36 e 48 px/s) |
| Pop-up fica de pé | 1,6 a 2,2 s | 0,85 a 1,25 s |
| Novo alvo em cada trilho a cada | 1,7 a 2,5 s | 1,0 a 1,5 s |
| Novo pop-up a cada | 1,5 a 2,2 s | 0,8 a 1,25 s |
| Rato e morcego a cada | 5 a 8 s | 3,2 a 5 s |
| Moeda a cada / fica no ar | 6 a 9 s / 1,5 s | 5 a 7 s / 0,9 s |
| Alvos por segundo (média de 200 agendas) | 1,91 | 3,14 |
| Alvos proibidos | nenhum | 30% dos pop-ups são aldeões; 20% do trilho de baixo são gatos de lata |
| Recarga | 1,0 s | 1,6 s |
| Valor dos pontos | ×1 | ×1,5 |
| Bronze / prata / ouro | 850 / 1000 / 1150 | 675 / 775 / 875 |

## Alvos

| Alvo | Onde | Pontos (antes do combo) | Tamanho (px de jogo, Normal) | Ao acertar |
|---|---|---|---|---|
| Alvo de anel | trilhos | 10, ou 20 no centro | 7 × 7 | vira no trilho |
| Garrafa | trilhos | 20 | 3 × 7 | estilhaça (som de vidro) |
| Goblin de papelão | atrás de caixote ou barril | 20 | 7 × 10 | cai atrás do caixote |
| Rato | chão, atravessa | 30 | 7 × 4 | vira de barriga para cima |
| Morcego de pano | no alto, balançando | 35 | 8 × 4 | vira e cai |
| Moeda | surge no ar e sobe | 50 | 4 × 4 | sobe (som de moeda) |
| Aldeão (só Extremo) | atrás de caixote ou barril | −50, zera combo | 7 × 10 | cai; buzina grave e desafinada |
| Gato de lata (só Extremo) | trilho de baixo | −50, zera combo | 6 × 6 | vira; buzina grave |

O palco tem 256 × 144 px de jogo, ampliados sem suavizar.

## Robô humano (regra de teste de jogos)

O robô joga a mesma simulação que o jogador, em passo fixo de 1/120 s e com semente fixa:

- reação gaussiana de 250 ± 60 ms, nunca abaixo de 130 ms;
- tempo de mira pela lei de Fitts, MT = 0,10 + 0,15·log2(D/W + 1), com trajetória suave de jerk mínimo;
- erro de mira gaussiano proporcional ao tamanho do alvo, mais erro de velocidade e de tempo;
- confunde o alvo proibido em 12% das vezes;
- metade das vezes ainda dá um clique seco antes de recarregar, e em 40% das vezes recarrega cedo.

As metas abaixo foram escritas antes de calibrar e não mudaram depois.

| 200 rodadas | Meta | Bronze | Prata | Ouro | Pontos p10 / p50 / p90 | Precisão média |
|---|---|---|---|---|---|---|
| Normal | bronze ≥ 70% | **80%** | 31% | 8% | 815 / 941 / 1130 | 72,3% |
| Extremo | bronze entre 15% e 40% | **25,5%** | 7% | 1% | 482 / 605 / 738 | 49,5% |

Outros números do robô:

- **Tiros por rodada:** 50,1 no Normal e 36,3 no Extremo.
- **Cliques secos por rodada:** 3,9 no Normal e 2,9 no Extremo.
- **Proibidos acertados por rodada no Extremo:** 0,55.
- **Reação medida em 39.107 decisões:** mínimo de 130 ms, média de 251 ms e desvio de 59 ms.

## Conferido

Rodado em 18/10/2026: `node docs/design/minigame-tiro/provas/gerar-provas.cjs`. **Resultado: 24 de 24 testes passaram.**

- **Simulação:**
  - a mesma semente dá a mesma rodada;
  - o robô bate as duas metas;
  - o proibido só aparece no Extremo (200 agendas de cada);
  - o Extremo tem alvos menores e mais rápidos, mais alvos por segundo, recarga mais lenta e menos tempo;
  - sem bala, o tiro não conta;
  - a recarga repõe 6 balas;
  - tiro durante a recarga não sai.
- **Propriedades do gráfico do movimento:**
  - as balas ficam entre 0 e 6 e só sobem para 6 com o evento de recarga pronta;
  - os pontos só mudam com acerto ou proibido;
  - a mira nunca passa de 600 px/s (máximo medido de 468);
  - os trilhos andam em velocidade constante;
  - não há proibido no Normal;
  - a rodada termina exatamente no tempo.
- **Entrada:**
  - mouse: mira, tiro, acerto e recarga pelo botão direito;
  - teclado: Espaço, setas, R até 6 e Esc pausando e continuando;
  - toque: `touch-action: none` e o botão "Recarregar";
  - controle falso: analógico, RT 0,8, A, X e Start.
- **Mestre:**
  - placar com 3 linhas;
  - pausar e continuar para todos (o relógio de todos para);
  - encerrar e reabrir;
  - "Mestre chama" com o botão "Chamar";
  - tentativas esgotadas desligam "Jogar de novo";
  - Dança ou Pesca fecham o convite;
  - nome, barraca e meta mudam o convite e o topo.
- **Rodada inteira em tempo real** (robô por PointerEvent e tecla R, Normal): 1208 pontos e ouro em 42,2 s.
  - Quadro: p50 de 16,7 ms, **p95 de 16,8 ms**, trabalho por quadro com p95 de 0,6 ms e máximo de 7,5 ms em 2399 quadros.
  - **Nenhuma tarefa longa.**
- **Sem rolagem horizontal** em 1440, 1024 e 390 px, no convite, na rodada, no resultado e no mestre.
- **Movimento reduzido:** tremor 0 no tiro.
- **Console:** nenhum erro.
- **Som:**
  - catálogo com pico verdadeiro de −1,3 dBTP, −19,8 LUFS integrado, sem cortes nem cliques;
  - rodada inteira, com os tiros encostados, em −1,5 dBTP, −19,5 LUFS, sem cortes nem cliques;
  - `scripts/conferir-som.cjs` dá "sons-do-tiro: aprovado nas medidas", com a mediana das aprovadas em −18,6 LUFS.
  - **Medir não é ouvir:** os números dizem que não estoura nem estala, não que soa bem.

## Como rodar as provas

```
node docs/design/minigame-tiro/provas/gerar-provas.cjs
node docs/design/minigame-tiro/provas/gerar-provas.cjs --sem-conferir   (pula o conferir-som)
```

Usa o Playwright do repositório com o Edge sem janela. Sai com código 1 se algum teste falhar.

## Como avaliar

Jogue **3 rodadas no Normal e 3 no Extremo**, de preferência com fone. Depois responda:

1. Foi justo ou deu raiva? Em que momento?
2. Algo pareceu lento, rápido demais ou estranho (alvo, mira, recarga, coice, queda)?
3. Algum som cansou (tiro, clique seco, tambor, realejo, sino)?

Também vale abrir "Ver como: Mestre" e testar o painel durante uma rodada: pausar, encerrar, trocar o jogo e mudar a meta.

## Não conferido

- **Ninguém ouviu o som.** Só medi.
- **Ninguém jogou com a mão.** Só o robô jogou.
- **Controle de verdade não foi testado.** O teste usa um controle falso na Gamepad API, então o mapeamento de RT e X pode variar entre controles.
- **Celular de verdade não foi testado.** O toque foi simulado com PointerEvent `touch`. O alvo de toque do palco em 390 px é pequeno, porque os alvos têm 7 px de jogo, cerca de 10 px de tela.
- **Outros navegadores não foram testados.** Só o Edge (Chromium); Safari e Firefox ficaram de fora.
- **A 1024 px não tem print.** Só o teste de rolagem.
- **Os jogadores simulados do placar são o mesmo robô.** No app, cada jogador atira no próprio aparelho.

## Em aberto (decisão do usuário)

1. **Bônus de ×1,5 nos pontos do Extremo.** Existe para que as medalhas do Extremo fiquem próximas das do Normal. A alternativa é pontuar igual e baixar mais as metas.
2. **Limiares das medalhas.** Normal 850/1000/1150 e Extremo 675/775/875 saíram do robô. Ajustar depois da avaliação de vocês.
3. **Punição do proibido.** Hoje são −50 pontos e o combo zera. O robô acerta 0,55 por rodada no Extremo. Pode ser pesado demais ou de menos.
4. **Recarga.** Hoje repõe as 6 balas de uma vez, sem cancelar. A outra opção é bala a bala, cancelável com um tiro, como em jogo de faroeste. Essa é mais tática, mas tem mais regra.
5. **Mira no teclado.** As setas movem a mira a 110 px de jogo por segundo, o que dá para jogar mas é lento. Uma opção é pular entre alvos com Tab.
6. **Realejo.** Vem ligado e toca só na contagem. Pode vir desligado.
7. **Alvo pequeno no celular.** Uma opção é uma margem de acerto maior no toque, de 2 a 3 px de jogo.

Página publicada (privada): https://claude.ai/artifact/Adhev7Vmp5x4ruFZy8vQnH
