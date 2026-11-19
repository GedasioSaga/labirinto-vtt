import { useCallback, useEffect, useMemo, useState } from 'react'
import { fichasDaCena } from '../../../lib/dbt/batalha/leitura'
import type { AcaoDoMestreDBT, AutorDBT, ComandoDBT } from '../../../lib/dbt/batalha/tipos'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../../../stores/adventureStore'
import { useBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import { useMapStore } from '../../../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../../../stores/rpgStore'
import { abertoNaCena, abrirPelaCarta, fecharOAbertoPelaCarta, useAbertoPelaCarta } from '../../batalha/abertoPelaCarta'
import type { ItemDoMenuDaCarta } from '../../batalha/MenuDaCarta'
import { PerfilDaCarta } from '../../batalha/PerfilDaCarta'
import { cartasDaBatalha, type CartaDBT, type Fichas } from './dadosDaBatalhaDBT'
import { faixaDoMestreDBT, nomeDoLadoDBT, type CartaNaFaixaDBT } from './dadosDaFaixaDBT'
import { FaixaDaOrdemDBT } from './FaixaDaOrdemDBT'
import { CaixaDaOrdemDBT, itensDoMestreDBT, ladosDaBatalhaDBT, type ContextoDoMenuDBT } from './OrdemDoMestreDBT'
import { linhasDoMestreDBT } from './RegistroDBT'

/**
 * A FAIXA DA ORDEM DBT na tela do MESTRE (seção 18, `App.tsx:3319`): lê a
 * batalha DBT da cena aberta e monta a faixa, o menu de cada carta (o mesmo
 * da ordem do painel, mais "Ver perfil") e o perfil só leitura. Tudo chama a
 * `batalhaDBTStore` direto; o host avisa os jogadores pelo
 * `deveAvisarJogadoresDBT` do App. Fora de batalha, não desenha nada.
 */

export interface FaixaDoMestreDBTProps {
  /** A cena aberta (`tableSceneKey`). */
  sceneKey: string
  className?: string
}

const MESTRE: AutorDBT = { tipo: 'mestre' }
const SEM_FICHAS: Fichas = new Map()
/** A recusa some sozinha depois deste tempo (ou na próxima ação que passar). */
const AVISO_MS = 6000

/**
 * O menu da carta DBT do mestre: "Ver perfil" e o menu da ordem (`itensDoMestreDBT`). Um lugar só
 * para a faixa do alto e a mesa da batalha (doca e janela à parte, `batalhaJanela/espelhoDBT.ts`);
 * o perfil e as caixas abrem por `abertoPelaCarta` e a faixa da cena desenha.
 */
export function itensDaCartaDoMestreDBT(sceneKey: string, carta: CartaDBT, personagemId: string | null, contexto: Omit<ContextoDoMenuDBT, 'abrirCaixa'>): ItemDoMenuDaCarta[] {
  const perfil: ItemDoMenuDaCarta[] =
    personagemId === null ? [] : [{ id: 'perfil', rotulo: 'Ver perfil', detalhe: 'A ficha só para ler', abreNoApp: true, onEscolher: () => abrirPelaCarta(sceneKey, { tipo: 'perfil', personagemId }) }]
  return [...perfil, ...itensDoMestreDBT(carta, { ...contexto, abrirCaixa: (caixa) => abrirPelaCarta(sceneKey, { tipo: 'caixaDBT', caixa }) })]
}

export function FaixaDoMestreDBT({ sceneKey, className }: FaixaDoMestreDBTProps) {
  const cena = useBatalhaDBTStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined))
  const tokens = useMapStore((state) => state.map.tokens)
  const personagens = useAdventureStore(personagensAtivos)
  const equipes = useAdventureStore(equipesAtivas)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const sistema = useMemo(() => sistemaPorId(biblioteca, sistemaId) ?? null, [biblioteca, sistemaId])
  // O que o menu da carta abriu (daqui, da mesa encostada no mapa ou da janela à parte): a faixa desenha, mesmo escondida.
  const perfilId = useAbertoPelaCarta((state) => abertoNaCena(state, sceneKey, 'perfil')?.personagemId ?? null)
  const caixa = useAbertoPelaCarta((state) => abertoNaCena(state, sceneKey, 'caixaDBT')?.caixa ?? null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (aviso === null) return
    const prazo = window.setTimeout(() => setAviso(null), AVISO_MS)
    return () => window.clearTimeout(prazo)
  }, [aviso])

  // Ficha apagada do mapa sai da batalha (e a vez que estava nela anda), como na One Piece (18/11/2026).
  const ligada = cena !== undefined
  useEffect(() => {
    if (ligada) useBatalhaDBTStore.getState().normalizarCena(sceneKey, new Set(tokens.map((token) => token.id)))
  }, [ligada, sceneKey, tokens])

  const combatentes = cena?.combatentes
  const fichas = useMemo<Fichas>(() => (combatentes === undefined ? SEM_FICHAS : fichasDaCena(personagens, sistema, Object.values(combatentes))), [personagens, sistema, combatentes])
  const cartas = useMemo(() => (cena === undefined ? [] : cartasDaBatalha(cena, fichas)), [cena, fichas])
  const personagemDe = useCallback((id: string) => (combatentes !== undefined && Object.hasOwn(combatentes, id) ? combatentes[id].personagemId : null), [combatentes])
  const dados = useMemo(
    () => (cena === undefined ? null : faixaDoMestreDBT({ nucleo: cena, cartas, fichas: tokens, personagens, equipes, personagemDe })),
    [cena, cartas, tokens, personagens, equipes, personagemDe],
  )
  const registro = cena?.registro
  const linhas = useMemo(() => (registro === undefined ? [] : linhasDoMestreDBT(registro)), [registro])
  const lados = useMemo(() => ladosDaBatalhaDBT(equipes), [equipes])

  const enviar = useCallback(
    (comando: ComandoDBT): boolean => {
      const resposta = useBatalhaDBTStore.getState().comando(sceneKey, MESTRE, comando)
      setAviso(resposta.ok ? null : (resposta.motivo ?? 'O motor recusou'))
      return resposta.ok
    },
    [sceneKey],
  )
  const mestre = useCallback((acao: AcaoDoMestreDBT) => enviar({ tipo: 'mestre', acao }), [enviar])

  const menuDaCarta = useCallback(
    (naFaixa: CartaNaFaixaDBT): readonly ItemDoMenuDaCarta[] => {
      const carta = cartas.find((candidata) => candidata.id === naFaixa.id)
      if (carta === undefined) return []
      const vez = cena?.fase === 'combate' ? (cena.ordem.vez ?? null) : null
      return itensDaCartaDoMestreDBT(sceneKey, carta, naFaixa.personagemId, { cartas, combate: cena?.fase === 'combate', vez, personagemDe, mestre, lados })
    },
    [sceneKey, cartas, cena, personagemDe, mestre, lados],
  )

  if (cena === undefined || dados === null) return null

  const vez = cena.fase === 'combate' && cena.ordem.vez !== null && Object.hasOwn(cena.combatentes, cena.ordem.vez) ? cena.combatentes[cena.ordem.vez] : null
  const perfil = perfilId === null ? undefined : personagens.find((personagem) => personagem.id === perfilId)
  const ladoDoPerfil = perfil === undefined ? undefined : Object.values(cena.combatentes).find((combatente) => combatente.personagemId === perfil.id)?.lado

  return (
    <>
      <FaixaDaOrdemDBT
        papel="mestre"
        className={className}
        dados={dados}
        onMover={(cartaId, indice) => mestre({ tipo: 'moverCarta', combatenteId: cartaId, posicao: indice })}
        menuDaCarta={menuDaCarta}
        onPassarVez={vez === null ? undefined : () => enviar({ tipo: 'passar', vez: { combatenteId: vez.id, rodada: cena.ordem.rodada, turno: vez.turnosJogados } })}
        registro={linhas}
        onDesfazer={(linhaId) => {
          const ok = useBatalhaDBTStore.getState().desfazer(sceneKey, linhaId, MESTRE)
          setAviso(ok ? null : 'Só a última linha de pé se desfaz: desfaça as de cima primeiro.')
        }}
        aviso={aviso}
      />
      {perfil !== undefined && (
        <PerfilDaCarta
          personagem={perfil}
          sistema={sistema}
          descricao={[ladoDoPerfil === undefined ? undefined : nomeDoLadoDBT(ladoDoPerfil, equipes), perfil.tipo === 'jogador' ? 'Jogador' : 'NPC', 'só leitura'].filter(Boolean).join(' · ')}
          onFechar={fecharOAbertoPelaCarta}
        />
      )}
      {caixa !== null && <CaixaDaOrdemDBT caixa={caixa} onFechar={fecharOAbertoPelaCarta} mestre={mestre} />}
    </>
  )
}
