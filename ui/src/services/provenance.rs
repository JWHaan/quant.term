//! Market data provenance — port of `src/services/provenanceEngine.ts`.
//! Tracks latency, gaps, sequence numbers and feed health per symbol.

use std::cell::RefCell;
use std::collections::{HashMap, VecDeque};

use crate::stores::now_ms;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FeedStatus {
    Live,
    Stale,
    Replay,
    Disconnected,
    Connecting,
}

impl FeedStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            FeedStatus::Live => "LIVE",
            FeedStatus::Stale => "STALE",
            FeedStatus::Replay => "REPLAY",
            FeedStatus::Disconnected => "DISCONNECTED",
            FeedStatus::Connecting => "CONNECTING",
        }
    }
}

#[derive(Clone, Debug)]
pub struct DataProvenance {
    pub exchange_timestamp: f64,
    pub received_timestamp: f64,
    pub sequence_number: u64,
    pub latency_ms: f64,
    pub is_suspected_gap: bool,
    pub feed_status: FeedStatus,
}

#[derive(Clone, Debug)]
pub struct LatencyDistribution {
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
    pub samples: Vec<f64>,
    pub last_updated: f64,
}

pub struct ProvenanceEngine {
    symbol: String,
    last_sequence_number: u64,
    last_received_timestamp: f64,
    latency_samples: VecDeque<f64>,
    max_samples: usize,
    gap_threshold_ms: f64,
    stale_threshold_ms: f64,
    feed_status: FeedStatus,
}

impl ProvenanceEngine {
    pub fn new(symbol: &str) -> Self {
        Self::with_options(symbol, 1000, 100.0, 5000.0)
    }

    pub fn with_options(
        symbol: &str,
        max_samples: usize,
        gap_threshold_ms: f64,
        stale_threshold_ms: f64,
    ) -> Self {
        Self {
            symbol: symbol.to_string(),
            last_sequence_number: 0,
            last_received_timestamp: 0.0,
            latency_samples: VecDeque::new(),
            max_samples,
            gap_threshold_ms,
            stale_threshold_ms,
            feed_status: FeedStatus::Disconnected,
        }
    }

    /// Augment OHLCV data with provenance metadata. Returns the provenance
    /// record; callers merge it into their payload.
    pub fn augment(&mut self, exchange_timestamp: f64) -> DataProvenance {
        let received_timestamp = now_ms();
        let latency_ms = received_timestamp - exchange_timestamp;

        self.last_sequence_number += 1;

        let time_since_last_tick = received_timestamp - self.last_received_timestamp;
        let is_suspected_gap =
            self.last_received_timestamp > 0.0 && time_since_last_tick > self.gap_threshold_ms;

        let feed_status = self.determine_feed_status(latency_ms, time_since_last_tick);

        self.latency_samples.push_back(latency_ms);
        if self.latency_samples.len() > self.max_samples {
            self.latency_samples.pop_front();
        }

        self.last_received_timestamp = received_timestamp;
        self.feed_status = feed_status;

        DataProvenance {
            exchange_timestamp,
            received_timestamp,
            sequence_number: self.last_sequence_number,
            latency_ms,
            is_suspected_gap,
            feed_status,
        }
    }

    fn determine_feed_status(&self, latency_ms: f64, time_since_last_tick: f64) -> FeedStatus {
        if self.last_received_timestamp > 0.0 && time_since_last_tick > self.stale_threshold_ms {
            return FeedStatus::Stale;
        }
        // TS returns 'LIVE' for both branches — preserved verbatim.
        let _ = latency_ms;
        FeedStatus::Live
    }

    pub fn get_latency_distribution(&self) -> LatencyDistribution {
        if self.latency_samples.is_empty() {
            return LatencyDistribution {
                p50: 0.0,
                p95: 0.0,
                p99: 0.0,
                samples: Vec::new(),
                last_updated: now_ms(),
            };
        }
        let mut sorted: Vec<f64> = self.latency_samples.iter().copied().collect();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        LatencyDistribution {
            p50: percentile(&sorted, 0.50),
            p95: percentile(&sorted, 0.95),
            p99: percentile(&sorted, 0.99),
            samples: sorted,
            last_updated: now_ms(),
        }
    }

