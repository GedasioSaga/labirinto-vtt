import type { FonteNoPreludio, MapData, Pin } from '../../types/map'
import { nomeDaFonte, TEXTO_INDISPONIVEL } from '../fonteNoPreludio'
import { podeIrAoJogador, textoDaSecaoParaOMapa } from './pacoteDoJogador'
import type { Verbete } from './tipos'

/**
 * O PINO LIGADO A UM VERBETE (P3 do estudo de 15/11): de onde sai o texto que
 * o jogador lê. O texto mora no Prelúdio; a janela do mapa guarda no pino
 * (`description`) a cópia em dia, já limpa, e é ela que vai ao jogador pela
 * lista do que vai da névoa (`pinForPlayer`). Puro: quem chama decide quando.
 *
 * - Seção comum: o texto dela pelo limpador do pacote do jogador
 *   (`textoDaSecaoParaOMapa`).
 * - Seção de segredo, seção com chave desconhecida, ou verbete que nunca vai
 *   ao jogador (a sessão, o formato mais novo): "Texto indisponível." — o
 *   segredo nunca sai do PC, nem a cópia velha que ele tinha antes de virar segredo.
 * - Verbete ou seção apagados: o pino fica com a cópia de reserva, e a ficha
 *   do pino avisa o mestre ("a fonte sumiu").
 */

export type SituacaoDaFonte =
  | { readonly t: 'ok'; readonly texto: string; readonly verbete: string; readonly secao: string }
  | { readonly t: 'segredo'; readonly verbete: string; readonly secao: string }
  | { readonly t: 'sumiu'; readonly o: 'verbete' | 'secao' }

export function situacaoDaFonte(fonte: Pick<FonteNoPreludio, 'verbeteId' | 'formaId' | 'secaoId'>, verbetes: ReadonlyMap<string, Verbete>): SituacaoDaFonte {
  const verbete = verbetes.get(fonte.verbeteId)
  if (verbete === undefined) return { t: 'sumiu', o: 'verbete' }
  const secao = verbete.formas.find((forma) => forma.id === fonte.formaId)?.secoes.find((uma) => uma.id === fonte.secaoId)
  if (secao === undefined) return { t: 'sumiu', o: 'secao' }
  const nomes = { verbete: nomeDaFonte(verbete.titulo), secao: nomeDaFonte(secao.titulo) }
  if (secao.segredo || secao.extras !== undefined || !podeIrAoJogador(verbete)) return { t: 'segredo', ...nomes }
  return { t: 'ok', texto: textoDaSecaoParaOMapa(secao.texto, verbetes), ...nomes }
}

/** O que o jogador lê, pela situação; `null` = fica a cópia de reserva. */
export function textoParaOJogador(situacao: SituacaoDaFonte): string | null {
  if (situacao.t === 'ok') return situacao.texto
  return situacao.t === 'segredo' ? TEXTO_INDISPONIVEL : null
}

/** O pino com o texto e as cópias de nome em dia; o MESMO pino quando nada muda (ou quando não é ligado). */
export function pinoEmDia(pin: Pin, verbetes: ReadonlyMap<string, Verbete>): Pin {
  const fonte = pin.fonte
  if (fonte === undefined) return pin
  const situacao = situacaoDaFonte(fonte, verbetes)
  if (situacao.t === 'sumiu') return pin
  const description = textoParaOJogador(situacao) ?? pin.description
  if (pin.description === description && fonte.verbete === situacao.verbete && fonte.secao === situacao.secao) return pin
  return { ...pin, description, fonte: { ...fonte, verbete: situacao.verbete, secao: situacao.secao } }
}

/**
 * O mapa com todo pino ligado em dia; o MESMO mapa quando nada muda. Pura e
 * válida para qualquer versão do mapa: serve de `transform` de
 * `applyPlayerChange` (não entra no Ctrl+Z, e desfazer não traz o texto velho).
 */
export function pinosEmDia(map: MapData, verbetes: ReadonlyMap<string, Verbete>): MapData {
  let mudou = false
  const pins = map.pins.map((pin) => {
    const novo = pinoEmDia(pin, verbetes)
    if (novo !== pin) mudou = true
    return novo
  })
  return mudou ? { ...map, pins } : map
}
