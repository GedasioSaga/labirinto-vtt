import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { usePreludio } from '../estado/preludio'
import { quadroQueJaEstaNaSessao, quadrosNaLixeira, quadrosSoltos, resumoDaContagem, useQuadros, type ResumoDoQuadro } from './estadoDosQuadros'
import { QuadroSobDemanda } from './sobDemanda'

/**
 * OS QUADROS (MAPA MENTAL) DO PRELÚDIO, fatia F3: a lista dos quadros soltos do
 * filtro "Campanha" (o de sessão fica na aba Quadro dela; pedido de 16/11) e,
 * aberto, o quadro no tldraw (baixado só então).
 * F3c, como na barra lateral do Grimório: cada quadro muda de campanha e vai
 * para a lixeira, de onde volta com "Restaurar" (ou com o "Desfazer" do aviso).
 */

/** Os quadros da lista "Quadros" (a barra lateral conta os mesmos): os soltos do filtro. */
export function useQuadrosSoltos(): readonly ResumoDoQuadro[] {
  const lista = useQuadros((estado) => estado.lista)
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const verbetes = usePreludio((estado) => estado.verbetes)
  return useMemo(() => quadrosSoltos(lista, campanhaId, (sessaoId) => verbetes.get(sessaoId)?.tipo === 'sessao'), [lista, campanhaId, verbetes])
}

/** Quanto tempo o aviso "foi para a lixeira — Desfazer" fica na lista. */
const AVISO_DA_LISTA_MS = 8000

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/**
 * "Na lixeira desde 09/11, 14:20". O esquema aceita qualquer texto em `lixeira`
 * (um arquivo editado à mão, um ""): sem data válida, fica só "Na lixeira", em
 * vez de o `format` derrubar a tela com "Invalid time value".
 */
export function quandoFoiParaALixeira(lixeira: string): string {
  const instante = Date.parse(lixeira)
  return Number.isNaN(instante) ? 'Na lixeira' : `Na lixeira desde ${DATA.format(new Date(instante))}`
}

/** "+ Novo quadro": cria na campanha do filtro e abre com o nome selecionado; se o disco recusar, a lista diz por quê. */
export function useNovoQuadro(): () => Promise<void> {
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const ir = usePreludio((estado) => estado.ir)
  return async () => {
    if (usePreludio.getState().travado) return
    const id = await useQuadros.getState().criar(campanhaId)
    ir({ secao: 'quadros', quadroId: id })
  }
}

type AvisoDaLista = { readonly texto: string; readonly falhou: boolean; readonly desfazer?: { readonly id: string } }

const LIXEIRA = (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 6h12M8 6V4.5h4V6M6 6l.7 9.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L14 6M8.7 9v4.5M11.3 9v4.5" />
  </svg>
)

interface LinhaProps {
  readonly quadro: ResumoDoQuadro
  readonly ocupado: boolean
  readonly travado: boolean
  readonly aoAbrir: () => void
  readonly aoMudarCampanha: (campanhaId: string | null) => void
  readonly aoLixeira: () => void
}

function LinhaDoQuadro({ quadro, ocupado, travado, aoAbrir, aoMudarCampanha, aoLixeira }: LinhaProps) {
  const campanhas = usePreludio((estado) => estado.campanhas)
  const idDaCampanha = useId()
  const nome = quadro.nome || 'Quadro sem nome'
  // O arquivo que não abriu (ou de versão mais nova) não muda daqui: o aviso dele já diz por quê.
  const mexivel = quadro.contagem !== null && quadro.aviso === null && !travado
  const campanhaSumiu = quadro.campanhaId !== null && !campanhas.some((campanha) => campanha.id === quadro.campanhaId)

  return (
    <li className="pr-quadros__item" aria-busy={ocupado}>
      <button type="button" className="pr-caderno" onClick={aoAbrir}>
        <span className="pr-caderno__nome">{nome}</span>
        <span className="pr-caderno__conta">{quadro.contagem === null ? 'Não abriu' : resumoDaContagem(quadro.contagem)}</span>
        {quadro.planta && <span className="pr-quadro__selo">Planta do Grimório, só para ver</span>}
        {quadro.aviso !== null && <span className="pr-quadro__aviso">{quadro.aviso}</span>}
      </button>
      {mexivel && (
        <div className="pr-quadros__acoes">
          <label className="pr-sr" htmlFor={idDaCampanha}>
            Campanha de {nome}
          </label>
          <select
            id={idDaCampanha}
            className="pr-quadros__campanha"
            value={quadro.campanhaId ?? ''}
            disabled={ocupado}
            title="Mudar de campanha"
            onChange={(evento) => aoMudarCampanha(evento.target.value === '' ? null : evento.target.value)}
          >
            <option value="">Sem campanha</option>
            {campanhas.map((campanha) => (
              <option key={campanha.id} value={campanha.id}>
                {campanha.nome}
              </option>
            ))}
            {campanhaSumiu && <option value={quadro.campanhaId ?? ''}>Campanha que não existe mais</option>}
          </select>
          <button type="button" className="pr-quadros__lixeira" disabled={ocupado} aria-label={`Mandar ${nome} para a lixeira`} title="Mandar para a lixeira" onClick={aoLixeira}>
            {LIXEIRA}
          </button>
        </div>
      )}
    </li>
  )
}

