import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { abrirCanalDoNavegador, type Canal } from '../../net/visaoDeTeste/canal'
import { lerMensagemDoHost, SESSAO_VALIDA, type MensagemDaJanela } from '../../net/visaoDeTeste/protocoloDoCanal'
import type { FichaParaTeste, ModoDoTeste } from '../../net/visaoDeTeste/tipos'
import { Session, welcomeName } from '../main'
import { createPlayerConnection, type PlayerConnection, type StorageLike } from '../playerConnection'
import { instalarSonsDoJogador } from '../sonsDoJogador'
import { BarraDoTeste } from './BarraDoTeste'
import { criarBloqueioDoOlhar, instalarGuardaDeTeclado } from './bloqueioDeEntrada'
import { RecadoDoOlhar } from './RecadoDoOlhar'
import { criarSocketDoCanal } from './socketDoCanal'

// JANELA DA VISÃO DE JOGADOR (`visao-jogador.html`): a tela do jogador de
// verdade (`Session`), ligada ao host de teste da janela principal pelo canal.
// Esta página não tem estado de jogo nem disco: tudo vem do host de teste
// (`net/visaoDeTeste/visaoDeTeste.ts`), e o que a tela guardaria no aparelho
// (ajustes, notas, nomes de lugares) fica em memória e some ao fechar.

/** "Jogar" ainda não existe nesta entrega: a barra mostra o lado desligado e o recado vem sem o botão. */
const JOGAR_DISPONIVEL = false

/** O `url` do cliente nunca é aberto (o socket é o canal): só identifica a origem nos avisos de erro. */
const URL_DO_TESTE = 'teste://visao'

/** A barra no alto e a tela do jogador no resto da janela. */
const RAIZ: CSSProperties = { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }
/**
 * A tela do jogador abaixo da barra. A tela dele é feita de peças `position:
 * fixed` (mapa, HUD, véu): o `contain` faz desta caixa o ponto de referência
 * delas, e o jogo inteiro cabe embaixo da barra sem nenhuma peça saber.
 */
const TELA: CSSProperties = { position: 'relative', flex: '1 1 auto', minHeight: 0, overflow: 'hidden', contain: 'layout paint' }

/** A sessão desta janela: a que o Rust pôs (`window.__LB_VISAO__`) ou, no navegador, a do endereço (`?sessao=`). */
export function sessaoDaJanela(janela: Window): string | null {
  const doRust: unknown = Reflect.get(janela, '__LB_VISAO__')
  const valor = typeof doRust === 'string' ? doRust : new URLSearchParams(janela.location.search).get('sessao')
  return valor !== null && SESSAO_VALIDA.test(valor) ? valor : null
}

/** O "aparelho" da janela de teste: em memória, para nada do teste ficar no `localStorage` do app. */
export function armazenamentoEmMemoria(): StorageLike {
  const itens = new Map<string, string>()
  return {
    getItem: (chave) => itens.get(chave) ?? null,
    setItem: (chave, valor) => {
      itens.set(chave, valor)
    },
    removeItem: (chave) => {
      itens.delete(chave)
    },
  }
}

/** Quem esta janela é agora; muda a cada geração (ficha trocada, janela recarregada). */
interface Geracao {
  geracao: number
  codigo: string
  nome: string
  ficha: FichaParaTeste
}

interface Lista {
  fichas: readonly FichaParaTeste[]
  fichaSelecionadaId: string | null
}

interface Ativa {
  geracao: number
  connection: PlayerConnection
  storage: StorageLike
}

const LISTA_VAZIA: Lista = { fichas: [], fichaSelecionadaId: null }

function Aviso({ children }: { children: ReactNode }) {
  return (
    <main className="pe-page">
      <div className="pe-card">
        <p role="status" aria-live="polite" className="pe-lead">
          {children}
        </p>
      </div>
    </main>
  )
}

