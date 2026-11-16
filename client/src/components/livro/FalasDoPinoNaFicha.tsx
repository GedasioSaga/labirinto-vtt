import { useState } from 'react'
import { ETIQUETAS_DA_FALA, comFalas, falasDoPino, novaFala } from '../../lib/falasDoPino'
import { useMapStore } from '../../stores/mapStore'
import { dizerFalaAgora, nomesDe, useMesaDoPino } from '../../stores/mesaDoPino'
import type { EtiquetaDaFala, FalaDoPino } from '../../types/cenarioEFalas'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { CampoTexto } from '../grimorio/CampoTexto'
import { Nota } from '../grimorio/Nota'
import type { ShowPinNowCandidate } from '../ShowPinNowControls'
import { mudarPino } from './CenarioDoPinoNaFicha'

/*
 * "?" FALAS E PISTAS NA FICHA DO PINO (P5, protótipo de 15/11, fluxo 3): uma
 * lista curta de coisas para DIZER. Cada entrada nasce oculta; o mestre diz
 * ("Dizer agora", a todos da cena ou a um) ou marca "Livre". O jogador nunca
 * sabe quantas estão ocultas (`lib/falasDoPino.ts`).
 */

const OPCOES_DA_ETIQUETA: readonly OpcaoDoSeg<EtiquetaDaFala>[] = ETIQUETAS_DA_FALA.map((etiqueta) => ({ valor: etiqueta, rotulo: etiqueta }))

export interface FalasDoPinoNaFichaProps {
  pinId: string
  /** Quem pode ouvir agora (conectado, com ficha, nesta cena); `null` = sem sala ou pino oculto. */
  candidatos: readonly ShowPinNowCandidate[] | null
}

function idDeFalaNova(): string {
  return `fala-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Troca as entradas do pino num passo do desfazer; o "?" antigo vira lista na primeira mudança. */
function mudarFalas(pinId: string, mudar: (falas: readonly FalaDoPino[]) => FalaDoPino[]): void {
  mudarPino(pinId, (antes) => comFalas(antes, mudar(falasDoPino(antes))))
}

function mudarFala(pinId: string, falaId: string, mudar: (fala: FalaDoPino) => FalaDoPino): void {
  mudarFalas(pinId, (falas) => falas.map((fala) => (fala.id === falaId ? mudar(fala) : fala)))
}

export function FalasDoPinoNaFicha({ pinId, candidatos }: FalasDoPinoNaFichaProps) {
  const pin = useMapStore((estado) => estado.map.pins.find((um) => um.id === pinId))
  const ditas = useMesaDoPino((estado) => estado.ditas[pinId])
  const [escolhendo, setEscolhendo] = useState<string | null>(null)
  if (pin === undefined || pin.kind !== 'interrogacao') return null
  const falas = falasDoPino(pin)
  const lista = candidatos ?? []
  const jogadores = useMesaDoPino.getState().acoes?.jogadores() ?? []

  const dizer = (falaId: string, ids: readonly string[] | null) => {
    if (dizerFalaAgora(pinId, falaId, ids).ok) setEscolhendo(null)
  }
  const adicionar = () => mudarFalas(pinId, (antes) => [...antes, novaFala(idDeFalaNova(), 'Fala', '')])
  const apagar = (falaId: string) => mudarFalas(pinId, (antes) => antes.filter((fala) => fala.id !== falaId))
  const trocarQuem = (falaId: string, quem: string) =>
    mudarFala(pinId, falaId, (fala) => {
      const nova: FalaDoPino = { ...fala, quem }
      if (quem.trim() === '') delete nova.quem
      return nova
    })
  const trocarLivre = (falaId: string) =>
    mudarFala(pinId, falaId, (fala) => {
      const nova: FalaDoPino = { ...fala, livre: true }
      if (fala.livre === true) delete nova.livre
      return nova
    })

  return (
    <div className="lb-falas-ficha" role="group" aria-label="Falas e pistas: o mestre diz">
      <p className="lb-cenario-ficha__ajuda">Cada entrada fica oculta até você dizer. Livre: qualquer um lê ao tocar. O jogador nunca vê quantas faltam.</p>
      {falas.length === 0 && <Nota>Nenhuma entrada ainda.</Nota>}
      <ol className="lb-falas-ficha__lista">
        {falas.map((fala, indice) => {
          const quemOuviu = ditas?.[fala.id] ?? []
          const estado = fala.livre === true ? 'livre' : quemOuviu.length > 0 ? `dita a ${nomesDe(quemOuviu, jogadores)}` : 'oculta'
          const podeDizer = candidatos !== null && lista.length > 0 && fala.texto.trim() !== ''
          return (
            <li key={fala.id} className="lb-falas-ficha__entrada" data-livre={fala.livre === true ? '' : undefined}>
              <div className="lb-falas-ficha__cabeca">
                <span className="lb-falas-ficha__numero">{indice + 1}</span>
                <em className="lb-falas-ficha__estado">{estado}</em>
              </div>
              <CampoSeg rotulo="Tipo" nomeAcessivel={`Tipo da entrada ${indice + 1}`} opcoes={OPCOES_DA_ETIQUETA} valor={fala.etiqueta} onChange={(etiqueta) => mudarFala(pinId, fala.id, (antes) => ({ ...antes, etiqueta }))} />
              <CampoTexto id={`lb-fala-quem-${fala.id}`} rotulo="Quem diz" placeholder="Bento (opcional)" valor={fala.quem ?? ''} maxLength={60} onChange={(quem) => trocarQuem(fala.id, quem)} />
              <CampoTexto id={`lb-fala-texto-${fala.id}`} rotulo="O que diz · o jogador lê" valor={fala.texto} multilinha onChange={(texto) => mudarFala(pinId, fala.id, (antes) => ({ ...antes, texto }))} />
              <Acoes>
                <button type="button" className="lb-falas-ficha__livre" aria-pressed={fala.livre === true} onClick={() => trocarLivre(fala.id)}>
                  Livre
                </button>
                {podeDizer && escolhendo !== fala.id && (
                  <>
                    <Botao variante="primario" tamanho="p" onClick={() => dizer(fala.id, null)}>
                      Dizer agora
                    </Botao>
                    <Botao variante="latao" tamanho="p" onClick={() => setEscolhendo(fala.id)}>
                      Dizer a…
                    </Botao>
                  </>
                )}
                <Botao variante="fantasma" tamanho="p" onClick={() => apagar(fala.id)}>
                  Apagar
                </Botao>
              </Acoes>
              {podeDizer && escolhendo === fala.id && (
                <div className="lb-cenario-ficha__chips" role="group" aria-label="Dizer a quem">
                  {lista.map((c) => (
                    <button key={c.playerId} type="button" className="lb-cenario-ficha__chip" onClick={() => dizer(fala.id, [c.playerId])}>
                      <span className="lb-cenario-ficha__ponto" style={{ background: c.color }} aria-hidden="true" />
                      {c.name}
                    </button>
                  ))}
                  <button type="button" className="lb-cenario-ficha__chip" onClick={() => setEscolhendo(null)}>
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {candidatos === null && <Nota>Dizer agora precisa da sala aberta e do pino visível aos jogadores.</Nota>}
      {candidatos !== null && lista.length === 0 && <Nota>Nenhum jogador conectado está nesta cena.</Nota>}
      <Acoes>
        <Botao variante="latao" tamanho="p" onClick={adicionar}>
          Adicionar entrada
        </Botao>
      </Acoes>
    </div>
  )
}
