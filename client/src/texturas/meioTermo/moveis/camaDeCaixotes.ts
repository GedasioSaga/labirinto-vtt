/**
 * CAMA DE CAIXOTES de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; a versão de dormir dos paletes
 * de madeira, `paletesDeMadeira.ts`). A cama improvisada: dois PALETES de carga de ponta a ponta, cada um um pouco torto
 * em relação ao outro, de pinho velho já acinzentado, com as TÁBUAS atravessadas, as FRESTAS fundas, as TRAVESSAS por
 * baixo, os pregos apagados, o carimbo na ponta de uma tábua e uma tábua faltando no pé. Em cima, o COLCHÃO fino, mais
 * estreito e mais curto que os paletes, com o vivo da costura, quatro covinhas mansas do capitonê, o fundo do meio onde se
 * deita, uma mancha e um REMENDO grande de brim desbotado, um pentágono torto pregado com pontos que correm por dentro
 * da beira. Na cabeceira, o TRAVESSEIRO de estopa amarrado na ponta; no pé do colchão, a COBERTA ENROLADA de lã
 * pardo-mostarda, mais grossa nas pontas, um pouco caída no meio e com a espiral do rolo à mostra na ponta da esquerda.
 *
 * A 25% de zoom sobram o colchão claro e as beiradas de tábua em volta dele, com a fresta escura entre os dois paletes:
 * cama no chão, feita de palete (o catre tem a armação lisa com cabeceira e postes).
 *
 * NA 3/4 fica como de cima (perfil EM_PE, com a sombra de baixo, como os paletes de madeira): derivada, o palete do pé,
 * pintado por último, varria a frente por cima do colchão e da coberta e a cama virava um caixote. As sombras de cada
 * andar (palete, colchão, coberta) dão a sombra comprida de cima. Materiais: `madeira` (o pinho de palete, sempre gasto
 * para o ocre acinzentado de palete velho) e `colchao` (um dos tecidos; o linho cru de partida). A estopa, a coberta e o
 * remendo são fixos. As medidas saem da pegada de partida (1 x 2 casas): esticada, a cama cresce inteira.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type Peca } from './motor'
import { G, PREGO, QUARTO, type MontarMovel } from './contexto'
import { girar } from './grilhoesDeParede'
import { arco, ESCURO_DO_CORTICO, madeiraGasta, prega } from './catreDesarrumado'

/** Alturas, em casas: o palete, o colchão em cima dele e a coberta enrolada. */
const ALTURA_DO_PALETE = 0.13
const ALTURA_DO_COLCHAO = 0.2
const ALTURA_DA_COBERTA = 0.27
/** O pinho de palete velho: a madeira escolhida puxada metade para o pardo gasto do cortiço (o pinho vira ~#9c8864). */
const GASTO_DO_PALETE = 0.55
/** Os dois paletes: o meio em y (fração da altura), o desvio em x (fração da largura) e o giro (radianos). */
const PALETES: readonly { readonly y: number; readonly x: number; readonly ang: number }[] = [
  { y: -0.25, x: -0.012, ang: 0.022 },
  { y: 0.25, x: 0.014, ang: -0.028 },
]
/** Meia largura (fração da largura) e meio comprimento (fração da altura) de um palete. */
const MEIA_LARGURA = 0.485
const MEIO_COMPRIMENTO = 0.243
/** As tábuas do tampo, de uma ponta do palete à outra, em fração do comprimento; o que sobra vira as quatro frestas. */
const TABUAS: readonly number[] = [0.19, 0.15, 0.16, 0.15, 0.19]
const TONS_DAS_TABUAS: readonly number[] = [0.92, 1.05, 0.96, 1.08, 0.9]
/** As três travessas de baixo (fração da meia largura) e a meia largura de cada uma (px da pegada de partida). */
const TRAVESSAS: readonly number[] = [-0.84, 0, 0.84]
const MEIA_TRAVESSA = 2.4
/** A tábua que falta no palete do pé (o índice). */
const TABUA_QUE_FALTA = 3
/** O colchão, em frações da pegada: meia largura, a cabeça e o pé (y), e o giro. */
const COLCHAO = { meiaLargura: 0.4, cabeca: -0.45, pe: 0.3, giro: 0.014 } as const
/** As quatro covinhas do capitonê (frações do colchão): só a sombra mansa, sem botão. */
const COVINHAS: readonly Ponto[] = [[0.3, 0.27], [0.7, 0.27], [0.3, 0.63], [0.7, 0.63]]
/** O remendo: o meio (frações do colchão), o raio (fração da largura do colchão) e os cinco cantos tortos (ângulo, raio). */
const MEIO_DO_REMENDO: Ponto = [0.64, 0.45]
const RAIO_DO_REMENDO = 0.125
const CANTOS_DO_REMENDO: readonly (readonly [number, number])[] = [[-1.75, 1.08], [-0.42, 0.9], [0.82, 1.04], [2.02, 0.92], [3.12, 1.1]]
/** Os pontos da costura: a linha corre por dentro da beira, a esta fração do raio, em traços e vãos (px da pegada). */
const COSTURA_POR_DENTRO = 0.76
const TRACO_DA_COSTURA = 1
const VAO_DA_COSTURA = 0.75
/** A coberta enrolada: pontos ao longo do rolo e em cada ponta redonda, e as voltas da espiral. */
const PASSOS_DO_ROLO = 12
const PASSOS_DA_PONTA = 6
const PASSOS_DA_ESPIRAL = 30
const VOLTAS_DA_ESPIRAL = 2.2
/** O vão escuro e fundo de dentro do palete e o carimbo apagado. */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x23, 0x1b] }
const CARIMBO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x3a, 0x2c] }
/** A estopa do travesseiro, a coberta de lã pardo-mostarda, o brim desbotado do remendo e a linha dos pontos. */
const ESTOPA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xa6, 0x91, 0x6b] }
const BARBANTE: MaterialDaPeca = { classe: 'corda', rgb: [0xb8, 0xa8, 0x82] }
const COBERTA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x8a, 0x74, 0x58] }
const BRIM_DESBOTADO: Rgb = [0x74, 0x7e, 0x88]
const LINHA: MaterialDaPeca = { classe: 'liso', rgb: [0xcf, 0xc4, 0xa8] }
const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x5f, 0x47] }

