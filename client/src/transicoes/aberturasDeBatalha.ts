import { cenaConferida, isTransicaoId, NOME_DE_TRANSICAO_MAX } from './catalogo'
import type { CriarCena, OpcoesDaCena, ThreeModule } from './tipos'

/**
 * Registro das ABERTURAS DE BATALHA: a animação curta que toca quando a
 * batalha começa (a primeira é "Espadas cruzadas", com o nome dos vilões).
 * Todas chegam pelo pacote de animações (`lib/pacoteDeAnimacoes.ts`, tipo
 * `batalha`, fontes em `src/animacoes/batalha/`); não há embutida.
 *
 * O contrato da cena é o mesmo das transições de local (`CriarCena` de
 * `tipos.ts`), e o motor as toca com `tocarAberturaDeBatalha` (`motor.ts`),
 * que passa `nome` em `OpcoesDaCena`. Como o catálogo das transições, este
 * arquivo não importa `three` em tempo de execução.
 */

/** Abertura é curta: mais que isso prende a mesa antes do primeiro turno. */
export const ABERTURA_DURACAO_MIN_S = 1
export const ABERTURA_DURACAO_MAX_S = 10

export interface AberturaDeBatalhaInfo {
  id: string
  nome: string
  duracaoNaturalS: number
  /** Momento (em segundos da cena) usado como miniatura na escolha. */
  quadroDaMiniaturaS: number
}

interface AberturaDeFora extends AberturaDeBatalhaInfo {
  criar: CriarCena
}

const NENHUMA: readonly AberturaDeFora[] = []
/** A referência só muda quando o registro muda (serve de `getSnapshot`). */
let aberturas: readonly AberturaDeFora[] = NENHUMA
const ouvintes = new Set<() => void>()

export function isDuracaoDeAberturaValida(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= ABERTURA_DURACAO_MIN_S && valor <= ABERTURA_DURACAO_MAX_S
}

/** Todas as aberturas, na ordem em que chegaram, para a escolha do mestre. */
export function listarAberturasDeBatalha(): readonly AberturaDeBatalhaInfo[] {
  return aberturas
}

/** Avisa quando uma abertura entra ou sai do registro. Devolve o cancelamento. */
export function assinarAberturasDeBatalha(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** A abertura do id, ou `undefined` = este app não a tem (pacote ainda não baixado). */
export function aberturaDeBatalhaInfo(id: string): AberturaDeBatalhaInfo | undefined {
  return aberturas.find((abertura) => abertura.id === id)
}

/** A fábrica da cena da abertura, ou `null` se este app não a tem. */
export function criarCenaDaAbertura(id: string): CriarCena | null {
  return aberturas.find((abertura) => abertura.id === id)?.criar ?? null
}

function trocar(novas: readonly AberturaDeFora[]): void {
  aberturas = novas.length === 0 ? NENHUMA : novas
  for (const ouvinte of ouvintes) ouvinte()
}

/** Tira todas (o pacote novo substitui o anterior inteiro). */
export function esquecerAberturasDeBatalhaDeFora(): void {
  if (aberturas.length === 0) return
  trocar(NENHUMA)
}

/**
 * Registra uma abertura vinda do pacote. Confere tudo em tempo de execução e
 * recusa, devolvendo `false`, o que não tem a forma do contrato; o mesmo id de
 * novo substitui o anterior (versão nova do pacote). O `criar` de fora é
 * chamado por `Reflect.apply`, como no catálogo das transições, e a cena que
 * ele devolve passa pela mesma conferência (`cenaConferida`).
 */
export function registrarAberturaDeBatalha(info: unknown): boolean {
  if (typeof info !== 'object' || info === null) return false
  if (!('id' in info) || !isTransicaoId(info.id)) return false
  const id = info.id
  if (!('nome' in info) || typeof info.nome !== 'string') return false
  const nome = info.nome.trim()
  if (nome === '' || nome.length > NOME_DE_TRANSICAO_MAX) return false
  if (!('duracaoNaturalS' in info) || !isDuracaoDeAberturaValida(info.duracaoNaturalS)) return false
  const duracaoNaturalS = info.duracaoNaturalS
  const quadro = 'quadroDaMiniaturaS' in info ? info.quadroDaMiniaturaS : undefined
  if (typeof quadro !== 'number' || !Number.isFinite(quadro) || quadro < 0 || quadro > duracaoNaturalS) return false
  if (!('criar' in info) || typeof info.criar !== 'function') return false
  const criarDeFora = info.criar
  const abertura: AberturaDeFora = {
    id,
    nome,
    duracaoNaturalS,
    quadroDaMiniaturaS: quadro,
    criar: (THREE: ThreeModule, opcoes: OpcoesDaCena) => cenaConferida(Reflect.apply(criarDeFora, undefined, [THREE, opcoes]), THREE, id),
  }
  trocar([...aberturas.filter((existente) => existente.id !== id), abertura])
  return true
}
