"""Reproducible descriptive and chronological evaluation; does not change game data.

Run: python scripts/evaluate-lottery-history.py
Requires numpy and scipy. Results are printed as JSON, not used by the simulator.
"""

import hashlib
import json
import math
from collections import Counter
from itertools import combinations
from pathlib import Path

import numpy as np
from scipy.stats import binomtest, chi2, spearmanr


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/data/history/playnow-winning-numbers.json"
SNAPSHOT = json.loads(SOURCE.read_text(encoding="utf-8-sig"))
GAMES = {"bc-49": 6, "lotto-649": 6, "daily-grand": 5}
TRAIN_END, VALID_END = 260, 390
MODELS = ("uniform", "expanding_hot", "recent52_hot", "recent52_cold",
          "ewma26", "lag1_markov", "weekday")
SEED = 20260928
PERMUTATIONS = 3000
BOOTSTRAPS = 10000


def holm(values):
    values = np.asarray(values, dtype=float)
    order = np.argsort(values)
    adjusted = np.empty(len(values))
    previous = 0.0
    for rank, index in enumerate(order):
        previous = max(previous, min(1.0, (len(values) - rank) * values[index]))
        adjusted[index] = previous
    return adjusted


def acfs(series, lags=10):
    centered = np.asarray(series, dtype=float) - np.mean(series, axis=0)
    denominator = np.sum(centered ** 2, axis=0)
    return np.array([
        np.sum(centered[lag:] * centered[:-lag], axis=0) / denominator
        for lag in range(1, lags + 1)
    ])


def ljung_box(series):
    n = len(series)
    correlations = acfs(series)
    statistic = n * (n + 2) * np.sum(correlations ** 2 / (n - np.arange(1, 11)))
    return {"lag1": float(correlations[0]), "Q10": float(statistic),
            "p": float(chi2.sf(statistic, 10))}


def normalize_probabilities(scores, k):
    scores = np.clip(scores, 1e-9, 1)
    probabilities = scores * k / np.sum(scores)
    assert np.all((probabilities >= 0) & (probabilities <= 1))
    assert abs(np.sum(probabilities) - k) < 1e-8
    return probabilities


def forecast(model, past, weekdays, next_weekday, k):
    p = k / 49
    if model == "uniform":
        return np.full(49, p)
    if model == "expanding_hot":
        return (past.sum(axis=0) + 52 * p) / (len(past) + 52)
    if model in ("recent52_hot", "recent52_cold"):
        recent = (past[-52:].sum(axis=0) + 26 * p) / 78
        return recent if model.endswith("hot") else normalize_probabilities(2 * p - recent, k)
    if model == "ewma26":
        weights = 2.0 ** (-np.arange(len(past) - 1, -1, -1) / 26)
        return (weights @ past + 26 * p) / (weights.sum() + 26)
    if model == "lag1_markov":
        masks = past[:-1] == past[-1]
        conditional = (np.sum(masks * past[1:], axis=0) + 52 * p) / (masks.sum(axis=0) + 52)
        return normalize_probabilities(conditional, k)
    if model == "weekday":
        matching = past[weekdays == next_weekday]
        return (matching.sum(axis=0) + 52 * p) / (len(matching) + 52)
    raise ValueError(model)


def block_bootstrap_mean_interval(values, rng, block_length=8):
    values = np.asarray(values)
    starts = rng.integers(0, len(values), (BOOTSTRAPS, math.ceil(len(values) / block_length)))
    indexes = (starts[:, :, None] + np.arange(block_length)) % len(values)
    samples = values[indexes.reshape(BOOTSTRAPS, -1)[:, :len(values)]].mean(axis=1)
    return np.quantile(samples, [0.025, 0.975]).tolist()


