# 콜 원장: 고객 검색, 가능 코스, 실제입장, 현금 잔액과 계좌 잔액

Status: ready-for-agent

## Problem Statement

카운터는 전화로 세 가지를 바로 답해야 한다. 이 손님이 전에 왔는지, 고른 시각에 어느 Therapist가 어느 코스를 할 수 있는지, 오늘 현금과 계좌에 얼마가 남았는지.

지금 콜 원장은 고른 날의 콜만 보여 준다. 손님은 고객/메모 한 칸이라, 지난달 손님을 찾으려면 날을 넘겨 가며 봐야 한다. 비어 있는 Therapist는 행이 없어서, 3시에 90분 코스가 되는지는 사람이 앞뒤 콜을 세어야 한다. 손님이 늦게 들어와도 적을 곳이 없고, 객실과 실시간과 TV의 종료 예상은 예약시각에 코스 길이를 더한 값이라 다음 예약시각을 침범해도 장부가 말해주지 않는다. 결제수단별 합계는 보이지만 지출에는 수단이 없어서, 현금 잔액과 계좌 잔액을 순매출과 구분해서 볼 수 없다.

## Solution

같은 콜 원장에서 네 가지를 본다. 고객의 이름, 연락처, 메모와 과거 콜의 고객/메모, 비고로 방문 이력을 찾는다. 시각을 고르면 활성 Therapist 전원의 가능 코스가 한 목록으로 나온다. 실제입장을 적으면 그 콜의 표시 종료와, 다음 예약이 더 빠르면 그 예약시각을 말한 경고가 보인다. 객실, 실시간, TV는 그 표시 종료를 그린다. 지출은 현금 또는 계좌이고, 고른 날과 그 운영월의 현금 잔액, 계좌 잔액이 순매출 옆에 나온다.

가능 코스와 경고는 전화 응대용이다. 긴 코스를 원장에 적어 저장할 수 있고, 경고가 있어도 저장된다. 뒤 콜의 예약시각, 코스, 금액은 그대로다.

## User Stories

