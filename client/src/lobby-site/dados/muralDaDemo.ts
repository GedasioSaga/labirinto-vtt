import { idDaRef } from '../../lib/midia'
import {
  fichaDaFrase,
  mencoesDoMural,
  modificacaoDoMural,
  MURAL_PAGINA_DO_ESTADO,
  MURAL_REACOES,
  PEDIDOS_DO_MESTRE,
  rotulosDoSistema,
  textoDoMural,
  type MensagemDoMuralDoServidor,
  type ModificacaoDoMural,
  type NoticiaDoMural,
  type PedidoDoMural,
  type ReacaoDoMural,
} from '../../lib/nuvem/muralDoLobby'
import { projetarMembros, projetarOpParaJogador } from '../../lib/nuvem/projecao'
import { CONTA_DO_MESTRE, type FichaGuardada, type Membro, type OpGravada } from '../../lib/nuvem/tipos'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import type { VersaoNova } from './versaoDoSite'

/**
 * O MURAL DA DEMO (`?demo=1`, fatia M2): o servidor de mentira do mural, no
 * navegador, com as MESMAS regras do DO (`lobby/nuvem/src/mural.ts`): só o
 * mestre posta, edita, apaga e fixa (o jogador recebe `sem-permissao`); texto
 * pelo `textoDoMural`, menções pelo `mencoesDoMural`; reenvio pelo
 * `idDoCliente` sem gravar duas vezes; lápide ao apagar; o lido é por conta e
 * por versão (editar ou fixar de novo faz o aviso voltar); as modificações
 * saem das ops da campanha, SEMPRE pela projeção de quem lê. Fica de fora o
 * ritmo e a cota (o DO de verdade os aplica). As notícias são inventadas;
 * recarregar a página volta tudo ao começo.
 */

const MINUTO_MS = 60_000
const HORA_MS = 60 * MINUTO_MS

/** O cartão de versão nova na demo: inventado, para a tela ter o que mostrar. */
export const VERSAO_NOVA_DA_DEMO: VersaoNova = { aberta: '0.6.1', nova: '0.6.2' }

function svg(conteudo: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320">${conteudo}</svg>`)}`
}

const CARTA_NAUTICA = svg(
  '<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f3a50"/><stop offset="1" stop-color="#122230"/></linearGradient></defs>' +
    '<rect width="640" height="320" fill="url(#m)"/>' +
    '<g stroke="#2d4d66" stroke-width="1"><path d="M0 64H640M0 128H640M0 192H640M0 256H640M128 0V320M256 0V320M384 0V320M512 0V320"/></g>' +
    '<g fill="#c8b48c" fill-opacity="0.9"><path d="M84 222c18-38 70-48 96-18s-8 58-50 54-64-6-46-36z"/><path d="M300 92c26-20 70-14 80 12s-24 44-58 40-44-34-22-52z"/><path d="M470 196c22-16 60-10 66 12s-20 36-48 32-38-28-18-44z"/></g>' +
    '<path d="M150 214C240 120 320 250 410 140S520 120 500 206" fill="none" stroke="#e0a44a" stroke-width="3" stroke-dasharray="9 9" stroke-linecap="round"/>' +
    '<circle cx="500" cy="206" r="8" fill="#e0a44a"/><circle cx="150" cy="214" r="5" fill="#ecead4"/>',
)

const NAVIO_NO_POENTE = svg(
  '<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a4a"/><stop offset="0.6" stop-color="#c46a3c"/><stop offset="1" stop-color="#e0a44a"/></linearGradient></defs>' +
    '<rect width="640" height="320" fill="url(#c)"/><circle cx="430" cy="210" r="56" fill="#f2c779" fill-opacity="0.85"/>' +
    '<rect y="226" width="640" height="94" fill="#1c2a3a"/>' +
    '<g fill="#14161c"><path d="M196 226h190l-26 26H222z"/><path d="M286 96v130h6V96z"/><path d="M292 104l70 50-70 40z"/><path d="M280 116l-58 44 58 30z"/></g>',
)

/** Os midiaId inventados (a forma de `ehIdDeMidia`) e as imagens que a demo mostra no lugar da rota de mídia. */
const MIDIA_DA_CARTA = `${'7b3e'.repeat(16)}.png`
const MIDIA_DO_NAVIO = `${'c41d'.repeat(16)}.png`

export const IMAGENS_DA_DEMO: ReadonlyMap<string, string> = new Map([
  [MIDIA_DA_CARTA, CARTA_NAUTICA],
  [MIDIA_DO_NAVIO, NAVIO_NO_POENTE],
])

/** A imagem inventada de uma `midia:` da demo; `null` = não é dela. */
export function imagemDaDemo(ref: string): string | null {
  const id = idDaRef(ref)
  return id === null ? null : (IMAGENS_DA_DEMO.get(id) ?? null)
}

