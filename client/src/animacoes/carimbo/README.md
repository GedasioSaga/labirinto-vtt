# Carimbo (pacote)

Objeto novo da ferramenta **Carimbos** (o mestre solta ou espalha no mapa), que
chega sem instalador no mesmo pacote das animações e das texturas.

`<id>.ts` — `export default` o desenho do objeto
(`DesenhoDeCarimbo` em `src/carimbos/embutidos.ts`):

```ts
import { css } from '../../carimbos/embutidos'

/** Um cacto: o corpo claro do lado da luz (esquerda) e escuro do outro. */
export default function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.rotate(Math.sin(giro) * 0.06) // em pé: o giro só inclina de leve
  g.fillStyle = css([92, 140, 96])
  g.fillRect(-0.09, -0.9, 0.09, 0.9)
  g.fillStyle = css([58, 104, 70])
  g.fillRect(0, -0.9, 0.09, 0.9)
}
```

- **O quadro**: 1 unidade = o tamanho natural do objeto; a BASE (onde ele
  toca o chão) fica na origem. Desenhe dentro de x de -0,75 a 0,75 e y de
  -1,2 (o alto) a 0,3 — o que passar disso é cortado.
- **O giro** (radianos) e a **semente** (0 a 7): cada objeto do mapa usa um de
  oito desenhos, um a cada 45°. Gire o que faz sentido girar (pedras, folhas,
  lóbulos da copa) e só incline o que fica em pé. A **luz não gira**: vem
  sempre de cima à esquerda, como no relevo.
- **Sem sombra no chão**: ela sai da silhueta, deitada para baixo e para a
  direita pelo `sombra` do `.json`.
- **Não estoura**: o teste dos embutidos (`src/carimbos/embutidos.test.ts`) é a
  régua — nenhum canal acima de 245, saturação contida, sem contorno grosso nem
  listra fina. Rode a mesma medida no carimbo novo antes de aprovar.
- Só Canvas 2D, sem estado entre chamadas. O desenho que lança some do mapa
  (o resto segue).

`<id>.json`:

```json
{ "nome": "Cacto", "tamanho": 10, "sombra": "em-pe" }
```

`tamanho`: o tamanho natural no mapa, em px do protótipo do relevo (2 a 80; o
Pinheiro usa 14, o Arbusto 6). `sombra`: `em-pe` (alto, sombra comprida),
`baixa` (rente ao chão) ou `nenhuma` (do chão, como a poça: vai por baixo das
sombras dos outros). O id não pode ser o de um carimbo da biblioteca: os 12
de `src/carimbos/embutidos.ts` (`pinheiro`, `pinheiro-nevado`, `arvore`,
`arvore-redonda`, `arvore-morta`, `arbusto`, `tronco-caido`, `toco-seco`,
`palmeira`, `pedras`, `poca`, `juncos`) e os novos de `src/carimbos/novos/`
(`cerejeira`, `bambuzal`, `cogumelo-gigante`, `mangue`, `carvalho`,
`arvore-de-outono`, `salgueiro`, `betula`, `macieira`, `ipe-amarelo`,
`ipe-roxo`, `araucaria`, `bananeira`, `samambaia`, `capim-alto`,
`flores-do-campo`, `arbusto-com-frutinhas`, `folhas-secas`, `galhos-caidos`,
`seixos`, `lama`, `musgo`, `vitoria-regia`, `conchas`, `algas`, `coral`,
`cacto`, `cacto-redondo`, `arbusto-que-rola`, `cranio-de-boi`,
`monte-de-neve`, `arvore-congelada`, `bloco-de-gelo`, `cristais`,
`estalagmite`, `cogumelos-que-brilham`, `rochedo-com-musgo`,
`rocha-vulcanica`, `raiz-retorcida`, `planta-carnivora`, `flor-gigante`,
`arvore-de-doces`). A exceção são os dois daqui, `girassol` e `girassois`:
desde 14/11/2026 a biblioteca os tem com este mesmo desenho
(`src/carimbos/novos/girassol.ts` e `girassois.ts` importam daqui), o app
novo pula a entrada do pacote e o pacote continua levando os dois para o app
mais velho. Mudar o desenho deles aqui muda também o da biblioteca.
