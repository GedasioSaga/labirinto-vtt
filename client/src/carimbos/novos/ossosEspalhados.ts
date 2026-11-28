import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Ossos espalhados (lote L02 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; temas
 * Dungeons, Cripta e Caverna): o que sobrou de alguém no chão da masmorra. O crânio de cara para o céu num lado, dois
 * ossos compridos cruzados (um deles partido, com o tutano à mostra), um pedaço de costelas ainda na ordem, duas
 * vértebras e uns ossinhos miúdos em volta; às vezes a mandíbula solta. Visto de cima e um pouco de frente, como as
 * pedras: o chão achata o desenho
 * na vertical. O osso é o mesmo branco-acinzentado desbotado do Crânio de boi (não amarelo, para não sumir na areia), e
 * o volume, as mesmas camadas chapadas dele: a do osso na sombra por baixo, a da luz por cima puxada para cima à
 * esquerda, um brilho miúdo nas cabeças e o fundo escuro do tutano e dos furos. A semente troca o arranjo e qual osso
 * está partido. O giro gira tudo no chão; a luz não gira.
 */

const OSSO_SOMBRA: Rgb = [166, 158, 142]
const OSSO: Rgb = [214, 208, 190]
const OSSO_CLARO: Rgb = [234, 230, 216]
const BURACO: Rgb = [84, 74, 62]

/** O chão visto de cima e um pouco de frente (o do Crânio de boi). */
const ACHATA = 0.62
/** O meio do monte no quadro. */
const MEIO_Y = -0.1
/** O quanto a camada da luz é puxada para cima à esquerda. */
const PUXA_PARA_A_LUZ = { x: -0.01, y: -0.013 } as const
/** A camada da luz é a do osso encolhida: a sombra fica de beira em volta. */
const ENCOLHE = 0.7
/** A sobra da camada da sombra além do osso (unidades do chão): a beira escura que dá o contorno sem traço. */
const BEIRA = 0.008

type P = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** O pincel: tudo em unidades do chão, levado à tela pelo giro e pelo achatamento. */
interface Pincel {
  /** Do chão para a tela; `puxa` = a camada da luz. */
  readonly naTela: (p: P, puxa: boolean) => P
  readonly g: CanvasRenderingContext2D
}

function poligono(k: Pincel, pontos: readonly P[], cor: Rgb, puxa: boolean): void {
  k.g.fillStyle = css(cor)
  k.g.beginPath()
  pontos.forEach((p, i) => {
    const [x, y] = k.naTela(p, puxa)
    if (i === 0) k.g.moveTo(x, y)
    else k.g.lineTo(x, y)
  })
  k.g.closePath()
  k.g.fill()
}

function disco(k: Pincel, centro: P, r: number, cor: Rgb, puxa: boolean): void {
  const [x, y] = k.naTela(centro, puxa)
  k.g.fillStyle = css(cor)
  k.g.beginPath()
  k.g.ellipse(x, y, r, r * ACHATA, 0, 0, Math.PI * 2)
  k.g.fill()
}

/** Uma curva grossa (a costela, a mandíbula) do chão `a` ao `c`, puxada por `b`. */
function curva(k: Pincel, a: P, b: P, c: P, largura: number, cor: Rgb, puxa: boolean): void {
  const [ax, ay] = k.naTela(a, puxa)
  const [bx, by] = k.naTela(b, puxa)
  const [cx, cy] = k.naTela(c, puxa)
  k.g.strokeStyle = css(cor)
  k.g.lineWidth = largura
  k.g.beginPath()
  k.g.moveTo(ax, ay)
  k.g.quadraticCurveTo(bx, by, cx, cy)
  k.g.stroke()
}

const mais = (a: P, b: P, t = 1): P => [a[0] + b[0] * t, a[1] + b[1] * t]

/** Um osso comprido (o fêmur, a tíbia): a haste que afina no meio, a cabeça redonda numa ponta e os dois nós na outra. */
interface OssoComprido {
  readonly centro: P
  readonly angulo: number
  readonly comprimento: number
  /** Meia largura da haste e o raio das cabeças. */
  readonly largura: number
  readonly cabeca: number
  /** Partido: a ponta de baixo é lascada e mostra o tutano. */
  readonly partido: boolean
}

