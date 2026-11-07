import { useId, useState } from 'react'
import { chatChannelKey } from '../../../lib/chat'
import type { CanalDoChat } from '../../../lib/nuvem/chatDoLobby'
import { CONTA_DO_MESTRE, type MembroProjetado } from '../../../lib/nuvem/tipos'
import type { ConversaDoChat, EstadoDoChat } from '../../dados/chatDaCampanha'
import { enderecoDaRota, type Rota } from '../../dados/rotas'
import type { EstadoDaCampanha } from '../../dados/sessaoDaCampanha'
import { aoClicarNoLink, useDoSite, useSite } from '../contexto'
import { AvisoDaPagina, Carregando } from '../Estados'
import { Icone } from '../Icone'
import { Rosto } from '../Rosto'
import { avisoJaVisto, JanelaDoAviso } from './AvisoDoPrivado'
import { Conversa } from './Conversa'
import { contagemDeNaoLidas, privadoEntreJogadores } from './textosDoChat'
import './chat.css'

/**
 * O CHAT DA MESA no site (plano do Lobby §8.2, fatia C2): a sala, que a mesa
 * inteira lê, e um privado com cada pessoa. À esquerda as conversas, com as
 * não lidas; à direita a conversa aberta. O privado entre dois jogadores leva
 * o aviso honesto (12.19): uma vez numa janela, e sempre no rodapé.
 */

type RotaDoChat = Extract<Rota, { tela: 'chat' }>

/** Uma linha da lista de conversas: a sala ou o privado com uma conta. */
interface Entrada {
  chave: string
  canal: CanalDoChat
  rota: RotaDoChat
  nome: string
  /** `null` = a sala. */
  com: MembroProjetado | null
  /** A conta saiu da mesa (só ler o que já foi dito). */
  saiu: boolean
}

export function TelaChat({ rota }: { rota: RotaDoChat }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const campanha = useDoSite((estado) => estado.campanha)
  const chat = useDoSite((estado) => estado.chat)
  const erroDaCampanha = useDoSite((estado) => estado.erroDaCampanha)
  const nomeDaMesa = useDoSite((estado) => (estado.eu.t === 'pronto' ? estado.eu.eu.campanhas.find((linha) => linha.campanhaId === rota.campanhaId)?.nomeDaCampanha : undefined))
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
  if (campanha === null || campanha.campanhaId !== rota.campanhaId || !campanha.carregada || chat === null) return <Carregando texto="Abrindo o chat da mesa…" />
  return <Chat rota={rota} campanha={campanha} chat={chat} nomeDaMesa={nomeDaMesa ?? 'Mesa'} />
}

