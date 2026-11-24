# HEC December Ad-Hoc: Proposed Format

One game, three tee boxes, one rule. No handicap strokes and no side calculations.

## The proposal
1. **Pick your tee box by band** (table below). The Low band plays the back tees (Black) every week, and the other bands move up from there. A guest picks the band closest to their handicap or typical score.
2. **Pick up at triple bogey.** The most you can take on any hole is triple bogey, which is par plus 3 (on a par 4, a 7 is the most you write down). Set GSPro's Max Score to triple bogey so it applies automatically. It speeds up play, and a bad drive stops costing the whole round.
3. **Closest to the pin is played from your assigned tee box.** That keeps the shorter tees in play on the par 3s too.
4. **Everything else is normal.** Same scoring, same payouts (50% weekly winner, 25% CTP, 25% skins), and the lowest total wins.

### Tees by band
| Date | Course | Low | Mid | High |
|---|---|---|---|---|
| Dec 2 | Sanctuary Moon (front) | Black | White | Yellow |
| Dec 9 | The Fold at Eastwood (back) | Black | Green | Yellow |
| Dec 16 | Gilded Dunes (back) | Black | Yellow | Red |
| Dec 23 | Kenai Fjords HD (front) | Black | White | Red |
| Dec 30 | San Miguel Island HD (back) | Black | White | Red |

- **Low (under 4):** BDizzle, PikeMatrick, NickP.
- **Mid (4 to 9):** bsteffy, TLindell, holiday402, cburesh, BozClubBreaker.
- **High (18 and up):** 2FlumsUp, HuskerRC13, FavHoliday27.

### Why this and not strokes
- **It is one game for everyone.** The only difference between players is which tee they hit from, which is how golf has always evened things out.
- **It doesn't punish the good players.** In Season 2 the triple-bogey max would have saved Low about 0 strokes per nine, Mid about 0.4 and High about 3.7. A double-bogey max would have saved High about 7, so triple is the lighter touch.
- **It aims at the real issue.** The High players can score well but have blow-up holes, mostly off the tee. Shorter tees make those less likely, and the cap limits the damage.
- **It's easy to run for guests.** There are no indexes to calculate and no allowance to apply.

### Check after two weeks
SGT's ratings on fantasy courses are untested (Gilded Dunes played about 4 strokes easier than its rating predicted), so treat the stroke estimates in the back pages as rough. After Dec 2 and Dec 9, look at the weekly scores by band. If one band is clearly running ahead or behind, move that band's tee up or down a box. Don't add a stroke rule.


---

# The work behind it

## How the bands were set
Bands are set by index (a guest uses their own index or a best guess):
- **Low (under 4):** BDizzle (−2), PikeMatrick (−2), NickP (1).
- **Mid (4 to 9):** bsteffy (4), TLindell (4), holiday402 (5), cburesh (6), BozClubBreaker (9).
- **High (18 and up):** 2FlumsUp (18), HuskerRC13 (19), FavHoliday27 (21).

Boz has no Season 2 handicap yet (the database holds a placeholder 0), so he is left out of the math and placed by his Season 1 index of 9. The numbers below use a representative index for each band: −1 for Low (the average of its members), 5 for Mid (the average of the four Mid players with a Season 2 index) and 19 for High. Each band gets the tee that lands closest to +3 over par, or the nearest the tee list allows.

| Date | Course | Low | Mid | High | Yards between tees (Low to Mid, Mid to High) | Expected gap, Low to High (strokes) |
|---|---|---|---|---|---|---|
| Dec 2 | Sanctuary Moon (F) | Black (+0.7) | White (+2.5) | Yellow (+5.5) | 343, 708 | 4.8 |
| Dec 9 | The Fold (B) | Black (−0.3) | Green (+1.8) | Yellow (+8.7) | 378, 553 | 9.0 |
| Dec 16 | Gilded Dunes (B) | Black (+0.6) | Yellow (+2.9) | Red (+9.2) | 392, 366 | 8.6 |
| Dec 23 | Kenai Fjords (F) | Black (−0.6) | White (+2.8) | Red (+11.2) | 488, 359 | 11.8 |
| Dec 30 | San Miguel (B) | Black (+2.6) | White (+4.2) | Red (+9.6) | 357, 300 | 7.0 |

Numbers in brackets are expected score over par for that band's representative index.

