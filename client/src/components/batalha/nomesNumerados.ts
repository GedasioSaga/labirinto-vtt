/**
 * Pedido de 09/11/2026 (item 6): fichas com o MESMO nome ganham número, na
 * ordem do mapa ("Urso 1", "Urso 2"), para o mestre saber qual é qual na lista
 * de quem entra na batalha, no "Fora da ordem" e na mira. Nome que não repete
 * fica como está. A ordem é a de `fichas` (a do mapa): a mesma ficha tem o
 * mesmo número em toda lista que numerar a partir do mapa inteiro.
 *
 * Puro: sem store.
 */
export function nomesNumerados(fichas: readonly { id: string; nome: string }[]): Map<string, string> {
  const chaveDe = (nome: string): string => nome.trim().toLocaleLowerCase('pt-BR')
  const quantos = new Map<string, number>()
  for (const ficha of fichas) quantos.set(chaveDe(ficha.nome), (quantos.get(chaveDe(ficha.nome)) ?? 0) + 1)
  const vistos = new Map<string, number>()
  const rotulos = new Map<string, string>()
  for (const ficha of fichas) {
    const nome = ficha.nome.trim() || 'Ficha'
    const chave = chaveDe(ficha.nome)
    if ((quantos.get(chave) ?? 0) < 2) {
      rotulos.set(ficha.id, nome)
      continue
    }
    const numero = (vistos.get(chave) ?? 0) + 1
    vistos.set(chave, numero)
    rotulos.set(ficha.id, `${nome} ${numero}`)
  }
  return rotulos
}
