import type { EventoDoMotor } from '../lib/sons/aoVivo/motor'
import { comEfeitoMudado, comEfeitoNovo, comPastaNova, comPastaRenomeada, novoIdDePastaDeSons, novoIdDeSom, semEfeito, semPasta, type BibliotecaDeSons, type ParteDosSons } from '../lib/sons/biblioteca'
import { abrirCanalDoNavegador, type Canal } from '../net/visaoDeTeste/canal'
import { useBibliotecaDeSonsStore } from '../stores/bibliotecaDeSonsStore'
import { limitarVolume, useSomStore } from '../stores/somStore'
import { avisarRecusaDoSom, type MotorDaPagina, type PonteDaPagina, type SonsNaJanela } from '../components/livro/PaginaSons'
import { lerMensagemDoApp, nomeDoCanal, type EstadoDosSons, type MensagemDaJanela, type MudancaNaBiblioteca, type PedidoDosSons, type RespostaDosSons } from './protocolo'

/**
 * O LADO DA JANELA do fio dos sons: o que a página Sons usa (motor, ponte,
 * importar, medir, bytes do trecho, a amostra do volume) vira pedido ao app, e
 * as lojas DESTA janela viram espelho do app.
 *
 * As lojas daqui (`useBibliotecaDeSonsStore`, `useSomStore`) são as mesmas da
 * página, mas nesta janela nunca leem nem gravam o disco: as ações da
 * biblioteca refazem a mudança aqui na hora (pelas mesmas funções puras, com
 * o id que vai junto), para o lápis responder sem esperar o app, e mandam a
 * mudança ao app, que aplica pelas ações de verdade e grava. O espelho do app
 * só substitui a biblioteca daqui depois de incluir a última mudança mandada
 * (`vez`): antes disso, voltaria um passo no meio de um arrasto.
 */

/** A principal manda `pong` a cada `ping`: sem nada dela por isto, ela fechou ou recarregou. */
const PING_MS = 2000
const SEM_O_APP_MS = 6000
/** Ler o disco (medir a pasta, os bytes de um áudio grande) pode demorar; importar, mais. */
const RESPOSTA_MS = 15_000
const IMPORTAR_MS = 60_000

export type SituacaoDoFio = 'esperando' | 'viva' | 'sumiu'

type SemEnvelope<T> = T extends unknown ? Omit<T, 'de' | 'sessao'> : never
type Esperando = { resolver: (resposta: RespostaDosSons) => void; prazo: ReturnType<typeof setTimeout> }

export interface FioDosSons {
  /** O que a página recebe no lugar do motor e da ponte do app. */
  sons: Omit<SonsNaJanela, 'onVoltar'>
  voltar(): void
  /** Liga o canal, o ping e o espelho; devolve o desligar. */
  ligar(): () => void
  assinarSituacao(ouvinte: (situacao: SituacaoDoFio) => void): () => void
  /** Já chegou o primeiro estado do app. */
  temEstado(): boolean
}

const SEM_RESPOSTA: RespostaDosSons = { tipo: 'erro', motivo: 'A janela principal não respondeu: confira se o app está aberto.' }
const SEM_FIO: RespostaDosSons = { tipo: 'erro', motivo: 'A janela ainda está ligando com o app.' }
const RESPOSTA_TORTA = 'O app respondeu o que esta janela não esperava.'

