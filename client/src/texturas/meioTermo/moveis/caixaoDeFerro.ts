/**
 * CAIXÃO DE FERRO (lote L05 de 24/11/2026, item 43: a versão de chapa do caixão, da cripta do mapa 8; desenho
 * próprio, só a ideia do objeto). O hexágono do caixão de madeira (`caixao.ts`: a cabeça estreita, o ombro largo a
 * um quarto do comprimento e o pé estreito), agora de CHAPA rebitada, mais escuro que o de madeira. A tampa é de duas
 * águas: a da esquerda pega a luz, a da direita fica na sombra, e a CUMEEIRA corre no meio, da cabeça ao pé. Duas
 * CINTAS de ferro abraçam o caixão (uma no ombro, uma perto do pé), cada uma com os rebites dela; a beira da tampa é
 * rebitada em volta. A PLAQUINHA do nome na cabeça, as quatro ALÇAS de argola nos lados e a FERRUGEM, contida, só
 * na base das cintas, em volta de alguns rebites e no pé.
 *
 * Revisão do diretor de arte (24/11): a água da direita fica 15 a 18% mais escura que a da esquerda, sem o chanfro
 * claro no corte da cumeeira (ele clareava a beira da água escura e as duas liam iguais), e a cumeeira ganhou o fio de
 * brilho na aresta; a ferrugem solta no meio da tampa (lia como sangue) e a do bisel saíram; o contorno voltou ao
 * escuro neutro da pedra; os rebites da beira são dois terços dos de antes (viravam serrilha no tamanho de mesa).
 *
 * Na 3/4 é como o de madeira: o caixão inteiro é a coluna (perfil derivado).
 * Materiais: `chapa` e `ferragens` (as cintas, os rebites, a cumeeira, as alças e a plaquinha); a ferrugem é fixa.
 */
import type { Rgb } from '../../ruido'
import { barra, caixa, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Altura do caixão em casas. */
const ALTURA = 0.42
/** O ombro: a fração do comprimento, a partir da cabeça, onde o caixão é mais largo (a do caixão de madeira). */
const OMBRO = 0.26
/** Meia largura (fração da meia pegada) na cabeça, no ombro e no pé. */
const LARGURA_NA_CABECA = 0.62
const LARGURA_NO_OMBRO = 0.94
const LARGURA_NO_PE = 0.55
/** O casco da caixa, o da tampa e o da fileira de rebites da beira, em fração da pegada. */
const CASCO_DA_CAIXA = 0.97
const CASCO_DA_TAMPA = 0.87
const CASCO_DOS_REBITES = 0.8
/** As duas cintas: onde ficam (de -1, a cabeça, a 1, o pé) e a meia largura delas (px). */
const CINTAS: readonly number[] = [-0.47, 0.5]
const MEIA_CINTA = 2.3
/** Os rebites da beira: o passo entre eles (dois terços dos 9 a 10 de cada lado de antes) e o raio (px). */
const PASSO_DOS_REBITES = 9.6
const REBITE = 0.78
/** As duas águas da tampa: a da luz e a da sombra (a da sombra sai 15 a 18% mais escura na imagem). */
const TOM_DA_AGUA_DA_LUZ = 1.1
const TOM_DA_AGUA_DA_SOMBRA = 0.88
/** A ferrugem: marrom-alaranjado apagado (saturação 0,44), meio transparente, só nos lugares dela. */
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x85, 0x60, 0x4a] }
const ALFA_DA_FERRUGEM = 0.26
/** Um rebite da beira em cada `REBITE_COM_FERRUGEM` tem a auréola de ferrugem. */
const REBITE_COM_FERRUGEM = 3
/** O vão escuro da argola: cinza-ferro neutro (o marrom da nogueira avermelhava a beira da silhueta). */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x3b, 0x3b, 0x3c] }
/**
 * O escuro em que o pixel escuro demais é levantado: o escuro neutro da pedra, o do túmulo e do pilar. O do ferro da
 * cadeira do L01 (#4a4541) ainda puxava o contorno da chapa para o vermelho.
 */
const ESCURO_NEUTRO: Rgb = [0x45, 0x43, 0x40]
/** A distância "longe" fora do recorte das águas: a peça não pinta ali e o corte não ganha chanfro nem contorno. */
const FORA = 1000

/** O caixão na pegada: o comprimento corre em y (em pé) ou em x (deitado). */
interface Eixos {
  readonly meioC: number
  readonly meiaL: number
  /** O veio corre ao comprido. */
  readonly eixo: number
  /** (através, ao longo), em px do protótipo a partir do meio → (x, y). */
  em(atraves: number, aoLongo: number): Ponto
  /** O "através" do ponto (x, y): negativo do lado da água da luz. */
  atraves(x: number, y: number): number
}

