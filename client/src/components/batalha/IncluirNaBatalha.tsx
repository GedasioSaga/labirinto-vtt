import { useMemo, useState } from 'react'
import type { LadoDoNpc } from '../../lib/batalha/equipes'
import type { EscolhaDaBatalha } from '../../lib/livros/combate'
import { personagensAtivos, useAdventureStore } from '../../stores/adventureStore'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { Acoes, Botao } from '../grimorio/Botao'
import { QuemEntraNaBatalha } from '../livro/QuemEntraNaBatalha'
import { useEscolhaNoMapa } from './escolhaNoMapa'
import { avisoDeForaDaOrdem, lerQuemPodeEntrar, prepararQuemEntra, type ListaDeQuemEntra } from './fichasDeQuemEntra'
import { porNpcNoLado } from './ladoDoNpcNaTela'

/** O "Incluir" põe cada NPC no lado depois de ele entrar na ordem; a preparação das fichas não mexe em lado. */
const SEM_LADOS: ReadonlyMap<string, LadoDoNpc> = new Map()

/**
 * Conserto de 09/11/2026 (achado 2): o "Incluir" da batalha em curso. No lugar
 * da lista suspensa "Fora da ordem" (que quebrava no livro estreito e incluía
 * um por vez), abre a MESMA lista do "Iniciar batalha": quem está fora da
 * ordem, com o número dos repetidos, a vida, o lado de cada NPC e o clique na
 * ficha do mapa. Ninguém vem marcado (ou só quem o mestre selecionou no mapa).
 */
export function IncluirNaBatalha({ sceneKey }: { sceneKey: string }) {
  const turnos = useBatalhaStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey]?.turnos : undefined))
  const fichas = useMapStore((state) => state.map.tokens)
  const personagens = useAdventureStore(personagensAtivos)
  const [caixa, setCaixa] = useState<{ chave: number; lista: ListaDeQuemEntra } | null>(null)
  const noMapa = useEscolhaNoMapa(caixa !== null)
  const jaNaOrdem = useMemo(() => {
    const naOrdem = new Set((turnos?.cartas ?? []).map((carta) => carta.tokenId))
    // O invocado age na carta do bando do dono; "Incluir" daria a ele uma segunda vez na ordem.
    for (const invocado of turnos?.invocados ?? []) naOrdem.add(invocado.tokenId)
    return naOrdem
  }, [turnos])
  // A conta do aviso sai da MESMA leitura da lista (segunda auditoria, achado 5: o aviso dizia 5 e a lista mostrava 4).
  // As fichas do mapa e as da aventura só estão aqui para a conta se refazer quando uma delas muda; quem lê é `lerQuemPodeEntrar`.
  const aviso = useMemo(() => avisoDeForaDaOrdem(lerQuemPodeEntrar({ jaNaOrdem })), [jaNaOrdem, fichas, personagens])

  const confirmar = (escolhas: EscolhaDaBatalha[], lados: ReadonlyMap<string, LadoDoNpc>) => {
    setCaixa(null)
    const entram = prepararQuemEntra(escolhas, SEM_LADOS)
    if (entram === null) return
    for (const token of entram) {
      useBatalhaStore.getState().incluirCombatente(sceneKey, token)
      // O lado vai DEPOIS de entrar na ordem: com a carta na batalha, a troca de lado fica no registro (segunda auditoria, achado 2).
      const lado = lados.get(token.id)
      if (lado !== undefined) porNpcNoLado(token.characterId, lado)
    }
  }

  if (caixa !== null)
    return (
      <QuemEntraNaBatalha
        key={caixa.chave}
        aberto
        titulo="Incluir na batalha"
        rotuloDoConfirmar={(quantos) => `Incluir ${quantos}`}
        candidatos={caixa.lista.candidatos}
        jogadoresSemFicha={caixa.lista.jogadoresSemFicha}
        modelos={caixa.lista.modelos}
        personagens={caixa.lista.personagens}
        rotulos={caixa.lista.rotulos}
        marcadosDePartida={caixa.lista.marcadosDePartida}
        avisoDaSelecao={caixa.lista.avisoDaSelecao}
        ladoDe={caixa.lista.ladoDe}
        onDestacar={noMapa.destacar}
        cliqueNoMapa={noMapa.clique}
        onConfirmar={confirmar}
        onCancelar={() => setCaixa(null)}
      />
    )
  if (aviso === null) return <p className="bt-texto">Toda ficha da cena já está na ordem.</p>
  return (
    <>
      <p className="bt-texto">{aviso}</p>
      <Acoes>
        {/* Lida no clique, antes de a lista tomar a seleção do mapa: as fichas selecionadas já vêm marcadas. */}
        <Botao onClick={() => setCaixa((antes) => ({ chave: (antes?.chave ?? 0) + 1, lista: lerQuemPodeEntrar({ jaNaOrdem }) }))}>Incluir na batalha…</Botao>
      </Acoes>
    </>
  )
}
