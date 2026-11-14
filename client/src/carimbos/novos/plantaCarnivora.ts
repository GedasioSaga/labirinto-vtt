import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Planta carnívora (item 150 da lista de 14/11/2026, Pântano e fantasia): uma
 * dioneia gigante. No chão, a roseta de folhas largas; na ponta de três delas
 * uma armadilha pequena aberta; no meio, num talo grosso, a CABEÇA: a
 * armadilha grande, aberta para cima. Cada armadilha, vista de cima, é um oval
 * com o miolo vermelho, a dobradiça escura no meio e os dentes claros em volta
 * da beira (o que diz "morde" de longe). Às vezes uma segunda cabeça, menor,
 * pende de lado.
 *
 * As duas metades da armadilha abrem em V: por dentro, a metade do lado da
 * sombra olha para a luz e sai mais clara; por fora, a beira do lado da luz
 * sai clara (a luz de sempre, de cima à esquerda, que não gira). O giro gira
 * a roseta e a boca das armadilhas e inclina o talo de leve.
 */

type Ponto = [number, number]

const FOLHA_ESCURA: Rgb = [40, 94, 70]
const FOLHA_CLARA: Rgb = [116, 160, 98]
const TALO: Rgb = [58, 104, 70]
const TALO_CLARO: Rgb = [100, 144, 88]
const LOBO_ESCURO: Rgb = [62, 106, 64]
const LOBO: Rgb = [100, 140, 74]
const LOBO_CLARO: Rgb = [146, 174, 96]
const BOCA: Rgb = [168, 60, 74]
const BOCA_CLARA: Rgb = [204, 104, 106]
const GARGANTA: Rgb = [112, 38, 54]
const DENTE: Rgb = [226, 220, 172]

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 } as const

/** O meio da roseta e o chão visto de cima e um pouco de frente. */
const ROSETA = { y: -0.05, achata: 0.6, folhas: 6, comprimento: 0.3, largura: 0.1 } as const
/** A cabeça: onde fica, o tamanho do oval e o quanto o plano dela se achata (olha mais para quem vê). */
const CABECA = { y: -0.56, comprimento: 0.17, largura: 0.135, achata: 0.78 } as const
/** Armadilha pequena na ponta das folhas, em fração da cabeça. */
const PEQUENA = 0.52
/** Dentes por metade da armadilha. */
const DENTES = 7

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** O quanto a direção (dx, dy) aponta para a luz: 0 de costas, 1 de frente. */
function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
}

/** Uma armadilha: o meio na tela, a direção da dobradiça (no plano dela), o tamanho e o achatamento do plano. */
interface Armadilha {
  x: number
  y: number
  angulo: number
  comprimento: number
  largura: number
  achata: number
}

/** O ponto (ao longo da dobradiça, de través), em frações do oval, levado para a tela. */
function naArmadilha(a: Armadilha, u: number, v: number): Ponto {
  const c = Math.cos(a.angulo)
  const s = Math.sin(a.angulo)
  const lu = u * a.comprimento
  const lv = v * a.largura
  return [a.x + lu * c - lv * s, a.y + (lu * s + lv * c) * a.achata]
}

/** O oval da armadilha em k vezes o tamanho, deslocado (du, dv) em frações. */
function oval(a: Armadilha, k: number, du = 0, dv = 0, kv = k): Ponto[] {
  const pontos: Ponto[] = []
  const passos = 20
  for (let i = 0; i < passos; i++) {
    const t = (i / passos) * Math.PI * 2
    pontos.push(naArmadilha(a, du + Math.cos(t) * k, dv + Math.sin(t) * kv))
  }
  return pontos
}

function pintar(g: CanvasRenderingContext2D, cor: Rgb, pontos: readonly Ponto[]): void {
  g.fillStyle = css(cor)
  caminho(g, pontos)
  g.fill()
}

/** Em que fração (du, dv) do oval fica o lado da luz, na tela: o plano está girado e achatado, a luz não. */
function ladoDaLuz(a: Armadilha): { du: number; dv: number } {
  const c = Math.cos(a.angulo)
  const s = Math.sin(a.angulo)
  // A luz na tela levada de volta para os eixos do oval (o achatamento só encurta y).
  const lx = LUZ_NO_PLANO.x
  const ly = LUZ_NO_PLANO.y / a.achata
  const du = lx * c + ly * s
  const dv = -lx * s + ly * c
  const n = Math.hypot(du, dv) || 1
  return { du: du / n, dv: dv / n }
}

