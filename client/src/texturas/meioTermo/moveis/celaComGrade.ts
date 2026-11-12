/**
 * CELA COM GRADE de cima com volume (lote 13 dos objetos novos, 11/11/2026,
 * grupo Templo e masmorra): a jaula de masmorra em que o mestre põe a ficha
 * do prisioneiro. Grade de ferro nos quatro lados, presa em quatro POSTES de
 * canto com CANTONEIRAS rebitadas por cima; na frente (o lado de baixo) a
 * PORTA, entre dois batentes, com duas DOBRADIÇAS grossas à esquerda e o
 * CADEADO pendurado no batente da direita. Dentro, o piso de LAJES de pedra,
 * a PALHA suja num canto do fundo, uma TIGELA de madeira na frente à direita
 * e uma ARGOLA chumbada no chão com um pedaço de CORRENTE. O meio fica livre:
 * é onde a ficha fica.
 *
 * De cima a cela é ABERTA (sem teto de grade): o que se vê é o TRILHO de
 * cima de cada lado, com a cabeça rebitada de cada barra, as cantoneiras, a
 * porta e o cadeado, e a SOMBRA das barras riscando o chão de dentro (as do
 * fundo e as da esquerda caem para dentro, para baixo à direita). É o que diz
 * "cela" vista do alto sem tapar nada do meio.
 *
 * NA 3/4 (derivada) cada barra, poste e batente é uma COLUNA da altura da
 * grade e cada trilho é um TAMPO no alto dela, como a cerca de ferro: a grade
 * do fundo aparece inteira por cima do piso e a da frente passa na frente
 * dele. Cada barra tem uma peça de ferro com o meio nela, para a coluna sair
 * de ferro e não de pedra; a peça do trilho e a dos rebites têm o meio da
 * caixa num vão entre duas barras, para subirem com o trilho e não com a
 * barra. As dobradiças e o cadeado sobem cada um num PINO (ponto sem sombra)
 * na altura deles, fora do batente: saem depois dele e, de costas, antes da
 * grade. As cantoneiras sobem num pino um fio acima do trilho, com a caixa
 * esticada até a frente NA TELA para saírem depois dos trilhos (por isso o
 * desenho lê `c.giro`).
 *
 * A cela MORA NO CHÃO (`ehMovelDoChao`, como o palco de bardo): o que o
 * mestre põe dentro dela (um catre, um balde, um baú) sai por cima do piso; a
 * ficha do prisioneiro está na faixa das fichas, por cima de todo objeto, e a
 * grade da frente nunca a tapa. Sem luz nem chama. Esticada, a cela ganha
 * barras (nunca barra mais grossa) e as nove lajes esticam junto. Materiais:
 * `grade` (o ferro) e `piso` (as lajes). A palha, a madeira da tigela e o
 * rejunte são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, cadeia, caixa, capsula, dentroDe, elipse, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type Cena, type CriarPeca, type MaterialDaPeca, type Peca } from './motor'
import { G, type MontarMovel } from './contexto'
import { elosAoLongo, texDoElo } from './corrente'

/** A cela foi medida no tamanho de partida (2 x 2 casas, 56 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = G

/** A grade: da beira da pegada ao eixo dela (px de partida), a altura (casas) e o espaço entre as barras (casas). */
const MARGEM = 5
const ALTURA_DA_GRADE = 1.15
const ESPACO_DAS_BARRAS = 0.18
/** As grossuras, em px de partida: o raio da barra, o meio trilho, o meio poste de canto, o meio batente e a meia soleira. */
const RAIO_DA_BARRA = 0.95
const MEIO_TRILHO = 1.4
const MEIO_POSTE = 1.9
const MEIO_BATENTE = 1.5
const MEIA_SOLEIRA = 1.45
/** A porta, na frente: a meia largura (casas) e a folga entre o trilho dela e o da parede (px). */
const MEIA_PORTA = 0.36
const FOLGA_DA_PORTA = 1.1
/** As dobradiças e o cadeado, na altura (fração da grade) em que ficam. */
const DOBRADICAS: readonly number[] = [0.2, 0.74]
const ALTURA_DO_CADEADO = 0.44
/** A cantoneira: o comprimento de cada braço e a meia largura (px de partida). */
const BRACO_DA_CANTONEIRA = 6.5
const MEIA_CANTONEIRA = 1.75
const RAIO_DO_REBITE = 0.72
/** O raio do pino (px): só o meio exato da peça cai nele. */
const RAIO_DO_PINO = 0.1

