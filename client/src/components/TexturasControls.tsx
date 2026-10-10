import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { isTauri } from '@tauri-apps/api/core'
import type { TexturaImportada } from '../types/map'
import { FORCA_MAX, FORCA_MIN, TAMANHO_DO_PINCEL_MAX, TAMANHO_DO_PINCEL_MIN, type ModoDaTextura } from '../lib/texturas'
import { escolherImagemDeTextura, ladrilhoDaImagem, nomeDoArquivo } from '../lib/texturaImportada'
import { ImagePickerUnavailableError } from '../lib/imageImport'
import { agruparPorForma, assinarTexturas, listarTexturas, type GrupoDeFormas, type TexturaDoCatalogo } from '../texturas/catalogo'
import { theme } from '../theme'
import { FATIA_DO_LADRILHO_MS, LADO_DA_MINIATURA, pixelsEmFatias } from '../texturas/ladrilhos'
import { mapaDoPiso } from '../lib/pisos'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { PinImageDrop } from './PinImageDrop'
import { BotaoProcurarAnimacoes } from './ProcurarAnimacoes'
import './TexturasControls.css'

const MODOS: Array<{ modo: ModoDaTextura; rotulo: string; dica: string }> = [
  { modo: 'pincel', rotulo: 'Pincel', dica: 'Arraste por cima do mapa para pintar a textura. Segure Alt para apagar.' },
  { modo: 'balde', rotulo: 'Balde', dica: 'Clique numa região ou num desenho pintado: a textura enche a parte dele que está à vista.' },
  { modo: 'borracha', rotulo: 'Borracha', dica: 'Arraste por cima de uma textura para tirá-la. O desenho de baixo volta a aparecer.' },
]

// ---------------------------------------------------------------------------
// Miniaturas: geradas uma por vez, cada uma em fatias, e guardadas.

const miniaturas = new Map<string, Uint8ClampedArray>()
let filaDeMiniaturas: Promise<void> = Promise.resolve()
/** 2×2 amostras por pixel: a borda da copa não serrilha no tamanho pequeno. */
const AMOSTRAS_DA_MINIATURA = 2
/**
 * Quanto do mundo a miniatura mostra, no máximo (em px do protótipo do
 * relevo, o metro da `escala`). As de ladrilho grande (Bosque, Pântano, Terra)
 * mostram só um pedaço dele: inteiro, a árvore e a poça saíam miúdas ao lado
 * das outras miniaturas.
 */
const ESCALA_DA_MINIATURA = 64

/** As de chão de masmorra (medidas em casas) mostram duas casas: a tábua e a lajota com o tamanho de ler. */
const CASAS_DA_MINIATURA = 2

function corDaMiniatura(textura: TexturaDoCatalogo): TexturaDoCatalogo['cor'] {
  const parte = Math.min(1, textura.casas !== undefined ? CASAS_DA_MINIATURA / textura.casas : ESCALA_DA_MINIATURA / textura.escala)
  return parte === 1 ? textura.cor : (u, v) => textura.cor(u * parte, v * parte)
}

function miniaturaDe(textura: TexturaDoCatalogo): Promise<Uint8ClampedArray | null> {
  const chave = `${textura.origem}:${textura.id}`
  const pronta = miniaturas.get(chave)
  if (pronta !== undefined) return Promise.resolve(pronta)
  // Uma por vez e em fatias de poucos ms: a miniatura da Serra inteira custava
  // ~170 ms numa tarefa só, e abrir o painel somava ~750 ms de travadas.
  const vez = filaDeMiniaturas.then(async () => {
    const ja = miniaturas.get(chave)
    if (ja !== undefined) return ja
    const dados = await pixelsEmFatias(corDaMiniatura(textura), LADO_DA_MINIATURA, () => false, FATIA_DO_LADRILHO_MS, AMOSTRAS_DA_MINIATURA)
    // Cor de um pacote que lança: sem miniatura (o quadro fica vazio), e a fila segue.
    if (dados !== null) miniaturas.set(chave, dados)
    return dados
  })
  filaDeMiniaturas = vez.then(() => undefined)
  return vez
}

