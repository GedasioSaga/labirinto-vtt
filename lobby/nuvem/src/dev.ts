import { encaminhar } from './encaminhar'
import { json, naoExiste } from './http'
import { emailNormalizado } from './identidade'

/**
 * PORTA DE TESTE LOCAL — só para `npx wrangler dev src/dev.ts --local`
 * (o `fumaca.mjs` fala com ela). Faz o papel do portão sem o Access: a
 * identidade vem da URL (`?eu=<email>&origem=app|site`), porque o WebSocket
 * do Node não manda cabeçalho próprio. Nunca entra no deploy: o `main` do
 * wrangler.toml é `src/index.ts`, e este arquivo não é importado por ele.
 * Mesmo assim, fora de localhost ela não responde.
 */
export { Campanha, Diretorio } from './index'

const HOSTS_LOCAIS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]'])

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!HOSTS_LOCAIS.has(url.hostname)) return naoExiste()
    const email = emailNormalizado(url.searchParams.get('eu'))
    if (email === null) return json({ erro: 'dev', detalhe: 'Porta de dev: falta ?eu=<email>' }, 400)
    const origem = url.searchParams.get('origem') === 'app' ? 'app' : 'site'
    url.searchParams.delete('eu')
    url.searchParams.delete('origem')
    return encaminhar(new Request(url.toString(), request), env, { email, origem })
  },
} satisfies ExportedHandler<Env>
