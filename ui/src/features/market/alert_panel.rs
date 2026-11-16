//! Port of `src/features/market/AlertPanel.tsx`.

use leptos::prelude::*;

use super::{
    format_locale_time, format_price, IconBell, IconBellOff, IconPlus, IconTrash,
};
use crate::stores::{
    use_stores, AlertCondition, AlertType, AlertValue, NewAlert,
};

#[component]
pub fn AlertPanel(symbol: Memo<String>) -> impl IntoView {
    let stores = use_stores();

    // Live price for the selected symbol (marketStore.marketData).
    let price = Memo::new(move |_| {
        let sym = symbol.get();
        stores
            .get_market_data(&sym)
            .map(|d| d.price)
            .filter(|p| p.is_finite() && *p > 0.0)
    });

    // checkAlerts(symbol, price) whenever the price ticks.
    Effect::new(move |_| {
        let sym = symbol.get();
        if let Some(p) = price.get() {
            stores.check_alerts(&sym, p, None);
        }
    });

    let condition = RwSignal::new(AlertCondition::Above);
    let target = RwSignal::new(String::new());
    let notifications = RwSignal::new(false);

    // Initial Notification.permission state.
    #[cfg(target_arch = "wasm32")]
    {
        notifications.set(js_notification_permission() == "granted");
    }

    let enable_notifications = move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            let notifications = notifications;
            leptos::task::spawn_local(async move {
                // Setting the signal after unmount is harmless in Leptos.
                notifications.set(request_notification_permission().await);
            });
        }
    };

    let create_alert = move |_| {
        let sym = symbol.get();
        let target_str = target.get();
        // Number(target || market?.price)
        let parsed = if target_str.is_empty() {
            price.get()
        } else {
            target_str.trim().parse::<f64>().ok()
        };
        let Some(value) = parsed.filter(|v| v.is_finite() && *v > 0.0) else {
            return;
        };
        let cond = condition.get();
        let cond_label = match cond {
            AlertCondition::Above => "above",
            AlertCondition::Below => "below",
            AlertCondition::Equals => "equals",
        };
        stores.add_alert(NewAlert {
            symbol: sym.clone(),
            alert_type: AlertType::Price,
            condition: cond,
            value: AlertValue::Num(value),
            message: format!("{sym} moved {cond_label} {}", format_price(value)),
            enabled: true,
            sound_enabled: true,
            notification_enabled: notifications.get(),
            indicator: None,
        });
    };

    let symbol_alerts = Memo::new(move |_| {
        let sym = symbol.get();
        stores.get_alerts_by_symbol(&sym)
    });

    let alert_ids = move || {
        symbol_alerts
            .get()
            .into_iter()
            .map(|a| a.id)
            .collect::<Vec<String>>()
    };

    view! {
        <section class="terminal-stack" aria-label=move || format!("{} price alerts", symbol.get())>
            <div class="source-line">
                "LOCAL PRICE ALERTS"
                <button class="text-action" on:click=enable_notifications>
                    {move || if notifications.get() { view! { <IconBell/> }.into_any() } else { view! { <IconBellOff/> }.into_any() }}
                    {move || if notifications.get() { "Browser alerts on" } else { "Enable browser alerts" }}
                </button>
            </div>
            <div class="alert-ticket">
                <select
                    prop:value=move || match condition.get() {
                        AlertCondition::Above => "above",
                        AlertCondition::Below => "below",
                        AlertCondition::Equals => "equals",
                    }
                    on:change=move |ev| {
                        condition.set(match event_target_value(&ev).as_str() {
                            "below" => AlertCondition::Below,
                            "equals" => AlertCondition::Equals,
                            _ => AlertCondition::Above,
                        });
                    }
                    aria-label="Alert condition"
                >
                    <option value="above">"Price above"</option>
                    <option value="below">"Price below"</option>
                </select>
                <input
                    type="text"
                    {::leptos::attr::custom::custom_attribute("inputmode", "decimal")}
                    prop:value=move || target.get()
                    on:input=move |ev| target.set(event_target_value(&ev))
                    placeholder=move || price.get().map(|p| p.to_string()).unwrap_or_else(|| "Target price".into())
                    aria-label="Alert target price"
                />
                <button class="primary-action" on:click=create_alert>
                    <IconPlus/> " Add"
                </button>
            </div>
            <div class="alert-list">
                <For
                    each=alert_ids
                    key=|id| id.clone()
                    children=move |alert_id| {
                        // Read the live alert so enable/trigger updates propagate.
                        let live = Memo::new(move |_| {
                            stores.alerts.with(|list| {
                                list.iter().find(|a| a.id == alert_id).cloned()
                            })
                        });
                        view! {
                            {move || live.get().map(|alert| {
                                let enabled = alert.enabled;
                                let triggered = alert.triggered;
                                let created = alert.created_at;
                                let id = alert.id.clone();
                                let value_label = match &alert.value {
                                    AlertValue::Num(v) => format_price(*v),
                                    AlertValue::Str(s) => s.clone(),
                                };
                                let cond_label = match alert.condition {
                                    AlertCondition::Above => "ABOVE",
                                    AlertCondition::Below => "BELOW",
                                    AlertCondition::Equals => "EQUALS",
                                };
                                let toggle_label = if enabled { "Disable alert" } else { "Enable alert" };
                                view! {
                                    <div class=if enabled { "alert-row" } else { "alert-row alert-row--disabled" }>
                                        <button
                                            class="icon-action"
                                            on:click={
                                                let id = id.clone();
                                                move |_| stores.toggle_alert(&id)
                                            }
                                            aria-label=toggle_label
                                        >
                                            {if enabled { view! { <IconBell size=12/> }.into_any() } else { view! { <IconBellOff size=12/> }.into_any() }}
                                        </button>
                                        <div>
                                            <strong>{cond_label} " " {value_label}</strong>
                                            <small>{if triggered { "Triggered" } else { "Armed" }} " · Created " {format_locale_time(created)}</small>
                                        </div>
                                        <button
                                            class="icon-action"
                                            on:click={
                                                let id = id.clone();
                                                move |_| stores.remove_alert(&id)
                                            }
                                            aria-label="Delete alert"
                                        >
                                            <IconTrash/>
                                        </button>
                                    </div>
                                }
                            })}
                        }
                    }
                />
                {move || {
                    if symbol_alerts.with(|a| a.is_empty()) {
                        view! {
                            <div class="panel-state">
                                <IconBell size=15/> " No alerts armed for " {symbol.get()}
                            </div>
                        }.into_any()
                    } else {
                        ().into_any()
                    }
                }}
            </div>
            <div class="freshness-line">"Alerts run in this browser while the terminal is open."</div>
        </section>
    }
}