/** As sombras: a de cada barra (fina) e a do poste e do batente, arrastadas do pé à altura; a do trilho, solta no ar. */
const SOMBRA_DA_BARRA = { suave: 1.1, forca: 0.3 } as const
const SOMBRA_DO_POSTE = { suave: 1.2, forca: 0.34 } as const
const SOMBRA_DO_TRILHO = { suave: 2, forca: 0.24, solta: true } as const

/** O ferro: o tom e o brilho de cada parte (o ferro velho; o novo é 0,42). */
const TOM_DO_TRILHO = 0.96
const TOM_DO_POSTE = 1.04
const TOM_DO_REBITE = 1.3
const BRILHO_DO_FERRO = 0.32
/** O escuro em que o pixel escuro demais é levantado: o cinza quente do ferro (o piso padrão é a nogueira). */
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]

/** O piso: as linhas das lajes (frações da largura, uma lista por fileira) e as fileiras (frações da altura). */
const FILEIRAS: readonly number[] = [0, 0.34, 0.67, 1]
const JUNTAS: readonly (readonly number[])[] = [
  [0, 0.38, 0.71, 1],
  [0, 0.27, 0.62, 1],
  [0, 0.41, 0.76, 1],
]
const MEIA_JUNTA = 0.6
const REJUNTE: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x4f, 0x48] }
/**
 * A palha suja, num canto do fundo: o meio (fração da meia grade), os raios (px de partida) e quantas palhas.
 * O monte é o fundo escuro (a palha amassada) e as palhas soltas, em três tons, por cima e em volta (a trama
 * da classe `palha` lia como esteira).
 */
const PALHA = { x: -0.5, y: -0.44, rx: 15, ry: 12 } as const
const PALHAS = 78
const MONTE_DE_PALHA: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x5e, 0x42] }
const TONS_DA_PALHA: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0xb8, 0xa0, 0x68] },
  { classe: 'liso', rgb: [0x9a, 0x84, 0x58] },
  { classe: 'liso', rgb: [0x7a, 0x68, 0x48] },
]
/** A tigela de madeira com o resto do mingau, na frente à direita. */
const TIGELA = { x: 0.55, y: 0.48, raio: 6.4 } as const
const MADEIRA_DA_TIGELA: MaterialDaPeca = { classe: 'madeira', rgb: [0x7c, 0x5c, 0x42] }
const MINGAU: MaterialDaPeca = { classe: 'liso', rgb: [0xb0, 0xa2, 0x80] }
/** O que as peças do chão de dentro projetam nas lajes (a sombra de contato fica por baixo delas e não aparece). */
const FORCA_DA_PROJECAO = 0.34
/**
 * As sombras pintadas no piso de dentro (a sombra no chão do mapa fica por baixo das lajes): a cor, o alfa da
 * barra, do poste e do trilho, e o lado de dentro de cada trecho (na ordem de `trechos`).
 */
const COR_DA_SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [14, 11, 8] }
const ALFA_DA_SOMBRA_DA_BARRA = 0.3
const ALFA_DA_SOMBRA_DO_POSTE = 0.34
const ALFA_DA_SOMBRA_DO_TRILHO = 0.24
const PARA_DENTRO: readonly Ponto[] = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, -1],
  [0, -1],
]
/** A argola chumbada no chão do fundo, à direita, e o fim do pedaço de corrente (frações da meia grade). */
const ARGOLA = { x: 0.52, y: -0.68, raio: 3.3, arame: 1.15 } as const
const FIM_DA_CORRENTE: readonly Ponto[] = [
  [0.4, -0.5],
  [0.3, -0.32],
]
const PASSO_DA_CORRENTE = 3.8
/** Os quatro cantos, em sinais de x e y. */
const CANTOS: readonly Ponto[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]

