/**
 * VERSÕES DENTRO DO OBJETO (I0-a do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): o mesmo
 * tipo com outra FORMA ou outro ESTADO (aberto, alagado, quebrado, com neve, a cor da chama), escolhido no painel do
 * objeto clicado ("Versão"). Um campo só no mapa, `Prop.mobiliaVersao`, para todo tipo desta tabela: tipo novo com
 * versões entra numa linha aqui e num arquivo de desenho (`texturas/meioTermo/moveis/versoes/<tipo>Versoes.ts`),
 * sem os 9 pontos de código por tipo da cova e da ponte.
 *
 * Regras (as mesmas de `mobiliaForma`):
 *
 * - a 1ª opção é a de partida, o desenho de hoje: o mapa não a grava (ausente = a 1ª);
 * - versão que o tipo não conhece (texto torto, versão futura, a de outro tipo) some na leitura e na travessia;
 * - trocar a versão não mexe na pegada (o mestre pode ter esticado), então toda versão tem a pegada do tipo.
 *
 * Sem import de Pixi nem de `types/map.ts`: só a lista de tipos (`tipos.ts`, que não importa nada), sem ciclo.
 */
import type { TipoMobilia } from './tipos'

export interface OpcaoDeVersao {
  /** O que o mapa grava (e a chave do desenho em `moveis/versoes/<tipo>Versoes.ts`). */
  readonly id: string
  /** O nome no botão do painel. */
  readonly nome: string
}

export interface VersoesDoMovel {
  /** O nome do campo no painel. */
  readonly rotulo: string
  /** A ordem do painel; a 1ª é a de partida (o desenho de hoje, sem campo no mapa). */
  readonly opcoes: readonly [OpcaoDeVersao, OpcaoDeVersao, ...OpcaoDeVersao[]]
}

/**
 * Os tipos com versão, e as versões de cada um. O desenho de cada versão que não é a 1ª mora em
 * `VERSOES_DESENHADAS` (`texturas/meioTermo/moveis/versoes/index.ts`), com o mesmo id.
 */
export const VERSOES_DO_MOVEL: Readonly<Partial<Record<TipoMobilia, VersoesDoMovel>>> = {
  // O lóculo da cripta (L05 de 24/11/2026): a laje inteira ou partida, com os ossos à vista. Desenhado desde 24/11,
  // sem botão até o I0-a.
  nichoFunerario: { rotulo: 'Versão', opcoes: [{ id: 'fechado', nome: 'Fechado' }, { id: 'aberto', nome: 'Aberto' }] },
  // O templo da selva (L08 de 24/11/2026): os degraus secos ou cada um virando tanque raso.
  piramideEmDegraus: { rotulo: 'Versão', opcoes: [{ id: 'seca', nome: 'Seca' }, { id: 'alagada', nome: 'Alagada' }] },
}

/** As versões do tipo (`undefined` = o tipo não tem versão, e o painel não mostra o campo). */
export function versoesDoMovel(tipo: TipoMobilia | undefined): VersoesDoMovel | undefined {
  return tipo === undefined ? undefined : VERSOES_DO_MOVEL[tipo]
}

/** A versão gravada que o tipo aceita: só um id da tabela que não seja o 1º. O resto (o 1º, texto torto, outro tipo) vira `undefined`. */
export function normalizarVersaoDoMovel(tipo: TipoMobilia | undefined, valor: unknown): string | undefined {
  const versoes = versoesDoMovel(tipo)
  if (versoes === undefined || typeof valor !== 'string' || valor === versoes.opcoes[0].id) return undefined
  return versoes.opcoes.some((opcao) => opcao.id === valor) ? valor : undefined
}

/** A versão que vale (a gravada ou a 1ª); `undefined` só no tipo sem versão. */
export function versaoEmVigor(tipo: TipoMobilia | undefined, valor: unknown): string | undefined {
  const versoes = versoesDoMovel(tipo)
  if (versoes === undefined) return undefined
  return normalizarVersaoDoMovel(tipo, valor) ?? versoes.opcoes[0].id
}
