/**
 * CALÇADA SOBRE A ÁGUA (lote L07 "Selva: ruína e água", 24/11/2026; versão do `pier`, só a ideia). O caminho de pedra
 * elevado que passa entre os tanques: as LAJES de arenito em fileiras de través (uma, duas ou três por fileira,
 * desencontradas), gastas e um nada polidas no meio pelos pés, uma ou outra com uma fissura reta e quebrada que entra
 * pela beira, ou de quina lascada; as juntas finas no escuro da pedra, com musgo só em trechos; nas duas beiras
 * compridas, o MEIO-FIO de pedras longas, mais escuro e um nada mais alto (faz sombra curta nas lajes), com o musgo da
 * beira molhada. A sombra do caminho cai na água (ou no chão) do lado de baixo da luz.
 *
 * Objeto de chão: o token anda em cima. O trecho se reparte pelo tamanho (a fileira e a pedra do meio-fio têm medida
 * fixa: o trecho maior ganha mais fileiras, nunca laje esticada), corre ao longo do lado MAIOR da pegada e as duas
 * pontas ficam abertas, cortadas no meio de uma fileira, para emendar noutro trecho sem degrau. Nada sobe na 3/4.
 * Perfil da 3/4: `DERIVADO`. Material: `pedra` (sugestão: arenito).
 */
import { hash } from '../../ruido'
import { caixa, dentroDe, poligono, type Forma, type Ponto } from './formas'
import { ruido, type Textura } from './motor'
import { type ContextoDoMovel, type MontarMovel } from './contexto'
import { rumoDaSombra } from './pilhaDeFatias'
import { quartosDoGiro } from './pipaDeitada'
import { ladoMaior, lascar, manchaDeMusgo, musgar, musgoDoAlto, pedraDeLaje, rumoUnitario, sombraDaBeira, suave } from './muroEmRuina'

/** O meio-fio: a largura (casas), o tom (mais escuro que as lajes) e o comprimento de uma pedra (casas, de partida e quanto varia). */
const MEIO_FIO = 0.2
const TOM_DO_MEIO_FIO = 0.82
const PEDRA_DO_MEIO_FIO = 0.7
const PEDRA_QUE_VARIA = 0.25
/** A sombra curta que o meio-fio faz nas lajes: ele fica um nada acima delas. */
const PROJECAO_DO_MEIO_FIO = { dist: 1.6, forca: 0.3 } as const
/** O tom das lajes (e quanto varia de uma para outra). */
const TOM_DA_LAJE = 0.95
const TOM_QUE_VARIA = 0.07
/** A fileira de lajes: o comprimento ao longo (casas). Os cortes de través variam até um quarto da laje: nenhuma fica estreita. */
const FILEIRA = 0.5
/** A meia folga entre duas pedras (px: a junta fica com ~1 px) e a margem das beiras compridas (px). */
const FOLGA = 0.5
const MARGEM = 0.6
/** A junta: o leito no escuro da própria pedra (marrom no arenito, nunca verde) e o contorno das pedras. */
const TOM_DA_JUNTA = 0.4
const CONTORNO_DA_PEDRA = 0.3
/** A altura do caminho sobre a água (casas): o quanto a sombra dele anda. */
const ALTURA = 0.14
/** O gasto dos pés no meio do caminho: a luz a mais e o quanto ele alisa o grão da pedra (polida). */
const GASTO = 0.065
const POLIDO = 0.35
/** A fissura: a meia largura (px), a luz dela e a do fio claro do lado aceso (até onde vai, px). */
const FISSURA = { meia: 0.42, luz: -0.3, fio: 1.3, luzDoFio: 0.09 } as const

interface Regua {
  readonly hu: number
  readonly hv: number
  readonly ponto: (u: number, v: number) => Ponto
  readonly uv: (x: number, y: number) => Ponto
  readonly caixa: (u0: number, v0: number, u1: number, v1: number, raio?: number) => Forma
  readonly quadra: (u0: number, v0: number, u1: number, v1: number) => Ponto[]
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
  }
}

type Segmento = readonly [number, number, number, number]