/** Os quartos de volta do giro que a 3/4 pinta (0 fora dela). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** A direção do desenho que cai em (x, y) NA TELA depois do quarto de volta (o avesso do giro de `girarCena`). */
function doDesenho(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** A mesma forma com a caixa de pintura centrada em (mx, my): a 3/4 lê o meio da caixa para saber com que estrutura a peça sobe. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** A mesma forma com a caixa esticada até `ate` px do centro, do lado que fica embaixo NA TELA: sai depois das outras estruturas. */
function esticadaParaAFrente(forma: Forma, ate: number, quartos: number): Forma {
  const [dx, dy] = doDesenho(0, 1, quartos)
  const [x0, y0, x1, y1] = forma.b
  const b: Caixa =
    dx > 0.5 ? [x0, y0, Math.max(x1, ate), y1] : dx < -0.5 ? [Math.min(x0, -ate), y0, x1, y1] : dy > 0.5 ? [x0, y0, x1, Math.max(y1, ate)] : [x0, Math.min(y0, -ate), x1, y1]
  return { b, d: forma.d }
}

/** Um PINO em (x, y): a estrutura da 3/4 do tamanho de um ponto. */
function pino(x: number, y: number): Forma {
  return { b: [x - RAIO_DO_PINO, y - RAIO_DO_PINO, x + RAIO_DO_PINO, y + RAIO_DO_PINO], d: (px, py) => Math.hypot(px - x, py - y) - RAIO_DO_PINO }
}

/** Os pontos entre `a` e `b` (sem as pontas) a cada `espaco` mais ou menos, para as barras de um trecho. */
function entre(a: number, b: number, espaco: number): number[] {
  const n = Math.max(1, Math.round((b - a) / espaco))
  return Array.from({ length: n - 1 }, (_, i) => a + ((i + 1) * (b - a)) / n)
}

/** Os rebites numa forma só: uma cabeça redonda de raio `r` em cada ponto. */
function rebites(pontos: readonly Ponto[], r: number): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pontos) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return {
    b: [x0 - r, y0 - r, x1 + r, y1 + r],
    d(x, y) {
      let menor = Infinity
      for (const [px, py] of pontos) {
        const dd = (x - px) * (x - px) + (y - py) * (y - py)
        if (dd < menor) menor = dd
      }
      return Math.sqrt(menor) - r
    },
  }
}

/** Um trecho de grade: as pontas do eixo e as barras dele. O trilho e os rebites sobem pelo vão entre a ponta e a primeira barra. */
interface Trecho {
  readonly a: Ponto
  readonly b: Ponto
  readonly barras: readonly Ponto[]
}

function trecho(a: Ponto, b: Ponto, espaco: number): Trecho {
  const horizontal = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1])
  const barras = horizontal ? entre(a[0], b[0], espaco).map((x): Ponto => [x, a[1]]) : entre(a[1], b[1], espaco).map((y): Ponto => [a[0], y])
  return { a, b, barras }
}

/** O ponto do eixo do trecho no vão entre a ponta e a primeira barra (o meio do trecho, se não há barra). */
function vaoDoTrecho(t: Trecho): Ponto {
  const alvo = t.barras.length > 0 ? t.barras[0] : t.b
  return [(t.a[0] + alvo[0]) / 2, (t.a[1] + alvo[1]) / 2]
}

/** Empurra a sombra de contato de uma peça do chão. */
type Sombrear = (f: Forma, forca: number) => void

