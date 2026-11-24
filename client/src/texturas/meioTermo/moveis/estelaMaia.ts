/**
 * ESTELA ENTALHADA (lote L07 "Selva: ruína e água", 24/11/2026; objeto novo, id `estelaMaia`). A laje de pé, alta e
 * fina, que marca a ruína na mata: o pé de pedra rente ao chão e a laje de ombros redondos, com a INSCRIÇÃO nas duas
 * faces largas, dentro da moldura rebaixada: em cima, o PAINEL GRANDE com um relevo só (a greca de degraus que acaba
 * em voluta) e, embaixo, duas colunas de três CARTUCHOS de canto bem redondo, cada um do seu tamanho, com um glifo.
 * Os glifos são desenhos próprios, só geometria (olho, divisas, voluta, degraus, cruz no losango), sem nenhum par de
 * pontos sobre barra: a grade antiga de 3 x 4 cartuchos iguais lia como teclado de celular, com carinhas. O musgo sobe
 * do pé, mais do lado da sombra, e pega a junta dos ombros.
 *
 * As duas vistas saem da PILHA DE FATIAS: de cima, a laje é um risco grosso com o alto áspero, o pé em volta e a
 * sombra COMPRIDA (a laje é alta); na 3/4, cada fatia mostra a faixa da face virada para quem olha, e a textura dela
 * desenha a inscrição naquela altura (de costas, a outra face, com outros glifos). Perfil da 3/4:
 * `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`.
 *
 * Exporta `luzDoGlifo`, o cartucho com o glifo, que a coluna com glifos também usa.
 */
import { hash } from '../../ruido'
import { poligono, type Ponto } from './formas'
import { contato, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'
import { blocoEmFatias, GRAO_POR_ALTURA, manchaDeMusgo, musgar, musgoDoAlto, PASSO_DAS_FATIAS, pedraDeLaje, pesoDaFace, rumoUnitario, sombraDaBeira } from './muroEmRuina'

// ---------- o glifo ----------

/** O cartucho de cantos redondos (meios lados a, b e raio r): a distância com sinal. */
function distanciaDoCartucho(u: number, v: number, a: number, b: number, r: number): number {
  const qx = Math.abs(u) - a + r
  const qy = Math.abs(v) - b + r
  const ox = qx > 0 ? qx : 0
  const oy = qy > 0 ? qy : 0
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}

/** A meia largura do sulco do cartucho e do traço do glifo, na casa do glifo (-0,5 a 0,5). */
const SULCO = 0.05
const TRACO = 0.045
/** O quanto o sulco escurece (a moldura e os cartuchos rebaixados fundo) e o quanto o miolo do cartucho sobe. */
const FUNDO = -0.34
const RELEVO = 0.04

/**
 * Os desenhos dos glifos em linha quebrada, no retângulo de -1 a 1 (y para cima), esticados até o tamanho de cada
 * cartucho: a serpente em ziguezague, a greca com gancho e a pirâmide em degraus (o olho e as ondas são curvas, no
 * `tracoDoGlifo`). Nenhum é letra, sinal de conta ou ponto: nada que leia como tecla de telefone ou como rosto.
 */
const SERPENTE: readonly Ponto[] = [[-1, -0.55], [-0.5, 0.55], [0, -0.55], [0.5, 0.55], [1, -0.55]]
const GRECA_PEQUENA: readonly Ponto[] = [[-1, -0.6], [-0.45, -0.6], [-0.45, 0.05], [0.1, 0.05], [0.1, 0.65], [0.85, 0.65], [0.85, -0.35], [0.45, -0.35]]
const PIRAMIDE: readonly Ponto[] = [[-1, -0.65], [-0.62, -0.65], [-0.62, -0.1], [-0.28, -0.1], [-0.28, 0.5], [0.28, 0.5], [0.28, -0.1], [0.62, -0.1], [0.62, -0.65], [1, -0.65]]

/** A distância do ponto (x, y) à linha quebrada esticada por (a, b), sem criar ponto novo (roda a cada pixel). */
function aLinhaEsticada(x: number, y: number, linha: readonly Ponto[], a: number, b: number): number {
  let menor = Infinity
  for (let i = 1; i < linha.length; i += 1) {
    const ax = linha[i - 1][0] * a
    const ay = linha[i - 1][1] * b
    const dx = linha[i][0] * a - ax
    const dy = linha[i][1] * b - ay
    let h = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9)
    h = h < 0 ? 0 : h > 1 ? 1 : h
    menor = Math.min(menor, Math.hypot(x - ax - dx * h, y - ay - dy * h))
  }
  return menor
}

