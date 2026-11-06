import { json, naoExiste } from './http'
import { comIdentidade, type IdentidadeDoPortao } from './identidade'
import { VERSAO_DO_FORMATO } from './nucleo'
import { NOME_DO_DIRETORIO, ROTA_DA_VERSAO, ROTA_DO_EU, rotaDaCampanha } from './rotas'

/**
 * O repasse ao DO certo, depois que o portão validou quem é (plano §6.2).
 * O portão (W2) chama isto com a identidade que montou do JWT; a porta de
 * dev (`dev.ts`) chama com a identidade da URL. Daqui para dentro, a
 * identidade só existe no cabeçalho que este repasse grava.
 */
export async function encaminhar(request: Request, env: Env, identidade: IdentidadeDoPortao): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname === ROTA_DA_VERSAO) return json({ versaoDoFormato: VERSAO_DO_FORMATO })
  if (url.pathname === ROTA_DO_EU) {
    return env.DIRETORIO.get(env.DIRETORIO.idFromName(NOME_DO_DIRETORIO)).fetch(comIdentidade(request, url, identidade))
  }
  const rota = rotaDaCampanha(url.pathname)
  if (rota === null) return naoExiste()
  return env.CAMPANHA.get(env.CAMPANHA.idFromName(rota.campanhaId)).fetch(comIdentidade(request, url, identidade))
}
