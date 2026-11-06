import { useId } from 'react'
import { useImagemDaMesa } from '../../components/ImagemDaMesa'
import { maximoComposto } from '../../lib/ajusteDaFicha'
import type { Personagem } from '../../lib/personagem'
import type { EstadoDaCampanha, FichaDoSite } from '../dados/sessaoDaCampanha'
import { enderecoDaRota, type Rota } from '../dados/rotas'
import { aoClicarNoLink, SISTEMA_DO_LOBBY, useDoSite, useSite } from './contexto'
import { DecisoesSemFicha } from './Decisoes'
import { AvisoDaPagina, Carregando } from './Estados'
import { Icone } from './Icone'
import { iniciais, plural, tomDe } from './textos'

/**
 * AS FICHAS DA MESA (protótipo, tela 3; em `/c/:id/fichas` desde a H1, que
 * pôs o lobby na entrada da mesa): os seus personagens primeiro, com HP e SP
 * e o caminho direto para a ficha e a mochila; depois a tripulação, só para
 * ver; e quem está na mesa agora. O mestre vê todas as fichas como suas.
 */

/** Os recursos com atual e máximo (HP, SP): as barras do cartão. */
const RECURSOS_COM_BARRA = SISTEMA_DO_LOBBY.recursos.filter((recurso) => recurso.atualEMaximo === true)

/**
 * As fichas que são da mesa: todas menos as cópias dos inimigos do treino
 * (`visivel: 'treino'`, que o mestre libera no app, T8). Elas só existem para
 * o treino; não são personagem de ninguém, nem do mestre (o NPC de verdade
 * mora no app), então ficam fora das listas, dos atalhos e das contagens.
 */
export function fichasDaMesa(campanha: EstadoDaCampanha): FichaDoSite[] {
  return campanha.fichas.filter((ficha) => ficha.visivel !== 'treino')
}

export function TelaCampanha({ campanhaId }: { campanhaId: string }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const campanha = useDoSite((estado) => estado.campanha)
  const erroDaCampanha = useDoSite((estado) => estado.erroDaCampanha)
  const nomeDaMesa = useDoSite((estado) => (estado.eu.t === 'pronto' ? estado.eu.eu.campanhas.find((linha) => linha.campanhaId === campanhaId)?.nomeDaCampanha : undefined))
  const mesas: Rota = { tela: 'campanhas' }
  const linkDasMesas = (
    <a className="lo-btn" href={enderecoDaRota(mesas, demo)} onClick={aoClicarNoLink(site, mesas)}>
      Ver suas mesas
    </a>
  )

  if (erroDaCampanha !== null) {
    return (
      <AvisoDaPagina titulo="Não deu para abrir a mesa" acoes={linkDasMesas}>
        <p>{erroDaCampanha}</p>
      </AvisoDaPagina>
    )
  }
  if (campanha?.conexao === 'sem-acesso') {
    return (
      <AvisoDaPagina titulo="Você não está nesta mesa" acoes={linkDasMesas}>
        <p>Peça ao mestre para te convidar de novo com este e-mail.</p>
      </AvisoDaPagina>
    )
  }
  if (campanha === null || campanha.campanhaId !== campanhaId || !campanha.carregada) return <Carregando texto="Abrindo a mesa…" />
  return <Mesa campanha={campanha} nome={nomeDaMesa ?? 'Mesa'} />
}

