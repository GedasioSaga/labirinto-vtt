# E2E pendente

Specs de `client/e2e/` que ficaram para trás de uma mudança de comportamento pedida pelo mestre e precisam ser reescritos antes de voltar ao portão. Uma linha por spec: arquivo, o que mudou, de onde veio a ordem.

- `client/e2e/task-ctrl-reto.spec.ts` — o Ctrl ao desenhar agora SOLTA o ângulo (o traço gruda sozinho em 0/45/90 e o Ctrl desliga esse grude); o spec ainda espera o Ctrl travando em 45° — resposta do mestre de 17/11/2026: "Gruda sozinho, Ctrl solta" (commit ada7b898).
