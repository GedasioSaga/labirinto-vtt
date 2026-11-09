import { useCallback, useEffect, useState } from 'react'
import { LabyrinthMark } from '../components/icons'
import { ROTULO_DO_TIPO } from '../lib/preparo/enciclopedia'
import type { Campanha } from '../lib/preparo/tipos'
import { BuscaGeral } from './busca/BuscaGeral'
import { PainelDaCopia } from './copia/PainelDaCopia'
import { precarregarEditor } from './editor/sobDemanda'
import { ListaDeVerbetes } from './enciclopedia/ListaDeVerbetes'
import { PaginaDoVerbete } from './enciclopedia/PaginaDoVerbete'
import { Escrita } from './escrita/Escrita'
import { usePreludio, type Lugar } from './estado/preludio'
import { PainelDaImportacao } from './importar/PainelDaImportacao'
import { Lado } from './Lado'
import { TITULO_DO_PRELUDIO } from './textos'
import '../screens/MainMenu.css'
import '../components/grimorio/grimorio.css'
import './preludio.css'

interface TelaDoPreludioProps {
  onBack: () => void
}

const NADA_AINDA =
  'Nada preparado ainda. Aqui moram a Enciclopédia (personagens, lugares, itens, facções) e a Escrita das campanhas; dá para começar importando as campanhas do Grimório, logo abaixo.'

/** "One Piece, Dragon Ball e Geonova": os nomes vêm do disco e entram como texto. */
function frasesDasCampanhas(campanhas: readonly Campanha[], verbetes: number): string {
  if (campanhas.length === 0 && verbetes === 0) return NADA_AINDA
  const nomes = new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(campanhas.map((campanha) => campanha.nome))
  const deCampanhas = campanhas.length === 0 ? 'Nenhuma campanha ainda.' : campanhas.length === 1 ? `1 campanha no Prelúdio: ${nomes}.` : `${campanhas.length} campanhas no Prelúdio: ${nomes}.`
  return `${deCampanhas} ${verbetes === 1 ? '1 verbete' : `${verbetes} verbetes`} entre a Enciclopédia e a Escrita.`
}

/** Onde a pessoa está, para a trilha do topo. */
function trilhaDe(lugar: Lugar, tituloDe: (id: string) => string | undefined): string[] {
  switch (lugar.secao) {
    case 'inicio':
      return []
    case 'enciclopedia': {
      const tipo = lugar.tipo === 'todos' ? 'Enciclopédia' : ROTULO_DO_TIPO[lugar.tipo].varios
      const nome = lugar.verbeteId === null ? undefined : (tituloDe(lugar.verbeteId) ?? 'Sem nome')
      return nome === undefined ? [tipo] : [tipo, nome || 'Sem nome']
    }
    case 'escrita': {
      const nome = lugar.paginaId === null ? undefined : (tituloDe(lugar.paginaId) ?? 'Sem nome')
      return nome === undefined ? ['Escrita'] : ['Escrita', nome || 'Sem nome']
    }
  }
}

function emCampoDeTexto(alvo: EventTarget | null): boolean {
  return alvo instanceof HTMLElement && (alvo.isContentEditable || alvo.closest('input, textarea, select') !== null)
}

function Inicio({ aoMudarGravacao, pedidoDeCopia, aoPedirCopia, gravando }: { aoMudarGravacao: (gravando: boolean) => void; pedidoDeCopia: number; aoPedirCopia: () => void; gravando: boolean }) {
  const carga = usePreludio((estado) => estado.carga)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const total = usePreludio((estado) => estado.verbetes.size)
  const avisos = usePreludio((estado) => estado.avisos)
  const carregar = usePreludio((estado) => estado.carregar)
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
          <span className="lb-home__badge">Em construção</span>
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
      <PainelDaImportacao onAplicado={() => void carregar()} onPedirCopia={aoPedirCopia} onGravando={aoMudarGravacao} />
      <PainelDaCopia onRestaurado={() => void carregar()} pedidoDeCopia={pedidoDeCopia} travado={gravando} />
    </div>
  )
}

/**
 * O PRELÚDIO, a preparação de sessão (plano §1): a barra lateral com as seções
 * e, no palco, o Início (importar do Grimório e cópia no Google Drive, com a
 * cópia diária ao abrir), a Enciclopédia e a Escrita. Ctrl+K busca em tudo.
 */