function Mesa({ campanha, nome }: { campanha: EstadoDaCampanha; nome: string }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const seusId = useId()
  const tripId = useId()
  const agoraId = useId()
  const ehMestre = campanha.eu?.papel === 'mestre'
  const daMesa = fichasDaMesa(campanha)
  const minhas = daMesa.filter((ficha) => ficha.ehMinha)
  const outras = daMesa.filter((ficha) => !ficha.ehMinha)
  const mestre = campanha.membros.find((membro) => membro.papel === 'mestre')
  const lobby: Rota = { tela: 'campanha', campanhaId: campanha.campanhaId }

  return (
    <div className="lo-pagina">
      <header className="lo-cab-pag">
        <div className="lo-cab-pag__texto">
          <a className="lo-voltar" href={enderecoDaRota(lobby, demo)} onClick={aoClicarNoLink(site, lobby)}>
            <Icone nome="voltar" /> {nome}
          </a>
          <h1 className="lo-titulo">Fichas da mesa</h1>
          <p className="lo-sub">
            {mestre !== undefined ? `Mestre ${mestre.nome}. ` : ''}Sistema {SISTEMA_DO_LOBBY.nome}. {plural(daMesa.length, 'personagem', 'personagens')}.
          </p>
        </div>
        <aside className="lo-agora" aria-labelledby={agoraId}>
          <p className="lo-agora__titulo" id={agoraId}>
            <span className="lo-ponto" aria-hidden="true" /> Na mesa agora
          </p>
          <ul>
            {campanha.naMesa.length === 0 ? (
              <li className="lo-agora__papel">Ninguém agora.</li>
            ) : (
              campanha.naMesa.map((pessoa) => (
                <li key={pessoa.contaId}>
                  <span className="lo-av" data-tom={tomDe(pessoa.contaId)} aria-hidden="true">
                    {pessoa.nome.slice(0, 1).toUpperCase()}
                    <span className="lo-ponto" />
                  </span>
                  {pessoa.contaId === campanha.eu?.contaId ? 'Você' : pessoa.nome}
                  {pessoa.papel === 'mestre' && <span className="lo-agora__papel"> (mestre)</span>}
                  {pessoa.onde === 'app' && <span className="lo-agora__papel"> no app</span>}
                </li>
              ))
            )}
          </ul>
        </aside>
      </header>
      <DecisoesSemFicha campanha={campanha} sistema={SISTEMA_DO_LOBBY} />
      <section className="lo-secao" aria-labelledby={seusId}>
        <div className="lo-secao__cab">
          <h2 className="lo-secao__titulo" id={seusId}>
            {ehMestre ? 'Fichas da mesa' : 'Seus personagens'}
          </h2>
          {ehMestre && <p className="lo-secao__nota">Você é o mestre: vê e muda todas as fichas daqui.</p>}
        </div>
        <ul className="lo-herois">
          {minhas.length === 0 ? (
            <li className="lo-secao__nota">Você não tem personagem nesta mesa. Peça ao mestre para ligar uma ficha à sua conta.</li>
          ) : (
            minhas.map((ficha) => <Heroi key={ficha.doc.id} campanhaId={campanha.campanhaId} ficha={ficha} />)
          )}
        </ul>
      </section>
      {outras.length > 0 && (
        <section className="lo-secao" aria-labelledby={tripId}>
          <div className="lo-secao__cab">
            <h2 className="lo-secao__titulo" id={tripId}>
              A tripulação
            </h2>
            <p className="lo-secao__nota">Você vê tudo dos colegas. Só eles e o mestre mudam as fichas deles.</p>
          </div>
          <ul className="lo-tripulacao">
            {outras.map((ficha) => (
              <Colega key={ficha.doc.id} campanha={campanha} ficha={ficha} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export function Retrato({ doc, grande = false }: { doc: Personagem; grande?: boolean }) {
  const resolver = useImagemDaMesa()
  const src = doc.retrato === null ? null : resolver(doc.retrato)
  return (
    <span className={grande ? 'lo-retrato lo-retrato--g' : 'lo-retrato'} data-tom={tomDe(doc.id)} aria-hidden="true">
      {src !== null ? <img src={src} alt="" /> : iniciais(doc.nome)}
    </span>
  )
}

export function Medidores({ doc }: { doc: Personagem }) {
  return (
    <div className="lo-medidores">
      {RECURSOS_COM_BARRA.map((recurso) => {
        const atual = doc.recursos[recurso.id] ?? 0
        const maximo = maximoComposto(doc, recurso.id).total
        const parte = maximo > 0 ? Math.max(0, Math.min(1, atual / maximo)) : 0
        return (
          <div key={recurso.id} className="lo-medidor" data-tom={recurso.tom}>
            <span className="lo-medidor__nome">{recurso.nome}</span>
            <span className="lo-barra" aria-hidden="true">
              <span style={{ transform: `scaleX(${parte.toFixed(3)})` }} />
            </span>
            <span className="lo-medidor__valor">
              {atual.toLocaleString('pt-BR')} <small>/ {maximo.toLocaleString('pt-BR')}</small>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Heroi({ campanhaId, ficha }: { campanhaId: string; ficha: FichaDoSite }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const nomeId = useId()
  const daFicha: Rota = { tela: 'ficha', campanhaId, fichaId: ficha.doc.id, aba: 'ficha' }
  const daMochila: Rota = { ...daFicha, aba: 'mochila' }
  const doHistorico: Rota = { ...daFicha, aba: 'historico' }
  return (
    <li>
      <article className="lo-heroi" aria-labelledby={nomeId}>
        <Retrato doc={ficha.doc} grande />
        <div className="lo-heroi__corpo">
          <div>
            <h3 className="lo-heroi__nome" id={nomeId}>
              {ficha.doc.nome}
            </h3>
            {ficha.nomeDoDono !== null && <p className="lo-heroi__de">de {ficha.nomeDoDono}</p>}
            {ficha.naoAceita && <span className="lo-tag lo-tag--brasa">não aceito pelo servidor</span>}
          </div>
          <Medidores doc={ficha.doc} />
          <div className="lo-heroi__acoes">
            <a className="lo-btn lo-btn--primario" href={enderecoDaRota(daFicha, demo)} onClick={aoClicarNoLink(site, daFicha)}>
              Abrir ficha
            </a>
            <a className="lo-btn" href={enderecoDaRota(daMochila, demo)} onClick={aoClicarNoLink(site, daMochila)}>
              Mochila
            </a>
            <a className="lo-btn lo-btn--fantasma" href={enderecoDaRota(doHistorico, demo)} onClick={aoClicarNoLink(site, doHistorico)}>
              Histórico
            </a>
          </div>
        </div>
      </article>
    </li>
  )
}

function Colega({ campanha, ficha }: { campanha: EstadoDaCampanha; ficha: FichaDoSite }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const rota: Rota = { tela: 'ficha', campanhaId: campanha.campanhaId, fichaId: ficha.doc.id, aba: 'ficha' }
  const dono = ficha.nomeDoDono
  const naMesa = dono !== null && campanha.naMesa.some((pessoa) => pessoa.nome === dono && pessoa.papel === 'jogador')
  return (
    <li>
      <a className="lo-colega" href={enderecoDaRota(rota, demo)} onClick={aoClicarNoLink(site, rota)} aria-label={`${ficha.doc.nome}${dono === null ? ', sem dono no Lobby' : `, de ${dono}`}. Só ver.`}>
        <Retrato doc={ficha.doc} />
        <div className="lo-colega__corpo">
          <h3 className="lo-colega__nome">{ficha.doc.nome}</h3>
          <p className="lo-colega__de">
            {dono === null ? 'sem dono no Lobby' : `de ${dono}`}
            {naMesa && <span className="lo-tag lo-tag--online"> na mesa agora</span>}
          </p>
          <Medidores doc={ficha.doc} />
        </div>
        <div className="lo-colega__pe">
          <span className="lo-tag">
            <Icone nome="olho" /> Só ver
          </span>
        </div>
      </a>
    </li>
  )
}