def evaluate_game(game, k, seed):
    rng = np.random.default_rng(seed)
    rows = sorted((d for d in SNAPSHOT["draws"] if d["gameId"] == game), key=lambda d: d["drawDate"])
    n = len(rows)
    assert n > VALID_END
    assert len({d["drawDate"] for d in rows}) == n
    assert len({d["drawNumber"] for d in rows}) == n
    for draw in rows:
        assert len(draw["mainNumbers"]) == len(set(draw["mainNumbers"])) == k
        assert all(1 <= x <= 49 for x in draw["mainNumbers"])
    picks = np.array([d["mainNumbers"] for d in rows])
    y = np.zeros((n, 49))
    y[np.arange(n)[:, None], picks - 1] = 1
    weekdays = np.array([__import__("datetime").date.fromisoformat(d["drawDate"]).weekday() for d in rows])
    counts = y.sum(axis=0).astype(int)
    p = k / 49
    high_numbers = {}
    for threshold in (29, 30, 39, 40):
        present = (picks > threshold).any(axis=1)
        theoretical = 1 - math.comb(threshold, k) / math.comb(49, k)
        high_numbers[f">{threshold}"] = {
            "draws_with": int(present.sum()), "draws_without": int(n - present.sum()),
            "percent": float(present.mean() * 100), "theoretical_percent": theoretical * 100,
            "p": binomtest(int(present.sum()), n, theoretical).pvalue,
            "counterexample": next(d for d, included in zip(reversed(rows), reversed(present)) if not included),
        }

    pearson = np.sum((counts - n * p) ** 2 / (n * p))
    corrected = pearson * 48 / (49 - k)
    frequency_p = [binomtest(int(c), n, p).pvalue for c in counts]
    pair_counts = Counter(pair for d in rows for pair in combinations(sorted(d["mainNumbers"]), 2))
    pair_probability = math.comb(k, 2) / math.comb(49, 2)
    pair_p = [binomtest(pair_counts[pair], n, pair_probability).pvalue
              for pair in combinations(range(1, 50), 2)]

    indicator_correlations = acfs(y)
    observed_max = np.max(np.abs(indicator_correlations))
    lag_index, number_index = np.unravel_index(np.argmax(np.abs(indicator_correlations)), indicator_correlations.shape)
    null_exceedances = 0
    for _ in range(PERMUTATIONS):
        null_exceedances += np.max(np.abs(acfs(y[rng.permutation(n)]))) >= observed_max
    per_number_time = {
        "maximum_abs_acf": float(observed_max), "number": int(number_index + 1),
        "lag": int(lag_index + 1),
        "permutation_max_test_p": (int(null_exceedances) + 1) / (PERMUTATIONS + 1),
    }
    series = {"sum": picks.sum(axis=1), "count_gt30": (picks > 30).sum(axis=1),
              "count_gt40": (picks > 40).sum(axis=1)}
    scalar_time = {name: ljung_box(values) for name, values in series.items()}
    adjacent_overlap = np.sum(y[1:] * y[:-1], axis=1)

    losses, hits = {}, {}
    for model in MODELS:
        per_draw_losses, per_draw_hits = [], []
        for t in range(TRAIN_END, n):
            probabilities = forecast(model, y[:t], weekdays[:t], weekdays[t], k)
            assert np.isclose(np.sum(probabilities), k)
            per_draw_losses.append(np.mean((probabilities - y[t]) ** 2))
            selected = np.argsort(-probabilities, kind="stable")[:k]
            per_draw_hits.append(np.sum(y[t, selected]))
        losses[model], hits[model] = np.array(per_draw_losses), np.array(per_draw_hits)
    val_size = VALID_END - TRAIN_END
    baseline_loss = p * (1 - p)
    metrics = {}
    for model in MODELS:
        holdout_loss = losses[model][val_size:]
        difference_ci = block_bootstrap_mean_interval(holdout_loss - baseline_loss, rng)
        metrics[model] = {
            "validation_brier": float(losses[model][:val_size].mean()),
            "holdout_brier": float(holdout_loss.mean()),
            "holdout_brier_skill_percent": 0.0 if model == "uniform" else float((1 - holdout_loss.mean() / baseline_loss) * 100),
            # Uniform probabilities do not specify a particular ticket. Keep the
            # theoretical random-ticket expectation separate from observed hits.
            "holdout_average_matches": None if model == "uniform" else float(hits[model][val_size:].mean()),
            "holdout_brier_difference_vs_uniform_95ci": [0.0, 0.0] if model == "uniform" else difference_ci,
        }
    chosen = min(MODELS, key=lambda m: metrics[m]["validation_brier"])
    best_nonuniform = min(MODELS[1:], key=lambda m: metrics[m]["validation_brier"])
    # An explicitly separate fixed-ticket experiment: select using only first 260,
    # then NEVER update that selection while scoring the last 132.
    fixed_train_hot = np.argsort(-y[:TRAIN_END].sum(axis=0), kind="stable")[:k]
    fixed_matches = y[VALID_END:, fixed_train_hot].sum(axis=1)
    return {
        "draws": n, "from": rows[0]["drawDate"], "to": rows[-1]["drawDate"],
        "splits": {"training_end": rows[TRAIN_END - 1]["drawDate"],
                   "validation_from": rows[TRAIN_END]["drawDate"],
                   "validation_end": rows[VALID_END - 1]["drawDate"],
                   "holdout_from": rows[VALID_END]["drawDate"], "holdout_draws": n - VALID_END},
        "high_numbers": high_numbers,
        "frequency": {"expected_per_number": n * p,
                      "minimum": int(counts.min()), "maximum": int(counts.max()),
                      "corrected_chisq": float(corrected), "uniformity_p": float(chi2.sf(corrected, 48)),
                      "top10": [{"number": int(i + 1), "count": int(counts[i])}
                                for i in np.argsort(-counts, kind="stable")[:10]],
                      "first_second_half_rank_correlation": float(spearmanr(y[:n//2].sum(axis=0), y[n//2:].sum(axis=0)).statistic),
                      "individual_p": frequency_p},
        "pairs": {"top5": [{"numbers": list(pair), "count": count}
                            for pair, count in pair_counts.most_common(5)],
                  "unadjusted_min_p": min(pair_p), "all_pair_p": pair_p},
        "time_series": {"individual_numbers": per_number_time, "aggregates": scalar_time,
                        "average_adjacent_draw_overlap": float(adjacent_overlap.mean()),
                        "expected_adjacent_overlap": k * k / 49},
        "model_evaluation": {"selected_using_validation": chosen,
                             "random_ticket_expected_matches_per_draw": k * k / 49,
                             "best_nonuniform_using_validation": best_nonuniform, "models": metrics},
        "fixed_training_hot_ticket": {"numbers": sorted((fixed_train_hot + 1).tolist()),
                                      "holdout_average_matches": float(fixed_matches.mean()),
                                      "holdout_mean_minus_random_95ci": block_bootstrap_mean_interval(fixed_matches - k*k/49, rng)},
    }


def main():
    # Fixed examples are generated once without consulting any historical scores.
    ticket_rng = np.random.default_rng(SEED)
    example_tickets = {game: sorted(ticket_rng.choice(np.arange(1, 50), size=k, replace=False).tolist())
                       for game, k in GAMES.items()}
    results = {game: evaluate_game(game, k, SEED + index + 1)
               for index, (game, k) in enumerate(GAMES.items())}
    individual_p = [value for result in results.values() for value in result["frequency"].pop("individual_p")]
    pair_p = [value for result in results.values() for value in result["pairs"].pop("all_pair_p")]
    scalar_tests = [test for result in results.values() for test in result["time_series"]["aggregates"].values()]
    for test, adjusted in zip(scalar_tests, holm([test["p"] for test in scalar_tests])):
        test["holm_p_across_nine_tests"] = float(adjusted)
    corrected_uniformity = holm([result["frequency"]["uniformity_p"] for result in results.values()])
    corrected_time = holm([result["time_series"]["individual_numbers"]["permutation_max_test_p"] for result in results.values()])
    for result, frequency_p, time_p in zip(results.values(), corrected_uniformity, corrected_time):
        result["frequency"]["holm_p_across_three_games"] = float(frequency_p)
        result["time_series"]["individual_numbers"]["holm_p_across_three_games"] = float(time_p)
    output = {
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "source_fetched_at": SNAPSHOT["fetchedAt"], "source_range": SNAPSHOT["range"],
        "methods": {"seed": SEED, "permutations": PERMUTATIONS, "bootstraps": BOOTSTRAPS,
                    "block_length": 8, "models_frozen_before_holdout_evaluation": list(MODELS),
                    "numpy_version": np.__version__, "scipy_version": __import__("scipy").__version__},
        "across_games": {"individual_frequency_tests": len(individual_p),
                         "min_holm_frequency_p": float(min(holm(individual_p))),
                         "pair_tests": len(pair_p), "min_holm_pair_p": float(min(holm(pair_p)))},
        "games": results, "fixed_examples_not_optimized": example_tickets,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
