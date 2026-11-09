/// <reference types="vite/client" />
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import {
  Tldraw,
  createShapeId,
  createTLStore,
  defaultShapeUtils,
  getSnapshot,
  loadSnapshot,
  useValue,
  type Editor,
  type TLAnyShapeUtilConstructor,
  type TLArrowShape,
  type TLAssetStore,
  type TLEditorSnapshot,
  type TLEventInfo,
  type TLImageShape,
  type TLShapeId,
  type TLStore,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { ROTULO_DO_TIPO, verbeteNovo } from '../../lib/preparo/enciclopedia'
import { ehLugarDentroDeLugar, gravarLigacoes, haLigacaoEntre, lerLigacoes, ligacaoNova, ligacoesVazias, tiposParaSugerir } from '../../lib/preparo/ligacoes'
import { caminhosSemMidia, ehPlanta, extensaoDaImagem, fotoComMidia, gravarMidiaDoQuadro, midiaDoAsset, midiaNaTabela, tabelaDeMidiaDasImportacoes } from '../../lib/preparo/quadros'
import type { Ligacao, Quadro, Verbete } from '../../lib/preparo/tipos'
import { agendarGravacaoDeFora, usePreludio } from '../estado/preludio'
import { prepararMidia, urlDaMidia } from '../midia'
import { CARD_ALTURA_PADRAO, CARD_LARGURA_PADRAO, UTILS_DOS_CARTOES, abrirVerbeteDoQuadro, marcarChegada, tipoDeCartaoDo, verbeteDoCartao } from './cartoes'
import { chaveDaGravacaoDoQuadro, gravarQuadroAtual, lerQuadroAtual, useQuadros } from './estadoDosQuadros'
import { exportarQuadro, type FormatoDeExportacao } from './exportarQuadro'
import { GavetaDeVerbetes } from './GavetaDeVerbetes'
import { criarGravadorDoQuadro } from './gravadorDoQuadro'
import { cartoesPorVerbete, desenharSetasDasLigacoes, mostrarForma, pontasDaSeta, porCartao, rotularSeta, setasQueFaltam, textoDaSeta, verbeteDaForma } from './ligacoesNoQuadro'
import { PerguntaDaLigacao, type PerguntaDeLigacao } from './PerguntaDaLigacao'
import { PerguntaDaImagem, type TipoDaImagem } from './PerguntaDaImagem'
import { registrarAtalhosDoQuadro } from './atalhosDoQuadro'
import { UTILS_DA_PLANTA, definirResolvedoresDaPlanta } from './planta'
import { QuadroEsperando } from './esperando'
import { definirQuadroAberto, focoFicaFora, MIME_DO_VERBETE } from './quadroAtivo'

/**
 * O QUADRO ABERTO (fatias F3a e F3b): o tldraw 4.5.12, o mesmo do Grimório, com a
 * foto do arquivo `preparo/quadros/<id>.json`.
 *
 * - Fontes, ícones e traduções do tldraw vêm de dentro do app
 *   (`@tldraw/assets/imports.vite`): o Grimório os buscava na internet.
 * - A chave de licença entra na hora do build por `VITE_TLDRAW_LICENSE_KEY` e
 *   nunca no git. Sem ela, o app (http://tauri.localhost) roda com a marca
 *   "made with tldraw" (plano, "Licença do tldraw").
 * - Os cartões e as peças de planta têm o esquema e as migrações do Grimório,
 *   letra por letra: sem isso a foto importada não abre.
 * - Salvar é automático, pela mesma fila dos verbetes (`agendarGravacaoDeFora`):
 *   o rodapé "Tudo salvo neste PC", o "Tentar de novo" e a pergunta ao fechar
 *   a janela valem para o quadro. Abrir não grava: só a mudança do mestre, e
 *   mexer e desfazer não conta como mudança (`gravadorDoQuadro.ts`).
 * - A planta do Grimório (`mapas-soltos/`) e o arquivo de formato mais novo
 *   abrem só para ver.
 * - F3b: a gaveta de verbetes (arrastar ou Enter põe o cartão, com as setas das
 *   ligações), a pergunta "criar a ligação?" quando o mestre liga dois cartões
 *   com uma seta, a busca (Ctrl+K) achando cartões, a câmera que volta onde
 *   estava e o alvo vindo de uma citação no texto.
 */

export interface EditorDoQuadroProps {
  id: string
  /** "‹ Quadros": volta à lista. Sem ele, a barra começa por `cabeca`. */
  aoVoltar?: () => void
  /** O começo da barra no lugar do "‹ Quadros" (as abas da sessão). */
  cabeca?: ReactNode
  /** A forma a mostrar ao abrir (`shape:…`), vinda de uma citação no texto. */
  alvo?: string
}

const UTILS_DO_QUADRO: TLAnyShapeUtilConstructor[] = [...UTILS_DOS_CARTOES, ...UTILS_DA_PLANTA]
/** O store precisa do esquema inteiro; o `<Tldraw>` soma os padrões aos de `shapeUtils` sozinho. */
const UTILS_DO_STORE: TLAnyShapeUtilConstructor[] = [...defaultShapeUtils, ...UTILS_DO_QUADRO]
const ENDERECOS_DO_TLDRAW = getAssetUrlsByImport()
const CHAVE_DO_TLDRAW: string | undefined = import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined

const PLANTA_SO_PARA_VER = 'Planta do Grimório: abre só para ver. O mapa se faz no editor de mapas do Labirinto.'
const NA_LIXEIRA = 'Este quadro está na lixeira: abre só para ver. Para mexer, restaure pela lista de Quadros (botão Lixeira).'
const IMAGEM_SEM_ARQUIVO = 'Esta imagem não tem arquivo no Prelúdio (veio do Grimório sem ele). Importe de novo pelo Início para trazê-la.'
/** O tldraw dá à primeira página do quadro novo o nome "Page 1"; o Prelúdio fala português. */
const PAGINA_EM_INGLES = 'Page 1'
const PRIMEIRA_PAGINA = 'Página 1'
const TRAVADO = 'O Prelúdio está gravando uma importação ou uma cópia restaurada. Tente de novo quando terminar.'

/** Quanto tempo o resultado (exportar, pôr cartão, ligação criada) fica na barra. */
const AVISO_DA_BARRA_MS = 5000
/** A câmera indo até um cartão achado: curta, porque é ação de teclado e de uso frequente. */
const VIAGEM_DA_CAMERA_MS = 240
/** Cartões postos no meio da vista em seguida não caem um em cima do outro: a folga entre eles e quantos anéis de vagas procurar. */
const FOLGA_NO_MEIO = 32
const ANEIS_NO_MEIO = 3

const ID_DA_GAVETA = 'pr-quadro-gaveta'
const CHAVE_DA_GAVETA = 'lb-preparo:gaveta-do-quadro'

const chaveDoPar = (a: string, b: string) => (a < b ? `${a}\n${b}` : `${b}\n${a}`)

/** Onde a câmera estava em cada quadro: voltar da página de um verbete (ou trocar de aba) não perde o lugar. */
const cameras = new Map<string, { x: number; y: number; z: number }>()

type Abertura =
  | { readonly t: 'lendo' }
  | { readonly t: 'sumiu' }
  | { readonly t: 'falhou'; readonly aviso: string }
  | {
      readonly t: 'pronto'
      readonly store: TLStore
      readonly quadro: Quadro
      /** O arquivo tem exatamente `quadro`; falso quando ele é o que o disco recusou. */
      readonly noDisco: boolean
      readonly soLeitura: string | null
      readonly semArquivo: number
    }

/** As ligações como abriram; `bloqueio` = por que não dá para gravar uma nova. */
interface LigacoesDoQuadro {
  readonly lista: readonly Ligacao[]
  readonly bloqueio: string | null
}

type Pergunta = PerguntaDeLigacao & { readonly deId: string; readonly paraId: string }

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

function gavetaGuardada(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_DA_GAVETA) !== 'fechada'
  } catch {
    return true
  }
}

