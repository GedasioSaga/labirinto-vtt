/**
 * ÁGUAS DO TELHADO de uma Sala: para cada ponto do mapa, qual água (o plano
 * inclinado que desce até uma borda da parede) cobre o ponto, a que altura e
 * em que posição ao longo da borda. É o esqueleto reto do telhado conferido
 * ponto a ponto, sem montar o esqueleto: a mesma conta serve para o
 * retângulo (4 águas, cumeeira de w − h), o L, o T, o U e o octógono.
 *
 * - Dentro da parede, a água dona é a da borda mais próxima (distância ao
 *   segmento). Cada água sobe 1 px por px a partir da sua borda.
 * - Onde o ponto mais próximo é um vértice CÔNCAVO (a quina de dentro do L),
 *   as duas bordas dele seguem o próprio plano além da ponta, e vence a de
 *   reta suporte MAIS LONGE (o plano mais alto). A emenda entre as duas é a
 *   bissetriz: o rincão reto saindo da quina. (Vencer a de reta mais perto,
 *   como dizia o plano, troca os lados da bissetriz: a água fica do lado
 *   errado e abre um rasgo de altura zero no meio da casa. O teste
 *   "forma livre sem degrau" pega isso.)
 * - Fora da parede, até `BEIRAL_PX`, o telhado continua o mesmo plano: é o
 *   beiral. Nas quinas de fora ele faz canto vivo (meia-esquadria), como o
 *   retângulo do protótipo aprovado em 18/10.
 *
 * Puro, sem DOM: o teste mede a conta, e `texturas/telhado.ts` pinta em cima.
 */

/** Quanto o telhado passa da parede, em px do mapa (decisão de 18/10/2026). */
export const BEIRAL_PX = 8

export interface PontoDoTelhado {
  readonly x: number
  readonly y: number
}

/**
 * O polígono já limpo e as contas fixas de cada borda. A borda `i` vai do
 * ponto `i` ao `i + 1` (o último fecha no primeiro).
 */
export interface GeometriaDasAguas {
  readonly n: number
  /** Primeiro ponto de cada borda. */
  readonly ax: Float64Array
  readonly ay: Float64Array
  /** Direção da borda (unitária). */
  readonly dx: Float64Array
  readonly dy: Float64Array
  readonly comprimento: Float64Array
  /** Normal unitária apontando para DENTRO da sala. */
  readonly nx: Float64Array
  readonly ny: Float64Array
  /** 1 = o ponto `i` (começo da borda `i`) é uma quina côncava. */
  readonly concavo: Uint8Array
  /** A borda que chega no ponto `i` (a de antes da borda `i`). */
  readonly anterior: Int32Array
  /** Onde a borda começa na régua da reta dela (`a · d`): bordas alinhadas dividem a mesma régua. */
  readonly regua: Float64Array
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
  /** Rascunho por ponto (distância com sinal e posição ao longo de cada borda), reaproveitado sem alocar. */
  readonly s: Float64Array
  readonly t: Float64Array
}

export interface AguaNoPonto {
  /** Borda dona da água. -1 = sem telhado (além do beiral, ou ponto inválido). */
  readonly agua: number
  /** 0 na ponta do beiral, `BEIRAL_PX` na linha da parede, e sobe 1 por px para dentro. */
  readonly altura: number
  /** Px ao longo da borda dona, a partir do primeiro ponto dela (passa de 0..comprimento nas quinas). */
  readonly aoLongo: number
  /** A água do outro lado da emenda mais próxima (cumeeira, espigão ou rincão). -1 = nenhuma. */
  readonly vizinha: number
  /** Px até essa emenda. `Infinity` sem vizinha. */
  readonly ateEmenda: number
  /** A emenda mais próxima é um rincão (vale) e não espigão ou cumeeira. */
  readonly rincao: boolean
}