/** Um palete no mapa: o meio, as medidas e o giro; devolve o corpo (a pegada dele). */
function montarPalete(P: CriarPeca, L: Peca[], mad: MaterialDaPeca, cx: number, cy: number, A: number, B: number, ang: number, falta: number, sem: number, k: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const em = (u: number, v: number): Ponto => [cx + u * co - v * si, cy + u * si + v * co]
  const ret = (u0: number, v0: number, u1: number, v1: number): Forma => poligono([em(u0, v0), em(u1, v0), em(u1, v1), em(u0, v1)])
  const corpo = ret(-A, -B, A, B)
  L.push(P(corpo, VAO, { tabua: 0, bisel: 0.6, contorno: 0.3, recesso: { k: 2, forca: 0.34 }, semente: sem }))
  TRAVESSAS.forEach((f, i) => {
    const u = f * A
    const m = MEIA_TRAVESSA * k
    L.push(P(ret(Math.max(-A, u - m), -B + 0.3, Math.min(A, u + m), B - 0.3), mad, { eixo: ang + QUARTO, tabua: 0, bisel: 0.7, tom: 0.66, contorno: 0.2, semente: sem + 1 + i }))
  })
  const fresta = ((1 - TABUAS.reduce((s, t) => s + t, 0)) * 2 * B) / (TABUAS.length - 1)
  let v = -B
  TABUAS.forEach((t, i) => {
    const v0 = v
    const v1 = v + t * 2 * B
    v = v1 + fresta
    if (i === falta) return
    const tom = TONS_DAS_TABUAS[(i + sem) % TONS_DAS_TABUAS.length] * (0.96 + 0.08 * hash(i, sem, 33))
    L.push(P(ret(-A, v0, A, v1), mad, { eixo: ang, tabua: 0, bisel: 0.9, tom, contorno: 0.26, semente: sem + 10 + i, projeta: { dist: 0.9, forca: 0.34 } }))
    // Os pregos velhos, quase da cor da tábua: aparecem de perto e somem de longe.
    for (const f of TRAVESSAS) {
      for (const fv of [0.3, 0.7]) {
        const [px, py] = em(f * A * 0.97, v0 + (v1 - v0) * fv)
        L.push(P(elipse(px, py, 0.55, 0.55), PREGO, { bisel: 0.4, contorno: 0, metal: 0.12, alfa: 0.45, semente: sem + 40 + i }))
      }
    }
  })
  return corpo
}