/**
 * O TRAÇO do glifo `id` no ponto (x, y) a partir do meio dele (y para cima), no retângulo de meios lados (a, b), com
 * meia largura `t` (tudo na mesma unidade): FUNDO no traço, RELEVO fora. O desenho estica até as beiras: no cartucho
 * largo da estela ele enche o bloco, e não fica um ícone pequeno no meio de um botão.
 */
function tracoDoGlifo(x: number, y: number, id: number, a: number, b: number, t: number): number {
  if (Math.abs(x) > a + t || Math.abs(y) > b + t) return RELEVO
  const tipo = id % 5
  if (tipo === 0) return aLinhaEsticada(x, y, SERPENTE, a, b) < t ? FUNDO : RELEVO
  if (tipo === 1) return aLinhaEsticada(x, y, GRECA_PEQUENA, a, b) < t ? FUNDO : RELEVO
  if (tipo === 2) return aLinhaEsticada(x, y, PIRAMIDE, a, b) < t ? FUNDO : RELEVO
  const xn = x / a
  if (Math.abs(xn) > 0.96) return RELEVO
  if (tipo === 3) {
    // O olho comprido: as duas pálpebras em arco e a barra do meio (um olho só, nunca um par).
    const arco = b * 0.66 * (1 - xn * xn)
    if (Math.abs(Math.abs(y) - arco) < t) return FUNDO
    return Math.abs(y) < t && Math.abs(xn) < 0.34 ? FUNDO : RELEVO
  }
  // As ondas: duas linhas de água, desencontradas.
  const onda = Math.sin(xn * Math.PI * 1.5) * b * 0.24
  return Math.abs(y - b * 0.4 - onda) < t || Math.abs(y + b * 0.4 + onda) < t ? FUNDO : RELEVO
}

/**
 * A luz do GLIFO no ponto (u, v) da casa dele (os dois de -0,5 a 0,5; v para cima): fora do cartucho a pedra lisa (0),
 * o sulco do cartucho escuro e, dentro, o miolo em relevo com o traço do glifo `id` escavado.
 */
export function luzDoGlifo(u: number, v: number, id: number): number {
  const d = distanciaDoCartucho(u, v, 0.42, 0.42, 0.15)
  if (d > SULCO) return 0
  if (d > -SULCO) return FUNDO
  return tracoDoGlifo(u, v, id, 0.27, 0.25, TRACO)
}

// ---------- a estela ----------

/** A laje: meia largura (fração do meio lado maior), meia grossura (fração do menor) e alto (casas). */
const MEIA_LARGURA = 0.68
const MEIA_GROSSURA = 0.36
const ALTURA = 0.9
/** O raio dos ombros (fração da meia largura). */
const OMBRO = 0.45
/** O pé: meios lados (frações dos meios lados da pegada) e alto (casas). */
const PE = { a: 0.94, b: 0.82, alto: 0.06 } as const
/** A inscrição: a margem da moldura (px), a meia largura do sulco (px) e a fração da altura que o painel de cima leva. */
const MOLDURA = 2.6
const SULCO_DA_MOLDURA = 0.75
const PAINEL = 0.47
/**
 * Os cartuchos de baixo: colunas, linhas, a folga entre dois (px, de lado e de cima: entre eles fica pedra lisa, e não
 * uma grade escura), o raio do canto (fração da meia altura), o sulco em volta (px) e, dentro, a margem do glifo, a
 * meia largura do traço e o prefixo (a barra em relevo de um lado, separada do sinal: metade dos blocos tem, px).
 */
