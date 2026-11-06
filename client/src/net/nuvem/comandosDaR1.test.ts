import { describe, expect, it } from 'vitest'
import { comandosDaR1, type Invocar } from './comandosDaR1'

/**
 * O adaptador real contra o contrato da R1 (topo de `desktop/src-tauri/src/nuvem.rs`):
 * o `invoke` é falso e grava cada chamada. Nome do comando e argumentos têm de
 * ser exatamente os que o Tauri 2 desserializa: camelCase, e no `pedido` nem
 * campo a mais nem opcional ausente como `undefined` (`deny_unknown_fields`).
 */

interface Chamada {
  comando: string
  argumentos: Record<string, unknown> | undefined
}

const MIDIA = `${'a'.repeat(64)}.webp`

describe('comandos da R1 (J0)', () => {
  it('chama cada comando com o nome e os argumentos exatos, uma rota do nuvem_pedir por vez, e devolve o erro da R1 cru', async () => {
    const chamadas: Chamada[] = []
    const respostas: Readonly<Record<string, unknown>> = { nuvem_credencial_estado: true, nuvem_enviar_midia: { midiaId: MIDIA } }
    const invocar: Invocar = async (comando, argumentos) => {
      chamadas.push({ comando, argumentos })
      return Object.hasOwn(respostas, comando) ? respostas[comando] : null
    }
    const r1 = comandosDaR1(invocar)
    const corpo = { v: 1, clienteId: 'cli_app' }
    // Por variável o TypeScript deixa passar campo que o tipo não mostra; ele não pode chegar ao fio.
    const desdeComSobra: { rota: 'desde'; campanhaId: string; rev: number; url: string } = { rota: 'desde', campanhaId: 'camp_1', rev: 7, url: 'https://outro.example' }

    expect(await r1.credencialGuardada()).toBe(true)
    await r1.guardarCredencial('abc.access', 'segredo')
    await r1.apagarCredencial()
    await r1.pedir({ rota: 'eu' })
    await r1.pedir({ rota: 'publicar', campanhaId: 'camp_1', corpo })
    await r1.pedir({ rota: 'membros', campanhaId: 'camp_1', corpo })
    await r1.pedir({ rota: 'ops', campanhaId: 'camp_1', corpo })
    await r1.pedir(desdeComSobra)
    await r1.pedir({ rota: 'desde', campanhaId: 'camp_1', rev: 0, limite: 500 })
    await r1.pedir({ rota: 'exportar', campanhaId: 'camp_1', deRev: 3 })
    await r1.pedir({ rota: 'exportar', campanhaId: 'camp_1' })
    expect(await r1.enviarMidia('camp_1', 'pasta_a', MIDIA)).toEqual({ midiaId: MIDIA })
    await r1.baixarMidia('camp_1', MIDIA)

    expect(chamadas).toStrictEqual([
      { comando: 'nuvem_credencial_estado', argumentos: undefined },
      { comando: 'nuvem_credencial_guardar', argumentos: { clientId: 'abc.access', clientSecret: 'segredo' } },
      { comando: 'nuvem_credencial_apagar', argumentos: undefined },
      { comando: 'nuvem_pedir', argumentos: { pedido: { rota: 'eu' } } },
      { comando: 'nuvem_pedir', argumentos: { pedido: { rota: 'publicar', campanhaId: 'camp_1', corpo } } },
      { comando: 'nuvem_pedir', argumentos: { pedido: { rota: 'membros', campanhaId: 'camp_1', corpo } } },
      { comando: 'nuvem_pedir', argumentos: { pedido: { rota: 'ops', campanhaId: 'camp_1', corpo } } },
      { comando: 'nuvem_pedir', argumentos: { pedido: { rota: 'desde', campanhaId: 'camp_1', rev: 7 } } },
      { comando: 'nuvem_pedir', argumentos: { pedido: { rota: 'desde', campanhaId: 'camp_1', rev: 0, limite: 500 } } },
      { comando: 'nuvem_pedir', argumentos: { pedido: { rota: 'exportar', campanhaId: 'camp_1', deRev: 3 } } },
      { comando: 'nuvem_pedir', argumentos: { pedido: { rota: 'exportar', campanhaId: 'camp_1' } } },
      { comando: 'nuvem_enviar_midia', argumentos: { campanhaId: 'camp_1', pastaId: 'pasta_a', midiaId: MIDIA } },
      { comando: 'nuvem_baixar_midia', argumentos: { campanhaId: 'camp_1', midiaId: MIDIA } },
    ])

    // O `Err` da R1 passa sem mudar: quem decide o que ele quer dizer é `lerErroDaR1` (laço) e `falhaDoErro` (telas).
    const erroDaR1 = { codigo: 'cofre', mensagem: 'A credencial labirinto-vtt.lobby está danificada.', status: null, detalhe: null }
    const quebrado = comandosDaR1(async () => {
      throw erroDaR1
    })
    await expect(quebrado.credencialGuardada()).rejects.toBe(erroDaR1)
  })
})
