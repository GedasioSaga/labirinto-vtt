# E2E pendente

Specs de `client/e2e/` que ficaram para trás de uma mudança de comportamento pedida pelo mestre e precisam ser reescritos antes de voltar ao portão. Uma linha por spec: arquivo, o que mudou, de onde veio a ordem.

- `client/e2e/task-ctrl-reto.spec.ts` — o Ctrl ao desenhar agora SOLTA o ângulo (o traço gruda sozinho em 0/45/90 e o Ctrl desliga esse grude); o spec ainda espera o Ctrl travando em 45° — resposta do mestre de 17/11/2026: "Gruda sozinho, Ctrl solta" (commit ada7b898).

## ui-onde-foi-parar: botão "Categorias" do Acervo de itens saiu (18/11/2026)

- `client/e2e/helpers/ondeFoiParar.ts:220` ainda espera o botão "Categorias" do Acervo de itens. Ele saiu em 747669a9 (as categorias viraram pastas). O spec `e2e/ui-onde-foi-parar.spec.ts` vai falhar nessa linha.
- Conserto: mover "Categorias" para a lista de aposentados e acrescentar a entrada "Nova pasta" do Acervo de itens.
- Não mexi agora porque o helper tem edições não commitadas de outra frente (renomes Excluir → Apagar, câmera do E14).
