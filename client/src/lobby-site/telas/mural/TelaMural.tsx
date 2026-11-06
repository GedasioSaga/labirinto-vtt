import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { MembroProjetado } from '../../../lib/nuvem/tipos'
import { enderecoDaRota, type AbaDoMural, type Rota } from '../../dados/rotas'
import type { VersaoNova } from '../../dados/versaoDoSite'
import { aoClicarNoLink, fonteDaDemo, useDoSite, useSite } from '../contexto'
import { AvisoDaPagina } from '../Estados'
import { Icone } from '../Icone'
import { PainelModificacoes } from './PainelModificacoes'
import { PainelNoticias } from './PainelNoticias'
import './mural.css'

/**
 * O MURAL DA MESA (fatia M2; pedido do usuário de 06/11/2026: "para ser um
 * verdadeiro lobby ... adicione o chat, notícias, modificações e avisos").
 * Duas abas na mesma folha das telas da S3: NOTÍCIAS (o mestre posta, edita,
 * apaga e fixa; todo mundo lê e reage; os avisos fixados ficam no topo) e
 * MODIFICAÇÕES (o feed do que mudou nas fichas, pelo que quem lê pode ver).
 * Em cima, o cartão de versão nova do Labirinto, quando houver.
 */

type RotaDoMural = Extract<Rota, { tela: 'mural' }>

const ABAS: readonly { id: AbaDoMural; nome: string }[] = [
  { id: 'noticias', nome: 'Notícias' },
  { id: 'modificacoes', nome: 'Modificações' },
]

