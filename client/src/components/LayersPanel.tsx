import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as PointerEventDoReact, type ReactNode } from 'react'
import type { CamadaId } from '../types/map'
import { contextoDeCamadas, type CamposDeCamadas } from '../lib/camadas/consulta'
import { NOME_DE_CAMADA_MAX, lerNomeDeCamada } from '../lib/camadas/arquivo'
import { MAX_CAMADAS_LIVRES, quantasLivres } from '../lib/camadas/modelo'
import { ehCamadaDeAntes, ehCamadaPadrao, ROTULOS_DAS_CAMADAS } from '../lib/camadas/padrao'
import { ChevronDownIcon, ChevronUpIcon, EyeIcon, EyeOffIcon, JogadoresIcon, JogadoresOcultosIcon, LockIcon, UnlockIcon } from './icons'
import './LayersPanel.css'

/**
 * Fatia 7: o que muda a LISTA (nomes e ordem, o modelo da aventura). Cada
 * chamada é um passo de Ctrl+Z. `criar` pode esperar (mapa solto pergunta antes
 * de virar aventura, onde a lista mora) e devolve o id da camada nova.
 */
export interface AcoesDoModelo {
  criar: (acimaDe?: CamadaId) => Promise<CamadaId | null>
  renomear: (id: CamadaId, nome: string) => void
  /** `destino`: índice na lista de BAIXO para CIMA. */
  mover: (id: CamadaId, destino: number) => void
  apagar: (id: CamadaId) => void
}

export interface LayersPanelProps {
  /** Os campos de camadas do mapa aberto (os dois olhos, cadeado, opacidade, versão, modelo). */
  camadas: CamposDeCamadas
  /** Itens por camada (`contarItensPorCamada`). Ausente = 0. Só informativo. */
  counts: Partial<Record<CamadaId, number>>
  /** Olho "Mestre vê". */
  onToggleLayer: (id: CamadaId) => void
  /** Olho "Jogadores veem". */
  onTogglePlayers: (id: CamadaId) => void
  onToggleLock: (id: CamadaId) => void
  /** Opacidade de 0 a 1. `gesto`: o mesmo valor do apertar ao soltar de um arrasto (um passo de Ctrl+Z por gesto). */
  onOpacity: (id: CamadaId, opacidade: number, gesto: string) => void
  /** Criar, renomear, ordenar e apagar. Ausente = a lista é só de leitura (sem alça nem "Nova camada"). */
  modelo?: AcoesDoModelo
  /** Linha de acesso rápido acima da lista (hoje: Mostrar grade / Grudar). */
  quickToggles?: ReactNode
  /** Aninhado na linha Chão: as camadas de pincel ("Camadas do chão"), com os controles de hoje. */
  chao?: ReactNode
  /** Aninhado na linha Telhados, só enquanto o mestre vê os telhados: o atalho "Transparente". */
  telhados?: ReactNode
}

/** Gestos do slider nesta sessão: cada arrasto (ou cada tecla) ganha um número novo. */
let ultimoGesto = 0
const novoGesto = (origem: 'arrasto' | 'tecla'): string => `${origem}-${(ultimoGesto += 1)}`

/** Distância (px) que o ponteiro anda na alça antes de o arrasto começar: um toque parado não mexe a lista. */
const LIMIAR_DO_ARRASTO = 4

/** O que a linha pede ao painel: referências ESTÁVEIS (a linha é `memo` e não re-renderiza por callback novo). */
interface AcoesDaLinha {
  olhoDoMestre: (id: CamadaId) => void
  olhoDosJogadores: (id: CamadaId) => void
  cadeado: (id: CamadaId) => void
  opacidade: (id: CamadaId, opacidade: number, gesto: string) => void
  /** Abre a linha (fechando a que estava aberta) ou fecha, se já era ela. */
  alternar: (id: CamadaId) => void
  fechar: (id: CamadaId) => void
  /** Um passo para cima (+1) ou para baixo (-1) na lista. */
  passo: (id: CamadaId, sentido: 1 | -1) => void
  editar: (id: CamadaId) => void
  /** `nome` null = desistiu (Esc): nada muda. */
  terminarEdicao: (id: CamadaId, nome: string | null) => void
  apagar: (id: CamadaId) => void
  pegar: (id: CamadaId, evento: PointerEventDoReact<HTMLElement>) => void
}

