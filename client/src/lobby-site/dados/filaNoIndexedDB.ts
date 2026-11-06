import { segmentoValido } from '../../lib/nuvem/caminho'
import type { ArmazenamentoDaFila } from '../../lib/nuvem/fila'

/**
 * A FILA DO SITE NO INDEXEDDB (§5.6; requisito herdado 5 da 8.1.1): o
 * adaptador de `criarFila` no navegador. Uma base por e-mail + campanha (duas
 * contas no mesmo navegador não misturam fila), com um registro da fila por
 * entrada, na ordem em que foram acrescentados (chave crescente).
 *
 * As abas da mesma pessoa dividem a base: a aba que abre manda também o que
 * uma aba fechada deixou a caminho. Cada op leva o `clienteId` da aba que a
 * fez (`clienteDaAba.ts`), e é com ele que o servidor confere a autoria; por
 * isso o id do aparelho não mora aqui.
 *
 * Cada `acrescentar` e cada `substituir` é UMA transação: o registro `grupo`
 * (o tudo-ou-nada) leva vários `opId` numa entrada só, e a escolha "Usar a
 * minha" vai junto com a op nova — nada disso pode ficar gravado pela metade.
 * Se um registro falha no meio, a transação é abortada e nada dela fica. A
 * promessa só resolve no `complete` com durabilidade `strict` (gravado de
 * verdade): é isso que a fila espera antes de mostrar a mudança como feita.
 */

const VERSAO_DO_BANCO = 1
const REGISTROS = 'registros'
const PREFIXO_DO_BANCO = 'labirinto-lobby-fila'

/** E-mail em minúsculas e sem espaços, como na conta (§4.3): o mesmo login cai sempre na mesma base. */
export function nomeDoBanco(email: string, campanhaId: string): string {
  return `${PREFIXO_DO_BANCO}:${email.trim().toLowerCase()}:${campanhaId}`
}

function erroDe(motivo: DOMException | null, quando: string): Error {
  return motivo ?? new Error(`IndexedDB: ${quando} falhou sem dizer por quê`)
}

function emPromessa<T>(pedido: IDBRequest<T>, quando: string): Promise<T> {
  return new Promise((resolve, reject) => {
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(erroDe(pedido.error, quando))
  })
}

/** Resolve quando a transação inteira foi gravada; rejeita se ela falhou ou foi abortada (aí nada dela ficou). */
function concluida(transacao: IDBTransaction, quando: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transacao.oncomplete = () => resolve()
    transacao.onerror = () => reject(erroDe(transacao.error, quando))
    transacao.onabort = () => reject(erroDe(transacao.error, `${quando} (abortada)`))
  })
}

export function abrirBancoDaFila(email: string, campanhaId: string, fabrica: IDBFactory = indexedDB): Promise<IDBDatabase> {
  if (!segmentoValido(campanhaId)) return Promise.reject(new TypeError(`abrirBancoDaFila: campanha inválida (${campanhaId})`))
  return new Promise((resolve, reject) => {
    const pedido = fabrica.open(nomeDoBanco(email, campanhaId), VERSAO_DO_BANCO)
    pedido.onupgradeneeded = () => {
      const banco = pedido.result
      if (!banco.objectStoreNames.contains(REGISTROS)) banco.createObjectStore(REGISTROS, { autoIncrement: true })
    }
    pedido.onsuccess = () => {
      const banco = pedido.result
      // Outra aba com um site mais novo quer subir a versão da base: esta sai do caminho em vez de travá-la.
      banco.onversionchange = () => banco.close()
      resolve(banco)
    }
    pedido.onerror = () => reject(erroDe(pedido.error, 'abrir a fila'))
  })
}

/**
 * Grava todos os registros numa transação só. Um registro que nem chega a
 * entrar (por exemplo, `DataCloneError`) aborta a transação inteira: sem isso,
 * os que já tinham entrado seriam gravados assim mesmo.
 */
async function gravarNumaTransacao(banco: IDBDatabase, registros: readonly unknown[], limparAntes: boolean, quando: string): Promise<void> {
  const transacao = banco.transaction(REGISTROS, 'readwrite', { durability: 'strict' })
  const fim = concluida(transacao, quando)
  try {
    const loja = transacao.objectStore(REGISTROS)
    if (limparAntes) loja.clear()
    for (const registro of registros) loja.add(registro)
  } catch (erro) {
    transacao.abort()
    // O motivo verdadeiro é o erro síncrono; o da transação abortada é só consequência dele.
    fim.catch(() => undefined)
    throw erro
  }
  await fim
}

export function armazenamentoNoIndexedDB(banco: IDBDatabase): ArmazenamentoDaFila {
  return {
    async carregar() {
      const transacao = banco.transaction(REGISTROS, 'readonly')
      const registros: readonly unknown[] = await emPromessa(transacao.objectStore(REGISTROS).getAll(), 'ler a fila')
      // IndexedDB guarda objeto, não texto: não existe a linha cortada do arquivo.
      return { registros, ilegiveis: 0 }
    },
    async acrescentar(registros) {
      if (registros.length === 0) return
      await gravarNumaTransacao(banco, registros, false, 'acrescentar na fila')
    },
    async substituir(registros) {
      await gravarNumaTransacao(banco, registros, true, 'compactar a fila')
    },
  }
}