export function TelaMural({ rota }: { rota: RotaDoMural }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const campanha = useDoSite((estado) => estado.campanha)
  const mural = useDoSite((estado) => estado.mural)
  const versaoNova = useDoSite((estado) => estado.versaoNova)
  const erroDaCampanha = useDoSite((estado) => estado.erroDaCampanha)
  const nomeDaMesa = useDoSite((estado) =>
    estado.eu.t === 'pronto' ? (estado.eu.eu.campanhas.find((linha) => linha.campanhaId === rota.campanhaId)?.nomeDaCampanha ?? 'Mesa') : 'Mesa',
  )
  const [comoMestre, setComoMestre] = useState(false)
  const listaDeAbas = useRef<HTMLDivElement>(null)
  const fonte = fonteDaDemo(site)

  // Só na demonstração: o mural da mesa responde como o mestre enquanto o atalho está ligado (e volta ao sair daqui).
  useEffect(() => {
    if (fonte === null) return
    fonte.verMuralComoMestre(rota.campanhaId, comoMestre)
    return () => fonte.verMuralComoMestre(rota.campanhaId, false)
  }, [fonte, rota.campanhaId, comoMestre])

  const rotaDaAba = (aba: AbaDoMural): Rota => ({ tela: 'mural', campanhaId: rota.campanhaId, aba })
  // Setas e Home/End andam entre as abas (padrão de abas do WAI-ARIA), e a aba nova já abre.
  function teclaNasAbas(evento: KeyboardEvent<HTMLDivElement>) {
    const atual = ABAS.findIndex((aba) => aba.id === rota.aba)
    const destino =
      evento.key === 'ArrowRight' ? (atual + 1) % ABAS.length : evento.key === 'ArrowLeft' ? (atual - 1 + ABAS.length) % ABAS.length : evento.key === 'Home' ? 0 : evento.key === 'End' ? ABAS.length - 1 : null
    if (destino === null) return
    evento.preventDefault()
    site.irPara(rotaDaAba(ABAS[destino].id))
    requestAnimationFrame(() => listaDeAbas.current?.querySelector<HTMLElement>(`#aba-mural-${ABAS[destino].id}`)?.focus())
  }

  const daMesa: Rota = { tela: 'campanha', campanhaId: rota.campanhaId }

  if (erroDaCampanha !== null) {
    return (
      <AvisoDaPagina titulo="Não deu para abrir esta mesa neste navegador">
        <p>{erroDaCampanha}</p>
      </AvisoDaPagina>
    )
  }

  if (campanha === null || mural === null) {
    return (
      <div className="lo-pagina lo-pagina--mural">
        <p className="lo-carregando" role="status">
          <span className="lo-giro" aria-hidden="true" />
          Abrindo a mesa…
        </p>
      </div>
    )
  }

  const mestre = campanha.membros.find((membro) => membro.papel === 'mestre') ?? null
  const eu: MembroProjetado | null = comoMestre && mestre !== null ? mestre : campanha.eu
  const souMestre = eu?.papel === 'mestre'
  const avisosNaoLidos = mural.fixadas.filter((noticia) => !noticia.lida && noticia.autorContaId !== eu?.contaId).length

  return (
    <div className="lo-pagina lo-pagina--mural">
      <header className="lo-cab-pag">
        <div className="lo-cab-pag__texto">
          <a className="lo-voltar" href={enderecoDaRota(daMesa, demo)} onClick={aoClicarNoLink(site, daMesa)}>
            <Icone nome="voltar" /> {nomeDaMesa}
          </a>
          <h1 className="lo-titulo">Mural da mesa</h1>
          <p className="lo-sub">{souMestre ? 'O que você posta aqui, toda a mesa lê. Fixe o que ninguém pode perder.' : 'Notícias e avisos do mestre, e o que mudou nas fichas.'}</p>
        </div>
      </header>

      {fonte !== null && mestre !== null && campanha.eu?.papel !== 'mestre' && (
        <aside className="lo-demo lo-mural__demo" aria-label="Demonstração (não existe no site de verdade)">
          <span className="lo-demo__selo">Demonstração</span>
          <button type="button" className="lo-btn lo-btn--fantasma" aria-pressed={comoMestre} onClick={() => setComoMestre((ligado) => !ligado)}>
            {comoMestre ? `Vendo como ${mestre.nome} (mestre): voltar a ver como você` : `Ver o mural como ${mestre.nome}, o mestre`}
          </button>
        </aside>
      )}

      {versaoNova !== null && <CartaoDeVersao versao={versaoNova} demo={demo} />}

      <div className="lo-folha">
        <div className="lo-abas" role="tablist" aria-label="Partes do mural" ref={listaDeAbas} onKeyDown={teclaNasAbas}>
          {ABAS.map((aba) => (
            <a
              key={aba.id}
              role="tab"
              className="lo-aba"
              id={`aba-mural-${aba.id}`}
              href={enderecoDaRota(rotaDaAba(aba.id), demo)}
              onClick={aoClicarNoLink(site, rotaDaAba(aba.id))}
              aria-selected={rota.aba === aba.id}
              aria-controls="painel-do-mural"
              tabIndex={rota.aba === aba.id ? 0 : -1}
            >
              {aba.nome}
              {aba.id === 'noticias' && avisosNaoLidos > 0 && <span className="lo-aba__conta">{avisosNaoLidos === 1 ? '1 aviso' : `${avisosNaoLidos} avisos`}</span>}
            </a>
          ))}
        </div>
        <div className="lo-painel" role="tabpanel" id="painel-do-mural" aria-labelledby={`aba-mural-${rota.aba}`}>
          {rota.aba === 'noticias' ? (
            <PainelNoticias campanha={campanha} mural={mural} eu={eu} souMestre={souMestre} demo={demo} />
          ) : (
            <PainelModificacoes campanha={campanha} mural={mural} demo={demo} />
          )}
        </div>
      </div>
    </div>
  )
}

/** "Saiu a versão X": o site aberto é de antes da última publicação. Recarregar traz a nova; o app se atualiza pelo atualizador dele. */
function CartaoDeVersao({ versao, demo }: { versao: VersaoNova; demo: boolean }) {
  return (
    <aside className="lo-versao" aria-label="Versão nova do Labirinto">
      <Icone nome="baixar" />
      <div className="lo-versao__texto">
        <p>
          Saiu a versão <b>{versao.nova}</b> do Labirinto. Esta página é da {versao.aberta}.
        </p>
        <p className="lo-versao__nota">
          Recarregue para usar o site novo. No app, o atualizador oferece a versão nova quando ele abre.{demo ? ' (Demonstração: versões inventadas.)' : ''}
        </p>
      </div>
      <button type="button" className="lo-btn" onClick={() => window.location.reload()}>
        Recarregar a página
      </button>
    </aside>
  )
}