export function TelaDoPreludio({ onBack }: TelaDoPreludioProps) {
  const carga = usePreludio((estado) => estado.carga)
  const lugar = usePreludio((estado) => estado.lugar)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const carregar = usePreludio((estado) => estado.carregar)
  const travar = usePreludio((estado) => estado.travar)
  const salvarPendentes = usePreludio((estado) => estado.salvarPendentes)
  const [pedidoDeCopia, setPedidoDeCopia] = useState(0)
  const [gravando, setGravando] = useState(false)
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    void carregar()
    return () => {
      void usePreludio.getState().fechar()
    }
  }, [carregar])

  useEffect(() => {
    travar(gravando)
  }, [gravando, travar])

  // Na Enciclopédia e na Escrita o editor vai ser preciso; no Início, o que mudou vai já para o disco (a importação lê o disco).
  useEffect(() => {
    if (lugar.secao === 'inicio') void salvarPendentes()
    else precarregarEditor()
  }, [lugar.secao, salvarPendentes])

  const sair = useCallback(() => {
    void salvarPendentes().finally(onBack)
  }, [salvarPendentes, onBack])

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && !evento.altKey && !evento.shiftKey && evento.code === 'KeyK') {
        if (carga.t !== 'pronta') return
        evento.preventDefault()
        setBuscando(true)
        return
      }
      // Esc volta ao menu só no Início, como nas outras telas de menu; nas outras seções ele é do texto e das janelas.
      if (evento.key === 'Escape' && !evento.defaultPrevented && lugar.secao === 'inicio' && !buscando && !gravando && !emCampoDeTexto(evento.target) && document.querySelector('[role="dialog"]') === null) {
        sair()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [carga.t, lugar.secao, buscando, gravando, sair])

  const trilha = trilhaDe(lugar, (id) => verbetes.get(id)?.titulo)
  const atual = trilha[trilha.length - 1] ?? TITULO_DO_PRELUDIO
  const antes = ['Labirinto', ...(trilha.length > 0 ? [TITULO_DO_PRELUDIO] : []), ...trilha.slice(0, -1)]

  return (
    <div className="pr-tela">
      <div className="lb-appbar">
        <span className="lb-appbar__mark" aria-hidden="true">
          <LabyrinthMark size={16} />
        </span>
        <nav className="lb-appbar__crumbs" aria-label="Posição na navegação">
          {antes.map((passo, indice) => (
            <span key={`${indice}-${passo}`} className="lb-appbar__crumb">
              {passo}
            </span>
          ))}
          <span className="lb-appbar__crumb lb-appbar__crumb--current" aria-current="page">
            {atual}
          </span>
        </nav>
      </div>
      <div className="pr-corpo">
        <Lado aoVoltar={gravando ? undefined : sair} aoBuscar={() => setBuscando(true)} />
        <main className="pr-palco" aria-busy={carga.t === 'lendo'}>
          {/* O Início fica montado: a importação e a cópia seguem (e terminam) enquanto a pessoa lê um verbete. */}
          <div hidden={lugar.secao !== 'inicio'}>
            <Inicio aoMudarGravacao={setGravando} pedidoDeCopia={pedidoDeCopia} aoPedirCopia={() => setPedidoDeCopia((anterior) => anterior + 1)} gravando={gravando} />
          </div>
          {lugar.secao === 'inicio' ? null : carga.t !== 'pronta' ? (
            <p className="pr-quieto pr-palco__abrindo" role="status">
              {carga.t === 'falhou' ? carga.aviso : 'Abrindo o Prelúdio…'}
            </p>
          ) : lugar.secao === 'enciclopedia' ? (
            lugar.verbeteId === null ? (
              <ListaDeVerbetes key={lugar.tipo} tipo={lugar.tipo} />
            ) : (
              <PaginaDoVerbete key={lugar.verbeteId} id={lugar.verbeteId} />
            )
          ) : (
            <Escrita paginaId={lugar.paginaId} />
          )}
        </main>
      </div>
      {buscando && <BuscaGeral aoFechar={() => setBuscando(false)} />}
    </div>
  )
}