1. As a 카운터, I want to search from the call ledger by a 고객's name, phone, and memo, so that I can find a guest while I am still on the phone.
2. As a 카운터, I want that same search to match past calls' 고객/메모 and 비고, so that a guest written down before 고객 records still turns up.
3. As a 카운터, I want each history row to be one 콜, so that I see the visit itself.
4. As a 카운터, I want each history row to show the date, 예약시각, course, Therapist, status, and 고객/메모, so that I can tell which visit I found.
5. As a 카운터, I want 방문완료 rows above the other statuses, so that finished visits are the first ones I read.
6. As a 카운터, I want 예약, 노쇼, and 취소 rows to stay in the history with their status written out, so that a dropped visit is still visible.
7. As a 카운터, I want to open that day's ledger from the history date, so that I can see the visit among the rest of the day.
8. As a 카운터, I want the search to look across operating months, so that last month's guest is findable from today's ledger.
9. As a 카운터, I want a locked month's calls to remain findable, so that closing a month does not hide its guests.
10. As a 카운터, I want a locked month to stay closed for edits, so that finding an old 콜 does not unlock it.
11. As a 카운터, I want a 고객 record with name, phone, and memo, so that a guest is more than one free-text cell.
12. As a 카운터, I want to create that 고객 from the call ledger, so that I can record them without leaving the page.
13. As a 카운터, I want to correct a 고객's name, phone, and memo, so that a typo does not become a second person.
14. As a 카운터, I want to attach a chosen 고객 to a 콜, so that later visits share one record.
15. As a 카운터, I want the same phone number to stay unattached until I choose, so that two guests who share a number remain two 고객.
16. As a 카운터, I want the call's own 고객/메모 to remain when I attach a 고객, so that the words already on the row stay.
17. As a 카운터, I want a visible label "고객 검색", so that the field is named on the page.
18. As a 카운터, I want candidates to appear shortly after I type, so that the list follows the phone call.
19. As a 카운터, I want each candidate to show 고객/메모 and the latest visit date, so that I can pick the right guest.
20. As a 카운터, I want to move through candidates with the arrow keys and Enter, so that I can choose without leaving the keyboard.
21. As a 카운터, I want choosing a candidate to open that guest's visit history, so that one choice shows the calls.
22. As a 카운터, I want an empty result to say that nothing matched and to try part of a name or number, so that a miss tells me what to do next.
23. As a 카운터, I want the search text kept in the address, so that going back restores the result and the scroll position.
24. As a 관리자, I want the same search, history, and 고객 choice, so that I can answer the same questions on the ledger.
25. As a 카운터, I want to pick a time and see every active Therapist in one list, so that "3시에 되나요?" starts from the time.
26. As a 카운터, I want the list collapsed to "가능 코스" and the time control, so that the ledger stays in front until I need it.
27. As a 카운터, I want the open list to be a table of Therapist, attendance, this time, next 예약시각, and possible courses, so that I can scan one row per person.
28. As a 카운터, I want an occupied Therapist to read as unavailable and to show the 예약시각 they are free from, so that I can offer the next opening in words.
29. As a 카운터, I want a free Therapist to show the next 예약시각 and the free minutes, so that I know which course lengths fit.
30. As a 카운터, I want a course offered only when its length fits in those free minutes, so that a 60-minute course is possible when the next 예약시각 is 60 minutes away and a 90-minute course is not.
31. As a 카운터, I want the free minutes to run until the end of that day's slots when there is no later 예약, so that an open evening is judged against the day, not against a missing row.
32. As a 카운터, I want a course that ends exactly when the next 예약 starts to count as free at that start, so that back-to-back bookings stay possible.
33. As a 카운터, I want occupancy to run from 예약시각 for the course length, so that the list follows the booking.
34. As a 카운터, I want 노쇼 and 취소 to leave the time free, so that a dropped 콜 does not block a Therapist.
35. As a 카운터, I want 예약, 사용중, 청소중, and 방문완료 to occupy only their own interval, so that a finished visit explains the past slot and frees what comes after.
36. As a 카운터, I want 실제입장 to leave this list on 예약시각, so that a late guest does not move someone else's availability.
37. As a 카운터, I want attendance written on the row and the Therapist kept in the list, so that I can book a phone reservation before attendance is entered.
38. As a 카운터, I want a course that needs a second Therapist to be possible only when this Therapist has that course's minutes free and at least one other Therapist is free for the same interval, so that the second person the course requires is actually free.
39. As a 카운터, I want both Therapist assignments on a 콜 to occupy that person, so that a second assignment is not shown as free.
40. As a 카운터, I want 귀케어 and 운영팀 left off this list, so that the list is the people who do the course.
41. As a 카운터, I want a possible course to be a button whose text includes the minutes and that it is possible, so that color is not the only signal.
42. As a 카운터, I want an impossible course to be text, with the minutes and that it is impossible, so that I do not activate it from this list.
43. As a 카운터, I want pressing a possible course to fill the new row's 예약시각, Therapist, and course, so that the answer becomes a 콜 without retyping.
44. As a 카운터, I want a longer course typed on the ledger to save, so that the list advises the phone call and the ledger still accepts the row.
45. As a 카운터, I want an empty Therapist list to say there is nobody to show at that time and what to look at next, so that the panel does not go blank.
46. As a 카운터, I want course buttons to wrap onto the next line, so that a course name is never clipped.
47. As a 카운터, I want keyboard order to run from the time control, to expand, to the possible-course buttons, then into the ledger, so that I can answer the phone without a mouse.
48. As a 카운터, I want an 실제입장 cell directly after 예약시각, so that the time the guest walked in sits next to the booked time.
49. As a 카운터, I want 실제입장 in 10-minute steps, so that the clock matches how we record an arrival.
50. As a 카운터, I want 실제입장 left empty, so that a 콜 with no arrival yet is still valid.
51. As a 카운터, I want the cell to say that 예약시각 stays as it is, so that typing an arrival does not look like moving the booking.
52. As a 카운터, I want an empty 실제입장 to keep the reference time as 예약시각, so that the visit is still measured from the booking.
53. As a 카운터, I want a filled 실제입장 to become the reference time, so that the proposed end is the arrival plus the course length.
54. As a 카운터, I want no hand-entered finish time, so that the end I see is the 표시 종료.
55. As a 카운터, I want the course and the amount to stay unchanged when I enter 실제입장, so that a late guest does not reprice the visit.
56. As a 카운터, I want the next 콜's 예약시각 to stay put, so that a late guest yields instead of pushing the next booking.
57. As a 카운터, I want the next 예약 to be the following one for that same Therapist, skipping 노쇼 and 취소, so that a dropped 콜 does not pull the end forward.
58. As a 카운터, I want a warning that names the next 예약시각 when the proposed end passes it, so that a 15:20 arrival with 60 minutes and a 16:00 booking says "4:00 예약이 있습니다".
59. As a 카운터, I want 표시 종료 to be that next 예약시각 in that case, so that the row shows 16:00.
60. As a 카운터, I want 표시 종료 to be the proposed end when there is no next 예약 or the next one is at or after the proposed end, so that the same arrival shows 16:20 when the next booking is absent or at 17:00.
61. As a 카운터, I want no warning when the next 예약 only touches the proposed end, so that a back-to-back booking is not called a conflict.
62. As a 카운터, I want the same yield when 실제입장 is empty and the booked course already runs past the next 예약시각, so that the row, the room, and the TV agree before anyone types an arrival.
63. As a 카운터, I want the warning on the row, tied to the cell for assistive tech, so that the words belong to 실제입장.
64. As a 카운터, I want the warning to leave the row saveable, so that I can keep the late arrival.
65. As a 카운터, I want the warning in words together with color, so that the meaning is not color alone.
66. As a 카운터, I want 실제입장 in the ledger keyboard order after 예약시각 and before the room, so that the new cell is on the path I already use.
67. As a 웨이터, I want the room card to show this same 표시 종료, so that the floor sees the time the ledger already decided.
68. As a 카운터, I want the live board and the TV board to show that same 표시 종료, so that all three screens match the row.
69. As a 카운터, I want those screens to render the server's 표시 종료, so that each screen shows one end.
70. As a 카운터, I want each 콜 to keep a single payment method, so that one visit is cash or bank or card or other.
71. As a 카운터, I want to mark an expense as cash or bank, so that money leaving has a bucket.
72. As a 카운터, I want a new expense to default to cash, so that the common case is one less choice.
73. As a 카운터, I want expenses already on the books to count as cash, so that today's history has a balance.
74. As a 카운터, I want the selected day's cash received, cash spent, and 현금 잔액 on the summary, so that I can see the till for that date.
75. As a 카운터, I want the selected day's bank received, bank spent, and 계좌 잔액 beside that, so that the account is separate from the till.
76. As a 카운터, I want the operating month's cumulative 현금 잔액 and cumulative 계좌 잔액, so that I can see the month's till without an opening float.
77. As a 카운터, I want 현금 잔액 to be that range's cash receipts minus that range's cash expenses, so that the till is its own number.
78. As a 카운터, I want 계좌 잔액 to be that range's bank receipts minus that range's bank expenses, so that the account follows the same rule.
79. As a 카운터, I want the receipts in those balances to use the same calls as today's payment-method totals, so that a 노쇼 or a 취소 does not become till money.
80. As a 카운터, I want card and other to stay as totals outside both balances, so that those receipts are visible and are not cash or bank.
81. As a 카운터, I want 순매출 to stay the payment total minus the expense total, so that the line I already read keeps its meaning.
82. As a 카운터, I want a negative 현금 잔액 to say it is short, in words and in the danger color, so that a shortage is not a color-only sign.
83. As a 카운터, I want a negative 계좌 잔액 to show its signed amount in words together with the danger color, so that the account shortage is readable too.
84. As a 카운터, I want the expense method control to have a visible label, so that I know I am choosing cash or bank.
85. As a 카운터, I want the save control to wait while the expense saves, and the reason under the field when it fails, so that a failed expense does not look saved.
86. As a 카운터, I want a locked month to refuse expense edits, including the method, so that closing still protects the month.
87. As a 관리자, I want monthly closing snapshots to keep their current contents, so that confirming a month does not start storing till balances.
88. As a 카운터, I want no opening till carried from the previous operating month, so that the cumulative figure is only days inside this month.
89. As a 카운터, I want Korean and Vietnamese copy for the new labels, warnings, and empty states, so that the locale cookie still switches the ledger.
90. As a 카운터, I want the existing ledger density, tokens, and tabular numbers kept, so that the new blocks match the sheet I already use.
91. As a 카운터, I want new controls to have a hit area of at least 44px while existing ledger cells keep their height, so that the grid does not grow.
92. As a 카운터, I want status and warnings in words, without emoji, so that the meaning does not depend on decoration.
93. As a 카운터, I want motion limited to color and opacity, between 150 and 250ms, and instant when I prefer reduced motion, so that the panel does not animate the grid.
94. As a 카운터, I want the second-Therapist rule, the fixed discount, and course base-price payment to stay as they are, so that this work does not reprice a visit.
95. As a 웨이터, I want rooms, live, and TV to stay free of 고객 search, 고객/메모 editing, and expense entry, so that the floor boards stay read-only.
96. As a 카운터, I want the word Therapist on the ledger column and the availability list, so that the role stays distinct from the settlement-manager account.
97. As a 카운터, I want settlement, attendance, and TV wording left as it is, so that this name stays on the ledger and the availability list.
98. As a 관리자, I want 고객 link, 실제입장, and expense method to appear in the audit trail I already read, so that a till or arrival change has the same history as other ledger edits.

