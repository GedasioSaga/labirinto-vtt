/**
 * FOSSO DE ARENA de cima com volume (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; construção nova). O
 * rebaixo redondo onde se luta: o CHÃO de terra batida marrom-acinzentada, mais clara no meio (onde mais se pisa),
 * rachada em placas finas e tortas (a mesma rede da textura Terra rachada, `chaos/terraRachada.ts`), com uma mancha
 * velha, cor de vinho apagado, e umas pedrinhas junto da parede; a PAREDE do rebaixo, duas fiadas de pedra que
 * descem da borda, acesa do lado que olha para a luz e na sombra do outro (e a sombra dela cai no chão do fosso); a
 * BORDA de pedras em anel, rente ao chão de fora; e a RAMPA de entrada, que corta a borda e a parede e desce até o
 * chão, de terra, com as travessas de madeira para o pé não escorregar e uma guia de pedra de cada lado.
 *
 * A 25% de zoom sobram o disco claro de terra dentro do anel escuro, a meia-lua de sombra do lado da luz e o rasgo
 * da rampa com as travessas: é um buraco redondo com uma entrada.
 *
 * É CHÃO: rente, não barra (o token anda dentro e pela rampa). A rampa fica embaixo no giro 0. Com 4 x 4 casas ele
 * cabe certo dentro de quatro Arquibancadas de pedra curvas (`arquibancadaDePedra.ts`, raio de dentro de 2 casas).
 * Na 3/4 (DERIVADO) só a borda sobe um fio. As medidas saem do menor meio lado (esticado, continua redondo).
 * Material: `pedra` (a borda, a parede e as guias; sugestão: ardósia). A terra, a mancha e as travessas são fixas.
 *
 * Este arquivo também é o APOIO do lote L11: as formas (`anelExato`, `setorDeAnel`, `bolha`, `girada`, `comMeioEm`)
 * e as contas (`passo`, `viradaParaALuz`, `escuroDe`) que os outros desenhos do lote usam.
 */
