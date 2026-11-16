import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Torrada, Torradas } from '../../components/grimorio/Torrada'
import { idNovo } from '../../lib/preparo/enciclopedia'
import {
  campanhaDaSessaoEm,
  campanhasComDados,
  comEraNova,
  comEraRenomeada,
  comEventoDeVolta,
  comEventoMovido,
  comEventoNaTecla,
  comEventoSalvo,
  linhaDaCampanha,
  SEM_CAMPANHA,
  type DadosDoEvento,
  type DestinoDoEvento,
  type LinhaDaCampanha,
} from '../../lib/preparo/linhaDoTempo'
import { semEvento, sessoesEmOrdem } from '../../lib/preparo/sessoes'
import type { Evento, Tempo, Verbete } from '../../lib/preparo/tipos'
import { lugarDoVerbete } from '../enciclopedia/ListaDeVerbetes'
import { usePreludio } from '../estado/preludio'
import { useArrastoNaLinha } from './arrastarNaLinha'
import { CartaoDoEvento } from './CartaoDoEvento'
import { FormularioDoEvento, type RascunhoDoEvento } from './FormularioDoEvento'
import './tempo.css'

/**
 * A LINHA DO TEMPO (E3c, protótipo aprovado em 16/11, tela 5; pedido do
 * mestre: "um lugar com uma Linha cronológica dos eventos"). Uma linha por
 * campanha, a do filtro "Campanha" da barra (em "Todas", a primeira, ou a que
 * for escolhida aqui). No alto, a bandeja com o que chegou das sessões sem
 * data; embaixo, as eras na ordem delas, e em cada era os anos, do mais
 * antigo ao mais novo.
 *
 * Criar, editar no lugar, arrastar pela alça (até um ano, ou de volta à
 * bandeja) e Alt+↑/↓ na alça. Cada mudança vai ao disco na hora
 * (`mudarLinhaDoTempo`); mover e apagar oferecem Desfazer.
 */

const NOVA_ERA_PADRAO = 'Nova era'
const LIMITE_DO_NOME_DA_ERA = 60
/** Quem viu a tela uma vez não vê mais o selo "Nova" na barra. */
const CHAVE_DE_JA_VISTA = 'lb-preparo:tempo-visto'

export function linhaDoTempoJaVista(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_DE_JA_VISTA) !== null
  } catch {
    return true
  }
}

function marcarComoVista(): void {
  try {
    window.localStorage.setItem(CHAVE_DE_JA_VISTA, '1')
  } catch {
    // Sem armazenamento, o selo só volta na próxima vez.
  }
}

function plural(quantos: number, um: string, varios: string): string {
  return `${quantos} ${quantos === 1 ? um : varios}`
}

function seletor(atributo: string, valor: string): string {
  const escapado = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(valor) : valor.replace(/["\\]/g, '')
  return `[${atributo}="${escapado}"]`
}

type Edicao = { readonly id: string; readonly novo: boolean; readonly darData: boolean; readonly inicial: RascunhoDoEvento }

interface Aviso {
  readonly chave: number
  readonly texto: string
  readonly desfazer?: () => void
}

type Resultado = { readonly t: 'mudou'; readonly antes: Tempo; readonly depois: Tempo } | { readonly t: 'igual' } | { readonly t: 'falhou' }

function rascunhoDe(evento: Evento): RascunhoDoEvento {
  return {
    titulo: evento.titulo,
    era: evento.quando.era,
    ano: evento.quando.era === '' ? '' : String(evento.quando.ano),
    mes: evento.quando.mes === undefined ? '' : String(evento.quando.mes),
    dia: evento.quando.dia === undefined ? '' : String(evento.quando.dia),
    resumo: evento.resumo,
    sessaoId: evento.sessaoId ?? '',
    segredo: evento.segredo,
  }
}

/** O nome da era: Enter ou sair do campo grava, Esc desiste; vazio desiste. */
function CampoDaEra({ inicial, aoTerminar }: { inicial: string; aoTerminar: (nome: string | null) => void }) {
  const terminou = useRef(false)
  const terminar = (nome: string | null) => {
    if (terminou.current) return
    terminou.current = true
    aoTerminar(nome === null || nome.trim() === '' ? null : nome.trim())
  }
  return (
    <input
      className="lt-era__entrada"
      defaultValue={inicial}
      aria-label="Nome da era"
      maxLength={LIMITE_DO_NOME_DA_ERA}
      autoFocus
      onFocus={(evento) => evento.currentTarget.select()}
      onBlur={(evento) => terminar(evento.currentTarget.value)}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter') {
          evento.preventDefault()
          terminar(evento.currentTarget.value)
        } else if (evento.key === 'Escape') {
          evento.preventDefault()
          evento.stopPropagation()
          terminar(null)
        }
      }}
    />
  )
}

