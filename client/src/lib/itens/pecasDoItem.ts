import type { PecasDoEfeito } from '../../types/map'
import { lerPecas, type PecaDa, type PecaDaMecanica } from '../batalha/mecanica/pecas'
import { ehDuracaoDaPeca, type BlocosDoItem, type DuracaoDaPeca, type GatilhoDaCondicao, type PecaDoGatilho } from './modelo'

/**
 * AS PEÇAS DO ITEM, SÓ A LEITURA (sistema de itens refeito, E2 e E6c): o "Ao acertar" e o "Ao usar"
 * guardados lidos como a tela e a batalha os usam. Separado do editor (`editorDoItem.ts`) para a
 * leitura da ficha da batalha (`lib/batalha/aoAcertarDoItem.ts`) não puxar o editor inteiro e fechar
 * um ciclo de import com `sistemaOnePiece.ts` (a ordem de carga quebrava o app). De fora, só tipos e
 * o leitor das peças das técnicas (`lerPecas`, mecanica/pecas.ts, que não importa nada daqui).
 */

/** Teto do número digitado nos campos de dano e bônus (o mesmo do cartão de papel). */
export const NUMERO_DO_ITEM_MAX = 9999
/** Teto das casas do alcance do golpe da híbrida e do empurrão. */
export const CASAS_DO_ITEM_MAX = 12

/** "Até o fim da batalha" ou por N turnos (contados na vez de quem está com a condição). */
export type DuracaoNoEditor = DuracaoDaPeca

/**
 * A peça como a tela a mostra. `condicao` = o selo das técnicas (com o nome da condição do
 * catálogo); `dano` = a soma de dano da mecânica; `empurrar` = o empurrão (guardado desde já,
 * a mesa só move na E6c); `curar` = a cura; `tirar` = tirar condição pelo nome (`null` = todas).
 */
export type PecaSimplesDoItem =
  | (Extract<PecaDoGatilho, { tipo: 'condicao' }> & { gatilho?: GatilhoDaCondicao })
  | Exclude<PecaDoGatilho, { tipo: 'condicao' }>
  | { tipo: 'empurrar'; casas: number }

/**
 * Pedido de 27/11/2026 ("os itens eles conseguem dar e diminuir status?"): o "Muda atributo" e o
 * "Diminui atributo do alvo" do item são as MESMAS peças das técnicas (`PecaStatus`, `PecaDiminui`),
 * guardadas na lista `pecas` da mecânica do bloco e lidas pelo mesmo leitor (`lerPecas`).
 */
export const FAMILIAS_DE_ATRIBUTO = ['status', 'diminui'] as const
export type FamiliaDeAtributo = (typeof FAMILIAS_DE_ATRIBUTO)[number]
export type PecaDeAtributo = PecaDa<FamiliaDeAtributo>

/** A peça das técnicas é uma das que o item usa? */
export function ehPecaDeAtributo(peca: PecaDaMecanica): peca is PecaDeAtributo {
  return peca.tipo === 'status' || peca.tipo === 'diminui'
}

/** A peça como a tela do item a mostra: as dele e as de atributo das técnicas. */
export type PecaDoItem = PecaSimplesDoItem | PecaDeAtributo

/** Teto do X do gatilho ("depois de X turnos"). */
export const TURNOS_DO_GATILHO_MAX = 99
/** Teto de peças do gatilho: o mesmo do bloco do item (`PECAS_POR_BLOCO_MAX`). */
export const PECAS_DO_GATILHO_MAX = 6
/** Teto do nome da condição numa peça (o mesmo do nome do selo das técnicas). */
const NOME_DA_PECA_MAX = 60

/** O nome como está (sem espaço nas pontas, até o teto); `null` = torto. */
function nomeDaPecaLido(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' && valor === valor.trim() && valor.length <= NOME_DA_PECA_MAX ? valor : null
}

function duracaoLida(valor: unknown): DuracaoDaPeca | null {
  return ehDuracaoDaPeca(valor) ? valor : null
}

/** Uma peça do gatilho lida do disco ou do fio. `null` = torta (fica de fora). */
export function pecaDoGatilhoLida(valor: unknown): PecaDoGatilho | null {
  if (!ehRegistro(valor)) return null
  if (valor.tipo === 'condicao') {
    const nome = nomeDaPecaLido(valor.nome)
    const duracao = duracaoLida(valor.duracao)
    if (nome === null || duracao === null) return null
    const n = inteiro(valor.n, 1, NUMERO_DO_ITEM_MAX)
    return { tipo: 'condicao', nome, duracao, ...(n === null ? {} : { n }) }
  }
  if (valor.tipo === 'dano') {
    const n = inteiro(valor.valor, 1, NUMERO_DO_ITEM_MAX)
    return n === null ? null : { tipo: 'dano', valor: n }
  }
  if (valor.tipo === 'curar') {
    const fixo = inteiro(valor.fixo, 1, NUMERO_DO_ITEM_MAX)
    return fixo === null ? null : { tipo: 'curar', fixo }
  }
  if (valor.tipo === 'tirar') {
    if (valor.nome === null) return { tipo: 'tirar', nome: null }
    const nome = nomeDaPecaLido(valor.nome)
    return nome === null ? null : { tipo: 'tirar', nome }
  }
  return null
}

/**
 * O GATILHO lido do disco ou do fio (o mesmo juiz do app, da ficha e do Worker). `undefined` =
 * ausente ou torto: a condição fica sem gatilho, como a de antes deste campo.
 */
