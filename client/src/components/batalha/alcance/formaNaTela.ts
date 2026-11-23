import type { FormaDoAlcance } from '../../../lib/batalha/alcance/forma'
import { CASAS_MAX, type AlvoDaMecanica, type FormaDoAlvo } from '../../../lib/batalha/mecanica/modelo'
import { alvoComForma } from '../../../lib/batalha/mecanica/modelos'

/**
 * AS FORMAS DO ALCANCE NA TELA (fase F do alcance, docs/design/habilidades/ALCANCE.md §8;
 * protótipo aprovado tmp/proto-alcance/fonte.html, o seletor "Forma do alcance"). Os 7
 * desenhos do protótipo mais a área num ponto e numa ficha, e como cada um vira peça: no
 * cartão montado, o alvo da mecânica (`AlvoDaMecanica`); no cartão só de texto e na entrada
 * do catálogo, o campo `alcance` (`FormaDoAlcance`). O número passa de um desenho para o
 * outro (linha de 5 vira leque de 5), como no protótipo.
 *
 * Puro: sem store, sem rede.
 */

export type FormaNaTela = 'alvo' | 'linha' | 'volta' | 'frente' | 'cruz' | 'leque' | 'anel' | 'ponto' | 'ficha'

/** O campo do cartão também pode ser "só em quem usa" (na mecânica isso é o "Pega: em quem usa"). */
export type FormaDoCampo = FormaNaTela | 'si'

export interface OpcaoDeForma<T extends string> {
  tipo: T
  rotulo: string
  /** A forma pequena que o desenho do botão acende. */
  exemplo: FormaDoAlcance
}

export const FORMAS_NA_TELA: readonly OpcaoDeForma<FormaNaTela>[] = [
  { tipo: 'alvo', rotulo: 'Alvo até', exemplo: { tipo: 'alvo', ate: 2 } },
  { tipo: 'linha', rotulo: 'Linha reta', exemplo: { tipo: 'linha', ate: 3 } },
  { tipo: 'volta', rotulo: 'Em volta', exemplo: { tipo: 'volta', ate: 1 } },
  { tipo: 'frente', rotulo: 'Quadrado à frente', exemplo: { tipo: 'frente', lado: 3 } },
  { tipo: 'cruz', rotulo: 'Cruz', exemplo: { tipo: 'cruz', ate: 3 } },
  { tipo: 'leque', rotulo: 'Leque', exemplo: { tipo: 'leque', ate: 3 } },
  { tipo: 'anel', rotulo: 'Anel (só longe)', exemplo: { tipo: 'alvo', ate: 3, de: 2 } },
  { tipo: 'ponto', rotulo: 'Área num ponto', exemplo: { tipo: 'ponto', ate: 3, raio: 1 } },
  { tipo: 'ficha', rotulo: 'Área numa ficha', exemplo: { tipo: 'ficha', ate: 3, raio: 1 } },
]

export const FORMAS_DO_CAMPO: readonly OpcaoDeForma<FormaDoCampo>[] = [...FORMAS_NA_TELA, { tipo: 'si', rotulo: 'Só em quem usa', exemplo: { tipo: 'si' } }]

/** O número de partida quando a forma de antes não tem número (o "1 alvo" sem limite). */
const NUMERO_DE_PARTIDA = 3
/** O anel nasce de 2 casas (o validador não deixa o mínimo abaixo de 2). */
export const ANEL_MINIMO = 2
/** O quadrado à frente nasce no máximo 5x5 (o protótipo: o lado grande engole o mapa). */
const LADO_DA_FRENTE_DE_PARTIDA_MAX = 5
/** A explosão de partida da área longe: 1 casa em volta (3 x 3). */
const EXPLOSAO_DE_PARTIDA = 1

function preso(n: number, minimo: number, maximo = CASAS_MAX): number {
  return Math.min(maximo, Math.max(minimo, Math.round(n)))
}

// ─── O alvo da mecânica montada ─────────────────────────────────────────────

/** O desenho que o alvo da mecânica mostra (o quadrado em volta de quem usa é o "Em volta"). */
export function formaNaTelaDoAlvo(alvo: Pick<AlvoDaMecanica, 'forma' | 'alcanceMinimo'>): FormaNaTela {
  const { forma } = alvo
  switch (forma.tipo) {
    case 'um':
    case 'varios':
      return alvo.alcanceMinimo === undefined ? 'alvo' : 'anel'
    case 'linha':
    case 'cruz':
    case 'leque':
      return forma.tipo
    case 'raio':
      return forma.centro === undefined ? 'volta' : forma.centro === 'ponto' ? 'ponto' : 'ficha'
    case 'quadrado':
      return forma.centro === 'frente' ? 'frente' : forma.centro === 'si' ? 'volta' : 'ponto'
  }
}