**Four picks were adjusted by hand after the model's first pass, and the proposal reflects them:**
- **The Fold (Mid):** White became Green, to even out the spacing. Mid was 183 yards behind Low but 748 yards ahead of High. On Green it is 378 and 553. It makes Mid's expected score about 1 stroke better.
- **The Fold (High):** Blue became Yellow. Yellow is 338 yards shorter on this nine (2,536 vs 2,874), but the model scored it about 0.4 strokes harder. That is an artifact: the back nine is a slightly bigger share of Yellow's 18 holes (51.4% vs 49.6%), which inflates its nine-hole rating.
- **Kenai Fjords (Mid):** Red became White. SGT rates Black, Blue and Red the same (70.0) despite 1,600 yards of difference, so the model couldn't separate them and put Mid and High on the same tee. Spacing here follows yardage. Low plays Black (the back tees) here like every other week.
- **San Miguel (Mid):** Red became White, for the same reason: Mid and High were both on Red. White splits the course, with about 350 yards to Black and 300 to Red. It costs Mid about 1 stroke of expected score.

### What the tees buy you
If everyone played one middle tee instead, the expected gap from Low to High would be about 10 to 12 strokes every week. With bands it is 4.8 to 11.8 strokes (9.0 on Dec 9 after the Yellow tee change). Low and Mid end up within about 1.5 to 3.5 strokes of each other. The High band is the outlier: no tee on these courses brings them within about 3 strokes of Mid, and Dec 23 leaves them 8 strokes behind.

## How far to trust the ratings
The tee picks use SGT's course ratings and slopes, which nobody has tested on these fantasy courses. Gilded Dunes is the only one of the five we have league results on (Season 1 week 8 from Yellow, Season 2 week 2 from Blue), and it shows the problem. I compared each Season 2 course's actual scores with what its rating predicts for each band, using the same method as the tee model:

| Band | Average miss across the 12 Season 2 courses (strokes per nine, actual minus predicted) | Gilded Dunes miss | Gilded Dunes vs average |
|---|---|---|---|
| Low | +4.7 | +0.4 | 4.3 strokes easier |
| Mid | +5.2 | +1.6 | 3.6 strokes easier |
| High | +10.8 | +5.8 | 5.0 strokes easier |

- Every course plays worse than the formula says, because the formula is built on handicap indexes. What matters is the difference between courses, and Gilded Dunes (rated 75.2/150, the highest in the league) came out about 4 to 5 strokes easier than the rest.
- Hillcrest (74.1/131) and Landmand's first week were also easier than their ratings, so the highest-rated courses may overstate their difficulty in general.
- The other four December courses have no league results, so their ratings could be off in either direction. The expected-score numbers in the tables below should be read as rough.
- The yards between tees do not depend on the ratings, which is why they are shown beside the tee picks. The two-week check on page 1 is what corrects any pick that turns out wrong.

## Note on the High band: the issue is blow-up holes, not ability
The High players can score much better than their index suggests. Their problem is consistency, mostly off the tee. The Season 2 hole-by-hole data (11 to 12 rounds each, auto-putt on) supports this:

| Band | Holes double bogey or worse | Avg per nine, over par | Same, any hole capped at triple | Same, any hole capped at double | Same, any hole capped at bogey |
|---|---|---|---|---|---|
| Low (BDizzle, PikeMatrick, NickP) | 7% to 12% | +4.1 | +4.1 | +3.9 | +3.0 |
| Mid (bsteffy, TLindell, holiday402, cburesh) | 14% to 27% | +8.1 | +7.7 | +7.1 | +5.2 |
| High (2FlumsUp, HuskerRC13, FavHoliday27) | 61% to 72% | +21.9 | +18.2 | +14.5 | +8.4 |

- Capping each hole at triple bogey takes about 3.7 strokes per nine off the High band, 0.4 off Mid and nothing off Low. A double-bogey cap would take about 7.4, 1.0 and 0.2.
- Capped at bogey, the High band averages +8.4 per nine against +5.2 for Mid, so the gap is about 3 strokes. That is the level they could reach if the blow-ups went away.
- These rounds were played from the league's usual tees, not the shorter tees proposed here. The tee model can't see blow-ups, so it doesn't predict how much shorter tees will help.

*Considered and set aside:* a fixed stroke allowance for the High band. It adds a second rule for one group and would over-credit them if the tees fix the problem.

## Where the numbers come from
Every tee's yardage, course rating and slope is read off the course's SGT scorecard (simulatorgolftour.com course library). Each nine's yardage was added up hole by hole and ties out to the printed 18-hole total on every tee used. All five courses are on SGT.

| Date | Course | Nine | Par | SGT id |
|---|---|---|---|---|
| Dec 2 | Sanctuary Moon | Front | 36 | 1969 |
| Dec 9 | The Fold at Eastwood | Back | 36 | 763 |
| Dec 16 | Gilded Dunes | Back | 36 | 2492 |
| Dec 23 | Kenai Fjords HD | Front | 36 | 3760 |
| Dec 30 | San Miguel Island HD | Back | 36 | 3725 |