/** A sala, depois o mestre, depois os colegas por nome; e quem saiu da mesa mas tem conversa guardada. */
function entradasDoChat(campanha: EstadoDaCampanha, chat: EstadoDoChat): Entrada[] {
  const { campanhaId, eu } = campanha
  const sala: Entrada = { chave: 'sala', canal: 'sala', rota: { tela: 'chat', campanhaId, com: null }, nome: 'Sala da mesa', com: null, saiu: false }
  const outros = campanha.membros
    .filter((membro) => membro.contaId !== eu?.contaId)
    .sort((a, b) => Number(b.contaId === CONTA_DO_MESTRE) - Number(a.contaId === CONTA_DO_MESTRE) || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((membro): Entrada => {
      const canal: CanalDoChat = { dm: membro.contaId }
      return { chave: chatChannelKey(canal), canal, rota: { tela: 'chat', campanhaId, com: membro.contaId }, nome: membro.nome, com: membro, saiu: false }
    })
  const conhecidas = new Set([sala.chave, ...outros.map((entrada) => entrada.chave)])
  const quemSaiu = [...chat.conversas.values()]
    .filter((conversa) => !conhecidas.has(conversa.chave) && conversa.canal !== 'sala' && conversa.ultimaId > 0)
    .map((conversa): Entrada => {
      const contaId = conversa.canal === 'sala' ? '' : conversa.canal.dm
      const nome = conversa.mensagens.find((msg) => msg.autorContaId === contaId)?.autorNome ?? 'Conta que saiu da mesa'
      return { chave: conversa.chave, canal: conversa.canal, rota: { tela: 'chat', campanhaId, com: contaId }, nome, com: null, saiu: true }
    })
  return [sala, ...outros, ...quemSaiu]
}

function Chat({ rota, campanha, chat, nomeDaMesa }: { rota: RotaDoChat; campanha: EstadoDaCampanha; chat: EstadoDoChat; nomeDaMesa: string }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const listaId = useId()
  /** Só para desenhar de novo quando a janela do aviso fecha (o "visto" mora fora do React). */
  const [, setAvisosFechados] = useState(0)
  const eu = campanha.eu
  const entradas = entradasDoChat(campanha, chat)
  const atual = entradas.find((entrada) => (rota.com === null ? entrada.com === null && !entrada.saiu : entrada.rota.com === rota.com))
  const daMesa: Rota = { tela: 'campanha', campanhaId: campanha.campanhaId }
  const naMesa = new Set(campanha.naMesa.map((pessoa) => pessoa.contaId))
  const salaEPrivados = entradas.filter((entrada) => entrada.com === null && !entrada.saiu)
  const privados = entradas.filter((entrada) => entrada.com !== null || entrada.saiu)

  // A janela do aviso aparece ao abrir o primeiro privado entre jogadores da mesa (pelo clique ou direto pelo endereço).
  const mostrarAviso =
    atual !== undefined && atual.com !== null && eu !== null && privadoEntreJogadores(eu, atual.com.contaId) && !avisoJaVisto(campanha.campanhaId, eu.contaId, demo)

  const linha = (entrada: Entrada) => {
    const conversa: ConversaDoChat | undefined = chat.conversas.get(entrada.chave)
    const naoLidas = conversa?.naoLidas ?? 0
    const ehAtual = entrada.chave === atual?.chave
    const contaId = entrada.com?.contaId ?? null
    const rotulo = [
      entrada.com === null && !entrada.saiu ? 'Sala da mesa' : `Privado com ${entrada.nome}${entrada.com?.papel === 'mestre' ? ' (mestre)' : ''}`,
      contaId !== null && naMesa.has(contaId) ? 'na mesa agora' : '',
      naoLidas > 0 ? `${contagemDeNaoLidas(naoLidas)} não ${naoLidas === 1 ? 'lida' : 'lidas'}` : '',
      conversa?.mencaoNaoLida === true ? 'menciona você' : '',
    ]
      .filter((parte) => parte !== '')
      .join(', ')
    return (
      <li key={entrada.chave}>
        <a
          className="lo-chat__conv"
          href={enderecoDaRota(entrada.rota, demo)}
          onClick={aoClicarNoLink(site, entrada.rota)}
          aria-current={ehAtual ? 'page' : undefined}
          aria-label={rotulo}
          data-saiu={entrada.saiu ? '1' : undefined}
        >
          {entrada.com === null && !entrada.saiu ? (
            <span className="lo-chat__sala" aria-hidden="true">
              <Icone nome="conversa" />
            </span>
          ) : (
            <Rosto contaId={contaId} nome={entrada.nome} semente={contaId ?? entrada.chave}>
              {contaId !== null && naMesa.has(contaId) && <span className="lo-ponto" />}
            </Rosto>
          )}
          <span className="lo-chat__conv-nome" aria-hidden="true">
            {entrada.nome}
            {entrada.com?.papel === 'mestre' && <span className="lo-chat__conv-papel"> mestre</span>}
          </span>
          {conversa?.mencaoNaoLida === true && (
            <span className="lo-chat__arroba" aria-hidden="true">
              @
            </span>
          )}
          {naoLidas > 0 && (
            <span className="lo-chat__conta" aria-hidden="true">
              {contagemDeNaoLidas(naoLidas)}
            </span>
          )}
        </a>
      </li>
    )
  }

  let painel
  if (atual === undefined) {
    painel = (
      <section className="lo-folha lo-chat__folha">
        <p className="lo-vazio">Esta conversa não existe nesta mesa. Escolha a sala ou alguém da lista.</p>
      </section>
    )
  } else {
    const ehSala = atual.com === null && !atual.saiu
    const comAviso = eu !== null && atual.com !== null && privadoEntreJogadores(eu, atual.com.contaId)
    const descricao = ehSala
      ? `Todo mundo da mesa lê. ${campanha.membros.length} ${campanha.membros.length === 1 ? 'pessoa' : 'pessoas'}.`
      : atual.saiu
        ? 'Esta pessoa saiu da mesa: dá para ler o que foi dito, não para responder.'
        : atual.com?.papel === 'mestre'
          ? `Conversa só entre você e ${atual.nome}, o mestre.`
          : eu?.papel === 'mestre'
            ? `Conversa só entre você e ${atual.nome}.`
            : `Conversa entre você e ${atual.nome}.`
    painel = (
      <Conversa
        key={atual.chave}
        chave={atual.chave}
        canal={atual.canal}
        conversa={chat.conversas.get(atual.chave)}
        pronto={chat.pronto}
        eu={eu}
        membros={campanha.membros}
        titulo={ehSala ? 'Sala da mesa' : atual.nome}
        descricao={descricao}
        nomeDaMesa={nomeDaMesa}
        comAviso={comAviso}
        bloqueado={atual.saiu ? 'Esta pessoa saiu da mesa: a conversa fica só para ler.' : null}
        coberta={mostrarAviso}
      />
    )
  }

  return (
    <div className="lo-pagina lo-pagina--chat">
      <header className="lo-cab-pag lo-chat__cab-pag">
        <div className="lo-cab-pag__texto">
          <a className="lo-voltar" href={enderecoDaRota(daMesa, demo)} onClick={aoClicarNoLink(site, daMesa)}>
            <Icone nome="voltar" /> {nomeDaMesa}
          </a>
          <h1 className="lo-titulo">Chat da mesa</h1>
        </div>
      </header>
      <div className="lo-chat">
        <nav className="lo-chat__lado" aria-labelledby={listaId}>
          <h2 className="lo-sr" id={listaId}>
            Conversas
          </h2>
          <ul className="lo-chat__lista">{salaEPrivados.map(linha)}</ul>
          {privados.length > 0 && (
            <>
              <p className="lo-chat__grupo" aria-hidden="true">
                Em particular
              </p>
              <ul className="lo-chat__lista">{privados.map(linha)}</ul>
            </>
          )}
        </nav>
        {painel}
      </div>
      {mostrarAviso && eu !== null && <JanelaDoAviso campanhaId={campanha.campanhaId} contaId={eu.contaId} demo={demo} aoFechar={() => setAvisosFechados((n) => n + 1)} />}
    </div>
  )
}