import { hash, type Rgb } from '../../ruido'
import { rachadura } from '../../chaos/terraRachada'
import { elipseGirada, menos, poligono, caixa, type Caixa, type Forma, type Ponto } from './formas'
import { contato, luminanciaLinear, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { naTela } from './pilhaDeFatias'
import { quartosDoGiro } from './pipaDeitada'

// ---------- o apoio do lote ----------

const VOLTA = Math.PI * 2
/** De onde vem a luz no plano da tela (de cima à esquerda, a do motor). */
const LUZ_X = -0.79
const LUZ_Y = -0.61

/** O degrau suave de `a` a `b` (vale também com a > b: desce). */
export function passo(a: number, b: number, t: number): number {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

/** O quanto a normal (nx, ny) do OBJETO fica virada para a luz NA TELA, no giro `q`: 1 de frente, -1 de costas. */
export function viradaParaALuz(nx: number, ny: number, q: number): number {
  const [sx, sy] = naTela(nx, ny, q)
  return sx * LUZ_X + sy * LUZ_Y
}

/** A luminância linear do escuro em que o pixel escuro demais é levantado (um nada acima do piso de luz do motor). */
const LUZ_DO_ESCURO = 0.058

/**
 * O ESCURO do próprio material: a cor dele escurecida até `LUZ_DO_ESCURO`. É o tom em que o pixel escuro demais é
 * levantado (`cena.corDoPiso`): com um escuro fixo, quente, a sombra funda da pedra azulada saía parda; assim a
 * sombra de cada pedra é o tom escuro da própria cor (regra 1 do estilo).
 */
export function escuroDe(m: MaterialDaPeca): Rgb {
  const escuro = (f: number): Rgb => [Math.round(m.rgb[0] * f), Math.round(m.rgb[1] * f), Math.round(m.rgb[2] * f)]
  let f = 1
  while (f > 0.02 && luminanciaLinear(...escuro(f)) > LUZ_DO_ESCURO) f -= 0.02
  return escuro(f)
}

/** O anel de centro (cx, cy) entre os raios `r0` e `r1`, com a distância exata (uma raiz só). */
export function anelExato(cx: number, cy: number, r0: number, r1: number): Forma {
  return {
    b: [cx - r1, cy - r1, cx + r1, cy + r1],
    d(x, y) {
      const r = Math.hypot(x - cx, y - cy)
      return Math.max(r0 - r, r - r1)
    },
  }
}

/** Um SETOR de anel (uma pedra de borda): entre `r0` e `r1`, do ângulo `a0` por `da`, com `folga` até a vizinha. */
export function setorDeAnel(cx: number, cy: number, r0: number, r1: number, a0: number, da: number, folga: number): Forma {
  const am = a0 + da / 2
  const meio = da / 2
  const rm = (r0 + r1) / 2
  const meiaEspessura = (r1 - r0) / 2
  const b = [Infinity, Infinity, -Infinity, -Infinity]
  for (let i = 0; i <= 8; i += 1) {
    const a = a0 + (da * i) / 8
    for (const r of [r0, r1]) {
      b[0] = Math.min(b[0], cx + Math.cos(a) * r)
      b[1] = Math.min(b[1], cy + Math.sin(a) * r)
      b[2] = Math.max(b[2], cx + Math.cos(a) * r)
      b[3] = Math.max(b[3], cy + Math.sin(a) * r)
    }
  }
  const caixaDoSetor: Caixa = [b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1]
  return {
    b: caixaDoSetor,
    d(x, y) {
      const dx = x - cx
      const dy = y - cy
      const rr = Math.hypot(dx, dy)
      let a = Math.atan2(dy, dx) - am
      a -= VOLTA * Math.round(a / VOLTA)
      return Math.max(Math.abs(rr - rm) - meiaEspessura, (Math.abs(a) - meio) * rr + folga / 2)
    },
  }
}

/**
 * Uma BOLHA: a volta fechada e mole de centro (cx, cy) e meios lados (rx, ry), com a beira torta (`torta`, fração do
 * raio) em três ondas de fases sorteadas por `semente`, girada `volta` radianos. Sem ponta nem lado reto: pano, saco,
 * monte, poça.
 */
export function bolha(cx: number, cy: number, rx: number, ry: number, semente: number, torta = 0.12, volta = 0, pontos = 26): Forma {
  const [f1, f2, f3] = [hash(semente, 1, 611) * VOLTA, hash(semente, 2, 611) * VOLTA, hash(semente, 3, 611) * VOLTA]
  const co = Math.cos(volta)
  const si = Math.sin(volta)
  const lista: Ponto[] = []
  for (let i = 0; i < pontos; i += 1) {
    const t = (i / pontos) * VOLTA
    const k = 1 + torta * (0.55 * Math.sin(2 * t + f1) + 0.3 * Math.sin(3 * t + f2) + 0.15 * Math.sin(5 * t + f3))
    const [px, py] = [Math.cos(t) * rx * k, Math.sin(t) * ry * k]
    lista.push([cx + px * co - py * si, cy + px * si + py * co])
  }
  return poligono(lista)
}

/** A forma girada `a` radianos em volta de (px, py); a caixa nova cobre os quatro cantos da velha. */
export function girada(f: Forma, px: number, py: number, a: number): Forma {
  const co = Math.cos(a)
  const si = Math.sin(a)
  const xs: number[] = []
  const ys: number[] = []
  for (const [x, y] of [[f.b[0], f.b[1]], [f.b[2], f.b[1]], [f.b[2], f.b[3]], [f.b[0], f.b[3]]]) {
    xs.push(px + (x - px) * co - (y - py) * si)
    ys.push(py + (x - px) * si + (y - py) * co)
  }
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d: (x, y) => f.d(px + (x - px) * co + (y - py) * si, py - (x - px) * si + (y - py) * co),
  }
}

/** A forma com a caixa crescida até o meio dela cair em (mx, my): a 3/4 sobe a peça pela estrutura que contém o meio da caixa. */
export function comMeioEm(f: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - f.b[0], f.b[2] - mx)
  const ey = Math.max(my - f.b[1], f.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: f.d }
}

// ---------- o fosso ----------

