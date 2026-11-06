import { CHAT_SEND_BURST, CHAT_SEND_MIN_INTERVAL_MS, takeChatTurn } from '../../lib/chat'
import {
  CHAT_NAO_LIDAS_MAX,
  mencoesDaSala,
  parDoPrivado,
  textoDoChat,
  type CanalDoChat,
  type MensagemDoChat,
  type MensagemDoChatDoServidor,
  type MensagemNoCanal,
  type PedidoDoChat,
  type ResumoDoCanal,
} from '../../lib/nuvem/chatDoLobby'
import { CONTA_DO_MESTRE, type Membro } from '../../lib/nuvem/tipos'

/**
 * O CHAT DA DEMO (`?demo=1`, fatia C2): o servidor de mentira do chat, no
 * navegador, com as MESMAS regras do DO (`lobby/nuvem/src/chat.ts`): texto
 * pelo `textoDoChat`, menções pelo `mencoesDaSala`, ritmo pelo
 * `takeChatTurn` (a sexta mensagem em rajada é segurada), reenvio pelo
 * `idDoCliente` sem gravar duas vezes, lápide ao apagar, não lidas por conta.
 * As conversas são inventadas; uma pessoa da mesa responde uma vez em cada
 * conversa, alguns segundos depois da primeira mensagem, para a tela mostrar a
 * chegada ao vivo. Recarregar a página volta tudo ao começo.
 */

const MINUTO_MS = 60_000
/** A resposta inventada chega depois disto. */
const ESPERA_DA_RESPOSTA_MS = 2_600

/** Uma fala que já estava lá quando a página abriu. */
interface FalaAntiga {
  quem: string
  texto: string
  minutosAtras: number
}

/** O chat inventado de uma mesa: a sala, os privados de quem vê a demo (pelo contaId do outro) e até onde ele já leu. */
interface ChatInventado {
  sala: readonly FalaAntiga[]
  privados: Readonly<Record<string, readonly FalaAntiga[]>>
  /** Quantas das últimas de cada conversa (de outras pessoas) ainda não foram lidas: `'sala'` ou o contaId do outro. */
  naoLidas: Readonly<Record<string, number>>
  /** Quem responde, uma vez, na sala e em cada privado. */
  respostas: Readonly<Record<string, FalaAntiga>>
}

const CONVERSA_DA_ROTA: FalaAntiga[] = [
  { quem: CONTA_DO_MESTRE, texto: 'Boa noite, tripulação! Sessão de sábado confirmada, 20h.', minutosAtras: 60 * 26 },
  { quem: 'conta_caio', texto: 'Confirmado. Levo os dados da sorte.', minutosAtras: 60 * 26 - 4 },
  { quem: 'conta_duda', texto: 'Eu chego 20h15, o ônibus atrasa.', minutosAtras: 60 * 26 - 9 },
  { quem: 'conta_leo', texto: 'Alguém lembra quanto a Ilha do Sino cobrava pela ancoragem?', minutosAtras: 60 * 25 },
  { quem: 'conta_bia', texto: '30 berries por noite. Anotei no diário da Sora.', minutosAtras: 60 * 25 - 2 },
  { quem: 'conta_leo', texto: 'Valeu! Então a gente consegue pagar duas noites.', minutosAtras: 60 * 25 - 3 },
  { quem: 'conta_duda', texto: 'Tanuki ainda deve 12 pra Iara, só lembrando 👀', minutosAtras: 60 * 24 },
  { quem: 'conta_caio', texto: 'Paga em peixe, aceita?', minutosAtras: 60 * 24 - 1 },
  { quem: 'conta_duda', texto: 'Só se for peixe-espada.', minutosAtras: 60 * 24 - 2 },
  { quem: CONTA_DO_MESTRE, texto: 'Lembrete: quem subiu de nível atualiza a ficha aqui pelo Lobby antes de sábado.', minutosAtras: 60 * 5 },
  { quem: 'conta_bia', texto: 'Feito! HP da Sora já está certo.', minutosAtras: 60 * 4 },
  { quem: 'conta_leo', texto: 'Ainda não subi, falta 1 combate.', minutosAtras: 60 * 3 },
  { quem: 'conta_caio', texto: 'Mapa do farol que o @Léo desenhou ficou incrível, aliás.', minutosAtras: 52 },
  { quem: 'conta_leo', texto: 'Obrigado! Fiz em 10 minutos no guardanapo kkk', minutosAtras: 50 },
  { quem: CONTA_DO_MESTRE, texto: '@Bia a Sora acordou com uma marca nova no braço. Me chama no privado antes da sessão.', minutosAtras: 18 },
  { quem: 'conta_duda', texto: 'Uuuh, mistério.', minutosAtras: 16 },
  { quem: 'conta_caio', texto: 'Aposto que é o selo do farol.\nOu tinta de polvo. Uma das duas.', minutosAtras: 9 },
]

