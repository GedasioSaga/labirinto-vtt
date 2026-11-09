/**
 * O TAMANHO DA LETRA DE CADA CARTÃO (copiado do Grimório, `lib/escalaFonte.ts`).
 * É o `fonteEscala` do cartão: um multiplicador por cima da escala que o
 * tamanho do cartão já dá. Os quadros importados trazem o valor de lá, e ele vale.
 */
export const FONTE_MIN = 0.8
export const FONTE_MAX = 2.0
export const FONTE_PASSO = 0.1

/** A próxima escala depois de `delta`, arredondada a 1 casa e presa entre o mínimo e o máximo. */
export function proximaEscala(atual: number, delta: number): number {
  const bruto = Math.round((atual + delta) * 10) / 10
  return Math.min(FONTE_MAX, Math.max(FONTE_MIN, bruto))
}

/**
 * A escala a mais dos controles do cartão (A−, A+, o lápis), por cima da do
 * cartão. O que o olho vê é `px × escala do cartão × zoom`: num cartão pequeno
 * com a câmera afastada, um botão de 12 px chegaria à tela com 3 px. A escala
 * sobe até o controle ter um piso na tela, com teto (em zoom 0,2 o botão não
 * pode ficar maior que o cartão), e anda em degraus para cima, para a roda do
 * mouse não redesenhar todo cartão a cada quadro do zoom.
 */
export const CONTROLE_BASE_PX = 12
export const CONTROLE_PISO_PX = 14
export const CONTROLE_TETO = 2.2
const DEGRAUS = 20

export function escalaDosControles(escalaDoCartao: number, zoom: number): number {
  const naTela = CONTROLE_BASE_PX * escalaDoCartao * zoom
  // Zoom ou escala inválidos só viriam do editor fora de estado: 1 deixa o cartão como era.
  if (!Number.isFinite(naTela) || naTela <= 0) return 1
  const bruto = Math.max(1, CONTROLE_PISO_PX / naTela)
  return Math.min(CONTROLE_TETO, Math.ceil(bruto * DEGRAUS) / DEGRAUS)
}
