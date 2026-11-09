import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { escolherTextoJson } from '../lib/arquivosDaFicha'
import { importarFichasDoProjetoRpg, type ResultadoDaImportacao } from '../lib/importarDoProjetoRpg'
import { temLivro } from '../lib/livroDeRegras'
import { moverFichaParaPasta, pastaDaFicha, type PastaDeFichas } from '../lib/pastasDeFichas'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { buildTokenPhotoData } from '../lib/tokenPhoto'
import { herdaDaPasta, pastasDeFichasAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { useMundoDoLivroStore } from '../stores/mundoDoLivroStore'
import type { TamanhoDaVista } from '../stores/criarToken'
import { ligarFichaAosTokens } from '../stores/ligarFichaNoToken'
import { casaSobOPonteiro, porPersonagemNoMapa, tokenSobOPonteiro, type CasaDoSoltar } from '../stores/porPersonagemNoMapa'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { useToastStore } from '../stores/toastStore'
import { comAventura } from '../stores/virarAventura'
import { useAbertaGuardada } from './CollapsibleSection'
import { ImagemOuIniciais } from './FichaPecas'
import { Botao } from './grimorio/Botao'
import { Ficha } from './grimorio/Ficha'
import { SearchIcon } from './icons'
import { ListaDePersonagens, pastasComANova } from './ListaDePersonagens'
import { IconeDoLivro } from './livro/icones'
import './FichaDePersonagem.css'

/** O token sob o ponteiro durante o arrasto: o disco dele na tela, o nome e quantos tokens a ficha vai ligar. */
export interface TokenNaTela {
  tela: { x: number; y: number; lado: number }
  nome: string
  quantos: number
}

export interface PersonagensSectionProps {
  /** O sistema da aventura; `undefined` quando ela não tem (ou ele não está neste computador). */
  sistema: SistemaDeRpg | undefined
  /** O id gravado na aventura, para dizer qual sistema falta. */
  sistemaId: string | undefined
  personagens: readonly Personagem[]
  /** "Livro de regras"; ausente = o sistema da aventura não tem livro (sem botão). */
  onAbrirLivro?: () => void
  onAbrirFicha: (personagemId: string) => void
  onCriar: () => void
  onApagar: (personagemId: string) => void
  /** "Importar personagens…": devolve o resumo (`null` = cancelou). Lança com a razão. */
  onImportar: () => Promise<ResultadoDaImportacao | null>
  /** PASTAS DE MAPAS: o nome da pasta quando os personagens são os dela. Ausente = os do mapa. */
  nomeDaPasta?: string
  /**
   * MUNDO DO LIVRO (M1): "Abrir o mundo do <sistema>", por cima do mapa.
   * Ausente = o mapa não herda o sistema de uma pasta (sem botão).
   */
  onAbrirMundo?: () => void
  /**
   * ARRASTAR PARA O MAPA: a casa sob o ponteiro (px de janela) para o realce,
   * `null` fora do mapa. Ausente = a lista não arrasta (só abre a ficha).
   */
  casaNaTela?: (clientX: number, clientY: number) => CasaDoSoltar['tela'] | null
  /** SOLTAR EM CIMA DO TOKEN: o token sob o ponteiro (ganha da casa), `null` = nenhum. */
  tokenNaTela?: (clientX: number, clientY: number) => TokenNaTela | null
  /** Soltou a linha no ponto da tela: `true` = era o mapa (o token nasce, ou a ficha liga ao token de lá). */
  onSoltarNoMapa?: (personagem: Personagem, clientX: number, clientY: number) => boolean
  /** PASTAS DO MESTRE: as de agora e o gravador. Ausente = a lista só tem os grupos. */
  pastas?: readonly PastaDeFichas[]
  onSalvarPastas?: (pastas: readonly PastaDeFichas[]) => void
}

/** Quanto o ponteiro anda (px) antes de o aperto virar arrasto; abaixo disso é clique (o do acervo de tokens). */
const LIMIAR_DO_ARRASTO_PX = 6
/** O anel do token-alvo passa um pouco do disco: o mestre vê o token por dentro dele. */
const FOLGA_DO_ANEL_PX = 10

interface ApertoNaLinha {
  personagem: Personagem
  pointerId: number
  inicio: { x: number; y: number }
  arrastando: boolean
  cancelado: boolean
}

function posicionarFantasma(fantasma: HTMLElement, ponto: { x: number; y: number }): void {
  fantasma.style.transform = `translate(${ponto.x}px, ${ponto.y}px) translate(-50%, -50%)`
}

/** O realce da casa de destino; some (`hidden`) fora do mapa. Estilo direto: anda a cada `pointermove`. */
function posicionarRealce(realce: HTMLElement, casa: CasaDoSoltar['tela'] | null): void {
  realce.hidden = casa === null
  realce.dataset.alvo = 'casa'
  delete realce.dataset.rotulo
  if (casa === null) return
  realce.style.width = `${casa.lado}px`
  realce.style.height = `${casa.lado}px`
  realce.style.transform = `translate(${casa.x - casa.lado / 2}px, ${casa.y - casa.lado / 2}px)`
  realce.dataset.redonda = casa.redonda ? 'sim' : 'nao'
}

/** Em cima de um token: o anel em volta dele e o que vai acontecer ("Ligar a Urso", "Ligar a 3 tokens"). */
function posicionarRealceNoToken(realce: HTMLElement, token: TokenNaTela): void {
  const lado = token.tela.lado + FOLGA_DO_ANEL_PX
  realce.hidden = false
  realce.style.width = `${lado}px`
  realce.style.height = `${lado}px`
  realce.style.transform = `translate(${token.tela.x - lado / 2}px, ${token.tela.y - lado / 2}px)`
  realce.dataset.redonda = 'sim'
  realce.dataset.alvo = 'token'
  realce.dataset.rotulo = token.quantos > 1 ? `Ligar a ${token.quantos} tokens` : `Ligar a ${token.nome.trim() || 'este token'}`
}

interface ArrastoDaLista {
  casaNaTela: PersonagensSectionProps['casaNaTela']
  tokenNaTela: PersonagensSectionProps['tokenNaTela']
  onSoltarNoMapa: PersonagensSectionProps['onSoltarNoMapa']
  /** A ficha pode ir para `pastaId` (`null` = fora de pasta)? Não = soltar ali não faz nada. */
  podeIrParaPasta?: (personagem: Personagem, pastaId: string | null) => boolean
  onMoverParaPasta?: (personagem: Personagem, pastaId: string | null) => void
}

/** A pasta (ou o grupo, "fora de pasta") do painel sob o ponteiro, se a ficha pode ir para lá. */
function pastaSobOPonteiro(clientX: number, clientY: number, personagem: Personagem, pode: ArrastoDaLista['podeIrParaPasta']): { el: HTMLElement; pastaId: string | null } | null {
  if (pode === undefined) return null
  const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-solta-pasta]') ?? null
  if (el === null) return null
  const valor = el.dataset.soltaPasta ?? ''
  const pastaId = valor === '' ? null : valor
  return pode(personagem, pastaId) ? { el, pastaId } : null
}

