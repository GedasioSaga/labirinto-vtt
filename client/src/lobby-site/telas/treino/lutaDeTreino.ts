import { maximoComposto } from '../../../lib/ajusteDaFicha'
import type { Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { aplicarJogada, criarDuelo, type DueloGravado, type JogadaDoDuelo, type MotivoDaRecusa, type MotorDoDuelo } from '../../../lib/treino/duelo'
import { montarLutadores, VAGAS_POR_LADO_MAX, type LutadoresDoTreino, type MontagemDoTreino } from '../../../lib/treino/mesaEmMemoria'
import { criarSorteio, type Sorteio } from '../../../lib/treino/sorteio'
import { passoDoRobo, type GolpesDaVez } from '../../dados/roboDoDuelo'

/**
 * A LUTA DE TREINO TURNO A TURNO (fatia T7, resposta 12.17: dado com semente,
 * "repetir esta luta" e "nova semente"). Você joga o seu lado e o robô do
 * treino (T3) joga o do inimigo, pela MESMA regra do duelo entre jogadores
 * (`lib/treino/duelo.ts`, T5): o dano e o custo são recalculados pela ficha,
 * nunca digitados. O d20 sai do sorteio com semente (`sorteio.ts`): a mesma
 * semente com as mesmas escolhas dá a mesma luta. Tudo roda em cópias das
 * fichas, no navegador; a ficha de verdade nunca é tocada.
 */

/** As duas "contas" da luta local: o lado de quem treina (A) e o do inimigo (B). */
export const CONTA_DO_TREINO = 'treino_voce'
export const CONTA_DO_INIMIGO = 'treino_inimigo'

/** Quantos passos do robô "ir até o fim" dá no máximo (o teto de passos da luta acaba antes). */
const PASSOS_ATE_O_FIM_MAX = 10_000

/** Quem luta: as minhas fichas (lado A) e os inimigos (lado B), já como vão para a luta. */
export interface MontagemDaLuta {
  minhas: readonly Personagem[]
  inimigos: readonly Personagem[]
}

export interface LutaLocal {
  semente: number
  duelo: DueloGravado
  golpesDaVez: GolpesDaVez | null
  sorteio: Sorteio
  motor: MotorDoDuelo
}

/** A cópia com Vida e Energia no máximo (o máximo com os modificadores, como a ficha mostra). */
export function comVidaCheia(doc: Personagem, sistema: SistemaDeRpg): Personagem {
  const recursos = { ...doc.recursos }
  for (const recurso of sistema.recursos) {
    if (recurso.atualEMaximo === true) recursos[recurso.id] = maximoComposto(doc, recurso.id).total
  }
  return { ...doc, recursos }
}

/** As vagas e as cópias da montagem (para as 100 lutas e o comparar build, no worker). */
export function lutadoresDaMontagem(montagem: MontagemDaLuta): MontagemDoTreino {
  return montarLutadores([...montagem.minhas.map((ficha) => ({ ficha, lado: 'a' as const })), ...montagem.inimigos.map((ficha) => ({ ficha, lado: 'b' as const }))])
}

/** A montagem cabe na luta? Texto do motivo, ou `null`. */
export function problemaDaMontagem(montagem: MontagemDaLuta): string | null {
  if (montagem.minhas.length === 0) return 'Escolha pelo menos um personagem seu.'
  if (montagem.inimigos.length === 0) return 'Escolha um inimigo.'
  if (montagem.minhas.length > VAGAS_POR_LADO_MAX || montagem.inimigos.length > VAGAS_POR_LADO_MAX) return `Cada lado leva no máximo ${VAGAS_POR_LADO_MAX}.`
  return null
}

/**
 * A assinatura do que vai para a luta: as cópias dos dois lados, com todos os
 * números. Mudou o inimigo, o "Quantos", uma ficha, a Vida cheia ou o
 * rascunho, ela muda, e o resultado que a tela guardou deixa de ser o da
 * montagem de agora (revisão da T7). As cópias são JSON puro e poucas (no
 * máximo 3 por lado): o texto sai barato.
 */
export function assinaturaDaMontagem(montagem: MontagemDaLuta): string {
  return JSON.stringify([montagem.minhas, montagem.inimigos])
}

function ladoEmTexto(fichas: readonly Personagem[]): string {
  const vezes = new Map<string, number>()
  for (const ficha of fichas) vezes.set(ficha.nome, (vezes.get(ficha.nome) ?? 0) + 1)
  const nomes = [...vezes].map(([nome, n]) => (n > 1 ? `${n} × ${nome}` : nome))
  if (nomes.length <= 1) return nomes[0] ?? 'ninguém'
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/** "Sora e Gael contra 2 × Recruta da Marinha": quem lutou, para o resultado dizer contra quem foi. */
export function quemLutou(montagem: MontagemDaLuta): string {
  return `${ladoEmTexto(montagem.minhas)} contra ${ladoEmTexto(montagem.inimigos)}`
}

export type ComecoDaLuta = { ok: true; luta: LutaLocal } | { ok: false; motivo: string }

/** A luta nova com a semente: as cópias com o dono de cada lado, a ordem pela Agilidade e o desempate no d20 da semente. */
export function comecarLutaLocal(montagem: MontagemDaLuta, sistema: SistemaDeRpg, semente: number): ComecoDaLuta {
  const problema = problemaDaMontagem(montagem)
  if (problema !== null) return { ok: false, motivo: problema }
  const sorteio = criarSorteio(semente)
  const motor: MotorDoDuelo = { sistema, rolarD20: () => sorteio.d20() }
  const criado = criarDuelo(
    {
      id: 'treino_local',
      a: { contaId: CONTA_DO_TREINO, nome: 'Você', fichas: montagem.minhas.map((ficha) => ({ ...ficha, dono: CONTA_DO_TREINO })) },
      b: { contaId: CONTA_DO_INIMIGO, nome: 'Inimigo', fichas: montagem.inimigos.map((ficha) => ({ ...ficha, dono: CONTA_DO_INIMIGO })) },
    },
    motor,
  )
  if (!criado.ok) return { ok: false, motivo: 'Não deu para montar a luta com essas fichas.' }
  return { ok: true, luta: { semente, duelo: criado.duelo, golpesDaVez: null, sorteio, motor } }
}

export type ResultadoNaLuta = { ok: true; luta: LutaLocal } | { ok: false; motivo: MotivoDaRecusa }

/** A minha jogada (lado A). Andar é livre, como na Arena do app: qualquer ficha minha, a qualquer hora (a casa dentro da grade e livre). */
export function jogarNaLuta(luta: LutaLocal, jogada: JogadaDoDuelo): ResultadoNaLuta {
  const feito = aplicarJogada(luta.duelo, luta.motor, CONTA_DO_TREINO, jogada, 'livre')
  if (!feito.ok) return feito
  return { ok: true, luta: { ...luta, duelo: feito.duelo } }
}

/** Um passo do robô: sempre pelo inimigo, e pelo meu lado também quando ele joga por mim. `null` = a vez é minha (ou acabou). */
export function passoDoInimigo(luta: LutaLocal, roboJogaPorMim: boolean): LutaLocal | null {
  const passo = passoDoRobo(luta.duelo, luta.motor, luta.golpesDaVez, (lado) => lado === 'b' || roboJogaPorMim)
  return passo === null ? null : { ...luta, duelo: passo.duelo, golpesDaVez: passo.golpesDaVez }
}

/** O robô joga os dois lados até a luta acabar (o "ir até o fim"). */
export function lutaAteOFim(luta: LutaLocal): LutaLocal {
  let agora = luta
  for (let passo = 0; passo < PASSOS_ATE_O_FIM_MAX && agora.duelo.fim === null; passo += 1) {
    const depois = passoDoInimigo(agora, true)
    if (depois === null) break
    agora = depois
  }
  return agora
}

export type { LutadoresDoTreino }
