# Passeio do jogador (persona: jogador de RPG, 22 anos, notebook, primeira vez no Labirinto)

Data: 2026-11-26. Inicio: mesa em http://localhost:1420/ (navegador) e lobby em http://localhost:1430/.
Resumo: os objetivos 1, 2 e 3 como jogador e o objetivo 4 (lobby) ficaram bloqueados: a mesa no navegador nao oferece sala/convite e o lobby so responde 404. Os achados abaixo sao o que um jogador/mestre novo encontra tentando chegar la.

## Achados (lista legivel: tela, o que tentou, o que atrapalhou, sugestao, gravidade, print)

### A1 - Mesa no navegador: nao existe botao de abrir sala / convidar jogador (gravidade ALTA)
- tela: Mesa do mestre (editor do mapa "Cripta de teste"), abas Ficha, Cena, Aventura, Acervo, Jogos, DOCS; livro da mesa Cenas, Batalha, Sons, Cutscenes; menu Arquivo; Atalhos do teclado; Configuracoes do mapa; Configurar Mapa vivo
- tentou: achar "abrir sala", "convidar" ou "link da sala" para entrar como jogador numa segunda janela
- atrapalhou: nenhuma tela, menu ou atalho mostra sala/convite; o painel do pino diz "Ler agora precisa da sala aberta", mas a sala nao se abre em lugar nenhum e nada explica que ela so existe no app instalado (a aba DOCS avisa isso para documentos, a sala nao avisa)
- sugestao: mostrar o botao "Abrir sala" sempre, desabilitado no navegador com o motivo ("so no app instalado") e um link de ajuda
- print: C:\dev\labirinto\docs\qualidade-de-vida\prints\jogador-02-mesa-sem-convite.png

