//! NewsFeed — port of `src/features/news/NewsFeed.tsx`.

use std::cell::RefCell;
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use leptos::prelude::*;
use wasm_bindgen_futures::spawn_local;

use crate::services::news::{fetch_crypto_news, NewsArticle, NewsOptions, NewsSentiment};
use crate::services::rest::IntervalGuard;

const REFRESH_INTERVAL_MS: f64 = 300_000.0;
const EMPTY_NEWS_MESSAGE: &str =
    "No headlines are currently available from the public feed.";
const UNAVAILABLE_MESSAGE: &str =
    "The CoinDesk / Cointelegraph news wire is temporarily unavailable.";

#[derive(Clone)]
struct NewsItem {
    id: String,
    title: String,
    source: String,
    sentiment: &'static str,
    timestamp: String,
    url: String,
}

fn sentiment_str(s: NewsSentiment) -> &'static str {
    s.as_str()
}

fn sentiment_color(sentiment: &str) -> &'static str {
    match sentiment {
        "bullish" | "positive" => "var(--accent-success)",
        "bearish" | "negative" => "var(--accent-danger)",
        _ => "var(--text-secondary)",
    }
}

fn sentiment_icon(sentiment: &str) -> &'static str {
    match sentiment {
        "bullish" | "positive" => "▲",
        "bearish" | "negative" => "▼",
        _ => "–",
    }
}

fn format_timestamp(timestamp: &str) -> String {
    let then = js_sys::Date::parse(timestamp);
    if !then.is_finite() {
        return "—".to_string();
    }
    let diff_ms = js_sys::Date::now() - then;
    let diff_mins = (diff_ms / 60_000.0).floor();
    if diff_mins < 1.0 {
        "NOW".to_string()
    } else if diff_mins < 60.0 {
        format!("{}m", diff_mins as i64)
    } else if diff_mins < 1_440.0 {
        format!("{}h", (diff_mins / 60.0).floor() as i64)
    } else {
        format!("{}d", (diff_mins / 1_440.0).floor() as i64)
    }
}

fn map_article(article: NewsArticle) -> NewsItem {
    NewsItem {
        id: article.id,
        title: article.headline,
        source: if article.source.is_empty() {
            "News wire".to_string()
        } else {
            article.source
        },
        sentiment: sentiment_str(article.sentiment),
        timestamp: article.published,
        url: article.url,
    }
}

/// One fetch cycle shared by the initial load and the 5-minute interval.
#[allow(clippy::too_many_arguments)]
fn spawn_fetch(
    cancelled: Arc<AtomicBool>,
    options: NewsOptions,
    news: RwSignal<Vec<NewsItem>>,
    loading: RwSignal<bool>,
    error: RwSignal<Option<String>>,
    max_items: usize,
) {
    spawn_local(async move {
        error.set(None);
        match fetch_crypto_news(&options).await {
            Ok(data) => {
                if cancelled.load(Ordering::SeqCst) {
                    return;
                }
                let mapped: Vec<NewsItem> =
                    data.into_iter().take(max_items).map(map_article).collect();
                let is_empty = mapped.is_empty();
                news.set(mapped);
                if is_empty {
                    error.set(Some(EMPTY_NEWS_MESSAGE.to_string()));
                }
                loading.set(false);
            }
            Err(e) => {
                if cancelled.load(Ordering::SeqCst) {
                    return;
                }
                web_sys::console::error_1(
                    &format!("Error fetching news: {}", e.message()).into(),
                );
                error.set(Some(UNAVAILABLE_MESSAGE.to_string()));
                news.set(Vec::new());
                loading.set(false);
            }
        }
    });
}