export function gatilhoLido(valor: unknown): GatilhoDaCondicao | undefined {
  if (!ehRegistro(valor)) return undefined
  const turnos = inteiro(valor.turnos, 1, TURNOS_DO_GATILHO_MAX)
  if (turnos === null || !Array.isArray(valor.pecas)) return undefined
  // Nenhum campo inventado (o Worker recusa o que o leitor não devolve igual): escolha torta = sem gatilho.
  const vezes = valor.vezes === 'uma' || valor.vezes === 'cada' ? valor.vezes : null
  const aoDisparar = valor.aoDisparar === 'some' || valor.aoDisparar === 'continua' ? valor.aoDisparar : null
  if (vezes === null || aoDisparar === null) return undefined
  const pecas: PecaDoGatilho[] = []
  for (const crua of valor.pecas) {
    const peca = pecaDoGatilhoLida(crua)
    if (peca !== null) pecas.push(peca)
    if (pecas.length >= PECAS_DO_GATILHO_MAX) break
  }
  return pecas.length === 0 ? undefined : { turnos, vezes, aoDisparar, pecas }
}

export function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function inteiro(valor: unknown, min: number, max: number): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max ? valor : null
}

export function pecaDoEfeitoGuardado(efeito: unknown): PecaSimplesDoItem | null {
  if (!ehRegistro(efeito)) return null
  if (efeito.tipo === 'selo' && typeof efeito.nome === 'string') {
    // Até 10 turnos (`DURACAO_DA_PECA_MAX`); "ateTirar", torto ou acima do teto = até o fim da batalha.
    const duracao: DuracaoNoEditor = ehDuracaoDaPeca(efeito.duracao) ? efeito.duracao : 'fim'
    const regra = ehRegistro(efeito.regra) ? inteiro(efeito.regra.curaRecebida, -100, 0) : null
    const porTurno = ehRegistro(efeito.porTurno) && ehRegistro(efeito.porTurno.quanto) ? inteiro(efeito.porTurno.quanto.fixo, 1, NUMERO_DO_ITEM_MAX) : null
    const n = regra !== null ? -regra : porTurno
    const gatilho = gatilhoLido(efeito.gatilho)
    return { tipo: 'condicao', nome: efeito.nome, duracao, ...(n === null ? {} : { n }), ...(gatilho === undefined ? {} : { gatilho }) }
  }
  if (efeito.tipo === 'cura' && ehRegistro(efeito.quanto)) {
    const fixo = inteiro(efeito.quanto.fixo, 1, NUMERO_DO_ITEM_MAX)
    return fixo === null ? null : { tipo: 'curar', fixo }
  }
  if (efeito.tipo === 'tirarSelos') {
    if (efeito.quais === 'todos' || efeito.quais === 'negativos') return { tipo: 'tirar', nome: null }
    if (ehRegistro(efeito.quais) && Array.isArray(efeito.quais.nomes)) {
      const nome = efeito.quais.nomes.find((atual): atual is string => typeof atual === 'string')
      return { tipo: 'tirar', nome: nome ?? null }
    }
    return null
  }
  if (efeito.tipo === 'mover') {
    const casas = inteiro(efeito.casas, 1, CASAS_DO_ITEM_MAX)
    return casas === null ? null : { tipo: 'empurrar', casas }
  }
  return null
}

/**
 * As peças das técnicas guardadas no bloco (`pecas` da mecânica), pelo leitor delas. Sem a lista = nenhuma;
 * lista torta = `null` (a tela mostra o bloco só para ler, e a batalha não aplica nenhuma).
 */
export function pecasDasTecnicasNoBloco(guardadas: PecasDoEfeito | undefined): readonly PecaDaMecanica[] | null {
  if (guardadas?.pecas === undefined) return []
  const lidas = lerPecas(guardadas.pecas)
  return lidas.ok ? lidas.pecas : null
}

/** As peças de atributo do bloco (o Muda atributo e o Diminui atributo), na ordem da lista. Torta = nenhuma. */
export function pecasDeAtributoLidas(guardadas: PecasDoEfeito | undefined): PecaDeAtributo[] {
  return (pecasDasTecnicasNoBloco(guardadas) ?? []).filter(ehPecaDeAtributo)
}

/** As peças guardadas (o `aoAcertar` ou o `aoUsar`) como a tela as mostra. A peça que a tela não conhece fica de fora daqui e no disco. */
export function pecasDoItemLidas(guardadas: PecasDoEfeito | undefined): PecaDoItem[] {
  if (guardadas === undefined) return []
  const pecas: PecaDoItem[] = []
  const dano = guardadas.dano
  if (ehRegistro(dano) && ehRegistro(dano.base)) {
    const valor = inteiro(dano.base.fixo, 1, NUMERO_DO_ITEM_MAX)
    if (valor !== null) pecas.push({ tipo: 'dano', valor })
  }
  const efeitos = guardadas.efeitos
  if (Array.isArray(efeitos)) {
    for (const efeito of efeitos) {
      const peca = pecaDoEfeitoGuardado(efeito)
      if (peca !== null) pecas.push(peca)
    }
  }
  // Pedido de 27/11/2026: as peças de atributo vêm depois dos efeitos (a ordem em que se gravam).
  pecas.push(...pecasDeAtributoLidas(guardadas))
  return pecas
}

/**
 * Decisão 14 do protótipo: o Dano extra igual ao dano de cima (o do ataque ou o do golpe) contaria
 * duas vezes. O editor o pinta de vermelho; a batalha (E6c) o ignora.
 */
export function danoExtraDobra(item: Pick<BlocosDoItem, 'ataque' | 'golpe'>, peca: PecaDoItem): boolean {
  if (peca.tipo !== 'dano') return false
  return peca.valor === item.ataque?.dano || peca.valor === item.golpe?.dano
}