/** O piso de dentro: o rejunte e as lajes de pedra, cada uma no seu tom. */
function montarPiso(P: CriarPeca, piso: MaterialDaPeca, X: number, Y: number, k: number, L: Peca[]): void {
  L.push(P(caixa(-X, -Y, X, Y, 0), REJUNTE, { tabua: 0, bisel: 0, contorno: 0.1, semente: 13400 }))
  const junta = MEIA_JUNTA * k
  for (let f = 0; f < FILEIRAS.length - 1; f += 1) {
    const ya = -Y + 2 * Y * FILEIRAS[f]
    const yb = -Y + 2 * Y * FILEIRAS[f + 1]
    const linhas = JUNTAS[f % JUNTAS.length]
    for (let j = 0; j < linhas.length - 1; j += 1) {
      const xa = -X + 2 * X * linhas[j]
      const xb = -X + 2 * X * linhas[j + 1]
      L.push(P(caixa(xa + junta, ya + junta, xb - junta, yb - junta, 1.4 * k), piso, { tabua: 0, bisel: 1.5 * k, tom: 0.7 + 0.16 * hash(f, j, 1341), contorno: 0.16, semente: 13401 + f * 4 + j }))
    }
  }
}

/** A palha suja num canto do fundo: o monte amassado e as palhas soltas por cima e em volta, em três tons. */
function montarPalha(P: CriarPeca, X: number, Y: number, k: number, L: Peca[]): void {
  const cx = PALHA.x * X
  const cy = PALHA.y * Y
  const monte = poligono(
    Array.from({ length: 13 }, (_, i): Ponto => {
      const a = (i / 13) * Math.PI * 2
      const r = 0.72 + 0.3 * hash(i, 5, 1342)
      return [cx + Math.cos(a) * PALHA.rx * k * r, cy + Math.sin(a) * PALHA.ry * k * r]
    }),
  )
  L.push(P(monte, MONTE_DE_PALHA, { tabua: 0, bisel: 2.4 * k, tom: 0.92, contorno: 0.12, suave: 1.2 * k, projeta: { dist: 1.4 * k, forca: FORCA_DA_PROJECAO }, semente: 13420 }))
  for (let i = 0; i < PALHAS; i += 1) {
    const a = hash(i, 1, 1343) * Math.PI * 2
    const d = Math.sqrt(hash(i, 2, 1343)) * 1.15
    const x = cx + Math.cos(a) * d * PALHA.rx * k
    const y = cy + Math.sin(a) * d * PALHA.ry * k
    const giro = hash(i, 3, 1343) * Math.PI
    const meio = (1.6 + 2.2 * hash(i, 4, 1343)) * k
    const palha = capsula(x - Math.cos(giro) * meio, y - Math.sin(giro) * meio, x + Math.cos(giro) * meio, y + Math.sin(giro) * meio, 0.36 * k)
    // As de fora do monte são mais escuras (pisadas no chão); as de cima, mais claras.
    const cor = TONS_DA_PALHA[d > 0.85 ? 2 : hash(i, 5, 1343) < 0.55 ? 0 : 1]
    L.push(P(palha, cor, { tabua: 0, bisel: 0.36 * k, tom: 0.9 + 0.22 * hash(i, 6, 1343), contorno: 0.24, semente: 13421 + i }))
  }
}

/** A tigela de madeira com o resto do mingau, na frente à direita. */
function montarTigela(P: CriarPeca, X: number, Y: number, k: number, L: Peca[]): void {
  const cx = TIGELA.x * X
  const cy = TIGELA.y * Y
  const r = TIGELA.raio * k
  L.push(P(elipse(cx, cy, r, r), MADEIRA_DA_TIGELA, { tabua: 0, bisel: 1.2 * k, tom: 0.72, contorno: 0.28, recesso: { k: 2.4 * k, forca: 0.5 }, projeta: { dist: 1.3 * k, forca: FORCA_DA_PROJECAO }, semente: 13440 }))
  L.push(P(elipse(cx + 0.6 * k, cy + 0.9 * k, r * 0.5, r * 0.44), MINGAU, { tabua: 0, bisel: 0.9 * k, tom: 0.92, contorno: 0, alfa: 0.92, semente: 13441 }))
  L.push(P(anel(cx, cy, r, r, r * 0.78, r * 0.78), MADEIRA_DA_TIGELA, { tabua: 0, bisel: 0.9 * k, tom: 1.05, contorno: 0.28, semente: 13442 }))
}

