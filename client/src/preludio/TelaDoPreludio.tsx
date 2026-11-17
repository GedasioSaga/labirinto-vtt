import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LabyrinthMark } from '../components/icons'
import { ROTULO_DO_TIPO } from '../lib/preparo/enciclopedia'
import { esquecerTabelaDeMidia } from '../lib/preparo/quadros'
import type { Campanha, LigaCena } from '../lib/preparo/tipos'
import { BuscaGeral } from './busca/BuscaGeral'
import { PainelDaCopia } from './copia/PainelDaCopia'
import { precarregarEditor } from './editor/sobDemanda'
import { CampanhasESistemas } from './campanhas/CampanhasESistemas'
import { ListaDeVerbetes } from './enciclopedia/ListaDeVerbetes'
import { LugaresEmRegioes } from './enciclopedia/pastas/LugaresEmRegioes'
import { TIPOS_COM_PASTAS, VerbetesEmPastas } from './enciclopedia/pastas/VerbetesEmPastas'
import { PaginaDoVerbete } from './enciclopedia/PaginaDoVerbete'
import { Escrita } from './escrita/Escrita'
import { lugarDeCima, usePreludio, type Lugar } from './estado/preludio'
import { PainelDaImportacao } from './importar/PainelDaImportacao'
import { Lado } from './Lado'
import { useCatalogoDaMesa } from './mesa/catalogo'
import { useQuadros } from './quadro/estadoDosQuadros'
import { Quadros } from './quadro/Quadros'
import { precarregarQuadro } from './quadro/sobDemanda'
import { definirAberturaNaMesa } from './mesa/ponte'
import { Sessoes } from './sessoes/Sessoes'
import { LinhaDoTempo } from './tempo/LinhaDoTempo'
import { TITULO_DO_PRELUDIO } from './textos'
import '../screens/MainMenu.css'
import '../components/grimorio/grimorio.css'
import './preludio.css'

interface TelaDoPreludioProps {
  onBack: () => void
  /** Abre o mapa do link na cena e no pino (o App sabe trocar de mapa); sem ela, o link de cena só não abre. */
  aoAbrirNaMesa?: (alvo: LigaCena) => void
  /**
   * PRELÚDIO EM JANELA PRÓPRIA (P1): não há menu para onde voltar, e importar do
   * Grimório e a cópia no Google Drive ficam no Prelúdio da janela principal
   * (a janela do Prelúdio não tem esses comandos nem o plugin de arquivos).
   */
  naJanela?: boolean
}

const SO_NA_PRINCIPAL = 'Importar do Grimório e a cópia no Google Drive ficam no Prelúdio da janela principal do Labirinto.'

const NADA_AINDA =
  'Nada preparado ainda. Aqui moram a Enciclopédia (personagens, lugares, itens, facções) e a Escrita das campanhas; dá para começar importando as campanhas do Grimório, logo abaixo.'

/** "One Piece, Dragon Ball e Geonova": os nomes vêm do disco e entram como texto. */
function frasesDasCampanhas(campanhas: readonly Campanha[], verbetes: number): string {
  if (campanhas.length === 0 && verbetes === 0) return NADA_AINDA
  const nomes = new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(campanhas.map((campanha) => campanha.nome))
  const deCampanhas = campanhas.length === 0 ? 'Nenhuma campanha ainda.' : campanhas.length === 1 ? `1 campanha no Prelúdio: ${nomes}.` : `${campanhas.length} campanhas no Prelúdio: ${nomes}.`
  return `${deCampanhas} ${verbetes === 1 ? '1 verbete' : `${verbetes} verbetes`} entre a Enciclopédia e a Escrita.`
}

type NomeDe = (id: string) => string | undefined

/** Um pedaço da trilha do topo: o nome e o lugar aonde ele leva. */
interface PassoDaTrilha {
  readonly rotulo: string
  readonly lugar: Lugar
}

