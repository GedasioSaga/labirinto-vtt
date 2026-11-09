import type { CartaoDaFicha, MecanicaGuardada } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { lerMecanica, VERSAO_DA_MECANICA, type AlvoDaMecanica, type FormaDoAlvo, type MecanicaV1, type QuemOAlvoPega } from './modelo'

/**
 * OS MODELOS PRONTOS e as regras de edição da tela de montar (construtor de
 * mecânicas, fatia C2). Um NPC sai em 3 cliques: "Montar mecânica", um modelo,
 * o número. Os modelos só usam as peças que o motor já executa (C1); a
 * leitura (`lerMecanica`) aceita cada um sem ajuste.
 *
 * Puro: sem store, sem rede.
 */

export type IdDoModelo = 'golpe' | 'area' | 'cura' | 'debuff' | 'buff'

export interface ModeloPronto {
  id: IdDoModelo
  nome: string
  /** O que ele monta, numa frase (a dica do botão). */
  dica: string
}

export const MODELOS_PRONTOS: readonly ModeloPronto[] = [
  { id: 'golpe', nome: 'Golpe simples', dica: '1 inimigo, que reage normal; dano por fórmula' },
  { id: 'area', nome: 'Golpe em área', dica: 'Todos os inimigos num quadrado 3x3 à frente' },
  { id: 'cura', nome: 'Cura', dica: 'Cura HP de 1 aliado, sem teste' },
  { id: 'debuff', nome: 'Debuff com teste', dica: '1 inimigo reage; se pegar, fica Atordoado' },
  { id: 'buff', nome: 'Buff em aliado', dica: 'Um selo bom em 1 aliado; o bônus você confere à mão' },
]

/** "Força + 20" com o 1º atributo do sistema; sem atributos, um número. */
function formulaDeExemplo(sistema: SistemaDeRpg): string {
  const atributo = sistema.atributos[0]?.nome.trim()
  return atributo === undefined || atributo === '' ? '50' : `${atributo} + 20`
}

const MULTIPLICADORES_DE_SEMPRE = { concentracao: true, surpresa: true } as const

/** A mecânica do modelo, pronta para o motor (os números são ponto de partida). */
export function mecanicaDoModelo(id: IdDoModelo, sistema: SistemaDeRpg): MecanicaV1 {
  const base = { versao: VERSAO_DA_MECANICA, limite: {}, teste: { tipo: 'reacao' }, efeitos: [] } as const
  const custo30 = [{ recurso: 'sp', quanto: { fixo: 30 }, quando: 'aoUsar' }] as const
  switch (id) {
    case 'golpe':
      return { ...base, acao: 'simples', custos: [...custo30], alvo: { quem: 'inimigos', forma: { tipo: 'um' } }, dano: { base: { formula: formulaDeExemplo(sistema) }, multiplicadores: { ...MULTIPLICADORES_DE_SEMPRE } }, efeitos: [] }
    case 'area':
      return {
        ...base,
        acao: 'completa',
        custos: [{ recurso: 'sp', quanto: { fixo: 50 }, quando: 'aoUsar' }],
        limite: { recarga: 2 },
        alvo: { quem: 'inimigos', forma: { tipo: 'quadrado', lado: 3, centro: 'frente' } },
        dano: { base: { formula: formulaDeExemplo(sistema) }, multiplicadores: { ...MULTIPLICADORES_DE_SEMPRE } },
        efeitos: [],
      }
    case 'cura':
      return { ...base, acao: 'simples', custos: [...custo30], alvo: { quem: 'aliados', forma: { tipo: 'um' } }, efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { fixo: 100 }, emQuem: 'alvo' }] }
    case 'debuff':
      return { ...base, acao: 'simples', custos: [...custo30], limite: { recarga: 2 }, alvo: { quem: 'inimigos', forma: { tipo: 'um' } }, efeitos: [{ tipo: 'selo', nome: 'Atordoado', duracao: 1, natureza: 'debuff' }] }
    case 'buff':
      return {
        ...base,
        acao: 'bonus',
        custos: [{ recurso: 'sp', quanto: { fixo: 20 }, quando: 'aoUsar' }],
        alvo: { quem: 'aliados', forma: { tipo: 'um' } },
        efeitos: [
          { tipo: 'selo', nome: 'Fortalecido', duracao: 2, natureza: 'buff' },
          { tipo: 'aMao', texto: 'Quanto o Fortalecido soma: aplique à mão' },
        ],
      }
  }
}

/** A mecânica como o cartão a guarda (cópia funda, só JSON). */
export function guardarMecanica(mecanica: MecanicaV1): MecanicaGuardada {
  const copia: unknown = JSON.parse(JSON.stringify(mecanica))
  return typeof copia === 'object' && copia !== null && !Array.isArray(copia) ? { ...copia } : {}
}

const vazio = (texto: string): boolean => texto.trim() === ''

