/*
 * Dados do protótipo. Nomes de seção, opções e textos saem do inventário
 * (redesenho-ui/inventario.md), que leu o código de 09/10/2026.
 * Esquema de campo: t = tipo, k = chave, rot = rótulo, v = valor inicial,
 * ops = opções, se = condição de aparecer, r = redesenha ao mudar,
 * var = é a variante da ferramenta (a antiga "setinha").
 */
(function () {
  'use strict';

  const CORES = ['#d9d2c0', '#c98a5b', '#e2645a', '#e0a44a', '#7fb48a', '#79a9cc', '#ab93d6', '#5b6670'];
  const JOGADORES = ['Vagn', 'Nami', 'Ryo', 'Vinícius'];

  /* ---------------- mapa de exemplo (estilo minimapa: chão chapado, linhas finas) */
  const MAPA = {
    cena: 'Porto de Tasmaturi',
    salas: [
      { id: 'cais', nome: 'Cais do Porto', x: 430, y: 196, w: 330, h: 270 },
      { id: 'armazem', nome: 'Armazém 3', x: 822, y: 176, w: 236, h: 226 },
      { id: 'sala2', nome: 'Sala 2', x: 520, y: 536, w: 240, h: 170 },
    ],
    corredores: [
      { x: 760, y: 294, w: 62, h: 54 },
      { x: 598, y: 466, w: 62, h: 70 },
    ],
    portas: [
      { id: 'p1', nome: 'Porta do cais', x: 760, y: 305, vertical: true, comp: 32, entre: 'Cais do Porto ↔ corredor' },
      { id: 'p2', nome: 'Porta do armazém', x: 822, y: 305, vertical: true, comp: 32, trancada: true, entre: 'Corredor ↔ Armazém 3' },
      { id: 'p3', nome: 'Porta da Sala 2', x: 613, y: 536, vertical: false, comp: 32, entre: 'Corredor ↔ Sala 2' },
    ],
    tokens: [
      { id: 'saga', nome: 'Saga', pub: 'Estivador', tipo: 'npc', cor: '#c98a5b', x: 520, y: 330 },
      { id: 'vagn', nome: 'Vagn', tipo: 'jogador', cor: '#79a9cc', x: 612, y: 402 },
      { id: 'jimena', nome: 'Nami', tipo: 'jogador', cor: '#7fb48a', x: 680, y: 268 },
      { id: 'guarda', nome: 'Guarda do cais', tipo: 'npc', cor: '#e2645a', x: 884, y: 244 },
      { id: 'ryo', nome: 'Ryo', tipo: 'jogador', cor: '#ab93d6', x: 950, y: 320 },
    ],
    pinos: [
      { id: 'caixas', tipo: '!', nome: 'Caixas suspeitas', x: 706, y: 236, local: 'Cais do Porto', recursos: ['cenario', 'fechadura'] },
      { id: 'bilhete', tipo: '?', nome: 'Bilhete rasgado', x: 680, y: 640, local: 'Sala 2' },
      { id: 'subida', tipo: 'viagem', nome: 'Subida para a Cidade Alta', x: 1028, y: 380, local: 'Armazém 3' },
    ],
  };

  /* ---------------- barra de ferramentas: 16 botões em 4 grupos (hoje são 22) */
  const BARRA = [
    { grupo: 'Escolher', itens: [{ id: 'selecionar', rot: 'Selecionar', ic: 'cursor', at: 'V' }] },
    { grupo: 'Construir', itens: [
      { id: 'parede', rot: 'Parede', ic: 'parede', at: 'W' },
      { id: 'porta', rot: 'Porta', ic: 'porta', at: 'D' },
      { id: 'sala', rot: 'Sala', ic: 'sala', at: 'N' },
      { id: 'chao', rot: 'Chão', ic: 'chao', at: 'I' },
      { id: 'escada', rot: 'Escada', ic: 'escada', at: 'S' },
      { id: 'caminho', rot: 'Caminho', ic: 'caminho' },
      { id: 'objeto', rot: 'Objeto', ic: 'bau' },
      { id: 'luz', rot: 'Luz', ic: 'luz', at: 'H' },
    ] },
    { grupo: 'Esconder e revelar', itens: [
      { id: 'zona', rot: 'Zona oculta', ic: 'zona', at: 'X' },
      { id: 'revelar', rot: 'Pincel de revelar', ic: 'pincelRevelar' },
    ] },
    { grupo: 'Anotar', itens: [
      { id: 'desenho', rot: 'Desenho', ic: 'lapis', at: 'P' },
      { id: 'texto', rot: 'Texto', ic: 'texto', at: 'T' },
      { id: 'pino', rot: 'Pino', ic: 'pino', at: 'Y' },
      { id: 'medir', rot: 'Medir', ic: 'regua', at: 'M' },
      { id: 'borracha', rot: 'Borracha', ic: 'borracha', at: 'E' },
    ] },
  ];

  /* teclas que armam uma ferramenta já numa variante (as antigas ferramentas separadas) */
  const TECLAS = {
    v: ['selecionar'], w: ['parede'], d: ['porta'], h: ['luz'], i: ['chao'], s: ['escada'],
    x: ['zona'], t: ['texto'], y: ['pino'], m: ['medir'], e: ['borracha'], b: ['objeto', 'tipo', 'imagem'],
    n: ['sala', 'forma', 'retangulo'], j: ['sala', 'forma', 'circulo'], q: ['sala', 'forma', 'poligono'], g: ['sala', 'forma', 'regiao'],
    p: ['desenho', 'forma', 'pincel'], l: ['desenho', 'forma', 'linha'], u: ['desenho', 'forma', 'curva'], c: ['desenho', 'forma', 'circulo'],
    o: ['desenho', 'forma', 'elipse'], r: ['desenho', 'forma', 'ret'], a: ['desenho', 'forma', 'pol'],
  };

  const PAREDE_ESTILO = [
    { t: 'cor', k: 'pcor', rot: 'Cor', ops: CORES, v: '#d9d2c0' },
    { t: 'sel', k: 'padrao', rot: 'Padrão', ops: ['Lisa', 'Pedra', 'Tijolo', 'Madeira'], v: 'Lisa' },
    { t: 'faixa', k: 'esp', rot: 'Espessura', min: 1, max: 12, v: 3, un: 'px' },
    { t: 'icones', k: 'deixa', rot: 'O que a parede deixa', ops: [['janela', 'Janela: vê, não passa', 'janela'], ['passar', 'Deixa passar', 'seta'], ['ver', 'Deixa ver', 'olho']], v: [] },
    { t: 'grupo', rot: 'Avançado', campos: [
      { t: 'faixa', k: 'fino', rot: 'Ajuste fino', min: -5, max: 5, v: 0, un: 'px' },
      { t: 'seg', k: 'ponta', rot: 'Ponta e canto', ops: [['reta', 'Reta'], ['redonda', 'Redonda'], ['chanfro', 'Chanfro']], v: 'reta' },
    ] },
  ];

  /* ---------------- ficha de cada ferramenta (o que hoje é painel + setinha) */
  const FERRAMENTAS = {
    selecionar: { dica: 'Clique numa ficha, porta, pino ou sala do mapa.', campos: [] },
    parede: { dica: 'Clique e arraste no mapa para traçar.', campos: [
      { t: 'seg', k: 'tipo', rot: 'Tipo de parede', ops: [['externa', 'Externa'], ['interna', 'Interna']], v: 'externa', var: 1 },
    ].concat(PAREDE_ESTILO) },
    porta: { dica: 'Clique numa parede para abrir a porta nela.', campos: [
      { t: 'seg', k: 'abrir', rot: 'Abrir na parede', ops: [['porta', 'Porta'], ['vao', 'Vão']], v: 'porta' },
      { t: 'seg', k: 'tipo', rot: 'Tipo de porta', ops: [['normal', 'Normal'], ['dupla', 'Dupla'], ['portao', 'Portão']], v: 'normal', var: 1 },
    ] },
    sala: { dica: 'Arraste no mapa para desenhar a sala.', campos: [
      { t: 'seg', k: 'forma', rot: 'Forma', grade: 1, r: 1, var: 1, v: 'retangulo', ops: [['retangulo', 'Retângulo', 'sala', 'N'], ['circulo', 'Circular', 'circulo', 'J'], ['poligono', 'Polígono', 'poligono', 'Q'], ['livre', 'Livre', 'livre'], ['regiao', 'Região', 'regiao', 'G']] },
      { t: 'seg', k: 'lados', rot: 'Lados', ops: [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['8', '8'], ['10', '10'], ['12', '12']], v: '6', se: (g) => g('forma') === 'poligono' },
      { t: 'seg', k: 'criar', rot: 'Criar', ops: [['sala', 'Sala'], ['parede', 'Só parede']], v: 'sala', r: 1, se: (g) => g('forma') === 'livre' },
      { t: 'liga', k: 'arred', rot: 'Arredondar', v: false, se: (g) => g('forma') === 'livre' },
      { t: 'seg', k: 'preench', rot: 'Preenchimento', ops: [['solido', 'Sólido'], ['hach', 'Hachurado']], v: 'solido', se: (g) => !(g('forma') === 'livre' && g('criar') === 'parede') },
      { t: 'cor', k: 'cor', rot: 'Cor do chão', ops: ['#333d45', '#3d4a3a', '#4a3f33', '#3b3b48', '#55575a'], v: '#333d45', se: (g) => !(g('forma') === 'livre' && g('criar') === 'parede') },
      { t: 'faixa', k: 'opac', rot: 'Opacidade', min: 0, max: 100, v: 100, un: '%', se: (g) => !(g('forma') === 'livre' && g('criar') === 'parede') },
      { t: 'liga', k: 'pborda', rot: 'Criar parede na borda', v: true, se: (g) => !(g('forma') === 'livre' && g('criar') === 'parede') },
      { t: 'grupo', rot: 'Avançado', se: (g) => !(g('forma') === 'livre' && g('criar') === 'parede'), campos: [
        { t: 'faixa', k: 'espc', rot: 'Espessura do contorno', min: 0, max: 8, v: 2, un: 'px' },
        { t: 'seg', k: 'cantos', rot: 'Cantos do contorno', ops: [['retos', 'Retos'], ['redondos', 'Redondos']], v: 'retos' },
        { t: 'liga', k: 'suave', rot: 'Suavizar contorno', v: false },
      ] },
    ] },
    chao: { dica: 'Pinte o chão direto no mapa.', campos: [
      { t: 'seg', k: 'forma', rot: 'Forma', grade: 1, r: 1, var: 1, v: 'pincel', ops: [['ret', 'Retângulo', 'sala'], ['elipse', 'Elipse', 'elipse'], ['pol', 'Polígono', 'poligono'], ['corredor', 'Corredor', 'caminho'], ['pincel', 'Pincel de blocos', 'chao'], ['balde', 'Balde', 'balde']] },
      { t: 'tinta', k: 'tinta', rot: 'Tinta', v: 'chao', ops: [['chao', 'Chão', '#333d45'], ['mar', 'Mar', '#1c3240'], ['grama', 'Grama', '#3d5a3a'], ['terra', 'Terra', '#5a4632'], ['pedra', 'Pedra', '#55575a'], ['lava', 'Lava', '#8a3a1e']] },
      { t: 'num', k: 'pincel', rot: 'Tamanho do pincel', v: 2, min: 1, max: 9, un: 'blocos', se: (g) => g('forma') === 'pincel' },
      { t: 'seg', k: 'lados', rot: 'Lados', ops: [['5', '5'], ['6', '6'], ['8', '8']], v: '6', se: (g) => g('forma') === 'pol' },
      { t: 'seg', k: 'op', rot: 'Operação', ops: [['somar', 'Somar'], ['subtrair', 'Subtrair']], v: 'somar' },
      { t: 'nota', txt: 'Cor do chão, contorno e moldura do mapa ficam no marcador Cena.', ir: 'cena' },
    ] },
    escada: { dica: 'Clique no mapa para pôr a escada.', campos: [
      { t: 'seg', k: 'tam', rot: 'Tamanho', ops: [['p', 'Pequena'], ['m', 'Média'], ['g', 'Grande']], v: 'm', var: 1 },
      { t: 'nota', txt: 'Sentido, forma e para onde leva se ajustam na ficha da escada, depois de criada.' },
    ] },
    caminho: { dica: 'Clique ponto a ponto; duplo clique termina.', campos: [
      { t: 'cor', k: 'cor', rot: 'Cor deste caminho', ops: ['#c9b48a', '#d9d2c0', '#79a9cc', '#7fb48a', '#e2645a'], v: '#c9b48a' },
      { t: 'faixa', k: 'larg', rot: 'Largura', min: 1, max: 6, v: 2, un: 'casas' },
    ] },
    objeto: { dica: 'Clique no mapa para colocar.', campos: [
      { t: 'seg', k: 'tipo', rot: 'Colocar', ops: [['movel', 'Móvel', 'bau'], ['imagem', 'Imagem', 'imagem', 'B']], v: 'movel', var: 1, r: 1 },
      { t: 'seg', k: 'movel', rot: 'Móvel', grade: 1, v: 'barril', se: (g) => g('tipo') === 'movel', ops: [['barril', 'Barril', 'barril'], ['caixa', 'Caixa', 'caixa'], ['bau', 'Baú', 'bau'], ['cama', 'Cama', 'cama'], ['mesa', 'Mesa', 'mesaMovel'], ['cadeira', 'Cadeira', 'cadeira']] },
      { t: 'acoes', se: (g) => g('tipo') === 'imagem', bts: [['Escolher imagem…', 'imagem', 'primario', 'No app, abre a escolha de arquivo de imagem.']] },
    ] },
    luz: { dica: 'Clique no mapa para acender uma luz.', campos: [
      { t: 'nota', txt: 'Cor, intensidade e "vista de longe" se ajustam na ficha da luz, depois de criada.' },
    ] },
    zona: { dica: 'Desenhe a área que os jogadores não veem.', campos: [
      { t: 'nota', txt: 'Nome e "Revelar para jogadores" ficam na ficha da zona, depois de criada.' },
    ] },
    revelar: { dica: 'Pinte o mapa durante o jogo.', campos: [
      { t: 'seg', k: 'modo', rot: 'Ao pintar', ops: [['revelar', 'Revelar'], ['esconder', 'Esconder']], v: 'revelar', var: 1 },
      { t: 'faixa', k: 'larg', rot: 'Largura do pincel', min: 1, max: 10, v: 3, un: 'casas' },
    ] },
    desenho: { dica: 'Desenhe à mão sobre o mapa.', campos: [
      { t: 'seg', k: 'forma', rot: 'Forma', grade: 1, r: 1, var: 1, v: 'pincel', ops: [['pincel', 'Pincel', 'lapis', 'P'], ['linha', 'Linha', 'linha', 'L'], ['curva', 'Curva', 'curva', 'U'], ['circulo', 'Círculo', 'circulo', 'C'], ['elipse', 'Elipse', 'elipse', 'O'], ['ret', 'Retângulo', 'sala', 'R'], ['pol', 'Polígono', 'poligono', 'A']] },
      { t: 'seg', k: 'modo', rot: 'Modo', ops: [['livre', 'Traço livre'], ['balde', 'Balde']], v: 'livre', se: (g) => g('forma') === 'pincel' },
      { t: 'seg', k: 'textura', rot: 'Textura', ops: [['caneta', 'Caneta'], ['lapis', 'Lápis'], ['marcador', 'Marcador']], v: 'caneta', se: (g) => g('forma') === 'pincel' },
      { t: 'cor', k: 'cor', rot: 'Cor', ops: CORES, v: '#e2645a' },
      { t: 'faixa', k: 'esp', rot: 'Espessura', min: 1, max: 16, v: 3, un: 'px' },
      { t: 'liga', k: 'preench', rot: 'Preenchido', v: false, se: (g) => ['circulo', 'elipse', 'ret', 'pol'].includes(g('forma')) },
      { t: 'faixa', k: 'opac', rot: 'Opacidade', min: 10, max: 100, v: 100, un: '%' },
      { t: 'grupo', rot: 'Estilo do traço', se: (g) => ['pincel', 'linha', 'curva'].includes(g('forma')), campos: [
        { t: 'seg', k: 'ponta', rot: 'Ponta', ops: [['redonda', 'Redonda'], ['reta', 'Reta']], v: 'redonda' },
        { t: 'seg', k: 'traco', rot: 'Traço', ops: [['cont', 'Contínuo'], ['trac', 'Tracejado'], ['pont', 'Pontilhado']], v: 'cont' },
      ] },
    ] },
    texto: { dica: 'Clique no mapa e escreva.', campos: [
      { t: 'cor', k: 'cor', rot: 'Cor', ops: CORES, v: '#d9d2c0' },
      { t: 'sel', k: 'fonte', rot: 'Fonte', ops: ['Sitka (de livro)', 'Segoe (da interface)', 'Bahnschrift (de legenda)'], v: 'Sitka (de livro)' },
      { t: 'faixa', k: 'tam', rot: 'Tamanho da fonte', min: 10, max: 72, v: 18, un: 'px' },
    ] },
    pino: { dica: 'Clique no mapa para fincar o pino.', campos: [
      { t: 'seg', k: 'tipo', rot: 'Tipo do próximo pino', grade: 1, var: 1, v: '!', ops: [['!', 'Exclamação', 'exclamacao'], ['?', 'Interrogação', 'interrogacao'], ['viagem', 'Viagem', 'viagem'], ['alavanca', 'Alavanca', 'alavanca']] },
    ] },
    medir: { dica: 'Arraste no mapa para medir.', campos: [
      { t: 'nota', txt: '1 casa = 1,5 m. Unidade, casas decimais e modo de medir mudam em Configurações do mapa.', ir: 'config' },
    ] },
    borracha: { dica: 'Clique ou arraste sobre o que quer apagar.', campos: [
      { t: 'seg', k: 'modo', rot: 'Modo', ops: [['inteiro', 'Objeto inteiro'], ['parte', 'Só uma parte']], v: 'inteiro', var: 1 },
    ] },
  };

  /* ---------------- ficha de cada tipo de objeto selecionado */
  const TIPOS = {
    token: (o) => ({
      rot: 'Token', ic: 'token',
      cabecaSeg: { t: 'seg', k: 'kind', ops: [['npc', 'Ficha de NPC'], ['jogador', 'Ficha de jogador']], v: o.tipo },
      fichas: [
        { id: 'nome', rot: 'Nome', ic: 'ficha', aberta: true, resumo: (g) => g('pubModo') === 'outro' ? g('pub') : g('pubModo') === 'nenhum' ? 'Sem nome' : 'O mesmo', campos: [
          { t: 'texto', k: 'nome', rot: 'Nome no editor', v: o.nome },
          { t: 'seg', k: 'pubModo', rot: 'Nome para os jogadores', ops: [['mesmo', 'O mesmo'], ['outro', 'Outro'], ['nenhum', 'Nenhum']], v: o.pub ? 'outro' : 'mesmo', r: 1 },
          { t: 'texto', k: 'pub', rot: 'Os jogadores leem', ph: 'ex.: Estivador', v: o.pub || '', se: (g) => g('pubModo') === 'outro' },
        ] },
        { id: 'vida', rot: 'Vida', ic: 'coracao', aberta: true, resumo: (g) => g('vida') + ' / ' + g('vidaMax'), campos: [
          { t: 'vida', k: 'vida', v: 18, max: 'vidaMax' },
          { t: 'num', k: 'vidaMax', rot: 'Vida máxima', v: 24, min: 1, max: 999, r: 1 },
          { t: 'liga', k: 'barra', rot: 'Jogadores veem a barra', v: false },
        ] },
        { id: 'cond', rot: 'Condições', ic: 'estrela', aberta: true, resumo: (g) => (g('cond') || []).join(', ') || 'Nenhuma', campos: [
          { t: 'chips', k: 'cond', ops: ['Envenenado', 'Caído', 'Dormindo', 'Atordoado', 'Invisível'], v: ['Dormindo'] },
          { t: 'nota', txt: 'Aparecem sobre a ficha, também para os jogadores.' },
        ] },
        { id: 'nomapa', rot: 'No mapa', ic: 'cena', aberta: false, resumo: (g) => g('tam') + (g('tam') === '1' ? ' casa' : ' casas'), campos: [
          { t: 'icones', k: 'trava', rot: 'Trava e visibilidade', ops: [['travado', 'Travado', 'cadeado'], ['congelado', 'Congelado', 'floco'], ['oculto', 'Oculto para jogadores', 'olhoFechado']], v: [] },
          { t: 'seg', k: 'tam', rot: 'Tamanho da ficha', ops: [['1', '1 casa'], ['2', '2 casas'], ['3', '3 casas']], v: '1' },
          { t: 'cor', k: 'cor', rot: 'Cor', ops: CORES, v: o.cor, padrao: 1 },
          { t: 'acoes', rot: 'Imagem do token', bts: [['Escolher imagem', 'imagem', '', 'No app, abre a escolha de imagem do token.'], ['Salvar no acervo', 'acervo', '', o.nome + ' guardado no Acervo, pasta NPCs.']] },
          { t: 'grupo', rot: 'Avançado', campos: [
            { t: 'faixa', k: 'giro', rot: 'Rotação', min: 0, max: 359, v: 0, un: '°' },
            { t: 'liga', k: 'ocEditor', rot: 'Oculto no editor', v: false },
          ] },
        ] },
        { id: 'levar', rot: 'Levar para outra cena', ic: 'seta', aberta: false, resumo: () => '', campos: [
          { t: 'sel', k: 'dest', rot: 'Destino', ops: ['Armazém 3', 'Navio Carcará', 'Praça da Cidade Alta', 'Pino: Subida para a Cidade Alta'], v: 'Armazém 3' },
          { t: 'acoes', bts: [['Levar agora', 'seta', 'latao', o.nome + ' foi levado para a cena escolhida.']] },
        ] },
      ],
      cartoes: { rot: 'Comportamento', itens: [
        { id: 'personagem', rot: 'Personagem', ic: 'ficha', resumo: (g) => g('rpg') !== 'Nenhuma' ? g('rpg') : 'Sem ficha de RPG', ligado: (g) => g('rpg') !== 'Nenhuma', campos: [
          { t: 'sel', k: 'rpg', rot: 'Ligar ficha de RPG', ops: ['Nenhuma', 'Saga (Tormenta)', 'Estivador genérico'], v: 'Nenhuma', r: 1 },
          { t: 'acoes', se: (g) => g('rpg') !== 'Nenhuma', bts: [['Abrir ficha', 'ficha', 'latao', 'No app, abre a ficha de personagem.']] },
        ] },
        { id: 'vigia', rot: 'Vigia', ic: 'olho', resumo: (g) => g('vigia') ? 'Olha ' + g('olha') : 'Desligado', ligado: (g) => g('vigia'), campos: [
          { t: 'liga', k: 'vigia', rot: 'Esta ficha vigia', v: false, r: 1 },
          { t: 'seg', k: 'olha', rot: 'Para onde olha', ops: [['norte', 'Norte'], ['leste', 'Leste'], ['sul', 'Sul'], ['oeste', 'Oeste']], v: 'norte', se: (g) => g('vigia') },
          { t: 'faixa', k: 'abert', rot: 'Abertura do olhar', min: 30, max: 360, v: 90, un: '°', se: (g) => g('vigia') },
          { t: 'num', k: 'alc', rot: 'Alcance', v: 6, min: 1, max: 30, un: 'casas', se: (g) => g('vigia') },
          { t: 'liga', k: 'volta', rot: 'Em volta', ajuda: 'Vê em todas as direções, mais perto.', v: false, se: (g) => g('vigia') },
        ] },
        { id: 'patrulha', rot: 'Patrulha', ic: 'rota', resumo: () => '4 pontos, ronda', ligado: () => true, campos: [
          { t: 'nota', txt: 'Rota com 4 pontos.' },
          { t: 'acoes', bts: [['Marcar ponto aqui', 'pino', '', 'Ponto 5 marcado na posição da ficha.'], ['Tirar último ponto', 'desfazer', '', 'Último ponto da rota tirado.'], ['Apagar rota', 'lixo', 'perigo', 'Rota apagada.']] },
          { t: 'seg', k: 'ronda', rot: 'No fim da rota', ops: [['ronda', 'Ronda'], ['volta', 'Vai e volta']], v: 'ronda' },
          { t: 'faixa', k: 'vel', rot: 'Velocidade', min: 1, max: 10, v: 4, un: 'casas/turno' },
          { t: 'liga', k: 'seguir', rot: 'Seguir a rota', v: true },
          { t: 'acoes', bts: [['Patrulhar sozinha', 'play', 'latao', 'Saga começou a patrulhar.'], ['Avançar patrulha', 'seta', '', 'Saga andou um passo da patrulha.']] },
        ] },
        { id: 'junto', rot: 'Levar junto', ic: 'elo', resumo: (g) => g('junto') === 'Ninguém' ? 'Sozinha' : 'Com ' + g('junto'), ligado: (g) => g('junto') !== 'Ninguém', campos: [
          { t: 'sel', k: 'junto', rot: 'Vai junto de', ops: ['Ninguém', 'Vagn', 'Nami', 'Guarda do cais'], v: 'Ninguém', r: 1 },
        ] },
        { id: 'veiculo', rot: 'Veículo', ic: 'carroca', resumo: (g) => g('veic') ? g('lugares') + ' lugares' : 'Não é veículo', ligado: (g) => g('veic'), campos: [
          { t: 'liga', k: 'veic', rot: 'Esta ficha é um veículo', v: false, r: 1 },
          { t: 'num', k: 'lugares', rot: 'Lugares', v: 4, min: 1, max: 20, se: (g) => g('veic') },
          { t: 'nota', txt: 'A bordo: ninguém.', se: (g) => g('veic') },
        ] },
        { id: 'rotina', rot: 'Rotina', ic: 'relogio', resumo: (g) => 'Maré ' + g('rotEst') + ': ' + g('rotPosto'), ligado: () => true, campos: [
          { t: 'sel', k: 'rotEst', rot: 'Quando a Maré está', ops: ['alta', 'baixa'], v: 'alta' },
          { t: 'sel', k: 'rotPosto', rot: 'Fica em', ops: ['Cais do Porto', 'Armazém 3', 'Sala 2'], v: 'Cais do Porto' },
          { t: 'acoes', bts: [['Andar sozinha', 'play', '', 'Saga segue a rotina sozinha.'], ['Parar', 'pausa', '', 'Rotina parada.']] },
        ] },
        { id: 'luzes', rot: 'Luzes', ic: 'lampiao', resumo: (g) => g('lampiao') ? 'Lampião aceso' : 'Nenhuma', ligado: (g) => g('lampiao'), campos: [
          { t: 'liga', k: 'lampiao', rot: 'Lampião nesta ficha', v: false },
          { t: 'nota', txt: 'A luz anda junto com a ficha.' },
        ] },
        { id: 'piso', rot: 'Piso', ic: 'cenas', resumo: () => 'Sem pisos', desligado: 'Esta cena não tem pisos.', campos: [] },
      ] },
      mais: [['Congelar ficha', 'floco', 'Saga congelada: os jogadores não conseguem movê-la.'], ['Enviar mensagem…', 'carta', 'No app, abre o recado para quem controla a ficha.'], ['Levar ao piso de cima', 'cenas', null, 'Esta cena não tem pisos.']],
      apagar: 'Apagar token',
    }),

    /* consolidado: a porta no jeito da Mesa limpa. Estado no topo, sempre à vista;
       o resto em fichas recolhidas. "Abrir agora" abre de verdade. */
    porta: (o) => ({
      rot: 'Porta', ic: 'porta', sub: o.entre,
      essencial: [
        { t: 'seg', k: 'aberta', rot: 'Estado', ops: [['aberta', 'Aberta', 'portaAberta'], ['fechada', 'Fechada', 'portaFechada']], v: 'fechada' },
        { t: 'liga', k: 'trancada', rot: 'Trancada', v: !!o.trancada },
        { t: 'liga', k: 'secreta', rot: 'Secreta', ajuda: 'Os jogadores veem parede até você revelar.', v: false, r: 1 },
        { t: 'acoes', se: (g) => g('secreta'), bts: [['Revelar passagem', 'olho', 'latao', 'Passagem revelada para quem está na cena.']] },
        { t: 'liga', k: 'espiar', rot: 'Jogador pode espiar', v: true },
      ],
      fichas: [
        { id: 'quem', rot: 'Quem abre', ic: 'chave', aberta: false, resumo: (g) => g('item') || 'Só o mestre', campos: [
          { t: 'texto', k: 'item', rot: 'Abre com o item', ph: 'Vazio: só o mestre abre', v: o.trancada ? 'Chave de ferro' : '' },
          { t: 'seg', k: 'lado', rot: 'Abre por', ops: [['dois', 'Os dois lados'], ['um', 'Só deste lado']], v: 'dois', r: 1 },
          { t: 'acoes', se: (g) => g('lado') === 'um', bts: [['Trocar o lado', 'troca', '', 'Agora abre só pelo outro lado.']] },
        ] },
        { id: 'aparencia', rot: 'Aparência', ic: 'porta', aberta: false, resumo: (g) => ({ normal: 'Normal', dupla: 'Dupla', portao: 'Portão' })[g('tipo')] + (g('anim') ? '' : ', sem animação'), campos: [
          { t: 'seg', k: 'tipo', rot: 'Tipo de porta', ops: [['normal', 'Normal'], ['dupla', 'Dupla'], ['portao', 'Portão']], v: 'normal' },
          { t: 'liga', k: 'anim', rot: 'Animação ao abrir', ajuda: 'A folha gira na dobradiça, no seu mapa e no dos jogadores.', v: true },
        ] },
        { id: 'parede', rot: 'Parede em volta', ic: 'parede', aberta: false, resumo: (g) => g('padrao'), campos: PAREDE_ESTILO },
        { id: 'estadoMundo', rot: 'Depende do estado', ic: 'pulso', aberta: false, resumo: (g) => g('dep'), campos: [
          { t: 'sel', k: 'dep', rot: 'Abre quando', ops: ['Sempre', 'Maré: baixa', 'Sino da torre: tocando'], v: 'Sempre' },
          { t: 'nota', txt: 'Os valores vêm do Estado do mundo, no marcador Aventura.', ir: 'aventura' },
        ] },
      ],
      mais: (g) => [
        { rot: g('aberta') === 'aberta' ? 'Fechar agora' : 'Abrir agora', ic: 'porta', acao: 'porta-alternar' },
        { rot: g('trancada') ? 'Destrancar' : 'Trancar', ic: 'cadeado', acao: 'porta-trancar' },
        ['Virar parede sólida', 'parede', 'A porta virou parede.'],
      ],
      apagar: 'Apagar porta',
    }),

    /* consolidado: a ficha do ponto de interesse da Mesa limpa. O essencial fica
       aberto; recursos entram por "+ Adicionar ao pino" e saem com "Tirar do pino". */
    pino: (o) => ({
      rot: (g) => ({ viagem: 'Pino de viagem', alavanca: 'Alavanca' })[g('tipo')] || 'Ponto de interesse',
      ic: 'pino', sub: o.local,
      essencial: [
        { t: 'seg', k: 'tipo', rot: 'Tipo', r: 1, v: o.tipo, ops: [['!', 'Exclamação', 'exclamacao', null, 1], ['?', 'Interrogação', 'interrogacao', null, 1], ['viagem', 'Viagem'], ['alavanca', 'Alavanca']] },
        { t: 'texto', k: 'nome', rot: 'Nome do local', v: o.nome },
        { t: 'area', k: 'desc', rot: 'Descrição · o jogador lê', ph: 'O que aparece no cartão do local', v: o.tipo === '!' ? 'Três caixas com o selo da Guilda, pregadas às pressas. Uma delas pinga.' : '', se: (g) => g('tipo') === '!' || g('tipo') === '?' },
        { t: 'sel', k: 'dest', rot: 'Leva a', se: (g) => g('tipo') === 'viagem', ops: ['Praça da Cidade Alta', 'Torre do sino', 'Navio Carcará', '+ Cena nova…'], v: 'Praça da Cidade Alta' },
        { t: 'seg', k: 'passagem', rot: 'Passagem desta saída', se: (g) => g('tipo') === 'viagem', ops: [['livre', 'Livre'], ['pede', 'Pede ao mestre'], ['trancada', 'Trancada']], v: 'pede', r: 1 },
        { t: 'texto', k: 'porque', rot: 'Por que está fechada', ph: 'ex.: O portão está emperrado', se: (g) => g('tipo') === 'viagem' && g('passagem') === 'trancada' },
        { t: 'sel', k: 'portaAlv', rot: 'Abre a porta', se: (g) => g('tipo') === 'alavanca', ops: ['Porta do armazém', 'Porta do cais', 'Porta da Sala 2'], v: 'Porta do armazém' },
        { t: 'html', se: (g) => g('tipo') === 'alavanca', html: '<div class="acoes"><button type="button" class="bt bt--p bt--latao" data-acao="alavanca-acionar">Acionar agora</button></div>' },
        { t: 'seg', k: 'quem', rot: 'Quem vê', ops: [['todos', 'Todos'], ['estes', 'Só estes'], ['ninguem', 'Ninguém']], v: 'todos', r: 1 },
        { t: 'chips', k: 'quais', ops: JOGADORES, v: ['Vagn'], se: (g) => g('quem') === 'estes' },
        { t: 'seg', k: 'alcance', rot: 'Alcance', ops: [['marco', 'Marco'], ['perto', 'Só de perto']], v: 'perto', r: 1, se: (g) => g('tipo') !== 'alavanca' },
        { t: 'nota', txt: 'Marco: aparece mesmo na névoa, para todos.', se: (g) => g('alcance') === 'marco' && g('tipo') !== 'alavanca' },
        { t: 'num', k: 'casas', rot: 'O jogador lê a até', v: 2, min: 1, max: 12, un: 'casas', se: (g) => g('alcance') === 'perto' && g('tipo') !== 'alavanca' },
      ],
      recursos: { v: o.recursos || [], se: (g) => g('tipo') === '!' || g('tipo') === '?', itens: [
        { id: 'cenario', rot: 'Animação do cenário', ic: 'filme', desc: 'A imagem do local entra na moldura e o texto se escreve.', resumo: (g) => ({ parada: 'Câmera parada', pan: 'Panorâmica', aprox: 'Aproximar' })[g('camera')], campos: [
          { t: 'cena' },
          { t: 'seg', k: 'camera', rot: 'Câmera dentro da moldura', ops: [['parada', 'Parada'], ['pan', 'Panorâmica'], ['aprox', 'Aproximar']], v: 'pan' },
          { t: 'icones', k: 'efeitos', rot: 'Efeitos', ops: [['nevoa', 'Névoa', 'nevoa'], ['sol', 'Raios de sol', 'luz'], ['part', 'Partículas', 'estrela'], ['vento', 'Som do vento', 'som']], v: ['nevoa', 'sol', 'vento'] },
          { t: 'sel', k: 'quando', rot: 'Quando o jogador vê', ops: ['Ao abrir o cartão', 'Ao chegar perto'], v: 'Ao abrir o cartão' },
          { t: 'acoes', bts: [['Trocar imagem do local', 'imagem', '', 'No app, abre a escolha da imagem do local.']] },
        ] },
        { id: 'item', rot: 'Item pegável', ic: 'joia', desc: 'O jogador leva um item deste lugar.', resumo: (g) => g('itemNome') || 'Sem nome', campos: [
          { t: 'texto', k: 'itemNome', rot: 'Nome do item', ph: 'ex.: Selo da Guilda', v: '' },
          { t: 'liga', k: 'semPedir', rot: 'Pega sem pedir ao mestre', v: false },
        ] },
        { id: 'fechadura', rot: 'Fechadura com segredo', ic: 'chave', desc: 'Só abre com a combinação certa.', resumo: (g) => g('comb') ? 'Segredo ' + g('comb') : 'Sem combinação', campos: [
          { t: 'texto', k: 'comb', rot: 'Combinação', ph: 'ex.: 3-1-4', v: '3-1-4' },
          { t: 'sel', k: 'como', rot: 'Como o jogador abre', ops: ['Digita a combinação', 'Gira os discos'], v: 'Gira os discos' },
          { t: 'sel', k: 'destranca', rot: 'Destranca também', ops: ['Nenhuma porta', 'Porta do armazém'], v: 'Nenhuma porta' },
          { t: 'liga', k: 'retrancar', rot: 'Trancar de novo ao sair', v: false },
        ] },
        { id: 'colecao', rot: 'Peça de coleção', ic: 'peca', desc: 'Uma parte de algo que se junta.', resumo: (g) => g('colN') + ' de ' + g('colDe'), campos: [
          { t: 'texto', k: 'colNome', rot: 'Coleção', ph: 'ex.: Mapa rasgado', v: '' },
          { t: 'num', k: 'colN', rot: 'Peça', v: 1, min: 1, max: 20 },
          { t: 'num', k: 'colDe', rot: 'De quantas', v: 4, min: 2, max: 20 },
        ] },
        { id: 'loja', rot: 'Loja com preços', ic: 'loja', desc: 'Mercadorias que o jogador compra.', resumo: () => '2 mercadorias', campos: [
          { t: 'lista', itens: [['Corda (10 m)', '4 moedas'], ['Lanterna', '6 moedas']], mais: '+ Mercadoria' },
          { t: 'liga', k: 'semConta', rot: 'Sem conta', ajuda: 'O jogador vê os preços, mas paga direto com você.', v: false },
        ] },
        { id: 'cabine', rot: 'Cabine contínua', ic: 'cabine', desc: 'Leva o grupo a outra cena sem parar.', resumo: (g) => g('cabLeva'), campos: [
          { t: 'sel', k: 'cabLeva', rot: 'Leva a', ops: ['Nenhuma cena', 'Torre do sino'], v: 'Nenhuma cena' },
          { t: 'acoes', bts: [['Avançar esteiras', 'seta', '', 'Esteiras avançaram uma casa.']] },
        ] },
        { id: 'estado', rot: 'Depende do estado', ic: 'pulso', desc: 'Só aparece em certas condições.', resumo: (g) => g('depP'), campos: [
          { t: 'sel', k: 'depP', rot: 'Aparece quando', ops: ['Sempre', 'Maré: baixa', 'Sino da torre: tocando'], v: 'Sempre' },
        ] },
      ] },
      fichas: [
        { id: 'viagem', rot: 'Mais da viagem', ic: 'viagem', aberta: false, se: (g) => g('tipo') === 'viagem', resumo: (g) => g('trans'), campos: [
          { t: 'icones', k: 'regras', ops: [['mao', 'Mão única', 'seta'], ['vista', 'Dá vista', 'olho'], ['chegada', 'Só chegada', 'pino']], v: ['vista'] },
          { t: 'sel', k: 'trans', rot: 'Transição especial', ops: ['Nenhuma', 'Chega direto', 'Escada de madeira (subir)', 'Escada de madeira (descer)', 'Escada curva'], v: 'Escada de madeira (subir)' },
          { t: 'acoes', bts: [['Assistir inteira', 'play', '', 'No app, toca a transição inteira só para você.'], ['Ir agora', 'seta', 'latao', 'Indo para a Praça da Cidade Alta.']] },
          { t: 'texto', k: 'nomeSaida', rot: 'Nome da saída', ph: 'ex.: Escadaria do porto' },
          { t: 'num', k: 'casasCheg', rot: 'Casas em volta do pino de chegada', v: 2, min: 0, max: 10 },
          { t: 'acoes', bts: [['Criar pino de chegada', 'pino', '', 'Pino de chegada criado na Praça da Cidade Alta.']] },
        ] },
        { id: 'aparencia', rot: 'Aparência', ic: 'olho', aberta: false, resumo: (g) => (g('aparencia') || []).indexOf('travado') >= 0 ? 'Travado' : '', campos: [
          { t: 'seg', k: 'icone', rot: 'Ícone no mapa', grade: 1, v: 'nenhum', se: (g) => g('tipo') === '!' || g('tipo') === '?', ops: [['nenhum', 'Sem ícone', 'x'], ['bau', 'Baú', 'bau'], ['chave', 'Chave', 'chave'], ['joia', 'Tesouro', 'joia'], ['carta', 'Carta', 'carta'], ['alerta', 'Perigo', 'alerta']] },
          { t: 'icones', k: 'aparencia', ops: [['circulo', 'Só o círculo, sem haste', 'circulo'], ['travado', 'Travado', 'cadeado']], v: [] },
        ] },
        { id: 'mesa', rot: 'Na mesa', ic: 'grupo', aberta: false, resumo: () => '', campos: [
          { t: 'acoes', col: 1, bts: [['Reunir quem vem para o pino', 'grupo', '', 'Pedido de reunião enviado a quem está na cena.'], ['Mostrar o cartão a…', 'olho', '', 'No app, escolhe quem vê o cartão agora.']] },
        ] },
      ],
      mais: [['Reunir no pino', 'grupo', 'Pedido de reunião enviado.'], ['Mostrar o cartão a…', 'olho', 'No app, escolhe quem vê o cartão agora.']],
      apagar: 'Excluir pino',
    }),

    sala: (o) => ({
      rot: 'Sala', ic: 'sala',
      fichas: [
        { id: 'sala', rot: 'Sala', ic: 'sala', aberta: true, resumo: () => '', campos: [
          { t: 'texto', k: 'nome', rot: 'Nome', v: o.nome },
          { t: 'area', k: 'aoEntrar', rot: 'Ao entrar, o jogador lê', ph: 'O que o jogador lê ao entrar', v: o.id === 'cais' ? 'Cheiro de sal e alcatrão. Gaivotas brigam por restos de peixe.' : '' },
          { t: 'sel', k: 'dentro', rot: 'Dentro de', ops: ['Nenhuma (sala solta)', 'Porto'], v: 'Porto' },
        ] },
        { id: 'veem', rot: 'O que os jogadores veem', ic: 'olho', aberta: true, resumo: () => '', campos: [
          { t: 'liga', k: 'veNome', rot: 'Jogadores veem o nome', v: true },
          { t: 'liga', k: 'teto', rot: 'Teto fechado para jogadores', ajuda: 'Quem está fora não vê o que há dentro.', v: false },
          { t: 'liga', k: 'comodo', rot: 'Cômodo', ajuda: 'Só aparece no mapa depois de visto.', v: true },
          { t: 'liga', k: 'escura', rot: 'Sala escura', ajuda: 'Só se vê com luz.', v: false },
          { t: 'liga', k: 'dentroFora', rot: 'De dentro vê lá fora', v: true },
          { t: 'liga', k: 'foraDentro', rot: 'De fora vê aqui dentro', v: false },
        ] },
        { id: 'extras', rot: 'Acrescentar', ic: 'mais', aberta: true, resumo: () => '', campos: [
          { t: 'extras', k: 'extras', ops: ['Nota do mestre', 'Facção', 'Raio de visão aqui', 'Perigo', 'Esteira', 'Criar sala dentro', 'Abrir para o corredor'], v: [] },
        ] },
        { id: 'aparencia', rot: 'Aparência', ic: 'chao', aberta: false, resumo: (g) => g('preench') === 'solido' ? 'Sólido' : 'Hachurado', campos: [
          { t: 'cor', k: 'cor', rot: 'Cor', ops: ['#333d45', '#3d4a3a', '#4a3f33', '#3b3b48', '#55575a'], v: '#333d45' },
          { t: 'seg', k: 'preench', rot: 'Preenchimento', ops: [['solido', 'Sólido'], ['hach', 'Hachurado']], v: 'solido' },
          { t: 'faixa', k: 'opac', rot: 'Opacidade', min: 0, max: 100, v: 100, un: '%' },
          { t: 'liga', k: 'parte', rot: 'Pintar parte da sala de outra cor', v: false },
          { t: 'grupo', rot: 'Avançado', campos: [
            { t: 'faixa', k: 'espc', rot: 'Espessura do contorno', min: 0, max: 8, v: 2, un: 'px' },
            { t: 'seg', k: 'cantos', rot: 'Cantos', ops: [['retos', 'Retos'], ['redondos', 'Redondos']], v: 'retos' },
            { t: 'liga', k: 'suave', rot: 'Suavizar contorno', v: false },
          ] },
        ] },
        { id: 'medidas', rot: 'Medidas e título', ic: 'regua', aberta: false, resumo: () => Math.round(o.w / 35) + ' × ' + Math.round(o.h / 35) + ' casas', campos: [
          { t: 'num', k: 'larg', rot: 'Largura', v: Math.round(o.w / 35), min: 1, max: 99, un: 'casas' },
          { t: 'num', k: 'alt', rot: 'Altura', v: Math.round(o.h / 35), min: 1, max: 99, un: 'casas' },
          { t: 'acoes', rot: 'Rotação', bts: [['Girar −90°', 'desfazer', '', 'Sala girada 90° para a esquerda.'], ['Girar +90°', 'refazer', '', 'Sala girada 90° para a direita.']] },
          { t: 'faixa', k: 'titTam', rot: 'Tamanho do título no mapa', min: 10, max: 32, v: 14, un: 'px' },
          { t: 'seg', k: 'titOri', rot: 'Orientação do título', ops: [['h', 'Deitado'], ['v', 'Em pé']], v: 'h' },
        ] },
        { id: 'trava', rot: 'Trava', ic: 'cadeado', aberta: false, resumo: () => '', campos: [
          { t: 'icones', k: 'trava', ops: [['travado', 'Travado', 'cadeado'], ['oculto', 'Oculto para jogadores', 'olhoFechado']], v: [] },
        ] },
      ],
      mais: [['Endireitar', 'regua', 'Contorno endireitado.'], ['Abrir para o corredor', 'porta', 'Vão aberto para o corredor.']],
      apagar: 'Apagar sala',
    }),
  };

  /* ---------------- marcador Cena */
  const CENA = {
    camadas: ['Paredes', 'Portas', 'Salas', 'Escadas', 'Objetos', 'Decoração', 'Iluminação', 'Tokens', 'Anotações'],
    chao: [
      { t: 'cor', k: 'corChao', rot: 'Cor do chão', ops: ['#333d45', '#3d4a3a', '#4a3f33', '#3b3b48'], v: '#333d45' },
      { t: 'liga', k: 'contorno', rot: 'Contorno', v: true, r: 1 },
      { t: 'cor', k: 'corCont', rot: 'Cor do contorno', ops: ['#d6d0c2', '#a2a09a', '#e0a44a'], v: '#d6d0c2', se: (g) => g('contorno') },
      { t: 'faixa', k: 'prec', rot: 'Precisão do contorno', min: 1, max: 10, v: 6 },
      { t: 'liga', k: 'fiel', rot: 'Render fiel', ajuda: 'Minimapa igual ao desenho, sem simplificar.', v: false },
      { t: 'liga', k: 'moldura', rot: 'Moldura com título', v: false, r: 1 },
      { t: 'texto', k: 'titulo', rot: 'Título da moldura', ph: 'ex.: Porto de Tasmaturi', v: 'Porto de Tasmaturi', se: (g) => g('moldura') },
    ],
    camadasChao: [['Chão base', '#333d45'], ['Mar do porto', '#1c3240'], ['Areia da praia', '#6a5a40']],
    faccoes: [['Guilda do Porto', '#e0a44a'], ['Contrabandistas', '#ab93d6']],
    marcas: [['Vagn', 'Cuidado com o guarda de vermelho'], ['Nami', 'Voltar aqui de noite']],
  };

  /* ---------------- marcador Aventura */
  const AVENTURA = {
    pinos: [
      { id: 'caixas', tipo: '!', nome: 'Caixas suspeitas', cena: 'Porto de Tasmaturi' },
      { id: 'bilhete', tipo: '?', nome: 'Bilhete rasgado', cena: 'Porto de Tasmaturi' },
      { id: 'subida', tipo: 'viagem', nome: 'Subida para a Cidade Alta', cena: 'Porto de Tasmaturi' },
      { id: 'x1', tipo: '!', nome: 'Sino rachado', cena: 'Torre do sino' },
      { id: 'x2', tipo: 'viagem', nome: 'Descida ao porto', cena: 'Praça da Cidade Alta' },
      { id: 'x3', tipo: 'alavanca', nome: 'Comporta da galeria', cena: 'Galeria norte' },
    ],
    agenda: [['Navio Carcará atraca', 'Dia 3, 2º apito'], ['Troca da guarda', 'Todo dia, 4º apito']],
    estados: [['mare', 'Maré', ['alta', 'baixa'], 'alta'], ['sino', 'Sino da torre', ['calado', 'tocando'], 'calado']],
  };

  /* ---------------- marcador Acervo */
  const ACERVO = {
    pastas: [
      { nome: 'NPCs', conta: 29, aberta: true, fichas: [['Estivador', '#c98a5b'], ['Guarda do cais', '#e2645a'], ['Capitã Iara', '#79a9cc'], ['Contrabandista', '#ab93d6'], ['Mercador', '#e0a44a'], ['Gato do porto', '#a2a09a']] },
      { nome: 'Veículos', conta: 0, fichas: [] },
      { nome: 'Jogadores', conta: 10, fichas: [['Vagn', '#79a9cc'], ['Nami', '#7fb48a'], ['Ryo', '#ab93d6'], ['Vinícius', '#e0a44a']] },
      { nome: 'Sem pasta', conta: 1, fichas: [['Saga', '#c98a5b']] },
    ],
    categorias: ['Todas', 'Chaves', 'Documentos', 'Armas', 'Moedas'],
    itens: [['Chave de ferro', 'chave', 'Chaves'], ['Selo da Guilda', 'selo', 'Documentos'], ['Mapa rasgado', 'cena', 'Documentos'], ['Adaga curva', 'seta', 'Armas'], ['Bolsa de moedas', 'moedas', 'Moedas'], ['Lanterna', 'lampiao', 'Todas']],
  };

  /* ---------------- livro da direita */
  const SALA = {
    codigo: 'KX7 41',
    jogadores: [
      { id: 'vagn', nome: 'Vagn', ficha: 'Vagn', cor: '#79a9cc', cena: 'Porto de Tasmaturi', on: true },
      { id: 'jimena', nome: 'Nami', ficha: 'Nami', cor: '#7fb48a', cena: 'Porto de Tasmaturi', on: true },
      { id: 'vinicius', nome: 'Vinícius', ficha: 'Saga (emprestada)', cor: '#c98a5b', cena: 'Porto de Tasmaturi', on: false },
      { id: 'ryo', nome: 'Ryo', ficha: 'Ryo', cor: '#ab93d6', cena: 'Armazém 3', on: true },
    ],
    chegando: [{ id: 'umaru', nome: 'Umaru', cor: '#a2a09a' }],
    pedido: { quem: 'Ryo', para: 'Praça da Cidade Alta' },
    personagens: [['Vagn', 'Jogador', '#79a9cc'], ['Nami', 'Jogador', '#7fb48a'], ['Ryo', 'Jogador', '#ab93d6'], ['Saga', 'NPC', '#c98a5b'], ['Capitã Iara', 'NPC', '#79a9cc']],
    contas: [['Saga', 0, 1], ['Vagner', 1, 0], ['Nami Rocha', 1, 0], ['Ryo', 1, 0], ['Vinícius', 0, 1], ['Umaru', 1, 0]],
    cenas: [
      { pasta: 'Porto', itens: [['Porto de Tasmaturi', 3, 'inicial', true], ['Armazém 3', 1], ['Navio Carcará', 0]] },
      { pasta: 'Cidade Alta', itens: [['Praça da Cidade Alta', 0], ['Torre do sino', 0]] },
      { pasta: 'Esgotos', itens: [['Galeria norte', 0]] },
    ],
    chat: [
      { quem: 'Nami', cor: '#7fb48a', cena: 'Porto', txt: 'Alguém viu para onde o guarda foi?' },
      { quem: 'Vagn', cor: '#79a9cc', cena: 'Porto', txt: 'Ele entrou no armazém. Vou espiar a porta.' },
      { quem: 'Ryo', cor: '#ab93d6', cena: 'Armazém 3', txt: 'Achei umas caixas aqui com o selo da Guilda.' },
    ],
  };

  /* ---------------- tela do jogador */
  const JOGADOR = {
    personagem: { nome: 'Vagn', cor: '#79a9cc', sub: 'Emprestado pelo mestre', onde: 'Cais do Porto' },
    acoes: [
      ['sinalizar', 'Sinalizar', 'bandeira', 'Toque no mapa para sinalizar. No PC: Alt+clique ou segure o clique parado.'],
      ['medir', 'Medir', 'regua', 'Arraste no mapa para medir a distância.'],
      ['laser', 'Laser', 'laser', 'Aponte no mapa: quem está na cena vê o seu laser.'],
      ['marcacoes', 'Marcações', 'marcador', 'Toque no mapa para marcar destino, anotar ou deixar uma marca.'],
    ],
    comigo: [['Corda (10 m)', 'Achada no cais'], ['Lanterna', 'Comprada na loja']],
    moedas: 14,
    grupo: [['Nami', 'Cais do Porto', '#7fb48a'], ['Ryo', 'Armazém 3', '#ab93d6']],
    notas: [['O guarda de vermelho troca de turno no 4º apito', 'Cais do Porto'], ['Caixas com selo da Guilda', 'Armazém 3']],
    lugares: [['Cais do Porto', true], ['Armazém 3', false], ['Sala 2', false]],
  };

  window.GR = { MAPA, BARRA, TECLAS, FERRAMENTAS, TIPOS, CENA, AVENTURA, ACERVO, SALA, JOGADOR, CORES, JOGADORES };
})();
