import { describe, expect, it } from 'vitest'
import { lerPedidoDaSala, urlDaSalaValida, type TipoDoEndereco } from '../../../../lobby/nuvem/src/salaAberta'

/**
 * A forma dos endereços da sala aberta no app (lobby/nuvem/src/salaAberta.ts,
 * fatia B2). O site navega para essa URL com o bilhete no fragmento, então o DO
 * só guarda a página do jogador numa rede local ou num túnel rápido da Cloudflare.
 */

const ACEITAS: readonly [TipoDoEndereco, string][] = [
  ['lan', 'http://192.168.0.10:7878/player'],
  ['lan', 'http://10.0.0.1:1/player'],
  ['lan', 'http://172.16.5.4:65535/player'],
  ['lan', 'http://172.31.255.255:8080/player'],
  ['tunel', 'https://alfa-beta-gama-delta.trycloudflare.com/player'],
]

const RECUSADAS: readonly [TipoDoEndereco, string, string][] = [
  ['lan', 'http://8.8.8.8:7878/player', 'IP público'],
  ['lan', 'http://172.32.0.1:7878/player', 'fora do 172.16/12'],
  ['lan', 'http://100.64.0.1:7878/player', 'VPN (100.64/10)'],
  ['lan', 'http://127.0.0.1:7878/player', 'loopback'],
  ['lan', 'http://192.168.0.10/player', 'sem a porta'],
  ['lan', 'http://192.168.0.10:0/player', 'porta 0'],
  ['lan', 'http://192.168.0.10:65536/player', 'porta acima de 65535'],
  ['lan', 'http://192.168.0.010:7878/player', 'zero à esquerda no IP'],
  ['lan', 'http://192.168.0.256:7878/player', 'octeto acima de 255'],
  ['lan', 'https://192.168.0.10:7878/player', 'https na rede local'],
  ['lan', 'http://192.168.0.10:7878/player/', 'barra no fim'],
  ['lan', 'http://192.168.0.10:7878/player?x=1', 'query'],
  ['lan', 'http://usuario@192.168.0.10:7878/player', 'usuário na URL'],
  ['lan', 'https://alfa-beta.trycloudflare.com/player', 'túnel com o tipo lan'],
  ['tunel', 'http://192.168.0.10:7878/player', 'rede local com o tipo tunel'],
  ['tunel', 'http://alfa-beta.trycloudflare.com/player', 'túnel sem https'],
  ['tunel', 'https://api.trycloudflare.com/player', 'rótulo sem hífen (api.)'],
  ['tunel', 'https://Alfa-Beta.trycloudflare.com/player', 'maiúscula no nome'],
  ['tunel', 'https://alfa-beta.trycloudflare.com.mal.example/player', 'outro domínio no fim'],
  ['tunel', 'https://x.alfa-beta.trycloudflare.com/player', 'dois rótulos'],
  ['tunel', 'https://alfa-beta.trycloudflare.com/player#entrar=x', 'fragmento'],
  ['tunel', `https://${'a'.repeat(60)}-bbbb.trycloudflare.com/player`, 'rótulo acima de 63'],
  ['tunel', 'javascript:alert(1)//.trycloudflare.com/player', 'javascript:'],
]

describe('endereço da sala aberta (B2)', () => {
  it('aceita a página do jogador num IPv4 privado com porta e num túnel rápido, e o pedido as lê na ordem', () => {
    for (const [tipo, url] of ACEITAS) expect(urlDaSalaValida(tipo, url), `${tipo} ${url}`).toBe(true)
    const enderecos = ACEITAS.map(([tipo, url]) => ({ tipo, url })).slice(0, 4)
    expect(lerPedidoDaSala({ codigo: 'ABC234', enderecos })).toEqual({ codigo: 'ABC234', enderecos })
  })

  it('recusa IP público, VPN, sem porta, forma não canônica, tipo trocado e outro domínio; o pedido com um deles dá 400', () => {
    for (const [tipo, url, motivo] of RECUSADAS) expect(urlDaSalaValida(tipo, url), motivo).toBe(false)
    for (const [tipo, url, motivo] of RECUSADAS) {
      expect(erroDe(() => lerPedidoDaSala({ codigo: 'ABC234', enderecos: [{ tipo, url }] })), motivo).toMatchObject({ status: 400, codigo: 'fora-do-formato' })
    }
  })
})

/** O erro que o passo lançou; `null` = não lançou (e o `toMatchObject` reprova). */
function erroDe(passo: () => unknown): unknown {
  try {
    passo()
  } catch (erro) {
    return erro
  }
  return null
}
