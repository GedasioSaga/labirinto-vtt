/**
 * FOSSO DE ARENA de cima com volume (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; construção nova). O
 * rebaixo redondo onde se luta: o CHÃO de terra batida marrom-acinzentada, mais clara no meio (onde mais se pisa),
 * rachada em placas (a mesma rede da textura Terra rachada, `chaos/terraRachada.ts`: fendas mestras largas e a rede
 * fina dentro delas), com uma mancha velha, cor de vinho apagado, e uns seixos claros junto da parede; a PAREDE do
 * rebaixo, duas fiadas de pedra que descem da borda, bem acesa do lado que olha para a luz e na sombra do outro (e a
 * meia-lua de sombra dela cai no chão do fosso: é o que faz dele um buraco); a BORDA de pedras rústicas em anel,
 * cada uma do seu comprimento, de quinas quebradas e uma ou outra lascada, rente ao chão de fora; e a RAMPA de
 * entrada, que corta a borda e a parede e desce até o chão: terra larga, escura no pé e clara no alto, com duas
 * travessas de madeira escura para o pé não escorregar e uma guia de blocos de pedra de cada lado.
 *
 * A 25% de zoom sobram o disco claro de terra dentro do anel escuro, a meia-lua de sombra do lado da luz e o rasgo
 * claro da rampa: é um buraco redondo com uma entrada.
 *
 * É CHÃO: rente, não barra (o token anda dentro e pela rampa). A rampa fica embaixo no giro 0. Com 4 x 4 casas ele
 * cabe certo dentro de quatro Arquibancadas de pedra curvas (`arquibancadaDePedra.ts`, raio de dentro de 2 casas), e
 * a rampa cai em frente a uma das quatro escadas delas. Na 3/4 (DERIVADO) só a borda e as guias sobem um fio. As
 * medidas saem do menor meio lado (esticado, continua redondo). Material: `pedra` (a borda, a parede e as guias;
 * sugestão: granito), sempre no tom da PEDRA ESCURA da arena (`PEDRA_ESCURA`). A terra, a mancha e as travessas são
 * fixas.
 *
 * Este arquivo também é o APOIO do lote L11: as formas (`anelExato`, `setorDeAnel`, `pedraRustica`, `bolha`,
 * `girada`, `comMeioEm`) e as contas (`passo`, `viradaParaALuz`, `escuroDe`, `PEDRA_ESCURA`) que os outros desenhos
 * do lote usam.
 */
