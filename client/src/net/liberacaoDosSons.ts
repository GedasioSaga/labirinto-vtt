import { idDaRefDeAudio } from '../lib/midia'
import { parseSomHostMessage } from './protocol'
import { parseDancaHostMessage } from './protocoloDaDanca'

/**
 * SONS AO VIVO, fatia F5 (contrato em `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`,
 * seção 2): os áudios que uma mensagem LIBERA para a conexão que a recebe. O
 * servidor da sala só entrega `/sons/<id>` a quem o host liberou aquele id, e
 * a liberação vai no mesmo `net_send` da mensagem: assim o liberado é, por
 * construção, exatamente o que saiu para aquela conexão, na ordem dela.
 *
 * `som.tocar` libera a fonte; `som.precarregar`, os ids da pré-carga;
 * `danca.convite` com música importada, a música (F5d: o jogador a baixa por
 * `/sons/<id>` assim que o convite chega, bem antes do `danca.comecar`). O
 * resto não libera nada. Quem chama passa a mensagem ORIGINAL, nunca o
 * envelope comprimido (o convite com a coreografia passa fácil do limiar do
 * gzip). A mensagem passa pelo MESMO parser do jogador: id torto não vira
 * liberação.
 */
export function midiasDaMensagem(carga: object): string[] {
  if (Reflect.get(carga, 'type') === 'danca.convite') return musicaDoConvite(carga)
  const msg = parseSomHostMessage(carga)
  if (msg === null) return []
  if (msg.type === 'som.tocar') return [msg.fonte.midia]
  if (msg.type === 'som.precarregar') return [...msg.midias]
  return []
}

/** A música importada do convite, pelo id que `/sons/<id>` serve; faixa demo ou convite torto, nada. */
function musicaDoConvite(carga: object): string[] {
  const msg = parseDancaHostMessage(carga)
  if (msg === null || msg.type !== 'danca.convite' || msg.musica.tipo !== 'arquivo') return []
  const id = idDaRefDeAudio(msg.musica.midia)
  return id === null ? [] : [id]
}
