import type { Equipe } from '../batalha/equipes'
import type { MesaDaBatalha } from '../batalha/mesa'
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
 * existe no treino, nem invocação (sem mapa, como a arena).
 *
 * Puro: sem store, sem DOM, sem Tauri.
 */

export type LadoDoTreino = 'a' | 'b'

export const LADOS_DO_TREINO: readonly LadoDoTreino[] = ['a', 'b']

/** Fichas num lado, contando as repetidas (o mesmo teto da arena, `FICHAS_POR_LADO_MAX`). */
export const VAGAS_POR_LADO_MAX = 6

const PREFIXO_DA_COPIA = 'treino_'
const PREFIXO_DO_TOKEN = 'treino_tok_'

/** As duas equipes virtuais. Cor no formato de `Equipe.cor`. */
export const EQUIPE_DO_LADO: Readonly<Record<LadoDoTreino, { readonly id: string; readonly nome: string; readonly cor: string }>> = {
  a: { id: 'treino-a', nome: 'Lado A', cor: '#4a78c2' },
  b: { id: 'treino-b', nome: 'Lado B', cor: '#c2524a' },
}

/** Uma ficha escolhida para um lado (a mesma ficha pode vir mais de uma vez). */
export interface EscolhaDaVaga {
  ficha: Personagem
  lado: LadoDoTreino
}

export interface VagaDoTreino {
  /** O lado e a posição nele, 1 em diante: `a1`, `a2`, `b1`. */
  id: string
  lado: LadoDoTreino
  /** O id da cópia: `treino_<vaga>`. */
  personagemId: string
  /** O id do token da cópia: `treino_tok_<vaga>`. */
  tokenId: string
  /** O id da ficha de onde a cópia veio. */
  origem: string
}

/** O token da vaga, no formato que `combatentesIniciais` e `incluirCombatente` (`lib/batalha/turnos.ts`) leem. */
export interface TokenDaVaga {
  id: string
  characterId: string
  name: string
}

/** Quem luta: as vagas e as cópias. Só dados: vai a JSON (a luta pausada) e volta por `criarMesaEmMemoria`. */
export interface LutadoresDoTreino {
  vagas: readonly VagaDoTreino[]
  personagens: readonly Personagem[]
}

export type MontagemDoTreino =
  | { ok: true; lutadores: LutadoresDoTreino }
  /** `vazio` = o lado não tem ninguém; `cheio` = passou de `VAGAS_POR_LADO_MAX`. */
  | { ok: false; motivo: 'vazio' | 'cheio'; lado: LadoDoTreino }

export interface MesaEmMemoria extends MesaDaBatalha {
  /** As vagas, Lado A primeiro, na ordem da escolha. */
  vagas(): readonly VagaDoTreino[]
  /** Um token por vaga, na ordem das vagas, com o nome da cópia. */
  tokens(): readonly TokenDaVaga[]
  /** As vagas e as cópias de AGORA (com o que a luta já mudou nelas), para gravar a luta pausada. */
  lutadores(): LutadoresDoTreino
}

/** O nome que ainda não está em `usados`: o da ficha, ou com número ("Marinheiro 2", "Marinheiro 3"). */
function nomeLivre(nome: string, usados: ReadonlySet<string>): string {
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
  for (const lado of LADOS_DO_TREINO) {
    const noLado = escolhas.filter((escolha) => escolha.lado === lado).length
    if (noLado === 0) return { ok: false, motivo: 'vazio', lado }
    if (noLado > VAGAS_POR_LADO_MAX) return { ok: false, motivo: 'cheio', lado }
  }
  const vagas: VagaDoTreino[] = []
  const personagens: Personagem[] = []
  const usados = new Set<string>()
  for (const lado of LADOS_DO_TREINO) {
    let posicao = 0
    for (const { ficha, lado: ladoDaEscolha } of escolhas) {
      if (ladoDaEscolha !== lado) continue
      posicao += 1
      const id = `${lado}${posicao}`
      const personagemId = `${PREFIXO_DA_COPIA}${id}`
      const nome = nomeLivre(ficha.nome, usados)
      usados.add(nome)
      vagas.push({ id, lado, personagemId, tokenId: `${PREFIXO_DO_TOKEN}${id}`, origem: ficha.id })
      personagens.push({ ...structuredClone(ficha), id: personagemId, nome, historico: [] })
    }
  }
  return { ok: true, lutadores: { vagas, personagens } }
}

/** As duas equipes virtuais com as cópias de cada lado. */
function equipesDasVagas(vagas: readonly VagaDoTreino[]): Equipe[] {
  return LADOS_DO_TREINO.map((lado) => ({
    ...EQUIPE_DO_LADO[lado],
    membros: vagas.filter((vaga) => vaga.lado === lado).map((vaga) => vaga.personagemId),
  }))
}

/**
 * A mesa da luta, sobre os lutadores (de `montarLutadores` ou de uma luta
 * pausada) e o sistema do livro. `personagens()` devolve a mesma lista até a
 * batalha ajustar alguém; o ajuste troca a lista inteira (a de antes fica como
 * estava). Vaga sem a cópia dela (luta gravada torta) = `RangeError`: a luta
 * não começa pela metade.
 */
export function criarMesaEmMemoria(sistema: SistemaDeRpg | null, lutadores: LutadoresDoTreino): MesaEmMemoria {
  const vagas = lutadores.vagas
  const porId = new Map(lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  const tokens: readonly TokenDaVaga[] = vagas.map((vaga) => {
    const copia = porId.get(vaga.personagemId)
    if (copia === undefined) throw new RangeError(`vaga ${vaga.id} do treino sem a cópia ${vaga.personagemId}`)
    return { id: vaga.tokenId, characterId: vaga.personagemId, name: copia.nome }
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