/** Os raios, em fração do menor meio lado: a beira de dentro da borda e o pé da parede (onde começa o chão). */
const BORDA_DE_DENTRO = 0.86
const PE_DA_PAREDE = 0.79
/** A espessura da borda (px): o quanto ela sobe na 3/4 e a sombra curta que faz no chão de fora. */
const ALTURA_DA_BORDA = 2.4
/** O comprimento de uma pedra da borda e de uma da parede (casas, pelo arco). */
const PEDRA_DA_BORDA = 0.56
const PEDRA_DA_PAREDE = 0.42
/** A sombra da parede no chão do fosso: a profundidade (px, para o lado da luz) e a força. */
const SOMBRA_NO_CHAO = { k: 10, forca: 0.5 } as const
/** A rampa: a meia largura no alto e no pé (casas), até onde ela desce (fração do raio) e a largura da guia (px). */
const RAMPA = { alto: 0.46, pe: 0.38, ate: 0.47, guia: 3.6 } as const
/** As travessas da rampa: onde (do pé, 0, ao alto, 1) e a meia espessura (px). */
const TRAVESSAS: readonly number[] = [0.2, 0.42, 0.64, 0.86]
const MEIA_TRAVESSA = 1.3
/** A placa do chão rachado, em casas, o quanto a rede é torcida (em placas: pouco, a fenda é quebrada e não ondulada) e a rede miúda dos fios de cabelo. */
const PLACA = 0.62
const TORCAO = 0.3
const FIO = 0.2

/** A terra batida, a fenda dela e a mancha velha (vinho apagado, quase da cor da terra). */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0x88, 0x7a, 0x69] }
const COR_DA_FENDA = [0x4c, 0x41, 0x38] as const
const COR_DA_MANCHA = [0x6c, 0x4f, 0x49] as const
/** A mancha e os respingos: [x, y (frações do raio do chão), raio (fração dele)]. */
const MANCHAS: readonly (readonly [number, number, number])[] = [
  [0.24, -0.2, 0.2],
  [0.44, -0.04, 0.055],
  [0.05, -0.4, 0.04],
  [0.36, -0.36, 0.03],
]
/** As pedrinhas junto da parede: [ângulo, distância (fração do raio do chão), raio (px)]. */
const PEDRINHAS: readonly (readonly [number, number, number])[] = [
  [3.5, 0.9, 2.3],
  [3.72, 0.93, 1.5],
  [5.6, 0.91, 2],
  [0.5, 0.94, 1.7],
  [2.45, 0.92, 1.4],
]

const R3 = new Float64Array(3)

/** O chão do fosso: a terra mais clara no meio, as manchas largas, as placas rachadas, os fios de cabelo e a mancha velha. */
function texDoChao(rChao: number, g: number): Textura {
  const celula = g * PLACA
  const fio = g * FIO
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x, y) / rChao
    let luz = 0.2 * (1 - passo(0, 0.9, rr)) - 0.07 - 0.05 * passo(0.82, 1, rr)
    luz += ruido(x * 0.03 + 3.1, y * 0.03) * 0.1 + ruido(x * 0.1, y * 0.1 + 5.2) * 0.05 + ruido(x * 0.55 + 9, y * 0.55) * 0.03
    const tx = ruido(x * 0.05 + 7, y * 0.05) * TORCAO + ruido(x * 0.23 + 3, y * 0.23) * 0.09
    const ty = ruido(x * 0.05, y * 0.05 + 13) * TORCAO + ruido(x * 0.23, y * 0.23 + 8) * 0.09
    rachadura(x / celula + tx, y / celula + ty, 0, 4407, 0.44, R3)
    const d = R3[0] * celula
    // A rede inteira só aparece onde a máscara deixa: cada fenda afina e some no caminho.
    const mascara = passo(-0.16, 0.12, ruido(x * 0.022 + 21, y * 0.022 + 4))
    luz += mascara * ((R3[2] - 0.5) * 0.05 + 0.04 * (passo(0, celula * 0.3, d) - 0.6))
    s[3] += luz
    let mancha = 0
    for (const [mx, my, mr] of MANCHAS) {
      const longe = Math.hypot(x - mx * rChao, y - my * rChao) / (mr * rChao)
      // Longe da mancha o ruído da beira dela não muda nada: a conta fica só para quem está perto.
      if (longe < 1.8) mancha = Math.max(mancha, passo(1, 0.5, longe + ruido(x * 0.13 + mx * 40, y * 0.13) * 1.1 + ruido(x * 0.4, y * 0.4 + my * 30) * 0.4))
    }
    let fenda = mascara > 0 ? passo(0.6 * mascara, 0, d) * 0.55 + passo(2.2 * mascara, 0, d) * 0.12 : 0
    const fina = mascara * passo(-0.05, 0.2, ruido(x * 0.04 + 50, y * 0.04))
    if (fina > 0) {
      rachadura(x / fio + ty * 2, y / fio + tx * 2, 0, 4408, 0.46, R3)
      fenda = Math.max(fenda, passo(0.4, 0, R3[0] * fio) * 0.2 * fina)
    }
    for (let k = 0; k < 3; k += 1) {
      s[k] += (COR_DA_MANCHA[k] - s[k]) * mancha * 0.3
      s[k] += (COR_DA_FENDA[k] - s[k]) * fenda
    }
  }
}

