/**
 * CAIXA D'ÁGUA ELEVADA de cima com volume (14/11/2026, lote L16, construções da base militar; serve também a
 * vila): o tanque redondo de aduelas de madeira cintado de ferro, em cima de um CAVALETE de quatro postes
 * travados em X, com o ASSOALHO em volta do tanque, o TELHADO cônico de chapa com a escotilha e o pináculo, e a
 * ESCADA de mão encostada na frente (o lado da escada é a frente). No pé de cada poste, a SAPATA de concreto.
 *
 * De cima: o cone de oito faces (as do lado da luz claras) com a escotilha, o anel do assoalho em volta, os pés
 * dos postes saindo nas quinas, as travessas em X de cada face, a escada e a SOMBRA comprida para baixo à
 * direita. É o cone redondo sobre o assoalho quadrado que diz "caixa d'água" e não a torre de vigia (telhado
 * de palha de quatro águas) nem o poço.
 *
 * NA 3/4 (`tresQuartos.ts`): os postes são colunas até o assoalho; as travessas em X, discos empilhados ao longo
 * de cada diagonal (as do fundo aparecem entre os postes da frente, como num cavalete de verdade); o assoalho,
 * um tampo em quatro tábuas (cada uma com a caixa centrada fora do tanque, para não subir com ele); o tanque,
 * tampos de disco que alargam um nada para baixo (o tanque de aduelas afunila), com a frente redonda de veio de
 * pé (as aduelas) e três tampos de ferro (as cintas); o cone, três tampos em degrau, o de baixo com o furo onde
 * moram os pingos do tanque. Lê `c.giro` só para a escada e o cone saírem depois do que fica atrás.
 *
 * Medidas em fração do menor meio lado (fica redonda e de pé quando esticada); alturas em lados.
 * Materiais: `madeira` (o tanque, o assoalho, os postes, as travessas e a escada). O ferro, a chapa do cone e o
 * concreto são fixos.
 */
import { caixa, capsula, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, QUARTO, materialDaPeca, type MontarMovel } from './contexto'
import { comMeioEm, esticadaParaAFrente, pingo, pilha, solta } from './apoioDasConstrucoes'

/** A beirada dos tampos da caixa d'água (px do protótipo): a altura de cada tampo do tanque. O perfil usa este valor. */
export const ESPESSURA_DA_CAIXA_D_AGUA = 0.1 * G

/** Em fração do menor meio lado: o poste, a sapata, o pé que abre, o assoalho e a borda de dentro dele, o tanque e o cone. */
const POSTE_EM = 0.66
const RAIO_DO_POSTE = 0.075
const PE_ATE = 0.8
const MEIA_SAPATA = 0.1
const ASSOALHO = 0.68
const ASSOALHO_DE_DENTRO = 0.42
const MEIO_DA_TABUA = 0.62
const TANQUE = 0.5
/** Quanto cada tampo do tanque alarga para baixo (px). */
const ALARGA_O_TANQUE = 0.22
const CAMADAS_DO_CONE: readonly number[] = [0.6, 0.4, 0.2]
const FACES_DO_CONE = 8
/** As travessas em X: o raio e quantos discos em cada diagonal. */
const RAIO_DA_TRAVESSA = 0.04
const DISCOS_DA_TRAVESSA = 18
/** A escada: o meio dela, a meia largura, onde o pé toca o chão, a grossura dos banzos e dos degraus. */
const MEIA_LARGURA_DA_ESCADA = 0.12
const PE_DA_ESCADA = 0.97
const RAIO_DO_BANZO = 0.03
const RAIO_DO_DEGRAU = 0.022
const PASSO_DA_ESCADA = 6
/** Alturas em lados: o assoalho, o alto do tanque, cada degrau do cone e o pé das travessas. */
const ALTURA_DO_ASSOALHO = 0.82
const ALTURA_DO_TANQUE = 1.2
const SOBE_O_CONE = 0.07
const PE_DA_TRAVESSA = 0.08
/** As cintas de ferro: os tampos do tanque (contados de cima) que saem ferro. */
const CINTAS: readonly number[] = [1, 4, 7]

const FERRO = materialDaPeca('ferro')
const CHAPA: MaterialDaPeca = { classe: 'metal', rgb: [0x86, 0x8a, 0x86] }
const CONCRETO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0xa4, 0xa1, 0x98] }

