import { useId } from 'react'
import { perigoDaSala, salasQueOAvancoAtinge } from '../lib/perigo'
import type { MapData, TipoDePerigo } from '../types/map'

export interface PerigoDaSalaControlsProps {
  map: Pick<MapData, 'regions' | 'walls' | 'grid' | 'perigos'>
  salaId: string
  onPor: (tipo: TipoDePerigo) => void
  onAvancar: (perigoId: string) => void
  onApagar: (perigoId: string) => void
}

const NOME_DO_TIPO: Record<TipoDePerigo, string> = { fogo: 'Fogo', agua: 'Água' }

/** Nome da sala como o mestre lê no painel; sala sem nome ganha o texto de sempre. */
function nomeDaSala(map: Pick<MapData, 'regions'>, id: string): string {
  const nome = map.regions.find((r) => r.id === id)?.room?.name.trim() ?? ''
  return nome.length > 0 ? nome : 'Sala sem nome'
}

/**
 * PERIGO QUE SE ALASTRA — bloco "Perigo" do painel da Sala. Sala livre:
 * "Pôr fogo" / "Pôr água". Sala alcançada: o que há nela, o que o PRÓXIMO
 * avanço atinge (pelo nome das salas), "Avançar" e "Apagar perigo".
 */
export function PerigoDaSalaControls({ map, salaId, onPor, onAvancar, onApagar }: PerigoDaSalaControlsProps) {
  const previsaoId = useId()
  const alcance = perigoDaSala(map, salaId)

  if (alcance === null) {
    return (
      <section className="lb-section" aria-label="Perigo">
        <h2 className="lb-eyebrow">Perigo</h2>
        <p className="lb-field__hint">Nenhum perigo nesta sala. Ele passa às vizinhas pelas portas abertas a cada avanço.</p>
        <button type="button" className="lb-btn lb-btn--block" onClick={() => onPor('fogo')}>
          Pôr fogo
        </button>
        <button type="button" className="lb-btn lb-btn--block" onClick={() => onPor('agua')}>
          Pôr água
        </button>
      </section>
    )
  }

  const { perigo, estado } = alcance
  const atinge = salasQueOAvancoAtinge(map, perigo)
  const situacao = estado === 'cinza' ? 'Cinza: esta sala já queimou.' : `${NOME_DO_TIPO[perigo.tipo]} nesta sala.`
  // Nada a mudar no próximo passo: o botão fica desligado (o avanço devolveria o mesmo mapa).
  const parado = atinge.length === 0 && !(perigo.tipo === 'fogo' && perigo.salas.length > 0)
  let previsao: string
  if (atinge.length > 0) previsao = `Vai atingir: ${atinge.map((id) => nomeDaSala(map, id)).join(', ')}.`
  else if (perigo.tipo === 'fogo' && perigo.salas.length > 0) previsao = 'Nenhuma porta aberta leva o fogo adiante: ao avançar, ele se apaga e vira cinza.'
  else if (perigo.tipo === 'fogo') previsao = 'O fogo já se apagou: ficou só a cinza.'
  else previsao = 'Nenhuma porta aberta leva a água adiante.'

  return (
    <section className="lb-section" aria-label="Perigo">
      <h2 className="lb-eyebrow">Perigo</h2>
      <p className="lb-label">{situacao}</p>
      <p className="lb-field__hint" id={previsaoId}>
        {previsao}
      </p>
      <button type="button" className="lb-btn lb-btn--block" aria-describedby={previsaoId} disabled={parado} onClick={() => onAvancar(perigo.id)}>
        Avançar
      </button>
      <button type="button" className="lb-btn lb-btn--block lb-btn--danger" onClick={() => onApagar(perigo.id)}>
        Apagar perigo
      </button>
    </section>
  )
}
