/**
 * RODA D'ÁGUA de cima com volume (lote L18 dos objetos e construções de 14/11/2026, construção do grupo Praça, rua
 * e campo): a roda de pás de madeira, em pé dentro do CANAL de pedra (a água corre da esquerda para a direita), com
 * o EIXO de tora apoiado atrás num PILAR de pedra e na frente num ESTEIO de madeira, cada um com o MANCAL. A roda
 * tem o ARO de fora com dezesseis PÁS, o aro de dentro, oito RAIOS e o CUBO; a água espuma onde as pás batem e
 * segue em ondinhas rio abaixo.
 *
 * De cima: o canal com as duas margens de pedra lavrada e a água; a roda é a faixa de pás atravessando o canal (as
 * do alto quase de quina, as dos lados de chapa), com o escuro de dentro e o cubo no meio aparecendo entre as pás do
 * alto; o eixo indo do pilar ao esteio, a espuma e a SOMBRA da roda para baixo à direita. São as pás atravessadas
 * no canal, com o eixo nos dois apoios, que dizem "roda d'água" e não ponte nem píer.
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada `ESPESSURA_DA_RODA_DAGUA`, a espessura do perfil): a roda fica
 * de frente para quem olha. Cada trecho do ARO, cada PÁ e cada pedaço do aro de dentro é um tampo na altura em que o
 * trecho está na volta da roda (os de baixo, debaixo d'água, não entram); a cara de cima de cada tampo é a largura
 * da roda, e por isso os lados da roda saem cheios. Os RAIOS são tampos rasos só na face da frente NA TELA, um tico
 * à frente do aro (saem depois dele); o CUBO, um tampo na altura do eixo; o EIXO, dois tampos (o de trás da roda sai
 * antes dela, o da frente depois). Os tampos de madeira não têm peça: a frente deles sai da maior peça do objeto, o
 * escuro de dentro da roda (madeira), que tem o meio da caixa num ponto de chão. O trecho do alto do aro tem um furo
 * no meio do cubo, para o eixo e o cubo vistos de cima subirem com o cubo. As margens e o pilar são colunas de pedra.
 * Lê `c.giro` para pôr os raios na face da frente NA TELA (de lado, a roda fica de quina e os raios não entram).
 * Materiais: `madeira` (a roda, o eixo, o esteio, os mancais) e `pedra` (as margens e o pilar). A água, a espuma e o
 * musgo são fixos.
 */
import { hash } from '../../ruido'
import { caixa, capsula, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type OpcoesDaPeca, type Sombra } from './motor'
import { G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

/** A beirada de cada tampo da roda (px do protótipo): a grossura do aro, das pás e dos raios. */
export const ESPESSURA_DA_RODA_DAGUA = 0.06 * G

/** O canal em fração da meia altura: a água (de, até) e as margens (a de trás começa, a da frente acaba). */
const AGUA_DE = -0.3
const AGUA_ATE = 0.42
const MARGEM_DE_TRAS = -0.44
const MARGEM_DA_FRENTE = 0.58
const ALTURA_DA_MARGEM = 0.12
/** A roda: o raio (casas), a altura do eixo (fração do raio), a meia largura (px na escala de partida). */
const RAIO_DA_RODA = 0.95
const EIXO_NO_RAIO = 0.9
const MEIA_LARGURA_DA_RODA = 7.5
/** A grossura de cada cambota (a face da roda) vista de cima (px na escala de partida). */
const CAMBOTA = 2.4
/** Os trechos do aro de fora, as pás, os trechos do aro de dentro (e o raio dele) e os raios. */
const TRECHOS_DO_ARO = 40
const PAS = 16
const PA_SAI = 4
const TRECHOS_DE_DENTRO = 20
const ARO_DE_DENTRO = 0.7
const RAIOS = 8
const PEDACOS_DO_RAIO = 8
/** O eixo: o raio (px), onde começa atrás (fração da meia altura, no pilar) e onde acaba na frente (no esteio). */
const RAIO_DO_EIXO = 3
const EIXO_DE = -0.74
const EIXO_ATE = 0.7
/** O pilar de trás (fração): meia largura, de, até; o esteio da frente: o meio (fração) e o raio (px). */
const PILAR = { meia: 0.16, de: -0.98, ate: -0.48 } as const
const ESTEIO_EM = 0.76
const RAIO_DO_ESTEIO = 3.6
/** A luz do aro visto de cima: o trecho virado para cima, claro; os dos lados, de quina, escuros. */
const TOM_DE_QUINA = 0.72
const TOM_DE_CIMA = 1.1

const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x66, 0x6b] }
const AGUA_NA_SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x40, 0x44] }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xd5, 0xdc, 0xd8] }
const MUSGO: MaterialDaPeca = { classe: 'folha', rgb: [0x5d, 0x6b, 0x45] }
const FERRO = materialDaPeca('ferro')

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