function guardarGaveta(aberta: boolean): void {
  try {
    window.localStorage.setItem(CHAVE_DA_GAVETA, aberta ? 'aberta' : 'fechada')
  } catch {
    // Sem armazenamento, a gaveta só não lembra na próxima vez.
  }
}

/** A câmera viaja (curta) ou salta, quem pediu menos movimento. */
function duracaoDaViagem(): number | undefined {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? undefined : VIAGEM_DA_CAMERA_MS
}

/**
 * Onde cai o cartão posto sem arrastar (clique na gaveta, Shift+Enter na busca):
 * o meio da vista, ou a vaga livre mais perto dele, numa grade do tamanho do
 * cartão. Moldura não ocupa (cartão dentro de cena é o normal); seta também não.
 */
function pontoNoMeio(editor: Editor): { x: number; y: number } {
  const centro = editor.getViewportPageBounds().center
  const meiaLargura = CARD_LARGURA_PADRAO / 2 + FOLGA_NO_MEIO / 2
  const meiaAltura = CARD_ALTURA_PADRAO / 2 + FOLGA_NO_MEIO / 2
  const ocupadas = editor
    .getCurrentPageShapes()
    .filter((forma) => forma.type !== 'arrow' && forma.type !== 'frame')
    .flatMap((forma) => editor.getShapePageBounds(forma) ?? [])
  const livre = (x: number, y: number) => ocupadas.every((caixa) => x + meiaLargura <= caixa.minX || x - meiaLargura >= caixa.maxX || y + meiaAltura <= caixa.minY || y - meiaAltura >= caixa.maxY)
  const vagas: { x: number; y: number }[] = []
  for (let i = -ANEIS_NO_MEIO; i <= ANEIS_NO_MEIO; i++) {
    for (let j = -ANEIS_NO_MEIO; j <= ANEIS_NO_MEIO; j++) vagas.push({ x: centro.x + i * (CARD_LARGURA_PADRAO + FOLGA_NO_MEIO), y: centro.y + j * (CARD_ALTURA_PADRAO + FOLGA_NO_MEIO) })
  }
  const distancia = (ponto: { x: number; y: number }) => Math.hypot(ponto.x - centro.x, ponto.y - centro.y)
  return vagas.sort((a, b) => distancia(a) - distancia(b)).find((vaga) => livre(vaga.x, vaga.y)) ?? { x: centro.x, y: centro.y }
}

