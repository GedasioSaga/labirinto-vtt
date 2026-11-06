import { useEffect, useRef, useState } from 'react'
import type { EstadoDaCampanha } from '../dados/sessaoDaCampanha'
import type { Rota } from '../dados/rotas'
import { aoClicarNoLink, useDoSite, useSite } from './contexto'
import { mudancasACaminho } from './enviar'
import { pedirFocoNoAviso } from './foco'
import { Icone, type NomeDoIcone } from './Icone'
import { tomDe } from './textos'
import { campanhaDaRota, enderecoDaRota } from '../dados/rotas'
import { contagemDeNaoLidas } from './chat/textosDoChat'
import { MOTIVO_DO_TREINO, TREINO_NO_SITE } from './lobby/treinoNoSite'

/**
 * A CABEÇA FIXA (protótipo, "cabeça fixa e faixa"): a marca, onde a pessoa
 * está (dentro de uma mesa, as partes dela: H1), quem está na mesa agora e a
 * conta; embaixo, a FAIXA DE ESTADO, em toda tela de campanha. "Salvo" só
 * aparece quando o servidor confirmou tudo.
 */

/** Sair do Access (Cloudflare Zero Trust): apaga a sessão do login e volta à porta do Google. */
const SAIR_DO_ACCESS = '/cdn-cgi/access/logout'

