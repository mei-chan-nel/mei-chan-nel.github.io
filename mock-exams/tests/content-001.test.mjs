// Independent calculations from No.001's statements, not the grading algorithm.
import test from "node:test";
import assert from "node:assert/strict";

test("Q1: decoding, prefix codes, cache timing and suppressed totals", () => {
  const codes = ["0", "10", "110", "111"],
    decoded = [];
  let bits = "0101100111";
  while (bits) {
    const i = codes.findIndex((code) => bits.startsWith(code));
    assert.notEqual(i, -1);
    decoded.push("ABCD"[i]);
    bits = bits.slice(codes[i].length);
  }
  assert.deepEqual(decoded, ["A", "B", "C", "A", "D"]);
  const counts = [8, 4, 2, 2, 16],
    candidates = [
      ["0", "110", "1110", "1111", "10"],
      ["10", "110", "111", "1111", "0"],
      ["10", "110", "1110", "1111", "0"],
      ["110", "10", "1110", "1111", "0"],
    ];
  assert.deepEqual(
    candidates.map((cs) =>
      cs.some((a, i) => cs.some((b, j) => i !== j && b.startsWith(a)))
        ? null
        : cs.reduce((n, c, i) => n + counts[i] * c.length, 0),
    ),
    [68, null, 60, 64],
  );
  const events = [
    [0, "P"],
    [4, "P"],
    [6, "P"],
    [8, "Q"],
    [12, "P"],
    [16, "Q"],
  ];
  function readings(lifetime) {
    const cache = {};
    return events.map(([t, device]) => {
      const version = t >= 10 ? 3 : t >= 5 ? 2 : 1;
      if (!cache[device] || t - cache[device].at >= lifetime)
        cache[device] = { at: t, version };
      return cache[device].version;
    });
  }
  assert.deepEqual(readings(10), [1, 1, 1, 2, 3, 2]);
  assert.deepEqual(readings(4), [1, 1, 1, 2, 3, 3]);
  assert.deepEqual(readings(6), [1, 1, 2, 2, 3, 3]);
  const totals = [];
  for (let northWalk = 0; northWalk <= 7; northWalk++)
    for (let northBike = 0; northBike <= 10; northBike++)
      if (
        northWalk + northBike + 8 === 16 &&
        7 - northWalk + 10 - northBike + 7 === 16
      )
        totals.push(northWalk);
  assert.ok(totals.includes(1) && totals.includes(2));
});

test("Q2B: exhaustively recover one-bit blocks (each bit is independent)", () => {
  const rows = Array.from({ length: 16 }, (_, n) => {
    const [A, B, C, D] = [0, 1, 2, 3].map((i) => (n >> i) & 1);
    return { A, B, C, D, P: A ^ B ^ C, Q: B ^ C ^ D, R: A ^ C };
  });
  function recoverable(known) {
    const groups = Map.groupBy(rows, (r) => known.map((k) => r[k]).join(""));
    return "ABCD"
      .split("")
      .filter((field) =>
        [...groups.values()].every(
          (rs) => new Set(rs.map((r) => r[field])).size === 1,
        ),
      );
  }
  assert.equal(0b1010 ^ 0b1100 ^ 0b0111, 0b0001);
  assert.equal(0b0111 ^ 0b0101 ^ 0b1100, 0b1110);
  const pairs = ["AB", "AC", "AD", "BC", "BD", "CD"];
  assert.deepEqual(
    pairs.filter(
      (lost) =>
        recoverable([..."ABCDPQ"].filter((k) => !lost.includes(k))).length < 4,
    ),
    ["BC"],
  );
  assert.ok(
    pairs.every(
      (lost) =>
        recoverable([..."ABCDPQR"].filter((k) => !lost.includes(k))).length ===
        4,
    ),
  );
  assert.deepEqual(recoverable([..."PQR"]), ["B"]);
  assert.deepEqual(
    ["ABP", "ACQ", "BCP", "CDR"].map(
      (lost) =>
        recoverable([..."ABCDPQR"].filter((k) => !lost.includes(k))).length ===
        4,
    ),
    [true, false, true, true],
  );
});

test("Q3: reservation and cancellation traces", () => {
  const types = [1, 2, 1, 3, 2, 1, 3, 2],
    quantities = [4, 2, 3, 2, 2, 2, 1, 1];
  const stock = [5, 3, 2],
    status = Array(8).fill(0);
  const process = () => {
    let count = 0;
    for (let i = 0; i < 8; i++)
      if (status[i] === 0 && stock[types[i] - 1] >= quantities[i]) {
        stock[types[i] - 1] -= quantities[i];
        status[i] = 1;
        count++;
      }
    return count;
  };
  assert.equal(process(), 4);
  assert.deepEqual(stock, [1, 0, 0]);
  assert.deepEqual(status, [1, 1, 0, 1, 0, 0, 0, 1]);
  const newCounts = [0, 3].map((i) => {
    stock[types[i] - 1] += quantities[i];
    status[i] = 2;
    return process();
  });
  assert.deepEqual(newCounts, [2, 1]);
  assert.deepEqual(stock, [0, 0, 1]);
  assert.deepEqual(status, [2, 1, 1, 2, 0, 1, 1, 1]);
});

test("Q4: table ratios, regression counterexample and comparable periods", () => {
  const D = [2376, 1096, 7403, 7410, 4639],
    M = [3334, 7343.5, 6314, 6314, 7343.5];
  assert.deepEqual(
    D.map((d, i) => Number((d / M[i]).toFixed(3))),
    [0.713, 0.149, 1.172, 1.174, 0.632],
  );
  assert.deepEqual(
    D.map((d, i) => d / M[i] < 0.7),
    [false, true, false, false, true],
  );
  assert.ok(697 > 0.184 * 4840 - 296 && 697 / 4840 < 0.184);
  assert.deepEqual(
    [1637 / 7403, 914 / 7410, 211 / 1096, 835 / 4639, 835 / 3630].map((x) =>
      Number((x * 100).toFixed(1)),
    ),
    [22.1, 12.3, 19.3, 18.0, 23.0],
  );
  assert.equal(2697 + 835 + 98, 3630);
  assert.equal(1009 + 3630, 4639);
});
