import { useCallback, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from 'react'
import { verbeteNovo } from '../../lib/preparo/enciclopedia'
import { comOrdem, dadosDaSessao, nomeDaProximaSessao, ordemDaProximaSessao, ordensAoMover, sessoesEmOrdem } from '../../lib/preparo/sessoes'
import type { Verbete } from '../../lib/preparo/tipos'
import { usePreludio, type AbaDaSessao } from '../estado/preludio'
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

/**
 * Cria a próxima sessão ("Sessão 4") na campanha do filtro (ou na única que
 * houver) e abre com o nome selecionado. Ela grava a ordem (depois de todas):
 * renomear para "A Fuga" não a tira do fim nem do "Mais recente".
 */
export function useNovaSessao(): () => Promise<void> {
  const sessoes = useSessoes()
  return useCallback(async () => {
    const { campanhaId, campanhas, criarVerbete, ir, travado, verbetes } = usePreludio.getState()
    if (travado) return
    const etiquetas = campanhaId !== null ? [campanhaId] : campanhas.length === 1 && campanhas[0] !== undefined ? [campanhas[0].id] : []
    const nova = verbeteNovo('sessao', nomeDaProximaSessao(sessoes), { campanhas: etiquetas, ordem: ordemDaProximaSessao(verbetes.values(), Date.now()) })
    await criarVerbete(nova)
    abrirComONomeSelecionado(nova.id)
    ir({ secao: 'sessoes', sessaoId: nova.id })
  }, [sessoes])
}

/** O tipo do arrastar de uma sessão: nenhuma outra área aceita, e soltar num campo de texto não escreve o id. */
const ARRASTO_DE_SESSAO = 'application/x-labirinto-sessao'

/**
 * Leva a sessão para a posição `para` da lista do filtro e grava a ordem nova
 * (`extras.ordem`) das que mudaram. Travado, ou alguma delas só de leitura:
 * nada muda (meia ordem gravada deixaria a lista diferente da que o mestre fez).
 */
export function useMoverSessao(): (sessaoId: string, para: number) => boolean {
  const sessoes = useSessoes()
  return useCallback(
    (sessaoId: string, para: number) => {
      const { mudarVerbete, soLeitura, travado } = usePreludio.getState()
      const de = sessoes.findIndex((sessao) => sessao.id === sessaoId)
      if (travado || de === -1) return false
      const novas = ordensAoMover(sessoes, de, para)
      if (novas.size === 0 || [...novas.keys()].some((id) => soLeitura.has(id))) return false
      for (const [id, ordem] of novas) mudarVerbete(id, (sessao) => comOrdem(sessao, ordem))
      return true
    },
    [sessoes],
  )
}

/** Onde a sessão arrastada cairia: antes ou depois da linha sob o ponteiro. */
interface PontoDeSoltar {
  readonly sessaoId: string
  readonly depois: boolean
}

function naMetadeDeBaixo(evento: DragEvent<HTMLElement>): boolean {
  const caixa = evento.currentTarget.getBoundingClientRect()
  return evento.clientY > caixa.top + caixa.height / 2
}

/**
 * ORGANIZAR AS SESSÕES (pedido de 16/11), igual na barra lateral e na lista
 * "Todas": arrastar uma linha para outra posição, ou Alt+↑/Alt+↓ com ela em
 * foco. Soltar fora de uma linha não muda nada. Durante o arrastar só a linha
 * de baixo do ponteiro muda (o fio de onde cai); a ordem grava ao soltar.
 * `lista` é o contêiner das linhas: o foco volta à sessão levada pelo teclado.
 */
export function useOrdemNaLista(sessoes: readonly Verbete[], lista: RefObject<HTMLElement | null>) {
  const mover = useMoverSessao()
  const travado = usePreludio((estado) => estado.travado)
  const podeMover = !travado && sessoes.length > 1
  // A levada mora num ref (o drop pode chegar antes de o React repintar) e num estado (só para apagar a linha).
  const levadaRef = useRef<string | null>(null)
  const [levada, setLevada] = useState<string | null>(null)
  const [solta, setSolta] = useState<PontoDeSoltar | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const focarDepois = useRef<string | null>(null)

  useLayoutEffect(() => {
    const id = focarDepois.current
    focarDepois.current = null
    if (id === null || lista.current === null) return
    const linha = [...lista.current.querySelectorAll<HTMLElement>('[data-sessao-id]')].find((botao) => botao.dataset.sessaoId === id)
    linha?.focus()
    linha?.scrollIntoView({ block: 'nearest' })
  }, [sessoes, lista])

  const largar = () => {
    levadaRef.current = null
    setLevada(null)
    setSolta(null)
  }
  const avisarPosicao = (sessaoId: string, para: number) => {
    const nome = sessoes.find((sessao) => sessao.id === sessaoId)?.titulo || 'Sessão sem nome'
    setAnuncio(`${nome}: posição ${para + 1} de ${sessoes.length}${para === sessoes.length - 1 ? ', a mais recente' : ''}.`)
  }

  const daLinha = (sessaoId: string, indice: number) => ({
    draggable: podeMover,
    'data-arrastada': levada === sessaoId ? true : undefined,
    'data-solta': solta?.sessaoId === sessaoId && levada !== sessaoId ? (solta.depois ? 'depois' : 'antes') : undefined,
    onDragStart: (evento: DragEvent<HTMLElement>) => {
      if (!podeMover) return
      evento.dataTransfer.setData(ARRASTO_DE_SESSAO, sessaoId)
      evento.dataTransfer.effectAllowed = 'move'
      levadaRef.current = sessaoId
      setLevada(sessaoId)
    },
    onDragOver: (evento: DragEvent<HTMLElement>) => {
      if (levadaRef.current === null) return
      evento.preventDefault()
      evento.dataTransfer.dropEffect = 'move'
      const depois = naMetadeDeBaixo(evento)
      if (solta?.sessaoId !== sessaoId || solta.depois !== depois) setSolta({ sessaoId, depois })
    },
    onDrop: (evento: DragEvent<HTMLElement>) => {
      const id = levadaRef.current
      if (id === null) return
      evento.preventDefault()
      const de = sessoes.findIndex((sessao) => sessao.id === id)
      // A posição conta sem a levada: cair depois de uma linha abaixo dela é uma casa a menos.
      const alvo = naMetadeDeBaixo(evento) ? indice + 1 : indice
      const para = de !== -1 && de < alvo ? alvo - 1 : alvo
      largar()
      if (mover(id, para)) avisarPosicao(id, para)
    },
    onDragEnd: largar,
  })

  const aoTeclar = (sessaoId: string, indice: number, evento: KeyboardEvent<HTMLElement>) => {
    if (!evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey || (evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown')) return
    evento.preventDefault()
    const para = indice + (evento.key === 'ArrowUp' ? -1 : 1)
    if (!podeMover || para < 0 || para >= sessoes.length) return
    if (!mover(sessaoId, para)) return
    focarDepois.current = sessaoId
    avisarPosicao(sessaoId, para)
  }

  return { daLinha, aoTeclar, anuncio, podeMover }
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
  const lista = useRef<HTMLOListElement>(null)
  const ordem = useOrdemNaLista(sessoes, lista)

  return (
    <div className="pr-sessoes">
      <header className="pr-sessoes__cabeca">
        <div>
          <h2 className="pr-sessoes__titulo">Sessões</h2>
          <p className="pr-sessoes__explica">
            Roteiro, o que revelar hoje e o que aconteceu. No mapa, o marcador Roteiro do Livro do mestre mostra a sessão mais recente da campanha.
            {ordem.podeMover && ' Arraste uma sessão para mudar a ordem (ou Alt+↑ e Alt+↓ com ela escolhida): a última é a mais recente.'}
          </p>
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
        <ol className="pr-sessoes__lista" ref={lista}>
          {sessoes.map((sessao, indice) => {
            const deQuais = nomeDa(sessao)
            return (
              <li key={sessao.id} {...ordem.daLinha(sessao.id, indice)}>
                <button
                  type="button"
                  className="pr-sessoes__item"
                  data-sessao-id={sessao.id}
                  onClick={() => ir({ secao: 'sessoes', sessaoId: sessao.id })}
                  onKeyDown={(evento) => ordem.aoTeclar(sessao.id, indice, evento)}
                >
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
      <p className="pr-sr" role="status">
        {ordem.anuncio}
      </p>
    </div>
  )
}

export function Sessoes({ sessaoId, aba, alvo }: { sessaoId: string | null; aba: AbaDaSessao; alvo?: string }) {
  return sessaoId === null ? <ListaDeSessoes /> : <PaginaDaSessao key={sessaoId} id={sessaoId} aba={aba} alvo={alvo} />
}