/**
 * A linha TRACEJADA dos pontos de costura ao longo do polígono fechado `pontos`: traços de `traco` px separados por
 * `vao` px, com meia grossura `r`. Os traços correm na direção da beira, sem nenhum risco atravessado.
 */
function tracejado(pontos: readonly Ponto[], r: number, traco: number, vao: number): Forma {
  const n = pontos.length
  const comprimentos = pontos.map((p, i) => Math.hypot(pontos[(i + 1) % n][0] - p[0], pontos[(i + 1) % n][1] - p[1]))
  const inicios = comprimentos.map((_, i) => comprimentos.slice(0, i).reduce((s, l) => s + l, 0))
  const periodo = traco + vao
  const xs = pontos.map((p) => p[0])
  const ys = pontos.map((p) => p[1])
  return {
    b: [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r],
    d: (x, y) => {
      let melhor = Infinity
      for (let i = 0; i < n; i += 1) {
        const [ax, ay] = pontos[i]
        const [bx, by] = pontos[(i + 1) % n]
        const l = comprimentos[i] || 1
        const [ux, uy] = [(bx - ax) / l, (by - ay) / l]
        const t = Math.max(0, Math.min(l, (x - ax) * ux + (y - ay) * uy))
        const atravessado = Math.hypot(x - ax - ux * t, y - ay - uy * t) - r
        const u = (inicios[i] + t) % periodo
        const aoLongo = u <= traco ? -Math.min(u, traco - u) : Math.min(u - traco, periodo - u)
        melhor = Math.min(melhor, Math.max(atravessado, aoLongo))
      }
      return melhor
    },
  }
}

