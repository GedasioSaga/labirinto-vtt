/**
 * DRAGON BALL TALES — acerto contra CA e estágio de dano (2.3 p. 9-11; 6.0.2.1
 * p. 59; 8.4 p. 103-104; 9.4 p. 115). Puro: recebe o d20 já rolado, para o
 * motor automático e o modo manual da batalha usarem a mesma conta.
 */
import type { FaixaDeDanoDBT, IdEstagioDeDanoDBT } from '../modelo'

/** Margem mínima (acerto − CA) de cada estágio. Abaixo do mínimo, erra. */
export interface LimiaresDeDanoDBT {
  minimo: number
  medio: number
  completo: number
}

/**
 * Sem diferença de EP: 1-2 mínimo, 3-5 médio, 6+ completo. Margem 0 (acerto
 * igual à CA) ERRA: o texto da p. 10 diz que só com +2 de EP "basta obter um
 * valor igual" à CA, e 8.4/9.4 tratam ≤ 0 como erro.
 */
export const LIMIARES_BASE: LimiaresDeDanoDBT = { minimo: 1, medio: 3, completo: 6 }

/**
 * A tabela de 2.3.3 (p. 10), atacante com 1 a 10 de EP acima do alvo. Copiada
 * como impressa: a partir de 5 o passo quebra (completo 0+ em vez de 1+; o
 * médio vira faixa de 2), e a linha 1 não é a base menos 1 no mínimo (só "1").
 */
const TABELA_DA_ESCALA: readonly LimiaresDeDanoDBT[] = [
  { minimo: 1, medio: 2, completo: 5 },
  { minimo: 0, medio: 1, completo: 4 },
  { minimo: -1, medio: 0, completo: 3 },
  { minimo: -2, medio: -1, completo: 2 },
  { minimo: -3, medio: -2, completo: 0 },
  { minimo: -4, medio: -3, completo: -1 },
  { minimo: -5, medio: -4, completo: -2 },
  { minimo: -6, medio: -5, completo: -3 },
  { minimo: -7, medio: -6, completo: -4 },
  { minimo: -8, medio: -7, completo: -5 },
]

/** O livro só imprime até 10 de diferença; acima disso segue o passo das linhas 5-10 (−1 por nível). */
const MAIOR_DIFERENCA_IMPRESSA = TABELA_DA_ESCALA.length

export const FRACAO_DO_ESTAGIO: Readonly<Record<IdEstagioDeDanoDBT, number>> = {
  erro: 0,
  minimo: 0.25,
  medio: 0.5,
  completo: 1,
}

export const NOME_DO_ESTAGIO: Readonly<Record<IdEstagioDeDanoDBT, string>> = {
  erro: 'erro',
  minimo: 'dano mínimo',
  medio: 'dano médio',
  completo: 'dano completo',
}

/** Crítico: 20 natural dobra o dano final (9.4, p. 115). */
export const MULTIPLICADOR_DO_CRITICO = 2
export const NATURAL_DO_CRITICO = 20
export const NATURAL_DO_ERRO_CRITICO = 1

/** Limiares pela diferença EP do atacante − EP do alvo. Diferença ≤ 0 = a base (o mais fraco paga no acerto, não na faixa). */
export function limiaresPelaDiferencaDeEP(diferenca: number): LimiaresDeDanoDBT {
  const nivel = Math.floor(diferenca)
  if (nivel <= 0) return LIMIARES_BASE
  if (nivel <= MAIOR_DIFERENCA_IMPRESSA) return TABELA_DA_ESCALA[nivel - 1]
  const ultima = TABELA_DA_ESCALA[MAIOR_DIFERENCA_IMPRESSA - 1]
  const alem = nivel - MAIOR_DIFERENCA_IMPRESSA
  return { minimo: ultima.minimo - alem, medio: ultima.medio - alem, completo: ultima.completo - alem }
}

export function estagioPelaMargem(margem: number, limiares: LimiaresDeDanoDBT): IdEstagioDeDanoDBT {
  if (margem >= limiares.completo) return 'completo'
  if (margem >= limiares.medio) return 'medio'
  if (margem >= limiares.minimo) return 'minimo'
  return 'erro'
}

/** −1 no ataque por nível de EP que o alvo tem acima do atacante (2.3.2, p. 10). Soma com o +EP passivo (2.3.1). */
export function penalidadeDeEscala(epAtacante: number, epAlvo: number): number {
  return -Math.max(0, epAlvo - epAtacante)
}

/**
 * Vitória automática interpretativa (2.3.4, p. 11): quando a EP maior é o
 * dobro (ou mais) da menor. Exemplos do livro: 10 vence 5; 3 vence 1. Pelo
 * texto, contra EP 0 qualquer EP acima vence; o mestre decide se aplica.
 */
export function vitoriaAutomatica(epA: number, epB: number): 'a' | 'b' | null {
  if (epA > epB && epA >= 2 * epB) return 'a'
  if (epB > epA && epB >= 2 * epA) return 'b'
  return null
}

export function danoDoEstagio(faixa: FaixaDeDanoDBT, estagio: IdEstagioDeDanoDBT): number {
  if (estagio === 'erro') return 0
  return faixa[estagio]
}

