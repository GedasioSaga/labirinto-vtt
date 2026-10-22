import { useId } from 'react'
import type { TipoDeMapa } from '../lib/mapFactory'
import { nomesDosLugaresLigados } from '../lib/nomesDosLugares'
import { nuvensLigadas } from '../lib/nuvens'
import { relevoLigado } from '../lib/relevo'
import type { MapData } from '../types/map'
import { Toggle } from './Toggle'

export interface SceneMapTypeControlsProps {
  /** "Tipo de mapa" da cena (`MapData.continente`). */
  tipo: TipoDeMapa
  onTipoChange: (tipo: TipoDeMapa) => void
  /** "Grupo anda junto (caravana)" (`MapData.worldMap`, `lib/caravan.ts`). Só aparece no Continente. */
  caravana: boolean
  onCaravanaChange: (caravana: boolean) => void
  /**
   * Chave "Relevo" da cena (`MapData.relevo`, `lib/relevo.ts`): luz, sombra no
   * mar e nas fronteiras. Já vem resolvida com o padrão do tipo. Sem
   * `onRelevoChange` (tela antiga, teste), a chave não aparece.
   */
  relevo?: boolean
  onRelevoChange?: (ligado: boolean) => void
  /**
   * Chave "Nomes dos lugares" (`MapData.nomesDosLugares`,
   * `lib/nomesDosLugares.ts`): o nome de cada região numa pílula com haste.
   * Já vem resolvida com o padrão do tipo. Sem `onNomesDosLugaresChange`, a
   * chave não aparece.
   */
  nomesDosLugares?: boolean
  onNomesDosLugaresChange?: (ligado: boolean) => void
  /**
   * Chave "Nuvens" (`MapData.nuvens`, `lib/nuvens.ts`): nuvens finas passando
   * devagar, com a sombra no chão. Já vem resolvida com o padrão do tipo. Sem
   * `onNuvensChange`, a chave não aparece.
   */
  nuvens?: boolean
  onNuvensChange?: (ligado: boolean) => void
}

const OPCOES: readonly { tipo: TipoDeMapa; rotulo: string }[] = [
  { tipo: 'normal', rotulo: 'Normal' },
  { tipo: 'continente', rotulo: 'Continente' },
]

/**
 * "Tipo de mapa" do "Configurar cena" (pedido de 09/10/2026). Continente
 * desenha a ficha de cada jogador como o pino do mapa (`lib/marcadorDeContinente.ts`),
 * no mestre e no jogador; NPC continua ficha. A caravana, que antes era a chave
 * "Mapa-mundi" das Configurações do mapa, mora aqui, dentro do Continente.
 * Escolha única no padrão `lb-seg` de `DoorKindControls`.
 */
export function SceneMapTypeControls({ tipo, onTipoChange, caravana, onCaravanaChange }: SceneMapTypeControlsProps) {
  const tipoHintId = useId()
  const caravanaHintId = useId()
  return (
    <section className="lb-section lb-cena-config__tipo">
      <h2 className="lb-eyebrow">Tipo de mapa</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Tipo de mapa" aria-describedby={tipoHintId}>
        {OPCOES.map((opcao) => (
          <button
            key={opcao.tipo}
            type="button"
            role="radio"
            aria-checked={tipo === opcao.tipo}
            className="lb-seg__option"
            onClick={() => onTipoChange(opcao.tipo)}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <p id={tipoHintId} className="lb-field__hint">
        {tipo === 'continente'
          ? 'A ficha de cada jogador vira um pino na cor dele, do mesmo tamanho em qualquer zoom. NPC continua ficha.'
          : 'Fichas como sempre.'}
      </p>
      {tipo === 'continente' && (
        <div className="lb-field">
          <Toggle label="Grupo anda junto (caravana)" checked={caravana} describedBy={caravanaHintId} onChange={onCaravanaChange} />
          <p id={caravanaHintId} className="lb-field__hint">
            O grupo vira um pino só, que você arrasta. Parado sobre um pino de viagem, a caravana pode desembarcar na cena dele.
          </p>
        </div>
      )}
    </section>
  )
}

/** O "Mapa vivo" tem o que mostrar: pelo menos uma das chaves veio com quem a muda. */
export function temMapaVivo(props: SceneMapTypeControlsProps): boolean {
  return props.onRelevoChange !== undefined || props.onNomesDosLugaresChange !== undefined || props.onNuvensChange !== undefined
}

/**
 * "Mapa vivo: ligado" (a nota da página Cena) quando alguma chave da seção vale
 * neste mapa, com o padrão do tipo. Mora junto da seção: a chave nova que entrar
 * nela entra aqui também.
 */
export function mapaVivoLigado(map: Pick<MapData, 'relevo' | 'nomesDosLugares' | 'nuvens' | 'continente' | 'worldMap'>): boolean {
  return relevoLigado(map) || nomesDosLugaresLigados(map) || nuvensLigadas(map)
}

/**
 * Seção "Mapa vivo" do "Configurar cena" (fatia 20): as chaves do que se mexe
 * sozinho no mapa (Relevo, Nomes dos lugares, Nuvens), que antes ficavam
 * embaixo do Tipo de mapa. Mesmas props do Tipo de mapa: cada chave só aparece
 * com quem a muda, e a chave que a fatia do relevo trouxer entra aqui.
 */
export function SceneMapaVivoControls({
  relevo = false,
  onRelevoChange,
  nomesDosLugares = false,
  onNomesDosLugaresChange,
  nuvens = false,
  onNuvensChange,
}: SceneMapTypeControlsProps) {
  const relevoHintId = useId()
  const nomesHintId = useId()
  const nuvensHintId = useId()
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Mapa vivo</h2>
      {onRelevoChange !== undefined && (
        <div className="lb-field">
          <Toggle label="Relevo" checked={relevo} describedBy={relevoHintId} onChange={onRelevoChange} />
          <p id={relevoHintId} className="lb-field__hint">
            Luz de cima à esquerda sobre a terra, sombra da terra no mar e nas fronteiras entre regiões. Sai das regiões, sem nada a
            desenhar. Ligado por padrão no Continente.
          </p>
        </div>
      )}
      {onNomesDosLugaresChange !== undefined && (
        <div className="lb-field">
          <Toggle label="Nomes dos lugares" checked={nomesDosLugares} describedBy={nomesHintId} onChange={onNomesDosLugaresChange} />
          <p id={nomesHintId} className="lb-field__hint">
            O nome de cada região numa pílula da cor do lugar, com uma haste até ele, do mesmo tamanho em qualquer zoom. Os nomes
            aparecem em cascata quando o mapa abre, e o jogador só vê o de lugar que já descobriu. Ligado por padrão no Continente.
          </p>
        </div>
      )}
      {onNuvensChange !== undefined && (
        <div className="lb-field">
          <Toggle label="Nuvens" checked={nuvens} describedBy={nuvensHintId} onChange={onNuvensChange} />
          <p id={nuvensHintId} className="lb-field__hint">
            Nuvens finas passando devagar sobre o mapa, com a sombra no chão, por baixo dos nomes, pinos e fichas. O jogador só as
            vê sobre o que já descobriu, e quem desliga “Efeitos do mapa” não as vê. Ligado por padrão no Continente.
          </p>
        </div>
      )}
    </section>
  )
}
