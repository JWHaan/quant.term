//! NewsTicker — port of `src/features/news/NewsTicker.tsx`.
//! Terminal-style scrolling headlines from the public news wire.

use std::sync::{Arc, Mutex};

use leptos::prelude::*;
use wasm_bindgen_futures::spawn_local;

use crate::services::news::{
    fetch_crypto_news, get_time_ago, start_news_polling, NewsArticle, NewsOptions, NewsPoll,
};

const TICKER_LIMIT: u32 = 15;
const POLL_INTERVAL_MS: f64 = 300_000.0;

#[derive(Clone)]
struct NewsTickerItem {
    id: String,
    headline: String,
    source: String,
    sentiment: &'static str,
    time: String,
    url: String,
}

fn map_article(article: NewsArticle) -> NewsTickerItem {
    NewsTickerItem {
        id: article.id,
        headline: article.headline,
        source: article.source,
        sentiment: article.sentiment.as_str(),
        time: get_time_ago(&article.published),
        url: article.url,
    }
}

fn sentiment_color(sentiment: &str) -> &'static str {
    match sentiment {
        "positive" | "bullish" => "var(--accent-primary)",
        "negative" | "bearish" => "var(--accent-danger)",
        _ => "var(--text-secondary)",
    }
}

fn sentiment_icon(sentiment: &str) -> &'static str {
    match sentiment {
        "positive" | "bullish" => "▲",
        "negative" | "bearish" => "▼",
        _ => "!",
    }
}

fn options() -> NewsOptions {
    NewsOptions {
        filter: Some("trending".to_string()),
        limit: Some(TICKER_LIMIT),
        ..NewsOptions::default()
    }
}

/// Scrolling news-wire ticker; pauses on hover.
#[component]
pub fn NewsTicker() -> impl IntoView {
    let news = RwSignal::new(Vec::<NewsTickerItem>::new());
    let is_paused = RwSignal::new(false);
    let is_loading = RwSignal::new(true);
    let poll_slot = Arc::new(Mutex::new(None::<NewsPoll>));

    Effect::new(move |_| {
        // Initial fetch.
        let news_init = news;
        let is_loading_init = is_loading;
        spawn_local(async move {
            is_loading_init.set(true);
            match fetch_crypto_news(&options()).await {
                Ok(articles) => {
                    if !articles.is_empty() {
                        news_init.set(articles.into_iter().map(map_article).collect());
                    }
                }
                Err(e) => {
                    web_sys::console::warn_1(
                        &format!("[NewsTicker] Public feed unavailable: {}", e.message())
                            .into(),
                    );
                }
            }
            is_loading_init.set(false);
        });

        // Poll for updates every five minutes.
        let news_poll = news;
        *poll_slot.lock().unwrap() = Some(start_news_polling(
            move |fresh| {
                news_poll.set(fresh.into_iter().map(map_article).collect());
            },
            POLL_INTERVAL_MS,
        ));

        let slot_cleanup = crate::SendWrap(Arc::clone(&poll_slot));
        on_cleanup(move || {
            *slot_cleanup.lock().unwrap() = None;
        });
    });

    view! {
        <div
            class="news-ticker"
            on:mouseenter=move |_| is_paused.set(true)
            on:mouseleave=move |_| is_paused.set(false)
        >
            <div class="news-ticker__brand">
                <span class="cursor-blink news-ticker__dot">"●"</span>
                <span class="news-ticker__label">"NEWSWIRE"</span>
                <span class="news-ticker__bracket">">>"</span>
            </div>

            <div class=move || {
                if is_paused.get() {
                    "news-ticker__track is-paused"
                } else {
                    "news-ticker__track"
                }
            }>
                {move || {
                    if is_loading.get() {
                        return view! {
                            <div class="news-ticker__msg">"INITIALIZING NEWS FEED..."</div>
                        }
                        .into_any();
                    }
                    let items = news.get();
                    if items.is_empty() {
                        return view! {
                            <div class="news-ticker__msg">
                                "NEWS WIRE UNAVAILABLE · MARKET DATA REMAINS LIVE"
                            </div>
                        }
                        .into_any();
                    }
                    // Duplicate news for a seamless loop.
                    let doubled: Vec<NewsTickerItem> = items
                        .iter()
                        .cloned()
                        .chain(items.iter().cloned())
                        .collect();
                    doubled
                        .into_iter()
                        .map(|item| {
                            let color = sentiment_color(item.sentiment);
                            let icon = sentiment_icon(item.sentiment);
                            let source = item.source.to_uppercase();
                            let headline = item.headline.to_uppercase();
                            let time = item.time.clone();
                            view! {
                                <a
                                    href=item.url.clone()
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="news-ticker__item"
                                    style=format!("color: {color}")
                                    title="Click to read full article"
                                >
                                    <span class="news-ticker__bracket">"["</span>
                                    {icon}
                                    <span class="news-ticker__bracket">"]"</span>
                                    <span class="news-ticker__src">{source}</span>
                                    <span class="news-ticker__headline">{headline}</span>
                                    <span class="news-ticker__time">{format!(":: {time}")}</span>
                                </a>
                            }
                            .into_any()
                        })
                        .collect_view()
                        .into_any()
                }}
            </div>

            <div class="news-ticker__fade" />
        </div>
    }
}
