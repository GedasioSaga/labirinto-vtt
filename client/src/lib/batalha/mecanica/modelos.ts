import type { CartaoDaFicha, MecanicaGuardada } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { cdDaExpressao } from '../disputa'
import { lerMecanica, testeRolado, VERSAO_DA_MECANICA, type CdDoTeste, type FormaDoAlvo, type MecanicaV1, type NumeroSimples, type QuemOAlvoPega, type Teste } from './modelo'
import type { FichaDaPrevia } from './resumo'

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
  { id: 'debuff', nome: 'Debuff com teste', dica: '1 inimigo testa contra CD 12; se falhar, fica Atordoado' },
  { id: 'buff', nome: 'Buff em aliado', dica: 'Um selo bom em 1 aliado; o bônus você confere à mão' },
]

/** "Força + 20" com o 1º atributo do sistema; sem atributos, um número. */
function formulaDeExemplo(sistema: SistemaDeRpg): string {
  const atributo = sistema.atributos[0]?.nome.trim()
  return atributo === undefined || atributo === '' ? '50' : `${atributo} + 20`
}

const MULTIPLICADORES_DE_SEMPRE = { concentracao: true, surpresa: true } as const

/** CD de partida do modelo com teste (construtor C4). */
const CD_DO_MODELO = 12

/** O atributo de partida de um teste: o pedido (`forca`, `resistencia`) ou, sem ele no sistema, o 1º; `null` = sistema sem atributos. */
function atributoDePartida(sistema: SistemaDeRpg, preferido: string): string | null {
  const achado = sistema.atributos.find((atributo) => atributo.id === preferido) ?? sistema.atributos.at(0)
  return achado === undefined ? null : achado.id
}

/**
 * Construtor C4: o teste novo ao trocar o tipo no bloco 4, com números de
 * partida (o alvo testa Resistência contra CD 12; a disputa é Força contra
 * Resistência). Sistema sem atributos: o alvo reage normal (a tela não
 * oferece teste).
 */
export function testeNovo(tipo: Teste['tipo'], atual: Teste, sistema: SistemaDeRpg): Teste {
  if (tipo === atual.tipo) return atual
  const resiste = atributoDePartida(sistema, 'resistencia')
  const forca = atributoDePartida(sistema, 'forca')
  switch (tipo) {
    case 'reacao':
    case 'naoErra':
      return { tipo }
    case 'resistencia':
      return resiste === null ? { tipo: 'reacao' } : { tipo, alvo: { atributo: resiste }, cd: { fixo: CD_DO_MODELO }, sePassar: 'nada' }
    case 'disputa':
      return resiste === null || forca === null ? { tipo: 'reacao' } : { tipo, usuario: { atributo: forca }, alvo: { atributo: resiste } }
  }
}

/** O teste do "Debuff com teste" (construtor C4): o alvo testa Resistência contra CD 12. */
function testeDoModelo(sistema: SistemaDeRpg): Teste {
  return testeNovo('resistencia', { tipo: 'reacao' }, sistema)
}

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
      return { ...base, acao: 'simples', custos: [...custo30], limite: { recarga: 2 }, alvo: { quem: 'inimigos', forma: { tipo: 'um' } }, teste: testeDoModelo(sistema), efeitos: [{ tipo: 'selo', nome: 'Atordoado', duracao: 1, natureza: 'debuff' }] }
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

/** Os números da CD (sem o "pega sem teste"). */
function numerosDaCd(cd: CdDoTeste): NumeroSimples[] {
  if (!('porCarga' in cd)) return [cd]
  return cd.porCarga.filter((numero): numero is NumeroSimples => numero !== 'automatico')
}

/**
 * Construtor C4: o que o teste pede com a ficha de quem usa, em frase: o
 * atributo que o sistema tem e a fórmula da CD que fecha ("12 + mod(Carisma)").
 */
function problemaDoTeste(teste: Teste, ficha: FichaDaPrevia): string | null {
  if (!testeRolado(teste)) return null
  const quem = teste.tipo === 'resistencia' ? [teste.alvo] : [teste.usuario, teste.alvo]
  if (quem.some((lado) => !ficha.sistema.atributos.some((atributo) => atributo.id === lado.atributo))) return 'o atributo do teste não existe neste sistema'
  if (teste.tipo !== 'resistencia') return null
  const fecha = numerosDaCd(teste.cd).every((numero) => 'fixo' in numero || cdDaExpressao(numero.formula, { personagem: ficha.personagem }, ficha.sistema) !== null)
  return fecha ? null : 'a fórmula da CD não fecha com esta ficha'
}

/** O que falta preencher, em frase de quem monta (antes do motivo técnico da leitura). */
function faltaPreencher(mecanica: MecanicaV1): string | null {
  const custo = mecanica.custos.find((item) => 'formula' in item.quanto && vazio(item.quanto.formula))
  if (custo !== undefined) return 'falta a fórmula do custo'
  if (mecanica.teste.tipo === 'resistencia' && numerosDaCd(mecanica.teste.cd).some((numero) => 'formula' in numero && vazio(numero.formula))) return 'falta a fórmula da CD'
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

/**
 * O motivo de a mecânica do editor não valer ainda; `null` = o motor aceita.
 * Com a `ficha` (construtor C4), também o que o teste pede dela.
 */
export function problemaDaMecanica(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string | null {
  const falta = faltaPreencher(mecanica)
  if (falta !== null) return falta
  const lida = lerMecanica(guardarMecanica(mecanica))
  if (lida.tipo === 'invalida') return lida.motivo
  return ficha === undefined ? null : problemaDoTeste(mecanica.teste, ficha)
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

/**
 * Troca quem o golpe pega: "em si" é um alvo só (o resto guarda a forma).
 * Natureza do selo acompanha. Ajuda não testa (C4): o teste rolado volta a
 * "reage normal", que na ajuda não pede reação.
 */
export function trocarQuem(mecanica: MecanicaV1, quem: QuemOAlvoPega): MecanicaV1 {
  const forma: FormaDoAlvo = quem === 'si' ? { tipo: 'um' } : mecanica.alvo.forma
  const natureza: 'buff' | 'debuff' = ehAjuda(quem) ? 'buff' : 'debuff'
  const efeitos = mecanica.efeitos.map((efeito) => (efeito.tipo === 'selo' ? { ...efeito, natureza } : efeito))
  const teste: Teste = ehAjuda(quem) && testeRolado(mecanica.teste) ? { tipo: 'reacao' } : mecanica.teste
  return { ...mecanica, alvo: { quem, forma }, efeitos, teste }
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