/** A forma andada (dx, dy): a sombra do trilho, pintada no piso já longe dele. */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/**
 * A sombra que a grade deixa no piso de dentro, pintada por cima das lajes (a do chão do mapa fica por baixo
 * delas): a de cada barra das paredes cuja sombra cai para dentro, a dos postes e a dos trilhos dessas paredes,
 * recortadas no piso. A direção é a da tela (`c.giro`): o sol não gira com a cela.
 */
function montarSombraNoPiso(P: CriarPeca, trechos: readonly Trecho[], trilhos: readonly Forma[], colunas: readonly (readonly [number, number, number])[], X: number, Y: number, altura: number, rb: number, quartos: number, L: Peca[]): void {
  const [sx, sy] = doDesenho(SOMBRA_X * altura, SOMBRA_Y * altura, quartos)
  const piso = caixa(-X, -Y, X, Y, 0)
  const pintar = (forma: Forma, alfa: number, suave: number, semente: number): void => {
    const f = dentroDe(forma, piso)
    if (f.b[2] - f.b[0] < 0.5 || f.b[3] - f.b[1] < 0.5) return
    L.push(P(f, COR_DA_SOMBRA, { bisel: 0, contorno: 0, alfa, suave, semente }))
  }
  trechos.forEach((t, i) => {
    const [nx, ny] = PARA_DENTRO[i]
    if (nx * sx + ny * sy <= 0) return
    t.barras.forEach(([x, y], j) => pintar(capsula(x, y, x + sx, y + sy, rb * 1.1), ALFA_DA_SOMBRA_DA_BARRA, 1.1, 13800 + i * 40 + j))
    pintar(deslocada(trilhos[i], sx, sy), ALFA_DA_SOMBRA_DO_TRILHO, 2, 13790 + i)
  })
  colunas.forEach(([x, y, m], i) => {
    if (Math.abs(x + sx * 0.5) >= X || Math.abs(y + sy * 0.5) >= Y) return
    pintar(capsula(x, y, x + sx, y + sy, m), ALFA_DA_SOMBRA_DO_POSTE, 1.2, 13780 + i)
  })
}

/** A argola chumbada no chão do fundo e o pedaço de corrente largado dela para o meio. */
function montarArgola(P: CriarPeca, ferro: MaterialDaPeca, X: number, Y: number, k: number, L: Peca[]): void {
  const cx = ARGOLA.x * X
  const cy = ARGOLA.y * Y
  const placa = caixa(cx - 3.1 * k, cy - 3.1 * k, cx + 3.1 * k, cy + 3.1 * k, 0.8 * k)
  L.push(P(placa, ferro, { tabua: 0, bisel: 1 * k, tom: 0.84, metal: BRILHO_DO_FERRO, contorno: 0.28, projeta: { dist: 0.7 * k, forca: FORCA_DA_PROJECAO }, semente: 13450 }))
  const caminho = FIM_DA_CORRENTE.map(([fx, fy]): Ponto => [fx * X, fy * Y])
  const ox = caminho[0][0] - cx
  const oy = caminho[0][1] - cy
  const n = Math.hypot(ox, oy) || 1
  const r = ARGOLA.raio * k
  const ax = cx + (ox / n) * (r - 0.6 * k)
  const ay = cy + (oy / n) * (r - 0.6 * k)
  const argola = anel(ax, ay, r, r, r - ARGOLA.arame * k, r - ARGOLA.arame * k)
  L.push(P(argola, ferro, { tabua: 0, bisel: ARGOLA.arame * k * 0.55, tom: 1.02, metal: 0.45, contorno: 0.3, projeta: { dist: 0.8 * k, forca: FORCA_DA_PROJECAO }, semente: 13451 }))
  const inicio: Ponto = [ax + (ox / n) * (r - 0.5 * k), ay + (oy / n) * (r - 0.5 * k)]
  const elos = elosAoLongo([inicio, ...caminho], PASSO_DA_CORRENTE * k, false)
  // Os deitados primeiro: os em pé entram no furo deles e passam por cima.
  const naOrdem = [...elos.filter((e) => e.deitado), ...elos.filter((e) => !e.deitado)]
  naOrdem.forEach((e, i) => {
    L.push(P(e.forma, ferro, { tabua: 0, bisel: e.meio * 0.13, tom: e.deitado ? 0.98 : 1.08, metal: 0.45, contorno: 0.3, textura: texDoElo(e, 0.75), projeta: { dist: 0.8 * k, forca: FORCA_DA_PROJECAO }, semente: 13452 + i }))
  })
  const grampo = capsula(cx - (oy / n) * 1.6 * k, cy + (ox / n) * 1.6 * k, cx + (oy / n) * 1.6 * k, cy - (ox / n) * 1.6 * k, 0.75 * k)
  L.push(P(grampo, ferro, { tabua: 0, bisel: 0.75 * k, tom: 1.12, metal: 0.45, contorno: 0.3, semente: 13470 }))
}

