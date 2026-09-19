// Ported from water_filling.py -- proportional allocation by SVF score,
// bounded by a min/max per family, with an emergency reserve deducted from
// the total budget. Defaults are code-level; callers may override per request
// or from MosqueSettings.

export const WF_DEFAULTS = {
  wf_reserve: 0.1, // fraction of the budget kept in reserve (0.1 = 10%)
  wf_min_amt: 1000, // minimum amount per family
  wf_max_amt: 50000, // maximum amount per family
};

function normalizeReserve(r) {
  const v = Number(r);
  if (!isFinite(v) || v < 0) return 0;
  // Accept either a fraction (0.1) or a percentage (10).
  const frac = v > 1 ? v / 100 : v;
  // A 100% reserve would leave nothing to distribute.
  return frac >= 1 ? 0.99 : frac;
}

const round2 = (n) => Math.round(n * 100) / 100;

// families: [{ id, firstName, lastName, svfScore }]
export function calculateWaterFilling(families, totalBudget, opts = {}) {
  const reserve = normalizeReserve(opts.reserve ?? WF_DEFAULTS.wf_reserve);
  let minAmt = Number(opts.minAmt ?? WF_DEFAULTS.wf_min_amt);
  let maxAmt = Number(opts.maxAmt ?? WF_DEFAULTS.wf_max_amt);
  const budget = Number(totalBudget);

  if (!families || families.length === 0)
    return { success: false, message: "No families to distribute to." };
  if (!isFinite(budget) || !(budget > 0))
    return { success: false, message: "Budget must be greater than 0." };
  if (!isFinite(minAmt) || minAmt < 0) minAmt = WF_DEFAULTS.wf_min_amt;
  if (!isFinite(maxAmt) || maxAmt <= 0) maxAmt = WF_DEFAULTS.wf_max_amt;
  if (maxAmt < minAmt)
    return {
      success: false,
      message: `The maximum per family (${maxAmt}) is lower than the minimum (${minAmt}).`,
    };

  const netBudget = budget * (1 - reserve);

  const requiredMinimum = minAmt * families.length;
  if (netBudget < requiredMinimum)
    return {
      success: false,
      message: `Budget too low for the number of families. Minimum required (net): ${requiredMinimum.toLocaleString()}.`,
    };

  const totalSvf = families.reduce((a, f) => a + Number(f.svfScore ?? 0), 0);
  if (!(totalSvf > 0))
    return {
      success: false,
      message:
        "Total SVF score is zero; cannot allocate proportionally. Recalculate the family scores first.",
    };

  // --- Water-filling proper -------------------------------------------------
  // The previous version clamped each share to [minAmt, maxAmt] independently
  // and returned the result as-is. That silently broke the budget guarantee:
  // clamping up to minAmt could push totalAllocated ABOVE netBudget (and above
  // the mosque balance), while clamping down to maxAmt left money unallocated.
  //
  // Real water-filling: repeatedly freeze the families that hit a bound and
  // redistribute the remaining budget over the still-free families, in
  // proportion to their SVF score, until nothing else saturates.
  const state = families.map((f) => ({
    ref: f,
    svf: Math.max(0, Number(f.svfScore ?? 0)),
    amount: 0,
    frozen: false,
  }));

  let remaining = netBudget;
  let freeSvf = state.reduce((a, s) => a + s.svf, 0);

  for (let guard = 0; guard < state.length + 2; guard++) {
    const free = state.filter((s) => !s.frozen);
    if (free.length === 0 || freeSvf <= 0) break;

    let saturated = false;
    for (const s of free) {
      s.amount = remaining * (s.svf / freeSvf);
    }
    // Freeze whichever bound is violated, highest-impact first.
    for (const s of free) {
      if (s.amount > maxAmt) {
        s.amount = maxAmt;
        s.frozen = true;
        saturated = true;
      } else if (s.amount < minAmt) {
        s.amount = minAmt;
        s.frozen = true;
        saturated = true;
      }
    }
    if (!saturated) break;

    remaining =
      netBudget - state.filter((s) => s.frozen).reduce((a, s) => a + s.amount, 0);
    freeSvf = state.filter((s) => !s.frozen).reduce((a, s) => a + s.svf, 0);

    if (remaining < 0) {
      // Every family is pinned at the minimum and that already exceeds the
      // net budget: not solvable within the given bounds.
      return {
        success: false,
        message: `Budget too low: paying ${minAmt} to each of the ${families.length} families requires ${(minAmt * families.length).toLocaleString()} net.`,
      };
    }
  }

  const distributions = state.map((s) => ({
    familyId: s.ref.id,
    headName: `${s.ref.firstName ?? ""} ${s.ref.lastName ?? ""}`.trim(),
    svfScore: Number(s.ref.svfScore ?? 0),
    amount: round2(s.amount),
  }));

  // Rounding can drift by a few centimes; absorb it on the largest allocation
  // so the sum never exceeds the net budget.
  let totalAllocated = round2(distributions.reduce((a, d) => a + d.amount, 0));
  const drift = round2(totalAllocated - netBudget);
  if (drift > 0 && distributions.length) {
    const biggest = distributions.reduce((a, b) => (b.amount > a.amount ? b : a));
    biggest.amount = round2(biggest.amount - drift);
    totalAllocated = round2(distributions.reduce((a, d) => a + d.amount, 0));
  }

  return {
    success: true,
    totalBudget: budget,
    netBudget: round2(netBudget),
    reserve,
    reserveAmount: round2(budget - netBudget),
    minAmt,
    maxAmt,
    totalAllocated,
    // Money that could not be allocated because everyone hit maxAmt.
    unallocated: round2(Math.max(0, netBudget - totalAllocated)),
    distributions,
  };
}
