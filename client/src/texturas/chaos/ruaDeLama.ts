import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, mod, passoSuave, rgb, valor } from '../ruido'

/**
 * RUA DE LAMA (lote L06 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cidade
 * medieval): a rua de terra batida depois da chuva, a das vielas e do mercado. A lama vai do molhado (escuro, com um
 * brilho frio) ao seco (mais claro e fosco) em manchas largas; nas partes baixas a água junta em poças rasas, com a
 * beira molhada em volta. Por cima fica o que a rua guarda de quem passou: sulcos curtos de roda, curvos e cada um
 * para um lado (nunca em faixas: sem listra), pegadas e marcas de casco, uns fiapos de palha e pedrinhas soltas.
 * Cores contidas: o marrom da terra, sem laranja; a poça é cinza (o céu nublado nela), não azul.
 *
 * As medidas, em casas: o ladrilho tem 8; as manchas de molhado têm 2 a 3 casas e as poças até 1,5; o sulco tem de 1
 * a 2 casas de comprido e 0,12 de largura; a pegada, 0,22; a pedrinha, 0,05. As marcas moram em células que dividem
 * o ladrilho por inteiro (cada uma olha as vizinhas), então a emenda não aparece.
 */

const CASAS = 8
/** Células por lado do ladrilho: as dos sulcos, as das pegadas e cascos, e as dos miúdos (palha e pedrinha). */
const CELULAS_DO_SULCO = 4
const CELULAS_DAS_PEGADAS = 20
const CELULAS_DOS_MIUDOS = 40

const SECA = rgb('#7b6a55')
const MOLHADA = rgb('#5b4b3c')
/** A água da poça: barrenta e escura, o céu nublado só no meio dela. */
const POCA = rgb('#4e4a43')
const CEU_NA_POCA = rgb('#6c6d69')
const PALHA = rgb('#a08c5e')
const PEDRINHA = rgb('#7c766c')

/** Distância (em casas) de um ponto a um arco: centro (cx, cy), raio `r`, do ângulo `a0` por `abertura`. */
function distanciaAoArco(x: number, y: number, cx: number, cy: number, r: number, a0: number, abertura: number): { d: number; lado: number } {
  const dx = x - cx
  const dy = y - cy
  let a = Math.atan2(dy, dx) - a0
  a -= Math.floor(a / (2 * Math.PI)) * 2 * Math.PI
  const raio = Math.hypot(dx, dy)
  if (a <= abertura) return { d: Math.abs(raio - r), lado: Math.sign(raio - r) }
  // Fora do arco: a distância à ponta mais perto (o sulco acaba arredondado).
  const [p0x, p0y] = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r]
  const [p1x, p1y] = [cx + Math.cos(a0 + abertura) * r, cy + Math.sin(a0 + abertura) * r]
  return { d: Math.min(Math.hypot(x - p0x, y - p0y), Math.hypot(x - p1x, y - p1y)), lado: Math.sign(raio - r) }
}

/**
 * Os sulcos de roda: em cada célula um sulco em arco, às vezes dois desencontrados, cada um com o seu centro, raio e
 * rumo sorteados. Devolve a fundura (0 fora, 1 no meio do sulco) e a inclinação da parede dele.
 */
