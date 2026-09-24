/**
 * ENCONTRO MARCADO — o jogador combina "espero a Bia no portão, 15 min": a
 * ficha dele ganha a marca "esperando" e o app avisa quando a Bia aparece no
 * recorte dele ou quando o prazo vence.
 *
 * Lógica pura: prazos e frases. Quem decide quem vê o quê é o host
 * (`net/hostSession.ts`) pelo recorte (`lib/fogFilter.ts`): o "quem" e o
 * "onde" vão só ao próprio jogador e ao mestre; os colegas que VEEM a ficha
 * recebem só a marca.
 */

/** Os prazos que a tela oferece, em minutos. */
export const ESPERA_MINUTOS_OPCOES = [5, 10, 15, 30, 60] as const
/** O prazo que a tela escolhe sozinha: o do meio. */
export const ESPERA_MINUTOS_PADRAO = 15
/** Teto do prazo aceito pelo host: bem acima de qualquer opção, abaixo de uma espera esquecida a noite toda. */
export const ESPERA_MINUTOS_MAX = 180
/** Teto do "onde" ("no portão", "na cozinha"), em unidades UTF-16 — o `maxLength` do campo conta igual. */
export const ESPERA_ONDE_MAX_LENGTH = 60
export const MS_POR_MINUTO = 60_000

/** A espera como o dono a vê: quem, onde e quanto falta (ms, relógio do host). */
export interface MinhaEspera {
  who?: string
  where?: string
  remainingMs: number
}

/**
 * Por que a espera acabou. `met`: o colega apareceu no recorte (o nome é o que
 * o host conhece dele). `expired`: o prazo venceu. `left`: quem esperava saiu
 * da cena onde combinou — o nome da cena nova não vai junto.
 */
export type FimDaEspera = { reason: 'met'; who: string } | { reason: 'expired'; who?: string } | { reason: 'left'; who?: string }

export type FimDaEsperaMotivo = FimDaEspera['reason']

export function isFimDaEsperaMotivo(value: unknown): value is FimDaEsperaMotivo {
  return value === 'met' || value === 'expired' || value === 'left'
}

/** Prazo que o host aceita: minuto inteiro entre 1 e `ESPERA_MINUTOS_MAX`. */
export function isWaitMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= ESPERA_MINUTOS_MAX
}

/** Minutos que faltam, arredondados para cima: 11 min e 1 s ainda são "faltam 12". Passou, zero. */
export function minutosRestantes(remainingMs: number): number {
  if (!(remainingMs > 0)) return 0
  return Math.ceil(remainingMs / MS_POR_MINUTO)
}

/** "falta 1 min" / "faltam 12 min" / "o prazo acabou". */
function quantoFalta(remainingMs: number): string {
  const minutos = minutosRestantes(remainingMs)
  if (minutos === 0) return 'o prazo acabou'
  return minutos === 1 ? 'falta 1 min' : `faltam ${minutos} min`
}

/** A frase da espera ativa, na tela de quem espera: "Esperando Bia · no portão · faltam 12 min". */
export function textoDaEspera(espera: { who?: string; where?: string }, remainingMs: number): string {
  const partes = [`Esperando ${espera.who ?? 'alguém'}`]
  if (espera.where !== undefined) partes.push(espera.where)
  partes.push(quantoFalta(remainingMs))
  return partes.join(' · ')
}

/**
 * A mesma espera como o MESTRE lê no painel da sala: "esperando Bia · no
 * portão · até 14:32". `until` é o relógio da sessão, que é o da máquina dele.
 */
export function textoDaEsperaParaOMestre(espera: { who?: string; where?: string; until: number }): string {
  const hora = new Date(espera.until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const partes = [`esperando ${espera.who ?? 'alguém'}`]
  if (espera.where !== undefined) partes.push(espera.where)
  partes.push(`até ${hora}`)
  return partes.join(' · ')
}

/** O aviso do fim da espera. */
export function textoDoFimDaEspera(fim: FimDaEspera): string {
  switch (fim.reason) {
    case 'met':
      return `${fim.who} chegou. Você parou de esperar.`
    case 'expired':
      return fim.who === undefined ? 'O prazo acabou: você parou de esperar.' : `O prazo acabou: ${fim.who} não apareceu.`
    case 'left':
      return 'Você saiu da cena: a espera acabou.'
  }
}

/** O nome embaixo da ficha. Esperando, ganha a marca; ficha sem nome fica só com ela. */
export function rotuloDaFicha(name: string, waiting: boolean): string {
  if (!waiting) return name
  return name === '' ? 'esperando' : `${name} · esperando`
}
