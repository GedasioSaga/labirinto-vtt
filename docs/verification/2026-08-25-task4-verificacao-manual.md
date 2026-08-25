# Task 4 — Verificação manual (Step 4 do plano `plano1b-ferramentas-desenho.md`)

O commit `4de75f8` ("feat: desenhar parede, colocar luz e desenhar regiao no canvas")
foi feito sem que o Step 4 do plano (verificação visual dos 5 cenários) tivesse sido
executado — o implementador só confirmou que Vite/Rust/app.exe subiam sem erro de log,
o que não testa nenhum dos comportamentos interativos pedidos.

Este documento registra a verificação manual feita a posteriori, via `vite` (modo web,
`npm run dev --workspace=client`) dirigido por Playwright, cobrindo os 5 cenários do
plano. Nenhuma mudança de código foi necessária — todos os 5 passaram como especificado.

## Método

- Servidor: `npm run dev --workspace=client` (Vite puro, sem Tauri — suficiente porque
  nenhum dos 5 cenários depende de API do Tauri; `convertFileSrc`/carregamento de fundo
  já tem fallback em try/catch).
- Interação real via `page.mouse` (pointerdown/pointermove/pointerup), não eventos sintéticos.
- Estado do `mapStore` lido diretamente via `import('/src/stores/mapStore.ts')` dentro da
  página, para confirmar posição final de tokens/paredes sem depender de leitura de pixel.

## Resultados

1. **Ferramenta Parede** — clique e arraste no canvas: linha amarela de preview
   (`drawWallDraft`) acompanhou o arrasto em tempo real; ao soltar o botão, virou uma
   parede branca permanente (mesmo estilo de `drawWalls`). Confirmado visualmente.

2. **Ferramenta Luz** — um único clique colocou imediatamente um círculo laranja
   translúcido na posição clicada, sem exigir arrasto. Confirmado visualmente.

3. **Ferramenta Região** — cliques sucessivos adicionaram vértices amarelos com linha de
   rascunho seguindo o cursor; duplo clique com 3+ pontos fechou o polígono e criou uma
   região azul translúcida permanente. Em rascunho separado, `Esc` cancelou o desenho em
   andamento sem criar nenhuma região. Ambos confirmados visualmente.

4. **Ferramenta Selecionar** — pan (arrastar em área vazia) e arrasto de token continuam
   funcionando como no Plano 1: confirmado visualmente (pan) e via estado do store
   (token arrastado moveu de `(400,300)` para `(576,512)` ao ser solto em área livre,
   arredondado pelo snap de grade de 64px).

5. **Colisão de token contra parede recém-criada** — com uma parede criada via
   `addWall`/desenho em `x=550` (de `y=200` a `y=400`) e um token em `(400,300)`, o
   arrasto real do token para a direita (mouse até `x=700`) parou em `(512,320)` —
   a célula de grade imediatamente antes da parede — em vez de atravessar para `x=700`.
   Teste de controle: o mesmo token, reposicionado para uma área sem parede, arrastado
   pela mesma distância aproximada, moveu-se livremente (`(400,500)` → `(576,512)`),
   confirmando que o bloqueio em (5) é devido à colisão com a parede nova, e não a uma
   falha geral de movimento.

Nenhum erro no console do navegador durante os testes (à parte um 404 inofensivo de
`favicon.ico`).

## Conclusão

Os 5 comportamentos exigidos pelo Step 4 do plano batem com o implementado no commit
`4de75f8`. Nenhuma alteração de código foi necessária; este documento fecha a lacuna de
processo (verificação pulada antes do commit original).
