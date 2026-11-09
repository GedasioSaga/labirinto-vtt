import { useState } from 'react'
import type { Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { QuadroEsperando } from '../quadro/esperando'
import { quadroDaSessao, useQuadros } from '../quadro/estadoDosQuadros'
import { QuadroSobDemanda } from '../quadro/sobDemanda'
import { AbasDaSessao, ID_DO_PAINEL_DA_SESSAO, idDaAba } from './AbasDaSessao'

/**
 * A ABA QUADRO DA SESSÃO (fatia F3b): o quadro cujo `sessaoId` é esta sessão
 * (os do Grimório vieram ligados na importação), aberto no palco inteiro com as
 * abas no começo da barra. Sem quadro, a aba explica e cria um, já ligado.
 */
export function QuadroDaSessao({ sessao, alvo }: { sessao: Verbete; alvo?: string }) {
  const lista = useQuadros((estado) => estado.lista)
  const falha = useQuadros((estado) => estado.avisoDaCriacao)
  const campanhaDoFiltro = usePreludio((estado) => estado.campanhaId)
  const travado = usePreludio((estado) => estado.travado)
  const [criando, setCriando] = useState(false)
  const abas = <AbasDaSessao sessaoId={sessao.id} aba="quadro" />
  // Pelo id, não pelo nome: renomear o quadro aberto não troca o que a aba mostra.
  const quadro = quadroDaSessao(lista, sessao.id)

  if (lista.t === 'falhou') {
    return (
      <div className="pr-quadro">
        <div className="pr-quadro__barra">{abas}</div>
        <section className="pr-lista" id={ID_DO_PAINEL_DA_SESSAO} role="tabpanel" aria-labelledby={idDaAba('quadro')}>
          <p className="pr-aviso" role="alert">
            {lista.aviso}
          </p>
        </section>
      </div>
    )
  }
  if (lista.t !== 'pronta') return <QuadroEsperando cabeca={abas} />

  if (quadro !== undefined) {
    return (
      <div className="pr-sessao__quadro" id={ID_DO_PAINEL_DA_SESSAO} role="tabpanel" aria-labelledby={idDaAba('quadro')}>
        <QuadroSobDemanda key={quadro.id} id={quadro.id} alvo={alvo} cabeca={abas} />
      </div>
    )
  }

  const criar = async () => {
    if (criando || usePreludio.getState().travado) return
    setCriando(true)
    await useQuadros.getState().criar(sessao.campanhas[0] ?? campanhaDoFiltro, { sessaoId: sessao.id, nome: sessao.titulo.trim() || 'Quadro da sessão' })
    setCriando(false)
  }

  return (
    <div className="pr-quadro">
      <div className="pr-quadro__barra">{abas}</div>
      <section className="pr-vazio pr-sessao__sem-quadro" id={ID_DO_PAINEL_DA_SESSAO} role="tabpanel" aria-labelledby={idDaAba('quadro')}>
        <p className="pr-vazio__texto">
          Esta sessão ainda não tem quadro. É o mapa mental dela: os cartões dos verbetes, as setas das ligações, imagens e notas soltas. O roteiro pode citar o quadro.
        </p>
        <button type="button" className="gr-bt gr-bt--latao" disabled={travado || criando} aria-busy={criando} onClick={() => void criar()}>
          {criando ? 'Criando…' : 'Criar o quadro da sessão'}
        </button>
        {travado && <p className="pr-quieto">O Prelúdio está gravando uma importação ou uma cópia restaurada. Dá para criar quando terminar.</p>}
        {falha !== null && (
          <p className="pr-aviso" role="alert">
            {falha}
          </p>
        )}
      </section>
    </div>
  )
}
