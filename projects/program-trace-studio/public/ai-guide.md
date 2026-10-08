# Program Trace Studio: instructions for AI file authors (version 1)

This specification is machine-discoverable from the Studio HTML head. It is not an editor legend. Generate an importable program for the user's requested task; do not generate JavaScript, HTML, or an editor implementation.

## Deliverable

Return a UTF-8 `.studio.json` file whose entire contents are one JSON object conforming to `ai-guide.json`. Do not put Markdown fences or explanatory text inside the file. Use exactly this envelope:

```json
{
  "format": "mei-program-studio",
  "version": 1,
  "title": "2つの値の合計",
  "source": "x = 3\ny = 4\ngoukei = x + y\n表示する(\"合計は\", goukei, \"です。\")",
  "settings": { "indexBase": 0, "inputs": {} }
}
```

`title` must be at most 120 characters. `source` is a JSON string, so encode actual program line breaks as `\n` and escape its quotes/backslashes. The app imports source into structured rows, placing each custom function in a separate block below main. Put both main statements and all function definitions in the same source string; the version 1 envelope and settings are unchanged. Older version 1 files remain readable. Files and shared URLs preserve definitions, parameters, returns and settings, but do not include execution state or backward-step history. Do **not** generate `builder`: it is private app metadata for unfinished drafts. Supply a complete program with a nonempty executable body for every conditional branch and loop. Comments alone do not make a body executable.

## Supported statements

Use the Information I pseudocode spellings below. Identifiers start with a Unicode letter or `_`, followed by Unicode letters, numbers or `_`. Use descriptive short ASCII or Japanese variable names, not reserved words or built-in function names. Do not use `__proto__`, `constructor` or `prototype`.

```text
x = 3
x = x + 1, y = x
Data = [3, 5, 9]
Data[0] = 7
Table = [[1, 2], [3, 4]]
Table[0, 1] = 8
age = 【外部からの入力】
表示する("値は", x)
もし age >= 18 ならば：
  表示する("成人です。")
そうでなくもし age >= 13 ならば：
  表示する("13歳以上です。")
そうでなければ：
  表示する("13歳未満です。")
i を 1 から 5 まで 1 ずつ増やしながら繰り返す：
  表示する(i)
i を 5 から 1 まで 1 ずつ減らしながら繰り返す：
  表示する(i)
x < 10 の間繰り返す：
  x = x + 1
# A standalone comment
x = 1 # An inline comment
```

Indent each nested body by two ASCII spaces. Align `そうでなくもし` and `そうでなければ` with their owning `もし`. No `end`, `endif`, `終了`, braces, or block terminator statements exist. Alternatively, use one `｜` or `⎿` per nesting level; `⎿` denotes the last row at that level. Do not mix leading spaces and markers. Optional fullwidth line numbers `（1）` or `（01）` are accepted, but omit them in generated files. Nesting is at most 32 levels. `break` and `continue` are unsupported.

External input is one assignment to a plain variable on its own line. Define its type and bounds under `settings.inputs` using the same variable name. Input opens a dialog during step execution. Never silently hard-code an external input in place of the user's request.

## Custom functions

Define functions at the outermost level, preferably after the main program:

```text
result = double(3)
表示する(result)
定義する double(n)：
  返す n * 2
```

Definitions are available before execution and their bodies run only when called.
Use unique function names distinct from built-ins, with unique parameter names.
Calls can appear in expressions or as standalone statements. `返す value` returns a
value; bare `返す` or falling off the body ends a standalone call, but using that
call in an expression requires a returned value on every executed path. A return
ends the current invocation immediately. For functions used as values, ensure
every branch reaches a value return. Parameters and local variables
are independent for each invocation; arrays are copied, and main variables are
not visible inside functions. Pass all required values as arguments. Nested
function definitions are unsupported. Recursion is supported up to 32 calls.
Every function body must contain executable code. The number and order of call
arguments must match the parameter list; use empty parentheses for zero arguments.
In source, parameter names are comma-separated.

In the editor, each parameter is added and removed in its own field before
pressing 関数を作成. The definition row is read-only after creation.
Value-returning functions appear in expression candidates; procedures without a
value return appear under 関数 → 呼び出す. Inside a function, 関数 → 値を返す
configures either a value return or 値を返さずに終了する. The upper-right × deletes
an unreferenced function block; undo restores it.

Functions and returns persist in files and shared URLs. Files keep the version 1
document envelope, and generated shared URLs keep the existing v2 URL format.

### Recursive Fibonacci example

Use a base case that returns without another recursive call, and move each
recursive argument toward that base case. This version prints F(0) through F(9):
0, 1, 1, 2, 3, 5, 8, 13, 21, 34. The 32-call depth limit and 10,000-step limit
both apply; use small values for an algorithm that branches recursively.
[Download the importable Fibonacci file](./examples/fibonacci.studio.json).

```json
{
  "format": "mei-program-studio",
  "version": 1,
  "title": "フィボナッチ数列（再帰）",
  "source": "項数 = 10\ni を 0 から 項数 - 1 まで 1 ずつ増やしながら繰り返す：\n  値 = フィボナッチ(i)\n  表示する(\"F(\", i, \") = \", 値)\n定義する フィボナッチ(n)：\n  もし n <= 1 ならば：\n    返す n\n  返す フィボナッチ(n - 1) + フィボナッチ(n - 2)",
  "settings": {
    "indexBase": 0,
    "inputs": {}
  }
}
```

### Procedure without a return value

Call this function as its own statement. Bare 返す ends the invocation without a
value; it cannot supply a right-hand-side value. Reaching the end also finishes
a standalone call.