function sulcos(x: number, y: number): { fundo: number; dhx: number; dhy: number } {
  const celula = CASAS / CELULAS_DO_SULCO
  const ci = Math.floor(x / celula)
  const cj = Math.floor(y / celula)
  let fundo = 0
  let dhx = 0
  let dhy = 0
  for (let j = cj - 1; j <= cj + 1; j += 1) {
    for (let i = ci - 1; i <= ci + 1; i += 1) {
      const [hi, hj] = [mod(i, CELULAS_DO_SULCO), mod(j, CELULAS_DO_SULCO)]
      for (let s = 0; s < 2; s += 1) {
        if (s === 1 && hash(hi, hj, 1907) < 0.75) continue
        const semente = 1910 + s * 7
        const r = 1.6 + hash(hi, hj, semente) * 2.4
        const rumo = hash(hi, hj, semente + 1) * 2 * Math.PI
        const abertura = (1 + hash(hi, hj, semente + 2)) / r
        // O meio do arco cai dentro da célula: o centro do círculo fica a `r` dele, para o lado de fora.
        const [mx, my] = [(i + 0.2 + 0.6 * hash(hi, hj, semente + 3)) * celula, (j + 0.2 + 0.6 * hash(hi, hj, semente + 4)) * celula]
        const meio = rumo + abertura / 2
        const [cx, cy] = [mx - Math.cos(meio) * r, my - Math.sin(meio) * r]
        const largura = 0.08 + 0.04 * hash(hi, hj, semente + 5)
        const { d, lado } = distanciaAoArco(x, y, cx, cy, r, rumo, abertura)
        if (d >= largura * 1.8) continue
        const f = 1 - passoSuave(largura * 0.4, largura * 1.8, d)
        if (f > fundo) {
          fundo = f
          // A parede do sulco desce para o meio dele: a inclinação aponta do meio do arco para fora.
          const k = (d < largura ? d / largura : 1) * 0.9 * lado
          const [nx, ny] = [(x - cx) / Math.max(1e-6, Math.hypot(x - cx, y - cy)), (y - cy) / Math.max(1e-6, Math.hypot(x - cx, y - cy))]
          dhx = nx * k
          dhy = ny * k
        }
      }
    }
  }
  return { fundo, dhx, dhy }
}

/** As pegadas e os cascos: uns poucos, cada um numa célula; devolve a fundura da marca (0 fora). */
function pegadas(x: number, y: number): number {
  const celula = CASAS / CELULAS_DAS_PEGADAS
  const ci = Math.floor(x / celula)
  const cj = Math.floor(y / celula)
  let fundo = 0
  for (let j = cj - 1; j <= cj + 1; j += 1) {
    for (let i = ci - 1; i <= ci + 1; i += 1) {
      const [hi, hj] = [mod(i, CELULAS_DAS_PEGADAS), mod(j, CELULAS_DAS_PEGADAS)]
      const tipo = hash(hi, hj, 1930)
      if (tipo > 0.16) continue
      const [px, py] = [(i + 0.5) * celula, (j + 0.5) * celula]
      const giro = hash(hi, hj, 1931) * 2 * Math.PI
      const [c, s] = [Math.cos(giro), Math.sin(giro)]
      const a = (x - px) * c + (y - py) * s
      const b = -(x - px) * s + (y - py) * c
      let d: number
      if (tipo < 0.09) {
        // A pegada: a sola comprida e o calcanhar, um oval só, mais estreito no meio.
        const meia = 0.11 * (1 - 0.18 * Math.exp(-((a * 12) ** 2)))
        d = Math.hypot(a / 0.11, b / meia) - 1
      } else {
        // O casco: a ferradura (o U aberto para trás).
        const raio = Math.hypot(a, b)
        d = Math.abs(raio - 0.075) / 0.03 - 1
        if (a < -0.02) d = Math.max(d, 1)
      }
      fundo = Math.max(fundo, 1 - passoSuave(-0.4, 0.3, d))
    }
  }
  return fundo
}

