import { cobertura, espalhar, pontosQueAlcancam, sorteador, type Cobertura, type Espalhamento } from '../espalhar'
import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * PEDRAS COM LAMA (pedido de 15/11/2026: "um chão de tijolos de pedra com terra lamacenta cinza"; cartão Pisos de
 * pedra): a rua de vila e o pátio depois da chuva. Pedras chatas e gastas de tamanhos diferentes, quase todas
 * compridas como tijolo, assentadas sem fiada na lama cinza; a lama enche as juntas, cobre um lado das pedras mais
 * afundadas e se espalha por cima de outras, a borda molhada brilha do lado da luz e a água junta em poças pequenas.
 * A cor é a de dia: a Tarde e a Noite escurecem o mapa sozinhas (a foto da referência é de noite).
 *
 * Diferente das vizinhas: o Calçamento é de pedra redonda e miúda em junta escura e fina; as Lajotas são uma grade
 * regular; o Paralelepípedo corre em fileira reta; a Pedra com musgo é laje angulosa (célula de Voronoi) na terra
 * parda. Aqui cada pedra é um retângulo gasto (canto redondo, uma ponta mais estreita, a borda lascada), jogado por
 * sorteio (dardo, as grandes primeiro) e depois assentado (cresce até quase encostar nas vizinhas): as juntas não se
 * alinham em fileira, a lama abre mais nos cantos e há regiões de mais lama e menos pedra.
 */

const CASAS = 8
const SEMENTE = 5300

// ---------- o assentamento (uma vez só) ----------

/** Os três tamanhos de pedra (comprimento e largura, em casas) e os dardos de cada um: as grandes primeiro, as miúdas tapam o vão. */
const TAMANHOS = [
  { dardos: 2500, comprimento: [0.85, 1.3], largura: [0.48, 0.72] },
  { dardos: 5000, comprimento: [0.52, 0.85], largura: [0.32, 0.5] },
  { dardos: 8000, comprimento: [0.3, 0.52], largura: [0.22, 0.36] },
] as const
/** Quantas pedras deitadas (o comprimento na horizontal); as outras em pé. */
const DEITADAS = 0.6
/** O quanto cada pedra gira fora do prumo, em radianos (até uns 11°). */
const GIRO = 0.2
/** A meia junta de cada pedra, em casas: a junta entre duas é a soma das metades (0,06 a 0,15 casa). */
const MEIA_JUNTA = [0.03, 0.075] as const
/** Cada lado da pedra cresce aos passos (casas) até quase encostar na vizinha, até o teto sorteado dela. */
const ASSENTO = { passo: 0.015, teto: 0.1 } as const
/** A pedra fica no máximo isto mais comprida que larga: o assentamento não a deixa virar régua. */
const ALONGAMENTO_MAXIMO = 2.4
/** Onde o chão é mais lamaçal, até esta fração dos dardos é recusada: a lama abre clareiras entre as pedras. */
const RECUSA_NO_LAMACAL = 0.35
/** A grade do sorteio: uma casa por célula; a busca olha duas células para cada lado (a maior pedra assentada cabe). */
const GRADE_DO_SORTEIO = CASAS
const BUSCA_DO_SORTEIO = 2

/** O canto gasto, em fração da meia largura da pedra, e o quanto uma ponta é mais estreita que a outra. */
const CANTO = [0.25, 0.85] as const
const AFINA = 0.22
/** Quantas pedras afundaram de um lado (a lama cobre aquele lado) e até onde a lama chega nelas (−1 a 1 na pedra). */
const AFUNDADAS = 0.22
const AFUNDA_ATE = [-0.2, 0.6] as const

// ---------- o pixel ----------

/**
 * A grade de busca das pedras (meia casa por célula) e até onde, além da pedra, cada célula a enxerga: a sombra e a
 * lama molhada acabam a 0,08 casa, mais os gomos e as lascas, mais a ponta larga da pedra que afina (0,15 cobre).
 */
