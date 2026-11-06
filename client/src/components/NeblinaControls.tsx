import { useId } from 'react'
import {
  FORCA_DA_NEBLINA_MAX,
  FORCA_DA_NEBLINA_MIN,
  INTENSIDADE_MAX,
  INTENSIDADE_MIN,
  neblinaDoMapa,
  type ModoDaNeblina,
} from '../lib/neblina'
import { mapaDoPiso } from '../lib/pisos'
import { TAMANHO_DO_PINCEL_MAX, TAMANHO_DO_PINCEL_MIN } from '../lib/texturas'
import { useMapStore } from '../stores/mapStore'
import { usePincelDaNeblina } from '../stores/pincelDaNeblina'
import { Toggle } from './Toggle'

const MODOS: Array<{ modo: ModoDaNeblina; rotulo: string; dica: string }> = [
  { modo: 'pincel', rotulo: 'Pincel', dica: 'Arraste por cima do mapa para pôr neblina. Segure Alt para apagar.' },
  { modo: 'borracha', rotulo: 'Borracha', dica: 'Arraste por cima da neblina pintada para tirá-la.' },
]

/**
 * O painel da ferramenta NEBLINA (`lib/neblina.ts`): primeiro a chave do mapa
 * inteiro com a intensidade dela (é o que vale para a cena toda), depois o
 * pincel por área. A intensidade da chave arrastada vira um passo só no
 * desfazer.
 */
export function NeblinaControls() {
  // A chave crua do mapa (referência estável); o padrão é calculado fora do seletor.
  const neblina = neblinaDoMapa({ neblina: useMapStore((s) => s.map.neblina) })
  const setNeblinaDoMapa = useMapStore((s) => s.setNeblinaDoMapa)
  const temPintada = useMapStore((s) => (mapaDoPiso(s.map, s.pisoAtivo).neblinaPintada ?? []).some((p) => p.tipo === 'pincel'))
  const apagarPintada = useMapStore((s) => s.apagarTodaANeblinaPintada)
  const { modo, tamanho, forca, setModo, setTamanho, setForca } = usePincelDaNeblina()
  const chaveId = useId()
  const intensidadeId = useId()
  const intensidadeDicaId = useId()
  const tamanhoId = useId()
  const forcaId = useId()
  const dicaDoModo = MODOS.find((m) => m.modo === modo)?.dica ?? ''

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Mapa inteiro</h2>
      <div className="lb-field">
        <Toggle
          label="Neblina no mapa inteiro"
          checked={neblina.ligada}
          describedBy={chaveId}
          onChange={(ligada) => setNeblinaDoMapa({ ligada, intensidade: neblina.intensidade })}
        />
        <p id={chaveId} className="lb-field__hint">
          Uma bruma lenta por cima da cena toda, à vista também de noite e no escuro. Não é a névoa dos jogadores: ela só cobre, nunca
          mostra o que eles não exploraram.
        </p>
      </div>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={intensidadeId}>
            Intensidade
          </label>
          <span className="lb-num">{neblina.intensidade}%</span>
        </div>
        <input
          id={intensidadeId}
          className="lb-range"
          type="range"
          min={INTENSIDADE_MIN}
          max={INTENSIDADE_MAX}
          step={5}
          value={neblina.intensidade}
          disabled={!neblina.ligada}
          aria-describedby={neblina.ligada ? undefined : intensidadeDicaId}
          onChange={(event) => setNeblinaDoMapa({ ligada: true, intensidade: Number(event.target.value) }, true)}
        />
        {!neblina.ligada && (
          <p id={intensidadeDicaId} className="lb-field__hint">
            Ligue a chave acima para ajustar.
          </p>
        )}
      </div>

      <h2 className="lb-eyebrow">Pincel</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Pincel de neblina">
        {MODOS.map((opcao) => (
          <button key={opcao.modo} type="button" role="radio" aria-checked={modo === opcao.modo} className="lb-seg__option" onClick={() => setModo(opcao.modo)}>
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <p className="lb-field__hint">{dicaDoModo}</p>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={tamanhoId}>
            Tamanho do pincel
          </label>
          <span className="lb-num">{tamanho}</span>
        </div>
        <input
          id={tamanhoId}
          className="lb-range"
          type="range"
          min={TAMANHO_DO_PINCEL_MIN}
          max={TAMANHO_DO_PINCEL_MAX}
          step={2}
          value={tamanho}
          onChange={(event) => setTamanho(Number(event.target.value))}
        />
      </div>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={forcaId}>
            {modo === 'borracha' ? 'Quanto tira' : 'Intensidade'}
          </label>
          <span className="lb-num">{Math.round(forca * 100)}%</span>
        </div>
        <input
          id={forcaId}
          className="lb-range"
          type="range"
          min={FORCA_DA_NEBLINA_MIN}
          max={FORCA_DA_NEBLINA_MAX}
          step={0.05}
          value={forca}
          onChange={(event) => setForca(Number(event.target.value))}
        />
      </div>
      {temPintada && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={apagarPintada}>
          Apagar toda a neblina pintada
        </button>
      )}
    </section>
  )
}
