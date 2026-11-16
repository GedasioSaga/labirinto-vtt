/**
 * PANELAS E BACIAS EMPILHADAS de cima com volume (lote L1 de 16/11/2026, necrotério e laboratório; versão ORIGINAL,
 * só a ideia do objeto das referências): a louça de ágata de hospital antigo largada no chão, branca de beira
 * azul-marinho e lascada. À esquerda, a PILHA de três BACIAS redondas encaixadas uma na outra, um nada desencontradas
 * (as beiras de baixo aparecem em meia-lua); no fundo à direita, a PANELA com a tampa, o pegador e as duas alças; na
 * frente à direita, três CUBAS-RIM empilhadas; e, no canto da frente à esquerda, a CANECA. As lascas mostram o ferro
 * escuro por baixo do esmalte.
 *
 * A 25% de zoom sobram os discos brancos com o fio azul em volta: é o que diz "louça de ágata".
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): cada grupo é uma coluna da altura dele (a pilha, a panela, as cubas e a
 * caneca), com a frente do esmalte branco; as alças da panela sobem com ela (`comMeioEm`). Nada lê o giro.
 *
 * Sem material escolhido: o esmalte, a beira azul e a lasca são fixos.
 */
import { anel, caixa, capsula, elipse, elipseGirada, menos, type Forma } from './formas'
import { contato } from './motor'
import { type MontarMovel } from './contexto'
import { comMeioEm } from './varalDeBandeirinhas'
import { BEIRA_AZUL, ESMALTE, LASCA, PISO_DO_NECROTERIO, texEsmalte } from './apoioDoNecroterio'

/** As alturas de cada grupo, em casas. */
const ALTURA_DA_PILHA = 0.14
const ALTURA_DA_PANELA = 0.24
const ALTURA_DAS_CUBAS = 0.07
const ALTURA_DA_CANECA = 0.12
/** A grossura da beira azul (px). */
const BEIRA = 1.1

const esmalte = (semente: number, bisel: number, fundo: boolean) => ({
  tabua: 0, bisel, contorno: 0.26, textura: texEsmalte, semente, ...(fundo ? { recesso: { k: 1.6, forca: 0.34 } } : {}), projeta: { dist: 0.9, forca: 0.28 },
})
const beira = (semente: number) => ({ tabua: 0, bisel: 0.5, contorno: 0.28, textura: texEsmalte, semente })
const lasca = (semente: number) => ({ tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, semente })

