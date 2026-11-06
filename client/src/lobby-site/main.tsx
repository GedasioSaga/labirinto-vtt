import { StrictMode, type MouseEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { useStore } from 'zustand'
import { iniciarSite, type Site } from './dados/lobbyStore'
import { enderecoDaRota, type Rota } from './dados/rotas'

// Entrada do site do Lobby (`client/lobby-site/index.html`, build em
// `vite.lobby.config.ts`). Roda no navegador do jogador, fora do Tauri: nada
// deste arquivo nem do que ele importa pode puxar `@tauri-apps/*`, `pixi.js` ou
// `three` (a guarda do build recusa). A camada de dados é a da S2
// (`dados/`); a tela abaixo é PROVISÓRIA — só lista as mesas e as fichas para
// provar os dados — e dá lugar às telas da S3 (docs/planos/lobby-jogadores-2026-11-05.md).

const site = iniciarSite(window)

function Link({ site, rota, children }: { site: Site; rota: Rota; children: string }) {
  const demo = useStore(site.store, (estado) => estado.demo)
  function navegar(evento: MouseEvent<HTMLAnchorElement>) {
    // Ctrl/Cmd/Shift/meio: o navegador abre em outra aba, como em qualquer link.
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return
    evento.preventDefault()
    site.irPara(rota)
  }
  return (
    <a href={enderecoDaRota(rota, demo)} onClick={navegar}>
      {children}
    </a>
  )
}

function Mesa({ site, campanhaId }: { site: Site; campanhaId: string }) {
  const campanha = useStore(site.store, (estado) => estado.campanha)
  const erro = useStore(site.store, (estado) => estado.erroDaCampanha)
  if (erro !== null) return <p className="lobby-esqueleto__texto">{erro}</p>
  if (campanha === null || campanha.campanhaId !== campanhaId || !campanha.carregada) return <p className="lobby-esqueleto__texto">Abrindo a mesa…</p>
  return (
    <>
      <p className="lobby-esqueleto__texto">
        {campanha.conexao === 'em-dia' ? 'Conectado' : 'Sem conexão'} · {campanha.fichas.length} fichas · {campanha.esperando} enviando
      </p>
      <ul>
        {campanha.fichas.map((ficha) => (
          <li key={ficha.doc.id}>
            {ficha.doc.nome}
            {ficha.ehMinha ? ' (sua)' : ''}
          </li>
        ))}
      </ul>
      <Link site={site} rota={{ tela: 'campanhas' }}>
        Voltar às mesas
      </Link>
    </>
  )
}

function Provisoria({ site }: { site: Site }) {
  const eu = useStore(site.store, (estado) => estado.eu)
  const rota = useStore(site.store, (estado) => estado.rota)
  if (eu.t === 'carregando') return <p className="lobby-esqueleto__texto">Carregando suas mesas…</p>
  if (eu.t === 'erro') return <p className="lobby-esqueleto__texto">{eu.tipo === 'sem-login' ? 'Entre de novo para ver suas mesas.' : eu.detalhe}</p>
  if (rota.tela === 'campanha' || rota.tela === 'ficha') return <Mesa site={site} campanhaId={rota.campanhaId} />
  if (rota.tela === 'nao-achada') {
    return (
      <>
        <p className="lobby-esqueleto__texto">Esta mesa não existe ou não é sua.</p>
        <Link site={site} rota={{ tela: 'campanhas' }}>
          Ver suas mesas
        </Link>
      </>
    )
  }
  if (eu.eu.campanhas.length === 0) return <p className="lobby-esqueleto__texto">Este e-mail ainda não está em nenhuma mesa.</p>
  return (
    <ul>
      {eu.eu.campanhas.map((campanha) => (
        <li key={campanha.campanhaId}>
          <Link site={site} rota={{ tela: 'campanha', campanhaId: campanha.campanhaId }}>
            {campanha.nomeDaCampanha}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Esqueleto() {
  return (
    <main className="lobby-esqueleto">
      <h1 className="lobby-esqueleto__titulo">Lobby do Labirinto</h1>
      <Provisoria site={site} />
    </main>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('lobby-site/index.html sem #root')
createRoot(root).render(
  <StrictMode>
    <Esqueleto />
  </StrictMode>,
)
