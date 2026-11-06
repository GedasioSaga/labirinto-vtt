import { aplicar, aplicarOp } from '../../lib/nuvem/aplicar'
import { diferencas } from '../../lib/nuvem/diferencas'
import type { RemotasRecebidas } from '../../lib/nuvem/fila'
import { ehCopiaDeTreino } from '../../lib/nuvem/projecao'
import type { Mudanca, OpGravada } from '../../lib/nuvem/tipos'
import type { Personagem } from '../../lib/personagem'
import { mudancasDaPasta, vaiAoLobby } from './emissor'
import type { BaseGuardada } from './estadoNoDisco'

/**
 * O ACERTO ENTRE A NUVEM E AS FICHAS DO APP (docs/planos/lobby-jogadores-2026-11-05.md
 * §5.5-5.6, fatia A5). Puro.
 *
 * - A BASE CONFIRMADA anda com as ops que o servidor confirmou, na ordem da
 *   rev, exatamente como a base de dentro da fila (`receberRemotas`): é ela
 *   que vai para o `base.json` e de onde a fila abre (8.1.1, item 3).
 * - A VISTA (base + ops locais) é o que a tela mostra. Quando ela muda (op
 *   remota, conflito, "Desfazer aqui"), só a DIFERENÇA entre a vista de antes
 *   e a de depois entra nas fichas do app: o campo que o mestre mexeu e ainda
 *   não chegou à fila não volta atrás.
 * - O `rpg.json` (gravador leve, e ao abrir) é ACERTADO com a vista ficha a
 *   ficha, por diferença, o que é idempotente: o que já está lá não entra de
 *   novo (a soma pendente nunca dobra). O que a nuvem não conhece fica como
 *   está: a foto embutida (Si7), o `historico`, as fichas de NPC e a ficha que
 *   nunca subiu.
 * - A CÓPIA DE TREINO (`treino_<id>`, T8) volta pelo `desde` como qualquer
 *   op e fica na base e no diário, mas nunca entra nas fichas do app: o NPC
 *   de verdade já está na pasta, e a cópia viraria um personagem a mais.
 */

// ── A base confirmada ───────────────────────────────────────────────────────

export interface BaseDaNuvem {
  readonly rev: number
  readonly fichas: ReadonlyMap<string, Personagem>
  readonly apagadas: ReadonlySet<string>
}

export function baseDaGuardada(guardada: BaseGuardada): BaseDaNuvem {
  return { rev: guardada.rev, fichas: new Map(guardada.fichas.map((doc): [string, Personagem] => [doc.id, doc])), apagadas: new Set(guardada.apagadas) }
}

export function guardadaDaBase(base: BaseDaNuvem): BaseGuardada {
  return { rev: base.rev, fichas: [...base.fichas.values()], apagadas: [...base.apagadas] }
}

export type AvancoDaBase = { t: 'buraco' } | { t: 'ok'; base: BaseDaNuvem; novas: OpGravada[] }

/**
 * A base com as ops confirmadas: as que vêm depois dela, até `ate`, em ordem
 * de rev (a mesma regra de `receberRemotas` da fila, para as duas andarem
 * juntas). `novas` = as que entraram, para o diário.
 */
export function avancarBase(base: BaseDaNuvem, remotas: RemotasRecebidas): AvancoDaBase {
  if (remotas.desde > base.rev) return { t: 'buraco' }
  const fichas = new Map(base.fichas)
  const apagadas = new Set(base.apagadas)
  const novas: OpGravada[] = []
  let ultima = base.rev
  for (const op of [...remotas.lista].sort((a, b) => a.rev - b.rev)) {
    if (op.rev <= ultima || op.rev > remotas.ate) continue
    ultima = op.rev
    novas.push(op)
    const aplicada = aplicarOp(fichas.get(op.fichaId) ?? null, op)
    if (!aplicada.ok) continue
    if (aplicada.doc === null) {
      fichas.delete(op.fichaId)
      apagadas.add(op.fichaId)
    } else {
      fichas.set(op.fichaId, aplicada.doc)
      apagadas.delete(op.fichaId)
    }
  }
  return { t: 'ok', base: { rev: Math.max(base.rev, remotas.ate), fichas, apagadas }, novas }
}

/** A nuvem conhece (ou conheceu) a ficha: o app pode tirá-la quando a vista não a tem mais. */
export function nuvemConhece(base: BaseDaNuvem, fichaId: string): boolean {
  return base.fichas.has(fichaId) || base.apagadas.has(fichaId)
}

