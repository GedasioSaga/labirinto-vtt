import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Palmeira de selva (lote L08 de 24/11/2026, item 77: versão da Palmeira; as palmeiras do templo do mapa 6, desenho
 * próprio). O que a separa da Palmeira de praia (o tronco fino e curvo, sete folhas estreitas e os cocos): a COPA
 * CHEIA de folhas PINADAS e LARGAS, de seis a nove por semente, cada uma com a nervura em arco e os FOLÍOLOS EM PENTE
 * dos dois lados (a metade que olha para a luz clara, a outra escura), com a ponta caída; uma ou duas FOLHAS SECAS,
 * marrons, penduradas junto do tronco; o tronco mais grosso, com os anéis das folhas que caíram; no olho da copa, o
 * broto novo; e nenhum coco. Em algumas sementes o pé mostra as RAÍZES à mostra, abertas no chão (as do alto do
 * templo, por cima da pedra).
 *
 * Cada semente é outra palmeira: a altura (15% para mais ou para menos), a inclinação do tronco (até 8 graus para um
 * lado ou para o outro), o número de folhas e o giro da copa mudam, e não só o leque. A luz não gira.
 *
 * A SOMBRA é a `baixa`: a copa cai perto do pé (com a `em-pe` ela caía quase uma casa longe, como mancha solta), e a
 * mancha escura do pé, pintada no chão, prende a sombra ao tronco.
 */

const TRONCO: Rgb = [128, 102, 70]
const TRONCO_SOMBRA: Rgb = [92, 72, 50]
const ANEL: Rgb = [74, 58, 42]
const RAIZ: Rgb = [116, 92, 64]
const RAIZ_SOMBRA: Rgb = [80, 62, 44]
const FOLHA_CLARA: Rgb = [94, 150, 86]
const FOLHA_MEDIA: Rgb = [58, 122, 72]
const FOLHA_ESCURA: Rgb = [30, 90, 62]
const NERVURA: Rgb = [142, 178, 110]
const BROTO: Rgb = [128, 170, 96]
const SECA_CLARA: Rgb = [156, 122, 78]
const SECA_ESCURA: Rgb = [112, 84, 54]
/** A mancha escura do pé, no chão: prende a sombra pousada ao tronco. */
const PE_NO_CHAO: Rgb = [36, 52, 42]

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

/** A altura de partida do olho da copa, o quanto ela muda por semente e a inclinação máxima do tronco (radianos). */
const ALTURA = 0.68
const MUDA_A_ALTURA = 0.15
const INCLINACAO = 0.14
/** O chão visto de cima e um pouco de frente: o leque das folhas e o das raízes achatam assim. */
const ACHATA = 0.6
/** Quantas folhas verdes cada semente tem (de seis a nove) e quantos folíolos de cada lado da nervura. */
const FOLHAS: readonly number[] = [7, 6, 9, 8, 6, 9, 7, 8]
const FOLIOLOS = 9
/** De cada quantas sementes uma mostra as raízes (as de número que deixa este resto). */
const RAIZES_A_CADA = 3

interface Folha {
  a: number
  comprimento: number
  /** O folíolo mais comprido (no meio da folha). */
  largura: number
  /** Quanto a nervura sobe no meio e quanto a ponta cai. */
  sobe: number
  cai: number
  seca: boolean
}

function noArco(a: Ponto, c: Ponto, b: Ponto, t: number): Ponto {
  const u = 1 - t
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
}

