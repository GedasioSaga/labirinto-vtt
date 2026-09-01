import { describe, expect, it, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import type { Light, Prop } from '../types/map'

/**
 * Onda 3, item 20 (frente D) — `docs/PLANO-REFINAMENTO.md`.
 *
 * `past` em `stores/mapStore.ts` cresce SEM LIMITE hoje: `withHistory`
 * (`:455-462`) e `commitDragHistory` (`:715`) empurram a referência do
 * `map` anterior a cada ação, para sempre — nenhum dos dois poda. Numa
 * sessão longa (o app é um editor desktop Tauri, fica aberto por horas)
 * isso é vazamento de memória de verdade, não estética.
 *
 * ESTE ARQUIVO FICA VERMELHO até o integrador implementar o cap em
 * `stores/mapStore.ts` — ver CONTRATO no relatório do agente. `HISTORY_CAP`
 * abaixo é local a ESTE arquivo de propósito: não é importado de produção,
 * porque ele É a especificação que o integrador precisa bater, não uma
 * checagem de um símbolo que ele ainda não escreveu (se fosse importado de
 * `mapStore.ts` hoje, o import já quebraria o `tsc`, não só o teste).
 *
 * Por que 50, não outro número — medição, não chute:
 * `lib/__fixtures__/legacy-map.json` é um mapa REAL (não sintético), 88
 * paredes + 21 regiões + 38 desenhos = 147 entidades em 16.079 bytes de
 * JSON → ~109 bytes/entidade serializada. Um "mapa grande" na linguagem do
 * próprio plano — mesma densidade, ~10x mais conteúdo, uns ~1500 entidades
 * somando paredes+regiões+tokens+props+escadas+desenhos — serializa em
 * ~165KB; o grafo de objetos JS vivo (arrays com overhead de ponteiro por
 * elemento + cada objeto com sua hidden class, não string crua) costuma
 * ficar entre 2x e 4x o tamanho do JSON equivalente, então ~330-660KB por
 * `MapData` inteiro.
 *
 * `past`/`commitDragHistory` guardam a REFERÊNCIA do mapa anterior, não um
 * `structuredClone` (comentário em `mapStore.ts:451-453`), e as arrays são
 * sempre substituídas por spread novo a cada mutação (nunca editadas
 * in-place) — então o pior caso realista de uma sessão real, em que ações
 * sucessivas tocam tipos de entidade diferentes (parede, depois luz, depois
 * token...), é da ordem de um snapshot quase inteiro por entrada de `past`,
 * não uma fração pequena dele.
 *
 * Cap 50 × ~650KB (pior caso acima) ≈ 32MB no pior cenário — tolerável para
 * um app desktop numa sessão de horas, e 50 passos de desfazer já é
 * generoso para qualquer gesto ISOLADO: a granularidade fina de arrasto e
 * slider (Onda 1, itens 3/4 — `moveTokenLive`/`updateLightIntensityLive` +
 * `commitDragHistory`) já garante que um arrasto de 40 `pointermove` conta
 * como 1 entrada aqui, não 40 — sem essa peça da Onda 1, nenhum cap seria
 * suficiente, porque um único gesto já estouraria qualquer N razoável.
 */
const HISTORY_CAP = 50

function light(id: string): Light {
  return { id, x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 }
}

const prop: Prop = { id: 'p1', src: '/a.png', x: 0, y: 0, width: 64, height: 64, linkedMapPath: null }

describe('poda do histórico via withHistory (ex.: addLight) — past nunca cresce sem limite', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, lights: [] },
      past: [],
      future: [],
    })
  })

  it('past nunca passa de HISTORY_CAP entradas, mesmo depois de HISTORY_CAP + 10 ações', () => {
    const totalActions = HISTORY_CAP + 10
    for (let i = 0; i < totalActions; i++) {
      useMapStore.getState().addLight(light(`l${i}`))
    }

    expect(useMapStore.getState().past.length).toBe(HISTORY_CAP)
    // Poda é só do HISTÓRICO — o mapa atual continua com as 60 luzes.
    expect(useMapStore.getState().map.lights).toHaveLength(totalActions)
  })

  it('ao estourar, descarta a entrada MAIS ANTIGA — nunca a mais recente', () => {
    const totalActions = HISTORY_CAP + 10
    for (let i = 0; i < totalActions; i++) {
      useMapStore.getState().addLight(light(`l${i}`))
    }

    const past = useMapStore.getState().past

    // past[0] (mais antiga que sobrou) é o snapshot capturado ANTES da 11ª
    // chamada (l10) — as 10 primeiras (prevMap de l0..l9, os mapas MAIS
    // VAZIOS) foram descartadas. Se a poda tivesse descartado a mais
    // RECENTE por engano, past[0] teria 0 luzes: seria o prevMap da 1ª
    // chamada, que nunca é candidato a descarte numa poda correta.
    expect(past[0].lights).toHaveLength(10)

    // past[último] é o snapshot capturado antes da ÚLTIMA chamada — tem
    // todas as luzes anteriores a ela.
    expect(past[past.length - 1].lights).toHaveLength(totalActions - 1)
  })

  it('undo() não alcança além do cap: HISTORY_CAP desfazer seguidos param na entrada mais antiga que sobreviveu à poda, não num mapa vazio', () => {
    const totalActions = HISTORY_CAP + 10
    for (let i = 0; i < totalActions; i++) {
      useMapStore.getState().addLight(light(`l${i}`))
    }

    for (let i = 0; i < HISTORY_CAP; i++) {
      useMapStore.getState().undo()
    }

    expect(useMapStore.getState().past).toHaveLength(0)
    // l0..l9 não têm mais como ser desfeitas — a poda descartou o histórico
    // delas antes deste teste sequer começar a desfazer. Um histórico SEM
    // cap chegaria a 0 luzes aqui; um histórico PODADO corretamente para
    // com 10 (as que foram "absorvidas" pela poda, sem entrada de undo).
    expect(useMapStore.getState().map.lights).toHaveLength(10)
  })
})

describe('poda do histórico via commitDragHistory — segundo ponto de push (mapStore.ts:715)', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, props: [prop] },
      past: [],
      future: [],
    })
  })

  it('commitDragHistory também respeita HISTORY_CAP — não é só withHistory que precisa podar', () => {
    const totalDrags = HISTORY_CAP + 10
    for (let i = 0; i < totalDrags; i++) {
      const before = useMapStore.getState().map
      useMapStore.getState().movePropLive('p1', i, i)
      useMapStore.getState().commitDragHistory(before)
    }

    expect(useMapStore.getState().past.length).toBe(HISTORY_CAP)
  })
})