export const montarCamaDeCaixotes: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const mad = madeiraGasta(c.m.madeira, GASTO_DO_PALETE)
  const col = c.m.colchao
  const L = cena.partes
  const k = Math.min(w / G, h / (2 * G))
  cena.corDoPiso = ESCURO_DO_CORTICO

  // Os PALETES, o da cabeça e o do pé, cada um torto do seu jeito; o do pé sem uma tábua.
  const A = MEIA_LARGURA * w
  const B = MEIO_COMPRIMENTO * h
  PALETES.forEach((p, i) => {
    const corpo = montarPalete(P, L, mad, p.x * w, p.y * h, A, B, p.ang, i === 1 ? TABUA_QUE_FALTA : -1, 8200 + i * 100, k)
    cena.sombras.push({ forma: corpo, z: g * ALTURA_DO_PALETE, forca: 0.3 }, contato(corpo, 0.34))
  })
  // O carimbo apagado na ponta da primeira tábua do palete da cabeça (fica de fora do colchão).
  const [cx0, cy0] = [PALETES[0].x * w + A * 0.9, PALETES[0].y * h - B * 0.8]
  L.push(P(caixa(cx0 - 2.2 * k, cy0 - 1.3 * k, cx0 + 1.6 * k, cy0 + 1.3 * k), CARIMBO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, semente: 8290 }))

  // O COLCHÃO fino, um nada torto: o corpo, o vivo da costura e o fundo do meio.
  const [mx0, mx1] = [-COLCHAO.meiaLargura * w, COLCHAO.meiaLargura * w]
  const [my0, my1] = [COLCHAO.cabeca * h, COLCHAO.pe * h]
  const [mcx, mcy] = [0, (my0 + my1) / 2]
  const torto = (f: Forma): Forma => girar(f, mcx, mcy, COLCHAO.giro)
  const pt = (fx: number, fy: number): Ponto => {
    const x = mx0 + (mx1 - mx0) * fx
    const y = my0 + (my1 - my0) * fy
    const co = Math.cos(COLCHAO.giro)
    const si = Math.sin(COLCHAO.giro)
    return [mcx + (x - mcx) * co - (y - mcy) * si, mcy + (x - mcx) * si + (y - mcy) * co]
  }
  const colchao = torto(caixa(mx0, my0, mx1, my1, 3.2 * k))
  cena.sombras.push({ forma: colchao, z: g * ALTURA_DO_COLCHAO, forca: 0.3 })
  L.push(P(colchao, col, { tabua: 0, bisel: 3 * k, ruga: 1.1, contorno: 0.22, semente: 8300, projeta: { dist: 1.8 * k, forca: 0.36, suave: 1.2 * k } }))
  const vivo = torto(menos(caixa(mx0 + 1.6 * k, my0 + 1.6 * k, mx1 - 1.6 * k, my1 - 1.6 * k, 2.2 * k), caixa(mx0 + 2.3 * k, my0 + 2.3 * k, mx1 - 2.3 * k, my1 - 2.3 * k, 1.8 * k)))
  L.push(P(vivo, col, { tabua: 0, bisel: 0, contorno: 0, tom: 0.8, alfa: 0.55, semente: 8301 }))
  const [fx, fy] = pt(0.48, 0.55)
  L.push(P(elipse(fx, fy, (mx1 - mx0) * 0.3, (my1 - my0) * 0.26), col, { tabua: 0, bisel: 0, contorno: 0, tom: 0.86, alfa: 0.5, suave: 5 * k, semente: 8302 }))
  const [sx, sy] = pt(0.28, 0.76)
  L.push(P(elipse(sx, sy, 4.6 * k, 3.2 * k), MANCHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.16, suave: 2 * k, semente: 8303 }))
  // As COVINHAS do capitonê: só a sombra mansa de cada uma, sem o botão (botão nítido lia parafuso).
  COVINHAS.forEach(([bx, by], i) => {
    const [x, y] = pt(bx, by)
    L.push(P(elipse(x + 0.3 * k, y + 0.4 * k, 1.8 * k, 1.5 * k), col, { tabua: 0, bisel: 0, contorno: 0, tom: 0.78, alfa: 0.42, suave: 1.3 * k, semente: 8310 + i }))
  })
  // O REMENDO de brim desbotado: um pentágono torto, grande (um quarto da largura do colchão), na metade da cor do
  // colchão, com a costura tracejada correndo por dentro da beira.
  const [rcx, rcy] = pt(MEIO_DO_REMENDO[0], MEIO_DO_REMENDO[1])
  const raio = RAIO_DO_REMENDO * (mx1 - mx0)
  const cantos = CANTOS_DO_REMENDO.map(([a, f]): Ponto => [rcx + Math.cos(a + COLCHAO.giro) * raio * f, rcy + Math.sin(a + COLCHAO.giro) * raio * f * 0.92])
  const pano: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: misturar(BRIM_DESBOTADO, col.rgb, 0.5) }
  L.push(P(poligono(cantos), pano, { tabua: 0, bisel: 0.6 * k, ruga: 0.6, contorno: 0.13, semente: 8320 }))
  const porDentro = cantos.map(([x, y]): Ponto => [rcx + (x - rcx) * COSTURA_POR_DENTRO, rcy + (y - rcy) * COSTURA_POR_DENTRO])
  L.push(P(tracejado(porDentro, 0.24 * k, TRACO_DA_COSTURA * k, VAO_DA_COSTURA * k), LINHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, semente: 8321 }))

  // O TRAVESSEIRO de estopa na cabeceira: o saco cheio, o pescoço amarrado com barbante e a ponta franzida.
  const [tx, ty] = pt(0.44, 0.075)
  const [tmx, tmy] = [(mx1 - mx0) * 0.3, (my1 - my0) * 0.05]
  const giroT = 0.07
  const saco = girar(caixa(tx - tmx, ty - tmy, tx + tmx, ty + tmy, 3.4 * k), tx, ty, giroT)
  L.push(P(saco, ESTOPA, { tabua: 0, bisel: tmy * 1.05, ruga: 1.8, contorno: 0.22, semente: 8330, projeta: { dist: 1.5 * k, forca: 0.32, suave: 1.1 * k } }))
  const naPonta = (d: number): Ponto => [tx + (tmx + d) * Math.cos(giroT), ty + (tmx + d) * Math.sin(giroT)]
  const [nx, ny] = naPonta(1.4 * k)
  L.push(P(elipse(nx, ny, 1.3 * k, 1.7 * k), ESTOPA, { tabua: 0, bisel: 0.9 * k, ruga: 1.2, tom: 0.86, contorno: 0.2, semente: 8331 }))
  const [fx2, fy2] = naPonta(3.4 * k)
  L.push(P(elipse(fx2, fy2, 1.8 * k, 2.4 * k), ESTOPA, { tabua: 0, bisel: 1 * k, ruga: 2, tom: 1.04, contorno: 0.2, semente: 8332 }))
  L.push(P(capsula(nx - 0.2 * k, ny - 2 * k, nx + 0.2 * k, ny + 2 * k, 0.55 * k), BARBANTE, { tabua: 0, bisel: 0.4 * k, contorno: 0.2, semente: 8333 }))
  prega(P, L, ESTOPA, arco(pt(0.2, 0.06), pt(0.3, 0.09), pt(0.42, 0.08)), 1 * k, 0.8, 8334)

  // A COBERTA ENROLADA no pé do colchão, de través: o rolo de lã, mais grosso nas pontas e um pouco caído no meio, com
  // a beira da última volta correndo por ele e a ESPIRAL do rolo na ponta da esquerda.
  const [ra, rb] = [pt(0.05, 0.895), pt(0.97, 0.88)]
  const raioDoRolo = 4.1 * k
  const caida = 1.3 * k
  const eixo = (t: number): Ponto => [ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t + caida * Math.sin(Math.PI * t)]
  const grossura = (t: number): number => raioDoRolo * (1.06 - 0.16 * Math.sin(Math.PI * t) - 0.06 * t)
  const rumo = (t: number): readonly [number, number, number, number] => {
    const [dx, dy] = [rb[0] - ra[0], rb[1] - ra[1] + caida * Math.PI * Math.cos(Math.PI * t)]
    const l = Math.hypot(dx, dy) || 1
    return [dx / l, dy / l, -dy / l, dx / l]
  }
  const ts = Array.from({ length: PASSOS_DO_ROLO + 1 }, (_, i) => i / PASSOS_DO_ROLO)
  const lado = (t: number, s: number): Ponto => {
    const [x, y] = eixo(t)
    const [, , nx2, ny2] = rumo(t)
    return [x + nx2 * grossura(t) * s, y + ny2 * grossura(t) * s]
  }
  const ponta = (t: number, fora: number): Ponto[] => {
    const [x, y] = eixo(t)
    const [ux, uy, nx2, ny2] = rumo(t)
    const r = grossura(t)
    return Array.from({ length: PASSOS_DA_PONTA - 1 }, (_, j): Ponto => {
      const f = (Math.PI * (j + 1)) / PASSOS_DA_PONTA
      return [x + ux * r * Math.sin(f) * fora - nx2 * r * Math.cos(f) * fora, y + uy * r * Math.sin(f) * fora - ny2 * r * Math.cos(f) * fora]
    })
  }
  const rolo = poligono([...ts.map((t) => lado(t, -1)), ...ponta(1, 1), ...[...ts].reverse().map((t) => lado(t, 1)), ...ponta(0, -1)])
  cena.sombras.push({ forma: rolo, z: g * ALTURA_DA_COBERTA, forca: 0.3 })
  L.push(P(rolo, COBERTA, { tabua: 0, bisel: raioDoRolo * 0.9, ruga: 1.2, contorno: 0.24, semente: 8340, projeta: { dist: 1.8 * k, forca: 0.36, suave: 1.2 * k } }))
  prega(P, L, COBERTA, ts.filter((t) => t > 0.12 && t < 0.94).map((t) => lado(t, 0.48)), 0.7 * k, 0.85, 8341)
  // A ponta da esquerda: a cara do rolo, mais escura, e a espiral das voltas de lã.
  const [ex, ey] = eixo(0)
  const [ux, uy, nx3, ny3] = rumo(0)
  const r0 = grossura(0)
  const [ccx, ccy] = [ex - ux * r0 * 0.3, ey - uy * r0 * 0.3]
  L.push(P(girar(elipse(ccx, ccy, r0 * 0.5, r0 * 0.94), ccx, ccy, Math.atan2(uy, ux)), COBERTA, { tabua: 0, bisel: 0.5 * k, ruga: 0.8, tom: 0.8, contorno: 0.16, semente: 8343 }))
  const fimDaEspiral = VOLTAS_DA_ESPIRAL * Math.PI * 2
  const espiral = Array.from({ length: PASSOS_DA_ESPIRAL + 1 }, (_, j): Ponto => {
    const a = (fimDaEspiral * j) / PASSOS_DA_ESPIRAL
    const s = 0.14 + (0.72 * a) / fimDaEspiral
    const [du, dn] = [r0 * 0.5 * s * Math.cos(a), r0 * 0.94 * s * Math.sin(a)]
    return [ccx + ux * du + nx3 * dn, ccy + uy * du + ny3 * dn]
  })
  L.push(P(cadeia(espiral, 0.3 * k), COBERTA, { tabua: 0, bisel: 0, contorno: 0, tom: 0.5, alfa: 0.8, semente: 8344 }))
}
