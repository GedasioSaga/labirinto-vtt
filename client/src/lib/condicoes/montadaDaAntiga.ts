import type { CondicaoPropria, RegraDaCondicao } from '../../types/map'
import type { GatilhoDaCondicao } from '../itens/modelo'
import { PRAZO_PADRAO, TIPO_PADRAO_DA_CONDICAO, type CondicaoMontada, type PecaDaCondicao } from './modelo'

/**
 * A CONDIÇÃO DE ANTES, MONTADA COM PEÇAS (rework das condições, PLANO.md §2, E1). A criada antes do
 * rework guarda só `regra`, `n` e `gatilho`; aqui ela ganha as peças equivalentes NA LEITURA, sem gravar:
 *  - `vida` N = "No começo de cada vez dele, perde N de vida, direto na vida" (o que o Aplicar faz hoje);
 *  - `cura` N = "Recebe −N% de cura";
 *  - `narra` = nenhuma peça (o mestre narra);
 *  - o `gatilho` = a peça Depois de X turnos, igual.
 * O `regra`, o `n` e o `gatilho` ficam como estavam: o app de antes, o site e o Worker seguem lendo eles.
 *
 * O caminho de volta (`regraDeHoje`) dá a regra de antes de uma condição montada: é o que o catálogo e a
 * gravação mostram ao que ainda lê `regra` e `n` (a ficha fora da batalha, o app de antes).
 *
 * Puro e idempotente: a condição que já tem `pecas` volta a MESMA referência.
 *
 * API pública: `pecasDaRegraDeAntes`, `montadaDaAntiga`, `montarCondicao`, `regraDeHoje`, `gatilhoDeHoje`.
 */

/** As peças que a regra de antes vira (lista nova a cada chamada). */
export function pecasDaRegraDeAntes(antiga: Pick<CondicaoPropria, 'regra' | 'n' | 'gatilho'>): PecaDaCondicao[] {
  const pecas: PecaDaCondicao[] = []
  const n = antiga.n ?? 0
  if (antiga.regra === 'vida') pecas.push({ tipo: 'vez', quando: 'comeco', faz: 'tira', v: n, conta: 'fixo', recurso: 'vida', direto: true })
  // `0 - n`, e não `-n`: o corte 0 sai 0, e não −0 (que o JSON grava como 0 mas o `Object.is` separa).
  if (antiga.regra === 'cura') pecas.push({ tipo: 'danoCura', curaV: 0 - n })
  if (antiga.gatilho !== undefined) pecas.push({ tipo: 'gatilho', gatilho: antiga.gatilho })
  return pecas
}

/**
 * A condição com as peças: a que já tem `pecas` volta a MESMA referência (2ª passada = nada muda); a de
 * antes ganha as `pecas` da regra dela e guarda o resto igual.
 */
export function montadaDaAntiga(propria: CondicaoPropria): CondicaoPropria {
  if (propria.pecas !== undefined) return propria
  return { ...propria, pecas: pecasDaRegraDeAntes(propria) }
}

/** A condição já com os padrões (negativa, 3 turnos e "o prazo recomeça", sem saída), para as frases, a tradução e o boneco. */
export function montarCondicao(propria: CondicaoPropria): CondicaoMontada {
  return {
    id: propria.id,
    nome: propria.nome,
    tipo: propria.tipo ?? TIPO_PADRAO_DA_CONDICAO,
    pecas: propria.pecas ?? pecasDaRegraDeAntes(propria),
    prazo: propria.prazo ?? PRAZO_PADRAO,
    saidas: propria.saidas ?? [],
  }
}

/**
 * A regra de antes de uma condição montada: o primeiro Efeito na vez que tira vida fixa no começo é
 * `vida` (com o número dele); senão, o primeiro corte de cura é `cura` (o tanto cortado); senão, `narra`.
 * O resto das peças só a batalha nova faz.
 */
export function regraDeHoje(montada: Pick<CondicaoMontada, 'pecas'>): { regra: RegraDaCondicao; n: number } {
  for (const peca of montada.pecas) {
    if (peca.tipo === 'vez' && peca.quando === 'comeco' && peca.faz === 'tira' && peca.recurso === 'vida' && peca.conta === 'fixo') return { regra: 'vida', n: peca.v }
  }
  for (const peca of montada.pecas) {
    if (peca.tipo === 'danoCura' && peca.curaV !== undefined && peca.curaV < 0) return { regra: 'cura', n: 0 - peca.curaV }
  }
  return { regra: 'narra', n: 0 }
}

/** O "Depois de X turnos" da condição montada (o da primeira peça Gatilho); `undefined` = nenhum. */
export function gatilhoDeHoje(montada: Pick<CondicaoMontada, 'pecas'>): GatilhoDaCondicao | undefined {
  for (const peca of montada.pecas) {
    if (peca.tipo === 'gatilho') return peca.gatilho
  }
  return undefined
}