/** As imagens do quadro moram em `preparo/midia/`; a foto guarda o caminho em `meta.midia`. */
function lojaDeImagens(raiz: string | null): TLAssetStore {
  return {
    async upload(_asset, arquivo) {
      const bytes = new Uint8Array(await arquivo.arrayBuffer())
      const midia = await gravarMidiaDoQuadro(bytes, extensaoDaImagem(bytes, arquivo.type, arquivo.name))
      return { src: (raiz === null ? null : urlDaMidia(raiz, midia)) ?? midia, meta: { midia } }
    },
    resolve(asset) {
      const midia = midiaDoAsset(asset.meta)
      const url = midia === null || raiz === null ? null : urlDaMidia(raiz, midia)
      return url ?? asset.props.src
    },
  }
}

async function abrir(id: string): Promise<Abertura> {
  // Uma mudança deste quadro esperando o relógio ou indo ao disco agora termina antes de reler; a recusada vale.
  const atual = await lerQuadroAtual(id)
  let quadro: Quadro
  let noDisco = true
  let soLeitura: string | null = null
  if (atual.t === 'naoGravado') {
    quadro = atual.quadro
    noDisco = false
  } else {
    const { lido } = atual
    if (lido.estado === 'novo') return { t: 'sumiu' }
    if (lido.estado === 'falhou') return { t: 'falhou', aviso: lido.aviso }
    if (lido.valor === null) return { t: 'falhou', aviso: lido.estado === 'somenteLeitura' ? lido.aviso : 'O arquivo do quadro está vazio.' }
    quadro = lido.valor
    if (lido.estado === 'somenteLeitura') soLeitura = lido.aviso
  }
  if (soLeitura === null && ehPlanta(quadro)) soLeitura = PLANTA_SO_PARA_VER
  if (soLeitura === null && quadro.lixeira !== undefined) soLeitura = NA_LIXEIRA

  // Imagem vinda do Grimório: o endereço do Prelúdio sai da tabela da importação (o `meta.rel` fica).
  let foto: unknown = quadro.tldraw
  let semArquivo = 0
  if (caminhosSemMidia(foto).length > 0) {
    const tabela = await tabelaDeMidiaDasImportacoes()
    const comMidia = fotoComMidia(foto, (rel) => midiaNaTabela(tabela, rel))
    foto = comMidia.foto
    semArquivo = comMidia.semArquivo
  }

  const raiz = await prepararMidia()
  const store = createTLStore({ shapeUtils: UTILS_DO_STORE, assets: lojaDeImagens(raiz) })
  if (foto !== null && foto !== undefined) {
    try {
      // O próprio tldraw migra a foto antiga ({store, schema}) e a de {document, session}.
      loadSnapshot(store, foto as Partial<TLEditorSnapshot>)
    } catch (erro) {
      return { t: 'falhou', aviso: `O tldraw não abriu este quadro (${motivo(erro)}). O arquivo continua intacto.` }
    }
  }
  return { t: 'pronto', store, quadro, noDisco, soLeitura, semArquivo }
}

/** O começo da barra: as abas da sessão ou o "‹ Quadros". */
function ComecoDaBarra({ aoVoltar, cabeca }: Pick<EditorDoQuadroProps, 'aoVoltar' | 'cabeca'>) {
  if (cabeca !== undefined) return <>{cabeca}</>
  if (aoVoltar === undefined) return null
  return (
    <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoVoltar}>
      ‹ Quadros
    </button>
  )
}

interface QuadroProntoProps extends Pick<EditorDoQuadroProps, 'aoVoltar' | 'cabeca' | 'alvo'> {
  id: string
  store: TLStore
  quadro: Quadro
  noDisco: boolean
  soLeitura: string | null
  semArquivo: number
}

