import type { FonteNoPreludio, MapData, Pin } from '../../types/map'
import type { FalaDoPino } from '../../types/cenarioEFalas'
import { QUEM_DIZ_MAX } from '../falasDoPino'
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
 * - Entrada do "?" ligada (P5): as mesmas regras, no `texto` da entrada; e o
 *   "quem diz" segue o nome do Personagem escolhido (`quemVerbeteId`).
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
  return falasDoPinoEmDia(pinoComFonteEmDia(pin, verbetes), verbetes)
}

function pinoComFonteEmDia(pin: Pin, verbetes: ReadonlyMap<string, Verbete>): Pin {
  const fonte = pin.fonte
  if (fonte === undefined) return pin
  const situacao = situacaoDaFonte(fonte, verbetes)
  if (situacao.t === 'sumiu') return pin
  const description = textoParaOJogador(situacao) ?? pin.description
  if (pin.description === description && fonte.verbete === situacao.verbete && fonte.secao === situacao.secao) return pin
  return { ...pin, description, fonte: { ...fonte, verbete: situacao.verbete, secao: situacao.secao } }
}

/**
 * O nome de quem diz, copiado do Personagem escolhido (P5). `null` = fica a
 * cópia que a entrada tem: Personagem apagado, ou verbete que não é Personagem
 * ou nunca vai ao jogador (arquivo editado à mão, formato mais novo).
 */
export function quemDizEmDia(quemVerbeteId: string, verbetes: ReadonlyMap<string, Verbete>): string | null {
  const verbete = verbetes.get(quemVerbeteId)
  if (verbete === undefined || verbete.tipo !== 'personagem' || !podeIrAoJogador(verbete)) return null
  const nome = nomeDaFonte(verbete.titulo).slice(0, QUEM_DIZ_MAX).trim()
  return nome === '' ? null : nome
}

/**
 * Uma entrada do "?" com o texto da seção ligada, as cópias de nome e quem diz
 * em dia; a MESMA entrada quando nada muda. Mesma regra do pino ligado: seção
 * de segredo (ou que virou segredo) vira "Texto indisponível."; fonte apagada
 * deixa a cópia de reserva.
 */
export function falaEmDia(fala: FalaDoPino, verbetes: ReadonlyMap<string, Verbete>): FalaDoPino {
  let nova = fala
  const fonte = fala.fonte
  const situacao = fonte === undefined ? null : situacaoDaFonte(fonte, verbetes)
  if (fonte !== undefined && situacao !== null && situacao.t !== 'sumiu') {
    const texto = textoParaOJogador(situacao) ?? fala.texto
    if (fala.texto !== texto || fonte.verbete !== situacao.verbete || fonte.secao !== situacao.secao) {
      nova = { ...nova, texto, fonte: { ...fonte, verbete: situacao.verbete, secao: situacao.secao } }
    }
  }
  const quem = fala.quemVerbeteId === undefined ? null : quemDizEmDia(fala.quemVerbeteId, verbetes)
  if (quem !== null && nova.quem !== quem) nova = { ...nova, quem }
  return nova
}

function falasDoPinoEmDia(pin: Pin, verbetes: ReadonlyMap<string, Verbete>): Pin {
  if (!Array.isArray(pin.falas)) return pin
  let mudou = false
  const falas = pin.falas.map((fala) => {
    const nova = falaEmDia(fala, verbetes)
    if (nova !== fala) mudou = true
    return nova
  })
  return mudou ? { ...pin, falas } : pin
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