/** As dobradiças da porta (no batente da esquerda) e o cadeado (no da direita), cada peça no pino da altura dela. */
function montarFerragemDaPorta(P: CriarPeca, ferro: MaterialDaPeca, porta: number, Y: number, altura: number, k: number, L: Peca[], sombras: Cena['sombras']): void {
  DOBRADICAS.forEach((fz, i) => {
    const px = -porta + (1.4 + 0.6 * i) * k
    const py = Y + 1.75 * k
    sombras.push({ forma: pino(px, py), z: altura * fz, solta: true, forca: 0 })
    const folha = caixa(-porta - 0.4 * k, Y + 1.3 * k, -porta + 7 * k, Y + 2.4 * k, 0.3 * k)
    const junta = elipse(-porta - 0.8 * k, Y + 2 * k, 1.45 * k, 1.45 * k)
    L.push(P(comMeioEm(folha, px, py), ferro, { tabua: 0, bisel: 0.45 * k, tom: 0.94, metal: BRILHO_DO_FERRO, contorno: 0.28, semente: 13480 + i * 2 }))
    L.push(P(comMeioEm(junta, px, py), ferro, { tabua: 0, bisel: 1.1 * k, tom: 1.16, metal: 0.45, contorno: 0.28, semente: 13481 + i * 2 }))
  })
  const qx = porta + 0.2 * k
  const qy = Y + 3.2 * k
  sombras.push({ forma: pino(qx, qy), z: altura * ALTURA_DO_CADEADO, solta: true, forca: 0 })
  const ferrolho = caixa(porta - 1.7 * k, Y + 1.15 * k, porta + 1.7 * k, Y + 2 * k, 0.3 * k)
  const alca = cadeia(
    [
      [porta - 0.95 * k, Y + 2.5 * k],
      [porta - 0.95 * k, Y + 1.6 * k],
      [porta, Y + 1.15 * k],
      [porta + 0.95 * k, Y + 1.6 * k],
      [porta + 0.95 * k, Y + 2.5 * k],
    ],
    0.42 * k,
  )
  const corpo = caixa(porta - 2 * k, Y + 2.3 * k, porta + 2 * k, Y + 4.8 * k, 0.75 * k)
  const buraco = uniao(elipse(porta, Y + 3.3 * k, 0.5 * k, 0.5 * k), capsula(porta, Y + 3.3 * k, porta, Y + 4.2 * k, 0.24 * k))
  L.push(P(comMeioEm(ferrolho, qx, qy), ferro, { tabua: 0, bisel: 0.4 * k, tom: 0.9, metal: BRILHO_DO_FERRO, contorno: 0.28, semente: 13490 }))
  L.push(P(comMeioEm(alca, qx, qy), ferro, { tabua: 0, bisel: 0.42 * k, tom: 1.2, metal: 0.5, contorno: 0.26, semente: 13491 }))
  L.push(P(comMeioEm(corpo, qx, qy), ferro, { tabua: 0, bisel: 1 * k, tom: 0.88, metal: 0.4, contorno: 0.3, semente: 13492 }))
  L.push(P(comMeioEm(buraco, qx, qy), REJUNTE, { tabua: 0, bisel: 0, tom: 0.6, contorno: 0, semente: 13493 }))
}

