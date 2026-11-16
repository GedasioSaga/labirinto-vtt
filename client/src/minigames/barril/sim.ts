/**
 * SIMULAÇÃO DO BARRIL: quebrar o barril no ritmo dos aros. O brilho percorre
 * os três aros de ferro no andamento, como uma contagem; golpe no pico do
 * brilho afrouxa o aro e racha as aduelas, golpe fora do tempo escorrega no
 * ferro, tira um golpe e trava o martelo por um instante. Lógica pura, sem
 * DOM, em passo fixo: a mesma semente dá a mesma partida no jogo, no robô e
 * nos testes.
 */
import { inteiro, rngDe } from '../abrir/rng'
import { DT, LIMITE_S, PASSOS_POR_AMOSTRA } from '../abrir/tipos'
import type { Rng } from '../abrir/rng'
import type { Dificuldade, Entrada, Evento, Fim } from '../abrir/tipos'

/** Números de ajuste de uma dificuldade. Tempos em s. */
export interface ParametrosDoBarril {
  /** Intervalo entre batidas (60 / BPM). */
  batida: number
  /** Instante do primeiro pico: a preparação antes da primeira batida. */
  primeiroPico: number
  /** Quanto o brilho leva subindo até o pico (meta: ≥ 0,3, para dar para antecipar). */
  subida: number
  /** Quanto o brilho leva caindo depois do pico. */
  queda: number
  /** Meia-largura da janela do golpe certo: |golpe − pico| ≤ janela. */
  janela: number
  /** Golpes certos, já descontados os escorregões, até abrir. */
  meta: number
  /** Chance de uma batida chegar meio tempo antes (síncope); 0 = andamento fixo. */
  sincope: number
  /** Subida do brilho na batida adiantada, mais curta (meta: ≥ 0,3). */
  subidaSincope: number
  /** true = aro sorteado a cada batida, nunca o mesmo duas vezes seguidas; false = de cima para baixo, em ciclo. */
  aroSorteado: boolean
  /** Golpes perdidos num escorregão (nunca abaixo do último aro solto). */
  perdaEscorrega: number
  /** Martelo travado depois de um escorregão; golpes nesse tempo são ignorados. */
  trava: number
}

/**
 * Tabela de ajuste. Afinada pelo placar do robô (robo.test.ts, 400 partidas
 * por dificuldade): Normal com vitória ≥ 70% e mediana entre 10 e 16 s,
 * Difícil entre 30% e 55%, martelar sem ritmo < 10%.
 */
export const DIF: Readonly<Record<Dificuldade, ParametrosDoBarril>> = {
  // 92 BPM, aros em ciclo e andamento fixo: dá para entrar no ritmo e antecipar.
  normal: {
    batida: 0.65, primeiroPico: 1.2, subida: 0.4, queda: 0.15, janela: 0.12, meta: 13,
    sincope: 0, subidaSincope: 0.4, aroSorteado: false, perdaEscorrega: 1, trava: 0.35,
  },
  // 118 BPM, aro sorteado e, de vez em quando, uma batida adiantada meio tempo.
  dificil: {
    batida: 0.51, primeiroPico: 1.2, subida: 0.4, queda: 0.15, janela: 0.08, meta: 14,
    sincope: 0.2, subidaSincope: 0.3, aroSorteado: true, perdaEscorrega: 1, trava: 0.35,
  },
}

/** Aros de ferro, de cima (0) para baixo (2). */
export const AROS = 3
/** Duração da animação de abrir depois da vitória, em s. */
export const DUR_ABRIR = 0.5
/** Batidas do começo sem síncope: a pessoa pega o andamento antes da primeira surpresa. */
const BATIDAS_SEM_SINCOPE = 2
/** Instante "nunca" dos marcadores de golpe: longe o bastante para qualquer conta de tempo dar zero. */
const NUNCA = -1e9
/** Passos até o teto da tentativa (contar passos evita erro de ponto flutuante no fim). */
const PASSOS_DO_LIMITE = Math.round(LIMITE_S / DT)
/** Folga nas comparações de tempo: 1/120 não é exato em ponto flutuante. */
const EPS = 1e-9
/** Cada golpe e cada escorregão marcam exatamente uma amostra de 0,1 s do gráfico. */
const JANELA_DA_MARCA = PASSOS_POR_AMOSTRA * DT

/** Uma batida: o aro que acende e o instante do pico do brilho. */
export interface Pulso {
  /** Instante do pico, em s. */
  pico: number
  aro: number
  /** Quanto o brilho leva subindo até o pico, em s. */
  subida: number
  /** Batida adiantada meio tempo (só no Difícil). */
  sincope: boolean
  /** Já levou o golpe certo (uma batida só aceita um). */
  acertado: boolean
}

/**
 * Evento do barril. O golpe leva também a força (progresso depois do golpe,
 * 0..1), para o som crescer com o progresso; `v` continua sendo o aro.
 */
