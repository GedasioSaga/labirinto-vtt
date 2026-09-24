import { buildTokenSharedPhoto } from '../lib/imageImport'
import { PROP_PLAYER_LABEL_MAX, propPlayerImage } from '../lib/propPlayerLook'
import { useMapStore } from './mapStore'

/**
 * OBJETO COM RÓTULO OU IMAGEM — os dois gestos do mestre no painel do objeto,
 * gravados no mapa com desfazer (`updateProp`). O recorte do jogador
 * (`lib/fogFilter.ts`) lê daqui e decide quem recebe.
 */

/**
 * "Rótulo para jogadores" enquanto o mestre digita. Só corta no teto: aparar
 * aqui comeria o espaço entre "Piano" e "de cauda" no meio da digitação — quem
 * apara é o recorte, na hora de mandar. Campo vazio apaga o rótulo.
 */
export function setPropLabelForPlayers(propId: string, label: string): void {
  const cortado = label.slice(0, PROP_PLAYER_LABEL_MAX)
  useMapStore.getState().updateProp(propId, { playerLabel: cortado === '' ? undefined : cortado })
}

/** Monta a cópia pequena a partir do arquivo do objeto; trocável no teste. */
export type PropImageBuilder = (sourcePath: string) => Promise<string>

/**
 * "Mostrar imagem ao jogador". Ligar monta a cópia pequena e auto-contida da
 * imagem do objeto (o mesmo teto da foto da ficha) e a grava; desligar apaga a
 * cópia. Cópia que não sai na forma auto-contida NÃO é gravada: o erro sobe
 * para quem chamou avisar o mestre (`reportFileError` no App).
 */
export async function setPropImageShownToPlayers(
  propId: string,
  show: boolean,
  build: PropImageBuilder = buildTokenSharedPhoto,
): Promise<void> {
  const { map, updateProp } = useMapStore.getState()
  const prop = map.props.find((p) => p.id === propId)
  if (prop === undefined) return
  if (!show) {
    updateProp(propId, { playerImage: undefined })
    return
  }
  const copia = propPlayerImage(await build(prop.src))
  if (copia === undefined) throw new Error('a imagem do objeto não virou uma cópia pequena que dê para mandar')
  // O objeto pode ter sido apagado enquanto a cópia era montada: não ressuscita nada.
  if (!useMapStore.getState().map.props.some((p) => p.id === propId)) return
  useMapStore.getState().updateProp(propId, { playerImage: copia })
}
