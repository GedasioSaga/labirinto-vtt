import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { compararTitulos, ROTULO_DO_TIPO, semAcento } from '../../lib/preparo/enciclopedia'
import type { ParaQuem } from '../../lib/preparo/revelado'
import { alvosParaRevelar, comParaRevelar, dadosDaSessao, formaParaRevelar, situacaoDoItem, type SituacaoDoItem } from '../../lib/preparo/sessoes'
import type { DadosDaSessao, ParaRevelar, Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { useContasDoJogo, type ContaDoJogo } from '../revelar/contas'
import { bloqueioDoVerbete, estadoEmTexto, useCampanhaDaRevelacao, useRevelacoesDaCampanha, type CampanhaDaRevelacao } from '../revelar/Revelar'
import './sessoes.css'

/**
 * "REVELAR HOJE" (F4): os verbetes que o mestre pretende mostrar nesta sessão.
 * O botão Revelar usa a revelação da F2c: o verbete, a forma e as seções comuns
 * dela, de uma vez, para quem o item pede. No Prelúdio a lista se monta; no
 * Livro do mestre ela é só leitura, com Revelar e Ocultar, e cada verbete
 * citado no roteiro também revela (`RevelarDaMencao`).
 */

const SEM_CAMPANHA = 'Marque a campanha desta sessão para revelar: cada campanha tem os jogadores dela.'
const MAXIMO_DE_ACHADOS = 8
const MAXIMO_DE_SUGESTOES = 6

const CHECK = (
  <svg className="pr-hoje__check" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </svg>
)

function textoDaSituacao(situacao: SituacaoDoItem, para: ParaQuem, contas: readonly ContaDoJogo[]): string {
  if (situacao.t === 'revelado') return estadoEmTexto(situacao.para, contas, false)
  if (situacao.t === 'parte') return `${estadoEmTexto(situacao.para, contas, false)}, em parte`
  return `Oculto. Revelar mostra ${para === 'todos' ? 'a todos' : estadoEmTexto(para, contas, false).replace(/^Revelado /, '')}`
}

// ─── Para quem ───────────────────────────────────────────────────────────────

const OUTRO = 'outro'

function valorDoPara(para: ParaQuem): string {
  if (para === 'todos') return 'todos'
  return para.length === 1 && para[0] !== undefined ? `conta:${para[0]}` : OUTRO
}

function ParaQuemSelect({ item, contas, aoMudar }: { item: ParaRevelar; contas: readonly ContaDoJogo[]; aoMudar: (para: ParaQuem) => void }) {
  const valor = valorDoPara(item.para)
  return (
    <select
      className="pr-hoje__escolha"
      aria-label="Revelar para"
      value={valor}
      onChange={(evento) => {
        const escolhido = evento.target.value
        if (escolhido === 'todos') aoMudar('todos')
        else if (escolhido.startsWith('conta:')) aoMudar([escolhido.slice('conta:'.length)])
      }}
    >
      <option value="todos">para todos</option>
      {contas.map((conta) => (
        <option key={conta.id} value={`conta:${conta.id}`}>
          só para {conta.nome}
        </option>
      ))}
      {valor === OUTRO && <option value={OUTRO}>{estadoEmTexto(item.para, contas, false).replace(/^Revelado a/, 'para')}</option>}
    </select>
  )
}

// ─── Um item ─────────────────────────────────────────────────────────────────

interface ItemProps {
  item: ParaRevelar
  verbete: Verbete | undefined
  campanhaId: string | null
  bloqueio: string | null
  porAlvo: ReturnType<typeof useRevelacoesDaCampanha>['porAlvo']
  contas: readonly ContaDoJogo[]
  editavel: boolean
  aoMudar: (mudar: (item: ParaRevelar) => ParaRevelar) => void
  aoTirar: () => void
  aoAbrir?: (verbete: Verbete) => void
}

function ItemDeRevelar({ item, verbete, campanhaId, bloqueio, porAlvo, contas, editavel, aoMudar, aoTirar, aoAbrir }: ItemProps) {
  const revelar = usePreludio((estado) => estado.revelar)
  const campanhas = usePreludio((estado) => estado.campanhas)
  if (verbete === undefined) {
    return (
      <li className="pr-hoje__item" data-estado="sumiu">
        <div className="pr-hoje__linha">
          <span className="pr-hoje__nome pr-hoje__nome--sumiu">Este verbete não existe mais</span>
          {editavel && (
            <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoTirar}>
              Tirar
            </button>
          )}
        </div>
      </li>
    )
  }
  const situacao = situacaoDoItem(verbete, item, porAlvo)
  const nome = verbete.titulo || 'Sem nome'
  // O pacote do jogador só leva o verbete etiquetado na campanha: revelar fora dela não chegaria a ninguém. Ocultar sempre pode.
  const fora = campanhaId !== null && !verbete.campanhas.includes(campanhaId)
  const doItem = bloqueioDoVerbete(verbete) ?? (fora ? `Fora de ${campanhas.find((campanha) => campanha.id === campanhaId)?.nome ?? 'esta campanha'}. Para revelar, marque a campanha no verbete.` : null)
  const paradoParaRevelar = bloqueio ?? doItem
  const paradoParaOcultar = bloqueio ?? bloqueioDoVerbete(verbete)
  const mudar = (para: ParaQuem | null) => {
    if (campanhaId === null) return
    void revelar(
      campanhaId,
      alvosParaRevelar(verbete, item).map((alvo) => ({ alvo, para })),
    )
  }
  return (
    <li className="pr-hoje__item" data-estado={situacao.t}>
      <div className="pr-hoje__linha">
        {aoAbrir === undefined ? (
          <span className="pr-hoje__nome">{nome}</span>
        ) : (
          <button type="button" className="pr-hoje__nome pr-hoje__nome--link" onClick={() => aoAbrir(verbete)}>
            {nome}
          </button>
        )}
        <div className="pr-hoje__acoes">
          {situacao.t === 'revelado' ? (
            <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={paradoParaOcultar !== null} title={paradoParaOcultar ?? `Ocultar ${nome} de novo`} onClick={() => mudar(null)}>
              Ocultar
            </button>
          ) : (
            <button type="button" className="gr-bt gr-bt--p gr-bt--latao pr-hoje__revelar" disabled={paradoParaRevelar !== null} title={paradoParaRevelar ?? undefined} onClick={() => mudar(item.para)}>
              {situacao.t === 'parte' ? 'Revelar o resto' : 'Revelar'}
            </button>
          )}
          {editavel && (
            <button type="button" className="pr-hoje__tirar" aria-label={`Tirar ${nome} da lista`} title="Tirar da lista (não oculta)" onClick={aoTirar}>
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path d="M6 6l8 8M14 6l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {/* O motivo de não poder revelar fica escrito na linha, não só na dica do botão. */}
      <p className="pr-hoje__estado" data-parado={doItem !== null ? '' : undefined} aria-live="polite">
        {doItem === null && situacao.t === 'revelado' && CHECK}
        {doItem ?? textoDaSituacao(situacao, item.para, contas)}
      </p>
      {editavel && (verbete.formas.length > 1 || contas.length > 0) && (
        <div className="pr-hoje__opcoes">
          {verbete.formas.length > 1 && (
            <select className="pr-hoje__escolha" aria-label={`Forma de ${nome} a revelar`} value={item.formaId ?? ''} onChange={(evento) => aoMudar((atual) => withForma(atual, evento.target.value))}>
              <option value="">forma ativa</option>
              {verbete.formas.map((forma) => (
                <option key={forma.id} value={forma.id}>
                  forma {forma.nome || 'sem nome'}
                </option>
              ))}
            </select>
          )}
          {contas.length > 0 && <ParaQuemSelect item={item} contas={contas} aoMudar={(para) => aoMudar((atual) => ({ ...atual, para: para === 'todos' ? 'todos' : [...para] }))} />}
        </div>
      )}
    </li>
  )
}

function withForma(item: ParaRevelar, formaId: string): ParaRevelar {
  const { formaId: _antes, ...resto } = item
  return formaId === '' ? resto : { ...resto, formaId }
}

// ─── Pôr na lista ────────────────────────────────────────────────────────────

function PorNaLista({ candidatos, aoPor }: { candidatos: readonly Verbete[]; aoPor: (verbete: Verbete) => void }) {
  const [consulta, setConsulta] = useState('')
  const [marcado, setMarcado] = useState(0)
  const lista = useId()
  const termo = semAcento(consulta.trim())
  const achados = useMemo(() => {
    if (termo === '') return []
    const comNota = candidatos
      .map((verbete) => {
        const nomes = [verbete.titulo, ...verbete.apelidos].map(semAcento)
        const nota = nomes.some((nome) => nome.startsWith(termo)) ? 0 : nomes.some((nome) => nome.includes(termo)) ? 1 : -1
        return { verbete, nota }
      })
      .filter(({ nota }) => nota >= 0)
    return comNota
      .sort((a, b) => a.nota - b.nota || compararTitulos(a.verbete.titulo, b.verbete.titulo))
      .slice(0, MAXIMO_DE_ACHADOS)
      .map(({ verbete }) => verbete)
  }, [candidatos, termo])
  const aberto = achados.length > 0
  const ativo = Math.min(marcado, achados.length - 1)

  const por = (verbete: Verbete) => {
    aoPor(verbete)
    setConsulta('')
    setMarcado(0)
  }
  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown' && aberto) {
      evento.preventDefault()
      setMarcado((ativo + 1) % achados.length)
    } else if (evento.key === 'ArrowUp' && aberto) {
      evento.preventDefault()
      setMarcado((ativo - 1 + achados.length) % achados.length)
    } else if (evento.key === 'Enter' && aberto) {
      evento.preventDefault()
      const escolhido = achados[ativo]
      if (escolhido !== undefined) por(escolhido)
    } else if (evento.key === 'Escape' && consulta !== '') {
      evento.preventDefault()
      evento.stopPropagation()
      setConsulta('')
    }
  }

  return (
    <div className="pr-hoje__novo">
      <input
        className="pr-campo__entrada"
        role="combobox"
        aria-label="Pôr um verbete na lista"
        aria-expanded={aberto}
        aria-controls={lista}
        aria-autocomplete="list"
        aria-activedescendant={aberto ? `${lista}-${ativo}` : undefined}
        placeholder="Pôr na lista: nome do verbete"
        value={consulta}
        onChange={(evento) => {
          setConsulta(evento.target.value)
          setMarcado(0)
        }}
        onKeyDown={aoTeclar}
      />
      {aberto && (
        <ul className="pr-hoje__achados" id={lista} role="listbox" aria-label="Verbetes">
          {achados.map((verbete, indice) => (
            <li
              key={verbete.id}
              id={`${lista}-${indice}`}
              role="option"
              aria-selected={indice === ativo}
              className="pr-hoje__achado"
              // O clique não tira o foco do campo: dá para pôr outro em seguida.
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => por(verbete)}
            >
              <span>{verbete.titulo || 'Sem nome'}</span>
              <span className="pr-hoje__achado-tipo">{ROTULO_DO_TIPO[verbete.tipo].um}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── A lista ─────────────────────────────────────────────────────────────────

interface RevelarHojeProps {
  sessao: Verbete
  /** No Livro do mestre a lista não se monta: só Revelar e Ocultar. */
  editavel: boolean
  /** Os verbetes mencionados no roteiro: entram na lista com um clique. */
  mencionados?: readonly Verbete[]
  aoAbrir?: (verbete: Verbete) => void
  /** Título da seção (o Livro usa um menor). */
  tituloId: string
  /** A campanha de quem chama (o Livro escolhe a da pasta do mapa e usa a mesma nas menções); sem ela, a da sessão. */
  campanha?: CampanhaDaRevelacao
}

export function RevelarHoje({ sessao, editavel, mencionados = [], aoAbrir, tituloId, campanha: deFora }: RevelarHojeProps) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const mudarVerbete = usePreludio((estado) => estado.mudarVerbete)
  const aviso = usePreludio((estado) => estado.avisoDoRevelado)
  const dispensarAviso = usePreludio((estado) => estado.dispensarAvisoDoRevelado)
  const propria = useCampanhaDaRevelacao(sessao)
  const campanha = deFora ?? propria
  const revelacoes = useRevelacoesDaCampanha(campanha.campanhaId)
  const contas = useContasDoJogo()
  const dados = dadosDaSessao(sessao)
  const bloqueio = campanha.campanhaId === null ? SEM_CAMPANHA : revelacoes.bloqueio

  const mudarDados = (mudar: (dados: DadosDaSessao) => DadosDaSessao) => mudarVerbete(sessao.id, (atual) => ({ ...atual, sessao: mudar(dadosDaSessao(atual)) }))
  const naLista = new Set(dados.revelarHoje.map((item) => item.verbeteId))
  // Só se revela o que está na campanha da revelação (o pacote do jogador confere a etiqueta).
  const candidatos = useMemo(
    () => [...verbetes.values()].filter((verbete) => verbete.tipo !== 'sessao' && (campanha.campanhaId === null || verbete.campanhas.includes(campanha.campanhaId))),
    [verbetes, campanha.campanhaId],
  )
  const sugestoes = mencionados.filter((verbete) => !naLista.has(verbete.id) && verbete.tipo !== 'sessao').slice(0, MAXIMO_DE_SUGESTOES)

  return (
    <section className="pr-hoje" aria-labelledby={tituloId}>
      <h3 id={tituloId} className="pr-trilho__titulo">
        Revelar hoje
      </h3>
      {campanha.campanhas.length > 1 && (
        <label className="pr-revelar__campanha">
          <span>na campanha</span>
          <select className="pr-revelar__escolha" value={campanha.campanhaId ?? ''} onChange={(evento) => campanha.escolher(evento.target.value)}>
            {campanha.campanhas.map((uma) => (
              <option key={uma.id} value={uma.id}>
                {uma.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {bloqueio !== null && <p className="pr-quieto">{bloqueio}</p>}
      {dados.revelarHoje.length === 0 ? (
        <p className="pr-quieto">{editavel ? 'Nada na lista ainda. Ponha aqui o que os jogadores podem descobrir hoje: o Revelar mostra com um clique, também no mapa.' : 'Nada para revelar nesta sessão.'}</p>
      ) : (
        <ul className="pr-hoje__lista">
          {dados.revelarHoje.map((item, indice) => (
            <ItemDeRevelar
              key={item.verbeteId}
              item={item}
              verbete={verbetes.get(item.verbeteId)}
              campanhaId={campanha.campanhaId}
              bloqueio={bloqueio}
              porAlvo={revelacoes.porAlvo}
              contas={contas}
              editavel={editavel}
              aoAbrir={aoAbrir}
              aoMudar={(mudar) => mudarDados((atual) => ({ ...atual, revelarHoje: atual.revelarHoje.map((outro, qual) => (qual === indice ? mudar(outro) : outro)) }))}
              aoTirar={() => mudarDados((atual) => ({ ...atual, revelarHoje: atual.revelarHoje.filter((_, qual) => qual !== indice) }))}
            />
          ))}
        </ul>
      )}
      {editavel && (
        <>
          <PorNaLista candidatos={candidatos.filter((verbete) => !naLista.has(verbete.id))} aoPor={(verbete) => mudarDados((atual) => comParaRevelar(atual, verbete.id))} />
          {sugestoes.length > 0 && (
            <div className="pr-hoje__sugestoes" role="group" aria-label="Mencionados no roteiro">
              <span className="pr-hoje__sugestoes-rotulo">Mencionados no roteiro</span>
              {sugestoes.map((verbete) => (
                <button key={verbete.id} type="button" className="pr-chip" onClick={() => mudarDados((atual) => comParaRevelar(atual, verbete.id))}>
                  + {verbete.titulo || 'Sem nome'}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {aviso !== null && (
        <p className="pr-aviso pr-revelar__aviso" role="alert">
          <span>{aviso}</span>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={dispensarAviso}>
            Entendi
          </button>
        </p>
      )}
    </section>
  )
}

// ─── Um verbete citado no roteiro ────────────────────────────────────────────

const NADA = () => undefined

interface RevelarDaMencaoProps {
  sessao: Verbete
  verbeteId: string
  /** A mesma campanha do "Revelar hoje" ao lado. */
  campanhaId: string | null
}

/**
 * O Revelar de um verbete citado no roteiro (o pop da menção no Livro do
 * mestre): o mesmo item do "Revelar hoje". Na lista, vale o "para quem" e a
 * forma dele; fora, a forma ativa, para todos. Não muda a lista da sessão.
 */
export function RevelarDaMencao({ sessao, verbeteId, campanhaId }: RevelarDaMencaoProps) {
  const verbete = usePreludio((estado) => estado.verbetes.get(verbeteId))
  const aviso = usePreludio((estado) => estado.avisoDoRevelado)
  const dispensarAviso = usePreludio((estado) => estado.dispensarAvisoDoRevelado)
  const revelacoes = useRevelacoesDaCampanha(campanhaId)
  const contas = useContasDoJogo()
  const daLista = dadosDaSessao(sessao).revelarHoje.find((item) => item.verbeteId === verbeteId)
  const item: ParaRevelar = daLista ?? { verbeteId, para: 'todos' }
  const bloqueio = campanhaId === null ? SEM_CAMPANHA : revelacoes.bloqueio
  const resumo = verbete === undefined ? '' : (formaParaRevelar(verbete, item)?.resumo.trim() ?? '')
  return (
    <div className="pr-hoje pr-hoje--mencao">
      <ul className="pr-hoje__lista">
        <ItemDeRevelar item={item} verbete={verbete} campanhaId={campanhaId} bloqueio={bloqueio} porAlvo={revelacoes.porAlvo} contas={contas} editavel={false} aoMudar={NADA} aoTirar={NADA} />
      </ul>
      {resumo !== '' && <p className="pr-hoje__resumo">{resumo}</p>}
      {verbete !== undefined && (
        <p className="pr-hoje__origem">
          {ROTULO_DO_TIPO[verbete.tipo].um}
          {daLista !== undefined && ', na lista de hoje'}
        </p>
      )}
      {bloqueio !== null && <p className="pr-quieto">{bloqueio}</p>}
      {aviso !== null && (
        <p className="pr-aviso pr-revelar__aviso" role="alert">
          <span>{aviso}</span>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={dispensarAviso}>
            Entendi
          </button>
        </p>
      )}
    </div>
  )
}