import { hash, type Rgb } from '../../ruido'
import { rachadura } from '../../chaos/terraRachada'
import { menos, poligono, caixa, type Caixa, type Forma, type Ponto } from './formas'
import { contato, luminanciaLinear, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { naTela, noObjeto } from './pilhaDeFatias'
import { quartosDoGiro } from './pipaDeitada'

// ---------- o apoio do lote ----------

const VOLTA = Math.PI * 2
/** De onde vem a luz no plano da tela (de cima à esquerda, a do motor). */
const LUZ_X = -0.79
const LUZ_Y = -0.61

/**
 * A PEDRA ESCURA da arena (revisão do diretor de arte, 24/11/2026): o tom em que a pedra escolhida entra nos degraus
 * da arquibancada, na borda e na parede do fosso e na boca do poço de sangue. O granito da tabela (#9a968b no tom do
 * Meio-Termo) a 0,66 dá perto de #66635c: é o granito #7e7b76 escurecido a 0,8 do pedido, escuro e neutro para
 * quente (o verde nunca passa do vermelho). A ardósia da primeira versão saía azul-petróleo ao lado da terra.
 */
export const PEDRA_ESCURA = 0.66

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
 * levantado (`cena.corDoPiso`): com um escuro fixo, a sombra funda de cada pedra saía de outra cor; assim a sombra
 * de cada pedra é o tom escuro da própria cor (regra 1 do estilo).
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

/** O sal dos sorteios da pedra rústica. */
const SAL_DA_PEDRA = 4471

/**
 * Uma PEDRA RÚSTICA de borda: o setor de anel entre `r0` e `r1`, do ângulo `a0` por `da`, com `folga` até a vizinha,
 * mas talhada à mão: a beira de fora torta, cada quina quebrada ou só amaciada (sorteio de `semente`) e, com
 * `lasca` (0 a 1, o lugar ao longo da pedra), um naco tirado da beira de fora. O anel de setores iguais lia como
 * borda de piscina.
 */
export function pedraRustica(cx: number, cy: number, r0: number, r1: number, a0: number, da: number, folga: number, semente: number, lasca?: number): Forma {
  const em = (r: number, a: number): Ponto => [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  const funda = r1 - r0
  const [d0, d1] = [a0 + folga / 2 / r0, a0 + da - folga / 2 / r0]
  const [f0, f1] = [a0 + folga / 2 / r1, a0 + da - folga / 2 / r1]
  const comprida = (d1 - d0) * r0
  /** A quina `i` (0 a 3): quebrada (um chanfro de 1 a 3,4 px) ou só amaciada. */
  const quina = (i: number): number => Math.min(funda * 0.42, comprida * 0.3, hash(semente, i, SAL_DA_PEDRA) < 0.55 ? 1 + 2.4 * hash(semente, i + 4, SAL_DA_PEDRA) : 0.4)
  const [q0, q1, q2, q3] = [quina(0), quina(1), quina(2), quina(3)]
  const pontos: Ponto[] = [em(r0 + q0, d0), em(r0, d0 + q0 / r0)]
  const nDeDentro = Math.max(2, Math.ceil(comprida / 6))
  for (let i = 1; i < nDeDentro; i += 1) pontos.push(em(r0, d0 + ((d1 - d0) * i) / nDeDentro))
  pontos.push(em(r0, d1 - q1 / r0), em(r0 + q1, d1), em(r1 - q2, f1))
  // A beira de fora, torta: cada ponto recua um nada; na pedra lascada falta um naco.
  const [de, ate] = [f1 - q2 / r1, f0 + q3 / r1]
  const nDeFora = Math.max(3, Math.ceil(((f1 - f0) * r1) / 4))
  for (let i = 0; i <= nDeFora; i += 1) {
    const t = i / nDeFora
    let recuo = 0.9 * hash(semente, 10 + i, SAL_DA_PEDRA)
    // O naco: torto, mais a pique de um lado que do outro (em V certinho, lia como um entalhe feito de propósito).
    if (lasca !== undefined) recuo += funda * 0.3 * Math.max(0, 1 - Math.abs(t - lasca) / (t < lasca ? 0.12 : 0.3)) ** 0.7
    pontos.push(em(r1 - recuo, de + (ate - de) * t))
  }
  pontos.push(em(r1 - q3, f0))
  return poligono(pontos)
}

/**
 * Um BLOCO RÚSTICO: o polígono dado com cada quina quebrada (um chanfro de `de` a `ate` px) ou inteira, pelo sorteio
 * de `semente`. Para a pedra de quatro lados que não pode sair de régua.
 */
export function blocoRustico(cantos: readonly Ponto[], semente: number, de = 1, ate = 2.6): Forma {
  const n = cantos.length
  const pontos: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const [antes, este, depois] = [cantos[(i + n - 1) % n], cantos[i], cantos[(i + 1) % n]]
    if (hash(semente, i, SAL_DA_PEDRA + 1) >= 0.6) {
      pontos.push(este)
      continue
    }
    const corte = de + (ate - de) * hash(semente, i + 8, SAL_DA_PEDRA + 1)
    for (const vizinho of [antes, depois]) {
      const longe = Math.hypot(vizinho[0] - este[0], vizinho[1] - este[1]) || 1
      const k = Math.min(0.4, corte / longe)
      pontos.push([este[0] + (vizinho[0] - este[0]) * k, este[1] + (vizinho[1] - este[1]) * k])
    }
  }
  return poligono(pontos)
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
/** A espessura da borda e a das guias da rampa (px): o quanto sobem na 3/4 e a sombra curta que fazem no chão de fora. */
const ALTURA_DA_BORDA = 2.4
const ALTURA_DA_GUIA = 3
/** O comprimento médio de uma pedra da borda (cada uma tem de metade a uma vez e meia dele) e de uma da parede (casas, pelo arco). */
const PEDRA_DA_BORDA = 0.56
const PEDRA_DA_PAREDE = 0.42
/** A meia-lua de sombra da parede no chão do fosso: a profundidade (px, para o lado da luz) e a força. É ela que faz o buraco. */
const SOMBRA_NO_CHAO = { k: 16, forca: 0.62 } as const
/** O quanto a parede acende virada para a luz (e apaga de costas). */
const LUZ_DA_PAREDE = 0.26
/** A rampa: a meia largura no alto e no pé (casas), até onde ela desce (fração do raio) e a largura da guia no alto (px). */
const RAMPA = { alto: 0.46, pe: 0.42, ate: 0.47, guia: 6 } as const
/** As duas travessas da rampa: onde (do pé, 0, ao alto, 1), a meia espessura (px) e o tom da madeira escura. */
const TRAVESSAS: readonly number[] = [0.3, 0.7]
const MEIA_TRAVESSA = 1.5
const TOM_DA_TRAVESSA = 0.8
/** A placa do chão rachado, em casas, o quanto a rede é torcida (em placas: pouco, a fenda é quebrada e não ondulada) e a rede miúda dos fios de cabelo. */
const PLACA = 0.62
const TORCAO = 0.3
const FIO = 0.2

/** A terra batida, a fenda dela, a mancha velha (vinho apagado, quase da cor da terra) e o seixo, mais claro que o chão e fosco. */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0x88, 0x7a, 0x69] }
const COR_DA_FENDA = [0x4c, 0x41, 0x38] as const
const COR_DA_MANCHA = [0x6c, 0x4f, 0x49] as const
const SEIXO: MaterialDaPeca = { classe: 'liso', rgb: [0x98, 0x8c, 0x7a] }
/** A mancha e os respingos: [x, y (frações do raio do chão), raio (fração dele)]. */
const MANCHAS: readonly (readonly [number, number, number])[] = [
  [0.24, -0.2, 0.2],
  [0.44, -0.04, 0.055],
  [0.05, -0.4, 0.04],
  [0.36, -0.36, 0.03],
]
/**
 * Os SEIXOS junto da parede, em grupos de dois ou três, fora da meia-lua de sombra: o ângulo e a distância do grupo
 * (fração do raio do chão) e, de cada seixo, [dx, dy, raio] em px. Os pontos escuros com brilho de antes liam como
 * rebites.
 */