/** Só primitivos e as ações estáveis: arrastar a opacidade de UMA camada re-renderiza só a linha dela. */
interface LinhaProps {
  id: CamadaId
  rotulo: string
  conta: number
  mestreVe: boolean
  jogadoresVeem: boolean
  travada: boolean
  /** Opacidade em pontos de porcentagem (0 a 100). */
  pct: number
  /** Mapa de antes, nas 9 de antes: o olho do mestre some também para os jogadores (o tooltip avisa). */
  olhoParaTodos: boolean
  aberta: boolean
  /** Fatia 7: a lista pode mudar (há `modelo`). */
  ordenavel: boolean
  livre: boolean
  editando: boolean
  /** Posição de CIMA para BAIXO (0 = Telhados, por padrão) e o total: os extremos desligam Subir/Descer. */
  posicao: number
  total: number
  acoes: AcoesDaLinha
}

/** Os seis pontos da alça de arrastar. */
function Alca() {
  return (
    <svg width="8" height="16" viewBox="0 0 8 16" aria-hidden="true" focusable="false">
      {[3, 8, 13].map((y) => (
        <g key={y}>
          <circle cx="1.5" cy={y} r="1.2" fill="currentColor" />
          <circle cx="6.5" cy={y} r="1.2" fill="currentColor" />
        </g>
      ))}
    </svg>
  )
}

/** Quantos caracteres VISÍVEIS (o emoji conta 1, como no teto do nome). */
function contarVisiveis(texto: string): number {
  return Array.from(new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(texto)).length
}

/** O campo de renomear: nasce com o nome selecionado; Enter grava, Esc desiste, sair do campo grava. */
function CampoDoNome({ id, rotulo, acoes }: { id: CamadaId; rotulo: string; acoes: AcoesDaLinha }) {
  const campo = useRef<HTMLInputElement>(null)
  const terminou = useRef(false)
  const [valor, setValor] = useState(rotulo)
  const contadorId = useId()
  useLayoutEffect(() => {
    campo.current?.focus()
    campo.current?.select()
  }, [])
  const terminar = (nome: string | null) => {
    if (terminou.current) return
    terminou.current = true
    acoes.terminarEdicao(id, nome)
  }
  const visiveis = contarVisiveis(valor)
  return (
    <span className="lb-camadas__edicao">
      <input
        ref={campo}
        className="lb-camadas__campo"
        type="text"
        dir="auto"
        value={valor}
        // O teto de verdade é de caracteres VISÍVEIS (`lerNomeDeCamada`); este só segura colagem gigante.
        maxLength={NOME_DE_CAMADA_MAX * 4}
        aria-label={`Nome da camada ${rotulo}`}
        aria-describedby={contadorId}
        aria-invalid={visiveis > NOME_DE_CAMADA_MAX || undefined}
        onChange={(evento) => setValor(evento.currentTarget.value)}
        onBlur={() => terminar(valor)}
        onKeyDown={(evento) => {
          // Nada daqui segue para o mapa (Esc não larga a seleção, letra não troca de ferramenta).
          evento.stopPropagation()
          if (evento.key === 'Enter') {
            evento.preventDefault()
            terminar(valor)
          } else if (evento.key === 'Escape') {
            evento.preventDefault()
            terminar(null)
          }
        }}
      />
      <span className="lb-camadas__contador" id={contadorId} data-passou={visiveis > NOME_DE_CAMADA_MAX ? '' : undefined}>
        {visiveis > NOME_DE_CAMADA_MAX ? `Cabem ${NOME_DE_CAMADA_MAX}: o resto sai` : `${visiveis}/${NOME_DE_CAMADA_MAX}`}
      </span>
    </span>
  )
}

