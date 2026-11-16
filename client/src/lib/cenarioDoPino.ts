import type { Pin } from '../types/map'
import type { LeiturasDoJogador, QuandoDoCenario } from '../types/cenarioEFalas'

/**
 * "!" CENÁRIO (P4 do estudo de 15/11): o texto para o jogador LER, e quando ele
 * abre. Puro: a névoa (`lib/fogFilter.ts`) chama estas regras na lista do que
 * vai de cada pino, e a ficha do pino as usa para mostrar o valor de agora.
 *
 * Mapa antigo: o "!" sem `quando` é "Ao tocar", o "!" de sempre. Nada a migrar.
 */

/** A quantas casas o "Ao chegar" abre: a faixa do passo da ficha e o valor de quem nunca mexeu. */
export const CHEGAR_CASAS_MIN = 1
export const CHEGAR_CASAS_MAX = 8
export const CHEGAR_CASAS_PADRAO = 3

export function ehQuandoDoCenario(valor: unknown): valor is QuandoDoCenario {
  return valor === 'tocar' || valor === 'chegar' || valor === 'mandar'
}

export function ehCasasAoChegar(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= CHEGAR_CASAS_MIN && valor <= CHEGAR_CASAS_MAX
}

/** Quando o texto abre. Só o "!" tem a escolha; o resto (e o valor torto) é o de sempre: ao tocar. */
export function quandoDoCenario(pin: Pick<Pin, 'kind' | 'quando'>): QuandoDoCenario {
  return pin.kind === 'exclamacao' && ehQuandoDoCenario(pin.quando) ? pin.quando : 'tocar'
}

export function casasAoChegar(pin: Pick<Pin, 'chegarCasas'>): number {
  return ehCasasAoChegar(pin.chegarCasas) ? pin.chegarCasas : CHEGAR_CASAS_PADRAO
}

function jaLeu(pinId: string, leituras: LeiturasDoJogador | undefined): boolean {
  return leituras !== undefined && leituras.cenarios.has(pinId)
}

/**
 * O pino como a névoa deve MEDIR a leitura: o "!" Ao chegar que ele ainda não
 * leu só se lê de perto (a ficha a N casas, enxergando o pino), como o "Ler só
 * de perto" que já existe. Já lido, vale a regra de sempre do pino. O pino
 * devolvido serve só para a conta (`canReadPin`), nunca para o recorte.
 */
export function pinoParaLeitura(pin: Pin, leituras?: LeiturasDoJogador): Pin {
  if (pin.kind !== 'exclamacao' || quandoDoCenario(pin) !== 'chegar' || jaLeu(pin.id, leituras)) return pin
  const casas = casasAoChegar(pin)
  const lerDePerto = pin.lerDePerto === undefined ? casas : Math.min(pin.lerDePerto, casas)
  return lerDePerto === pin.lerDePerto ? pin : { ...pin, lerDePerto }
}

/** O pino do recorte sem o que se LÊ: texto, nome do local, imagem e a animação dela. */
function semOQueSeLe(paraJogador: Pin): Pin {
  const vazio: Pin = { ...paraJogador, description: '', image: null }
  delete vazio.nome
  delete vazio.cenario
  return vazio
}

/**
 * A regra do cenário no pino que JÁ saiu pela lista do que vai (`pinForPlayer`):
 * só tira, nunca põe texto.
 * - Só quando eu mandar, ainda não lido para ele: o "!" aparece sem texto.
 * - Ao chegar, ainda não lido, com o texto chegando agora (a ficha encostou):
 *   marca `abreAoChegar`, e a tela dele abre a revelação sozinha, uma vez.
 */
export function cenarioParaJogador(paraJogador: Pin, pin: Pin, leituras?: LeiturasDoJogador): Pin {
  if (pin.kind !== 'exclamacao') return paraJogador
  const quando = quandoDoCenario(pin)
  if (quando === 'tocar' || jaLeu(pin.id, leituras)) return paraJogador
  if (quando === 'mandar') return semOQueSeLe(paraJogador)
  const temTexto = paraJogador.description.trim() !== '' || (paraJogador.nome ?? '').trim() !== ''
  return paraJogador.longe === true || !temTexto ? paraJogador : { ...paraJogador, abreAoChegar: true }
}