### A2 - Lobby: so mostra "O Lobby respondeu 404" e nao deixa fazer nada (gravidade ALTA)
- tela: Lobby da mesa (http://localhost:1430/), cartao "O Lobby nao respondeu direito"
- tentou: entrar no lobby, ver campanha, ficha e galeria; clicou "Tentar de novo" 3 vezes, "Suas mesas" e o logo; reabriu em sessao nova
- atrapalhou: o erro e tecnico ("respondeu 404") e sem ponto entre as frases ("404 Tente de novo"); "Tentar de novo" recarrega a pagina inteira (tela preta por um instante) e volta ao mesmo erro, sem contador nem indicacao de que tentou; nao ha caminho para entrar, nem botao de login visivel
- sugestao: mensagem humana ("O servidor do lobby esta fora do ar") com carregando no botao e, depois de 2 falhas, dizer o que fazer (avisar o mestre)
- print: C:\dev\labirinto\docs\qualidade-de-vida\prints\jogador-01-lobby-entrada.png

### A3 - Abas do painel Jogos com caractere quebrado (quadradinho) (gravidade MEDIA)
- tela: Mesa, aba Jogos, abas "Acao", "Objetos", "Puzzles"
- tentou: abrir a aba Jogos para achar dados/minijogos
- atrapalhou: depois de cada rotulo aparece um quadrado vazio (glifo que a fonte nao tem)
- sugestao: trocar o simbolo por icone SVG ou por um caractere que a fonte cubra
- print: C:\dev\labirinto\docs\qualidade-de-vida\prints\jogador-04-abas-jogos-caractere-quebrado.png

### A4 - "Enquadrar tudo" (tecla F) poe o mapa atras dos paineis e do titulo (gravidade MEDIA)
- tela: Mesa, area do mapa, zoom 71% depois de F
- tentou: olhar em volta e enquadrar a sala inteira
- atrapalhou: a sala ocupa a janela inteira, com a borda esquerda atras do painel esquerdo, a direita atras do painel direito e a de cima atras do titulo da cena; a alca de girar da sala fica debaixo do titulo
- sugestao: enquadrar so na area livre entre os paineis, com margem
- print: C:\dev\labirinto\docs\qualidade-de-vida\prints\jogador-03-enquadrar-atras-paineis.png

### A5 - "Voltar ao inicio" nao sai do mapa no navegador: tenta salvar, falha e prende o usuario (gravidade ALTA)
- tela: Mesa, botao de logo no topo esquerdo ("Voltar ao inicio") e menu Arquivo > Voltar ao inicio
- tentou: voltar para a tela inicial para procurar uma entrada de jogador
- atrapalhou: os dois caminhos mostram "Nao foi possivel salvar o mapa: salvar e abrir arquivos so funciona no aplicativo instalado" e ficam no mapa; clicar de novo repete o mesmo erro; nao ha "Sair sem salvar"; o aviso vermelho cobre o nome do pino no mapa
- sugestao: quando salvar falha, perguntar "Sair sem salvar?" / "Exportar antes" em vez de bloquear a saida
- print: C:\dev\labirinto\docs\qualidade-de-vida\prints\jogador-05-voltar-inicio-preso.png

### A6 - Tela inicial da mesa nao tem caminho de jogador (gravidade MEDIA)
- tela: tela inicial "Labirinto" (Criar Mapas, Carregar Mapa existente, Roleplay, Livros de regras)
- tentou: como jogador que recebeu o endereco, achar "Entrar numa sala" ou "Sou jogador"
- atrapalhou: as quatro portas sao de mestre; quem chega como jogador nao sabe se esta no lugar certo
- sugestao: uma quinta porta "Entrar como jogador" (pede o link/codigo da sala, ou explica que o mestre manda o link)
- print: C:\Users\gedasio.filho\AppData\Local\Temp\passeio-jogador\m01-inicio.png

### A7 - Roda do mouse: vertical aproxima, lateral anda de lado; nao ha roda para olhar para cima/baixo (gravidade MEDIA)
- tela: Mesa, area do mapa
- tentou: olhar em volta com a roda (o gesto de dois dedos do touchpad do notebook manda o mesmo evento de roda)
- atrapalhou: roda para baixo afasta (33% -> 22%), para cima aproxima, roda lateral anda de lado 400 px; nenhum gesto de roda anda na vertical (so Espaco + arrastar, que a tela de atalhos lista); com o pino debaixo do titulo da cena nao deu para descer a vista; seta para cima, com o foco nas abas, trocou a aba do painel em vez de mover a vista
- sugestao: Shift+roda (ou modo "touchpad") para andar na vertical, e Ctrl+roda/pinca para zoom
- print: C:\dev\labirinto\docs\qualidade-de-vida\prints\jogador-03-enquadrar-atras-paineis.png

### A8 - Nome do pino ("papel no chao") ilegivel no zoom inicial (gravidade MEDIA)
- tela: Mesa, pino "Bilhete rasgado" na Sala 1
- tentou: achar e ler o pino no chao
- atrapalhou: no zoom com que o mapa abre (33%) o nome do pino vira um risco de poucos pixels; em 71% tem cerca de 6 px; so fica legivel perto de 100%, texto claro com contorno escuro sobre o chao salmao
- sugestao: nome do pino com tamanho minimo na tela (nao encolher abaixo de ~11 px) e fundo de pilula como o nome da sala
- print: C:\dev\labirinto\docs\qualidade-de-vida\prints\jogador-03-enquadrar-atras-paineis.png

### A9 - Campo "Nome do mapa" vem preenchido e o texto digitado gruda no padrao (gravidade BAIXA)
- tela: Novo Dungeon Map, campo Nome do mapa
- tentou: digitar "Cripta de teste" no campo
- atrapalhou: o mapa nasceu com o nome "Mapa sem tituloCripta de teste" (o padrao e valor, nao exemplo, e nao fica selecionado ao focar)
- sugestao: usar "Mapa sem titulo" como placeholder, ou selecionar tudo ao focar
- print: C:\dev\labirinto\docs\qualidade-de-vida\prints\jogador-02-mesa-sem-convite.png

### A10 - Ligar ficha de jogador ao token: lista "Personagem" so tem "sem personagem", sem dizer onde criar (gravidade MEDIA)
- tela: Mesa, token Kael > Ficha de jogador > Comportamento > Personagem
- tentou: ligar uma ficha de exemplo ao token para entrar na batalha (Iniciar batalha avisa "1 token de jogador sem ficha fica fora: ligue a ficha dele no token")
- atrapalhou: a lista so tem "- sem personagem"; nenhuma ficha de exemplo e nenhum "Criar personagem" ou link para Livros de regras
- sugestao: item "+ Criar personagem" no fim da lista e uma ficha de exemplo pronta
- print: C:\Users\gedasio.filho\AppData\Local\Temp\ux-driver\mestre-j\quadros\1795665239644-0076-clicar-depois.png

## Achados no formato do contrato (JSON)

```json
[
  {
    "tela": "Mesa do mestre no navegador: editor do mapa (abas Ficha, Cena, Aventura, Acervo, Jogos, DOCS; Cenas, Batalha; menu Arquivo; Atalhos do teclado; Configuracoes do mapa; Configurar > Mapa vivo)",
    "gesto_tentado": "clicar em cada aba, menu e configuracao procurando abrir sala / convidar jogador",
    "esperado": "um botao 'Abrir sala' ou 'Convidar' que de o link para o jogador entrar numa segunda janela",
    "obtido": "nenhum botao, menu ou atalho de sala/convite; o pino diz 'Ler agora precisa da sala aberta', mas nada abre a sala nem explica que ela so existe no app instalado",
    "passos": [
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs abrir --sessao mestre-j --url http://localhost:1420/ --largura 1366 --altura 768",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor \"texto:Criar Mapas\" --espera-ms 1200",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs digitar --sessao mestre-j --seletor \"#lb-map-name\" --texto \"Cripta de teste\" --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor ref:e32 --espera-ms 2500",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor \"button[aria-label=Arquivo]\" --espera-ms 800 --arvore-linhas 60",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs tecla --sessao mestre-j --combo Escape --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 37 --y 160 --espera-ms 800 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 222 --y 186 --espera-ms 1000 --arvore-linhas 50",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs tecla --sessao mestre-j --combo Escape --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor \"button[aria-label='Configurações do mapa']\" --espera-ms 800 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs tecla --sessao mestre-j --combo Escape --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs estado --sessao mestre-j --arvore-linhas 600",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor \"button[aria-label='Atalhos do teclado']\" --espera-ms 800 --arvore-linhas 200",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs tecla --sessao mestre-j --combo Escape --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 37 --y 160 --espera-ms 800 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs foto --sessao mestre-j --saida C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-02-mesa-sem-convite.png --sem-arvore"
    ],
    "quadros": [
      "C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-02-mesa-sem-convite.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665117517-0042-clicar-depois.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665173307-0062-clicar-depois.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665131878-0048-clicar-depois.png"
    ],
    "metrica": null,
    "tipo_defeito": null,
    "classe": "sugestao",
    "produto_referencia": null,
    "repro_referencia": null
  },
  {
    "tela": "Lobby da mesa (http://localhost:1430/), cartao 'O Lobby nao respondeu direito'",
    "gesto_tentado": "clicar em 'Tentar de novo' (3 vezes), 'Suas mesas' e no logo; reabrir o lobby em sessao nova",
    "esperado": "entrar no lobby e ver a campanha, a ficha e a galeria; se o servidor falhar, mensagem humana e botao que mostre que esta tentando",
    "obtido": "so o cartao 'O Lobby respondeu 404 Tente de novo em instantes.' (sem ponto entre as frases); 'Tentar de novo' recarrega a pagina inteira (tela preta) e volta ao mesmo erro; nenhum login, campanha, ficha ou galeria alcancavel",
    "passos": [
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs abrir --sessao lobby-j --url http://localhost:1430/ --largura 1366 --altura 768",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs foto --sessao lobby-j --saida C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-01-lobby-entrada.png --arvore-linhas 120",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao lobby-j --seletor ref:e11 --espera-ms 2500",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao lobby-j --seletor ref:e7 --espera-ms 1500 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao lobby-j --seletor \"texto:Tentar de novo\" --espera-ms 3000 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao lobby-j --seletor \"texto:Tentar de novo\" --espera-ms 30 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs fechar --sessao lobby-j",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs abrir --sessao lobby-j2 --url http://localhost:1430/ --largura 1366 --altura 768",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs esperar --sessao lobby-j2 --texto \"respondeu\" --timeout-ms 6000",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao lobby-j2 --seletor ref:e2 --espera-ms 1500 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs fechar --sessao lobby-j2"
    ],
    "quadros": [
      "C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-01-lobby-entrada.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/lobby-j/quadros/1795665275774-0008-clicar-depois.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/lobby-j/quadros/1795665194661-0002-clicar-depois.png"
    ],
    "metrica": null,
    "tipo_defeito": null,
    "classe": "sugestao",
    "produto_referencia": null,
    "repro_referencia": null
  },
  {
    "tela": "Mesa, aba Jogos, abas 'Acao', 'Objetos', 'Puzzles'",
    "gesto_tentado": "clicar na aba Jogos do livro do mestre",
    "esperado": "rotulos das abas limpos (ou com contador legivel)",
    "obtido": "um quadrado vazio (glifo que a fonte nao tem) depois de cada rotulo",
    "passos": [
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 37 --y 327 --espera-ms 1000 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs foto --sessao mestre-j --saida C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-04-abas-jogos-caractere-quebrado.png --elemento \"#_r_o_\" --sem-arvore"
    ],
    "quadros": [
      "C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-04-abas-jogos-caractere-quebrado.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665328084-0098-clicar-depois.png"
    ],
    "metrica": null,
    "tipo_defeito": null,
    "classe": "sugestao",
    "produto_referencia": null,
    "repro_referencia": null
  },
  {
    "tela": "Mesa, area do mapa depois de 'Enquadrar tudo' (zoom 71%)",
    "gesto_tentado": "tecla f",
    "esperado": "a sala inteira visivel na area livre entre os paineis",
    "obtido": "a sala ocupa a janela toda: borda esquerda atras do painel esquerdo, direita atras do painel direito, topo atras do titulo da cena; a alca de girar da sala fica debaixo do titulo",
    "passos": [
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs tecla --sessao mestre-j --combo f --espera-ms 600 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs foto --sessao mestre-j --saida C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-03-enquadrar-atras-paineis.png --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 900 --y 560 --espera-ms 1500 --sem-arvore"
    ],
    "quadros": [
      "C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-03-enquadrar-atras-paineis.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665320099-0096-clicar-depois.png"
    ],
    "metrica": null,
    "tipo_defeito": null,
    "classe": "sugestao",
    "produto_referencia": null,
    "repro_referencia": null
  },
  {
    "tela": "Mesa, botao 'Voltar ao inicio' (logo no topo esquerdo) e menu Arquivo > Voltar ao inicio",
    "gesto_tentado": "clicar em 'Voltar ao inicio' pelos dois caminhos",
    "esperado": "voltar a tela inicial, ou perguntar se quer sair sem salvar",
    "obtido": "aviso 'Nao foi possivel salvar o mapa: salvar e abrir arquivos so funciona no aplicativo instalado...' e o app continua no mapa; repetir da o mesmo resultado; o aviso cobre o nome do pino",
    "passos": [
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 37 --y 37 --espera-ms 800 --arvore-linhas 80",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor \"button[aria-label='Voltar ao início']\" --espera-ms 1200 --arvore-linhas 40",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs foto --sessao mestre-j --saida C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-05-voltar-inicio-preso.png --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor \"button[aria-label='Voltar ao início']\" --espera-ms 1200 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor \"button[aria-label=Arquivo]\" --espera-ms 600 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 373 --y 262 --espera-ms 1500 --sem-arvore"
    ],
    "quadros": [
      "C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-05-voltar-inicio-preso.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665442063-0112-clicar-depois.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665460791-0120-clicar-depois.png"
    ],
    "metrica": null,
    "tipo_defeito": null,
    "classe": "sugestao",
    "produto_referencia": null,
    "repro_referencia": null
  },
  {
    "tela": "Tela inicial 'Labirinto' (Criar Mapas, Carregar Mapa existente, Roleplay, Livros de regras)",
    "gesto_tentado": "foto da tela inicial procurando entrada de jogador",
    "esperado": "uma porta 'Entrar como jogador' / 'Entrar numa sala'",
    "obtido": "as quatro portas sao de mestre; nada para quem chega como jogador",
    "passos": [
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs abrir --sessao mestre-j --url http://localhost:1420/ --largura 1366 --altura 768",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs foto --sessao mestre-j --saida C:/Users/gedasio.filho/AppData/Local/Temp/passeio-jogador/m01-inicio.png",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor ref:e11 --espera-ms 1000"
    ],
    "quadros": [
      "C:/Users/gedasio.filho/AppData/Local/Temp/passeio-jogador/m01-inicio.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665013233-0002-clicar-depois.png"
    ],
    "metrica": null,
    "tipo_defeito": null,
    "classe": "sugestao",
    "produto_referencia": null,
    "repro_referencia": null
  },
  {
    "tela": "Mesa, area do mapa",
    "gesto_tentado": "rolar --dy 400, rolar --dy -400, rolar --dx 400, rolar --dx -500 sobre o canvas; tecla ArrowUp",
    "esperado": "conseguir olhar para cima/baixo e para os lados com a roda ou o touchpad, e aproximar com outro gesto",
    "obtido": "roda vertical so aproxima/afasta (33% -> 22% -> 33%); roda lateral anda de lado 400 px; nenhum gesto de roda anda na vertical, entao o pino ficou debaixo do titulo da cena sem jeito de descer a vista pela roda; seta para cima, com o foco nas abas, trocou a aba do painel (Jogos -> Acervo) em vez de mover a vista",
    "passos": [
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs rolar --sessao mestre-j --em canvas --dx 0 --dy 400 --espera-ms 600 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs rolar --sessao mestre-j --em canvas --dx 0 --dy -400 --espera-ms 600 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs rolar --sessao mestre-j --em canvas --dx 400 --dy 0 --espera-ms 600 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs rolar --sessao mestre-j --em canvas --dx 0 --dy -600 --espera-ms 600 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs rolar --sessao mestre-j --em canvas --dx -500 --dy 0 --espera-ms 600 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs tecla --sessao mestre-j --combo ArrowUp --espera-ms 500 --sem-arvore"
    ],
    "quadros": [
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665288358-0087-rolar-antes.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665289123-0088-rolar-depois.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665297802-0090-rolar-depois.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665299263-0092-rolar-depois.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665380194-0104-rolar-depois.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665390953-0106-tecla-depois.png"
    ],
    "metrica": null,
    "tipo_defeito": null,
    "classe": "sugestao",
    "produto_referencia": null,
    "repro_referencia": null
  },
  {
    "tela": "Mesa, pino 'Bilhete rasgado' na Sala 1",
    "gesto_tentado": "olhar o mapa no zoom de abertura (33%), em 71% (tecla f) e em 106%",
    "esperado": "ler o nome do pino no chao sem precisar aproximar muito",
    "obtido": "em 33% o nome e um risco ilegivel; em 71% tem cerca de 6 px; so fica legivel perto de 100%, texto claro com contorno escuro sobre o chao salmao",
    "passos": [
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs foto --sessao mestre-j --saida C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-03-enquadrar-atras-paineis.png --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs rolar --sessao mestre-j --em canvas --dx 0 --dy 200 --espera-ms 600 --sem-arvore"
    ],
    "quadros": [
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665096737-0036-digitar-depois.png",
      "C:/dev/labirinto/docs/qualidade-de-vida/prints/jogador-03-enquadrar-atras-paineis.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665403591-0108-rolar-depois.png"
    ],
    "metrica": null,
    "tipo_defeito": null,
    "classe": "sugestao",
    "produto_referencia": null,
    "repro_referencia": null
  },
  {
    "tela": "Novo Dungeon Map, campo 'Nome do mapa'",
    "gesto_tentado": "digitar 'Cripta de teste' no campo de nome",
    "esperado": "o mapa se chamar 'Cripta de teste'",
    "obtido": "o mapa se chamou 'Mapa sem tituloCripta de teste' (o padrao e valor do campo e nao fica selecionado)",
    "passos": [
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs digitar --sessao mestre-j --seletor \"#lb-map-name\" --texto \"Cripta de teste\" --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor ref:e32 --espera-ms 2500"
    ],
    "quadros": [
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665026352-0008-digitar-depois.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/passeio-jogador/m02-editor.png"
    ],
    "metrica": null,
    "tipo_defeito": null,
    "classe": "sugestao",
    "produto_referencia": null,
    "repro_referencia": null
  },
  {
    "tela": "Mesa, token Kael > Ficha de jogador > Comportamento > Personagem",
    "gesto_tentado": "abrir a lista 'Personagem' para ligar uma ficha ao token",
    "esperado": "fichas de exemplo para escolher, ou '+ Criar personagem'",
    "obtido": "a lista so tem '- sem personagem', sem dizer por que nem onde criar uma ficha; Iniciar batalha avisa que o token sem ficha fica fora",
    "passos": [
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 682 --y 384 --espera-ms 800 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 252 --y 283 --espera-ms 1000 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs rolar --sessao mestre-j --em \"#_r_o_\" --dx 0 --dy 800 --espera-ms 500 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 117 --y 505 --espera-ms 1000 --arvore-linhas 150",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --x 194 --y 256 --espera-ms 600 --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs tecla --sessao mestre-j --combo Escape --sem-arvore",
      "node C:/Users/gedasio.filho/.claude/scripts/ux-driver.cjs clicar --sessao mestre-j --seletor \"texto:Iniciar batalha\" --espera-ms 1500 --sem-arvore"
    ],
    "quadros": [
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665239644-0076-clicar-depois.png",
      "C:/Users/gedasio.filho/AppData/Local/Temp/ux-driver/mestre-j/quadros/1795665250253-0080-clicar-depois.png"
    ],
    "metrica": null,
    "tipo_defeito": "vazio_sem_mensagem",
    "classe": "sugestao",
    "produto_referencia": null,
    "repro_referencia": null
  }
]
```

## COMO PASSEEI
- abrir mestre-j em http://localhost:1420/ -> tela inicial com 4 portas, todas de mestre
- clicar "Carregar Mapa existente" -> "Nenhum mapa salvo ainda", so "Procurar no disco..." (nao usei: arquivos do usuario); Voltar
- clicar "Criar Mapas", digitar nome, "Criar mapa" -> editor abriu com o nome "Mapa sem tituloCripta de teste" (A9)
- ferramenta Sala + arrastar 420,200 -> 900,520 (pausa 200 ms) -> Sala 1 criada
- "+ Token", digitar "Kael" + Enter -> token no centro
- clicar ref:e96 (Pino) falhou: "ref e96 nao existe nesta pagina" (a arvore tinha mudado); refeito por coordenada 688,733; clique no mapa fincou o pino; selecionado, preenchidos Nome "Bilhete rasgado" e Descricao
- clicar no logo 37,37 -> era "Voltar ao inicio": aviso de que salvar so funciona no app instalado (A5)
- clicar 1327,37 (icone do topo direito) -> nada visivel mudou
- menu Arquivo, inventario: Abrir..., Importar mapa (pasta)..., Exportar mapa (pasta)..., Exportar imagem (PNG)..., Importar imagem de fundo..., Voltar ao inicio. Itens escolhidos: 1 de 6 (Voltar ao inicio); os outros abrem escolha de arquivo do computador (ver lacunas)
- aba Cena -> "Mapa vivo: desligado. Configurar" -> dialogo com Visao, Ambiente, Tamanho do mapa, Tamanho da ficha, Tipo de mapa, Mapa vivo: nenhum item de sala/convite; Escape fechou
- aba Aventura (Pinos, Agenda, Estado do mundo); Configuracoes do mapa (Grade, Alinhar a imagem, Medicao, Tamanho do mapa, Texto de chegada, Rostos, Moveis, Armadilhas, Sistema de RPG): nenhum item de sala
- estado com 600 linhas de arvore: nenhum controle com "sala", "convid" ou "link" (A1)
- "Mais acoes" da cena: o clique so revelou os icones da linha, sem menu
- aba Batalha -> "Iniciar batalha" abre formulario (Abertura, Nome na abertura, Empate 1d20/Eu decido, Regra do campo) e avisa "1 token de jogador sem ficha fica fora"; Cancelar
- Atalhos do teclado: nenhum atalho de sala/convite; Escape fechou
- abrir lobby-j em http://localhost:1430/ -> "O Lobby respondeu 404"; Tentar de novo 3x (recarrega a pagina, mesmo erro), "Suas mesas" sem efeito (A2)
- aba DOCS -> "Os documentos moram no aplicativo do mestre: abra o Labirinto instalado"
- token Kael > "Ficha de jogador" > Personagem: lista so com "- sem personagem" (A10)
- aba Acervo: Tokens vazio com mensagem (aba Itens fora desta sessao, nao aberta)
- tres gestos de roda no canvas: dy 400 afastou (33% -> 22%); dy -400 aproximou (22% -> 33%); dx 400 andou de lado; dx -500 andou para o outro lado; efeitos distintos, nenhum anda na vertical (A7)
- tecla f -> Enquadrar tudo pos a sala atras dos paineis (A4)
- clique no chao com Kael selecionado (Clicar para andar ligado) -> selecionou a Sala 1, o token nao andou (no mestre o clique seleciona)
- aba Jogos -> abas com glifo quebrado (A3)
- tecla ArrowUp com foco nas abas -> trocou de aba (Jogos -> Acervo), nao moveu a vista
- reabri o lobby em sessao nova (lobby-j2): mesmo 404; clique no logo sem efeito
- Voltar ao inicio pelo logo (2x) e pelo menu Arquivo (item a 373,262; uma tentativa com texto:Voltar ao inicio acertou o logo de novo) -> sempre o mesmo aviso e o app fica no mapa (A5)
- fechar mestre-j, fechar lobby-j, fechar lobby-j2 (config_restaurada null nas tres: nenhuma config alterada)
- alvo pequeno: nenhum gesto central do jogador foi alcancado (sem sala), entao nao houve repeticao em alvo < 24 px

## O QUE NAO CONSEGUI TESTAR
- Objetivos 1, 2 e 3 como jogador (entrar na sala e achar a ficha; andar, ler pino, chat, rolar dados; batalha com vez, tecnica, mira e reacao): a mesa no navegador nao tem sala nem convite. Tentativas: menu Arquivo, abas Ficha/Cena/Aventura/Acervo/Jogos/DOCS, Cenas/Batalha, Configuracoes do mapa, Configurar > Mapa vivo, Atalhos do teclado e "estado --sessao mestre-j --arvore-linhas 600"; nenhum controle de sala. O app instalado nao foi aberto porque o inicio recebido e so o endereco do navegador. Virou o achado A1.
- Batalha do lado do mestre: Iniciar batalha avisa que o token sem ficha fica fora e a lista Personagem nao tem ficha (A10); criar ficha exigiria sair do mapa, e sair falha (A5).
- Objetivo 4 (lobby: entrar, campanha, ficha, galeria): o lobby so responde 404 em duas sessoes (lobby-j e lobby-j2) e "Tentar de novo" nao muda nada (A2).
- Roda com tecla de modificador (Ctrl+roda, Shift+roda) no mapa: o "rolar" do driver nao tem opcao para segurar tecla durante a roda (rodados: rolar --em canvas --dy 400, --dy -400, --dx 400, sem variante com modificador).
- Pairar sobre pino e token para ver cartao ou alca: "rolar --sessao mestre-j --em 1327,37 --dx 0 --dy 0" devolveu "querySelector ... '1327,37' is not a valid selector"; o --em nao aceitou coordenada, e pino/token vivem dentro do canvas, sem seletor proprio.
- Itens do menu Arquivo alem de "Voltar ao inicio" (Abrir..., Importar mapa (pasta)..., Exportar mapa (pasta)..., Exportar imagem (PNG)..., Importar imagem de fundo...): abrem escolha de arquivo do computador, o que o pedido proibe ("nao use arquivos do usuario"), e sao de mestre.
- Telas de Inventario e Itens e abas de armas/itens da ficha: fora desta sessao por ordem do pedido.
- Fluidez (medir): passeio sem fatia de fluidez; nao medi.