export const montarPanelasEBacias: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_NECROTERIO
  const m = Math.min(hw, hh)
  const L = cena.partes
  const coluna = (forma: Forma, altura: number): void => {
    cena.sombras.push({ forma, z: g * altura, suave: 1.2, forca: 0.28 }, contato(forma, 0.32))
  }

  // A pilha de bacias: três discos encaixados, cada um um nada para a frente e para a direita do de baixo.
  const [px, py, pr] = [-m * 0.3, -m * 0.12, m * 0.56]
  coluna(elipse(px + 1, py + 0.8, pr + 1, pr + 1), ALTURA_DA_PILHA)
  for (let i = 0; i < 3; i += 1) {
    const [x, y, r] = [px + i * 1.2, py + i * 0.9, pr - i * 0.6]
    const topo = i === 2
    L.push(P(elipse(x, y, r, r), ESMALTE, esmalte(7901 + i * 3, topo ? r * 0.18 : 1, topo)))
    L.push(P(anel(x, y, r, r, r - BEIRA, r - BEIRA), BEIRA_AZUL, beira(7902 + i * 3)))
    if (topo) {
      // O fundo da bacia de cima: um disco liso, um degrau abaixo, e as lascas na beira e no fundo.
      L.push(P(elipse(x + r * 0.08, y + r * 0.08, r * 0.45, r * 0.45), ESMALTE, { tabua: 0, bisel: 0.6, tom: 0.95, contorno: 0.08, textura: texEsmalte, semente: 7910 }))
      L.push(P(elipseGirada(x + r * 0.62, y - r * 0.6, 1.6, 0.9, 0.8), LASCA, lasca(7911)))
      L.push(P(elipseGirada(x - r * 0.2, y + r * 0.35, 1.1, 0.7, -0.4), LASCA, { ...lasca(7912), alfa: 0.6 }))
    }
  }

  // A panela tampada: as duas alças (sobem com ela), o corpo, a tampa com a beira azul e o pegador.
  const [nx, ny, nr] = [m * 0.5, -m * 0.48, m * 0.36]
  coluna(elipse(nx, ny, nr, nr), ALTURA_DA_PANELA)
  for (const lado of [-1, 1]) {
    const alca = menos(elipseGirada(nx + lado * nr * 1.05, ny, nr * 0.24, nr * 0.34, 0), elipseGirada(nx + lado * nr * 1.05, ny, nr * 0.12, nr * 0.2, 0))
    L.push(P(comMeioEm(alca, nx + lado * nr * 0.6, ny), BEIRA_AZUL, { ...beira(7920), projeta: { dist: 0.7, forca: 0.26 } }))
  }
  L.push(P(elipse(nx, ny, nr, nr), ESMALTE, esmalte(7921, 1.2, false)))
  L.push(P(anel(nx, ny, nr, nr, nr - BEIRA, nr - BEIRA), BEIRA_AZUL, beira(7922)))
  L.push(P(elipse(nx, ny, nr * 0.86, nr * 0.86), ESMALTE, { ...esmalte(7923, nr * 0.35, false), tom: 1.03 }))
  L.push(P(elipse(nx, ny, nr * 0.22, nr * 0.22), BEIRA_AZUL, { ...beira(7924), bisel: 0.8, projeta: { dist: 0.9, forca: 0.3 } }))
  L.push(P(elipseGirada(nx - nr * 0.55, ny + nr * 0.4, 1.2, 0.8, 0.5), LASCA, lasca(7925)))

  // As duas cubas-rim empilhadas, bem desencontradas (o feijão com a curva para trás): mais que duas, com a mordida
  // repetida, liam como uma concha em espiral.
  const [kx, ky] = [m * 0.42, m * 0.52]
  const rim = (x: number, y: number, s: number): Forma => menos(elipse(x, y, m * 0.34 * s, m * 0.2 * s), elipse(x, y - m * 0.2 * s, m * 0.16 * s, m * 0.08 * s))
  coluna(rim(kx - 1, ky - 0.6, 1.08), ALTURA_DAS_CUBAS)
  // O esmalte branco vem primeiro e inteiro: é a maior caixa da coluna, e a frente dela na 3/4 sai branca.
  for (let i = 0; i < 2; i += 1) {
    const [x, y] = [kx - i * 2.6, ky - i * 1.5]
    L.push(P(rim(x, y, 1), ESMALTE, esmalte(7930 + i * 2, 0.6, false)))
    L.push(P(menos(rim(x, y, 1), rim(x, y, 0.84)), BEIRA_AZUL, beira(7931 + i * 2)))
    if (i === 1) L.push(P(rim(x, y, 0.84), ESMALTE, esmalte(7935, 1.4, true)))
  }

  // A caneca: o corpo, a beira, o fundo e a asa.
  const [qx, qy, qr] = [-m * 0.62, m * 0.62, m * 0.17]
  coluna(elipse(qx, qy, qr, qr), ALTURA_DA_CANECA)
  L.push(P(comMeioEm(menos(caixa(qx + qr * 0.7, qy - qr * 0.35, qx + qr * 1.55, qy + qr * 0.35, qr * 0.3), caixa(qx + qr * 0.85, qy - qr * 0.16, qx + qr * 1.35, qy + qr * 0.16, 0.3)), qx, qy), ESMALTE, { ...esmalte(7940, 0.5, false), projeta: { dist: 0.6, forca: 0.26 } }))
  L.push(P(elipse(qx, qy, qr, qr), ESMALTE, esmalte(7941, qr * 0.3, true)))
  L.push(P(anel(qx, qy, qr, qr, qr - BEIRA * 0.8, qr - BEIRA * 0.8), BEIRA_AZUL, beira(7942)))
  L.push(P(capsula(qx - qr * 0.4, qy - qr * 0.75, qx - qr * 0.1, qy - qr * 0.85, 0.5), LASCA, lasca(7943)))
}