/** Mais 40 falas curtas antes de tudo: dá para ver o "carregar anteriores" (a página da tela é de 50). */
function falasDaSemanaPassada(): FalaAntiga[] {
  const quem = ['conta_caio', 'conta_duda', 'conta_leo', 'conta_bia', CONTA_DO_MESTRE]
  const textos = ['Cheguei.', 'Alguém viu meu dado de 20?', 'Rolando iniciativa.', 'Essa foi por pouco!', 'Próxima sessão eu levo o pão de queijo.', 'Anotado.', 'Quem tem corda?', 'O navio aguenta mais uma tempestade?', 'Eu acho que não.', 'Vamos votar.']
  return Array.from({ length: 40 }, (_, i) => ({ quem: quem[i % quem.length], texto: textos[i % textos.length], minutosAtras: 60 * 24 * 7 - i * 3 }))
}

const CHAT_DAS_MESAS: Readonly<Record<string, ChatInventado>> = {
  'rota-das-ilhas': {
    sala: [...falasDaSemanaPassada(), ...CONVERSA_DA_ROTA],
    privados: {
      [CONTA_DO_MESTRE]: [
        { quem: CONTA_DO_MESTRE, texto: 'Oi Bia! Antes de sábado: a Sora pode escolher entre seguir a gaivota ou o sino. Pensa com calma.', minutosAtras: 17 },
      ],
      conta_caio: [
        { quem: 'conta_caio', texto: 'Bia, bora combinar de dividir o tesouro do farol antes do mestre ver? 😅', minutosAtras: 40 },
        { quem: 'conta_bia', texto: 'Hahaha, só se o Tanuki não souber.', minutosAtras: 38 },
        { quem: 'conta_caio', texto: 'Fechado. Leva a luneta.', minutosAtras: 7 },
      ],
    },
    naoLidas: { sala: 3, [CONTA_DO_MESTRE]: 1, conta_caio: 1 },
    respostas: {
      sala: { quem: 'conta_duda', texto: 'Anotado! Até sábado, gente.', minutosAtras: 0 },
      [CONTA_DO_MESTRE]: { quem: CONTA_DO_MESTRE, texto: 'Combinado. Guardo isso só entre nós até a sessão.', minutosAtras: 0 },
      conta_caio: { quem: 'conta_caio', texto: 'Boa! Te vejo no convés.', minutosAtras: 0 },
      conta_duda: { quem: 'conta_duda', texto: 'Oi Bia! Pode falar.', minutosAtras: 0 },
      conta_leo: { quem: 'conta_leo', texto: 'Opa, tô aqui.', minutosAtras: 0 },
    },
  },
  'mar-de-cobre': {
    sala: [
      { quem: CONTA_DO_MESTRE, texto: 'Mar de Cobre volta mês que vem. Fichas paradas até lá.', minutosAtras: 60 * 24 * 2 },
      { quem: 'conta_gui', texto: 'Casco Duro vai estar com o machado afiado.', minutosAtras: 60 * 24 * 2 - 30 },
    ],
    privados: {},
    naoLidas: {},
    respostas: { sala: { quem: 'conta_mel', texto: 'Oi! Sumida, mas voltando.', minutosAtras: 0 } },
  },
}

