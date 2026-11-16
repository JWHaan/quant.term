//! Live market telemetry — port of `src/services/marketTelemetry.ts`.
//! Aggregates per-source connection status across owners and fans out
//! exchange-derived latency events to subscribers.

use std::cell::RefCell;
use std::collections::{HashMap, HashSet, VecDeque};

use crate::stores::{now_ms, AppStores, ConnectionStatus};

#[derive(Clone, Debug)]
pub struct LiveMarketEvent {
    pub source: String,
    pub received_at: f64,
    pub latency_ms: Option<f64>,
    pub symbol: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum StatusRank {
    Disconnected = 0,
    Error = 1,
    Connecting = 2,
    Reconnecting = 3,
    Connected = 4,
}

fn rank(status: ConnectionStatus) -> StatusRank {
    match status {
        ConnectionStatus::Disconnected => StatusRank::Disconnected,
        ConnectionStatus::Error => StatusRank::Error,
        ConnectionStatus::Connecting => StatusRank::Connecting,
        ConnectionStatus::Reconnecting => StatusRank::Reconnecting,
        ConnectionStatus::Connected => StatusRank::Connected,
    }
}

thread_local! {
    /// source -> owner_id -> status
    static OWNERS: RefCell<HashMap<String, HashMap<usize, ConnectionStatus>>> =
        RefCell::new(HashMap::new());
    static LAST_PUBLISHED: RefCell<HashMap<String, ConnectionStatus>> =
        RefCell::new(HashMap::new());
    /// Bounded ring of recent live market events.
    static EVENTS: RefCell<VecDeque<LiveMarketEvent>> = RefCell::new(VecDeque::new());
    static EVENT_VERSION: std::cell::Cell<u64> = const { std::cell::Cell::new(0) };
    static NEXT_OWNER: std::cell::Cell<usize> = const { std::cell::Cell::new(1) };
}

const MAX_EVENTS: usize = 500;

/// Allocate a unique owner id for a feed instance.
pub fn next_owner_id() -> usize {
    NEXT_OWNER.with(|c| {
        let id = c.get();
        c.set(id.wrapping_add(1));
        id
    })
}

fn aggregate_status(statuses: impl Iterator<Item = ConnectionStatus>) -> ConnectionStatus {
    let mut best = ConnectionStatus::Disconnected;
    for status in statuses {
        if rank(status) > rank(best) {
            best = status;
        }
    }
    best
}

fn publish_if_changed(stores: &AppStores, source: &str, status: ConnectionStatus) {
    LAST_PUBLISHED.with(|last| {
        let mut last = last.borrow_mut();
        if last.get(source) == Some(&status) {
            return;
        }
        last.insert(source.to_string(), status);
        stores.set_connection_status(source, status);
    });
}

/// Report (or clear) a connection status owned by `owner_id` on `source`.
/// Pass `None` to release ownership.
pub fn report_live_connection(
    stores: &AppStores,
    source: &str,
    owner_id: usize,
    status: Option<ConnectionStatus>,
) {
    OWNERS.with(|owners| {
        let mut owners = owners.borrow_mut();
        let entry = owners.entry(source.to_string()).or_default();
        match status {
            Some(status) => {
                entry.insert(owner_id, status);
            }
            None => {
                entry.remove(&owner_id);
                if entry.is_empty() {
                    owners.remove(source);
                }
            }
        }

        let statuses: Vec<ConnectionStatus> = owners
            .get(source)
            .map(|m| m.values().copied().collect())
            .unwrap_or_default();
        let aggregate = if statuses.is_empty() {
            ConnectionStatus::Disconnected
        } else {
            aggregate_status(statuses.into_iter())
        };
        publish_if_changed(stores, source, aggregate);
    });
}

/// Record a live market event derived from an exchange timestamp.
pub fn record_live_market_event(source: &str, exchange_timestamp_ms: Option<f64>, symbol: &str) {
    let received_at = now_ms();
    let latency_ms = exchange_timestamp_ms.and_then(|ts| {
        if ts.is_finite() && ts > 1_000_000_000_000.0 {
            Some((received_at - ts).max(0.0))
        } else {
            None
        }
    });
    let event = LiveMarketEvent {
        source: source.to_string(),
        received_at,
        latency_ms,
        symbol: symbol.to_uppercase(),
    };
    EVENTS.with(|events| {
        let mut events = events.borrow_mut();
        events.push_back(event);
        while events.len() > MAX_EVENTS {
            events.pop_front();
        }
        EVENT_VERSION.with(|v| v.set(v.get().wrapping_add(1)));
    });
}

/// Release all ownerships held by `owner_id` across every source.
pub fn release_live_connection(stores: &AppStores, owner_id: usize) {
    let sources: Vec<String> = OWNERS.with(|owners| {
        owners
            .borrow()
            .iter()
            .filter(|(_, m)| m.contains_key(&owner_id))
            .map(|(s, _)| s.clone())
            .collect()
    });
    for source in sources {
        report_live_connection(stores, &source, owner_id, None);
    }
}

/// Snapshot of recent live market events (newest last).
pub fn live_market_events() -> Vec<LiveMarketEvent> {
    EVENTS.with(|events| events.borrow().iter().cloned().collect())
}

/// Monotonic counter bumped on each recorded event — usable as a signal dep.
pub fn live_event_version() -> u64 {
    EVENT_VERSION.with(|v| v.get())
}

/// Sources currently tracked, for diagnostics.
pub fn tracked_sources() -> HashSet<String> {
    OWNERS.with(|owners| owners.borrow().keys().cloned().collect())
}
