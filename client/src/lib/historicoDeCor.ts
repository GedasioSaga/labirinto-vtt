/**
 * Chave para emendar no histórico os eventos de UM seletor de cor.
 *
 * O `<input type="color">` dispara `onChange` a cada quadro enquanto a pessoa
 * arrasta no seletor: sem emendar, cada quadro virava um passo de Ctrl+Z (e,
 * num chão grande, um passo que guardava um mapa inteiro). Com a chave, os
 * eventos seguidos do mesmo campo atualizam o mapa sem empurrar passo novo —
 * o mesmo `typingKey` dos campos de texto e da cor do título da Sala. Soltar e
 * mexer em OUTRA coisa no meio fecha o passo.
 *
 * Só emenda patch de UM campo cujo valor é cor (texto); "Voltar à cor do
 * chão" (`undefined`) e "sem contorno" (`null`) são um passo cada.
 */
export function chaveDeArrastoDeCor(prefixo: string, patch: object, camposDeCor: readonly string[]): string | undefined {
  const chaves = Object.keys(patch)
  if (chaves.length !== 1) return undefined
  const [campo] = chaves
  if (!camposDeCor.includes(campo)) return undefined
  return typeof (patch as Record<string, unknown>)[campo] === 'string' ? `${prefixo}:${campo}` : undefined
}