## Implementation Decisions

- All four behaviors live on the call ledger. There is no new top-level menu. Administrator and counter keep the ledger they have now. Other roles do not gain it.
- A 고객 has name, phone, and memo. Phone is not unique. The counter creates a 고객 and corrects those three fields from the ledger. Delete, merge, and import are absent. A 콜 may store a chosen 고객. Choosing does not copy or overwrite the call's 고객/메모. The same phone never selects a 고객 by itself. Calls written before this link remain searchable by 고객/메모 and 비고.
- Search is a calls-service query. It matches 고객 name, phone, and memo, plus 고객/메모 and 비고 on calls, across operating months, including locked months. The history result is one row per matching 콜. 방문완료 comes first. Within a status group, later service date then later 예약시각 comes first. 예약, 노쇼, and 취소 stay, with their status. An empty query returns no rows. Candidates group a 고객 as one choice, and group unlinked matches by their 고객/메모. Opening a 고객 shows calls linked to that 고객. Opening a memo group shows the unlinked calls in that group. The page waits 300ms after typing, labels the field "고객 검색", moves with arrows and Enter, and keeps the query in the address so back restores the result and scroll. The empty copy says nothing matched and tells the counter to try part of a name or number. Choosing a date opens that day's ledger.
- Availability is a calls-service query for one operating month, one service date, and one time. It returns one row per active Therapist. 귀케어 and 운영팀 are absent. Inactive Therapists are absent. Attendance is a label on the row, including when attendance has not been entered. It does not remove the row.
- Occupancy for that list runs from the call's 예약시각 for the course policy's duration. A course that ends at the next 예약시각 does not block that 예약시각. 노쇼 and 취소 do not occupy. 예약, 사용중, 청소중, and 방문완료 occupy their interval. Therapist 1 and Therapist 2 both occupy that person. 실제입장 does not move occupancy, and 표시 종료 does not move occupancy. Those two clocks are different on purpose. The availability list answers who is booked. 표시 종료 answers when this guest yields.
- A Therapist who is occupied at the chosen time is unavailable, and the row names the 예약시각 they are free from. A Therapist who is free shows the next 예약시각 and the free minutes until it. When there is no later 예약, the free minutes run to the end of that date's last time slot. A course is possible when its policy duration fits in the free minutes. At a time such as 15:00 with no later 예약, and with the day still longer than the longest seed course, every seed course is possible. A course that needs a second Therapist is possible only when this Therapist has that course's full duration free and at least one other active Therapist is free for that same interval. The second-Therapist flag and the duration come from the operating month's course policy.
- The open panel is a table: Therapist, attendance, this time, next 예약, possible courses. The this-time cell says "가능" or "불가 · HH:mm부터". A possible course is a button whose text includes the minutes and that it is possible. An impossible course is text whose text includes the minutes and that it is impossible. Buttons wrap. An empty list says there is no Therapist to show at that time and what to look at next. Keyboard order is the time control, expand, the possible-course buttons, then the ledger. Pressing a possible course fills the new row's 예약시각, Therapist, and course. It does not save by itself. The existing save path still accepts a course this list called impossible.
- 실제입장 is stored on the 콜. It is empty or a 10-minute step. Any other value fails validation before write. Empty is valid. The reference time is 실제입장 when present, and 예약시각 when empty. The proposed end is the reference time plus the course duration. There is no stored finish time and no field for one.
- 표시 종료 and the warning are derived by the calls service when it returns the row, the same way payment amounts are derived. The next 예약 is the soonest later call that day for the same Therapist in either assignment, excluding 노쇼 and 취소. When that 예약시각 is earlier than the proposed end, 표시 종료 is that 예약시각 and the warning names it, in the form "4:00 예약이 있습니다" for a 16:00 booking. When the next 예약 is absent, equal to the proposed end, or later, 표시 종료 is the proposed end and the warning is empty. The worked example is a 15:00 booking, 실제입장 15:20, 60 minutes: next 예약 at 16:00 gives warning "4:00 예약이 있습니다" and 표시 종료 16:00; no next 예약, or a next 예약 at 17:00, gives 표시 종료 16:20 and no warning. The yield also applies when 실제입장 is empty, so a booked course that already overruns the next 예약시각 shows the yielded end before anyone types an arrival. The next call's 예약시각, the course, and the amounts stay as saved.
- The warning is text on the row, associated with the 실제입장 cell for assistive tech. It is not a dialog, and save still proceeds. Color accompanies the words. The cell's helper text says the 예약시각 is unchanged. The ledger keyboard order gains 실제입장 after 예약시각 and before the room.
- Room status takes 표시 종료 from the call and uses it as the expected end. Live and TV render that room status. Remaining time and the existing ending-soon threshold compare against this end. They do not add the course length again. The late-guest rule lives only in the calls service.
- An expense stores a method, cash or bank. Omitted method and expenses already stored are cash. Active expenses count, as they do now. Locked months still reject expense create, update, and deactivate, including a method change. The day summary adds, for the selected service date and again for every day in the selected operating month: cash receipts, cash expenses, 현금 잔액, bank receipts, bank expenses, 계좌 잔액. The cumulative range is the whole operating month, including later days in that month that already have rows. It does not include the previous operating month and it has no opening float. A balance is that range's receipt bucket minus that range's same-method expenses. The receipt buckets are the calls already included in today's payment-method totals. Card and other stay on those totals and stay out of both balances. A 콜 still has one payment method. 순매출 remains payment total minus expense total. Balances are derived on the summary. The monthly closing snapshot does not gain them.
- A negative 현금 잔액 is shown with the word 부족 before the amount and with the danger color. A negative 계좌 잔액 is shown as a signed amount with the danger color, so the sign is in the text. The expense method control has a visible label, defaults to cash, is busy while saving, and shows the failure reason under the field.
- 고객 link, 실제입장, and expense method ride the existing call and expense audit events. Creating or correcting a 고객 writes an audit event into the audit log the administrator already reads. There is no new audit screen.
- Korean and Vietnamese strings are added together. The locale cookie continues to choose them. Visual tokens stay the current surface, danger, readonly, brand, and square radius. Numbers stay tabular. New controls are at least 44px. Existing ledger cell height stays. Status and warnings are words, with no emoji. Motion is color and opacity only, 150–250ms, and instant under reduced motion.
- The calls service remains the only place that calculates payment, commission, 표시 종료, availability, and balances. Screens render those values.

