import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * LAJE DE TEMPLO (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Pisos de pedra): o
 * chão do templo do deserto. Lajes grandes de arenito bege-areia, 2 x 2 casas, em grade reta; séculos de pés
 * gastaram e arredondaram as bordas e os cantos (o ombro largo pega a luz de cima à esquerda), a poeira junta na
 * beira de cada laje e na junta, o arenito mostra as camadas dele em faixas largas e fracas, e uma ou outra laje
 * está rachada de um lado a outro, ou até o meio.
 */

const CASAS = 8
/** Lado da laje, em casas: 4 x 4 lajes no ladrilho. */
const LADO = 2
const LAJES = CASAS / LADO
/** Meia junta de cada laje, em casas. */
const MEIA_JUNTA = [0.028, 0.045] as const
/** O raio do canto gasto, em casas. */
const CANTO = [0.12, 0.32] as const
/** O quanto a borda serpenteia (gasta e lascada), em casas: a onda larga e o lascado miúdo. */
const TORCAO = { larga: 0.028, miuda: 0.008 } as const
/** O ombro gasto: da borda até `largura` casas para dentro a laje desce; a inclinação na borda. */
const OMBRO = { largura: 0.14, inclinacao: 0.3 } as const
/** Cada laje assentada um nada torta. */
const TORTO = 0.035
const LUZ_DO_RELEVO = 0.24
/** A passagem macia da laje para a junta, em casas a partir da borda. */
const PASSAGEM = { dentro: -0.016, fora: 0.012 } as const
/** A poeira na beira da laje: até onde entra, em casas, e quanto escurece. */
const POEIRA = { largura: 0.3, forca: 0.045 } as const
/** As camadas do arenito: faixas por casa e a força delas. */
const CAMADAS = { porCasa: 2.6, forca: 0.035 } as const
/** Quantas lajes têm racha. */
const CHANCE_DE_RACHA = 0.2
/** A racha: meia largura do miolo e do halo, em casas, e quanto cada um puxa para a cor da racha. */
const RACHA = { miolo: 0.012, halo: 0.04, forcaMiolo: 0.6, forcaHalo: 0.14 } as const

/** Arenito bege-areia: o mais forte fica abaixo do teto de croma (0,20) mesmo na luz. */
const TONS: readonly Rgb[] = [rgb('#c2b396'), rgb('#bfae91'), rgb('#c6b89c'), rgb('#bbac90'), rgb('#c4b598'), rgb('#b8aa8f')]
/** A junta: areia suja e funda. */
const COR_DA_JUNTA = rgb('#8a7b64')
/** O fundo da racha: o mesmo pardo, mais escuro. */
const COR_DA_RACHA = rgb('#7a6b56')

/** Ruído de valor sem período (período enorme): para o que é medido dentro da laje e não no ladrilho. */
const SEM_PERIODO = 1 << 20

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/**
 * A racha da laje no ponto (px, py) dela, em casas a partir do meio: de 0 (nada) a 1 (o fundo da racha).
 * Uma linha torta que passa por um ponto sorteado, num rumo sorteado, e afina até sumir na ponta.
 */
function racha(px: number, py: number, laje: number): number {
  if (hash(laje, 10, 2001) >= CHANCE_DE_RACHA) return 0
  const ox = (hash(laje, 11, 2001) - 0.5) * LADO * 0.5
  const oy = (hash(laje, 12, 2001) - 0.5) * LADO * 0.5
  let rx = hash(laje, 13, 2001) - 0.5
  let ry = hash(laje, 14, 2001) - 0.5
  if (Math.abs(rx) + Math.abs(ry) < 0.2) rx = 0.4
  const tamanho = Math.sqrt(rx * rx + ry * ry)
  rx /= tamanho
  ry /= tamanho
  const ao = (px - ox) * rx + (py - oy) * ry
  const atravessado = (px - ox) * -ry + (py - oy) * rx + (valor(ao * 2.5, laje, SEM_PERIODO, 2002) - 0.5) * 0.16 + (valor(ao * 9, laje, SEM_PERIODO, 2003) - 0.5) * 0.035
  // Meia racha (só de um lado do ponto) ou de lado a lado; afina perto da ponta.
  const comprimento = 0.7 + hash(laje, 15, 2001) * 1.3
  const ponta = hash(laje, 16, 2001) < 0.5 ? Math.abs(ao) : Math.max(ao, -ao * 0.15)
  const grossura = 1 - passoSuave(comprimento * 0.55, comprimento, ponta)
  if (grossura <= 0) return 0
  const d = Math.abs(atravessado)
  return passoSuave(RACHA.miolo * grossura, 0, d) * RACHA.forcaMiolo + passoSuave(RACHA.halo * grossura, 0, d) * RACHA.forcaHalo
}