function VisaoDeJogador({ sessao, canal }: { sessao: string; canal: Canal }) {
  const [geracao, setGeracao] = useState<Geracao | null>(null)
  const [lista, setLista] = useState<Lista>(LISTA_VAZIA)
  const [ativa, setAtiva] = useState<Ativa | null>(null)
  const [hostName, setHostName] = useState<string | null>(null)
  const [encerrado, setEncerrado] = useState(false)
  const [modo, setModo] = useState<ModoDoTeste>('olhar')
  const [recado, setRecado] = useState(false)
  /** O modo lido pelo socket e pelo bloqueio a cada evento, sem recriar nenhum dos dois. */
  const modoRef = useRef(modo)
  modoRef.current = modo
  /** Número da próxima conexão: único na vida da página, através das gerações. */
  const proximaConexao = useRef(1)

  const enviar = useCallback((mensagem: MensagemDaJanela) => canal.enviar(mensagem), [canal])

  // O fio com o host de teste: o `ola` pede (ou repede, depois de recarregar) quem esta janela é.
  useEffect(() => {
    const parar = canal.ouvir((dado) => {
      const mensagem = lerMensagemDoHost(dado, sessao)
      if (mensagem === null) return
      switch (mensagem.tipo) {
        case 'config': {
          const { geracao: numero, codigo, nome, ficha, fichas, fichaSelecionadaId } = mensagem
          setGeracao((atual) => (atual !== null && atual.geracao >= numero ? atual : { geracao: numero, codigo, nome, ficha }))
          setLista({ fichas, fichaSelecionadaId })
          return
        }
        case 'fichas':
          setLista({ fichas: mensagem.fichas, fichaSelecionadaId: mensagem.fichaSelecionadaId })
          return
        case 'ping':
          // No ouvinte e não num timer: a janela minimizada (timers estrangulados) ainda responde.
          enviar({ de: 'janela', tipo: 'pong', sessao })
          return
        case 'encerrar':
          setEncerrado(true)
          return
        default:
          // `aberto`, `msg` e `derrubar` são do socket da conexão (`socketDoCanal.ts`).
          return
      }
    })
    enviar({ de: 'janela', tipo: 'ola', sessao })
    return parar
  }, [canal, sessao, enviar])

  // Uma conexão por geração. A de antes fecha antes de a nova abrir: o host só aceita a da geração dele.
  useEffect(() => {
    if (geracao === null || encerrado) return
    const storage = armazenamentoEmMemoria()
    const connection = createPlayerConnection({
      url: URL_DO_TESTE,
      code: geracao.codigo,
      name: geracao.nome,
      createSocket: () => {
        const conexao = proximaConexao.current
        proximaConexao.current += 1
        return criarSocketDoCanal({
          canal,
          sessao,
          geracao: geracao.geracao,
          conexao,
          modo: () => modoRef.current,
          observar: (data) => {
            const registrado = welcomeName(data)
            if (registrado !== null) setHostName(registrado)
          },
        })
      },
      storage,
      isHidden: () => document.visibilityState === 'hidden',
      aceitaGzip: false,
    })
    setHostName(null)
    setAtiva({ geracao: geracao.geracao, connection, storage })
    // SONS DE CLIMA: os mesmos do jogador, presos à conexão desta geração.
    const desinstalarSons = instalarSonsDoJogador(connection)
    return () => {
      desinstalarSons()
      connection.close()
    }
  }, [geracao, encerrado, canal, sessao])

  // Teclas com nada em foco (atalhos da tela do jogador na `window`): barradas no Olhar.
  useEffect(() => instalarGuardaDeTeclado(window, () => modoRef.current === 'olhar'), [])

  // O título da janela (barra do Windows) diz de quem é a tela.
  useEffect(() => {
    document.title = geracao === null ? 'Visão de jogador' : `Visão de jogador · ${geracao.ficha.nome}`
  }, [geracao])

  const mostrarRecado = useCallback(() => setRecado(true), [])
  const bloqueio = useMemo(() => criarBloqueioDoOlhar(() => modoRef.current === 'olhar', mostrarRecado), [mostrarRecado])
  // "Voltar", "Sair" ou "Reconectar" das telas de fim: o teste recomeça do zero com a mesma ficha.
  const recomecar = useCallback(() => enviar({ de: 'janela', tipo: 'ola', sessao }), [enviar, sessao])

  if (encerrado) return <Aviso>O teste acabou. Pode fechar esta janela.</Aviso>

  return (
    <div style={RAIZ}>
      {geracao !== null && (
        <BarraDoTeste
          ficha={geracao.ficha}
          modo={modo}
          onModo={(proximo) => {
            if (proximo === 'olhar' || JOGAR_DISPONIVEL) setModo(proximo)
          }}
          jogarDisponivel={JOGAR_DISPONIVEL}
          fichas={lista.fichas}
          fichaSelecionadaId={lista.fichaSelecionadaId}
          onTrocarFicha={(tokenId) => enviar({ de: 'janela', tipo: 'trocar-ficha', sessao, tokenId })}
          onFechar={() => enviar({ de: 'janela', tipo: 'pedir-fechar', sessao })}
        />
      )}
      <div style={TELA} {...bloqueio}>
        {ativa !== null && geracao !== null && ativa.geracao === geracao.geracao ? (
          <Session
            key={ativa.geracao}
            connection={ativa.connection}
            code={geracao.codigo}
            typedName={geracao.nome}
            hostName={hostName}
            onLeave={recomecar}
            onQuit={recomecar}
            storage={ativa.storage}
            onAcaoNoOlhar={modo === 'olhar' ? mostrarRecado : undefined}
          />
        ) : (
          <Aviso>Abrindo a tela do jogador…</Aviso>
        )}
      </div>
      {recado && modo === 'olhar' && <RecadoDoOlhar onFechar={() => setRecado(false)} />}
    </div>
  )
}

const raiz = document.getElementById('root')
if (!raiz) throw new Error('visao-jogador.html sem #root')
const sessao = sessaoDaJanela(window)
createRoot(raiz).render(
  <StrictMode>
    {sessao === null ? (
      <Aviso>Esta janela abre pelo botão Visão de jogador, na aba Jogo do editor.</Aviso>
    ) : (
      <VisaoDeJogador sessao={sessao} canal={abrirCanalDoNavegador()} />
    )}
  </StrictMode>,
)