/**
 * Uma camada: o NOME é o botão que abre a linha (a opacidade, controle raro,
 * mora dentro), a contagem, o olho do mestre, o olho dos jogadores e o
 * cadeado. O texto da linha fechada é só nome e contagem (as jornadas leem
 * "Paredes 1"): a divisa e a alça são desenho e a porcentagem é `::after`.
 * Os três botões usam `aria-pressed` para o estado FORA do padrão (oculta,
 * escondida dos jogadores, travada) e o nome acessível diz a ação do próximo
 * clique. A ordem do DOM é a da leitura: nome, botões, e só então o miolo.
 *
 * Fatia 7: a alça (ponteiro) arrasta a linha; pelo teclado, "Subir" e
 * "Descer" no miolo. Camada livre ainda renomeia (duplo clique no nome ou
 * "Renomear") e apaga.
 */
const LinhaDaCamada = memo(function LinhaDaCamada(props: LinhaProps) {
  const { id, rotulo, conta, mestreVe, jogadoresVeem, travada, pct, olhoParaTodos, aberta, ordenavel, livre, editando, posicao, total, acoes } = props
  const gesto = useRef<string | null>(null)
  const nome = useRef<HTMLButtonElement>(null)
  const subir = useRef<HTMLButtonElement>(null)
  const descer = useRef<HTMLButtonElement>(null)
  /** O botão que andou com a linha: mover tira o nó do lugar (e o foco); ele volta no quadro seguinte. */
  const focarDepois = useRef<'subir' | 'descer' | 'nome' | null>(null)
  const editavaAntes = useRef(editando)
  const corpoId = useId()
  const notaId = useId()
  const olhoDoMestre = mestreVe ? `Ocultar ${rotulo}` : `Mostrar ${rotulo}`
  const olhoDosJogadores = jogadoresVeem ? `Ocultar ${rotulo} dos jogadores` : `Mostrar ${rotulo} aos jogadores`
  const ehATopo = posicao === 0
  const ehABase = posicao === total - 1

  useLayoutEffect(() => {
    const alvo = focarDepois.current
    focarDepois.current = null
    if (alvo === 'subir') (ehATopo ? descer : subir).current?.focus()
    else if (alvo === 'descer') (ehABase ? subir : descer).current?.focus()
  }, [posicao, ehATopo, ehABase])
  // Fim da edição: o foco volta ao nome (Enter ou Esc), não some para o corpo da página.
  useLayoutEffect(() => {
    if (editavaAntes.current && !editando && focarDepois.current === 'nome') {
      focarDepois.current = null
      nome.current?.focus()
    }
    editavaAntes.current = editando
  }, [editando])

  const soltar = () => {
    gesto.current = null
  }
  // Esc fecha a linha e devolve o foco ao nome; o Esc não segue para o mapa (não larga a seleção).
  const fecharComEsc = (evento: KeyboardEvent<HTMLElement>) => {
    if (evento.key !== 'Escape' || !aberta) return
    evento.preventDefault()
    evento.stopPropagation()
    acoes.fechar(id)
    nome.current?.focus()
  }
  const passo = (sentido: 1 | -1) => {
    focarDepois.current = sentido === 1 ? 'subir' : 'descer'
    acoes.passo(id, sentido)
  }
  return (
    <>
      <div className="lb-camadas__cabeca">
        {ordenavel && (
          // Só o ponteiro arrasta; o teclado e o leitor de tela usam "Subir"/"Descer" no miolo da linha.
          <span className="lb-camadas__alca" aria-hidden="true" title={`Arraste para mudar ${rotulo} de altura`} onPointerDown={(evento) => acoes.pegar(id, evento)}>
            <Alca />
          </span>
        )}
        {editando ? (
          <CampoDoNome
            id={id}
            rotulo={rotulo}
            acoes={{
              ...acoes,
              terminarEdicao: (alvo, novo) => {
                focarDepois.current = 'nome'
                acoes.terminarEdicao(alvo, novo)
              },
            }}
          />
        ) : (
          <button
            ref={nome}
            type="button"
            className="lb-camadas__nome"
            aria-expanded={aberta}
            aria-controls={corpoId}
            aria-label={`${rotulo}, opacidade`}
            title={livre && ordenavel ? `${rotulo} (duplo clique renomeia)` : rotulo}
            onClick={() => acoes.alternar(id)}
            onDoubleClick={livre && ordenavel ? () => acoes.editar(id) : undefined}
            onKeyDown={fecharComEsc}
          >
            <span className="lb-camadas__divisa" aria-hidden="true">
              <ChevronDownIcon size={12} />
            </span>
            <span className="lb-camadas__rotulo" dir="auto">
              {rotulo}
            </span>
          </button>
        )}
        <span className="lb-camadas__pct" data-pct={pct === 100 ? undefined : `${pct}%`} aria-hidden="true" />
        <span className="lb-num lb-layers__count lb-camadas__conta" data-zero={conta === 0 ? '' : undefined}>
          {conta}
        </span>
        <button
          type="button"
          className="lb-iconbtn lb-iconbtn--sm lb-camadas__bt"
          aria-pressed={!mestreVe}
          aria-label={olhoDoMestre}
          title={olhoParaTodos ? `${olhoDoMestre} (some também para os jogadores)` : `${olhoDoMestre} só para você`}
          onClick={() => acoes.olhoDoMestre(id)}
        >
          {mestreVe ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
        </button>
        <button
          type="button"
          className="lb-iconbtn lb-iconbtn--sm lb-camadas__bt"
          aria-pressed={!jogadoresVeem}
          aria-label={olhoDosJogadores}
          title={olhoDosJogadores}
          onClick={() => acoes.olhoDosJogadores(id)}
        >
          {jogadoresVeem ? <JogadoresIcon size={16} /> : <JogadoresOcultosIcon size={16} />}
        </button>
        <button
          type="button"
          className="lb-iconbtn lb-iconbtn--sm lb-camadas__bt"
          aria-pressed={travada}
          aria-label={travada ? `Destravar ${rotulo}` : `Travar ${rotulo}`}
          title={travada ? `Destravar ${rotulo}` : `Travar ${rotulo}`}
          onClick={() => acoes.cadeado(id)}
        >
          {travada ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
        </button>
      </div>
      {/* Fechada, a linha fica montada (a abertura anima como a ficha do Grimório) e `inert`: fora do Tab e do leitor. */}
      <div className="lb-camadas__corpo" id={corpoId} inert={!aberta} onKeyDown={fecharComEsc}>
        <div className="lb-camadas__miolo">
          <div className="lb-camadas__dentro">
            <input
              type="range"
              className="gr-faixa lb-camadas__faixa"
              min={0}
              max={100}
              step={1}
              value={pct}
              aria-label={`Opacidade de ${rotulo}`}
              aria-valuetext={`${pct}%`}
              aria-describedby={aberta ? notaId : undefined}
              // Fixo (não muda a cada quadro do arrasto): o valor está no `aria-valuetext` e no `::after` da linha.
              title={`Opacidade de ${rotulo} (0% some para todos)`}
              onPointerDown={() => {
                gesto.current = novoGesto('arrasto')
              }}
              onPointerUp={soltar}
              onPointerCancel={soltar}
              onBlur={soltar}
              onChange={(evento) => acoes.opacidade(id, Number(evento.currentTarget.value) / 100, gesto.current ?? novoGesto('tecla'))}
            />
            {/* Só com a linha aberta: fechada, o texto da linha continua só nome e contagem. */}
            {aberta && (
              <span className="lb-camadas__nota" id={notaId}>
                Para você e para os jogadores
              </span>
            )}
            {/* Também só com a linha aberta: fechada, o texto da linha é só nome e contagem (as jornadas leem "Paredes 1"). */}
            {ordenavel && aberta && (
              <div className="lb-camadas__acoes" role="group" aria-label={`Lista: ${rotulo}`}>
                <button ref={subir} type="button" className="lb-camadas__acao" aria-label={`Subir ${rotulo}`} title="Desenha por cima da camada de cima" disabled={ehATopo} onClick={() => passo(1)}>
                  <ChevronUpIcon size={14} />
                  Subir
                </button>
                <button ref={descer} type="button" className="lb-camadas__acao" aria-label={`Descer ${rotulo}`} title="Desenha por baixo da camada de baixo" disabled={ehABase} onClick={() => passo(-1)}>
                  <ChevronDownIcon size={14} />
                  Descer
                </button>
                {livre && (
                  <>
                    <button type="button" className="lb-camadas__acao" aria-label={`Renomear ${rotulo}`} onClick={() => acoes.editar(id)}>
                      Renomear
                    </button>
                    <button type="button" className="lb-camadas__acao lb-camadas__acao--apagar" aria-label={`Apagar a camada ${rotulo}`} title="Os itens dela voltam à camada padrão (Ctrl+Z desfaz)" onClick={() => acoes.apagar(id)}>
                      Apagar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
})

/** O nome da linha: um dos 13 rótulos, ou o da camada livre no modelo. */
function rotuloDe(id: CamadaId, camadas: CamposDeCamadas): string {
  if (ehCamadaPadrao(id)) return ROTULOS_DAS_CAMADAS[id]
  const nome = camadas.modeloCamadas?.ordem.find((def) => def.id === id)?.nome?.trim()
  return nome === undefined || nome === '' ? 'Sem nome' : nome
}

/** O arrasto de uma linha pela alça, fora do React: estilo direto por quadro, um `mover` ao soltar. */
interface Arrasto {
  id: CamadaId
  ponteiro: number
  alca: HTMLElement
  inicioY: number
  /** As linhas de CIMA para BAIXO e o meio de cada uma, medidos ao pegar. */
  linhas: HTMLElement[]
  meios: number[]
  de: number
  para: number
  /** O destino que as vizinhas já mostram: elas só mudam quando o destino muda, não a cada movimento. */
  pintado: number
  altura: number
  andou: boolean
}

/**
 * CAMADAS (fase 3, fatias 6 e 7): as camadas na ordem da lista, de CIMA para
 * BAIXO = da que desenha por cima (Telhados) à de baixo (Chão). Cada linha
 * tem os dois olhos e o cadeado à vista; a opacidade abre pelo nome (uma
 * linha aberta por vez). A linha Chão leva aninhadas as camadas de pincel, e
 * a de Telhados o atalho "Transparente" do mestre. Com `modelo`, a lista
 * muda: alça de arrastar, Subir/Descer, "Nova camada", renomear e apagar.
 *
 * Só apresentação: quem responde por cada camada é `contextoDeCamadas` (o
 * ponto único); este componente lê e emite o pedido. O título e o abre/fecha
 * ficam com quem envolve (a ficha "Camadas" da página Cena).
 */
export function LayersPanel(props: LayersPanelProps) {
  const { camadas, counts, quickToggles, chao, telhados, modelo } = props
  const contexto = contextoDeCamadas(camadas)
  const deCimaParaBaixo = [...contexto.ordem].reverse()
  const mapaDeAntes = camadas.versaoDasCamadas !== 2
  const [aberta, setAberta] = useState<CamadaId | null>(null)
  const [editando, setEditando] = useState<CamadaId | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const [arrastando, setArrastando] = useState<CamadaId | null>(null)
  const lista = useRef<HTMLUListElement>(null)
  const arrasto = useRef<Arrasto | null>(null)
  const ordenavel = modelo !== undefined
  const noTeto = quantasLivres(camadas) >= MAX_CAMADAS_LIVRES

  // Quem envolve passa callbacks novos a cada render: a linha recebe ações estáveis que chamam as de AGORA.
  const atuais = useRef(props)
  useLayoutEffect(() => {
    atuais.current = props
  })

  const acoes = useMemo<AcoesDaLinha>(() => {
    /** A lista de AGORA, de baixo para cima (o arrasto e o passo leem no momento do gesto). */
    const ordemAgora = (): readonly CamadaId[] => contextoDeCamadas(atuais.current.camadas).ordem
    const anunciar = (id: CamadaId, destino: number) => {
      const total = ordemAgora().length
      setAnuncio(`${rotuloDe(id, atuais.current.camadas)}: posição ${total - destino} de ${total}`)
    }
    const mover = (id: CamadaId, destino: number) => {
      atuais.current.modelo?.mover(id, destino)
      anunciar(id, destino)
    }
    /** Os vizinhos abrem espaço; a linha pega segue o ponteiro. Só `transform`, sem React por quadro. */
    const pintarArrasto = (a: Arrasto, dy: number) => {
      a.linhas[a.de].style.transform = `translateY(${dy}px)`
      if (a.para === a.pintado) return
      a.pintado = a.para
      a.linhas.forEach((li, i) => {
        if (i === a.de) return
        if (a.de < a.para && i > a.de && i <= a.para) li.style.transform = `translateY(${-a.altura}px)`
        else if (a.de > a.para && i < a.de && i >= a.para) li.style.transform = `translateY(${a.altura}px)`
        else li.style.transform = ''
      })
    }
    const encerrar = (a: Arrasto, confirmar: boolean) => {
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoCancelar)
      window.removeEventListener('keydown', aoTeclar, true)
      if (a.alca.hasPointerCapture(a.ponteiro)) a.alca.releasePointerCapture(a.ponteiro)
      arrasto.current = null
      setArrastando(null)
      // Tirar os deslocamentos e mudar a ordem no MESMO quadro: a linha já está onde vai ficar.
      for (const li of a.linhas) li.style.transform = ''
      if (confirmar && a.andou && a.para !== a.de) mover(a.id, a.linhas.length - 1 - a.para)
    }
    function aoMover(evento: PointerEvent) {
      const a = arrasto.current
      if (a === null || evento.pointerId !== a.ponteiro) return
      const dy = evento.clientY - a.inicioY
      if (!a.andou) {
        if (Math.abs(dy) < LIMIAR_DO_ARRASTO) return
        a.andou = true
        setArrastando(a.id)
      }
      // O destino é a linha cujo meio o ponteiro passou (medido ao pegar, antes de qualquer deslocamento).
      // Posição nova = quantas das OUTRAS linhas têm o meio acima do meio da linha pega.
      const y = a.meios[a.de] + dy
      a.para = a.meios.filter((meio, i) => i !== a.de && meio < y).length
      pintarArrasto(a, dy)
    }
    function aoSoltar(evento: PointerEvent) {
      const a = arrasto.current
      if (a !== null && evento.pointerId === a.ponteiro) encerrar(a, true)
    }
    function aoCancelar(evento: PointerEvent) {
      const a = arrasto.current
      if (a !== null && evento.pointerId === a.ponteiro) encerrar(a, false)
    }
    // Esc desiste do arrasto: a linha volta e nada muda (e o Esc não segue para o mapa).
    function aoTeclar(evento: globalThis.KeyboardEvent) {
      const a = arrasto.current
      if (a === null || evento.key !== 'Escape') return
      evento.preventDefault()
      evento.stopPropagation()
      encerrar(a, false)
    }
    return {
      olhoDoMestre: (id) => atuais.current.onToggleLayer(id),
      olhoDosJogadores: (id) => atuais.current.onTogglePlayers(id),
      cadeado: (id) => atuais.current.onToggleLock(id),
      opacidade: (id, opacidade, gesto) => atuais.current.onOpacity(id, opacidade, gesto),
      alternar: (id) => setAberta((atual) => (atual === id ? null : id)),
      fechar: (id) => setAberta((atual) => (atual === id ? null : atual)),
      passo: (id, sentido) => {
        const de = ordemAgora().indexOf(id)
        if (de !== -1) mover(id, de + sentido)
      },
      editar: (id) => setEditando(id),
      terminarEdicao: (id, nome) => {
        setEditando(null)
        if (nome !== null && lerNomeDeCamada(nome) !== undefined) atuais.current.modelo?.renomear(id, nome)
      },
      apagar: (id) => {
        setAberta((atual) => (atual === id ? null : atual))
        atuais.current.modelo?.apagar(id)
      },
      pegar: (id, evento) => {
        // Só o botão principal (ou o dedo/caneta); um arrasto por vez.
        if (arrasto.current !== null || evento.button !== 0 || lista.current === null) return
        evento.preventDefault()
        const linhas = Array.from(lista.current.querySelectorAll<HTMLElement>(':scope > li[data-camada]'))
        const de = linhas.findIndex((li) => li.dataset.camada === id)
        if (de === -1) return
        const caixas = linhas.map((li) => li.getBoundingClientRect())
        const gap = linhas.length > 1 ? caixas[1].top - caixas[0].bottom : 0
        evento.currentTarget.setPointerCapture(evento.pointerId)
        arrasto.current = {
          id,
          ponteiro: evento.pointerId,
          alca: evento.currentTarget,
          inicioY: evento.clientY,
          linhas,
          meios: caixas.map((c) => c.top + c.height / 2),
          de,
          para: de,
          pintado: de,
          altura: caixas[de].height + gap,
          andou: false,
        }
        window.addEventListener('pointermove', aoMover)
        window.addEventListener('pointerup', aoSoltar)
        window.addEventListener('pointercancel', aoCancelar)
        window.addEventListener('keydown', aoTeclar, true)
      },
    }
  }, [])

  // Painel que sai no meio de um arrasto (troca de página do livro): nada fica preso à janela.
  useEffect(
    () => () => {
      const a = arrasto.current
      if (a !== null) for (const li of a.linhas) li.style.transform = ''
      arrasto.current = null
    },
    [],
  )

  const criar = () => {
    void modelo?.criar(aberta ?? undefined).then((id) => {
      if (id === null) return
      setAberta(null)
      setEditando(id)
      setAnuncio('Camada nova criada: escreva o nome')
    })
  }

  return (
    <>
      {quickToggles}
      {/* A chave dos ícones: os dois olhos da linha não são iguais, e aqui se diz qual é qual. */}
      <p className="lb-camadas__legenda">
        <span className="lb-camadas__chave">
          <EyeIcon size={14} />
          Você vê
        </span>
        <span className="lb-camadas__chave">
          <JogadoresIcon size={14} />
          Jogadores veem
        </span>
        <span className="lb-camadas__chave">
          <UnlockIcon size={14} />
          Trava
        </span>
      </p>
      <ul ref={lista} className="lb-layers lb-camadas" aria-label="Camadas do mapa" data-arrastando={arrastando === null ? undefined : ''}>
        {deCimaParaBaixo.map((id, posicao) => {
          const mestreVe = contexto.mestreVe(id)
          const pct = Math.round(contexto.alfa(id) * 100)
          const aninhado = id === 'chao' ? chao : id === 'telhados' && mestreVe ? telhados : undefined
          return (
            <li
              key={id}
              className="lb-layers__row lb-camadas__linha"
              data-camada={id}
              data-hidden={mestreVe ? undefined : ''}
              data-esmaecida={pct < 100 ? '' : undefined}
              data-aberta={aberta === id ? '' : undefined}
              data-arrastada={arrastando === id ? '' : undefined}
            >
              <LinhaDaCamada
                id={id}
                rotulo={rotuloDe(id, camadas)}
                conta={counts[id] ?? 0}
                mestreVe={mestreVe}
                jogadoresVeem={contexto.jogadorVe(id)}
                travada={contexto.travada(id)}
                pct={pct}
                olhoParaTodos={mapaDeAntes && ehCamadaDeAntes(id) && camadas.ocultasDoJogador === undefined}
                aberta={aberta === id}
                ordenavel={ordenavel}
                livre={!ehCamadaPadrao(id)}
                editando={editando === id}
                posicao={posicao}
                total={deCimaParaBaixo.length}
                acoes={acoes}
              />
              {aninhado !== undefined && <div className="lb-camadas__aninhado">{aninhado}</div>}
            </li>
          )
        })}
      </ul>
      {ordenavel && (
        <div className="lb-camadas__rodape">
          <button type="button" className="lb-btn lb-camadas__nova" onClick={criar} disabled={noTeto} aria-describedby={noTeto ? 'lb-camadas-teto' : undefined}>
            + Nova camada
          </button>
          {noTeto && (
            <span className="lb-camadas__nota" id="lb-camadas-teto">
              Limite de {MAX_CAMADAS_LIVRES} camadas novas: apague uma para criar outra.
            </span>
          )}
        </div>
      )}
      <p className="lb-sr-only" aria-live="polite">
        {anuncio}
      </p>
    </>
  )
}