function pintarOssoComprido(k: Pincel, o: OssoComprido, cor: Rgb, escala: number, sobra: number, puxa: boolean): void {
  const d: P = [Math.cos(o.angulo), Math.sin(o.angulo)]
  const n: P = [-d[1], d[0]]
  const meio = o.comprimento / 2
  const ponta1 = mais(o.centro, d, -meio)
  const ponta2 = mais(o.centro, d, meio)
  const w = o.largura * escala + sobra
  const fino = o.largura * 0.78 * escala + sobra
  // A ponta de baixo do partido é lascada: três dentes desiguais no lugar dos nós.
  const fim = o.partido
    ? [mais(mais(ponta2, n, -w), d, -0.012), mais(mais(ponta2, n, -w * 0.3), d, 0.018), mais(mais(ponta2, n, w * 0.2), d, -0.006), mais(mais(ponta2, n, w), d, 0.012)]
    : [mais(ponta2, n, -w), mais(ponta2, n, w)]
  poligono(k, [mais(ponta1, n, w), mais(o.centro, n, fino), ...[...fim].reverse(), mais(o.centro, n, -fino), mais(ponta1, n, -w)], cor, puxa)
  // A cabeça redonda, um tanto para fora da ponta e para o lado (o colo do fêmur).
  disco(k, mais(mais(ponta1, d, -o.cabeca * 0.35), n, o.cabeca * 0.25), o.cabeca * 1.05 * escala + sobra, cor, puxa)
  disco(k, mais(ponta1, n, -o.cabeca * 0.45), o.cabeca * 0.7 * escala + sobra, cor, puxa)
  if (!o.partido) for (const lado of [-1, 1]) disco(k, mais(mais(ponta2, n, lado * o.cabeca * 0.55), d, o.cabeca * 0.15), o.cabeca * 0.8 * escala + sobra, cor, puxa)
}

/** Uma vértebra: o corpo redondo, o espinho para trás e as duas asas. */
function pintarVertebra(k: Pincel, centro: P, angulo: number, r: number, cor: Rgb, escala: number, sobra: number, puxa: boolean): void {
  const d: P = [Math.cos(angulo), Math.sin(angulo)]
  const n: P = [-d[1], d[0]]
  const asa = r * 0.45 * escala + sobra
  poligono(k, [mais(mais(centro, n, -r * 2), d, -asa), mais(mais(centro, n, r * 2), d, -asa), mais(mais(centro, n, r * 2), d, asa), mais(mais(centro, n, -r * 2), d, asa)], cor, puxa)
  poligono(k, [mais(centro, n, -asa), mais(mais(centro, d, r * 2.1), n, -asa * 0.6), mais(mais(centro, d, r * 2.1), n, asa * 0.6), mais(centro, n, asa)], cor, puxa)
  disco(k, centro, r * escala + sobra, cor, puxa)
}

/**
 * O crânio de gente de cara para o céu, a peça que diz "restos" de longe: a abóbada e a face (duas camadas, como o
 * resto), o brilho na testa e as órbitas e o nariz escuros. `rumo` é para onde a face aponta.
 */
function pintarCranio(k: Pincel, centro: P, rumo: number, cor: Rgb, escala: number, sobra: number, puxa: boolean): void {
  const d: P = [Math.cos(rumo), Math.sin(rumo)]
  disco(k, mais(centro, d, -0.022), 0.078 * escala + sobra, cor, puxa)
  disco(k, mais(centro, d, 0.052), 0.054 * escala + sobra, cor, puxa)
}

function furosDoCranio(k: Pincel, centro: P, rumo: number): void {
  const d: P = [Math.cos(rumo), Math.sin(rumo)]
  const n: P = [-d[1], d[0]]
  disco(k, mais(centro, d, -0.045), 0.03, OSSO_CLARO, true)
  for (const lado of [-1, 1]) disco(k, mais(mais(centro, d, 0.035), n, lado * 0.03), 0.02, BURACO, false)
  disco(k, mais(centro, d, 0.074), 0.011, BURACO, false)
}

/** O arranjo da semente: o crânio, os dois ossos compridos, o pedaço de costelas, as vértebras e os miúdos. */
interface Monte {
  readonly cranio: readonly [P, number]
  readonly compridos: readonly OssoComprido[]
  readonly costelas: readonly (readonly [P, P, P])[]
  readonly vertebras: readonly (readonly [P, number])[]
  readonly miudos: readonly (readonly [P, number, number])[]
  readonly mandibula: readonly [P, P, P] | null
}

/**
 * Na primeira folha (28/11), sem crânio e com os ossos finos (meia haste 0,022 a 0,026), o monte lia rabisco branco
 * na mesa e "gravetos" no grande; agora os ossos são mais grossos, há menos miúdos e o crânio de gente fica num lado.
 */
