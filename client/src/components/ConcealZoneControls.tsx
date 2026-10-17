import type { ReactNode } from 'react'
import { useLivroDoMestreStore } from '../stores/livroDoMestreStore'
import type { ConcealZone } from '../types/map'
import { Essencial } from './grimorio/Cartoes'
import { Fichas } from './grimorio/Ficha'
import { Nota } from './grimorio/Nota'
import { FichaLembrada } from './livro/FichaLembrada'
import { RevealToControls, type RevealToControlsProps } from './PlayerSecretControls'
import { Toggle } from './Toggle'
import './livro/fichaDoItem.css'

export interface ConcealZoneControlsProps {
  /** Id da zona: a cabeça da ficha remonta quando outra zona abre. */
  id: string
  name: string
  onNameChange: (name: string) => void
  revealed: boolean
  onRevealedChange: (revealed: boolean) => void
  /** O "Excluir zona" da cabeça da ficha (fatia 16a: saiu do corpo, como o Excluir do pino). */
  onDelete: () => void
  /**
   * Só com a sala aberta: "Revelar para…" quem descobriu o que a zona esconde.
   * Aparece com a zona ativa — revelada para todos, a lista não diria nada.
   */
  reveal?: RevealToControlsProps | null
  /** "Depende do estado" (`EstadoDaZona`): só com uma aventura aberta. */
  estado?: ReactNode
  /** `ConcealZone.porEstado`, a regra que o `EstadoDaZona` edita: dá o resumo da ficha, como na porta. */
  porEstado?: ConcealZone['porEstado']
}

/** Chave da escolha lembrada da ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-zona-'

/**
 * FICHA DA ZONA OCULTA (A5; fatia 16a do design consolidado, decisão 4.1: a
 * gramática da porta, sem perder controle). A cabeça — medalha da zona, nome e
 * "Excluir zona" — sai do painel, como a do pino; aqui ficam o essencial (Nome,
 * "Revelar para jogadores" e o "Revelar para…") e a ficha "Depende do estado".
 * "Revelar para jogadores" não apaga a zona: o mestre pode esconder de novo
 * sem redesenhar.
 */
export function ConcealZoneControls({ name, onNameChange, revealed, onRevealedChange, reveal = null, estado, porEstado }: ConcealZoneControlsProps) {
  return (
    <section className="lb-ficha-da-zona">
      {/* O título que as jornadas procuram ("Zona oculta"), só para o leitor de tela: a cabeça já diz o tipo. */}
      <h2 className="gr-sr">Zona oculta</h2>
      <Essencial>
        <section className="lb-section">
          <div className="lb-field">
            <label className="lb-label" htmlFor="lb-conceal-zone-name">
              Nome
            </label>
            <input id="lb-conceal-zone-name" className="lb-input" value={name} onChange={(event) => onNameChange(event.target.value)} />
          </div>
          <Toggle label="Revelar para jogadores" checked={revealed} onChange={onRevealedChange} />
          {reveal !== null && !revealed && <RevealToControls {...reveal} />}
        </section>
      </Essencial>
      {estado !== undefined && (
        <Fichas>
          <FichaLembrada prefixo={PREFIXO_LEMBRADO} id="estado" titulo="Depende do estado" icone="pulso" padrao={false} resumo={porEstado === undefined ? 'Sempre' : 'Muda com o estado'}>
            {estado}
            <Nota ir={{ rotulo: 'Ir para Aventura', onClick: (evento) => useLivroDoMestreStore.getState().abrirPagina('aventura', evento.detail > 0) }}>
              Os valores vêm do Estado do mundo, no marcador Aventura.
            </Nota>
          </FichaLembrada>
        </Fichas>
      )}
    </section>
  )
}
