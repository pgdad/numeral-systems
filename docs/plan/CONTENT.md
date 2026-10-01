# Lesson Content & Narration Scripts

These are draft scripts. Lesson phases turn each **Scene** into a scene object and each
numbered line into a step: the `say` text plus the described animation in [brackets].
Sessions may polish the wording (short sentences, friendly tone, read-aloud
friendly) but must keep the teaching points. Narration should spell numbers the way
they should be spoken, for example "one-zero-one-one", not "1011".

---

## Lesson 1 — Base‑10: Counting on Our Fingers (`base10`, Phase 04)

### Scene 1.1 "Hello, fingers!"
1. Hi! Let's count. Hold up your hands. How many fingers do you have? [two open hands appear, wave]
2. Let's count them together. [fingers rise one by one with a pop sound and the big number 1…10 beside them; the narrator says each number]
3. Ten fingers! That's why people count in groups of **ten**. [hands glow, "10" bounces]

### Scene 1.2 "Ten digits"
1. We write every number with just ten little symbols called **digits**. [tiles 0–9 slide in]
2. Zero, one, two, three, four, five, six, seven, eight, nine. [each tile wiggles as it's read]
3. "Digit" is also a word for finger! [a finger morphs into the "1" tile]
4. But wait: there's no single digit for ten. What do we do? [a "?" bounces]

### Scene 1.3 "Making a bundle"
1. When we run out of fingers, we make a bundle of ten. [ten sticks gather into a bundle with a rubber band]
2. We write one bundle in the **tens** place and zero leftovers in the **ones** place. [place-value columns: Tens | Ones → 1 | 0]
3. Let's keep counting: eleven, twelve… [the odometer rolls 10→15; a single stick joins the ones column each time]
4. Ten bundles make a hundred! A bundle of bundles. [ten bundles → one big crate; Hundreds column appears]

### Scene 1.4 "What does 237 mean?"
1. Look at 237. [big number]
2. Two hundreds, three tens, and seven ones. [the digits fly into columns and expand to 200 + 30 + 7]
3. Each place is worth **ten times** the place to its right. [×10 arrows between columns]

### Scene 1.5 "You try it!" (interactive)
- The child clicks fingers up or down on two hands (0–10), then uses the +/– buttons on a
  3-column place-value board (0–999). The narrator reads the number.
- Challenge prompts: "Show me seven fingers!", "Make the number forty-two!"

---

## Lesson 2 — Binary: Count to 1023 on Two Hands (`binary`, Phase 05)

### Scene 2.1 "Fingers are switches"
1. Usually we count one finger at a time. Ten fingers, ten numbers. [hands count 1–10 quickly]
2. But what if every finger was a switch? Up means **one**, down means **zero**. [all fingers down; one finger flicks up and down showing 1/0 labels]
3. With only two digits, zero and one, we're counting in **binary**. Computers count this way! [the hands sit next to a cartoon computer chip with blinking lights]

### Scene 2.2 "Each finger has a value"
1. Let's give each finger a number. This little finger on the right is worth one. [right pinky label "1"]
2. The next finger is worth double: two. [right ring "2"]
3. Then four, eight, sixteen… each finger is worth double the one before. [labels appear across both hands: 1, 2, 4 … 512]
4. Just like base‑10 places go up by ten times, binary places go up by **two** times. [compare strips: 1,10,100 vs 1,2,4,8]

### Scene 2.3 "Let's count!"
1. Zero: all fingers down. [all down; the binary readout shows 0000000000]
2. One: little finger up. [readout …0001]
3. Two: put that one down, and the next one up. Just like carrying! [readout …0010]
4. Three: both up. Two plus one is three. [readout …0011]
5. Watch it count all by itself. [auto count 0–31 with the binary readout and decimal readout; it speeds up gradually]

### Scene 2.4 "How high can we go?"
1. What if *all ten* fingers are up? [all up; values float above]
2. Let's add them up: 512 + 256 + 128 + 64 + 32 + 16 + 8 + 4 + 2 + 1… [the values fly into a sum]
3. **One thousand and twenty-three!** With ten fingers you can count to 1023 instead of 10! [fireworks]
4. Counting zero, that's 1024 different numbers. [small text: 2 × 2 × … ten times = 1024]

### Scene 2.5 "Reading binary numbers"
1. Here's a binary number: one-zero-one-one. [1011 appears; matching fingers go up]
2. Eight, plus zero, plus two, plus one. That makes eleven! [values highlight and sum]
3. Your turn! [interactive]

### Scene 2.6 "You try it!" (interactive)
- Clicking fingers toggles bits. Live readouts show binary, decimal, and the sum of values.
- Challenges: "Show 5", "Show 10", "Show your age", "Show 100", "Show 1023".
  Show a star when solved.

---

## Lesson 3 — Octal & Hexadecimal (`octal-hex`, Phase 06)

### Scene 3.1 "Any number can be the base"
1. We've counted with ten digits and with two digits. We can pick *any* number of digits! [base‑10 and base‑2 strips]
2. Imagine aliens with **eight** fingers. They'd count in **octal**. [a friendly 4-fingered-per-hand alien waves]
3. Octal digits are zero to seven. After seven comes one-zero! [the odometer in base 8 rolls 5,6,7,10,11]
4. Each octal place is worth **eight** times more: ones, eights, sixty-fours. [place columns]

### Scene 3.2 "Hexadecimal: sixteen digits"
1. Now imagine a creature with **sixteen** fingers! [silly octopus-ish creature with 16 fingers]
2. We need sixteen digits, but we only have zero to nine. So we borrow letters! [tiles 0–9 then A B C D E F pop in]
3. A is ten, B is eleven, C is twelve, D is thirteen, E is fourteen, F is fifteen. [each letter reveals its value]
4. After F comes one-zero, which is sixteen. [the hex odometer rolls E, F, 10, 11]
5. People call this "hex" for short. [stamp: HEX]

### Scene 3.3 "Hex and binary are best friends"
1. One hex digit fits exactly four binary digits: four fingers! [4 fingers ↔ 1 hex tile; cycle 0–F]
2. So programmers use hex as a short way to write binary. [1111 1010 → F A]
3. All ten fingers up is binary 1111111111. In hex that's three-F-F. [regroup bits 11 1111 1111 → 3 F F]

### Scene 3.4 "Secret codes in colors"
1. Every color on a computer screen has a secret hex code! [color swatch with #FF0000]
2. Two hex digits for **red**, two for **green**, two for **blue**. [code split into RR GG BB, with three sliders]
3. F-F means "as much as possible". Zero-zero means "none". [slider demo: #FF0000 → #00FF00 → #0000FF → #FFFF00]
4. Mix them to make any color! [interactive color mixer]

### Scene 3.5 "You try it!" (interactive)
- A hex color mixer: three dials (00–FF) show the hex code, the decimal value, and a live swatch.
  Challenges: "Make yellow", "Make purple", "Make white".
- An octal/hex counter with +1 and −1 buttons and three readouts (dec/oct/hex).

---

## Lesson 4 — Silly Number Systems (`silly`, Phase 07)

### Scene 4.1 "Digits can be anything!"
1. Digits are just symbols we agree on. They could be pictures! [digits 0–4 morph into animals]
2. Meet the **animal numbers**: Cat is zero, Dog is one, Frog is two, Pig is three, Duck is four. [each animal pops in with its sound]
3. Five animals means we're counting in **base five**.

### Scene 4.2 "Counting with animals"
1. Let's count! Cat… Dog… Frog… Pig… Duck… [one place cycles through the animals with sounds]
2. We ran out of animals! So: Dog in the next place, Cat in the ones place. Dog-Cat means five! [two places; the carry animation shows a duck "jumping" into the next column]
3. Dog-Dog is six. Dog-Frog is seven… [odometer]
4. What's Frog-Pig? Two fives plus three… thirteen! [the value breakdown animates]

### Scene 4.3 "Color numbers"
1. Now let's count with **colors**: red is zero, yellow is one, green is two. [traffic light; each color has its own shape]
2. Only three colors means **base three**. [odometer: red, yellow, green, yellow-red, yellow-yellow…]
3. Each place is worth three times more: ones, threes, nines. [place columns]
4. Green-Green-Green is two nines plus two threes plus two ones: twenty-six! [breakdown]

### Scene 4.4 "Same number, many costumes"
1. The number thirteen can wear lots of costumes. [13 in a center circle]
2. In base‑10 it's one-three. In binary, one-one-zero-one. In hex, D. With animals, Frog-Pig. With colors, yellow-yellow-yellow. [costumes appear around it]
3. The number doesn't change, only how we write it! [all costumes spin back into 13]

### Scene 4.5 "You try it!" (interactive)
- An animal counter and a color counter with +1/−1 buttons. A "costume wheel": type a decimal
  number and see it in every system.
- Challenge: "What number is Dog-Duck?" with multiple-choice answers.

---

## Lesson 5 — Adding in Every System (`addition`, Phase 08)

### Scene 5.1 "Adding with carries (base‑10)"
1. Let's add 47 and 38. [column layout]
2. Ones first: seven plus eight is fifteen. That's more than nine! [ones-column sum bubble shows 15]
3. Write the five, and **carry** the one ten over to the tens. [the "1" hops to the top of the tens column]
4. Tens: one plus four plus three is eight. Answer: eighty-five! [result]

### Scene 5.2 "Adding in binary"
1. Binary addition has only four rules: 0+0=0, 0+1=1, 1+1=10, and 1+1+1=11. [rule cards]
2. Let's add five and three: one-zero-one plus zero-one-one. [columns; matching hands show 5 and 3]
3. [Step through each column with carries] … one-zero-zero-zero, that's eight! [hands show 8]

### Scene 5.3 "Adding in hex"
1. Add 2A and 1F in hex. [columns]
2. A plus F is ten plus fifteen, twenty-five. Twenty-five is one sixteen plus nine: write 9, carry 1. [breakdown]
3. One plus two plus one is four. Answer: four-nine in hex, which is seventy-three! [result + decimal check]

### Scene 5.4 "Adding octal" (short)
1. 17 + 5 in octal: seven plus five is twelve, which is one eight and four. Write 4, carry 1 → 24. [columns]

### Scene 5.5 "Adding animals!"
1. Dog-Frog plus Frog-Pig. [animal columns]
2. Frog plus Pig is two plus three, five. That's one more than Duck, so the ones place becomes Cat and we carry a Dog! [the carry animation with a dog jumping]
3. Dog plus Dog plus Frog… Duck! Answer: Duck-Cat. That's twenty! [decimal check: 7 + 13 = 20]

### Scene 5.6 "Adding colors!"
1. Yellow-Green plus Green-Green (base 3). [the color columns animate the same way, with carries as a bouncing yellow ball]

### Scene 5.7 "You try it!" (interactive)
- Pick a system (dec/bin/oct/hex/animals/colors). The app gives two numbers. The child steps
  through each column, choosing the result digit and carry from tile buttons. The app
  checks each answer and celebrates when it's right.

---

## Lesson 6 — Playground (`playground`, Phase 09)
Not narrated scene by scene. A short intro line, then free play:
- **Converter**: type or click a number and see it in dec/bin/oct/hex/animals/colors, plus the finger view.
- **Make your own number system**: choose a base (2–16) and pick a symbol for each digit
  from the icon/color palette. Then count, convert, and add with it. Saved in `localStorage`
  (optional, wrapped in try/catch).
- **Quiz**: 10 random questions, mixed systems, with an adjustable difficulty and a star tally.
