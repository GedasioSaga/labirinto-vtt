import type { CartaoDaFicha } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { FORMULA_DO_ATAQUE, formulaDoAtaque } from '../formula'
import { formaDoAlcanceGuardada } from '../alcanceDoCartao'
import { VERSAO_GRAVADA, type AlvoDaMecanica, type Custo, type DanoDaMecanica, type Efeito, type Limite, type MecanicaV1 } from './modelo'

/**
 * OS 20 MODELOS DE ARMA (docs/design/habilidades/ARMAS-FONTE-UNICA.md §5): o
 * "O que ela faz" da arma começa por um deles, como o item começa pelos dele
 * (`modelosDeItem.ts`). Todos cabem no Atacar com arma (`motivoDaArmaNasPecas`):
 * inimigo, 1 ou vários marcados na mira, reação normal ou não erra, custo só
 * ao usar, sem Overload. "Dano" = o Dano da arma pela fórmula do Atacar dela.
 *
 * Os ids `atordoa` e `golpeComSelo` ficam (o `scripts/conserto-fichas-f0.cjs`
 * copia o `atordoa`, e o Boomerang do Vincent é ele). Nomes originais.
 *
 * Puro: sem store, sem rede.
 */

export type IdDoModeloDaArma =
  | 'atordoa'
  | 'golpeComSelo'
  | 'laminaQueSangra'
  | 'pontaEmBrasa'
  | 'punhadoDeAreia'
  | 'miraDoCacador'
  | 'descargaParalisante'
  | 'redeDePesca'
  | 'golpeNaFresta'
  | 'furaCouraca'
  | 'golpeEVolta'
  | 'arcoLargo'
  | 'lequeDeLaminas'
  | 'laminaSedenta'
  | 'tiroCerteiro'
  | 'golpePesado'
  | 'precoDeSangue'
  | 'cacadaAoMarcado'
  | 'pancadaAtordoante'
  | 'poCeganteECorte'

/** Os grupos do degrau 1 da arma (§5 do plano). */
export type GrupoDoModeloDaArma = 'semDano' | 'golpeESelo' | 'golpeForte' | 'varios'

export const GRUPOS_DOS_MODELOS_DA_ARMA: readonly { grupo: GrupoDoModeloDaArma; nome: string }[] = [
  { grupo: 'semDano', nome: 'Sem dano' },
  { grupo: 'golpeESelo', nome: 'Golpe e selo' },
  { grupo: 'golpeForte', nome: 'Golpe forte' },
  { grupo: 'varios', nome: 'Vários' },
]

export interface ModeloDaArma {
  id: IdDoModeloDaArma
  /** O número da tabela do plano (A01 a A20). */
  numero: string
  nome: string
  /** O que ele monta, numa frase (a dica do botão). */
  dica: string
  grupo: GrupoDoModeloDaArma
}

export const MODELOS_DA_ARMA: readonly ModeloDaArma[] = [
  { id: 'atordoa', numero: 'A01', nome: 'Atordoa sem dano', dica: 'Se acertar, Atordoado. 3 por batalha', grupo: 'semDano' },
  { id: 'punhadoDeAreia', numero: 'A05', nome: 'Punhado de Areia', dica: 'Sem dano: Cego no acerto. 2 por batalha', grupo: 'semDano' },
  { id: 'redeDePesca', numero: 'A08', nome: 'Rede de Pesca', dica: 'Sem dano: Paralisado por 2. 1 por batalha', grupo: 'semDano' },
  { id: 'golpeComSelo', numero: 'A02', nome: 'Golpe com efeito', dica: 'Dano e Sangrando no acerto. 2 por batalha', grupo: 'golpeESelo' },
  { id: 'laminaQueSangra', numero: 'A03', nome: 'Lâmina que Sangra', dica: 'Todo acerto deixa Sangrando', grupo: 'golpeESelo' },
  { id: 'pontaEmBrasa', numero: 'A04', nome: 'Ponta em Brasa', dica: 'Dano e Queimando; espera 2 vezes', grupo: 'golpeESelo' },
  { id: 'miraDoCacador', numero: 'A06', nome: 'Mira do Caçador', dica: 'Dano e Marcado por 3 vezes', grupo: 'golpeESelo' },
  { id: 'descargaParalisante', numero: 'A07', nome: 'Descarga Paralisante', dica: 'Dano e Paralisado. 1 por batalha', grupo: 'golpeESelo' },
  { id: 'precoDeSangue', numero: 'A17', nome: 'Preço de Sangue', dica: 'Custa 10 de vida; dano e Sangrando', grupo: 'golpeESelo' },
  { id: 'pancadaAtordoante', numero: 'A19', nome: 'Pancada Atordoante', dica: 'Dano e Atordoado; espera 3 vezes', grupo: 'golpeESelo' },
  { id: 'poCeganteECorte', numero: 'A20', nome: 'Pó Cegante e Corte', dica: 'Dano, Sangrando e Cego. 1 por batalha', grupo: 'golpeESelo' },
  { id: 'golpeNaFresta', numero: 'A09', nome: 'Golpe na Fresta', dica: 'Perfurante: vai direto à vida. 2 por batalha', grupo: 'golpeForte' },
  { id: 'furaCouraca', numero: 'A10', nome: 'Fura-Couraça', dica: 'Metade do dano vai direto à vida', grupo: 'golpeForte' },
  { id: 'golpeEVolta', numero: 'A11', nome: 'Golpe e Volta', dica: 'Dois golpes: o 2º com metade do dano', grupo: 'golpeForte' },
  { id: 'laminaSedenta', numero: 'A14', nome: 'Lâmina Sedenta', dica: '30% do dano volta como vida. 3 por batalha', grupo: 'golpeForte' },
  { id: 'tiroCerteiro', numero: 'A15', nome: 'Tiro Certeiro', dica: 'Não erra. 1 por batalha', grupo: 'golpeForte' },
  { id: 'golpePesado', numero: 'A16', nome: 'Golpe Pesado', dica: 'Custa 20 SP; perfurante', grupo: 'golpeForte' },
  { id: 'cacadaAoMarcado', numero: 'A18', nome: 'Caçada ao Marcado', dica: 'Só vale em quem está Marcado; perfurante', grupo: 'golpeForte' },
  { id: 'arcoLargo', numero: 'A12', nome: 'Arco Largo', dica: 'Até 3 inimigos marcados na mira. 2 por batalha', grupo: 'varios' },
  { id: 'lequeDeLaminas', numero: 'A13', nome: 'Leque de Lâminas', dica: 'Até 3 inimigos, o dano dividido', grupo: 'varios' },
]

