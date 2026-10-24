import { parseSomHostMessage } from './protocol'

/**
 * SONS AO VIVO, fatia F5 (contrato em `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`,
 * seção 2): os áudios que uma mensagem LIBERA para a conexão que a recebe. O
 * servidor da sala só entrega `/sons/<id>` a quem o host liberou aquele id, e
 * a liberação vai no mesmo `net_send` da mensagem: assim o liberado é, por
 * construção, exatamente o que saiu para aquela conexão, na ordem dela.
 *
 * `som.tocar` libera a fonte; `som.precarregar`, os ids da pré-carga; o resto
 * (inclusive o envelope comprimido, que nunca leva som) não libera nada. A
 * mensagem passa pelo MESMO parser do jogador: id torto não vira liberação.
 */
export function midiasDaMensagem(carga: object): string[] {
  const msg = parseSomHostMessage(carga)
  if (msg === null) return []
  if (msg.type === 'som.tocar') return [msg.fonte.midia]
  if (msg.type === 'som.precarregar') return [...msg.midias]
  return []
}
