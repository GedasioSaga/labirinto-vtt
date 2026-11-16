import { useId } from 'react'
import { useMapStore } from '../stores/mapStore'
import { Toggle } from './Toggle'

/**
 * ARMADILHAS (Configurações do mapa, pedido de 15/11/2026): o Jumpscare da
 * cobra, por mapa, ligado de fábrica. Desligado, a cobra ainda morde (o dano e
 * o Envenenado valem); só não pula na tela do jogador, que vê a imagem parada
 * com o som. O movimento reduzido do aparelho do jogador vale sempre, à parte.
 */
export function ArmadilhasDoMapa() {
  const ligado = useMapStore((state) => state.map.semJumpscare !== true)
  const setJumpscareDoMapa = useMapStore((state) => state.setJumpscareDoMapa)
  const explicacaoId = useId()
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Armadilhas</h2>
      <div className="lb-field">
        <Toggle label="Jumpscare" checked={ligado} onChange={setJumpscareDoMapa} describedBy={explicacaoId} />
        <p id={explicacaoId} className="lb-field__hint">
          Ligado de fábrica. Desligado, a cobra ainda morde; só não pula na tela do jogador.
        </p>
      </div>
    </section>
  )
}