These decisions follow ADR 0001 (a late guest yields to the next 예약시각), ADR 0002 (till balances are not 순매출), and ADR 0003 (a 고객 is separate from 고객/메모).

## Testing Decisions

A good test asserts what the calls service returns: search rows, availability rows, the call's 실제입장, 표시 종료, and warning, the expense method, and the day and month balances. It does not assert private helpers, query shape, or component structure.

The seam is the calls service, one place. The late-guest examples, the occupancy examples, and the balance examples are expectations on that service's results.

- 15:20 arrival, 60 minutes, next 예약시각 16:00: the warning names 16:00 and 표시 종료 is 16:00. The next call's 예약시각 is still 16:00. Course and amounts are unchanged.
- The same arrival with no next 예약, or with the next 예약 at 17:00: 표시 종료 is 16:20 and the warning is empty.
- A proposed end that only touches the next 예약시각 has an empty warning and 표시 종료 equal to the proposed end.
- An empty 실제입장 uses 예약시각 as the reference, and still yields when that proposed end passes the next 예약시각.
- A 14:00 call of 90 minutes makes 15:00 unavailable for that Therapist, and the free-from time is 15:30.
- A free Therapist at 15:00 whose next 예약 is 16:00 can take the 60-minute course and cannot take the 90-minute or 120-minute courses.
- A call that ends at 15:00 does not block a 15:00 start.
- 노쇼 and 취소 do not occupy and are not the next 예약.
- Both Therapist assignments occupy.
- 실제입장 does not change the availability interval.
- A course that requires a second Therapist is possible only when this Therapist and another active Therapist are both free for the whole duration.
- Cash receipts minus cash expenses, and bank receipts minus bank expenses, for the day and for the whole operating month. Card and other stay out. An expense with no method counts as cash. 순매출 is unchanged. A previous operating month does not enter the cumulative balance.
- Search returns one 콜 per row across months, 방문완료 first, and still returns 예약, 노쇼, and 취소. A shared phone does not attach a 고객. Locked months are readable. Call save and expense mutation on a locked month still fail with the existing lock error.

