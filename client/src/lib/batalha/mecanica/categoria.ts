import { rotuloDoTipo, type TipoDaHabilidade } from '../tiposDaHabilidade'
import { ehAjuda } from './modelos'
import type { AcaoDaMecanica, MecanicaV1 } from './modelo'

/**
 * A CATEGORIA DA AÇÃO E O TIPO NA BATALHA (fase ED2 do editor novo; EDITOR.md §3.3).
 * A categoria não tem campo: sai das peças (Simples, Completo, Overload, Apoio,
 * Reação). Passiva não está aqui: é o cartão sem mecânica (decisão de 23/11).
 * O editor (a linha Ação, o papel) e o texto gerado (`textoGerado.ts`) leem
 * daqui, para a tela e o campo Tipo nunca dizerem coisas diferentes.
 *
 * Puro: sem store, sem rede.
 */

export type CategoriaDaAcao = 'simples' | 'completo' | 'overload' | 'apoio' | 'reacao'

/** A categoria das peças: a reação (só nela ou também na vez) vem antes; depois a Overload; depois a ajuda. */
export function categoriaDaMecanica(mecanica: MecanicaV1): CategoriaDaAcao {
  if (mecanica.uso === 'reacao' || mecanica.uso === 'ativaOuReacao') return 'reacao'
  if (mecanica.limite.overload === true) return 'overload'
  if (ehAjuda(mecanica.alvo.quem)) return 'apoio'
  return mecanica.acao === 'completa' ? 'completo' : 'simples'
}

/** Ataque que gasta outra ação (a Bônus, a Livre ou a da hora) continua no cartão "Ataque Simples", com o nome dela. */
const NOME_DO_ATAQUE: Readonly<Record<AcaoDaMecanica, string>> = {
  simples: 'Ataque Simples',
  bonus: 'Ataque Bônus',
  completa: 'Ataque Completo',
  livre: 'Ataque Livre',
  perguntar: 'Ataque (a ação na hora)',
}

/** O nome que abre a frase do papel e a linha curta ("Ataque Completo", "Reação (ou na vez)"). */
export function nomeDaAcao(mecanica: MecanicaV1): string {
  const categoria = categoriaDaMecanica(mecanica)
  if (categoria === 'simples' || categoria === 'completo') return NOME_DO_ATAQUE[mecanica.acao]
  if (categoria === 'reacao') return mecanica.uso === 'ativaOuReacao' ? 'Reação (ou na vez)' : 'Reação'
  return categoria === 'overload' ? 'Overload' : 'Apoio'
}

/** Os tipos que as peças dizem; Passiva, Evolução, Escolha e Invocação as peças não dizem. */
export type TipoDasPecas = Extract<TipoDaHabilidade, 'ativa' | 'buff' | 'debuff' | 'reacao'>

/**
 * A técnica não dá dano e o que ela põe no alvo é só condição: os Efeitos e o tipo do golpe (o
 * Veneno vira o selo Envenenado na leitura do motor, `pecasParaOMotor`; o "só o tipo" não põe nada;
 * o empurrão do Impacto é lembrete do próprio tipo, não conta como outra coisa).
 */
function soPoeCondicao(mecanica: MecanicaV1): boolean {
  if (mecanica.dano !== undefined || !mecanica.efeitos.every((efeito) => efeito.tipo === 'selo')) return false
  return mecanica.efeitos.length + condicoesDoGolpe(mecanica) > 0
}

/** Quantos tipos do golpe põem condição (o Perfurante e o "só o tipo" não põem). */
function condicoesDoGolpe(mecanica: MecanicaV1): number {
  const { bate, causa = [] } = mecanica.golpe ?? {}
  const tipos = [...(bate === undefined || bate.tipo === 'perfurante' ? [] : [bate]), ...causa]
  return tipos.filter((escolha) => escolha.regra.quando !== 'soTipo').length
}

/**
 * O Tipo das peças (§3.3): só no lugar da reação = Reação; ajuda (aliados, em si) = Buff; sem dano
 * e só condição = Debuff; o resto (a Overload e o "também na vez" inclusive) = Ativa. O "também na
 * vez" não é Reação: o Tipo Reação trava o uso na vez (`motivoDaTecnica`, "reação pura"); a caixa
 * REAÇÃO o acha pelas peças (`usoDeReacao`) ou pela Ação "Reação/Ação ...".
 */
export function tipoDasPecas(mecanica: MecanicaV1): TipoDasPecas {
  if (mecanica.uso === 'reacao') return 'reacao'
  if (ehAjuda(mecanica.alvo.quem)) return 'buff'
  return soPoeCondicao(mecanica) ? 'debuff' : 'ativa'
}

/** "Tipo na batalha", como a ficha o escreve ("Ativa", "Buff", "Debuff", "Reação"). */
export function tipoNaBatalha(mecanica: MecanicaV1): string {
  return rotuloDoTipo(tipoDasPecas(mecanica))
}
