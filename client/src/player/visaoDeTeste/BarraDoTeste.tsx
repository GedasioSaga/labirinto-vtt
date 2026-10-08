import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { EscolherFichaDeTeste, RetratoDaFicha, type AberturaDaEscolha } from '../../components/EscolherFichaDeTeste'
import { CloseIcon, EsquecerIcon, EyeIcon, FrascoIcon, JogarIcon, ReticenciasIcon, TrocarIcon } from '../../components/icons'
import type { BarraDoTesteProps, ModoDoTeste } from '../../net/visaoDeTeste/tipos'
import './BarraDoTeste.css'

/**
 * VISÃO DE JOGADOR — a barra fina da janela de teste, logo abaixo do título
 * do Windows. Diz de quem é a tela (retrato, ficha, dono), que é teste (o
 * selo tracejado, a linguagem do que só o mestre vê), em que modo ela está
 * (Olhar | Jogar, no centro) e o que dá para fazer: trocar a ficha, esquecer
 * o explorado, fechar.
 *
 * Três larguras, pela largura da própria barra (a janela pode ser estreita):
 *  - larga: tudo escrito;
 *  - média: os botões da direita viram só ícone (com o nome no balão) e o
 *    selo encurta para "Teste";
 *  - estreita: o seletor fica só com ícones, o dono sai, e Trocar ficha,
 *    Esquecer tudo e Fechar vão para o menu "Mais". O nome é quem corta.
 *
 * O CSS é próprio (`BarraDoTeste.css`): esta é a página do jogador, sem main.css.
 */

/** A partir desta largura cabe tudo escrito com o seletor no centro (medido com o selo inteiro e o nome cortando a 60 px). */
export const LARGURA_LARGA = 880
/** Daqui até a larga, os botões da direita viram ícone; abaixo, vão para o menu "Mais". */
export const LARGURA_MEDIA = 640
/** Quanto tempo o "Névoa esquecida." fica à vista depois do Esquecer tudo. */
export const AVISO_DO_ESQUECER_MS = 4000

export const SELO_DO_TESTE = 'Teste — nada fica no jogo'
export const MOTIVO_JOGAR_INDISPONIVEL = 'Jogar ainda não está disponível nesta versão. Por enquanto, a janela só mostra o que a ficha vê.'

export type LarguraDaBarra = 'larga' | 'media' | 'estreita'

export function larguraDaBarra(px: number): LarguraDaBarra {
  if (px >= LARGURA_LARGA) return 'larga'
  if (px >= LARGURA_MEDIA) return 'media'
  return 'estreita'
}

const MODOS: readonly ModoDoTeste[] = ['olhar', 'jogar']

/**
 * A largura da barra, medida nela (e não na janela): quem monta pode pô-la
 * numa caixa menor. Sem `ResizeObserver` (jsdom), vale a da janela.
 */
function useLarguraDaBarra(barraRef: RefObject<HTMLElement | null>): LarguraDaBarra {
  const [largura, setLargura] = useState<LarguraDaBarra>(() => larguraDaBarra(window.innerWidth))
  useLayoutEffect(() => {
    const barra = barraRef.current
    if (barra === null) return
    const medir = (): void => setLargura(larguraDaBarra(barra.getBoundingClientRect().width || window.innerWidth))
    medir()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir)
      return () => window.removeEventListener('resize', medir)
    }
    const observador = new ResizeObserver(medir)
    observador.observe(barra)
    return () => observador.disconnect()
  }, [barraRef])
  return largura
}

/** Enter e Espaço sintetizam o clique com `detail` 0: foi o teclado. */
function aberturaDoClique(detail: number): AberturaDaEscolha {
  return detail === 0 ? 'teclado' : 'ponteiro'
}

interface ItemDoMais {
  rotulo: string
  icone: ReactNode
  onEscolher(abertura: AberturaDaEscolha): void
}

interface MenuMaisProps {
  id: string
  ancora: HTMLElement
  abertura: AberturaDaEscolha
  itens: readonly ItemDoMais[]
  /** `devolverFoco`: Esc devolve o foco ao "Mais"; o clique fora, não. */
  onFechar(devolverFoco: boolean): void
}

/**
 * O menu "Mais" da barra estreita, no molde do menu da cena: o foco entra no
 * primeiro item, as setas andam (dando a volta), Home e End vão às pontas,
 * Esc fecha e devolve o foco ao "Mais", Tab fecha e segue dali.
 */
