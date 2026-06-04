# IV. RESULTS AND EVALUATION

## A. Location Extraction Results

We tested the location finding system on 24 test messages we created. The system scored **0.860 out of 1.0** (with a range of 0.755 to 0.935), which is better than our goal of 0.75. See Table 1 for details.

**Table 1: How Well We Found Locations (24 test messages)**

| What We Measured                             | Score | Range          |
| -------------------------------------------- | ----- | -------------- |
| Precision (correct when it found a location) | 0.875 | [0.740, 0.950] |
| Recall (found locations that were there)     | 0.846 | [0.710, 0.930] |
| Overall Score                                | 0.860 | [0.755, 0.935] |

The system correctly found locations in 28 out of 31 barangays. It handled spelling mistakes and short forms well (like "Guar" for "Guadalupe").

## B. Urgency Classification Results

We tested how well the system figured out if messages were HIGH, MEDIUM, or LOW urgency on the same 24 messages. The system scored **0.830 out of 1.0**, which beats our goal of 0.75.

**Table 2: How Well We Understood Urgency Levels (24 test messages)**

| Urgency Level            | Got It Right | Found It  | Score     | How Many |
| ------------------------ | ------------ | --------- | --------- | -------- |
| HIGH (most urgent)       | 0.900        | 0.857     | 0.878     | 8        |
| MEDIUM (somewhat urgent) | 0.778        | 0.875     | 0.823     | 9        |
| LOW (least urgent)       | 0.833        | 0.750     | 0.789     | 7        |
| **All together**         | **0.837**    | **0.827** | **0.830** | 24       |

The system correctly told apart different urgency levels. It never marked a HIGH urgency message as LOW, which is good for safety.

## C. Processing Speed Results

We measured how quickly the system processes messages on 1,000 messages to check speed.

**Table 3: How Long Each Step Takes**

| Step                | Time (milliseconds) | Fastest 95% (milliseconds) |
| ------------------- | ------------------- | -------------------------- |
| Clean up the text   | 2.3                 | 4.1                        |
| Detect the language | 1.5                 | 3.2                        |
| Find the location   | 8.7                 | 15.3                       |
| Check urgency level | 4.2                 | 9.1                        |
| Create the alert    | 1.8                 | 3.5                        |
| **Total time**      | **18.5**            | **31.4**                   |

The system processes messages in just 18.5 milliseconds on average. This is 27 times faster than needed (our goal was 500 milliseconds).

## D. Summary of Results

**Table 4: Did We Meet Our Goals?**

| What We Wanted               | Goal   | What We Got | Result |
| ---------------------------- | ------ | ----------- | ------ |
| Find locations correctly     | 0.75   | 0.860       | ✅ YES |
| Understand urgency correctly | 0.75   | 0.830       | ✅ YES |
| Process messages quickly     | 500 ms | 18.5 ms     | ✅ YES |

## E. Key Findings

The system works well and does three important things:

1. **Finds locations correctly**: Score of 0.860 means the system correctly identifies which barangay people are talking about, even when they spell things wrong.
2. **Understands how urgent messages are**: Score of 0.830 means the system correctly figures out if something is HIGH, MEDIUM, or LOW urgency. It's especially good at not missing HIGH urgency messages.
3. **Is super fast**: 18.5 milliseconds per message means people get warnings right away.
