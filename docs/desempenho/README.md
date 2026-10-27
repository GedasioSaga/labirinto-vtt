# Desempenho do mapa grande

Harness criado em 27/10/2026 para a queixa "mapas 200x200, meu amigo trava, parece 5 fps".
Linha de base completa em [`linha-de-base-2026-10-27.json`](linha-de-base-2026-10-27.json).

## Como rodar

```
node scripts/medir-desempenho.cjs --mapa-real C:/caminho/mapa.json          # todos os casos (~9 min)
node scripts/medir-desempenho.cjs --conjunto rapido --mapa-real ...         # só o caso principal
node scripts/medir-desempenho.cjs --so sint200-mt-1080 --sem-perfil         # um caso, sem perfil de CPU
node scripts/medir-desempenho.cjs ... --gravar docs/desempenho/<arquivo>.json
```

- Build de produção com a sonda (`VITE_LAB_SONDA=1`, `client/src/lib/sondaDeDesempenho.ts`), sem minificar e com
  sourcemap, numa pasta temporária. `--modo dev` usa o vite de desenvolvimento; `--janela` abre o navegador com janela.
- `client/desempenho/mapa-grande.spec.ts` monta a MESA DE VERDADE: o app do mestre (Tauri de mentira, mapa aberto pelo
  "Carregar Mapa existente") e o `player.html` num navegador à parte, ligados por um repasse do WebSocket. O
  `hostBridge` real do mestre calcula o recorte do jogador.
- O mapa real NÃO entra no repositório (conteúdo do usuário). Sem `--mapa-real` os casos `real-*` são pulados e os
  sintéticos (`client/desempenho/mapaSintetico.ts`, mesmas contagens do real, semente fixa) rodam.
- Por cenário: fps, quadro p50/p95/p99, tarefas longas (>= 50 ms), CPU da thread principal (ms por segundo), chamadas
  de desenho do WebGL por quadro e, no caso principal, as 15 funções de maior tempo próprio (segunda passada).

## O que a linha de base mostra (RTX 3050 Laptop, Chromium 1243, ANGLE D3D11)

**O "5 fps" reproduz em 2560x1440 com escala 150% e o Meio-Termo ligado:**

| caso (mapa real)          | mestre arrasta ficha | mestre parado c/ sala | jogador arrasta ficha | jogador vê mestre mover |
|---------------------------|---------------------:|----------------------:|----------------------:|------------------------:|
| 1440 DPR 1.5, Meio-Termo  | 10,6 / 37,7 fps      | 32,7 / 26,2 fps       | 4,3 / 6,0 fps         | 4,9 / 6,1 fps           |
| 1440 DPR 1.5, linhas      | 60 fps               | 60 fps                | 60 fps                | 60 fps                  |
| 1080 DPR 1, Meio-Termo    | 58,5 fps             | 56,6 fps              | 60 fps                | 59,4 fps (mestre 17,5)  |

(duas rodadas no 1440 com Meio-Termo; nessas quedas a CPU fica baixa, 7 a 80 ms/s: o gargalo é a GPU.)

- **Textura na GPU cresce com o zoom no Meio-Termo:** mestre 36 MB ao abrir, 427-448 MB depois de dar zoom e chegar
  perto (texturas de 8192x4096 e 8192x2048); com linhas, 78-113 MB. Jogador: 71-88 MB (Meio-Termo) contra 34 MB.
- **Redesenha parado:** 100% dos quadros têm desenho, mestre ~70 e jogador ~38 chamadas por quadro; parado o mestre
  gasta 80-90 ms de CPU por segundo.
- **Mestre com sala aberta movendo uma ficha (1080, Meio-Termo):** 17,5 fps, p95 200 ms, 12 tarefas longas (maior
  235 ms), 707 ms de CPU por segundo; manda 6 patches de ~140 KB (837 KB) ao jogador em 1,5 s.
- **Escala com o tamanho (sintético, Meio-Termo, 1080):** 50x50 e 100x100 a 60 fps em tudo; 200x200 cai para
  ~30 fps no pan perto (712 ms/s de CPU) e ~42 fps no mestre com sala aberta.
- **Abrir:** mestre interativo em ~3,0-3,3 s (tarefa longa de ~1 s); jogador em ~1,5 s, primeira tela de 170 KB.

## Funções quentes (mapa real, 1080, Meio-Termo)

| ms próprios | função | onde | cenário |
|---:|---|---|---|
| 684 | `pintarLinhas` | `src/texturas/meioTermo/chaoNoMundo.ts:179` | mestre pan perto (45% da CPU) |
| 403 / 333 / 261 / 220 | `mod` / `canto` / `fbm` / `gradiente` | `src/texturas/ruido.ts:25/84/120/78` | abrir o mapa |
| 397 | `marchingSquares` | `src/lib/floorContour.ts:74` | abrir o mapa |
| 394 | `andarDijkstra` | `src/lib/caminhamento/marcos.ts:78` | jogador vê o mestre mover (29%) |
| 275 + 89 | `round` / `buildLine` (Pixi) | `pixi.js .../buildCommands/buildLine.mjs:28/72` | mestre move ficha com sala aberta |
| 222 | `umaCopa` | `src/texturas/embutidas.ts:209` | abrir o mapa |
| 137 | `caminhosParaJogador` | `src/lib/penhasco.ts:402` | mestre revela névoa com sala aberta |
| 107 / 103 | `interiorSamples` | `src/lib/fogFilter.ts:764` | revelar névoa / mover ficha com sala aberta |
| 89 | `forEachExploredRun` | `src/lib/exploration.ts:841` | jogador vê o mestre mover |

## Limites conhecidos

- Navegador Chromium, não a WebView2 do Tauri. `--force-low-power-gpu` não trocou a placa (o relatório da GPU continuou
  RTX): a placa integrada não foi medida.
- A queda pela metade com as duas telas no MESMO navegador (~38 fps) é o processo de GPU dividido; por isso o jogador
  roda em outro navegador. Na mesma máquina as duas ainda dividem a placa de vídeo.
- No mapa real o mestre recusa o passo de 10 casas da ficha do jogador (manda `token.move`, a ficha não anda); nos
  sintéticos ela anda 640 px.
- A cópia do mapa real ganha 6 zonas ocultas e 1 ficha (a do jogador) para os cenários de névoa e de ficha; a imagem
  de objeto do disco do usuário não carrega no Tauri de mentira.
