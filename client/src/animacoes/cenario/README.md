# Cenário (pacote)

`<id>.ts` — `export default` a função `criar` de `EstiloDeCenario`
(`src/cenario/estilosDeCenario.ts`):

```ts
import type { EstiloDeCenario } from '../../cenario/estilosDeCenario'

const criar: EstiloDeCenario['criar'] = (canvas, imagem, { reduzirMovimento, volume }) => {
  // desenha no canvas (já no tamanho do quadro, em px físicos) sobre a imagem do pino
  return { atualizar: (tS) => {}, ajustarTela: (largura, altura) => {}, descartar: () => {} }
}
export default criar
```

- `atualizar(tS)` recebe os segundos desde o começo; quem chama a cada quadro
  é o app. `ajustarTela` é opcional.
- `descartar` solta tudo (som, timers) e é chamado uma vez.

`<id>.json`:

```json
{ "nome": "Chuva na janela", "duracaoNaturalS": 8, "quadroDaMiniaturaS": 2 }
```

`duracaoNaturalS` de 3 a 40; `quadroDaMiniaturaS` é opcional.
