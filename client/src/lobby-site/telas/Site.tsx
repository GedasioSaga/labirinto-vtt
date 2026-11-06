import { useEffect } from 'react'
import { ImagemDaMesa } from '../../components/ImagemDaMesa'
import { resolverSoEmbutida } from '../../lib/midia'
import { enderecoDaRota, type Rota } from '../dados/rotas'
import { Cabeca } from './Cabeca'
import { aoClicarNoLink, useDoSite, useSite } from './contexto'
import { mudancasACaminho } from './enviar'
import { AvisoDaPagina } from './Estados'
import { TelaAcesso } from './TelaAcesso'
import { TelaCampanha } from './TelaCampanha'
import { TelaCampanhas } from './TelaCampanhas'
import { TelaFicha } from './TelaFicha'

/**
 * O SITE DO LOBBY, tela por tela: a cabeça fixa com a faixa de estado em
 * cima e a página da rota embaixo. Imagem só a embutida na ficha: a mídia
 * da mesa (`midia:`) mora no app e o site ainda não a serve.
 */

const NOME_DO_SITE = 'Lobby do Labirinto'

export function Site() {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const eu = useDoSite((estado) => estado.eu)
  const rota = useDoSite((estado) => estado.rota)
  const esperando = useDoSite((estado) => (estado.campanha === null ? 0 : mudancasACaminho(estado.campanha)))
  const tituloDaPagina = useDoSite((estado) =>
    tituloDe(
      estado.rota,
      estado.campanha?.fichas.find((ficha) => estado.rota.tela === 'ficha' && ficha.doc.id === estado.rota.fichaId)?.doc.nome,
      estado.eu.t === 'pronto' ? estado.eu.eu.campanhas.find((linha) => linha.campanhaId === estado.campanha?.campanhaId)?.nomeDaCampanha : undefined,
    ),
  )

  // Fechar a aba com mudança a caminho: o navegador pergunta. A fila fica guardada, mas a pessoa fica sabendo;
  // um desfazer a caminho vive só nesta aba (sai pelo canal, fora da fila) e se perde.
  useEffect(() => {
    if (esperando === 0) return
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault()
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [esperando])

  useEffect(() => {
    document.title = tituloDaPagina === null ? NOME_DO_SITE : `${tituloDaPagina} | ${NOME_DO_SITE}`
  }, [tituloDaPagina])

  let pagina
  if (eu.t !== 'pronto' || eu.eu.campanhas.length === 0) pagina = <TelaAcesso carga={eu} />
  else if (rota.tela === 'campanhas') pagina = <TelaCampanhas eu={eu.eu} />
  else if (rota.tela === 'campanha') pagina = <TelaCampanha campanhaId={rota.campanhaId} />
  else if (rota.tela === 'ficha') pagina = <TelaFicha rota={rota} />
  else {
    const mesas: Rota = { tela: 'campanhas' }
    pagina = (
      <AvisoDaPagina
        titulo="Esta página não existe"
        acoes={
          <a className="lo-btn lo-btn--primario" href={enderecoDaRota(mesas, demo)} onClick={aoClicarNoLink(site, mesas)}>
            Ver suas mesas
          </a>
        }
      >
        <p>O endereço pode estar torto, ou a mesa não é sua.</p>
      </AvisoDaPagina>
    )
  }

  return (
    <ImagemDaMesa.Provider value={resolverSoEmbutida}>
      <a className="lo-pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <Cabeca />
      <main id="conteudo" className="lo-principal" tabIndex={-1}>
        {pagina}
      </main>
    </ImagemDaMesa.Provider>
  )
}

function tituloDe(rota: Rota, nomeDaFicha: string | undefined, nomeDaMesa: string | undefined): string | null {
  switch (rota.tela) {
    case 'campanhas':
      return 'Suas mesas'
    case 'campanha':
      return nomeDaMesa ?? null
    case 'ficha':
      return nomeDaFicha ?? nomeDaMesa ?? null
    case 'nao-achada':
      return 'Página não encontrada'
  }
}
