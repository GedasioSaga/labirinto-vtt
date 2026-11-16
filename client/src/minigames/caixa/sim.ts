/**
 * SIMULAÇÃO DA CAIXA: arrombar a caixa de tábuas com o pé de cabra. Segurar
 * faz força numa curva que começa devagar e acelera; soltar dá o tranco. Com a
 * força na faixa verde, a tábua da frente racha um estágio (trinca, racha,
 * quebra); fraco demais, só range; forte demais, o pé de cabra escorrega.
 * Puro, sem DOM e determinístico por semente, para o jogo, o robô e os testes
 * rodarem a mesma conta.
 */
import { entre, rngDe } from '../abrir/rng'
import { DT, LIMITE_S } from '../abrir/tipos'
import type { Dificuldade, Entrada, Evento, Fim } from '../abrir/tipos'

/** Números de ajuste de uma dificuldade: tudo o que se afina mora aqui. */
export interface ParametrosDaDificuldade {
  nome: string
  /** s segurando para a força ir de 0 a 1. */
  encher: number
  /** Expoente da curva da força: acima de 1, começa devagar e acelera (pede leitura, não só reflexo). */
  expoente: number
  /** Largura da faixa verde, em fração da força. */
  largura: number
  /** Onde o centro da faixa é sorteado; os três sorteios (um por estágio) saem em ordem crescente. */
  centro: readonly [number, number]
  /** s com a força no máximo até o pé de cabra escorregar sozinho. */
  topo: number
  /** s sem aceitar segurar depois de um escorregão (inclui reposicionar). */
  escorregao: number
  /** s para reposicionar o pé de cabra depois de um tranco fraco ou de um racha. */
  reposicionar: number
}

/*
 * Força em fração de 0 a 1; tempos em s. Afinado contra o robô que joga como
 * gente (robo.test.ts), 15/11/2026. Partida dos números do pedido (faixa 0,17
 * e 0,10, reposicionar 0,3 s, escorregão 0,6 s): o Normal saía com 99,8% e
 * mediana de 7,1 s e o robô ruim vencia 20%; o Difícil, 84%. A faixa estreitou,
 * o reposicionar ficou mais longo (menos puxadas cabem em 20 s, o que segura o
 * robô ruim) e o escorregão passou a custar mais que o reposicionar, para
 * passar da faixa nunca sair mais barato que ficar abaixo dela.
 */
export const DIF: Readonly<Record<Dificuldade, ParametrosDaDificuldade>> = {
  normal: {
    nome: 'Normal', encher: 1.5, expoente: 1.6, largura: 0.1, centro: [0.5, 0.82],
    topo: 0.25, escorregao: 1.0, reposicionar: 0.8,
  },
  dificil: {
    nome: 'Difícil', encher: 1.1, expoente: 1.6, largura: 0.07, centro: [0.6, 0.85],
    topo: 0.25, escorregao: 0.9, reposicionar: 0.7,
  },
}

/** Estágios da tábua até abrir: trinca, racha, quebra. */
export const ESTAGIOS = 3
/** Duração da animação de abrir (a tábua quebrada cai), em s. */
export const DURACAO_ABRIR = 0.5
/** Intervalo entre dois rangidos de tensão enquanto segura, em s. */
export const INTERVALO_TENSAO = 0.09
/** Folga nas comparações de tempo: o passo é 1/120 s e a conta em ponto flutuante erra na 15ª casa. */
const EPS = 1e-9

/** Vocabulário de eventos da caixa; cada nome tem um som em som.ts. */
export type NomeDoEvento = 'tensao' | 'racha' | 'fraco' | 'escorregou' | 'abriu' | 'tempo'
export const NOMES_DOS_EVENTOS: readonly NomeDoEvento[] = ['tensao', 'racha', 'fraco', 'escorregou', 'abriu', 'tempo']

/** Evento da caixa: `tensao` leva a força (0..1); `racha`, o estágio novo (1..3); `fraco` e `escorregou`, a força da soltura. */
export interface EventoDaCaixa extends Evento {
  nome: NomeDoEvento
}

/** Resultado de um tranco: soltura na faixa, abaixo dela, acima dela (ou o escorregão sozinho no máximo). */
export type Tranco = 'racha' | 'fraco' | 'escorregou'

