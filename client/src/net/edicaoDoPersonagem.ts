import { ABA_DAS_ARMAS } from '../lib/batalha/leituraDaFicha'
import { aplicarCamposDBT, camposDBTMudados, PERSONAGEM_SEM_NOME, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { comOcultasDe, comOcultasDoLocal } from '../lib/habilidadeOculta'
import { fitsTokenPhotoSend } from '../lib/tokenPhoto'
import { mesclarSemDesfazer } from './nuvem/emissor'
import {
  cartaoSemImagem,
  parsePartesDoPersonagem,
  type CartaoSemImagem,
  type PartesDoPersonagem,
  type PersonagemEditarMessage,
  type PersonagemImagemMessage,
} from './protocoloDoPersonagem'

/**
 * FICHA DE PERSONAGEM NA MESA — as duas pontas da edição do jogador:
 *  - no JOGADOR, o "Salvar" vira mensagens (`mensagensDoSalvar`): só as partes
 *    que ele mudou desde que abriu a edição, em pacotes que cabem no teto do
 *    servidor, e cada imagem mudada numa mensagem própria;
 *  - no HOST, cada mensagem aceita entra no personagem como está AGORA
 *    (`aplicarPartes`, `aplicarImagem`) — o que o mestre mudou nesse meio-tempo
 *    em outra parte fica.
 *
 * Puro: nada de store, nada de rede.
 */

/** Uma imagem que o jogador trocou: ausente `cartaoId` = o retrato. */
export interface ImagemMudada {
  cartaoId?: string
  imagem: string | null
}

const mesmoTexto = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * Os registros de números da ficha que a edição troca chave a chave. Os
 * cartões ligados e o histórico ficam de fora: mudam só pelo ajuste rápido.
 */
const NUMEROS_DA_FICHA = ['recursos', 'maximos', 'modificadoresDosRecursos', 'atributos', 'modificadoresDosAtributos'] as const

/** As chaves do rascunho cujo valor não é o da base; `undefined` = nenhuma. */
function chavesMudadas<T>(base: Record<string, T>, rascunho: Record<string, T>): Record<string, T> | undefined {
  const mudadas = Object.entries(rascunho).filter(([chave, valor]) => !mesmoTexto(base[chave], valor))
  return mudadas.length === 0 ? undefined : Object.fromEntries(mudadas)
}

/**
 * O que o rascunho mudou em relação à `base` — a ficha como estava quando a
 * edição ABRIU, e não a de agora: parte que o jogador não tocou não vai, e a
 * mudança que o mestre fez nela nesse meio-tempo continua valendo. Imagem não
 * entra (vai em `imagensMudadas`); aba só com imagem trocada também não.
 *
 * Conserto das fichas F1 (bug 6): a aba e a lista de etiquetas vão INTEIRAS,
 * e o host as mescla a partir da ficha que mandou por último (`recebida`), não
 * da de quando a edição abriu. Com `recebida`, elas saem por cima dela: o que
 * o mestre mudou desde que a edição abriu e o jogador não tocou (o custo de
 * outra técnica da mesma aba) vai junto, em vez de voltar atrás.
 */
export function partesMudadas(base: Personagem, rascunho: Personagem, recebida?: Personagem): PartesDoPersonagem {
  const partes: PartesDoPersonagem = {}
  const inteiras = recebida === undefined ? rascunho : mesclarSemDesfazer(base, rascunho, recebida, rascunho)
  const comProposta = recebida === undefined ? (cartao: CartaoSemImagem) => cartao : propostaNaoTocadaDaRecebida(base, recebida)
  if (rascunho.nome !== base.nome) partes.nome = rascunho.nome
  if (rascunho.descricao !== base.descricao) partes.descricao = rascunho.descricao
  if (!mesmoTexto(rascunho.etiquetas, base.etiquetas)) partes.etiquetas = inteiras.etiquetas
  const escolhas = chavesMudadas(base.escolhas, rascunho.escolhas)
  if (escolhas !== undefined) partes.escolhas = escolhas
  for (const campo of NUMEROS_DA_FICHA) {
    const mudadas = chavesMudadas(base[campo], rascunho[campo])
    if (mudadas !== undefined) partes[campo] = mudadas
  }
  const abas = Object.entries(rascunho.abas).flatMap(([abaId, cartoes]): [string, CartaoSemImagem[]][] => {
    if (mesmoTexto((base.abas[abaId] ?? []).map(cartaoSemImagem), cartoes.map(cartaoSemImagem))) return []
    return [[abaId, (inteiras.abas[abaId] ?? cartoes).map(cartaoSemImagem).map(comProposta)]]
  })
  if (abas.length > 0) partes.abas = Object.fromEntries(abas)
  // A ficha Dragon Ball vai só nos campos que mudaram; sumir do rascunho não apaga a do host (não há parte para isso).
  const dbt = rascunho.dbt === undefined ? undefined : camposDBTMudados(base.dbt, rascunho.dbt)
  if (dbt !== undefined) partes.dbt = dbt
  return partes
}

/** A imagem de cada cartão, pelo id, subcartões juntos. */
function imagensDosCartoes(abas: Record<string, CartaoDaFicha[]>): Map<string, string | null> {
  const imagens = new Map<string, string | null>()
  const visitar = (cartao: CartaoDaFicha): void => {
    imagens.set(cartao.id, cartao.imagem)
    cartao.subcartoes.forEach(visitar)
  }
  for (const cartoes of Object.values(abas)) cartoes.forEach(visitar)
  return imagens
}

/** A mecânica montada (ou a proposta do dono, ou a forma do alcance: fase B) de cada cartão que tem uma, pelo id, subcartões juntos. */
function mecanicasDosCartoes(abas: Record<string, CartaoDaFicha[]>, campo: 'mecanica' | 'mecanicaProposta' | 'alcance' = 'mecanica'): Map<string, NonNullable<CartaoDaFicha['mecanica']>> {
  const mecanicas = new Map<string, NonNullable<CartaoDaFicha['mecanica']>>()
  const visitar = (cartao: CartaoDaFicha): void => {
    const mecanica = cartao[campo]
    if (mecanica !== undefined) mecanicas.set(cartao.id, mecanica)
    cartao.subcartoes.forEach(visitar)
  }
  for (const cartoes of Object.values(abas)) cartoes.forEach(visitar)
  return mecanicas
}

type LigacaoDoCartao = Pick<CartaoDaFicha, 'itemId' | 'municaoPeloNome' | 'naMochila'>

/** A ligação com a mochila (`itemId`, `municaoPeloNome`) de cada cartão que tem uma, pelo id, subcartões juntos. */
function ligacoesDosCartoes(abas: Record<string, CartaoDaFicha[]>): Map<string, LigacaoDoCartao> {
  const ligacoes = new Map<string, LigacaoDoCartao>()
  const visitar = (cartao: CartaoDaFicha): void => {
    if (cartao.itemId !== undefined || cartao.municaoPeloNome === true || cartao.naMochila === true) {
      ligacoes.set(cartao.id, {
        ...(cartao.itemId === undefined ? {} : { itemId: cartao.itemId }),
        ...(cartao.municaoPeloNome === true ? { municaoPeloNome: true } : {}),
        // Sistema de itens refeito (E1): a marca da conversão é do mestre, como a ligação.
        ...(cartao.naMochila === true ? { naMochila: true } : {}),
      })
    }
    cartao.subcartoes.forEach(visitar)
  }
  for (const cartoes of Object.values(abas)) cartoes.forEach(visitar)
  return ligacoes
}

type RequisitosDoCartao = Pick<CartaoDaFicha, 'requisitos' | 'marcas' | 'acumulador'>

/**
 * Fase B2 dos requisitos: o bloco, as marcas e a definição do acumulador de cada cartão que tem
 * algum, pelo id, subcartões juntos. São regra do mestre (como a mecânica e o alcance): o fio do
 * jogador não os leva (`CartaoSemImagem`), e o host guarda os do cartão de mesmo id.
 */
function requisitosDosCartoes(abas: Record<string, CartaoDaFicha[]>): Map<string, RequisitosDoCartao> {
  const porId = new Map<string, RequisitosDoCartao>()
  const visitar = (cartao: CartaoDaFicha): void => {
    const { requisitos, marcas, acumulador } = cartao
    if (requisitos !== undefined || marcas !== undefined || acumulador !== undefined) {
      porId.set(cartao.id, { ...(requisitos === undefined ? {} : { requisitos }), ...(marcas === undefined ? {} : { marcas }), ...(acumulador === undefined ? {} : { acumulador }) })
    }
    cartao.subcartoes.forEach(visitar)
  }
  for (const cartoes of Object.values(abas)) cartoes.forEach(visitar)
  return porId
}

/**
 * Fatia C2 (revisão): a proposta de mecânica de um cartão que o jogador NÃO
 * tocou desde que a edição abriu sai como a da ficha recebida por último, ou
 * some se ela não tem. Sem isso, a proposta que o mestre recusou nesse
 * meio-tempo voltava com o Salvar de outro cartão da mesma aba. A proposta que
 * o jogador mudou vai como está. (A proposta ganhou caminho no Lobby depois,
 * `lib/nuvem/caminho.ts`; esta regra continua valendo para a sala LAN.)
 */
function propostaNaoTocadaDaRecebida(base: Personagem, recebida: Personagem): (cartao: CartaoSemImagem) => CartaoSemImagem {
  const daBase = mecanicasDosCartoes(base.abas, 'mecanicaProposta')
  const daRecebida = mecanicasDosCartoes(recebida.abas, 'mecanicaProposta')
  const ajustar = ({ mecanicaProposta: doRascunho, ...cartao }: CartaoSemImagem): CartaoSemImagem => {
    const proposta = mesmoTexto(doRascunho, daBase.get(cartao.id)) ? daRecebida.get(cartao.id) : doRascunho
    return { ...cartao, subcartoes: cartao.subcartoes.map(ajustar), ...(proposta === undefined ? {} : { mecanicaProposta: proposta }) }
  }
  return ajustar
}

/** As imagens que o rascunho trocou: o retrato e a de cada cartão (o novo só se já tem imagem). */
export function imagensMudadas(base: Personagem, rascunho: Personagem): ImagemMudada[] {
  const mudadas: ImagemMudada[] = rascunho.retrato === base.retrato ? [] : [{ imagem: rascunho.retrato }]
  const antes = imagensDosCartoes(base.abas)
  for (const [cartaoId, imagem] of imagensDosCartoes(rascunho.abas)) {
    if ((antes.get(cartaoId) ?? null) !== imagem) mudadas.push({ cartaoId, imagem })
  }
  return mudadas
}

export const ERRO_ABA_GRANDE = 'Uma aba da ficha ficou grande demais para a mesa. Divida o texto em mais cartões e salve de novo.'
export const ERRO_CAMPO_FORA_DO_TETO = 'Algum texto da ficha passou do tamanho que a mesa aceita (nome até 80 letras, cada texto até 8000). Encurte e salve de novo.'
export const ERRO_IMAGEM_GRANDE = 'Uma das imagens da ficha é pesada demais para a mesa. Escolha outra.'
export const ERRO_FICHA_DBT_GRANDE = 'A ficha Dragon Ball ficou grande demais para a mesa (técnicas, história e notas juntas). Encurte os textos mais longos e salve de novo.'

export type MensagemDoSalvar = PersonagemEditarMessage | PersonagemImagemMessage

export type ResultadoDoSalvar = { ok: true; mensagens: MensagemDoSalvar[] } | { ok: false; erro: string }

export interface OpcoesDoSalvar {
  novoReqId: () => string
  /** A mensagem cabe no teto do servidor? (`PLAYER_MESSAGE_MAX_BYTES`, medido em UTF-8.) */
  cabe: (mensagem: MensagemDoSalvar) => boolean
}

/** Id de pedido do tamanho máximo, para medir um pacote antes de ele ter o id dele. */
const REQ_ID_DE_SONDA = 'x'.repeat(64)

/**
 * O "Salvar" do jogador como mensagens, na ordem de envio: primeiro as
 * partes (nome, descrição, escolhas, números, junto com as abas que couberem;
 * aba que não cabe com as outras vai sozinha), depois uma mensagem por imagem
 * — o cartão novo já existe no host quando a imagem dele chega. Recusa antes
 * de enviar, com o motivo, o que o host recusaria: aba que sozinha passa do
 * teto, texto fora do limite, imagem pesada. Nada mudou = lista vazia.
 * `recebida` = a ficha que a mesa mandou por último (bug 6, `partesMudadas`).
 */
export function mensagensDoSalvar(base: Personagem, rascunho: Personagem, opcoes: OpcoesDoSalvar, recebida?: Personagem): ResultadoDoSalvar {
  const { abas, dbt, ...escalares } = partesMudadas(base, rascunho, recebida)
  const sonda = (partes: PartesDoPersonagem): PersonagemEditarMessage => ({ type: 'personagem.editar', reqId: REQ_ID_DE_SONDA, personagemId: base.id, partes })
  const pacotes: PartesDoPersonagem[] = []
  let atual: PartesDoPersonagem | null = Object.keys(escalares).length > 0 ? escalares : null
  for (const [abaId, cartoes] of Object.entries(abas ?? {})) {
    const junto: PartesDoPersonagem = { ...atual, abas: { ...atual?.abas, [abaId]: cartoes } }
    if (opcoes.cabe(sonda(junto))) {
      atual = junto
      continue
    }
    if (atual !== null) pacotes.push(atual)
    atual = { abas: { [abaId]: cartoes } }
    if (!opcoes.cabe(sonda(atual))) return { ok: false, erro: ERRO_ABA_GRANDE }
  }
  // Os campos da ficha Dragon Ball vão juntos (a raça com a variante): com o último pacote se couber, senão sozinhos.
  if (dbt !== undefined) {
    const junto: PartesDoPersonagem = { ...atual, dbt }
    if (opcoes.cabe(sonda(junto))) {
      atual = junto
    } else {
      if (atual !== null) {
        if (!opcoes.cabe(sonda(atual))) return { ok: false, erro: ERRO_ABA_GRANDE }
        pacotes.push(atual)
      }
      atual = { dbt }
      if (!opcoes.cabe(sonda(atual))) return { ok: false, erro: ERRO_FICHA_DBT_GRANDE }
    }
  }
  if (atual !== null) {
    if (!opcoes.cabe(sonda(atual))) return { ok: false, erro: ERRO_ABA_GRANDE }
    pacotes.push(atual)
  }
  // O host recusaria calado (para ele é mensagem torta): melhor o jogador saber qual é o problema.
  if (pacotes.some((partes) => parsePartesDoPersonagem(partes) === null)) return { ok: false, erro: ERRO_CAMPO_FORA_DO_TETO }
  const mensagens: MensagemDoSalvar[] = pacotes.map((partes) => ({ type: 'personagem.editar', reqId: opcoes.novoReqId(), personagemId: base.id, partes }))
  for (const { cartaoId, imagem } of imagensMudadas(base, rascunho)) {
    if (imagem !== null && !fitsTokenPhotoSend(imagem)) return { ok: false, erro: ERRO_IMAGEM_GRANDE }
    const mensagem: PersonagemImagemMessage = { type: 'personagem.imagem', reqId: opcoes.novoReqId(), personagemId: base.id, imagem }
    mensagens.push(cartaoId === undefined ? mensagem : { ...mensagem, cartaoId })
  }
  return { ok: true, mensagens }
}

/**
 * HOST: as partes aceitas entram no personagem de AGORA. Registro troca chave
 * a chave; o cartão volta com a imagem que o de mesmo id já tinha (novo, sem).
 * Nome em branco vira "Personagem sem nome", como na janela do mestre.
 * A mecânica montada (construtor de mecânicas, decisão 1 do mestre) também é
 * a que o cartão de mesmo id já tinha: a que o jogador manda é ignorada até o
 * mestre aprovar, e o Salvar dele em OUTRO cartão da aba nunca a apaga.
 *
 * Fatia C2: o que o dono montou vem como `mecanicaProposta` e fica no cartão
 * como proposta, para o mestre aceitar ou recusar. Igual à mecânica que já
 * vale = não espera nada. Com `base` (a ficha que o host mandou por último a
 * ele), a proposta que o jogador não tocou é a de AGORA: a que o mestre acabou
 * de recusar não volta com o Salvar dele em outro cartão da aba.
 *
 * A ligação com a mochila (`itemId` da arma e da bala, `municaoPeloNome`) é a
 * mesma regra da mecânica: a do cartão de mesmo id que já tinha. Quem a cria é
 * o mestre ou o tiro no host (`comABalaLigada`); o Salvar do jogador não a cria
 * (bala que aponta para item que ele não tem), não a troca e não a apaga — e a
 * bala zerada continua bloqueando o tiro.
 *
 * ARMAS-FONTE-UNICA §8: o cartão de arma ligado (`itemId` no host) é cópia da
 * regra do livro; os campos e as balas dele também ficam os do host (o que o
 * jogador mandou neles não fica). O nome e a arma padrão continuam do dono.
 */
export function aplicarPartes(atual: Personagem, partes: PartesDoPersonagem, base?: Personagem): Personagem {
  const imagens = imagensDosCartoes(atual.abas)
  const mecanicas = mecanicasDosCartoes(atual.abas)
  // Fase B do alcance: a forma do alcance é regra do mestre, como a mecânica: fica a do cartão de mesmo id no host.
  const alcances = mecanicasDosCartoes(atual.abas, 'alcance')
  const ligacoes = ligacoesDosCartoes(atual.abas)
  const requisitos = requisitosDosCartoes(atual.abas)
  const propostasDeAgora = mecanicasDosCartoes(atual.abas, 'mecanicaProposta')
  const propostasDaBase = base === undefined ? null : mecanicasDosCartoes(base.abas, 'mecanicaProposta')
  const armasDoLivro = new Map((atual.abas[ABA_DAS_ARMAS] ?? []).filter((arma) => arma.itemId !== undefined).map((arma) => [arma.id, arma]))
  const comARegraDoHost = (abaId: string, cartao: CartaoDaFicha): CartaoDaFicha => {
    const doHost = abaId === ABA_DAS_ARMAS ? armasDoLivro.get(cartao.id) : undefined
    return doHost === undefined ? cartao : { ...cartao, campos: doHost.campos, subcartoes: doHost.subcartoes }
  }
  const comImagem = ({ mecanica: _doJogador, mecanicaProposta: doJogador, itemId: _itemDoJogador, municaoPeloNome: _marcaDoJogador, naMochila: _conversaoDoJogador, ...cartao }: CartaoSemImagem): CartaoDaFicha => {
    const mecanica = mecanicas.get(cartao.id)
    const tocada = propostasDaBase === null || !mesmoTexto(doJogador, propostasDaBase.get(cartao.id))
    const proposta = tocada ? doJogador : propostasDeAgora.get(cartao.id)
    const espera = proposta !== undefined && !mesmoTexto(proposta, mecanica)
    const alcance = alcances.get(cartao.id)
    return {
      ...cartao,
      imagem: imagens.get(cartao.id) ?? null,
      subcartoes: cartao.subcartoes.map(comImagem),
      ...(mecanica === undefined ? {} : { mecanica }),
      ...(alcance === undefined ? {} : { alcance }),
      ...(espera ? { mecanicaProposta: proposta } : {}),
      // Cartão sem ligação no host (o novo também) fica solto, seja o que for que o jogador mandou.
      ...ligacoes.get(cartao.id),
      // Fase B2 dos requisitos: os do host; o cartão novo do jogador nasce sem.
      ...requisitos.get(cartao.id),
    }
  }
  // Fatia C7: a aba volta inteira do jogador, que nunca viu os cartões ocultos; eles voltam do personagem de AGORA.
  const abasNovas =
    partes.abas === undefined ? {} : Object.fromEntries(Object.entries(partes.abas).map(([abaId, cartoes]) => [abaId, comOcultasDe(atual.abas[abaId] ?? [], cartoes.map(comImagem).map((cartao) => comARegraDoHost(abaId, cartao)))]))
  const aplicado: Personagem = {
    ...atual,
    ...(partes.nome === undefined ? {} : { nome: partes.nome.trim() || PERSONAGEM_SEM_NOME }),
    ...(partes.descricao === undefined ? {} : { descricao: partes.descricao }),
    ...(partes.etiquetas === undefined ? {} : { etiquetas: partes.etiquetas }),
    escolhas: { ...atual.escolhas, ...partes.escolhas },
    abas: { ...atual.abas, ...abasNovas },
    // Só sobre a ficha Dragon Ball que já existe: personagem de outro motor não ganha uma pela rede.
    ...(partes.dbt === undefined || atual.dbt === undefined ? {} : { dbt: aplicarCamposDBT(atual.dbt, partes.dbt) }),
  }
  for (const campo of NUMEROS_DA_FICHA) aplicado[campo] = { ...atual[campo], ...partes[campo] }
  // NPC do Dragon Ball: o PV máximo sai do ND (ND × vida por golpe), e o ND não vai ao jogador
  // (`paraOFio`). A conta dele seria a de jogador: o máximo que ele manda não vale, o do host fica.
  if (atual.tipo === 'npc' && atual.dbt !== undefined && partes.maximos !== undefined && Object.hasOwn(partes.maximos, 'pv')) {
    const { pv: _doJogador, ...semPv } = aplicado.maximos
    aplicado.maximos = Object.hasOwn(atual.maximos, 'pv') ? { ...semPv, pv: atual.maximos.pv } : semPv
  }
  return aplicado
}

/**
 * HOST, com a BASE da conexão (LOBBY, §5.1): `base` é a ficha que o host
 * enviou por último a este jogador. A aba que o jogador mandou inteira não
 * desfaz o que o mestre mudou depois noutro cartão dela, nem a lista de
 * etiquetas a etiqueta que o mestre pôs: o que o mestre mudou desde a base,
 * fora do que o jogador tocou, volta por cima (`mesclarSemDesfazer`).
 */
export function aplicarPartesPelaBase(base: Personagem, atual: Personagem, partes: PartesDoPersonagem): Personagem {
  // Fatia C7: a base é a ficha que o jogador recebeu (sem os ocultos); o resultado fica com os ocultos de agora.
  return comOcultasDoLocal(atual, mesclarSemDesfazer(base, aplicarPartes(base, partes), atual, aplicarPartes(atual, partes, base)))
}

/** HOST: a imagem aceita entra no retrato (`cartaoId` ausente) ou no cartão; `null` = o cartão não existe mais. */
export function aplicarImagem(atual: Personagem, cartaoId: string | undefined, imagem: string | null): Personagem | null {
  if (cartaoId === undefined) return { ...atual, retrato: imagem }
  if (!imagensDosCartoes(atual.abas).has(cartaoId)) return null
  const trocar = (cartao: CartaoDaFicha): CartaoDaFicha =>
    cartao.id === cartaoId ? { ...cartao, imagem } : { ...cartao, subcartoes: cartao.subcartoes.map(trocar) }
  return { ...atual, abas: Object.fromEntries(Object.entries(atual.abas).map(([abaId, cartoes]) => [abaId, cartoes.map(trocar)])) }
}
