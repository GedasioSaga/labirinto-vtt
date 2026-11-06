import { ehRegistro, lerJsonSeguro, proprio } from './nucleo'

/**
 * A identidade que o portão (lobby/site, fatia W2) põe no pedido depois de
 * validar o JWT do Access (plano §6.2): o e-mail da pessoa, ou o do mestre
 * quando é o Service Token do app (mapeado por `MAPA_DO_APP`). O portão APAGA
 * qualquer `X-Identidade` que venha de fora e grava a sua; o Worker não tem
 * rota pública (§6.3), então só o portão chega aqui com ela.
 *
 * Conta, nome e papel NÃO vêm do portão: o DO Campanha os lê de `membros`
 * pelo e-mail a cada pedido e a cada mensagem (§6.4).
 */

export const CABECALHO_DA_IDENTIDADE = 'X-Identidade'

export interface IdentidadeDoPortao {
  email: string
  /** `mesa` nunca vem daqui: é por op, com `autorDeclarado`, e só do app. */
  origem: 'app' | 'site'
}

const FORMA_DO_EMAIL = /^[^\s@]{1,64}@[^\s@]{1,189}$/

/** E-mail em minúsculas e sem espaços nas pontas (§4.3); `null` se não parece e-mail. */
export function emailNormalizado(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const email = valor.trim().toLowerCase()
  return FORMA_DO_EMAIL.test(email) ? email : null
}

function identidadeDe(valor: unknown): IdentidadeDoPortao | null {
  if (!ehRegistro(valor)) return null
  const email = emailNormalizado(proprio(valor, 'email'))
  const origem = proprio(valor, 'origem')
  if (email === null || (origem !== 'app' && origem !== 'site')) return null
  return { email, origem }
}

/** A identidade gravada pelo portão; `null` = pedido sem ela (o DO responde "não existe"). */
export function lerIdentidade(request: Request): IdentidadeDoPortao | null {
  const texto = request.headers.get(CABECALHO_DA_IDENTIDADE)
  if (texto === null) return null
  try {
    return identidadeDe(lerJsonSeguro(texto))
  } catch {
    // Cabeçalho que não é JSON: o mesmo que não ter identidade.
    return null
  }
}

/** O pedido com a identidade do portão no lugar de qualquer uma que tenha vindo de fora. */
export function comIdentidade(request: Request, url: URL, identidade: IdentidadeDoPortao): Request {
  const cabecalhos = new Headers(request.headers)
  cabecalhos.delete(CABECALHO_DA_IDENTIDADE)
  cabecalhos.set(CABECALHO_DA_IDENTIDADE, JSON.stringify(identidade))
  return new Request(url.toString(), { method: request.method, headers: cabecalhos, body: request.body })
}
