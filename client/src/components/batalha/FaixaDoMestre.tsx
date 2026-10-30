import { useCallback, useEffect, useMemo, useState } from 'react'
import { equipeDe } from '../../lib/batalha/equipes'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../../stores/adventureStore'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { faixaDoMestre, linhasDoMestre, type DadosDaCarta } from './dadosDaFaixa'
import { FaixaDaOrdem } from './FaixaDaOrdem'
import type { ItemDoMenuDaCarta } from './MenuDaCarta'
import { PerfilDaCarta } from './PerfilDaCarta'

/**
 * A FAIXA DA ORDEM na tela do MESTRE: lê a batalha da cena aberta na store e
 * monta a faixa, o menu de cada carta e o perfil. Toda ação é chamada direta
 * na `batalhaStore` (o host roda no mesmo processo e avisa os jogadores pelo
 * `deveAvisarJogadores` do App). Fora de batalha, não desenha nada.
 */

export interface FaixaDoMestreProps {
  /** A cena aberta (`tableSceneKey`). */
  sceneKey: string
}

const MESTRE = { tipo: 'mestre' } as const

export function FaixaDoMestre({ sceneKey }: FaixaDoMestreProps) {
  const cena = useBatalhaStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined))
  const fichas = useMapStore((state) => state.map.tokens)
  const personagens = useAdventureStore(personagensAtivos)
  const equipes = useAdventureStore(equipesAtivas)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const sistema = useMemo(() => sistemaPorId(biblioteca, sistemaId) ?? null, [biblioteca, sistemaId])
  const [perfilId, setPerfilId] = useState<string | null>(null)

  // Ficha apagada do mapa sai da ordem (e a vez que estava nela anda).
  const ligada = cena !== undefined
  useEffect(() => {
    if (ligada) useBatalhaStore.getState().normalizarCena(sceneKey, new Set(fichas.map((ficha) => ficha.id)))
  }, [ligada, sceneKey, fichas])

  const turnos = cena?.turnos
  const dados = useMemo(
    () => (turnos === undefined ? null : faixaDoMestre({ turnos, fichas, personagens, equipes, sistema })),
    [turnos, fichas, personagens, equipes, sistema],
  )
  const registro = useMemo(() => (cena === undefined ? [] : linhasDoMestre(cena.registro)), [cena])

  const menuDaCarta = useCallback(
    (carta: DadosDaCarta): readonly ItemDoMenuDaCarta[] => {
      const store = useBatalhaStore.getState()
      const indice = dados?.cartas.findIndex((candidata) => candidata.id === carta.id) ?? -1
      const itens: ItemDoMenuDaCarta[] = []
      const personagemId = carta.personagemId
      if (personagemId !== null) {
        itens.push({ id: 'perfil', rotulo: 'Ver perfil', detalhe: 'A ficha só para ler', onEscolher: () => setPerfilId(personagemId) })
        itens.push({ id: 'ficha', rotulo: 'Abrir a ficha', detalhe: 'Ajustar HP e SP entra no registro', onEscolher: () => useRpgStore.getState().abrirFicha(personagemId) })
      }
      const jaEaVez = carta.id === dados?.vez
      itens.push({
        id: 'vez',
        secao: 'Vez',
        rotulo: 'Dar a vez',
        detalhe: jaEaVez ? 'Já é a vez desta carta' : carta.caiu ? 'Caiu, mas pode jogar se você der a vez' : undefined,
        desabilitado: jaEaVez,
        onEscolher: () => store.darVez(sceneKey, carta.id),
      })
      itens.push({
        id: 'extra-rodada',
        rotulo: 'Agir de novo nesta rodada',
        detalhe: 'Carta extra logo depois; some na próxima rodada',
        onEscolher: () => store.adicionarCartaExtra(sceneKey, carta.tokenId, indice + 1, 'rodada'),
      })
      itens.push({
        id: 'extra-sempre',
        rotulo: 'Agir de novo em todas as rodadas',
        detalhe: 'Carta extra logo depois; fica até você tirar',
        onEscolher: () => store.adicionarCartaExtra(sceneKey, carta.tokenId, indice + 1, 'sempre'),
      })
      if (carta.extra !== null) itens.push({ id: 'tirar-extra', rotulo: 'Tirar esta carta extra', onEscolher: () => store.removerCarta(sceneKey, carta.id) })
      if (personagemId !== null) {
        if (equipes.length === 0) {
          itens.push({ id: 'equipe-nenhuma', secao: 'Equipe', rotulo: 'Sem equipes', detalhe: 'Crie equipes no painel da batalha, no livro da mesa', desabilitado: true, onEscolher: () => {} })
        } else {
          const atual = equipeDe(personagemId, equipes)?.id ?? null
          equipes.forEach((equipe, i) =>
            itens.push({
              id: `equipe-${equipe.id}`,
              secao: i === 0 ? 'Equipe' : undefined,
              rotulo: equipe.nome,
              cor: equipe.cor,
              marcado: atual === equipe.id,
              onEscolher: () => store.trocarEquipe(personagemId, equipe.id),
            }),
          )
          itens.push({ id: 'equipe-sem', rotulo: 'Sem equipe', marcado: atual === null, onEscolher: () => store.trocarEquipe(personagemId, null) })
        }
      }
      itens.push({
        id: 'tirar',
        secao: 'Batalha',
        rotulo: 'Tirar da batalha',
        detalhe: 'Sai da ordem com as cartas extras; o Desfazer do registro volta',
        perigo: true,
        onEscolher: () => store.tirarCombatente(sceneKey, carta.tokenId),
      })
      return itens
    },
    [dados, equipes, sceneKey],
  )

  if (cena === undefined || dados === null) return null
  const perfil = perfilId === null ? undefined : personagens.find((personagem) => personagem.id === perfilId)
  const equipeDoPerfil = perfil === undefined ? null : equipeDe(perfil.id, equipes)

  return (
    <>
      <FaixaDaOrdem
        papel="mestre"
        dados={dados}
        onMover={(cartaId, indice) => useBatalhaStore.getState().moverCarta(sceneKey, cartaId, indice)}
        menuDaCarta={menuDaCarta}
        onPassarVez={dados.cartas.length === 0 ? undefined : () => useBatalhaStore.getState().passarVez(sceneKey, MESTRE)}
        regras={cena.regras}
        registro={registro}
        onDesfazer={(linhaId) => useBatalhaStore.getState().desfazer(sceneKey, linhaId, MESTRE)}
      />
      {perfil !== undefined && (
        <PerfilDaCarta
          personagem={perfil}
          sistema={sistema}
          descricao={[equipeDoPerfil?.nome, perfil.tipo === 'npc' ? 'NPC' : 'Jogador', 'só leitura'].filter(Boolean).join(' · ')}
          onFechar={() => setPerfilId(null)}
        />
      )}
    </>
  )
}
