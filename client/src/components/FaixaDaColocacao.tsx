import { useEffect } from 'react'
import { caminhoDaFonte } from '../lib/fonteNoPreludio'
import { terminarColocacao, useColocacaoDoPreludio } from '../stores/colocacaoDoPreludio'
import './faixaDaColocacao.css'

/**
 * A FAIXA DO "PÔR NO MAPA" (P3 do estudo de 15/11), na janela do mapa: diz ao
 * mestre que a seção do Prelúdio espera o clique dele, e onde ela vai. Esc ou
 * "Cancelar" desistem (a janela do Prelúdio fica sabendo pelo fio).
 */
export function FaixaDaColocacao() {
  const pendente = useColocacaoDoPreludio((estado) => estado.pendente)
  useEffect(() => {
    if (pendente === null) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') terminarColocacao('cancelado')
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [pendente])
  if (pendente === null) return null
  const tipo = pendente.kind === 'exclamacao' ? 'o cenário !' : 'a fala ou pista ?'
  return (
    <div className="lb-faixa-colocacao" role="status" aria-live="polite">
      <span>
        <b>Pôr no mapa:</b> clique onde fica {tipo} de {caminhoDaFonte(pendente.fonte)}. Esc cancela.
      </span>
      <button type="button" className="gr-bt gr-bt--fantasma gr-bt--p" onClick={() => terminarColocacao('cancelado')}>
        Cancelar
      </button>
    </div>
  )
}
