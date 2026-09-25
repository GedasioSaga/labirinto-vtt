/**
 * CAIXA DE PEDIDOS COM IDADE: a linha pequena embaixo de cada pedido de
 * passagem ("há 3 min · agora a 20 casas do pino"). O mestre atende a mesa
 * inteira e esquece quem espera há mais tempo; e o pedido feito colado no
 * pino pode estar, minutos depois, com a ficha do outro lado da sala.
 * Só texto: quem mede é a sessão (`travelRequestStatus`).
 */

const MINUTO_MS = 60_000
const MINUTOS_POR_HORA = 60

/** "há menos de 1 min", "há 3 min", "há 1 h", "há 1 h 5 min". Espera negativa (relógio voltou) conta como agora. */
export function idadeDoPedido(esperaMs: number): string {
  const minutos = Math.floor(Math.max(0, esperaMs) / MINUTO_MS)
  if (minutos < 1) return 'há menos de 1 min'
  if (minutos < MINUTOS_POR_HORA) return `há ${minutos} min`
  const horas = Math.floor(minutos / MINUTOS_POR_HORA)
  const resto = minutos % MINUTOS_POR_HORA
  return resto === 0 ? `há ${horas} h` : `há ${horas} h ${resto} min`
}

/** "agora a 20 casas do pino", "agora no pino"; `null` = a ficha já não está na cena do pino. */
export function distanciaAoPino(casas: number | null): string {
  if (casas === null) return 'ficha fora da cena do pino'
  if (casas <= 0) return 'agora no pino'
  return casas === 1 ? 'agora a 1 casa do pino' : `agora a ${casas} casas do pino`
}

/** A linha inteira: "há 3 min · agora a 20 casas do pino". */
export function linhaDoPedidoVivo(esperaMs: number, casas: number | null): string {
  return `${idadeDoPedido(esperaMs)} · ${distanciaAoPino(casas)}`
}
