import type { Eu } from '../dados/fonte'
import { enderecoDaRota, type Rota } from '../dados/rotas'
import { aoClicarNoLink, useDoSite, useSite } from './contexto'
import { Icone } from './Icone'
import { iniciais, plural, tomDe } from './textos'

/**
 * SUAS MESAS (protótipo, tela 2): as campanhas em que este e-mail está. O
 * `/api/eu` só diz o nome e o papel de cada uma; o resto (fichas, quem está
 * na mesa) chega quando a campanha abre.
 */
export function TelaCampanhas({ eu }: { eu: Eu }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const comoMestre = eu.campanhas.filter((campanha) => campanha.papel === 'mestre').length

  return (
    <div className="lo-pagina">
      <header className="lo-cab-pag">
        <div className="lo-cab-pag__texto">
          <h1 className="lo-titulo">Suas mesas</h1>
          <p className="lo-sub">
            {plural(eu.campanhas.length, 'campanha', 'campanhas')} com {eu.email}
            {comoMestre > 0 ? `, ${comoMestre === 1 ? 'uma' : comoMestre} como mestre` : ''}. Escolha uma para ver as fichas.
          </p>
        </div>
      </header>
      <ul className="lo-mesas">
        {eu.campanhas.map((campanha) => {
          const rota: Rota = { tela: 'campanha', campanhaId: campanha.campanhaId }
          return (
            <li key={campanha.campanhaId}>
              <a className="lo-mesa" href={enderecoDaRota(rota, demo)} onClick={aoClicarNoLink(site, rota)}>
                <div className="lo-mesa__topo">
                  <span className="lo-retrato" data-tom={tomDe(campanha.campanhaId)} aria-hidden="true">
                    {iniciais(campanha.nomeDaCampanha)}
                  </span>
                  {campanha.papel === 'mestre' ? <span className="lo-tag lo-tag--latao">Você é o mestre</span> : <span className="lo-tag">Jogador</span>}
                </div>
                <h2 className="lo-mesa__nome">{campanha.nomeDaCampanha}</h2>
                <div className="lo-mesa__rodape">
                  <p className="lo-mesa__ultima">{campanha.papel === 'mestre' ? 'Todas as fichas da mesa, para ver e mudar.' : 'A sua ficha e a dos colegas.'}</p>
                  <span className="lo-mesa__ir">
                    Entrar <Icone nome="ir" />
                  </span>
                </div>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