export const montarCelaComGrade: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / MEIO_LADO_DE_PARTIDA
  const ferro = c.m.grade
  const quartos = quartosDoGiro(c.giro)
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const X = hw - MARGEM * k
  const Y = hh - MARGEM * k
  const altura = ALTURA_DA_GRADE * G * k
  const espaco = ESPACO_DAS_BARRAS * G * k
  const porta = MEIA_PORTA * G * k
  const folga = FOLGA_DA_PORTA * k
  const sombra: Sombrear = (f, forca) => {
    cena.sombras.push(contato(f, forca))
  }

  // ---------- a grade: os trechos com as barras, as colunas (postes e batentes) e os trilhos de cima ----------
  const trechos: readonly Trecho[] = [
    trecho([-X, -Y], [X, -Y], espaco),
    trecho([-X, -Y], [-X, Y], espaco),
    trecho([X, -Y], [X, Y], espaco),
    trecho([-X, Y], [-porta, Y], espaco),
    trecho([-porta, Y], [porta, Y], espaco),
    trecho([porta, Y], [X, Y], espaco),
  ]
  const rb = Math.max(0.6, RAIO_DA_BARRA * k)
  const mp = MEIO_POSTE * k
  const mb = MEIO_BATENTE * k
  const colunas: readonly (readonly [number, number, number])[] = [...CANTOS.map(([sx, sy]): readonly [number, number, number] => [sx * X, sy * Y, mp]), [-porta, Y, mb], [porta, Y, mb]]
  const mt = MEIO_TRILHO * k
  const trilhos: readonly Forma[] = [
    caixa(-X - mt, -Y - mt, X + mt, -Y + mt, 0.4 * k),
    caixa(-X - mt, -Y - mt, -X + mt, Y + mt, 0.4 * k),
    caixa(X - mt, -Y - mt, X + mt, Y + mt, 0.4 * k),
    caixa(-X - mt, Y - mt, -porta - folga, Y + mt, 0.4 * k),
    caixa(-porta + folga, Y - mt, porta - folga, Y + mt, 0.4 * k),
    caixa(porta + folga, Y - mt, X + mt, Y + mt, 0.4 * k),
  ]

  // ---------- dentro, no chão: as lajes, a palha, a tigela, a argola com a corrente e a sombra da grade ----------
  montarPiso(P, c.m.piso, X, Y, k, L)
  montarPalha(P, X, Y, k, L)
  montarTigela(P, X, Y, k, L)
  montarArgola(P, ferro, X, Y, k, L)
  montarSombraNoPiso(P, trechos, trilhos, colunas, X, Y, altura, rb, quartos, L)

  // ---------- as soleiras: o ferro no chão em que as barras entram (o meio fora de toda coluna: ficam no chão) ----------
  const ms = MEIA_SOLEIRA * k
  const fora = MEIO_TRILHO * k + 0.15 * k
  const soleiras: readonly (readonly [Forma, number, number])[] = [
    [caixa(-X - ms, -Y - ms, X + ms, -Y + ms, 0.3 * k), 0, -Y - fora],
    [caixa(-X - ms, -Y - ms, -X + ms, Y + ms, 0.3 * k), -X - fora, 0],
    [caixa(X - ms, -Y - ms, X + ms, Y + ms, 0.3 * k), X + fora, 0],
    [caixa(-X - ms, Y - ms, X + ms, Y + ms, 0.3 * k), 0, Y + fora],
  ]
  soleiras.forEach(([forma, mx, my], i) => {
    sombra(forma, 0.26)
    L.push(P(comMeioEm(forma, mx, my), ferro, { tabua: 0, bisel: 0.7 * k, tom: 0.78, metal: 0.25, contorno: 0.26, semente: 13410 + i }))
  })

  // ---------- as barras, os postes de canto e os batentes da porta: colunas da altura da grade ----------
  trechos.forEach((t, ti) => {
    t.barras.forEach(([x, y], i) => {
      const barra = elipse(x, y, rb, rb)
      cena.sombras.push({ forma: barra, z: altura, ...SOMBRA_DA_BARRA })
      L.push(P(barra, ferro, { tabua: 0, bisel: rb, tom: TOM_DO_POSTE, metal: BRILHO_DO_FERRO, contorno: 0.24, semente: 13500 + ti * 40 + i }))
    })
  })
  colunas.forEach(([x, y, m], i) => {
    const coluna = caixa(x - m, y - m, x + m, y + m, 0.5 * k)
    cena.sombras.push({ forma: coluna, z: altura, ...SOMBRA_DO_POSTE })
    L.push(P(coluna, ferro, { tabua: 0, bisel: m * 0.8, tom: TOM_DO_POSTE, metal: BRILHO_DO_FERRO, contorno: 0.28, semente: 13600 + i }))
  })

  // ---------- os trilhos de cima (tampos da 3/4) com a cabeça rebitada de cada barra; a porta tem o dela, com folga ----------
  trilhos.forEach((forma, i) => {
    const t = trechos[i]
    const [vx, vy] = vaoDoTrecho(t)
    cena.sombras.push({ forma, z: altura, ...SOMBRA_DO_TRILHO })
    L.push(P(comMeioEm(forma, vx, vy), ferro, { tabua: 0, bisel: mt * 0.9, tom: TOM_DO_TRILHO, metal: BRILHO_DO_FERRO, contorno: 0.3, semente: 13620 + i }))
    if (t.barras.length > 0) {
      L.push(P(comMeioEm(rebites(t.barras, RAIO_DO_REBITE * k), vx, vy), ferro, { tabua: 0, bisel: RAIO_DO_REBITE * k, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.22, semente: 13630 + i }))
    }
  })

  // ---------- a porta: as dobradiças e o cadeado ----------
  montarFerragemDaPorta(P, ferro, porta, Y, altura, k, L, cena.sombras)

  // ---------- as cantoneiras rebitadas, um fio acima dos trilhos, saindo depois deles na 3/4 ----------
  const bc = BRACO_DA_CANTONEIRA * k
  const mc = MEIA_CANTONEIRA * k
  const ate = Math.max(hw, hh) + 2
  CANTOS.forEach(([sx, sy], i) => {
    const cx = sx * X
    const cy = sy * Y
    const x0 = Math.min(cx + sx * mc, cx - sx * bc)
    const x1 = Math.max(cx + sx * mc, cx - sx * bc)
    const y0 = Math.min(cy + sy * mc, cy - sy * bc)
    const y1 = Math.max(cy + sy * mc, cy - sy * bc)
    const cantoneira = uniao(caixa(x0, cy - mc, x1, cy + mc, 0.5 * k), caixa(cx - mc, y0, cx + mc, y1, 0.5 * k))
    const pregos = rebites(
      [
        [cx, cy],
        [cx - sx * (bc - 1.6 * k), cy],
        [cx, cy - sy * (bc - 1.6 * k)],
      ],
      RAIO_DO_REBITE * k,
    )
    cena.sombras.push({ forma: esticadaParaAFrente(pino(cx, cy), ate, quartos), z: altura + 0.6 * k, solta: true, forca: 0 })
    L.push(P(comMeioEm(cantoneira, cx, cy), ferro, { tabua: 0, bisel: 0.9 * k, tom: 0.92, metal: BRILHO_DO_FERRO, contorno: 0.3, projeta: { dist: 0.8 * k, forca: 0.3 }, semente: 13700 + i * 2 }))
    L.push(P(comMeioEm(pregos, cx, cy), ferro, { tabua: 0, bisel: RAIO_DO_REBITE * k, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.22, semente: 13701 + i * 2 }))
  })
}
