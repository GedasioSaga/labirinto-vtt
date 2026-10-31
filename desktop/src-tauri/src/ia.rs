//! Assistente do mestre (M4 do mundo do livro de regras): IA do Google
//! (Gemini) com a chave guardada no Cofre do Windows.
//!
//! Desenho de segurança (docs/planos/livros-de-regras-plano.md, M4):
//! - a chave mora no Credential Manager, alvo `labirinto-vtt.gemini`, como um
//!   JSON com as chaves e o índice da ativa; nunca em arquivo do app, porque o
//!   `fs:scope` deixa a webview ler toda a pasta APPDATA;
//! - a chamada HTTP sai daqui, não da webview: a webview manda o pedido e
//!   recebe só o texto da resposta; nenhum comando devolve a chave;
//! - a URL é fixa no código e o modelo vem de uma lista fechada;
//! - nada aqui registra chave nem corpo em log;
//! - os quatro comandos recusam qualquer janela que não seja a `main` (a
//!   visão de jogador roda o mesmo código de front e não pode usar a IA).

use std::time::Duration;

use base64::Engine as _;
use reqwest::header::{HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{State, WebviewWindow};

/// Única janela autorizada a usar a IA.
const ROTULO_MAIN: &str = "main";
/// Nome da credencial no Gerenciador de Credenciais do Windows.
pub const ALVO_COFRE: &str = "labirinto-vtt.gemini";

const CHAVES_MAX: usize = 3;
const CHAVE_MIN_CARACTERES: usize = 30;
const CHAVE_MAX_CARACTERES: usize = 100;

/// Cópia da lista fechada de modelos do lado TypeScript
/// (client/src/lib/ia/portaDaIa.ts, `MODELOS_GEMINI`, portada do
/// projeto-rpg-v2). Mudou lá, muda aqui: modelo fora desta lista é recusado.
pub const MODELOS_GEMINI: [&str; 9] = [
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-pro",
    "gemini-3.1-pro-preview",
];

const URL_MODELOS: &str = "https://generativelanguage.googleapis.com/v1beta/models/";
const METODO: &str = ":generateContent";
const CABECALHO_CHAVE: &str = "x-goog-api-key";

/// Baixa mas não zero: número de balanceamento não pode mudar a cada pergunta
/// igual (mesmos valores do projeto-rpg-v2).
const TEMPERATURA: f64 = 0.2;
const TOP_P: f64 = 0.9;

const TEMPO_TOTAL: Duration = Duration::from_secs(90);
const TEMPO_CONEXAO: Duration = Duration::from_secs(15);

const MIB: usize = 1024 * 1024;
const CORPO_MAX_BYTES: usize = 4 * MIB;
const RESPOSTA_MAX_BYTES: usize = 2 * MIB;
/// Retrato reduzido a 512 px cabe folgado; o teto só barra lixo.
const IMAGEM_MAX_BASE64: usize = 2 * MIB;
const IMAGENS_MAX: usize = 4;
const HISTORICO_MAX: usize = 200;
const DETALHE_MAX_CARACTERES: usize = 300;
const MIMES_IMAGEM: [&str; 3] = ["image/png", "image/jpeg", "image/webp"];
const CHAVE_MASCARADA: &str = "(chave)";

// ---------------------------------------------------------------------------
// Erro que cruza o IPC
// ---------------------------------------------------------------------------

/// Erro devolvido à webview. `codigo` é estável (o TS decide por ele);
/// `mensagem` já vem pronta para o usuário. Nunca carrega a chave: o
/// `detalhe` do Google passa por [`detalhe_seguro`] antes de sair.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErroIa {
    pub codigo: &'static str,
    pub mensagem: String,
    pub status: Option<u16>,
    pub detalhe: Option<String>,
}

impl ErroIa {
    fn novo(codigo: &'static str, mensagem: impl Into<String>) -> Self {
        Self {
            codigo,
            mensagem: mensagem.into(),
            status: None,
            detalhe: None,
        }
    }

    fn com_http(mut self, status: u16, detalhe: String) -> Self {
        self.status = Some(status);
        self.detalhe = (!detalhe.is_empty()).then_some(detalhe);
        self
    }
}

