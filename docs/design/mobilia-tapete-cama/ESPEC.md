# Tapete e cama em três cores: especificação

Protótipo para aprovação (15/10/2026). Fonte visual: `prototipo.html` (gerado por `node docs/design/mobilia-tapete-cama/montar.cjs` a partir de `modelo.html` + `entrada.ts`). O código proposto está em `proposta.ts`, escrito para ir quase como está para o app; ele importa o código real (`lib/mobilia.ts`, `pixi/drawPropSilhouettes.ts`, `pixi/pixelAlign.ts`, `lib/roomRotation.ts`, `lib/tokenColor.ts`). Os móveis de hoje no protótipo são desenhados pelo `drawPropSilhouettes` real, num Canvas 2D, por um adaptador do pedaço do `Graphics` que ele usa (`poly`, `fill`, `stroke`, `moveTo`, `lineTo`). O antisserrilhado da diagonal pode diferir um pouco do WebGL do Pixi; a geometria é a mesma.

**Prova de que mapa antigo abre igual:** a cama sem os campos novos, pintada pelo `drawPropSilhouettes` de hoje e pelo caminho novo, dá **0 pixels diferentes** em 18 casos (24/48/96 px por casa × giro 0°/30°/90° × com e sem a variante de moldura). A página mostra a conta (seção 3).

Convenções iguais às de `lib/mobilia.ts`: centro na origem, sem giro, y para baixo, `w`×`h` em px de mundo, `y(t) = (t − 0,5)·h` a partir de cima, `m = min(w, h)`.

## Dados

| Campo novo (`Prop`, types/map.ts) | Valor | Gravado quando | Vale em |
|---|---|---|---|
| `mobilia: 'tapete'` | novo `TipoMobilia`, no fim de `TIPOS_MOBILIA` (depois da fogueira) | sempre no tapete | — |
| `mobiliaForma?: 'redondo'` | só `'redondo'`; ausente = retangular | forma redonda | só tapete |
| `mobiliaCorDoTravesseiro?: string` | `#rrggbb` minúsculo | cor própria | só `catre` |
| `mobiliaCorDoCobertor?: string` | `#rrggbb` minúsculo | cor própria | só `catre` |

- Rótulo `Tapete`; com artigo `um tapete` (a dica "Clique no mapa para pôr um tapete." sai sozinha de `toolVariants.ts`). Tapete entra em `TIPOS_COM_VISTA` (Frente | Lado). Não é redondo para `ehMovelRedondo` (a silhueta dele vem de `contornoDoTapete`), não é vazado.
- Normalização (a mesma porta na leitura do disco, na edição, na travessia e no desenho): `normalizarFormaDoTapete(tipo, valor)` → `'redondo' | undefined`; `normalizarCorDeTecido(tipo, valor)` → `normalizarCorDoMovel(valor)` só se `tipo === 'catre'`.
- `propMobiliaFromFile`: passa os três campos pelas portas; em outro tipo eles somem. `semNadaDeMovel`: tira os três. `mesmaAparenciaDoMovel`: compara as duas cores de tecido.
- `AparenciaDoMovelPatch` ganha `corDoTravesseiro?: string | null` e `corDoCobertor?: string | null` (`null` = padrão, o campo sai). `mapStore.setAparenciaDoMovel`: o `arrastoDeCor` (um passo só de Ctrl+Z ao arrastar no seletor) passa a contar as duas chaves novas.
- `movelComOutroTipo`: as cores de tecido ficam só se o tipo novo é `catre`; a forma só se é `tapete` (como a curva da cerca). Função nova `movelComOutraForma(prop, forma, grade)`: grava a forma e põe o tamanho padrão da forma nova na vista atual (como trocar o tipo; centro e giro ficam).
- `tamanhoPadrao(tipo, vista, grade)` passa a receber a forma (só o tapete usa).
- **Jogador / névoa** (`lib/fogFilter.ts`, bloco da mobília em ~4760): copiar `mobiliaForma` (via `normalizarFormaDoTapete`) e as duas cores (via `normalizarCorDeTecido`), como já faz com vista e curva. `PropSilhouette` (drawPropSilhouettes.ts) acrescenta os três campos ao `Pick`. A chave de repintura do jogador (`JSON.stringify(props)` em `PlayerView.redrawPropsLayer`) e a do editor (referência do prop em `drawProps.FurnitureEntry`) já cobrem campo novo.

## Tamanho padrão (casas, largura × altura, sem giro)

| | Frente | Lado |
|---|---|---|
| Tapete retangular | 3 × 2 | 3 × 0,25 |
| Tapete redondo | 2 × 2 | 2 × 0,25 |

O retangular cabe a mesa 2×1 com as cadeiras. Esticado, o redondo vira oval. De lado, 0,25 casa é a altura da cerca: o clique ainda pega.

## Ordem de desenho: o tapete fica no chão

