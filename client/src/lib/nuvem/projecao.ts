import type { Personagem } from '../personagem'
import { alvoDoCaminho, CAMPOS_DO_MESTRE, ESQUEMA_DO_CAMINHO } from './caminho'
import type { Json } from './json'
import { podeEscreverNaFicha, podeVer } from './permissao'
import type { FichaGuardada, FichaNoEstado, Membro, MembroProjetado, OpGravada, Visibilidade } from './tipos'

/**
 * PROJEÇÃO (docs/planos/lobby-jogadores-2026-11-05.md §6.4): o que o jogador
 * recebe. Ele vê TUDO dos colegas, menos os campos do mestre (dono, combate,
 * soCenario, nomeDoJogador, notaDoMestre) e o bloco de NPC da ficha Dragon
 * Ball. Mochila e moedas ficam (≠ `paraOFio`, que é só da sala LAN).
 *
 * A remoção é pelo VALOR, não só pelo caminho: a op que cria ou apaga a
 * ficha inteira leva o doc no `valor` ou no `antes`, e os dois saem
 * projetados. Lista própria (`CAMPOS_DO_MESTRE`), sem importar código de
 * `personagem.ts`, que roda também no Worker.
 */

/** A ficha sem os campos do mestre e sem o NPC da Dragon Ball; mantém mochila e moedas. Nunca muda a recebida. */
export function projetarParaJogador(doc: Personagem): Personagem {
  const copia: Personagem = { ...doc }
  for (const campo of CAMPOS_DO_MESTRE) delete copia[campo]
  if (copia.dbt !== undefined && copia.dbt.npc !== undefined) {
    // Sem a chave, como a ficha de jogador (nada de `npc: undefined`).
    const { npc: _doMestre, ...fichaPublica } = copia.dbt
    copia.dbt = fichaPublica
  }
  return copia
}

type ObjetoJson = { [chave: string]: Json }

function ehObjetoJson(valor: Json | undefined): valor is ObjetoJson {
  return valor !== undefined && valor !== null && typeof valor === 'object' && !Array.isArray(valor)
}

const CHAVES_DO_MESTRE: ReadonlySet<string> = new Set(CAMPOS_DO_MESTRE)

/** O mesmo que `projetarParaJogador`, sobre o doc em JSON do `valor`/`antes` de uma op. */
function projetarDocEmJson(valor: Json | undefined): Json | undefined {
  if (!ehObjetoJson(valor)) return valor
  const publico: ObjetoJson = Object.fromEntries(Object.entries(valor).filter(([chave]) => !CHAVES_DO_MESTRE.has(chave)))
  const dbt = publico.dbt
  if (ehObjetoJson(dbt) && Object.hasOwn(dbt, 'npc')) {
    publico.dbt = Object.fromEntries(Object.entries(dbt).filter(([chave]) => chave !== 'npc'))
  }
  return publico
}

/**
 * A op como o jogador a recebe, nos quatro pontos (`estado`, `aplicada`,
 * `historico`, `exportar`). `null` = não vai: ficha fora da mesa, ou campo
 * do mestre (o jogador vê um buraco na numeração das revs, de propósito).
 * Na ficha inteira (`[]`), `valor` e `antes` saem projetados.
 */
export function projetarOpParaJogador(op: OpGravada, visivel: Visibilidade): OpGravada | null {
  // v1: só a mesa. A projeção do treino (inimigo liberado) entra na T8.
  if (visivel !== 'mesa') return null
  const alvo = alvoDoCaminho(op.caminho)
  if (alvo === null || !ESQUEMA_DO_CAMINHO[alvo.regra].visivelAoJogador) return null
  if (alvo.regra !== 'ficha') return op
  const projetada: OpGravada = { ...op }
  const valor = projetarDocEmJson(op.valor)
  const antes = projetarDocEmJson(op.antes)
  if (valor !== undefined) projetada.valor = valor
  if (antes !== undefined) projetada.antes = antes
  return projetada
}

/**
 * A ficha no `estado` para quem a recebe; `null` = não vê. Para o jogador,
 * o doc vai projetado. `ehMinha` = quem recebe pode editá-la (dono, ou o
 * mestre); `nomeDoDono` = `null` na ficha sem dono.
 */
export function fichaNoEstado(eu: Membro, ficha: FichaGuardada, nomeDaConta: (contaId: string) => string | null): FichaNoEstado | null {
  if (!podeVer(eu.papel, ficha) || ficha.apagada) return null
  const dono = ficha.doc.dono
  return {
    doc: eu.papel === 'mestre' ? ficha.doc : projetarParaJogador(ficha.doc),
    visivel: ficha.visivel,
    rev: ficha.rev,
    ehMinha: podeEscreverNaFicha(eu, ficha),
    nomeDoDono: dono === undefined ? null : nomeDaConta(dono),
  }
}

/** Os membros como o jogador os vê: só os ativos, sem e-mail (só `/api/eu` devolve o próprio). */
export function projetarMembros(membros: readonly Membro[]): MembroProjetado[] {
  return membros.filter((membro) => membro.estado === 'ativo').map(({ contaId, nome, papel }) => ({ contaId, nome, papel }))
}
