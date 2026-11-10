import { maximoComposto } from '../../../lib/ajusteDaFicha'
import type { CasaDaArena } from '../../../lib/arena/grade'
import { AVISO_SEM_HP, fichaSemHp } from '../../../lib/livros/combate'
import type { Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { aplicarJogada, criarDuelo, type DueloGravado, type JogadaDoDuelo, type MotorDoDuelo, type RecusaDaJogada } from '../../../lib/treino/duelo'
import { GRADE_DO_TREINO, montarLutadores, VAGAS_POR_LADO_MAX, type LutadoresDoTreino, type MontagemDoTreino } from '../../../lib/treino/mesaEmMemoria'
import { dentroDaGrade } from './grade/bonecos'
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

/** A casa de largada de cada ficha, por lado, na ordem das fichas do lado (a montagem na grade, fatia J). */
export interface LargadaDaLuta {
  a: readonly CasaDaArena[]
  b: readonly CasaDaArena[]
}

/** Quem luta: as minhas fichas (lado A) e os inimigos (lado B), já como vão para a luta. */
export interface MontagemDaLuta {
  minhas: readonly Personagem[]
  inimigos: readonly Personagem[]
  /** Onde cada ficha começa na grade; ausente = as casas de largada da Arena (`casasIniciais`). Não muda dano nem alcance. */
  largada?: LargadaDaLuta
  /**
   * Os ids das fichas (antes da cópia) que nunca reagem quando o robô joga por
   * elas: o Judge com "Fica parado" (fatia J), como o boneco da Arena. Ausente
   * ou vazio = todo mundo rola o d20.
   */
  naoReagem?: readonly string[]
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

/** As vagas com o "Fica parado": a cópia de uma ficha de `naoReagem` leva `reage: 'parado'`, e o robô não rola o d20 por ela. */
function comParados(lutadores: LutadoresDoTreino, naoReagem: readonly string[] | undefined): LutadoresDoTreino {
  if (naoReagem === undefined || naoReagem.length === 0) return lutadores
  const parados = new Set(naoReagem)
  return { ...lutadores, vagas: lutadores.vagas.map((vaga) => (parados.has(vaga.origem) ? { ...vaga, reage: 'parado' as const } : vaga)) }
}

/** As vagas e as cópias da montagem (para as 100 lutas e o comparar build, no worker). */
export function lutadoresDaMontagem(montagem: MontagemDaLuta): MontagemDoTreino {
  const montada = montarLutadores([...montagem.minhas.map((ficha) => ({ ficha, lado: 'a' as const })), ...montagem.inimigos.map((ficha) => ({ ficha, lado: 'b' as const }))])
  return montada.ok ? { ok: true, lutadores: comParados(montada.lutadores, montagem.naoReagem) } : montada
}

/** "Sora: ficha sem HP. Dê HP máximo à ficha para ela lutar." (F2, fatia A: resposta da Saga). */
function textoSemHp(nome: string): string {
  return `${nome}: ${AVISO_SEM_HP}. Dê HP máximo à ficha para ela lutar.`
}

/** A montagem cabe na luta? Texto do motivo, ou `null`. F2 (fatia A): ficha com HP máximo 0 fica de fora e diz qual. */
export function problemaDaMontagem(montagem: MontagemDaLuta, sistema: SistemaDeRpg): string | null {
  if (montagem.minhas.length === 0) return 'Escolha pelo menos um personagem seu.'
  if (montagem.inimigos.length === 0) return 'Escolha um inimigo.'
  if (montagem.minhas.length > VAGAS_POR_LADO_MAX || montagem.inimigos.length > VAGAS_POR_LADO_MAX) return `Cada lado leva no máximo ${VAGAS_POR_LADO_MAX}.`
  const semHp = [...montagem.minhas, ...montagem.inimigos].find((ficha) => fichaSemHp(ficha, sistema))
  return semHp === undefined ? null : textoSemHp(semHp.nome)
}

/**
 * A assinatura do que vai para a luta: as cópias dos dois lados, com todos os
 * números. Mudou o inimigo, o "Quantos", uma ficha, a Vida cheia ou o
 * rascunho, ela muda, e o resultado que a tela guardou deixa de ser o da
 * montagem de agora (revisão da T7). As cópias são JSON puro e poucas (no
 * máximo 3 por lado): o texto sai barato. O "Fica parado" do Judge muda o
 * resultado e entra também (sem ele, a assinatura é a de antes).
 */
export function assinaturaDaMontagem(montagem: MontagemDaLuta): string {
  const naoReagem = montagem.naoReagem ?? []
  return JSON.stringify(naoReagem.length === 0 ? [montagem.minhas, montagem.inimigos] : [montagem.minhas, montagem.inimigos, naoReagem])
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
  const problema = problemaDaMontagem(montagem, sistema)
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
  if (!criado.ok) return { ok: false, motivo: criado.motivo === 'semHp' ? textoSemHp(criado.nome) : 'Não deu para montar a luta com essas fichas.' }
  const comReacao: DueloGravado = { ...criado.duelo, lutadores: comParados(criado.duelo.lutadores, montagem.naoReagem) }
  const duelo = montagem.largada === undefined ? comReacao : comLargada(comReacao, montagem.largada)
  return { ok: true, luta: { semente, duelo, golpesDaVez: null, sorteio, motor } }
}

/**
 * O duelo com cada ficha na casa onde a montagem a pôs: a n-ésima vaga de cada
 * lado na n-ésima casa da largada dele. Casa fora da grade, repetida ou que
 * falta = aquela ficha fica na casa de largada da Arena (a luta nunca nasce
 * com duas fichas na mesma casa). A posição não entra na regra do golpe: a
 * semente vale igual.
 */
function comLargada(duelo: DueloGravado, largada: LargadaDaLuta): DueloGravado {
  const posicoes: Record<string, CasaDaArena> = { ...duelo.posicoes }
  const usadas = new Set<string>()
  const pedidas = new Map<string, CasaDaArena>()
  for (const lado of ['a', 'b'] as const) {
    duelo.lutadores.vagas
      .filter((vaga) => vaga.lado === lado)
      .forEach((vaga, i) => {
        const casa = largada[lado][i]
        if (casa === undefined || !dentroDaGrade(casa, GRADE_DO_TREINO) || usadas.has(`${casa.col},${casa.row}`)) return
        usadas.add(`${casa.col},${casa.row}`)
        pedidas.set(vaga.tokenId, { col: casa.col, row: casa.row })
      })
  }
  // Quem ficou sem casa pedida guarda a da Arena, se ela não colidir com uma pedida.
  for (const [tokenId, casa] of Object.entries(duelo.posicoes)) {
    if (pedidas.has(tokenId)) continue
    if (usadas.has(`${casa.col},${casa.row}`)) return duelo
    usadas.add(`${casa.col},${casa.row}`)
  }
  for (const [tokenId, casa] of pedidas) posicoes[tokenId] = casa
  return { ...duelo, posicoes }
}

export type ResultadoNaLuta = { ok: true; luta: LutaLocal } | RecusaDaJogada

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