fn erro_corpo(mensagem: impl Into<String>) -> ErroIa {
    ErroIa::novo("corpo_invalido", mensagem)
}

fn erro_cofre(mensagem: impl Into<String>) -> ErroIa {
    ErroIa::novo("cofre", mensagem)
}

fn exigir_main(window: &WebviewWindow) -> Result<(), ErroIa> {
    if window.label() == ROTULO_MAIN {
        Ok(())
    } else {
        Err(ErroIa::novo(
            "janela",
            "O assistente só funciona na janela principal do app.",
        ))
    }
}

// ---------------------------------------------------------------------------
// Estado e o que fica no cofre
// ---------------------------------------------------------------------------

/// Serializa o acesso ao cofre: a crate do Windows avisa que operações na
/// mesma credencial em threads diferentes não saem em ordem garantida.
/// A trava cobre só ler e gravar, nunca a chamada HTTP (até 90 s).
#[derive(Default)]
pub struct IaEstado {
    trava_cofre: tokio::sync::Mutex<()>,
}

/// O JSON guardado no cofre. Sem `Debug` de propósito: nada imprime isto.
#[derive(Serialize, Deserialize, PartialEq)]
struct ChavesGuardadas {
    chaves: Vec<String>,
    ativa: usize,
}

impl ChavesGuardadas {
    /// Índice da ativa sempre dentro da lista, mesmo se o cofre foi editado
    /// à mão. Chamar só com a lista não vazia.
    fn inicio(&self) -> usize {
        self.ativa.min(self.chaves.len().saturating_sub(1))
    }
}

#[cfg(windows)]
mod cofre {
    use std::collections::HashMap;

    use keyring_core::api::CredentialStoreApi as _;
    use keyring_core::{Entry, Error};

    use super::{erro_cofre, ErroIa, ALVO_COFRE};

    const SERVICO: &str = "gemini";
    const USUARIO: &str = "labirinto-vtt";

    fn mensagem(erro: &Error) -> String {
        // O Display da keyring-core descreve a falha do Windows; nunca inclui
        // o segredo (ele não passa pelos erros da crate).
        format!("Não deu para usar o Cofre do Windows ({erro}).")
    }

    fn entrada() -> Result<Entry, ErroIa> {
        let store =
            windows_native_keyring_store::Store::new().map_err(|e| erro_cofre(mensagem(&e)))?;
        // `target` fixa o nome da credencial; `Local` = só neste computador
        // (o padrão da crate, Enterprise, viaja com o perfil de domínio).
        let modificadores = HashMap::from([("target", ALVO_COFRE), ("persistence", "Local")]);
        store
            .build(SERVICO, USUARIO, Some(&modificadores))
            .map_err(|e| erro_cofre(mensagem(&e)))
    }

    pub fn ler() -> Result<Option<String>, ErroIa> {
        match entrada()?.get_password() {
            Ok(texto) => Ok(Some(texto)),
            Err(Error::NoEntry) => Ok(None),
            Err(e) => Err(erro_cofre(mensagem(&e))),
        }
    }

    pub fn gravar(texto: &str) -> Result<(), ErroIa> {
        entrada()?
            .set_password(texto)
            .map_err(|e| erro_cofre(mensagem(&e)))
    }

    pub fn apagar() -> Result<(), ErroIa> {
        match entrada()?.delete_credential() {
            Ok(()) | Err(Error::NoEntry) => Ok(()),
            Err(e) => Err(erro_cofre(mensagem(&e))),
        }
    }
}

#[cfg(not(windows))]
mod cofre {
    use super::{erro_cofre, ErroIa};

    const INDISPONIVEL: &str = "Cofre indisponível neste sistema.";

    pub fn ler() -> Result<Option<String>, ErroIa> {
        Err(erro_cofre(INDISPONIVEL))
    }

    pub fn gravar(_texto: &str) -> Result<(), ErroIa> {
        Err(erro_cofre(INDISPONIVEL))
    }

    pub fn apagar() -> Result<(), ErroIa> {
        Err(erro_cofre(INDISPONIVEL))
    }
}

