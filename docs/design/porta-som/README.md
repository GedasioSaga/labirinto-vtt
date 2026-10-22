# Porta refinada e som da porta (fatia 22, faixa A, etapa 2)

O que mudou no app:

- **Girar e Deslizar refinados** (`client/src/portas/animacoesDePorta.ts`). A folha ganhou uma sombra suave por baixo, opaca (duas faixas misturadas com o chão, sem alfa: a cópia por cima do telhado depende disso). A sombra só existe no meio do caminho, porque a 0 e a 1 a porta tem que ser igual à parada. O Girar recolhe a folha para a dobradiça no fim do giro (`GIRAR_INICIO_DO_RECOLHER = 0.8`), com smoothstep, em vez de sumir de uma vez. Não há quique.
- **A curva do tempo continua `easeOutCubic`** (`cubic-bezier(0.33, 1, 0.68, 1)`, 300/260 ms no Girar, 240 ms no Deslizar), porque é a mesma da medalha da ficha (`MedalhaDaPorta.tsx`) e está fixada no protótipo pelo `grimorio.tokens.test.ts`. O refinamento está no desenho, não no relógio.
- **Desempenho** (`client/src/pixi/animadorDePortas.ts`). Antes, todas as portas eram repintadas a cada quadro. Agora a porta que anda vai para uma camada irmã (`portasEmMovimento`). A camada de base só é repintada quando muda o conjunto de portas que andam.
- **Som** (`client/src/portas/somDePorta.ts`). Sintetizado em WebAudio: rangido no abrir e no fechar do Girar, trinco no Deslizar, tranca e destranca. Ele toca no começo da animação e quando a porta tranca ou destranca. Respeita o volume do Controle de Som e fica mudo com movimento reduzido. Nunca cria `AudioContext`: usa o da mesa, que só nasce no primeiro gesto. O pacote de animações (`lib/pacoteDeAnimacoes.ts`, `scripts/pacote-animacoes.cjs`) ganhou o campo opcional `som`. Mapa e pacote antigos abrem iguais.

## Provas

`node docs/design/porta-som/provas/gerar-provas.cjs` roda o código real do app no Chromium 1243 (SwiftShader). As metas foram escritas antes, em `provas/metas.json`. O resultado completo fica em `provas/testes.json`.

| Meta | Resultado |
| --- | --- |
| M1: fim do abrir e do fechar igual à porta parada (zoom 1, 2,5 e 4; 3 cores e trancada) | 0 pixels diferentes nos 24 casos |
| M2: desenho opaco | 0 pixels translúcidos em todos os quadros |
| M3: sem quique | 0 passos contra o sentido, nada fora de [0, 1] |
| M4: medalha da ficha (curva CSS do navegador) no mesmo ângulo do mapa | no máximo 0,2° de diferença |
| M5: inverter a 25%, 50% e 75% não salta | maior passo com inversão ≤ maior passo normal |
| M6: movimento reduzido | 0 quadros intermediários, 0 sons |
| M7: 60 portas, abrindo 1 e abrindo as 60 a cada 400 ms, 4 s cada | quadro p95 8,5 / 8,4 ms; 0 tarefas longas; animador p95 0,1 / 0,3 ms por quadro |
| M7: custo de um quadro com 1 porta andando entre 60 | repintar as 60: 0,038 ms; repintar só a que anda: 0,003 ms |
| M8: som (pico ≤ -12 dBTP, 0 cliques, 0 cortes, DC ≤ 0,5%, fim < -60 dBFS) | girar -33,8 / -34,1 LUFS; deslizar -38,1 / -34,5; tranca -35,5; destranca -35,2; pico máximo -13,3 dBTP |
| M9: folhas de contato com 12 a 16 quadros por linha | 4 linhas × 14 quadros, tempo embaixo de cada um |
| M10: console limpo | 0 mensagens do app (o único aviso, "GPU stall due to ReadPixels", vem da leitura de pixels da própria prova e fica em `avisosDaFerramentaDeProva`) |

- `provas/folhas/girar.png` e `provas/folhas/deslizar.png`: a porta sem cor própria, azul, musgo e ameixa trancada ("destrancar e abrir", depois "fechar e trancar").
- `provas/graficos/girar.png` e `provas/graficos/deslizar.png`: caminho, comprimento da folha, sombra e medalha, com o volume do som embaixo, na mesma linha do tempo. No Girar, a linha do ângulo do mapa fica escondida debaixo da linha da medalha, porque as duas coincidem.
- `provas/som/*.wav`: os seis sons, 48 kHz, 16 bits, no volume máximo da mesa.

**Medir não é ouvir.** LUFS, pico e cliques dizem que o som não estoura nem estala. Não dizem se o rangido parece porta ou se cansa na décima vez. Os `.wav` estão aí para isso.

## Revisão do movimento (review-animations)

- Curva de saída, ≤ 300 ms, assimétrica no Girar (abre 300, fecha 260), interrompível do ponto onde está, sem quique, só a porta que anda é redesenhada: aprovado.
- **Aceito com ressalva:** ao fechar, o Girar desdobra a folha em cerca de 1 quadro. A curva de saída anda 18% do caminho nos primeiros 16 ms, e o desdobrar mora nos últimos 20% do caminho. O desenho tem que ser o mesmo nos dois sentidos, para a reversão no meio e a medalha. Na folha de contato, isso aparece como a folha "nascendo" já aberta e girando até fechar.
- Movimento reduzido troca na hora, sem quadro intermediário, como pede a tarefa (a regra do Emil prefere manter um fade; aqui não há fade a manter, porque o desenho é opaco).

## O que não foi verificado

- Ouvir os sons (cabe ao usuário).
- Desempenho em GPU de verdade e em celular fraco: a medida rodou no SwiftShader, que roda na CPU.
- A medalha dentro da ficha real: a prova compara a curva CSS no navegador com o mapa, não a tela da ficha aberta.