export function criarFioDosSons(sessao: string, abrirCanal: (nome: string) => Canal = abrirCanalDoNavegador): FioDosSons {
  let canal: Canal | null = null
  let proximoId = 1
  const esperando = new Map<number, Esperando>()
  /** As mudanças desta janela (biblioteca, volume, mudo) já mandadas, e o fio do app em que a conta vale. */
  let enviadas = 0
  let appVisto: string | null = null
  let chegouEstado = false
  let situacao: SituacaoDoFio = 'esperando'
  const ouvintesDaSituacao = new Set<(situacao: SituacaoDoFio) => void>()
  const ouvintesDoMotor = new Set<(evento: EventoDoMotor) => void>()
  /** O que soa no app agora: quem assina o motor depois (a página monta) recebe na hora. */
  const soando = new Map<string, EventoDoMotor>()

  const mudarSituacao = (nova: SituacaoDoFio) => {
    if (nova === situacao) return
    situacao = nova
    for (const ouvinte of [...ouvintesDaSituacao]) ouvinte(nova)
  }

  const mandar = (corpo: SemEnvelope<MensagemDaJanela>) => canal?.enviar({ de: 'janela', sessao, ...corpo })

  const pedir = (pedido: PedidoDosSons) => {
    mandar({ tipo: 'pedido', id: proximoId, pedido })
    proximoId += 1
  }

  /** O pedido que espera resposta; sem fio ou sem resposta no prazo, a frase da recusa. */
  const perguntar = (pedido: PedidoDosSons, prazoMs: number = RESPOSTA_MS): Promise<RespostaDosSons> => {
    if (canal === null) return Promise.resolve(SEM_FIO)
    const id = proximoId
    return new Promise<RespostaDosSons>((resolver) => {
      const prazo = setTimeout(() => {
        esperando.delete(id)
        resolver(SEM_RESPOSTA)
      }, prazoMs)
      esperando.set(id, { resolver, prazo })
      pedir(pedido)
    })
  }

  const mudancaDaJanela = () => {
    enviadas += 1
    return enviadas
  }

  // ---- as lojas desta janela viram espelho do app

  const aplicarEstado = (estado: EstadoDosSons) => {
    // O app ligou o fio de novo (F5 nele, o editor que voltou): a conta recomeça na vez dele.
    if (estado.app !== appVisto) {
      appVisto = estado.app
      enviadas = estado.vez
    }
    const emDia = estado.vez >= enviadas
    useBibliotecaDeSonsStore.setState({
      pasta: estado.pasta,
      carregando: estado.carregando,
      pendente: estado.pendente,
      aviso: estado.aviso,
      podeGravar: estado.podeGravar,
      ...(emDia ? { biblioteca: estado.biblioteca } : {}),
    })
    if (emDia) useSomStore.setState({ volume: estado.volume, mudo: estado.mudo })
    chegouEstado = true
    mudarSituacao('viva')
  }

  const corrigirLojas = () => {
    const loja = useBibliotecaDeSonsStore
    const impedida = () => {
      const { carregando, podeGravar } = loja.getState()
      return carregando || !podeGravar
    }
    /** A mudança vale aqui na hora e vai ao app; recusada aqui, nem vai. */
    const mudar = (proxima: BibliotecaDeSons | null, mudanca: MudancaNaBiblioteca): boolean => {
      if (impedida() || proxima === null) return false
      loja.setState({ biblioteca: proxima, pendente: true })
      pedir({ acao: 'biblioteca', vez: mudancaDaJanela(), mudanca })
      return true
    }
    const biblioteca = () => loja.getState().biblioteca
    loja.setState({
      // O disco é do app: aqui nada lê, migra nem grava.
      carregar: () => Promise.resolve(),
      migrarAventura: () => Promise.resolve(),
      gravarAgora: () => Promise.resolve(),
      importarArquivoDeSom: () => Promise.reject(new Error('Nesta janela, quem importa é a página Sons (pelo app).')),
      adicionarEfeito: (novo, id = novoIdDeSom()) => {
        if (impedida()) return null
        const resultado = comEfeitoNovo(biblioteca(), novo, id)
        if (resultado === null) return null
        mudar(resultado.biblioteca, { acao: 'adicionarEfeito', novo, id })
        return resultado.efeito
      },
      editarEfeito: (id, mudanca) => mudar(comEfeitoMudado(biblioteca(), id, mudanca), { acao: 'editarEfeito', id, mudanca }),
      apagarEfeito: (id) => mudar(semEfeito(biblioteca(), id), { acao: 'apagarEfeito', id }),
      criarPasta: (nome, parte: ParteDosSons = 'efeitos', id = novoIdDePastaDeSons()) => {
        if (impedida()) return null
        const resultado = comPastaNova(biblioteca(), nome, id, parte)
        if (resultado === null) return null
        mudar(resultado.biblioteca, { acao: 'criarPasta', nome, parte, id })
        return resultado.pasta
      },
      renomearPasta: (id, nome) => mudar(comPastaRenomeada(biblioteca(), id, nome), { acao: 'renomearPasta', id, nome }),
      apagarPasta: (id) => mudar(semPasta(biblioteca(), id), { acao: 'apagarPasta', id }),
    })
    // O volume deste computador é o do app (é ele quem toca): a barra daqui muda lá.
    useSomStore.setState({
      setVolume: (volume) => {
        if (!Number.isFinite(volume)) return
        useSomStore.setState({ volume: limitarVolume(volume) })
        pedir({ acao: 'volumeDoAparelho', vez: mudancaDaJanela(), volume })
      },
      alternarMudo: () => {
        const mudo = !useSomStore.getState().mudo
        useSomStore.setState({ mudo })
        pedir({ acao: 'mudo', vez: mudancaDaJanela(), mudo })
      },
    })
  }

  // ---- o motor e a ponte do app, vistos daqui

  const avisarDoMotor = (evento: EventoDoMotor) => {
    if (evento.tipo === 'tocando') soando.set(evento.instancia, evento)
    else if (evento.tipo === 'terminou' || evento.tipo === 'recusado') soando.delete(evento.instancia)
    for (const ouvinte of [...ouvintesDoMotor]) ouvinte(evento)
  }

  const motor: MotorDaPagina = {
    // Aceito daqui: a recusa do app chega pelos eventos, como a do motor de verdade.
    tocar: (instancia, fonte, opcoes) => {
      pedir({ acao: 'provar', instancia, fonte, loop: opcoes.loop, volume: opcoes.volumeDoEfeito })
      return { aceito: true }
    },
    parar: (instancia) => pedir({ acao: 'pararProva', instancia }),
    assinar: (ouvinte) => {
      ouvintesDoMotor.add(ouvinte)
      for (const evento of soando.values()) ouvinte(evento)
      return () => {
        ouvintesDoMotor.delete(ouvinte)
      }
    },
  }

  const ponte: PonteDaPagina = {
    tocar: (efeito) => {
      void perguntar({ acao: 'tocar', efeitoId: efeito.id }).then((resposta) => {
        // A mesa recusou por loops demais: o mesmo aviso que a página daria no app.
        if (resposta.tipo === 'tocou' && resposta.limiteNaMesa) avisarRecusaDoSom('limite-de-loops', efeito.nome)
      })
      // O que aconteceu lá chega pelos eventos do motor (e o limite da mesa, pela resposta acima).
      return { local: null, rede: null }
    },
    parar: (efeitoId) => pedir({ acao: 'parar', efeitoId }),
    pararTudo: () => pedir({ acao: 'pararTudo' }),
    mudarVolume: (efeitoId, volume) => pedir({ acao: 'mudarVolume', efeitoId, volume }),
  }

  const sons: FioDosSons['sons'] = {
    motor,
    ponte,
    tocarAmostra: () => pedir({ acao: 'amostra' }),
    importar: async (nome, bytes, parte) => {
      const resposta = await perguntar({ acao: 'importar', nome, bytes, parte }, IMPORTAR_MS)
      if (resposta.tipo === 'importado') return resposta.nome
      throw new Error(resposta.tipo === 'erro' ? resposta.motivo : RESPOSTA_TORTA)
    },
    medirMidia: async () => {
      const resposta = await perguntar({ acao: 'medir' })
      if (resposta.tipo === 'arquivos') return resposta.arquivos
      throw new Error(resposta.tipo === 'erro' ? resposta.motivo : RESPOSTA_TORTA)
    },
    carregarAudio: async (midia) => {
      const resposta = await perguntar({ acao: 'bytes', midia })
      if (resposta.tipo === 'bytes') return resposta.bytes
      throw new Error(resposta.tipo === 'erro' ? resposta.motivo : RESPOSTA_TORTA)
    },
  }

  return {
    sons,
    voltar: () => mandar({ tipo: 'voltar' }),
    temEstado: () => chegouEstado,
    assinarSituacao: (ouvinte) => {
      ouvintesDaSituacao.add(ouvinte)
      ouvinte(situacao)
      return () => {
        ouvintesDaSituacao.delete(ouvinte)
      }
    },
    ligar: () => {
      corrigirLojas()
      const meu = abrirCanal(nomeDoCanal(sessao))
      canal = meu
      let ultima = 0
      const parar = meu.ouvir((dado) => {
        const mensagem = lerMensagemDoApp(dado, sessao)
        if (mensagem === null) return
        if (mensagem.tipo === 'saiu') {
          ultima = 0
          mudarSituacao('sumiu')
          return
        }
        ultima = Date.now()
        switch (mensagem.tipo) {
          case 'estado':
            aplicarEstado(mensagem.estado)
            return
          case 'motor':
            // O início veio no relógio de parede: de volta ao relógio desta janela.
            avisarDoMotor(mensagem.evento.tipo === 'tocando' ? { ...mensagem.evento, inicioEmMs: mensagem.evento.inicioEmMs - performance.timeOrigin } : mensagem.evento)
            return
          case 'pong':
            if (situacao === 'sumiu') mudarSituacao(chegouEstado ? 'viva' : 'esperando')
            return
          case 'resposta': {
            const quem = esperando.get(mensagem.id)
            if (quem === undefined) return
            clearTimeout(quem.prazo)
            esperando.delete(mensagem.id)
            quem.resolver(mensagem.resposta)
            return
          }
          case 'fechar':
            window.close()
            return
        }
      })
      mandar({ tipo: 'ola' })
      const ping = setInterval(() => {
        mandar({ tipo: 'ping' })
        if (ultima !== 0 && Date.now() - ultima > SEM_O_APP_MS) mudarSituacao('sumiu')
      }, PING_MS)
      const adeus = () => mandar({ tipo: 'adeus' })
      window.addEventListener('pagehide', adeus)
      return () => {
        clearInterval(ping)
        window.removeEventListener('pagehide', adeus)
        parar()
        meu.fechar()
        if (canal === meu) canal = null
        for (const [id, quem] of esperando) {
          clearTimeout(quem.prazo)
          quem.resolver(SEM_FIO)
          esperando.delete(id)
        }
      }
    },
  }
}