/** A mesma coisa, mutável: o laço da textura reaproveita um objeto só. */
export interface AmostraDaAgua {
  agua: number
  /** Distância com sinal até a reta da borda dona: + dentro, − no beiral. */
  dist: number
  aoLongo: number
  vizinha: number
  ateEmenda: number
  rincao: boolean
}

export function novaAmostraDaAgua(): AmostraDaAgua {
  return { agua: -1, dist: 0, aoLongo: 0, vizinha: -1, ateEmenda: Infinity, rincao: false }
}

const PERTO = 1e-9

function pontoUsavel(p: unknown): p is PontoDoTelhado {
  if (typeof p !== 'object' || p === null) return false
  const { x, y } = p as { x: unknown; y: unknown }
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
}

/**
 * Prepara o polígono. Ponto sem número, ponto repetido e o último igual ao
 * primeiro são descartados. `null` = não sobra telhado (menos de 3 pontos,
 * área zero, ou nem é uma lista): quem chama não desenha, ninguém lança.
 */
export function prepararAguas(pontos: readonly PontoDoTelhado[]): GeometriaDasAguas | null {
  if (!Array.isArray(pontos)) return null
  const limpos: PontoDoTelhado[] = []
  for (const p of pontos as unknown[]) {
    if (!pontoUsavel(p)) continue
    const ultimo = limpos[limpos.length - 1]
    if (ultimo === undefined || Math.hypot(p.x - ultimo.x, p.y - ultimo.y) > PERTO) limpos.push(p)
  }
  while (limpos.length > 1 && Math.hypot(limpos[0].x - limpos[limpos.length - 1].x, limpos[0].y - limpos[limpos.length - 1].y) <= PERTO) limpos.pop()
  const n = limpos.length
  if (n < 3) return null

  let areaDupla = 0
  for (let i = 0; i < n; i += 1) {
    const a = limpos[i]
    const b = limpos[(i + 1) % n]
    areaDupla += a.x * b.y - b.x * a.y
  }
  if (!(Math.abs(areaDupla) > 1e-6)) return null
  // Com área positiva o lado de dentro fica à esquerda de cada borda; com negativa, à direita.
  const lado = areaDupla > 0 ? 1 : -1

  const ax = new Float64Array(n)
  const ay = new Float64Array(n)
  const dx = new Float64Array(n)
  const dy = new Float64Array(n)
  const comprimento = new Float64Array(n)
  const nx = new Float64Array(n)
  const ny = new Float64Array(n)
  const regua = new Float64Array(n)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < n; i += 1) {
    const a = limpos[i]
    const b = limpos[(i + 1) % n]
    const c = Math.hypot(b.x - a.x, b.y - a.y)
    ax[i] = a.x
    ay[i] = a.y
    dx[i] = (b.x - a.x) / c
    dy[i] = (b.y - a.y) / c
    comprimento[i] = c
    nx[i] = -dy[i] * lado
    ny[i] = dx[i] * lado
    regua[i] = a.x * dx[i] + a.y * dy[i]
    minX = Math.min(minX, a.x)
    minY = Math.min(minY, a.y)
    maxX = Math.max(maxX, a.x)
    maxY = Math.max(maxY, a.y)
  }
  const concavo = new Uint8Array(n)
  const anterior = new Int32Array(n)
  for (let i = 0; i < n; i += 1) {
    anterior[i] = (i - 1 + n) % n
    const virada = dx[anterior[i]] * dy[i] - dy[anterior[i]] * dx[i]
    concavo[i] = virada * lado < -1e-9 ? 1 : 0
  }
  return { n, ax, ay, dx, dy, comprimento, nx, ny, concavo, anterior, regua, minX, minY, maxX, maxY, s: new Float64Array(n), t: new Float64Array(n) }
}

/** Ponto dentro do polígono (par ou ímpar de cruzamentos). Sobre a parede pode dar qualquer um dos dois. */
export function dentroDoPoligono(g: GeometriaDasAguas, x: number, y: number): boolean {
  let dentro = false
  const { n, ax, ay } = g
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    if (ay[i] > y !== ay[j] > y) {
      const xc = ax[j] + ((y - ay[j]) * (ax[i] - ax[j])) / (ay[i] - ay[j])
      if (x < xc) dentro = !dentro
    }
  }
  return dentro
}

