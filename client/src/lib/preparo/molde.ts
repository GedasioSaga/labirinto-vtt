/**
 * MOLDES DO PRELÚDIO (docs/planos/preludio-2026-11-08.md §2): como cada pedaço
 * dos arquivos de `<appData>/preparo/` é lido do disco e volta para ele,
 * declarado uma vez só (`tipos.ts`). Ler confere o tipo de cada campo; gravar
 * devolve o formato do disco.
 *
 * A regra que mora aqui: CHAVE QUE O APP NÃO CONHECE NÃO SOME. Em todo objeto,
 * em qualquer nível (verbete, forma, seção…), o que o molde não declara vai
 * para `extras` na leitura e volta ao mesmo objeto na gravação. Um arquivo de
 * uma versão mais nova que só acrescentou campos sobrevive a um salvar desta,
 * o contrário de `parseAdventure` (`lib/adventure.ts`), que descarta chave nova
 * em silêncio.
 */

/** As chaves que o app não conhece, guardadas como vieram. */
export type Extras = Readonly<Record<string, unknown>>

export type Leitura<T> = { ok: true; valor: T } | { ok: false; motivo: string }

export interface Molde<T> {
  /** Confere o que veio do disco. `onde` é o caminho do campo (`formas[0].titulo`), para o motivo dizer qual falhou. */
  ler(bruto: unknown, onde: string): Leitura<T>
  /** Volta ao formato do disco, com as chaves desconhecidas de volta no lugar delas. */
  gravar(valor: T): unknown
}

/** O tipo que um molde lê: `type Verbete = Valor<typeof VERBETE>`. */
export type Valor<M> = M extends Molde<infer T> ? T : never

/** Em memória, cada objeto guarda aqui as chaves desconhecidas: nenhum molde pode ter um campo com este nome. */
const CHAVE_DOS_EXTRAS = 'extras'

function certo<T>(valor: T): Leitura<T> {
  return { ok: true, valor }
}

function falha(motivo: string): { ok: false; motivo: string } {
  return { ok: false, motivo }
}

function campo(onde: string, chave: string): string {
  return onde === '' ? chave : `${onde}.${chave}`
}

function nomeDoCampo(onde: string): string {
  return onde === '' ? 'o arquivo' : onde
}

export function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function texto(): Molde<string> {
  return {
    ler: (bruto, onde) => (typeof bruto === 'string' ? certo(bruto) : falha(`${nomeDoCampo(onde)} devia ser texto`)),
    gravar: (valor) => valor,
  }
}

/** Número finito (o JSON não tem NaN nem infinito). */
export function numero(): Molde<number> {
  return {
    ler: (bruto, onde) => (typeof bruto === 'number' && Number.isFinite(bruto) ? certo(bruto) : falha(`${nomeDoCampo(onde)} devia ser número`)),
    gravar: (valor) => valor,
  }
}

export function booleano(): Molde<boolean> {
  return {
    ler: (bruto, onde) => (typeof bruto === 'boolean' ? certo(bruto) : falha(`${nomeDoCampo(onde)} devia ser sim ou não`)),
    gravar: (valor) => valor,
  }
}

/** Um dos textos da lista (o tipo do verbete, o alvo da revelação). Valor fora dela = arquivo que esta versão não entende. */
export function umDe<V extends string>(...valores: readonly V[]): Molde<V> {
  return {
    ler(bruto, onde) {
      const achado = valores.find((valor) => valor === bruto)
      return achado === undefined ? falha(`${nomeDoCampo(onde)} devia ser um de: ${valores.join(', ')}`) : certo(achado)
    },
    gravar: (valor) => valor,
  }
}

/** Guardado inteiro, sem olhar dentro: a foto do tldraw, um campo que o plano ainda não detalhou. */
export function qualquer(): Molde<unknown> {
  return {
    ler: (bruto) => certo(bruto),
    gravar: (valor) => valor,
  }
}

/** Guardado inteiro, conferindo só a casca (`confere`): o documento do editor de texto. */
export function intacto<T>(confere: (bruto: unknown) => bruto is T, descricao: string): Molde<T> {
  return {
    ler: (bruto, onde) => (confere(bruto) ? certo(bruto) : falha(`${nomeDoCampo(onde)} devia ser ${descricao}`)),
    gravar: (valor) => valor,
  }
}

