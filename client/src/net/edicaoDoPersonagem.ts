import { PERSONAGEM_SEM_NOME, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { fitsTokenPhotoSend } from '../lib/tokenPhoto'
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
 */
export function partesMudadas(base: Personagem, rascunho: Personagem): PartesDoPersonagem {
  const partes: PartesDoPersonagem = {}
  if (rascunho.nome !== base.nome) partes.nome = rascunho.nome
  if (rascunho.descricao !== base.descricao) partes.descricao = rascunho.descricao
  if (!mesmoTexto(rascunho.etiquetas, base.etiquetas)) partes.etiquetas = rascunho.etiquetas
  const escolhas = chavesMudadas(base.escolhas, rascunho.escolhas)
  if (escolhas !== undefined) partes.escolhas = escolhas
  for (const campo of NUMEROS_DA_FICHA) {
    const mudadas = chavesMudadas(base[campo], rascunho[campo])
    if (mudadas !== undefined) partes[campo] = mudadas
  }
  const abas = Object.entries(rascunho.abas).flatMap(([abaId, cartoes]): [string, CartaoSemImagem[]][] => {
    const semImagem = cartoes.map(cartaoSemImagem)
    return mesmoTexto((base.abas[abaId] ?? []).map(cartaoSemImagem), semImagem) ? [] : [[abaId, semImagem]]
  })
  if (abas.length > 0) partes.abas = Object.fromEntries(abas)
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
 */
export function mensagensDoSalvar(base: Personagem, rascunho: Personagem, opcoes: OpcoesDoSalvar): ResultadoDoSalvar {
  const { abas, ...escalares } = partesMudadas(base, rascunho)
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
 */
export function aplicarPartes(atual: Personagem, partes: PartesDoPersonagem): Personagem {
  const imagens = imagensDosCartoes(atual.abas)
  const comImagem = (cartao: CartaoSemImagem): CartaoDaFicha => ({ ...cartao, imagem: imagens.get(cartao.id) ?? null, subcartoes: cartao.subcartoes.map(comImagem) })
  const abasNovas = partes.abas === undefined ? {} : Object.fromEntries(Object.entries(partes.abas).map(([abaId, cartoes]) => [abaId, cartoes.map(comImagem)]))
  const aplicado: Personagem = {
    ...atual,
    ...(partes.nome === undefined ? {} : { nome: partes.nome.trim() || PERSONAGEM_SEM_NOME }),
    ...(partes.descricao === undefined ? {} : { descricao: partes.descricao }),
    ...(partes.etiquetas === undefined ? {} : { etiquetas: partes.etiquetas }),
    escolhas: { ...atual.escolhas, ...partes.escolhas },
    abas: { ...atual.abas, ...abasNovas },
  }
  for (const campo of NUMEROS_DA_FICHA) aplicado[campo] = { ...atual[campo], ...partes[campo] }
  return aplicado
}

/** HOST: a imagem aceita entra no retrato (`cartaoId` ausente) ou no cartão; `null` = o cartão não existe mais. */
export function aplicarImagem(atual: Personagem, cartaoId: string | undefined, imagem: string | null): Personagem | null {
  if (cartaoId === undefined) return { ...atual, retrato: imagem }
  if (!imagensDosCartoes(atual.abas).has(cartaoId)) return null
  const trocar = (cartao: CartaoDaFicha): CartaoDaFicha =>
    cartao.id === cartaoId ? { ...cartao, imagem } : { ...cartao, subcartoes: cartao.subcartoes.map(trocar) }
  return { ...atual, abas: Object.fromEntries(Object.entries(atual.abas).map(([abaId, cartoes]) => [abaId, cartoes.map(trocar)])) }
}