## Tee data (rating / slope are 18-hole; yards are for that week's nine)
| Course (nine) | Tee | Rating/Slope | Nine yds | 18-hole yds |
|---|---|---|---|---|
| Sanctuary Moon (F) | Black | 76.5/124 | 3,529 | 7,256 |
| | Blue | 75.8/122 | 3,438 | 7,088 |
| | White | 73.4/115 | 3,186 | 6,497 |
| | Red | 71.5/110 | 3,045 | 6,041 |
| | Yellow | 67.1/98 | 2,478 | 5,003 |
| The Fold (B) | Black | 73.4/135 | 3,467 | 7,010 |
| | White | 72.7/130 | 3,284 | 6,658 |
| | Green | 70.7/127 | 3,089 | 6,242 |
| | Blue | 68.6/122 | 2,874 | 5,789 |
| | Yellow | 67.3/120 | 2,536 | 4,937 |
| Gilded Dunes (B) | Black | 77.5/156 | 3,452 | 7,171 |
| | Blue | 75.2/150 | 3,226 | 6,700 |
| | Yellow | 73.1/145 | 3,060 | 6,260 |
| | White | 71.5/139 | 2,906 | 6,001 |
| | Red | 69.2/132 | 2,694 | 5,471 |
| Kenai Fjords HD (F) | Black | 70.0/150 | 3,660 | 7,104 |
| | Blue | 70.0/145 | 3,428 | 6,618 |
| | White | 69.0/140 | 3,172 | 6,123 |
| | Red | 70.0/135 | 2,813 | 5,490 |
| San Miguel HD (B) | Black | 72.9/123 | 3,495 | 6,517 |
| | White | 69.6/113 | 3,138 | 5,789 |
| | Red | 66.7/105 | 2,838 | 5,149 |

Junior and Par-3 tees are left out.

## Method
1. **Nine-hole rating** = 18-hole rating × (this nine's yards ÷ 18-hole yards).
2. **Expected score for a player with index H** = nine-hole rating + (H ÷ 2) × (slope ÷ 113). This is the standard USGA relationship (score ≈ rating + index × slope/113), halved for nine holes.
3. **Expected over par** = expected score − 36.

Indices used are the current league handicaps: BDizzle −2, PikeMatrick −2, Boz 0, NickP 1, bsteffy 4, TLindell 4, holiday402 5, cburesh 6, 2FlumsUp 18, HuskerRC13 19, FavHoliday27 21.

## Expected score over par, by tee
| Course | Tee | −2 | 0 | 4 | 6 | 18 | 21 |
|---|---|---|---|---|---|---|---|
| Sanctuary Moon | Black | +0.1 | +1.2 | +3.4 | +4.5 | +11.1 | +12.7 |
| | Blue | −0.3 | +0.8 | +2.9 | +4.0 | +10.5 | +12.1 |
| | White | −1.0 | 0.0 | +2.0 | +3.0 | +9.2 | +10.7 |
| | Red | −0.9 | 0.0 | +2.0 | +3.0 | +8.8 | +10.3 |
| | Yellow | −3.6 | −2.8 | −1.0 | −0.2 | +5.0 | +6.3 |
| The Fold | Black | −0.9 | +0.3 | +2.7 | +3.9 | +11.1 | +12.8 |
| | White | −1.3 | −0.1 | +2.2 | +3.3 | +10.2 | +11.9 |
| | Green | −2.1 | −1.0 | +1.2 | +2.4 | +9.1 | +10.8 |
| | Blue | −3.0 | −1.9 | +0.2 | +1.3 | +7.8 | +9.4 |
| | Yellow | −2.5 | −1.4 | +0.7 | +1.8 | +8.1 | +9.7 |
| Gilded Dunes | Black | −0.1 | +1.3 | +4.1 | +5.4 | +13.7 | +15.8 |
| | Blue | −1.1 | +0.2 | +2.9 | +4.2 | +12.2 | +14.1 |
| | Yellow | −1.6 | −0.3 | +2.3 | +3.6 | +11.3 | +13.2 |
| | White | −2.6 | −1.4 | +1.1 | +2.3 | +9.7 | +11.5 |
| | Red | −3.1 | −1.9 | +0.4 | +1.6 | +8.6 | +10.3 |
| Kenai Fjords | Black | −1.3 | +0.1 | +2.7 | +4.0 | +12.0 | +14.0 |
| | Blue | −1.0 | +0.3 | +2.8 | +4.1 | +11.8 | +13.7 |
| | White | −1.5 | −0.3 | +2.2 | +3.5 | +10.9 | +12.8 |
| | Red | −1.3 | −0.1 | +2.3 | +3.5 | +10.6 | +12.4 |
| San Miguel | Black | +2.0 | +3.1 | +5.3 | +6.4 | +12.9 | +14.5 |
| | White | +0.7 | +1.7 | +3.7 | +4.7 | +10.7 | +12.2 |
| | Red | −0.2 | +0.8 | +2.6 | +3.6 | +9.1 | +10.5 |