/// News feed panel — polls the public news wire every 5 minutes.
#[component]
pub fn NewsFeed(
    #[prop(optional)] symbol: Option<impl Fn() -> String + Copy + Send + Sync + 'static>,
    #[prop(optional)] max_items: Option<usize>,
) -> impl IntoView {
    let news = RwSignal::new(Vec::<NewsItem>::new());
    let loading = RwSignal::new(true);
    let error = RwSignal::new(None::<String>);
    let max_items = max_items.unwrap_or(20);
    let symbol_fn = move || {
        symbol
            .as_ref()
            .map(|f| f())
            .unwrap_or_default()
    };
    let guard_slot = Rc::new(RefCell::new(None::<IntervalGuard>));

    Effect::new(move |_| {
        let sym = symbol_fn();
        // Extract currency from symbol (e.g., BTCUSDT -> BTC).
        let currency = if sym.is_empty() {
            None
        } else {
            let stripped = sym.replace("USDT", "").replace("USD", "");
            (!stripped.is_empty()).then_some(stripped)
        };
        let options = NewsOptions {
            currencies: currency,
            filter: Some("rising".to_string()),
            ..NewsOptions::default()
        };
        let cancelled = Arc::new(AtomicBool::new(false));

        spawn_fetch(
            Arc::clone(&cancelled),
            options.clone(),
            news,
            loading,
            error,
            max_items,
        );

        let do_fetch = {
            let cancelled = Arc::clone(&cancelled);
            let options = options.clone();
            move || {
                spawn_fetch(
                    Arc::clone(&cancelled),
                    options.clone(),
                    news,
                    loading,
                    error,
                    max_items,
                );
            }
        };
        *guard_slot.borrow_mut() = Some(IntervalGuard::start(
            REFRESH_INTERVAL_MS,
            move |_: web_sys::Event| do_fetch(),
        ));

        let cancelled_cleanup = Arc::clone(&cancelled);
        on_cleanup(move || {
            cancelled_cleanup.store(true, Ordering::SeqCst);
        });
    });

    view! {
        {move || {
            if loading.get() {
                return view! {
                    <div class="feed-init">"[FETCHING_NEWS_FEED]..."</div>
                }
                .into_any();
            }
            view! {
                <div class="news-feed">
                    {move || {
                        error.get().map(|e| {
                            view! {
                                <div class="news-feed__error">
                                    <span>"≡ "</span>
                                    "[ERROR] " {e}
                                </div>
                            }
                        })
                    }}
                    <For
                        each=move || news.get()
                        key=|item| item.id.clone()
                        children=move |item| {
                            let sentiment = item.sentiment;
                            let color = sentiment_color(sentiment);
                            let icon = sentiment_icon(sentiment);
                            let stamp = format_timestamp(&item.timestamp);
                            let title = item.title.to_uppercase();
                            let source = item.source.clone();
                            let sentiment_label = sentiment.to_uppercase();
                            view! {
                                <a
                                    href=item.url.clone()
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="news-item-card"
                                >
                                    <div class="news-item-card__meta">
                                        <span class="news-item-card__src">
                                            {format!("[{source}]")}
                                        </span>
                                        <div class="news-item-card__flags">
                                            <span
                                                class="news-item-card__sentiment"
                                                style=format!("color: {color}")
                                            >
                                                {icon} " " {sentiment_label}
                                            </span>
                                            <span class="news-item-card__stamp tnum">
                                                {stamp}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="news-item-card__title">
                                        {title}
                                    </div>
                                </a>
                            }
                        }
                    />
                    {move || {
                        (news.get().is_empty() && !loading.get()).then(|| {
                            let sym = symbol_fn();
                            let hint = if sym.is_empty() {
                                "SELECT_SYMBOL".to_string()
                            } else {
                                format!("NO_NEWS_FOR_{}", sym.replace("USDT", ""))
                            };
                            view! {
                                <div class="news-feed__empty">
                                    <span style="display:block;margin:0 auto 12px;opacity:0.3;font-size:32px">"▤"</span>
                                    <p>"NO_DATA_AVAILABLE"</p>
                                    <p style="font-size:12px;margin-top:8px">{hint}</p>
                                </div>
                            }
                        })
                    }}
                </div>
            }
            .into_any()
        }}
    }
}
