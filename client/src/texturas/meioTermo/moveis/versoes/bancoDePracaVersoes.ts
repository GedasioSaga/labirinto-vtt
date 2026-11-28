/**
 * As VERSÕES do banco de praça (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`;
 * tema Neve): a 1ª, a de hoje, é o desenho de `MONTADORES` (`../bancoDePraca.ts`). Aqui fica COM NEVE: o MESMO banco,
 * de ripas e ferro, depois de uma noite de neve.
 *
 * - O ASSENTO leva um colchão só de neve, de beira mole, que deixa a madeira à mostra nas pontas, perto dos braços;
 *   nos vãos entre as ripas a neve afunda um nada (a linha das ripas ainda se lê por baixo).
 * - O ENCOSTO tem um fio de neve no alto das duas ripas, com falhas.
 * - Os BRAÇOS de ferro ganham um punhado de neve no começo, os PUNHOS e os MONTANTES um chapéu pequeno.
 *
 * Como a troca acontece: o desenho de hoje é chamado com uma fábrica de peças que guarda as opções de cada peça; a
 * semente diz o que ela é (`../bancoDePraca.ts`: ripas 520+, encosto 531 e 532, braços 541±1, punhos 544±1,
 * montantes 547±1). O colchão do assento entra depois da última ripa (e dos parafusos dela); a neve das outras peças,
 * logo depois de cada uma. Na 3/4 derivada a neve tem o meio da caixa dentro da estrutura da peça que cobre e sobe com
 * ela. Lugares de material: `madeira` e `ferragens`, os de hoje.
 */
import { hash } from '../../../ruido'
import { caixa, dentroDe, elipse, poligono, type Forma, type Ponto } from '../formas'
import type { CriarPeca, OpcoesDaPeca, Peca } from '../motor'
import { montarBancoDePraca } from '../bancoDePraca'
import { quartosDoGiro } from '../pipaDeitada'
import { NEVE, texDaNeveDeitada } from '../bonecoDeNeve'
import type { VersoesDesenhadas } from '.'

/** As faixas de semente das peças do desenho de hoje (`../bancoDePraca.ts`). */
const SEMENTES = {
  ripa: [520, 531],
  encosto: [531, 533],
  braco: [540, 543],
  punho: [543, 546],
  montante: [546, 549],
} as const

type Tipo = keyof typeof SEMENTES | 'outra'

function tipoDa(o: OpcoesDaPeca | undefined): Tipo {
  const semente = o?.semente ?? -1
  for (const tipo of Object.keys(SEMENTES) as (keyof typeof SEMENTES)[]) {
    const [de, ate] = SEMENTES[tipo]
    if (semente >= de && semente < ate) return tipo
  }
  return 'outra'
}

/** O colchão do assento: quanto da meia largura ele cobre, o quanto ele se arredonda nas pontas e o ondulado (px). */
const COLCHAO = { largura: 0.8, altura: 0.86, expoente: 4, ondula: 1.5 } as const
const VOLTA = 48

/** Um retângulo de pontas redondas (superelipse) com a beira ondulada: a neve deitada em cima de uma peça. */
function manchaDeNeve(cx: number, cy: number, rx: number, ry: number, semente: number): Forma {
  const pontos = Array.from({ length: VOLTA }, (_, i): Ponto => {
    const t = (i / VOLTA) * 2 * Math.PI
    const c = Math.cos(t)
    const s = Math.sin(t)
    const onda = COLCHAO.ondula * (Math.sin(t * 7 + semente) * 0.5 + (hash(i, semente, 8701) - 0.5) * 0.9)
    const ex = 2 / COLCHAO.expoente
    return [cx + Math.sign(c) * Math.abs(c) ** ex * (rx + onda), cy + Math.sign(s) * Math.abs(s) ** ex * (ry + onda * 0.4)]
  })
  return poligono(pontos)
}

