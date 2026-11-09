import type { IndiceDoPreparo, Ligacoes, Quadro, TipoDeVerbete, Verbete } from '../tipos'
import { DESTINOS, TIPOS_NO_GRIMORIO, type Destino, type TipoNoGrimorio } from './classificar'
import { chaveDoCaminho } from './cofre'
import type { CopiasDeConflito } from './conflitos'
import type { PlanoDeReimportacao } from './reimportar'

/**
 * O RELATÓRIO DA SIMULAÇÃO (plano §4, passo 5): contagem por tipo (lidos,
 * importados, guardados só como original, ignorados com motivo), os avisos e
 * o espaço em disco. Cada arquivo do cofre aparece em `arquivos` com
 * exatamente 1 destino. Nada aqui foi gravado: o "Aplicar" é da F2.
 */

export const FORMATO_DO_RELATORIO = 1

/** Depois de importar, o disco do Prelúdio tem de ficar com pelo menos isto livre (plano §4, passo 6). */
export const MINIMO_QUE_SOBRA_BYTES = 8 * 1024 ** 3

export interface ArquivoNoRelatorio {
  readonly caminho: string
  readonly bytes: number
  readonly tipo: TipoNoGrimorio
  readonly destino: Destino
  /** Por que foi ignorado, guardado só como original, ou falhou. */
  readonly motivo?: string
  /** O que virou no Prelúdio: o id do verbete, do quadro ou da campanha, ou o arquivo de `midia/`. */
  readonly vira?: string
}

export interface ContagemDoTipo {
  /** Arquivos deste tipo no cofre. */
  lidos: number
  importados: number
  soOriginal: number
  ignorados: number
  falhas: number
}

export interface Contagens {
  readonly campanhas: number
  readonly sessoes: number
  readonly cadernos: number
  readonly paginas: number
  readonly personagens: number
  readonly cenarios: number
  readonly itens: number
  readonly quadros: number
  /** Entradas válidas do `vinculos.json` (participações + relações). */
  readonly vinculos: number
  readonly participacoes: number
  readonly relacoes: number
  readonly imagens: number
  /** Imagens com conteúdo diferente (pelo SHA-256): o que vai para `midia/`. */
  readonly imagensUnicas: number
  readonly chats: number
  readonly pastas: number
  /** Entradas da lixeira (`.lixeira/<id>/`). */
  readonly lixeira: number
}

export interface EspacoEmDisco {
  /** As imagens que faltam em `midia/` + os arquivos novos do Prelúdio + a cópia dos JSON originais. */
  readonly necessarioBytes: number
  /**
   * A parte das imagens em `necessarioBytes`: só as que ainda não estão em
   * `midia/`, porque a que já está lá não é copiada de novo. O "Aplicar" troca
   * esta parte pela conta feita na hora (`midia/` pode mudar depois da simulação).
   */
  readonly midiaBytes: number
  /** `null` = não deu para medir aqui. */
  readonly livreBytes: number | null
  readonly minimoQueSobraBytes: number
  readonly sobraDepoisBytes: number | null
  /** `null` = sem medida do espaço livre. */
  readonly cabe: boolean | null
}

export interface RelatorioDaSimulacao {
  readonly formato: typeof FORMATO_DO_RELATORIO
  readonly geradoEm: string
  readonly cofre: { readonly arquivos: number; readonly bytes: number }
  /** A regra do plano: cada arquivo do cofre em exatamente 1 destino. */
  readonly cadaArquivoUmDestino: boolean
  readonly destinos: Readonly<Record<Destino, { arquivos: number; bytes: number }>>
  readonly porTipo: Readonly<Record<TipoNoGrimorio, ContagemDoTipo>>
  readonly contagens: Contagens
  /** O que o "Aplicar" gravaria no Prelúdio. */
  readonly saida: {
    readonly verbetes: Readonly<Record<TipoDeVerbete, number>>
    readonly quadros: number
    readonly ligacoes: number
    readonly campanhas: number
    readonly midias: number
    readonly chats: number
    /** 1 com o `layout-teia.json`, 0 sem ele. */
    readonly teia: number
    /** Entradas da lixeira (`.lixeira/<id>/`). */
    readonly lixeira: number
  }
  readonly espaco: EspacoEmDisco
  /** Falha, pasta ilegível ou falta de espaço travam o "Aplicar". */
  readonly podeAplicar: boolean
  readonly motivosParaNaoAplicar: readonly string[]
  readonly avisos: readonly string[]
  readonly falhas: readonly { readonly caminho: string; readonly motivo: string }[]
  readonly copiasDeConflito: CopiasDeConflito | null
  readonly reimportacao: PlanoDeReimportacao | null
  readonly arquivos: readonly ArquivoNoRelatorio[]
  /**
   * Caminho antigo da imagem no cofre → `midia/<sha256>.<ext>` (passo 10 do plano).
   * A chave é `chaveDoCaminho` (o cofre cita `imagens/…` e o disco tem `Imagens/…`):
   * procure com `midiaDaTabela`, nunca pela grafia crua.
   */
  readonly tabelaDeMidia: Readonly<Record<string, string>>
}