/**
 * O gesto de arrastar uma linha, no molde do acervo de tokens
 * (`TokenLibraryPanel`): ouvintes de janela só durante o aperto, limiar de
 * 6 px entre clique e arrasto, Esc desiste, e o `click` que o navegador manda
 * depois do soltar não abre a ficha. Três destinos, nesta ordem: uma pasta
 * do mestre (ou um grupo, para tirar da pasta), um token do mapa (liga a
 * ficha a ele) e uma casa vazia do mapa (o token nasce ali).
 */
function useArrastoParaOMapa({ casaNaTela, tokenNaTela, onSoltarNoMapa, podeIrParaPasta, onMoverParaPasta }: ArrastoDaLista) {
  const [arrastado, setArrastado] = useState<Personagem | null>(null)
  const apertoRef = useRef<ApertoNaLinha | null>(null)
  const ultimoPontoRef = useRef({ x: 0, y: 0 })
  const fantasmaRef = useRef<HTMLDivElement | null>(null)
  const realceRef = useRef<HTMLDivElement | null>(null)
  const engolirCliqueRef = useRef(false)
  const soltarOuvintesRef = useRef<(() => void) | null>(null)
  const pastaMarcadaRef = useRef<HTMLElement | null>(null)

  const marcarPasta = (el: HTMLElement | null) => {
    if (pastaMarcadaRef.current === el) return
    if (pastaMarcadaRef.current !== null) delete pastaMarcadaRef.current.dataset.alvoDoSoltar
    pastaMarcadaRef.current = el
    if (el !== null) el.dataset.alvoDoSoltar = 'sim'
  }

  // Seção desmontada no meio do arrasto (troca de página): os ouvintes não sobrevivem a ela.
  useEffect(
    () => () => {
      soltarOuvintesRef.current?.()
      if (pastaMarcadaRef.current !== null) delete pastaMarcadaRef.current.dataset.alvoDoSoltar
    },
    [],
  )

  /** O destino sob o ponteiro, desenhado: a pasta acende, ou o anel do token, ou a casa. */
  const desenharAlvo = (personagem: Personagem, x: number, y: number) => {
    const pasta = pastaSobOPonteiro(x, y, personagem, podeIrParaPasta)
    marcarPasta(pasta?.el ?? null)
    const realce = realceRef.current
    if (realce === null) return
    if (pasta !== null) {
      posicionarRealce(realce, null)
      return
    }
    const token = tokenNaTela?.(x, y) ?? null
    if (token !== null) posicionarRealceNoToken(realce, token)
    else posicionarRealce(realce, casaNaTela?.(x, y) ?? null)
  }

  const comecar = (event: ReactPointerEvent<HTMLButtonElement>, personagem: Personagem) => {
    if (casaNaTela === undefined || onSoltarNoMapa === undefined || event.button !== 0 || !event.isPrimary) return
    soltarOuvintesRef.current?.()
    engolirCliqueRef.current = false
    apertoRef.current = { personagem, pointerId: event.pointerId, inicio: { x: event.clientX, y: event.clientY }, arrastando: false, cancelado: false }

    const mover = (e: PointerEvent) => {
      const aperto = apertoRef.current
      if (aperto === null || e.pointerId !== aperto.pointerId || aperto.cancelado) return
      ultimoPontoRef.current = { x: e.clientX, y: e.clientY }
      if (!aperto.arrastando) {
        if (Math.hypot(e.clientX - aperto.inicio.x, e.clientY - aperto.inicio.y) < LIMIAR_DO_ARRASTO_PX) return
        aperto.arrastando = true
        setArrastado(aperto.personagem)
      }
      if (fantasmaRef.current !== null) posicionarFantasma(fantasmaRef.current, ultimoPontoRef.current)
      desenharAlvo(aperto.personagem, e.clientX, e.clientY)
    }

    const encerrar = (e: PointerEvent, soltou: boolean) => {
      const aperto = apertoRef.current
      if (aperto === null || e.pointerId !== aperto.pointerId) return
      soltarOuvintesRef.current?.()
      apertoRef.current = null
      if (!aperto.arrastando) return
      setArrastado(null)
      marcarPasta(null)
      // O `click` chega logo depois deste `pointerup`; o `setTimeout` libera o próximo clique de verdade.
      engolirCliqueRef.current = true
      setTimeout(() => {
        engolirCliqueRef.current = false
      }, 0)
      if (!soltou || aperto.cancelado) return
      const pasta = pastaSobOPonteiro(e.clientX, e.clientY, aperto.personagem, podeIrParaPasta)
      if (pasta !== null) onMoverParaPasta?.(aperto.personagem, pasta.pastaId)
      else onSoltarNoMapa(aperto.personagem, e.clientX, e.clientY)
    }
    const aoSoltar = (e: PointerEvent) => encerrar(e, true)
    const aoCancelar = (e: PointerEvent) => encerrar(e, false)
    // Esc desiste, na CAPTURA e parando ali: chegando ao mapa, largaria a seleção.
    const aoTeclar = (e: KeyboardEvent) => {
      const aperto = apertoRef.current
      if (e.key !== 'Escape' || aperto === null || !aperto.arrastando || aperto.cancelado) return
      e.preventDefault()
      e.stopImmediatePropagation()
      aperto.cancelado = true
      marcarPasta(null)
      setArrastado(null)
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('pointercancel', aoCancelar)
    window.addEventListener('keydown', aoTeclar, true)
    soltarOuvintesRef.current = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoCancelar)
      window.removeEventListener('keydown', aoTeclar, true)
      soltarOuvintesRef.current = null
    }
  }

  const fantasma =
    arrastado === null
      ? null
      : // Portal no `body`: o painel tem rolagem e recorte, e o fantasma anda por cima do mapa inteiro.
        // `aria-hidden`: eco visual do gesto; o leitor de tela já tem o botão.
        createPortal(
          <>
            <div
              className="lb-rpg__casa-alvo"
              aria-hidden="true"
              ref={(el) => {
                realceRef.current = el
                if (el !== null) desenharAlvo(arrastado, ultimoPontoRef.current.x, ultimoPontoRef.current.y)
              }}
            />
            <div
              className="lb-rpg__fantasma"
              aria-hidden="true"
              ref={(el) => {
                fantasmaRef.current = el
                if (el !== null) posicionarFantasma(el, ultimoPontoRef.current)
              }}
            >
              <span className="lb-rpg__fantasma-retrato">
                <ImagemOuIniciais imagem={arrastado.retrato} nome={arrastado.nome} />
              </span>
              <span className="lb-rpg__fantasma-nome">{arrastado.nome || 'Personagem'}</span>
            </div>
          </>,
          document.body,
        )

  return { comecar, engolirClique: () => engolirCliqueRef.current, fantasma, arrastando: arrastado !== null }
}