function doDesenho(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

export const montarRodaDagua: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.hw, c.hh) / G
  const quartos = quartosDoGiro(c.giro)
  const madeira = c.m.madeira
  const pedra = c.m.pedra
  const L = cena.partes
  const S = cena.sombras
  const fy = (f: number): number => f * c.hh
  const solta = (forma: Forma, z: number, forca = 0): Sombra => ({ forma, z, solta: true, forca })
  const R = RAIO_DA_RODA * c.g
  const zEixo = EIXO_NO_RAIO * R
  const bw = MEIA_LARGURA_DA_RODA * k
  const yc = (fy(AGUA_DE) + fy(AGUA_ATE)) / 2
  const [ya, yb] = [fy(AGUA_DE), fy(AGUA_ATE)]
  /** O ponto de chão: o escuro de dentro da roda tem o meio da caixa nele (fora de toda estrutura). */
  const chao: Ponto = [R * 0.5, yc + bw + 3]

  // ---------- as sombras: o contato da roda na água e a sombra comprida dela ----------
  // A sombra da roda em pé é a volta dela projetada no chão (para baixo à direita), pintada no chão: uma sombra com
  // altura viraria coluna na 3/4.
  const volta: Ponto[] = []
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * 2 * Math.PI
    const z = Math.max(0, zEixo + Math.sin(a) * R)
    volta.push([Math.cos(a) * R + SOMBRA_X * z, yc + SOMBRA_Y * z])
  }
  S.push({ forma: poligono(volta), z: 0, suave: 3, forca: 0.26 }, contato(caixa(-R * 0.4, yc - bw, R * 0.4, yc + bw, 2), 0.3))

  // ---------- a água do canal: as ondinhas correndo para a direita, a espuma das pás ----------
  L.push(P(comMeioEm(caixa(-c.hw, ya - 1, c.hw, yb + 1), chao[0], chao[1]), AGUA, { tabua: 0, eixo: 0, bisel: 0, contorno: 0.1, tom: 1, ruga: 0.4, recesso: { k: 2.4, forca: 0.36 }, semente: 19200 }))
  for (let i = 0; i < 26; i += 1) {
    const x = -c.hw + 2 * c.hw * hash(i, 1, 19201)
    const y = ya + 3 + (yb - ya - 6) * hash(i, 2, 19201)
    const comp = (5 + 9 * hash(i, 3, 19201)) * k * (x > 0 ? 1.3 : 0.9)
    const onda = capsula(x, y, x + comp, y + (hash(i, 4, 19201) - 0.5) * 1.5, 0.5 * k)
    L.push(P(comMeioEm(onda, chao[0], chao[1]), AGUA, { tabua: 0, bisel: 0, contorno: 0, tom: 1.32, alfa: 0.55, suave: 0.5, semente: 19202 + i }))
  }
  // A espuma: forte junto da roda, abrindo em ondas rio abaixo (à direita).
  for (let i = 0; i < 30; i += 1) {
    const t = hash(i, 1, 19230)
    const x = -R * 0.35 + t * (R * 1.3)
    const largura = (bw + 2) + t * (yb - ya) * 0.35
    const y = yc + (hash(i, 2, 19230) - 0.5) * 2 * largura
    const r = (1.4 + 1.6 * hash(i, 3, 19230) * (1 - t * 0.6)) * k
    L.push(P(comMeioEm(elipseGirada(x, y, r * 1.5, r, 0.2), chao[0], chao[1]), ESPUMA, { tabua: 0, bisel: r * 0.4, contorno: 0.1, tom: 0.92 + 0.12 * hash(i, 4, 19230), alfa: 0.85 - 0.45 * t, semente: 19231 + i }))
  }

  // ---------- as margens: pedras lavradas em fila, colunas baixas; o musgo rente à água ----------
  const margens: readonly (readonly [number, number, number])[] = [
    [fy(MARGEM_DE_TRAS), ya, 0],
    [yb, fy(MARGEM_DA_FRENTE), 1],
  ]
  const passo = 14 * k
  margens.forEach(([m0, m1, lado]) => {
    S.push({ forma: caixa(-c.hw, m0, c.hw, m1), z: ALTURA_DA_MARGEM * c.g, forca: 0.3 })
    // As pedras desencontradas de uma margem para a outra; nenhuma tem o meio no eixo (o eixo, mais alto, a levaria).
    for (let x = -c.hw + (lado === 0 ? 0 : passo / 2); x < c.hw; x += passo) {
      const x1 = Math.min(c.hw, x + passo)
      const meio = (x + x1) / 2
      if (Math.abs(meio) < RAIO_DO_EIXO + 1) continue
      const j = Math.round(x)
      L.push(P(caixa(x + 0.5, m0 + 0.5, x1 - 0.5, m1 - 0.5, 1.2 * k), pedra, { tabua: 0, bisel: 1.6 * k, contorno: 0.3, tom: 0.9 + 0.16 * hash(j, lado, 19270), semente: 19270 + j + lado * 7 }))
    }
    for (let i = 0; i < 7; i += 1) {
      const x = -c.hw * 0.9 + 1.8 * c.hw * hash(i, lado, 19280)
      if (Math.abs(x) < RAIO_DO_EIXO + 4) continue
      const y = lado === 0 ? m1 - 1.6 * k : m0 + 1.6 * k
      L.push(P(elipseGirada(x, y, (2.4 + 2 * hash(i, 2, 19280)) * k, 1.4 * k, 0.1), MUSGO, { tabua: 0, bisel: 0.8, contorno: 0.2, tom: 0.9, semente: 19281 + i + lado * 8 }))
    }
  })

  // ---------- o pilar de trás (com o mancal) e o esteio da frente ----------
  const [p0, p1, pm] = [fy(PILAR.de), fy(PILAR.ate), PILAR.meia * c.hw]
  const pilar = caixa(-pm, p0, pm, p1, 1.2)
  S.push(contato(pilar, 0.34), { forma: pilar, z: zEixo + 2, forca: 0.3 })
  // As peças do pilar têm o meio fora do eixo (que passa por cima dele e é mais alto).
  const doPilar = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    L.push(P(comMeioEm(forma, pm * 0.6, (p0 + p1) / 2), mat, { tabua: 0, ...o }))
  }
  doPilar(pilar, pedra, { bisel: 2 * k, contorno: 0.3, tom: 0.96, semente: 19300 })
  doPilar(caixa(-pm + 1.5, (p0 + p1) / 2 - 0.6, pm - 1.5, (p0 + p1) / 2 + 0.6), pedra, { bisel: 0, contorno: 0.2, tom: 0.7, semente: 19301 })
  doPilar(caixa(-6 * k, p1 - 13 * k, 6 * k, p1 - 2 * k, 1), madeira, { eixo: 0, bisel: 1 * k, contorno: 0.32, tom: 0.9, projeta: { dist: 1.2, forca: 0.3 }, semente: 19302 })
  const ye = fy(ESTEIO_EM)
  const esteio = elipse(0, ye, RAIO_DO_ESTEIO * k, RAIO_DO_ESTEIO * k)
  S.push(contato(esteio, 0.34), { forma: esteio, z: zEixo - RAIO_DO_EIXO, forca: 0.26 })
  L.push(P(esteio, madeira, { tabua: 0, bisel: 1.4 * k, contorno: 0.32, tom: 0.9, polar: { cx: 0, cy: ye, r: RAIO_DO_ESTEIO * k }, semente: 19303 }))
  L.push(P(comMeioEm(caixa(-5.5 * k, ye - 3 * k, 5.5 * k, ye + 2 * k, 0.8), 0, ye), madeira, { tabua: 0, eixo: 0, bisel: 0.8 * k, contorno: 0.32, tom: 0.84, projeta: { dist: 1, forca: 0.3 }, semente: 19304 }))

  // ---------- o eixo: de trás (sai antes da roda) e da frente (sai depois), o mancal de ferro em cada ponta ----------
  const [e0, e1] = [fy(EIXO_DE), fy(EIXO_ATE)]
  const trechosDoEixo: readonly (readonly [number, number, number])[] = [
    [e0, yc - bw, (e0 + yc - bw) / 2 + 3],
    [yc + bw, e1, (yc + bw + e1) / 2],
  ]
  trechosDoEixo.forEach(([de, ate, meio], i) => {
    S.push(solta(caixa(-RAIO_DO_EIXO * k, de, RAIO_DO_EIXO * k, ate, 1), zEixo + RAIO_DO_EIXO * k))
    L.push(P(comMeioEm(caixa(-RAIO_DO_EIXO * k, de, RAIO_DO_EIXO * k, ate, RAIO_DO_EIXO * k * 0.8), 0, meio), madeira, { tabua: 0, eixo: QUARTO, bisel: RAIO_DO_EIXO * k * 0.8, contorno: 0.32, tom: 0.96, projeta: { dist: 1.4, forca: 0.32 }, semente: 19310 + i }))
  })
  L.push(P(comMeioEm(caixa(-RAIO_DO_EIXO * k - 0.8, e1 - 3 * k, RAIO_DO_EIXO * k + 0.8, e1 - 1 * k, 0.4), 0, (yc + bw + e1) / 2), FERRO, { tabua: 0, bisel: 0.4, contorno: 0.32, metal: 0.4, semente: 19312 }))

  // ---------- a roda: o escuro de dentro (no chão), os trechos do aro, as pás, o aro de dentro ----------
  // O vão de dentro da roda, de cima: a água na sombra dela (na 3/4, o pé da roda na água, no chão).
  L.push(P(comMeioEm(caixa(-R - PA_SAI * k, yc - bw, R + PA_SAI * k, yc + bw, 1), chao[0], chao[1]), AGUA_NA_SOMBRA, { tabua: 0, eixo: 0, bisel: 0, contorno: 0, tom: 1, suave: 1, semente: 19320 }))
  const furoDoCubo = elipse(0, yc, 0.6, 0.6)
  /**
   * Um TAMPO DA RODA no ângulo `a` (rad, 0 = direita, π/2 = alto), no raio `r`, com a largura dele na volta. Cada
   * tampo sai um `tico` para trás da roda, e o pingo de madeira dele fica no fundo do tico. Numa mesma vertical, a
   * família mais alta tem o tico mais raso: o pingo da mais baixa fica fundo demais para a mais alta o pegar. Quem
   * passa no meio do cubo ganha o furo dele.
   */
  const tampo = (a: number, r: number, largura: number, z: number, tico: number, semente: number): Forma => {
    const x = Math.cos(a) * r
    const w = Math.max(2.4, Math.abs(Math.sin(a)) * largura)
    const forma = caixa(x - w / 2, yc - bw - tico, x + w / 2, yc + bw)
    S.push(solta(forma.d(0, yc) <= 0 ? menos(forma, furoDoCubo) : forma, z))
    L.push(P(elipse(x, yc - bw - tico + 0.15, 0.2, 0.2), madeira, { tabua: 0, bisel: 0, contorno: 0, semente }))
    return forma
  }
  // Os ticos de cada família, da mais alta (o aro de fora no alto) à mais baixa (as pás de baixo).
  const TICO_ATRAS = { aroDeCima: 0.6, dentroDeCima: 1.2, dentroDeBaixo: 1.8, aroDeBaixo: 2.4, paDeBaixo: 3, paDeCima: 0.3 } as const
  const passoDoAro = (2 * Math.PI) / TRECHOS_DO_ARO
  for (let i = 0; i < TRECHOS_DO_ARO; i += 1) {
    const a = i * passoDoAro
    const z = zEixo + Math.sin(a) * R
    if (z <= 1) continue
    const forma = tampo(a, R, passoDoAro * R + 0.6, z, Math.sin(a) > 0 ? TICO_ATRAS.aroDeCima : TICO_ATRAS.aroDeBaixo, 19330 + i)
    // De cima só se vê a metade de cima do aro: as duas cambotas (as faces), finas, mais claras quanto mais deitadas;
    // entre elas, o vão escuro de dentro da roda.
    if (Math.sin(a) > 0) {
      const tom = TOM_DE_QUINA + (TOM_DE_CIMA - TOM_DE_QUINA) * Math.sin(a)
      for (const lado of [-1, 1]) {
        const face = caixa(forma.b[0], yc + lado * bw - (lado > 0 ? CAMBOTA * k : 0), forma.b[2], yc + lado * bw + (lado < 0 ? CAMBOTA * k : 0))
        L.push(P(face, madeira, { tabua: 0, eixo: 0, bisel: 0.5, contorno: 0.3, tom, semente: 19400 + i * 2 + (lado + 1) / 2 }))
      }
    }
  }
  const passoDeDentro = (2 * Math.PI) / TRECHOS_DE_DENTRO
  for (let i = 0; i < TRECHOS_DE_DENTRO; i += 1) {
    const a = (i + 0.5) * passoDeDentro
    const z = zEixo + Math.sin(a) * R * ARO_DE_DENTRO
    if (z > 1) tampo(a, R * ARO_DE_DENTRO, passoDeDentro * R * ARO_DE_DENTRO + 0.6, z, Math.sin(a) > 0 ? TICO_ATRAS.dentroDeCima : TICO_ATRAS.dentroDeBaixo, 19440 + i)
  }
  const passoDaPa = (2 * Math.PI) / PAS
  for (let i = 0; i < PAS; i += 1) {
    const a = (i + 0.5) * passoDaPa
    const rPa = R + PA_SAI * k
    const z = zEixo + Math.sin(a) * rPa
    if (z <= 1) continue
    const forma = tampo(a, rPa, 4.5 * k, z, Math.sin(a) > 0 ? TICO_ATRAS.paDeCima : TICO_ATRAS.paDeBaixo, 19470 + i)
    // A pá vista de cima: a beira de fora dela, uma travessa fina de cambota a cambota (as das pontas mais juntas, o
    // que dá o redondo da roda). O meio fica na ponta da pá, a mais alta naquele x: na 3/4 ela sobe com a pá.
    if (Math.sin(a) > 0) {
      const x1 = Math.cos(a) * rPa
      const meia = (forma.b[2] - forma.b[0]) / 2 + 0.6
      const tom = 0.88 + 0.24 * Math.abs(Math.cos(a))
      L.push(P(comMeioEm(caixa(x1 - meia, yc - bw - 0.6, x1 + meia, yc + bw + 0.6, 0.4), x1, yc), madeira, { tabua: 0, eixo: QUARTO, bisel: 0.5, contorno: 0.34, tom, projeta: { dist: 1.4, forca: 0.34 }, semente: 19490 + i }))
    }
  }

  // ---------- os raios, na face da frente NA TELA, um tico à frente do aro (de lado a roda fica de quina) ----------
  // Cada raio são pedaços colados; o pingo de cada pedaço fica na beira do lado do vizinho mais baixo (o mais alto não
  // o alcança) e, nos raios de baixo, mais à frente (o raio de cima, no mesmo x, não o alcança).
  const [, frente] = doDesenho(0, 1, quartos)
  if (Math.abs(frente) > 0.5) {
    const lado = Math.sign(frente)
    for (let i = 0; i < RAIOS; i += 1) {
      const a = (i * 2 * Math.PI) / RAIOS + Math.PI / RAIOS
      const deBaixo = Math.sin(a) < 0
      const [r0, r1] = [yc + lado * (bw - 2.5), yc + lado * (bw + (deBaixo ? 1.6 : 0.8))]
      const yPingo = yc + lado * (bw + (deBaixo ? 1.3 : 0.5))
      const aoLado = -Math.sign(Math.cos(a)) * Math.sign(Math.sin(a)) * 1.6 * k
      for (let j = 0; j < PEDACOS_DO_RAIO; j += 1) {
        const r = R * (0.16 + ((ARO_DE_DENTRO - 0.2) * (j + 0.5)) / PEDACOS_DO_RAIO)
        const x = Math.cos(a) * r
        const z = zEixo + Math.sin(a) * r + 1.6
        if (z <= 1) continue
        S.push(solta(caixa(x - 1.8 * k, Math.min(r0, r1), x + 1.8 * k, Math.max(r0, r1)), z))
        L.push(P(elipse(x + aoLado, yPingo, 0.2, 0.2), madeira, { tabua: 0, bisel: 0, contorno: 0, semente: 19510 + i * PEDACOS_DO_RAIO + j }))
      }
    }
  }
  // O cubo: rente à face da frente (o pingo dos raios fica fora dele), atrás até passar do aro.
  S.push(solta(caixa(-5.5 * k, yc - bw - 1.2, 5.5 * k, yc + bw + 0.3, 1), zEixo + 5.5 * k))
  // O cubo e o eixo vistos de cima pelo vão entre as pás do alto: a tora, o cubo, as duas cintas de ferro.
  L.push(P(comMeioEm(caixa(-RAIO_DO_EIXO * k, yc - bw, RAIO_DO_EIXO * k, yc + bw, 1), 0, yc), madeira, { tabua: 0, eixo: QUARTO, bisel: 1.4, contorno: 0.3, tom: 0.9, semente: 19560 }))
  L.push(P(comMeioEm(caixa(-5.5 * k, yc - 3 * k, 5.5 * k, yc + 3 * k, 1), 0, yc), madeira, { tabua: 0, eixo: 0, bisel: 1.6 * k, contorno: 0.32, tom: 1.02, projeta: { dist: 1.2, forca: 0.32 }, semente: 19561 }))
  for (const dy of [-2.2, 2.2]) L.push(P(comMeioEm(caixa(-5.8 * k, yc + dy * k - 0.6, 5.8 * k, yc + dy * k + 0.6), 0, yc), FERRO, { tabua: 0, bisel: 0.3, contorno: 0.3, metal: 0.4, semente: 19562 }))
}