/**
 * A fórmula do golpe da arma: a mesma do Atacar com ela, o "Soma no ataque"
 * dela mais o Dano da arma (a Rosa Fúnebre soma Percepção, não Força). Sem a
 * arma em mãos, a do Atacar de sempre (Força + Dano da arma).
 */
function formulaDaArma(sistema: SistemaDeRpg, arma: CartaoDaFicha | undefined): string {
  return arma === undefined ? FORMULA_DO_ATAQUE : formulaDoAtaque(arma, sistema)
}

/** Até quantos inimigos o "Vários" marca na mira (A12, A13). */
const ALVOS_DO_VARIOS = 3
/** A parte que vai direto à vida no Fura-Couraça (A10), em %. */
const PERFURACAO_DO_FURA_COURACA = 50
/** O 2º golpe do Golpe e Volta (A11): metade do dano. */
const FRACAO_DO_SEGUNDO_GOLPE = 0.5
/** A parte do dano que volta como vida na Lâmina Sedenta (A14), em %. */
const DRENO_DA_LAMINA_SEDENTA = 30
/** O custo do Golpe Pesado (A16) e do Preço de Sangue (A17). */
const SP_DO_GOLPE_PESADO = 20
const HP_DO_PRECO_DE_SANGUE = 10

function selo(nome: string, duracao: number): Efeito {
  return { tipo: 'selo', nome, duracao, natureza: 'debuff' }
}

const usos = (usosPorBatalha: number): Limite => ({ usosPorBatalha })
const recarga = (vezes: number): Limite => ({ recarga: vezes })
const custoAoUsar = (recurso: Custo['recurso'], fixo: number): Custo => ({ recurso, quanto: { fixo }, quando: 'aoUsar' })

/**
 * Fase G do alcance (ALCANCE.md §8, "Modelos ganham alcance de fábrica"): até onde o golpe
 * do modelo chega quando a arma não diz o dela. Corpo a corpo = 1; o que se atira (areia,
 * rede, lâminas, a descarga) vai um pouco mais longe; a mira e o tiro, longe.
 */
const ALCANCE_DO_MODELO_DA_ARMA: Readonly<Record<IdDoModeloDaArma, number>> = {
  atordoa: 1,
  golpeComSelo: 1,
  laminaQueSangra: 1,
  pontaEmBrasa: 1,
  punhadoDeAreia: 2,
  miraDoCacador: 6,
  descargaParalisante: 2,
  redeDePesca: 3,
  golpeNaFresta: 1,
  furaCouraca: 1,
  golpeEVolta: 1,
  arcoLargo: 1,
  lequeDeLaminas: 3,
  laminaSedenta: 1,
  tiroCerteiro: 8,
  golpePesado: 1,
  precoDeSangue: 1,
  cacadaAoMarcado: 1,
  pancadaAtordoante: 1,
  poCeganteECorte: 1,
}

/**
 * O alcance do golpe do modelo: o da própria arma, quando ela tem o campo `alcance` de um alvo
 * (o anel vai junto), senão o de fábrica do modelo. A arma montada só aceita o alvo (`arma.ts`).
 */