export function LinhaDoTempo() {
  const tempoNaTela = usePreludio((estado) => estado.tempo)
  const avisoDoDisco = usePreludio((estado) => estado.avisoDoTempo)
  const dispensarAvisoDoDisco = usePreludio((estado) => estado.dispensarAvisoDoTempo)
  const mudarLinhaDoTempo = usePreludio((estado) => estado.mudarLinhaDoTempo)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const campanhaDoFiltro = usePreludio((estado) => estado.campanhaId)
  const escolherCampanha = usePreludio((estado) => estado.escolherCampanha)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const travado = usePreludio((estado) => estado.travado)
  const ir = usePreludio((estado) => estado.ir)

  const tempo = tempoNaTela.tempo
  const editavel = tempo !== null && tempoNaTela.soLeitura === null && !travado
  const campanhaDaSessao = useMemo(() => campanhaDaSessaoEm(verbetes), [verbetes])
  const comDados = useMemo(() => (tempo === null ? new Set<string>() : campanhasComDados(tempo, campanhaDaSessao)), [tempo, campanhaDaSessao])
  const mostraSemCampanha = campanhas.length === 0 || comDados.has(SEM_CAMPANHA)
  const [verSemCampanha, setVerSemCampanha] = useState(false)
  const campanha = campanhaDoFiltro ?? (verSemCampanha && mostraSemCampanha ? SEM_CAMPANHA : (campanhas[0]?.id ?? SEM_CAMPANHA))
  const nomeDaCampanha = campanha === SEM_CAMPANHA ? 'sem campanha' : (campanhas.find((uma) => uma.id === campanha)?.nome ?? 'uma campanha que não existe mais')

  const [comSegredos, setComSegredos] = useState(true)
  const linha: LinhaDaCampanha | null = useMemo(() => (tempo === null ? null : linhaDaCampanha(tempo, campanha, campanhaDaSessao, comSegredos)), [tempo, campanha, campanhaDaSessao, comSegredos])
  const sessoes = useMemo(() => sessoesEmOrdem(verbetes.values(), campanha === SEM_CAMPANHA ? null : campanha), [verbetes, campanha])

  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [criandoEra, setCriandoEra] = useState(false)
  const [chegou, setChegou] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const raiz = useRef<HTMLDivElement>(null)
  const focarDepois = useRef<string | null>(null)
  const contaDosAvisos = useRef(0)

  useLayoutEffect(() => {
    marcarComoVista()
  }, [])

  // Depois de mover, salvar ou desistir, o foco volta ao que a pessoa estava usando (o cartão pode ter trocado de ano e nascido de novo).
  useLayoutEffect(() => {
    const alvo = focarDepois.current
    if (alvo === null || raiz.current === null) return
    const elemento = raiz.current.querySelector<HTMLElement>(alvo)
    if (elemento === null) return
    focarDepois.current = null
    elemento.focus({ preventScroll: true })
    elemento.scrollIntoView({ block: 'nearest' })
  })

  // Trocou de campanha: a edição aberta era da outra linha.
  const [campanhaVista, setCampanhaVista] = useState(campanha)
  if (campanhaVista !== campanha) {
    setCampanhaVista(campanha)
    setEdicao(null)
    setRenomeando(null)
    setCriandoEra(false)
  }

  const avisar = useCallback((texto: string, desfazer?: () => void) => {
    contaDosAvisos.current += 1
    setAviso({ chave: contaDosAvisos.current, texto, ...(desfazer === undefined ? {} : { desfazer }) })
  }, [])

  /** Muda e espera o disco: só depois disso o aviso diz que mudou (se não gravou, a tela já voltou e o aviso do disco aparece). */
  const mudar = useCallback(
    async (fazer: (tempo: Tempo) => Tempo): Promise<Resultado> => {
      const antes = usePreludio.getState().tempo.tempo
      if (antes === null) return { t: 'falhou' }
      await mudarLinhaDoTempo(fazer)
      const estado = usePreludio.getState()
      if (estado.avisoDoTempo !== null) return { t: 'falhou' }
      const depois = estado.tempo.tempo
      return depois === null || depois === antes ? { t: 'igual' } : { t: 'mudou', antes, depois }
    },
    [mudarLinhaDoTempo],
  )

  /** O Desfazer: volta ao de antes só se nada mudou depois (a outra janela, outro clique). */
  const desfazerPara = useCallback(
    (antes: Tempo, depois: Tempo) => () => {
      if (usePreludio.getState().tempo.tempo !== depois) {
        avisar('Não deu para desfazer: a linha do tempo mudou depois disso.')
        return
      }
      void mudarLinhaDoTempo(() => antes)
    },
    [avisar, mudarLinhaDoTempo],
  )

  const tituloDe = (eventoId: string) => tempo?.eventos.find((evento) => evento.id === eventoId)?.titulo || 'Evento sem título'

  const { aoApertar } = useArrastoNaLinha({
    tituloDe,
    anunciar: setAnuncio,
    rolagem: () => raiz.current?.closest<HTMLElement>('.pr-palco') ?? null,
    aoSoltar: (eventoId: string, destino: DestinoDoEvento) => {
      const titulo = tituloDe(eventoId)
      void mudar((agora) => comEventoMovido(agora, eventoId, destino, campanha, campanhaDaSessao)).then((resultado) => {
        if (resultado.t !== 'mudou') {
          if (resultado.t === 'igual') setAnuncio('Ficou onde estava.')
          return
        }
        setChegou(eventoId)
        focarDepois.current = seletor('data-alca', eventoId)
        avisar(destino.t === 'bandeja' ? `"${titulo}" voltou para a bandeja, sem data.` : `"${titulo}" está em ${destino.ano}.`, desfazerPara(resultado.antes, resultado.depois))
      })
    },
  })

  const aoTeclarAlca = (eventoId: string, evento: KeyboardEvent<HTMLButtonElement>) => {
    if (!evento.altKey || evento.ctrlKey || evento.metaKey || (evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown')) return
    evento.preventDefault()
    if (tempo === null || linha === null || !linha.emOrdem.some((um) => um.id === eventoId)) return
    const direcao = evento.key === 'ArrowUp' ? -1 : 1
    if (comEventoNaTecla(tempo, eventoId, direcao, linha, campanha, campanhaDaSessao) === null) {
      setAnuncio(direcao < 0 ? 'Já é o primeiro evento.' : 'Já é o último evento.')
      return
    }
    focarDepois.current = seletor('data-alca', eventoId)
    const titulo = tituloDe(eventoId)
    // Sobre o tempo de agora (pode ter mudado desde o desenho): sem animação, a tecla é rápida e repetida.
    void mudar((agora) => comEventoNaTecla(agora, eventoId, direcao, linhaDaCampanha(agora, campanha, campanhaDaSessao, comSegredos), campanha, campanhaDaSessao) ?? agora).then((resultado) => {
      if (resultado.t !== 'mudou') return
      const novaLinha = linhaDaCampanha(resultado.depois, campanha, campanhaDaSessao, comSegredos)
      const doAno = novaLinha.eras.flatMap((era) => era.anos).find((ano) => ano.eventos.some((um) => um.id === eventoId))
      if (doAno === undefined) return
      const posicao = doAno.eventos.findIndex((um) => um.id === eventoId) + 1
      setAnuncio(`${titulo}: ${doAno.ano}, ${posicao} de ${doAno.eventos.length}.`)
    })
  }

  const ultimaEra = linha?.eras[linha.eras.length - 1]
  const semEra = linha !== null && linha.eras.length === 0 ? 'Crie uma era com + Era antes de dar a data.' : null

  const abrir = (eventoId: string, darData: boolean) => {
    const evento = tempo?.eventos.find((um) => um.id === eventoId)
    if (evento === undefined) return
    const inicial = rascunhoDe(evento)
    setRenomeando(null)
    setEdicao({ id: eventoId, novo: false, darData, inicial: darData ? { ...inicial, era: ultimaEra?.era.id ?? '', ano: '', mes: '', dia: '' } : inicial })
  }

  const abrirNovo = () => {
    const ultimoAno = ultimaEra?.anos[ultimaEra.anos.length - 1]?.ano
    setRenomeando(null)
    setEdicao({
      id: idNovo('ev'),
      novo: true,
      darData: false,
      inicial: { titulo: '', era: ultimaEra?.era.id ?? '', ano: ultimoAno === undefined ? '' : String(ultimoAno), mes: '', dia: '', resumo: '', sessaoId: '', segredo: false },
    })
  }

  const fecharEdicao = (foco: string) => {
    setEdicao(null)
    focarDepois.current = foco
  }

  const cancelar = () => {
    if (edicao === null) return
    fecharEdicao(edicao.novo ? '[data-acao="novo-evento"]' : edicao.darData ? seletor('data-alca', edicao.id) : seletor('data-abrir', edicao.id))
  }

  const salvar = async (dados: DadosDoEvento): Promise<boolean> => {
    if (edicao === null) return false
    const { id, novo } = edicao
    const resultado = await mudar((agora) => comEventoSalvo(agora, id, dados, campanha, campanhaDaSessao))
    if (resultado.t === 'falhou') return false
    fecharEdicao(seletor('data-abrir', id))
    if (resultado.t === 'igual') return true
    setChegou(id)
    const onde = dados.era === '' ? (novo ? ' na bandeja' : '') : ` em ${dados.ano}`
    avisar(novo ? `Evento "${dados.titulo}" criado${onde}.` : `Evento "${dados.titulo}" salvo${onde}.`)
    return true
  }

  const apagar = () => {
    if (edicao === null || tempo === null) return
    const id = edicao.id
    const indice = tempo.eventos.findIndex((evento) => evento.id === id)
    const evento = tempo.eventos[indice]
    if (evento === undefined) return
    void mudar((agora) => semEvento(agora, id)).then((resultado) => {
      if (resultado.t === 'falhou') return
      fecharEdicao('[data-acao="novo-evento"]')
      avisar(`Evento "${evento.titulo || 'sem título'}" apagado.`, () => void mudarLinhaDoTempo((agora) => comEventoDeVolta(agora, evento, indice)))
    })
  }

  const terminarEraNova = (nome: string | null) => {
    setCriandoEra(false)
    focarDepois.current = '[data-acao="nova-era"]'
    if (nome === null) return
    const id = idNovo('era')
    void mudar((agora) => comEraNova(agora, id, nome, campanha)).then((resultado) => {
      if (resultado.t === 'mudou') avisar(`Era "${nome}" criada no fim da linha.`)
    })
  }

  const terminarRenomear = (eraId: string, nome: string | null) => {
    setRenomeando(null)
    focarDepois.current = seletor('data-era-nome', eraId)
    if (nome !== null) void mudar((agora) => comEraRenomeada(agora, eraId, nome))
  }

  const irPara = (verbete: Verbete) => ir(lugarDoVerbete(verbete, verbetes))

  const escolher = (valor: string) => {
    if (valor === SEM_CAMPANHA) {
      setVerSemCampanha(true)
      escolherCampanha(null)
      return
    }
    setVerSemCampanha(false)
    escolherCampanha(valor)
  }

  const formulario = (aberta: Edicao) => (
    <FormularioDoEvento
      key={aberta.id}
      novo={aberta.novo}
      inicial={aberta.inicial}
      eras={linha?.eras.map((era) => era.era) ?? []}
      sessoes={sessoes}
      tituloDaSessao={(sessaoId) => verbetes.get(sessaoId)?.titulo}
      focarNoAno={aberta.darData}
      aoSalvar={salvar}
      aoCancelar={cancelar}
      {...(aberta.novo ? {} : { aoApagar: apagar })}
    />
  )

  const cartao = (evento: Evento, naBandeja: boolean) =>
    edicao?.id === evento.id && !edicao.novo ? (
      <li key={evento.id} className="lt-ev lt-ev--aberto" data-evento={evento.id}>
        {formulario(edicao)}
      </li>
    ) : (
      <CartaoDoEvento
        key={evento.id}
        evento={evento}
        naBandeja={naBandeja}
        editavel={editavel}
        chegou={chegou === evento.id}
        semEra={semEra}
        verbetes={verbetes}
        aoAbrir={(id) => abrir(id, false)}
        aoDarData={(id) => abrir(id, true)}
        aoApertarAlca={aoApertar}
        aoTeclarAlca={aoTeclarAlca}
        aoIr={irPara}
        aoAcenderAcabar={() => setChegou((agora) => (agora === evento.id ? null : agora))}
      />
    )

  const motivoParado = tempo === null ? (tempoNaTela.soLeitura ?? 'A linha do tempo ainda não abriu.') : tempoNaTela.soLeitura !== null ? tempoNaTela.soLeitura : travado ? 'O Prelúdio está gravando uma importação ou restauração; a linha do tempo volta a mudar quando ela terminar.' : null
  const datados = linha?.emOrdem.length ?? 0

  return (
    <div className="lt" ref={raiz}>
      <header className="lt-cab">
        <div>
          <h2 className="lt-cab__tit">Linha do tempo</h2>
          <p className="lt-cab__conta">
            {linha === null
              ? 'Não abriu.'
              : `${plural(datados, 'evento', 'eventos')} em ${plural(linha.eras.length, 'era', 'eras')} de ${nomeDaCampanha}${linha.escondidos > 0 ? `, ${plural(linha.escondidos, 'segredo escondido', 'segredos escondidos')}` : ''}`}
          </p>
        </div>
        <div className="lt-cab__acoes">
          <label className="lt-filtro">
            Campanha
            <select value={campanha} onChange={(evento) => escolher(evento.target.value)} disabled={campanhas.length === 0 && !mostraSemCampanha}>
              {campanhas.map((uma) => (
                <option key={uma.id} value={uma.id}>
                  {uma.nome}
                </option>
              ))}
              {mostraSemCampanha && <option value={SEM_CAMPANHA}>Sem campanha</option>}
            </select>
          </label>
          <button type="button" className="gr-bt gr-bt--p lt-bt-segredo" aria-pressed={comSegredos} title={comSegredos ? 'Esconder os eventos secretos' : 'Mostrar os eventos secretos'} onClick={() => setComSegredos((agora) => !agora)}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M1.8 10s3-5.5 8.2-5.5S18.2 10 18.2 10s-3 5.5-8.2 5.5S1.8 10 1.8 10z" />
              <circle cx="10" cy="10" r="2.4" />
            </svg>
            Segredos
          </button>
          <button type="button" className="gr-bt gr-bt--p" data-acao="nova-era" disabled={!editavel || criandoEra} onClick={() => setCriandoEra(true)}>
            + Era
          </button>
          <button type="button" className="gr-bt gr-bt--p gr-bt--latao" data-acao="novo-evento" disabled={!editavel || edicao?.novo === true} onClick={abrirNovo}>
            + Novo evento
          </button>
        </div>
      </header>

      {motivoParado !== null && (
        <p className="pr-aviso lt-aviso" role="note">
          {motivoParado}
        </p>
      )}
      {avisoDoDisco !== null && (
        <p className="pr-aviso lt-aviso lt-aviso--disco" role="alert">
          <span>{avisoDoDisco}</span>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={dispensarAvisoDoDisco}>
            Entendi
          </button>
        </p>
      )}

      {linha !== null && (
        <>
          <section className="lt-bandeja" data-solta-bandeja="" aria-labelledby="lt-bandeja-titulo">
            <div className="lt-bandeja__cab">
              <h3 className="lt-bandeja__tit" id="lt-bandeja-titulo">
                Chegaram das sessões, sem data
              </h3>
              {linha.bandeja.length > 0 && editavel && <span className="pr-quieto lt-bandeja__dica">{semEra ?? 'Arraste até o ano certo, ou use Dar data.'}</span>}
            </div>
            {linha.bandeja.length > 0 ? (
              <ul className="lt-bandeja__lista" aria-label="Eventos sem data">
                {linha.bandeja.map((evento) => cartao(evento, true))}
              </ul>
            ) : (
              <p className="lt-bandeja__vazia">Nada esperando. O que você mandar de uma sessão com "Para a linha do tempo" aparece aqui.</p>
            )}
          </section>

          {edicao?.novo === true && (
            <ul className="lt-novo">
              <li className="lt-ev lt-ev--aberto">{formulario(edicao)}</li>
            </ul>
          )}

          {linha.eras.length === 0 && !criandoEra && (
            <div className="lt-sem-eras">
              <p className="lt-sem-eras__texto">
                Nenhuma era ainda {campanha === SEM_CAMPANHA ? 'sem campanha' : `em ${nomeDaCampanha}`}. A era é o capítulo da história (Era dos Reis, Grande Era Pirata): o ano de cada evento conta dentro dela.
              </p>
              {editavel && (
                <button type="button" className="gr-bt gr-bt--p gr-bt--latao" onClick={() => setCriandoEra(true)}>
                  Criar a primeira era
                </button>
              )}
            </div>
          )}

          {linha.eras.map(({ era, anos }) => {
            const faixa = anos.length > 1 ? `${anos[0]?.ano} a ${anos[anos.length - 1]?.ano}` : anos.length === 1 ? String(anos[0]?.ano) : ''
            return (
              <section key={era.id} className="lt-era" aria-labelledby={`lt-era-${era.id}`}>
                <div className="lt-era__cab">
                  <h3 className="lt-era__nome" id={`lt-era-${era.id}`}>
                    {renomeando === era.id ? (
                      <CampoDaEra inicial={era.nome} aoTerminar={(nome) => terminarRenomear(era.id, nome)} />
                    ) : editavel ? (
                      <button type="button" className="lt-era__bt" data-era-nome={era.id} title="Renomear a era" onClick={() => setRenomeando(era.id)}>
                        {era.nome || 'Era sem nome'}
                      </button>
                    ) : (
                      era.nome || 'Era sem nome'
                    )}
                  </h3>
                  {faixa !== '' && <span className="lt-era__faixa">{faixa}</span>}
                </div>
                {anos.length === 0 && <p className="lt-era__vazia">Nenhum evento nesta era ainda. Use + Novo evento e escolha esta era, ou arraste um da bandeja até aqui depois de dar o ano.</p>}
                {anos.map(({ ano, eventos }) => (
                  <div key={ano} className="lt-ano" data-solta-ano={editavel ? '' : undefined} data-era={era.id} data-ano={ano}>
                    <div className="lt-ano__num" aria-hidden="true">
                      {ano}
                    </div>
                    <ul className="lt-ano__eventos" data-lista-do-ano="" aria-label={`Ano ${ano}`}>
                      {eventos.map((evento) => cartao(evento, false))}
                    </ul>
                  </div>
                ))}
              </section>
            )
          })}

          {criandoEra && (
            <section className="lt-era" aria-label="Era nova">
              <div className="lt-era__cab">
                <h3 className="lt-era__nome">
                  <CampoDaEra inicial={NOVA_ERA_PADRAO} aoTerminar={terminarEraNova} />
                </h3>
              </div>
              <p className="lt-era__vazia">Enter cria a era no fim da linha; Esc desiste.</p>
            </section>
          )}
        </>
      )}

      {aviso !== null && (
        <Torradas>
          <Torrada
            key={aviso.chave}
            mensagem={aviso.texto}
            acao={aviso.desfazer === undefined ? undefined : { rotulo: 'Desfazer', onClick: aviso.desfazer }}
            onFechar={() => setAviso((agora) => (agora?.chave === aviso.chave ? null : agora))}
          />
        </Torradas>
      )}
      <p className="pr-sr" role="status">
        {anuncio}
      </p>
    </div>
  )
}