export interface ChatDaDemo {
  /** Atende um pedido de `eu`; `entregar` manda a resposta a ele (com a latência da demo). */
  atender(pedido: PedidoDoChat, eu: Membro, entregar: (mensagem: MensagemDoChatDoServidor) => void): void
}

interface Gravada extends MensagemDoChat {
  /** `'sala'` ou o par `'a|b'`. */
  conversa: string
  idDoCliente: string | null
}

/**
 * `quemVe`: o contaId de quem abre a demo, dono dos privados inventados
 * (`conta_bia`, a dona do e-mail da demo em todas as mesas).
 */
export function criarChatDaDemo(
  campanhaId: string,
  quemVe: string,
  membros: () => readonly Membro[],
  agora: () => number,
  depois: (ms: number, fazer: () => void) => void,
): ChatDaDemo {
  const inventado = CHAT_DAS_MESAS[campanhaId]
  const gravadas: Gravada[] = []
  /** `contaId|conversa` -> lida até o id. */
  const lidas = new Map<string, number>()
  const ritmo = new Map<string, number>()
  const responderam = new Set<string>()
  let ultimoIdDaSala = 0
  let ultimoIdDosPrivados = 0
  let mudou = 0

  function membro(contaId: string): Membro | undefined {
    return membros().find((candidato) => candidato.contaId === contaId && candidato.estado === 'ativo')
  }

  function gravar(conversa: string, autor: Membro, texto: string, criadaEm: number, idDoCliente: string | null): Gravada {
    const ehSala = conversa === 'sala'
    const id = ehSala ? (ultimoIdDaSala += 1) : (ultimoIdDosPrivados += 1)
    mudou += 1
    const mencoes = ehSala ? mencoesDaSala(texto, membros().filter((candidato) => candidato.estado === 'ativo')) : []
    const gravada: Gravada = { id, autorContaId: autor.contaId, autorNome: autor.nome, texto, mencoes, criadaEm, apagadaEm: null, mudou, conversa, idDoCliente }
    gravadas.push(gravada)
    return gravada
  }

  function semear(conversa: string, falas: readonly FalaAntiga[], inicio: number): void {
    for (const fala of falas) {
      const autor = membro(fala.quem)
      if (autor === undefined) throw new Error(`demo do chat: ${fala.quem} não é membro de ${campanhaId}`)
      gravar(conversa, autor, fala.texto, inicio - fala.minutosAtras * MINUTO_MS, null)
    }
  }

  function chaveDaConversa(eu: string, canal: CanalDoChat): string | null {
    if (canal === 'sala') return 'sala'
    if (canal.dm === eu || membro(canal.dm) === undefined) return null
    return parDoPrivado(eu, canal.dm).par
  }

  /** O canal como `eu` vê a conversa. */
  function canalPara(conversa: string, eu: string): CanalDoChat {
    if (conversa === 'sala') return 'sala'
    const [a, b] = conversa.split('|')
    return { dm: a === eu ? b : a }
  }

  function daConversa(conversa: string): Gravada[] {
    return gravadas.filter((gravada) => gravada.conversa === conversa)
  }

  function publica({ conversa: _conversa, idDoCliente: _idDoCliente, ...msg }: Gravada): MensagemDoChat {
    return msg
  }

  function resumo(eu: string): Extract<MensagemDoChatDoServidor, { t: 'chat.resumo' }> {
    const conversas = new Set(['sala', ...gravadas.filter((gravada) => gravada.conversa.split('|').includes(eu)).map((gravada) => gravada.conversa)])
    const canais = [...conversas].map((conversa): ResumoDoCanal => {
      const lidaAte = lidas.get(`${eu}|${conversa}`) ?? 0
      const dela = daConversa(conversa)
      const naoLidas = dela.filter((gravada) => gravada.id > lidaAte && gravada.autorContaId !== eu && gravada.apagadaEm === null).length
      return { canal: canalPara(conversa, eu), ultimaId: dela.at(-1)?.id ?? 0, lidaAte, naoLidas: Math.min(naoLidas, CHAT_NAO_LIDAS_MAX) }
    })
    return { t: 'chat.resumo', cursor: mudou, canais }
  }

  /** Uma pessoa da conversa responde, uma vez por conversa, como se estivesse em outra aba. */
  function responderDepois(conversa: string, eu: string, entregar: (mensagem: MensagemDoChatDoServidor) => void): void {
    const outro = conversa === 'sala' ? 'sala' : canalPara(conversa, eu)
    const chave = outro === 'sala' ? 'sala' : outro.dm
    const resposta = inventado?.respostas[chave]
    if (resposta === undefined || responderam.has(conversa)) return
    responderam.add(conversa)
    depois(ESPERA_DA_RESPOSTA_MS, () => {
      const autor = membro(resposta.quem)
      if (autor === undefined) return
      const gravada = gravar(conversa, autor, resposta.texto, agora(), null)
      entregar({ t: 'chat.msg', canal: canalPara(conversa, eu), msg: publica(gravada) })
    })
  }

  function enviar(pedido: Extract<PedidoDoChat, { t: 'chat.enviar' }>, eu: Membro, entregar: (mensagem: MensagemDoChatDoServidor) => void): void {
    const { idDoCliente } = pedido
    const conversa = chaveDaConversa(eu.contaId, pedido.canal)
    if (conversa === null) return entregar({ t: 'chat.recusado', pedido: pedido.t, idDoCliente, motivo: 'canal' })
    const repetida = gravadas.find((gravada) => gravada.conversa === conversa && gravada.autorContaId === eu.contaId && gravada.idDoCliente === idDoCliente)
    if (repetida !== undefined) return entregar({ t: 'chat.ok', idDoCliente, canal: pedido.canal, msg: publica(repetida) })
    const texto = textoDoChat(pedido.texto)
    if (texto === null) return entregar({ t: 'chat.recusado', pedido: pedido.t, idDoCliente, motivo: 'texto' })
    const hora = agora()
    const passo = takeChatTurn(ritmo.get(eu.contaId), hora)
    if (passo === null) {
      // O GCRA deixa passar quando o relógio da conta está no máximo `BURST - 1` intervalos à frente.
      const tentarDepoisDe = (ritmo.get(eu.contaId) ?? hora) - (CHAT_SEND_BURST - 1) * CHAT_SEND_MIN_INTERVAL_MS
      return entregar({ t: 'chat.recusado', pedido: pedido.t, idDoCliente, motivo: 'ritmo', tentarDepoisDe: Math.max(hora, tentarDepoisDe) })
    }
    ritmo.set(eu.contaId, passo)
    const gravada = gravar(conversa, eu, texto, hora, idDoCliente)
    entregar({ t: 'chat.ok', idDoCliente, canal: pedido.canal, msg: publica(gravada) })
    responderDepois(conversa, eu.contaId, entregar)
  }

  function apagar(pedido: Extract<PedidoDoChat, { t: 'chat.apagar' }>, eu: Membro, entregar: (mensagem: MensagemDoChatDoServidor) => void): void {
    const conversa = chaveDaConversa(eu.contaId, pedido.canal)
    const gravada = conversa === null ? undefined : gravadas.find((candidata) => candidata.conversa === conversa && candidata.id === pedido.id)
    if (gravada === undefined) return entregar({ t: 'chat.recusado', pedido: pedido.t, motivo: 'nao-existe' })
    if (gravada.autorContaId !== eu.contaId) return entregar({ t: 'chat.recusado', pedido: pedido.t, motivo: 'sem-permissao' })
    if (gravada.apagadaEm === null) {
      mudou += 1
      gravada.apagadaEm = agora()
      gravada.texto = ''
      gravada.mencoes = []
      gravada.mudou = mudou
    }
    entregar({ t: 'chat.apagada', canal: pedido.canal, id: gravada.id, apagadaEm: gravada.apagadaEm, mudou: gravada.mudou })
  }

  function antes(pedido: Extract<PedidoDoChat, { t: 'chat.antes' }>, eu: Membro, entregar: (mensagem: MensagemDoChatDoServidor) => void): void {
    const conversa = chaveDaConversa(eu.contaId, pedido.canal)
    if (conversa === null) return entregar({ t: 'chat.recusado', pedido: pedido.t, motivo: 'canal' })
    const antesDe = pedido.antesDeId ?? Number.MAX_SAFE_INTEGER
    const anteriores = daConversa(conversa).filter((gravada) => gravada.id < antesDe)
    const pagina = anteriores.slice(-pedido.limite)
    entregar({ t: 'chat.lista', canal: pedido.canal, lista: pagina.map(publica), temMaisAntigas: anteriores.length > pedido.limite })
  }

  function desde(pedido: Extract<PedidoDoChat, { t: 'chat.desde' }>, eu: Membro, entregar: (mensagem: MensagemDoChatDoServidor) => void): void {
    entregar(resumo(eu.contaId))
    if (pedido.cursor === null || pedido.cursor > mudou) {
      entregar({ t: 'chat.mudancas', desde: pedido.cursor ?? 0, ate: mudou, lista: [], recomecar: true })
      return
    }
    const cursor = pedido.cursor
    const lista = gravadas
      .filter((gravada) => gravada.mudou > cursor && (gravada.conversa === 'sala' || gravada.conversa.split('|').includes(eu.contaId)))
      .sort((x, y) => x.mudou - y.mudou)
      .map((gravada): MensagemNoCanal => ({ canal: canalPara(gravada.conversa, eu.contaId), msg: publica(gravada) }))
    entregar({ t: 'chat.mudancas', desde: cursor, ate: mudou, lista })
  }

  function lida(pedido: Extract<PedidoDoChat, { t: 'chat.lida' }>, eu: Membro, entregar: (mensagem: MensagemDoChatDoServidor) => void): void {
    const conversa = chaveDaConversa(eu.contaId, pedido.canal)
    if (conversa === null) return
    const chave = `${eu.contaId}|${conversa}`
    const ultima = daConversa(conversa).at(-1)?.id ?? 0
    const ateId = Math.min(pedido.ateId, ultima)
    if (ateId <= (lidas.get(chave) ?? 0)) return
    lidas.set(chave, ateId)
    entregar(resumo(eu.contaId))
  }

  // As conversas que já existiam, e o quanto quem vê a demo já tinha lido delas.
  if (inventado !== undefined) {
    const inicio = agora()
    semear('sala', inventado.sala, inicio)
    for (const [outro, falas] of Object.entries(inventado.privados)) semear(parDoPrivado(quemVe, outro).par, falas, inicio)
    for (const [qual, quantas] of Object.entries(inventado.naoLidas)) {
      const conversa = qual === 'sala' ? 'sala' : parDoPrivado(quemVe, qual).par
      const dosOutros = daConversa(conversa).filter((gravada) => gravada.autorContaId !== quemVe)
      const primeiraNaoLida = dosOutros.at(-quantas)
      lidas.set(`${quemVe}|${conversa}`, primeiraNaoLida === undefined ? 0 : primeiraNaoLida.id - 1)
    }
  }

  return {
    atender(pedido, eu, entregar) {
      switch (pedido.t) {
        case 'chat.enviar':
          return enviar(pedido, eu, entregar)
        case 'chat.apagar':
          return apagar(pedido, eu, entregar)
        case 'chat.antes':
          return antes(pedido, eu, entregar)
        case 'chat.desde':
          return desde(pedido, eu, entregar)
        case 'chat.lida':
          return lida(pedido, eu, entregar)
      }
    },
  }
}