export interface AtaqueDBT {
  /** O d20 rolado (1 a 20). */
  natural: number
  /** Modificador do atributo de acerto da técnica. */
  modificador: number
  /** EP total do atacante (base + transformação): soma no acerto e escolhe a faixa. */
  epAtacante: number
  /** EP total do alvo. */
  epAlvo: number
  caDoAlvo: number
  faixa: FaixaDeDanoDBT
  /** Outros bônus e redutores já somados (Aumentar Precisão, ataque básico repetido, Desnorteado...). */
  extras?: number
  /** Menor natural que é crítico: 20; Exposto baixa para 16 (9.7). */
  criticoAPartirDe?: number
}

export interface ResultadoDoAtaqueDBT {
  natural: number
  /** d20 + modificador + EP + extras + penalidade de escala. */
  total: number
  penalidade: number
  margem: number
  limiares: LimiaresDeDanoDBT
  estagio: IdEstagioDeDanoDBT
  critico: boolean
  erroCritico: boolean
  dano: number
  /** "d20 14 + 2 + 2 (EP) - 1 (escala) = 17 contra CA 15: margem 2, dano mínimo 11". */
  explicacao: string
}

function sinalizado(n: number): string {
  return n < 0 ? `- ${-n}` : `+ ${n}`
}

/**
 * Resolve um ataque (9.4, p. 115): 1 natural erra sempre (erro crítico); 20
 * natural (ou a margem de crítico) acerta sempre, no dano completo × 2; no
 * resto, a margem contra a CA escolhe o estágio pela tabela de EP.
 */
export function resolverAtaque(ataque: AtaqueDBT): ResultadoDoAtaqueDBT {
  const extras = ataque.extras ?? 0
  const criticoAPartirDe = ataque.criticoAPartirDe ?? NATURAL_DO_CRITICO
  const penalidade = penalidadeDeEscala(ataque.epAtacante, ataque.epAlvo)
  const total = ataque.natural + ataque.modificador + ataque.epAtacante + extras + penalidade
  const margem = total - ataque.caDoAlvo
  const limiares = limiaresPelaDiferencaDeEP(ataque.epAtacante - ataque.epAlvo)
  const erroCritico = ataque.natural === NATURAL_DO_ERRO_CRITICO
  const critico = !erroCritico && ataque.natural >= criticoAPartirDe
  let estagio: IdEstagioDeDanoDBT
  let dano: number
  if (erroCritico) {
    estagio = 'erro'
    dano = 0
  } else if (critico) {
    estagio = 'completo'
    dano = ataque.faixa.completo * MULTIPLICADOR_DO_CRITICO
  } else {
    estagio = estagioPelaMargem(margem, limiares)
    dano = danoDoEstagio(ataque.faixa, estagio)
  }

  let conta = `d20 ${ataque.natural} ${sinalizado(ataque.modificador)} ${sinalizado(ataque.epAtacante)} (EP)`
  if (extras !== 0) conta += ` ${sinalizado(extras)}`
  if (penalidade !== 0) conta += ` ${sinalizado(penalidade)} (escala)`
  conta += ` = ${total} contra CA ${ataque.caDoAlvo}: margem ${margem}`
  let desfecho: string
  if (erroCritico) desfecho = '1 natural, erro crítico'
  else if (critico) desfecho = `crítico, dano completo × ${MULTIPLICADOR_DO_CRITICO} = ${dano}`
  else if (estagio === 'erro') desfecho = 'erra'
  else desfecho = `${NOME_DO_ESTAGIO[estagio]} ${dano}`

  return { natural: ataque.natural, total, penalidade, margem, limiares, estagio, critico, erroCritico, dano, explicacao: `${conta}, ${desfecho}` }
}

export interface DistribuicaoDoAtaqueDBT {
  /** Chance (0 a 1) de causar algum dano: estágio diferente de erro. */
  chanceDeAcerto: number
  chanceDeCritico: number
  /** Média do dano nas 20 faces do d20, com o crítico dobrado. */
  danoEsperado: number
  /** Chance de cada estágio (o crítico conta em 'completo'). */
  chancePorEstagio: Record<IdEstagioDeDanoDBT, number>
}

/** Passa pelas 20 faces do d20 (todas com a mesma chance): o Comparar e a Arena usam isto. */
export function distribuicaoDoAtaque(ataque: Omit<AtaqueDBT, 'natural'>): DistribuicaoDoAtaqueDBT {
  const FACES = 20
  const contagem: Record<IdEstagioDeDanoDBT, number> = { erro: 0, minimo: 0, medio: 0, completo: 0 }
  let criticos = 0
  let somaDoDano = 0
  for (let natural = 1; natural <= FACES; natural++) {
    const resultado = resolverAtaque({ ...ataque, natural })
    contagem[resultado.estagio] += 1
    if (resultado.critico) criticos += 1
    somaDoDano += resultado.dano
  }
  return {
    chanceDeAcerto: (FACES - contagem.erro) / FACES,
    chanceDeCritico: criticos / FACES,
    danoEsperado: somaDoDano / FACES,
    chancePorEstagio: {
      erro: contagem.erro / FACES,
      minimo: contagem.minimo / FACES,
      medio: contagem.medio / FACES,
      completo: contagem.completo / FACES,
    },
  }
}
