import { lerJsonSeguro } from './nucleo'

/**
 * Respostas e leitura de corpo do Worker. Pedido torto vira `ErroDoPedido`
 * (status + código curto), nunca exceção crua: a mensagem não carrega nada
 * do pedido (plano §6.2: nada de logar ou ecoar o corpo).
 */

export class ErroDoPedido extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    readonly detalhe: string,
  ) {
    super(`${status} ${codigo}`)
  }
}

export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Não membro, campanha que não existe e rota que não existe têm a mesma resposta (§6.4): não revela nada. */
export function naoExiste(): Response {
  return json({ erro: 'nao-existe' }, 404)
}

export function respostaDoErro(erro: ErroDoPedido): Response {
  return json({ erro: erro.codigo, detalhe: erro.detalhe }, erro.status)
}

const decodificador = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })

/** O corpo JSON do pedido, com teto em bytes conferido antes e depois de ler (o `content-length` pode mentir ou faltar). */
export async function lerCorpo(request: Request, tetoEmBytes: number): Promise<unknown> {
  const declarado = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declarado) && declarado > tetoEmBytes) throw new ErroDoPedido(413, 'corpo-grande', `Pedido grande demais: máximo ${tetoEmBytes} bytes`)
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > tetoEmBytes) throw new ErroDoPedido(413, 'corpo-grande', `Pedido grande demais: máximo ${tetoEmBytes} bytes`)
  try {
    return lerJsonSeguro(decodificador.decode(bytes))
  } catch {
    // Texto que não é UTF-8 ou JSON torto: o motivo exato não ajuda o cliente certo e não é ecoado.
    throw new ErroDoPedido(400, 'json-invalido', 'Corpo do pedido fora do formato')
  }
}

/** Inteiro não negativo de um parâmetro da URL; ausente = `padrao`. */
export function inteiroDaUrl(url: URL, nome: string, padrao: number): number {
  const texto = url.searchParams.get(nome)
  if (texto === null) return padrao
  if (!/^\d{1,15}$/.test(texto)) throw new ErroDoPedido(400, 'parametro-invalido', `Parâmetro ${nome} fora do formato`)
  return Number(texto)
}
