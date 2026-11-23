import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { rolarDisputa, textoDaDisputa, type FichaNaDisputa, type ResultadoDaDisputa } from '../disputa'
import { normalizar } from '../formula'
import type { Referencia } from './modelo'
import type { RequisitoDeTeste } from './portao'

/**
 * REQUISITOS, fase D (§6 do plano, H1 e H2): o host ROLA os testes dos requisitos na hora do pedido,
 * com a máquina da disputa que o app já usa (`disputa.ts`: d20 + o modificador do atributo, metade do
 * rank, com os selos; contra a CD, passa com o total igual ou acima; contra o d20 do alvo, só vencendo).
 * O resultado vai ao portão (`testes`) e o texto ao registro.
 *
 * Puro: o d20 entra por parâmetro, sem store, sem rede.
 */

/** Um teste rolado: passou, o que fazer se falhou e o texto do registro ("Percepção: teste d20 12+2 = 14 contra CD 15, falhou"). */
export interface TesteRolado {
  requisitoId: string
  passou: boolean
  seFalhar: RequisitoDeTeste['seFalhar']
  texto: string
}

export interface ContextoDosTestes {
  /** Quem usa, com os selos dele agora. */
  quemUsa: FichaNaDisputa
  /** O primeiro alvo do pedido (H2); `null` = sem alvo com ficha (a disputa falha). */
  alvo: FichaNaDisputa | null
  sistema: SistemaDeRpg
  rolarD20: () => number
}

/** O atributo do sistema pela referência: o id, senão o nome ou a abreviação. `null` = o sistema não tem (rola o d20 puro). */
export function atributoDoTeste(sistema: SistemaDeRpg, ref: Referencia): string | null {
  const porId = ref.id === undefined ? undefined : sistema.atributos.find((atributo) => atributo.id === ref.id)
  if (porId !== undefined) return porId.id
  const nome = normalizar(ref.nome)
  return sistema.atributos.find((atributo) => normalizar(atributo.nome) === nome || normalizar(atributo.abreviacao) === nome)?.id ?? null
}

function resultado(teste: RequisitoDeTeste, ctx: ContextoDosTestes): ResultadoDaDisputa | null {
  const atributoId = atributoDoTeste(ctx.sistema, teste.atributo)
  if (teste.tipo === 'teste') {
    // A CD é a do requisito; a carga não muda CD fixa.
    return rolarDisputa({ rola: { atributoId }, contra: { tipo: 'cd', cd: { tipo: 'fixa', cd: teste.cd } } }, { testa: ctx.quemUsa, usa: ctx.quemUsa, resiste: ctx.quemUsa }, ctx.sistema, 0, ctx.rolarD20)
  }
  if (ctx.alvo === null) return null
  const doAlvo = teste.doAlvo === undefined ? atributoId : atributoDoTeste(ctx.sistema, teste.doAlvo)
  return rolarDisputa({ rola: { atributoId }, contra: { tipo: 'rolagem', quem: { atributoId: doAlvo } } }, { testa: ctx.quemUsa, usa: ctx.quemUsa, resiste: ctx.alvo }, ctx.sistema, 0, ctx.rolarD20)
}

/** Rola cada teste, na ordem do bloco. A disputa sem alvo com ficha não rola e falha. */
export function rolarOsTestes(testes: readonly RequisitoDeTeste[], ctx: ContextoDosTestes): TesteRolado[] {
  return testes.map((teste): TesteRolado => {
    const rolado = resultado(teste, ctx)
    const passou = rolado !== null && rolado.passou
    const como = rolado === null ? 'disputa sem alvo com ficha' : textoDaDisputa(rolado)
    return { requisitoId: teste.id, passou, seFalhar: teste.seFalhar, texto: `${teste.atributo.nome.trim() || 'teste'}: ${como}, ${passou ? 'passou' : 'falhou'}` }
  })
}

/** O mapa que o portão lê (id do requisito → passou). */
export function testesDoPortao(rolados: readonly TesteRolado[]): Record<string, boolean> {
  return Object.fromEntries(rolados.map((rolado) => [rolado.requisitoId, rolado.passou]))
}

/** Algum teste falhou com "perde a ação": a ação e o custo vão, a ação não sai. */
export function perdeAAcaoNosTestes(rolados: readonly TesteRolado[]): boolean {
  return rolados.some((rolado) => !rolado.passou && rolado.seFalhar === 'perdeAAcao')
}

/** O texto dos testes para a linha: "(Percepção: teste d20 12+2 = 14 contra CD 15, passou)". */
export function textoDosTestes(rolados: readonly TesteRolado[]): string {
  return `(${rolados.map((rolado) => rolado.texto).join('; ')})`
}
