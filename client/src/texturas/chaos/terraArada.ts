import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, mod, passoSuave, rgb, valor, vizinhos, type Rgb } from '../ruido'

/**
 * TERRA ARADA (L07 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Vila e fazenda): a
 * terra virada pelo arado, pronta para o plantio. Os CAMALHÕES correm na horizontal, dois por casa, largos e
 * arredondados em cima, com o SULCO mais estreito entre eles; a luz de cima à esquerda acende a encosta de cima de cada
 * camalhão e deixa a de baixo na sombra, e o fundo do sulco é a terra mais úmida e escura. As fileiras não são régua:
 * cada uma serpenteia um nada (o arado de boi não anda reto), muda de altura e de perfil ao longo do caminho.
 *
 * Por cima, os TORRÕES que o arado deixou: miúdos e muitos nas encostas e no alto dos camalhões, poucos no fundo do
 * sulco; um ou outro torrão grande, e umas PEDRINHAS foscas. Cada torrão é uma bolota de terra mais seca, acesa do lado
 * da luz, com a sombra curta caindo para baixo à direita. As manchas largas de terra mais ruiva (argila) e mais
 * cinzenta, e o grão fino de terra esfarelada, tiram o desenho repetido. Ladrilho de 8 casas, que dá a volta.
 *
 * Conta por pixel: três `fbm` curtos, dois `vizinhos` e o grão. Os torrões são TABELADOS uma vez (onde há torrão e o
 * tamanho dele dependem da altura do camalhão no centro, que custaria dois `fbm` por célula vizinha em cada pixel).
 */

/** A terra: a comum, a seca do alto dos camalhões, a úmida do fundo do sulco, a ruiva (argila) e a cinzenta. */
const TERRA: Rgb = rgb('#695545')
const TERRA_SECA: Rgb = rgb('#7b6752')
const TERRA_UMIDA: Rgb = rgb('#4e4137')
const TERRA_RUIVA: Rgb = rgb('#6e5240')
const TERRA_CINZENTA: Rgb = rgb('#605950')
/** O torrão (terra que secou ao ar) e a pedrinha. */
const TORRAO: Rgb = rgb('#76624f')
const PEDRINHA: Rgb = rgb('#7a756c')
const SOMBRA: Rgb = rgb('#3c322b')

/** Quantos camalhões o ladrilho tem de cima a baixo (dois por casa). */
const CAMALHOES = 16
/** O serpentear das fileiras, em camalhões: o largo (o campo todo) e o miúdo (o passo do boi). */
const MEANDRO = { largo: 0.32, miudo: 0.07, semente: 7101 } as const
/** O perfil do camalhão: o expoente da encosta (maior = alto mais largo e sulco mais fechado), por fileira. */
const PERFIL = { de: 1.3, ate: 1.95, celulas: 5, semente: 7111 } as const
/** A altura do camalhão, em fração da largura dele, por fileira e ao longo do caminho. */
const ALTURA = { de: 0.15, ate: 0.24, celulas: 4, semente: 7121 } as const
/** O quanto a encosta virada para a luz acende e a de costas escurece (a sombra é mais branda: a luz do céu enche). */
const LUZ_DO_CAMALHAO = { claro: 0.42, sombra: 0.2 } as const

interface Torroes {
  /** Células por lado do ladrilho. */
  readonly celulas: number
  readonly semente: number
  readonly folga: number
  /** O raio (em células) do menor e do maior. */
  readonly raio: readonly [number, number]
  /** Quanto das células tem torrão no fundo do sulco e no alto do camalhão. */
  readonly noSulco: number
  readonly noAlto: number
  /** Quanto dos torrões grandes é pedrinha. */
  readonly pedrinhas: number
}