/**
 * Os x em que a linha horizontal `y` cruza a parede, em ordem. A textura
 * anda a linha da imagem trocando dentro/fora a cada cruzamento, em vez de
 * testar o polígono inteiro em cada pixel. Devolve quantos escreveu em `saida`
 * (que precisa ter pelo menos `n` lugares).
 */
export function cruzamentosDaLinha(g: GeometriaDasAguas, y: number, saida: Float64Array): number {
  const { n, ax, ay } = g
  let k = 0
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    if (ay[i] > y !== ay[j] > y) {
      saida[k] = ax[j] + ((y - ay[j]) * (ax[i] - ax[j])) / (ay[i] - ay[j])
      k += 1
    }
  }
  // Ordenação por inserção: são poucos cruzamentos.
  for (let i = 1; i < k; i += 1) {
    const v = saida[i]
    let j = i - 1
    while (j >= 0 && saida[j] > v) {
      saida[j + 1] = saida[j]
      j -= 1
    }
    saida[j + 1] = v
  }
  return k
}

function distanciaAteEmenda(g: GeometriaDasAguas, a: number, b: number, folgaDeAltura: number): number {
  // As duas águas sobem com inclinação 1 nas normais delas: a diferença de altura cresce |na − nb| por px.
  // `Math.sqrt` e não `Math.hypot`: roda em todo pixel, e o hypot do V8 custa várias vezes mais.
  const ex = g.nx[a] - g.nx[b]
  const ey = g.ny[a] - g.ny[b]
  const k = Math.sqrt(ex * ex + ey * ey)
  return k > 1e-9 ? folgaDeAltura / k : Infinity
}

/**
 * A água no ponto (x, y), escrevendo em `saida`. `dentro` vem de quem chama
 * (a textura sabe pela linha; `aguaNoPonto` pergunta ao polígono).
 * `alcanceFora` = até quantos px fora da parede ainda é telhado. Devolve
 * `false` quando o ponto não tem telhado; aí `saida.dist` = −(distância até
 * a parede, com a meia-esquadria das quinas), ou −Infinity.
 *
 * Dentro e fora são a mesma disputa com o sinal trocado: dentro vence a
 * MENOR altura entre as bordas cujo pé cai nelas e as cunhas das quinas
 * côncavas; fora vence a parede mais perto entre as bordas e as quinas
 * convexas (meia-esquadria). Roda um milhão de vezes por textura: estado em
 * variável local e nada de função auxiliar no meio (no Node, 1024 × 1024, a
 * conta das águas caiu de 95 ms com Math.hypot e estado no módulo para 47 ms).
 */
