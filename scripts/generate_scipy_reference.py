"""Generates SciPy/NumPy reference values for the TypeScript statistics engine.

Usage: python3 scripts/generate_scipy_reference.py > tests/fixtures/scipy-reference.json
Requires numpy and scipy. Output is consumed by tests/mathStats.test.ts.
"""
import hashlib
import json

import numpy as np
from scipy import special, stats

rng = np.random.default_rng(20261026)


def r(n, loc=20.0, scale=1.0):
    return [round(float(v), 4) for v in rng.normal(loc, scale, n)]


ref = {"distributions": {}, "tests": {}, "fdr": {}, "pca": {}, "sha256": []}

d = ref["distributions"]
d["tTwoSided"] = [
    {"t": t, "df": df, "p": float(2 * stats.t.sf(abs(t), df))}
    for t, df in [(0.0, 5), (1.0, 3), (2.0, 6), (2.0, 6.7), (5.0, 6), (-3.3, 12.4), (10.0, 4), (25.0, 30), (0.3, 100)]
]
d["fSurvival"] = [
    {"f": f, "df1": a, "df2": b, "p": float(stats.f.sf(f, a, b))}
    for f, a, b in [(0.5, 2, 9), (3.2, 2, 9), (12.0, 3, 20), (40.0, 1, 6), (1.0, 5, 5)]
]
d["normalSurvival"] = [{"z": z, "p": float(stats.norm.sf(z))} for z in [-2.0, 0.0, 0.5, 1.96, 3.0, 6.0, 9.0]]
d["incompleteBeta"] = [
    {"x": x, "a": a, "b": b, "value": float(special.betainc(a, b, x))}
    for x, a, b in [(0.1, 0.5, 0.5), (0.5, 2, 3), (0.9, 10, 1.5), (0.3, 50, 40), (0.999, 3, 0.5)]
]

t = ref["tests"]
a, b = r(4, 21.5, 0.6), r(4, 20.0, 0.4)
a6, b5 = r(6, 18.0, 1.5), r(5, 19.2, 0.5)
t["welch"] = [
    {"a": x, "b": y, **dict(zip(("statistic", "p"), map(float, stats.ttest_ind(x, y, equal_var=False))))}
    for x, y in [(a, b), (a6, b5)]
]
t["student"] = [
    {"a": x, "b": y, **dict(zip(("statistic", "p"), map(float, stats.ttest_ind(x, y, equal_var=True))))}
    for x, y in [(a, b), (a6, b5)]
]
pa, pb = r(6, 20.0, 1.0), None
pb = [round(v - 0.4 + float(e), 4) for v, e in zip(pa, rng.normal(0, 0.3, 6))]
res = stats.ttest_rel(pa, pb)
t["paired"] = [{"a": pa, "b": pb, "statistic": float(res.statistic), "p": float(res.pvalue)}]


def mw(x, y, method):
    res = stats.mannwhitneyu(x, y, alternative="two-sided", method=method)
    return {"a": x, "b": y, "method": method, "statistic": float(res.statistic), "p": float(res.pvalue)}


t["mannWhitney"] = [
    mw(a, b, "exact"),
    mw(a6, b5, "exact"),
    mw([1.0, 2.0, 3.0, 4.0], [5.0, 6.0, 7.0, 8.0], "exact"),
    mw([1.0, 2.0, 2.0, 3.0, 5.0], [2.0, 4.0, 5.0, 6.0, 7.0], "asymptotic"),
    mw(r(10), r(10, 20.8), "asymptotic"),
    mw(r(3), r(30, 20.5), "exact"),
]


def wx(x, y, method):
    res = stats.wilcoxon(x, y, alternative="two-sided", method=method)
    return {"a": x, "b": y, "method": method, "statistic": float(res.statistic), "p": float(res.pvalue)}


t["wilcoxon"] = [
    wx(pa, pb, "exact"),
    wx(r(12), r(12, 20.3), "exact"),
    wx([3.0, 5.0, 6.0, 8.0, 9.0, 4.0, 7.0], [1.0, 3.0, 4.0, 8.0, 6.0, 5.0, 2.0], "asymptotic"),
]
groups = [r(4, 20.0), r(4, 21.0), r(3, 20.4)]
res = stats.f_oneway(*groups)
t["anova"] = [{"groups": groups, "statistic": float(res.statistic), "p": float(res.pvalue)}]

p_values = [float(v) for v in rng.uniform(0, 0.2, 25)] + [1e-6, 0.5, 0.9]
ref["fdr"] = {
    "p": p_values,
    "bh": [float(v) for v in stats.false_discovery_control(p_values, method="bh")],
}

# PCA: samples x proteins, proteins centered, not scaled
x = rng.normal(20, 1, (6, 40))
x[3:, :10] += 2.0
x = x.round(6)
xc = x - x.mean(axis=0)
u, s, vt = np.linalg.svd(xc, full_matrices=False)
scores = u * s
ref["pca"] = {
    "matrix": x.T.tolist(),  # proteins x samples
    "pc1": scores[:, 0].tolist(),
    "pc2": scores[:, 1].tolist(),
    "varExplained": (s**2 / (s**2).sum() * 100).tolist(),
}

ref["sha256"] = [
    {"text": text, "hex": hashlib.sha256(text.encode("utf-8")).hexdigest()}
    for text in ["", "abc", "a" * 1000, "proteomics µ α β → ✓", "x" * 55, "y" * 56, "z" * 64]
]

print(json.dumps(ref, indent=1))
