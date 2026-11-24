import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Moita tropical (lote L08 de 24/11/2026, item 78: a folhagem baixa de folha larga que cobre as bordas dos degraus do
 * templo do mapa 6, desenho próprio). Uma touceira BAIXA: de cinco a oito FOLHAS LARGAS, em coração, cada uma com duas
 * a quatro FENDAS FUNDAS de cada lado que entram da beira até perto da nervura (a folha "de janela" da mata), de
 * tamanhos bem diferentes, ABERTAS PARA FORA quase no plano do chão (lê deitada, não um cone em pé). Cada folha é de
 * um tom só (a que abre para o lado da luz, clara; a do outro lado, escura: com duas metades de tom ela lia dobrada,
 * como um telhado), com a nervura do meio, as nervuras de lado e, por baixo, a própria sombra no chão; no meio, o pé
 * escuro e uma folha nova enrolada. O que a separa do Arbusto (uma bola de folha miúda) e da Samambaia
 * (frondes finas): poucas folhas GRANDES, de contorno recortado.
 *
 * Cada semente é outra moita: muda o número de folhas, o giro e os tamanhos, e uma das folhas é mais amarelada (a
 * velha). O giro gira a roda das folhas; a luz não gira.
 */

const MASSA: Rgb = [24, 70, 52]
const FOLHA_ESCURA: Rgb = [38, 102, 66]
const FOLHA_MEDIA: Rgb = [60, 130, 76]
const FOLHA_CLARA: Rgb = [102, 160, 90]
const FOLHA_NOVA: Rgb = [138, 182, 104]
const NERVURA: Rgb = [156, 192, 124]
const AMARELADA: Rgb = [156, 170, 88]
const AMARELADA_ESCURA: Rgb = [118, 140, 72]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

type Ponto = readonly [number, number]

/** O pé da touceira e o quanto o chão achata: quase de cima, para as folhas lerem deitadas. */
const PE = { x: 0, y: -0.07 } as const
const ACHATA = 0.74
/** Quantas folhas cada semente tem (de cinco a oito). */
const FOLHAS: readonly number[] = [6, 5, 8, 7, 5, 8, 6, 7]
/** Amostras ao longo de cada metade da folha e onde as fendas podem ficar (frações do comprimento). */
const AMOSTRAS = 15
const FENDAS: readonly number[] = [0.3, 0.46, 0.62, 0.77]

interface Folha {
  a: number
  /** A que distância do pé a folha começa, o comprimento e a meia largura dela. */
  talo: number
  comprimento: number
  largura: number
  /** Quais das fendas cada metade tem (de duas a quatro). */
  fendas: readonly number[]
  amarelada: boolean
}

/** A meia largura da folha em coração ao longo dela (0 no pé, 1 na ponta): o ombro largo perto do pé, a ponta aguda. */
function perfil(t: number): number {
  return Math.pow(Math.sin(Math.PI * Math.pow(Math.max(0, t), 0.56)), 0.8) * (1 - 0.2 * t)
}

/** O contorno de uma metade da folha, do seio do coração até a ponta, com as fendas fundas. */
function metade(f: Folha, lado: 1 | -1, desloca: Ponto): Ponto[] {
  const dx = Math.cos(f.a)
  const dy = Math.sin(f.a)
  const em = (ao: number, traves: number): Ponto => {
    const u = f.talo + ao * f.comprimento
    const w = traves * f.largura * lado
    return [PE.x + desloca[0] + dx * u - dy * w, PE.y + desloca[1] + (dy * u + dx * w) * ACHATA]
  }
  const pontos: Ponto[] = [em(0.07, 0), em(-0.07, 0.5), em(0.03, 0.86)]
  for (let k = 1; k < AMOSTRAS; k++) {
    const t = k / AMOSTRAS
    const fenda = f.fendas.find((x) => Math.abs(x - t) < 0.5 / AMOSTRAS)
    if (fenda !== undefined) {
      // A fenda entra em cunha, da beira até perto da nervura, um pouco para trás.
      pontos.push(em(fenda - 0.035, perfil(fenda - 0.035)), em(fenda - 0.075, 0.2), em(fenda + 0.03, perfil(fenda + 0.03)))
    } else pontos.push(em(t, perfil(t)))
  }
  pontos.push(em(1, 0))
  return pontos
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[], fecha: Ponto): void {
  g.beginPath()
  g.moveTo(pontos[0][0], pontos[0][1])
  for (let i = 1; i < pontos.length; i++) g.lineTo(pontos[i][0], pontos[i][1])
  g.lineTo(fecha[0], fecha[1])
  g.closePath()
  g.fill()
}

