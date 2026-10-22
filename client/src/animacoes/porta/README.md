# Porta (pacote)

`<id>.ts` — `export default` a função `desenhar` de `AnimacaoDePorta`
(`src/portas/animacoesDePorta.ts`):

```ts
import type { AnimacaoDePorta } from '../../portas/animacoesDePorta'

const desenhar: AnimacaoDePorta['desenhar'] = (g, porta, progresso, abrindo) => {
  // só ACRESCENTA ao Graphics `g` (nada de g.clear()): 0 = fechada, 1 = aberta
}
export default desenhar
```

- `porta` traz as pontas, o centro, o sentido, a espessura, a cor e o contorno
  escuro (`borda`), já em coordenadas de mundo (`PortaParaDesenho`). A folha
  enche o vão inteiro (desde 22/10/2026).
- Nos extremos (0 e 1) o desenho deve bater com o da porta parada. O jeito
  certo é o de `_folha.ts`: `comecarQuadro` desenha a fechada em 0 e o batente
  de 0 a 1 com os MESMOS ajudantes da porta parada (`desenharFolhaFechada`,
  `desenharBatente`). A folha em movimento vai em peças para `pintarFolha`,
  que põe o contorno escuro em volta da silhueta inteira, chapado e opaco.
- Ajudantes importados de `portas/animacoesDePorta.ts` e arquivos `_<nome>.ts`
  desta pasta são embutidos no módulo pelo `scripts/pacote-animacoes.cjs`.

`<id>.json`:

```json
{ "nome": "Grade que sobe", "duracaoMs": 600, "duracaoFecharMs": 420, "curvaAbrir": [0.37, 0, 0.63, 1], "curvaFechar": [0.37, 0, 0.63, 1], "som": "grade" }
```

- `duracaoMs` de 1 a 3000 (fechada até aberta); `duracaoFecharMs`, opcional,
  na mesma régua (ausente = fecha no tempo de abrir).
- `curvaAbrir` e `curvaFechar`, opcionais: cubic-bezier com os 4 números entre
  0 e 1, que nunca volta nem passa do alvo (ausente = `easeOutCubic`).
- `som`, opcional: `rangido`, `trinco`, `dupla`, `grade`, `arrombada`,
  `sanfona` ou `cortina` (`portas/somDePorta.ts`). Ausente = porta muda.
- App de antes desses campos ignora o que não conhece: a porta anda no tempo
  e na curva de sempre, muda.
