/**
 * CALÇADA SOBRE A ÁGUA (lote L07 "Selva: ruína e água", 24/11/2026; versão do `pier`, só a ideia). O caminho de pedra
 * elevado que passa entre os tanques: as LAJES de arenito em fileiras de través (uma, duas ou três por fileira,
 * desencontradas), gastas no meio pelos pés, uma ou outra rachada ou de quina lascada, e as juntas tomadas de musgo
 * escuro; nas duas beiras compridas, o MEIO-FIO de pedras longas, com o musgo da beira molhada. A sombra do caminho
 * cai na água (ou no chão) do lado de baixo da luz.
 *
 * Objeto de chão: o token anda em cima. O trecho se reparte pelo tamanho (a fileira e a pedra do meio-fio têm medida
 * fixa: o trecho maior ganha mais fileiras, nunca laje esticada), corre ao longo do lado MAIOR da pegada e as duas
 * pontas ficam abertas, cortadas no meio de uma fileira, para emendar noutro trecho sem degrau. Nada sobe na 3/4.
 * Perfil da 3/4: `DERIVADO`. Material: `pedra` (sugestão: arenito).
 */
import { hash } from '../../ruido'
import { caixa, dentroDe, poligono, type Forma, type Ponto } from './formas'
import { texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { rumoDaSombra } from './pilhaDeFatias'
import { quartosDoGiro } from './pipaDeitada'
import { lascar, manchaDeMusgo, musgar } from './muroEmRuina'

/** O musgo escuro que toma as juntas (o leito que aparece entre as lajes). */
const JUNTAS: MaterialDaPeca = { classe: 'folha', rgb: [0x49, 0x53, 0x39] }
/** O meio-fio: a largura (casas) e o comprimento de uma pedra (casas, de partida e quanto varia). */
const MEIO_FIO = 0.15
const PEDRA_DO_MEIO_FIO = 0.7
const PEDRA_QUE_VARIA = 0.25
/** A fileira de lajes: o comprimento ao longo (casas). Os cortes de través variam até um quarto da laje: nenhuma fica estreita. */
const FILEIRA = 0.5
/** A meia folga entre duas pedras (px) e a margem das beiras compridas (px). */
const FOLGA = 0.4
const MARGEM = 0.6
/** A altura do caminho sobre a água (casas): o quanto a sombra dele anda. */
const ALTURA = 0.14
/** O gasto dos pés no meio do caminho (luz a mais). */
const GASTO = 0.07

interface Regua {
  readonly hu: number
  readonly hv: number
  readonly ponto: (u: number, v: number) => Ponto
  readonly uv: (x: number, y: number) => Ponto
  readonly caixa: (u0: number, v0: number, u1: number, v1: number, raio?: number) => Forma
  readonly quadra: (u0: number, v0: number, u1: number, v1: number) => Ponto[]
  readonly eixoDeTraves: number
}

function novaRegua(c: ContextoDoMovel): Regua {
  const deitado = c.w > c.h
  const ponto = (u: number, v: number): Ponto => (deitado ? [u, v] : [v, u])
  return {
    hu: deitado ? c.hw : c.hh,
    hv: deitado ? c.hh : c.hw,
    ponto,
    uv: ponto,
    caixa: (u0, v0, u1, v1, raio = 0) => (deitado ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio)),
    quadra: (u0, v0, u1, v1) => [ponto(u0, v0), ponto(u1, v0), ponto(u1, v1), ponto(u0, v1)],
    eixoDeTraves: deitado ? QUARTO : 0,
  }
}

