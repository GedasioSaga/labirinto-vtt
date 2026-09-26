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
 *
 * Peça mapa-inteiro-enxuto (laudo do painel, rodada 2):
 * - o alerta é o segmentado do projeto, a mesma pastilha de "Precisão do
 *   contorno" e "Abre por", no lugar dos rádios nativos (13 px, azul do
 *   navegador, fora de `theme.ts`);
 * - "Nenhuma sala tem facção" diz por que o "Quem manda aqui" não pinta nada:
 *   é a explicação do interruptor (`aria-describedby`), então mora no "?" dele
 *   como dica sob demanda (`lib/dicaDoPainel.ts`), não em duas linhas da coluna.
 */
export function TerritorioControls({ filtroLigado, onFiltroChange, legenda, alerta, onAlertaChange }: TerritorioControlsProps) {
  const baseId = useId()
  const filtroHintId = `${baseId}-filtro-hint`
  const semFaccaoId = `${baseId}-sem-faccao`
  const alertaHintId = `${baseId}-alerta-hint`
  const semFaccao = legenda.length === 0
  return (
    <div className="lb-territorio">
      <Toggle
        label="Quem manda aqui"
        checked={filtroLigado}
        onChange={onFiltroChange}
        describedBy={semFaccao ? `${filtroHintId} ${semFaccaoId}` : filtroHintId}
      />
      <p className="lb-field__hint" id={filtroHintId}>
        Pinta cada sala e distrito com a cor da facção. Só no seu editor.
      </p>

      {semFaccao ? (
        <p className="lb-field__hint" id={semFaccaoId}>
          Nenhuma sala tem facção. Escolha uma no campo Facção do painel da Sala.
        </p>
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

      {/* Rótulo e segmentado no mesmo campo: é a "linha" que a dica paira, com o
          "?" logo depois do rótulo. O nome do grupo vem de `aria-label`, como
          nos outros segmentados do painel ("Abre por", "Abrir na parede"). */}
      <div className="lb-field">
        <span className="lb-label">Alerta da cena</span>
        <div className="lb-seg" role="radiogroup" aria-label="Alerta da cena" aria-describedby={alertaHintId}>
          {NIVEIS_ALERTA.map((nivel) => (
            <button
              key={nivel}
              type="button"
              role="radio"
              aria-checked={alerta === nivel}
              className="lb-seg__option"
              onClick={() => onAlertaChange(nivel)}
            >
              {ROTULO_ALERTA[nivel]}
            </button>
          ))}
        </div>
      </div>
      <p className="lb-field__hint" id={alertaHintId}>
        Suba conforme o grupo faz barulho. Os jogadores não recebem o nível.
      </p>
    </div>
  )
}