function desenharArmadilha(g: CanvasRenderingContext2D, a: Armadilha): void {
  const luz = ladoDaLuz(a)
  // Por fora: a beira das duas metades, clara do lado da luz e escura do outro.
  pintar(g, LOBO_ESCURO, oval(a, 1.1, -luz.du * 0.05, -luz.dv * 0.07, 1.14))
  pintar(g, LOBO_CLARO, oval(a, 1.06, luz.du * 0.05, luz.dv * 0.07, 1.1))
  pintar(g, LOBO, oval(a, 1.04, 0, 0, 1.06))
  // Por dentro: o vermelho, a metade do lado da sombra (que olha para a luz) mais clara e a dobradiça funda no meio.
  pintar(g, BOCA, oval(a, 0.88, 0, 0, 0.86))
  pintar(g, BOCA_CLARA, oval(a, 0.66, -luz.du * 0.16, -luz.dv * 0.34, 0.42))
  pintar(g, GARGANTA, oval(a, 0.72, 0, 0, 0.13))
  // Os dentes: espinhos claros saindo da beira das duas metades (nenhum nas pontas da dobradiça).
  g.fillStyle = css(DENTE)
  g.beginPath()
  for (const lado of [1, -1]) {
    for (let i = 0; i < DENTES; i++) {
      const t = lado * (0.42 + ((Math.PI - 0.84) * (i + 0.5)) / DENTES)
      const meia = 0.13
      const p0 = naArmadilha(a, Math.cos(t - meia) * 0.96, Math.sin(t - meia) * 0.96)
      const p1 = naArmadilha(a, Math.cos(t) * 1.42, Math.sin(t) * 1.4)
      const p2 = naArmadilha(a, Math.cos(t + meia) * 0.96, Math.sin(t + meia) * 0.96)
      g.moveTo(p0[0], p0[1])
      g.lineTo(p1[0], p1[1])
      g.lineTo(p2[0], p2[1])
      g.closePath()
    }
  }
  g.fill()
}

/**
 * Uma folha da roseta deitada no chão, do meio para fora, na cor da direção
 * dela. A que leva armadilha é o pecíolo da dioneia: fino no pé e largo na
 * ponta, onde a armadilha assenta (a ponta fina deixava a armadilha solta,
 * boiando na grama); a outra é a folha comum, larga no meio e de ponta fina.
 */
function desenharFolha(g: CanvasRenderingContext2D, angulo: number, comprimento: number, largura: number, peciolo: boolean): Ponto {
  const dx = Math.cos(angulo)
  const dy = Math.sin(angulo)
  const ponto = (u: number, v: number): Ponto => [u * dx - v * dy, ROSETA.y + (u * dy + v * dx) * ROSETA.achata]
  const passos = 6
  // A folha em k da largura, de u0 a u1 do comprimento.
  const contorno = (k: number, u0: number, u1: number): Ponto[] => {
    const ida: Ponto[] = []
    const volta: Ponto[] = []
    for (let i = 0; i <= passos; i++) {
      const t = u0 + ((u1 - u0) * i) / passos
      const w = k * (peciolo ? largura * (0.25 + 0.45 * Math.sqrt(t)) : largura * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) ** 0.6)
      ida.push(ponto(t * comprimento, w))
      volta.push(ponto(t * comprimento, -w))
    }
    return [...ida, ...volta.reverse()]
  }
  // A beira sempre escura (a folha clara sumia na grama) e o miolo na cor da direção dela.
  const tom = voltadoParaALuz(dx, dy * ROSETA.achata)
  g.fillStyle = css(misturar(FOLHA_ESCURA, FOLHA_CLARA, 0.12 * tom))
  caminho(g, contorno(1, 0, 1))
  g.fill()
  g.fillStyle = css(misturar(FOLHA_ESCURA, FOLHA_CLARA, 0.25 + 0.75 * tom))
  caminho(g, contorno(0.6, 0.1, peciolo ? 0.94 : 0.86))
  g.fill()
  return ponto(comprimento, 0)
}