Room status is a consumer check, not a second copy of the rule. Its expected end equals the 표시 종료 the calls service already returned for that 콜. The 15:20 and 16:00 cases are not restated there. Live and TV are covered by rendering that same room status.

Presentation checks stay on the tests that already render the ledger. They assert that the screen shows the service's words and amounts: the shortage word when 현금 잔액 is negative, the empty search and empty availability copy, the warning text, and keyboard order through 실제입장, the time control, and the possible-course buttons. They do not recompute occupancy, yield, or balances.

Prior art is the calls service tests that already cover payment buckets, expenses, locked months, and completed-call totals. Those tests call the service and assert the returned summary and rows. Room status tests already assert the expected end. The summary strip, the ledger keyboard tests, and the call-ledger end-to-end stories are the prior art for rendering a service value, including Vietnamese and Korean labels.

## Out of Scope

- Copying the sample console. That leaves out the demo reset, a Therapist mobile app, contact blocking, a server hard block on overlapping bookings, a 15-minute grid, a booking drawer, and a separate operations console.
- Nickname, platform account, country-code parsing, and a shared-number flag. A shared phone is just two 고객 until someone chooses.
- A cleanup buffer. Back-to-back bookings stay possible.
- Opening till, split payment on one 콜, and till balances inside the monthly closing snapshot.
- Changing the 순매출 formula or the contents of snapshots already confirmed.
- Renaming Therapist on settlement, attendance, or TV.
- 고객 search, 고객/메모 editing, and expense entry on rooms, live, and TV.
- 귀케어 and 운영팀 in the availability list.
- Auto-completing a 콜 because its expected end has passed.
- A hand-entered finish time.
- Blocking save because the availability list called a course impossible, or because the yield warning is showing.
- Deleting, merging, or importing 고객.
- A new top-level menu, a new typeface, a new palette, a dark theme, a heatmap, and scroll animation.

## Further Notes

The behavior was decided on 2026-10-13. The sample site was read for its judgments only. ADR 0001, ADR 0002, and ADR 0003 are the source of the yield rule, the till rule, and the 고객 rule. This spec follows them.

The test seam was confirmed: the calls service is the only place the rules are specified. Room, live, and TV render 표시 종료. Ledger presentation tests show the service's words and amounts.

Triage labels for this repo are the five default role names. This spec is `ready-for-agent`.
