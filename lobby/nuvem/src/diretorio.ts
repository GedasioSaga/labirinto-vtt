import { DurableObject } from 'cloudflare:workers'
import { criarEsquemaDoDiretorio } from './esquema'
import { json, naoExiste } from './http'
import { lerIdentidade } from './identidade'
import { ehPapel, texto, type Linha } from './linhas'
import type { Papel } from './nucleo'
import { ROTA_DO_EU } from './rotas'

/**
 * DO DIRETÓRIO (plano §4.5): um só, o índice e-mail -> campanhas que o
 * `/api/eu` lê. Quem escreve é o DO Campanha, quando os membros mudam
 * (`atualizarCampanha`, por RPC); a campanha continua sendo a verdade de quem
 * é membro (a checagem de cada pedido é lá).
 */

export interface EntradaDoDiretorio {
  email: string
  papel: Papel
}

export interface CampanhaDoEmail {
  campanhaId: string
  nome: string
  papel: Papel
}

function campanhaDaLinha(linha: Linha): CampanhaDoEmail {
  const papel = texto(linha, 'papel')
  // A coluna tem CHECK no esquema; conferir de novo só para o tipo.
  if (!ehPapel(papel)) throw new Error('papel gravado fora do formato no Diretório')
  return { campanhaId: texto(linha, 'campanhaId'), nome: texto(linha, 'nomeDaCampanha'), papel }
}

export class Diretorio extends DurableObject<Env> {
  private readonly sql: SqlStorage

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    criarEsquemaDoDiretorio(this.sql)
  }

  /** `GET /api/eu`: o próprio e-mail e as campanhas dele (só aqui o e-mail volta para quem é dono dele, §6.4). */
  fetch(request: Request): Response {
    const identidade = lerIdentidade(request)
    if (identidade === null || request.method !== 'GET' || new URL(request.url).pathname !== ROTA_DO_EU) return naoExiste()
    const campanhas = this.sql
      .exec('SELECT campanhaId, nomeDaCampanha, papel FROM campanhasDoEmail WHERE email = ? ORDER BY nomeDaCampanha', identidade.email)
      .toArray()
      .map(campanhaDaLinha)
    return json({ email: identidade.email, campanhas })
  }

  /** A lista inteira desta campanha troca de uma vez (quem saiu some do índice; a campanha guarda o histórico). */
  atualizarCampanha(campanhaId: string, nome: string, entradas: EntradaDoDiretorio[]): void {
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM campanhasDoEmail WHERE campanhaId = ?', campanhaId)
      for (const { email, papel } of entradas) {
        this.sql.exec('INSERT INTO campanhasDoEmail (email, campanhaId, papel, nomeDaCampanha) VALUES (?, ?, ?, ?)', email, campanhaId, papel, nome)
      }
    })
  }
}
