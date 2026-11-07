import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CHAT_MASTER_MENTION, isDirectChannel } from '../../../lib/chat'
import type { CanalDoChat, MensagemDoChat } from '../../../lib/nuvem/chatDoLobby'
import type { MembroProjetado } from '../../../lib/nuvem/tipos'
import type { ConversaDoChat, MensagemPendente } from '../../dados/chatDaCampanha'
import { useAgora, useSite } from '../contexto'
import { Icone } from '../Icone'
import { Rosto } from '../Rosto'
import { horaExata, nomeDoDia } from '../textos'
import { motivoDaSoLeitura, useSoLeitura } from '../VerComo'
import { Compositor } from './Compositor'
import { RodapeDoPrivado } from './AvisoDoPrivado'
import { continuaOBloco, nomeDoArquivo, nomeNoChat, pedacosDoTexto, textoDaSituacao, textoDoArquivo } from './textosDoChat'

/**
 * UMA CONVERSA do chat (C2): a cabeça (quem lê, baixar), o registro com
 * "carregar anteriores" no topo e o campo de escrever embaixo. O registro
 * acompanha a mensagem nova só quando quem lê está no fim; mais acima, aparece
 * "Mensagens novas" e ninguém é empurrado. Ler o fim marca como lida.
 */

/** Até esta distância do fim, em px, o registro acompanha a mensagem nova. */
const DISTANCIA_DO_FIM_PX = 48

/** U+FEFF, a marca de ordem dos bytes do UTF-8. */
const MARCA_DE_UTF8 = String.fromCharCode(0xfeff)

export interface PropsDaConversa {
  chave: string
  canal: CanalDoChat
  conversa: ConversaDoChat | undefined
  /** O chat está em dia com o servidor. */
  pronto: boolean
  eu: MembroProjetado | null
  membros: readonly MembroProjetado[]
  titulo: string
  descricao: string
  nomeDaMesa: string
  /** Rodapé de privado entre jogadores (o aviso honesto, sempre). */
  comAviso: boolean
  /** Motivo de não dar para escrever aqui; `null` = pode. */
  bloqueado: string | null
  /** A janela do aviso cobre a conversa: nada conta como lido até ela fechar. */
  coberta: boolean
}

type Baixada = { t: 'parada' } | { t: 'juntando' } | { t: 'feita'; quantas: number } | { t: 'erro'; texto: string }