const MIUDOS: Torroes = { celulas: 112, semente: 7201, folga: 0.36, raio: [0.2, 0.44], noSulco: 0.14, noAlto: 0.62, pedrinhas: 0 }
const GRANDES: Torroes = { celulas: 40, semente: 7211, folga: 0.32, raio: [0.15, 0.27], noSulco: 0, noAlto: 0.3, pedrinhas: 0.14 }
/** O torrão é mais comprido na direção da fileira (o arado o deita) e um nada torto. */
const ALONGA = { x: 1.28, y: 0.82, torce: 0.35 } as const
/** A luz no torrão e a sombra curta dele, para baixo à direita (em raios do torrão). */
const LUZ_NO_TORRAO = { claro: 0.17, beira: 0.17, sombra: 0.24, desvio: 0.38, alcance: 1.12 } as const

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function meandro(u: number, v: number): number {
  return MEANDRO.largo * fbm(u, v, 2, 2, MEANDRO.semente) + MEANDRO.miudo * fbm(u, v, 9, 2, MEANDRO.semente + 1)
}

interface NoCamalhao {
  /** A altura no ponto: 0 no fundo do sulco, 1 no alto do camalhão. */
  readonly altura: number
  /** A inclinação de cima para baixo (positiva = a encosta virada para a luz). */
  readonly inclinacao: number
}

/**
 * O camalhão no ponto. O perfil é `1 - passoSuave(q^m)` (q = 0 no alto, 1 no fundo): o alto largo e redondo, a encosta
 * mais em pé perto do sulco e o fundo também redondo (derivada nula nas duas pontas, então duas fileiras de perfil
 * diferente emendam lisas no fundo do sulco).
 */
function camalhao(u: number, v: number): NoCamalhao {
  const t = v * CAMALHOES + meandro(u, v)
  const fileira = mod(Math.floor(t), CAMALHOES)
  const s = t - Math.floor(t)
  const m = PERFIL.de + (PERFIL.ate - PERFIL.de) * valor(u * PERFIL.celulas, 0.5, PERFIL.celulas, PERFIL.semente + fileira * 17)
  const alto = ALTURA.de + (ALTURA.ate - ALTURA.de) * valor(u * ALTURA.celulas, 0.5, ALTURA.celulas, ALTURA.semente + fileira * 23)
  const q = Math.abs(s - 0.5) * 2
  const x = Math.pow(q, m)
  const altura = 1 - x * x * (3 - 2 * x)
  // d(passoSuave(q^m))/dq; dq/ds = -2 antes do alto e +2 depois, e a altura cresce para baixo antes do alto.
  const encosta = q <= 0 ? 0 : 6 * x * (1 - x) * m * (x / q)
  const inclinacao = (s < 0.5 ? 1 : -1) * alto * 2 * encosta
  return { altura, inclinacao }
}

/** Raio de cada célula com torrão (0 = sem torrão; negativo = pedrinha), tabelado uma vez por grade. */
const tabelas = new Map<Torroes, Float32Array>()

function tabelaDos(t: Torroes): Float32Array {
  const pronta = tabelas.get(t)
  if (pronta !== undefined) return pronta
  const n = t.celulas
  const tabela = new Float32Array(n * n)
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      // O centro do torrão, o mesmo ponto que `vizinhos` sorteia na célula.
      const cx = (ix + 0.5 + (hash(ix, iy, t.semente) - 0.5) * 2 * t.folga) / n
      const cy = (iy + 0.5 + (hash(ix, iy, t.semente + 7) - 0.5) * 2 * t.folga) / n
      const { altura } = camalhao(naVolta(cx), naVolta(cy))
      const parte = t.noSulco + (t.noAlto - t.noSulco) * passoSuave(0.25, 0.8, altura)
      if (hash(ix, iy, t.semente + 1) > parte) continue
      const raio = t.raio[0] + (t.raio[1] - t.raio[0]) * hash(ix, iy, t.semente + 2)
      tabela[iy * n + ix] = hash(ix, iy, t.semente + 3) < t.pedrinhas ? -raio * 0.8 : raio
    }
  }
  tabelas.set(t, tabela)
  return tabela
}

