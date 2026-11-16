import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { fecharLerJunto, nomesDe, useMesaDoPino } from '../stores/mesaDoPino'
import './lerJuntoDoMestre.css'

/*
 * "LER JUNTO" (P4, protótipo de 15/11, fluxo 2): depois do "Ler agora", o
 * mestre vê o mesmo texto em letra grande, para ler em voz alta enquanto a
 * tela dos jogadores datilografa, e o estado de cada um (lendo, leu). Fechar
 * aqui não fecha o cartão dos jogadores. Esc fecha; o foco volta a quem abriu.
 */
export function LerJuntoDoMestre() {
  const lerJunto = useMesaDoPino((estado) => estado.lerJunto)
  if (lerJunto === null) return null
  return <PainelDoLerJunto key={`${lerJunto.pinId}:${lerJunto.para.join(',')}`} />
}

function PainelDoLerJunto() {
  const tituloId = useId()
  const fecharRef = useRef<HTMLButtonElement | null>(null)
  const lerJunto = useMesaDoPino((estado) => estado.lerJunto)
  const leituras = useMesaDoPino((estado) => (estado.lerJunto === null ? undefined : estado.leituras[estado.lerJunto.pinId]))
  const acoes = useMesaDoPino((estado) => estado.acoes)

  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    fecharRef.current?.focus({ preventScroll: true })
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      evento.preventDefault()
      evento.stopPropagation()
      fecharLerJunto()
    }
    // Captura: o Esc do mapa (desmarcar, trocar de ferramenta) não age por baixo do painel.
    window.addEventListener('keydown', aoTeclar, true)
    return () => {
      window.removeEventListener('keydown', aoTeclar, true)
      if (antes !== null && antes.isConnected) antes.focus({ preventScroll: true })
    }
  }, [])

  if (lerJunto === null) return null
  const jogadores = acoes?.jogadores() ?? []
  const titulo = lerJunto.nome === '' ? 'Cenário' : lerJunto.nome
  return createPortal(
    <div className="lb-ler-junto" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
      <div className="lb-ler-junto__folha">
        <div className="lb-ler-junto__topo">
          <div>
            <h2 id={tituloId} className="lb-ler-junto__titulo">
              {titulo}
            </h2>
            <small className="lb-ler-junto__sub">Na tela de {nomesDe(lerJunto.para, jogadores)} agora. Leia junto em voz alta, se quiser.</small>
          </div>
          <button ref={fecharRef} type="button" className="lb-ler-junto__fechar" onClick={fecharLerJunto}>
            Fechar <kbd>Esc</kbd>
          </button>
        </div>
        <ul className="lb-ler-junto__quem" aria-label="Quem está lendo">
          {lerJunto.para.map((playerId) => {
            const leitura = leituras?.[playerId]
            const estado = leitura === undefined ? 'nao' : leitura.estado
            return (
              <li key={playerId} data-estado={estado}>
                {nomesDe([playerId], jogadores)}: {estado === 'lendo' ? 'lendo' : estado === 'leu' ? 'leu' : 'ainda não'}
              </li>
            )
          })}
        </ul>
        <p className="lb-ler-junto__texto">{lerJunto.texto}</p>
        <p className="lb-ler-junto__pe">Fechar aqui não fecha o cartão dos jogadores: cada um fecha o seu.</p>
      </div>
    </div>,
    document.body,
  )
}