const CELULAS = 16
const CELULA = CASAS / CELULAS
const ALCANCE_ALEM = 0.15
/** O quanto a borda serpenteia (em casas) e a escala do ruído que a torce (células por ladrilho). */
const TORCAO = 0.035
const TORCAO_ESCALA = 16
/** A borda gasta: os gomos largos (a pedra nunca é retângulo de régua) e as lascas miúdas, em casas, com as escalas. */
const GOMO = 0.025
const GOMO_ESCALA = 32
const LASCA = 0.012
const LASCA_ESCALA = 96
/** A passagem macia da pedra para a lama, em casas para cada lado da borda: sem fio de 1 px. */
const PASSAGEM = 0.01
/** O ombro gasto: largura em casas (nunca mais que o canto, senão o vinco da diagonal aparece) e a inclinação na borda. */
const OMBRO = 0.05
const INCLINACAO = 0.4
/** Cada pedra assentada um nada torta. */
const TORTO = 0.05
/** Quanto a luz do relevo pesa na cor. */
const LUZ_DO_RELEVO = 0.2
/**
 * A borda molhada da pedra: até onde a água sobe (casas), o quanto escurece e o peso do brilho do lado da luz. O
 * brilho vem em pontos ao longo da borda (a escala do ruído que o recorta), não num crescente inteiro.
 */
const BORDA_MOLHADA = 0.04
const ESCURO_DA_BORDA = 0.06
const BRILHO = 0.3
const BRILHO_ESCALA = 120
/**
 * Os poros miúdos da pedra gasta (a escala do ruído e o quanto escurecem): de perto ela não sai lisa. Ruído de
 * gradiente: o de valor, cortado tão alto, saía em tracinhos alinhados com a grade.
 */
const POROS = { escala: 220, luz: 0.07 } as const
/**
 * Até onde a lama sobe pela borda da pedra mais suja, em casas, e o quanto a mancha de lama larga cobre a pedra. A
 * lama por cima da pedra já secou: mais clara que a da junta, perto do tom da pedra (escura, a pedra meio coberta
 * virava uma tampa branca na outra metade).
 */
const LAMA_SOBE = 0.07
const PELICULA_MAXIMA = 0.45
const PELICULA_CLAREIA = 0.06
/**
 * O quanto a lama cobre o lado da pedra afundada: a pedra ainda aparece por baixo. Cobrindo inteiro, o lado de fora
 * da pedra clara virava uma faixa branca, e a faixa se lia repetida no ladrilho.
 */
const AFUNDADA_MAXIMA = 0.6
/** O grão da lama: o quanto escurece e clareia, e os pontinhos de areia mais clara (a escala e o quanto clareiam). */
const GRAO_DA_LAMA = 0.05
const AREIA = { escala: 300, luz: 0.07 } as const
/** A lama junto da pedra é mais molhada até `JUNTO` casas; a sombra da pedra cai até `alcance` casas para baixo à direita. */
const JUNTO = 0.07
const SOMBRA = { alcance: 0.08, forca: 0.14 } as const

/** As poças: raio em casas (a margem de uma poça sozinha), quantos dardos e o alcance do domo de cada uma ("metaball"). */
const POCA_RAIO = [0.22, 0.5] as const
const POCA_DARDOS = 14
const POCA_ALCANCE = 1.6
/** O campo de uma poça sozinha bem na margem dela: (1 - 1/1,6²)². */
const LIMIAR_DA_AGUA = (1 - 1 / POCA_ALCANCE ** 2) ** 2
/** O quanto a margem da poça é torcida (casas) e a escala do ruído: nenhuma sai elipse. */
const POCA_TORCAO = 0.24
const POCA_TORCAO_ESCALA = 10
/**
 * O alto da pedra fica fora da água até este nível da poça (0 na margem, ~1,7 no meio de uma poça sozinha): a água
 * enche primeiro a lama entre as pedras e só no fundo cobre a pedra.
 */
const PEDRA_FORA_DA_AGUA = 0.8
/** Pedra nenhuma assenta onde o campo passa disto (em limiares): o fundo da poça é só lama e água. */
const FUNDO_SEM_PEDRA = 1.15

