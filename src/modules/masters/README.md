# Masters Module

Owns configuration and master data.

## Includes

- operating months
- rooms
- employees
- courses
- course display names
- therapist course rates
- operations-team incentive rules
- status, payment, discount, confirmation, and attendance codes
- time slots

## Upstream

None. This module is the source of reference data for other modules.

## Downstream

- `calls`
- `rooms`
- `settlements`
- `closing`
- `dashboard`

## Operating Month Contract

운영월은 모든 콜 입력, 정산, 대시보드, 월마감이 공유하는 월 기준 마스터 데이터다.

- `createOperatingMonth()` creates a single `YYYY-MM` operating month with calculated ISO date range and default status `작성중`.
- `listOperatingMonths()` returns dense management-list DTOs with `monthKey`, `startDate`, `endDate`, `status`, `createdAt`, and `updatedAt`.
- `changeOperatingMonthStatus()` supports only `작성중` to `검토중` in Story 1.4. `마감확정`, `잠금`, and reopen transitions belong to monthly-close stories.
- `getOperatingMonthDateRange()` returns `{ monthKey, startDate, endDate, status }` so `calls`, `settlements`, `dashboard`, and `closing` can aggregate by operating-month dates instead of Excel row ranges.
- Successful creates record `operating_month.created`; status changes record `operating_month.status_changed`. Audit snapshots use ISO date strings, not `Date` objects.

## Room Contract

객실은 콜 원장, 객실 현황, TV 현황판이 공유하는 기준 마스터 데이터다.

- `ensureDefaultRooms()` prepares the default 11 rooms from `101 호실` through `402 호실` with stable IDs, spaced sort orders, and preserved hidden-list references from `1번방` through `11번방`.
- `listRooms()` returns active and inactive rooms for administrator management; `listActiveRooms()` returns only active rooms for downstream selection lists.
- `updateRoomDisplayName()` changes the operational display label while preserving the stable `Room.id` and `migrationReferenceName`.
- `updateRoomSortOrder()` changes TV/room-card order and rejects duplicate sort order values.
- `deactivateRoom()` sets `isActive=false`; normal room master flows do not physically remove room rows.
- Successful room writes record `room.created`, `room.display_name_changed`, `room.sort_order_changed`, or `room.deactivated` with plain JSON snapshots.

## Code And Time Slot Contract

코드와 시간 슬롯은 콜 원장, 정산, 객실 현황이 공유하는 드롭다운 기준 데이터다.

- `ensureDefaultCodeItems()` prepares `SERVICE_STATUS`, `PAYMENT_METHOD`, `DISCOUNT_TYPE`, `ATTENDANCE_STATUS`, and `CONFIRMATION` defaults. Empty discount/confirmation choices are represented by downstream `null`, not blank code rows.
- `ensureDefaultTimeSlots()` prepares exactly 29 input slots from `11:00` through `01:00`; workbook-only later values such as `01:30`, `02:00`, and `02:30` are not seeded for Story 1.6.
- `listCodeItems()` and `listTimeSlots()` return active and inactive rows for administrator management; `listActiveCodeItems()` and `listActiveTimeSlots()` return active-only dropdown DTOs for downstream modules.
- `CodeItem.codeType + code` and `TimeSlot.id`/`CodeItem.id` are stable references. `displayName` and `value` are operational labels that can change.
- `deactivateCodeItem()` and `deactivateTimeSlot()` set `isActive=false`; normal code/time-slot master flows do not physically remove rows.
- Successful writes record `code_item.created`, `code_item.display_name_changed`, `code_item.sort_order_changed`, `code_item.deactivated`, `time_slot.created`, `time_slot.value_changed`, `time_slot.sort_order_changed`, or `time_slot.deactivated` with plain JSON snapshots.

## Employee And Account Contract