interface EscolhaProps {
  readonly quadro: ResumoDoQuadro
  readonly atual: ResumoDoQuadro
  readonly sessao: string
  readonly aoTrocar: () => void
  readonly aoSoltar: () => void
  readonly aoCancelar: () => void
}

/**
 * Restaurar um quadro cuja sessão já tem outro na aba Quadro: o mestre diz
 * qual fica na sessão (antes, o de menor id ganhava calado, e o trabalho no
 * outro sumia da sessão). O foco vai para a primeira resposta; Esc desiste.
 */
function EscolhaDaSessao({ quadro, atual, sessao, aoTrocar, aoSoltar, aoCancelar }: EscolhaProps) {
  const primeira = useRef<HTMLButtonElement>(null)
  const idDoTexto = useId()
  const nome = quadro.nome || 'Quadro sem nome'
  const nomeAtual = atual.nome || 'Quadro sem nome'
  // O quadro novo da sessão nasce com o nome dela: com os dois de mesmo nome, o que cada um tem dentro os distingue.
  const mesmoNome = nome === nomeAtual
  const conteudo = (de: ResumoDoQuadro) => (de.contagem === null ? 'não abriu' : resumoDaContagem(de.contagem).toLocaleLowerCase('pt-BR'))

  useEffect(() => {
    primeira.current?.focus()
  }, [])

  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Escape') return
    evento.preventDefault()
    aoCancelar()
  }

  return (
    <div className="pr-quadros__escolha" role="group" aria-labelledby={idDoTexto} onKeyDown={aoTeclar}>
      <p id={idDoTexto} className="pr-quadros__escolha-texto">
        A sessão <b>{sessao}</b> já tem o quadro <b>{nomeAtual}</b>
        {mesmoNome && ` (${conteudo(atual)}); o da lixeira tem o mesmo nome (${conteudo(quadro)})`}. Qual fica na sessão?
      </p>
      <div className="pr-quadros__escolha-acoes">
        <button ref={primeira} type="button" className="gr-bt gr-bt--p gr-bt--latao" onClick={aoTrocar}>
          {mesmoNome ? 'O da lixeira' : nome} volta para a sessão
        </button>
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoSoltar}>
          {mesmoNome ? 'Fica o que já está; o da lixeira volta solto' : `Fica ${nomeAtual}; este volta solto`}
        </button>
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function ListaDeQuadros() {
  const lista = useQuadros((estado) => estado.lista)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const travado = usePreludio((estado) => estado.travado)
  const ir = usePreludio((estado) => estado.ir)
  const novoQuadro = useNovoQuadro()
  const falha = useQuadros((estado) => estado.avisoDaCriacao)
  const [naLixeira, setNaLixeira] = useState(false)
  const [ocupados, setOcupados] = useState<ReadonlySet<string>>(new Set())
  const [aviso, setAviso] = useState<AvisoDaLista | null>(null)
  /** O quadro que ia voltar, e o da sessão dele que já está na aba: a linha pergunta qual fica. */
  const [escolha, setEscolha] = useState<{ readonly quadroId: string; readonly atualId: string } | null>(null)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const botoesDeRestaurar = useRef(new Map<string, HTMLButtonElement>())
  const quadros = useQuadrosSoltos()
  const jogados = quadrosNaLixeira(lista)
  const mostrados = naLixeira ? jogados : quadros

  // O aviso de sucesso some sozinho; o de falha fica até a próxima ação.
  useEffect(() => {
    if (aviso === null || aviso.falhou) return
    const relogio = setTimeout(() => setAviso(null), AVISO_DA_LISTA_MS)
    return () => clearTimeout(relogio)
  }, [aviso])

  // A lixeira esvaziou (restaurou o último): a lista volta aos quadros.
  useEffect(() => {
    if (naLixeira && lista.t === 'pronta' && jogados.length === 0) setNaLixeira(false)
  }, [naLixeira, lista.t, jogados.length])

  const comOcupado = async (id: string, fazer: () => Promise<string | null>, sucesso: AvisoDaLista) => {
    setOcupados((antes) => new Set(antes).add(id))
    const motivo = await fazer()
    setOcupados((antes) => {
      const depois = new Set(antes)
      depois.delete(id)
      return depois
    })
    setAviso(motivo === null ? sucesso : { texto: motivo, falhou: true })
  }

  const nomeDe = (quadro: ResumoDoQuadro) => quadro.nome || 'Quadro sem nome'
  const lixeira = (quadro: ResumoDoQuadro) => void comOcupado(quadro.id, () => useQuadros.getState().porNaLixeira(quadro.id, true), { texto: `${nomeDe(quadro)} foi para a lixeira.`, falhou: false, desfazer: { id: quadro.id } })
  const restaurar = (quadro: ResumoDoQuadro) => {
    // A sessão dele já tem outro quadro: o mestre escolhe qual fica (a linha da lixeira pergunta).
    const atual = quadroQueJaEstaNaSessao(lista, quadro)
    if (atual !== undefined) {
      setNaLixeira(true)
      setEscolha({ quadroId: quadro.id, atualId: atual.id })
      return
    }
    void comOcupado(quadro.id, () => useQuadros.getState().porNaLixeira(quadro.id, false), { texto: `${nomeDe(quadro)} voltou da lixeira.`, falhou: false })
  }
  const desistirDaEscolha = () => {
    const id = escolha?.quadroId
    setEscolha(null)
    if (id !== undefined) requestAnimationFrame(() => botoesDeRestaurar.current.get(id)?.focus())
  }
  const voltarParaASessao = (quadro: ResumoDoQuadro, atual: ResumoDoQuadro) => {
    setEscolha(null)
    // Primeiro o outro sai da sessão; se o disco recusar, nada mais muda (a sessão não fica com dois).
    void comOcupado(
      quadro.id,
      async () => (await useQuadros.getState().soltarDaSessao(atual.id)) ?? useQuadros.getState().porNaLixeira(quadro.id, false),
      { texto: `${nomeDe(quadro)} voltou para a sessão; ${nomeDe(atual)} continua na lista, solto.`, falhou: false },
    )
  }
  const voltarSolto = (quadro: ResumoDoQuadro, atual: ResumoDoQuadro) => {
    setEscolha(null)
    void comOcupado(quadro.id, () => useQuadros.getState().restaurarSolto(quadro.id), { texto: `${nomeDe(quadro)} voltou da lixeira, solto; a sessão continua com ${nomeDe(atual)}.`, falhou: false })
  }
  const mudarCampanha = (quadro: ResumoDoQuadro, nova: string | null) => {
    const destino = nova === null ? 'ficou sem campanha' : `foi para ${campanhas.find((campanha) => campanha.id === nova)?.nome ?? 'a campanha escolhida'}`
    void comOcupado(quadro.id, () => useQuadros.getState().mudarCampanha(quadro.id, nova), { texto: `${nomeDe(quadro)} ${destino}.`, falhou: false })
  }
  const desfazer = (id: string) => {
    const quadro = lista.t === 'pronta' ? lista.quadros.find((cada) => cada.id === id) : undefined
    if (quadro !== undefined) restaurar(quadro)
  }

  const conta = lista.t !== 'pronta' ? ' ' : naLixeira ? (jogados.length === 1 ? '1 quadro na lixeira' : `${jogados.length} quadros na lixeira`) : quadros.length === 1 ? '1 quadro' : `${quadros.length} quadros`

  return (
    <section className="pr-lista" aria-labelledby="pr-quadros-titulo" aria-busy={lista.t === 'lendo'}>
      <header className="pr-lista__cabeca">
        <div>
          <h2 id="pr-quadros-titulo" className="pr-lista__titulo">
            {naLixeira ? 'Lixeira dos quadros' : 'Quadros'}
          </h2>
          <p className="pr-lista__conta">{conta}</p>
        </div>
        <div className="pr-lista__acoes">
          {(jogados.length > 0 || naLixeira) && (
            <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma pr-quadros__ver-lixeira" aria-pressed={naLixeira} onClick={() => setNaLixeira((antes) => !antes)}>
              {LIXEIRA}
              {naLixeira ? 'Voltar aos quadros' : `Lixeira (${jogados.length})`}
            </button>
          )}
          {!naLixeira && (
            <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={travado || lista.t !== 'pronta'} onClick={() => void novoQuadro()}>
              + Novo quadro
            </button>
          )}
        </div>
      </header>
      {falha !== null && (
        <p className="pr-aviso" role="alert">
          {falha}
        </p>
      )}
      <div className="pr-quadros__aviso-casca" role={aviso?.falhou === true ? 'alert' : 'status'}>
        {aviso !== null && (
          <p className={`pr-quadros__aviso${aviso.falhou ? ' pr-quadros__aviso--falhou' : ''}`}>
            <span>{aviso.texto}</span>
            {aviso.desfazer !== undefined && (
              <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={() => aviso.desfazer !== undefined && desfazer(aviso.desfazer.id)}>
                Desfazer
              </button>
            )}
          </p>
        )}
      </div>
      {lista.t === 'falhou' ? (
        <p className="pr-aviso" role="alert">
          {lista.aviso}
        </p>
      ) : lista.t !== 'pronta' ? null : mostrados.length === 0 ? (
        <div className="pr-vazio">
          <p className="pr-vazio__texto">
            Nenhum quadro solto ainda. Aqui ficam os quadros para rabiscar fora das sessões: imagens, notas, cartões dos verbetes e setas entre eles. O quadro de cada sessão fica dentro dela, na aba Quadro.
          </p>
        </div>
      ) : naLixeira ? (
        <ul className="pr-cadernos">
          {jogados.map((quadro) => {
            const atual = escolha?.quadroId === quadro.id && lista.t === 'pronta' ? lista.quadros.find((cada) => cada.id === escolha.atualId) : undefined
            return (
              <li key={quadro.id} className="pr-quadros__item pr-quadros__item--lixeira" aria-busy={ocupados.has(quadro.id)}>
                <div className="pr-caderno pr-caderno--parado">
                  <span className="pr-caderno__nome">{nomeDe(quadro)}</span>
                  <span className="pr-caderno__conta">{quadro.contagem === null ? 'Não abriu' : resumoDaContagem(quadro.contagem)}</span>
                  {quadro.lixeira !== null && <span className="pr-caderno__conta">{quandoFoiParaALixeira(quadro.lixeira)}</span>}
                </div>
                {atual !== undefined ? (
                  <EscolhaDaSessao
                    quadro={quadro}
                    atual={atual}
                    sessao={(quadro.sessaoId === null ? undefined : verbetes.get(quadro.sessaoId)?.titulo) || 'sem nome'}
                    aoTrocar={() => voltarParaASessao(quadro, atual)}
                    aoSoltar={() => voltarSolto(quadro, atual)}
                    aoCancelar={desistirDaEscolha}
                  />
                ) : (
                  <div className="pr-quadros__acoes">
                    <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={() => ir({ secao: 'quadros', quadroId: quadro.id })}>
                      Ver
                    </button>
                    <button
                      ref={(botao) => {
                        if (botao === null) botoesDeRestaurar.current.delete(quadro.id)
                        else botoesDeRestaurar.current.set(quadro.id, botao)
                      }}
                      type="button"
                      className="gr-bt gr-bt--p gr-bt--latao"
                      disabled={travado || ocupados.has(quadro.id)}
                      onClick={() => restaurar(quadro)}
                    >
                      Restaurar
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="pr-cadernos">
          {quadros.map((quadro) => (
            <LinhaDoQuadro
              key={quadro.id}
              quadro={quadro}
              ocupado={ocupados.has(quadro.id)}
              travado={travado}
              aoAbrir={() => ir({ secao: 'quadros', quadroId: quadro.id })}
              aoMudarCampanha={(nova) => mudarCampanha(quadro, nova)}
              aoLixeira={() => lixeira(quadro)}
            />
          ))}
        </ul>
      )}
      {naLixeira && <p className="pr-quieto pr-quadros__explica">O quadro na lixeira continua inteiro, com o que tem dentro. Ele não aparece na lista, na sessão nem na hora de citar, até você restaurar.</p>}
    </section>
  )
}

export function Quadros({ quadroId, alvo }: { quadroId: string | null; alvo?: string }) {
  const ir = usePreludio((estado) => estado.ir)
  if (quadroId === null) return <ListaDeQuadros />
  return <QuadroSobDemanda key={quadroId} id={quadroId} alvo={alvo} aoVoltar={() => ir({ secao: 'quadros', quadroId: null })} />
}