interface NoTorrao {
  /** A cor do torrão que cobre o ponto, ou nula fora deles. */
  readonly cor: Rgb | null
  /** A sombra curta dos torrões em volta (0 a 1). */
  readonly sombra: number
}

function torroes(u: number, v: number, t: Torroes, chao: Rgb): NoTorrao {
  const tabela = tabelaDos(t)
  let cor: Rgb | null = null
  let maisPerto = Infinity
  let sombra = 0
  vizinhos(u, v, t.celulas, t.semente, t.folga, ({ dx, dy, ix, iy }) => {
    const r = tabela[iy * t.celulas + ix]
    if (r === 0) return
    const pedra = r < 0
    const raio = Math.abs(r)
    const giro = (hash(ix, iy, t.semente + 4) - 0.5) * 2 * ALONGA.torce
    const [c, s] = [Math.cos(giro), Math.sin(giro)]
    const lx = (dx * c + dy * s) / (raio * (pedra ? 1.1 : ALONGA.x))
    const ly = (-dx * s + dy * c) / (raio * (pedra ? 0.9 : ALONGA.y))
    const d = Math.hypot(lx, ly)
    if (d >= 1) {
      // A sombra: o mesmo contorno, um tanto para baixo à direita.
      const ds = Math.hypot(lx - LUZ_NO_TORRAO.desvio, ly - LUZ_NO_TORRAO.desvio)
      sombra = Math.max(sombra, passoSuave(LUZ_NO_TORRAO.alcance, 0.7, ds))
      return
    }
    if (d >= maisPerto) return
    maisPerto = d
    const voltado = -(lx + ly) / Math.SQRT2
    const base = pedra ? PEDRINHA : misturar(chao, TORRAO, 0.6)
    const tom = luz(base, (hash(ix, iy, t.semente + 5) - 0.5) * 0.12 + voltado * LUZ_NO_TORRAO.claro)
    cor = luz(tom, -passoSuave(0.62, 1, d) * LUZ_NO_TORRAO.beira)
  })
  return { cor, sombra }
}

/** A cor da terra arada no ponto (u, v) do ladrilho. */
export function texturaTerraArada(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const { altura, inclinacao } = camalhao(uu, vv)

  // A terra: as manchas de argila e de cinzenta, o fundo úmido e o alto seco.
  const mancha = fbm(uu, vv, 3, 3, 7131)
  let c = misturar(TERRA, TERRA_RUIVA, passoSuave(0.1, 0.7, mancha) * 0.55)
  c = misturar(c, TERRA_CINZENTA, passoSuave(-0.1, -0.7, mancha) * 0.5)
  c = misturar(c, TERRA_UMIDA, (1 - altura) * (1 - altura) * 0.55)
  c = misturar(c, TERRA_SECA, passoSuave(0.55, 1, altura) * 0.42)

  // O relevo do camalhão e o grão da terra esfarelada.
  const relevo = luzNaInclinacao(0, inclinacao) - LUZ_NO_PLANO
  c = luz(c, relevo > 0 ? relevo * LUZ_DO_CAMALHAO.claro : relevo * LUZ_DO_CAMALHAO.sombra)
  c = luz(c, (valor(uu * 384, vv * 384, 384, 7141) - 0.5) * 0.07 + (valor(uu * 150, vv * 150, 150, 7142) - 0.5) * 0.06)

  // Os torrões: primeiro os grandes (por baixo), depois os miúdos; a sombra de cada um no chão.
  const chao = c
  const grandes = torroes(uu, vv, GRANDES, chao)
  const miudos = torroes(uu, vv, MIUDOS, chao)
  c = misturar(c, SOMBRA, Math.max(grandes.sombra, miudos.sombra) * LUZ_NO_TORRAO.sombra)
  if (grandes.cor !== null) c = grandes.cor
  if (miudos.cor !== null) c = misturar(c, miudos.cor, grandes.cor === null ? 1 : 0.85)
  return empacotar(c)
}
