import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as PointerEventDoReact, type ReactNode } from 'react'
import type { CamadaId } from '../types/map'
import { contextoDeCamadas, type CamposDeCamadas } from '../lib/camadas/consulta'
import { NOME_DE_CAMADA_MAX, PONTOS_POR_CARACTERE_MAX, grafemas, lerNomeDeCamada } from '../lib/camadas/arquivo'
import { MAX_CAMADAS_LIVRES, camadasApagadasEscondidas, quantasLivres } from '../lib/camadas/modelo'
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
/** Soltar: a linha assenta na vaga nova (só `transform`). */
const ASSENTAR_AO_SOLTAR_MS = 150
/** Esc ou cancelar: a linha volta ao lugar, um pouco mais devagar (andou mais). */
const VOLTAR_AO_LUGAR_MS = 200
/** As vizinhas voltam com a transição de 180 ms do CSS: `data-arrastando` fica até elas chegarem. */
const VIZINHAS_VOLTAM_MS = 180
const CURVA_DE_SAIDA = 'cubic-bezier(0.23, 1, 0.32, 1)'
/** Além da primeira e da última vaga, a linha anda 30% do ponteiro (resiste em vez de bater numa parede). */
const RESISTENCIA_NA_PONTA = 0.3
/** Ponteiro a esta distância (px) da borda do livro rola o livro, até `ROLAGEM_MAX` px por quadro. */
const BORDA_QUE_ROLA = 32
const ROLAGEM_MAX = 12
/** O campo do nome aceita até o dobro do teto (o contador mostra "49/40"); acima disso é colagem gigante. */
const TETO_DO_CAMPO = NOME_DE_CAMADA_MAX * 2

const movimentoReduzido = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** FLIP: a linha sai de onde estava (`delta` px acima/abaixo) e assenta. Sem deslocamento (ou sem WAAPI), nada. */
function assentar(li: HTMLElement, delta: number, duracao: number): Animation | null {
  if (Math.abs(delta) < 0.5 || typeof li.animate !== 'function') return null
  return li.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: duracao, easing: CURVA_DE_SAIDA })
}

/** O ancestral que rola (o livro do mestre); `null` se nada rola. */
function rolagemDe(el: HTMLElement): HTMLElement | null {
  for (let pai = el.parentElement; pai !== null; pai = pai.parentElement) {
    const { overflowY } = getComputedStyle(pai)
    if ((overflowY === 'auto' || overflowY === 'scroll') && pai.scrollHeight > pai.clientHeight) return pai
  }
  return null
}

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
  /** O nome recusado na última edição e o motivo (só camada livre); some no próximo gesto. */
  recusa: string | undefined
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

