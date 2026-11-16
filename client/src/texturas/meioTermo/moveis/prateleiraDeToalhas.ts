/**
 * PRATELEIRA DE TOALHAS (lote L2 das referências, 16/11/2026, das parciais: versão original, só a ideia). A estante
 * aberta de madeira, de duas laterais, fundo de tábuas, três prateleiras e o tampo, com as TOALHAS DOBRADAS em pilhas
 * (as brancas de linho e as da cor escolhida, com a barra perto da dobra) recuadas da beira da tábua, e uma toalha
 * dobrada esquecida em cima do tampo. Cabe num banheiro antigo, numa enfermaria ou num quarto de hotel. A frente é o
 * lado de baixo da pegada; o fundo encosta na parede.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): de cima aparecem o tampo de tábuas e a toalha em
 * cima dele; na 3/4 a estante sobe e cada prateleira mostra a beira da tábua e as pilhas, com a dobra de frente de
 * cada toalha (a textura da fatia escurece o pé e clareia o alto da dobra). Perfil da 3/4:
 * `{ modo: 'derivado', espessura: 0 }`. Materiais: `madeira` e `toalha` (as coloridas; as brancas são do linho fixo,
 * `LENCOL`).
 */
import { hash } from '../../ruido'
import { caixa } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { LENCOL, type MontarMovel } from './contexto'
import { alturas, novoFatiador, type Fatiador } from './pilhaDeFatias'
import { lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'

/** Altura da estante (casas) e as alturas das três prateleiras, em fração dela. */
const ALTURA = 1.25
const PRATELEIRAS = [0.03, 0.33, 0.63] as const
/** A lateral, a grossura da tábua, o fundo e quanto o tampo passa das laterais (px do protótipo). */
const LATERAL = 2.6
const TABUA = 1.6
const FUNDO = 1.1
const BEIRAL = 0.8
/** A toalha dobrada: a grossura (px), a folga entre as pilhas e o recuo da beira da prateleira. */
const TOALHA = 2.4
const FOLGA = 1.2
const RECUO = 3.6
/** As pilhas de cada prateleira (de baixo para cima): quantas toalhas em cada pilha e quais são coloridas. */
const PILHAS: readonly (readonly (readonly ('b' | 'c')[])[])[] = [
  [['b', 'b', 'b', 'b'], ['c', 'c', 'c']],
  [['c', 'b', 'c'], ['b', 'b', 'b'], ['c', 'c']],
  [['b', 'b', 'b'], ['c', 'c', 'c', 'c']],
]

export const montarPrateleiraDeToalhas: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const madeira = c.m.madeira
  const colorida = c.m.toalha
  const f: Fatiador = novoFatiador(P, cena, c.giro)
  const q = f.q
  const daMadeira = texturaDaClasse(madeira.classe)
  const doPano = texturaDaClasse('tecido')
  const H = g * ALTURA
  const [x0, x1, y0, y1] = [-hw + 0.6 + BEIRAL, hw - 0.6 - BEIRAL, -hh + 0.4, hh - 0.6 - BEIRAL]

  const tabuaDePe = (z: number, nx: number, ny: number, tom: number): Textura => (u, v, x, y, p, s, escala) => {
    if (daMadeira !== null) daMadeira(z * 1.6 + u * 0.2, v, x, y, p, s, escala)
    s[3] += luzDaNormal(nx, ny, 0, q) + tom
  }

  // As LATERAIS e o FUNDO de tábuas, do chão até o tampo (o fundo mais escuro: fica na sombra da estante, e as
  // juntas das tábuas correm de pé).
  for (const z of alturas(0, H - TABUA, 1)) {
    for (const sx of [-1, 1]) {
      const lateral = sx < 0 ? caixa(x0, y0, x0 + LATERAL, y1, 0.4) : caixa(x1 - LATERAL, y0, x1, y1, 0.4)
      f.fatia(0, z, lateral, madeira, lisa(0.9, tabuaDePe(z, sx * 0.6, 0.8, 0), 5902))
    }
    const fundo: Textura = (_u, _v, x, y, p, s, escala) => {
      if (daMadeira !== null) daMadeira(x * 0.3, z * 1.6, x, y, p, s, escala)
      s[3] += Math.abs(Math.sin(x * 0.42)) < 0.08 ? -0.2 : 0
    }
    f.fatia(0, z, caixa(x0 + LATERAL, y0, x1 - LATERAL, y0 + FUNDO), madeira, lisa(0.6, fundo, 5903))
  }

  /** Uma tábua deitada de (zp - TABUA) a zp, com a beira de cima chanfrada e o veio ao comprido. */
  const tabua = (forma: ReturnType<typeof caixa>, zp: number, semente: number) => {
    for (const z of alturas(Math.max(0, zp - TABUA), zp, 0.8)) {
      f.fatia(0, z, forma, madeira, z >= zp - 1e-6 ? { eixo: 0, tabua: 0, bisel: 0.5, tom: 0.98, contorno: 0.24, semente } : lisa(0.84, tabuaDePe(z, 0, 1, 0), semente + 1))
    }
  }

  /** Uma pilha de toalhas dobradas com o pé em `zp`, centrada em `cx`, de largura `larg`. */
  const pilha = (tipos: readonly ('b' | 'c')[], zp: number, cx: number, larg: number, frente: number, chave: number) => {
    tipos.forEach((tipo, n) => {
      const mat: MaterialDaPeca = tipo === 'b' ? LENCOL : colorida
      // Cada toalha um nada torta: a pilha de verdade não é um tijolo.
      const torto = (hash(chave, n, 5922) - 0.5) * 1.4
      const forma = caixa(cx - larg / 2 + torto, y0 + FUNDO + 1.2, cx + larg / 2 + torto, frente - 0.3 * n, 1.4)
      const zb = zp + n * TOALHA
      const dobra: Textura = (u, v, x, y, p, s, escala) => {
        if (doPano !== null) doPano(u, v, x, y, p, s, escala)
        // A barra das coloridas: duas listras claras perto da dobra.
        if (tipo === 'c' && Math.abs(Math.abs(x - (cx + torto)) - larg * 0.3) < 0.6) s[3] += 0.14
      }
      for (const z of alturas(zb + 0.2, zb + TOALHA, 0.6)) {
        const t = (z - zb) / TOALHA
        const topo = z >= zb + TOALHA - 1e-6
        f.fatia(1, z, forma, mat, topo ? { tabua: 0, bisel: 1.3, tom: 1, contorno: 0.2, ruga: 0.5, textura: dobra, semente: 5930 + n } : lisa(0.66 + 0.34 * Math.sin(Math.PI * t), dobra, 5931))
      }
    })
  }

  // As PRATELEIRAS: a tábua de lado a lado, com a beira à mostra na frente das pilhas.
  const largura = x1 - x0 - 2 * LATERAL
  PRATELEIRAS.forEach((fz, k) => {
    const zp = H * fz + TABUA
    tabua(caixa(x0 + LATERAL - 0.2, y0 + FUNDO, x1 - LATERAL + 0.2, y1, 0.4), zp, 5910 + k * 2)
    const vao = largura / PILHAS[k].length
    PILHAS[k].forEach((tipos, j) => {
      const larg = vao - 2 * FOLGA - 1.2 * hash(k, j, 5920)
      const cx = x0 + LATERAL + vao * (j + 0.5) + (hash(j, k, 5921) - 0.5) * 1.2
      pilha(tipos, zp, cx, larg, y1 - RECUO, k * 7 + j)
    })
  })

  // O TAMPO, que passa um pouco das laterais e da frente, e a toalha esquecida em cima dele.
  tabua(caixa(x0 - BEIRAL, y0, x1 + BEIRAL, y1 + BEIRAL, 0.6), H, 5940)
  pilha(['c'], H, x0 + (x1 - x0) * 0.62, (x1 - x0) * 0.34, y1 - 1.6, 99)
  f.fechar()

  // A sombra da estante alta, varrida do pé até a do tampo, e o contato no pé.
  cena.sombras.push(sombraVarrida(x0, y0, x1, y1, H * 0.55, q, 0.22, 2.6), contato(caixa(x0, y0, x1, y1, 0.6), 0.3))
}
