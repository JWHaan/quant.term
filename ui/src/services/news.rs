//! Public crypto-news client — port of `src/integrations/news/client.ts`.
//! Headlines are normalized by the same-origin `/api/news` worker endpoint;
//! the browser shares a short in-memory cache and never ships provider
//! credentials. Malformed articles are dropped, never fatal.

use std::cell::{Cell, RefCell};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use wasm_bindgen_futures::{spawn_local, JsFuture};

use crate::services::rest::{fetch_response, js_to_json, sleep_ms, RestError};
use crate::stores::now_ms;

const NEWS_ENDPOINT: &str = "/api/news";
const CACHE_TTL_MS: f64 = 90_000.0;
const NEWS_TIMEOUT_MS: f64 = 8_000.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NewsSentiment {
    Positive,
    Negative,
    Neutral,
}

impl NewsSentiment {
    pub fn as_str(&self) -> &'static str {
        match self {
            NewsSentiment::Positive => "positive",
            NewsSentiment::Negative => "negative",
            NewsSentiment::Neutral => "neutral",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct NewsVotes {
    pub positive: f64,
    pub negative: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsMetadata {
    pub domain: String,
    pub votes: NewsVotes,
}

/// Normalized article — mirrors the TS `NewsArticle` interface.
#[derive(Clone, Debug, PartialEq)]
pub struct NewsArticle {
    /// `String(article.id)` — ids may be numeric or string upstream.
    pub id: String,
    pub headline: String,
    pub url: String,
    pub source: String,
    /// ISO-8601 timestamp (the wire value normalized via `Date#toISOString`).
    pub published: String,
    pub sentiment: NewsSentiment,
    pub currencies: Vec<String>,
    pub metadata: NewsMetadata,
}

/// Options accepted by `fetchCryptoNews`. `kind`, `filter` and `regions`
/// are kept for API parity — the worker endpoint ignores them today, just
/// like the TS client.
#[derive(Clone, Debug, Default)]
pub struct NewsOptions {
    pub currencies: Option<String>,
    pub kind: Option<String>,
    pub filter: Option<String>,
    pub regions: Option<String>,
    pub limit: Option<u32>,
}

// ─── wire payload ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct WireArticle {
    id: Option<serde_json::Value>,
    headline: Option<String>,
    url: Option<String>,
    source: Option<String>,
    published: Option<String>,
    currencies: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct WireResponse {
    articles: Option<Vec<WireArticle>>,
    error: Option<String>,
}

/// JS truthiness for the `!article.id` guard (0, "", null, false drop out).
fn js_truthy(v: &serde_json::Value) -> bool {
    match v {
        serde_json::Value::Null => false,
        serde_json::Value::Bool(b) => *b,
        serde_json::Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0),
        serde_json::Value::String(s) => !s.is_empty(),
        serde_json::Value::Array(a) => !a.is_empty(),
        serde_json::Value::Object(o) => !o.is_empty(),
    }
}

/// `String(article.id)` for numeric or string ids.
fn js_id_string(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        _ => String::new(),
    }
}

/// `new Date(published).toISOString()` — returns None for invalid dates.
fn js_date_to_iso(date_string: &str) -> Option<String> {
    let parsed = js_sys::Date::parse(date_string);
    if !parsed.is_finite() {
        return None;
    }
    let date = js_sys::Date::new_0();
    date.set_time(parsed);
    Some(date.to_iso_string().as_string().unwrap_or_default())
}

async fn response_json_value(response: &web_sys::Response) -> Result<serde_json::Value, RestError> {
    let promise = response
        .json()
        .map_err(|e| RestError::Parse(crate::services::rest::js_err_string(&e)))?;
    let value = JsFuture::from(promise)
        .await
        .map_err(|e| RestError::Parse(crate::services::rest::js_err_string(&e)))?;
    js_to_json(&value)
}

/// Fetch + normalize the full article list (no client-side filtering).
async fn load_news() -> Result<Vec<NewsArticle>, RestError> {
    let url = format!("{NEWS_ENDPOINT}?limit=50");
    let response = fetch_response(&url, NEWS_TIMEOUT_MS).await?;
    let payload_value = response_json_value(&response).await?;
    let payload: WireResponse = serde_json::from_value(payload_value)
        .map_err(|e| RestError::Parse(e.to_string()))?;
    let articles = payload.articles.ok_or_else(|| {
        RestError::Parse(
            payload
                .error
                .unwrap_or_else(|| "Unexpected news response".to_string()),
        )
    })?;

    let mut out = Vec::new();
    for article in articles {
        let (Some(id), Some(headline), Some(url), Some(source), Some(published)) = (
            article.id.as_ref().filter(|v| js_truthy(v)),
            article.headline,
            article.url,
            article.source,
            article.published,
        ) else {
            continue;
        };
        if headline.is_empty() || url.is_empty() || source.is_empty() || published.is_empty() {
            continue;
        }

        let Ok(parsed_url) = web_sys::Url::new(&url) else {
            continue;
        };
        let protocol = parsed_url.protocol();
        if protocol != "https:" && protocol != "http:" {
            continue;
        }
        let published_iso = match js_date_to_iso(&published) {
            Some(iso) => iso,
            None => continue,
        };

        out.push(NewsArticle {
            id: js_id_string(id),
            headline,
            url,
            source,
            published: published_iso,
            sentiment: NewsSentiment::Neutral,
            currencies: article.currencies.unwrap_or_default(),
            metadata: NewsMetadata {
                domain: parsed_url.hostname(),
                votes: NewsVotes::default(),
            },
        });
    }
    Ok(out)
}

// ─── shared cache (module-level, like the TS `cachedArticles`) ───────────────

#[derive(Default)]
struct NewsCache {
    articles: Vec<NewsArticle>,
    timestamp: f64,
}

thread_local! {
    static NEWS_CACHE: RefCell<NewsCache> = RefCell::new(NewsCache::default());
    static NEWS_IN_FLIGHT: Cell<bool> = const { Cell::new(false) };
}

fn cache_is_fresh() -> bool {
    NEWS_CACHE.with(|c| {
        let c = c.borrow();
        c.timestamp > 0.0 && now_ms() - c.timestamp < CACHE_TTL_MS
    })
}

fn cached_articles() -> Vec<NewsArticle> {
    NEWS_CACHE.with(|c| c.borrow().articles.clone())
}

fn store_cache(articles: Vec<NewsArticle>) {
    NEWS_CACHE.with(|c| {
        let mut c = c.borrow_mut();
        c.articles = articles;
        c.timestamp = now_ms();
    });
}

fn in_flight() -> bool {
    NEWS_IN_FLIGHT.with(|c| c.get())
}

fn set_in_flight(value: bool) {
    NEWS_IN_FLIGHT.with(|c| c.set(value));
}

/// Filter cached articles by comma-separated currencies (case-insensitive),
/// falling back to the full tape when a symbol-specific feed is sparse —
/// identical to the TS `fetchCryptoNews`.
pub async fn fetch_crypto_news(
    options: &NewsOptions,
) -> Result<Vec<NewsArticle>, RestError> {
    let limit = options
        .limit
        .unwrap_or(20)
        .clamp(1, 50) as usize;

    if !cache_is_fresh() {
        if in_flight() {
            // Another caller is already loading; wait for it like the TS
            // shared `inFlight` promise (bounded by the 8s fetch timeout).
            for _ in 0..200 {
                if cache_is_fresh() || !in_flight() {
                    break;
                }
                sleep_ms(50.0).await;
            }
        }
        if !cache_is_fresh() {
            set_in_flight(true);
            let result = load_news().await;
            set_in_flight(false);
            store_cache(result?);
        }
    }

    let cached = cached_articles();
    let requested: Vec<String> = options
        .currencies
        .as_deref()
        .unwrap_or("")
        .split(',')
        .map(|c| c.trim().to_uppercase())
        .filter(|c| !c.is_empty())
        .collect();

    let filtered: Vec<NewsArticle> = if requested.is_empty() {
        cached.clone()
    } else {
        cached
            .iter()
            .filter(|article| {
                article
                    .currencies
                    .iter()
                    .any(|c| requested.contains(&c.to_uppercase()))
            })
            .cloned()
            .collect()
    };

    let pool = if filtered.is_empty() {
        cached
    } else {
        filtered
    };
    Ok(pool.into_iter().take(limit).collect())
}

/// `getTimeAgo` from the TS client.
pub fn get_time_ago(date_string: &str) -> String {
    let then = js_sys::Date::parse(date_string);
    let seconds = ((now_ms() - then) / 1_000.0).max(0.0).floor();
    if seconds < 60.0 {
        "just now".to_string()
    } else if seconds < 3_600.0 {
        format!("{}m ago", (seconds / 60.0).floor() as i64)
    } else if seconds < 86_400.0 {
        format!("{}h ago", (seconds / 3_600.0).floor() as i64)
    } else {
        format!("{}d ago", (seconds / 86_400.0).floor() as i64)
    }
}

/// RAII guard for `start_news_polling` — dropping it stops the poll loop.
pub struct NewsPoll {
    active: Arc<AtomicBool>,
    timer: Arc<Mutex<Option<crate::services::rest::TimeoutGuard>>>,
}

impl Drop for NewsPoll {
    fn drop(&mut self) {
        self.active.store(false, Ordering::Relaxed);
        self.timer.lock().unwrap().take();
    }
}

fn poll_cycle(
    active: Arc<AtomicBool>,
    timer: Arc<Mutex<Option<crate::services::rest::TimeoutGuard>>>,
    callback: Arc<dyn Fn(Vec<NewsArticle>) + Send + Sync>,
    interval_ms: f64,
) {
    spawn_local(async move {
        let news = fetch_crypto_news(&NewsOptions {
            filter: Some("latest".to_string()),
            limit: Some(15),
            ..NewsOptions::default()
        })
        .await;
        if !active.load(Ordering::Relaxed) {
            return;
        }
        if let Ok(news) = news {
            callback(news);
        }
        if active.load(Ordering::Relaxed) {
            let active2 = Arc::clone(&active);
            let timer2 = Arc::clone(&timer);
            let callback2 = Arc::clone(&callback);
            *timer.lock().unwrap() = Some(crate::services::rest::TimeoutGuard::start(
                interval_ms,
                move |_: web_sys::Event| {
                    poll_cycle(
                        Arc::clone(&active2),
                        Arc::clone(&timer2),
                        Arc::clone(&callback2),
                        interval_ms,
                    );
                },
            ));
        }
    });
}

/// Port of `startNewsPolling`: fetch immediately, then re-poll `interval_ms`
/// after each fetch settles (recursive setTimeout, like the TS version).
pub fn start_news_polling(
    on_news: impl Fn(Vec<NewsArticle>) + Send + Sync + 'static,
    interval_ms: f64,
) -> NewsPoll {
    let active = Arc::new(AtomicBool::new(true));
    let timer = Arc::new(Mutex::new(None));
    let callback: Arc<dyn Fn(Vec<NewsArticle>) + Send + Sync> = Arc::new(on_news);
    poll_cycle(
        Arc::clone(&active),
        Arc::clone(&timer),
        Arc::clone(&callback),
        interval_ms,
    );
    NewsPoll { active, timer }
}