/** A frase do resultado: quantos entraram, com os nomes, e quantos NPCs ficaram de fora. */
export function resumoDaImportacao(resultado: ResultadoDaImportacao): string {
  const n = resultado.personagens.length
  const nomes = resultado.personagens.map((personagem) => personagem.nome).join(', ')
  const entrou = n === 0 ? 'Nenhum personagem entrou.' : `${n} ${n === 1 ? 'personagem entrou' : 'personagens entraram'}: ${nomes}.`
  const fora = resultado.npcsIgnorados === 0 ? '' : ` ${resultado.npcsIgnorados} ${resultado.npcsIgnorados === 1 ? 'NPC ficou' : 'NPCs ficaram'} de fora.`
  return `${entrou}${fora}`
}

const SEM_PASTAS: readonly PastaDeFichas[] = []

/**
 * "Livro de regras" (quando o sistema tem) e "Personagens" na aba Jogo, logo
 * abaixo da Sala: é durante a mesa que o mestre abre ficha e consulta regra.
 * O "Sistema de RPG" mora na janela Configurações do mapa. Aparece também no
 * mapa solto: criar ou importar ali pergunta antes se o mapa vira aventura,
 * porque personagens e sistema moram no `adventure.json`.
 *
 * A lista (pedido de 09/11/2026) tem busca no topo, as pastas do mestre e os
 * grupos que fecham (`ListaDePersonagens`).
 */
