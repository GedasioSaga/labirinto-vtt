/**
 * ROBÔS DO BARRIL (METAS.md, seção 1). O humano só enxerga o jogo pelo
 * `Olho` (atraso de 250 ± 60 ms, relê a cada 0,15 s, erra a leitura em
 * ± 0,03) e decide a 60 Hz. Ele antecipa como gente: o brilho sobe sempre da
 * mesma forma, então pela altura do brilho dá para prever o pico, e o
 * andamento vira um metrônomo interno, corrigido a cada batida vista (o
 * modelo clássico de correção de fase e de período de quem bate junto com um
 * metrônomo). Compensa só o atraso MÉDIO do próprio olho, nunca o exato de
 * cada leitura; a variação do atraso, o erro de leitura e o erro da mão
 * (σ 50 ms) é o que faz ele errar. O ruim martela sem olhar.
 */
import { entre, rngDe } from '../abrir/rng'
import { ERRO_DA_MAO, Olho, PASSOS_POR_DECISAO, REACAO_MEDIA, RELEITURA, erroDaMao, lerComErro } from '../abrir/robo'
import { SEM_ENTRADA } from '../abrir/tipos'
import { AROS, DIF, amostra } from './sim'
import type { Visto } from '../abrir/robo'
import type { Dificuldade, Entrada, Politica } from '../abrir/tipos'
import type { Estado } from './sim'

/** O atraso que o robô desconta: reação média mais metade da releitura (não sabe o atraso de cada leitura). */
const ATRASO_MEDIO = REACAO_MEDIA + RELEITURA / 2
/** Chance de se distrair numa batida e não golpear. */
const DISTRACAO = 0.05
/** Acima disto o aro está aceso para o olho (o erro de leitura de ± 0,03 quase nunca passa daqui num aro apagado). */
const LIMIAR_ACESO = 0.12
/** Acima disto o brilho está no pico: a leitura não diz mais quanto falta. */
const QUASE_PICO = 0.97
/**
 * Duas leituras do mesmo aro com picos estimados a menos disto são a mesma
 * batida. Duas batidas seguidas nunca usam o mesmo aro, e o mesmo aro só volta
 * depois de 1,5 batida (0,77 s no Difícil), então a conta não as mistura.
 */
const MESMA_BATIDA = 0.35
/** Peso do metrônomo interno contra cada leitura do brilho, na previsão do pico. */
const PESO_METRONOMO = 2
/** Correção de fase e de período a cada batida vista. */
const ALFA = 0.5
const BETA = 0.25
/** Período plausível de batida, em s: fora disso a pessoa descarta a conta. */
const PERIODO_MIN = 0.25
const PERIODO_MAX = 1.5
/** Sem metrônomo ainda, a janela (em s) em que um aro aceso é a batida que acabou de ser tratada. */
const JANELA_SEM_RITMO = 0.2
/** Com metrônomo, essa janela em fração do período. */
const JANELA_PROPRIA = 0.4
/** Passou disto do momento planejado, a pessoa deixa a batida ir em vez de golpear atrasado. */
const TARDE_DEMAIS = 0.1
/** Batidas vistas guardadas por até este tempo, em s. */
const MEMORIA_S = 2

const TOQUE: Readonly<Entrada> = { segurando: false, toque: 0 }

type Leitura = Readonly<Record<string, number>>

/** Uma batida que o olho viu acender: estimativas do pico, uma por decisão enquanto a subida é vista. */
interface BatidaVista {
  aro: number
  soma: number
  n: number
  /** Leituras distintas que viram a subida (o peso dela contra o metrônomo). */
  leituras: number
  /** Já entrou no metrônomo interno. */
  sentida: boolean
  /** Já foi golpeada ou deixada ir: não vale de novo. */
  tratada: boolean
}

/** Uma batida já tratada: quando e qual aro (-1 = golpeada pelo metrônomo antes de ver o aro). */
interface Tratada {
  t: number
  aro: number
}

interface Metronomo {
  /** Instante da última batida que o relógio interno marcou. */
  fase: number
  periodo: number
  /** Batidas vistas seguidas fora do andamento: duas seguidas e a pessoa recomeça a contagem. */
  foraSeguidas: number
}

/** Batidas seguidas fora do andamento que fazem a pessoa recomeçar a contagem (a síncope nunca vem duas vezes seguidas). */
const FORA_PARA_RECOMECAR = 2
/** Batidas vistas para entrar no ritmo: com três, o período sai da média de dois intervalos. */
const BATIDAS_PARA_O_RITMO = 3
/** Dois intervalos são do mesmo andamento se diferem menos que esta fração do maior (uma síncope no meio não forma ritmo). */
const INTERVALOS_PARECIDOS = 0.25