export function Cabeca() {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const eu = useDoSite((estado) => estado.eu)
  const rota = useDoSite((estado) => estado.rota)
  const campanha = useDoSite((estado) => estado.campanha)
  const email = eu.t === 'pronto' ? eu.eu.email : null
  const nomeDaMesa = eu.t === 'pronto' && campanha !== null ? (eu.eu.campanhas.find((linha) => linha.campanhaId === campanha.campanhaId)?.nomeDaCampanha ?? null) : null
  const euNaMesa = campanha?.eu ?? null
  const nomeDaConta = euNaMesa?.nome ?? email ?? 'Você'
  const naMesa = campanha?.naMesa ?? []
  const nomesNaMesa = naMesa.map((pessoa) => (pessoa.papel === 'mestre' ? `${pessoa.nome} (mestre)` : pessoa.nome)).join(', ')

  const link = (alvo: Rota, texto: string) => (
    <a href={enderecoDaRota(alvo, demo)} onClick={aoClicarNoLink(site, alvo)}>
      {texto}
    </a>
  )

  return (
    <header className="lo-cabeca">
      <div className="lo-topo">
        <a className="lo-marca" href={enderecoDaRota({ tela: 'campanhas' }, demo)} onClick={aoClicarNoLink(site, { tela: 'campanhas' })} aria-label="Labirinto Lobby, suas mesas">
          <span className="lo-marca__nome">Labirinto</span>
          <span className="lo-marca__lobby">Lobby</span>
        </a>
        {campanhaDaRota(rota) !== null && eu.t === 'pronto' ? (
          // Dentro de uma mesa: as partes dela, sempre no mesmo lugar (H1). A mesa e a ficha estão no título de cada página.
          <NavDaMesa rota={rota} nomeDaMesa={nomeDaMesa} />
        ) : (
          <nav className="lo-trilha" aria-label="Onde você está">
            <ol>
              <li>{rota.tela === 'campanhas' ? <span aria-current="page">Suas mesas</span> : link({ tela: 'campanhas' }, 'Suas mesas')}</li>
            </ol>
          </nav>
        )}
        <div className="lo-topo__direita">
          {naMesa.length > 0 && (
            <div className="lo-agora-mini" title={`Na mesa agora: ${nomesNaMesa}`}>
              <div className="lo-agora-mini__rostos" aria-hidden="true">
                {naMesa.map((pessoa) => (
                  <span key={pessoa.contaId} className="lo-av" data-tom={tomDe(pessoa.contaId)}>
                    {pessoa.nome.slice(0, 1)}
                  </span>
                ))}
              </div>
              <span>
                <span className="lo-sr">Na mesa agora: {nomesNaMesa}. </span>
                <span aria-hidden="true">{naMesa.length} na mesa</span>
              </span>
            </div>
          )}
          {email !== null && (
            <>
              <button type="button" className="lo-conta" popoverTarget="lo-menu-conta" aria-label={`Conta de ${nomeDaConta} (${email})`}>
                <span className="lo-av" data-tom={tomDe(euNaMesa?.contaId ?? email)} aria-hidden="true">
                  {nomeDaConta.slice(0, 1).toUpperCase()}
                </span>
                <span className="lo-conta__nome">{nomeDaConta}</span>
              </button>
              <div className="lo-menu" id="lo-menu-conta" popover="auto">
                <div className="lo-menu__quem">
                  <span className="lo-av" data-tom={tomDe(euNaMesa?.contaId ?? email)} aria-hidden="true">
                    {nomeDaConta.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p>{nomeDaConta}</p>
                    <p className="lo-menu__email">{email}</p>
                  </div>
                </div>
                {demo ? (
                  <p className="lo-motivo lo-menu__nota">Demonstração: dados inventados, sem login. Nada sai deste navegador.</p>
                ) : (
                  <a className="lo-btn lo-btn--fantasma" href={SAIR_DO_ACCESS}>
                    <Icone nome="sair" /> Sair
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {campanha !== null && <Faixa campanha={campanha} />}
    </header>
  )
}

type ParteDaMesa = 'inicio' | 'fichas' | 'chat' | 'mural' | 'treino' | 'duelo'

/** Em que parte da mesa a rota está (a ficha, a mochila e o histórico moram em "Fichas"). */
function parteDaRota(rota: Rota): ParteDaMesa | null {
  switch (rota.tela) {
    case 'campanha':
      return 'inicio'
    case 'fichas':
    case 'ficha':
      return 'fichas'
    case 'chat':
      return 'chat'
    case 'mural':
      return 'mural'
    case 'treino':
      return rota.parte === 'duelo' ? 'duelo' : 'treino'
    default:
      return null
  }
}

/**
 * AS PARTES DA MESA (H1), na cabeça de toda tela de dentro dela: início (o
 * lobby), fichas, chat com as não lidas, mural com os avisos não lidos,
 * treino e duelo. Treino e duelo ficam à vista mas parados, com o motivo,
 * enquanto as telas deles (T7) não chegam.
 */
function NavDaMesa({ rota, nomeDaMesa }: { rota: Rota; nomeDaMesa: string | null }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const naoLidasDoChat = useDoSite((estado) => estado.chat?.naoLidas ?? 0)
  const meuId = useDoSite((estado) => estado.campanha?.eu?.contaId ?? null)
  const avisosNaoLidos = useDoSite((estado) => estado.mural?.fixadas.filter((noticia) => !noticia.lida && noticia.autorContaId !== meuId).length ?? 0)
  const campanhaId = campanhaDaRota(rota)
  if (campanhaId === null) return null
  const atual = parteDaRota(rota)

  const item = (parte: ParteDaMesa, alvo: Rota, icone: NomeDoIcone, nome: string, conta: string | null, rotuloDaConta: string) => (
    <li>
      <a
        className="lo-secoes__item"
        href={enderecoDaRota(alvo, demo)}
        onClick={aoClicarNoLink(site, alvo)}
        // A página exata é "page"; dentro de uma ficha, "Fichas" é a parte onde se está.
        aria-current={atual === parte ? (parte === 'fichas' && rota.tela === 'ficha' ? 'true' : 'page') : undefined}
        aria-label={conta === null ? undefined : `${nome}, ${rotuloDaConta}`}
      >
        <Icone nome={icone} />
        <span>{nome}</span>
        {conta !== null && (
          <span className="lo-chat__conta" aria-hidden="true">
            {conta}
          </span>
        )}
      </a>
    </li>
  )

  const parado = (icone: NomeDoIcone, nome: string) => (
    <li>
      <span className="lo-secoes__item" aria-disabled="true" title={MOTIVO_DO_TREINO}>
        <Icone nome={icone} />
        <span>{nome}</span>
        <span className="lo-secoes__breve">
          em breve<span className="lo-sr">: {MOTIVO_DO_TREINO}</span>
        </span>
      </span>
    </li>
  )

  return (
    <nav className="lo-secoes" aria-label={nomeDaMesa === null ? 'Partes da mesa' : `Partes da mesa ${nomeDaMesa}`}>
      <ul>
        {item('inicio', { tela: 'campanha', campanhaId }, 'lobby', 'Início', null, '')}
        {item('fichas', { tela: 'fichas', campanhaId }, 'ficha', 'Fichas', null, '')}
        {item(
          'chat',
          { tela: 'chat', campanhaId, com: null },
          'conversa',
          'Chat',
          naoLidasDoChat > 0 ? contagemDeNaoLidas(naoLidasDoChat) : null,
          `${contagemDeNaoLidas(naoLidasDoChat)} não ${naoLidasDoChat === 1 ? 'lida' : 'lidas'}`,
        )}
        {item(
          'mural',
          { tela: 'mural', campanhaId, aba: 'noticias' },
          'mural',
          'Mural',
          avisosNaoLidos > 0 ? String(avisosNaoLidos) : null,
          `${avisosNaoLidos} ${avisosNaoLidos === 1 ? 'aviso não lido' : 'avisos não lidos'}`,
        )}
        {TREINO_NO_SITE ? item('treino', { tela: 'treino', campanhaId, parte: 'lutas' }, 'treino', 'Treino', null, '') : parado('treino', 'Treino')}
        {TREINO_NO_SITE ? item('duelo', { tela: 'treino', campanhaId, parte: 'duelo' }, 'duelo', 'Duelo', null, '') : parado('duelo', 'Duelo')}
      </ul>
    </nav>
  )
}

type NomeDoEstado = 'decisao' | 'erro' | 'offline' | 'conectando' | 'enviando' | 'salvo'

function estadoDaFaixa(campanha: EstadoDaCampanha): NomeDoEstado {
  if (campanha.conexao === 'versao' || campanha.conexao === 'sem-acesso' || campanha.erroLocal !== null) return 'erro'
  if (campanha.paraDecidir.length > 0) return 'decisao'
  if (campanha.conexao === 'sem-rede') return 'offline'
  if (campanha.conexao === 'conectando' || !campanha.carregada) return 'conectando'
  return mudancasACaminho(campanha) > 0 ? 'enviando' : 'salvo'
}

function Faixa({ campanha }: { campanha: EstadoDaCampanha }) {
  const site = useSite()
  const estado = estadoDaFaixa(campanha)
  const anterior = useRef<NomeDoEstado>(estado)
  // O visto assenta uma vez, quando o servidor acabou de confirmar (enviando -> salvo).
  const [recem, setRecem] = useState(false)
  useEffect(() => {
    setRecem(anterior.current === 'enviando' && estado === 'salvo')
    anterior.current = estado
  }, [estado])

  const n = mudancasACaminho(campanha)
  const nd = campanha.paraDecidir.length
  const primeira = campanha.paraDecidir.at(0)

  function verDecisao() {
    if (primeira === undefined) return
    pedirFocoNoAviso(primeira.op.opId)
    site.irPara({ tela: 'ficha', campanhaId: campanha.campanhaId, fichaId: primeira.op.fichaId, aba: 'ficha' })
  }

  let principal
  let extra = null
  switch (estado) {
    case 'erro':
      principal = (
        <>
          <Icone nome="alerta" />
          <span>{campanha.conexao === 'versao' ? 'O Lobby foi atualizado' : campanha.conexao === 'sem-acesso' ? 'Você não está mais nesta mesa' : 'Não deu para guardar neste navegador'}</span>
        </>
      )
      extra =
        campanha.conexao === 'versao' ? (
          <button type="button" className="lo-btn lo-faixa__acao" onClick={() => window.location.reload()}>
            Recarregar a página
          </button>
        ) : (
          <span className="lo-faixa__extra">
            {campanha.conexao === 'sem-acesso'
              ? 'Peça ao mestre para te convidar de novo com este e-mail.'
              : `${campanha.erroLocal ?? ''} A última mudança não foi feita; libere espaço ou feche outras abas e tente de novo.`}
          </span>
        )
      break
    case 'decisao':
      principal = (
        <>
          <Icone nome="alerta" />
          <span>{nd === 1 ? '1 precisa da sua decisão' : `${nd} precisam da sua decisão`}</span>
        </>
      )
      extra = (
        <>
          <button type="button" className="lo-btn lo-faixa__acao" onClick={verDecisao}>
            Ver
          </button>
          {n > 0 && <span className="lo-faixa__extra">{campanha.conexao === 'sem-rede' ? `Sem internet: ${n} esperando` : `Enviando ${n}`}</span>}
        </>
      )
      break
    case 'offline':
      principal = (
        <>
          <Icone nome="sem-rede" />
          <span>{n > 0 ? `Sem internet: ${n} esperando` : 'Sem internet'}</span>
        </>
      )
      extra = (
        <span className="lo-faixa__extra">
          {n > 0 ? `${n === 1 ? 'Ela vai sozinha' : 'Elas vão sozinhas'} quando a conexão voltar. Mudanças novas ficam pausadas até lá.` : 'Mudanças novas ficam pausadas até a conexão voltar.'}
        </span>
      )
      break
    case 'conectando':
      principal = (
        <>
          <span className="lo-giro" aria-hidden="true" />
          <span>Conectando à mesa…</span>
        </>
      )
      break
    case 'enviando':
      principal = (
        <>
          <span className="lo-giro" aria-hidden="true" />
          <span>Enviando {n}</span>
        </>
      )
      break
    case 'salvo':
      principal = (
        <>
          <Icone nome="visto" />
          <span>Salvo</span>
        </>
      )
      extra = <span className="lo-faixa__extra">Tudo o que você mudou está no servidor.</span>
      break
  }

  return (
    <div className="lo-faixa" data-estado={estado === 'erro' ? 'decisao' : estado} data-recem={recem ? '1' : undefined} role="status" aria-live="polite">
      <div className="lo-faixa__dentro">
        <p className="lo-faixa__principal">{principal}</p>
        {extra}
      </div>
    </div>
  )
}
