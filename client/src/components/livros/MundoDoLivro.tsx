import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { entraNaBatalha } from '../../lib/livros/combate'
import { useMundoDoLivroStore, usePersonagensDoMundo, type AbaDoMundo } from '../../stores/mundoDoLivroStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { usePastaDoMundo } from './comum'
import { GavetaDaFicha } from './GavetaDaFicha'
import { IconeDoMundo, type NomeDoIconeDoMundo } from './icones'
import { PaginaJogadores } from './PaginaJogadores'
import { PaginaNpcs } from './PaginaNpcs'
import '../FichaDePersonagem.css'
import './mundo.css'

/**
 * O MUNDO DE UM LIVRO DE REGRAS (M1, docs/planos/livros-de-regras-plano.md
 * §3): marcadores à esquerda e a página no meio (sem a coluna da IA até a M4,
 * decisão D6). Lê o que está aberto em `useMundoDoLivroStore` e as fichas por
 * `usePersonagensDoMundo`; abre pela tela inicial (dentro da `LivrosScreen`)
 * ou por cima do editor (atalho no livro do mestre), em camada própria.
 * Porte fiel do protótipo aprovado (docs/design/livros-de-regras/).
 */
export interface MundoDoLivroProps {
  /** "Fechar" e Esc: quem montou decide para onde volta (a escolha do sistema, ou o mapa). */
  onFechar: () => void
}

const MARCADORES: readonly { aba: AbaDoMundo; rotulo: string; icone: NomeDoIconeDoMundo }[] = [
  { aba: 'jogadores', rotulo: 'Jogadores', icone: 'jogadores' },
  { aba: 'npcs', rotulo: 'NPCs de combate', icone: 'npc' },
]

/** Os marcadores das próximas fases: aparecem apagados, com "em breve", sem página nem clique. */
const EM_BREVE: readonly { rotulo: string; icone: NomeDoIconeDoMundo }[] = [
  { rotulo: 'Comparar e balancear', icone: 'balanca' },
  { rotulo: 'Saúde da ficha', icone: 'saude' },
  { rotulo: 'Itens e habilidades', icone: 'itens' },
  { rotulo: 'Anotações', icone: 'nota' },
]

const idDaAba = (aba: AbaDoMundo): string => `mu-aba-${aba}`
const ID_DA_PAGINA = 'mu-pagina'