const COLUNAS = 2
const LINHAS = 3
const FOLGA_DO_CARTUCHO = { lado: 1.1, cima: 0.8 } as const
const CANTO_DO_CARTUCHO = 0.72
const SULCO_DO_CARTUCHO = 0.55
const MARGEM_DO_GLIFO = 0.9
const TRACO_DO_CARTUCHO = 0.42
const PREFIXO = 2.6
/** A greca do painel (px, a partir do meio dele, v para cima): os degraus e a voluta em que eles acabam. */
const DEGRAUS: readonly Ponto[] = [[-13.5, -6], [-9.5, -6], [-9.5, -2.6], [-5.5, -2.6], [-5.5, 0.8], [-1.5, 0.8], [-1.5, 4.4], [2.8, 4.4]]
const VOLUTA = { cx: 6.1, cy: -0.4, fim: 1.1, aperto: 0.7, sulco: 0.6 } as const
/** A sombra da laje: a altura a mais (vezes a altura) e a força. A laje é alta e fina: de cima, a sombra passa de uma casa. */
const SOMBRA_DA_LAJE = { alto: 3.4, forca: 0.45, suave: 2.2 } as const

/** A distância do ponto à linha quebrada. */
function aLinha(x: number, y: number, linha: readonly Ponto[]): number {
  let menor = Infinity
  for (let i = 1; i < linha.length; i += 1) {
    const [ax, ay] = linha[i - 1]
    const [bx, by] = linha[i]
    const dx = bx - ax
    const dy = by - ay
    let h = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9)
    h = h < 0 ? 0 : h > 1 ? 1 : h
    menor = Math.min(menor, Math.hypot(x - ax - dx * h, y - ay - dy * h))
  }
  return menor
}

/** A GRECA do painel de cima (du, dv em px a partir do meio do painel, dv para cima): os degraus e a voluta. */
function luzDaGreca(du: number, dv: number): number {
  if (aLinha(du, dv, DEGRAUS) < VOLUTA.sulco) return FUNDO
  // A voluta: continua dos degraus, girando para dentro no sentido do relógio até o miolo.
  const [ux, uy] = DEGRAUS[DEGRAUS.length - 1]
  const a0 = Math.atan2(uy - VOLUTA.cy, ux - VOLUTA.cx)
  const r0 = Math.hypot(ux - VOLUTA.cx, uy - VOLUTA.cy)
  const giroMaximo = (r0 - VOLUTA.fim) / VOLUTA.aperto
  const rho = Math.hypot(du - VOLUTA.cx, dv - VOLUTA.cy)
  const phi = Math.atan2(dv - VOLUTA.cy, du - VOLUTA.cx)
  let andado = a0 - phi
  andado -= Math.floor(andado / (2 * Math.PI)) * 2 * Math.PI
  for (; andado <= giroMaximo; andado += 2 * Math.PI) {
    if (Math.abs(rho - (r0 - VOLUTA.aperto * andado)) < VOLUTA.sulco) return FUNDO
  }
  return rho < VOLUTA.fim * 0.8 ? FUNDO : RELEVO
}