```json
{
  "format": "mei-program-studio",
  "version": 1,
  "title": "戻り値なしの関数",
  "source": "通知(\"処理を始めます。\")\n定義する 通知(内容)：\n  表示する(内容)\n  返す",
  "settings": {
    "indexBase": 0,
    "inputs": {}
  }
}
```

## Values and expressions

- Values: finite numbers, quoted strings, `真` / `偽` (also `true` / `false`), one-dimensional arrays and rectangular two-dimensional arrays. No null, objects, or three-dimensional arrays.
- Arithmetic: `+ - * / ÷ % **`. `/` is real division; `÷` truncates the quotient toward zero (`-7 ÷ 2` is `-3`); `%` has the dividend's sign. `**` is right-associative. Use parentheses whenever precedence might be unclear.
- Comparison: `== != < <= > >=`. Logical operators: `and or not`, with short-circuit evaluation. Prefer explicitly boolean comparisons as conditions.
- Strings: single or double quotes with supported JSON-style escapes. A `#` inside quotes is text, not a comment. String + string concatenates. Prefer `表示する("値は", x)` over adding a string and a number.
- Multiple assignments on one line execute sequentially from left to right, not simultaneously. Use a temporary variable for a swap.
- All variables must be assigned before they are read. Initialize arrays before assigning their elements. Arrays do not grow through an out-of-bounds assignment. An array assigned to another variable is copied.
- `settings.indexBase` is `0` or `1` and applies to all array indices. Match every index and loop bound to this setting. `Table[i, j]` and `Table[i][j]` are equivalent; prefer comma notation. `Table[i]` returns one row. Rows must have equal widths. A one-dimensional empty array `[]` is allowed; a matrix must have at least one row and one column.
- Range loops include the end value; start, end and step must be safe integers, step >= 1. Bounds are evaluated once on entering a loop. Nested loops are supported. The counter ends one step beyond the range after the final header check.
- Numbers use browser floating-point arithmetic; integer results must remain within ±9,007,199,254,740,991. Do not assume arbitrary precision.

## Built-in function registry, version 1

Only these built-ins are currently supported. Additional built-ins may be registered in later versions; never invent one.

| Function | Arguments | Result / effect |
|---|---|---|
| `表示する(...)` | zero or more values | A standalone statement. Concatenates formatted arguments without adding spaces and appends a new output record. Cannot be used inside an expression. |
| `要素数(array)` | exactly one array | Number of elements; for a matrix, number of rows. `要素数(Table[0])` counts columns for indexBase 0. |
| `乱数()` | none | Real number in [0, 1). |
| `乱数(min, max, "整数")` | two integer bounds and the literal string `"整数"` | Inclusive integer range [min, max]; min <= max. |
| `乱数(min, max, "実数")` | two finite numeric bounds and the literal string `"実数"` | Real range [min, max); min < max. |

Resetting an execution replays its random sequence. Preparing a new execution gives a new sequence.

## External input specifications

Each `settings.inputs` entry must include **all** of these properties, even those irrelevant to its selected kind:

```json
{
  "kind": "number",
  "integer": true,
  "min": 0,
  "max": 120,
  "minLength": 1,
  "maxLength": 100,
  "elementKind": "number",
  "rows": 2,
  "columns": 3
}
```

- `kind`: `number`, `text`, `array` (one dimension), or `matrix` (two dimensions).
- `integer`: numeric input / numeric array elements must be integers when true. In this case `min` and `max` must also be integers.
- `min` / `max`: inclusive finite bounds within the safe integer range, min <= max. Choose useful educational bounds, not unnecessarily huge ones. Irrelevant numeric fields can use the defaults -1000000 / 1000000 and integer true.
- `minLength` / `maxLength`: integer one-dimensional array sizes from 1 to 1000, minLength <= maxLength. Default 1 / 100 when irrelevant.
- `elementKind`: `number` or `text`, for both array kinds. Text and text elements are at most 1000 characters; text input has no numeric range. Default `number` when irrelevant.
- `rows` / `columns`: fixed integer matrix dimensions from 1 to 30. Default 2 / 3 when irrelevant.

An input example ready to import:

```json
{
  "format": "mei-program-studio",
  "version": 1,
  "title": "年齢で分岐する",
  "source": "age = 【外部からの入力】\nもし age >= 18 ならば：\n  表示する(\"成人です。\")\nそうでなければ：\n  表示する(\"未成年です。\")",
  "settings": {
    "indexBase": 0,
    "inputs": {
      "age": { "kind": "number", "integer": true, "min": 0, "max": 120, "minLength": 1, "maxLength": 100, "elementKind": "number", "rows": 2, "columns": 3 }
    }
  }
}
```

For a binary search input, require an ascending array in your program's comment or process/sort it before searching: bounds settings alone do not check sort order. For algorithms accessing fixed positions, set minLength large enough to include every referenced index.

## Limits and preflight

The file is at most 300,000 UTF-8 bytes; source at most 500 physical lines and 50,000 UTF-8 bytes. Block nesting and function call depth are each limited to 32. Execution stops at 10,000 steps, 128 variables, 1,000 cells per array / 5,000 total array cells, or 1,000 outputs / 200,000 output characters. A string is at most 10,000 characters; aggregate stored strings at most 100,000. Keep teaching examples much smaller. Nonfinite numbers, division by zero, invalid indices, unsupported syntax, and exhausted limits produce a row-specific error.

Before supplying a file: verify the JSON envelope, complete block bodies, matching branch depths, initialized variables and arrays, array dimensions and indexing base, integer range loops, input specs, function signatures and arities, return values on every required path, a terminating base case for recursion, and termination within these limits. Do not include user-facing instructions in `source` unless they are appropriate program comments or displayed output. The app will validate the file before replacing the current program; importing never automatically executes it.