/** O que falta preencher, em frase de quem monta (antes do motivo técnico da leitura). */
function faltaPreencher(mecanica: MecanicaV1): string | null {
  const custo = mecanica.custos.find((item) => 'formula' in item.quanto && vazio(item.quanto.formula))
  if (custo !== undefined) return 'falta a fórmula do custo'
  const { dano } = mecanica
  if (dano !== undefined && 'formula' in dano.base && vazio(dano.base.formula)) return 'falta a fórmula do dano'
  if (dano?.multiplicadores.extra?.some((extra) => vazio(extra.nome)) === true) return 'falta o nome de um multiplicador'
  for (const efeito of mecanica.efeitos) {
    if (efeito.tipo === 'selo' && vazio(efeito.nome)) return 'falta o nome do selo'
    if (efeito.tipo === 'aMao' && vazio(efeito.texto)) return 'um lembrete à mão está vazio'
    if (efeito.tipo === 'cura') {
      const numeros = 'porCarga' in efeito.quanto ? efeito.quanto.porCarga : [efeito.quanto]
      if (numeros.some((numero) => 'formula' in numero && vazio(numero.formula))) return 'falta quanto a cura cura'
    }
  }
  return null
}

/** O motivo de a mecânica do editor não valer ainda; `null` = o motor aceita. */
export function problemaDaMecanica(mecanica: MecanicaV1): string | null {
  const falta = faltaPreencher(mecanica)
  if (falta !== null) return falta
  const lida = lerMecanica(guardarMecanica(mecanica))
  return lida.tipo === 'invalida' ? lida.motivo : null
}

/** Mesma mecânica (ordem das chaves conta pouco: as duas saem do mesmo editor ou do mesmo fio). */
export function mesmaMecanica(a: MecanicaGuardada | undefined, b: MecanicaGuardada | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export interface TecnicaParaCopiar {
  id: string
  nome: string
  mecanica: MecanicaV1
}

/** As técnicas montadas (peças válidas) da lista, menos a que está sendo editada. */
export function tecnicasParaCopiar(cartoes: readonly CartaoDaFicha[], excetoId: string): TecnicaParaCopiar[] {
  return cartoes.flatMap((cartao) => {
    if (cartao.id === excetoId || cartao.mecanica === undefined) return []
    const lida = lerMecanica(cartao.mecanica)
    return lida.tipo === 'pecas' ? [{ id: cartao.id, nome: cartao.nome, mecanica: lida.mecanica }] : []
  })
}

// ─── As regras que a tela segue ao trocar uma peça ──────────────────────────

/** A forma é área (linha, quadrado, raio)? */
export function formaDeArea(forma: FormaDoAlvo): boolean {
  return forma.tipo === 'linha' || forma.tipo === 'quadrado' || forma.tipo === 'raio'
}

/** Ajuda: o golpe pega em quem usa ou num aliado (cura e tirar selos só valem aí). */
export function ehAjuda(quem: QuemOAlvoPega): boolean {
  return quem === 'aliados' || quem === 'si'
}

/** A mecânica tem cura ou tira selos (prende o alvo em aliado ou em si). */
export function temLimpeza(mecanica: MecanicaV1): boolean {
  return mecanica.efeitos.some((efeito) => efeito.tipo === 'cura' || efeito.tipo === 'tirarSelos')
}

/**
 * Por que este "quem" não pode ser escolhido agora; `null` = pode. A forma
 * se ajusta sozinha (`trocarQuem`), a cura não: ela é do mestre.
 */
export function motivoDoQuem(mecanica: MecanicaV1, quem: QuemOAlvoPega): string | null {
  if (!ehAjuda(quem) && temLimpeza(mecanica)) return 'Tem cura ou tira selos: isso só pega em aliado ou em quem usa.'
  return null
}

/** Por que esta forma não pode ser escolhida agora; `null` = pode. */
export function motivoDaForma(alvo: AlvoDaMecanica, tipo: FormaDoAlvo['tipo']): string | null {
  if (alvo.quem === 'si') return null
  if (alvo.quem === 'aliados' && (tipo === 'linha' || tipo === 'quadrado' || tipo === 'raio')) return 'Área só de aliados chega numa próxima versão.'
  return null
}

/** Troca quem o golpe pega: "em si" é um alvo só; aliado não pega área (ainda). Natureza do selo acompanha. */
export function trocarQuem(mecanica: MecanicaV1, quem: QuemOAlvoPega): MecanicaV1 {
  const forma: FormaDoAlvo = quem === 'si' || (quem === 'aliados' && formaDeArea(mecanica.alvo.forma)) ? { tipo: 'um' } : mecanica.alvo.forma
  const natureza: 'buff' | 'debuff' = ehAjuda(quem) ? 'buff' : 'debuff'
  const efeitos = mecanica.efeitos.map((efeito) => (efeito.tipo === 'selo' ? { ...efeito, natureza } : efeito))
  return { ...mecanica, alvo: { quem, forma }, efeitos }
}

/** A forma nova com números de partida razoáveis (3x3 à frente, linha de 5, raio de 1, até 3). */
export function formaNova(tipo: FormaDoAlvo['tipo'], atual: FormaDoAlvo): FormaDoAlvo {
  if (tipo === atual.tipo) return atual
  switch (tipo) {
    case 'um':
      return { tipo }
    case 'varios':
      return { tipo, max: 3 }
    case 'linha':
      return { tipo, casas: 5 }
    case 'quadrado':
      return { tipo, lado: 3, centro: 'frente' }
    case 'raio':
      return { tipo, casas: 1 }
  }
}

/** Lado do quadrado em volta de quem usa: só ímpar (3x3 = 1 casa para cada lado). */
export function ladoValido(lado: number, centro: 'si' | 'frente'): number {
  const inteiro = Math.max(1, Math.round(lado))
  return centro === 'si' && inteiro % 2 === 0 ? inteiro + 1 : inteiro
}
