import { atenderPeloPortao, type AmbienteDoPortao } from '../../src/portao'

/**
 * O portão do Lobby (plano §6.2): toda rota `/api/*` do site cai aqui
 * (`client/public-lobby/_routes.json`), em qualquer método e no upgrade do
 * WebSocket. A regra mora em `src/portao.ts`.
 */
export const onRequest: PagesFunction<AmbienteDoPortao> = (contexto) => atenderPeloPortao(contexto.request, contexto.env)