function alcanceDoModelo(id: IdDoModeloDaArma, arma: CartaoDaFicha | undefined): Pick<AlvoDaMecanica, 'alcance' | 'alcanceMinimo'> {
  const daArma = arma?.alcance === undefined ? null : formaDoAlcanceGuardada(arma.alcance)
  if (daArma === null || daArma.tipo !== 'alvo') return { alcance: ALCANCE_DO_MODELO_DA_ARMA[id] }
  return daArma.de === undefined ? { alcance: daArma.ate } : { alcance: daArma.ate, alcanceMinimo: daArma.de }
}

/** `arma`: a arma em que o modelo vai (o editor passa o cartão); o golpe soma o que ela soma no Atacar. */
export function mecanicaDoModeloDaArma(id: IdDoModeloDaArma, sistema: SistemaDeRpg, arma?: CartaoDaFicha): MecanicaV1 {
  // A ordem das chaves é a do modelo de antes: o Boomerang gravado (catálogo e ficha) sai igual, byte a byte.
  const alcance = alcanceDoModelo(id, arma)
  const base = { versao: VERSAO_GRAVADA, acao: 'simples', custos: [], teste: { tipo: 'reacao' }, alvo: { quem: 'inimigos', forma: { tipo: 'um' }, ...alcance } } satisfies Partial<MecanicaV1>
  const golpe = (extra: Partial<DanoDaMecanica> = {}): DanoDaMecanica => ({
    base: { formula: formulaDaArma(sistema, arma) },
    arma: 'padrao',
    ...extra,
    multiplicadores: { concentracao: true, surpresa: true },
  })
  const comDano = (limite: Limite, efeitos: readonly Efeito[], dano: DanoDaMecanica = golpe()): MecanicaV1 => ({ ...base, limite, dano, efeitos })
  switch (id) {
    case 'atordoa':
      return { ...base, limite: usos(3), efeitos: [selo('Atordoado', 1)] }
    case 'punhadoDeAreia':
      return { ...base, limite: usos(2), efeitos: [selo('Cego', 2)] }
    case 'redeDePesca':
      return { ...base, limite: usos(1), efeitos: [selo('Paralisado', 2)] }
    case 'golpeComSelo':
      return comDano(usos(2), [selo('Sangrando', 3)])
    case 'laminaQueSangra':
      return comDano({}, [selo('Sangrando', 3)])
    case 'pontaEmBrasa':
      return comDano(recarga(2), [selo('Queimando', 2)])
    case 'miraDoCacador':
      return comDano(usos(3), [selo('Marcado', 3)])
    case 'descargaParalisante':
      return comDano(usos(1), [selo('Paralisado', 1)])
    case 'precoDeSangue':
      return { ...comDano({}, [selo('Sangrando', 3)]), custos: [custoAoUsar('hp', HP_DO_PRECO_DE_SANGUE)] }
    case 'pancadaAtordoante':
      return comDano(recarga(3), [selo('Atordoado', 1)])
    case 'poCeganteECorte':
      return comDano(usos(1), [selo('Sangrando', 3), selo('Cego', 2)])
    case 'golpeNaFresta':
      return comDano(usos(2), [], golpe({ perfurante: true }))
    case 'furaCouraca':
      return comDano({}, [], golpe({ perfurante: true, perfuracao: PERFURACAO_DO_FURA_COURACA }))
    case 'golpeEVolta':
      return comDano(recarga(2), [], golpe({ segundoGolpe: { fracao: FRACAO_DO_SEGUNDO_GOLPE, perfurante: false } }))
    case 'laminaSedenta':
      return comDano(usos(3), [{ tipo: 'dreno', recurso: 'hp', porcentoDoDano: DRENO_DA_LAMINA_SEDENTA }])
    case 'tiroCerteiro':
      return { ...comDano(usos(1), []), teste: { tipo: 'naoErra' } }
    case 'golpePesado':
      return { ...comDano({}, [], golpe({ perfurante: true })), custos: [custoAoUsar('sp', SP_DO_GOLPE_PESADO)] }
    case 'cacadaAoMarcado':
      return { ...comDano({}, [], golpe({ perfurante: true })), alvo: { quem: 'inimigos', forma: { tipo: 'um' }, exigeSelo: 'Marcado', ...alcance } }
    case 'arcoLargo':
      return { ...comDano(usos(2), []), alvo: { quem: 'inimigos', forma: { tipo: 'varios', max: ALVOS_DO_VARIOS }, ...alcance } }
    case 'lequeDeLaminas':
      return { ...comDano({}, []), alvo: { quem: 'inimigos', forma: { tipo: 'varios', max: ALVOS_DO_VARIOS, dividirDano: true }, ...alcance } }
  }
}