/// O Credential Manager é chamada bloqueante do Windows: sai do worker async.
async fn no_cofre<T, F>(f: F) -> Result<T, ErroIa>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, ErroIa> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|_| erro_cofre("O acesso ao Cofre do Windows foi interrompido."))?
}

async fn ler_chaves() -> Result<Option<ChavesGuardadas>, ErroIa> {
    let Some(texto) = no_cofre(cofre::ler).await? else {
        return Ok(None);
    };
    let guardadas: ChavesGuardadas = serde_json::from_str(&texto).map_err(|_| {
        erro_cofre(format!(
            "A credencial {ALVO_COFRE} está danificada. Apague as chaves e guarde de novo."
        ))
    })?;
    let mut guardadas = guardadas;
    // Credencial editada à mão fora do app: nunca mais que o teto.
    guardadas.chaves.truncate(CHAVES_MAX);
    if guardadas.chaves.is_empty() {
        return Ok(None);
    }
    Ok(Some(guardadas))
}

async fn gravar_chaves(guardadas: &ChavesGuardadas) -> Result<(), ErroIa> {
    let texto = serde_json::to_string(guardadas)
        .map_err(|_| erro_cofre("Não deu para preparar as chaves para o cofre."))?;
    no_cofre(move || cofre::gravar(&texto)).await
}

/// Quantas chaves cabem no `u8` do IPC: no máximo [`CHAVES_MAX`].
fn contar(chaves: &[String]) -> u8 {
    // A lista nunca passa de CHAVES_MAX (3) depois de `validar_chaves`; o
    // `min` cobre um cofre editado à mão.
    u8::try_from(chaves.len().min(CHAVES_MAX)).unwrap_or(u8::MAX)
}

/// Regras da M4: 1 a 3 chaves; cada uma aparada, 30 a 100 caracteres, só
/// letras ASCII, dígitos, hífen e sublinhado; sem repetidas. As mensagens
/// citam o número da chave, nunca o conteúdo.
fn validar_chaves(brutas: Vec<String>) -> Result<Vec<String>, ErroIa> {
    let invalida = |m: String| ErroIa::novo("chaves_invalidas", m);
    if brutas.is_empty() {
        return Err(invalida("Escreva pelo menos uma chave.".into()));
    }
    if brutas.len() > CHAVES_MAX {
        return Err(invalida(format!("No máximo {CHAVES_MAX} chaves.")));
    }
    let mut chaves: Vec<String> = Vec::with_capacity(brutas.len());
    for (i, bruta) in brutas.into_iter().enumerate() {
        let numero = i + 1;
        let chave = bruta.trim();
        let tamanho = chave.chars().count();
        if !(CHAVE_MIN_CARACTERES..=CHAVE_MAX_CARACTERES).contains(&tamanho) {
            return Err(invalida(format!(
                "A chave {numero} precisa ter de {CHAVE_MIN_CARACTERES} a {CHAVE_MAX_CARACTERES} caracteres."
            )));
        }
        if !chave
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            return Err(invalida(format!(
                "A chave {numero} tem caractere que chave do Google não tem (só letras, números, hífen e sublinhado)."
            )));
        }
        if chaves.iter().any(|c| c == chave) {
            return Err(invalida(format!("A chave {numero} está repetida.")));
        }
        chaves.push(chave.to_owned());
    }
    Ok(chaves)
}

// ---------------------------------------------------------------------------
// Comandos das chaves
// ---------------------------------------------------------------------------

/// Quantas chaves estão guardadas (0 a 3). Nunca devolve a chave.
#[tauri::command]
pub async fn ia_chaves_estado(
    window: WebviewWindow,
    estado: State<'_, IaEstado>,
) -> Result<u8, ErroIa> {
    exigir_main(&window)?;
    let _trava = estado.trava_cofre.lock().await;
    Ok(ler_chaves().await?.map_or(0, |g| contar(&g.chaves)))
}

