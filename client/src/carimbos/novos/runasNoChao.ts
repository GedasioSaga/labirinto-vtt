import { css, type DefinicaoDeCarimbo, type DesenhoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Runas no chão (lote L02 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; temas Dungeons,
 * Cripta e Templo): o círculo de runas ENTALHADO na pedra do chão. Dois anéis de sulco, oito runas entre eles, um
 * triângulo dentro do anel de dentro e o olho no meio. Vista de cima e um pouco de frente, como as pedras: o chão
 * achata o círculo na vertical. O sulco é o escuro frio da pedra cortada e a beira de baixo à direita dele pega a luz
 * (a parede do corte virada para a luz de cima à esquerda). Os anéis e uma das runas estão GASTOS (falhas onde o chão
 * foi pisado por séculos). As runas são riscos retos de uma a quatro hastes, desenho original, e a semente troca quais
 * saem, onde ficam as falhas e o giro do triângulo.
 *
 * DOIS desenhos no mesmo quadro e no mesmo giro, como a Fenda em brasa: `desenhar` é o círculo APAGADO; `brilho` é
 * SÓ o que acende, os mesmos riscos na borda e no miolo da chama AZUL do app (`TONS_DA_CHAMA.azul`, o fogo-fátuo,
 * `lib/mobilia/corDaChama.ts`), somado por cima e pulsando. É do chão (`sombra: 'nenhuma'`). O giro gira o círculo
 * inteiro no chão; a luz não gira.
 *
 * Os anéis são linhas de poucos pontos (e não `ellipse`), e o apagado tem só duas passadas: na primeira folha, com o
 * fio do fundo numa terceira e os anéis em `ellipse`, os 8 desenhos levavam 906 ms no software (teto 500), e as runas,
 * miúdas demais para o anel, liam risquinhos.
 */

/** O sulco: a pedra cortada, de costas para a luz. */
const SULCO: Rgb = [44, 46, 54]
/** A beira do corte que pega a luz (meio transparente, para servir em qualquer chão). */
const LABIO: Rgb = [206, 200, 188]
/** A mancha do chão gasto dentro do círculo. */
const MANCHA: Rgb = [38, 40, 46]
/** O que acende: a borda e o miolo da chama azul do app (`0x2f5a8a` e `0xbcdcec`). Só no `brilho`, fora da paleta. */
const BORDA_AZUL: Rgb = [47, 90, 138]
const MIOLO_AZUL: Rgb = [188, 220, 236]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.58
/** O meio do círculo no quadro: o anel de fora fica entre y -0,46 e 0,26 (o quadro vai até 0,3). */
const MEIO_Y = -0.1
/** Os raios no chão (unidades): os dois anéis, a roda das runas, o triângulo e o olho do meio. */
const RAIO = { fora: 0.62, dentro: 0.4, runas: 0.51, triangulo: 0.355, olho: 0.09, pupila: 0.026 } as const
/** Meia largura (ao longo do anel) e meia altura (para fora) de cada runa, no chão. */
const RUNA = { meiaLargura: 0.056, meiaAltura: 0.074 } as const
/** As grossuras dos traços (unidades da tela). */
const LARGURA = { sulco: 0.024, labio: 0.022, borda: 0.036, miolo: 0.012 } as const
/** Para onde a beira clara aparece: um tanto para baixo à direita do sulco. */
const LUZ_DO_LABIO = { x: 0.006, y: 0.008 } as const
const ALFA = { labio: 0.5, mancha: 0.1, borda: 0.85 } as const
/** Quantas runas, quantas falhas em cada anel e quantos pontos um anel inteiro tem. */
const RUNAS_NA_RODA = 8
const FALHAS = { fora: 2, dentro: 1 } as const
const PONTOS_NA_VOLTA = 28

type P = readonly [number, number]
type Traco = readonly P[]

/**
 * As runas: cada uma é uma lista de traços em (u, v), u ao longo do anel e v para fora, de -1 a 1. Riscos retos de
 * uma a quatro hastes, como se cortados a cinzel.
 */
const RUNAS: readonly (readonly Traco[])[] = [
  [[[0, -1], [0, 1]], [[0, 0.2], [0.7, 0.9]], [[0, -0.4], [0.7, 0.3]]],
  [[[0, -1], [0, 1]], [[-0.6, 0.4], [0, 1], [0.6, 0.4]]],
  [[[0, 1], [0.55, 0.2], [0, -0.6], [-0.55, 0.2], [0, 1]], [[0, -0.6], [0, -1]]],
  [[[-0.5, -1], [-0.5, 1]], [[0.5, -1], [0.5, 1]], [[-0.5, 0.6], [0.5, -0.2]]],
  [[[-0.6, 1], [0.4, 0.35], [-0.4, -0.3], [0.6, -1]]],
  [[[0, -1], [0, 1]], [[-0.6, 0.5], [0.6, -0.1]], [[-0.6, -0.1], [0.6, 0.5]]],
  [[[-0.6, -1], [0, 1], [0.6, -1]], [[-0.3, -0.1], [0.3, -0.1]]],
  [[[0, -1], [0, 1]], [[0, 1], [0.6, 0.6], [0.6, 0.15], [0, -0.1]]],
  [[[-0.6, 0], [0, 0.75], [0.6, 0], [0, -0.75], [-0.6, 0]], [[0, 0.25], [0, -0.25]]],
  [[[0, -1], [0, 1]], [[0, 0.8], [-0.5, 0.45]], [[0, 0.2], [0.5, -0.15]], [[0, -0.4], [-0.5, -0.75]]],
]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Do chão (x, y) para a tela: o giro já vem nos ângulos; aqui só achata. */
function naTela(x: number, y: number): P {
  return [x, MEIO_Y + y * ACHATA]
}

/** Um arco de anel no chão, de `de` a `ate` (radianos, já com o giro), em pontos. */
function arco(r: number, de: number, ate: number): P[] {
  const passos = Math.max(3, Math.ceil(((ate - de) / (Math.PI * 2)) * PONTOS_NA_VOLTA))
  const pontos: P[] = []
  for (let i = 0; i <= passos; i += 1) {
    const a = de + ((ate - de) * i) / passos
    pontos.push(naTela(Math.cos(a) * r, Math.sin(a) * r))
  }
  return pontos
}

/** Os arcos de um anel com `falhas` trechos gastos, cada um num lugar e de um tamanho. */
function anelGasto(r: number, falhas: number, giro: number, semente: number, canal: number): P[][] {
  const inicio = sorteio(semente, canal) * Math.PI * 2 + giro
  const passo = (Math.PI * 2) / falhas
  const arcos: P[][] = []
  for (let i = 0; i < falhas; i += 1) {
    const buraco = 0.1 + 0.1 * sorteio(semente, canal + 1 + i)
    arcos.push(arco(r, inicio + passo * i + buraco, inicio + passo * (i + 1)))
  }
  return arcos
}

/** Todos os sulcos, na tela: as runas, o triângulo e os anéis. */
function sulcosDe(giro: number, semente: number): Traco[] {
  const linhas: Traco[] = []
  // As runas da roda: a semente escolhe quais (nunca a mesma lado a lado) e qual delas está gasta.
  const gasta = Math.floor(sorteio(semente, 20) * RUNAS_NA_RODA)
  let anterior = -1
  for (let i = 0; i < RUNAS_NA_RODA; i += 1) {
    let qual = Math.floor(sorteio(semente, 30 + i) * RUNAS.length)
    if (qual === anterior) qual = (qual + 1) % RUNAS.length
    anterior = qual
    const angulo = (i / RUNAS_NA_RODA) * Math.PI * 2 + giro
    const cos = Math.cos(angulo)
    const sen = Math.sin(angulo)
    const tracos = i === gasta ? RUNAS[qual].slice(0, 1) : RUNAS[qual]
    for (const traco of tracos) {
      linhas.push(traco.map(([u, v]): P => {
        const rho = RAIO.runas + v * RUNA.meiaAltura
        const tau = u * RUNA.meiaLargura
        return naTela(rho * cos - tau * sen, rho * sen + tau * cos)
      }))
    }
  }
  // O triângulo de dentro, girado pela semente.
  const giroDoTriangulo = sorteio(semente, 40) * Math.PI * 2 + giro
  const triangulo: P[] = []
  for (let k = 0; k <= 3; k += 1) {
    const a = giroDoTriangulo + (k * Math.PI * 2) / 3
    triangulo.push(naTela(Math.cos(a) * RAIO.triangulo, Math.sin(a) * RAIO.triangulo))
  }
  linhas.push(triangulo)
  linhas.push(...anelGasto(RAIO.fora, FALHAS.fora, giro, semente, 50))
  linhas.push(...anelGasto(RAIO.dentro, FALHAS.dentro, giro, semente, 60))
  linhas.push(arco(RAIO.olho, 0, Math.PI * 2))
  return linhas
}

/** Todos os sulcos num caminho só, deslocados por (dx, dy) na tela, num traço de `largura` e `cor`. */
function tracarSulcos(g: CanvasRenderingContext2D, linhas: readonly Traco[], largura: number, cor: string, dx = 0, dy = 0): void {
  g.strokeStyle = cor
  g.lineWidth = largura
  g.beginPath()
  for (const linha of linhas) {
    linha.forEach(([x, y], i) => {
      if (i === 0) g.moveTo(x + dx, y + dy)
      else g.lineTo(x + dx, y + dy)
    })
  }
  g.stroke()
}

function pupila(g: CanvasRenderingContext2D, cor: string, raio: number): void {
  g.fillStyle = cor
  g.beginPath()
  g.ellipse(0, MEIO_Y, raio, raio * ACHATA, 0, 0, Math.PI * 2)
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const linhas = sulcosDe(giro, semente)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  // A mancha do chão gasto, por baixo de tudo.
  g.fillStyle = css(MANCHA, ALFA.mancha)
  g.beginPath()
  g.ellipse(0, MEIO_Y, RAIO.fora + 0.04, (RAIO.fora + 0.04) * ACHATA, 0, 0, Math.PI * 2)
  g.fill()
  // A beira clara e o sulco por cima dela.
  tracarSulcos(g, linhas, LARGURA.labio, css(LABIO, ALFA.labio), LUZ_DO_LABIO.x, LUZ_DO_LABIO.y)
  tracarSulcos(g, linhas, LARGURA.sulco, css(SULCO))
  pupila(g, css(SULCO), RAIO.pupila)
}

/** Só o que acende: os mesmos sulcos na borda azul e o miolo claro por dentro, e a pupila. Nada fora dos riscos. */
const desenharBrilho: DesenhoDeCarimbo = (g, giro, semente) => {
  const linhas = sulcosDe(giro, semente)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  tracarSulcos(g, linhas, LARGURA.borda, css(BORDA_AZUL, ALFA.borda))
  tracarSulcos(g, linhas, LARGURA.miolo, css(MIOLO_AZUL))
  pupila(g, css(MIOLO_AZUL), RAIO.pupila)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'runas-no-chao', nome: 'Runas no chão', tamanho: 10, sombra: 'nenhuma', desenhar }

export const brilho: DesenhoDeCarimbo = desenharBrilho

/** Todas as cores chapadas do desenho (as do `brilho` ficam fora, como pede o briefing dos carimbos). */
export const paleta: readonly Rgb[] = [SULCO, LABIO, MANCHA]