function eixosDo(c: ContextoDoMovel): Eixos {
  const deitado = c.w > c.h
  return {
    meioC: Math.max(c.hw, c.hh),
    meiaL: Math.min(c.hw, c.hh),
    eixo: deitado ? 0 : QUARTO,
    em: (atraves, aoLongo) => (deitado ? [aoLongo, atraves] : [atraves, aoLongo]),
    atraves: (x, y) => (deitado ? y : x),
  }
}

/** A forma só de um lado da cumeeira (`lado` -1, a água da luz, ou 1), sem chanfro nem contorno no corte. */
function deUmLado(f: Forma, e: Eixos, lado: number): Forma {
  return { b: f.b, d: (x, y) => (e.atraves(x, y) * lado >= 0 ? f.d(x, y) : FORA) }
}

/** Meia largura (fração da meia pegada) no ponto `t` do comprimento, de -1 (cabeça) a 1 (pé). */
function larguraEm(t: number): number {
  const ombro = -1 + 2 * OMBRO
  if (t <= ombro) return LARGURA_NA_CABECA + ((t + 1) / (ombro + 1)) * (LARGURA_NO_OMBRO - LARGURA_NA_CABECA)
  return LARGURA_NO_OMBRO + ((t - ombro) / (1 - ombro)) * (LARGURA_NO_PE - LARGURA_NO_OMBRO)
}

/** Os seis cantos do hexágono encolhido para `k` da pegada, em (através, ao longo). */
function cantos(e: Eixos, k: number): Ponto[] {
  const ombro = (-1 + 2 * OMBRO) * e.meioC * k
  const C = e.meioC * k
  const L = e.meiaL * k
  return [
    [-LARGURA_NA_CABECA * L, -C],
    [-LARGURA_NO_OMBRO * L, ombro],
    [-LARGURA_NO_PE * L, C],
    [LARGURA_NO_PE * L, C],
    [LARGURA_NO_OMBRO * L, ombro],
    [LARGURA_NA_CABECA * L, -C],
  ]
}

function casco(e: Eixos, k: number): Forma {
  return poligono(cantos(e, k).map(([a, l]) => e.em(a, l)))
}

/** Um retângulo dado em (através, ao longo). */
function retangulo(e: Eixos, a0: number, l0: number, a1: number, l1: number, raio = 0): Forma {
  const [x0, y0] = e.em(a0, l0)
  const [x1, y1] = e.em(a1, l1)
  return caixa(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), raio)
}

/** A sombra no chão e o contato, pelo casco de fora. */
function sombraDoCaixao(c: ContextoDoMovel, e: Eixos, cena: Cena): void {
  const fora = casco(e, 1)
  cena.sombras.push({ forma: fora, z: c.g * ALTURA }, contato(fora))
}

/** Os rebites da beira da tampa: pelos seis lados do hexágono dos rebites, a cada `PASSO_DOS_REBITES`, fora das cintas. */
function rebitesDaBeira(e: Eixos): Ponto[] {
  const hexagono = cantos(e, CASCO_DOS_REBITES)
  const pontos: Ponto[] = []
  hexagono.forEach(([a0, l0], i) => {
    const [a1, l1] = hexagono[(i + 1) % hexagono.length]
    const passos = Math.max(1, Math.round(Math.hypot(a1 - a0, l1 - l0) / PASSO_DOS_REBITES))
    for (let k = 0; k < passos; k += 1) {
      const a = a0 + ((a1 - a0) * k) / passos
      const l = l0 + ((l1 - l0) * k) / passos
      const naCinta = CINTAS.some((t) => Math.abs(l - t * e.meioC) < MEIA_CINTA + 1.4)
      if (!naCinta) pontos.push([a, l])
    }
  })
  return pontos
}

