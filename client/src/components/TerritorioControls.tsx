import { useId } from 'react'
import type { NivelAlerta } from '../types/map'
import { NIVEIS_ALERTA, ROTULO_ALERTA } from '../lib/faccoes'
import { Toggle } from './Toggle'

/** Uma linha da legenda: a facção, a cor CSS da amostra e quantas salas ela manda. */
export interface TerritorioLegenda {
  faccao: string
  cor: string
  salas: number
}

export interface TerritorioControlsProps {
  /** Filtro "Quem manda aqui" ligado (`stores/territorioStore.ts`). */
  filtroLigado: boolean
  onFiltroChange: (ligado: boolean) => void
  /** Facções do mapa, na ordem e com a cor que o filtro pinta (`lib/faccoes.ts` → `coresDasFaccoes`). */
  legenda: readonly TerritorioLegenda[]
  /** Alerta da cena aberta (`MapData.alerta`, calmo se ausente). */
  alerta: NivelAlerta
  onAlertaChange: (nivel: NivelAlerta) => void
}

function contarSalas(salas: number): string {
  return salas === 1 ? '1 sala' : `${salas} salas`
}

/**
 * TERRITÓRIO — o bloco do mapa inteiro para FACÇÃO E ALERTA: o filtro "Quem
 * manda aqui" (pinta cada distrito com a cor da facção), a legenda das
 * facções e o alerta da cena, que o mestre sobe conforme o grupo faz barulho.
 * Tudo aqui é só do mestre: `lib/fogFilter.ts` tira facção e alerta do
 * pacote de todo jogador.
 */
export function TerritorioControls({ filtroLigado, onFiltroChange, legenda, alerta, onAlertaChange }: TerritorioControlsProps) {
  const baseId = useId()
  const filtroHintId = `${baseId}-filtro-hint`
  const alertaHintId = `${baseId}-alerta-hint`
  return (
    <div className="lb-territorio">
      <Toggle label="Quem manda aqui" checked={filtroLigado} onChange={onFiltroChange} describedBy={filtroHintId} />
      <p className="lb-field__hint" id={filtroHintId}>
        Pinta cada sala e distrito com a cor da facção. Só no seu editor.
      </p>

      {legenda.length === 0 ? (
        <p className="lb-field__hint">Nenhuma sala tem facção. Escolha uma no campo Facção do painel da Sala.</p>
      ) : (
        <ul className="lb-territorio__legenda" aria-label="Facções do mapa">
          {legenda.map((item) => (
            <li key={item.faccao} className="lb-territorio__item" data-testid="legenda-faccao">
              <span className="lb-territorio__cor" data-testid="cor-faccao" aria-hidden="true" style={{ backgroundColor: item.cor }} />
              {item.faccao} · {contarSalas(item.salas)}
            </li>
          ))}
        </ul>
      )}

      <fieldset className="lb-territorio__alerta" aria-describedby={alertaHintId}>
        <legend className="lb-label">Alerta da cena</legend>
        <div className="lb-territorio__niveis">
          {NIVEIS_ALERTA.map((nivel) => (
            <label key={nivel} className="lb-territorio__nivel">
              <input
                type="radio"
                name={`${baseId}-alerta`}
                value={nivel}
                checked={alerta === nivel}
                onChange={() => onAlertaChange(nivel)}
              />
              {ROTULO_ALERTA[nivel]}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="lb-field__hint" id={alertaHintId}>
        Suba conforme o grupo faz barulho. Os jogadores não recebem o nível.
      </p>
    </div>
  )
}