/** O nome de cada lugar na trilha do topo. */
function rotuloDe(lugar: Lugar, tituloDe: NomeDe, nomeDoQuadro: NomeDe): string {
  switch (lugar.secao) {
    case 'inicio':
      return TITULO_DO_PRELUDIO
    case 'enciclopedia':
      if (lugar.verbeteId !== null) return tituloDe(lugar.verbeteId) || 'Sem nome'
      return lugar.tipo === 'todos' ? 'Enciclopédia' : ROTULO_DO_TIPO[lugar.tipo].varios
    case 'escrita':
      return lugar.paginaId === null ? 'Escrita' : (tituloDe(lugar.paginaId) || 'Sem nome')
    case 'sessoes':
      if (lugar.sessaoId === null) return 'Sessões'
      return lugar.aba === 'quadro' ? 'Quadro' : (tituloDe(lugar.sessaoId) || 'Sessão sem nome')
    case 'quadros': {
      if (lugar.quadroId === null) return 'Quadros'
      // A lista dos quadros ainda não lida diz só "Quadro"; o quadro sem nome se diz assim.
      const nome = nomeDoQuadro(lugar.quadroId)
      return nome === undefined ? 'Quadro' : nome || 'Quadro sem nome'
    }
    case 'campanhas':
      return 'Campanhas e sistemas'
    case 'tempo':
      return 'Linha do tempo'
  }
}

/** Onde a pessoa está, para a trilha do topo: do Prelúdio (o Início) até o lugar, um nível por vez. */
function trilhaDe(lugar: Lugar, tituloDe: NomeDe, nomeDoQuadro: NomeDe): PassoDaTrilha[] {
  const trilha: PassoDaTrilha[] = []
  for (let nivel: Lugar | null = lugar; nivel !== null; nivel = lugarDeCima(nivel)) trilha.unshift({ rotulo: rotuloDe(nivel, tituloDe, nomeDoQuadro), lugar: nivel })
  return trilha
}

/** O botão de voltar do mouse (o do lado, perto do polegar) é o `button` 3 nos eventos do navegador. */
const BOTAO_VOLTAR_DO_MOUSE = 3

function emCampoDeTexto(alvo: EventTarget | null): boolean {
  return alvo instanceof HTMLElement && (alvo.isContentEditable || alvo.closest('input, textarea, select') !== null)
}

/** Uma caixa aberta por cima (a busca, uma pergunta): voltar não passa por trás dela. */
function caixaAberta(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"], dialog[open]') !== null
}

interface InicioProps {
  importando: boolean
  aoImportar: (importando: boolean) => void
  aoRestaurar: (restaurando: boolean) => void
  pedidoDeCopia: number
  aoPedirCopia: () => void
  naJanela: boolean
}

function Inicio({ importando, aoImportar, aoRestaurar, pedidoDeCopia, aoPedirCopia, naJanela }: InicioProps) {
  const carga = usePreludio((estado) => estado.carga)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const total = usePreludio((estado) => estado.verbetes.size)
  const avisos = usePreludio((estado) => estado.avisos)
  const carregar = usePreludio((estado) => estado.carregar)
  const antesDeRestaurar = usePreludio((estado) => estado.antesDeRestaurar)
  const depoisDeRestaurar = usePreludio((estado) => estado.depoisDeRestaurar)
  const ir = usePreludio((estado) => estado.ir)
  return (
    <div className="pr-inicio">
      {carga.t === 'lendo' || carga.t === 'fechada' ? (
        <section className="lb-wip" aria-busy="true" aria-label="Abrindo o Prelúdio" />
      ) : (
        <section className="lb-wip" aria-label="Prelúdio">
          <svg className="lb-wip__scaffold" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <path d="M60 34c-12-8-28-10-44-8v66c16-2 32 0 44 8 12-8 28-10 44-8V26c-16-2-32 0-44 8z" />
            <path d="M60 34v66M28 48h20M28 60h20M28 72h14M72 48h20M72 60h20M72 72h14" />
          </svg>
          <p className="lb-wip__text">{carga.t === 'falhou' ? NADA_AINDA : frasesDasCampanhas(campanhas, total)}</p>
          {carga.t === 'falhou' && (
            <p className="lb-wip__text" role="alert">
              {carga.aviso}
            </p>
          )}
          {avisos.length > 0 && (
            <p className="lb-wip__text" role="status">
              {avisos.length === 1 ? avisos[0] : `${avisos.length} verbetes não abriram: ${avisos[0]}`}
            </p>
          )}
          {carga.t === 'pronta' && total > 0 && (
            <div className="pr-inicio__atalhos">
              <button type="button" className="gr-bt gr-bt--latao" onClick={() => ir({ secao: 'enciclopedia', tipo: 'todos', verbeteId: null })}>
                Abrir a Enciclopédia
              </button>
              <button type="button" className="gr-bt gr-bt--fantasma" onClick={() => ir({ secao: 'escrita', paginaId: null })}>
                Abrir a Escrita
              </button>
            </div>
          )}
        </section>
      )}
      {naJanela ? (
        <p className="pr-quieto pr-inicio__so-na-principal">{SO_NA_PRINCIPAL}</p>
      ) : (
        <>
          <PainelDaImportacao
            onAplicado={() => {
              // A importação traz a tabela de mídia nova: o próximo quadro aberto a relê.
              esquecerTabelaDeMidia()
              void carregar()
            }}
            onPedirCopia={aoPedirCopia}
            onGravando={aoImportar}
          />
          <PainelDaCopia
            pedidoDeCopia={pedidoDeCopia}
            travado={importando}
            antesDeRestaurar={() => {
              aoRestaurar(true)
              return antesDeRestaurar()
            }}
            depoisDeRestaurar={async (restaurou) => {
              if (restaurou) esquecerTabelaDeMidia()
              await depoisDeRestaurar(restaurou)
              aoRestaurar(false)
            }}
          />
        </>
      )}
    </div>
  )
}