/** O talo da cabeça: o escuro largo e o claro estreito puxado para a luz. */
function desenharTalo(g: CanvasRenderingContext2D, de: Ponto, curva: Ponto, ate: Ponto, largura: number): void {
  g.lineCap = 'round'
  g.lineWidth = largura
  g.strokeStyle = css(TALO)
  g.beginPath()
  g.moveTo(de[0], de[1])
  g.quadraticCurveTo(curva[0], curva[1], ate[0], ate[1])
  g.stroke()
  g.lineWidth = largura * 0.42
  g.strokeStyle = css(TALO_CLARO)
  const d = largura * 0.22
  g.beginPath()
  g.moveTo(de[0] - d, de[1])
  g.quadraticCurveTo(curva[0] - d, curva[1], ate[0] - d, ate[1])
  g.stroke()
}

function desenharPlantaCarnivora(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.06
  const folhas = Array.from({ length: ROSETA.folhas }, (_, i) => {
    const angulo = giro + (i * Math.PI * 2) / ROSETA.folhas + (sorteio(semente, i) - 0.5) * 0.4
    return {
      angulo,
      comprimento: ROSETA.comprimento * (0.85 + 0.3 * sorteio(semente, 10 + i)),
      largura: ROSETA.largura * (0.9 + 0.2 * sorteio(semente, 20 + i)),
      // Uma folha sim, outra não, com a armadilha na ponta.
      armadilha: i % 2 === 0,
    }
  })
  // A armadilha assenta na ponta larga do pecíolo: a dobradiça continua a folha.
  const daFolha = (f: (typeof folhas)[number], ponta: Ponto): Armadilha => ({
    x: ponta[0] + Math.cos(f.angulo) * CABECA.comprimento * PEQUENA * 0.55,
    y: ponta[1] + Math.sin(f.angulo) * CABECA.comprimento * PEQUENA * 0.55 * ROSETA.achata - 0.012,
    angulo: f.angulo,
    comprimento: CABECA.comprimento * PEQUENA,
    largura: CABECA.largura * PEQUENA,
    achata: ROSETA.achata,
  })
  const deTras = folhas.filter((f) => Math.sin(f.angulo) < 0).sort((p, q) => Math.sin(p.angulo) - Math.sin(q.angulo))
  const daFrente = folhas.filter((f) => Math.sin(f.angulo) >= 0).sort((p, q) => Math.sin(p.angulo) - Math.sin(q.angulo))

  // As de trás (para cima na tela) e as armadilhas delas, por baixo do talo.
  for (const f of deTras) {
    const ponta = desenharFolha(g, f.angulo, f.comprimento, f.largura, f.armadilha)
    if (f.armadilha) desenharArmadilha(g, daFolha(f, ponta))
  }

  // A segunda cabeça, às vezes: menor, pendendo para o lado que o giro escolhe.
  const segunda = sorteio(semente, 30) < 0.5
  const ladoDaSegunda = Math.cos(giro + 1.1) >= 0 ? 1 : -1
  const cabeca: Armadilha = {
    x: inclina * 1.6,
    y: CABECA.y,
    angulo: giro * 0.5 + (sorteio(semente, 31) - 0.5) * 0.5,
    comprimento: CABECA.comprimento,
    largura: CABECA.largura,
    achata: CABECA.achata,
  }
  const pequenaCabeca: Armadilha = {
    x: ladoDaSegunda * 0.24,
    y: -0.34,
    angulo: giro * 0.5 + ladoDaSegunda * 0.7,
    comprimento: CABECA.comprimento * 0.66,
    largura: CABECA.largura * 0.66,
    achata: CABECA.achata,
  }
  if (segunda) desenharTalo(g, [ladoDaSegunda * 0.03, ROSETA.y], [ladoDaSegunda * 0.2, -0.16], [pequenaCabeca.x, pequenaCabeca.y + 0.04], 0.05)
  desenharTalo(g, [0, ROSETA.y], [inclina - 0.05, -0.32], [cabeca.x, cabeca.y + 0.06], 0.066)

  for (const f of daFrente) {
    const ponta = desenharFolha(g, f.angulo, f.comprimento, f.largura, f.armadilha)
    if (f.armadilha) desenharArmadilha(g, daFolha(f, ponta))
  }
  if (segunda) desenharArmadilha(g, pequenaCabeca)
  desenharArmadilha(g, cabeca)
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'planta-carnivora',
  nome: 'Planta carnívora',
  tamanho: 7,
  sombra: 'em-pe',
  desenhar: desenharPlantaCarnivora,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [
  FOLHA_ESCURA,
  FOLHA_CLARA,
  TALO,
  TALO_CLARO,
  LOBO_ESCURO,
  LOBO,
  LOBO_CLARO,
  BOCA,
  BOCA_CLARA,
  GARGANTA,
  DENTE,
]
