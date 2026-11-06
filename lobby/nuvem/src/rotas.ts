/**
 * As rotas que chegam aos DOs (plano §5.4). O portão (W2) repassa o pedido
 * com a URL de sempre; o DO Campanha relê a rota daqui, e `encaminhar` usa a
 * mesma leitura para escolher o DO. Mídia (`/midia/:hash`) é da fatia W3.
 */

export const ROTA_DO_EU = '/api/eu'
export const ROTA_DA_VERSAO = '/api/versao'
/** O DO Diretório é um só (e-mail -> campanhas, §4.5). */
export const NOME_DO_DIRETORIO = 'diretorio'

export type NomeDaRota = 'publicar' | 'membros' | 'ops' | 'desde' | 'exportar' | 'ws'

export interface RotaDaCampanha {
  campanhaId: string
  nome: NomeDaRota
  /** Só em `desde/:rev`. */
  rev: number
}

const FORMA_DA_ROTA = /^\/api\/c\/([A-Za-z0-9_-]{1,80})\/(publicar|membros|ops|exportar|ws|desde\/(\d{1,15}))$/

function nomeDaRota(trecho: string): NomeDaRota | null {
  if (trecho.startsWith('desde/')) return 'desde'
  switch (trecho) {
    case 'publicar':
    case 'membros':
    case 'ops':
    case 'exportar':
    case 'ws':
      return trecho
    default:
      return null
  }
}

/** A rota de campanha do caminho; `null` = não é rota de campanha (a resposta é "não existe"). */
export function rotaDaCampanha(caminho: string): RotaDaCampanha | null {
  const achado = FORMA_DA_ROTA.exec(caminho)
  if (achado === null) return null
  const [, campanhaId, trecho, rev] = achado
  const nome = nomeDaRota(trecho)
  if (nome === null) return null
  return { campanhaId, nome, rev: rev === undefined ? 0 : Number(rev) }
}