function MenuMais({ id, ancora, abertura, itens, onFechar }: MenuMaisProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const itensRef = useRef<(HTMLButtonElement | null)[]>([])
  const onFecharRef = useRef(onFechar)
  useLayoutEffect(() => {
    onFecharRef.current = onFechar
  })

  useLayoutEffect(() => {
    itensRef.current[0]?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const fecharSeForFora = (evento: Event): void => {
      const alvo = evento.target
      if (!(alvo instanceof Node) || menuRef.current?.contains(alvo) || ancora.contains(alvo)) return
      onFecharRef.current(false)
    }
    document.addEventListener('pointerdown', fecharSeForFora, true)
    document.addEventListener('focusin', fecharSeForFora)
    return () => {
      document.removeEventListener('pointerdown', fecharSeForFora, true)
      document.removeEventListener('focusin', fecharSeForFora)
    }
  }, [ancora])

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>): void {
    const lista = itensRef.current.filter((item): item is HTMLButtonElement => item !== null)
    const atual = lista.findIndex((item) => item === document.activeElement)
    const focar = (indice: number): void => {
      evento.preventDefault()
      lista[(indice + lista.length) % lista.length]?.focus()
    }
    switch (evento.key) {
      case 'Escape':
        evento.preventDefault()
        onFechar(true)
        break
      case 'Tab':
        // O Tab do navegador segue a partir do "Mais", como se o menu não existisse.
        ancora.focus({ preventScroll: true })
        onFechar(false)
        break
      case 'ArrowDown':
        focar(atual + 1)
        break
      case 'ArrowUp':
        focar(atual < 0 ? lista.length - 1 : atual - 1)
        break
      case 'Home':
        focar(0)
        break
      case 'End':
        focar(lista.length - 1)
        break
      default:
        return
    }
    // Nenhuma tecla do menu chega aos atalhos da tela do jogador (o Esc fecharia o cartão dele).
    evento.stopPropagation()
    evento.nativeEvent.stopImmediatePropagation()
  }

  return (
    <div ref={menuRef} id={id} className="vj-barra__menu" role="menu" aria-label="Mais" data-abertura={abertura} onKeyDown={aoTeclar}>
      {itens.map((item, indice) => (
        <button
          key={item.rotulo}
          ref={(no) => {
            itensRef.current[indice] = no
          }}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="vj-barra__item"
          onClick={(evento) => item.onEscolher(aberturaDoClique(evento.detail))}
        >
          {item.icone}
          {item.rotulo}
        </button>
      ))}
    </div>
  )
}

interface Aberto {
  ancora: HTMLElement
  abertura: AberturaDaEscolha
  /** A largura em que abriu: com a barra mudando de forma, o botão de onde saiu pode não existir mais. */
  largura: LarguraDaBarra
}