export const montarCaixaDAguaElevada: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const S = cena.sombras
  const R = Math.min(c.hw, c.hh)
  const lado = 2 * R
  const e = ESPESSURA_DA_CAIXA_D_AGUA
  const madeira = c.m.madeira
  const f = (v: number): number => v * R
  const [zAssoalho, zTanque] = [ALTURA_DO_ASSOALHO * lado, ALTURA_DO_TANQUE * lado]
  const disco = (x: number, y: number, r: number): Forma => elipse(x, y, r, r)
  /** Em cima do assoalho: sai depois dele (e das travessas da frente), embaixo na tela. */
  const noAlto = (forma: Forma, mais = 0): Forma => esticadaParaAFrente(forma, f(ASSOALHO) + 1 + mais, c.giro)

  // ---------- no chão: as sapatas, os postes (colunas) e o pé de cada um abrindo para a quina ----------
  const quinas: readonly Ponto[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  quinas.forEach(([sx, sy], i) => {
    const [x, y] = [sx * f(POSTE_EM), sy * f(POSTE_EM)]
    const [px, py] = [sx * f(PE_ATE - 0.04), sy * f(PE_ATE - 0.04)]
    const sapata = caixa(px - f(MEIA_SAPATA), py - f(MEIA_SAPATA), px + f(MEIA_SAPATA), py + f(MEIA_SAPATA), 1.2)
    S.push(contato(sapata, 0.32))
    L.push(P(sapata, CONCRETO, { tabua: 0, bisel: 1.2, tom: 0.92, contorno: 0.3, semente: 17100 + i }))
    S.push({ forma: disco(x, y, f(RAIO_DO_POSTE)), z: zAssoalho - e, suave: 1.2, forca: 0.26 })
    // O pé que abre do poste até a sapata (o meio dele fora do assoalho, dentro da coluna do poste).
    const pe = capsula(x - sx * f(0.03), y - sy * f(0.03), px, py, f(RAIO_DO_POSTE) * 0.9)
    L.push(P(comMeioEm(pe, x + sx * f(0.04), y + sy * f(0.04)), madeira, { tabua: 0, eixo: Math.atan2(sy, sx), bisel: f(0.04), tom: 0.94, contorno: 0.32, projeta: { dist: 1, forca: 0.3 }, semente: 17110 + i }))
  })

  // ---------- as travessas em X nas quatro faces: discos ao longo de cada diagonal ----------
  const zPe = PE_DA_TRAVESSA * lado
  const faces: readonly (readonly [Ponto, Ponto])[] = [
    [[-1, -1], [1, -1]],
    [[1, -1], [1, 1]],
    [[1, 1], [-1, 1]],
    [[-1, 1], [-1, -1]],
  ]
  faces.forEach(([a, b]) => {
    for (const [de, ate] of [[a, b], [b, a]] as const) {
      for (let k = 0; k < DISCOS_DA_TRAVESSA; k += 1) {
        const t = k / (DISCOS_DA_TRAVESSA - 1)
        const [x, y] = [f(POSTE_EM) * (de[0] + (ate[0] - de[0]) * t), f(POSTE_EM) * (de[1] + (ate[1] - de[1]) * t)]
        S.push(solta(disco(x, y, f(RAIO_DA_TRAVESSA)), zPe + (zAssoalho - e - zPe) * t))
      }
    }
  })

  // ---------- o assoalho: quatro tábuas largas em volta do tanque, cada uma com a caixa centrada fora dele ----------
  S.push(solta(noAlto(caixa(-f(ASSOALHO), -f(ASSOALHO), f(ASSOALHO), f(ASSOALHO), 1)), zAssoalho, 0.3))
  const [A, D, M] = [f(ASSOALHO), f(ASSOALHO_DE_DENTRO), f(MEIO_DA_TABUA)]
  const tabuas: readonly (readonly [Forma, Ponto, number])[] = [
    [caixa(-A, -A, A, -D), [0, -M], 0],
    [caixa(-A, D, A, A), [0, M], 0],
    [caixa(-A, -D, -D, D), [-M, 0], QUARTO],
    [caixa(D, -D, A, D), [M, 0], QUARTO],
  ]
  tabuas.forEach(([forma, [mx, my], eixo], i) => {
    L.push(P(comMeioEm(forma, mx, my), madeira, { tabua: 6, eixo, bisel: 1, tom: 1.04, contorno: 0.3, projeta: { dist: 1.3, forca: 0.32 }, semente: 17130 + i }))
  })

  // ---------- o tanque: tampos de disco do assoalho ao alto, alargando para baixo; três saem ferro (as cintas) ----------
  const rTanque = f(TANQUE)
  const tampos = pilha(disco(0, 0, rTanque), zAssoalho, zTanque, e)
  const pingos: Ponto[] = []
  tampos.forEach((t, k) => {
    const rk = rTanque + k * ALARGA_O_TANQUE
    S.push({ ...t, forma: noAlto(disco(0, 0, rk), 0.1), forca: k === tampos.length - 1 ? 0.3 : 0 })
    const ponto: Ponto = [-(rk - ALARGA_O_TANQUE / 2), 0]
    pingos.push(ponto)
    L.push(pingo(P, ponto[0], ponto[1], CINTAS.includes(k) ? FERRO : madeira, 17140 + k))
  })

  // ---------- o cone de chapa: três tampos em degrau; o de baixo com o furo onde moram os pingos do tanque ----------
  const ultimo = pingos[pingos.length - 1]
  const furo = capsula(pingos[0][0], 0, ultimo[0], 0, 0.3)
  CAMADAS_DO_CONE.forEach((meio, i) => {
    const r = f(meio)
    const proximo = i + 1 < CAMADAS_DO_CONE.length ? f(CAMADAS_DO_CONE[i + 1]) : 0
    const camada = disco(0, 0, r)
    S.push(solta(noAlto(i === 0 ? menos(camada, furo) : camada, 0.2 + 0.01 * i), zTanque + e * (1 + i) + SOBE_O_CONE * lado * i, i === 0 ? 0.28 : 0))
    for (let j = 0; j < FACES_DO_CONE; j += 1) {
      const [a0, a1] = [((j - 0.5) / FACES_DO_CONE) * 2 * Math.PI, ((j + 0.5) / FACES_DO_CONE) * 2 * Math.PI]
      const meioA = (a0 + a1) / 2
      const fora: Ponto[] = [[Math.cos(a0) * r, Math.sin(a0) * r], [Math.cos(a1) * r, Math.sin(a1) * r]]
      const dentro: Ponto[] = proximo > 0 ? [[Math.cos(a1) * proximo, Math.sin(a1) * proximo], [Math.cos(a0) * proximo, Math.sin(a0) * proximo]] : [[0, 0]]
      // A face virada para a luz (cima à esquerda) clara; a do outro lado escura.
      const tom = 0.96 - 0.16 * (Math.cos(meioA) * 0.79 + Math.sin(meioA) * 0.61)
      L.push(P(poligono([...fora, ...dentro]), CHAPA, { tabua: 0, eixo: meioA + QUARTO, bisel: 0.7, tom, contorno: 0.22, metal: 0.26, projeta: { dist: 1.3, forca: 0.3 }, semente: 17160 + i * FACES_DO_CONE + j }))
    }
  })
  // A escotilha na água do norte e o pináculo no alto.
  L.push(P(caixa(-f(0.09), -f(0.5), f(0.09), -f(0.4), 0.6), CHAPA, { tabua: 0, bisel: 0.6, tom: 1.08, contorno: 0.34, metal: 0.3, projeta: { dist: 1, forca: 0.3 }, semente: 17190 }))
  L.push(P(disco(0, 0, f(0.045)), FERRO, { tabua: 0, bisel: f(0.03), tom: 1.05, contorno: 0.34, metal: 0.4, projeta: { dist: 1.2, forca: 0.32 }, semente: 17191 }))

  // ---------- a escada encostada na frente: discos ao longo dos banzos; cada pedaço e cada degrau sobe com o seu ----------
  const zEscada = zAssoalho + 0.06 * lado
  const pe = f(PE_DA_ESCADA)
  const yNa = (z: number): number => pe - (pe - A) * (z / zAssoalho)
  const niveis = Math.ceil(zEscada / PASSO_DA_ESCADA)
  const banzos = [-f(MEIA_LARGURA_DA_ESCADA), f(MEIA_LARGURA_DA_ESCADA)]
  const rBanzo = f(RAIO_DO_BANZO)
  const zDoNivel = (k: number): number => zEscada * (1 - k / niveis)
  banzos.forEach((x, l) => {
    for (let k = 0; k < niveis; k += 1) {
      const [y, y2] = [yNa(zDoNivel(k)), yNa(zDoNivel(k + 1))]
      const banzo = disco(x, y, rBanzo)
      S.push(solta(zDoNivel(k) > zAssoalho ? noAlto(banzo, 0.3) : banzo, zDoNivel(k)))
      L.push(P(comMeioEm(capsula(x, y, x, y2, rBanzo), x, y), madeira, { tabua: 0, eixo: QUARTO, bisel: rBanzo, tom: 1.04, contorno: 0.32, projeta: { dist: 0.9, forca: 0.3 }, semente: 17200 + l * 60 + k }))
    }
  })
  for (let k = 1; k < niveis; k += 2) {
    const y = yNa(zDoNivel(k))
    L.push(P(comMeioEm(capsula(banzos[0], y, banzos[1], y, f(RAIO_DO_DEGRAU)), banzos[0], y), madeira, { tabua: 0, bisel: f(RAIO_DO_DEGRAU), tom: 0.98, contorno: 0.32, semente: 17330 + k }))
  }
  S.push(contato(capsula(banzos[0], pe, banzos[1], pe, rBanzo * 1.4), 0.3))
}
