/**
 * As rotas que chegam aos DOs (plano §5.4). O portão (W2) repassa o pedido
 * com a URL de sempre; o DO Campanha relê a rota daqui, e `encaminhar` usa a
 * mesma leitura para escolher o DO. A mídia (`/midia/:id`, fatia W3) chega
 * com o id já na forma exata `<sha256>.<ext>`.
 */

export const ROTA_DO_EU = '/api/eu'
export const ROTA_DA_VERSAO = '/api/versao'
/** O DO Diretório é um só (e-mail -> campanhas, §4.5). */
export const NOME_DO_DIRETORIO = 'diretorio'

export type RotaDaCampanha =
  /** `chatSala` = `GET /chat/sala?desde=<cursor>`, a cópia da sala do app (v2, C1 no servidor; C3 no app). */
  | { campanhaId: string; nome: 'publicar' | 'membros' | 'ops' | 'exportar' | 'ws' | 'chatSala' }
  | RotaDoDesde
  | RotaDaMidia

export interface RotaDoDesde {
  campanhaId: string
  nome: 'desde'
  rev: number
}

export interface RotaDaMidia {
  campanhaId: string
  nome: 'midia'
  /** `<64 hex minúsculos>.<webp|png|jpg|gif>`, a mesma forma de `ehIdDeMidia` (client/src/lib/midia.ts). */
  midiaId: string
}

const FORMA_DA_ROTA =
  /^\/api\/c\/([A-Za-z0-9_-]{1,80})\/(publicar|membros|ops|exportar|ws|chat\/sala|desde\/(\d{1,15})|midia\/([0-9a-f]{64}\.(?:webp|png|jpg|gif)))$/

/** A rota de campanha do caminho; `null` = não é rota de campanha (a resposta é "não existe"). */
export function rotaDaCampanha(caminho: string): RotaDaCampanha | null {
  const achado = FORMA_DA_ROTA.exec(caminho)
  if (achado === null) return null
  const [, campanhaId, trecho, rev, midiaId] = achado
  if (rev !== undefined) return { campanhaId, nome: 'desde', rev: Number(rev) }
  if (midiaId !== undefined) return { campanhaId, nome: 'midia', midiaId }
  switch (trecho) {
    case 'publicar':
    case 'membros':
    case 'ops':
    case 'exportar':
    case 'ws':
      return { campanhaId, nome: trecho }
    case 'chat/sala':
      return { campanhaId, nome: 'chatSala' }
    default:
      return null
  }
}