/** Cinza de pedra molhada de chuva: neutro, um ou outro um nada mais quente ou mais claro. A lama é que é parda. */
const TONS: readonly Rgb[] = [
  rgb('#74736f'), rgb('#6f6e6b'), rgb('#787672'), rgb('#6c6c6a'), rgb('#76736d'), rgb('#71706d'), rgb('#7a7874'), rgb('#6a6967'),
]
/** A lama cinza, um nada parda: a seca e a molhada. */
const LAMA_SECA = rgb('#65625c')
const LAMA_MOLHADA = rgb('#4d4b47')
/** O brilho da água na borda da pedra: cinza claro e frio (o céu), nunca branco. */
const BRILHO_MOLHADO = rgb('#a2a6a7')
/** A água da poça: cinza turvo de lama na sombra da margem e o reflexo do céu, mais claro, no resto (frio de leve: azul, não). */
const AGUA = rgb('#565551')
const REFLEXO = rgb('#6c6f6e')

interface Pedra {
  /** O meio, em casas no ladrilho. */
  x: number
  y: number
  /** O rumo do comprimento. */
  cos: number
  sen: number
  /** Meio comprimento e meia largura, em casas (a ≥ b). */
  a: number
  b: number
  /** A meia junta dela, em casas. */
  folga: number
}

interface FormaDaPoca {
  cos: number
  sen: number
  /** Raiz do alongamento: o eixo longo é r·k, o curto r/k. */
  k: number
}

/** As poças, espalhadas pelo ladrilho (em lados de ladrilho), com a forma e o alcance de cada uma. */
interface Pocas {
  pocas: Espalhamento
  formas: readonly FormaDaPoca[]
  alcance: Cobertura
}

/** O chão pronto, em vetores: o pixel lê sem criar objeto. */
interface Chao extends Pocas {
  x: Float64Array
  y: Float64Array
  cos: Float64Array
  sen: Float64Array
  a: Float64Array
  b: Float64Array
  canto: Float64Array
  ombro: Float64Array
  afina: Float64Array
  tom: Int32Array
  luz: Float64Array
  tortoX: Float64Array
  tortoY: Float64Array
  sujeira: Float64Array
  /** A pedra afundada: o rumo (no corpo dela) do lado que a lama cobre e até onde; `afunda` = 2 na pedra que não afundou. */
  afundaX: Float64Array
  afundaY: Float64Array
  afunda: Float64Array
  /** As pedras que cada célula enxerga: `indices[inicio[c]]` até `indices[inicio[c + 1] - 1]`. */
  inicio: Int32Array
  indices: Int32Array
}

function naVoltaDoLadrilho(t: number): number {
  return t - Math.floor(t)
}

