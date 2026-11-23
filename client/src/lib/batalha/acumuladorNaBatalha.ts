import type { CartaoDaFicha, Personagem } from '../personagem'
import type { CombateDoPersonagem } from './combate'
import { mesmaReferencia } from './requisitos/contexto'
import { lerAcumulador } from './requisitos/ler'
import type { AcumuladorDaFicha, Referencia } from './requisitos/modelo'

/**
 * REQUISITOS, fase B3: o NÍVEL de cada acumulador genérico na batalha (Polaridade, Fúria, Cargas).
 * A definição mora no cartão (`CartaoDaFicha.acumulador`, lida por `lerAcumulador`); o nível de
 * agora mora no combate (`CombateDoPersonagem.acumuladores`, id → nível) e volta no Desfazer pela
 * parte "combate" da linha, por delta (`combateSemALinha`).
 *
 * Aqui: ler as definições da ficha, ler e mudar o nível (de 0 ao máximo) e as regras de subir e de
 * cair que o motor já sabe disparar (acerta, apanha, usa a técnica, derruba, esquiva). Ainda não:
 * "gasta a reação", "gasta SP", "começo da vez", "rodada sem uso" (sem gancho no motor ainda), o
 * ganho por nível no golpe e o "gasta" do requisito A4 (fase C, `gastos.ts`).
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** O que aconteceu com a ficha, para as regras de subir e de cair. */
export type EventoDoAcumulador =
  | { quando: 'acerta' }
  | { quando: 'apanha' }
  | { quando: 'usaTecnica'; tecnica: Referencia }
  | { quando: 'derruba' }
  | { quando: 'esquiva' }

/** As definições de acumulador nos cartões da ficha (abas e subcartões), uma por id (a primeira vale). Torta = de fora. */
export function acumuladoresDoPersonagem(personagem: Pick<Personagem, 'abas'>): AcumuladorDaFicha[] {
  const achados = new Map<string, AcumuladorDaFicha>()
  const ler = (cartao: CartaoDaFicha): void => {
    if (cartao.acumulador !== undefined) {
      const lido = lerAcumulador(cartao.acumulador).acumulador
      if (lido !== null && !achados.has(lido.id)) achados.set(lido.id, lido)
    }
    cartao.subcartoes.forEach(ler)
  }
  for (const cartoes of Object.values(personagem.abas)) cartoes.forEach(ler)
  return [...achados.values()]
}

/** O nível de agora (fora do mapa = 0). */
export function nivelDoAcumulador(combate: CombateDoPersonagem | undefined, acumuladorId: string): number {
  const niveis = combate?.acumuladores
  return niveis !== undefined && Object.hasOwn(niveis, acumuladorId) ? (niveis[acumuladorId] ?? 0) : 0
}

/** O combate com o nível somado de `delta`, entre 0 e o máximo; 0 sai do mapa. Nada muda = o MESMO combate. */
export function comNivelSomado(combate: CombateDoPersonagem, acumulador: Pick<AcumuladorDaFicha, 'id' | 'maximo'>, delta: number): CombateDoPersonagem {
  const antes = nivelDoAcumulador(combate, acumulador.id)
  const depois = Math.min(acumulador.maximo, Math.max(0, antes + Math.trunc(delta)))
  if (depois === antes) return combate
  const { [acumulador.id]: _fora, ...outros } = combate.acumuladores ?? {}
  const niveis = depois === 0 ? outros : { ...outros, [acumulador.id]: depois }
  const { acumuladores: _niveis, ...resto } = combate
  return Object.keys(niveis).length === 0 ? resto : { ...resto, acumuladores: niveis }
}

/** Quanto o evento sobe (as regras de subir) menos quanto desce (as de cair) num acumulador. "tudo" = o nível inteiro. */
function deltaDoEvento(acumulador: AcumuladorDaFicha, nivel: number, evento: EventoDoAcumulador): number {
  let delta = 0
  for (const regra of acumulador.sobe) {
    if (regra.quando !== evento.quando) continue
    if (regra.quando === 'usaTecnica' && (evento.quando !== 'usaTecnica' || !mesmaReferencia(regra.tecnica, evento.tecnica))) continue
    delta += regra.quanto
  }
  for (const regra of acumulador.desce) {
    if (evento.quando !== 'apanha' || regra.quando !== 'apanha') continue
    delta -= regra.quanto === 'tudo' ? nivel + Math.max(0, delta) : regra.quanto
  }
  return delta
}

/** O combate com as regras de todos os acumuladores da ficha aplicadas ao evento. Nada muda = o MESMO combate. */
export function comOEventoNosAcumuladores(combate: CombateDoPersonagem, definicoes: readonly AcumuladorDaFicha[], evento: EventoDoAcumulador): CombateDoPersonagem {
  let volta = combate
  for (const acumulador of definicoes) {
    const delta = deltaDoEvento(acumulador, nivelDoAcumulador(volta, acumulador.id), evento)
    if (delta !== 0) volta = comNivelSomado(volta, acumulador, delta)
  }
  return volta
}