function horaCurta(t: number): string {
  return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function salvarArquivo(nome: string, texto: string): void {
  // A marca de UTF-8 na frente: o Bloco de Notas antigo e o Excel abrem os acentos certos.
  const url = URL.createObjectURL(new Blob([MARCA_DE_UTF8, texto], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.append(link)
  link.click()
  link.remove()
  // O navegador já leu o endereço no clique; soltar no próximo giro libera a memória.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function Conversa(props: PropsDaConversa) {
  const { chave, canal, conversa, pronto, eu, membros, titulo, descricao, nomeDaMesa, comAviso, bloqueado, coberta } = props
  const site = useSite()
  const chat = site.chat()
  // "Ver como": a sala chega pelo store (ao vivo), mas nada sai daqui: escrever, apagar, baixar e pedir as anteriores ficam de fora.
  const soLeitura = useSoLeitura()
  // De segundo em segundo só com uma mensagem segurada (a contagem "vai sozinha em 3 s"); senão, de minuto em minuto.
  const agora = useAgora(conversa?.pendentes.some((pendente) => pendente.situacao.t === 'esperando') === true ? 1_000 : 60_000)
  const registroRef = useRef<HTMLDivElement>(null)
  const noFim = useRef(true)
  /** O maior id que já estava na tela quando a conversa carregou: só o que vem depois entra com movimento. */
  const linhaDeBase = useRef<number | null>(null)
  /** A posição antes de pedir as anteriores: elas entram em cima sem mexer no que se está lendo. */
  const ancora = useRef<{ altura: number; topo: number; primeira: number } | null>(null)
  /** Quantas a caminho no último desenho: uma a mais = a pessoa acabou de mandar, e a conversa desce até ela. */
  const pendentesAntes = useRef(0)
  const [novasAbaixo, setNovasAbaixo] = useState(false)
  const [baixada, setBaixada] = useState<Baixada>({ t: 'parada' })
  const mensagens = conversa?.mensagens ?? []
  const pendentes = conversa?.pendentes ?? []
  const ultima = mensagens.at(-1)
  const naoLidas = conversa?.naoLidas ?? 0
  const carregada = conversa?.carregada === true

  // A chave identifica o canal (o objeto `canal` é novo a cada render).
  useEffect(() => {
    if (chat === null) return
    chat.abrir(canal)
    return () => chat.soltar(canal)
  }, [chat, chave])

  if (conversa?.carregada === true && linhaDeBase.current === null) linhaDeBase.current = ultima?.id ?? 0

  // Anteriores chegaram em cima: devolve a rolagem para a mesma mensagem. Nova no fim: acompanha se a pessoa estava lá.
  // A própria pessoa mandou: desce até o fim mesmo que ela estivesse lendo lá em cima (o "enviando…" fica à vista).
  useLayoutEffect(() => {
    const caixa = registroRef.current
    if (caixa === null) return
    const mandouAgora = pendentes.length > pendentesAntes.current
    pendentesAntes.current = pendentes.length
    if (mandouAgora) {
      noFim.current = true
      ancora.current = null
      caixa.scrollTop = caixa.scrollHeight
      setNovasAbaixo(false)
      return
    }
    const antes = ancora.current
    const primeira = mensagens.at(0)
    if (antes !== null && primeira !== undefined && primeira.id < antes.primeira) {
      caixa.scrollTop = caixa.scrollHeight - antes.altura + antes.topo
      ancora.current = null
      return
    }
    if (noFim.current) caixa.scrollTop = caixa.scrollHeight
  }, [mensagens, pendentes.length])

  // Mensagem de outra pessoa chegou com quem lê lá em cima: o botão "Mensagens novas" aparece.
  useEffect(() => {
    if (ultima === undefined || noFim.current || ultima.autorContaId === eu?.contaId) return
    if (linhaDeBase.current !== null && ultima.id > linhaDeBase.current) setNovasAbaixo(true)
  }, [ultima, eu])

  // Ler o fim com a aba à vista marca como lida (e de novo quando a aba volta a aparecer).
  useEffect(() => {
    if (chat === null || !pronto || !carregada || naoLidas === 0 || coberta) return
    const ler = () => {
      if (document.visibilityState === 'visible' && noFim.current) chat.marcarLida(canal)
    }
    ler()
    document.addEventListener('visibilitychange', ler)
    return () => document.removeEventListener('visibilitychange', ler)
  }, [chat, chave, pronto, carregada, naoLidas, coberta])

  function acompanharRolagem(): void {
    const caixa = registroRef.current
    if (caixa === null) return
    noFim.current = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight <= DISTANCIA_DO_FIM_PX
    if (!noFim.current) return
    setNovasAbaixo(false)
    if (naoLidas > 0 && pronto && !coberta && document.visibilityState === 'visible') chat?.marcarLida(canal)
  }

  function irParaOFim(): void {
    const caixa = registroRef.current
    if (caixa === null) return
    noFim.current = true
    caixa.scrollTop = caixa.scrollHeight
    setNovasAbaixo(false)
  }

  function carregarAnteriores(): void {
    const caixa = registroRef.current
    const primeira = mensagens.at(0)
    if (caixa !== null && primeira !== undefined) ancora.current = { altura: caixa.scrollHeight, topo: caixa.scrollTop, primeira: primeira.id }
    chat?.carregarAnteriores(canal)
  }

  async function baixar(): Promise<void> {
    if (chat === null) return
    setBaixada({ t: 'juntando' })
    try {
      const todas = await chat.juntarTudo(canal)
      const momento = Date.now()
      const quem = eu === null ? 'você' : eu.nome
      const texto = textoDoArquivo({ nomeDaMesa, nomeDaConversa: titulo, quemBaixou: quem, agora: momento }, todas, eu?.contaId ?? null)
      salvarArquivo(nomeDoArquivo(nomeDaMesa, titulo, momento), texto)
      setBaixada({ t: 'feita', quantas: todas.length })
    } catch (erro) {
      setBaixada({ t: 'erro', texto: erro instanceof Error ? erro.message : 'Não deu para juntar a conversa' })
    }
  }

  const ehPrivado = isDirectChannel(canal)
  const vazia = conversa?.carregada === true && mensagens.length === 0 && pendentes.length === 0

  let conteudo: ReactNode
  if (conversa?.fechada === true) {
    conteudo = <p className="lo-vazio">Esta conversa não abre mais: a outra pessoa saiu da mesa.</p>
  } else if (conversa?.carregada !== true) {
    conteudo = (
      <p className="lo-chat__carregando" role="status">
        {pronto ? <span className="lo-giro" aria-hidden="true" /> : <Icone nome="sem-rede" />}
        {pronto ? 'Carregando a conversa…' : 'Esperando a conexão com a mesa…'}
      </p>
    )
  } else if (vazia) {
    conteudo = (
      <div className="lo-vazio lo-chat__vazio">
        <Icone nome="conversa" />
        <p>{ehPrivado ? `Nenhuma mensagem com ${titulo} ainda.` : 'Ninguém falou na sala ainda.'}</p>
        <p className="lo-motivo">{ehPrivado ? 'Só vocês dois leem o que for escrito aqui.' : 'Diga oi para a mesa: todo mundo lê o que é escrito aqui.'}</p>
      </div>
    )
  } else {
    conteudo = (
      <>
        {conversa.temMaisAntigas ? (
          <div className="lo-chat__antes">
            <button type="button" className="lo-btn lo-btn--fantasma" disabled={conversa.carregando || !pronto || soLeitura !== null} onClick={carregarAnteriores}>
              {conversa.carregando ? 'Carregando…' : 'Carregar anteriores'}
            </button>
            {soLeitura !== null && <span className="lo-motivo">As mais antigas abrem quando você voltar a ser mestre.</span>}
          </div>
        ) : (
          <p className="lo-chat__inicio">Começo da conversa</p>
        )}
        <ol className="lo-chat__linhas">
          {mensagens.map((msg, i) => {
            const anterior = mensagens[i - 1]
            const outroDia = anterior === undefined || new Date(anterior.criadaEm).toDateString() !== new Date(msg.criadaEm).toDateString()
            return (
              <Linha
                key={msg.id}
                canal={canal}
                msg={msg}
                dia={outroDia ? nomeDoDia(msg.criadaEm, agora) : null}
                continua={!outroDia && continuaOBloco(anterior, msg)}
                nova={linhaDeBase.current !== null && msg.id > linhaDeBase.current && msg.autorContaId !== eu?.contaId}
                apagando={conversa.apagando.has(msg.id)}
                eu={eu}
                membros={membros}
                podeApagar={pronto && soLeitura === null && msg.autorContaId === eu?.contaId && msg.apagadaEm === null}
              />
            )
          })}
          {pendentes.map((pendente) => (
            <LinhaPendente key={pendente.idDoCliente} canal={canal} pendente={pendente} eu={eu} membros={membros} agora={agora} />
          ))}
        </ol>
      </>
    )
  }

  return (
    <section className="lo-folha lo-chat__folha" aria-labelledby={`${chave}-titulo`}>
      <header className="lo-chat__cab">
        <div className="lo-chat__cab-texto">
          <h2 className="lo-painel__titulo" id={`${chave}-titulo`}>
            {titulo}
          </h2>
          <p className="lo-motivo">{descricao}</p>
        </div>
        {soLeitura === null && (
        <div className="lo-chat__cab-acoes">
          <button
            type="button"
            className="lo-btn lo-btn--fantasma"
            disabled={!pronto || baixada.t === 'juntando' || conversa?.carregada !== true || mensagens.length === 0}
            onClick={() => void baixar()}
          >
            <Icone nome="baixar" />
            {baixada.t === 'juntando' ? 'Juntando a conversa…' : 'Baixar minha conversa'}
          </button>
          <p className="lo-motivo lo-chat__baixada" role="status">
            {baixada.t === 'feita' && `Baixada: ${baixada.quantas} ${baixada.quantas === 1 ? 'mensagem' : 'mensagens'}.`}
            {baixada.t === 'erro' && baixada.texto}
          </p>
        </div>
        )}
      </header>
      {!pronto && soLeitura === null && conversa?.carregada === true && (
        <p className="lo-linha-aviso lo-chat__fora" data-tom="mare">
          <Icone nome="sem-rede" />
          <span>Sem conexão com a mesa. O que você enviar fica guardado nesta aba e vai sozinho quando a conexão voltar.</span>
        </p>
      )}
      <div className="lo-chat__registro-casca">
        <div
          ref={registroRef}
          className="lo-chat__registro"
          role="log"
          aria-label={`Mensagens: ${titulo}`}
          aria-busy={conversa?.carregando === true ? true : undefined}
          tabIndex={0}
          onScroll={acompanharRolagem}
        >
          {conteudo}
        </div>
        {novasAbaixo && (
          <button type="button" className="lo-btn lo-chat__novas" onClick={irParaOFim}>
            Mensagens novas
          </button>
        )}
      </div>
      {conversa?.fechada !== true && (
        <Compositor
          key={chave}
          chave={chave}
          rotulo={ehPrivado ? `Mensagem para ${titulo}` : 'Mensagem para a mesa'}
          nomes={ehPrivado ? [] : nomesParaMencionar(membros, eu)}
          bloqueado={soLeitura !== null ? `${motivoDaSoLeitura(soLeitura.nome)} A mensagem sairia em seu nome, não no dele.` : bloqueado}
          aoEnviar={(texto) => chat?.enviar(canal, texto) ?? false}
        />
      )}
      {comAviso && <RodapeDoPrivado />}
    </section>
  )
}

/** Os colegas pelo nome e o mestre por `@mestre` (o mesmo que o servidor reconhece, `mencoesDaSala`); quem escreve fica de fora. */
function nomesParaMencionar(membros: readonly MembroProjetado[], eu: MembroProjetado | null): string[] {
  const colegas = membros.filter((membro) => membro.contaId !== eu?.contaId && membro.papel !== 'mestre').map((membro) => membro.nome)
  return eu?.papel === 'mestre' ? colegas : [CHAT_MASTER_MENTION, ...colegas]
}

function Texto({ texto, eu, membros }:{ texto: string; eu: MembroProjetado | null; membros: readonly MembroProjetado[] }) {
  // Sempre filho de texto do React, nunca HTML: `<img src=x onerror=...>` aparece como foi escrito.
  return (
    <>
      {pedacosDoTexto(texto, membros, eu).map((pedaco, i) =>
        pedaco.t === 'texto' ? (
          <span key={i}>{pedaco.texto}</span>
        ) : (
          <span key={i} className="lo-chat__mencao" data-a-mim={pedaco.aMim ? '1' : undefined}>
            {pedaco.texto}
          </span>
        ),
      )}
    </>
  )
}

interface PropsDaLinha {
  canal: CanalDoChat
  msg: MensagemDoChat
  dia: string | null
  continua: boolean
  nova: boolean
  apagando: boolean
  eu: MembroProjetado | null
  membros: readonly MembroProjetado[]
  podeApagar: boolean
}

function Linha({ canal, msg, dia, continua, nova, apagando, eu, membros, podeApagar }: PropsDaLinha) {
  const site = useSite()
  const [confirmando, setConfirmando] = useState(false)
  const apagada = msg.apagadaEm !== null
  const quem = nomeNoChat(msg.autorContaId, msg.autorNome, eu?.contaId ?? null)
  const aMim = !apagada && eu !== null && msg.mencoes.includes(eu.contaId)

  function apagar(): void {
    setConfirmando(false)
    site.chat()?.apagar(canal, msg.id)
  }

  return (
    <>
      {dia !== null && (
        <li className="lo-chat__dia">{dia}</li>
      )}
      <li className="lo-msg" data-continua={continua ? '1' : undefined} data-nova={nova ? '1' : undefined} data-a-mim={aMim ? '1' : undefined} data-apagada={apagada ? '1' : undefined}>
        {continua ? (
          <span className="lo-msg__lado" aria-hidden="true" />
        ) : (
          <Rosto className="lo-msg__lado" contaId={msg.autorContaId} nome={msg.autorNome} />
        )}
        <div className="lo-msg__corpo">
          <p className={continua ? 'lo-sr' : 'lo-msg__cab'}>
            <span className="lo-msg__quem" data-eu={msg.autorContaId === eu?.contaId ? '1' : undefined}>
              {quem}
            </span>{' '}
            <time className="lo-msg__hora" dateTime={new Date(msg.criadaEm).toISOString()} title={horaExata(msg.criadaEm)}>
              {horaCurta(msg.criadaEm)}
            </time>
            {aMim && <span className="lo-sr"> (menciona você)</span>}
          </p>
          <p className="lo-msg__texto">{apagada ? 'Mensagem apagada' : <Texto texto={msg.texto} eu={eu} membros={membros} />}</p>
          {confirmando && (
            <div className="lo-confirma lo-msg__confirma">
              <p>Apagar esta mensagem para todo mundo? Fica só "Mensagem apagada" no lugar.</p>
              <div>
                <button type="button" className="lo-btn" autoFocus onClick={apagar}>
                  Apagar
                </button>
                <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => setConfirmando(false)}>
                  Manter
                </button>
              </div>
            </div>
          )}
        </div>
        {podeApagar && !confirmando && (
          <div className="lo-msg__acoes">
            <button type="button" className="lo-btn lo-btn--fantasma lo-btn--icone" disabled={apagando} aria-label={`Apagar sua mensagem das ${horaCurta(msg.criadaEm)}`} title="Apagar" onClick={() => setConfirmando(true)}>
              {apagando ? <span className="lo-giro" aria-hidden="true" /> : <Icone nome="tirar" />}
            </button>
          </div>
        )}
      </li>
    </>
  )
}

function LinhaPendente({ canal, pendente, eu, membros, agora }: { canal: CanalDoChat; pendente: MensagemPendente; eu: MembroProjetado | null; membros: readonly MembroProjetado[]; agora: number }) {
  const site = useSite()
  const recusada = pendente.situacao.t === 'recusada'
  return (
    <li className="lo-msg" data-pendente="1" data-recusada={recusada ? '1' : undefined} data-nova="1">
      <Rosto className="lo-msg__lado" contaId={eu?.contaId ?? null} nome={eu?.nome ?? 'V'} semente={eu?.contaId ?? ''} />
      <div className="lo-msg__corpo">
        <p className="lo-msg__cab">
          <span className="lo-msg__quem" data-eu="1">
            Você
          </span>{' '}
          <span className="lo-msg__estado" role="status">
            {pendente.situacao.t === 'enviando' && <span className="lo-giro" aria-hidden="true" />}
            {textoDaSituacao(pendente.situacao, agora)}
          </span>
        </p>
        <p className="lo-msg__texto">
          <Texto texto={pendente.texto} eu={eu} membros={membros} />
        </p>
        {recusada && (
          <div className="lo-msg__pendente-acoes">
            {pendente.situacao.t === 'recusada' && pendente.situacao.motivo !== 'texto' && (
              <button type="button" className="lo-btn" onClick={() => site.chat()?.tentarDeNovo(canal, pendente.idDoCliente)}>
                Tentar de novo
              </button>
            )}
            <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => site.chat()?.descartar(canal, pendente.idDoCliente)}>
              Descartar
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
