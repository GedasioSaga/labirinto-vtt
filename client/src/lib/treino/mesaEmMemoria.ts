import { casasDoLado, casasDoPerimetro, GRADE_MEDIA, GRADE_PEQUENA, type GradeDaArena, type TamanhoDaGrade } from '../arena/grade'
import type { Casa } from '../batalha/blocos'
import type { Equipe } from '../batalha/equipes'
import type { MesaDaBatalha } from '../batalha/mesa'
import { fichaSemHp } from '../livros/combate'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'

/**
 * A MESA EM MEMÓRIA DO TREINO (LOBBY v2, fatia T2 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): a `MesaDaBatalha` da luta
 * de treino, com CÓPIAS das fichas (a liberada pelo mestre, a do jogador ou o
 * rascunho de build). A batalha do treino lê e grava só aqui; a ficha de
 * verdade nunca é tocada (lei: "treino nunca altera a ficha real").
 *
 * ID DETERMINÍSTICO POR VAGA (achado Tr8, "mesmo inimigo duas vezes", §11):
 * cada vaga é o lado e a posição nele (`a1`, `a2`, `b1`), e a cópia e o token
 * dela levam o id da vaga (`treino_a1`, `treino_tok_a1`). Assim o mesmo
 * inimigo duas vezes não colide, e a mesma escolha dá os mesmos ids: a luta
 * repetida com a mesma semente, a pausada em JSON e o duelo nos dois lados da
 * rede falam dos mesmos combatentes. (A arena do app usa `arena_<uuid>`,
 * `lib/arena/copias.ts`: lá ninguém precisa repetir a luta.)
 *
 * As equipes são as duas virtuais, "Lado A" e "Lado B"; trocar de equipe não
 * existe no treino, nem invocação (como a arena).
 *
 * A GRADE (fatia M1, pedido de 06/11: o treino e o duelo com a cara da Arena
 * de testes do app): a pequena da Arena, 12 x 8. Cada vaga nasce numa casa
 * determinística, como a Arena monta (`casasDoLado` de `lib/arena/grade.ts`):
 * o Lado A nas 2 colunas da esquerda, o B nas 2 da direita, em zigue-zague e
 * centrados na altura. A mesma escolha dá as mesmas casas.
 *
 * N LADOS (Arena multijogador, fatia F2 de
 * docs/planos/arena-multijogador-2026-11-07.md §1): a luta aceita até 12
 * lados, uma letra cada (`LadoDaLuta`, `a` a `l`); o treino e o duelo de hoje
 * são o atalho de 2 lados (`LadoDoTreino`, só `a` e `b`), com a grade, as casas
 * e as equipes de sempre. Com mais de 2 lados as fichas nascem pelo perímetro
 * (`casasDoPerimetro`); a luta v4 escolhe a grade média com mais de 2 lados ou
 * mais de 6 fichas (`tamanhoDaLuta`). Ids `a1`/`b1` seguem valendo.
 *
 * Puro: sem store, sem DOM, sem Tauri.
 */

/** Os lados da luta: até 12, uma letra cada. */
export type LadoDaLuta = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l'