/// Substitui as chaves guardadas; a primeira vira a ativa. Devolve quantas
/// ficaram.
#[tauri::command]
pub async fn ia_chaves_guardar(
    window: WebviewWindow,
    estado: State<'_, IaEstado>,
    chaves: Vec<String>,
) -> Result<u8, ErroIa> {
    exigir_main(&window)?;
    let chaves = validar_chaves(chaves)?;
    let guardadas = ChavesGuardadas { chaves, ativa: 0 };
    let _trava = estado.trava_cofre.lock().await;
    gravar_chaves(&guardadas).await?;
    Ok(contar(&guardadas.chaves))
}

/// Apaga a credencial do cofre (apagar o que não existe não é erro).
#[tauri::command]
pub async fn ia_chaves_apagar(
    window: WebviewWindow,
    estado: State<'_, IaEstado>,
) -> Result<(), ErroIa> {
    exigir_main(&window)?;
    let _trava = estado.trava_cofre.lock().await;
    no_cofre(cofre::apagar).await
}

// ---------------------------------------------------------------------------
// Pedido à IA
// ---------------------------------------------------------------------------

#[derive(Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Papel {
    User,
    Model,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MensagemIa {
    pub papel: Papel,
    pub texto: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImagemIa {
    /// "image/png", "image/jpeg" ou "image/webp".
    pub mime_type: String,
    /// Base64 puro, sem o prefixo `data:...;base64,`.
    pub base64: String,
}

/// O que a webview manda. O corpo do Google é montado aqui, a partir destes
/// campos fechados; a webview não escolhe URL, cabeçalho nem chave.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PedidoIa {
    pub modelo: String,
    /// Vazio = sem instrução de sistema.
    #[serde(default)]
    pub system_prompt: String,
    /// Conversa anterior, em ordem (só texto).
    #[serde(default)]
    pub historico: Vec<MensagemIa>,
    /// A pergunta nova (vai como mensagem do usuário, depois do histórico).
    pub texto: String,
    /// Até 4 retratos, presos à pergunta nova.
    #[serde(default)]
    pub imagens: Vec<ImagemIa>,
    /// `generationConfig.responseSchema` do Gemini (objeto JSON). Presente =
    /// a resposta vem como texto JSON (Gerar NPC).
    #[serde(default)]
    pub esquema_resposta: Option<Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RespostaIa {
    /// Texto do primeiro candidato (JSON em texto quando houve esquema).
    pub texto: String,
    /// Índice (0-based) da chave que passou a ser a ativa depois de cota
    /// esgotada (429) na anterior; `null` quando não trocou.
    pub trocou_para: Option<u8>,
}

fn validar_imagem(i: usize, imagem: &ImagemIa) -> Result<(), ErroIa> {
    let numero = i + 1;
    if !MIMES_IMAGEM.contains(&imagem.mime_type.as_str()) {
        return Err(erro_corpo(format!(
            "O retrato {numero} não é PNG, JPEG nem WebP."
        )));
    }
    if imagem.base64.is_empty() || imagem.base64.len() > IMAGEM_MAX_BASE64 {
        return Err(erro_corpo(format!(
            "O retrato {numero} está vazio ou grande demais (reduza para 512 px)."
        )));
    }
    base64::engine::general_purpose::STANDARD
        .decode(imagem.base64.as_bytes())
        .map_err(|_| erro_corpo(format!("O retrato {numero} não está em base64 válido.")))?;
    Ok(())
}

fn validar_pedido(pedido: &PedidoIa) -> Result<(), ErroIa> {
    if !MODELOS_GEMINI.contains(&pedido.modelo.as_str()) {
        return Err(ErroIa::novo(
            "modelo_invalido",
            "Esse modelo não está na lista do app. Escolha outro na engrenagem.",
        ));
    }
    if pedido.texto.trim().is_empty() {
        return Err(erro_corpo("Escreva a pergunta antes de enviar."));
    }
    if pedido.historico.len() > HISTORICO_MAX {
        return Err(erro_corpo(format!(
            "A conversa passou de {HISTORICO_MAX} mensagens. Comece uma nova."
        )));
    }
    if pedido.historico.iter().any(|m| m.texto.trim().is_empty()) {
        return Err(erro_corpo("A conversa tem uma mensagem vazia."));
    }
    if pedido.imagens.len() > IMAGENS_MAX {
        return Err(erro_corpo(format!(
            "No máximo {IMAGENS_MAX} retratos por pergunta."
        )));
    }
    for (i, imagem) in pedido.imagens.iter().enumerate() {
        validar_imagem(i, imagem)?;
    }
    if pedido
        .esquema_resposta
        .as_ref()
        .is_some_and(|esquema| !esquema.is_object())
    {
        return Err(erro_corpo(
            "O esquema da resposta precisa ser um objeto JSON.",
        ));
    }
    Ok(())
}

/// Corpo do POST generateContent (mesmo formato do `montarCorpo` do
/// projeto-rpg-v2). Valida antes e mede depois: até 4 MiB.
fn montar_corpo(pedido: &PedidoIa) -> Result<Vec<u8>, ErroIa> {
    validar_pedido(pedido)?;

    let papel = |p: Papel| match p {
        Papel::User => "user",
        Papel::Model => "model",
    };
    let mut contents: Vec<Value> = pedido
        .historico
        .iter()
        .map(|m| json!({ "role": papel(m.papel), "parts": [{ "text": m.texto }] }))
        .collect();
    let mut partes = vec![json!({ "text": pedido.texto })];
    partes.extend(
        pedido.imagens.iter().map(
            |img| json!({ "inline_data": { "mime_type": img.mime_type, "data": img.base64 } }),
        ),
    );
    contents.push(json!({ "role": "user", "parts": partes }));

    let mut geracao = json!({ "temperature": TEMPERATURA, "topP": TOP_P });
    if let (Some(esquema), Some(mapa)) = (&pedido.esquema_resposta, geracao.as_object_mut()) {
        mapa.insert("responseMimeType".into(), json!("application/json"));
        mapa.insert("responseSchema".into(), esquema.clone());
    }

    let mut corpo = json!({ "contents": contents, "generationConfig": geracao });
    if !pedido.system_prompt.trim().is_empty() {
        if let Some(mapa) = corpo.as_object_mut() {
            mapa.insert(
                "system_instruction".into(),
                json!({ "parts": [{ "text": pedido.system_prompt }] }),
            );
        }
    }

    let bytes = serde_json::to_vec(&corpo)
        .map_err(|_| erro_corpo("Não deu para montar o pedido para a IA."))?;
    if bytes.len() > CORPO_MAX_BYTES {
        return Err(erro_corpo(format!(
            "O pedido ficou grande demais ({:.1} MiB; o máximo é 4 MiB). Tire um retrato ou encurte a conversa.",
            // Só para exibir: precisão de f64 sobra para alguns MiB.
            bytes.len() as f64 / MIB as f64
        )));
    }
    Ok(bytes)
}

// ---------------------------------------------------------------------------
// Resposta do Google
// ---------------------------------------------------------------------------

/// Até 300 caracteres do corpo do erro, com toda ocorrência de qualquer chave
/// guardada trocada por "(chave)". Mascara ANTES de cortar: cortar primeiro
/// poderia deixar um pedaço da chave que já não casa com a busca.
fn detalhe_seguro(corpo: &[u8], chaves: &[String]) -> String {
    let mut texto = String::from_utf8_lossy(corpo).into_owned();
    for chave in chaves {
        texto = texto.replace(chave.as_str(), CHAVE_MASCARADA);
    }
    texto.trim().chars().take(DETALHE_MAX_CARACTERES).collect()
}

fn erro_http(status: u16, corpo: &[u8], chaves: &[String], indice: usize) -> ErroIa {
    let detalhe = detalhe_seguro(corpo, chaves);
    let numero = indice + 1;
    let chave_recusada = matches!(status, 401 | 403)
        || (status == 400
            && (detalhe.contains("API_KEY_INVALID") || detalhe.contains("API key not valid")));
    let erro = if chave_recusada {
        ErroIa::novo(
            "chave_recusada",
            format!("O Google recusou a chave {numero}. Confira a chave na engrenagem."),
        )
    } else if status == 404 {
        ErroIa::novo(
            "modelo_indisponivel",
            "Esse modelo não está mais disponível no Google. Escolha outro na engrenagem.",
        )
    } else if status >= 500 {
        ErroIa::novo(
            "servidor",
            format!("O Google está com problema agora ({status}). Tente de novo em instantes."),
        )
    } else {
        ErroIa::novo("http", format!("O Google recusou o pedido ({status})."))
    };
    erro.com_http(status, detalhe)
}

fn erro_rede(erro: &reqwest::Error) -> ErroIa {
    // Sem o texto do erro do reqwest: não é preciso, e assim nada do pedido
    // escapa por ele.
    let mensagem = if erro.is_timeout() {
        "O Google demorou demais para responder. Tente de novo."
    } else if erro.is_connect() {
        "Sem conexão com o Google. Confira a internet."
    } else {
        "A conexão com o Google caiu no meio da resposta. Tente de novo."
    };
    ErroIa::novo("rede", mensagem)
}

fn resposta_invalida(mensagem: impl Into<String>) -> ErroIa {
    ErroIa::novo("resposta_invalida", mensagem)
}

/// Texto do primeiro candidato, sem as partes de "pensamento".
fn extrair_texto(corpo: &[u8]) -> Result<String, ErroIa> {
    let resposta: Value = serde_json::from_slice(corpo)
        .map_err(|_| resposta_invalida("A resposta da IA veio num formato inesperado."))?;
    let candidato = resposta.get("candidates").and_then(|c| c.get(0));
    let texto: String = candidato
        .and_then(|c| c.pointer("/content/parts"))
        .and_then(Value::as_array)
        .map(|partes| {
            partes
                .iter()
                .filter(|p| p.get("thought").and_then(Value::as_bool) != Some(true))
                .filter_map(|p| p.get("text").and_then(Value::as_str))
                .collect()
        })
        .unwrap_or_default();
    if !texto.trim().is_empty() {
        return Ok(texto);
    }
    if let Some(motivo) = resposta
        .pointer("/promptFeedback/blockReason")
        .and_then(Value::as_str)
    {
        return Err(resposta_invalida(format!(
            "O Google bloqueou a pergunta (motivo: {}).",
            motivo.chars().take(40).collect::<String>()
        )));
    }
    match candidato
        .and_then(|c| c.get("finishReason"))
        .and_then(Value::as_str)
    {
        Some("MAX_TOKENS") => Err(resposta_invalida(
            "A resposta passou do tamanho máximo do modelo. Peça algo mais curto.",
        )),
        Some(motivo) if motivo != "STOP" => Err(resposta_invalida(format!(
            "A IA parou sem responder (motivo: {}).",
            motivo.chars().take(40).collect::<String>()
        ))),
        _ => Err(resposta_invalida("A IA respondeu vazio. Tente de novo.")),
    }
}

/// Lê o corpo em pedaços e para no teto, sem confiar no Content-Length.
async fn ler_limitado(resposta: &mut reqwest::Response) -> Result<Vec<u8>, ErroIa> {
    let grande = || resposta_invalida("A resposta da IA veio grande demais (mais de 2 MiB).");
    if resposta
        .content_length()
        .is_some_and(|n| n > u64::try_from(RESPOSTA_MAX_BYTES).unwrap_or(u64::MAX))
    {
        return Err(grande());
    }
    let mut corpo = Vec::new();
    while let Some(pedaco) = resposta.chunk().await.map_err(|e| erro_rede(&e))? {
        if corpo.len() + pedaco.len() > RESPOSTA_MAX_BYTES {
            return Err(grande());
        }
        corpo.extend_from_slice(&pedaco);
    }
    Ok(corpo)
}

/// Um POST com uma chave. Devolve o status e o corpo (já limitado).
async fn chamar_gemini(
    cliente: &reqwest::Client,
    url: &str,
    corpo: &[u8],
    chave: &str,
) -> Result<(u16, Vec<u8>), ErroIa> {
    let mut valor = HeaderValue::from_str(chave).map_err(|_| {
        ErroIa::novo(
            "chave_recusada",
            "Uma chave guardada está danificada. Apague as chaves e guarde de novo.",
        )
    })?;
    // Marca sensível: o `Debug` do reqwest/http não imprime o valor.
    valor.set_sensitive(true);
    let mut resposta = cliente
        .post(url)
        .header(CONTENT_TYPE, "application/json")
        .header(CABECALHO_CHAVE, valor)
        .body(corpo.to_vec())
        .send()
        .await
        .map_err(|e| erro_rede(&e))?;
    let status = resposta.status().as_u16();
    let corpo_resposta = ler_limitado(&mut resposta).await?;
    Ok((status, corpo_resposta))
}

fn cliente_http() -> Result<reqwest::Client, ErroIa> {
    reqwest::Client::builder()
        .timeout(TEMPO_TOTAL)
        .connect_timeout(TEMPO_CONEXAO)
        .https_only(true)
        // A URL é fixa; redirecionamento levaria a chave para outro lugar.
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| ErroIa::novo("rede", "Não deu para preparar a conexão com o Google."))
}

