# Sombras: o escuro da visão (protótipo)

Página para o mestre comparar o escuro da visão do jogador como ele é hoje no Labirinto com uma versão mais suave, e escolher três números. Nada aqui mexe no programa. "Sombras" quer dizer só o escuro da visão; a sombra dos objetos no chão ficou de fora (decisão do dono em 12/11/2026).

Especificação: `tmp/caca-2026-11-12/sombras/ESPEC-PROTOTIPO.md`.

## Como abrir

Dois cliques em `prototipo-sombras.html`. Não usa internet nem nada de fora; abre direto do disco no Chrome ou no Edge.

- Arraste a ficha azul, ou ande com as setas (com o mapa em foco).
- `1` Hoje, `2` Proposta, `3` Só amaciar, `4` Olho com tamanho. Segure `H` (ou o botão) para ver o Hoje sem tirar a mão.
- `D` / `T` / `N` dia, tarde e noite. `L` tocha. `M` visão do mestre (mostra a sala secreta). `E` esquece o que já viu.
- Roda do mouse aproxima, `0` encaixa o mapa, botão do meio ou espaço + arrastar move a vista. `Esc` durante o arrasto devolve a ficha.
- Clique na porta da cela (no corredor) para abrir e fechar.
- "Copiar os números" copia uma linha para colar na conversa.
- Abrir com `?prova=1` no fim do endereço roda a prova da regra da névoa e mostra o resultado no painel.

## Números de partida

| Número | Partida | Faixa |
|---|---|---|
| Suavidade da borda | 0,45 casa | 0 a 1 casa (0 é a linha dura de hoje) |
| Brilho do lembrado | 45% | 30% a 80% |
| Fim do alcance | 30% | 0% a 50% (0 é o disco de hoje) |

## Prova (?prova=1), 12/11/2026

Chrome 143 (Playwright) e Edge 157: as duas passaram, cerca de 8,5 s.

- Sala secreta: 48 casos (4 posições, 4 desenhos, dia/tarde/noite), com e sem a sala no mapa: 0 pixel diferente em todos.
- O escuro novo nunca clareia nada fora do corpo das paredes: 0 pixel. Dentro do corpo das paredes, onde a Proposta mostra a parede inteira: 60.987 (dia e tarde), 53.827 (noite).
- O "nunca vi" é uma cor só, sem desenho de luz vazando: 0 pixel diferente.
- Parede sul do corredor: 10 pixels de corpo à vista no Hoje (meia parede), 20 na Proposta (inteira).
- Um passo de 1 casa: o escuro muda em 10 de 19 quadros (mistura de 200 ms) e aos 300 ms é igual, pixel a pixel, a quem já estava parado ali.
- Console sem erro e nenhum pedido de rede, nos dois navegadores.

Os 35 controles da página (teclas, botões, deslizantes, porta, arrasto contra a parede, `Esc`, zoom, Tab, menos movimento) foram conferidos um por um: `provas/controles.json`.

## Medida do quadro arrastando (Chrome 143, 1920 x 1080, mapa a 100%, 5 s cada)

Tempo de CPU por quadro, p95 / pior: Hoje 1,0 / 2,4 ms; Proposta dia 3,9 / 4,9 ms; Só amaciar 4,6 / 6,3 ms; Olho com tamanho dia 1,9 / 3,1 ms; Proposta noite 4,9 / 8,2 ms; Olho com tamanho noite 1,5 / 3,6 ms. Nenhum quadro passou de 16 ms. A única tarefa longa foi de 61 ms, ao abrir a página. O tempo de placa de vídeo não entra nessa conta. Detalhe: `provas/medida-do-quadro.json`.

## Onde o protótipo se afasta da especificação

- A camada do "nunca vi" é pintada depois da cor do período, com uma cor fixa. Na ordem da especificação a luz da noite vazava por baixo e desenhava a forma do lampião no escuro nunca visto.
- Na noite, a parede clareada pela luz fica presa ao círculo de cada luz, para não acender um halo de parede no fim do alcance.
- A mistura de 200 ms ao andar é feita na imagem final do escuro, então o lugar que sai da visão também apaga devagar.
- Olho com tamanho: a face da parede conta como vista e a área de uma luz à noite conta inteira.
- Suavidade 0 desliga a beira suave por completo (linha dura).
- Fundo e contorno dos botões trocam na hora, sem fade: a troca vem quase sempre do teclado.

## O que não foi conferido

Placa de vídeo e tela reais do PC do mestre (a medida foi feita sem tela), Firefox, celular (fora do escopo) e a área de transferência num navegador aberto à mão (conferida só no Chrome automatizado).

## Arquivos

- `prototipo-sombras.html`: a página.
- `provas/1` a `7`: prints de conferência (Hoje x Proposta de dia e de noite, sala com pilar, mestre, tela inteira, alternativas, o Hoje ao lado do app de hoje).
- `provas/prova-chrome.*`, `provas/prova-edge.*`, `provas/controles.json`, `provas/medida-do-quadro.json`.
- Roteiros de conferência: `tmp/caca-2026-11-12/sombras/prototipo/`.