/** Os miúdos por cima da lama: um fiapo de palha ou uma pedrinha, ou nada. Devolve a cor e o quanto ela cobre. */
function miudos(x: number, y: number): { cor: readonly [number, number, number]; cobre: number } {
  const celula = CASAS / CELULAS_DOS_MIUDOS
  const ci = Math.floor(x / celula)
  const cj = Math.floor(y / celula)
  const [hi, hj] = [mod(ci, CELULAS_DOS_MIUDOS), mod(cj, CELULAS_DOS_MIUDOS)]
  const tipo = hash(hi, hj, 1950)
  const [px, py] = [(ci + 0.3 + 0.4 * hash(hi, hj, 1951)) * celula, (cj + 0.3 + 0.4 * hash(hi, hj, 1952)) * celula]
  if (tipo < 0.06) {
    // O fiapo de palha: um risco curto e fino, em rumo sorteado.
    const giro = hash(hi, hj, 1953) * Math.PI
    const [c, s] = [Math.cos(giro), Math.sin(giro)]
    const a = (x - px) * c + (y - py) * s
    const b = -(x - px) * s + (y - py) * c
    const d = Math.max(Math.abs(a) - 0.07, 0) + Math.abs(b) - 0.008
    return { cor: luz(PALHA, (hash(hi, hj, 1954) - 0.5) * 0.2), cobre: (1 - passoSuave(-0.006, 0.006, d)) * 0.85 }
  }
  if (tipo < 0.13) {
    // A pedrinha: redonda, o alto de cima à esquerda mais claro.
    const r = 0.03 + 0.025 * hash(hi, hj, 1955)
    const d = Math.hypot(x - px, y - py) - r
    const brilho = ((px - x) + (py - y)) / r
    return { cor: luz(PEDRINHA, (hash(hi, hj, 1956) - 0.5) * 0.16 + brilho * 0.08), cobre: 1 - passoSuave(-0.008, 0.006, d) }
  }
  return { cor: PEDRINHA, cobre: 0 }
}

/** A cor da rua de lama no ponto (u, v) do ladrilho. */
export function texturaRuaDeLama(u: number, v: number): number {
  const uu = u - Math.floor(u)
  const vv = v - Math.floor(v)
  const x = uu * CASAS
  const y = vv * CASAS
  // O molhado em manchas largas; as poças nas partes mais baixas dele.
  const umidade = fbm(uu, vv, 3, 3, 1901) * 0.5 + 0.5
  const molhado = passoSuave(0.4, 0.66, umidade)
  const fundoDaPoca = passoSuave(0.62, 0.78, umidade + fbm(uu, vv, 12, 2, 1902) * 0.03)
  // A lama: o tom do seco ao molhado, as manchas miúdas e o grão.
  let lama = misturar(SECA, MOLHADA, molhado)
  lama = luz(lama, fbm(uu, vv, 10, 3, 1903) * 0.06 + (valor(uu * 192, vv * 192, 192, 1904) - 0.5) * 0.05)
  // O relevo miúdo (os montinhos da lama remexida), os sulcos e as marcas, à luz de cima à esquerda.
  const e = 1 / 2048
  const h = (a: number, b: number): number => fbm(a, b, 24, 3, 1905)
  let dhx = ((h(uu + e, vv) - h(uu - e, vv)) / (2 * e * CASAS)) * 0.05
  let dhy = ((h(uu, vv + e) - h(uu, vv - e)) / (2 * e * CASAS)) * 0.05
  const sulco = sulcos(x, y)
  dhx += sulco.dhx
  dhy += sulco.dhy
  const marca = pegadas(x, y)
  lama = luz(lama, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * 0.5 * (1 - fundoDaPoca))
  // O fundo do sulco e da marca junta água: mais escuro, mais ainda onde já está molhado.
  lama = luz(lama, -(sulco.fundo * 0.12 + marca * 0.14) * (0.6 + 0.4 * molhado))
  // O brilho frio do molhado: um reflexo fraco do céu, só onde a lama está encharcada.
  lama = misturar(lama, CEU_NA_POCA, molhado * passoSuave(0.55, 0.9, valor(uu * 40, vv * 40, 40, 1906)) * 0.08)
  // A poça: a água cinza, mais clara longe da beira (o céu nela); a beira fica escura e lisa.
  if (fundoDaPoca > 0) {
    const agua = misturar(POCA, CEU_NA_POCA, passoSuave(0.5, 1, fundoDaPoca) * 0.35 + fbm(uu, vv, 6, 2, 1907) * 0.06)
    lama = misturar(lama, agua, fundoDaPoca)
  }
  // Os miúdos por cima, fora da água.
  const m = miudos(x, y)
  if (m.cobre > 0) lama = misturar(lama, m.cor, m.cobre * (1 - fundoDaPoca))
  return empacotar(lama)
}