export const LADOS_DA_LUTA: readonly LadoDaLuta[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']

/** Os dois lados do treino e do duelo: o atalho de 2 lados da luta. */
export type LadoDoTreino = 'a' | 'b'

export const LADOS_DO_TREINO: readonly LadoDoTreino[] = ['a', 'b']

/** Fichas num lado, contando as repetidas (o mesmo teto da arena, `FICHAS_POR_LADO_MAX`). */
export const VAGAS_POR_LADO_MAX = 6

/** Fichas numa luta, somando todos os lados (plano da Arena multijogador §2). */
export const FICHAS_DA_LUTA_MAX = 12

/** Fichas acima disso, ou mais de 2 lados, levam a luta v4 para a grade média. */
const FICHAS_NA_GRADE_PEQUENA_MAX = 6

const PREFIXO_DA_COPIA = 'treino_'
const PREFIXO_DO_TOKEN = 'treino_tok_'

/** Uma equipe virtual. Cor no formato de `Equipe.cor`. */
interface EquipeVirtual {
  readonly id: string
  readonly nome: string
  readonly cor: string
}

/** A equipe virtual de cada lado da luta: a e b são as de sempre; as outras cores ficam longe do azul e do vermelho delas. */
export const EQUIPE_DA_LUTA: Readonly<Record<LadoDaLuta, EquipeVirtual>> = {
  a: { id: 'treino-a', nome: 'Lado A', cor: '#4a78c2' },
  b: { id: 'treino-b', nome: 'Lado B', cor: '#c2524a' },
  c: { id: 'treino-c', nome: 'Lado C', cor: '#3f9a5b' },
  d: { id: 'treino-d', nome: 'Lado D', cor: '#c29a2e' },
  e: { id: 'treino-e', nome: 'Lado E', cor: '#8a5cc2' },
  f: { id: 'treino-f', nome: 'Lado F', cor: '#2e9fae' },
  g: { id: 'treino-g', nome: 'Lado G', cor: '#c2652e' },
  h: { id: 'treino-h', nome: 'Lado H', cor: '#c24f8f' },
  i: { id: 'treino-i', nome: 'Lado I', cor: '#6f8a2e' },
  j: { id: 'treino-j', nome: 'Lado J', cor: '#5a6f9e' },
  k: { id: 'treino-k', nome: 'Lado K', cor: '#9e6f4f' },
  l: { id: 'treino-l', nome: 'Lado L', cor: '#7a7a7a' },
}

/** As duas equipes virtuais do treino e do duelo. */
export const EQUIPE_DO_LADO: Readonly<Record<LadoDoTreino, EquipeVirtual>> = { a: EQUIPE_DA_LUTA.a, b: EQUIPE_DA_LUTA.b }

/** Uma ficha escolhida para um lado (a mesma ficha pode vir mais de uma vez). */
export interface EscolhaDaVaga<L extends LadoDaLuta = LadoDoTreino> {
  ficha: Personagem
  lado: L
  /** A conta que joga esta ficha (luta v4: no time, cada conta só joga a própria). Ausente no treino e no duelo. */
  contaId?: string
}

export interface VagaDaLuta<L extends LadoDaLuta = LadoDaLuta> {
  /** O lado e a posição nele, 1 em diante: `a1`, `a2`, `b1`. */
  id: string
  lado: L
  /** O id da cópia: `treino_<vaga>`. */
  personagemId: string
  /** O id do token da cópia: `treino_tok_<vaga>`. */
  tokenId: string
  /** O id da ficha de onde a cópia veio. */
  origem: string
  /**
   * Como o robô reage por esta vaga (fatia J): `'parado'` = nunca reage, todo
   * golpe entra cheio (o Judge com "Fica parado", como o boneco da Arena);
   * ausente = rola o d20 e fica com a melhor defesa que o dado liberar.
   */
  reage?: 'parado'
  /** A conta que joga a vaga (luta v4). Ausente = a vaga é do lado inteiro (o treino e o duelo). */
  contaId?: string
  /** A vaga saiu da luta (a conta sumiu 3 min ou saiu): fora da ordem e fora da conta de quem está de pé. */
  fora?: true
}

/** A vaga do treino e do duelo: só os lados `a` e `b`. */
export type VagaDoTreino = VagaDaLuta<LadoDoTreino>

/** A grade do treino e do duelo: a pequena da Arena (12 colunas x 8 linhas). */
export const GRADE_DO_TREINO: GradeDaArena = GRADE_PEQUENA

/** Uma casa da grade do treino (coluna e linha, de 0). */
export type CasaDoTreino = Casa

/**
 * O token da vaga, no formato que `combatentesIniciais` e `incluirCombatente`
 * (`lib/batalha/turnos.ts`) leem, com a casa onde a vaga nasce na grade.
 */
export interface TokenDaVaga {
  id: string
  characterId: string
  name: string
  col: number
  row: number
}

/** Quem luta: as vagas e as cópias. Só dados: vai a JSON (a luta pausada) e volta por `criarMesaEmMemoria`. */
export interface LutadoresDaLuta<L extends LadoDaLuta = LadoDaLuta> {
  vagas: readonly VagaDaLuta<L>[]
  personagens: readonly Personagem[]
}

/** Quem luta no treino e no duelo (2 lados). */
export type LutadoresDoTreino = LutadoresDaLuta<LadoDoTreino>

export type MontagemNosLados<L extends LadoDaLuta> =
  | { ok: true; lutadores: LutadoresDaLuta<L> }
  /** `vazio` = o lado não tem ninguém; `cheio` = passou de `VAGAS_POR_LADO_MAX`. */
  | { ok: false; motivo: 'vazio' | 'cheio'; lado: L }

export type MontagemDoTreino = MontagemNosLados<LadoDoTreino>

/** A montagem da luta v4: `poucosLados` = menos de 2 lados com ficha; `demais` = passou de `FICHAS_DA_LUTA_MAX`. */
export type MontagemDaLuta = MontagemNosLados<LadoDaLuta> | { ok: false; motivo: 'poucosLados' | 'demais' }

export interface MesaDaLuta<L extends LadoDaLuta = LadoDaLuta> extends MesaDaBatalha {
  /** As vagas, Lado A primeiro, na ordem da escolha. */
  vagas(): readonly VagaDaLuta<L>[]
  /** Um token por vaga, na ordem das vagas, com o nome da cópia. */
  tokens(): readonly TokenDaVaga[]
  /** As vagas e as cópias de AGORA (com o que a luta já mudou nelas), para gravar a luta pausada. */
  lutadores(): LutadoresDaLuta<L>
}

/** A mesa do treino e do duelo (2 lados). */
export type MesaEmMemoria = MesaDaLuta<LadoDoTreino>

/** O nome que ainda não está em `usados`: o da ficha, ou com número ("Marinheiro 2", "Marinheiro 3"). A montagem na grade do site numera com o mesmo. */
export function nomeLivre(nome: string, usados: ReadonlySet<string>): string {
  if (!usados.has(nome)) return nome
  let n = 2
  while (usados.has(`${nome} ${n}`)) n += 1
  return `${nome} ${n}`
}

/**
 * As vagas e as cópias da escolha: Lado A primeiro, depois o B, cada lado na
 * ordem em que as fichas foram escolhidas. A cópia é a ficha inteira (clone
 * fundo) com o id da vaga, o histórico zerado e o nome sem repetir entre todas
 * as cópias dos dois lados: o registro nunca fica com dois nomes iguais.
 * Lado sem ninguém ou acima de `VAGAS_POR_LADO_MAX` = recusa, com o lado.
 */
export function montarLutadores(escolhas: readonly EscolhaDaVaga[]): MontagemDoTreino {
  return montarNosLados(escolhas, LADOS_DO_TREINO)
}

/**
 * As vagas e as cópias da luta v4: cada lado que tem ficha, na ordem das
 * letras (`LADOS_DA_LUTA`), e em cada lado a ordem da escolha, com a conta de
 * cada ficha na vaga. Recusa: menos de 2 lados (`poucosLados`), mais de
 * `FICHAS_DA_LUTA_MAX` fichas (`demais`) ou um lado acima de
 * `VAGAS_POR_LADO_MAX` (`cheio`).
 */
export function montarLutadoresDaLuta(escolhas: readonly EscolhaDaVaga<LadoDaLuta>[]): MontagemDaLuta {
  const lados = LADOS_DA_LUTA.filter((lado) => escolhas.some((escolha) => escolha.lado === lado))
  if (lados.length < 2) return { ok: false, motivo: 'poucosLados' }
  if (escolhas.length > FICHAS_DA_LUTA_MAX) return { ok: false, motivo: 'demais' }
  return montarNosLados(escolhas, lados)
}

/**
 * Conserto das fichas F2 (fatia A, resposta da Saga: "FICA DE FORA E AVISA
 * ficha sem HP"): a primeira ficha da escolha com HP máximo 0
 * (`fichaSemHp`), com o lado e o nome, para quem cria a luta recusar e dizer
 * qual; `null` = todas lutam. Sem isto ela entraria na grade sem carta na
 * ordem (`combatentesIniciais` a pula), parada e calada.
 */
export function fichaSemHpNaEscolha<L extends LadoDaLuta>(escolhas: readonly EscolhaDaVaga<L>[], sistema: SistemaDeRpg | null): { lado: L; nome: string } | null {
  const achada = escolhas.find((escolha) => fichaSemHp(escolha.ficha, sistema))
  return achada === undefined ? null : { lado: achada.lado, nome: achada.ficha.nome }
}

/** A montagem nos `lados` pedidos, nesta ordem: cada um com alguém e até `VAGAS_POR_LADO_MAX`. Escolha de outro lado fica de fora. */
function montarNosLados<L extends LadoDaLuta>(escolhas: readonly EscolhaDaVaga<L>[], lados: readonly L[]): MontagemNosLados<L> {
  for (const lado of lados) {
    const noLado = escolhas.filter((escolha) => escolha.lado === lado).length
    if (noLado === 0) return { ok: false, motivo: 'vazio', lado }
    if (noLado > VAGAS_POR_LADO_MAX) return { ok: false, motivo: 'cheio', lado }
  }
  const vagas: VagaDaLuta<L>[] = []
  const personagens: Personagem[] = []
  const usados = new Set<string>()
  for (const lado of lados) {
    let posicao = 0
    for (const { ficha, lado: ladoDaEscolha, contaId } of escolhas) {
      if (ladoDaEscolha !== lado) continue
      posicao += 1
      const id = `${lado}${posicao}`
      const personagemId = `${PREFIXO_DA_COPIA}${id}`
      const nome = nomeLivre(ficha.nome, usados)
      usados.add(nome)
      const vaga: VagaDaLuta<L> = { id, lado, personagemId, tokenId: `${PREFIXO_DO_TOKEN}${id}`, origem: ficha.id }
      // Só a luta v4 diz a conta: as vagas do treino e do duelo saem iguais às de antes (o JSON gravado não muda).
      if (contaId !== undefined) vaga.contaId = contaId
      vagas.push(vaga)
      personagens.push({ ...structuredClone(ficha), id: personagemId, nome, historico: [] })
    }
  }
  return { ok: true, lutadores: { vagas, personagens } }
}

/** Os lados que têm vaga, na ordem das letras. */
export function ladosDasVagas(vagas: readonly VagaDaLuta[]): LadoDaLuta[] {
  return LADOS_DA_LUTA.filter((lado) => vagas.some((vaga) => vaga.lado === lado))
}

/** Só os lados `a` e `b` (o treino e o duelo de hoje, ou a luta v4 de 2 lados): as casas e as equipes de sempre. */
export function soOsDoisLados(vagas: readonly VagaDaLuta[]): boolean {
  return vagas.every((vaga) => vaga.lado === 'a' || vaga.lado === 'b')
}

/** A grade da luta v4: a média com mais de 2 lados ou mais de 6 fichas; senão a pequena do treino (o duelo de hoje). */
export function tamanhoDaLuta(vagas: readonly VagaDaLuta[]): TamanhoDaGrade {
  return ladosDasVagas(vagas).length > 2 || vagas.length > FICHAS_NA_GRADE_PEQUENA_MAX ? 'media' : 'pequena'
}

/**
 * A casa onde cada vaga nasce, pelo id do token. Só os lados `a` e `b`: cada
 * lado em `casasDoLado` da Arena, na ordem das vagas dele (`VAGAS_POR_LADO_MAX`
 * = 6 cabe em 2 colunas x 3 linhas). Mais lados: pelo perímetro
 * (`casasDoPerimetro`), um arco por lado na ordem das letras. Vaga que não cabe
 * fica sem casa (`criarMesaEmMemoria` recusa).
 */
export function casasIniciais(vagas: readonly VagaDaLuta[], grade: GradeDaArena = GRADE_DO_TREINO): ReadonlyMap<string, CasaDoTreino> {
  const casas = new Map<string, CasaDoTreino>()
  const porLado = (doLado: readonly VagaDaLuta[], naGrade: readonly CasaDoTreino[]): void => {
    doLado.forEach((vaga, i) => {
      const casa = naGrade[i]
      if (casa !== undefined) casas.set(vaga.tokenId, casa)
    })
  }
  if (soOsDoisLados(vagas)) {
    for (const lado of LADOS_DO_TREINO) {
      const doLado = vagas.filter((vaga) => vaga.lado === lado)
      porLado(doLado, casasDoLado(doLado.length, lado, grade))
    }
    return casas
  }
  const lados = ladosDasVagas(vagas)
  const doLado = lados.map((lado) => vagas.filter((vaga) => vaga.lado === lado))
  const arcos = casasDoPerimetro(doLado.map((lista) => lista.length), grade)
  doLado.forEach((lista, i) => porLado(lista, arcos[i] ?? []))
  return casas
}

/** As equipes virtuais com as cópias de cada lado: as duas de sempre no treino e no duelo; na luta de mais lados, uma por lado que tem vaga. */
function equipesDasVagas(vagas: readonly VagaDaLuta[]): Equipe[] {
  const lados: readonly LadoDaLuta[] = soOsDoisLados(vagas) ? LADOS_DO_TREINO : ladosDasVagas(vagas)
  return lados.map((lado) => ({
    ...EQUIPE_DA_LUTA[lado],
    membros: vagas.filter((vaga) => vaga.lado === lado).map((vaga) => vaga.personagemId),
  }))
}

/**
 * A mesa da luta, sobre os lutadores (de `montarLutadores` ou de uma luta
 * pausada) e o sistema do livro. `personagens()` devolve a mesma lista até a
 * batalha ajustar alguém; o ajuste troca a lista inteira (a de antes fica como
 * estava). Vaga sem a cópia dela (luta gravada torta) = `RangeError`: a luta
 * não começa pela metade. `grade` ausente: a do treino com 2 lados (a de
 * sempre), a média com mais.
 */
export function criarMesaEmMemoria<L extends LadoDaLuta>(sistema: SistemaDeRpg | null, lutadores: LutadoresDaLuta<L>, grade?: GradeDaArena): MesaDaLuta<L> {
  const vagas = lutadores.vagas
  const porId = new Map(lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  const casas = casasIniciais(vagas, grade ?? (soOsDoisLados(vagas) ? GRADE_DO_TREINO : GRADE_MEDIA))
  const tokens: readonly TokenDaVaga[] = vagas.map((vaga) => {
    const copia = porId.get(vaga.personagemId)
    if (copia === undefined) throw new RangeError(`vaga ${vaga.id} do treino sem a cópia ${vaga.personagemId}`)
    const casa = casas.get(vaga.tokenId)
    if (casa === undefined) throw new RangeError(`vaga ${vaga.id} do treino sem casa na grade`)
    return { id: vaga.tokenId, characterId: vaga.personagemId, name: copia.nome, col: casa.col, row: casa.row }
  })
  const equipes = equipesDasVagas(vagas)
  let personagens = lutadores.personagens

  return {
    personagens: () => personagens,
    sistema: () => sistema,
    equipes: () => equipes,
    ajustarPersonagem: (personagemId, ajustar) => {
      const atual = personagens.find((personagem) => personagem.id === personagemId)
      if (atual === undefined) return false
      const novo = ajustar(atual)
      if (novo !== atual) personagens = personagens.map((personagem) => (personagem.id === personagemId ? novo : personagem))
      return true
    },
    trocarEquipe: () => false,
    vagas: () => vagas,
    tokens: () => tokens,
    lutadores: () => ({ vagas, personagens }),
  }
}
