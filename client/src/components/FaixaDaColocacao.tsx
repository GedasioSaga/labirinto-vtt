import { useEffect } from 'react'
import { caminhoDaFonte } from '../lib/fonteNoPreludio'
import { ehDoVerbete, terminarColocacao, useColocacaoDoPreludio, type ColocacaoDoVerbete } from '../stores/colocacaoDoPreludio'
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
  if (ehDoVerbete(pendente)) {
    return (
      <div className="lb-faixa-colocacao" role="status" aria-live="polite">
        <span>
          <b>Pôr no mapa:</b> clique onde fica {oQueVai(pendente)}. Esc cancela.
        </span>
        <button type="button" className="gr-bt gr-bt--fantasma gr-bt--p" onClick={() => terminarColocacao('cancelado')}>
          Cancelar
        </button>
      </div>
    )
  }
  const caminho = caminhoDaFonte(pendente.fonte)
  return (
    <div className="lb-faixa-colocacao" role="status" aria-live="polite">
      {pendente.kind === 'exclamacao' ? (
        <span>
          <b>Pôr no mapa:</b> clique onde fica o cenário ! de {caminho}. Esc cancela.
        </span>
      ) : (
        <span>
          <b>Pôr no mapa:</b> clique num ? para juntar a fala de {caminho}, ou noutro lugar para um ? novo. Esc cancela.
        </span>
      )}
      <button type="button" className="gr-bt gr-bt--fantasma gr-bt--p" onClick={() => terminarColocacao('cancelado')}>
        Cancelar
      </button>
    </div>
  )
}

/** O que o clique põe, dito como o protótipo do E3: o token, o pino de item ou o "!" do lugar. */
function oQueVai(pendente: ColocacaoDoVerbete) {
  const nome = <b>{pendente.nome || 'sem nome'}</b>
  if (pendente.coisa.o === 'token') return <>o token de {nome}</>
  if (pendente.coisa.o === 'item') return <>o pino de item de {nome}</>
  return <>o ! de {nome}{pendente.coisa.imagem === null ? '' : ', com a imagem'}</>
}