export function amostrarAgua(g: GeometriaDasAguas, x: number, y: number, dentro: boolean, alcanceFora: number, saida: AmostraDaAgua): boolean {
  const n = g.n
  const { ax, ay, dx, dy, nx, ny, comprimento, concavo, anterior, s, t } = g
  const sinal = dentro ? 1 : -1
  let melhor = Infinity
  let dona = -1
  let segundo = Infinity
  let donaDoSegundo = -1
  let folgaInterna = Infinity
  let rivalInterna = -1

  // A borda cujo pé da perpendicular cai nela mesma (dentro: do lado de dentro; fora: do lado de fora).
  for (let i = 0; i < n; i += 1) {
    const px = x - ax[i]
    const py = y - ay[i]
    const ti = px * dx[i] + py * dy[i]
    const si = px * nx[i] + py * ny[i]
    t[i] = ti
    s[i] = si
    const valor = sinal * si
    if (ti >= 0 && ti <= comprimento[i] && valor >= 0) {
      if (valor < melhor) {
        if (i !== dona) {
          segundo = melhor
          donaDoSegundo = dona
        }
        melhor = valor
        dona = i
        folgaInterna = Infinity
        rivalInterna = -1
      } else if (i !== dona && valor < segundo) {
        segundo = valor
        donaDoSegundo = i
      }
    }
  }
  // A cunha da quina: dentro, a côncava (as duas bordas seguem além da ponta e vence o plano mais
  // alto: o rincão); fora, a convexa (meia-esquadria: vence a reta mais longe, o espigão até o beiral).
  const tipo = dentro ? 1 : 0
  for (let i = 0; i < n; i += 1) {
    if (concavo[i] !== tipo) continue
    const a = anterior[i]
    if (t[a] > comprimento[a] && t[i] < 0) {
      const va = sinal * s[a]
      const vi = sinal * s[i]
      const o = va >= vi ? a : i
      const valor = va >= vi ? va : vi
      if (valor < melhor) {
        if (o !== dona) {
          segundo = melhor
          donaDoSegundo = dona
        }
        melhor = valor
        dona = o
        folgaInterna = Math.abs(va - vi)
        rivalInterna = o === a ? i : a
      } else if (o !== dona && valor < segundo) {
        segundo = valor
        donaDoSegundo = o
      }
    }
  }

  if (dentro && dona < 0) {
    // Só na linha da parede, por arredondamento: fica com a borda mais perto.
    let perto = Infinity
    for (let i = 0; i < n; i += 1) {
      const k = Math.min(Math.max(t[i], 0), comprimento[i])
      const ex = x - (ax[i] + dx[i] * k)
      const ey = y - (ay[i] + dy[i] * k)
      const d = ex * ex + ey * ey
      if (d < perto) {
        perto = d
        dona = i
      }
    }
    if (dona < 0) return false
  }
  if (!dentro && (dona < 0 || melhor > alcanceFora)) {
    // Sem telhado, mas diz a que distância ele está: essa distância anda no máximo 1 px por px,
    // então a textura pula esse tanto de pixels vazios sem perguntar de novo.
    saida.agua = -1
    saida.dist = dona < 0 ? -Infinity : -melhor
    return false
  }

  saida.agua = dona
  saida.dist = s[dona]
  saida.aoLongo = t[dona]
  saida.vizinha = -1
  saida.ateEmenda = Infinity
  saida.rincao = false
  if (rivalInterna >= 0) {
    // Dentro, a emenda da cunha é o rincão; fora, a da quina é o espigão chegando no beiral.
    saida.ateEmenda = distanciaAteEmenda(g, dona, rivalInterna, folgaInterna)
    saida.vizinha = rivalInterna
    saida.rincao = dentro
  }
  if (donaDoSegundo >= 0) {
    const d = distanciaAteEmenda(g, dona, donaDoSegundo, segundo - melhor)
    if (d < saida.ateEmenda) {
      // Dentro vence a mais baixa (cumeeira e espigão); fora vence a mais alta (os beirais se cruzam num rincão).
      saida.ateEmenda = d
      saida.vizinha = donaDoSegundo
      saida.rincao = !dentro
    }
  }
  return true
}

const AMOSTRA = novaAmostraDaAgua()
const SEM_AGUA: AguaNoPonto = { agua: -1, altura: 0, aoLongo: 0, vizinha: -1, ateEmenda: Infinity, rincao: false }

/** A água no ponto (x, y) do mapa. Ponto inválido ou fora do beiral: `agua` −1. */
export function aguaNoPonto(g: GeometriaDasAguas, x: number, y: number): AguaNoPonto {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return SEM_AGUA
  if (!amostrarAgua(g, x, y, dentroDoPoligono(g, x, y), BEIRAL_PX, AMOSTRA)) return SEM_AGUA
  return {
    agua: AMOSTRA.agua,
    altura: AMOSTRA.dist + BEIRAL_PX,
    aoLongo: AMOSTRA.aoLongo,
    vizinha: AMOSTRA.vizinha,
    ateEmenda: AMOSTRA.ateEmenda,
    rincao: AMOSTRA.rincao,
  }
}