export function PersonagensSection({
  sistema,
  sistemaId,
  personagens,
  onAbrirLivro,
  onAbrirFicha,
  onCriar,
  onApagar,
  onImportar,
  nomeDaPasta,
  onAbrirMundo,
  casaNaTela,
  tokenNaTela,
  onSoltarNoMapa,
  pastas = SEM_PASTAS,
  onSalvarPastas,
}: PersonagensSectionProps) {
  const [aberta, setAberta] = useAbertaGuardada('personagens', false)
  const copiaIds = new Set(personagens.filter((personagem) => personagem.combate?.modeloId !== undefined && personagens.some((outro) => outro.id === personagem.combate?.modeloId)).map((personagem) => personagem.id))
  const arrasto = useArrastoParaOMapa({
    casaNaTela,
    tokenNaTela,
    onSoltarNoMapa,
    // A cópia anda com o modelo (não vai sozinha para uma pasta); e soltar onde ela já está não é mudança.
    podeIrParaPasta:
      onSalvarPastas === undefined || pastas.length === 0
        ? undefined
        : (personagem, pastaId) => !copiaIds.has(personagem.id) && (pastaDaFicha(pastas, personagem.id)?.id ?? null) !== pastaId,
    onMoverParaPasta: (personagem, pastaId) => {
      const novas = moverFichaParaPasta(pastas, personagem.id, pastaId)
      if (novas !== pastas) onSalvarPastas?.(novas)
    },
  })
  const arrasta = casaNaTela !== undefined && onSoltarNoMapa !== undefined
  const [busca, setBusca] = useState('')
  const [pastaNova, setPastaNova] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; texto: string; avisos: string[] } | null>(null)
  const idDaBusca = useId()

  const importar = async () => {
    setImportando(true)
    setEstado(null)
    try {
      const resultado = await onImportar()
      if (resultado !== null) setEstado({ tipo: 'ok', texto: resumoDaImportacao(resultado), avisos: resultado.avisos })
    } catch (erro) {
      setEstado({ tipo: 'erro', texto: `Não deu para importar: ${erro instanceof Error ? erro.message : String(erro)}`, avisos: [] })
    } finally {
      setImportando(false)
    }
  }

  const criarPasta = (comFicha?: string) => {
    if (onSalvarPastas === undefined) return
    const { pastas: novas, id } = pastasComANova(pastas, comFicha)
    onSalvarPastas(novas)
    setBusca('')
    setPastaNova(id)
  }

  return (
    <>
      {onAbrirLivro !== undefined && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--block lb-rpg__livro" onClick={onAbrirLivro}>
          Livro de regras
        </button>
      )}
      {/* h3: o livro da mesa já tem o h2 "Sala" acima. Recolhida, com a contagem no resumo. */}
      <Ficha titulo="Personagens" icone={<IconeDoLivro nome="ficha" />} resumo={personagens.length > 0 ? String(personagens.length) : undefined} aberta={aberta} onAlternar={setAberta}>
        <div className="lb-rpg">
          {/* Mexer aqui é mexer em todos os mapas da pasta: o mestre precisa saber antes do −/+. */}
          {nomeDaPasta !== undefined && <p className="lb-field__hint">Da pasta &quot;{nomeDaPasta}&quot;: a mesma ficha em todos os mapas dela.</p>}
          {personagens.length > 0 && (
            <div className="lb-rpg__topo">
              {/* O nome do campo é do leitor de tela: a lupa e o texto de exemplo dizem o que ele é. */}
              <label className="gr-sr" htmlFor={idDaBusca}>
                Buscar personagem
              </label>
              <div className="lb-objetos__campo lb-rpg__busca">
                <span className="lb-objetos__lupa" aria-hidden="true">
                  <SearchIcon size={16} />
                </span>
                <input
                  id={idDaBusca}
                  type="search"
                  className="lb-input lb-objetos__busca"
                  placeholder="Buscar nome"
                  value={busca}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setBusca(event.target.value)}
                  onKeyDown={(event) => {
                    // Esc limpa a busca e para aqui: no editor ele largaria a seleção do mapa.
                    if (event.key === 'Escape' && busca !== '') {
                      event.preventDefault()
                      event.stopPropagation()
                      setBusca('')
                    }
                  }}
                />
              </div>
              {onSalvarPastas !== undefined && (
                // "+ Pasta" no molde do "+ Personagem" logo abaixo.
                <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact lb-rpg__nova-pasta" title="Nova pasta: arraste fichas para ela" onClick={() => criarPasta()}>
                  + Pasta
                </button>
              )}
            </div>
          )}
          {personagens.length === 0 ? (
            <p className="lb-rpg__vazio">Nenhum personagem ainda.</p>
          ) : (
            <ListaDePersonagens
              personagens={personagens}
              pastas={pastas}
              busca={busca}
              arrastando={arrasto.arrastando}
              arrasta={arrasta}
              onSalvarPastas={onSalvarPastas}
              pastaNova={pastaNova}
              onPastaNovaVista={() => setPastaNova(null)}
              onCriarPasta={criarPasta}
              onApertar={arrasto.comecar}
              engolirClique={arrasto.engolirClique}
              onAbrirFicha={onAbrirFicha}
              onApagar={onApagar}
            />
          )}
          {onAbrirMundo !== undefined && sistema !== undefined && (
            // Botão do grimório: ele dá ao ícone o tamanho certo (o `.lb-btn` não mede SVG).
            <Botao variante="fantasma" largo onClick={onAbrirMundo}>
              <IconeDoLivro nome="livro" />
              Abrir o mundo do {sistema.nome}
            </Botao>
          )}
          {sistema === undefined && (
            <p className="lb-field__hint">
              {sistemaId === undefined
                ? 'Escolha o sistema de RPG em Configurações do mapa (a engrenagem do painel) para criar e importar personagens.'
                : `O sistema ${sistemaId} não está neste computador: importe-o em Configurações do mapa para criar e importar personagens.`}
            </p>
          )}
          <div className="lb-cenas__acoes">
            <button type="button" className="lb-btn" disabled={sistema === undefined} onClick={onCriar}>
              + Personagem
            </button>
            <button type="button" className="lb-btn lb-btn--ghost" disabled={sistema === undefined || importando} onClick={() => void importar()}>
              {importando ? 'Importando…' : 'Importar personagens…'}
            </button>
          </div>
          {estado !== null && (
            <div className="lb-rpg__estado" role={estado.tipo === 'erro' ? 'alert' : 'status'}>
              <p className={estado.tipo === 'erro' ? 'lb-field__error' : 'lb-field__hint'}>{estado.texto}</p>
              {estado.avisos.length > 0 && (
                <ul className="lb-rpg__avisos">
                  {estado.avisos.map((aviso, i) => (
                    <li key={i}>{aviso}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Ficha>
      {arrasto.fantasma}
    </>
  )
}

export interface PersonagensDaAventuraProps {
  /** Mapa solto: pergunta e vira aventura antes de criar ou importar (`garantirAventura`). `true` = pode seguir. */
  garantirAventura: () => Promise<boolean>
  /**
   * O "Livro de regras" acima dos Personagens. No livro da mesa só com a sala
   * fechada (com ela aberta ele mora na página Mesa, `BotaoDoLivroDeRegras`).
   * Padrão: com o livro.
   */
  comLivro?: boolean
  /**
   * ARRASTAR PARA O MAPA: o elemento do canvas do editor (o mesmo do soltar do
   * acervo) e o tamanho da vista. Ausente = a lista não arrasta.
   */
  mapa?: { host: () => HTMLElement | null; vista: () => TamanhoDaVista | null }
}

/** Abre o livro do sistema em uso; `undefined` quando o sistema não tem livro (ou o mapa não tem sistema). */
function useAbrirLivroDeRegras(): (() => void) | undefined {
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const sistema = sistemaPorId(biblioteca, sistemaId)
  return sistema !== undefined && temLivro(sistema) ? () => useRpgStore.getState().abrirLivro() : undefined
}

/** "Livro de regras" sozinho, para a página Mesa do livro da mesa; some quando o sistema não tem livro. */
export function BotaoDoLivroDeRegras() {
  const abrirLivro = useAbrirLivroDeRegras()
  if (abrirLivro === undefined) return null
  return (
    <button type="button" className="gr-bt gr-bt--p lb-rpg__livro-mesa" onClick={abrirLivro}>
      <IconeDoLivro nome="livro" />
      Livro de regras
    </button>
  )
}

/**
 * A seção ligada às stores: o sistema e os personagens EM USO
 * (`sistemaAtivo`/`personagensAtivos`: os da pasta de mapas quando o mapa
 * herda, senão os da aventura; nenhum no mapa solto), as pastas do mestre do
 * mesmo dono, a biblioteca de sistemas e as janelas (`RpgDialogs`).
 */
export function PersonagensDaAventura({ garantirAventura, comLivro = true, mapa }: PersonagensDaAventuraProps) {
  const sistemaId = useAdventureStore(sistemaAtivo)
  const personagens = useAdventureStore(personagensAtivos)
  const pastas = useAdventureStore(pastasDeFichasAtivas)
  const nomeDaPasta = useAdventureStore((state) => (herdaDaPasta(state) && state.pasta !== null ? state.pasta.nome : undefined))
  // MUNDO DO LIVRO: só quando o mapa herda da pasta ("Configurar só neste mapa" fica fora do mundo).
  const pastaId = useAdventureStore((state) => (herdaDaPasta(state) && state.pasta !== null ? state.pasta.pastaId : undefined))
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const carregarBiblioteca = useRpgStore((state) => state.carregarBiblioteca)
  const abrirLivro = useAbrirLivroDeRegras()
  // Sistema importado só se acha depois de ler a pasta: lida uma vez, na primeira vez que a seção aparece.
  useEffect(() => {
    void carregarBiblioteca()
  }, [carregarBiblioteca])
  const sistema = sistemaPorId(biblioteca, sistemaId)

  return (
    <PersonagensSection
      sistema={sistema}
      sistemaId={sistemaId}
      personagens={personagens}
      nomeDaPasta={nomeDaPasta}
      pastas={pastas}
      onSalvarPastas={(novas) => {
        if (!useAdventureStore.getState().salvarPastasDeFichas(novas)) useToastStore.getState().push('error', 'Não deu para guardar a pasta: este mapa ainda não é uma aventura nem está numa pasta com sistema.')
      }}
      onAbrirLivro={comLivro ? abrirLivro : undefined}
      onAbrirMundo={
        pastaId === undefined || sistemaId === undefined
          ? undefined
          : () => void useMundoDoLivroStore.getState().abrir({ sistemaId, pastaId, origem: 'editor' })
      }
      onAbrirFicha={(id) => useRpgStore.getState().abrirFicha(id)}
      casaNaTela={mapa === undefined ? undefined : (clientX, clientY) => casaSobOPonteiro(mapa.host(), clientX, clientY)?.tela ?? null}
      tokenNaTela={
        mapa === undefined
          ? undefined
          : (clientX, clientY) => {
              const token = tokenSobOPonteiro(mapa.host(), clientX, clientY)
              return token === null ? null : { tela: token.tela, nome: token.nome, quantos: token.tokenIds.length }
            }
      }
      onSoltarNoMapa={
        mapa === undefined
          ? undefined
          : (personagem, clientX, clientY) => {
              // Em cima de um token, a ficha LIGA a ele (ou à seleção de vários); fora de token, nasce um token novo.
              const token = tokenSobOPonteiro(mapa.host(), clientX, clientY)
              if (token !== null) {
                void ligarFichaAosTokens(personagem.id, token.tokenIds)
                return true
              }
              const casa = casaSobOPonteiro(mapa.host(), clientX, clientY)
              if (casa === null) return false
              void porPersonagemNoMapa(personagem, casa.mundo, mapa.vista())
              return true
            }
      }
      onCriar={() => {
        if (sistema === undefined) return
        comAventura(garantirAventura, () => {
          const personagem = novoPersonagem(sistema, 'jogador', '')
          if (useAdventureStore.getState().salvarPersonagem(personagem)) useRpgStore.getState().abrirFicha(personagem.id, true)
        })
      }}
      onApagar={(id) => useAdventureStore.getState().apagarPersonagem(id)}
      onImportar={async () => {
        if (sistema === undefined || !(await garantirAventura())) return null
        const texto = await escolherTextoJson('Importar personagens do projeto-rpg-v2', 'Fichas do projeto-rpg-v2')
        if (texto === null) return null
        const atuais = personagensAtivos(useAdventureStore.getState())
        const resultado = await importarFichasDoProjetoRpg(texto, sistema, atuais, { reduzirImagem: buildTokenPhotoData })
        useAdventureStore.getState().adicionarPersonagens(resultado.personagens)
        return resultado
      }}
    />
  )
}