export function lista<T>(item: Molde<T>): Molde<T[]> {
  return {
    ler(bruto, onde) {
      if (!Array.isArray(bruto)) return falha(`${nomeDoCampo(onde)} devia ser uma lista`)
      const itens: readonly unknown[] = bruto
      const valores: T[] = []
      for (const [posicao, cru] of itens.entries()) {
        const lido = item.ler(cru, `${onde}[${posicao}]`)
        if (!lido.ok) return lido
        valores.push(lido.valor)
      }
      return certo(valores)
    },
    gravar: (valores) => valores.map((valor) => item.gravar(valor)),
  }
}

/** Campo que pode faltar. Ausente no disco = ausente no objeto, e vice-versa. */
export interface Opcional<T> {
  readonly opcional: Molde<T>
}

export function opcional<T>(molde: Molde<T>): Opcional<T> {
  return { opcional: molde }
}

type Campo = Molde<unknown> | Opcional<unknown>
type Campos = Readonly<Record<string, Campo>>

type ValorDoCampo<C> = C extends Opcional<infer T> ? T : C extends Molde<infer T> ? T : never

/** Achata a interseção: o editor mostra um objeto só. */
type Plano<T> = { [K in keyof T]: T[K] } & {}

export type ObjetoDe<F extends Campos> = Plano<
  { [K in keyof F as F[K] extends Opcional<unknown> ? never : K]: ValorDoCampo<F[K]> } & {
    [K in keyof F as F[K] extends Opcional<unknown> ? K : never]?: ValorDoCampo<F[K]>
  } & { extras?: Extras }
>

function ehOpcional(campo: Campo): campo is Opcional<unknown> {
  return 'opcional' in campo
}

function moldeDo(campo: Campo): Molde<unknown> {
  return ehOpcional(campo) ? campo.opcional : campo
}

/**
 * Objeto com campos conhecidos. Na leitura, cada campo passa pelo próprio
 * molde e o resto vai para `extras`; na gravação, `extras` volta primeiro e os
 * campos conhecidos vêm por cima (nunca o contrário).
 */
export function objeto<F extends Campos>(campos: F): Molde<ObjetoDe<F>> {
  if (Object.hasOwn(campos, CHAVE_DOS_EXTRAS)) throw new Error(`"${CHAVE_DOS_EXTRAS}" guarda as chaves desconhecidas e não pode ser campo de molde.`)
  const definicoes: ReadonlyArray<readonly [string, Campo]> = Object.entries(campos)
  const conhecidas: ReadonlySet<string> = new Set(Object.keys(campos))
  return {
    ler(bruto, onde) {
      if (!ehRegistro(bruto)) return falha(`${nomeDoCampo(onde)} devia ser um objeto`)
      const lido: Record<string, unknown> = {}
      for (const [chave, definicao] of definicoes) {
        if (!Object.hasOwn(bruto, chave)) {
          if (ehOpcional(definicao)) continue
          return falha(`falta ${campo(onde, chave)}`)
        }
        const leitura = moldeDo(definicao).ler(bruto[chave], campo(onde, chave))
        if (!leitura.ok) return leitura
        lido[chave] = leitura.valor
      }
      // `fromEntries` cria a chave como dado mesmo quando ela se chama "__proto__" (atribuir trocaria o protótipo).
      const extras = Object.fromEntries(Object.entries(bruto).filter(([chave]) => !conhecidas.has(chave)))
      if (Object.keys(extras).length > 0) lido[CHAVE_DOS_EXTRAS] = extras
      // Cada chave de `campos` passou pelo próprio molde logo acima (as opcionais só quando presentes) e,
      // fora delas, só `extras` entra em `lido`: é a forma de ObjetoDe<F> por construção.
      return certo(lido as ObjetoDe<F>) // cast: montado e conferido campo a campo no laço acima

    },
    gravar(valor) {
      const guardados: unknown = Reflect.get(valor, CHAVE_DOS_EXTRAS)
      const disco: Record<string, unknown> = ehRegistro(guardados) ? { ...guardados } : {}
      for (const [chave, definicao] of definicoes) {
        const atual: unknown = Reflect.get(valor, chave)
        if (atual === undefined) continue
        disco[chave] = moldeDo(definicao).gravar(atual)
      }
      return disco
    },
  }
}
