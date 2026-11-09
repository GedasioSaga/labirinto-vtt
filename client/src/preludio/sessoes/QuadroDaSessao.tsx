import { useState, type ReactNode } from 'react'
import type { Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { QuadroEsperando } from '../quadro/esperando'
import { quadroDaSessao, quadroDaSessaoNaLixeira, useQuadros } from '../quadro/estadoDosQuadros'
import { QuadroSobDemanda } from '../quadro/sobDemanda'
import { AbasDaSessao, ID_DO_PAINEL_DA_SESSAO, idDaAba } from './AbasDaSessao'

/**
 * O QUADRO DA SESSÃO (fatia F3b): o quadro cujo `sessaoId` é esta sessão (os
 * do Grimório vieram ligados na importação). Na aba Quadro, ocupa o palco
 * inteiro com as abas no começo da barra; lado a lado com o roteiro (F3c), a
 * barra começa pelo título e pelo recolher. Sem quadro, explica e cria um, já
 * ligado; com o quadro na lixeira, oferece restaurar.
 */
export function QuadroDaSessao({ sessao, alvo, cabeca }: { sessao: Verbete; alvo?: string; cabeca?: ReactNode }) {
  const lista = useQuadros((estado) => estado.lista)
  const falha = useQuadros((estado) => estado.avisoDaCriacao)
  const campanhaDoFiltro = usePreludio((estado) => estado.campanhaId)
  const travado = usePreludio((estado) => estado.travado)
  const [criando, setCriando] = useState(false)
  const [falhaDaVolta, setFalhaDaVolta] = useState<string | null>(null)
  // Lado a lado não há abas: o painel não é de aba.
  const comAbas = cabeca === undefined
  const comeco = cabeca ?? <AbasDaSessao sessaoId={sessao.id} aba="quadro" />
  const painel = comAbas ? { id: ID_DO_PAINEL_DA_SESSAO, role: 'tabpanel', 'aria-labelledby': idDaAba('quadro') } : {}
  // Pelo id, não pelo nome: renomear o quadro aberto não troca o que a aba mostra.
  const quadro = quadroDaSessao(lista, sessao.id)
  const naLixeira = quadro === undefined ? quadroDaSessaoNaLixeira(lista, sessao.id) : undefined

  if (lista.t === 'falhou') {
    return (
      <div className="pr-quadro">
        <div className="pr-quadro__barra">{comeco}</div>
        <section className="pr-lista" {...painel}>
          <p className="pr-aviso" role="alert">
            {lista.aviso}
          </p>
        </section>
      </div>
    )
  }
  if (lista.t !== 'pronta') return <QuadroEsperando cabeca={comeco} />

  if (quadro !== undefined) {
    return (
      <div className="pr-sessao__quadro" {...painel}>
        <QuadroSobDemanda key={quadro.id} id={quadro.id} alvo={alvo} cabeca={comeco} />
      </div>
    )
  }

  const criar = async () => {
    if (criando || usePreludio.getState().travado) return
    setCriando(true)
    await useQuadros.getState().criar(sessao.campanhas[0] ?? campanhaDoFiltro, { sessaoId: sessao.id, nome: sessao.titulo.trim() || 'Quadro da sessão' })
    setCriando(false)
  }

  const restaurar = async () => {
    if (naLixeira === undefined || criando) return
    setCriando(true)
    setFalhaDaVolta(await useQuadros.getState().porNaLixeira(naLixeira.id, false))
    setCriando(false)
  }

  return (
    <div className="pr-quadro">
      <div className="pr-quadro__barra">{comeco}</div>
      <section className="pr-vazio pr-sessao__sem-quadro" {...painel}>
        {naLixeira !== undefined ? (
          <>
            <p className="pr-vazio__texto">O quadro desta sessão ({naLixeira.nome || 'Quadro sem nome'}) está na lixeira. Ele volta inteiro, como estava.</p>
            <div className="pr-sessao__sem-quadro-acoes">
              <button type="button" className="gr-bt gr-bt--latao" disabled={travado || criando} aria-busy={criando} onClick={() => void restaurar()}>
                {criando ? 'Restaurando…' : 'Restaurar o quadro'}
              </button>
              <button type="button" className="gr-bt gr-bt--fantasma" disabled={travado || criando} onClick={() => void criar()}>
                Começar outro quadro
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="pr-vazio__texto">
              Esta sessão ainda não tem quadro. É o mapa mental dela: os cartões dos verbetes, as setas das ligações, imagens e notas soltas. O roteiro pode citar o quadro.
            </p>
            <button type="button" className="gr-bt gr-bt--latao" disabled={travado || criando} aria-busy={criando} onClick={() => void criar()}>
              {criando ? 'Criando…' : 'Criar o quadro da sessão'}
            </button>
          </>
        )}
        {travado && <p className="pr-quieto">O Prelúdio está gravando uma importação ou uma cópia restaurada. Dá para mexer quando terminar.</p>}
        {(falhaDaVolta ?? falha) !== null && (
          <p className="pr-aviso" role="alert">
            {falhaDaVolta ?? falha}
          </p>
        )}
      </section>
    </div>
  )
}
