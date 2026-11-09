import type { CartaoDaFicha } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { FORMULA_DO_ATAQUE, formulaDoAtaque } from '../formula'
import { avisoDoCartaoMontado, cartaoMontado, mecanicaLidaDoCartao } from './leitura'
import { testeRolado, VERSAO_DA_MECANICA, type MecanicaV1 } from './modelo'

/**
 * A ARMA MONTADA (construtor de mecânicas, fatia C8; seção 1 do plano: "vale
 * para técnica, arma e bala, o efeito da arma com usos sai daqui"). A arma
 * com `mecanica` ataca pelas peças: o Atacar com ela gasta a ação da peça,
 * cobra o custo, conta os usos da batalha (zeram na batalha nova, como os da
 * técnica) e põe o selo no acerto. O Boomerang do Vincent: arma de arremesso
 * que ao acertar não dá dano e atordoa, 3 vezes por combate.
 *
 * Tudo ou nada, como na técnica: com peças, o Dano da arma em texto vira só
 * descrição. A arma aceita só as peças que o Atacar executa; a que pede mais
 * (área pela grade, teste rolado, ajuda) fica recusada com o motivo, em vez
 * de rodar pela metade.
 *
 * Puro: sem store, sem rede.
 */

/**
 * O que a arma montada não executa, em frase de quem monta ("na arma, ...");
 * `null` = todas as peças valem no Atacar. O Atacar pede o alvo à mão, o d20
 * de reação de sempre e só cobra ao usar.
 */
export function motivoDaArmaNasPecas(mecanica: MecanicaV1): string | null {
  if (mecanica.acao === 'perguntar') return 'na arma, escolha a ação (o Atacar não pergunta)'
  if (mecanica.custos.some((custo) => custo.quando !== 'aoUsar')) return 'na arma, o custo é só ao usar'
  if (mecanica.limite.overload === true) return 'na arma, não há Overload'
  if (mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si') return 'na arma, o golpe vai em inimigo'
  const { forma } = mecanica.alvo
  if (forma.tipo !== 'um' && forma.tipo !== 'varios') return 'na arma, o alvo é 1 ou vários, marcados na mira'
  if (testeRolado(mecanica.teste)) return 'na arma, o alvo reage normal ou o golpe não erra'
  if (mecanica.dano?.arma === 'perguntar') return 'na arma, o dano da arma é o dela mesma'
  return null
}

/** A arma lida pelas peças: `texto` = sem mecânica (o Atacar de sempre); `recusada` = torta, de app mais novo ou com peça que a arma não executa. */
export type ArmaLida = { tipo: 'texto' } | { tipo: 'pecas'; mecanica: MecanicaV1 } | { tipo: 'recusada'; motivo: string }

export function armaLida(arma: Pick<CartaoDaFicha, 'mecanica' | 'nome'>): ArmaLida {
  if (!cartaoMontado(arma)) return { tipo: 'texto' }
  const lida = mecanicaLidaDoCartao(arma)
  const nome = arma.nome.trim() || 'A arma'
  if (lida.tipo !== 'pecas') return { tipo: 'recusada', motivo: `${nome}: ${avisoDoCartaoMontado(arma) ?? 'mecânica inválida'}` }
  const falta = motivoDaArmaNasPecas(lida.mecanica)
  // A primeira letra sobe: a frase do editor ("na arma, ...") vira o motivo da tira.
  return falta === null ? { tipo: 'pecas', mecanica: lida.mecanica } : { tipo: 'recusada', motivo: `${nome}: ${falta}. O mestre ajusta a mecânica.` }
}

// ─── Os modelos da arma ─────────────────────────────────────────────────────

export type IdDoModeloDaArma = 'atordoa' | 'golpeComSelo'

export const MODELOS_DA_ARMA: readonly { id: IdDoModeloDaArma; nome: string; dica: string }[] = [
  { id: 'atordoa', nome: 'Atordoa sem dano', dica: '1 inimigo reage normal; se acertar, Atordoado. 3 vezes por batalha' },
  { id: 'golpeComSelo', nome: 'Golpe com efeito', dica: 'Dano da arma e um selo no acerto. 2 vezes por batalha' },
]

/**
 * A fórmula do golpe da arma: a mesma do Atacar com ela, o "Soma no ataque"
 * dela mais o Dano da arma (a Rosa Fúnebre soma Percepção, não Força). Sem a
 * arma em mãos, a do Atacar de sempre (Força + Dano da arma).
 */
function formulaDaArma(sistema: SistemaDeRpg, arma: CartaoDaFicha | undefined): string {
  return arma === undefined ? FORMULA_DO_ATAQUE : formulaDoAtaque(arma, sistema)
}

/** USOS de partida de cada modelo (o Boomerang: 3 por combate). */
const USOS_DO_ATORDOA = 3
const USOS_DO_GOLPE_COM_SELO = 2

/** `arma`: a arma em que o modelo vai (o editor passa o cartão); o "Golpe com efeito" soma o que ela soma no Atacar. */
export function mecanicaDoModeloDaArma(id: IdDoModeloDaArma, sistema: SistemaDeRpg, arma?: CartaoDaFicha): MecanicaV1 {
  const base = { versao: VERSAO_DA_MECANICA, acao: 'simples', custos: [], teste: { tipo: 'reacao' }, alvo: { quem: 'inimigos', forma: { tipo: 'um' } } } as const
  switch (id) {
    case 'atordoa':
      return { ...base, limite: { usosPorBatalha: USOS_DO_ATORDOA }, efeitos: [{ tipo: 'selo', nome: 'Atordoado', duracao: 1, natureza: 'debuff' }] }
    case 'golpeComSelo':
      return {
        ...base,
        limite: { usosPorBatalha: USOS_DO_GOLPE_COM_SELO },
        dano: { base: { formula: formulaDaArma(sistema, arma) }, arma: 'padrao', multiplicadores: { concentracao: true, surpresa: true } },
        efeitos: [{ tipo: 'selo', nome: 'Sangrando', duracao: 3, natureza: 'debuff' }],
      }
  }
}

// ─── A arma padrão da ficha ─────────────────────────────────────────────────

/**
 * Construtor C8 (Siegfried: "para ele colocar a arma padrão"): a arma marcada
 * como padrão entre estas; sem marca, a 1ª (como antes). `null` = nenhuma.
 */
export function armaPadraoEntre<T extends Pick<CartaoDaFicha, 'armaPadrao'>>(armas: readonly T[]): T | null {
  return armas.find((arma) => arma.armaPadrao === true) ?? armas[0] ?? null
}

/** As armas com a padrão na frente (a mira que pergunta "Qual arma?" já abre nela); a ordem das outras fica. */
export function comAPadraoNaFrente<T extends Pick<CartaoDaFicha, 'armaPadrao'>>(armas: readonly T[]): T[] {
  const padrao = armas.find((arma) => arma.armaPadrao === true)
  return padrao === undefined ? [...armas] : [padrao, ...armas.filter((arma) => arma !== padrao)]
}