export const montarEstelaMaia: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const rumo = rumoUnitario(q)
  cena.corDoPiso = ESCURO_DA_PEDRA
  // A laje corre ao longo do lado maior da pegada.
  const deitada = hw >= hh
  const W = Math.max(hw, hh) * MEIA_LARGURA
  const T = Math.min(hw, hh) * MEIA_GROSSURA
  const zPe = g * PE.alto
  const zAlto = g * ALTURA
  const rOmbro = W * OMBRO
  const daPedra = pedraDeLaje(pedra, 7120, 2 * W)
  /** Do referencial da laje (`a` ao comprido, `b` de través) para o objeto, e de volta. */
  const ponto = (a: number, b: number): Ponto => (deitada ? [a, b] : [-b, a])
  const naLaje = (x: number, y: number): readonly [number, number] => (deitada ? [x, y] : [y, -x])

  // O PÉ: a laje rente ao chão, com musgo.
  const pa = (deitada ? hw : hh) * PE.a
  const pb = (deitada ? hh : hw) * PE.b
  const pe = [ponto(-pa, -pb), ponto(pa, -pb), ponto(pa, pb), ponto(-pa, pb)]
  blocoEmFatias(f, 0, pe, 0, zPe, pedra, { semente: 7100, tom: 0.86, bisel: 0.9, musgo: (x, y) => manchaDeMusgo(x, y, 17, -0.08) })

  // A INSCRIÇÃO, nas duas faces largas: a moldura funda, o painel grande com a greca e os seis cartuchos embaixo.
  const zBaixo = zPe + 3
  const zCima = zAlto - rOmbro * 0.55
  const largura = W - MOLDURA
  const zMeio = zBaixo + (zCima - zBaixo) * (1 - PAINEL)
  const larguraDaCasa = (2 * largura) / COLUNAS
  const alturaDaCasa = (zMeio - zBaixo) / LINHAS
  const inscricao = (a: number, z: number, costas: boolean): number => {
    // A beira da moldura: o sulco em volta da inscrição e o que separa o painel dos cartuchos.
    const dentroA = largura - Math.abs(a)
    const dentroZ = Math.min(z - zBaixo, zCima - z)
    if (dentroA < -0.2 || dentroZ < -0.2) return 0
    if (dentroA < SULCO_DA_MOLDURA * 1.4 || dentroZ < SULCO_DA_MOLDURA * 1.4 || Math.abs(z - zMeio) < SULCO_DA_MOLDURA) return FUNDO
    if (z > zMeio) {
      // O painel de cima: a greca, centrada (a de trás, espelhada).
      return luzDaGreca(costas ? -a : a, z - (zMeio + zCima) / 2) - 0.02
    }
    // Os cartuchos: cada um do seu tamanho (de largura e de altura), de canto bem redondo, com o glifo esticado até
    // encher o bloco; metade com o prefixo de um lado. Cada face tem os cinco desenhos.
    const coluna = Math.min(COLUNAS - 1, Math.floor((a + largura) / larguraDaCasa))
    const linha = Math.min(LINHAS - 1, Math.floor((z - zBaixo) / alturaDaCasa))
    const sal = costas ? 11 : 0
    const meioA = (larguraDaCasa / 2 - FOLGA_DO_CARTUCHO.lado) * (0.84 + 0.16 * hash(coluna, linha + sal, 7151))
    const meioZ = (alturaDaCasa / 2 - FOLGA_DO_CARTUCHO.cima) * (0.88 + 0.12 * hash(coluna, linha + sal, 7153))
    const du = a + largura - (coluna + 0.5) * larguraDaCasa
    const dv = z - zBaixo - (linha + 0.5) * alturaDaCasa
    const d = distanciaDoCartucho(du, dv, meioA, meioZ, meioZ * CANTO_DO_CARTUCHO)
    if (d > SULCO_DO_CARTUCHO) return 0
    if (d > -SULCO_DO_CARTUCHO) return FUNDO
    const id = (linha * COLUNAS + coluna) * 3 + (costas ? 1 : 0)
    const sorte = hash(coluna, linha + sal, 7152)
    let meio = 0
    let meiaLargura = meioA - MARGEM_DO_GLIFO
    if (sorte < 0.5) {
      // O prefixo: a barra em relevo, com um risco curto no meio, e o sulco que a separa do sinal principal.
      const lado = sorte < 0.25 ? -1 : 1
      const divisa = lado * (meioA - PREFIXO)
      if (Math.abs(du - divisa) < TRACO_DO_CARTUCHO) return FUNDO
      if (lado * (du - divisa) > 0) {
        const doPrefixo = (divisa + lado * meioA) / 2
        return Math.abs(dv) < TRACO_DO_CARTUCHO && Math.abs(du - doPrefixo) < PREFIXO * 0.22 ? FUNDO : RELEVO
      }
      meio = (divisa - lado * meioA) / 2
      meiaLargura = meioA - PREFIXO / 2 - MARGEM_DO_GLIFO
    }
    return tracoDoGlifo(du - meio, dv, id, meiaLargura, meioZ - MARGEM_DO_GLIFO, TRACO_DO_CARTUCHO) - 0.02
  }

  // A LAJE: o corpo reto e os ombros redondos no alto (a meia largura encolhe pelo arco).
  const musgoDaLaje = (x: number, y: number, z: number): number => {
    const pe2 = z < zPe + 5 ? (1 - (z - zPe) / 5) * manchaDeMusgo(x * 1.2, y + z * 1.4, 19, -0.08) : 0
    const alto = z > zAlto - 4 ? manchaDeMusgo(x + z * 0.4, y + z, 23, 0.02) : 0
    return Math.max(pe2, alto)
  }
  for (const z of alturas(zPe, zAlto, PASSO_DAS_FATIAS).slice(1)) {
    const noOmbro = z - (zAlto - rOmbro)
    const meia = noOmbro > 0 ? W - rOmbro + Math.sqrt(Math.max(0, rOmbro * rOmbro - noOmbro * noOmbro)) : W
    const corte = poligono([ponto(-meia, -T), ponto(meia, -T), ponto(meia, T), ponto(-meia, T)])
    if (z >= zAlto - 1e-6) {
      const doAlto: Textura = (u, v, x, y, p, s, escala) => {
        daPedra(u, v, x, y, p, s, escala)
        s[3] += 0.04
        musgar(s, musgoDoAlto(musgoDaLaje(x, y, z), -corte.d(x, y), sombraDaBeira(corte, x, y, rumo), x, y, 7120), x, y)
      }
      f.fatia(0, z, corte, pedra, { tabua: 0, bisel: 1.1, tom: 1, contorno: 0.26, textura: doAlto, semente: 7120 })
      continue
    }
    const face: Textura = (u, v, x, y, p, s, escala) => {
      daPedra(u, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, p, s, escala)
      const [a, b] = naLaje(x, y)
      // A face: as largas (b = ±T) levam a inscrição; nos ombros e nas pontas, a luz do arco.
      const largas = T - Math.abs(b) < meia - Math.abs(a)
      let luz: number
      let nx: number
      let ny: number
      if (largas) {
        const nb = Math.sign(b)
        ;[nx, ny] = deitada ? [0, nb] : [-nb, 0]
        luz = luzDaNormal(nx, ny, 0, q) + inscricao(b > 0 ? a : -a, z, b < 0)
      } else {
        const na = Math.sign(a)
        ;[nx, ny] = deitada ? [na, 0] : [0, na]
        const subida = noOmbro > 0 ? noOmbro / rOmbro : 0
        luz = luzDaNormal(nx * (1 - subida), ny * (1 - subida), subida, q)
      }
      if (z - zPe < 1) luz -= 0.18
      s[3] += luz
      musgar(s, musgoDaLaje(x, y, z) * pesoDaFace(z - zPe, nx * rumo[0] + ny * rumo[1]), x, y)
    }
    f.fatia(0, z, corte, pedra, lisa(0.95, face, 7121))
  }
  f.fechar()

  // A sombra COMPRIDA da laje (alta e fina: de cima, ela diz que a laje é de pé), a do pé e o contato.
  const [ax, ay] = ponto(-W, -T)
  const [bx, by] = ponto(W, T)
  const [cx, cy] = ponto(-pa, -pb)
  const [dx, dy] = ponto(pa, pb)
  cena.sombras.push(
    sombraVarrida(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), (zAlto - rOmbro * 0.3) * SOMBRA_DA_LAJE.alto, q, SOMBRA_DA_LAJE.forca, SOMBRA_DA_LAJE.suave),
    sombraVarrida(Math.min(cx, dx), Math.min(cy, dy), Math.max(cx, dx), Math.max(cy, dy), zPe, q, 0.2, 1.1),
    contato(poligono(pe), 0.3),
  )
}