직원 마스터는 콜 원장, 정산, 월마감이 공유할 직원 고유 ID와 표시 정보를 소유한다. 로그인 계정은 `UserAccount`가 별도로 소유하고 필요할 때만 직원에 1:1로 연결한다.

- `ensureDefaultEmployees()` prepares the default 59 business employees: 5 operations staff, 4 earcare staff, and 50 therapists. It keys idempotency by stable `staffCode`, not mutable display names.
- `listEmployees()` returns active and inactive rows for administrator management; `listActiveEmployees()` returns active-only employee DTOs for call/settlement selection.
- `createEmployee()`, `updateEmployeeProfile()`, `updateEmployeeSortOrder()`, and `deactivateEmployee()` mutate employees only by stable `Employee.id`.
- `deactivateEmployee()` sets `isActive=false`; normal employee master flows do not physically remove employee rows because historical calls and settlements keep the employee reference.
- `linkUserAccountToEmployee()` connects or updates a `UserAccount.employeeId` link and reuses account-service password hashing. It does not merge employment status with account active/lock state.
- Successful employee writes record `employee.created`, `employee.profile_changed`, `employee.sort_order_changed`, or `employee.deactivated`; account-link writes record `user_account.linked_to_employee` or `user_account.role_changed` with plain JSON snapshots.

## Course And Policy Contract

코스/수당/인센 정책은 콜 계산, 정산, 월마감이 공유할 코스 고유 ID와 적용월 정책 이력을 소유한다.

- `Course` owns stable identity: `Course.id`, stable code `A` through `E`, and `isActive`. Display values and prices live in `CoursePolicy`.
- `ensureDefaultCoursesAndPolicies()` prepares default A/B/C/D/E courses, current course policies, therapist course rates, and operations daily/monthly incentive rules idempotently.
- Default course policies preserve workbook values: A 60 minutes 1,500,000 VND, B 90 minutes 1,800,000 VND, C 90 minutes 2,000,000 VND, D 90 minutes 3,200,000 VND, E 120 minutes 3,000,000 VND. D has `requiresSecondTherapist=true`; A/B/C/E are false.
- `TherapistCourseRate` seeds by stable `Employee.staffCode` from `THR-001` through `THR-050`, then stores `Employee.id` and `Course.id`. `THR-001` through `THR-004` get A 700,000, B 900,000, C 900,000, D/E 0; `THR-005` through `THR-050` get explicit 0 values for A through E.
- Operations daily incentive defaults are 30/40/50 calls with 50,000/100,000/200,000 VND personal amounts.
- Operations monthly incentive defaults are 1000/1100/1200/1300/1400/1500 calls with 3,000,000/5,000,000/8,000,000/12,000,000/18,000,000/25,000,000 VND total amounts and lead/counter/waiter shares 0.30/0.35/0.35.
- `getCoursePolicyForMonth()`, `getTherapistCourseRateForMonth()`, `listOpsDailyIncentiveRulesForMonth()`, and `listOpsMonthlyIncentiveRulesForMonth()` return active policies for a `YYYY-MM` month. Missing course or rate policies return domain errors instead of silently assuming 0.
- Active policy ranges cannot overlap for the same course, therapist/course, or incentive threshold. Existing rows are ended with `effectiveToMonth` or made inactive; normal flows do not physically delete policy rows.
- Policy and course mutations write audit events with plain JSON snapshots: `course.created`, `course.policy_changed`, `course.deactivated`, `therapist_course_rate.created`, `therapist_course_rate.changed`, `therapist_course_rate.ended`, `ops_daily_incentive_rule.created`, `ops_daily_incentive_rule.changed`, `ops_monthly_incentive_rule.created`, and `ops_monthly_incentive_rule.changed`.
- Downstream calls and settlement stories must use `Course.id`, `Employee.id`, and effective-month policy services. They must not infer D-course behavior from Korean course names or TV labels.

## Does Not Own

- service-call transactions
- daily settlement results
- monthly close snapshots