// ── Diferença entre vistas ──────────────────────────────────────────────────

/** O que mudou da vista de antes para a de depois, ficha a ficha, por campo. */
export function mudancasEntreVistas(antes: ReadonlyMap<string, Personagem>, depois: ReadonlyMap<string, Personagem>): Mudanca[] {
  const ids = new Set([...antes.keys(), ...depois.keys()])
  return [...ids].flatMap((id) => {
    const deAntes = antes.get(id) ?? null
    const deDepois = depois.get(id) ?? null
    return deAntes === deDepois ? [] : diferencas(deAntes, deDepois)
  })
}

/** A vista com estas ops por cima (para desfazer no app o que a fila não aceitou). */
export function vistaComOps(vista: ReadonlyMap<string, Personagem>, ops: readonly Mudanca[]): Map<string, Personagem> {
  const nova = new Map(vista)
  const porFicha = new Map<string, Mudanca[]>()
  for (const op of ops) porFicha.set(op.fichaId, [...(porFicha.get(op.fichaId) ?? []), op])
  for (const [fichaId, mudancas] of porFicha) {
    const doc = aplicar(nova.get(fichaId) ?? null, mudancas).doc
    if (doc === null) nova.delete(fichaId)
    else nova.set(fichaId, doc)
  }
  return nova
}

// ── Nas fichas do app ───────────────────────────────────────────────────────

function porFicha(mudancas: readonly Mudanca[]): Map<string, Mudanca[]> {
  const grupos = new Map<string, Mudanca[]>()
  for (const mudanca of mudancas) grupos.set(mudanca.fichaId, [...(grupos.get(mudanca.fichaId) ?? []), mudanca])
  return grupos
}

/**
 * As mudanças da nuvem nas fichas do app, na ordem da lista; ficha nova vai
 * para o fim. A ficha local que não vai ao Lobby (virou NPC, é invocação) não
 * é tocada. `null` = nada mudou.
 */
export function aplicarNasFichasDoApp(locais: readonly Personagem[], mudancas: readonly Mudanca[]): Personagem[] | null {
  if (mudancas.length === 0) return null
  let lista = [...locais]
  let mudou = false
  for (const [fichaId, daFicha] of porFicha(mudancas)) {
    if (ehCopiaDeTreino(fichaId)) continue
    const indice = lista.findIndex((ficha) => ficha.id === fichaId)
    const local = indice === -1 ? null : lista[indice]
    if (local !== null && !vaiAoLobby(local)) continue
    const resultado = aplicar(local, daFicha).doc
    if (resultado === local) continue
    mudou = true
    if (resultado === null) lista = lista.filter((ficha) => ficha.id !== fichaId)
    else if (indice === -1) lista.push(resultado)
    else lista[indice] = resultado
  }
  return mudou ? lista : null
}

/**
 * As fichas do app acertadas com a vista inteira (o gravador leve e a
 * reabertura). Idempotente: rodar duas vezes dá o mesmo. `null` = já estavam certas.
 * - ficha do Lobby na vista: o que difere na parte que a nuvem conhece passa a ser o da vista;
 * - ficha do Lobby fora da vista que a nuvem conhecia: sai (foi apagada);
 * - ficha da vista que o app não tem: entra no fim;
 * - o resto (NPC, invocação, ficha que nunca subiu): fica.
 */
export function acertarComAVista(locais: readonly Personagem[], vista: ReadonlyMap<string, Personagem>, conhece: (fichaId: string) => boolean): Personagem[] | null {
  let mudou = false
  const lista: Personagem[] = []
  const idsLocais = new Set<string>()
  for (const local of locais) {
    idsLocais.add(local.id)
    if (!vaiAoLobby(local)) {
      lista.push(local)
      continue
    }
    const naVista = vista.get(local.id)
    if (naVista === undefined) {
      if (conhece(local.id)) mudou = true
      else lista.push(local)
      continue
    }
    const mudancas = mudancasDaPasta([local], [naVista])
    const acertada = mudancas.length === 0 ? local : (aplicar(local, mudancas).doc ?? local)
    if (acertada !== local) mudou = true
    lista.push(acertada)
  }
  for (const [fichaId, doc] of vista) {
    if (idsLocais.has(fichaId) || ehCopiaDeTreino(fichaId)) continue
    lista.push(doc)
    mudou = true
  }
  return mudou ? lista : null
}