export const montarFossoDeArena: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const daPedra = texturaDaClasse(pedra.classe)
  const q = quartosDoGiro(c.giro)
  const L = cena.partes
  cena.corDoPiso = escuroDe(pedra)
  const R = Math.min(hw, hh)
  const rBorda = R * BORDA_DE_DENTRO
  const rChao = R * PE_DA_PAREDE
  const rParede = (rChao + rBorda) / 2

  // A RAMPA desce para o meio pelo lado de baixo: a meia largura em cada altura e o rasgo que ela abre na borda.
  const [alto, pe, yPe] = [g * RAMPA.alto, g * RAMPA.pe, R * RAMPA.ate]
  const meiaRampa = (y: number): number => pe + ((alto - pe) * (y - yPe)) / (R - yPe)
  const rasgo = caixa(-alto - RAMPA.guia, 0, alto + RAMPA.guia, R + 4)
  const meioRasgo = Math.asin(Math.min(0.9, (alto + RAMPA.guia + 0.6) / ((rBorda + R) / 2)))

  // O CHÃO, com a sombra da parede do lado da luz (o motor a põe na tela: vale nos quatro giros).
  L.push(P(anelExato(0, 0, -1, rChao + 1), TERRA, { tabua: 0, bisel: 0, contorno: 0, recesso: SOMBRA_NO_CHAO, textura: texDoChao(rChao, g), semente: 4400 }))

  // As PEDRINHAS junto da parede.
  PEDRINHAS.forEach(([a, longe, raio], i) => {
    const forma = elipseGirada(Math.cos(a) * rChao * longe, Math.sin(a) * rChao * longe, raio * 1.25, raio, a + 0.6)
    cena.sombras.push(contato(forma, 0.26))
    L.push(P(forma, pedra, { tabua: 0, bisel: raio * 0.85, tom: 0.92 + 0.14 * hash(i, 1, 4401), contorno: 0.24, semente: 4402 + i, projeta: { dist: 1.1, forca: 0.26 } }))
  })

  // A PAREDE: duas fiadas que descem da borda; a luz de cada trecho sai de para onde ele olha NA TELA.
  const nDaParede = Math.max(8, Math.round((VOLTA * rParede) / (g * PEDRA_DA_PAREDE)))
  const texDaParede: Textura = (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const rr = Math.hypot(x, y) || 1
    let luz = 0.17 * viradaParaALuz(-x / rr, -y / rr, q) - 0.03
    const fiada = rr > rParede ? 0.5 : 0
    if (Math.abs(rr - rParede) < 0.45) luz -= 0.16
    const k = (Math.atan2(y, x) / VOLTA) * nDaParede + fiada
    if (Math.abs(k - Math.round(k)) * ((VOLTA * rr) / nDaParede) < 0.45) luz -= 0.14
    // O pé da parede junta terra: a fiada de baixo escurece e puxa para o chão.
    if (rr < rChao + 1.4) luz -= 0.08
    s[3] += luz
  }
  L.push(P(menos(anelExato(0, 0, rChao - 0.6, rBorda + 1), rasgo), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.8, textura: texDaParede, semente: 4420 }))

  // A RAMPA de terra: clara no alto (o chão de fora), some no chão do fosso no pé; dois sulcos de tanto arrastar.
  const subida = viradaParaALuz(0, -1, q)
  const texDaRampa: Textura = (_u, _v, x, y, _p, s) => {
    const t = (y - yPe) / (R - yPe)
    const meia = meiaRampa(y)
    let luz = 0.03 + 0.05 * t + 0.07 * subida + ruido(x * 0.06 + 31, y * 0.06) * 0.08 + ruido(x * 0.5, y * 0.5 + 17) * 0.03
    const sulco = Math.abs(Math.abs(x) - meia * 0.45)
    if (sulco < 2.2) luz -= 0.045 * (1 - sulco / 2.2)
    s[3] += luz
    s[5] = passo(0, 0.16, t)
  }
  L.push(P(poligono([[-alto, R + 0.4], [alto, R + 0.4], [pe, yPe], [-pe, yPe]]), TERRA, { tabua: 0, bisel: 0, contorno: 0, textura: texDaRampa, semente: 4430 }))
  const madeira = materialDaPeca('velha')
  TRAVESSAS.forEach((t, i) => {
    const y = yPe + (R - yPe) * t
    const meia = meiaRampa(y) - 1.6
    L.push(P(caixa(-meia, y - MEIA_TRAVESSA, meia, y + MEIA_TRAVESSA, 0.7), madeira, { tabua: 0, bisel: 1.1, tom: 0.92 + 0.1 * hash(i, 2, 4431), contorno: 0.26, semente: 4432 + i, projeta: { dist: 1, forca: 0.3 } }))
  })
  // As GUIAS de pedra dos dois lados, em três pedras cada, a do pé acabando em ponta.
  for (const lado of [-1, 1]) {
    const cortes = [R - 0.2, yPe + (R - yPe) * 0.66, yPe + (R - yPe) * 0.3, yPe - 1]
    for (let i = 0; i + 1 < cortes.length; i += 1) {
      const [y0, y1] = [cortes[i] - 0.4, cortes[i + 1] + 0.4]
      const fora = i === 2 ? 0.8 : RAMPA.guia
      const forma = poligono([[lado * meiaRampa(y0), y0], [lado * (meiaRampa(y0) + RAMPA.guia), y0], [lado * (meiaRampa(y1) + fora), y1], [lado * meiaRampa(y1), y1]])
      cena.sombras.push(contato(forma, 0.24))
      L.push(P(forma, pedra, { tabua: 0, eixo: Math.PI / 2, bisel: 1.3, tom: 0.9 + 0.12 * hash(i, lado + 3, 4440), contorno: 0.26, semente: 4441 + i * 2 + lado, projeta: { dist: 1.6, forca: 0.3 } }))
    }
  }

  // A BORDA: o leito escuro das juntas e as pedras em anel, da guia de um lado da rampa até a do outro.
  const aro = menos(anelExato(0, 0, rBorda, R), rasgo)
  cena.sombras.push({ forma: aro, z: ALTURA_DA_BORDA, forca: 0.24 }, contato(aro, 0.3))
  L.push(P(menos(anelExato(0, 0, rBorda - 0.5, R - 0.2), rasgo), pedra, { tabua: 0, bisel: 0.4, tom: 0.52, contorno: 0.2, semente: 4450 }))
  const de = Math.PI / 2 + meioRasgo
  const arco = VOLTA - 2 * meioRasgo
  const nDaBorda = Math.max(6, Math.round((arco * (rBorda + R)) / 2 / (g * PEDRA_DA_BORDA)))
  let a = de
  for (let i = 0; i < nDaBorda; i += 1) {
    // Cada pedra do seu comprimento (a soma fecha o arco certo).
    const fim = i === nDaBorda - 1 ? de + arco : de + (arco * (i + 1 + (hash(i, 5, 4451) - 0.5) * 0.3)) / nDaBorda
    const forma = setorDeAnel(0, 0, rBorda, R - 0.4, a, fim - a, 1)
    L.push(P(forma, pedra, { tabua: 0, arco: { cx: 0, cy: 0, r: (rBorda + R) / 2, a0: (a + fim) / 2 }, bisel: 1.7, tom: 0.94 + 0.16 * hash(i, 6, 4451), contorno: 0.26, semente: 4460 + i }))
    a = fim
  }
}
