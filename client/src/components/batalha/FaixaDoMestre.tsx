import { useCallback, useEffect, useMemo, useRef } from 'react'
import { equipeDe } from '../../lib/batalha/equipes'
import { aparenciaDaForma } from '../../lib/batalha/transformacao'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../../stores/adventureStore'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { abertoNaCena, abrirPelaCarta, fecharOAbertoPelaCarta, useAbertoPelaCarta } from './abertoPelaCarta'
import { DialogoDoMestreNaCena } from './BatalhaDoMestre'
import { faixaDoMestre, linhasDoMestre, type DadosDaCarta } from './dadosDaFaixa'
import { abrirDestaqueDaFaixa } from './escolhaNoMapa'
import { FaixaDaOrdem } from './FaixaDaOrdem'
import { itensDaCartaDoMestre } from './menuDaCartaDoMestre'
import type { ItemDoMenuDaCarta } from './MenuDaCarta'
import { PassivasDaFicha, alvosDaOrdemParaPassiva, passivasNaCena } from './PassivasDaBatalha'
import { PerfilDaCarta } from './PerfilDaCarta'
import { usePassarVezDoMestre } from './passarVezDoMestre'
import { useTravaDoPassar } from './travaDoPassar'

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
  // O que o menu da carta abriu (daqui, da mesa encostada no mapa ou da janela à parte): a faixa desenha, mesmo escondida.
  const perfilId = useAbertoPelaCarta((state) => abertoNaCena(state, sceneKey, 'perfil')?.personagemId ?? null)
  const dialogo = useAbertoPelaCarta((state) => abertoNaCena(state, sceneKey, 'dialogo')?.dialogo ?? null)

  // Ficha apagada do mapa sai da ordem (e a vez que estava nela anda).
  const ligada = cena !== undefined
  useEffect(() => {
    if (ligada) useBatalhaStore.getState().normalizarCena(sceneKey, new Set(fichas.map((ficha) => ficha.id)))
  }, [ligada, sceneKey, fichas])

  const turnos = cena?.turnos
  const dados = useMemo(
    () => (turnos === undefined ? null : faixaDoMestre({ turnos, fichas, personagens, equipes, sistema, registro: cena?.registro })),
    [turnos, fichas, personagens, equipes, sistema, cena?.registro],
  )
  const registro = useMemo(() => (cena === undefined ? [] : linhasDoMestre(cena.registro)), [cena])
  // Conserto das fichas F1 (bug 7): passa SÓ a vez mostrada; o duplo clique e o clique junto com o do jogador não pulam ninguém.
  const passarAVez = usePassarVezDoMestre(sceneKey, turnos)
  // Conserto de 19/11 (auditoria da mesa): com a mesa recolhida, o Passar a vez daqui espera a reação e o contra-ataque.
  const { trava, seguirSemEsperar } = useTravaDoPassar(sceneKey)

  // Achado 4 (09/11): passar o mouse numa carta acende a ficha dela no mapa (pela seleção do editor); sair devolve a seleção.
  const destaque = useRef<ReturnType<typeof abrirDestaqueDaFaixa> | null>(null)
  useEffect(() => () => destaque.current?.soltar(), [])
  const apontarCarta = useCallback((tokenId: string | null) => {
    destaque.current ??= abrirDestaqueDaFaixa()
    destaque.current.apontar(tokenId)
  }, [])

  const menuDaCarta = useCallback(
    (carta: DadosDaCarta): readonly ItemDoMenuDaCarta[] => (dados === null || turnos === undefined ? [] : itensDaCartaDoMestre(carta, { sceneKey, dados, turnos, personagens, equipes, sistema })),
    [dados, equipes, sceneKey, turnos, personagens, sistema],
  )

  if (cena === undefined || dados === null) return null
  const perfil = perfilId === null ? undefined : personagens.find((personagem) => personagem.id === perfilId)
  const equipeDoPerfil = perfil === undefined ? null : equipeDe(perfil.id, equipes)
  // Tipos de habilidade F3: as passivas do perfil (o mestre ativa e desliga as de qualquer ficha), na primeira carta dele.
  const cartaDoPerfil = perfil === undefined ? undefined : cena.turnos.cartas.find((carta) => carta.personagemId === perfil.id)
  const passivasDoPerfil = perfil === undefined || cartaDoPerfil === undefined ? [] : passivasNaCena(perfil, sistema, cena.turnos, cartaDoPerfil.tokenId)
  const nomeDe = (tokenId: string) => fichas.find((ficha) => ficha.id === tokenId)?.name.trim() || cena.turnos.cartas.find((carta) => carta.tokenId === tokenId)?.nome?.trim() || 'Ficha'
  const mesmoLado = (personagemId: string | null) => equipeDoPerfil !== null && personagemId !== null && equipeDe(personagemId, equipes)?.id === equipeDoPerfil.id

  return (
    <>
      <FaixaDaOrdem
        papel="mestre"
        dados={dados}
        onMover={(cartaId, indice) => useBatalhaStore.getState().moverCarta(sceneKey, cartaId, indice)}
        menuDaCarta={menuDaCarta}
        onPassarVez={dados.cartas.length === 0 ? undefined : passarAVez}
        travaDoPassar={trava === null ? null : { texto: trava, onSeguir: seguirSemEsperar }}
        regras={cena.regras}
        registro={registro}
        onDesfazer={(linhaId) => useBatalhaStore.getState().desfazer(sceneKey, linhaId, MESTRE)}
        onSelo={(carta, seloId) => abrirPelaCarta(sceneKey, { tipo: 'dialogo', dialogo: { tipo: 'selo', tokenId: carta.tokenId, seloId } })}
        onApontar={apontarCarta}
      />
      {perfil !== undefined && (
        <PerfilDaCarta
          personagem={perfil}
          sistema={sistema}
          descricao={[equipeDoPerfil?.nome, perfil.tipo === 'npc' ? 'NPC' : 'Jogador', cartaDoPerfil !== undefined && passivasDoPerfil.length > 0 ? 'ficha só para ler, passivas ativam aqui' : 'só leitura'].filter(Boolean).join(' · ')}
          imagemDaForma={aparenciaDaForma(cena.turnos.formas?.[perfil.id], perfil)}
          onRevelar={(cartaoId) => useBatalhaStore.getState().revelar(perfil.id, cartaoId)}
          passivas={
            cartaDoPerfil === undefined || passivasDoPerfil.length === 0 ? undefined : (
              <PassivasDaFicha
                passivas={passivasDoPerfil}
                tokenId={cartaDoPerfil.tokenId}
                alvos={alvosDaOrdemParaPassiva(cena.turnos.cartas, nomeDe, cartaDoPerfil.tokenId, mesmoLado)}
                sistema={sistema}
                aplicarLivre
                onPedir={(pedido) => useBatalhaStore.getState().passiva(sceneKey, MESTRE, pedido)}
              />
            )
          }
          onFechar={fecharOAbertoPelaCarta}
        />
      )}
      {dialogo !== null && <DialogoDoMestreNaCena sceneKey={sceneKey} dialogo={dialogo} onFechar={fecharOAbertoPelaCarta} />}
    </>
  )
}
