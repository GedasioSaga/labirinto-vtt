import { useId } from 'react'
import type { TokenVehicle } from '../types/map'
import { VEHICLE_SEATS_DEFAULT, VEHICLE_SEATS_MAX, VEHICLE_SEATS_MIN, type VehicleSeatOption } from '../lib/vehicle'
import { Toggle } from './Toggle'
import './TokenControls.css'

export interface TokenVehicleControlsProps {
  /** Veículo da ficha selecionada, já lido (`vehicleOf`); `null` = ficha comum. */
  vehicle: TokenVehicle | null
  /** As fichas da cena que podem embarcar (`vehicleSeatOptions`). */
  options: readonly VehicleSeatOption[]
  /** Lugares novos, ou `null` para a ficha deixar de ser veículo. */
  onSeatsChange: (lugares: number | null) => void
  /** Embarcar (`true`) ou descer (`false`) a ficha `tokenId`. */
  onPassengerChange: (tokenId: string, aBordo: boolean) => void
}

/**
 * VEÍCULO COM LUGARES (cesto, bote, vagonete) — o mestre faz da ficha um
 * veículo, diz quantos cabem e marca quem está a bordo. Quem está a bordo anda
 * junto com o veículo e atravessa o pino junto (`lib/vehicle.ts`).
 *
 * Interruptor nativo (`Toggle`) para ligar; ligado, menos/mais para os
 * lugares (menos para em quem já está a bordo) e uma caixa nativa por ficha
 * da cena. Cheio, quem está fora fica indisponível e o texto diz por quê; a
 * ficha longe do veículo também, com "longe do veículo" na linha dela.
 * Cada clique passa pelo histórico, então Ctrl+Z desfaz.
 *
 * UMA linha, sem título (peça ficha-em-ordem-de-tarefa, no molde das linhas
 * de opcional do Figma UI3): o interruptor já diz o que é o bloco. Desligado,
 * é a linha de 34 px das outras chaves da ficha; ligado, lugares e "A bordo"
 * aparecem embaixo e o interruptor não sai do lugar (TokenControls.css).
 */
export function TokenVehicleControls({ vehicle, options, onSeatsChange, onPassengerChange }: TokenVehicleControlsProps) {
  const statusId = useId()
  const ocupados = options.filter((option) => option.aBordo).length
  return (
    <section className="lb-section lb-token-linha">
      <Toggle label="Esta ficha é um veículo" checked={vehicle !== null} onChange={(on) => onSeatsChange(on ? VEHICLE_SEATS_DEFAULT : null)} />
      {vehicle !== null && (
        <div className="lb-token-linha__corpo">
          <span className="lb-label">Lugares</span>
          <div className="lb-vehicle__seats">
            <button
              type="button"
              className="lb-btn"
              aria-label="Menos um lugar"
              disabled={vehicle.lugares <= Math.max(VEHICLE_SEATS_MIN, ocupados)}
              onClick={() => onSeatsChange(vehicle.lugares - 1)}
            >
              −
            </button>
            <output className="lb-vehicle__count" aria-live="polite">
              {vehicle.lugares}
            </output>
            <button
              type="button"
              className="lb-btn"
              aria-label="Mais um lugar"
              disabled={vehicle.lugares >= VEHICLE_SEATS_MAX}
              onClick={() => onSeatsChange(vehicle.lugares + 1)}
            >
              +
            </button>
          </div>
          <span className="lb-label">A bordo</span>
          {options.length === 0 ? (
            <span className="lb-label">Nenhuma outra ficha nesta cena para embarcar.</span>
          ) : (
            <>
              <ul className="lb-gather__list" aria-describedby={statusId}>
                {options.map((option) => (
                  <li key={option.id}>
                    <label className={option.disponivel ? 'lb-gather__item' : 'lb-gather__item lb-vehicle__item--off'}>
                      <input
                        type="checkbox"
                        className="lb-gather__check"
                        checked={option.aBordo}
                        disabled={!option.disponivel}
                        onChange={(event) => onPassengerChange(option.id, event.target.checked)}
                      />
                      <span className="lb-party__name">{option.nome}</span>
                      {/* Embarcar exige proximidade: o mestre traz a ficha para perto antes. */}
                      {option.longe && <span className="lb-vehicle__far"> — longe do veículo</span>}
                    </label>
                  </li>
                ))}
              </ul>
              <span className="lb-label" id={statusId}>
                {ocupados >= vehicle.lugares ? 'Cheio: ' : ''}
                {`${ocupados} de ${vehicle.lugares} lugares ocupados.`}
              </span>
            </>
          )}
          {/* O mestre precisa saber o que sai para a mesa e o que fica com ele. */}
          <span className="lb-label">Quem joga não vê a lista: vê as fichas andando juntas.</span>
        </div>
      )}
    </section>
  )
}