/** O campo de renomear: nasce com o nome selecionado; Enter grava, Esc desiste, sair do campo grava. */
function CampoDoNome({ id, rotulo, acoes }: { id: CamadaId; rotulo: string; acoes: AcoesDaLinha }) {
  const campo = useRef<HTMLInputElement>(null)
  const terminou = useRef(false)
  const [valor, setValor] = useState(rotulo)
  const contadorId = useId()
  const passouId = useId()
  useLayoutEffect(() => {
    campo.current?.focus()
    campo.current?.select()
  }, [])
  const terminar = (nome: string | null) => {
    if (terminou.current) return
    terminou.current = true
    acoes.terminarEdicao(id, nome)
  }
  // Caracteres VISÍVEIS (o emoji conta 1, como no teto do nome).
  const visiveis = grafemas(valor).length
  const passou = visiveis > NOME_DE_CAMADA_MAX
  return (
    <span className="lb-camadas__edicao">
      <input
        ref={campo}
        className="lb-camadas__campo"
        type="text"
        dir="auto"
        value={valor}
        // O teto de verdade é de caracteres VISÍVEIS (`lerNomeDeCamada`, e o `onChange` em grafemas); este só segura
        // colagem gigante, com folga para o dobro do teto no maior caractere aceito (pontos de código em UTF-16).
        maxLength={TETO_DO_CAMPO * PONTOS_POR_CARACTERE_MAX * 2}
        aria-label={`Nome da camada ${rotulo}`}
        aria-describedby={passou ? `${contadorId} ${passouId}` : contadorId}
        aria-invalid={passou || undefined}
        onChange={(evento) => {
          const texto = evento.currentTarget.value
          const partes = grafemas(texto)
          setValor(partes.length > TETO_DO_CAMPO ? partes.slice(0, TETO_DO_CAMPO).join('') : texto)
        }}
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
      {/* Sempre "n/40" (passou: em latão), com largura fixa: o campo não encolhe. A frase vai ao leitor de tela. */}
      <span className="lb-camadas__contador" id={contadorId} data-passou={passou ? '' : undefined}>
        {`${visiveis}/${NOME_DE_CAMADA_MAX}`}
      </span>
      {passou && (
        <span className="lb-sr-only" id={passouId}>
          Cabem {NOME_DE_CAMADA_MAX}: o resto sai
        </span>
      )}
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
  const { id, rotulo, conta, mestreVe, jogadoresVeem, travada, pct, olhoParaTodos, aberta, ordenavel, livre, editando, posicao, total, recusa, acoes } = props
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
          <span className="lb-camadas__alca" aria-hidden="true" title={`Arraste para pôr ${rotulo} por cima ou por baixo`} onPointerDown={(evento) => acoes.pegar(id, evento)}>
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
            onClick={(evento) => {
              // O 2º clique do duplo (renomear) não fecha a linha que o 1º abriu.
              if (evento.detail > 1 && livre && ordenavel) return
              acoes.alternar(id)
            }}
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
      {recusa !== undefined && (
        <p className="lb-camadas__recusa" role="status">
          {recusa}
        </p>
      )}
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
              <div className="lb-camadas__acoes" role="group" aria-label={`Ordem e nome de ${rotulo}`}>
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
  /** A lista ao pegar: mudou no meio (Ctrl+Z), e soltar não move com índice velho. */
  ordem: string
  /** O último Y do ponteiro (a rolagem automática recalcula com ele). */
  ultimoY: number
  /** O livro que rola, onde estava ao pegar e a caixa dele. */
  rolagem: HTMLElement | null
  rolagemInicial: number
  caixaDaRolagem: { top: number; bottom: number }
  /** O quadro da rolagem automática em curso. */
  quadro: number | null
}

/** Depois de soltar, o quadro seguinte ao da ordem nova: a linha sai de `topo` e assenta. */
interface Pouso {
  id: CamadaId
  topo: number
  /** A lista ao pegar: se ainda é ela, a ordem nova não chegou (mapa solto perguntando) e a linha volta ao lugar. */
  ordem: string
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
  /** A linha que acabou de ser solta e ainda assenta: continua levantada (fundo e sombra) até pousar. */
  const [pousando, setPousando] = useState<CamadaId | null>(null)
  /** Nome recusado (sem caractere que se veja): a linha diz o motivo até o próximo gesto. */
  const [recusa, setRecusa] = useState<{ id: CamadaId; texto: string } | null>(null)
  const lista = useRef<HTMLUListElement>(null)
  const arrasto = useRef<Arrasto | null>(null)
  const pouso = useRef<Pouso | null>(null)
  const vizinhasVoltando = useRef<number | null>(null)
  /** Depois de apagar: o foco vai ao nome da vizinha (a de baixo; a de cima se era a última), não ao corpo da página. */
  const focoDepoisDeApagar = useRef<{ apagada: CamadaId; vizinha: CamadaId | undefined } | null>(null)
  const ordenavel = modelo !== undefined
  const noTeto = quantasLivres(camadas) >= MAX_CAMADAS_LIVRES
  const apagadas = camadasApagadasEscondidas(camadas)

  // Quem envolve passa callbacks novos a cada render: a linha recebe ações estáveis que chamam as de AGORA.
  const atuais = useRef(props)
  useLayoutEffect(() => {
    atuais.current = props
  })

  // Depois do quadro que trouxe a ordem nova (ou o "apagar"): FLIP da linha solta e o foco da vizinha.
  useLayoutEffect(() => {
    const p = pouso.current
    if (p !== null) {
      pouso.current = null
      const pousou = () => setPousando((atual) => (atual === p.id ? null : atual))
      const li = lista.current?.querySelector<HTMLElement>(`:scope > li[data-camada="${p.id}"]`) ?? null
      // A ordem nova ainda não chegou (o mapa solto pergunta antes): a linha volta ao lugar de onde saiu.
      const voltou = contextoDeCamadas(camadas).ordem.join(',') === p.ordem
      const animacao = li === null ? null : assentar(li, p.topo - li.getBoundingClientRect().top, voltou ? VOLTAR_AO_LUGAR_MS : ASSENTAR_AO_SOLTAR_MS)
      if (animacao === null) pousou()
      else animacao.finished.then(pousou, pousou)
    }
    const foco = focoDepoisDeApagar.current
    if (foco !== null && !contextoDeCamadas(camadas).ordem.includes(foco.apagada)) {
      focoDepoisDeApagar.current = null
      if (foco.vizinha !== undefined) lista.current?.querySelector<HTMLElement>(`:scope > li[data-camada="${foco.vizinha}"] .lb-camadas__nome`)?.focus()
    }
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
    /** As vizinhas voltam ao lugar com a transição do CSS, que só vale com `data-arrastando`: ele sai depois delas. */
    const soltarAsVizinhasDepois = () => {
      if (vizinhasVoltando.current !== null) window.clearTimeout(vizinhasVoltando.current)
      vizinhasVoltando.current = window.setTimeout(() => {
        vizinhasVoltando.current = null
        if (arrasto.current === null) setArrastando(null)
      }, VIZINHAS_VOLTAM_MS)
    }
    const encerrar = (a: Arrasto, confirmar: boolean) => {
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoCancelar)
      window.removeEventListener('keydown', aoTeclar, true)
      if (a.alca.hasPointerCapture(a.ponteiro)) a.alca.releasePointerCapture(a.ponteiro)
      if (a.quadro !== null) cancelAnimationFrame(a.quadro)
      arrasto.current = null
      const linha = a.linhas[a.de]
      // FLIP: onde a linha está AGORA (com o deslocamento do arrasto), antes de limpar.
      const topo = a.andou ? linha.getBoundingClientRect().top : 0
      // Ctrl+Z no meio do arrasto mudou a lista: o índice de agora é velho, e soltar não move nada.
      const listaMudou = ordemAgora().join(',') !== a.ordem
      const move = confirmar && a.andou && a.para !== a.de && !listaMudou
      for (const li of a.linhas) li.style.transform = ''
      const reduzido = movimentoReduzido()
      if (move) {
        // Tirar os deslocamentos e mudar a ordem no MESMO quadro; a linha sai de onde estava e assenta (efeito acima).
        setArrastando(null)
        if (!reduzido) {
          pouso.current = { id: a.id, topo, ordem: a.ordem }
          setPousando(a.id)
        }
        mover(a.id, a.linhas.length - 1 - a.para)
        return
      }
      if (!a.andou || reduzido) {
        setArrastando(null)
        return
      }
      // Volta ao lugar (Esc, cancelado, soltou onde estava, lista mudou): a linha desliza de volta, as vizinhas também.
      assentar(linha, topo - linha.getBoundingClientRect().top, confirmar ? ASSENTAR_AO_SOLTAR_MS : VOLTAR_AO_LUGAR_MS)
      soltarAsVizinhasDepois()
    }
    /** A posição da linha pega para o ponteiro em `a.ultimoY` (e a rolagem andada desde o pegar). */
    const acompanhar = (a: Arrasto) => {
      const rolou = a.rolagem === null ? 0 : a.rolagem.scrollTop - a.rolagemInicial
      let dy = a.ultimoY - a.inicioY + rolou
      if (!a.andou) {
        if (Math.abs(dy) < LIMIAR_DO_ARRASTO) return
        a.andou = true
        setArrastando(a.id)
      }
      // Além da primeira e da última vaga, a linha resiste (anda 30% do que o ponteiro anda).
      const acima = a.meios[0] - a.meios[a.de]
      const abaixo = a.meios[a.meios.length - 1] - a.meios[a.de]
      if (dy < acima) dy = acima + (dy - acima) * RESISTENCIA_NA_PONTA
      else if (dy > abaixo) dy = abaixo + (dy - abaixo) * RESISTENCIA_NA_PONTA
      // O destino é a linha cujo meio o ponteiro passou (medido ao pegar, antes de qualquer deslocamento).
      // Posição nova = quantas das OUTRAS linhas têm o meio acima do meio da linha pega.
      const y = a.meios[a.de] + dy
      a.para = a.meios.filter((meio, i) => i !== a.de && meio < y).length
      pintarArrasto(a, dy)
    }
    /** Quanto o livro rola neste quadro: até 12 px, mais perto da borda mais rápido; 0 fora da faixa de 32 px. */
    const passoDaRolagem = (a: Arrasto): number => {
      if (a.rolagem === null || !a.andou) return 0
      const doTopo = a.ultimoY - a.caixaDaRolagem.top
      const daBase = a.caixaDaRolagem.bottom - a.ultimoY
      const forca = (distancia: number) => Math.max(1, Math.round(ROLAGEM_MAX * (1 - Math.max(0, distancia) / BORDA_QUE_ROLA)))
      if (doTopo < BORDA_QUE_ROLA) return -forca(doTopo)
      if (daBase < BORDA_QUE_ROLA) return forca(daBase)
      return 0
    }
    function rolarNaBorda(a: Arrasto) {
      a.quadro = null
      const passo = arrasto.current === a ? passoDaRolagem(a) : 0
      if (passo === 0 || a.rolagem === null) return
      const antes = a.rolagem.scrollTop
      a.rolagem.scrollTop = antes + passo
      if (a.rolagem.scrollTop !== antes) acompanhar(a)
      a.quadro = requestAnimationFrame(() => rolarNaBorda(a))
    }
    function aoMover(evento: PointerEvent) {
      const a = arrasto.current
      if (a === null || evento.pointerId !== a.ponteiro) return
      a.ultimoY = evento.clientY
      acompanhar(a)
      if (a.quadro === null && passoDaRolagem(a) !== 0) a.quadro = requestAnimationFrame(() => rolarNaBorda(a))
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
      alternar: (id) => {
        setRecusa(null)
        setAberta((atual) => (atual === id ? null : id))
      },
      fechar: (id) => setAberta((atual) => (atual === id ? null : atual)),
      passo: (id, sentido) => {
        const de = ordemAgora().indexOf(id)
        if (de !== -1) mover(id, de + sentido)
      },
      editar: (id) => {
        setRecusa(null)
        setEditando(id)
      },
      terminarEdicao: (id, nome) => {
        setEditando(null)
        if (nome === null) return
        if (lerNomeDeCamada(nome) !== undefined) {
          atuais.current.modelo?.renomear(id, nome)
          return
        }
        // Sem nenhum caractere que se veja (em branco, ou só invisíveis): o nome de antes fica, e a linha diz por quê.
        const texto = `Nome sem letra que se veja: continua "${rotuloDe(id, atuais.current.camadas)}".`
        setRecusa({ id, texto })
        setAnuncio(texto)
      },
      apagar: (id) => {
        const deCima = [...ordemAgora()].reverse()
        const i = deCima.indexOf(id)
        focoDepoisDeApagar.current = { apagada: id, vizinha: deCima[i + 1] ?? deCima[i - 1] }
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
        // Pegar de novo enquanto a anterior assenta: a linha vai já para o lugar dela (a animação não briga com o ponteiro).
        for (const li of linhas) for (const animacao of li.getAnimations?.() ?? []) if (!(animacao instanceof CSSTransition)) animacao.cancel()
        // Posições de LAYOUT (sem os `transform` das vizinhas que ainda voltam): o meio de cada linha e o vão entre elas.
        const caixas = linhas.map((li) => ({ top: li.offsetTop, height: li.offsetHeight, bottom: li.offsetTop + li.offsetHeight }))
        const gap = linhas.length > 1 ? caixas[1].top - caixas[0].bottom : 0
        const rolagem = rolagemDe(lista.current)
        const caixaDaRolagem = rolagem?.getBoundingClientRect() ?? { top: -Infinity, bottom: Infinity }
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
          ordem: ordemAgora().join(','),
          ultimoY: evento.clientY,
          rolagem,
          rolagemInicial: rolagem?.scrollTop ?? 0,
          caixaDaRolagem: { top: caixaDaRolagem.top, bottom: caixaDaRolagem.bottom },
          quadro: null,
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
      if (a !== null) {
        for (const li of a.linhas) li.style.transform = ''
        if (a.quadro !== null) cancelAnimationFrame(a.quadro)
      }
      if (vizinhasVoltando.current !== null) window.clearTimeout(vizinhasVoltando.current)
      arrasto.current = null
    },
    [],
  )

  const criar = () => {
    setRecusa(null)
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
      {/* No alto, logo depois da legenda: a camada nasce no topo (ou acima da aberta), perto de onde aparece. */}
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
      <ul
        ref={lista}
        className="lb-layers lb-camadas"
        aria-label="Camadas do mapa"
        data-arrastando={arrastando === null ? undefined : ''}
        data-ordenavel={ordenavel ? '' : undefined}
      >
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
              data-arrastada={arrastando === id || pousando === id ? '' : undefined}
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
                recusa={recusa?.id === id ? recusa.texto : undefined}
                acoes={acoes}
              />
              {aninhado !== undefined && <div className="lb-camadas__aninhado">{aninhado}</div>}
            </li>
          )
        })}
      </ul>
      {/* Camada apagada noutra cena (ou perdida por um cliente antigo) que ainda esconde itens dos jogadores:
          eles continuam escondidos (falha FECHADA) até o mestre mostrar aqui. */}
      {apagadas.length > 0 && (
        <ul className="lb-layers lb-camadas lb-camadas--apagadas" aria-label="Camadas apagadas que escondem itens">
          {apagadas.map((id, i) => {
            const nome = apagadas.length === 1 ? 'Camada apagada' : `Camada apagada ${i + 1}`
            return (
              <li key={id} className="lb-layers__row lb-camadas__linha" data-camada-apagada={id}>
                <div className="lb-camadas__cabeca">
                  <span className="lb-camadas__apagada">{nome}</span>
                  <button
                    type="button"
                    className="lb-iconbtn lb-iconbtn--sm lb-camadas__bt"
                    aria-pressed={true}
                    aria-label={`Mostrar aos jogadores os itens de ${nome}`}
                    title="Os itens dela estão escondidos dos jogadores; mostrar põe cada um na camada padrão do tipo"
                    onClick={() => acoes.olhoDosJogadores(id)}
                  >
                    <JogadoresOcultosIcon size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="lb-sr-only" aria-live="polite">
        {anuncio}
      </p>
    </>
  )
}
