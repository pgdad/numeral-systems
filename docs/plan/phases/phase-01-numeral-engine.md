# Phase 01 — Numeral & Addition Engine

**Depends on:** 00 · **Unlocks:** 03 (with 02)

## Context
Pure logic with no DOM. Every lesson and the playground use these functions to
convert numbers, describe place values, and drive step-by-step animations. See
PLAN.md § "Numeral engine contract" and DECISIONS D6/D7.

## Goal
Well-tested modules `js/core/numeral.js`, `js/core/digitsets.js` and `js/core/addition.js`.

## Tasks
1. **`numeral.js`** (`NumSys.numeral`):
   - `toDigits(n, base)` returns an array of digit values, most significant first. `0 → [0]`.
   - `fromDigits(values, base)`.
   - `placeValues(n, base)` returns `[{digit, power, placeValue, contribution}]`. This drives the "237 = 200+30+7" animations.
   - `format(n, set, {minLength, groupSize})` returns a string for text sets, or an array of digit objects for icon/color sets.
   - `parse(input, set)`: case-insensitive for hex. It returns `{ok, value, error}` with kid-friendly error text
     (for example "8 isn't a digit in octal: octal only uses 0–7!").
   - `countSequence(from, to, base)` returns an array of `{n, digits, changedPlaces}`. `changedPlaces` marks which
     places rolled over, so the odometer can animate only those.
   - `maxWithPlaces(places, base)`, for example (10, 2) → 1023.
   - BigInt support in `toDigits`/`fromDigits`/`parse` for the converter (accept bigint input and return bigint
     when the input was bigint).
2. **`digitsets.js`** (`NumSys.digitsets`): registry plus built-ins:
   `decimal`, `binary`, `octal`, `hex`, `animals` (base 5, per D6, with `speak` and `sound` keys),
   and `colors` (base 3, per D6, with `color`, `shape` and `name`). Add `register(set)` so the playground can add
   custom sets, and `validate(set)`. An icon digit has `{value, label, speak, icon:'cat', sound:'meow'}`.
   A color digit has `{value, label, speak, color:'#e53935', shape:'circle'}`.
   - `speak(n, set)` returns read-aloud text: "one-zero-one-one" for binary, "Dog-Frog" for animals,
     "two A" for hex, and normal words for decimal ("two hundred thirty-seven"). Include a small
     `numberToWords` up to 9999 for decimal.
3. **`addition.js`** (`NumSys.addition`):
   - `addSteps(a, b, base)` returns a per-column list, from the ones column outward:
     `{column, power, da, db, carryIn, total, digit, carryOut}`, plus a final carry column if needed.
   - `explainStep(step, set)` returns kid-friendly text, for example
     "A plus F is twenty-five. That's one sixteen and nine, so write 9 and carry 1."
     This uses `set` for digit names (animals say "Frog plus Pig…").
   - `add(a, b)` is a convenience wrapper. Also `subtractSteps` (stretch goal, not required).
4. **Tests** (`tests/numeral.test.js`, `tests/digitsets.test.js`, `tests/addition.test.js`):
   round-trips for bases 2–16 and many values, edge cases (0, max values, BigInt), and every worked
   example in CONTENT.md (13 in every costume, 47+38, 101+011, 2A+1F, 17+5 octal, Dog-Frog+Frog-Pig,
   Yellow-Green+Green-Green) asserted exactly. These double as a content correctness check.
5. Add the new files to `index.html` and `tests/load-app.js`.

## Acceptance criteria
- [x] All CONTENT.md worked examples are verified by tests.
- [x] Round-trip property test: for bases 2..16 and n in 0..5000, `fromDigits(toDigits(n,b),b) === n`.
- [x] `speak()` outputs match the expected strings for the CONTENT.md examples.
- [x] `parse()` rejects invalid digits with friendly messages.
- [x] `tools/check.sh` passes. PROGRESS.md is updated and committed.

## How to see it
Open `tests/browser.html` and run `node --test tests/`.

## Out of scope
Any UI.
