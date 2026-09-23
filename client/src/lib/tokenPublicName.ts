import type { Token } from '../types/map'

/** As três escolhas de "Nome para os jogadores" no painel da ficha. */
export type TokenPublicNameMode = 'same' | 'other' | 'none'

/**
 * Qual escolha o campo guarda. Qualquer coisa que não seja texto nem `null`
 * (ausente, ou valor torto que escapou da leitura do disco) é "O mesmo" — o
 * que a ficha sempre mostrou.
 */
export function tokenPublicNameMode(publicName: Token['publicName']): TokenPublicNameMode {
  if (publicName === null) return 'none'
  return typeof publicName === 'string' ? 'other' : 'same'
}

/**
 * A ficha como um jogador a recebe. O dono vê o nome real; os outros, o nome
 * público. Nos dois casos `publicName` sai do objeto: o dono não precisa saber
 * como a mesa o vê, e o nome de trabalho nunca é lido fora do recorte.
 * Ficha sem o campo volta pela mesma referência.
 */
export function tokenAsSeenByPlayer(token: Token, isOwner: boolean): Token {
  if (!('publicName' in token)) return token
  // `publicName` descartado de propósito: é só o rest que viaja.
  const { publicName, ...rest } = token
  if (isOwner) return rest
  if (publicName === null) return { ...rest, name: '' }
  return typeof publicName === 'string' ? { ...rest, name: publicName } : rest
}

/**
 * Leitura do disco (mão única): texto e `null` ficam; qualquer outro valor
 * (arquivo editado à mão) some — a ficha volta a "O mesmo". Ficha sem o campo
 * ou com valor válido volta pela mesma referência, sem ganhar chave nova.
 */
export function tokenPublicNameFromFile(token: Token): Token {
  const value: unknown = token.publicName
  if (value === undefined || value === null || typeof value === 'string') return token
  const { publicName: _torto, ...rest } = token
  return rest
}