/** Estado mutável único de uma tentativa. */
export interface Estado {
  dif: Dificuldade
  d: ParametrosDaDificuldade
  /** Passos dados; o tempo sai daqui (somar DT a cada passo acumularia erro de arredondamento). */
  passos: number
  t: number
  fim: Fim | null
  /** Instante do fim; a animação de abrir conta daqui. */
  tFim: number
  /** Centro da faixa verde de cada estágio, em ordem crescente: a tábua resiste mais a cada racha. */
  centros: readonly number[]
  /** Estágios já rachados, 0..3. */
  estagio: number
  forca: number
  /** Fazendo força: segurando com o pé de cabra assentado na fresta. */
  enchendo: boolean
  /** Passos segurando nesta puxada. */
  passosSegurando: number
  /** Passos com a força no máximo nesta puxada. */
  passosNoTopo: number
  /** Instante a partir do qual o pé de cabra está assentado e aceita segurar. */
  livreEm: number
  /** Instante do próximo rangido de tensão. */
  proxTensao: number
  /** Último tranco (null antes do primeiro), a força dele e o instante: a marca no medidor. */
  ultimoTranco: Tranco | null
  ultimaSolta: number
  tSolta: number
  /** Instante do último racha e do último escorregão (-Infinity = nunca), para o tremor e o pulo na arte. */
  tRacha: number
  tEscorregou: number
  /** Eventos do último passo; a lista é refeita a cada passo. */
  ev: EventoDaCaixa[]
}

/** Força depois de `tSegurando` s segurando: (t / encher) ^ expoente, até 1. */
export const forcaNoTempo = (tSegurando: number, d: Readonly<ParametrosDaDificuldade>): number =>
  Math.min(1, Math.pow(Math.max(0, tSegurando) / d.encher, d.expoente))

/** Inverso da curva: s segurando até a força chegar a `f`. É a "forma da curva" que o robô conhece. */
export const tempoDaForca = (f: number, d: Readonly<ParametrosDaDificuldade>): number =>
  d.encher * Math.pow(Math.min(1, Math.max(0, f)), 1 / d.expoente)

/** Nova tentativa. A sorte do jogo (só os centros das faixas) sai de `semente + '|jogo'`. */
export function criar(semente: string, dif: Dificuldade): Estado {
  const d = DIF[dif]
  const r = rngDe(semente + '|jogo')
  const centros = Array.from({ length: ESTAGIOS }, () => entre(r, d.centro[0], d.centro[1])).sort((a, b) => a - b)
  return {
    dif, d, passos: 0, t: 0, fim: null, tFim: 0, centros, estagio: 0, forca: 0, enchendo: false,
    passosSegurando: 0, passosNoTopo: 0, livreEm: 0, proxTensao: 0,
    ultimoTranco: null, ultimaSolta: 0, tSolta: -Infinity, tRacha: -Infinity, tEscorregou: -Infinity, ev: [],
  }
}

/** Faixa verde do estágio atual, [mínimo, máximo] da força. Depois de abrir, fica a do último estágio. */
export function faixaAtual(e: Readonly<Estado>): readonly [number, number] {
  const c = e.centros[Math.min(e.estagio, ESTAGIOS - 1)]
  return [c - e.d.largura / 2, c + e.d.largura / 2]
}

/** O pé de cabra está assentado e a tentativa segue: segurar agora começa a puxada. */
export const pronto = (e: Readonly<Estado>): boolean => e.fim === null && e.t >= e.livreEm - EPS

function tranco(e: Estado, tipo: Tranco, f: number): void {
  e.enchendo = false
  e.forca = 0
  e.passosSegurando = 0
  e.passosNoTopo = 0
  e.ultimoTranco = tipo
  e.ultimaSolta = f
  e.tSolta = e.t
  if (tipo === 'racha') {
    e.estagio++
    e.tRacha = e.t
    e.livreEm = e.t + e.d.reposicionar
    e.ev.push({ nome: 'racha', v: e.estagio })
  } else if (tipo === 'escorregou') {
    e.tEscorregou = e.t
    e.livreEm = e.t + e.d.escorregao
    e.ev.push({ nome: 'escorregou', v: f })
  } else {
    e.livreEm = e.t + e.d.reposicionar
    e.ev.push({ nome: 'fraco', v: f })
  }
}

function soltar(e: Estado): void {
  const f = e.forca
  const [min, max] = faixaAtual(e)
  tranco(e, f > max ? 'escorregou' : f >= min ? 'racha' : 'fraco', f)
}

