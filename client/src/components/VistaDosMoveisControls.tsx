import { useId } from 'react'
import { useMapStore } from '../stores/mapStore'
import { Toggle } from './Toggle'

/**
 * "Todos os móveis em 3/4": a vista padrão dos móveis DESTE MAPA
 * (`MapData.vistaDosMoveis`, Meio-Termo), na janela Configurações do mapa. Lê
 * e grava direto na store, com desfazer (`definirVistaDosMoveis`): ligar ou
 * desligar muda todos os móveis e apaga, no mesmo passo do Ctrl+Z, as escolhas
 * feitas objeto por objeto (a "Vista 3/4" da ficha de cada um).
 */
export function VistaDosMoveisDoMapa() {
  const ajudaId = `${useId()}-vista-dos-moveis`
  const ligada = useMapStore((state) => state.map.vistaDosMoveis === 'tres-quartos')
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Móveis</h2>
      <Toggle
        label="Todos os móveis em 3/4"
        checked={ligada}
        describedBy={ajudaId}
        onChange={(ligar) => useMapStore.getState().definirVistaDosMoveis(ligar ? 'tres-quartos' : undefined)}
      />
      <p className="lb-field__hint" id={ajudaId}>
        Muda todos os móveis deste mapa e apaga as escolhas feitas objeto por objeto.
      </p>
    </section>
  )
}