/** Uma folha pinada: a nervura em arco e os folíolos em pente dos dois lados, cada lado num caminho só. */
function desenharFolha(g: CanvasRenderingContext2D, olho: Ponto, f: Folha): void {
  const dx = Math.cos(f.a)
  const dy = Math.sin(f.a) * ACHATA
  const base: Ponto = [olho[0] + dx * 0.02, olho[1] + dy * 0.02]
  const curva: Ponto = [olho[0] + dx * f.comprimento * 0.5, olho[1] + dy * f.comprimento * 0.5 - f.sobe]
  const ponta: Ponto = [olho[0] + dx * f.comprimento, olho[1] + dy * f.comprimento + f.cai]
  const tangenteEm = (t: number): Ponto => {
    const q = noArco(base, curva, ponta, Math.min(1, t + 0.02))
    const r = noArco(base, curva, ponta, Math.max(0, t - 0.02))
    const n = Math.hypot(q[0] - r[0], q[1] - r[1]) || 1
    return [(q[0] - r[0]) / n, (q[1] - r[1]) / n]
  }
  const meio = tangenteEm(0.5)
  const [claro, escuro] = f.seca ? [SECA_CLARA, SECA_ESCURA] : Math.sin(f.a) < -0.25 ? [FOLHA_MEDIA, FOLHA_ESCURA] : [FOLHA_CLARA, FOLHA_MEDIA]
  const passo = 0.94 / FOLIOLOS
  for (const lado of [1, -1] as const) {
    // O lado da nervura que olha para a luz fica claro.
    g.fillStyle = css(voltadoParaALuz(-meio[1] * lado, meio[0] * lado) > 0.5 ? claro : escuro)
    g.beginPath()
    for (let k = 0; k < FOLIOLOS; k++) {
      const t = 0.08 + (k + 0.5) * passo
      const p = noArco(base, curva, ponta, t)
      const tg = tangenteEm(t)
      // Largo no meio da folha, curto no pé e na ponta; o folíolo aponta para fora e para a frente, e a ponta dele cai.
      const w = f.largura * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.8)
      const meia = passo * f.comprimento * 0.4
      const fx = p[0] + (-tg[1] * lado + tg[0] * 0.42) * w
      const fy = p[1] + (tg[0] * lado + tg[1] * 0.42) * w + w * 0.3
      g.moveTo(p[0] - tg[0] * meia, p[1] - tg[1] * meia)
      g.lineTo(fx, fy)
      g.lineTo(p[0] + tg[0] * meia, p[1] + tg[1] * meia)
      g.closePath()
    }
    g.fill()
  }
  // A nervura, do pé até a ponta.
  g.strokeStyle = css(f.seca ? SECA_ESCURA : NERVURA, f.seca ? 0.9 : 0.8)
  g.lineWidth = 0.013
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(base[0], base[1])
  g.quadraticCurveTo(curva[0], curva[1], ponta[0], ponta[1])
  g.stroke()
}