function MiniaturaDoCatalogo({ textura }: { textura: TexturaDoCatalogo }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let vivo = true
    void miniaturaDe(textura).then((dados) => {
      if (!vivo || dados === null) return
      const g = ref.current?.getContext('2d')
      if (g) g.putImageData(new ImageData(new Uint8ClampedArray(dados), LADO_DA_MINIATURA, LADO_DA_MINIATURA), 0, 0)
    })
    return () => {
      vivo = false
    }
  }, [textura])
  return <canvas ref={ref} className="lb-texturas__miniatura" width={LADO_DA_MINIATURA} height={LADO_DA_MINIATURA} aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// Painel de formas: a textura que tem mais de uma (Lajotas Clara | Escura).

/** Só o gesto do ponteiro anima o painel; aberto ou fechado pelo teclado, ele troca de uma vez. */
type Movimento = 'abrindo' | 'fechando'

/** Fechando, o painel fica na árvore o tempo da saída (o `fast` da casa) e mais um respiro. */
const FECHA_MS = Number.parseFloat(theme.motion.fast)
const FOLGA_MS = 20

interface FecharPainel {
  /** Gesto do ponteiro: sai com movimento. */
  comMovimento: boolean
  /** Escolheu ou desistiu (Esc): o foco volta ao cartão. Clique fora e Tab deixam o foco onde foi. */
  devolverFoco: boolean
}

interface PainelDeFormasProps {
  grupo: GrupoDeFormas
  escolhida: string
  movimento: Movimento | undefined
  /** O cartão que abriu o painel: a âncora da posição e da origem do movimento. */
  cartao: () => HTMLButtonElement | undefined
  onEscolher: (id: string) => void
  onFechar: (como: FecharPainel) => void
}

/**
 * O painelzinho que abre do cartão de uma textura com formas (pedido de
 * 10/10/2026: "se ela tiver mais de uma forma abre um pequeno painel onde eu
 * possa escolher"). Um grupo de rádio como a grade: setas andam e já escolhem,
 * clique ou Enter escolhe e fecha, Esc fecha e devolve o foco ao cartão.
 *
 * Nasce colado ao cartão, centrado nele e preso à largura da biblioteca;
 * embaixo, ou em cima quando embaixo passaria da janela. A origem da escala é
 * o próprio cartão, para o painel brotar dele.
 */
