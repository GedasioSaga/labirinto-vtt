import { useId } from 'react'
import { prazosDaFicha } from '../lib/prazoDaCondicao'
import { useBatalhaDBTStore } from '../stores/batalhaDBTStore'
import { useBatalhaStore } from '../stores/batalhaStore'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { turnoDaCena, useTurnoForaDaBatalhaStore, type PasseDoTurno } from '../stores/turnoForaDaBatalha'
import type { Token } from '../types/map'
import { Botao } from './grimorio/Botao'
import { IconeDoLivro } from './livro/icones'
import './TurnoForaDaBatalha.css'

/** O aviso do passe fica o bastante para o mestre ler a linha e achar o Desfazer. */
const AVISO_DO_PASSE_MS = 9000

export const PASSAR_TURNO_LABEL = 'Passar turno'
export const NINGUEM_COM_PRAZO = 'Ninguém com condição que conta turno agora.'
export const NOTA_DO_TURNO = 'Cada turno passado tira a vida de quem perde por turno e desconta 1 turno de cada condição.'
export const SO_O_ULTIMO_SE_DESFAZ = 'Só o último turno passado se desfaz.'

/** Quantas fichas da cena aberta têm prazo aceso (a de pastilha apagada não conta). */
function contarComPrazo(tokens: readonly Token[]): number {
  return tokens.reduce((soma, token) => (prazosDaFicha(token).length > 0 ? soma + 1 : soma), 0)
}

function avisarOPasse(passe: PasseDoTurno): void {
  const toasts = useToastStore.getState()
  toasts.push('info', `Turno ${passe.depois.numero}. ${passe.partes.join('. ')}.`, AVISO_DO_PASSE_MS, {
    actions: [
      {
        label: 'Desfazer',
        run: () => {
          if (!useTurnoForaDaBatalhaStore.getState().desfazer(passe)) useToastStore.getState().push('error', SO_O_ULTIMO_SE_DESFAZ)
        },
      },
    ],
  })
}

/**
 * O TURNO FORA DA BATALHA no topo do Grupo (Fase C, item 4, protótipo
 * aprovado em 15/11/2026, tela "Condições e turno"): "Fora da batalha /
 * Turno N", o botão "Passar turno" e a linha do último passe. Com batalha
 * ligada na cena (One Piece ou Dragon Ball) o bloco some: lá quem conta é a
 * vez de cada ficha.
 *
 * Sem ninguém com prazo o botão fica à vista mas não age (`aria-disabled`,
 * com o motivo lido junto): o mestre aprende onde ele mora antes de precisar.
 * Sem animação: é clique de toda rodada, e a resposta é o número e a linha.
 */
export function TurnoForaDaBatalha({ sceneKey }: { sceneKey: string }) {
  const motivoId = useId()
  const emBatalha = useBatalhaStore((state) => Object.hasOwn(state.cenas, sceneKey))
  const emBatalhaDBT = useBatalhaDBTStore((state) => Object.hasOwn(state.cenas, sceneKey))
  const comPrazo = useMapStore((state) => contarComPrazo(state.map.tokens))
  const turno = useTurnoForaDaBatalhaStore((state) => turnoDaCena(state.cenas, sceneKey))
  if (emBatalha || emBatalhaDBT) return null
  const parado = comPrazo === 0
  const passar = (): void => {
    if (parado) return
    const passe = useTurnoForaDaBatalhaStore.getState().passar(sceneKey)
    if (passe !== null) avisarOPasse(passe)
  }
  return (
    <section className="gr-turno" aria-label="Turno fora da batalha">
      <div className="gr-turno__cab">
        <span className="gr-ficha__med" aria-hidden="true">
          <IconeDoLivro nome="relogio" />
        </span>
        <div className="gr-turno__num">
          <small>Fora da batalha</small>
          <b>Turno {turno.numero}</b>
        </div>
        <Botao variante="primario" tamanho="p" aria-disabled={parado || undefined} aria-describedby={parado ? motivoId : undefined} onClick={passar}>
          {PASSAR_TURNO_LABEL}
        </Botao>
      </div>
      {turno.resumo !== null && <p className="gr-turno__log">{turno.resumo}</p>}
      {parado ? (
        <p className="gr-nota" id={motivoId}>
          {NINGUEM_COM_PRAZO}
        </p>
      ) : (
        <p className="gr-nota">{NOTA_DO_TURNO}</p>
      )}
    </section>
  )
}