/** As raízes à mostra: dedos que saem do pé do tronco e se abrem no chão, cada um com a metade da luz e a da sombra. */
function desenharRaizes(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const quantas = 6
  for (let i = 0; i < quantas; i++) {
    const a = giro * 0.5 + 0.3 + (i * Math.PI * 2) / quantas + (sorteio(semente, 60 + i) - 0.5) * 0.5
    const comprida = 0.2 + 0.1 * sorteio(semente, 70 + i)
    const dx = Math.cos(a)
    const dy = Math.sin(a) * ACHATA
    const ponta: Ponto = [dx * comprida, dy * comprida + 0.02]
    const pe: Ponto = [dx * 0.03, -0.05 + dy * 0.03]
    const nx = -dy
    const ny = dx
    const n = Math.hypot(nx, ny) || 1
    const grossa = 0.032
    const cotovelo: Ponto = [dx * comprida * 0.5, dy * comprida * 0.5 - 0.035]
    for (const lado of [1, -1] as const) {
      g.fillStyle = css(voltadoParaALuz((nx / n) * lado, (ny / n) * lado) > 0.5 ? RAIZ : RAIZ_SOMBRA)
      g.beginPath()
      g.moveTo(pe[0], pe[1])
      g.quadraticCurveTo(cotovelo[0] + (nx / n) * grossa * lado, cotovelo[1] + (ny / n) * grossa * lado, ponta[0], ponta[1])
      g.quadraticCurveTo(cotovelo[0], cotovelo[1], pe[0], pe[1])
      g.closePath()
      g.fill()
    }
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // Cada semente é outra palmeira: a altura, a inclinação do tronco e o giro da copa.
  const altura = ALTURA * (1 - MUDA_A_ALTURA + 2 * MUDA_A_ALTURA * sorteio(semente, 2))
  const tomba = (sorteio(semente, 3) - 0.5) * 2 * INCLINACAO
  const olho: Ponto = [Math.sin(tomba) * altura, -Math.cos(tomba) * altura]
  /** O ponto a `t` do tronco (0 no pé, 1 no olho), `lado` para o lado dele. */
  const noTronco = (t: number, lado: number): Ponto => [olho[0] * t + Math.cos(tomba) * lado, olho[1] * t + Math.sin(tomba) * lado]

  // A mancha do pé no chão: a sombra pousada presa ao tronco.
  g.fillStyle = css(PE_NO_CHAO, 0.34)
  g.beginPath()
  g.ellipse(0.03, 0.012, 0.15, 0.05, 0, 0, Math.PI * 2)
  g.fill()

  if (semente % RAIZES_A_CADA === 1) desenharRaizes(g, giro, semente)

  // O tronco: grosso, mais largo no pé; a metade da esquerda na luz, a da direita na sombra.
  const [peE, peD, altoE, altoD, meioE, meioD] = [noTronco(0, -0.064), noTronco(0, 0.066), noTronco(0.97, -0.034), noTronco(0.97, 0.034), noTronco(0.42, -0.04), noTronco(0.42, 0.044)]
  const altoM = noTronco(0.97, 0)
  g.fillStyle = css(TRONCO)
  g.beginPath()
  g.moveTo(peE[0], peE[1] + 0.012)
  g.quadraticCurveTo(meioE[0], meioE[1], altoE[0], altoE[1])
  g.lineTo(altoM[0], altoM[1])
  g.lineTo(0, 0.02)
  g.closePath()
  g.fill()
  g.fillStyle = css(TRONCO_SOMBRA)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(altoM[0], altoM[1])
  g.lineTo(altoD[0], altoD[1])
  g.quadraticCurveTo(meioD[0], meioD[1], peD[0], peD[1] + 0.014)
  g.closePath()
  g.fill()
  // Os anéis das folhas que caíram: riscos curtos de través, mais juntos no alto.
  g.strokeStyle = css(ANEL, 0.6)
  g.lineWidth = 0.011
  g.lineCap = 'round'
  g.beginPath()
  for (let i = 0; i < 7; i++) {
    const t = 0.1 + 0.12 * i
    const meia = 0.055 - 0.022 * t
    const [e, m, d] = [noTronco(t, -meia), noTronco(t - 0.022, 0), noTronco(t, meia)]
    g.moveTo(e[0], e[1])
    g.quadraticCurveTo(m[0], m[1], d[0], d[1])
  }
  g.stroke()

  // As folhas: de seis a nove, em roda, mais uma ou duas secas penduradas junto do tronco.
  const quantas = FOLHAS[((semente % FOLHAS.length) + FOLHAS.length) % FOLHAS.length]
  const copa = giro + sorteio(semente, 4) * Math.PI * 2
  const folhas: Folha[] = []
  for (let i = 0; i < quantas; i++) {
    const a = copa + (i * Math.PI * 2) / quantas + (sorteio(semente, 10 + i) - 0.5) * 0.44
    // As que vêm para a frente caem mais; as de trás ficam mais em pé.
    const paraFrente = 0.5 + 0.5 * Math.sin(a)
    folhas.push({
      a,
      comprimento: 0.46 * (0.84 + 0.3 * sorteio(semente, 20 + i)),
      largura: 0.105 + 0.03 * sorteio(semente, 30 + i),
      sobe: 0.2 - 0.07 * paraFrente,
      cai: 0.07 + 0.11 * paraFrente + 0.04 * sorteio(semente, 40 + i),
      seca: false,
    })
  }
  const secas = 1 + (semente % 2)
  for (let i = 0; i < secas; i++) {
    folhas.push({
      a: Math.PI / 2 + (i === 0 ? -0.62 : 0.7) + (sorteio(semente, 50 + i) - 0.5) * 0.3,
      comprimento: 0.26 + 0.06 * sorteio(semente, 52 + i),
      largura: 0.07,
      sobe: -0.02,
      cai: 0.2 + 0.05 * sorteio(semente, 54 + i),
      seca: true,
    })
  }
  // As secas por baixo; depois as de trás; as que vêm para a frente por último.
  for (const f of folhas.filter((f) => f.seca)) desenharFolha(g, olho, f)
  for (const f of folhas.filter((f) => !f.seca).sort((p, q) => Math.sin(p.a) - Math.sin(q.a))) desenharFolha(g, olho, f)

  // O olho da copa: o broto novo, fechado e de pé.
  g.fillStyle = css(FOLHA_ESCURA)
  g.beginPath()
  g.ellipse(olho[0] + 0.006, olho[1] + 0.006, 0.05, 0.036, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(BROTO)
  g.beginPath()
  g.moveTo(olho[0] - 0.022, olho[1])
  g.quadraticCurveTo(olho[0] - 0.014, olho[1] - 0.12, olho[0] + 0.01, olho[1] - 0.15)
  g.quadraticCurveTo(olho[0] + 0.02, olho[1] - 0.07, olho[0] + 0.016, olho[1])
  g.closePath()
  g.fill()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'palmeira-de-selva', nome: 'Palmeira de selva', tamanho: 14, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [TRONCO, TRONCO_SOMBRA, ANEL, RAIZ, RAIZ_SOMBRA, FOLHA_CLARA, FOLHA_MEDIA, FOLHA_ESCURA, NERVURA, BROTO, SECA_CLARA, SECA_ESCURA, PE_NO_CHAO]