interface NoticiaGuardada {
  id: number
  autorContaId: string
  autorNome: string
  texto: string
  imagem: string | null
  mencoes: string[]
  fixada: boolean
  versao: number
  criadaEm: number
  editadaEm: number | null
  apagadaEm: number | null
  idDoCliente: string | null
}

/** Uma notícia que já estava lá quando a página abriu. */
interface NoticiaAntiga {
  texto: string
  imagem?: string
  fixada?: boolean
  apagada?: boolean
  horasAtras: number
  /** contaId → reação. */
  reacoes?: Readonly<Record<string, ReacaoDoMural>>
}

const TRECHOS_DO_RESUMO = [
  'a tripulação cruzou o Estreito das Gaivotas sem perder ninguém',
  'o Barto pagou a rodada no porto e ninguém soube de onde veio o dinheiro',
  'a Iara achou a primeira página do diário do velho capitão',
  'a tempestade levou metade das velas, mas o leme aguentou',
  'o Tanuki ganhou uma aposta contra um peixe-homem',
  'o Gael segurou a ponte sozinho por três rodadas',
]

/** Os resumos de sessão antigos da Rota (mais de uma página: o "carregar anteriores" tem o que trazer). */
function resumosDaRota(): NoticiaAntiga[] {
  return Array.from({ length: 22 }, (_, i) => ({
    texto: `Resumo da sessão ${i + 1}: ${TRECHOS_DO_RESUMO[i % TRECHOS_DO_RESUMO.length]}.`,
    horasAtras: 24 * 7 * (40 - i),
  }))
}

function noticiasInventadas(campanhaId: string): NoticiaAntiga[] {
  switch (campanhaId) {
    case 'rota-das-ilhas':
      return [
        ...resumosDaRota(),
        { texto: 'Notícia velha que o mestre apagou.', apagada: true, horasAtras: 24 * 9 },
        {
          texto: 'A recompensa do navio pirata saiu: 500 berries para a tripulação, já estão nas moedas da Sora. Gastem com juízo (ou não).',
          horasAtras: 30,
          reacoes: { conta_caio: '😂', conta_duda: '❤️', conta_leo: '❤️' },
        },
        {
          texto: 'Carta nova da rota liberada! A saída do porto é pelo norte, contornando as três ilhas. @Bia, a navegação da Sora vai ser testada logo na primeira cena.',
          imagem: `midia:${MIDIA_DA_CARTA}`,
          horasAtras: 20,
          reacoes: { conta_caio: '👍', conta_duda: '👍', conta_leo: '🔥' },
        },
        {
          texto: 'Sessão deste sábado começa às 20h em ponto. Quem chegar depois entra na cena seguinte.\nTragam as fichas em dia: subi a Vida máxima de todo mundo depois do arco das Ilhas Partidas.',
          fixada: true,
          horasAtras: 3,
          reacoes: { conta_caio: '👍' },
        },
      ]
    case 'mar-de-cobre':
      return [
        {
          texto: 'Bem-vindos ao Mar de Cobre. Primeira sessão em duas semanas; até lá, leiam a carta que mandei no chat.',
          imagem: `midia:${MIDIA_DO_NAVIO}`,
          horasAtras: 24 * 4,
          reacoes: { conta_gui: '🔥', conta_mel: '🔥' },
        },
      ]
    default:
      return []
  }
}

export interface LeitorDaDemo {
  agora(): number
  membros(): Membro[]
  todasAsOps(): readonly OpGravada[]
  ficha(fichaId: string): FichaGuardada | undefined
}

export interface MuralDaDemo {
  /** O `mural.estado` que o DO manda depois de cada `ola`, visto por `eu`. */
  estadoPara(eu: Membro): MensagemDoMuralDoServidor
  atender(pedido: PedidoDoMural, eu: Membro, entregar: (mensagem: MensagemDoMuralDoServidor) => void): void
}