export function MundoDoLivro({ onFechar }: MundoDoLivroProps) {
  const aberto = useMundoDoLivroStore((state) => state.aberto)
  const aba = useMundoDoLivroStore((state) => state.aba)
  const erro = useMundoDoLivroStore((state) => state.erro)
  const personagens = usePersonagensDoMundo()
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const bibliotecaLida = useRpgStore((state) => state.bibliotecaLida)
  const pasta = usePastaDoMundo(aberto?.pastaId)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const marcadoresRef = useRef<HTMLDivElement>(null)
  const fitaRef = useRef<HTMLSpanElement>(null)
  const fitaPosta = useRef(false)
  /** A troca veio das setas: a fita pula sem deslizar (movimento em ação de teclado só atrasa). */
  const trocaPeloTeclado = useRef(false)

  useEffect(() => {
    void useRpgStore.getState().carregarBiblioteca()
    tituloRef.current?.focus()
  }, [])

  // A fita de latão vai até o marcador aberto: a primeira vez sem deslizar, depois a cada troca (e se a lombada encolher).
  useLayoutEffect(() => {
    const colocar = (animar: boolean): boolean => {
      const fita = fitaRef.current
      const marcador = marcadoresRef.current?.querySelector<HTMLElement>(`#${idDaAba(aba)}`)
      if (fita === null || marcador === null || marcador === undefined) return false
      fita.classList.toggle('mu-fita--parada', !animar)
      fita.style.transform = `translateY(${marcador.offsetTop}px)`
      fita.style.height = `${marcador.offsetHeight}px`
      return true
    }
    if (colocar(fitaPosta.current && !trocaPeloTeclado.current)) fitaPosta.current = true
    trocaPeloTeclado.current = false
    const aoRedimensionar = () => colocar(false)
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [aba])

  // Esc com o foco fora do mundo (no corpo da página): fecha também. Com uma janela aberta por cima, é dela.
  useEffect(() => {
    const aoTeclar = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.activeElement !== document.body && document.activeElement !== null) return
      if (useMundoDoLivroStore.getState().fichaAberta !== null || document.querySelector('.mu-modal-fundo') !== null) return
      onFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onFechar])

  if (aberto === null) return null
  const sistema = sistemaPorId(biblioteca, aberto.sistemaId)
  const nomeDoSistema = sistema?.nome ?? aberto.sistemaId
  const contagem: Record<AbaDoMundo, number | null> = {
    jogadores: personagens === null ? null : personagens.filter((personagem) => personagem.tipo === 'jogador').length,
    npcs: personagens === null ? null : personagens.filter((personagem) => personagem.tipo === 'npc' && entraNaBatalha(personagem)).length,
    // A Arena de testes não tem contagem.
    arena: null,
  }

  const trocarAba = (nova: AbaDoMundo, focar: boolean) => {
    trocaPeloTeclado.current = focar
    useMundoDoLivroStore.getState().trocarAba(nova)
    const pagina = document.getElementById(ID_DA_PAGINA)
    if (pagina !== null) pagina.scrollTop = 0
    if (focar) document.getElementById(idDaAba(nova))?.focus()
  }

  const aoTeclarNosMarcadores = (event: KeyboardEvent<HTMLDivElement>) => {
    const i = MARCADORES.findIndex((marcador) => marcador.aba === aba)
    let j: number | null = null
    if (event.key === 'ArrowDown') j = (i + 1) % MARCADORES.length
    else if (event.key === 'ArrowUp') j = (i - 1 + MARCADORES.length) % MARCADORES.length
    else if (event.key === 'Home') j = 0
    else if (event.key === 'End') j = MARCADORES.length - 1
    const destino = j === null ? undefined : MARCADORES[j]
    if (destino === undefined) return
    event.preventDefault()
    trocarAba(destino.aba, true)
  }

  /** Nenhuma tecla do mundo vale como atalho do editor atrás dele; Esc fecha (a janela aberta por cima trata o dela antes). */
  const aoTeclar = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation()
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault()
      onFechar()
    }
  }

  let pagina
  if (erro !== null) {
    pagina = (
      <div className="mu-pg">
        <div className="mu-vazio mu-vazio--erro" role="alert">
          <p>Não deu para ler os personagens da pasta: {erro}.</p>
          <button type="button" className="mu-bt mu-bt--p" onClick={() => void useMundoDoLivroStore.getState().recarregar()}>
            Tentar de novo
          </button>
        </div>
      </div>
    )
  } else if (personagens === null || (sistema === undefined && !bibliotecaLida)) {
    pagina = (
      <div className="mu-pg" aria-busy="true">
        <p className="mu-pg-nota">Lendo as fichas da pasta…</p>
      </div>
    )
  } else if (sistema === undefined) {
    pagina = (
      <div className="mu-pg">
        <div className="mu-vazio">
          <p>O sistema {aberto.sistemaId} não está neste computador. Importe-o em Configurações do mapa, na grade de sistemas, para trabalhar com as fichas dele aqui.</p>
        </div>
      </div>
    )
  } else if (aba === 'jogadores') {
    pagina = <PaginaJogadores personagens={personagens} sistema={sistema} mapas={pasta?.mapas ?? null} />
  } else {
    pagina = <PaginaNpcs personagens={personagens} sistema={sistema} />
  }

  return (
    <section className="lb-mundo" aria-label={`Mundo do livro de regras ${nomeDoSistema}`} onKeyDown={aoTeclar}>
      <aside className="mu-lombada" aria-label={`Livro de regras ${nomeDoSistema}`}>
        <div className="mu-selo">
          <span className="mu-selo__med" aria-hidden="true">
            <IconeDoMundo nome="bussola" />
          </span>
          <div className="mu-selo__txt">
            <h1 className="mu-selo__nome" ref={tituloRef} tabIndex={-1}>
              {nomeDoSistema}
            </h1>
            <p className="mu-selo__tipo" title={pasta?.nome}>
              {pasta === null ? 'Mundo do livro de regras' : `Campanha: ${pasta.nome}`}
            </p>
          </div>
        </div>
        <div className="mu-marcadores" ref={marcadoresRef}>
          <span className="mu-fita mu-fita--parada" ref={fitaRef} aria-hidden="true" />
          <div role="tablist" aria-orientation="vertical" aria-label="Partes do livro" onKeyDown={aoTeclarNosMarcadores}>
            {MARCADORES.map((marcador) => {
              const ativo = marcador.aba === aba
              const n = contagem[marcador.aba]
              return (
                <button
                  key={marcador.aba}
                  type="button"
                  role="tab"
                  className="mu-marcador"
                  id={idDaAba(marcador.aba)}
                  aria-selected={ativo}
                  aria-controls={ID_DA_PAGINA}
                  tabIndex={ativo ? 0 : -1}
                  onClick={() => trocarAba(marcador.aba, false)}
                >
                  <IconeDoMundo nome={marcador.icone} />
                  <span>{marcador.rotulo}</span>
                  <span className="mu-marcador__n">{n === null ? '' : n}</span>
                </button>
              )
            })}
          </div>
          <hr />
          <p className="mu-embreve__tit" id="mu-embreve">
            Nas próximas versões
          </p>
          <ul className="mu-embreve" aria-labelledby="mu-embreve">
            {EM_BREVE.map((item) => (
              <li key={item.rotulo} className="mu-embreve__item" title={`${item.rotulo}: chega numa próxima versão`}>
                <IconeDoMundo nome={item.icone} />
                <span>{item.rotulo}</span>
                <span className="mu-embreve__tag">em breve</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mu-pe">
          <button type="button" className="mu-bt mu-bt--fantasma" onClick={onFechar}>
            <IconeDoMundo nome="voltar" />
            <span>{aberto.origem === 'editor' ? 'Voltar ao mapa' : 'Outros livros'}</span>
          </button>
        </div>
      </aside>

      <div className="mu-pagina" id={ID_DA_PAGINA} role="tabpanel" tabIndex={0} aria-labelledby={idDaAba(aba)}>
        {pagina}
      </div>

      <GavetaDaFicha sistema={sistema} sistemaId={aberto.sistemaId} />
    </section>
  )
}
