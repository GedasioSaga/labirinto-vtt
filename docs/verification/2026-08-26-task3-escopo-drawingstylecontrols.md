# Task 3 (Interação — colocar e editar) — nota de escopo: `DrawingStyleControls.tsx`

> **Achado da revisão de spec (2026-08-26):** o commit `29b7260` ("fix(texto): liga
> drawFontSize/setDrawFontSize a um controle de UI") modifica
> `client/src/components/DrawingStyleControls.tsx` (adiciona `showWidth`, `fontSize`,
> `onFontSizeChange`, `showFontSize`), mas esse arquivo **não estava** na lista de "Files" da
> Task 3, que listava apenas `PixiCanvas.tsx`, `TextLabelControls.tsx`, `PropertiesPanel.tsx`,
> `App.tsx`, `Toolbar.tsx`, `components/labels.ts` e `components/icons.tsx`.

## O gap é real, e a mudança é necessária

A Task 1 definiu o contrato `drawFontSize`/`setDrawFontSize` na store (`mapStore.ts`), com o
mesmo padrão já usado por `drawColor`/`drawWidth`/`drawFilled` para pincel/linha/círculo: um
valor de estilo "em edição" que se aplica ao **próximo** desenho colocado, ajustável **antes**
de posicionar o traço.

Sem UI ligada a `drawFontSize`/`setDrawFontSize`, a ferramenta Texto ficava inconsistente com
as demais ferramentas de desenho: dava pra pré-ajustar cor/espessura/preenchimento antes de
desenhar uma parede/linha/círculo, mas não dava pra pré-ajustar o tamanho da fonte antes de
colocar um rótulo — só depois, um rótulo já colocado por vez, via
`TextLabelControls.tsx`/`updateTextLabel`. `setDrawFontSize` ficava código morto (só chamado
pelo teste unitário isolado da action).

`DrawingStyleControls.tsx` já é o componente que centraliza esse "estilo em edição" para as
ferramentas de desenho (é ele quem renderiza o slider de espessura e o toggle de preenchimento
hoje) — colocar o slider de tamanho de fonte ali, condicionado a `showFontSize` (true só quando
`activeTool === 'text'`), segue exatamente o padrão já estabelecido pelo próprio arquivo, em vez
de duplicar esse mecanismo em outro componente.

## Por que a spec da Task 3 não previu isso

A lista de "Files" da Task 3 foi montada a partir dos arquivos que participam do fluxo de
*colocar e editar* o rótulo em si (canvas, painel do rótulo já colocado, toolbar, App, labels,
ícones). Ela não atribuiu a nenhum arquivo a responsabilidade de expor
`drawFontSize`/`setDrawFontSize` — contrato que é da Task 1 — numa UI. Isso é uma lacuna da
especificação, não um desvio arbitrário da implementação: sem tocar em algum componente de
estilo, o contrato da Task 1 ficaria sem consumidor de UI, e a Task 3 ficaria com a ferramenta
Texto pré-configurável de forma diferente (pior) das demais ferramentas de desenho.

**Registro para fechar o gap:** `client/src/components/DrawingStyleControls.tsx` passa a fazer
parte do escopo real da Task 3 (junto com o ajuste de 2 linhas em `App.tsx` para plugar
`drawFontSize`/`setDrawFontSize`/`showFontSize`/`showWidth` nas props do componente, e 1 linha
em `PropertiesPanel.tsx` para o painel aparecer também com a ferramenta Texto ativa —
`showDrawingStyle = DRAWING_TOOLS.includes(activeTool) || activeTool === 'text'`). Commits:
`ed3f565` (Task 3 original) + `29b7260` (fix que fecha este gap).

## Verificação

Rodado nesta sessão, a partir da raiz do repo:

```
cd client && npm run typecheck --workspace=client
```

```
> tsc --noEmit && tsc --noEmit -p tsconfig.e2e.json
```

Saída limpa, exit code 0 — os **dois** tsconfigs (`tsconfig.json` e `tsconfig.e2e.json`)
passam, não só o primeiro.

```
cd client && npm run test --workspace=client
```

```
 Test Files  24 passed (24)
      Tests  227 passed (227)
```

Nenhuma mudança de código foi necessária além da já existente em `29b7260` — a implementação
estava correta; o gap era exclusivamente de documentação de escopo, agora fechado por este
registro.
