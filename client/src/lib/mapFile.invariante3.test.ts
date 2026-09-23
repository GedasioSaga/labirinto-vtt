// COMANDO DA INVARIANTE 3 — "mapa antigo em map.json sem os campos novos
// continua abrindo, com default preenchido na migração de lib/mapFile.ts".
//
// POR QUE ESTE ARQUIVO EXISTE. `mapFile.test.ts` prova a migração campo a
// campo, com o NOME de cada campo escrito à mão ('preenche defaults quando
// campos opcionais estão ausentes', 'preenche kind: "normal"'…). É prova boa
// para o passado e cega para o futuro: o campo que ESTE run acrescenta não
// está em lista nenhuma, então a suíte inteira fica verde sem nunca saber que
// ele existe — exatamente o buraco que a Invariante 3 quer fechar.
//
// Os testes daqui não citam nome de campo NENHUM. Eles comparam o mapa que o
// app cria hoje com o que volta de um map.json antigo, então um campo novo
// entra na cobertura no mesmo commit em que nasce, sem ninguém lembrar de
// atualizar teste.
import { describe, expect, it } from 'vitest'
import { deserializeMap, serializeMap } from './mapFile'
import { createEmptyMap } from './mapFactory'

/** Um mapa do jeito que o app cria hoje — a referência do que "estar completo" significa. */
const mapaDeHoje = createEmptyMap('map_ref', 'Referência', 30, 20, 64)

/**
 * Campos de topo que podem faltar de propósito depois da migração, com o
 * motivo. Ausência aqui é a resposta certa, não esquecimento.
 */
const AUSENCIA_LEGITIMA_NO_TOPO: Record<string, string> = {
  // `gridOffset` só existe quando a pessoa alinhou a grade a uma imagem de
  // fundo; "sem alinhamento" é `undefined`, e é o estado recuperável
  // (lib/mapFile.ts, `gridOffsetOrNone`).
  gridOffset: 'sem alinhamento de grade é ausência legítima',
}

/**
 * Campos que o mapa de referência tem e o mapa restaurado não trouxe. Função
 * pura de propósito: sem isolá-la não dá para PROVAR que a comparação reprova
 * um campo esquecido — e detector que nunca reprova nada é decoração (último
 * teste deste arquivo).
 */
function camposQueAMigracaoNaoPreencheu(
  referencia: Record<string, unknown>,
  restaurado: Record<string, unknown>,
  ausenciasLegitimas: Record<string, string>,
): string[] {
  return Object.keys(referencia).filter((campo) => !(campo in ausenciasLegitimas) && restaurado[campo] === undefined)
}

describe('Invariante 3 — map.json antigo abre com os campos novos preenchidos', () => {
  it('todo campo que o mapa novo tem volta preenchido num map.json que só traz o id', () => {
    const restaurado = deserializeMap('{"id": "map_antigo"}') as unknown as Record<string, unknown>

    const faltando = camposQueAMigracaoNaoPreencheu(
      mapaDeHoje as unknown as Record<string, unknown>,
      restaurado,
      AUSENCIA_LEGITIMA_NO_TOPO,
    )

    // Mensagem longa de propósito: quem quebrar isto é quem acabou de
    // acrescentar o campo, e precisa saber o que fazer sem abrir este arquivo.
    expect(
      faltando,
      `campo(s) que o mapa novo tem e que a migração de lib/mapFile.ts não preenche: ${faltando.join(', ')}. ` +
        'Acrescente a linha de default em deserializeMapFields — ou, se a ausência for legítima, documente em AUSENCIA_LEGITIMA_NO_TOPO.',
    ).toEqual([])
  })

  it('o mapa que o app cria hoje sobrevive inteiro ao ida-e-volta por disco', () => {
    expect(deserializeMap(serializeMap(mapaDeHoje))).toEqual(mapaDeHoje)
  })

  it('campo NOVO de entidade não é descartado na leitura (parede, sala, escada, desenho, token, objeto)', () => {
    // `campoDeUmaFaseFutura` faz o papel do campo que a próxima feature vai
    // acrescentar: se a migração passar a remontar a entidade campo a campo em
    // vez de copiar o que veio, ele some — e todo dado novo de mapa salvo
    // sumiria junto, calado.
    const marca = { campoDeUmaFaseFutura: 'valor-que-precisa-voltar' }
    const json = JSON.stringify({
      id: 'map_com_campo_novo',
      walls: [{ id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null, ...marca }],
      regions: [{ id: 'r1', points: [], tag: 'sala', data: {}, ...marca }],
      stairs: [{ id: 's1', x: 0, y: 0, width: 64, height: 128, rotation: 0, ...marca }],
      drawings: [{ id: 'd1', kind: 'rect', x: 0, y: 0, width: 10, height: 10, color: '#fff', width2: 2, ...marca }],
      tokens: [{ id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1, image: null, ...marca }],
      props: [{ id: 'p1', src: '/a.png', x: 0, y: 0, width: 64, height: 64, ...marca }],
    })

    const restaurado = deserializeMap(json) as unknown as Record<string, Array<Record<string, unknown>>>
    const listas = ['walls', 'regions', 'stairs', 'drawings', 'tokens', 'props']
    const perdidos = listas.filter((lista) => restaurado[lista][0]?.campoDeUmaFaseFutura !== 'valor-que-precisa-voltar')

    expect(perdidos, `lista(s) que descartam campo novo de entidade: ${perdidos.join(', ')}`).toEqual([])
  })

  it('mapa antigo com geometria abre sem exceção e sem perder o que a pessoa desenhou', () => {
    // Forma mínima de um map.json de antes das fases de estilo: sem floorStyle,
    // sem lockedLayers, sem gridSettings, sem thickness/lineStyle em parede.
    const antigo = JSON.stringify({
      id: 'map_2025',
      name: 'Cripta',
      width: 20,
      height: 15,
      grid: 64,
      walls: [
        { id: 'w1', x1: 0, y1: 0, x2: 640, y2: 0, blocksLight: true, blocksMove: true, door: null },
        { id: 'w2', x1: 640, y1: 0, x2: 640, y2: 480, blocksLight: true, blocksMove: true, door: { open: false, locked: true } },
      ],
      regions: [{ id: 'r1', points: [{ x: 0, y: 0 }, { x: 640, y: 0 }, { x: 640, y: 480 }], tag: 'sala', data: {} }],
    })

    const restaurado = deserializeMap(antigo)
    expect(restaurado.walls.map((parede) => parede.id)).toEqual(['w1', 'w2'])
    expect(restaurado.walls[0]).toMatchObject({ x1: 0, y1: 0, x2: 640, y2: 0 })
    expect(restaurado.walls[1].door).toMatchObject({ open: false, locked: true })
    expect(restaurado.regions[0].points).toHaveLength(3)
  })

  it('a comparação tem dente: ela REPROVA um campo novo que a migração esqueceu', () => {
    const referencia = { id: 'x', campoNovoDaProximaFase: 'padrão' }
    const migracaoEsqueceu = { id: 'x' }
    expect(camposQueAMigracaoNaoPreencheu(referencia, migracaoEsqueceu, {})).toEqual(['campoNovoDaProximaFase'])

    const migracaoPreencheu = { id: 'x', campoNovoDaProximaFase: 'padrão' }
    expect(camposQueAMigracaoNaoPreencheu(referencia, migracaoPreencheu, {})).toEqual([])
  })
})