/** O número principal do alvo (o que passa para o próximo desenho). */
function numeroDoAlvo(alvo: Pick<AlvoDaMecanica, 'forma' | 'alcance'>): number {
  const { forma, alcance } = alvo
  switch (forma.tipo) {
    case 'um':
    case 'varios':
      return alcance ?? NUMERO_DE_PARTIDA
    case 'linha':
    case 'cruz':
    case 'leque':
      return forma.casas
    case 'raio':
      return forma.centro === undefined ? forma.casas : (alcance ?? NUMERO_DE_PARTIDA)
    case 'quadrado':
      if (forma.centro === 'frente') return forma.lado
      if (forma.centro === 'si') return Math.max(1, Math.floor((forma.lado - 1) / 2))
      return alcance ?? NUMERO_DE_PARTIDA
  }
}

/** A explosão que a área longe já tinha (raio), para não perder ao trocar de ponto para ficha. */
function explosaoDoAlvo(forma: FormaDoAlvo): number {
  if (forma.tipo === 'raio' && forma.centro !== undefined) return forma.casas
  if (forma.tipo === 'quadrado' && forma.centro === 'ponto') return Math.max(1, Math.floor((forma.lado - 1) / 2))
  return EXPLOSAO_DE_PARTIDA
}

function semAlcance(alvo: AlvoDaMecanica): AlvoDaMecanica {
  const { alcance: _alcance, alcanceMinimo: _minimo, ...resto } = alvo
  return resto
}

/**
 * O alvo com outro desenho. O "1 alvo" ou "Vários" de antes fica no alvo e no anel; o número
 * passa adiante; o resto do alvo (em quem pega, o selo exigido) não muda. `alvoComForma` tira o
 * que a forma nova não aceita (o caído só no alvo escolhido).
 */
export function alvoNaForma(alvo: AlvoDaMecanica, tipo: FormaNaTela): AlvoDaMecanica {
  if (tipo === formaNaTelaDoAlvo(alvo)) return alvo
  const n = numeroDoAlvo(alvo)
  const base = semAlcance(alvo)
  const escolhido: FormaDoAlvo = alvo.forma.tipo === 'um' || alvo.forma.tipo === 'varios' ? alvo.forma : { tipo: 'um' }
  switch (tipo) {
    case 'alvo':
      return alvoComForma({ ...base, alcance: n }, escolhido)
    case 'anel':
      return alvoComForma({ ...base, alcance: Math.max(ANEL_MINIMO + 1, n), alcanceMinimo: ANEL_MINIMO }, escolhido)
    case 'linha':
    case 'cruz':
    case 'leque':
      return alvoComForma(base, { tipo, casas: n })
    case 'volta':
      return alvoComForma(base, { tipo: 'raio', casas: n })
    case 'frente':
      return alvoComForma(base, { tipo: 'quadrado', lado: Math.min(n, LADO_DA_FRENTE_DE_PARTIDA_MAX), centro: 'frente' })
    case 'ponto':
    case 'ficha':
      return alvoComForma({ ...base, alcance: n }, { tipo: 'raio', casas: explosaoDoAlvo(alvo.forma), centro: tipo === 'ponto' ? 'ponto' : 'alvo' })
  }
}

// ─── O campo `alcance` do cartão só de texto e da entrada do catálogo ──────

export function formaDoCampoDe(forma: FormaDoAlcance): FormaDoCampo {
  return forma.tipo === 'alvo' && forma.de !== undefined ? 'anel' : forma.tipo
}

function numeroDaForma(forma: FormaDoAlcance): number {
  switch (forma.tipo) {
    case 'si':
      return NUMERO_DE_PARTIDA
    case 'frente':
      return forma.lado
    default:
      return forma.ate
  }
}

/** A forma do campo com outro desenho, levando o número (e a explosão, entre ponto e ficha). */
export function formaComOutroDesenho(antes: FormaDoAlcance, tipo: FormaDoCampo): FormaDoAlcance {
  if (tipo === formaDoCampoDe(antes)) return antes
  const n = numeroDaForma(antes)
  switch (tipo) {
    case 'si':
      return { tipo: 'si' }
    case 'alvo':
      return { tipo: 'alvo', ate: n }
    case 'anel':
      return { tipo: 'alvo', ate: Math.max(ANEL_MINIMO + 1, n), de: ANEL_MINIMO }
    case 'linha':
    case 'volta':
    case 'cruz':
    case 'leque':
      return { tipo, ate: n }
    case 'frente':
      return { tipo: 'frente', lado: Math.min(n, LADO_DA_FRENTE_DE_PARTIDA_MAX) }
    case 'ponto':
    case 'ficha': {
      const raio = antes.tipo === 'ponto' || antes.tipo === 'ficha' ? (antes.raio ?? Math.max(1, Math.floor(((antes.lado ?? 3) - 1) / 2))) : EXPLOSAO_DE_PARTIDA
      return { tipo, ate: n, raio }
    }
  }
}

/** A forma de partida ao marcar "Tem alcance" no cartão só de texto (o alvo a até 3). */
export const FORMA_DO_CAMPO_DE_PARTIDA: FormaDoAlcance = { tipo: 'alvo', ate: NUMERO_DE_PARTIDA }

/** O mesmo teto de casas do disco, para todo número do campo. */
export function casasNoTeto(n: number, minimo = 1): number {
  return preso(n, minimo)
}
