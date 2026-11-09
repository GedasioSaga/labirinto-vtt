import { ARQUIVO_DO_REVELADO, type AlvoDaRevelacao, type Revelacao, type Revelado } from './tipos'

/**
 * O QUE FOI REVELADO, E A QUEM (docs/planos/preludio-2026-11-08.md §2,
 * "Revelação"): `revelado/<campanhaId>.json`, uma revelação por alvo.
 *
 * - Tudo começa oculto: sem revelação, ninguém vê. Ocultar de novo apaga a revelação.
 * - Forma e seção carregam o verbete (e a seção, a forma) no alvo: o id delas
 *   só é único dentro do verbete. Alvo sem esse escopo não vale.
 * - Revelação com chave que esta versão não conhece não vale (ela pode trazer
 *   uma regra, como um prazo, que esta versão não saberia cumprir), nem o
 *   arquivo de formato mais novo inteiro: na dúvida, oculto.
 * - A tela (`preludio/revelar/`) e o pacote do jogador (`pacoteDoJogador.ts`)
 *   leem pelas mesmas funções daqui: o controle mostra o que o pacote faz.
 */

/** Quem vê: o grupo inteiro da campanha, ou só as contas escolhidas. Oculto = sem revelação (`null`). */
export type ParaQuem = 'todos' | readonly string[]

export interface MudancaDeRevelacao {
  readonly alvo: AlvoDaRevelacao
  /** `null` = ocultar. */
  readonly para: ParaQuem | null
}

export function reveladoVazio(): Revelado {
  return { formato: ARQUIVO_DO_REVELADO.formato, revelacoes: [] }
}

// ─── Alvos ───────────────────────────────────────────────────────────────────

export function alvoDoVerbete(verbeteId: string): AlvoDaRevelacao {
  return { tipo: 'verbete', id: verbeteId }
}

export function alvoDaForma(verbeteId: string, formaId: string): AlvoDaRevelacao {
  return { tipo: 'forma', id: formaId, verbeteId }
}

export function alvoDaSecao(verbeteId: string, formaId: string, secaoId: string): AlvoDaRevelacao {
  return { tipo: 'secao', id: secaoId, verbeteId, formaId }
}

export function alvoDaLigacao(ligacaoId: string): AlvoDaRevelacao {
  return { tipo: 'ligacao', id: ligacaoId }
}

/**
 * A chave única do alvo (o JSON de uma lista de textos não confunde `a/b` + `c`
 * com `a` + `b/c`). `null` = alvo torto: forma sem verbete, seção sem forma,
 * escopo onde não cabe, chave desconhecida.
 */
export function chaveDoAlvo(alvo: AlvoDaRevelacao): string | null {
  if (alvo.extras !== undefined || alvo.id === '') return null
  switch (alvo.tipo) {
    case 'forma':
      return alvo.verbeteId === undefined || alvo.verbeteId === '' || alvo.formaId !== undefined ? null : JSON.stringify(['forma', alvo.verbeteId, alvo.id])
    case 'secao':
      return alvo.verbeteId === undefined || alvo.verbeteId === '' || alvo.formaId === undefined || alvo.formaId === ''
        ? null
        : JSON.stringify(['secao', alvo.verbeteId, alvo.formaId, alvo.id])
    default:
      return alvo.verbeteId !== undefined || alvo.formaId !== undefined ? null : JSON.stringify([alvo.tipo, alvo.id])
  }
}

// ─── Para quem ───────────────────────────────────────────────────────────────

/** `'todos'`, ou as contas sem repetição e em ordem; lista vazia = oculto (`null`). */
export function paraNormal(para: ParaQuem | null): 'todos' | string[] | null {
  if (para === null) return null
  if (para === 'todos') return 'todos'
  const contas = [...new Set(para.filter((conta) => conta !== ''))].sort()
  return contas.length === 0 ? null : contas
}

/** A conta (`null` = um jogador qualquer, que só vê o revelado a todos) vê o que foi revelado a `para`? */
export function contaVe(para: ParaQuem | null, contaId: string | null): boolean {
  if (para === null) return false
  if (para === 'todos') return true
  return contaId !== null && para.includes(contaId)
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

/** O que vale de cada alvo. Repetido no arquivo (mexido à mão): vale a última. */
export function revelacoesPorAlvo(revelado: Revelado | null): ReadonlyMap<string, Revelacao> {
  const porAlvo = new Map<string, Revelacao>()
  if (revelado === null || revelado.formato > ARQUIVO_DO_REVELADO.formato) return porAlvo
  for (const revelacao of revelado.revelacoes) {
    if (revelacao.extras !== undefined) continue
    const chave = chaveDoAlvo(revelacao.alvo)
    if (chave === null) continue
    const para = paraNormal(revelacao.para)
    if (para === null) {
      porAlvo.delete(chave)
      continue
    }
    porAlvo.set(chave, { ...revelacao, para })
  }
  return porAlvo
}

/** A quem o alvo foi revelado; `null` = oculto. */
export function paraDe(porAlvo: ReadonlyMap<string, Revelacao>, alvo: AlvoDaRevelacao): ParaQuem | null {
  const chave = chaveDoAlvo(alvo)
  return chave === null ? null : (porAlvo.get(chave)?.para ?? null)
}

// ─── Mudança ─────────────────────────────────────────────────────────────────

/**
 * O arquivo com as mudanças aplicadas em ordem: cada alvo fica com uma
 * revelação só (a nova), ou nenhuma (ocultar). O resto fica como está, até o
 * que esta versão não entende. Alvo torto lança: é erro de quem chamou.
 */
export function comRevelacoes(revelado: Revelado, mudancas: readonly MudancaDeRevelacao[], quando: string): Revelado {
  let revelacoes = revelado.revelacoes
  for (const { alvo, para } of mudancas) {
    const chave = chaveDoAlvo(alvo)
    if (chave === null) throw new Error(`O alvo ${JSON.stringify(alvo)} não serve para revelar.`)
    const doAlvo = (revelacao: Revelacao) => revelacao.extras === undefined && chaveDoAlvo(revelacao.alvo) === chave
    const atuais = revelacoes.filter(doAlvo)
    const normal = paraNormal(para)
    // Já está assim: nada muda (e o `quando` de quando foi revelado fica).
    const atual = atuais.length === 1 ? atuais[0] : undefined
    if (normal === null ? atuais.length === 0 : atual !== undefined && JSON.stringify(paraNormal(atual.para)) === JSON.stringify(normal)) continue
    const resto = revelacoes.filter((revelacao) => !doAlvo(revelacao))
    revelacoes = normal === null ? resto : [...resto, { alvo: { ...alvo }, para: normal, quando }]
  }
  return revelacoes === revelado.revelacoes ? revelado : { ...revelado, revelacoes }
}