// ─── Browser Notification permission (web_sys has no typed promise API here) ──

#[cfg(target_arch = "wasm32")]
fn js_notification_permission() -> String {
    use wasm_bindgen::JsValue;
    let global = js_sys::global();
    // `Notification.permission` is a static readonly attribute.
    let Ok(notification) = js_sys::Reflect::get(&global, &JsValue::from_str("Notification")) else {
        return String::new();
    };
    js_sys::Reflect::get(&notification, &JsValue::from_str("permission"))
        .ok()
        .and_then(|v| v.as_string())
        .unwrap_or_default()
}

#[cfg(target_arch = "wasm32")]
async fn request_notification_permission() -> bool {
    use wasm_bindgen::{JsCast, JsValue};
    use wasm_bindgen_futures::JsFuture;
    let result = (|| -> Result<js_sys::Promise, JsValue> {
        let global = js_sys::global();
        let notification = js_sys::Reflect::get(&global, &JsValue::from_str("Notification"))?;
        let f = js_sys::Reflect::get(&notification, &JsValue::from_str("requestPermission"))?;
        let f: js_sys::Function = f.dyn_into()?;
        let v = f.call0(&notification)?;
        v.dyn_into::<js_sys::Promise>()
    })();
    let Ok(promise) = result else {
        return false;
    };
    let Ok(value) = JsFuture::from(promise).await else {
        return false;
    };
    value.as_string().as_deref() == Some("granted")
}

#[cfg(not(target_arch = "wasm32"))]
fn js_notification_permission() -> String {
    String::new()
}

#[cfg(not(target_arch = "wasm32"))]
async fn request_notification_permission() -> bool {
    false
}
