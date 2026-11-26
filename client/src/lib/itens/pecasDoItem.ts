import type { PecasDoEfeito } from '../../types/map'
import type { BlocosDoItem } from './modelo'

/**
 * AS PEÇAS DO ITEM, SÓ A LEITURA (sistema de itens refeito, E2 e E6c): o "Ao acertar" e o "Ao usar"
 * guardados lidos como a tela e a batalha os usam. Separado do editor (`editorDoItem.ts`) para a
 * leitura da ficha da batalha (`lib/batalha/aoAcertarDoItem.ts`) não puxar o editor inteiro e fechar
 * um ciclo de import com `sistemaOnePiece.ts` (a ordem de carga quebrava o app). Só tipos de fora.
 */

/** Teto do número digitado nos campos de dano e bônus (o mesmo do cartão de papel). */
export const NUMERO_DO_ITEM_MAX = 9999
/** Teto das casas do alcance do golpe da híbrida e do empurrão. */
export const CASAS_DO_ITEM_MAX = 12

/** "Até o fim da batalha" ou por N turnos (contados na vez de quem está com a condição). */
export type DuracaoNoEditor = 'fim' | 1 | 2 | 3

/**
 * A peça como a tela a mostra. `condicao` = o selo das técnicas (com o nome da condição do
 * catálogo); `dano` = a soma de dano da mecânica; `empurrar` = o empurrão (guardado desde já,
 * a mesa só move na E6c); `curar` = a cura; `tirar` = tirar condição pelo nome (`null` = todas).
 */
export type PecaDoItem =
  | { tipo: 'condicao'; nome: string; duracao: DuracaoNoEditor; n?: number }
  | { tipo: 'dano'; valor: number }
  | { tipo: 'empurrar'; casas: number }
  | { tipo: 'curar'; fixo: number }
  | { tipo: 'tirar'; nome: string | null }

export function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function inteiro(valor: unknown, min: number, max: number): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max ? valor : null
}

export function pecaDoEfeitoGuardado(efeito: unknown): PecaDoItem | null {
  if (!ehRegistro(efeito)) return null
  if (efeito.tipo === 'selo' && typeof efeito.nome === 'string') {
    const turnos = inteiro(efeito.duracao, 1, 3)
    const duracao: DuracaoNoEditor = turnos === 1 || turnos === 2 || turnos === 3 ? turnos : 'fim'
    const regra = ehRegistro(efeito.regra) ? inteiro(efeito.regra.curaRecebida, -100, 0) : null
    const porTurno = ehRegistro(efeito.porTurno) && ehRegistro(efeito.porTurno.quanto) ? inteiro(efeito.porTurno.quanto.fixo, 1, NUMERO_DO_ITEM_MAX) : null
    const n = regra !== null ? -regra : porTurno
    return { tipo: 'condicao', nome: efeito.nome, duracao, ...(n === null ? {} : { n }) }
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
