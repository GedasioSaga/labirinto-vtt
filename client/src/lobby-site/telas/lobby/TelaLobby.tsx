import { useId, useRef } from 'react'
import type { EstadoDoChat } from '../../dados/chatDaCampanha'
import { enderecoDaRota, type Rota } from '../../dados/rotas'
import type { EstadoDaCampanha } from '../../dados/sessaoDaCampanha'
import { Conversa } from '../chat/Conversa'
import { contagemDeNaoLidas } from '../chat/textosDoChat'
import { aoClicarNoLink, SISTEMA_DO_LOBBY, useDoSite, useSite } from '../contexto'
import { DecisoesSemFicha } from '../Decisoes'
import { AvisoDaPagina, Carregando } from '../Estados'
import { Icone } from '../Icone'
import { plural, tomDe } from '../textos'
import { AtalhosDaMesa } from './AtalhosDaMesa'
import { AvisosDaMesa, UltimasModificacoes, UltimasNoticias } from './NovidadesDaMesa'
import '../chat/chat.css'
import '../mural/mural.css'
import './saguao.css'

/**
 * O LOBBY DA MESA (fatia H1): a primeira tela de dentro de uma mesa, logo
 * depois do login (direto, com uma mesa só; depois de "Suas mesas", com
 * várias). Junta o que acontece na mesa numa página só: quem está aqui agora,
 * os avisos do mestre, os atalhos grandes (ficha, mochila, treino, duelo), a
 * sala do chat e, ao lado, as últimas notícias e modificações. Cada parte
 * leva à tela inteira dela; nada aqui é só enfeite.
 */

export function TelaLobby({ campanhaId }: { campanhaId: string }) {
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
  return <Saguao campanha={campanha} nome={nomeDaMesa ?? 'Mesa'} />
}

function Saguao({ campanha, nome }: { campanha: EstadoDaCampanha; nome: string }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const chat = useDoSite((estado) => estado.chat)
  const mural = useDoSite((estado) => estado.mural)
  const variasMesas = useDoSite((estado) => estado.eu.t === 'pronto' && estado.eu.eu.campanhas.length > 1)
  const mestre = campanha.membros.find((membro) => membro.papel === 'mestre')
  const mesas: Rota = { tela: 'campanhas' }

  return (
    <div className="lo-pagina lo-saguao">
      <header className="lo-cab-pag lo-saguao__cab">
        <div className="lo-cab-pag__texto">
          {variasMesas && (
            <a className="lo-voltar" href={enderecoDaRota(mesas, demo)} onClick={aoClicarNoLink(site, mesas)}>
              <Icone nome="voltar" /> Suas mesas
            </a>
          )}
          <h1 className="lo-titulo">{nome}</h1>
          <p className="lo-sub">
            {mestre !== undefined ? `Mestre ${mestre.nome}. ` : ''}
            {plural(campanha.membros.length, 'pessoa', 'pessoas')} na mesa.
          </p>
        </div>
        <QuemEstaNaMesa campanha={campanha} />
      </header>
      <DecisoesSemFicha campanha={campanha} sistema={SISTEMA_DO_LOBBY} />
      <AvisosDaMesa campanha={campanha} mural={mural} />
      <AtalhosDaMesa campanha={campanha} />
      <div className="lo-saguao__vida">
        <SalaNoLobby campanha={campanha} chat={chat} nomeDaMesa={nome} />
        <div className="lo-saguao__coluna">
          <UltimasNoticias campanha={campanha} mural={mural} />
          <UltimasModificacoes campanha={campanha} mural={mural} />
        </div>
      </div>
    </div>
  )
}

/**
 * Quem está na mesa agora (a presença da C1): o ponto verde, onde está (site
 * ou app) e, para cada colega, o caminho para conversar em particular. Quem
 * chega com a página aberta entra com um movimento curto; quem já estava
 * aparece parado.
 */