export interface EventoDoBarril extends Evento {
  forca?: number
}

/** Estado mutável único de uma tentativa. */
export interface Estado {
  readonly dif: Dificuldade
  readonly d: ParametrosDoBarril
  /** Passos dados; o tempo sai daqui. */
  passos: number
  t: number
  fim: Fim | null
  /** Instante do fim, em s (a animação de abrir conta daqui). */
  tFim: number
  /** Golpes certos líquidos, de 0 até d.meta. */
  golpes: number
  /** Aros já soltos (o último solta ao abrir). */
  soltos: number
  /** Golpes em que cada aro solta: 1/3 e 2/3 da meta. */
  readonly limiares: readonly number[]
  /** Todas as batidas da tentativa, em ordem de pico. */
  readonly pulsos: readonly Pulso[]
  /** Próxima batida a soar o tique. */
  iBatida: number
  /** Martelo travado até este instante (depois de um escorregão). */
  travadoAte: number
  /** Último golpe certo e o aro que ele acertou. */
  tGolpe: number
  aroGolpe: number
  /** Último escorregão. */
  tEscorrega: number
  /** Semente da arte (onde nascem as rachaduras), sorteada por tentativa. */
  readonly semRacha: number
  ev: EventoDoBarril[]
}

/** Outro aro que não o anterior (no Difícil o brilho nunca repete o aro seguido). */
function outroAro(r: Rng, anterior: number): number {
  if (anterior < 0) return inteiro(r, AROS)
  return (anterior + 1 + inteiro(r, AROS - 1)) % AROS
}

/**
 * Batidas da tentativa inteira, sorteadas na criação. A síncope adianta uma
 * batida meio tempo sem mudar a grade: a seguinte volta para o andamento.
 */
function gerarPulsos(d: ParametrosDoBarril, r: Rng): Pulso[] {
  const pulsos: Pulso[] = []
  let aro = -1
  let sincopeAntes = false
  for (let k = 0; ; k++) {
    const grade = d.primeiroPico + k * d.batida
    if (grade > LIMITE_S + d.batida) break
    const sincope: boolean = k >= BATIDAS_SEM_SINCOPE && !sincopeAntes && r() < d.sincope
    aro = d.aroSorteado ? outroAro(r, aro) : k % AROS
    pulsos.push({ pico: sincope ? grade - d.batida / 2 : grade, aro, subida: sincope ? d.subidaSincope : d.subida, sincope, acertado: false })
    sincopeAntes = sincope
  }
  return pulsos
}

/** Nova tentativa. A sorte do jogo vem de `semente + '|jogo'`. */
export function criar(semente: string, dif: Dificuldade): Estado {
  const d = DIF[dif]
  const r = rngDe(semente + '|jogo')
  const pulsos = gerarPulsos(d, r)
  return {
    dif, d, passos: 0, t: 0, fim: null, tFim: 0, golpes: 0, soltos: 0,
    limiares: [Math.round(d.meta / 3), Math.round((2 * d.meta) / 3)],
    pulsos, iBatida: 0, travadoAte: 0,
    tGolpe: NUNCA, aroGolpe: 0, tEscorrega: NUNCA,
    semRacha: inteiro(r, 1e9),
    ev: [],
  }
}

/** Índice do primeiro pulso com pico depois de t (busca binária: os pulsos estão em ordem). */
function primeiroDepois(pulsos: readonly Pulso[], t: number): number {
  let a = 0
  let b = pulsos.length
  while (a < b) {
    const m = (a + b) >> 1
    if (pulsos[m].pico <= t) a = m + 1
    else b = m
  }
  return a
}

/** Última batida com pico até t; null antes da primeira. */
export function ultimoPulso(e: Readonly<Estado>, t: number): Pulso | null {
  const i = primeiroDepois(e.pulsos, t) - 1
  return i >= 0 ? e.pulsos[i] : null
}

/** Próxima batida com pico depois de t; null depois da última. */
export function proximoPulso(e: Readonly<Estado>, t: number): Pulso | null {
  const i = primeiroDepois(e.pulsos, t)
  return i < e.pulsos.length ? e.pulsos[i] : null
}

/** A batida mais perto de t (a que um golpe em t disputa). */
function pulsoMaisPerto(e: Readonly<Estado>, t: number): Pulso | null {
  const antes = ultimoPulso(e, t)
  const depois = proximoPulso(e, t)
  if (antes === null) return depois
  if (depois === null) return antes
  return t - antes.pico <= depois.pico - t ? antes : depois
}

/**
 * Forma do brilho de uma batida em t: sobe em linha reta durante a subida,
 * pico 1 no tempo da batida e cai em `queda`. Sempre a mesma forma, para quem
 * joga poder antecipar o pico pelo começo da subida.
 */
export function brilhoDoPulso(p: Readonly<Pulso>, queda: number, t: number): number {
  const desde = t - p.pico
  if (desde < -p.subida || desde > queda) return 0
  return desde <= 0 ? 1 + desde / p.subida : 1 - desde / queda
}

