import { join } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { readDir, readFile, readTextFile, stat, type DirEntry } from '@tauri-apps/plugin-fs'
import type { LeitorDoCofre, TipoDaEntrada } from './cofre'

/**
 * O COFRE NO APP INSTALADO (plano §4, passo 1): o mestre escolhe a pasta no
 * diálogo e o importador lê por `@tauri-apps/plugin-fs`. O diálogo põe a
 * pasta escolhida no escopo de leitura até o app fechar
 * (`plugin-dialog/dist-js/index.d.ts`, `open`); nada é gravado nela, porque o
 * leitor não tem como gravar.
 *
 * `stat` só pergunta o tamanho e os atributos do Windows, sem abrir o
 * conteúdo: um arquivo que está só na nuvem do OneDrive não é baixado.
 */

/** `null` quando o mestre fecha o diálogo sem escolher. */
export async function escolherPastaDoCofre(titulo: string): Promise<string | null> {
  const escolhida = await open({ directory: true, recursive: true, multiple: false, title: titulo })
  return typeof escolhida === 'string' ? escolhida : null
}

/**
 * O `readDir` do plugin-fs 2.5.1 (`commands.rs`, `read_dir`) devolve o
 * `file_type()` do Rust, que no Windows só chama de link o ponto de reparse com
 * marca de substituto de nome (link simbólico e junção); a pasta do OneDrive tem
 * outra marca e chega como pasta. O Node já mostrou como link uma pasta do
 * OneDrive guardada dentro de pasta comum; por isso atalho nunca é descartado
 * calado: vira entrada, e falha na lista.
 */
function tipoDaEntrada(entrada: DirEntry): TipoDaEntrada {
  if (entrada.isSymlink) return 'atalho'
  return entrada.isDirectory ? 'pasta' : 'arquivo'
}

/** Atalho não é seguido: o cofre do Grimório não usa, e seguir poderia sair da pasta escolhida. */
export function leitorDoCofreNoApp(raiz: string): LeitorDoCofre {
  const absoluto = (caminho: string): Promise<string> => (caminho === '' ? Promise.resolve(raiz) : join(raiz, ...caminho.split('/')))
  return {
    async listar(caminho) {
      const entradas = await readDir(await absoluto(caminho))
      return entradas.map((entrada) => ({ nome: entrada.name, tipo: tipoDaEntrada(entrada) }))
    },
    async info(caminho) {
      const info = await stat(await absoluto(caminho))
      return { bytes: info.size, atributos: info.fileAttributes }
    },
    async lerTexto(caminho) {
      return readTextFile(await absoluto(caminho))
    },
    async lerBytes(caminho) {
      return readFile(await absoluto(caminho))
    },
  }
}