/**
 * A cor da laje de templo no ponto (u, v) do ladrilho.
 * A emenda do ladrilho cai no meio das lajes, nunca numa junta.
 */
export function texturaLajeDeTemplo(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * LAJES + 0.5
  const y = vv * LAJES + 0.5
  const laje = (Math.floor(y) % LAJES) * LAJES + (Math.floor(x) % LAJES)
  // O ponto na laje, em casas a partir do meio, com a borda gasta e lascada.
  const torceX = fbm(uu, vv, 16, 2, 2004) * TORCAO.larga + fbm(uu, vv, 64, 1, 2005) * TORCAO.miuda
  const torceY = fbm(uu, vv, 16, 2, 2006) * TORCAO.larga + fbm(uu, vv, 64, 1, 2007) * TORCAO.miuda
  const px = (x - Math.floor(x) - 0.5) * LADO
  const py = (y - Math.floor(y) - 0.5) * LADO
  const meiaJunta = MEIA_JUNTA[0] + (MEIA_JUNTA[1] - MEIA_JUNTA[0]) * hash(laje, 0, 2001)
  const a = LADO / 2 - meiaJunta
  const r = CANTO[0] + (CANTO[1] - CANTO[0]) * hash(laje, 1, 2001)
  const dx = px + torceX
  const dy = py + torceY
  const qx = Math.abs(dx) - (a - r)
  const qy = Math.abs(dy) - (a - r)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  const fora = Math.sqrt(ox * ox + oy * oy)
  // Distância assinada à borda (negativa dentro) e o rumo para fora dela.
  const borda = fora + Math.min(Math.max(qx, qy), 0) - r
  let nx = 0
  let ny = 0
  if (fora > 0) {
    nx = (Math.sign(dx) * ox) / fora
    ny = (Math.sign(dy) * oy) / fora
  } else if (qx > qy) nx = Math.sign(dx)
  else ny = Math.sign(dy)

  let c = TONS[Math.floor(hash(laje, 2, 2001) * TONS.length) % TONS.length]
  // As camadas do arenito: faixas largas, fracas e tortas, deitadas ou em pé conforme o corte da laje.
  const deitada = hash(laje, 3, 2001) < 0.5
  const camada = (deitada ? py : px) * CAMADAS.porCasa + fbm(uu, vv, 8, 2, 2008) * 0.7
  const faixa = valor(camada, laje, SEM_PERIODO, 2009) - 0.5
  // Manchas largas, o grão de areia e, no fundo do grão, os poros miúdos.
  const grao = valor(uu * 256, vv * 256, 256, 2010)
  const poro = passoSuave(0.2, 0.06, grao)
  c = luz(c, faixa * CAMADAS.forca + fbm(uu, vv, 8, 2, 2011) * 0.04 + (hash(laje, 4, 2001) - 0.5) * 0.05 + (grao - 0.5) * 0.035 - poro * 0.05)
  // A poeira que junta na beira da laje.
  c = luz(c, -passoSuave(POEIRA.largura, 0, -borda) * POEIRA.forca)
  // O ombro gasto pega a luz de cima à esquerda; a laje inteira um nada torta.
  const ombro = OMBRO.inclinacao * (1 - passoSuave(0, OMBRO.largura, -borda))
  const dhx = -nx * ombro + (hash(laje, 5, 2001) - 0.5) * 2 * TORTO
  const dhy = -ny * ombro + (hash(laje, 6, 2001) - 0.5) * 2 * TORTO
  c = luz(c, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO)
  c = misturar(c, COR_DA_RACHA, racha(px, py, laje))
  const naJunta = passoSuave(PASSAGEM.dentro, PASSAGEM.fora, borda)
  if (naJunta <= 0) return empacotar(c)
  // A junta, com o grão dela (o mesmo grão da laje, só mais forte).
  return empacotar(misturar(c, luz(COR_DA_JUNTA, (grao - 0.5) * 0.06), naJunta))
}