/** Brilho de um aro em t (0..1). Depois do fim os aros apagam. */
export function brilhoEm(e: Readonly<Estado>, aro: number, t: number): number {
  if (e.fim !== null && t >= e.tFim) return 0
  const subidaMaxima = Math.max(e.d.subida, e.d.subidaSincope)
  let b = 0
  // Só as batidas perto de t brilham: da que ainda pode estar caindo até a primeira que nem começou a subir.
  for (let i = primeiroDepois(e.pulsos, t - e.d.queda - EPS); i < e.pulsos.length; i++) {
    const p = e.pulsos[i]
    if (p.pico - subidaMaxima > t) break
    if (p.aro === aro) b = Math.max(b, brilhoDoPulso(p, e.d.queda, t))
  }
  return b
}

/** Progresso que um escorregão não tira: o do último aro solto. */
function piso(e: Readonly<Estado>): number {
  return e.soltos > 0 ? e.limiares[Math.min(e.soltos, e.limiares.length) - 1] : 0
}

function golpear(e: Estado): void {
  const p = pulsoMaisPerto(e, e.t)
  if (p !== null && !p.acertado && Math.abs(e.t - p.pico) <= e.d.janela + EPS) {
    p.acertado = true
    e.golpes++
    e.tGolpe = e.t
    e.aroGolpe = p.aro
    e.ev.push({ nome: 'golpe', v: p.aro, forca: e.golpes / e.d.meta })
    if (e.soltos < e.limiares.length && e.golpes >= e.limiares[e.soltos]) {
      e.ev.push({ nome: 'aro', v: e.soltos })
      e.soltos++
    }
    return
  }
  // Fora da janela, ou segundo golpe na mesma batida: escorrega no ferro.
  e.golpes = Math.max(piso(e), e.golpes - e.d.perdaEscorrega)
  e.travadoAte = e.t + e.d.trava
  e.tEscorrega = e.t
  e.ev.push({ nome: 'escorrega' })
}

/** O tique de cada batida soa no pico, para quem joga de ouvido. */
function soarBatidas(e: Estado): void {
  while (e.iBatida < e.pulsos.length && e.pulsos[e.iBatida].pico <= e.t + EPS) {
    e.ev.push({ nome: 'batida', v: e.pulsos[e.iBatida].aro })
    e.iBatida++
  }
}

function terminar(e: Estado, fim: Fim): void {
  e.fim = fim
  e.tFim = e.t
  if (fim === 'abriu') e.soltos = AROS
  e.ev.push({ nome: fim })
}

/**
 * Avança um passo de DT. Depois do fim só o relógio anda (a animação de
 * abrir), sem ler a entrada e sem eventos, e devolve sempre o mesmo fim.
 */
export function passo(e: Estado, entrada: Readonly<Entrada>): Fim | null {
  e.ev = []
  e.passos++
  e.t = e.passos * DT
  if (e.fim !== null) return e.fim
  soarBatidas(e)
  if (entrada.toque >= 0 && e.t >= e.travadoAte - EPS) golpear(e)
  if (e.golpes >= e.d.meta) terminar(e, 'abriu')
  else if (e.passos >= PASSOS_DO_LIMITE) terminar(e, 'tempo')
  return e.fim
}

/** Eventos do último passo (a lista é refeita a cada passo). */
export const eventos = (e: Readonly<Estado>): readonly EventoDoBarril[] => e.ev

/** Tempo da tentativa, em s. */
export const tempo = (e: Readonly<Estado>): number => e.t

/** Como a tentativa acabou; null enquanto corre. */
export const fim = (e: Readonly<Estado>): Fim | null => e.fim

/** Progresso até abrir, 0..1. */
export const progresso = (e: Readonly<Estado>): number => e.golpes / e.d.meta

/** Animação de abrir, 0..1 em DUR_ABRIR depois da vitória; 1 = aberto. */
export function abertura(e: Readonly<Estado>): number {
  if (e.fim !== 'abriu') return 0
  return Math.min(1, (e.t - e.tFim) / DUR_ABRIR)
}

/** 1 se a marca (golpe ou escorregão) caiu nesta amostra de 0,1 s. */
const marcouAgora = (e: Readonly<Estado>, t0: number): number => (e.t - t0 < JANELA_DA_MARCA - EPS ? 1 : 0)

/**
 * O que o gráfico do movimento e o robô leem: brilho de cada aro, progresso
 * e as marcas de golpe certo e de escorregão.
 */
export function amostra(e: Readonly<Estado>): Readonly<Record<string, number>> {
  return {
    b0: brilhoEm(e, 0, e.t),
    b1: brilhoEm(e, 1, e.t),
    b2: brilhoEm(e, 2, e.t),
    progresso: progresso(e),
    golpe: marcouAgora(e, e.tGolpe),
    escorrega: marcouAgora(e, e.tEscorrega),
  }
}
