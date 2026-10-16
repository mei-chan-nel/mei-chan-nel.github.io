// Each example has a specific teaching purpose, rather than using a number
// that happens to convert in a single step.
export const CONVERSION_EXAMPLES = {
  "decimal-binary": {
    source: 10, value: "45.6875", target: 2,
  },
  "decimal-hex": {
    source: 10, value: "427.734375", target: 16,
  },
  position: {
    source: 2, value: "101101.1011", target: 10,
  },
  "hex-decimal": {
    source: 16, value: "1AB.BC", target: 10,
  },
  "binary-hex": {
    source: 2, value: "110101011.101111", target: 16,
  },
  "hex-binary": {
    source: 16, value: "1AB.BC", target: 2,
  },
  cycle: {
    source: 10, value: "0.1", target: 2,
  },
};
