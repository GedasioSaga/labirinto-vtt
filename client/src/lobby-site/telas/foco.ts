/**
 * O PEDIDO DE FOCO num aviso de decisão: o "Ver" da faixa (ou a resposta a
 * um Salvar desta tela) pede, e o aviso, quando aparece, toma. Fica fora do
 * React de propósito: o aviso pode só nascer depois da navegação, e quem
 * pediu não espera por ele.
 */

let avisoPedido: string | null = null

export function pedirFocoNoAviso(opId: string): void {
  avisoPedido = opId
}

/** `true` uma vez só, para o aviso pedido (o pedido some ao ser tomado). */
export function tomarFocoPedido(opId: string): boolean {
  if (avisoPedido !== opId) return false
  avisoPedido = null
  return true
}

export function idDoAviso(opId: string): string {
  return `aviso-${opId}`
}

/** Quanto tempo depois de um envio desta tela um aviso novo ainda é "resposta" a ele (e toma o foco). */
const RESPOSTA_AO_ENVIO_MS = 30_000

let ultimoEnvio = Number.NEGATIVE_INFINITY

/** A pessoa acabou de mandar uma mudança daqui (Salvar, −/+, mochila). */
export function marcarEnvio(): void {
  ultimoEnvio = Date.now()
}

/** Um aviso que chega agora responde a um envio recente: leva o foco até ele (senão, só é anunciado). */
export function enviouHaPouco(): boolean {
  return Date.now() - ultimoEnvio < RESPOSTA_AO_ENVIO_MS
}