function desenharFolha(g: CanvasRenderingContext2D, f: Folha): void {
  const dx = Math.cos(f.a)
  const dy = Math.sin(f.a)
  const noEixo = (ao: number): Ponto => [PE.x + dx * (f.talo + ao * f.comprimento), PE.y + dy * (f.talo + ao * f.comprimento) * ACHATA]
  // A sombra da folha no chão, logo abaixo dela: é o que a deixa deitada, e não em pé.
  g.fillStyle = css(MASSA, 0.5)
  for (const lado of [1, -1] as const) caminho(g, metade(f, lado, [0.012, 0.02]), [noEixo(0.07)[0] + 0.012, noEixo(0.07)[1] + 0.02])
  // A folha inteira num tom só, pelo lado para onde ela abre: a do lado da luz clara, a do outro lado escura.
  const luz = voltadoParaALuz(dx, dy * ACHATA)
  const tom = f.amarelada ? AMARELADA : luz > 0.62 ? FOLHA_CLARA : luz > 0.3 ? FOLHA_MEDIA : FOLHA_ESCURA
  g.fillStyle = css(tom)
  for (const lado of [1, -1] as const) caminho(g, metade(f, lado, [0, 0]), noEixo(0.07))
  // A nervura do meio e as de lado, que saem dela para a ponta de cada gomo.
  const de = noEixo(0.05)
  const ate = noEixo(0.9)
  g.strokeStyle = css(f.amarelada ? AMARELADA_ESCURA : luz > 0.3 ? NERVURA : FOLHA_MEDIA, 0.75)
  g.lineWidth = 0.011
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(de[0], de[1])
  g.lineTo(ate[0], ate[1])
  for (const lado of [1, -1] as const) {
    for (const t of [0.2, 0.4, 0.56, 0.7]) {
      const raiz = noEixo(t - 0.08)
      const w = perfil(t) * f.largura * 0.7 * lado
      g.moveTo(raiz[0], raiz[1])
      g.lineTo(PE.x + dx * (f.talo + t * f.comprimento) - dy * w, PE.y + (dy * (f.talo + t * f.comprimento) + dx * w) * ACHATA)
    }
  }
  g.stroke()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // O pé escuro: o vão entre as folhas, no meio.
  g.fillStyle = css(MASSA)
  g.beginPath()
  g.ellipse(PE.x + 0.008, PE.y + 0.012, 0.13, 0.085, 0, 0, Math.PI * 2)
  g.fill()

  const quantas = FOLHAS[((semente % FOLHAS.length) + FOLHAS.length) % FOLHAS.length]
  const roda = giro + sorteio(semente, 1) * Math.PI * 2
  const velha = Math.floor(sorteio(semente, 2) * quantas)
  const folhas: Folha[] = Array.from({ length: quantas }, (_, i) => {
    // De duas a quatro fendas por metade, sorteadas entre as quatro posições.
    const tiradas = Math.floor(sorteio(semente, 40 + i) * 3)
    const fendas = FENDAS.filter((_x, k) => !(tiradas >= 1 && k === Math.floor(sorteio(semente, 50 + i) * 4)) && !(tiradas >= 2 && k === (Math.floor(sorteio(semente, 50 + i) * 4) + 2) % 4))
    // Tamanhos bem diferentes: uma folha grande ao lado de uma pequena.
    const tamanho = 0.62 + 0.5 * sorteio(semente, 20 + i)
    return {
      a: roda + (i * Math.PI * 2) / quantas + (sorteio(semente, 10 + i) - 0.5) * 0.5,
      talo: 0.03 + 0.04 * sorteio(semente, 30 + i),
      comprimento: 0.34 * tamanho,
      largura: 0.2 * tamanho * (0.88 + 0.24 * sorteio(semente, 60 + i)),
      fendas,
      amarelada: i === velha,
    }
  })
  // As de trás primeiro; as que vêm para a frente por cima.
  for (const f of [...folhas].sort((p, q) => Math.sin(p.a) - Math.sin(q.a))) desenharFolha(g, f)

  // A folha nova no meio: enrolada, clara, inteira.
  const a = roda + 0.8
  g.fillStyle = css(FOLHA_NOVA)
  g.beginPath()
  g.ellipse(PE.x + Math.cos(a) * 0.035, PE.y + Math.sin(a) * 0.035 * ACHATA - 0.012, 0.055, 0.026, Math.atan2(Math.sin(a) * ACHATA, Math.cos(a)), 0, Math.PI * 2)
  g.fill()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'moita-tropical', nome: 'Moita tropical', tamanho: 8, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [MASSA, FOLHA_ESCURA, FOLHA_MEDIA, FOLHA_CLARA, FOLHA_NOVA, NERVURA, AMARELADA, AMARELADA_ESCURA]
