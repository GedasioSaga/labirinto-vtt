import { ABA_DAS_TECNICAS, CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_TEMPO } from '../../../../lib/batalha/leituraDaFicha'
import { CAMPO_DO_DANO, lerDano, type LeituraDoDano } from '../../../../lib/batalha/formula'
import type { CartaoDaFicha, Personagem } from '../../../../lib/personagem'
import type { SistemaDeRpg } from '../../../../lib/sistemaDeRpg'

/**
 * A TÉCNICA DE TREINO (fatia J, pedido de 06/11/2026: "eles vão poder dar
 * técnicas [ao Judge] e modificar os status deles quando forem fazer
 * simulação solo"). Uma técnica que só existe no treino deste navegador: nome,
 * ação, a fórmula do dano (a mesma gramática da ficha, `lib/batalha/formula.ts`:
 * "Força + 20", "150"), o custo em SP e a recarga em turnos. Vira um cartão da
 * aba Habilidades na CÓPIA da ficha que luta (`cartaoDaTecnica`), e a luta a lê
 * como lê qualquer técnica da ficha: o robô usa, o HUD mostra, o custo cobra.
 *
 * Puro: sem DOM, sem armazenamento.
 */

export type AcaoDaTecnicaDeTreino = 'simples' | 'completa' | 'bonus'

export interface TecnicaDeTreino {
  id: string
  nome: string
  acao: AcaoDaTecnicaDeTreino
  /** A fórmula do dano, como na ficha ("Força + 20"). */
  dano: string
  /** SP por uso; 0 = de graça. */
  custo: number
  /** Turnos de recarga; 0 = livre. */
  recarga: number
}

/** Quantas técnicas de treino uma ficha (ou o Judge) leva. */
export const TECNICAS_DE_TREINO_MAX = 8
export const NOME_DA_TECNICA_MAX = 60
export const DANO_DA_TECNICA_MAX = 120
export const CUSTO_DA_TECNICA_MAX = 9_999
export const RECARGA_DA_TECNICA_MAX = 9

export const ACOES_DA_TECNICA: readonly { id: AcaoDaTecnicaDeTreino; nome: string; naFicha: string }[] = [
  { id: 'simples', nome: 'Simples', naFicha: 'Ação Simples' },
  { id: 'bonus', nome: 'Bônus', naFicha: 'Ação Bônus' },
  { id: 'completa', nome: 'Completa', naFicha: 'Ação Completa' },
]

const PREFIXO_DO_CARTAO = 'treino_tec_'

function inteiroEntre(valor: unknown, min: number, max: number): number | null {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= min && valor <= max ? valor : null
}

/** A técnica lida do armazenamento; `null` = torta (a lista inteira é descartada por quem chama). */
function lerTecnica(valor: unknown): TecnicaDeTreino | null {
  if (typeof valor !== 'object' || valor === null) return null
  const bruto = valor as Record<string, unknown>
  const { id, nome, acao, dano } = bruto
  const custo = inteiroEntre(bruto.custo, 0, CUSTO_DA_TECNICA_MAX)
  const recarga = inteiroEntre(bruto.recarga, 0, RECARGA_DA_TECNICA_MAX)
  if (typeof id !== 'string' || !/^[a-z0-9]{1,24}$/.test(id)) return null
  if (typeof nome !== 'string' || nome.length > NOME_DA_TECNICA_MAX) return null
  if (typeof dano !== 'string' || dano.length > DANO_DA_TECNICA_MAX) return null
  if (!ACOES_DA_TECNICA.some((candidata) => candidata.id === acao) || custo === null || recarga === null) return null
  return { id, nome, acao: acao as AcaoDaTecnicaDeTreino, dano, custo, recarga }
}

/** A lista guardada; `null` = torta ou comprida demais. Ids repetidos também são tortos. */
export function lerTecnicasDeTreino(valor: unknown): TecnicaDeTreino[] | null {
  if (!Array.isArray(valor) || valor.length > TECNICAS_DE_TREINO_MAX) return null
  const lidas: TecnicaDeTreino[] = []
  for (const item of valor) {
    const tecnica = lerTecnica(item)
    if (tecnica === null || lidas.some((outra) => outra.id === tecnica.id)) return null
    lidas.push(tecnica)
  }
  return lidas
}

/** Um id curto que ainda não está na lista. */
export function idDeTecnicaNova(lista: readonly TecnicaDeTreino[]): string {
  let n = lista.length + 1
  while (lista.some((tecnica) => tecnica.id === `t${n}`)) n += 1
  return `t${n}`
}

/** A técnica que o "Nova técnica" põe na lista: um golpe simples que a regra já lê. */
export function tecnicaNova(lista: readonly TecnicaDeTreino[]): TecnicaDeTreino {
  return { id: idDeTecnicaNova(lista), nome: `Golpe de treino ${lista.length + 1}`, acao: 'simples', dano: 'Força + 10', custo: 10, recarga: 0 }
}

/** O nome que a ficha mostra: o digitado, ou um no lugar do vazio. */
export function nomeDaTecnica(tecnica: TecnicaDeTreino): string {
  const limpo = tecnica.nome.trim()
  return limpo === '' ? 'Técnica sem nome' : limpo
}

/** O cartão da aba Habilidades que a cópia da ficha recebe (os campos que a batalha lê: ação, custo, tempo e dano). */
export function cartaoDaTecnica(tecnica: TecnicaDeTreino): CartaoDaFicha {
  const acao = ACOES_DA_TECNICA.find((candidata) => candidata.id === tecnica.acao)?.naFicha ?? 'Ação Simples'
  return {
    id: `${PREFIXO_DO_CARTAO}${tecnica.id}`,
    nome: nomeDaTecnica(tecnica),
    campos: {
      descricao: 'Técnica de treino: só existe neste navegador.',
      [CAMPO_DA_ACAO]: acao,
      [CAMPO_DO_CUSTO]: tecnica.custo > 0 ? `${tecnica.custo} SP` : '-',
      [CAMPO_DO_TEMPO]: tecnica.recarga > 0 ? String(tecnica.recarga) : '-',
      [CAMPO_DO_DANO]: tecnica.dano.trim(),
    },
    extras: [],
    atributos: [],
    imagem: null,
    modificadores: [],
    subcartoes: [],
  }
}

/** A cópia com as técnicas de treino no fim da aba Habilidades; a ficha recebida não muda. */
export function comTecnicasDeTreino(doc: Personagem, tecnicas: readonly TecnicaDeTreino[]): Personagem {
  if (tecnicas.length === 0) return doc
  const daFicha = doc.abas[ABA_DAS_TECNICAS] ?? []
  return { ...doc, abas: { ...doc.abas, [ABA_DAS_TECNICAS]: [...daFicha, ...tecnicas.map(cartaoDaTecnica)] } }
}

/** Como a luta lê o dano da técnica com os números de quem a usa (sem arma e sem saber a vida do alvo). */
export function leituraDoDano(tecnica: TecnicaDeTreino, personagem: Personagem, sistema: SistemaDeRpg): LeituraDoDano {
  return lerDano(tecnica.dano, { personagem, sistema, arma: null, vidaDoAlvo: null })
}

/** A técnica entra na luta pelo robô e pelo menu? Só com o dano que a regra lê sozinha. */
export function danoQueALutaLe(leitura: LeituraDoDano): leitura is Extract<LeituraDoDano, { tipo: 'valor' }> {
  return leitura.tipo === 'valor'
}
