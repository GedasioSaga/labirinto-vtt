import { paraOFio, type Personagem } from '../lib/personagem'

/**
 * A ficha de um ALIADO na batalha (`batalha.aliados` e `batalhaDBT.aliados`):
 * a do fio (`paraOFio`) sem a lista de documentos. A lista é do dono da ficha
 * (pendência 2 da D1, decidida na D3): o aliado vê a carta do colega, não o
 * que ele leu, ganhou ou recebeu do mestre. Sem lista, a MESMA referência que
 * `paraOFio` devolveu.
 */
export function paraOAliado(personagem: Personagem): Personagem {
  const publico = paraOFio(personagem)
  if (publico.documentos === undefined) return publico
  const { documentos: _doDono, ...semLista } = publico
  return semLista
}
