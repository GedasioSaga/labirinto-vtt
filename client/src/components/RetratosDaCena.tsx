import { pendingRequestsLabel, type ScenePerson } from '../lib/party'

/** Um retrato da linha. `where` = ele está numa cena de dentro da pasta recolhida, e o rótulo diz qual. */
export interface PessoaNaLinha extends ScenePerson {
  where?: string
}

/** Mais que isto e a fileira vira "+N": sete rostos espremidos não se leem. */
const RETRATOS_A_VISTA = 5

/**
 * O texto ao lado dos retratos: os nomes, na ordem deles. Quando todos estão
 * em cenas de dentro da pasta recolhida, diz "lá dentro" — a pasta não é onde
 * eles estão, é onde eles estão DENTRO.
 */
export function nomesDaLinha(pessoas: readonly PessoaNaLinha[]): string {
  if (pessoas.length === 0) return ''
  const nomes = pessoas.map((pessoa) => pessoa.name).join(', ')
  return pessoas.every((pessoa) => pessoa.where !== undefined) ? `${nomes}, lá dentro` : nomes
}

/**
 * A letra do retrato sem foto, legível sobre a cor do jogador: tinta escura na
 * cor clara, pergaminho na escura (a cor da ficha vai do limão ao azul-noite).
 */
export function letraClara(cor: string): boolean {
  const hex = /^#?([0-9a-f]{6})$/i.exec(cor.trim())?.[1]
  if (hex === undefined) return false
  const canal = (inicio: number) => {
    const c = parseInt(hex.slice(inicio, inicio + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luz = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4)
  return luz < 0.18
}

/** A primeira letra do nome, contando acento e emoji como uma letra só. */
function inicial(nome: string): string {
  return Array.from(nome.trim())[0]?.toLocaleUpperCase() ?? '?'
}

interface RetratosDaCenaProps {
  pessoas: readonly PessoaNaLinha[]
  pedidos: number
}

/**
 * ONDE ESTÁ O GRUPO, na linha da cena: um retrato por jogador (a foto da
 * ficha; sem foto, a inicial na cor dele), os nomes ao lado e o selo dos
 * pedidos que esperam o mestre. O nome (e a cena de dentro, na pasta
 * recolhida) está no rótulo e no título de cada retrato — o mouse em cima diz
 * quem é. O texto dos nomes é só para o olho: o leitor de tela já ouviu os
 * retratos.
 */
export function RetratosDaCena({ pessoas, pedidos }: RetratosDaCenaProps) {
  const aVista = pessoas.length > RETRATOS_A_VISTA ? pessoas.slice(0, RETRATOS_A_VISTA - 1) : pessoas
  const escondidas = pessoas.slice(aVista.length)
  const nomes = nomesDaLinha(pessoas)
  return (
    <div className="lb-cenas__gente">
      {pessoas.length > 0 && (
        <span className="lb-cenas__retratos">
          {aVista.map((pessoa) => {
            const rotulo = pessoa.where === undefined ? pessoa.name : `${pessoa.name}, em ${pessoa.where}`
            return (
              <span
                key={pessoa.playerId}
                role="img"
                className={letraClara(pessoa.color) ? 'lb-cenas__retrato lb-cenas__retrato--clara' : 'lb-cenas__retrato'}
                aria-label={rotulo}
                title={rotulo}
                style={{ background: pessoa.color }}
              >
                {pessoa.photo === undefined ? inicial(pessoa.name) : <img src={pessoa.photo} alt="" draggable={false} />}
              </span>
            )
          })}
          {escondidas.length > 0 && (
            <span
              role="img"
              className="lb-cenas__retrato lb-cenas__retrato--mais"
              aria-label={`Mais ${escondidas.length}: ${nomesDaLinha(escondidas)}`}
              title={escondidas.map((pessoa) => (pessoa.where === undefined ? pessoa.name : `${pessoa.name}, em ${pessoa.where}`)).join('\n')}
            >
              +{escondidas.length}
            </span>
          )}
        </span>
      )}
      {nomes !== '' && (
        <span className="lb-cenas__gente-nomes" aria-hidden="true">
          {nomes}
        </span>
      )}
      {pedidos > 0 && <span className="lb-cenas__pedidos">{pendingRequestsLabel(pedidos)}</span>}
    </div>
  )
}