export function criarMuralDaDemo(campanhaId: string, leitor: LeitorDaDemo): MuralDaDemo {
  const agoraDaAbertura = leitor.agora()
  const mestre = leitor.membros().find((membro) => membro.contaId === CONTA_DO_MESTRE)
  const noticias: NoticiaGuardada[] = []
  /** noticiaId → (contaId → reação). */
  const reacoes = new Map<number, Map<string, ReacaoDoMural>>()
  /** contaId → (noticiaId → versão lida). */
  const lidos = new Map<string, Map<number, number>>()
  const rotulos = rotulosDoSistema(SISTEMA_ONE_PIECE)

  for (const antiga of noticiasInventadas(campanhaId)) {
    if (mestre === undefined) break
    const quando = agoraDaAbertura - antiga.horasAtras * HORA_MS
    const id = noticias.length + 1
    noticias.push({
      id,
      autorContaId: mestre.contaId,
      autorNome: mestre.nome,
      texto: antiga.apagada === true ? '' : antiga.texto,
      imagem: antiga.apagada === true ? null : (antiga.imagem ?? null),
      mencoes: antiga.apagada === true ? [] : mencoesDoMural(antiga.texto, projetarMembros(leitor.membros())),
      fixada: antiga.fixada === true,
      versao: 1,
      criadaEm: quando,
      editadaEm: null,
      apagadaEm: antiga.apagada === true ? quando + HORA_MS : null,
      idDoCliente: null,
    })
    reacoes.set(id, new Map(Object.entries(antiga.reacoes ?? {})))
  }

  function vistaPor(noticia: NoticiaGuardada, contaId: string): NoticiaDoMural {
    const daNoticia = reacoes.get(noticia.id) ?? new Map<string, ReacaoDoMural>()
    const apagada = noticia.apagadaEm !== null
    const contagem = MURAL_REACOES.flatMap((reacao) => {
      const total = [...daNoticia.values()].filter((dela) => dela === reacao).length
      return total > 0 && !apagada ? [{ reacao, total }] : []
    })
    const { idDoCliente: _idDoCliente, ...publica } = noticia
    return {
      ...publica,
      mencoes: [...noticia.mencoes],
      reacoes: contagem,
      minhaReacao: apagada ? null : (daNoticia.get(contaId) ?? null),
      lida: (lidos.get(contaId)?.get(noticia.id) ?? 0) >= noticia.versao,
    }
  }

  function recusar(entregar: (mensagem: MensagemDoMuralDoServidor) => void, pedido: PedidoDoMural, motivo: 'texto' | 'imagem' | 'nao-existe' | 'sem-permissao' | 'apagada'): void {
    const recusa: MensagemDoMuralDoServidor = { t: 'mural.recusado', pedido: pedido.t, motivo }
    if (pedido.t === 'mural.postar') recusa.idDoCliente = pedido.idDoCliente
    entregar(recusa)
  }

  /** A imagem precisa ser uma que a campanha guarda (na demo, as inventadas). */
  function imagemGuardada(imagem: string | null): boolean {
    return imagem === null || imagemDaDemo(imagem) !== null
  }

  function modificacoes(eu: Membro, pedido: Extract<PedidoDoMural, { t: 'mural.modificacoes' }>): MensagemDoMuralDoServidor {
    const antesDe = pedido.antesDeRev ?? Number.MAX_SAFE_INTEGER
    const lidas = leitor
      .todasAsOps()
      .filter((op) => op.rev < antesDe && (pedido.fichaId === null || op.fichaId === pedido.fichaId) && (pedido.autorContaId === null || op.autorContaId === pedido.autorContaId))
      .filter((op) => eu.papel === 'mestre' || leitor.ficha(op.fichaId)?.visivel === 'mesa')
      .sort((a, b) => b.rev - a.rev)
      .slice(0, pedido.limite + 1)
    const pagina = lidas.slice(0, pedido.limite)
    const lista = pagina.flatMap((op): ModificacaoDoMural[] => {
      const ficha = leitor.ficha(op.fichaId)
      if (ficha === undefined) return []
      // A mesma projeção do DO: o jogador não vê ficha de NPC nem campo do mestre.
      const vista = eu.papel === 'mestre' ? op : ficha.doc.tipo === 'jogador' ? projetarOpParaJogador(op, ficha.visivel) : null
      return vista === null ? [] : [modificacaoDoMural(vista, fichaDaFrase(ficha.doc), rotulos)]
    })
    const ultima = pagina.at(-1)
    const proximaAntesDeRev = lidas.length > pedido.limite && ultima !== undefined ? ultima.rev : null
    return { t: 'mural.modificacoes', fichaId: pedido.fichaId, autorContaId: pedido.autorContaId, lista, proximaAntesDeRev }
  }

  function dePe(pedido: { id: number }): NoticiaGuardada | 'nao-existe' | 'apagada' {
    const noticia = noticias.find((candidata) => candidata.id === pedido.id)
    if (noticia === undefined) return 'nao-existe'
    return noticia.apagadaEm === null ? noticia : 'apagada'
  }

  return {
    estadoPara(eu) {
      const fixadas = noticias.filter((noticia) => noticia.fixada && noticia.apagadaEm === null).reverse()
      const pagina = [...noticias].reverse().slice(0, MURAL_PAGINA_DO_ESTADO + 1)
      return {
        t: 'mural.estado',
        fixadas: fixadas.map((noticia) => vistaPor(noticia, eu.contaId)),
        noticias: pagina.slice(0, MURAL_PAGINA_DO_ESTADO).map((noticia) => vistaPor(noticia, eu.contaId)),
        temMaisAntigas: pagina.length > MURAL_PAGINA_DO_ESTADO,
      }
    },
    atender(pedido, eu, entregar) {
      const agora = leitor.agora()
      if (PEDIDOS_DO_MESTRE.has(pedido.t) && eu.papel !== 'mestre') return recusar(entregar, pedido, 'sem-permissao')
      switch (pedido.t) {
        case 'mural.postar': {
          const repetida = noticias.find((noticia) => noticia.autorContaId === eu.contaId && noticia.idDoCliente === pedido.idDoCliente)
          if (repetida !== undefined) return entregar({ t: 'mural.ok', idDoCliente: pedido.idDoCliente, noticia: vistaPor(repetida, eu.contaId) })
          const texto = textoDoMural(pedido.texto)
          if (texto === null) return recusar(entregar, pedido, 'texto')
          if (!imagemGuardada(pedido.imagem)) return recusar(entregar, pedido, 'imagem')
          const nova: NoticiaGuardada = {
            id: noticias.length + 1,
            autorContaId: eu.contaId,
            autorNome: eu.nome,
            texto,
            imagem: pedido.imagem,
            mencoes: mencoesDoMural(texto, projetarMembros(leitor.membros())),
            fixada: false,
            versao: 1,
            criadaEm: agora,
            editadaEm: null,
            apagadaEm: null,
            idDoCliente: pedido.idDoCliente,
          }
          noticias.push(nova)
          return entregar({ t: 'mural.ok', idDoCliente: pedido.idDoCliente, noticia: vistaPor(nova, eu.contaId) })
        }
        case 'mural.editar': {
          const atual = dePe(pedido)
          if (typeof atual === 'string') return recusar(entregar, pedido, atual)
          const texto = textoDoMural(pedido.texto)
          if (texto === null) return recusar(entregar, pedido, 'texto')
          if (!imagemGuardada(pedido.imagem)) return recusar(entregar, pedido, 'imagem')
          Object.assign(atual, { texto, imagem: pedido.imagem, mencoes: mencoesDoMural(texto, projetarMembros(leitor.membros())), versao: atual.versao + 1, editadaEm: agora })
          return entregar({ t: 'mural.noticia', noticia: vistaPor(atual, eu.contaId) })
        }
        case 'mural.apagar': {
          const atual = noticias.find((noticia) => noticia.id === pedido.id)
          if (atual === undefined) return recusar(entregar, pedido, 'nao-existe')
          if (atual.apagadaEm === null) Object.assign(atual, { texto: '', imagem: null, mencoes: [], fixada: false, apagadaEm: agora })
          return entregar({ t: 'mural.noticia', noticia: vistaPor(atual, eu.contaId) })
        }
        case 'mural.fixar': {
          const atual = dePe(pedido)
          if (typeof atual === 'string') return recusar(entregar, pedido, atual)
          if (atual.fixada !== pedido.fixada) Object.assign(atual, { fixada: pedido.fixada, versao: atual.versao + (pedido.fixada ? 1 : 0) })
          return entregar({ t: 'mural.noticia', noticia: vistaPor(atual, eu.contaId) })
        }
        case 'mural.reagir': {
          const atual = dePe(pedido)
          if (typeof atual === 'string') return recusar(entregar, pedido, atual)
          const daNoticia = reacoes.get(atual.id) ?? new Map<string, ReacaoDoMural>()
          if (pedido.reacao === null) daNoticia.delete(eu.contaId)
          else daNoticia.set(eu.contaId, pedido.reacao)
          reacoes.set(atual.id, daNoticia)
          return entregar({ t: 'mural.noticia', noticia: vistaPor(atual, eu.contaId) })
        }
        case 'mural.lido': {
          const atual = dePe(pedido)
          if (typeof atual === 'string') return recusar(entregar, pedido, atual)
          // Como o DO: lido só vale para notícia fixada, e nunca além da versão atual.
          if (!atual.fixada) return
          const daConta = lidos.get(eu.contaId) ?? new Map<number, number>()
          daConta.set(atual.id, Math.max(daConta.get(atual.id) ?? 0, Math.min(pedido.versao, atual.versao)))
          lidos.set(eu.contaId, daConta)
          return entregar({ t: 'mural.noticia', noticia: vistaPor(atual, eu.contaId) })
        }
        case 'mural.antes': {
          const antesDe = pedido.antesDeId ?? Number.MAX_SAFE_INTEGER
          const lidas = [...noticias].reverse().filter((noticia) => noticia.id < antesDe).slice(0, pedido.limite + 1)
          return entregar({ t: 'mural.lista', noticias: lidas.slice(0, pedido.limite).map((noticia) => vistaPor(noticia, eu.contaId)), temMaisAntigas: lidas.length > pedido.limite })
        }
        case 'mural.modificacoes':
          return entregar(modificacoes(eu, pedido))
      }
    },
  }
}