function monteDa(semente: number): Monte {
  const s = (i: number) => sorteio(semente, i)
  const partido = s(1) < 0.5 ? 0 : 1
  const cruz = (s(2) - 0.5) * 0.5
  const cranio: [P, number] = [[-0.24 + 0.04 * s(13), -0.06 + 0.06 * s(14)], s(15) * Math.PI * 2]
  const compridos: OssoComprido[] = [
    { centro: [0.0 + 0.05 * s(3), -0.01], angulo: 0.5 + cruz, comprimento: 0.44, largura: 0.034, cabeca: 0.046, partido: partido === 0 },
    { centro: [0.08, 0.06 + 0.04 * s(4)], angulo: -0.55 + cruz * 0.6, comprimento: 0.38, largura: 0.03, cabeca: 0.042, partido: partido === 1 },
  ]
  // As costelas: três, quase paralelas, saindo da espinha para o mesmo lado (a última às vezes quebrada).
  const base: P = [0.24 + 0.05 * s(5), -0.16 + 0.04 * s(6)]
  const rumo = 1.9 + 0.5 * s(7)
  const ao: P = [Math.cos(rumo), Math.sin(rumo)]
  const fora: P = [-ao[1], ao[0]]
  const costelas: [P, P, P][] = []
  for (let i = 0; i < 3; i += 1) {
    const raiz = mais(base, ao, i * 0.08)
    const comprida = i === 2 && s(9) < 0.6 ? 0.6 : 1
    costelas.push([raiz, mais(mais(raiz, fora, 0.14 * comprida), ao, -0.07 * comprida), mais(mais(raiz, fora, 0.25 * comprida), ao, 0.04 * comprida)])
  }
  // As vértebras: a espinha que sobrou, ao lado das costelas.
  const vertebras: [P, number][] = [
    [mais(base, ao, -0.07), rumo],
    [mais(base, ao, -0.15), rumo + 0.25],
  ]
  // Os miúdos: dedos e lascas, em volta do monte.
  const miudos: [P, number, number][] = []
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + s(20 + i) * 1.2
    const r = 0.34 + 0.1 * s(30 + i)
    miudos.push([[Math.cos(a) * r, Math.sin(a) * r * 0.7], s(40 + i) * Math.PI, 0.02 + 0.012 * s(50 + i)])
  }
  const [[cx, cy]] = cranio
  const mandibula: [P, P, P] | null = s(12) < 0.4 ? [[cx - 0.07, cy + 0.17], [cx + 0.01, cy + 0.27], [cx + 0.09, cy + 0.15]] : null
  return { cranio, compridos, costelas, vertebras, miudos, mandibula }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const k: Pincel = {
    g,
    naTela: ([u, v], puxa) => [u * c - v * s + (puxa ? PUXA_PARA_A_LUZ.x : 0), MEIO_Y + (u * s + v * c) * ACHATA + (puxa ? PUXA_PARA_A_LUZ.y : 0)],
  }
  const monte = monteDa(semente)
  g.lineCap = 'round'
  g.lineJoin = 'round'

  // Duas passadas: a do osso na sombra (inteiro, com a beira) e a da luz por cima (encolhida e puxada para a luz).
  for (const [cor, escala, sobra, puxa] of [[OSSO_SOMBRA, 1, BEIRA, false], [OSSO, ENCOLHE, 0, true]] as const) {
    for (const [centro, angulo, r] of monte.miudos) {
      const d: P = [Math.cos(angulo) * r, Math.sin(angulo) * r]
      curva(k, mais(centro, d, -1), centro, mais(centro, d), (r * 1.1 * escala + sobra) * 1.2, cor, puxa)
    }
    if (monte.mandibula !== null) curva(k, ...monte.mandibula, 0.04 * escala + sobra, cor, puxa)
    for (const [a, b, ponta] of monte.costelas) curva(k, a, b, ponta, 0.038 * escala + sobra, cor, puxa)
    for (const [centro, angulo] of monte.vertebras) pintarVertebra(k, centro, angulo, 0.034, cor, escala, sobra, puxa)
    for (const o of monte.compridos) pintarOssoComprido(k, o, cor, escala, sobra, puxa)
    pintarCranio(k, monte.cranio[0], monte.cranio[1], cor, escala, sobra, puxa)
  }
  furosDoCranio(k, monte.cranio[0], monte.cranio[1])

  // O brilho miúdo nas cabeças e no meio das hastes, e o fundo escuro do tutano e dos furos das vértebras.
  for (const o of monte.compridos) {
    const d: P = [Math.cos(o.angulo), Math.sin(o.angulo)]
    const ponta1 = mais(o.centro, d, -o.comprimento / 2)
    disco(k, mais(ponta1, d, -o.cabeca * 0.35), o.cabeca * 0.4, OSSO_CLARO, true)
    disco(k, mais(o.centro, d, -o.comprimento * 0.12), o.largura * 0.35, OSSO_CLARO, true)
    if (o.partido) disco(k, mais(o.centro, d, o.comprimento / 2 - 0.004), o.largura * 0.5, BURACO, false)
  }
  for (const [centro] of monte.vertebras) disco(k, centro, 0.011, BURACO, false)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'ossos-espalhados', nome: 'Ossos espalhados', tamanho: 9, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [OSSO_SOMBRA, OSSO, OSSO_CLARO, BURACO]