export function BarraDoTeste({
  ficha,
  modo,
  onModo,
  jogarDisponivel = true,
  fichas,
  fichaSelecionadaId,
  onTrocarFicha,
  onEsquecerTudo,
  onFechar,
}: BarraDoTesteProps) {
  const barraRef = useRef<HTMLElement>(null)
  const opcoesRef = useRef<(HTMLButtonElement | null)[]>([])
  const largura = useLarguraDaBarra(barraRef)
  const [escolha, setEscolha] = useState<Aberto | null>(null)
  const [menu, setMenu] = useState<Aberto | null>(null)
  const [modoPeloTeclado, setModoPeloTeclado] = useState(false)
  const [esquecida, setEsquecida] = useState(false)
  const escolhaId = useId()
  const menuId = useId()
  const motivoId = useId()
  const escolhaAberta = escolha !== null && escolha.largura === largura
  const menuAberto = menu !== null && menu.largura === largura && largura === 'estreita'
  const estreita = largura === 'estreita'
  const botoesSoIcone = largura !== 'larga'
  const seloCurto = largura !== 'larga'

  // O "Névoa esquecida." sai sozinho: é confirmação, não estado.
  useEffect(() => {
    if (!esquecida) return
    const relogio = window.setTimeout(() => setEsquecida(false), AVISO_DO_ESQUECER_MS)
    return () => window.clearTimeout(relogio)
  }, [esquecida])

  const disponivel = (alvo: ModoDoTeste): boolean => alvo === 'olhar' || jogarDisponivel

  function escolherModo(alvo: ModoDoTeste, peloTeclado: boolean): void {
    if (!disponivel(alvo) || alvo === modo) return
    // Pelo teclado o marcador pula na hora (← → trocam sem animação); no clique, desliza.
    setModoPeloTeclado(peloTeclado)
    onModo(alvo)
  }

  function teclaNoModo(evento: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    let alvo: number
    switch (evento.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        alvo = (indice + 1) % MODOS.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        alvo = (indice - 1 + MODOS.length) % MODOS.length
        break
      case 'Home':
        alvo = 0
        break
      case 'End':
        alvo = MODOS.length - 1
        break
      default:
        return
    }
    // As setas são do seletor: não andam a câmera do jogador.
    evento.preventDefault()
    evento.stopPropagation()
    // O foco vai até o Jogar desligado (o balão diz o porquê), mas só o disponível troca o modo.
    opcoesRef.current[alvo]?.focus()
    escolherModo(MODOS[alvo], true)
  }

  function abrirEscolha(ancora: HTMLElement, abertura: AberturaDaEscolha): void {
    setMenu(null)
    setEscolha({ ancora, abertura, largura })
  }

  function esquecerTudo(): void {
    onEsquecerTudo?.()
    setEsquecida(true)
  }

  const fecharMenu = (devolverFoco: boolean): void => {
    const ancora = menu?.ancora
    setMenu(null)
    if (devolverFoco) ancora?.focus({ preventScroll: true })
  }

  const itensDoMais: ItemDoMais[] = [
    {
      rotulo: 'Trocar ficha',
      icone: <TrocarIcon size={16} />,
      onEscolher: (abertura) => {
        // A lista se prende ao "Mais": o item some com o menu.
        if (menu !== null) abrirEscolha(menu.ancora, abertura)
      },
    },
  ]
  if (onEsquecerTudo !== undefined) {
    itensDoMais.push({
      rotulo: 'Esquecer tudo',
      icone: <EsquecerIcon size={16} />,
      onEscolher: () => {
        fecharMenu(true)
        esquecerTudo()
      },
    })
  }
  itensDoMais.push({ rotulo: 'Fechar a janela', icone: <CloseIcon size={16} />, onEscolher: () => onFechar() })

  const dono =
    ficha.dono === null ? (
      <span className="vj-barra__dono vj-barra__dono--sem" title="Sem jogador: a névoa começa do zero">
        sem jogador
      </span>
    ) : (
      <span className="vj-barra__dono" title={`de ${ficha.dono}`}>
        de {ficha.dono}
      </span>
    )

  const classeDoBotao = botoesSoIcone ? 'vj-barra__botao vj-barra__botao--icone' : 'vj-barra__botao'

  // A confirmação do Esquecer tudo, ao lado do botão: escrita na barra larga, só
  // falada nas outras. A região fica montada (vazia) para o leitor de tela ouvir a troca.
  const avisoDoEsquecer = (
    <span className={esquecida && !botoesSoIcone ? 'vj-barra__feito' : 'vj-barra__sr'} role="status">
      {esquecida ? 'Névoa esquecida.' : ''}
    </span>
  )

  return (
    <header ref={barraRef} className="vj-barra" data-largura={largura} aria-label={`Visão de jogador: ${ficha.nome} (teste)`}>
      <div className="vj-barra__ficha">
        <RetratoDaFicha ficha={ficha} tamanho={24} />
        <span className="vj-barra__nome" title={ficha.nome}>
          {ficha.nome}
        </span>
        {!estreita && dono}
        {!estreita && <span className="vj-barra__div" aria-hidden="true" />}
        <span className="vj-barra__teste" title={seloCurto ? SELO_DO_TESTE : undefined}>
          <FrascoIcon size={14} />
          {seloCurto ? (
            <>
              Teste<span className="vj-barra__sr"> — nada fica no jogo</span>
            </>
          ) : (
            SELO_DO_TESTE
          )}
        </span>
      </div>

      <div className={estreita ? 'vj-modo vj-modo--icones' : 'vj-modo'} role="radiogroup" aria-label="Modo" data-modo={modo} data-instante={modoPeloTeclado ? 'true' : undefined}>
        {/* O marcador desliza por baixo das opções: é ele que tem o latão do marcado. */}
        <span className="vj-modo__marca" aria-hidden="true" />
        {MODOS.map((opcao, indice) => {
          const marcada = opcao === modo
          const desligada = !disponivel(opcao)
          const rotulo = opcao === 'olhar' ? 'Olhar' : 'Jogar'
          return (
            <button
              key={opcao}
              ref={(no) => {
                opcoesRef.current[indice] = no
              }}
              type="button"
              role="radio"
              className="vj-modo__opcao"
              aria-checked={marcada}
              aria-disabled={desligada ? 'true' : undefined}
              aria-describedby={desligada ? motivoId : undefined}
              // Uma parada só do Tab no seletor: a opção marcada.
              tabIndex={marcada ? 0 : -1}
              aria-label={estreita ? rotulo : undefined}
              title={estreita && !desligada ? rotulo : undefined}
              onClick={(evento) => escolherModo(opcao, evento.detail === 0)}
              onKeyDown={(evento) => teclaNoModo(evento, indice)}
            >
              {opcao === 'olhar' ? <EyeIcon size={16} /> : <JogarIcon size={14} />}
              {!estreita && rotulo}
            </button>
          )
        })}
        {!jogarDisponivel && (
          <span id={motivoId} className="vj-modo__dica" role="tooltip">
            {MOTIVO_JOGAR_INDISPONIVEL}
          </span>
        )}
      </div>

      <div className="vj-barra__acoes">
        {estreita ? (
          <div className="vj-barra__mais">
            <button
              type="button"
              className="vj-barra__botao vj-barra__botao--icone"
              aria-label="Mais"
              title="Mais"
              aria-haspopup="menu"
              aria-expanded={menuAberto || escolhaAberta}
              aria-controls={menuAberto ? menuId : escolhaAberta ? escolhaId : undefined}
              onClick={(evento) => {
                if (menuAberto) {
                  setMenu(null)
                  return
                }
                if (escolhaAberta) {
                  setEscolha(null)
                  return
                }
                setMenu({ ancora: evento.currentTarget, abertura: aberturaDoClique(evento.detail), largura })
              }}
            >
              <ReticenciasIcon size={16} strokeWidth={2.2} />
            </button>
            {menuAberto && <MenuMais id={menuId} ancora={menu.ancora} abertura={menu.abertura} itens={itensDoMais} onFechar={fecharMenu} />}
            {onEsquecerTudo !== undefined && avisoDoEsquecer}
          </div>
        ) : (
          <>
            <button
              type="button"
              className={classeDoBotao}
              aria-haspopup="dialog"
              aria-expanded={escolhaAberta}
              aria-controls={escolhaAberta ? escolhaId : undefined}
              aria-label={botoesSoIcone ? 'Trocar ficha' : undefined}
              title={botoesSoIcone ? 'Trocar ficha' : undefined}
              onClick={(evento) => {
                if (escolhaAberta) setEscolha(null)
                else abrirEscolha(evento.currentTarget, aberturaDoClique(evento.detail))
              }}
            >
              <TrocarIcon size={16} />
              {!botoesSoIcone && 'Trocar ficha'}
            </button>
            {onEsquecerTudo !== undefined && avisoDoEsquecer}
            {onEsquecerTudo !== undefined && (
              <button
                type="button"
                className={classeDoBotao}
                aria-label={botoesSoIcone ? 'Esquecer tudo' : undefined}
                title={botoesSoIcone ? 'Esquecer tudo: a névoa volta ao que a ficha vê agora' : 'A névoa volta ao que a ficha vê agora'}
                onClick={esquecerTudo}
              >
                <EsquecerIcon size={16} />
                {!botoesSoIcone && 'Esquecer tudo'}
              </button>
            )}
            <span className="vj-barra__div" aria-hidden="true" />
            <button type="button" className={classeDoBotao} aria-label={botoesSoIcone ? 'Fechar' : undefined} title="Fechar a janela de teste" onClick={() => onFechar()}>
              <CloseIcon size={16} />
              {!botoesSoIcone && 'Fechar'}
            </button>
          </>
        )}
      </div>

      {escolhaAberta && (
        <EscolherFichaDeTeste
          id={escolhaId}
          fichas={fichas}
          fichaSelecionadaId={fichaSelecionadaId}
          fichaAbertaId={ficha.id}
          ancora={escolha.ancora}
          abertura={escolha.abertura}
          acaoDoEnter="trocar"
          onEscolher={onTrocarFicha}
          onFechar={() => setEscolha(null)}
        />
      )}
    </header>
  )
}
