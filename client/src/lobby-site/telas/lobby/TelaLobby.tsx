import { useEffect, useId, useRef, useState } from 'react'
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
import { EntrarNaMesa } from './EntrarNaMesa'
import { AvisosDaMesa, UltimasModificacoes, UltimasNoticias } from './NovidadesDaMesa'
import '../chat/chat.css'
import '../mural/mural.css'
import './saguao.css'

/**
 * O LOBBY DA MESA (fatia H1): a primeira tela de dentro de uma mesa, logo
 * depois do login (direto, com uma mesa só; depois de "Suas mesas", com
 * várias). Junta o que acontece na mesa numa página só: quem está aqui agora,
 * a mesa aberta no app com o "Entrar na mesa agora" (B6), os avisos do
 * mestre, os atalhos grandes (ficha, mochila, treino, duelo), a
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
      <EntrarNaMesa campanha={campanha} />
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

/** Quanto da caixa das mensagens precisa estar na tela (ou da tela, se ela for mais alta) para a sala contar como vista. */
const PARTE_DA_SALA_A_VISTA = 0.5

/** Folga, em px, para o fim da caixa contar como à vista: o arredondamento de meio pixel não deixa a conta fechar em zero. */
const FOLGA_DO_FIM_PX = 4

/** De 5 em 5% e mais 99%: o observador avisa quando o fim da caixa entra na tela, até numa janela baixa. */
const LIMIARES_DA_SALA = [...Array.from({ length: 20 }, (_, indice) => indice / 20), 0.99, 1]

/**
 * A caixa das mensagens da sala está de fato à vista: o fim dela (onde chega a
 * mensagem nova) dentro da tela e pelo menos metade dela visível. No lobby a
 * sala fica abaixo dos avisos e dos atalhos; sem isso ela contaria como lida
 * assim que a página abre, sem a pessoa ter descido até ela.
 */
function useSalaAVista(casca: HTMLElement | null): boolean {
  const [aVista, setAVista] = useState(false)
  useEffect(() => {
    if (casca === null) return
    // Sem o observador (navegador antigo) vale o que valia antes: a sala aberta conta como vista.
    if (typeof IntersectionObserver === 'undefined') {
      setAVista(true)
      return
    }
    const caixa = casca.querySelector('[role="log"]') ?? casca
    const observador = new IntersectionObserver(
      (entradas) => {
        const ultima = entradas.at(-1)
        if (ultima === undefined) return
        const { boundingClientRect: inteira, intersectionRect: visivel } = ultima
        const alturaDaTela = ultima.rootBounds?.height ?? window.innerHeight
        const fimAVista = inteira.bottom - visivel.bottom <= FOLGA_DO_FIM_PX
        const bastanteAVista = visivel.height >= Math.min(inteira.height, alturaDaTela) * PARTE_DA_SALA_A_VISTA
        setAVista(ultima.isIntersecting && fimAVista && bastanteAVista)
      },
      { threshold: LIMIARES_DA_SALA },
    )
    observador.observe(caixa)
    return () => observador.disconnect()
  }, [casca])
  return aVista
}

/**
 * A sala do chat (C2), inteira, dentro do lobby: a mesma conversa da tela do
 * chat (mandar, menções, "enviando…", carregar anteriores), numa folha mais
 * baixa. Ler o fim dela aqui conta como lido, como lá, mas só com a caixa das
 * mensagens à vista na página (`useSalaAVista`): enquanto ela está abaixo da
 * tela, a contagem do "Chat" e o "(N)" do título da aba ficam. Os privados
 * ficam na tela do chat, com as não lidas no link.
 */
function SalaNoLobby({ campanha, chat, nomeDaMesa }: { campanha: EstadoDaCampanha; chat: EstadoDoChat | null; nomeDaMesa: string }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const [casca, setCasca] = useState<HTMLDivElement | null>(null)
  const aVista = useSalaAVista(casca)
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
    <div className="lo-saguao__sala" ref={setCasca}>
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
        coberta={!aVista}
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