function QuadroPronto({ id, store, quadro, noDisco, soLeitura, semArquivo, aoVoltar, cabeca, alvo }: QuadroProntoProps) {
  const travado = usePreludio((estado) => estado.travado)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhaDoFiltro = usePreludio((estado) => estado.campanhaId)
  const recemCriado = useQuadros((estado) => estado.recemCriado === id)
  const [nome, setNome] = useState(quadro.nome)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [exportando, setExportando] = useState(false)
  const [resultado, setResultado] = useState<{ texto: string; falhou: boolean } | null>(null)
  const [gavetaAberta, setGavetaAberta] = useState(gavetaGuardada)
  // Só a gaveta aberta pelo botão assenta; a que abre junto com o quadro já aparece parada.
  const [gavetaPeloBotao, setGavetaPeloBotao] = useState(false)
  const [ligacoes, setLigacoes] = useState<LigacoesDoQuadro>({ lista: [], bloqueio: null })
  const [pergunta, setPergunta] = useState<Pergunta | null>(null)
  const [imagemEmVerbete, setImagemEmVerbete] = useState<{ readonly id: TLShapeId; readonly sugestao: string; readonly midia: string | null } | null>(null)
  const [soltando, setSoltando] = useState(false)
  const nomeGravado = useRef(quadro.nome)
  const campoDoNome = useRef<HTMLInputElement>(null)
  const botaoDaGaveta = useRef<HTMLButtonElement>(null)
  const fantasma = useRef<HTMLDivElement>(null)
  const tela = useRef<HTMLDivElement>(null)
  const entradasDoArrasto = useRef(0)
  const ligacoesAtuais = useRef<readonly Ligacao[]>([])
  const dispensadas = useRef(new Set<string>())
  const voltaNoCartao = useRef(new Map<string, number>())
  const alvoMostrado = useRef<string | undefined>(undefined)
  const somenteVer = soLeitura !== null
  const podePor = !somenteVer && !travado

  // O que vai ao disco é montado na hora de gravar: a foto de agora, o nome de agora, o resto como veio.
  const [gravador] = useState(() =>
    criarGravadorDoQuadro({
      id,
      quadro,
      noDisco,
      foto: () => getSnapshot(store),
      nome: () => nomeGravado.current,
      async gravarNoDisco(novo) {
        await gravarQuadroAtual(id, novo)
        useQuadros.getState().gravado(id, novo)
      },
    }),
  )
  const agendar = useRef(() => {
    agendarGravacaoDeFora(chaveDaGravacaoDoQuadro(id), async () => {
      await gravador.gravar()
    })
  }).current

  useEffect(() => {
    ligacoesAtuais.current = ligacoes.lista
  }, [ligacoes])

  // As ligações entre verbetes: as setas do cartão que entra e a pergunta da seta desenhada.
  useEffect(() => {
    let vivo = true
    void lerLigacoes().then((lido) => {
      if (!vivo) return
      if (lido.estado === 'novo') setLigacoes({ lista: [], bloqueio: null })
      else if (lido.estado === 'ok') setLigacoes({ lista: lido.valor.ligacoes, bloqueio: null })
      else if (lido.estado === 'somenteLeitura') setLigacoes({ lista: lido.valor?.ligacoes ?? [], bloqueio: lido.aviso })
      else setLigacoes({ lista: [], bloqueio: lido.aviso })
    })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (!recemCriado) return
    campoDoNome.current?.select()
    useQuadros.getState().esquecerRecemCriado()
  }, [recemCriado])

  useEffect(() => {
    editor?.updateInstanceState({ isReadonly: somenteVer || travado })
  }, [editor, somenteVer, travado])

  useEffect(() => {
    if (resultado === null) return
    const relogio = setTimeout(() => setResultado(null), AVISO_DA_BARRA_MS)
    return () => clearTimeout(relogio)
  }, [resultado])

  // Uma citação no texto pediu outra forma com o quadro já aberto.
  useEffect(() => {
    if (editor === null || alvo === undefined || alvoMostrado.current === alvo) return
    alvoMostrado.current = alvo
    if (!mostrarForma(editor, alvo as TLShapeId, duracaoDaViagem())) setResultado({ texto: 'O que o texto cita não está mais neste quadro.', falhou: true })
  }, [editor, alvo])

  /** Põe o cartão do verbete no ponto (da página), com as setas das ligações, e conta na barra. */
  const porVerbete = (alvoDoCartao: Editor, verbete: Verbete, ponto: { x: number; y: number }) => {
    if (somenteVer || usePreludio.getState().travado) return
    const { formaId, setas } = porCartao(alvoDoCartao, verbete, ponto, ligacoesAtuais.current, usePreludio.getState().verbetes)
    alvoDoCartao.select(formaId)
    // A vaga livre pode ter ficado fora da vista: a câmera desliza até o cartão novo, sem mudar o zoom.
    const caixa = alvoDoCartao.getShapePageBounds(formaId)
    if (caixa !== undefined && !alvoDoCartao.getViewportPageBounds().contains(caixa)) {
      const duracao = duracaoDaViagem()
      alvoDoCartao.centerOnPoint(caixa.center, duracao === undefined ? { immediate: true } : { animation: { duration: duracao } })
    }
    const nomeDoVerbete = verbete.titulo || 'Sem nome'
    setResultado({ texto: setas === 0 ? `${nomeDoVerbete} entrou no quadro.` : `${nomeDoVerbete} entrou no quadro, com ${setas === 1 ? '1 seta' : `${setas} setas`} das ligações.`, falhou: false })
  }

  /** Mostra o cartão do verbete; com mais de um, cada pedido mostra o seguinte. */
  const irAoVerbete = (alvoDoCartao: Editor, verbeteId: string): boolean => {
    const formas = cartoesPorVerbete(alvoDoCartao, usePreludio.getState().verbetes).get(verbeteId)
    if (formas === undefined || formas.length === 0) return false
    const vez = (voltaNoCartao.current.get(verbeteId) ?? -1) + 1
    voltaNoCartao.current.set(verbeteId, vez)
    const forma = formas[vez % formas.length]
    return forma !== undefined && mostrarForma(alvoDoCartao, forma, duracaoDaViagem())
  }

  // A busca (Ctrl+K) acha os cartões deste quadro e põe verbetes nele.
  useEffect(() => {
    if (editor === null) return
    definirQuadroAberto({
      nome: nomeGravado.current,
      editavel: !somenteVer && !travado,
      cartoes: () => {
        const lista: { formaId: string; verbeteId: string }[] = []
        for (const [verbeteId, formas] of cartoesPorVerbete(editor, usePreludio.getState().verbetes)) for (const formaId of formas) lista.push({ formaId, verbeteId })
        return lista
      },
      irAoCartao: (formaId) => {
        mostrarForma(editor, formaId as TLShapeId, duracaoDaViagem())
        editor.focus()
      },
      porNoQuadro: (verbeteId) => {
        const verbete = usePreludio.getState().verbetes.get(verbeteId)
        if (verbete === undefined) return
        porVerbete(editor, verbete, pontoNoMeio(editor))
        editor.focus()
      },
    })
    return () => definirQuadroAberto(null)
    // `porVerbete` lê refs e o estado do Prelúdio na hora; o registro muda só com o editor e a trava.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, somenteVer, travado])

  // A seta desenhada entre dois cartões sem ligação: ao soltar o ponteiro, o quadro pergunta se cria a ligação.
  useEffect(() => {
    if (editor === null || somenteVer) return
    const pendentes = new Set<TLShapeId>()
    const pararDeOuvir = editor.store.listen(
      ({ changes }) => {
        for (const registro of Object.values(changes.added)) if (registro.typeName === 'binding' && registro.type === 'arrow') pendentes.add(registro.fromId)
        for (const [, depois] of Object.values(changes.updated)) if (depois.typeName === 'binding' && depois.type === 'arrow') pendentes.add(depois.fromId)
      },
      { scope: 'document', source: 'user' },
    )
    const avaliar = () => {
      const todos = usePreludio.getState().verbetes
      let achada: Pergunta | null = null
      for (const setaId of pendentes) {
        const seta = editor.getShape(setaId)
        if (seta === undefined || seta.type !== 'arrow') continue
        const pontas = pontasDaSeta(editor, seta as TLArrowShape)
        if (pontas === null) continue
        const de = verbeteDaForma(editor, pontas.inicio, todos)
        const para = verbeteDaForma(editor, pontas.fim, todos)
        if (de === undefined || para === undefined || de.id === para.id) continue
        // A seta de lugar dentro de lugar é a hierarquia, que o próprio quadro desenha: não vira ligação.
        if (ehLugarDentroDeLugar(de, para)) continue
        if (haLigacaoEntre(ligacoesAtuais.current, de.id, para.id) || dispensadas.current.has(chaveDoPar(de.id, para.id))) continue
        achada = { setaId, de: de.titulo || 'Sem nome', para: para.titulo || 'Sem nome', tipo: textoDaSeta(editor, seta as TLArrowShape), deId: de.id, paraId: para.id }
      }
      pendentes.clear()
      if (achada !== null) setPergunta(achada)
    }
    let relogio: ReturnType<typeof setTimeout> | undefined
    const aoEvento = (info: TLEventInfo) => {
      if (info.type !== 'pointer') return
      if (info.name === 'pointer_down') pendentes.clear()
      else if (info.name === 'pointer_up') {
        clearTimeout(relogio)
        relogio = setTimeout(avaliar, 0)
      }
    }
    editor.on('event', aoEvento)
    return () => {
      pararDeOuvir()
      editor.off('event', aoEvento)
      clearTimeout(relogio)
    }
  }, [editor, somenteVer])

  const aoMontar = (montado: Editor) => {
    // O idioma fica em português, qualquer que seja o do Windows (o tldraw seguia o do sistema).
    montado.user.updateUserPreferences({ colorScheme: 'dark', locale: 'pt-br' })
    // O quadro nascido no Prelúdio: a primeira página ganha nome em português, fora do desfazer e antes de marcar a abertura (o importado fica como veio).
    if (quadro.origem === undefined && !somenteVer) {
      const paginas = montado.getPages()
      const primeira = paginas[0]
      if (paginas.length === 1 && primeira !== undefined && primeira.name === PAGINA_EM_INGLES) montado.run(() => montado.renamePage(primeira.id, PRIMEIRA_PAGINA), { history: 'ignore' })
    }
    const pararAtalhos = registrarAtalhosDoQuadro(montado, {
      abrirVerbete: abrirVerbeteDoQuadro,
      imagemEmVerbete: somenteVer
        ? null
        : (imagem: TLImageShape) => {
            const asset = imagem.props.assetId === null ? undefined : montado.getAsset(imagem.props.assetId)
            const nomeDoArquivo = asset?.type === 'image' ? asset.props.name : ''
            setPergunta(null)
            setImagemEmVerbete({ id: imagem.id, sugestao: nomeDoArquivo.replace(/\.[A-Za-z0-9]{1,8}$/, '').replace(/[-_]+/g, ' ').trim(), midia: midiaDoAsset(asset?.meta) })
          },
      avisar: (texto, falhou) => setResultado({ texto, falhou }),
    })
    // As salas da planta mostram o nome do lugar ligado, e o duplo clique abre o verbete.
    const verbeteDe = (verbeteId: string) => verbeteDoCartao(usePreludio.getState().verbetes, verbeteId)
    const abrirVerbete = (verbeteId: string) => {
      const verbete = verbeteDe(verbeteId)
      if (verbete !== undefined) abrirVerbeteDoQuadro(verbete)
    }
    definirResolvedoresDaPlanta({ nomeDoCenario: (cenarioId) => verbeteDe(cenarioId)?.titulo, nomeDoItem: (itemId) => verbeteDe(itemId)?.titulo, abrirCenario: abrirVerbete, abrirItem: abrirVerbete })
    // A citação manda numa forma; senão, a câmera volta onde estava (ao voltar da página de um verbete).
    alvoMostrado.current = alvo
    const lembrada = cameras.get(id)
    if (alvo !== undefined) {
      if (!mostrarForma(montado, alvo as TLShapeId)) setResultado({ texto: 'O que o texto cita não está mais neste quadro.', falhou: true })
    } else if (lembrada !== undefined) montado.setCamera(lembrada, { immediate: true })
    // Depois de montar: o que o editor arruma ao nascer (página, câmera) não conta como mudança do mestre.
    let pararDeOuvir = () => {}
    if (!somenteVer) {
      gravador.marcarAbertura()
      pararDeOuvir = montado.store.listen(agendar, { scope: 'document', source: 'user' })
    }
    setEditor(montado)
    return () => {
      const { x, y, z } = montado.getCamera()
      cameras.set(id, { x, y, z })
      pararAtalhos()
      pararDeOuvir()
      definirResolvedoresDaPlanta({})
      setEditor(null)
    }
  }

  const confirmarNome = () => {
    const limpo = nome.trim()
    if (somenteVer || limpo === nomeGravado.current) {
      setNome(nomeGravado.current)
      return
    }
    nomeGravado.current = limpo
    setNome(limpo)
    useQuadros.getState().renomear(id, limpo)
    agendar()
  }

  const aoTeclarNoNome = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter') {
      evento.preventDefault()
      evento.currentTarget.blur()
    } else if (evento.key === 'Escape') {
      evento.preventDefault()
      setNome(nomeGravado.current)
      requestAnimationFrame(() => campoDoNome.current?.blur())
    }
  }

  const exportar = async (formato: FormatoDeExportacao) => {
    if (editor === null || exportando) return
    setExportando(true)
    try {
      const caminho = await exportarQuadro(editor, nomeGravado.current, formato)
      if (caminho !== null) setResultado({ texto: `${formato.toUpperCase()} salvo em ${caminho}`, falhou: false })
    } catch (erro) {
      setResultado({ texto: `A exportação falhou: ${motivo(erro)}`, falhou: true })
    } finally {
      setExportando(false)
    }
  }

  const abrirOuFecharGaveta = (aberta: boolean) => {
    setGavetaAberta(aberta)
    setGavetaPeloBotao(aberta)
    guardarGaveta(aberta)
    if (!aberta) requestAnimationFrame(() => botaoDaGaveta.current?.focus())
  }

  // ─── Soltar um verbete da gaveta: o fantasma mostra onde o cartão vai cair ───

  const trazVerbete = (evento: DragEvent) => evento.dataTransfer.types.includes(MIME_DO_VERBETE)

  const moverFantasma = (clienteX: number, clienteY: number) => {
    const caixa = tela.current?.getBoundingClientRect()
    const elemento = fantasma.current
    if (caixa === undefined || elemento === null || editor === null) return
    const zoom = editor.getZoomLevel()
    const largura = CARD_LARGURA_PADRAO * zoom
    const altura = CARD_ALTURA_PADRAO * zoom
    elemento.style.width = `${largura}px`
    elemento.style.height = `${altura}px`
    elemento.style.transform = `translate(${clienteX - caixa.left - largura / 2}px, ${clienteY - caixa.top - altura / 2}px)`
  }

  const aoEntrarArrastando = (evento: DragEvent<HTMLDivElement>) => {
    if (!podePor || !trazVerbete(evento)) return
    entradasDoArrasto.current += 1
    setSoltando(true)
  }

  const aoSairArrastando = (evento: DragEvent<HTMLDivElement>) => {
    if (!trazVerbete(evento)) return
    entradasDoArrasto.current -= 1
    if (entradasDoArrasto.current <= 0) {
      entradasDoArrasto.current = 0
      setSoltando(false)
    }
  }

  // Fase de captura: o tldraw para o soltar no próprio canvas; o guarda pelo tipo deixa passar imagem e arquivo.
  const aoArrastarSobre = (evento: DragEvent<HTMLDivElement>) => {
    if (!podePor || !trazVerbete(evento)) return
    evento.preventDefault()
    evento.stopPropagation()
    evento.dataTransfer.dropEffect = 'copy'
    moverFantasma(evento.clientX, evento.clientY)
  }

  const aoSoltar = (evento: DragEvent<HTMLDivElement>) => {
    if (!trazVerbete(evento)) return
    evento.preventDefault()
    evento.stopPropagation()
    entradasDoArrasto.current = 0
    setSoltando(false)
    const verbete = usePreludio.getState().verbetes.get(evento.dataTransfer.getData(MIME_DO_VERBETE))
    if (verbete === undefined || editor === null || !podePor) return
    porVerbete(editor, verbete, editor.screenToPage({ x: evento.clientX, y: evento.clientY }))
    editor.focus()
  }

  // ─── A gaveta e a pergunta da seta ───

  const chaveNoQuadro = useValue('verbetes no quadro', () => (editor === null || !gavetaAberta ? '' : [...cartoesPorVerbete(editor, verbetes).keys()].sort().join('\n')), [editor, gavetaAberta, verbetes])
  const noQuadro = useMemo(() => new Set(chaveNoQuadro === '' ? [] : chaveNoQuadro.split('\n')), [chaveNoQuadro])
  const faltam = useValue('setas que faltam', () => (editor === null || !gavetaAberta || somenteVer ? 0 : setasQueFaltam(editor, ligacoes.lista, verbetes)), [editor, gavetaAberta, somenteVer, ligacoes.lista, verbetes])
  const tipos = useMemo(() => tiposParaSugerir(ligacoes.lista), [ligacoes.lista])

  const escolherNaGaveta = (verbete: Verbete) => {
    if (editor === null) return
    if (irAoVerbete(editor, verbete.id)) return
    if (podePor) porVerbete(editor, verbete, pontoNoMeio(editor))
  }

  const desenharSetas = () => {
    if (editor === null || !podePor) return
    let feitas = 0
    editor.markHistoryStoppingPoint('setas das ligações')
    editor.run(() => {
      feitas = desenharSetasDasLigacoes(editor, ligacoesAtuais.current, usePreludio.getState().verbetes)
    })
    setResultado({ texto: feitas === 1 ? '1 seta desenhada pelas ligações.' : `${feitas} setas desenhadas pelas ligações.`, falhou: false })
  }

  const dispensarPergunta = () => {
    if (pergunta !== null) dispensadas.current.add(chaveDoPar(pergunta.deId, pergunta.paraId))
    setPergunta(null)
    editor?.focus()
  }

  const criarLigacao = async (tipo: string): Promise<string | null> => {
    const feita = pergunta
    if (feita === null) return null
    if (usePreludio.getState().travado) return TRAVADO
    // Relida na hora: uma importação pode ter trazido ligações enquanto o quadro estava aberto.
    const lido = await lerLigacoes()
    if (lido.estado === 'falhou' || lido.estado === 'somenteLeitura') return lido.aviso
    const arquivo = lido.estado === 'novo' ? ligacoesVazias() : lido.valor
    let lista = arquivo.ligacoes
    if (!haLigacaoEntre(lista, feita.deId, feita.paraId)) {
      lista = [...lista, ligacaoNova(feita.deId, feita.paraId, tipo)]
      try {
        await gravarLigacoes({ ...arquivo, ligacoes: lista })
      } catch (erro) {
        return `A ligação não foi gravada: ${motivo(erro)}`
      }
    }
    setLigacoes({ lista, bloqueio: null })
    const seta = editor?.getShape(feita.setaId as TLShapeId)
    if (editor !== null && seta !== undefined && seta.type === 'arrow') rotularSeta(editor, seta as TLArrowShape, tipo)
    setPergunta(null)
    setResultado({ texto: `Ligação criada: ${feita.de} ${tipo} ${feita.para}.`, falhou: false })
    editor?.focus()
    return null
  }

  const bloqueioDaLigacao = travado ? TRAVADO : ligacoes.bloqueio

  const dispensarImagem = () => {
    setImagemEmVerbete(null)
    editor?.focus()
  }

  /** A imagem vira verbete: ele nasce com ela de retrato (o arquivo já está em `midia/`), e o cartão fica no lugar dela, na mesma moldura. */
  const criarVerbeteDaImagem = async (tipo: TipoDaImagem, nomeDoVerbete: string): Promise<string | null> => {
    const pedido = imagemEmVerbete
    if (pedido === null || editor === null) return null
    if (usePreludio.getState().travado) return TRAVADO
    if (pedido.midia === null) return IMAGEM_SEM_ARQUIVO
    const imagem = editor.getShape(pedido.id)
    if (imagem === undefined) return 'A imagem não está mais no quadro.'
    const campanha = quadro.campanhaId ?? campanhaDoFiltro
    const base = verbeteNovo(tipo, nomeDoVerbete, { campanhas: campanha === null ? [] : [campanha] })
    const midia = pedido.midia
    const novo: Verbete = { ...base, formas: base.formas.map((forma, indice) => (indice === 0 ? { ...forma, retrato: midia } : forma)) }
    await usePreludio.getState().criarVerbete(novo)
    const centro = editor.getShapePageBounds(imagem)?.center ?? pontoNoMeio(editor)
    const pai = imagem.parentId
    const formaNova = createShapeId()
    const tipoDoCartao = tipoDeCartaoDo(novo)
    const posicao = { id: formaNova, x: centro.x - CARD_LARGURA_PADRAO / 2, y: centro.y - CARD_ALTURA_PADRAO / 2 }
    marcarChegada(formaNova)
    // Um passo só no desfazer: a imagem sai e o cartão entra juntos.
    editor.markHistoryStoppingPoint('imagem vira verbete')
    editor.run(() => {
      editor.deleteShapes([imagem.id])
      if (tipoDoCartao === 'cenario-card') editor.createShape({ ...posicao, type: tipoDoCartao, props: { cenarioId: novo.id } })
      else if (tipoDoCartao === 'item-card') editor.createShape({ ...posicao, type: tipoDoCartao, props: { itemId: novo.id } })
      else editor.createShape({ ...posicao, type: tipoDoCartao, props: { personagemId: novo.id } })
      // Dentro de uma moldura (a cena do mapa mental), o cartão continua dentro dela.
      if (editor.getShape(pai)?.type === 'frame') editor.reparentShapes([formaNova], pai)
    })
    editor.select(formaNova)
    setImagemEmVerbete(null)
    setResultado({ texto: `${nomeDoVerbete} virou ${ROTULO_DO_TIPO[tipo].um.toLowerCase()}, com a imagem de retrato.`, falhou: false })
    editor.focus()
    return null
  }

  return (
    <div className="pr-quadro">
      <div className="pr-quadro__barra">
        <ComecoDaBarra aoVoltar={aoVoltar} cabeca={cabeca} />
        <input
          ref={campoDoNome}
          className="pr-quadro__nome"
          aria-label="Nome do quadro"
          value={nome}
          readOnly={somenteVer || travado}
          placeholder="Quadro sem nome"
          onChange={(evento) => setNome(evento.target.value)}
          onBlur={confirmarNome}
          onKeyDown={aoTeclarNoNome}
        />
        <span className="pr-quadro__espaco" />
        {resultado !== null && (
          <span className={`pr-quadro__resultado${resultado.falhou ? ' pr-quadro__resultado--falhou' : ''}`} role={resultado.falhou ? 'alert' : 'status'}>
            {resultado.texto}
          </span>
        )}
        <button
          ref={botaoDaGaveta}
          type="button"
          className="gr-bt gr-bt--p gr-bt--fantasma pr-quadro__gaveta-bt"
          aria-expanded={gavetaAberta}
          aria-controls={ID_DA_GAVETA}
          disabled={editor === null}
          onClick={() => abrirOuFecharGaveta(!gavetaAberta)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="3.5" y="4" width="13" height="12" rx="1.5" />
            <path d="M12 4v12" />
          </svg>
          Verbetes
        </button>
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={editor === null || exportando} onClick={() => void exportar('png')}>
          Exportar PNG
        </button>
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={editor === null || exportando} onClick={() => void exportar('svg')}>
          Exportar SVG
        </button>
      </div>
      {(soLeitura !== null || semArquivo > 0) && (
        <div className="pr-quadro__avisos">
          {soLeitura !== null && <p className="pr-quadro__nota">{soLeitura}</p>}
          {semArquivo > 0 && (
            <p className="pr-quadro__nota">
              {semArquivo === 1 ? '1 imagem deste quadro não veio na importação do Grimório.' : `${semArquivo} imagens deste quadro não vieram na importação do Grimório.`} Importe de novo pelo Início para trazê-las.
            </p>
          )}
        </div>
      )}
      <div className="pr-quadro__corpo">
        <div
          ref={tela}
          className={`pr-quadro__tela${soltando ? ' pr-quadro__tela--soltando' : ''}`}
          onDragEnterCapture={aoEntrarArrastando}
          onDragLeaveCapture={aoSairArrastando}
          onDragOverCapture={aoArrastarSobre}
          onDropCapture={aoSoltar}
        >
          <Tldraw store={store} shapeUtils={UTILS_DO_QUADRO} assetUrls={ENDERECOS_DO_TLDRAW} licenseKey={CHAVE_DO_TLDRAW} autoFocus={!focoFicaFora()} onMount={aoMontar} />
          {soltando && (
            <>
              <div ref={fantasma} className="pr-quadro__fantasma" aria-hidden="true" />
              <p className="pr-quadro__soltar" aria-hidden="true">
                Solte para pôr o cartão aqui
              </p>
            </>
          )}
          {pergunta !== null && <PerguntaDaLigacao key={pergunta.setaId} pergunta={pergunta} tipos={tipos} bloqueio={bloqueioDaLigacao} aoCriar={criarLigacao} aoDispensar={dispensarPergunta} />}
          {imagemEmVerbete !== null && (
            <PerguntaDaImagem
              key={imagemEmVerbete.id}
              sugestao={imagemEmVerbete.sugestao}
              bloqueio={travado ? TRAVADO : imagemEmVerbete.midia === null ? IMAGEM_SEM_ARQUIVO : null}
              aoCriar={criarVerbeteDaImagem}
              aoDispensar={dispensarImagem}
            />
          )}
        </div>
        {gavetaAberta && editor !== null && (
          <GavetaDeVerbetes
            id={ID_DA_GAVETA}
            campanhaId={quadro.campanhaId ?? campanhaDoFiltro}
            noQuadro={noQuadro}
            editavel={podePor}
            faltam={faltam}
            entra={gavetaPeloBotao}
            aoEscolher={escolherNaGaveta}
            aoDesenharSetas={desenharSetas}
            aoFechar={() => abrirOuFecharGaveta(false)}
          />
        )}
      </div>
    </div>
  )
}

export function EditorDoQuadro({ id, aoVoltar, cabeca, alvo }: EditorDoQuadroProps) {
  const [abertura, setAbertura] = useState<Abertura>({ t: 'lendo' })

  useEffect(() => {
    let vivo = true
    abrir(id).then(
      (aberto) => {
        if (vivo) setAbertura(aberto)
      },
      (erro: unknown) => {
        if (vivo) setAbertura({ t: 'falhou', aviso: `Não deu para ler o quadro: ${motivo(erro)}.` })
      },
    )
    return () => {
      vivo = false
    }
  }, [id])

  if (abertura.t === 'pronto') {
    return <QuadroPronto id={id} store={abertura.store} quadro={abertura.quadro} noDisco={abertura.noDisco} soLeitura={abertura.soLeitura} semArquivo={abertura.semArquivo} aoVoltar={aoVoltar} cabeca={cabeca} alvo={alvo} />
  }
  if (abertura.t === 'lendo') return <QuadroEsperando cabeca={cabeca} />
  return (
    <div className="pr-quadro">
      {cabeca !== undefined && <div className="pr-quadro__barra">{cabeca}</div>}
      <section className="pr-lista">
        <p className="pr-aviso" role="alert">
          {abertura.t === 'sumiu' ? 'Este quadro não existe mais.' : abertura.aviso}
        </p>
        {aoVoltar !== undefined && (
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoVoltar}>
            Voltar aos quadros
          </button>
        )}
      </section>
    </div>
  )
}
