import { naoExiste } from './http'

/**
 * Worker `labirinto-nuvem` (plano §3.1, §6.3): só define as classes dos DOs.
 * `workers_dev = false`, nenhuma rota, e o `fetch` padrão devolve 404: o
 * Worker só é alcançado pelo binding do portão (lobby/site, fatia W2), que
 * chama `encaminhar` (./encaminhar.ts) depois de validar o JWT do Access.
 * A porta de teste local fica em `dev.ts`, que NÃO entra neste bundle.
 */
export { Campanha } from './campanha'
export { Diretorio } from './diretorio'

export default {
  fetch(): Response {
    return naoExiste()
  },
} satisfies ExportedHandler<Env>