function QuemEstaNaMesa({ campanha }: { campanha: EstadoDaCampanha }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const tituloId = useId()
  const jaEstavam = useRef<ReadonlySet<string> | null>(null)
  // A presença chega logo depois do estado da mesa, e a própria pessoa sempre está nela: lista vazia = ainda não
  // chegou. Quem está na primeira lista que chega já estava; só quem vem depois entra com movimento.
  if (jaEstavam.current === null && campanha.naMesa.length > 0) jaEstavam.current = new Set(campanha.naMesa.map((pessoa) => pessoa.contaId))
  const presentes = new Set(campanha.naMesa.map((pessoa) => pessoa.contaId))
  const eu = campanha.eu?.contaId ?? null
  const fora = campanha.membros.filter((membro) => !presentes.has(membro.contaId))

  return (
    <aside className="lo-agora lo-saguao__agora" aria-labelledby={tituloId}>
      <p className="lo-agora__titulo" id={tituloId}>
        <span className="lo-ponto" aria-hidden="true" /> Na mesa agora
      </p>
      {campanha.naMesa.length === 0 ? (
        <p className="lo-agora__papel">Ninguém agora.</p>
      ) : (
        <ul>
          {campanha.naMesa.map((pessoa) => {
            const papel = `${pessoa.papel === 'mestre' ? ' (mestre)' : ''}${pessoa.onde === 'app' ? ' no app' : ''}`
            const rosto = (
              <span className="lo-av" data-tom={tomDe(pessoa.contaId)} aria-hidden="true">
                {pessoa.nome.slice(0, 1).toUpperCase()}
                <span className="lo-ponto" />
              </span>
            )
            const privado: Rota = { tela: 'chat', campanhaId: campanha.campanhaId, com: pessoa.contaId }
            return (
              <li key={pessoa.contaId} data-entra={jaEstavam.current !== null && !jaEstavam.current.has(pessoa.contaId) ? '1' : undefined}>
                {pessoa.contaId === eu ? (
                  <span className="lo-saguao__pessoa">
                    {rosto}
                    Você
                    <span className="lo-agora__papel">{papel}</span>
                  </span>
                ) : (
                  <a
                    className="lo-saguao__pessoa"
                    href={enderecoDaRota(privado, demo)}
                    onClick={aoClicarNoLink(site, privado)}
                    aria-label={`${pessoa.nome}${papel}. Conversar em particular`}
                    title="Conversar em particular"
                  >
                    {rosto}
                    {pessoa.nome}
                    <span className="lo-agora__papel">{papel}</span>
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {fora.length > 0 && <p className="lo-saguao__fora">Fora agora: {fora.map((membro) => membro.nome).join(', ')}.</p>}
    </aside>
  )
}

/**
 * A sala do chat (C2), inteira, dentro do lobby: a mesma conversa da tela do
 * chat (mandar, menções, "enviando…", carregar anteriores), numa folha mais
 * baixa. Ler o fim dela aqui conta como lido, como lá. Os privados ficam na
 * tela do chat, com as não lidas no link.
 */
function SalaNoLobby({ campanha, chat, nomeDaMesa }: { campanha: EstadoDaCampanha; chat: EstadoDoChat | null; nomeDaMesa: string }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const doChat: Rota = { tela: 'chat', campanhaId: campanha.campanhaId, com: null }
  if (chat === null) {
    return (
      <section className="lo-folha lo-chat__folha lo-saguao__sala" aria-label="Sala da mesa">
        <p className="lo-chat__carregando" role="status">
          <span className="lo-giro" aria-hidden="true" />
          Abrindo a sala…
        </p>
      </section>
    )
  }
  let noPrivado = 0
  for (const conversa of chat.conversas.values()) if (conversa.chave !== 'sala') noPrivado += conversa.naoLidas
  return (
    <div className="lo-saguao__sala">
      <Conversa
        chave="sala"
        canal="sala"
        conversa={chat.conversas.get('sala')}
        pronto={chat.pronto}
        eu={campanha.eu}
        membros={campanha.membros}
        titulo="Sala da mesa"
        descricao={`Todo mundo da mesa lê. ${plural(campanha.membros.length, 'pessoa', 'pessoas')}.`}
        nomeDaMesa={nomeDaMesa}
        comAviso={false}
        bloqueado={null}
        coberta={false}
      />
      <p className="lo-saguao__pe">
        <a href={enderecoDaRota(doChat, demo)} onClick={aoClicarNoLink(site, doChat)}>
          <Icone nome="conversa" />
          {noPrivado > 0 ? `Abrir o chat: ${contagemDeNaoLidas(noPrivado)} em particular não ${noPrivado === 1 ? 'lida' : 'lidas'}` : 'Abrir o chat e as conversas em particular'}
        </a>
      </p>
    </div>
  )
}
