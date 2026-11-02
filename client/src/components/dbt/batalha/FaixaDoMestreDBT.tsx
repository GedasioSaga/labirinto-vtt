import { useCallback, useEffect, useMemo, useState } from 'react'
import { fichasDaCena } from '../../../lib/dbt/batalha/leitura'
import type { AcaoDoMestreDBT, AutorDBT, ComandoDBT } from '../../../lib/dbt/batalha/tipos'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../../../stores/adventureStore'
import { useBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import { useMapStore } from '../../../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../../../stores/rpgStore'
import type { ItemDoMenuDaCarta } from '../../batalha/MenuDaCarta'
import { PerfilDaCarta } from '../../batalha/PerfilDaCarta'
import { cartasDaBatalha, type Fichas } from './dadosDaBatalhaDBT'
import { faixaDoMestreDBT, nomeDoLadoDBT, type CartaNaFaixaDBT } from './dadosDaFaixaDBT'
import { FaixaDaOrdemDBT } from './FaixaDaOrdemDBT'
import { CaixaDaOrdemDBT, itensDoMestreDBT, ladosDaBatalhaDBT, type CaixaDoMenuDBT } from './OrdemDoMestreDBT'
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

export function FaixaDoMestreDBT({ sceneKey, className }: FaixaDoMestreDBTProps) {
  const cena = useBatalhaDBTStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined))
  const tokens = useMapStore((state) => state.map.tokens)
  const personagens = useAdventureStore(personagensAtivos)
  const equipes = useAdventureStore(equipesAtivas)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const sistema = useMemo(() => sistemaPorId(biblioteca, sistemaId) ?? null, [biblioteca, sistemaId])
  const [perfilId, setPerfilId] = useState<string | null>(null)
  const [caixa, setCaixa] = useState<CaixaDoMenuDBT | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (aviso === null) return
    const prazo = window.setTimeout(() => setAviso(null), AVISO_MS)
    return () => window.clearTimeout(prazo)
  }, [aviso])

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
      const itens: ItemDoMenuDaCarta[] = []
      const personagemId = naFaixa.personagemId
      if (personagemId !== null) itens.push({ id: 'perfil', rotulo: 'Ver perfil', detalhe: 'A ficha só para ler', onEscolher: () => setPerfilId(personagemId) })
      const vez = cena?.fase === 'combate' ? (cena.ordem.vez ?? null) : null
      return [...itens, ...itensDoMestreDBT(carta, { cartas, combate: cena?.fase === 'combate', vez, personagemDe, mestre, abrirCaixa: setCaixa, lados })]
    },
    [cartas, cena, personagemDe, mestre, lados],
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
          onFechar={() => setPerfilId(null)}
        />
      )}
      {caixa !== null && <CaixaDaOrdemDBT caixa={caixa} onFechar={() => setCaixa(null)} mestre={mestre} />}
    </>
  )
}
