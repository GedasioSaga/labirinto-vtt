# Textura (pacote)

Textura nova da ferramenta **Texturas** (o mestre pinta por cima do mapa), que
chega sem instalador no mesmo pacote das animações.

`<id>.ts` — `export default` a função de cor do ladrilho
(`DefinicaoDeTextura['cor']` em `src/texturas/embutidas.ts`):

```ts
import { empacotar, fbm, misturar, rgb } from '../../texturas/ruido'

const CLARO = rgb('#c9b27a')
const ESCURO = rgb('#b39a64')

/** A cor (0xRRGGBB) do ponto (u, v) do ladrilho, u e v em [0, 1). */
export default function cor(u: number, v: number): number {
  return empacotar(misturar(CLARO, ESCURO, fbm(u, v, 3, 4, 7) * 0.5 + 0.5))
}
```

- **Repete sem emenda**: o valor em `u = 1` tem de ser o de `u = 0` (o mesmo
  para `v`). Use só o ruído de `src/texturas/ruido.ts`, que mora numa grade de
  período inteiro e repete por construção (`fbm`, `cristas`, `valor`,
  `vizinhos`); ele é embutido no módulo pelo import.
- **Não estoura**: o teste das embutidas (`src/texturas/embutidas.test.ts`) é a
  régua — sem canal acima de 245, saturação e contraste contidos, nada de
  listra fina. Rode a mesma medida na textura nova antes de aprovar.
- A luz vem de cima à esquerda, como no relevo (`luzNaInclinacao`, `sombreado`).
- A função é chamada uma vez por pixel do ladrilho (256 × 256): conta, sem
  canvas, sem estado entre chamadas. Cor que não é número vira preto.

`<id>.json`:

```json
{ "nome": "Cerrado", "escala": 40 }
```

`escala`: o lado do ladrilho no mapa, em px do protótipo do relevo (8 a 200; a
Floresta usa 40, a Duna 64). O id não pode ser o de uma textura da biblioteca
(`areia`, `duna`, `grama`, `floresta`, `pinheiros`, `pantano`, `terra`,
`pedra`, `neve`).