`emOrdemDeDesenho(props)`: tapetes primeiro (na ordem da lista), depois o resto na ordem de sempre.
- **Jogador** (`drawPropSilhouettes`): percorrer `emOrdemDeDesenho(props)`.
- **Editor** (`drawProps.ts`): hoje cada móvel novo entra com `addChildAt(drawing, 0)`, por baixo dos outros. O tapete precisa ir para um `Container` próprio, "chão", no índice 0 do container de objetos, para ficar sempre abaixo de sprite e móvel.
- **Clique** (`propInteraction.findPropAt`): duas passadas de trás para a frente, primeiro tudo que não é tapete, depois os tapetes. Clicar numa cadeira em cima do tapete pega a cadeira. Seleção por retângulo segue igual.

## Tapete: geometria (`proposta.ts`)

Constantes: `TAPETE_DE_CIMA = { franja 0,06; fios 12; borda 0,12; medalhaoAoLongo 0,42; medalhaoAtravessado 0,62; miolo 0,45 }`, `TAPETE_REDONDO = { borda 0,12; medalhao 0,6; miolo 0,45 }`, `TAPETE_DE_LADO = { topo 0,6; franja 0,04; borda 0,08; fioDeCima 0,7; fioDeBaixo 0,86; pontaDoFioDeBaixo 0,75 }`.

**Retangular, de cima.** Comprimento `L` = o lado maior, `S` = o menor (`w ≥ h` → franja nas pontas esquerda/direita; senão em cima/embaixo). Franja `f = 0,06·S`; corpo = retângulo de meio comprimento `L/2 − f` e meia largura `S/2` (é a silhueta: a franja fica vazada, o chão aparece entre os fios). Borda `b = 0,12·S`; campo de dentro = corpo recuado `b`. Medalhão = losango com meias diagonais `0,42·(meio campo ao longo)` e `0,62·(meio campo atravessado)`; miolo = o mesmo losango a 0,45. Franja = 12 fios por ponta, nas posições `−S/2 + (i + 0,5)·S/12`, da beira do corpo até a beira do objeto.

**Redondo, de cima.** Silhueta = `pontosDaElipse(w, h)`. Borda `b = 0,12·m`, campo = elipse `(w − 2b) × (h − 2b)`. Losango com pontas a 0,6 do meio eixo do campo; miolo a 0,45. **Sem franja**: em volta toda, de longe, vira roda dentada, que já é a leitura da fogueira.

**De lado (as duas formas).** Silhueta = faixa de `y(0,6)` até o chão (`h/2`), de `−corpo` a `corpo`, com `corpo = w/2 − 0,04·w` no retangular e `w/2` no redondo. Borda de quina: tira de `0,08·w` em cada ponta, com o traço da beira de dentro. Retangular: dois fios por ponta, de `(±corpo, y(0,70))` a `(±w/2, chão)` e de `(±corpo, y(0,86))` a `(±(corpo + 0,75·franja), chão)`.

Áreas de cor (`desenhoDoTapete` → `regioes`): o anel da borda (um polígono só, volta de fora num sentido e de dentro no outro, ligadas por uma ponte, que o earcut do Pixi fura sem `cut()`) e o losango; de lado, as duas tiras. Traços: a beira de dentro da borda, o losango, o miolo, a franja.

## Cama: travesseiro e cobertor

Traços **iguais aos de hoje** (`tracosDoGlifo('catre')`: retângulo do travesseiro e a dobra). Áreas, só quando o campo existe:
- travesseiro: o retângulo do travesseiro de hoje, `RECUO_TRAVESSEIRO 0,12·m`, altura `0,18·h`;
- cobertor (variante proposta, "madeira à vista"): de `(−w/2 + 0,07·m, y(0,42))` a `(w/2 − 0,07·m, h/2 − 0,07·m)`. Alternativa sem moldura: de `(−w/2, y(0,42))` a `(w/2, h/2)`. **O usuário escolhe** (seção 3 do protótipo).
- A "Cor" pinta o resto: cabeceira e moldura. Sem "Preencher", nada de fundo nem de tecido (as linhas de cor de tecido ficam inertes, como a "Cor").

## Cores

| | Sem "Cor" | Com "Cor" |
|---|---|---|
| Campo do tapete | preto α 0,20 (os outros móveis: 0,35; o móvel em cima do tapete sai um tom abaixo) | a Cor, opaca |
| Borda e medalhão | mais uma camada de preto α 0,22 por cima (~0,38 do chão) | `tomEscuro(cor)`: cada canal × 0,70 (mesmo matiz) |
| Fio e glifo | o de sempre (`WALL_COLOR` α 0,5) ou a "Cor da linha" | |

Paleta de tecido (`PALETA_DE_TECIDO`, saturação ≤ ~45% HSL, branco quebrado): Branco `#e6e1d6`, Creme `#d6c49e`, Cinza `#8c8a84`, Vermelho `#9a3f36`, Azul `#46638a`, Verde `#55704a`, Roxo `#6c5280`, Castanho `#7a5838`.

