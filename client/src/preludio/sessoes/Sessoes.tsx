import { useCallback, useMemo } from 'react'
import { verbeteNovo } from '../../lib/preparo/enciclopedia'
import { dadosDaSessao, nomeDaProximaSessao, sessoesEmOrdem } from '../../lib/preparo/sessoes'
import type { Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { abrirComONomeSelecionado, PaginaDaSessao } from './PaginaDaSessao'
import './sessoes.css'

/**
 * AS SESSÕES (plano §1, F4): a lista, da primeira à última, e a sessão aberta.
 * A mais recente é a que o marcador Roteiro do Livro do mestre abre no mapa.
 */

/** As sessões da campanha do filtro (todas, sem filtro), na ordem. */
export function useSessoes(): Verbete[] {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  return useMemo(() => sessoesEmOrdem(verbetes.values(), campanhaId), [verbetes, campanhaId])
}

/** Cria a próxima sessão ("Sessão 4") na campanha do filtro (ou na única que houver) e abre com o nome selecionado. */
export function useNovaSessao(): () => Promise<void> {
  const sessoes = useSessoes()
  return useCallback(async () => {
    const { campanhaId, campanhas, criarVerbete, ir, travado } = usePreludio.getState()
    if (travado) return
    const etiquetas = campanhaId !== null ? [campanhaId] : campanhas.length === 1 && campanhas[0] !== undefined ? [campanhas[0].id] : []
    const nova = verbeteNovo('sessao', nomeDaProximaSessao(sessoes), { campanhas: etiquetas })
    await criarVerbete(nova)
    abrirComONomeSelecionado(nova.id)
    ir({ secao: 'sessoes', sessaoId: nova.id })
  }, [sessoes])
}

function resumoDa(sessao: Verbete, eventos: ReadonlySet<string>): string {
  const { revelarHoje, aconteceu } = dadosDaSessao(sessao)
  const partes: string[] = []
  if (revelarHoje.length > 0) partes.push(revelarHoje.length === 1 ? '1 para revelar' : `${revelarHoje.length} para revelar`)
  if (aconteceu.length > 0) {
    const levados = aconteceu.filter((linha) => eventos.has(linha.id)).length
    partes.push(`${aconteceu.length === 1 ? '1 acontecimento' : `${aconteceu.length} acontecimentos`}${levados > 0 ? ` (${levados} na linha do tempo)` : ''}`)
  }
  return partes.length === 0 ? 'Só o roteiro, por enquanto' : partes.join(', ')
}

function ListaDeSessoes() {
  const sessoes = useSessoes()
  const novaSessao = useNovaSessao()
  const campanhas = usePreludio((estado) => estado.campanhas)
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const travado = usePreludio((estado) => estado.travado)
  const tempo = usePreludio((estado) => estado.tempo)
  const ir = usePreludio((estado) => estado.ir)
  const eventos = useMemo(() => new Set((tempo.tempo?.eventos ?? []).map((evento) => evento.id)), [tempo])
  const nomeDa = (sessao: Verbete) => campanhas.filter((campanha) => sessao.campanhas.includes(campanha.id)).map((campanha) => campanha.nome)
  const ultima = sessoes[sessoes.length - 1]

  return (
    <div className="pr-sessoes">
      <header className="pr-sessoes__cabeca">
        <div>
          <h2 className="pr-sessoes__titulo">Sessões</h2>
          <p className="pr-sessoes__explica">Roteiro, o que revelar hoje e o que aconteceu. No mapa, o marcador Roteiro do Livro do mestre mostra a sessão mais recente da campanha.</p>
        </div>
        <button type="button" className="gr-bt gr-bt--latao" disabled={travado} onClick={() => void novaSessao()}>
          Nova sessão
        </button>
      </header>
      {sessoes.length === 0 ? (
        <section className="pr-vazio">
          <p className="pr-vazio__texto">
            {campanhaId === null ? 'Nenhuma sessão ainda.' : `Nenhuma sessão em ${campanhas.find((campanha) => campanha.id === campanhaId)?.nome ?? 'esta campanha'} ainda.`} A próxima começa com o roteiro e a lista do que revelar.
          </p>
        </section>
      ) : (
        <ol className="pr-sessoes__lista">
          {sessoes.map((sessao) => {
            const deQuais = nomeDa(sessao)
            return (
              <li key={sessao.id}>
                <button type="button" className="pr-sessoes__item" onClick={() => ir({ secao: 'sessoes', sessaoId: sessao.id })}>
                  <span className="pr-sessoes__nome">{sessao.titulo || 'Sessão sem nome'}</span>
                  {sessao === ultima && <span className="pr-sessoes__selo">Mais recente</span>}
                  <span className="pr-sessoes__resumo">
                    {resumoDa(sessao, eventos)}
                    {campanhaId === null && deQuais.length > 0 && <span className="pr-sessoes__campanha">{deQuais.join(', ')}</span>}
                    {deQuais.length === 0 && <span className="pr-sessoes__campanha">Sem campanha: marque uma para poder revelar</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export function Sessoes({ sessaoId }: { sessaoId: string | null }) {
  return sessaoId === null ? <ListaDeSessoes /> : <PaginaDaSessao key={sessaoId} id={sessaoId} />
}
