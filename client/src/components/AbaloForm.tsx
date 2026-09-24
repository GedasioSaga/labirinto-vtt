import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { NOTE_MAX_LENGTH } from '../net/protocol'
import type { AbaloFaixa, AbaloOrigem, AbaloTextos, OrigemDoAbalo } from '../lib/abalo'

/** Valor do "De onde veio" que quer dizer "sem ponto": ninguém ganha seta. */
const SEM_PONTO = ''

/** As três faixas, na ordem do formulário, com o rótulo que o mestre lê. */
const FAIXAS: readonly { faixa: AbaloFaixa; rotulo: string; dica: string }[] = [
  { faixa: 'perto', rotulo: 'Nesta cena', dica: 'com seta e vibração' },
  { faixa: 'andar', rotulo: 'Nas cenas vizinhas', dica: 'a mesma pasta, a de fora e as de dentro' },
  { faixa: 'longe', rotulo: 'No resto da aventura', dica: 'vazio = não ouvem' },
]

const TEXTOS_VAZIOS: AbaloTextos = { perto: '', andar: '', longe: '' }

export interface AbaloFormProps {
  sceneId: string
  sceneName: string
  /** As Salas e os pinos da cena (`origensDaCena`). Vazio = só "sem ponto". */
  origens: readonly OrigemDoAbalo[]
  onSend(origem: AbaloOrigem, textos: AbaloTextos): void
  onCancel(): void
}

/**
 * ABALO a partir de uma cena, dentro da linha dela, no molde do Recado: de
 * onde veio (uma Sala ou um pino, ou sem ponto) e um texto por faixa. Enter
 * comum quebra linha; Ctrl+Enter envia; Esc cancela. Faixa vazia não recebe
 * nada; tudo vazio não envia.
 */
export function AbaloForm({ sceneId, sceneName, origens, onSend, onCancel }: AbaloFormProps) {
  const baseId = useId()
  const [origemChave, setOrigemChave] = useState(SEM_PONTO)
  const [textos, setTextos] = useState<AbaloTextos>(TEXTOS_VAZIOS)
  const firstRef = useRef<HTMLTextAreaElement | null>(null)
  const empty = FAIXAS.every(({ faixa }) => textos[faixa].trim().length === 0)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  const send = () => {
    if (empty) return
    const ponto = origens.find((origem) => origem.chave === origemChave)
    onSend(ponto === undefined ? { sceneId } : { sceneId, x: ponto.x, y: ponto.y }, textos)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    send()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      // Esc fecha sem enviar; não pode chegar ao canvas (Esc lá troca a ferramenta).
      event.preventDefault()
      event.stopPropagation()
      onCancel()
      return
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form className="lb-cenas__recado" onSubmit={submit} aria-label={`Abalo a partir de ${sceneName}`}>
      <label className="lb-label" htmlFor={`${baseId}-origem`}>
        De onde veio, em {sceneName}
      </label>
      <select id={`${baseId}-origem`} className="lb-input" value={origemChave} onChange={(event) => setOrigemChave(event.target.value)} onKeyDown={onKeyDown}>
        <option value={SEM_PONTO}>Sem ponto (sem seta)</option>
        {origens.map((origem) => (
          <option key={origem.chave} value={origem.chave}>
            {origem.rotulo}
          </option>
        ))}
      </select>
      {FAIXAS.map(({ faixa, rotulo, dica }, index) => (
        <div key={faixa} className="lb-field">
          <label className="lb-label" htmlFor={`${baseId}-${faixa}`}>
            {rotulo} ({dica})
          </label>
          <textarea
            id={`${baseId}-${faixa}`}
            ref={index === 0 ? firstRef : undefined}
            className="lb-input lb-cenas__recado-campo"
            rows={2}
            value={textos[faixa]}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(event) => {
              const value = event.target.value
              setTextos((atual) => ({ ...atual, [faixa]: value }))
            }}
            onKeyDown={onKeyDown}
          />
        </div>
      ))}
      <div className="lb-cenas__acoes">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--primary" disabled={empty}>
          Enviar abalo
        </button>
      </div>
    </form>
  )
}