export const versoesDoBancoDePraca: VersoesDesenhadas = {
  comNeve: (c, cena) => {
    const opcoes = new Map<Peca, OpcoesDaPeca | undefined>()
    const guardar: CriarPeca = (forma, mat, o) => {
      const p = c.peca(forma, mat, o)
      opcoes.set(p, o)
      return p
    }
    montarBancoDePraca({ ...c, peca: guardar }, cena)

    const P = c.peca
    const tex = texDaNeveDeitada(quartosDoGiro(c.giro))
    const neve = (forma: Forma, semente: number, bisel: number): Peca =>
      P(forma, NEVE, { tabua: 0, bisel, contorno: 0.1, textura: tex, semente, projeta: { dist: 0.7, forca: 0.12 } })

    const ripas: Forma[] = []
    const novas: Peca[] = []
    let assentoFeito = false
    const cobrirAssento = (): void => {
      if (assentoFeito || ripas.length === 0) return
      assentoFeito = true
      const x0 = Math.min(...ripas.map((r) => r.b[0]))
      const y0 = Math.min(...ripas.map((r) => r.b[1]))
      const x1 = Math.max(...ripas.map((r) => r.b[2]))
      const y1 = Math.max(...ripas.map((r) => r.b[3]))
      const assento = caixa(x0, y0, x1, y1)
      const colchao = dentroDe(manchaDeNeve((x0 + x1) / 2, (y0 + y1) / 2 - 0.4, ((x1 - x0) / 2) * COLCHAO.largura, ((y1 - y0) / 2) * COLCHAO.altura, 3.3), assento)
      novas.push(P(colchao, NEVE, { tabua: 0, bisel: 3.2, contorno: 0.06, textura: tex, semente: 8720, projeta: { dist: 0.9, forca: 0.14 } }))
      // A neve afunda um nada em alguns vãos entre duas ripas, num trecho só de cada um.
      const ordem = [...ripas].sort((a, b) => a.b[1] - b.b[1])
      const largo = x1 - x0
      for (let k = 1; k < ordem.length; k += 1) {
        if (hash(k, 1, 8722) < 0.35) continue
        const y = (ordem[k - 1].b[3] + ordem[k].b[1]) / 2
        const a = x0 + largo * (0.14 + 0.22 * hash(k, 2, 8722))
        const b = x1 - largo * (0.14 + 0.22 * hash(k, 3, 8722))
        novas.push(P(dentroDe(caixa(a, y - 0.35, b, y + 0.35, 0.35), colchao), NEVE, { tabua: 0, bisel: 0, contorno: 0, tom: 0.88, alfa: 0.3, suave: 0.8, semente: 8721 + k }))
      }
    }
    for (const p of cena.partes) {
      const o = opcoes.get(p)
      const tipo = tipoDa(o)
      if (tipo !== 'ripa' && o?.semente !== undefined) cobrirAssento()
      novas.push(p)
      const [x0, y0, x1, y1] = p.forma.b
      const largo = x1 - x0
      const alto = y1 - y0
      const semente = o?.semente ?? 0
      if (tipo === 'ripa') {
        ripas.push(p.forma)
      } else if (tipo === 'encosto') {
        // O fio de neve no alto da ripa, em dois ou três lances com falhas entre eles.
        const lances = 2 + Math.round(hash(semente, 1, 8740))
        const passo = (largo - 3) / lances
        for (let k = 0; k < lances; k += 1) {
          const a = x0 + 1.5 + k * passo + (k > 0 ? 1.2 + 1.6 * hash(k, semente, 8741) : 0)
          const b = x0 + 1.5 + (k + 1) * passo - (k < lances - 1 ? 0.6 + 1.4 * hash(k, semente, 8742) : 0)
          novas.push(neve(dentroDe(caixa(a, y0 + alto * 0.12, b, y0 + alto * (semente === 532 ? 0.5 : 0.4), alto * 0.2), p.forma), 8745 + k, alto * 0.16))
        }
      } else if (tipo === 'braco') {
        novas.push(neve(dentroDe(caixa(x0 + largo * 0.26, y0 + 1.2, x1 - largo * 0.3, y0 + 1.2 + alto * 0.36, largo * 0.3), p.forma), 8750 + semente, largo * 0.18))
      } else if (tipo === 'punho') {
        const r = largo / 2
        novas.push(neve(dentroDe(elipse(x0 + r * 0.88, y0 + r * 0.84, r * 0.56, r * 0.5), p.forma), 8760 + semente, r * 0.32))
      } else if (tipo === 'montante') {
        novas.push(neve(dentroDe(caixa(x0 + largo * 0.24, y0 + 0.5, x1 - largo * 0.28, y0 + Math.min(alto * 0.3, largo), largo * 0.3), p.forma), 8780 + semente, largo * 0.18))
      }
    }
    cobrirAssento()
    cena.partes.length = 0
    cena.partes.push(...novas)
  },
}