Ordem de pintura (`pintarMovelProposto`): fundo → áreas de cor → fio de fora (o contorno de novo) → glifo. As áreas ficam entre o fundo e o fio para o fio nunca ficar por baixo de uma cor. Vértices alinhados ao pixel físico quando o giro é múltiplo de 90°, como `silhouettePolygon`; o redondo não alinha (curva, como o barril).

## Painel (`components/MobiliaControls.tsx`)

- **Forma** (só no tapete): segmentado `lb-seg` com ícone (retângulo / círculo) + texto, logo depois da Vista. Trocar chama `movelComOutraForma`.
- **Cor do travesseiro** e **Cor do cobertor** (só na cama, entre "Cor" e "Cor da linha"): a linha de sempre (rótulo, pipeta, seletor livre `lb-swatch`) **sem** o botão "Padrão"; embaixo, a paleta: `role="radiogroup"`, 9 amostras (`Padrão` + 8 tons), 24 px de altura, ~23 de largura, 26 px de centro a centro (WCAG 2.5.8 pelo espaçamento). "Padrão" é a primeira amostra: a cor da cama riscada na diagonal, `aria-label="Padrão (como hoje)"`. Motivo: com o botão "Padrão" na linha, "Cor do travesseiro" quebrava em duas linhas no primeiro clique e a paleta descia debaixo do cursor. Um ponto de Tab por paleta (roving tabindex); setas, Home e End andam e escolhem; marcada = anel de latão por dentro, foco = o anel de foco do app por fora. Clique numa amostra = `onAparenciaChange(id, { corDoTravesseiro: cor })` (Padrão = `null`).
- CSS novo em `MobiliaControls.css`: `.lb-cor-de-tecido`, `.lb-paleta`, `.lb-paleta__amostra`, `--padrao`, só com `var(--lb-*)` (o protótipo traz as regras prontas em `modelo.html`, bloco "NOVO: a paleta de tecido").

## Ícone (`components/icons.tsx`, `glifoDoMovel`)

```tsx
case 'tapete':
  // O corpo, o losango do medalhão e três fios de franja em cada ponta curta.
  return (
    <>
      <rect x="4.5" y="6" width="15" height="12" />
      <path d="M12 8.6l4.4 3.4-4.4 3.4-4.4-3.4z" />
      <path d="M4.5 8.5H2.5M4.5 12H2.5M4.5 15.5H2.5M19.5 8.5h2M19.5 12h2M19.5 15.5h2" />
    </>
  )
```

## Plano de implementação, por arquivo

1. `types/map.ts`: `'tapete'` em `TipoMobilia`; os três campos em `Prop`, com o comentário de "ausente = de sempre, sem migração".
2. `lib/mobilia.ts`: catálogo (rótulo, artigo, tamanhos por forma e vista, `TIPOS_COM_VISTA`); `normalizarFormaDoTapete`, `formaDoTapete`, `normalizarCorDeTecido`, `PALETA_DE_TECIDO`; `contornoDoTapete`, `desenhoDoTapete` e `regioesDaCama` (de `proposta.ts`, usando as réguas da cama que já estão lá); `tracosDoGlifo`/`contornoDeLado` passam a aceitar o tapete (ou a pintura chama as funções novas direto); patch, leitura, troca de tipo, `movelComOutraForma`, `emOrdemDeDesenho`.
3. `pixi/drawPropSilhouettes.ts`: `PropSilhouette` + 3 campos; percorrer `emOrdemDeDesenho`; silhueta do tapete por `contornoDoTapete`; as áreas de cor entre fundo e fio (`pintarMovelProposto` é o molde); fundo padrão do tapete a 0,20.
4. `pixi/drawProps.ts`: container "chão" para os tapetes no índice 0. `pixi/propInteraction.ts`: tapete por último no clique.
5. `lib/fogFilter.ts`: copiar forma e cores de tecido (depois que o outro agente que mexe nele terminar).
6. `stores/mapStore.ts`: ação de forma (`setFormaDoTapete`, desfazível) e as chaves novas no `arrastoDeCor`.
7. `components/MobiliaControls.tsx` + `.css`: Forma e as duas cores de tecido com a paleta; `PropertiesPanel.tsx` passa o `onFormaChange`.
8. `components/icons.tsx`: o ícone.
9. Testes (sem tela): leitura do disco (forma torta some, cor de tecido fora da cama some, `#ABC` vira `#aabbcc`); troca de tipo leva/derruba os campos; `emOrdemDeDesenho` estável; `findPropAt` pega a cadeira em cima do tapete; `desenhoDoTapete` com tamanho não desenhável devolve vazio, franja nas pontas curtas quando `h > w`; cama sem campos novos = mesmos traços e nenhuma área; a travessia do jogador leva os três campos e nada torto; o teste da barra que conta os itens da setinha (agora 11).
