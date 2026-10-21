# What we're doing

This is a fun one. I play the two-row chromatic half-step button accordion, this one, to be precise, in C#/D: https://www.libertybellows.com/shop/Diatonic-Button-Accordions/2-Row-Half-Step-Chromatics/p/NEW-Cherry-Saltarelle-Aether-II-Diatonic-Button-Accordion-CD-MM-21-8-x33458899.htm

and I'm having trouble memorizing the buttons. I'd like to build myself a little quizzer in javascript (or whatever), that I can host ideally on my github. Here's what I want:

I'd like to see a vertical row of buttons rendered on the page (maybe make the middle d button colored differently, as a middle reference point). Then each "quiz" consists of one buttons being highlighted, plus a direction of the bellows (left arrow for pull, right arrow for push). Then I'd like to click/tap for the answer to be revealed (what note, basically), then I'll swipe left for wrong, swipe right for correct.

We should have these use notes from a given key, so for D major the entire D row is in play, and two notes from C# (F# and C#, namely). So the user should be able to choose a key, maybe from a dropdown. 

Actually, rethinking this slightly... It would be ideal if we had a few quiz rounds centered around a given note, instead of just middle D. So e.g. say we're in A major: we should generate a few quiz tests around F# in the low-end. We could have a sort of minimap of the whole instrument in a small box in the top-right, then in the area of interest, we just have a zoomed in box (giving us much more visual space)

THEN (and sorry for the rambles) what I want to do is add another mode, which will just be a timed/auto version of the previous one. I'd the area in question to move to a new note center (wait for a second, so the player can get their bearings), then the note to guess will flash, wait some timed interval, then reveal the correct answer. This is sort of the blitz version of the previous one. 

The important / constant parts of all this are
1. There's a key. Let's start with F,C,G,D,A,E,B (majors) to start with
2. There's a reference point/anchor. The user should see an anchor note hightlighted (it should remain highlighted) and then a note in not-necessarily close proximity should be chosen as the quiz. 
3. There's a box around the anochor - I've only got five fingers, and so what's important to me is knowing instantaneously: "say my first finger is on low d, where is my third finger on the pull on the inner row". The bounding box should scale with difficulty. Let's just start with a bounding box consisting of five buttons from the inner row, and our anchor note can land anywhere in that box. 

Then one more tweak... let's have the reference note just have an outline of some very noticeable color, plus a direction arrow above it. 

OKAY, that was a lot. Can you ask me 10 questions to clarify your understanding / the design, and we'll use that so you can write the spec? I'll create a repo for this in my personal GH. For now, local only