const SEIXOS: readonly (readonly [number, number, readonly (readonly [number, number, number])[]])[] = [
  [5.75, 0.9, [[0, 0, 3.5], [-5.2, 1.8, 2.4], [-1.6, 4.6, 2]]],
  [0.5, 0.91, [[0, 0, 3.1], [-3.8, -3.4, 2.2]]],
  [2.2, 0.9, [[0, 0, 3.3], [4.4, 2.4, 2.3], [5, -3, 1.8]]],
]

const R5 = new Float64Array(5)

/**
 * O chão do fosso: a terra mais clara no meio, as manchas largas, as placas rachadas (a fenda mestra, larga, com a
 * beira acesa, e a rede fina dentro dela), os fios de cabelo e a mancha velha. A rede é lida NA TELA (com o giro, a
 * beira acesa de cada placa continua do lado da luz).
 */
function texDoChao(rChao: number, g: number, q: number): Textura {
  const celula = g * PLACA
  const fio = g * FIO
  const [lx, ly] = noObjeto(LUZ_X, LUZ_Y, q)
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x, y) / rChao
    let luz = 0.2 * (1 - passo(0, 0.9, rr)) - 0.07 - 0.05 * passo(0.82, 1, rr)
    // A penumbra: o chão escurece aos poucos para o lado da parede que faz sombra e clareia um nada do lado aceso.
    const paraALuz = (x * lx + y * ly) / rChao
    luz += 0.035 * passo(0.25, 1, -paraALuz) - 0.09 * passo(0.1, 1, paraALuz)
    luz += ruido(x * 0.03 + 3.1, y * 0.03) * 0.1 + ruido(x * 0.1, y * 0.1 + 5.2) * 0.05 + ruido(x * 0.55 + 9, y * 0.55) * 0.03
    const [tx0, ty0] = naTela(x, y, q)
    const tx = ruido(tx0 * 0.05 + 7, ty0 * 0.05) * TORCAO + ruido(tx0 * 0.23 + 3, ty0 * 0.23) * 0.09
    const ty = ruido(tx0 * 0.05, ty0 * 0.05 + 13) * TORCAO + ruido(tx0 * 0.23, ty0 * 0.23 + 8) * 0.09
    rachadura(tx0 / celula + tx, ty0 / celula + ty, 0, 4407, 0.44, R5)
    const d = R5[0] * celula
    const dMestra = R5[3] * celula
    const viradaDaMestra = R5[4]
    // A rede inteira só aparece onde a máscara deixa: cada fenda afina e some no caminho.
    const mascara = passo(-0.12, 0.2, ruido(tx0 * 0.022 + 21, ty0 * 0.022 + 4))
    luz += mascara * ((R5[2] - 0.5) * 0.05 + 0.04 * (passo(0, celula * 0.5, dMestra) - 0.6))
    // A beira da placa grande: acesa virada para a luz, na sombra de costas.
    luz += mascara * passo(4.6, 1.2, dMestra) * (viradaDaMestra > 0 ? viradaDaMestra * 0.1 : viradaDaMestra * 0.05)
    s[3] += luz
    let mancha = 0
    for (const [mx, my, mr] of MANCHAS) {
      const longe = Math.hypot(x - mx * rChao, y - my * rChao) / (mr * rChao)
      // Longe da mancha o ruído da beira dela não muda nada: a conta fica só para quem está perto.
      if (longe < 1.8) mancha = Math.max(mancha, passo(1, 0.5, longe + ruido(x * 0.13 + mx * 40, y * 0.13) * 1.1 + ruido(x * 0.4, y * 0.4 + my * 30) * 0.4))
    }
    // A rede fina, apagada, e por cima a fenda mestra, larga, com o halo úmido.
    let fenda = mascara > 0 ? passo(0.5 * mascara, 0, d) * 0.3 + passo(1.8 * mascara, 0, d) * 0.06 : 0
    if (mascara > 0) fenda = Math.max(fenda, passo(1.25 * mascara, 0, dMestra) * 0.6 + passo(3.4 * mascara, 0, dMestra) * 0.13)
    const fina = mascara * passo(-0.05, 0.2, ruido(tx0 * 0.04 + 50, ty0 * 0.04))
    if (fina > 0) {
      rachadura(tx0 / fio + ty * 2, ty0 / fio + tx * 2, 0, 4408, 0.46, R5)
      fenda = Math.max(fenda, passo(0.4, 0, R5[0] * fio) * 0.16 * fina)
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

  // A RAMPA desce para o meio pelo lado de baixo: a meia largura em cada altura e o rasgo que ela abre na borda. As
  // guias vão da beira da rampa até a beira (reta) do rasgo: mais largas no pé, como um arrimo.
  const [alto, pe, yPe] = [g * RAMPA.alto, g * RAMPA.pe, R * RAMPA.ate]
  const meiaRampa = (y: number): number => pe + ((alto - pe) * (y - yPe)) / (R - yPe)
  const fora = alto + RAMPA.guia
  const rasgo = caixa(-fora, 0, fora, R + 4)
  const meioRasgo = Math.asin(Math.min(0.9, (fora + 0.6) / ((rBorda + R) / 2)))
  const naRampa = (t: number): number => yPe + (R - yPe) * t

  // O CHÃO, com a meia-lua de sombra da parede do lado da luz (o motor a põe na tela: vale nos quatro giros).
  L.push(P(anelExato(0, 0, -1, rChao + 1), TERRA, { tabua: 0, bisel: 0, contorno: 0, recesso: SOMBRA_NO_CHAO, textura: texDoChao(rChao, g, q), semente: 4400 }))

  // Os SEIXOS junto da parede: maiores, claros e foscos, de volta torta (o chanfro baixo não acende um ponto de brilho).
  SEIXOS.forEach(([a, longe, seixos], i) => {
    const [gx, gy] = [Math.cos(a) * rChao * longe, Math.sin(a) * rChao * longe]
    seixos.forEach(([dx, dy, raio], j) => {
      const sal = 4401 + i * 7 + j
      const forma = bolha(gx + dx, gy + dy, raio * 1.2, raio * 0.92, sal, 0.2, a + j * 1.3, 12)
      cena.sombras.push(contato(forma, 0.2))
      L.push(P(forma, SEIXO, { tabua: 0, bisel: raio * 0.45, tom: 0.92 + 0.12 * hash(i, j, 4401), contorno: 0.16, semente: sal, projeta: { dist: 1.2, forca: 0.24 } }))
    })
  })

  // A PAREDE: duas fiadas que descem da borda; a luz de cada trecho sai de para onde ele olha NA TELA.
  const nDaParede = Math.max(8, Math.round((VOLTA * rParede) / (g * PEDRA_DA_PAREDE)))
  const texDaParede: Textura = (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const rr = Math.hypot(x, y) || 1
    let luz = LUZ_DA_PAREDE * viradaParaALuz(-x / rr, -y / rr, q) - 0.03
    const fiada = rr > rParede ? 0.5 : 0
    if (Math.abs(rr - rParede) < 0.45) luz -= 0.16
    const k = (Math.atan2(y, x) / VOLTA) * nDaParede + fiada
    if (Math.abs(k - Math.round(k)) * ((VOLTA * rr) / nDaParede) < 0.45) luz -= 0.14
    // O pé da parede junta terra: a fiada de baixo escurece e puxa para o chão.
    if (rr < rChao + 1.4) luz -= 0.08
    s[3] += luz
  }
  L.push(P(menos(anelExato(0, 0, rChao - 0.6, rBorda + 1), rasgo), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.84 * PEDRA_ESCURA, textura: texDaParede, semente: 4420 }))

  // A RAMPA de terra, larga: escura no pé (some no chão do fosso), clara no alto (o chão de fora); dois sulcos de
  // tanto arrastar.
  const subida = viradaParaALuz(0, -1, q)
  const texDaRampa: Textura = (_u, _v, x, y, _p, s) => {
    const t = (y - yPe) / (R - yPe)
    const meia = meiaRampa(y)
    let luz = -0.07 + 0.16 * t + 0.06 * subida + ruido(x * 0.06 + 31, y * 0.06) * 0.07 + ruido(x * 0.5, y * 0.5 + 17) * 0.03
    const sulco = Math.abs(Math.abs(x) - meia * 0.45)
    if (sulco < 2.2) luz -= 0.04 * (1 - sulco / 2.2)
    s[3] += luz
    s[5] = passo(0, 0.16, t)
  }
  L.push(P(poligono([[-alto, R + 0.4], [alto, R + 0.4], [pe, yPe], [-pe, yPe]]), TERRA, { tabua: 0, bisel: 0, contorno: 0, textura: texDaRampa, semente: 4430 }))
  // As duas TRAVESSAS de madeira escura, meio enterradas.
  const madeira = materialDaPeca('nogueira')
  TRAVESSAS.forEach((t, i) => {
    const y = naRampa(t)
    const meia = meiaRampa(y) - 1.2
    L.push(P(caixa(-meia, y - MEIA_TRAVESSA, meia, y + MEIA_TRAVESSA, 0.8), madeira, { tabua: 0, bisel: 1.1, tom: TOM_DA_TRAVESSA * (0.96 + 0.08 * hash(i, 2, 4431)), contorno: 0.22, semente: 4432 + i, projeta: { dist: 1.3, forca: 0.3 } }))
  })
  // As GUIAS dos dois lados: o leito escuro das juntas e, em cima, quatro blocos rústicos de pedra, cada um do seu
  // comprimento e da sua largura, com a sombra pousada na terra da rampa. O do pé é mais baixo, meio enterrado.
  for (const lado of [-1, 1]) {
    const leito = poligono([[lado * (meiaRampa(R) - 0.4), R - 0.2], [lado * (fora + 0.5), R - 0.2], [lado * (fora + 0.5), yPe + 1], [lado * (meiaRampa(yPe + 1) - 0.4), yPe + 1]])
    L.push(P(leito, pedra, { tabua: 0, bisel: 0, tom: 0.58 * PEDRA_ESCURA, contorno: 0.16, semente: 4439 }))
    const sal = 4440 + (lado + 1) * 5
    const cortes = [R - 0.2, naRampa(0.74 + 0.08 * (hash(1, sal, 4440) - 0.5)), naRampa(0.5 + 0.1 * (hash(2, sal, 4440) - 0.5)), naRampa(0.2 + 0.08 * (hash(3, sal, 4440) - 0.5)), yPe - 2.2]
    for (let i = 0; i + 1 < cortes.length; i += 1) {
      const [y0, y1] = [cortes[i] - 0.5, cortes[i + 1] + 0.5]
      const doPe = i === cortes.length - 2
      // O bloco não encosta na régua do rasgo: cada um recua um nada da beira de fora (o do pé, mais).
      const recuo = (doPe ? 1.8 : 0.2) + 1.1 * hash(i, sal, 4441)
      const torto = (k: number): number => (hash(i * 4 + k, sal, 4442) - 0.5) * 1.1
      const forma = blocoRustico(
        [
          [lado * (meiaRampa(y0) + 0.2 + torto(0)), y0],
          [lado * (fora - recuo + torto(1)), y0 + torto(1)],
          [lado * (fora - recuo + torto(2)), y1 + torto(2)],
          [lado * (meiaRampa(y1) + 0.2 + torto(3)), y1],
        ],
        sal + i,
      )
      cena.sombras.push(contato(forma, 0.26), { forma, z: doPe ? ALTURA_DA_GUIA * 0.5 : ALTURA_DA_GUIA, forca: 0.22 })
      L.push(P(forma, pedra, { tabua: 0, eixo: Math.PI / 2, bisel: 1.6, tom: (doPe ? 0.86 : 0.92 + 0.16 * hash(i, sal, 4443)) * PEDRA_ESCURA, contorno: 0.24, semente: sal + 10 + i, projeta: { dist: 2.4, forca: 0.34, suave: 1.1 } }))
    }
  }

  // A BORDA: o leito escuro das juntas e as pedras rústicas em anel, da guia de um lado da rampa até a do outro.
  const aro = menos(anelExato(0, 0, rBorda, R), rasgo)
  cena.sombras.push({ forma: aro, z: ALTURA_DA_BORDA, forca: 0.24 }, contato(aro, 0.3))
  L.push(P(menos(anelExato(0, 0, rBorda - 0.5, R - 0.2), rasgo), pedra, { tabua: 0, bisel: 0.4, tom: 0.58 * PEDRA_ESCURA, contorno: 0.2, semente: 4450 }))
  const de = Math.PI / 2 + meioRasgo
  const arco = VOLTA - 2 * meioRasgo
  const nDaBorda = Math.max(6, Math.round((arco * (rBorda + R)) / 2 / (g * PEDRA_DA_BORDA)))
  // Cada pedra do seu comprimento, de metade a uma vez e meia da média (a soma fecha o arco certo).
  const pesos = Array.from({ length: nDaBorda }, (_, i) => 0.5 + hash(i, 5, 4451))
  const soma = pesos.reduce((a, b) => a + b, 0)
  // Duas pedras lascadas, longe uma da outra e fora de simetria, com o caco caído no vão.
  const lascadas = new Map<number, number>([[Math.floor(nDaBorda * 0.16), 0.4], [Math.floor(nDaBorda * 0.6), 0.56]])
  let a = de
  for (let i = 0; i < nDaBorda; i += 1) {
    const fim = i === nDaBorda - 1 ? de + arco : a + (arco * pesos[i]) / soma
    const lasca = lascadas.get(i)
    const forma = pedraRustica(0, 0, rBorda, R - 0.4, a, fim - a, 1.1, 4460 + i, lasca)
    L.push(P(forma, pedra, { tabua: 0, arco: { cx: 0, cy: 0, r: (rBorda + R) / 2, a0: (a + fim) / 2 }, bisel: 1.7, tom: (0.9 + 0.22 * hash(i, 6, 4451)) * PEDRA_ESCURA, contorno: 0.24, semente: 4460 + i }))
    if (lasca !== undefined) {
      // O caco: um pedaço pequeno da própria pedra, caído onde ela lascou.
      const noVao = a + (fim - a) * (1 - lasca)
      const [kx, ky] = [Math.cos(noVao) * (R - 3.4), Math.sin(noVao) * (R - 3.4)]
      const caco = blocoRustico([[kx - 2.3, ky - 1.2], [kx + 1.9, ky - 1.7], [kx + 2.5, ky + 1.1], [kx - 1.4, ky + 1.8]], 4490 + i, 0.6, 1.2)
      L.push(P(caco, pedra, { tabua: 0, bisel: 0.9, tom: 0.98 * PEDRA_ESCURA, contorno: 0.24, semente: 4490 + i, projeta: { dist: 0.8, forca: 0.24 } }))
    }
    a = fim
  }
}