function comecar(e: Estado): void {
  e.enchendo = true
  e.passosSegurando = 0
  e.passosNoTopo = 0
  e.forca = 0
  // O primeiro rangido sai já no aperto: é a resposta de que o toque pegou.
  e.ev.push({ nome: 'tensao', v: 0 })
  e.proxTensao = e.t + INTERVALO_TENSAO
}

function puxar(e: Estado): void {
  e.passosSegurando++
  e.forca = forcaNoTempo(e.passosSegurando * DT, e.d)
  if (e.forca >= 1) {
    e.passosNoTopo++
    if (e.passosNoTopo * DT > e.d.topo + EPS) {
      tranco(e, 'escorregou', 1)
      return
    }
  }
  if (e.t >= e.proxTensao - EPS) {
    e.ev.push({ nome: 'tensao', v: e.forca })
    e.proxTensao += INTERVALO_TENSAO
  }
}

function terminar(e: Estado, fim: Fim): void {
  e.fim = fim
  e.tFim = e.t
  e.enchendo = false
  e.forca = 0
  e.ev.push({ nome: fim === 'abriu' ? 'abriu' : 'tempo' })
}

/**
 * Avança um passo de DT. Muta `e` e devolve o fim quando a tentativa acaba.
 *
 * Quem já está segurando quando o pé de cabra termina de assentar começa a
 * encher dali, sem precisar soltar e apertar de novo: exigir o novo aperto
 * engoliria a entrada de quem segurou um pouco cedo (o botão "morto" frustra
 * mais do que ajuda), e a contagem da força só começa quando o pé de cabra
 * assenta, então segurar cedo não dá vantagem de tempo.
 *
 * Depois do fim, só o relógio anda (para a animação de abrir), sem ler a
 * entrada, e o fim devolvido é sempre o mesmo.
 */
export function passo(e: Estado, entrada: Readonly<Entrada>): Fim | null {
  e.ev = []
  e.passos++
  e.t = e.passos * DT
  if (e.fim !== null) return e.fim
  if (e.enchendo) {
    if (entrada.segurando) puxar(e)
    else soltar(e)
  } else if (entrada.segurando && pronto(e)) comecar(e)
  if (e.estagio >= ESTAGIOS) terminar(e, 'abriu')
  else if (e.t >= LIMITE_S - EPS) terminar(e, 'tempo')
  return e.fim
}

/** Eventos do último passo. */
export const eventos = (e: Readonly<Estado>): readonly EventoDaCaixa[] => e.ev

/** Tempo desde o começo da tentativa, em s (continua andando depois do fim, para a animação). */
export const tempo = (e: Readonly<Estado>): number => e.t

/** Como a tentativa acabou; null enquanto segue. */
export const fim = (e: Readonly<Estado>): Fim | null => e.fim

/** 0..1 até abrir: um terço por estágio rachado. */
export const progresso = (e: Readonly<Estado>): number => e.estagio / ESTAGIOS

/** 0..1 da tábua caindo, em DURACAO_ABRIR s depois da vitória; 0 sem vitória. */
export function abertura(e: Readonly<Estado>): number {
  if (e.fim !== 'abriu') return 0
  return Math.min(1, Math.max(0, (e.t - e.tFim) / DURACAO_ABRIR))
}

/*
 * Tipo, não interface: um tipo de objeto literal aceita ser lido como
 * Record<string, number> (o contrato do gráfico); uma interface não.
 */
/** O que o gráfico do movimento e o robô leem, em números (o mesmo que a tela mostra). */
export type AmostraDaCaixa = {
  forca: number
  faixaMin: number
  faixaMax: number
  /** Estágios rachados, 0..3. */
  estagio: number
  /** 1 = fazendo força agora. */
  segurando: number
  /** 1 = pé de cabra assentado, segurar começa a puxada. */
  pronto: number
  abertura: number
}

/** Amostra do estado, sem desenhar. Objeto novo a cada chamada (o olho do robô guarda as telas). */
export function amostra(e: Readonly<Estado>): AmostraDaCaixa {
  const [faixaMin, faixaMax] = faixaAtual(e)
  return {
    forca: e.forca,
    faixaMin,
    faixaMax,
    estagio: e.estagio,
    segurando: e.enchendo ? 1 : 0,
    pronto: pronto(e) ? 1 : 0,
    abertura: abertura(e),
  }
}
