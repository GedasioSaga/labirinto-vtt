# Transição (pacote)

`<id>.ts` — `export default` uma `CriarCena` (`src/transicoes/tipos.ts`), o
mesmo contrato das cenas embutidas em `src/transicoes/cenas/`:

```ts
import type { CriarCena } from '../../transicoes/tipos'

const criar: CriarCena = (THREE, { reduzirMovimento }) => {
  // monta scene + PerspectiveCamera com o THREE recebido (nunca importe 'three')
  return { scene, camera, atualizar: (t) => ({ fade }), ajustarTela: (aspecto) => {}, descartar: () => {} }
}
export default criar
```

- `atualizar(t)` recebe o tempo da cena em segundos (0 até a duração natural)
  e devolve `{ fade }`, 0 = cena visível, 1 = tela preta.
- `criarSom(kit)` é opcional, como nas embutidas.
- As luzes pontuais e holofotes passam pela mesma conversão das embutidas
  (`converterLuzesLegadas` em `motor.ts`).

`<id>.json`:

```json
{ "nome": "Túnel de pedra", "duracaoNaturalS": 8, "quadroDaMiniaturaS": 3 }
```

`duracaoNaturalS` de 2 a 30; `quadroDaMiniaturaS` (o quadro da miniatura na
galeria) de 0 até a duração natural.