/// Pergunta à IA com a chave do cofre. Começa na ativa; 429 (cota esgotada)
/// passa para a próxima e grava a nova ativa. Devolve só o texto.
#[tauri::command]
pub async fn ia_gerar(
    window: WebviewWindow,
    estado: State<'_, IaEstado>,
    pedido: PedidoIa,
) -> Result<RespostaIa, ErroIa> {
    exigir_main(&window)?;
    let corpo = montar_corpo(&pedido)?;
    // O modelo já passou pela lista fechada em `montar_corpo`: a URL só
    // varia nele, nunca em texto livre da webview.
    let url = format!("{URL_MODELOS}{}{METODO}", pedido.modelo);
    // Libera a memória dos retratos antes da espera longa da rede.
    drop(pedido);

    let guardadas = {
        let _trava = estado.trava_cofre.lock().await;
        ler_chaves().await?
    };
    let Some(guardadas) = guardadas else {
        return Err(ErroIa::novo(
            "sem_chave",
            "Sem chave da IA. Ponha a chave na engrenagem do assistente.",
        ));
    };

    let cliente = cliente_http()?;
    let total = guardadas.chaves.len();
    let inicio = guardadas.inicio();
    for tentativa in 0..total {
        let indice = (inicio + tentativa) % total;
        let Some(chave) = guardadas.chaves.get(indice) else {
            continue;
        };
        let (status, corpo_resposta) = chamar_gemini(&cliente, &url, &corpo, chave).await?;
        if status == 429 {
            continue;
        }
        if !(200..300).contains(&status) {
            return Err(erro_http(
                status,
                &corpo_resposta,
                &guardadas.chaves,
                indice,
            ));
        }
        let texto = extrair_texto(&corpo_resposta)?;
        let trocou_para = if indice == inicio {
            None
        } else {
            gravar_ativa(&estado, &guardadas, indice).await;
            // `indice` < total <= CHAVES_MAX (3): sempre cabe em u8.
            u8::try_from(indice).ok()
        };
        return Ok(RespostaIa { texto, trocou_para });
    }
    Err(ErroIa::novo(
        "cota_esgotada",
        if total == 1 {
            "A cota da chave acabou. Espere a cota voltar ou ponha outra chave na engrenagem."
        } else {
            "A cota acabou em todas as chaves. Espere a cota voltar ou ponha outra chave na engrenagem."
        },
    ))
}

/// Grava a nova ativa só se o cofre ainda guarda as mesmas chaves (o usuário
/// pode ter trocado as chaves durante a pergunta).
async fn gravar_ativa(estado: &IaEstado, usadas: &ChavesGuardadas, indice: usize) {
    let _trava = estado.trava_cofre.lock().await;
    let Ok(Some(atuais)) = ler_chaves().await else {
        return;
    };
    if atuais.chaves != usadas.chaves {
        return;
    }
    let nova = ChavesGuardadas {
        chaves: atuais.chaves,
        ativa: indice,
    };
    // Falhar aqui não estraga a resposta que já chegou: na próxima pergunta
    // a chave antiga dá 429 de novo e a troca se repete. Por isso o erro é
    // descartado de propósito.
    let _ = gravar_chaves(&nova).await;
}