/** A distância do ponto ao segmento, e o ponto mais perto dele em `PERTO`. */
const PERTO = new Float64Array(2)
function aoSegmento(x: number, y: number, s: Segmento): number {
  const [ax, ay, bx, by] = s
  const dx = bx - ax
  const dy = by - ay
  let h = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9)
  h = h < 0 ? 0 : h > 1 ? 1 : h
  PERTO[0] = ax + dx * h
  PERTO[1] = ay + dy * h
  return Math.hypot(x - PERTO[0], y - PERTO[1])
}

export const montarCalcadaSobreAgua: MontarMovel = (c, cena) => {
  const r = novaRegua(c)
  const { g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const { hu, hv } = r
  const mf = g * MEIO_FIO
  const dentro = hv - mf - MARGEM
  const q = quartosDoGiro(c.giro)
  const rumo = rumoUnitario(q)

  // A sombra do caminho na água, do lado de baixo da luz NA TELA, só entre as duas pontas (emenda no vizinho).
  const [rx, ry] = rumoDaSombra(q)
  const [su, sv] = r.uv(rx * ALTURA * g, ry * ALTURA * g)
  const largo = 2 * hv + 4 * ALTURA * g
  cena.sombras.push({ forma: dentroDe(r.caixa(-hu + su, -hv + MARGEM + sv, hu + su, hv - MARGEM + sv), r.caixa(-hu, -largo, hu, largo)), z: 0, suave: 1.6, forca: 0.34 })

  // O leito das juntas, de ponta a ponta, no escuro da pedra.
  L.push(P(r.caixa(-hu, -hv + MARGEM, hu, hv - MARGEM), pedra, { tabua: 0, bisel: 0.4, tom: TOM_DA_JUNTA, contorno: 0.2, textura: pedraDeLaje(pedra, 6500, 2 * hu), semente: 6500 }))

  /**
   * Uma pedra do caminho: a pedra de laje, o gasto do meio, o musgo das juntas (em trechos) e da beira molhada e, se
   * pedir, a fissura. A inteira é a caixa de cantos gastos; a lascada (mais de quatro pontos) é o polígono.
   */
  const pedraDoCaminho = (pontos: readonly Ponto[], tom: number, semente: number, beiraMolhada: number, fissura: readonly Segmento[], meioFio: boolean): void => {
    const xs = pontos.map((p) => p[0])
    const ys = pontos.map((p) => p[1])
    const forma = pontos.length > 4 ? poligono(pontos) : caixa(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 0.9)
    const daPedra = pedraDeLaje(pedra, semente, ladoMaior(forma))
    const textura: Textura = (u, v, x, y, p, s, escala) => {
      const antes = s[3]
      daPedra(u, v, x, y, p, s, escala)
      const [, pv] = r.uv(x, y)
      // O gasto: a faixa do meio mais clara e com o grão alisado (polida pelos pés).
      const gasto = meioFio ? 0 : Math.exp(-((pv / (dentro * 0.5)) ** 2))
      s[3] = antes + (s[3] - antes) * (1 - POLIDO * gasto) + GASTO * gasto
      // A fissura: reta, em pedaços quebrados; o fio do lado virado para a luz pega um nada de claro.
      for (const seg of fissura) {
        const d = aoSegmento(x, y, seg)
        if (d < FISSURA.meia) {
          s[3] += FISSURA.luz
          break
        }
        if (d < FISSURA.fio && (x - PERTO[0]) * rumo[0] + (y - PERTO[1]) * rumo[1] > 0) {
          s[3] += FISSURA.luzDoFio
          break
        }
      }
      // O musgo: nas juntas só em trechos (~30% do comprimento) e mais do lado da sombra; na beira molhada do meio-fio.
      const beira = -forma.d(x, y)
      const trecho = suave(0.05, 0.13, ruido(x * 0.075 + semente * 0.013, y * 0.075 + 4.4))
      const daJunta = trecho > 0 ? musgoDoAlto(trecho * manchaDeMusgo(x, y, 6510, -0.12), beira, sombraDaBeira(forma, x, y, rumo), x, y, semente) : 0
      const daAgua = Math.abs(pv) > hv - beiraMolhada ? manchaDeMusgo(x * 1.2, y * 1.2, 6511, -0.14) : 0
      musgar(s, Math.max(daJunta, daAgua), x, y)
    }
    const opcoes = { tabua: 0, bisel: meioFio ? 1.5 : 1.2, tom, contorno: CONTORNO_DA_PEDRA, textura, semente }
    L.push(P(forma, pedra, meioFio ? { ...opcoes, projeta: PROJECAO_DO_MEIO_FIO } : opcoes))
  }

  /** A fissura de uma laje: entra pela beira (`v0` ou `v1`) e para perto do meio, em dois ou três pedaços quebrados. */
  const fissuraDa = (u0: number, v0: number, u1: number, v1: number, sorte: (k: number) => number): Segmento[] => {
    const deCima = sorte(41) < 0.5
    let pu = u0 + (u1 - u0) * (0.3 + 0.4 * sorte(42))
    let pv = deCima ? v0 : v1
    const alvo = (v1 - v0) * (0.5 + 0.15 * sorte(43))
    const pedacos = sorte(44) < 0.5 ? 2 : 3
    // Reta no todo: um rumo só, e cada pedaço quebra um nada para um lado e o seguinte para o outro (nunca um V).
    const rumoDaFissura = (sorte(45) - 0.5) * 0.6
    const segmentos: Segmento[] = []
    for (let k = 0; k < pedacos; k += 1) {
      const desvio = rumoDaFissura + (k % 2 === 0 ? 1 : -1) * (0.1 + 0.12 * sorte(46 + k))
      const passo = alvo / pedacos
      const nu = Math.max(u0 + 1, Math.min(u1 - 1, pu + Math.sin(desvio) * passo))
      const nv = pv + (deCima ? 1 : -1) * Math.cos(desvio) * passo
      const [ax, ay] = r.ponto(pu, pv)
      const [bx, by] = r.ponto(nu, nv)
      segmentos.push([ax, ay, bx, by])
      ;[pu, pv] = [nu, nv]
    }
    return segmentos
  }

  // As LAJES em fileiras de través: a fileira das pontas corta no meio (a ponta fica aberta).
  const fileiras = Math.max(2, Math.round((2 * hu) / (g * FILEIRA)))
  const passo = (2 * hu) / fileiras
  for (let i = 0; i <= fileiras; i += 1) {
    const u0 = Math.max(-hu, -hu + (i - 0.5) * passo) + (i > 0 ? FOLGA : 0)
    const u1 = Math.min(hu, -hu + (i + 0.5) * passo) - (i < fileiras ? FOLGA : 0)
    if (u1 - u0 < 2) continue
    // Uma, duas ou três lajes de través, cortadas em lugares sorteados.
    const sorteDaFileira = (k: number): number => hash(i, k, 6520)
    const quantas = sorteDaFileira(1) < 0.3 ? 1 : sorteDaFileira(1) < 0.8 ? 2 : 3
    const cortes: number[] = []
    for (let k = 1; k < quantas; k += 1) cortes.push(-dentro + ((2 * dentro) * (k + (sorteDaFileira(1 + k) - 0.5) * 0.5)) / quantas)
    const limites = [-dentro, ...cortes, dentro]
    for (let j = 0; j + 1 < limites.length; j += 1) {
      const sorte = (k: number): number => hash(i, k + j * 100, 6520)
      const v0 = limites[j] + (j > 0 ? FOLGA : 0)
      const v1 = limites[j + 1] - (j + 2 < limites.length ? FOLGA : 0)
      let pontos = r.quadra(u0, v0, u1, v1)
      if (sorte(10) < 0.24) pontos = lascar(pontos, Math.floor(sorte(20) * 4), 2.2)
      const fissura = sorte(30) < 0.16 && u1 - u0 > 12 ? fissuraDa(u0, v0, u1, v1, sorte) : []
      pedraDoCaminho(pontos, TOM_DA_LAJE + TOM_QUE_VARIA * (sorte(50) - 0.5), 6530 + i * 4 + j, 0, fissura, false)
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
      pedraDoCaminho(r.quadra(u0, v0, u1, v1), TOM_DO_MEIO_FIO + 0.05 * (hash(k, lado + 5, 6561) - 0.5), 6570 + k * 2 + (lado + 1) / 2, 3.4, [], true)
    }
  }
}
