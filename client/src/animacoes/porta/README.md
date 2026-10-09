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

- `porta` traz as pontas, o centro, o sentido, a espessura e a cor, já em
  coordenadas de mundo (`PortaParaDesenho`).
- Nos extremos (0 e 1) o desenho deve bater com o da porta parada; os
  ajudantes `desenharBatente` e `tracarRetanguloDaPorta` do mesmo arquivo são
  embutidos no módulo se você os importar.

`<id>.json`:

```json
{ "nome": "Cair para dentro", "duracaoMs": 300 }
```

`duracaoMs` de 1 a 3000 (fechada até aberta).