    pub fn get_feed_status(&mut self) -> FeedStatus {
        // No tick ever received: the stored Disconnected placeholder is a
        // first-connect/socket-swap — report CONNECTING, not OFFLINE.
        if self.last_received_timestamp == 0.0 && self.feed_status == FeedStatus::Disconnected {
            return FeedStatus::Connecting;
        }
        let now = now_ms();
        let time_since_last_tick = now - self.last_received_timestamp;
        if self.last_received_timestamp > 0.0 && time_since_last_tick > self.stale_threshold_ms {
            self.feed_status = FeedStatus::Stale;
        }
        self.feed_status
    }

    pub fn mark_disconnected(&mut self) {
        self.feed_status = FeedStatus::Disconnected;
    }

    pub fn mark_replay(&mut self) {
        self.feed_status = FeedStatus::Replay;
    }

    pub fn reset(&mut self) {
        self.last_sequence_number = 0;
        self.last_received_timestamp = 0.0;
        self.latency_samples.clear();
        self.feed_status = FeedStatus::Disconnected;
    }

    pub fn detect_sequence_gap(&self, expected_sequence: u64) -> bool {
        self.last_sequence_number != expected_sequence
    }

    pub fn get_average_latency(&self) -> f64 {
        if self.latency_samples.is_empty() {
            return 0.0;
        }
        self.latency_samples.iter().sum::<f64>() / self.latency_samples.len() as f64
    }

    pub fn get_latency_range(&self) -> (f64, f64) {
        if self.latency_samples.is_empty() {
            return (0.0, 0.0);
        }
        let mut min = f64::INFINITY;
        let mut max = f64::NEG_INFINITY;
        for &v in &self.latency_samples {
            min = min.min(v);
            max = max.max(v);
        }
        (min, max)
    }

    pub fn is_healthy(&mut self) -> bool {
        matches!(
            self.get_feed_status(),
            FeedStatus::Live | FeedStatus::Replay
        )
    }

    pub fn get_quality_score(&mut self) -> u8 {
        match self.get_feed_status() {
            FeedStatus::Disconnected | FeedStatus::Connecting => 0,
            FeedStatus::Stale => 25,
            FeedStatus::Replay => 75,
            FeedStatus::Live => {
                let avg = self.get_average_latency();
                if avg < 50.0 {
                    100
                } else if avg < 100.0 {
                    90
                } else if avg < 200.0 {
                    80
                } else if avg < 500.0 {
                    70
                } else if avg < 1000.0 {
                    60
                } else {
                    50
                }
            }
        }
    }

    pub fn symbol(&self) -> &str {
        &self.symbol
    }
}

fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let index = (sorted.len() as f64 * p).ceil() as usize;
    sorted[index.saturating_sub(1).min(sorted.len() - 1)]
}

thread_local! {
    static ENGINES: RefCell<HashMap<String, ProvenanceEngine>> = RefCell::new(HashMap::new());
}

/// Run `f` with mutable access to the engine for `symbol`, creating it if needed.
pub fn with_provenance_engine<R>(symbol: &str, f: impl FnOnce(&mut ProvenanceEngine) -> R) -> R {
    ENGINES.with(|engines| {
        let mut map = engines.borrow_mut();
        let engine = map
            .entry(symbol.to_string())
            .or_insert_with(|| ProvenanceEngine::new(symbol));
        f(engine)
    })
}

pub fn remove_provenance_engine(symbol: &str) {
    ENGINES.with(|engines| {
        engines.borrow_mut().remove(symbol);
    });
}

pub fn reset_all_provenance_engines() {
    ENGINES.with(|engines| {
        for engine in engines.borrow_mut().values_mut() {
            engine.reset();
        }
    });
}

pub fn tracked_provenance_symbols() -> Vec<String> {
    ENGINES.with(|engines| engines.borrow().keys().cloned().collect())
}

/// Run `f` with immutable access to the engine for `symbol`, if it exists.
pub fn with_provenance_engine_ref<R>(
    symbol: &str,
    f: impl FnOnce(&ProvenanceEngine) -> R,
) -> Option<R> {
    ENGINES.with(|engines| engines.borrow().get(symbol).map(f))
}

/// Health summary for all tracked symbols: symbol -> (status, quality).
pub fn provenance_health_summary() -> Vec<(String, FeedStatus, u8)> {
    ENGINES.with(|engines| {
        engines
            .borrow_mut()
            .iter_mut()
            .map(|(sym, e)| (sym.clone(), e.get_feed_status(), e.get_quality_score()))
            .collect()
    })
}