/**
 * O PRELÚDIO, a preparação de sessão (plano §1): a barra lateral com as seções
 * e, no palco, o Início (importar do Grimório e cópia no Google Drive, com a
 * cópia diária ao abrir), as Sessões, os Quadros, a Enciclopédia e a Escrita. Ctrl+K
 * busca em tudo.
 */
export function TelaDoPreludio({ onBack, aoAbrirNaMesa, naJanela = false }: TelaDoPreludioProps) {
  const carga = usePreludio((estado) => estado.carga)
  const lugar = usePreludio((estado) => estado.lugar)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const carregar = usePreludio((estado) => estado.carregar)
  const travar = usePreludio((estado) => estado.travar)
  const salvarPendentes = usePreludio((estado) => estado.salvarPendentes)
  const ir = usePreludio((estado) => estado.ir)
  const voltarUmPasso = usePreludio((estado) => estado.voltarUmPasso)
  const podeVoltar = usePreludio((estado) => estado.historico.length > 0 || lugarDeCima(estado.lugar) !== null)
  const naoSalvou = usePreludio((estado) => estado.salvamento.t === 'falhou')
  const listaDosQuadros = useQuadros((estado) => estado.lista)
  const [pedidoDeCopia, setPedidoDeCopia] = useState(0)
  const [importando, setImportando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [buscando, setBuscando] = useState(false)
  /** Pediu para sair com algo que não gravou: o rodapé da barra pergunta antes. */
  const [pedindoSaida, setPedindoSaida] = useState(false)
  // Importar e restaurar gravam em preparo/: sair no meio deixaria a tela sem o aviso de como terminou.
  const gravando = importando || restaurando

  useEffect(() => {
    void carregar()
    return () => {
      void usePreludio.getState().fechar()
    }
  }, [carregar])

  // A porta para o mapa vale enquanto a tela está aberta. A função do App nasce de novo a cada desenho dele: a porta chama sempre a mais nova.
  const abrirNaMesa = useRef(aoAbrirNaMesa)
  useLayoutEffect(() => {
    abrirNaMesa.current = aoAbrirNaMesa
  })
  const temPorta = aoAbrirNaMesa !== undefined
  useEffect(() => {
    definirAberturaNaMesa(temPorta ? (alvo) => abrirNaMesa.current?.(alvo) : null)
    return () => definirAberturaNaMesa(null)
  }, [temPorta])

  // Ao abrir, a lista de mapas, cenas e fichas é relida: pode ter mudado no editor.
  useEffect(() => {
    useCatalogoDaMesa.getState().esquecer()
  }, [])

  useEffect(() => {
    travar('importacao', importando)
  }, [importando, travar])

  // Gravou depois do "Tentar de novo": a pergunta de saída não tem mais razão de ser.
  useEffect(() => {
    if (!naoSalvou) setPedindoSaida(false)
  }, [naoSalvou])

  // Na Enciclopédia e na Escrita o editor vai ser preciso (nos Quadros, o tldraw); no Início, o que mudou vai já para o disco (a importação lê o disco).
  useEffect(() => {
    if (lugar.secao === 'inicio') void salvarPendentes()
    else if (lugar.secao === 'quadros') precarregarQuadro()
    else {
      precarregarEditor()
      // A sessão tem a aba Quadro: o tldraw já vem baixando enquanto o mestre lê o roteiro.
      if (lugar.secao === 'sessoes') precarregarQuadro()
    }
  }, [lugar.secao, salvarPendentes])

  // A lista dos quadros é relida a cada leitura do Prelúdio (ao abrir, e depois de importar ou restaurar).
  useEffect(() => {
    if (carga.t === 'pronta') void useQuadros.getState().recarregar()
  }, [carga.t])

  const sair = useCallback(async () => {
    const tudoNoDisco = await salvarPendentes()
    if (!tudoNoDisco && usePreludio.getState().salvamento.t === 'falhou') setPedindoSaida(true)
    else onBack()
  }, [salvarPendentes, onBack])

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && !evento.altKey && !evento.shiftKey && evento.code === 'KeyK') {
        if (carga.t !== 'pronta') return
        evento.preventDefault()
        setBuscando(true)
        return
      }
      // Esc volta ao menu só no Início, como nas outras telas de menu; nas outras seções ele é do texto e das janelas. Na janela própria não há menu.
      if (evento.key === 'Escape' && !naJanela && !evento.defaultPrevented && lugar.secao === 'inicio' && !buscando && !gravando && !emCampoDeTexto(evento.target) && document.querySelector('[role="dialog"]') === null) {
        void sair()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [carga.t, lugar.secao, buscando, gravando, sair, naJanela])

  // Voltar um passo em qualquer tela do Prelúdio (pedido de 17/11): Alt+← e o botão de voltar do mouse, como no navegador.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'ArrowLeft' || !evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return
      if (emCampoDeTexto(evento.target) || buscando || caixaAberta()) return
      // Na captura, antes do quadro: para o tldraw, Alt+← é o ← que empurra a forma escolhida 1 px. E o WebView voltaria a página dele.
      evento.preventDefault()
      evento.stopPropagation()
      if (!evento.repeat) voltarUmPasso()
    }
    const aoSoltarBotao = (evento: MouseEvent) => {
      if (evento.button !== BOTAO_VOLTAR_DO_MOUSE) return
      evento.preventDefault()
      if (buscando || caixaAberta()) return
      // O mouse não digita: o texto do campo vai para a loja antes de a página sair, como num clique em outro lugar.
      const ativo = document.activeElement
      if (ativo instanceof HTMLElement && emCampoDeTexto(ativo)) ativo.blur()
      voltarUmPasso()
    }
    window.addEventListener('keydown', aoTeclar, { capture: true })
    window.addEventListener('mouseup', aoSoltarBotao)
    return () => {
      window.removeEventListener('keydown', aoTeclar, { capture: true })
      window.removeEventListener('mouseup', aoSoltarBotao)
    }
  }, [buscando, voltarUmPasso])

  const trilha = trilhaDe(
    lugar,
    (id) => verbetes.get(id)?.titulo,
    (id) => (listaDosQuadros.t === 'pronta' ? listaDosQuadros.quadros.find((quadro) => quadro.id === id)?.nome : undefined),
  )
  // O quadro (da lista ou o da sessão) ocupa o palco inteiro: quem rola e aproxima é o tldraw. A sessão aberta
  // também (F3c): lado a lado, cada lado rola por conta própria; em abas, o roteiro rola dentro da sessão.
  const quadroAberto = (lugar.secao === 'quadros' && lugar.quadroId !== null) || (lugar.secao === 'sessoes' && lugar.sessaoId !== null)
  // A trilha começa no Início e termina no lugar de agora: nunca vem vazia.
  const atual = trilha[trilha.length - 1]
  const acima = trilha.slice(0, -1)
  // Sair pela trilha vale o mesmo que o Voltar da barra lateral: nem na janela própria, nem gravando.
  const podeSair = !naJanela && !gravando

  return (
    <div className="pr-tela">
      <div className="lb-appbar">
        <button type="button" className="pr-topo__voltar" disabled={!podeVoltar} onClick={() => voltarUmPasso()} aria-label="Voltar" aria-keyshortcuts="Alt+ArrowLeft" title="Voltar (Alt+←)">
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
        </button>
        <span className="lb-appbar__mark" aria-hidden="true">
          <LabyrinthMark size={16} />
        </span>
        <nav className="lb-appbar__crumbs" aria-label="Posição na navegação">
          <span className="lb-appbar__crumb">
            {podeSair ? (
              <button type="button" className="pr-topo__passo" title="Voltar ao menu do Labirinto" onClick={() => void sair()}>
                Labirinto
              </button>
            ) : (
              'Labirinto'
            )}
          </span>
          {acima.map((passo, indice) => (
            <span key={`${indice}-${passo.rotulo}`} className="lb-appbar__crumb">
              <button type="button" className="pr-topo__passo" onClick={() => ir(passo.lugar)}>
                {passo.rotulo}
              </button>
            </span>
          ))}
          <span className="lb-appbar__crumb lb-appbar__crumb--current" aria-current="page">
            {atual.rotulo}
          </span>
        </nav>
      </div>
      <div className="pr-corpo">
        <Lado
          aoVoltar={gravando || naJanela ? undefined : () => void sair()}
          aoBuscar={() => setBuscando(true)}
          saida={pedindoSaida && naoSalvou && !gravando ? { aoSair: onBack, aoFicar: () => setPedindoSaida(false) } : undefined}
        />
        <main className={`pr-palco${quadroAberto ? ' pr-palco--quadro' : ''}`} aria-busy={carga.t === 'lendo'}>
          {/* O Início fica montado: a importação e a cópia seguem (e terminam) enquanto a pessoa lê um verbete. */}
          <div hidden={lugar.secao !== 'inicio'}>
            <Inicio
              importando={importando}
              aoImportar={setImportando}
              aoRestaurar={setRestaurando}
              pedidoDeCopia={pedidoDeCopia}
              aoPedirCopia={() => setPedidoDeCopia((anterior) => anterior + 1)}
              naJanela={naJanela}
            />
          </div>
          {lugar.secao === 'inicio' ? null : carga.t !== 'pronta' ? (
            <p className="pr-quieto pr-palco__abrindo" role="status">
              {carga.t === 'falhou' ? carga.aviso : 'Abrindo o Prelúdio…'}
            </p>
          ) : lugar.secao === 'enciclopedia' ? (
            lugar.verbeteId === null ? (
              lugar.tipo === 'lugar' ? (
                <LugaresEmRegioes key={lugar.tipo} />
              ) : lugar.tipo !== 'todos' && TIPOS_COM_PASTAS.includes(lugar.tipo) ? (
                <VerbetesEmPastas key={lugar.tipo} tipo={lugar.tipo} />
              ) : (
                <ListaDeVerbetes key={lugar.tipo} tipo={lugar.tipo} />
              )
            ) : (
              <PaginaDoVerbete key={lugar.verbeteId} id={lugar.verbeteId} />
            )
          ) : lugar.secao === 'sessoes' ? (
            <Sessoes sessaoId={lugar.sessaoId} aba={lugar.aba ?? 'roteiro'} alvo={lugar.alvo} />
          ) : lugar.secao === 'quadros' ? (
            <Quadros quadroId={lugar.quadroId} alvo={lugar.alvo} />
          ) : lugar.secao === 'campanhas' ? (
            <CampanhasESistemas naJanela={naJanela === true} />
          ) : lugar.secao === 'tempo' ? (
            <LinhaDoTempo />
          ) : (
            <Escrita paginaId={lugar.paginaId} />
          )}
        </main>
      </div>
      {buscando && <BuscaGeral aoFechar={() => setBuscando(false)} />}
    </div>
  )
}
