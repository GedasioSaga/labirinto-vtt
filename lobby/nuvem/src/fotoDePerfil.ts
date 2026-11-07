import { ErroDoPedido } from './http'
import { apagarMidia, gravarMidia, lerBytesComTeto, metaDaMidia, PREFIXO_DO_PERFIL, type IdDaMidia } from './midia'
import { hashHex, membroAtivo, tipoDosBytes, type TipoDeMidia } from './nucleo'
import { membroPorConta } from './banco'
import { KIB } from './pedidos'

/**
 * A FOTO DE PERFIL (07/11/2026): a foto é da CONTA nesta campanha, não da
 * ficha. `PUT /api/c/:id/foto` (o corpo é a imagem) troca e
 * `DELETE /api/c/:id/foto` tira (volta a inicial).
 *
 * - Só a própria: a conta sai do e-mail do Access, nunca do pedido; não há
 *   como apontar outra conta. Qualquer membro ativo pode (jogador ou mestre).
 * - Teto de 256 KiB (o site já reduz para 256 x 256), lido com teto; o tipo
 *   vem dos BYTES (webp, png ou jpg; gif não, nem SVG) e o id é o sha256 que
 *   o próprio servidor calcula: mora na mídia da campanha (W3, `midia.ts`),
 *   servida pela mesma rota, com os mesmos cabeçalhos.
 * - Ritmo por conta (GCRA no KV do DO, como o bilhete): trocar e tirar contam.
 * - A foto anterior some da mídia só se for foto de perfil de ninguém mais
 *   (`enviadoPor` = `perfil:<contaId>`); se o mestre subiu os mesmos bytes
 *   para uma ficha, ela já é dele e fica.
 */

export const FOTO_MAX_BYTES = 256 * KIB
const TIPOS_DA_FOTO: ReadonlySet<TipoDeMidia> = new Set(['webp', 'png', 'jpg'])

/** Uma troca a cada 10 s, com folga para 3 seguidas (escolher, errar o recorte, escolher de novo). */
const INTERVALO_DA_FOTO_MS = 10_000
const RAJADA_DA_FOTO = 3

export type RitmoDaFoto = { ok: true; paceAt: number } | { ok: false; tentarDepoisDe: number }

export function chaveDoRitmoDaFoto(contaId: string): string {
  return `ritmoDaFoto:${contaId}`
}

/** GCRA, como `conferirRitmoDoBilhete`: passa enquanto o `paceAt` não estiver mais de `(RAJADA - 1) × INTERVALO` à frente de agora. */
export function conferirRitmoDaFoto(paceAt: number | undefined, agora: number): RitmoDaFoto {
  const teorico = paceAt === undefined ? agora : Math.max(paceAt, agora)
  const folga = (RAJADA_DA_FOTO - 1) * INTERVALO_DA_FOTO_MS
  if (teorico - agora > folga) return { ok: false, tentarDepoisDe: teorico - folga }
  return { ok: true, paceAt: teorico + INTERVALO_DA_FOTO_MS }
}

export interface FotoRecebida {
  id: IdDaMidia
  bytes: Uint8Array
}

const fotoGrandeDemais = (): ErroDoPedido => new ErroDoPedido(413, 'foto-grande', `A foto passa de ${FOTO_MAX_BYTES / KIB} KiB`)

/** O corpo do PUT: com teto, imagem pelos bytes e o hash calculado aqui. */
export async function lerFotoDoPedido(request: Request): Promise<FotoRecebida> {
  const bytes = await lerBytesComTeto(request, FOTO_MAX_BYTES, fotoGrandeDemais)
  const tipo = tipoDosBytes(bytes)
  if (tipo === null || !TIPOS_DA_FOTO.has(tipo)) throw new ErroDoPedido(400, 'foto-tipo', 'A foto precisa ser uma imagem webp, png ou jpg')
  return { id: { hash: await hashHex(bytes), tipo }, bytes }
}

function fotoDaConta(sql: SqlStorage, contaId: string): string | null {
  for (const linha of sql.exec('SELECT foto FROM membros WHERE contaId = ?', contaId)) return typeof linha.foto === 'string' ? linha.foto : null
  return null
}

/** A foto que saiu: apaga a mídia se ela é só foto de perfil e nenhuma outra conta a usa. */
function apagarSeSobrou(sql: SqlStorage, foto: string): void {
  const hash = foto.split('.')[0]
  const meta = metaDaMidia(sql, hash)
  if (meta === undefined || !meta.enviadoPor.startsWith(PREFIXO_DO_PERFIL)) return
  if (sql.exec('SELECT contaId FROM membros WHERE foto = ? LIMIT 1', foto).toArray().length > 0) return
  apagarMidia(sql, hash)
}

/**
 * Troca (`nova`) ou tira (`null`) a foto da conta. Chamar dentro de
 * `transactionSync`: o membro é relido aqui (pode ter saído enquanto o corpo
 * chegava). Devolve o id da foto de agora, ou `null`.
 */
export function trocarFotoDaConta(sql: SqlStorage, contaId: string, nova: FotoRecebida | null, agora: number): string | null {
  if (!membroAtivo(membroPorConta(sql, contaId))) throw new ErroDoPedido(404, 'nao-existe', 'Não existe')
  const anterior = fotoDaConta(sql, contaId)
  let atual: string | null = null
  if (nova !== null) {
    gravarMidia(sql, nova.id, nova.bytes, `${PREFIXO_DO_PERFIL}${contaId}`, agora)
    atual = `${nova.id.hash}.${nova.id.tipo}`
  }
  sql.exec('UPDATE membros SET foto = ? WHERE contaId = ?', atual, contaId)
  if (anterior !== null && anterior !== atual) apagarSeSobrou(sql, anterior)
  return atual
}
