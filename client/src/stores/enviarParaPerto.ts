import { lugaresPertoDoAlvo } from '../lib/enviarParaPerto'
import { nomeDoPiso, pisoDe } from '../lib/pisos'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

/**
 * "ENVIAR PARA PERTO DE ›" (pedido de 25/11/2026): as fichas `tokenIds` vão
 * para as casas livres em volta do token `alvoId`, no piso dele
 * (`lib/enviarParaPerto.ts`), num passo só do Ctrl+Z. O editor vai junto
 * para o piso do alvo, com elas selecionadas. `false` = nenhuma saiu do
 * lugar (o aviso diz por quê).
 */
export function enviarParaPerto(tokenIds: readonly string[], alvoId: string): boolean {
  const { map, pisoAtivo } = useMapStore.getState()
  const alvo = map.tokens.find((token) => token.id === alvoId)
  const plano = lugaresPertoDoAlvo(map, alvoId, tokenIds)
  const toast = useToastStore.getState()
  if (alvo === undefined || plano === null) {
    toast.push('error', 'Esse token não está mais no mapa.')
    return false
  }
  const nomeDoAlvo = alvo.name.trim() || 'o token'
  if (plano.lugares.length === 0) {
    toast.push('error', plano.semLugar.length === 0 ? `Nada para mandar: só ${nomeDoAlvo} está selecionado.` : `Não há casa livre perto de ${nomeDoAlvo}. Nenhuma ficha saiu do lugar.`)
    return false
  }
  useMapStore.getState().levarFichasParaPerto(plano.lugares, plano.piso)
  const [primeira] = plano.lugares
  const nomeDaPrimeira = primeira === undefined ? '' : (map.tokens.find((token) => token.id === primeira.id)?.name.trim() ?? '')
  const quem = plano.lugares.length === 1 ? `${nomeDaPrimeira || 'A ficha'} foi` : `${plano.lugares.length} fichas foram`
  const outroPiso = plano.piso !== pisoAtivo || plano.lugares.some((lugar) => map.tokens.some((token) => token.id === lugar.id && pisoDe(token) !== plano.piso))
  const piso = outroPiso ? ` (${nomeDoPiso(plano.piso)})` : ''
  const sobra = plano.semLugar.length === 0 ? '' : `; ${plano.semLugar.length === 1 ? '1 não coube e ficou' : `${plano.semLugar.length} não couberam e ficaram`} onde estava${plano.semLugar.length === 1 ? '' : 'm'}`
  toast.push('info', `${quem} para perto de ${nomeDoAlvo}${piso}${sobra}. Ctrl+Z desfaz.`)
  return true
}