/** O chat de IA (`<x>.notas/chat-ia.json`), guardado só para leitura junto do dono. */
export interface ChatDoGrimorio {
  /** Id no Prelúdio da sessão, do caderno ou do quadro dono. */
  readonly donoId: string
  readonly caminho: string
  /** O arquivo como veio (`{mensagens: [{papel, texto, em}]}` no Grimório). */
  readonly conteudo: Readonly<Record<string, unknown>>
}

export interface PosicaoNaTeia {
  readonly x: number
  readonly y: number
}

/** O `layout-teia.json`: as posições que o mestre arrumou na Teia, com os ids já do Prelúdio. */
export interface TeiaDoGrimorio {
  readonly caminho: string
  /** Escopo (`cofre` ou `campanha:<id>`) → id → posição em fração da moldura (`grafoLayoutPersistido.ts`). */
  readonly porEscopo: Readonly<Record<string, Readonly<Record<string, PosicaoNaTeia>>>>
}

/** Uma entrada da lixeira do Grimório (`.lixeira/<id>/`): o `entrada.json` e o que foi apagado, como vieram. */
export interface EntradaDaLixeira {
  readonly id: string
  readonly arquivos: readonly { readonly caminho: string; readonly conteudo: Readonly<Record<string, unknown>> }[]
}

/** O que o "Aplicar" (F2) gravaria. Nada disto vai ao disco na simulação. */
export interface PlanoDaImportacao {
  /**
   * `importacao`: tudo entra. `reimportacao` (`reimportar.ts`): verbetes e quadros
   * trazem só os novos e os trocados, e o índice e as ligações trazem a lista
   * inteira, já mesclada com o que é do Prelúdio. Nos dois, o "Aplicar" troca só
   * a lista no arquivo que já está no Prelúdio: o resto dele volta igual.
   */
  readonly modo: 'importacao' | 'reimportacao'
  readonly indice: IndiceDoPreparo
  readonly verbetes: readonly Verbete[]
  readonly quadros: readonly { readonly id: string; readonly quadro: Quadro }[]
  readonly ligacoes: Ligacoes
  readonly midias: readonly { readonly midia: string; readonly caminho: string; readonly bytes: number }[]
  readonly chats: readonly ChatDoGrimorio[]
  readonly teia: TeiaDoGrimorio | null
  readonly lixeira: readonly EntradaDaLixeira[]
}

/**
 * Os bytes das imagens do plano que ainda não estão em `midia/` (`jaNoPreludio`,
 * com o nome que o plano usa: `midia/<sha256>.<ext>`). Só essas o "Aplicar" copia.
 */
export function bytesDasMidiasQueFaltam(midias: PlanoDaImportacao['midias'], jaNoPreludio: ReadonlySet<string>): number {
  return midias.reduce((soma, midia) => (jaNoPreludio.has(midia.midia) ? soma : soma + midia.bytes), 0)
}

/** A mídia nova de um caminho do cofre (`meta.rel` do quadro, `data-rel`), com qualquer grafia; `null` se não há. */
export function midiaDaTabela(tabela: Readonly<Record<string, string>>, rel: string): string | null {
  const chave = chaveDoCaminho(rel)
  return Object.hasOwn(tabela, chave) ? tabela[chave] : null
}

export interface ResultadoDaSimulacao {
  readonly relatorio: RelatorioDaSimulacao
  readonly plano: PlanoDaImportacao
}

export function contagemVazia(): ContagemDoTipo {
  return { lidos: 0, importados: 0, soOriginal: 0, ignorados: 0, falhas: 0 }
}

/** Destino que conta como "importado" na contagem por tipo. */
const IMPORTADOS: ReadonlySet<Destino> = new Set(['verbete', 'quadro', 'ligacoes', 'campanha', 'midia', 'organizacao', 'teia', 'chat', 'lixeira'])

/** Um registro com exatamente estas chaves, cada uma com o próprio valor inicial. */
export function registroDe<K extends string, V>(chaves: readonly K[], valor: (chave: K) => V): Record<K, V> {
  return Object.fromEntries(chaves.map((chave) => [chave, valor(chave)])) as Record<K, V> // cast: `fromEntries` perde o tipo da chave; cada uma de `chaves` entrou uma vez, então o registro tem todas
}

export function somarPorTipo(arquivos: readonly ArquivoNoRelatorio[]): Record<TipoNoGrimorio, ContagemDoTipo> {
  const porTipo = registroDe(TIPOS_NO_GRIMORIO, contagemVazia)
  for (const arquivo of arquivos) {
    const doTipo = porTipo[arquivo.tipo]
    doTipo.lidos += 1
    if (IMPORTADOS.has(arquivo.destino)) doTipo.importados += 1
    else if (arquivo.destino === 'soOriginal') doTipo.soOriginal += 1
    else if (arquivo.destino === 'ignorado') doTipo.ignorados += 1
    else doTipo.falhas += 1
  }
  return porTipo
}

export function somarPorDestino(arquivos: readonly ArquivoNoRelatorio[]): Record<Destino, { arquivos: number; bytes: number }> {
  const porDestino = registroDe(DESTINOS, () => ({ arquivos: 0, bytes: 0 }))
  for (const arquivo of arquivos) {
    porDestino[arquivo.destino].arquivos += 1
    porDestino[arquivo.destino].bytes += arquivo.bytes
  }
  return porDestino
}