function PainelDeFormas({ grupo, escolhida, movimento, cartao, onEscolher, onFechar }: PainelDeFormasProps) {
  const ref = useRef<HTMLDivElement>(null)
  const indiceEscolhido = grupo.formas.findIndex((f) => f.id === escolhida)

  useLayoutEffect(() => {
    const raiz = ref.current
    const ancora = cartao()
    if (!raiz || !ancora) return
    const estilo = getComputedStyle(raiz)
    const folga = Number.parseFloat(estilo.getPropertyValue('--lb-space-1')) || 0
    const bordaDaJanela = Number.parseFloat(estilo.getPropertyValue('--lb-layout-edge-gap')) || 0
    // Cada forma do tamanho do cartão: a miniatura se lê igual nas duas.
    raiz.style.setProperty('--lb-formas-lado', `${ancora.offsetWidth}px`)
    const largura = raiz.offsetWidth
    const altura = raiz.offsetHeight
    const caixa = raiz.offsetParent instanceof HTMLElement ? raiz.offsetParent.clientWidth : largura
    const centro = ancora.offsetLeft + ancora.offsetWidth / 2
    const esquerda = Math.min(Math.max(0, centro - largura / 2), Math.max(0, caixa - largura))
    const tela = ancora.getBoundingClientRect()
    const cabeEmbaixo = tela.bottom + folga + altura <= window.innerHeight - bordaDaJanela
    const cabeEmCima = tela.top - folga - altura >= bordaDaJanela
    const embaixo = cabeEmbaixo || !cabeEmCima
    raiz.style.left = `${esquerda}px`
    raiz.style.top = `${embaixo ? ancora.offsetTop + ancora.offsetHeight + folga : ancora.offsetTop - folga - altura}px`
    raiz.style.transformOrigin = `${centro - esquerda}px ${embaixo ? 0 : altura}px`
    // `preventScroll`: o foco não rola o painel lateral para alcançar o painelzinho.
    raiz.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true })
    // Só na abertura: escolher outra forma não reposiciona nem rouba o foco.
  }, [])

  const opcoes = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Escape') {
      // Não deixa o Esc subir e fechar mais alguma coisa além do painel.
      evento.preventDefault()
      evento.stopPropagation()
      onFechar({ comMovimento: false, devolverFoco: true })
      return
    }
    const atual = indiceEscolhido < 0 ? 0 : indiceEscolhido
    const passo: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    let proximo: number | null = null
    if (evento.key in passo) proximo = Math.min(grupo.formas.length - 1, Math.max(0, atual + passo[evento.key]))
    else if (evento.key === 'Home') proximo = 0
    else if (evento.key === 'End') proximo = grupo.formas.length - 1
    if (proximo === null) return
    evento.preventDefault()
    onEscolher(grupo.formas[proximo].id)
    opcoes()[proximo]?.focus()
  }

  /** Tab para fora fecha; voltar ao cartão (Shift+Tab, ou o clique nele) não: quem decide é o cartão. */
  const sair = (evento: FocusEvent<HTMLDivElement>) => {
    const destino = evento.relatedTarget
    if (!(destino instanceof Node) || evento.currentTarget.contains(destino) || cartao()?.contains(destino)) return
    onFechar({ comMovimento: false, devolverFoco: false })
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Formas de ${grupo.nome}`}
      className="lb-panel lb-texturas__formas"
      data-movimento={movimento}
      inert={movimento === 'fechando'}
      onKeyDown={teclar}
      onBlur={sair}
    >
      <div className="lb-texturas__formas-grade" role="radiogroup" aria-label="Forma">
        {grupo.formas.map((forma, i) => {
          const marcada = forma.id === escolhida
          return (
            <button
              key={forma.id}
              type="button"
              role="radio"
              aria-checked={marcada}
              tabIndex={marcada || (indiceEscolhido < 0 && i === 0) ? 0 : -1}
              className="lb-texturas__opcao"
              onClick={(evento) => {
                onEscolher(forma.id)
                onFechar({ comMovimento: evento.detail > 0, devolverFoco: true })
              }}
            >
              <MiniaturaDoCatalogo textura={forma} />
              <span className="lb-texturas__nome">{forma.forma?.nome ?? forma.nome}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Dois quadradinhos sobrepostos no canto da miniatura: este cartão tem mais de uma forma. */
function SeloDeFormas() {
  return (
    <svg className="lb-texturas__selo" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="7" height="7" rx="1.5" />
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------

interface ItemDaBiblioteca {
  /** O id da textura sozinha (ou da importada); nas formas, o da primeira, só como chave. */
  chave: string
  nome: string
  grupo?: GrupoDeFormas
  importada?: TexturaImportada
}

const SEM_IMPORTADAS: readonly TexturaImportada[] = []

/** As colunas da grade (o CSS usa as mesmas três): as setas sobem e descem de três em três. */
const COLUNAS = 3

/** A memória da última forma de cada grupo, com `id` lembrado se ele for uma forma de um grupo de verdade. */
function lembrarForma(memoria: ReadonlyMap<string, string>, grupos: readonly GrupoDeFormas[], id: string): ReadonlyMap<string, string> {
  const grupo = grupos.find((g) => g.formas.length > 1 && g.formas.some((f) => f.id === id))
  if (grupo === undefined || memoria.get(grupo.grupo) === id) return memoria
  return new Map(memoria).set(grupo.grupo, id)
}

/**
 * Painel da ferramenta Texturas (`lib/texturas.ts`): o que o PRÓXIMO gesto faz
 * (Pincel | Balde | Borracha), a BIBLIOTECA em miniaturas (as embutidas, as
 * do pacote e as que o mestre importou), importar uma imagem, o tamanho do
 * pincel e a força.
 *
 * Lê e escreve a store direto (como `PenhascoControls`): são preferências da
 * ferramenta e as texturas da cena aberta, sem nada para o App repassar. O que
 * não serve ao modo escolhido não aparece (a borracha não tem textura; o balde
 * não tem tamanho), para nenhum controle ficar na tela sem efeito.
 */
export function TexturasControls() {
  const modo = useMapStore((s) => s.texturaModo)
  const setModo = useMapStore((s) => s.setTexturaModo)
  const escolhida = useMapStore((s) => s.texturaEscolhida)
  const setEscolhida = useMapStore((s) => s.setTexturaEscolhida)
  const tamanho = useMapStore((s) => s.texturaTamanho)
  const setTamanho = useMapStore((s) => s.setTexturaTamanho)
  const forca = useMapStore((s) => s.texturaForca)
  const setForca = useMapStore((s) => s.setTexturaForca)
  const importadas = useMapStore((s) => s.map.texturasImportadas ?? SEM_IMPORTADAS)
  // PISOS: "apagar todas" só alcança o piso em edição; o botão aparece pelo mesmo recorte.
  const temTextura = useMapStore((s) => (mapaDoPiso(s.map, s.pisoAtivo).texturas?.length ?? 0) > 0)
  const importar = useMapStore((s) => s.importarTextura)
  const remover = useMapStore((s) => s.removerTexturaImportada)
  const apagarTodas = useMapStore((s) => s.apagarTodasAsTexturas)
  const catalogo = useSyncExternalStore(assinarTexturas, listarTexturas)
  const grupos = useMemo(() => agruparPorForma(catalogo), [catalogo])
  const [importando, setImportando] = useState(false)
  // A última forma usada de cada grupo: o cartão volta a ela (a primeira, na primeira vez).
  const [lembradas, setLembradas] = useState<ReadonlyMap<string, string>>(() => lembrarForma(new Map(), grupos, escolhida))
  const [painel, setPainel] = useState<{ grupo: string; movimento?: Movimento } | null>(null)
  const grade = useRef<HTMLDivElement>(null)
  const biblioteca = useRef<HTMLDivElement>(null)
  const idDasFormas = useId()

  const itens: ItemDaBiblioteca[] = [
    ...grupos.map((g) => ({ chave: g.formas[0].id, nome: g.nome, grupo: g })),
    ...importadas.map((t) => ({ chave: t.id, nome: t.nome, importada: t })),
  ]
  /** A forma que o cartão do grupo mostra e escolhe: a escolhida, se for dele; senão a última usada; senão a primeira. */
  const formaDoGrupo = (g: GrupoDeFormas): TexturaDoCatalogo =>
    g.formas.find((f) => f.id === escolhida) ?? g.formas.find((f) => f.id === lembradas.get(g.grupo)) ?? g.formas[0]
  const idDoItem = (item: ItemDaBiblioteca) => (item.grupo !== undefined ? formaDoGrupo(item.grupo).id : item.chave)
  const marcado = (item: ItemDaBiblioteca) => (item.grupo !== undefined ? item.grupo.formas.some((f) => f.id === escolhida) : item.chave === escolhida)
  const indiceEscolhido = itens.findIndex(marcado)
  const importadaEscolhida = importadas.find((t) => t.id === escolhida)
  const grupoDoPainel = painel === null ? undefined : grupos.find((g) => g.grupo === painel.grupo && g.formas.length > 1)
  const painelAberto = grupoDoPainel !== undefined && painel?.movimento !== 'fechando'

  const escolher = (id: string) => {
    setEscolhida(id)
    setLembradas((memoria) => lembrarForma(memoria, grupos, id))
  }

  const cartaoDoGrupo = (grupo: string) =>
    Array.from(grade.current?.querySelectorAll<HTMLButtonElement>('[data-grupo]') ?? []).find((b) => b.dataset.grupo === grupo)

  const fecharPainel = ({ comMovimento, devolverFoco }: FecharPainel) => {
    // Já saindo, a saída segue até o fim (o foco que volta ao cartão não a corta).
    setPainel((atual) => (atual === null || atual.movimento === 'fechando' ? atual : comMovimento ? { ...atual, movimento: 'fechando' } : null))
    if (devolverFoco && painel !== null) cartaoDoGrupo(painel.grupo)?.focus({ preventScroll: true })
  }

  /** Cartão com formas: escolhe a forma de sempre e abre o painel (ou fecha, se ele já está aberto). */
  const clicarNoCartao = (item: ItemDaBiblioteca, evento: MouseEvent<HTMLButtonElement>) => {
    const grupo = item.grupo
    if (grupo === undefined || grupo.formas.length < 2) {
      escolher(idDoItem(item))
      return
    }
    // `detail` 0 é o clique que o Enter e o Espaço disparam: teclado não anima.
    const comMovimento = evento.detail > 0
    if (painelAberto && painel?.grupo === grupo.grupo) {
      fecharPainel({ comMovimento, devolverFoco: false })
      return
    }
    escolher(formaDoGrupo(grupo).id)
    setPainel({ grupo: grupo.grupo, movimento: comMovimento ? 'abrindo' : undefined })
  }

  // Fechando: sai da árvore quando a saída acaba.
  useEffect(() => {
    if (painel?.movimento !== 'fechando') return
    const timer = setTimeout(() => setPainel((atual) => (atual?.movimento === 'fechando' ? null : atual)), FECHA_MS + FOLGA_MS)
    return () => clearTimeout(timer)
  }, [painel])

  // Clique fora (no mapa, noutro cartão, noutro controle) fecha com movimento. O
  // próprio cartão não conta: o clique nele é que decide (fecha o que está aberto).
  const grupoAberto = painelAberto ? painel?.grupo : undefined
  useEffect(() => {
    if (grupoAberto === undefined) return
    const fora = (evento: Event) => {
      const alvo = evento.target
      if (!(alvo instanceof Node)) return
      if (biblioteca.current?.querySelector('.lb-texturas__formas')?.contains(alvo)) return
      if (cartaoDoGrupo(grupoAberto)?.contains(alvo)) return
      setPainel((atual) => (atual === null || atual.movimento === 'fechando' ? atual : { ...atual, movimento: 'fechando' }))
    }
    document.addEventListener('pointerdown', fora, true)
    return () => document.removeEventListener('pointerdown', fora, true)
  }, [grupoAberto])
  const dicaDoModo = MODOS.find((m) => m.modo === modo)?.dica ?? ''

  const avisar = (erro: unknown) => {
    const texto = erro instanceof Error ? erro.message : 'não deu para importar essa imagem'
    useToastStore.getState().push('error', `Textura não importada: ${texto}`)
  }

  const receberImagem = async (blob: Blob) => {
    setImportando(true)
    try {
      const imagem = await ladrilhoDaImagem(blob)
      importar(blob instanceof File ? nomeDoArquivo(blob.name) : 'Textura importada', imagem)
    } catch (erro) {
      avisar(erro)
    } finally {
      setImportando(false)
    }
  }

  const escolherDoDisco = async () => {
    setImportando(true)
    try {
      const escolha = await escolherImagemDeTextura()
      if (escolha !== null) importar(escolha.nome, escolha.imagem)
    } catch (erro) {
      if (erro instanceof ImagePickerUnavailableError) useToastStore.getState().push('instrucao', erro.message)
      else avisar(erro)
    } finally {
      setImportando(false)
    }
  }

  /**
   * Setas andam pela grade (três por linha), Home e End vão às pontas: o grupo
   * de rádio de sempre, de cartão em cartão. No cartão com formas, a seta
   * escolhe a forma de sempre dele, sem abrir o painel (quem abre é o clique,
   * o Enter ou o Espaço).
   */
  const navegar = (evento: KeyboardEvent<HTMLDivElement>) => {
    const atual = indiceEscolhido < 0 ? 0 : indiceEscolhido
    const passo: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUNAS, ArrowUp: -COLUNAS }
    let proximo: number | null = null
    if (evento.key in passo) proximo = Math.min(itens.length - 1, Math.max(0, atual + passo[evento.key]))
    else if (evento.key === 'Home') proximo = 0
    else if (evento.key === 'End') proximo = itens.length - 1
    if (proximo === null) return
    evento.preventDefault()
    escolher(idDoItem(itens[proximo]))
    grade.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[proximo]?.focus()
  }

  /** Esc com o foco de volta no cartão (Shift+Tab saindo do painel) também fecha. */
  const escDaBiblioteca = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Escape' || !painelAberto) return
    evento.preventDefault()
    evento.stopPropagation()
    fecharPainel({ comMovimento: false, devolverFoco: true })
  }

  return (
    <section className="lb-section lb-texturas">
      <h2 className="lb-eyebrow">Ao pintar</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Ao pintar">
        {MODOS.map((opcao) => (
          <button
            key={opcao.modo}
            type="button"
            role="radio"
            aria-checked={modo === opcao.modo}
            className="lb-seg__option"
            onClick={() => {
              // A borracha esconde a biblioteca: o painel de formas não fica esperando por ela.
              setPainel(null)
              setModo(opcao.modo)
            }}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <p className="lb-field__hint">{dicaDoModo}</p>

      {modo !== 'borracha' && (
        <>
          <h2 className="lb-eyebrow">Textura</h2>
          <div ref={biblioteca} className="lb-texturas__biblioteca" onKeyDown={escDaBiblioteca}>
            <div ref={grade} className="lb-texturas__grade" role="radiogroup" aria-label="Textura" onKeyDown={navegar}>
              {itens.map((item, i) => {
                const marcada = marcado(item)
                const formas = item.grupo !== undefined && item.grupo.formas.length > 1 ? item.grupo : undefined
                const mostrada = item.grupo !== undefined ? formaDoGrupo(item.grupo) : undefined
                return (
                  <button
                    key={item.chave}
                    type="button"
                    role="radio"
                    aria-checked={marcada}
                    aria-describedby={formas !== undefined ? `${idDasFormas}-${formas.grupo}` : undefined}
                    data-grupo={formas?.grupo}
                    // Um só ponto de parada do Tab no grupo; as setas andam dentro dele.
                    tabIndex={marcada || (indiceEscolhido < 0 && i === 0) ? 0 : -1}
                    className="lb-texturas__opcao"
                    title={formas !== undefined ? `${item.nome}: ${mostrada?.forma?.nome ?? ''}` : item.nome}
                    onClick={(evento) => clicarNoCartao(item, evento)}
                  >
                    {mostrada !== undefined ? (
                      <span className="lb-texturas__quadro">
                        <MiniaturaDoCatalogo textura={mostrada} />
                        {formas !== undefined && <SeloDeFormas />}
                      </span>
                    ) : (
                      <img className="lb-texturas__miniatura" src={item.importada?.imagem} alt="" draggable={false} />
                    )}
                    <span className="lb-texturas__nome">{item.nome}</span>
                  </button>
                )
              })}
            </div>
            {/* A descrição dos cartões com formas, para o leitor de tela: o nome fica só o da textura. */}
            {grupos
              .filter((g) => g.formas.length > 1)
              .map((g) => (
                <span key={g.grupo} id={`${idDasFormas}-${g.grupo}`} hidden>
                  {`Formas: ${g.formas.map((f) => f.forma?.nome ?? f.nome).join(', ')}. Enter abre a escolha.`}
                </span>
              ))}
            {grupoDoPainel !== undefined && (
              <PainelDeFormas
                key={grupoDoPainel.grupo}
                grupo={grupoDoPainel}
                escolhida={escolhida}
                movimento={painel?.movimento}
                cartao={() => cartaoDoGrupo(grupoDoPainel.grupo)}
                onEscolher={escolher}
                onFechar={fecharPainel}
              />
            )}
          </div>
          {importadaEscolhida !== undefined && (
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => remover(importadaEscolhida.id)}>
              Remover “{importadaEscolhida.nome}”
            </button>
          )}
          <h2 className="lb-eyebrow">Importar textura</h2>
          <PinImageDrop onImage={(blob) => void receberImagem(blob)} rotulo="Colar ou soltar a imagem da nova textura" />
          {isTauri() && (
            <button type="button" className="lb-btn lb-btn--block" disabled={importando} onClick={() => void escolherDoDisco()}>
              {importando ? 'Importando…' : 'Escolher imagem…'}
            </button>
          )}
          {importando && !isTauri() && (
            <p className="lb-field__hint" role="status">
              Importando…
            </p>
          )}
          <p className="lb-field__hint">A imagem vira um ladrilho que se repete sem emenda. Texturas novas também chegam pelo pacote de animações.</p>
          <BotaoProcurarAnimacoes rotulo="Procurar texturas novas" />
        </>
      )}

      {modo !== 'balde' && (
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-textura-tamanho">
              Tamanho do pincel
            </label>
            <span className="lb-num">{tamanho}</span>
          </div>
          <input
            id="lb-textura-tamanho"
            className="lb-range"
            type="range"
            min={TAMANHO_DO_PINCEL_MIN}
            max={TAMANHO_DO_PINCEL_MAX}
            step={2}
            value={tamanho}
            onChange={(event) => setTamanho(Number(event.target.value))}
          />
        </div>
      )}
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-textura-forca">
            Força
          </label>
          <span className="lb-num">{Math.round(forca * 100)}%</span>
        </div>
        <input
          id="lb-textura-forca"
          className="lb-range"
          type="range"
          min={FORCA_MIN}
          max={FORCA_MAX}
          step={0.05}
          value={forca}
          onChange={(event) => setForca(Number(event.target.value))}
        />
      </div>
      {temTextura && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={apagarTodas}>
          Apagar todas as texturas
        </button>
      )}
    </section>
  )
}
