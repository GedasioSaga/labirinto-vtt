import { pastilhasAcesas } from '../lib/turnoForaDaBatalha'
import { recursoDeVida, vidaDoPersonagem } from '../lib/vidaDaFicha'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import type { Token } from '../types/map'
import { PastilhaDeCondicao } from './PastilhaDeCondicao'
import './TurnoForaDaBatalha.css'

/** Abaixo disto (fração da vida) a barra fica na cor do perigo, como no protótipo. */
const VIDA_BAIXA = 0.35

/** O token da linha: no editor (cena aberta ou mapa solto) ou numa cena de fundo já carregada. `undefined` = fora de alcance. */
function useTokenDaLinha(tokenId: string, sceneId: string | null): Token | undefined {
  const ativa = useAdventureStore((state) => state.activeSceneId)
  const noEditor = useMapStore((state) => state.map.tokens.find((token) => token.id === tokenId))
  const noFundo = useAdventureStore((state) => {
    if (sceneId === null || !Object.hasOwn(state.cache, sceneId)) return undefined
    const slot = state.cache[sceneId]
    return slot.status === 'ok' ? slot.map.tokens.find((token) => token.id === tokenId) : undefined
  })
  return sceneId === null || sceneId === ativa ? noEditor : noFundo
}

/** "Envenenado, faltam 2 turnos" para quem não vê a pastilha. */
function nomeDaPastilha(nome: string, turnos: number | null): string {
  if (turnos === null) return nome
  return `${nome}, ${turnos === 1 ? 'falta 1 turno' : `faltam ${turnos} turnos`}`
}

/**
 * A VIDA E AS CONDIÇÕES na linha do jogador no Grupo (Fase C, item 4): "40/60
 * PV" (o mestre vê os pontos: `vidaDoPersonagem`, a mesma conta da barra sob o
 * token), o trilho da vida e as pastilhas acesas com os turnos que faltam.
 * Sem ficha ligada ou sem vida no sistema: só as pastilhas; sem nada, nada.
 * Mora dentro do botão da linha: o texto entra no nome dele ("40/60 PV,
 * Envenenado, faltam 2 turnos").
 */
export function VidaNaLinhaDoGrupo({ tokenId, sceneId }: { tokenId: string; sceneId: string | null }) {
  const token = useTokenDaLinha(tokenId, sceneId)
  const personagens = useAdventureStore(personagensAtivos)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  if (token === undefined) return null
  const recurso = recursoDeVida(sistemaPorId(biblioteca, sistemaId) ?? null)
  const personagem = token.characterId === null ? undefined : personagens.find((candidato) => candidato.id === token.characterId)
  const vida = personagem === undefined || recurso === null ? null : vidaDoPersonagem(personagem, recurso)
  const pastilhas = pastilhasAcesas(token)
  if (vida === null && pastilhas.length === 0) return null
  const fracao = vida === null ? 0 : vida.atual / vida.maximo
  return (
    <span className="gr-vida-linha">
      {vida !== null && (
        <>
          <span className="gr-vida-linha__pv">
            {vida.atual}/{vida.maximo} PV
          </span>
          <span className="gr-vida-linha__trilho" aria-hidden="true">
            <i style={{ transform: `scaleX(${fracao.toFixed(3)})` }} data-baixa={fracao < VIDA_BAIXA ? '' : undefined} />
          </span>
        </>
      )}
      {pastilhas.length > 0 && (
        <span className="gr-vida-linha__conds">
          {pastilhas.map((pastilha) => {
            const turnos = pastilha.prazo?.turnos ?? null
            const nome = nomeDaPastilha(pastilha.nome, turnos)
            return (
              <span key={pastilha.chave} className="gr-vida-linha__cond" title={nome}>
                {' '}
                <PastilhaDeCondicao symbol={pastilha.symbol} tamanho={14} />
                {turnos !== null && <span aria-hidden="true">{turnos}</span>}
                <span className="lb-sr-only">{nome}</span>
              </span>
            )
          })}
        </span>
      )}
    </span>
  )
}