const limitar = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))
const estimativa = (b: Readonly<BatidaVista>): number => b.soma / b.n

/**
 * Robô que joga como gente. Lê o brilho pelo Olho, prevê o pico pela forma
 * do brilho e pelo andamento e golpeia no pico previsto mais o erro da mão;
 * em 5% das batidas se distrai; nunca golpeia duas vezes a mesma batida por
 * querer. Sorte do robô: `semente + '|robo'`.
 */
export function roboHumano(semente: string, dif: Dificuldade): Politica<Estado> {
  const r = rngDe(semente + '|robo')
  const olho = new Olho<Leitura>(r)
  // A forma da subida a pessoa aprende nas primeiras batidas; o andamento, ela mede jogando.
  const subidaAprendida = DIF[dif].subida
  const lido = new Array<number>(AROS).fill(0)
  const antes = new Array<number>(AROS).fill(0)
  /** A batida que cada aro está mostrando (ou mostrou por último). */
  const daVez = new Array<BatidaVista | null>(AROS).fill(null)
  const vistas: BatidaVista[] = []
  const tratadas: Tratada[] = []
  let visto: Visto<Leitura> | null = null
  let metro: Metronomo | null = null
  /** Batidas vistas desde que a contagem (re)começou, até o metrônomo nascer. */
  const contagem: number[] = []
  /** Última batida vista fora do andamento (para recomeçar a contagem a partir dela). */
  let ultimaFora = 0
  /** Instante (estimado) da última batida tratada: golpeada, deixada ir ou perdida por distração. */
  let ultimoAlvo = -1
  let erro = erroDaMao(r, ERRO_DA_MAO)
  let distraido = r() < DISTRACAO
  let passos = 0

  /** Conta as batidas vistas: três seguidas com intervalos parecidos fazem nascer o metrônomo. */
  const contar = (pico: number): void => {
    contagem.push(pico)
    if (contagem.length > BATIDAS_PARA_O_RITMO) contagem.shift()
    if (contagem.length < BATIDAS_PARA_O_RITMO) return
    const p1 = contagem[1] - contagem[0]
    const p2 = contagem[2] - contagem[1]
    const plausivel = (p: number): boolean => p >= PERIODO_MIN && p <= PERIODO_MAX
    if (plausivel(p1) && plausivel(p2) && Math.abs(p1 - p2) < INTERVALOS_PARECIDOS * Math.max(p1, p2)) {
      metro = { fase: pico, periodo: (p1 + p2) / 2, foraSeguidas: 0 }
      contagem.length = 0
    }
  }

  /** Uma batida vista inteira entra no metrônomo interno. */
  const sentirBatida = (pico: number): void => {
    if (metro === null) return contar(pico)
    const k = Math.max(1, Math.round((pico - metro.fase) / metro.periodo))
    const previsto = metro.fase + k * metro.periodo
    const desvio = pico - previsto
    if (Math.abs(desvio) > metro.periodo / 4) {
      // Uma batida fora do andamento (a síncope do Difícil) não mexe no relógio interno;
      // duas seguidas querem dizer que a conta é que está errada: recomeça das duas.
      metro.foraSeguidas++
      if (metro.foraSeguidas >= FORA_PARA_RECOMECAR) {
        metro = null
        contagem.length = 0
        contar(ultimaFora)
        contar(pico)
      } else ultimaFora = pico
      return
    }
    metro.periodo = limitar(metro.periodo + (BETA * desvio) / k, PERIODO_MIN, PERIODO_MAX)
    metro.fase = previsto + ALFA * desvio
    metro.foraSeguidas = 0
  }

  /** Aro acendendo que ainda não tinha batida: é nova, ou é a que acabou de ser golpeada às cegas? */
  const novaBatida = (aro: number, x: number): BatidaVista => {
    const b: BatidaVista = { aro, soma: x, n: 1, leituras: 1, sentida: false, tratada: false }
    const janela = metro !== null ? JANELA_PROPRIA * metro.periodo : JANELA_SEM_RITMO
    // O golpe às cegas reivindica o aro que acende mais perto dele que da batida seguinte (meio período).
    const janelaCega = metro !== null ? metro.periodo / 2 : JANELA_SEM_RITMO
    for (const h of tratadas) {
      if ((h.aro === -1 && Math.abs(x - h.t) < janelaCega) || (h.aro === aro && Math.abs(x - h.t) < janela)) {
        b.tratada = true
        h.aro = aro
        break
      }
    }
    vistas.push(b)
    while (vistas.length > 0 && estimativa(vistas[0]) < x - MEMORIA_S) vistas.shift()
    return b
  }

  /** Atualiza as batidas vistas com a leitura atual (uma estimativa do pico por decisão). */
  const acompanhar = (agora: number, nova: boolean): void => {
    for (let i = 0; i < AROS; i++) {
      const b = lido[i]
      const caindo = antes[i] > LIMIAR_ACESO && b < antes[i]
      const atual = daVez[i]
      if (b > LIMIAR_ACESO && b < QUASE_PICO && !caindo) {
        const x = agora - ATRASO_MEDIO + (1 - b) * subidaAprendida
        if (atual !== null && Math.abs(x - estimativa(atual)) < MESMA_BATIDA) {
          atual.soma += x
          atual.n++
          if (nova) atual.leituras++
        } else daVez[i] = novaBatida(i, x)
      } else if (atual !== null && !atual.sentida && (b <= LIMIAR_ACESO || caindo)) {
        atual.sentida = true
        sentirBatida(estimativa(atual))
      }
    }
  }

  /** A batida vista mais cedo que ainda não foi tratada; as velhas demais saem de cena. */
  const batidaDaVez = (): BatidaVista | null => {
    let melhor: BatidaVista | null = null
    for (const b of vistas) {
      if (b.tratada) continue
      if (estimativa(b) < ultimoAlvo) {
        b.tratada = true
        continue
      }
      if (melhor === null || estimativa(b) < estimativa(melhor)) melhor = b
    }
    return melhor
  }

  return (e) => {
    const agora = e.t
    const v = olho.olhar(agora, amostra(e))
    if (passos++ % PASSOS_POR_DECISAO !== 0 || v === null) return SEM_ENTRADA
    const nova = v !== visto
    if (nova) {
      visto = v
      for (let i = 0; i < AROS; i++) {
        antes[i] = lido[i]
        lido[i] = lerComErro(r, v.a['b' + i])
      }
    }
    acompanhar(agora, nova)

    // Batida que vem: pelo metrônomo interno (a primeira da grade depois da última tratada) e pelo brilho visto.
    let grade: number | null = null
    if (metro !== null) grade = metro.fase + (Math.floor((ultimoAlvo + metro.periodo / 2 - metro.fase) / metro.periodo) + 1) * metro.periodo
    const quarto = metro !== null ? metro.periodo / 4 : JANELA_SEM_RITMO
    let vista = batidaDaVez()
    let alvo = grade
    let substitui: number | null = null
    if (vista !== null) {
      const x = estimativa(vista)
      if (grade === null) alvo = x
      else if (x < grade - quarto) {
        // Aro acendendo antes da hora: a batida chegou adiantada e toma o lugar da batida da grade.
        alvo = x
        substitui = grade
      } else if (x <= grade + quarto) alvo = (PESO_METRONOMO * grade + vista.leituras * x) / (PESO_METRONOMO + vista.leituras)
      else vista = null
    }
    if (alvo === null) return SEM_ENTRADA
    const quando = alvo + erro
    if (agora < quando) return SEM_ENTRADA

    // Hora do golpe (ou já passou): golpeia uma vez só e passa para a próxima batida.
    const golpeia = !distraido && agora - quando <= TARDE_DEMAIS
    if (vista !== null) vista.tratada = true
    tratadas.push({ t: alvo, aro: vista !== null ? vista.aro : -1 })
    if (tratadas.length > 4) tratadas.shift()
    ultimoAlvo = substitui ?? alvo
    erro = erroDaMao(r, ERRO_DA_MAO)
    distraido = r() < DISTRACAO
    return golpeia ? TOQUE : SEM_ENTRADA
  }
}

/** Intervalo entre marteladas do robô ruim, em s (uniforme, do pedido). */
const MARTELADA: readonly [number, number] = [0.12, 0.45]

/** Robô ruim do pedido: martela a cada 0,12 a 0,45 s, sem olhar o brilho. */
export function roboRuim(semente: string, _dif: Dificuldade): Politica<Estado> {
  const r = rngDe(semente + '|robo')
  let proxima = entre(r, MARTELADA[0], MARTELADA[1])
  return (e) => {
    if (e.t < proxima) return SEM_ENTRADA
    proxima = e.t + entre(r, MARTELADA[0], MARTELADA[1])
    return TOQUE
  }
}