export const montarCaixaoDeFerro: MontarMovel = (c, cena) => {
  const P = c.peca
  const e = eixosDo(c)
  const chapa = c.m.chapa
  const ferragens = c.m.ferragens
  cena.corDoPiso = ESCURO_NEUTRO
  sombraDoCaixao(c, e, cena)
  const L = cena.partes
  const C = e.meioC

  // A CAIXA e as ALÇAS de argola, duas de cada lado, por baixo da tampa.
  const caixaDeFora = casco(e, CASCO_DA_CAIXA)
  for (const lado of [-1, 1]) {
    for (const t of [-0.22, 0.3]) {
      const borda = larguraEm(t) * e.meiaL * CASCO_DA_CAIXA
      const alca = retangulo(e, lado * (borda - 0.6), t * C - 3.8, lado * (borda + 2.6), t * C + 3.8, 1.2)
      L.push(P(alca, ferragens, { bisel: 0.7, tom: 1.02, contorno: 0.4, semente: 4300 + lado * 3 + (t < 0 ? 0 : 1) }))
      L.push(P(retangulo(e, lado * (borda + 0.4), t * C - 2.4, lado * (borda + 1.5), t * C + 2.4, 0.5), VAO, { bisel: 0, contorno: 0, alfa: 0.8, semente: 4301 }))
    }
  }
  L.push(P(caixaDeFora, chapa, { eixo: e.eixo, tabua: 0, bisel: 1.4, tom: 0.78, contorno: 0.5, semente: 4310 }))

  // A TAMPA de duas águas: a da esquerda clara, a da direita na sombra, e a cumeeira no meio. O corte das águas na
  // cumeeira não tem chanfro (o chanfro clareava a beira da água escura, e as duas liam iguais).
  const tampa = casco(e, CASCO_DA_TAMPA)
  L.push(P(deUmLado(tampa, e, 1), chapa, { eixo: e.eixo, tabua: 0, bisel: 1, tom: TOM_DA_AGUA_DA_SOMBRA, contorno: 0.34, semente: 4320 }))
  L.push(P(deUmLado(tampa, e, -1), chapa, { eixo: e.eixo, tabua: 0, bisel: 1, tom: TOM_DA_AGUA_DA_LUZ, contorno: 0.34, semente: 4321 }))

  // A FERRUGEM, por baixo das cintas e dos rebites: a faixa no pé da tampa e, mais adiante, a da base de cada cinta.
  const ferrugem = { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DA_FERRUGEM, suave: 1.6 }
  const larguraNoPe = LARGURA_NO_PE * e.meiaL * CASCO_DA_TAMPA
  L.push(P(dentroDe(retangulo(e, -larguraNoPe, C * CASCO_DA_TAMPA - 5.5, larguraNoPe, C), casco(e, CASCO_DA_TAMPA - 0.04)), FERRUGEM, { ...ferrugem, semente: 4330 }))

  // A CUMEEIRA: a barra e o fio de brilho da aresta, do lado da luz.
  const [ca, cl] = e.em(0, -C * CASCO_DA_TAMPA + 1)
  const [pa, pl] = e.em(0, C * CASCO_DA_TAMPA - 1)
  L.push(P(dentroDe(barra(ca, cl, pa, pl, 1.6), tampa), ferragens, { bisel: 0.6, tom: 1.04, contorno: 0.3, semente: 4322 }))
  const [ba, bl] = e.em(-0.55, -C * CASCO_DA_TAMPA + 2)
  const [qa, ql] = e.em(-0.55, C * CASCO_DA_TAMPA - 2)
  L.push(P(barra(ba, bl, qa, ql, 0.55), ferragens, { tabua: 0, bisel: 0, contorno: 0, tom: 1.5, alfa: 0.75, semente: 4323 }))

  // As CINTAS: a ferrugem que escorre da base de cada uma, a faixa que abraça a caixa inteira, com a sombra dela na
  // chapa, e os quatro rebites de cada uma.
  CINTAS.forEach((t, i) => {
    const l = t * C
    const larg = larguraEm(t) * e.meiaL * CASCO_DA_TAMPA
    L.push(P(dentroDe(retangulo(e, -larg, l + MEIA_CINTA - 0.6, larg, l + MEIA_CINTA + 2.6), casco(e, CASCO_DA_TAMPA - 0.04)), FERRUGEM, { ...ferrugem, suave: 1.3, semente: 4336 + i }))
    const cinta = dentroDe(casco(e, 0.99), retangulo(e, -e.meiaL, l - MEIA_CINTA, e.meiaL, l + MEIA_CINTA))
    L.push(P(cinta, ferragens, { eixo: e.eixo + QUARTO, tabua: 0, bisel: 0.9, tom: 0.94, contorno: 0.42, projeta: { dist: 1, forca: 0.32 }, semente: 4340 + i }))
    for (const f of [-0.74, -0.27, 0.27, 0.74]) {
      L.push(P(elipse(...e.em(f * larg, l), REBITE * 1.15, REBITE * 1.15), ferragens, { bisel: 0.7, tom: 1.26, contorno: 0.3, semente: 4345 }))
    }
  })

  // Os REBITES da beira da tampa, um em cada três com a auréola de ferrugem.
  rebitesDaBeira(e).forEach(([a, l], k) => {
    if (k % REBITE_COM_FERRUGEM === 1) L.push(P(dentroDe(elipse(...e.em(a, l + 0.5), REBITE * 2.1, REBITE * 2.4), casco(e, CASCO_DA_TAMPA - 0.04)), FERRUGEM, { ...ferrugem, suave: 1, semente: 4351 }))
    L.push(P(elipse(...e.em(a, l), REBITE, REBITE), ferragens, { bisel: 0.6, tom: 1.18, contorno: 0.3, semente: 4350 }))
  })

  // A PLAQUINHA do nome, perto da cabeça: a placa e o risco gasto do nome.
  const lPlaca = -C * 0.7
  L.push(P(retangulo(e, -4.6, lPlaca - 2.2, 4.6, lPlaca + 2.2, 0.6), ferragens, { bisel: 0.6, tom: 1.2, contorno: 0.3, projeta: { dist: 0.6, forca: 0.26 }, semente: 4360 }))
  L.push(P(retangulo(e, -3, lPlaca - 0.4, 2.2, lPlaca + 0.4, 0.2), ferragens, { bisel: 0, tom: 0.66, contorno: 0, semente: 4361 }))
}