export const montarCalcadaSobreAgua: MontarMovel = (c, cena) => {
  const r = novaRegua(c)
  const { g, peca: P } = c
  const pedra = c.m.pedra
  const daPedra = texturaDaClasse(pedra.classe)
  const L = cena.partes
  const { hu, hv } = r
  const mf = g * MEIO_FIO
  const dentro = hv - mf - MARGEM

  // A sombra do caminho na água, do lado de baixo da luz NA TELA, só entre as duas pontas (emenda no vizinho).
  const [rx, ry] = rumoDaSombra(quartosDoGiro(c.giro))
  const [su, sv] = r.uv(rx * ALTURA * g, ry * ALTURA * g)
  const largo = 2 * hv + 4 * ALTURA * g
  cena.sombras.push({ forma: dentroDe(r.caixa(-hu + su, -hv + MARGEM + sv, hu + su, hv - MARGEM + sv), r.caixa(-hu, -largo, hu, largo)), z: 0, suave: 1.6, forca: 0.34 })

  // O leito das juntas, de ponta a ponta.
  L.push(P(r.caixa(-hu, -hv + MARGEM, hu, hv - MARGEM), JUNTAS, { tabua: 0, bisel: 0.4, tom: 0.92, contorno: 0.2, semente: 6500 }))

  /**
   * Uma pedra do caminho: a textura da pedra, o gasto do meio, o musgo da beira e, se pedir, a racha. A inteira é a
   * caixa de cantos gastos; a lascada (mais de quatro pontos) é o polígono, que perde o canto.
   */
  const pedraDoCaminho = (pontos: readonly Ponto[], tom: number, semente: number, beiraMolhada: number, racha: readonly [number, number] | null): void => {
    const xs = pontos.map((p) => p[0])
    const ys = pontos.map((p) => p[1])
    const forma = pontos.length > 4 ? poligono(pontos) : caixa(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 1.1)
    const textura: Textura = (u, v, x, y, p, s, escala) => {
      if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
      const [, pv] = r.uv(x, y)
      let luz = GASTO * Math.max(0, 1 - (pv / dentro) ** 2 * 1.6)
      // A racha entra por uma beira da laje e para no meio dela, torta em duas escalas (uma onda só lia desenhada).
      if (racha !== null && pv > racha[1]) {
        const [pu] = r.uv(x, y)
        const torto = Math.sin(pv * 0.61 + semente) * 0.8 + Math.sin(pv * 1.73 + semente * 2.1) * 0.35
        if (Math.abs(pu - racha[0] - torto) < 0.4) luz -= 0.28
      }
      s[3] += luz
      // O musgo sobe das juntas e, no meio-fio, da beira da água.
      const beira = -forma.d(x, y)
      const daJunta = beira < 1.8 ? (1 - beira / 1.8) * manchaDeMusgo(x, y, 6510, -0.02) : 0
      const daAgua = Math.abs(pv) > hv - beiraMolhada ? manchaDeMusgo(x * 1.2, y * 1.2, 6511, -0.1) : 0
      musgar(s, Math.max(daJunta, daAgua), x, y)
    }
    L.push(P(forma, pedra, { tabua: 0, bisel: 1.3, tom, contorno: 0.24, textura, semente }))
  }

  // As LAJES em fileiras de través: a fileira das pontas corta no meio (a ponta fica aberta).
  const fileiras = Math.max(2, Math.round((2 * hu) / (g * FILEIRA)))
  const passo = (2 * hu) / fileiras
  for (let i = 0; i <= fileiras; i += 1) {
    const sorte = (k: number): number => hash(i, k, 6520)
    const u0 = Math.max(-hu, -hu + (i - 0.5) * passo) + (i > 0 ? FOLGA : 0)
    const u1 = Math.min(hu, -hu + (i + 0.5) * passo) - (i < fileiras ? FOLGA : 0)
    if (u1 - u0 < 2) continue
    // Uma, duas ou três lajes de través, cortadas em lugares sorteados.
    const quantas = sorte(1) < 0.3 ? 1 : sorte(1) < 0.8 ? 2 : 3
    const cortes: number[] = []
    for (let k = 1; k < quantas; k += 1) cortes.push(-dentro + ((2 * dentro) * (k + (sorte(1 + k) - 0.5) * 0.5)) / quantas)
    const limites = [-dentro, ...cortes, dentro]
    for (let j = 0; j + 1 < limites.length; j += 1) {
      const v0 = limites[j] + (j > 0 ? FOLGA : 0)
      const v1 = limites[j + 1] - (j + 2 < limites.length ? FOLGA : 0)
      let pontos = r.quadra(u0, v0, u1, v1)
      if (sorte(10 + j) < 0.24) pontos = lascar(pontos, Math.floor(sorte(20 + j) * 4), 2.2)
      const racha = sorte(30 + j) < 0.14 ? ([(u0 + u1) / 2 + (sorte(40 + j) - 0.5) * (u1 - u0) * 0.4, v0 + (v1 - v0) * (0.2 + 0.4 * sorte(45 + j))] as const) : null
      pedraDoCaminho(pontos, 0.86 + 0.2 * sorte(50 + j), 6530 + i * 4 + j, 0, racha)
    }
  }

  // O MEIO-FIO das duas beiras compridas: pedras longas desencontradas, a beira de fora molhada e com musgo.
  for (const lado of [-1, 1]) {
    const v0 = lado < 0 ? -hv + MARGEM : hv - mf - MARGEM + FOLGA * 2
    const v1 = lado < 0 ? -hv + mf + MARGEM - FOLGA * 2 : hv - MARGEM
    let u = -hu - (lado > 0 ? g * PEDRA_DO_MEIO_FIO * 0.5 : 0)
    for (let k = 0; u < hu - 1e-6; k += 1) {
      const comprimento = g * (PEDRA_DO_MEIO_FIO + PEDRA_QUE_VARIA * hash(k, lado + 2, 6560))
      const u0 = Math.max(-hu, u) + (u > -hu ? FOLGA : 0)
      const u1 = Math.min(hu, u + comprimento) - (u + comprimento < hu ? FOLGA : 0)
      u += comprimento
      if (u1 - u0 < 3) continue
      pedraDoCaminho(r.quadra(u0, v0, u1, v1), 0.84 + 0.1 * hash(k, lado + 5, 6561), 6570 + k * 2 + (lado + 1) / 2, 3.2, null)
    }
  }
}