function resto(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** Onde o chão é mais lamaçal (0 a 1), em lados de ladrilho: largo, umas poucas regiões por ladrilho. */
function lamacal(u: number, v: number): number {
  return passoSuave(0, 0.7, fbm(u, v, 3, 2, SEMENTE + 40))
}

/** A metade da sombra da pedra no eixo (ex, ey). */
function meiaSombra(p: Pedra, ex: number, ey: number): number {
  return p.a * Math.abs(p.cos * ex + p.sen * ey) + p.b * Math.abs(-p.sen * ex + p.cos * ey)
}

/**
 * As duas pedras ficam a pelo menos a junta delas (a soma das meias juntas) uma da outra? Basta um eixo que as
 * separe (os dois de cada pedra): a sombra num eixo nunca passa da distância de verdade. Pela volta do ladrilho.
 */
function separadas(p: Pedra, q: Pedra): boolean {
  let dx = q.x - p.x
  let dy = q.y - p.y
  dx -= CASAS * Math.round(dx / CASAS)
  dy -= CASAS * Math.round(dy / CASAS)
  const junta = p.folga + q.folga
  const longe = Math.sqrt(p.a * p.a + p.b * p.b) + Math.sqrt(q.a * q.a + q.b * q.b) + junta
  if (dx * dx + dy * dy >= longe * longe) return true
  const eixos = [p.cos, p.sen, -p.sen, p.cos, q.cos, q.sen, -q.sen, q.cos]
  for (let k = 0; k < eixos.length; k += 2) {
    const ex = eixos[k]
    const ey = eixos[k + 1]
    if (Math.abs(dx * ex + dy * ey) >= meiaSombra(p, ex, ey) + meiaSombra(q, ex, ey) + junta) return true
  }
  return false
}

/** A pedra com um dos lados (0 e 1: as pontas do comprimento; 2 e 3: as da largura) `passo` casas mais para fora. */
function estendida(p: Pedra, lado: number, passo: number): Pedra {
  const meio = (passo / 2) * (lado % 2 === 0 ? 1 : -1)
  if (lado < 2) return { ...p, a: p.a + passo / 2, x: p.x + p.cos * meio, y: p.y + p.sen * meio }
  return { ...p, b: p.b + passo / 2, x: p.x - p.sen * meio, y: p.y + p.cos * meio }
}

/**
 * A pedra cai no fundo de uma poça? Confere o meio e as duas pontas: a pedra pode entrar pela beira da poça (a margem
 * fica torta, como a de verdade), nunca ficar no meio dela.
 */
function noFundoDaPoca(pocas: Pocas, p: Pedra): boolean {
  for (const t of [-0.6, 0, 0.6]) {
    if (campoDaAgua(pocas, (p.x + p.cos * p.a * t) / CASAS, (p.y + p.sen * p.a * t) / CASAS) > LIMIAR_DA_AGUA * FUNDO_SEM_PEDRA) return true
  }
  return false
}

/**
 * As pedras jogadas por sorteio (as grandes primeiro, menos no lamaçal, nenhuma no fundo das poças) e assentadas:
 * cada lado cresce até quase encostar na vizinha.
 */
function assentar(pocas: Pocas): Pedra[] {
  const sorteio = sorteador(SEMENTE)
  const pedras: Pedra[] = []
  const baldes: number[][] = Array.from({ length: GRADE_DO_SORTEIO * GRADE_DO_SORTEIO }, () => [])
  const cabe = (p: Pedra, ela: number): boolean => {
    if (noFundoDaPoca(pocas, p)) return false
    const cx = Math.floor(p.x)
    const cy = Math.floor(p.y)
    for (let oy = -BUSCA_DO_SORTEIO; oy <= BUSCA_DO_SORTEIO; oy += 1) {
      for (let ox = -BUSCA_DO_SORTEIO; ox <= BUSCA_DO_SORTEIO; ox += 1) {
        for (const i of baldes[resto(cy + oy, GRADE_DO_SORTEIO) * GRADE_DO_SORTEIO + resto(cx + ox, GRADE_DO_SORTEIO)]) {
          if (i !== ela && !separadas(p, pedras[i])) return false
        }
      }
    }
    return true
  }
  for (const tamanho of TAMANHOS) {
    for (let k = 0; k < tamanho.dardos; k += 1) {
      const x = sorteio() * CASAS
      const y = sorteio() * CASAS
      const comprimento = tamanho.comprimento[0] + (tamanho.comprimento[1] - tamanho.comprimento[0]) * sorteio()
      const largura = tamanho.largura[0] + (tamanho.largura[1] - tamanho.largura[0]) * sorteio()
      const angulo = (sorteio() < DEITADAS ? 0 : Math.PI / 2) + (sorteio() - 0.5) * 2 * GIRO
      const folga = MEIA_JUNTA[0] + (MEIA_JUNTA[1] - MEIA_JUNTA[0]) * sorteio()
      if (sorteio() < RECUSA_NO_LAMACAL * lamacal(x / CASAS, y / CASAS)) continue
      const p: Pedra = { x, y, cos: Math.cos(angulo), sen: Math.sin(angulo), a: Math.max(comprimento, largura) / 2, b: Math.min(comprimento, largura) / 2, folga }
      if (!cabe(p, -1)) continue
      baldes[resto(Math.floor(y), GRADE_DO_SORTEIO) * GRADE_DO_SORTEIO + resto(Math.floor(x), GRADE_DO_SORTEIO)].push(pedras.length)
      pedras.push(p)
    }
  }
  // O assentamento: a pedra fica no balde do meio sorteado; ela anda no máximo o teto, e a busca de duas casas cobre.
  for (let i = 0; i < pedras.length; i += 1) {
    const teto = ASSENTO.teto * sorteio()
    for (let lado = 0; lado < 4; lado += 1) {
      for (let crescido = ASSENTO.passo; crescido <= teto; crescido += ASSENTO.passo) {
        const nova = estendida(pedras[i], lado, ASSENTO.passo)
        if (nova.a > nova.b * ALONGAMENTO_MAXIMO || nova.b > nova.a || !cabe(nova, i)) break
        pedras[i] = nova
      }
    }
  }
  return pedras
}

/** As pedras que cada célula da grade do pixel enxerga: a pedra entra nas células que o círculo dela (mais a folga) toca. */
function gradeDoPixel(pedras: readonly Pedra[]): { inicio: Int32Array; indices: Int32Array } {
  const listas: number[][] = Array.from({ length: CELULAS * CELULAS }, () => [])
  pedras.forEach((p, i) => {
    const alcance = Math.sqrt(p.a * p.a + p.b * p.b) * (1 + AFINA) + ALCANCE_ALEM
    const x0 = Math.floor((p.x - alcance) / CELULA)
    const y0 = Math.floor((p.y - alcance) / CELULA)
    const x1 = Math.min(Math.floor((p.x + alcance) / CELULA), x0 + CELULAS - 1)
    const y1 = Math.min(Math.floor((p.y + alcance) / CELULA), y0 + CELULAS - 1)
    for (let cy = y0; cy <= y1; cy += 1) {
      for (let cx = x0; cx <= x1; cx += 1) listas[resto(cy, CELULAS) * CELULAS + resto(cx, CELULAS)].push(i)
    }
  })
  const inicio = new Int32Array(listas.length + 1)
  listas.forEach((lista, c) => {
    inicio[c + 1] = inicio[c] + lista.length
  })
  const indices = new Int32Array(inicio[listas.length])
  listas.forEach((lista, c) => indices.set(lista, inicio[c]))
  return { inicio, indices }
}

/** As poças, sorteadas ANTES das pedras: cada uma é um buraco de lama onde pedra nenhuma assentou. */
function pocasDoChao(): Pocas {
  const pocas = espalhar({
    semente: SEMENTE + 30,
    dardos: POCA_DARDOS,
    grade: 4,
    raio: (s) => (POCA_RAIO[0] + (POCA_RAIO[1] - POCA_RAIO[0]) * s ** 1.6) / CASAS,
    fica: () => true,
    // Longe uma da outra: poça pequena e solta, nunca um lago.
    distanciaMinima: (p, q) => (p.r + q.r) * 1.5,
  })
  const formas = pocas.pontos.map((p) => {
    const angulo = p.a * Math.PI
    return { cos: Math.cos(angulo), sen: Math.sin(angulo), k: Math.sqrt(1 + 0.9 * p.b) }
  })
  // O alcance cobre também a torção da margem: o ponto torcido nunca sai de onde a poça chega.
  const alcance = cobertura(pocas, (p) => p.r * Math.sqrt(1 + 0.9 * p.b) * POCA_ALCANCE + (1.2 * POCA_TORCAO) / CASAS, 16)
  return { pocas, formas, alcance }
}

let pronto: Chao | null = null

function montar(): Chao {
  if (pronto !== null) return pronto
  const pocas = pocasDoChao()
  const pedras = assentar(pocas)
  const n = pedras.length
  const chao: Chao = {
    x: Float64Array.from(pedras, (p) => p.x),
    y: Float64Array.from(pedras, (p) => p.y),
    cos: Float64Array.from(pedras, (p) => p.cos),
    sen: Float64Array.from(pedras, (p) => p.sen),
    a: Float64Array.from(pedras, (p) => p.a),
    b: Float64Array.from(pedras, (p) => p.b),
    canto: new Float64Array(n),
    ombro: new Float64Array(n),
    afina: new Float64Array(n),
    tom: new Int32Array(n),
    luz: new Float64Array(n),
    tortoX: new Float64Array(n),
    tortoY: new Float64Array(n),
    sujeira: new Float64Array(n),
    afundaX: new Float64Array(n),
    afundaY: new Float64Array(n),
    afunda: new Float64Array(n),
    ...gradeDoPixel(pedras),
    ...pocas,
  }
  const s = SEMENTE + 20
  for (let i = 0; i < n; i += 1) {
    chao.canto[i] = pedras[i].b * (CANTO[0] + (CANTO[1] - CANTO[0]) * hash(i, 0, s))
    chao.ombro[i] = Math.min(OMBRO, chao.canto[i])
    chao.afina[i] = (hash(i, 1, s) - 0.5) * 2 * AFINA
    chao.tom[i] = Math.floor(hash(i, 2, s) * TONS.length) % TONS.length
    chao.luz[i] = (hash(i, 3, s) - 0.5) * 0.08
    chao.tortoX[i] = (hash(i, 4, s) - 0.5) * 2 * TORTO
    chao.tortoY[i] = (hash(i, 5, s) - 0.5) * 2 * TORTO
    chao.sujeira[i] = hash(i, 6, s)
    const rumo = hash(i, 7, s) * Math.PI * 2
    chao.afundaX[i] = Math.cos(rumo)
    chao.afundaY[i] = Math.sin(rumo)
    chao.afunda[i] = hash(i, 8, s) < AFUNDADAS ? AFUNDA_ATE[0] + (AFUNDA_ATE[1] - AFUNDA_ATE[0]) * hash(i, 9, s) : 2
  }
  pronto = chao
  return pronto
}

/**
 * A lama sem a pedra: regiões mais secas e mais molhadas (miúdas, para o ladrilho não se ler repetido), as manchas,
 * o grão e os pontinhos de areia.
 */
function lamaNoPonto(uu: number, vv: number): Rgb {
  const c = misturar(LAMA_SECA, LAMA_MOLHADA, 0.2 + 0.6 * passoSuave(-0.6, 0.6, fbm(uu, vv, 6, 2, SEMENTE + 8)))
  const areia = passoSuave(0.72, 0.9, valor(uu * AREIA.escala, vv * AREIA.escala, AREIA.escala, SEMENTE + 14))
  return luz(c, fbm(uu, vv, 40, 2, SEMENTE + 9) * 0.05 + (valor(uu * 512, vv * 512, 512, SEMENTE + 10) - 0.5) * 2 * GRAO_DA_LAMA + areia * AREIA.luz)
}

/**
 * A pedra no ponto (já com a borda gasta), com a lama que a cobre: `dentro` é a distância até a borda (casas),
 * (nx, ny) o rumo de dentro para fora e (lx, ly) o ponto no corpo da pedra.
 */
function corDaPedra(chao: Chao, i: number, dentro: number, nx: number, ny: number, lx: number, ly: number, uu: number, vv: number): Rgb {
  let c = TONS[chao.tom[i]]
  const poro = passoSuave(0.45, 0.75, fbm(uu, vv, POROS.escala, 1, SEMENTE + 15))
  c = luz(c, chao.luz[i] + fbm(uu, vv, 14, 2, SEMENTE + 4) * 0.07 + (valor(uu * 640, vv * 640, 640, SEMENTE + 5) - 0.5) * 0.05 - poro * POROS.luz)
  // O ombro gasto: inclinado na borda, plano no alto; a pedra inteira um nada torta.
  const inclinacao = INCLINACAO * (1 - passoSuave(0, chao.ombro[i], dentro))
  const relevo = luzNaInclinacao(-nx * inclinacao + chao.tortoX[i], -ny * inclinacao + chao.tortoY[i]) - LUZ_NO_PLANO
  c = luz(c, relevo * LUZ_DO_RELEVO)
  // A lama por cima: sobe pela borda em franja (nunca zero, senão o passo divide por zero), cobre o lado da pedra
  // afundada (a beira serpenteando) e a mancha larga de lama cobre de leve as pedras do lamaçal.
  const sobe = LAMA_SOBE * (0.15 + 0.85 * chao.sujeira[i]) * (0.3 + 0.7 * valor(uu * 80, vv * 80, 80, SEMENTE + 6))
  const naBorda = passoSuave(sobe, sobe * 0.25, dentro) * 0.9
  let afundada = 0
  if (chao.afunda[i] < 1) {
    const meio = (lx * chao.afundaX[i]) / chao.a[i] + (ly * chao.afundaY[i]) / chao.b[i]
    const beira = meio + (valor(uu * 40, vv * 40, 40, SEMENTE + 12) - 0.5) * 0.5
    afundada = passoSuave(chao.afunda[i], chao.afunda[i] + 0.55, beira) * AFUNDADA_MAXIMA
  }
  const pelicula = passoSuave(0.2, 0.65, fbm(uu, vv, 7, 2, SEMENTE + 7)) * PELICULA_MAXIMA
  const coberta = Math.max(naBorda, afundada, pelicula)
  if (coberta > 0.005) c = misturar(c, luz(lamaNoPonto(uu, vv), PELICULA_CLAREIA), coberta)
  // A borda molhada, por cima da pedra e da lama que subiu nela (o brilho é da água, não da pedra): escurece, e do
  // lado da luz brilha em pontos.
  const molhada = 1 - passoSuave(0, BORDA_MOLHADA, dentro)
  c = luz(c, -ESCURO_DA_BORDA * molhada)
  if (molhada > 0 && relevo > 0.02) {
    const pontos = passoSuave(0.35, 0.75, valor(uu * BRILHO_ESCALA, vv * BRILHO_ESCALA, BRILHO_ESCALA, SEMENTE + 13))
    c = misturar(c, BRILHO_MOLHADO, molhada * passoSuave(0.02, 0.2, relevo) * pontos * BRILHO)
  }
  return c
}

/** A lama no ponto, a `d` casas da pedra mais perto (rumo de fora dela: nx, ny). */
function corDaLama(d: number, nx: number, ny: number, uu: number, vv: number): Rgb {
  // Junto da pedra a lama é mais molhada; do lado de baixo à direita dela, fica na sombra.
  const junto = 1 - passoSuave(0, JUNTO, d)
  const deCostas = (nx + ny) * Math.SQRT1_2
  const sombra = (1 - passoSuave(0, SOMBRA.alcance, d)) * passoSuave(-0.3, 0.7, deCostas)
  return luz(lamaNoPonto(uu, vv), -0.045 * junto - SOMBRA.forca * sombra)
}

/**
 * Onde o ponto cai na poça, ao longo da diagonal da luz (−1 na beira de cima à esquerda, 1 na de baixo à direita),
 * pesado pelo domo de cada poça. A última conta de `campoDaAgua` deixa aqui (o pixel não cria objeto).
 */
let diagonalNaPoca = 0

/** O campo da água no ponto (em lados de ladrilho): cada poça soma um domo macio; acima do limiar, é água. */
function campoDaAgua(pocas: Pocas, px: number, py: number): number {
  let soma = 0
  let diagonal = 0
  pontosQueAlcancam(pocas.pocas, pocas.alcance, px, py, (p, dx, dy, i) => {
    const f = pocas.formas[i]
    const ao = (dx * f.cos + dy * f.sen) / f.k
    const at = (-dx * f.sen + dy * f.cos) * f.k
    const d2 = (ao * ao + at * at) / (p.r * POCA_ALCANCE) ** 2
    if (d2 >= 1) return
    const peso = (1 - d2) ** 2
    soma += peso
    diagonal += (peso * (dx + dy) * Math.SQRT1_2) / p.r
  })
  diagonalNaPoca = soma > 0 ? diagonal / soma : 0
  return soma
}

/**
 * A poça por cima do chão: a lama em volta escurece; a água enche o buraco de lama e o ombro das pedras da beira (o
 * alto delas fica de fora). Vista de cima com a luz de cima à esquerda, a água é um buraco: escura junto da beira de
 * cima à esquerda (a sombra da margem) e clareando para baixo à direita (o reflexo do céu).
 */
function comAgua(chao: Chao, c: Rgb, uu: number, vv: number, dentro: number): Rgb {
  const celula = Math.floor(vv * chao.alcance.grade) * chao.alcance.grade + Math.floor(uu * chao.alcance.grade)
  if (chao.alcance.baldes[celula].length === 0) return c
  const px = uu + (fbm(uu, vv, POCA_TORCAO_ESCALA, 2, SEMENTE + 31) * POCA_TORCAO) / CASAS
  const py = vv + (fbm(uu, vv, POCA_TORCAO_ESCALA, 2, SEMENTE + 32) * POCA_TORCAO) / CASAS
  const campo = campoDaAgua(chao, px, py)
  if (campo <= LIMIAR_DA_AGUA * 0.45) return c
  const topo = passoSuave(0.01, 0.06, dentro)
  const beira = passoSuave(LIMIAR_DA_AGUA * 0.45, LIMIAR_DA_AGUA, campo)
  const molhado = luz(c, -0.06 * beira * (1 - 0.5 * topo))
  const nivel = (campo - LIMIAR_DA_AGUA) / LIMIAR_DA_AGUA
  const agua = passoSuave(0, 0.12, nivel - PEDRA_FORA_DA_AGUA * topo) * (0.92 - 0.3 * topo)
  if (agua <= 0) return molhado
  const reflexo = passoSuave(-0.7, 0.5, diagonalNaPoca)
  return misturar(molhado, misturar(AGUA, REFLEXO, reflexo), agua)
}

/**
 * A cor das pedras com lama no ponto (u, v) do ladrilho (8 casas por lado).
 * As pedras e as poças dão a volta: a do lado de lá da emenda aparece inteira do lado de cá.
 */
export function texturaPedrasComLama(u: number, v: number): number {
  const uu = naVoltaDoLadrilho(u)
  const vv = naVoltaDoLadrilho(v)
  const chao = montar()
  // O lugar torcido onde o ponto procura a sua pedra: a borda serpenteia.
  const x = uu * CASAS + fbm(uu, vv, TORCAO_ESCALA, 2, SEMENTE + 1) * TORCAO
  const y = vv * CASAS + fbm(uu, vv, TORCAO_ESCALA, 2, SEMENTE + 2) * TORCAO
  // A pedra mais perto: a distância assinada até a borda dela (negativa dentro), o rumo de dentro para fora e o
  // ponto no corpo dela (uma ponta da pedra é mais estreita: a largura muda ao longo do comprimento).
  const celula = resto(Math.floor(y / CELULA), CELULAS) * CELULAS + resto(Math.floor(x / CELULA), CELULAS)
  let d = Infinity
  let dona = -1
  let nx = 0
  let ny = 0
  let donaX = 0
  let donaY = 0
  for (let k = chao.inicio[celula]; k < chao.inicio[celula + 1]; k += 1) {
    const i = chao.indices[k]
    let dx = x - chao.x[i]
    let dy = y - chao.y[i]
    dx -= CASAS * Math.round(dx / CASAS)
    dy -= CASAS * Math.round(dy / CASAS)
    const cos = chao.cos[i]
    const sen = chao.sen[i]
    const a = chao.a[i]
    const lx = dx * cos + dy * sen
    const ly = (-dx * sen + dy * cos) / (1 + chao.afina[i] * Math.max(-1, Math.min(1, lx / a)))
    const r = chao.canto[i]
    const qx = Math.abs(lx) - (a - r)
    const qy = Math.abs(ly) - (chao.b[i] - r)
    let di: number
    let gx: number
    let gy: number
    if (qx > 0 || qy > 0) {
      // Fora do miolo: a distância ao canto arredondado ou ao lado reto.
      const ox = qx > 0 ? qx : 0
      const oy = qy > 0 ? qy : 0
      const comprimento = Math.sqrt(ox * ox + oy * oy)
      di = comprimento - r
      gx = (ox / comprimento) * Math.sign(lx)
      gy = (oy / comprimento) * Math.sign(ly)
    } else {
      di = Math.max(qx, qy) - r
      gx = qx > qy ? Math.sign(lx) : 0
      gy = qx > qy ? 0 : Math.sign(ly)
    }
    if (di < d) {
      d = di
      dona = i
      nx = gx * cos - gy * sen
      ny = gx * sen + gy * cos
      donaX = lx
      donaY = ly
    }
  }
  // A borda gasta: os gomos largos e as lascas miúdas.
  d += (valor(uu * GOMO_ESCALA, vv * GOMO_ESCALA, GOMO_ESCALA, SEMENTE + 11) - 0.5) * 2 * GOMO
  d += (valor(uu * LASCA_ESCALA, vv * LASCA_ESCALA, LASCA_ESCALA, SEMENTE + 3) - 0.5) * 2 * LASCA
  const dentro = -d
  const naPedra = dona < 0 ? 0 : passoSuave(-PASSAGEM, PASSAGEM, dentro)
  let c: Rgb
  if (naPedra >= 1) c = corDaPedra(chao, dona, dentro, nx, ny, donaX, donaY, uu, vv)
  else if (naPedra <= 0) c = corDaLama(d, nx, ny, uu, vv)
  else c = misturar(corDaLama(d, nx, ny, uu, vv), corDaPedra(chao, dona, dentro, nx, ny, donaX, donaY, uu, vv), naPedra)
  return empacotar(comAgua(chao, c, uu, vv, dentro))
}
