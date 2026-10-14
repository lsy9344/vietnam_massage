# 워크플로 중심 내비게이션 1차 자료 조사

조사일: 2026-10-14. 모든 "접속일" 표기는 이 날짜다.

목적: 사이드바+상단바를 배제하고, "전화 예약 → 실제입장/객실 확인 → 완료/수납 → 지급 확인 → 월 마감"이라는 실제 업무 흐름을 축으로 내비게이션을 구성하기 위한 근거 수집. 5개 역할(administrator, counter, settlement_manager, waiter, read_only_viewer) × 4개 기기군(PC, 태블릿, 폰, 벽걸이 TV)에 적용할 모델을 고르기 전 단계 자료다. 이 문서는 최종 설계를 고르지 않는다.

방법: 각 디자인 시스템의 공식 문서를 직접 열람했다. 일부 사이트(m3.material.io, fluent2.microsoft.design, lightningdesignsystem.com)는 클라이언트 렌더링 SPA라서 단순 fetch로는 정적 뼈대만 나오는 경우가 있었다. 그런 경우 본문에 "확보 못함"이라고 명시했고, 대안으로 같은 회사의 다른 1차 문서(예: Salesforce는 developer.salesforce.com)를 썼다. Nielsen Norman Group(NNG) 인용은 모두 "2차 자료"로 표시했다. 인용되지 않은 수치나 주장은 이 문서에 넣지 않았다 — 없으면 "공백"이라고 적었다(문서 끝 목록 참고).

---

## 1. 주요 디자인 시스템의 내비게이션 모델

### 1.1 Material Design 3 (Google)

**Navigation bar** — "Navigation bars let people switch between UI views on smaller devices. They're a common navigation component on handheld screens." 화면 하단에 위치한다.
- 목적지는 **3~5개**로 규정돼 있다. 3개 미만이면 "Don't use a navigation bar for fewer than three destinations. Instead, use tabs."라며 금지한다.
- 5개 초과면 "elements may collide and there likely won't be enough space for translated text"라며 tabs나 modal expanded navigation rail로 대체하라고 한다.
- 데스크톱용이 아니라고 명시한다("not intended for desktop"). ([Navigation bar guidelines](https://m3.material.io/components/navigation-bar/guidelines))

**Navigation rail**
- 접힌(collapsed) 변형은 화면 선행 모서리에 고정되고 **3~7개** 항목을 담으며 "should not be hidden."
- compact 창폭에서는 쓰지 말라고 한다("Don't use a standard navigation rail for compact layouts due to space constraints. Use a navigation bar instead."). medium~extra-large(태블릿·데스크톱)에서 쓴다.
- 펼친(expanded) 변형은 standard(본문 옆에 상시 배치, 넓은 창에 적합)와 modal(메뉴 아이콘으로 열리는 오버레이, "Information dense layouts where space is limited" 또는 "Products with many navigation items"에 적합) 두 가지다.
- **"Never use the navigation rail and navigation bar simultaneously."** ([Navigation rail guidelines](https://m3.material.io/components/navigation-rail/guidelines))

**Navigation drawer**
- 문서 맨 위에 **폐기 경고**가 있다: "The navigation drawer is no longer recommended in the Material 3 Expressive update... use an expanded navigation rail, which has mostly the same functionality... and adapts better across breakpoints."
- 구버전 기준 권장 조건은 top-level 목적지 5개 이상, 계층 2단 이상, 서로 무관한 목적지 간 빠른 전환, 큰 화면에서 rail/bar 대체 등이었다.
- 브레이크포인트 매핑을 명시적으로 표로 준다: **"Navigation bars for compact breakpoints / Navigation rails for medium and expanded breakpoints / Standard navigation drawers for expanded, large and extra-large breakpoints."**
- 웹에서는 320 CSS px 미만이면 drawer를 nav bar로 바꾸라는 접근성 각주도 있다. ([Navigation drawer guidelines](https://m3.material.io/components/navigation-drawer/guidelines))

**Tabs** — "Tabs organize groups of related content that are at the same level of hierarchy" — 뒤집어 말해 **"Use tabs to group related content, not sequential content"**, 즉 순서대로 읽어야 하는 콘텐츠에는 쓰지 말라는 것. Primary tabs(상단, 앱바 아래, 한 화면에 한 세트만)와 Secondary tabs(그 아래 추가 구분, 기능은 동일하나 인디케이터가 단순함, "should always be placed below primary tabs")로 나뉜다. ([Tabs guidelines](https://m3.material.io/components/tabs/guidelines))

**Adaptive design / canonical layouts** — 워크플로 중심 설계에 가장 직접적인 참고다. 공식 세 가지 canonical layout은 feed, list-detail, supporting pane이다.
- list-detail: "divides the window into two side-by-side panes." 브레이크포인트별 pane 수가 표로 나온다 — compact(0–599): 1 pane(목록⇄상세 전환), medium(600–839): 1(권장) 또는 2 pane, expanded(840+)·large·extra-large: 2 pane 고정. RTL에서는 좌우 반전. ([List-detail](https://m3.material.io/foundations/layout/canonical-examples/list-detail))
- supporting pane: "Primary display area: Contains the main content and occupies the majority of the window (typically about two-thirds). Secondary display area: Presents supporting content..." compact/medium에서는 보조 패널이 주 영역 **아래**에, expanded에서는 주 영역의 **선행 또는 후행 측면**에 온다. ([Supporting pane](https://m3.material.io/foundations/layout/canonical-examples/supporting-pane))
- 이 세 레이아웃을 1~3절의 내비게이션 컴포넌트 선택과 합쳐 보면: compact → navigation bar(또는 overflow 시 modal rail/drawer), medium → navigation bar 또는 rail(가로·세로 공간 trade-off 판단), expanded 이상 → rail(또는 모달 확장 rail), 바와 동시 사용 금지라는 일관된 규칙이 나온다.

**데이터 테이블 공백**
- m3.material.io에는 현재 "Data tables" 컴포넌트 전용 가이드 페이지가 없다(`/components/data-tables/guidelines` 404, 컴포넌트 목록에도 없음; M2에는 있었다).
- 대신 밀도(density) 기초 문서가 "High density layouts are useful when people need to scan, view, or compare a lot of information, such as in a data table"라며 News/금융/대시보드를 예로 들고, 기본값은 48×48dp 아래로 줄이지 말라고 한다("Don't scale layouts below 48x48dp by default").
- 선택(selection) 패턴 문서는 "주 활동이 선택"이면 체크박스 상시 노출, "보조 활동"이면 hover 시에만 노출하라고 구분한다. ([Density](https://m3.material.io/foundations/layout/grids-spacing/density), [Selection](https://m3.material.io/foundations/interaction/selection))

### 1.2 Apple Human Interface Guidelines

**Tab bars**
- "A tab bar lets people navigate between top-level sections of your app... They also let people quickly switch between sections of the view while preserving the current navigation state within each section."
- **용도 경계를 스스로 명시한다**: "Use a tab bar to support navigation, not to provide actions... If you need to provide controls that act on elements in the current view, use a toolbar instead."
- 항상 보이게 유지하라고 한다("If you hide the tab bar, people can forget which area of the app they're in").
- 하드 상한 수치는 명시돼 있지 않다. "Use the appropriate number of tabs required to help people navigate your app"라고만 하고, 다만 "it's generally easier to navigate among fewer tabs"라며 적을수록 낫다는 방향만 제시한다(※ 이전 버전 조사 초안에 있던 "iPadOS는 기본 탭 목록을 5개 이하로"라는 구체적 인용은 재검증 결과 현재 페이지 본문에서 확인되지 않아 삭제함 — 추측 금지 원칙에 따름).
- 넘치는 탭은 "More" 탭으로 몰리는데 "The More tab makes it harder for people to reach and notice content... so limit scenarios"라며 가급적 피하라고 한다.
- 플랫폼별: iOS는 하단 플로팅(Liquid Glass 배경). iPadOS는 상단 근처에 배치되며 버튼으로 sidebar로 전환 가능("Prefer a tab bar for navigation... If your app is more complex, you can provide the option to convert the tab bar to a sidebar"). tvOS는 치수가 고정(**높이 68pt, 화면 상단에서 46pt**)이고 split view가 있는 화면에서는 스크롤돼도 상단에 고정(pinned)되며 "focus always returns to the tab bar at the top of the page when people press Menu on the remote." watchOS는 미지원. ([Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars))

**Sidebars**
- "A sidebar appears on the leading side of a view and lets people navigate between areas of your app or top-level collections of content, like folders and playlists."
- 공간 요구를 스스로 인정한다: **"A sidebar requires a large amount of vertical and horizontal space. When space is limited... a more compact control such as a tab bar may provide a better navigation experience."**
- 계층은 2단까지만 권장한다("show no more than two levels of hierarchy in a sidebar"), 그 이상이면 split view(목록+상세 사이에 content list를 추가)를 권장한다.
- 숨기기는 허용하되 기본값으로 숨기지는 말라고 한다("Avoid hiding the sidebar by default to ensure that it remains discoverable").
- tvOS·watchOS에는 별도 섹션이 아예 없다(watchOS는 미지원, tvOS는 "No additional considerations"로 일반 규칙만 적용 — 즉 tvOS의 실질적 1차 내비게이션 수단은 sidebar가 아니라 tab bar/split view라는 뜻). ([Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars))

**Split views**
- "A split view manages the presentation of multiple adjacent panes of content... Typically, you use a split view to show multiple levels of your app's hierarchy at once and support navigation between them... selecting an item in the view's primary pane displays the item's contents in the secondary pane." 즉 애플식 list-detail이다.
- "persistently highlight the current selection in each pane that leads to the detail view"가 모범 사례.
- iOS는 compact(세로 아이폰)보다 regular 환경을 권장, iPadOS는 2~3단 수직 pane, macOS는 패널 배치(수직/수평/둘 다)와 분할선 두께까지 규정한다.
- **tvOS에서는 "필터" 용도로 설명된다**: "a split view can work well to help people filter content. When people choose a filter category in the primary pane, your app can display the results in the secondary pane." 기본 비율은 주 pane 1/3 : 보조 pane 2/3(또는 반반 선택 가능)이고, 제목은 분할뷰 전체에 하나만 둔다("Display a single title above a split view... they don't need titles that describe what each pane contains").
- visionOS는 새 창 대신 split view를 우선하라고 한다("prefer a split view instead of a new window"). ([Split views](https://developer.apple.com/design/human-interface-guidelines/split-views))

**Toolbars**
- "A toolbar provides convenient access to frequently used commands, controls, navigation, and search." 세 가지 내용으로 구성된다: 현재 뷰 제목, 내비게이션 컨트롤(뒤로가기/검색), 액션(버튼·메뉴).
- **tab bar와의 경계를 스스로 명시한다**: "In contrast to a toolbar, a tab bar is specifically for navigating between areas of an app" — "영역 간 이동"과 "현재 화면에 대한 동작"을 컴포넌트 차원에서 분리하는 것이 애플의 공식 입장이다.
- 배치 구조: 선행 모서리(뒤로가기/사이드바 토글 + 제목, 커스터마이즈 불가), 중앙(커스터마이즈 가능한 공용 컨트롤), 후행 모서리(상시 노출되는 중요 항목 + 프라이머리 액션, "Items on the trailing edge remain visible at all window sizes").
- 그룹 수는 "aim for a maximum of three"로 제한. 프라이머리 액션은 `.prominent` 스타일로 단 하나만, 후행 측에 둔다.
- 과밀 방지: "The system automatically adds an overflow menu in macOS or iPadOS when items no longer fit. Don't add an overflow menu manually."
- tvOS는 "No additional considerations"로 일반 규칙이 그대로 적용된다. iPadOS는 toolbar와 tab bar를 같은 가로 공간에 공존시킬 수 있다고 명시한다. ([Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars))

### 1.3 IBM Carbon — UI Shell

UI Shell은 "the foundation for navigating and orienting your user to the UI"이며 **헤더(header) / 좌측 패널(left panel) / 우측 패널(right panel)** 세 조각으로 구성된다. 헤더는 전역(제품을 넘나드는) 내비게이션과 유틸리티가 상시 위치하는 자리이고 UI 이름을 표시한다. 좌측 패널은 "제품 자체의 내비게이션"을 담고, 우측 패널은 헤더 아이콘에 연결된 시스템 수준 액션/콘텐츠다.

- **헤더만 vs 헤더+좌측 패널**: "can be used on its own for simple products." "Header base"는 단일 페이지 UI용 상시 타이틀, "Header with navigation"은 간단한 링크·드롭다운을 포함한다. 좌측 패널(side nav)은 **"a deeper level of navigation"**이 필요할 때만 추가하며, 햄버거 메뉴는 접이식 좌측 내비게이션이 있을 때만 나타난다.
- **좌측 패널 사용 기준(수치 명시)**: "when there are more than five secondary navigation items" 또는 사용자가 "expected to switch between secondary items frequently"일 때 추가하라고 좌측 패널 전용 문서가 명시한다. 반대로 **3단 이상 계층이 필요하거나** 서브메뉴 아래 별도 콘텐츠를 더 보여줘야 하는 경우(그럴 땐 페이지 내 탭을 쓰라고 안내)는 쓰지 말라고 한다. 계층은 **2단까지만** 지원하며, 링크와 서브메뉴를 같은 좌측 패널에 섞어 쓸 수 있다. ([UI Shell left panel usage](https://carbondesignsystem.com/components/UI-shell-left-panel/usage/))
- 상단 항목 권장 개수는 문서에 명시돼 있지 않다(확인했으나 없음 — 추측 금지). ([UI Shell header usage](https://carbondesignsystem.com/components/UI-shell-header/usage/))
- **Data table**: "Organize and display data efficiently. Column headers can sort data, rows can expand to reveal more information, and single or batch actions can be taken on rows."
  - **밀도**: 행 높이 5단계 — extra small 24px(고밀도용), small 32px, medium 40px(기본), large 48px, extra large 64px(두 줄 콘텐츠용). 헤더 행 높이는 본문 행과 맞추고, 툴바·페이지네이션 높이도 행 높이에 맞추라는 규칙이 있다("Pair a tall toolbar with large or extra large rows, and a small toolbar with small or extra small rows"). 지브라 스트라이프 옵션으로 가로 스캔을 돕는다.
  - **행 액션**: 3개 미만이면 인라인 아이콘 버튼으로 바로 노출, 그 이상이면 overflow 메뉴(기본 상시 노출, `overflowMenuOnHover`로 hover/focus 시에만 노출 가능하되 터치 기기에서는 이 옵션이 있어도 항상 보임).
  - **일괄 액션**: 항목 선택 시 상단에 batch action bar가 뜨고, 그동안 단일 행 액션·overflow는 비활성화되며, 취소 또는 전체 선택 해제로 빠져나온다.
  - **툴바 액션**은 설정·복합 필터·내보내기 같은 전역 액션용으로 최대 5개 권장, 넘치면 overflow/콤보 버튼으로.
  - **스티키 헤더와 인라인 편집은 이 문서에 언급이 없다** — 추측하지 않는다. ([Data table usage](https://carbondesignsystem.com/components/data-table/usage/))

### 1.4 Microsoft Fluent 2

fluent2.microsoft.design은 클라이언트 렌더링 React 앱이라, 단순 fetch로는 `/components`, `/components/navigation` 페이지가 정적 뼈대(스킵 링크, 헤더 로고, 검색, 사내 로그인, 바닥글)만 돌려준다. 텍스트 추출 프록시를 거쳐 재시도한 결과 `/components/web/react/core/nav/usage` 페이지는 본문을 확보했다(아래). side nav/pivot 등 다른 내비게이션 계열 컴포넌트의 가이드 본문은 이 세션에서 끝내 확보하지 못했다 — 없다고 단정하는 것이 아니라, 접근 가능한 도구로 확인하지 못했다는 뜻이다.

**Nav 컴포넌트** — "a high-level wayfinding component that lists links to the main sections of an app or site"로 정의되며, 상시 노출하되 공간을 아끼려면 최소화할 수 있다.
- 계층은 **최대 2단**("Nav only supports one level of nesting")이고, 더 깊은 계층이 필요하면 별도의 **Tree** 컴포넌트를 쓰라고 명시한다. 1단 항목만 있는 단순(simple) nav와, 아코디언으로 묶는 카테고리를 포함한 복합(complex) nav로 나뉜다.
- 기본 폭은 인라인 드로어 기준 **260px**이며 화면 폭이 **640px 이하**로 좁아지면 오버레이 드로어로 전환된다. 바닥글(footer) 슬롯이 있지만 "can obscure nav content"라는 이유로 사용을 권장하지 않는다.
- 보조 액션(secondary action)은 hover/focus로만 시각 노출해도 DOM에는 항상 남겨 두어야 하고, hover로만 노출한다면 컨텍스트 메뉴로도 접근 가능해야 한다는 접근성 조건이 붙는다. ([Nav usage](https://fluent2.microsoft.design/components/web/react/core/nav/usage))

그 밖에 확보한 것은 레이아웃 기초 문서다.
- **브레이크포인트**: small 320–479 / medium 480–639 / large 640–1023 / x-large 1024–1365 / xx-large 1366–1919 / xxx-large 1920+.
- Responsive(미디어쿼리 기반 유동 레이아웃 하나)와 Adaptive(고정 레이아웃 여러 개 중 선택)를 구분하고 "둘을 섞는 것이 맞는 선택일 때도 있다"고 한다.
- **Responsive 기법 5가지**가 명시돼 있고, 그중 "Re-architect"가 워크플로 설계에 참고할 만하다: **"On wide windows, a list can sit beside its details; on small screens, focus stays on key information and actions."** — M3의 list-detail/supporting pane과 같은 발상을 Fluent는 "콘텐츠를 접거나 가지치기한다(collapse or fork content)"는 용어로 설명한다.
- 최소 터치 타깃은 iOS/Web 44×44, Android 48×48(각 플랫폼 기준을 재인용). ([Layout](https://fluent2.microsoft.design/layout))

### 1.5 Shopify Polaris

구버전 `polaris.shopify.com`의 컴포넌트 개별 페이지(`/components/navigation`, `/components/index-table` 등)는 전부 `https://shopify.dev/docs/api/polaris` 허브로 301 리다이렉트된다 — Polaris 문서가 shopify.dev로 통합 이전했다는 뜻이고, 이 문서의 인용은 그 이전된 위치를 쓴다.

- **현행 앱 내비게이션(`s-app-nav`)**: "sets up navigation items for your app in the Shopify admin." 데스크톱은 좌측 사이드바, Shopify 모바일 앱에서는 타이틀바 드롭다운으로 렌더링된다(즉 "사이드바처럼 보이는 자리"는 앱이 아니라 Shopify 관리자 호스트 쪽이 제공·결정한다).
  - **1단만 지원 — "You can't nest navigation items inside other navigation items."**
  - 짧은 메뉴("Keep the menu short, since long lists are harder to scan"), 1~2단어 명사 라벨, 자주 쓰는 항목을 앞에, 라벨은 목적지 제목과 일치시키라는 규칙이 있다.
  - 홈 경로가 `/`가 아니면 `rel="home"` 링크로 override하되 그 링크는 메뉴에 렌더링되지 않는다. 앱 루트 근처에 마운트해 두고 라우트마다 다시 렌더링하지 말라는 주의도 있다. ([App nav](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-nav))
- **Contextual save bar**(컴포넌트 자체는 폐기, App Bridge API로 이전): 폼에 저장되지 않은 변경이 생기면 뜨고, 새 객체(제품·고객 등) 생성 중에도 뜬다.
  - **한 화면에 동시에 편집 가능한 폼이 여러 개 있는 상태는 피하라**고 명시.
  - 문구는 기존 편집 시 "Unsaved changes", 생성 중엔 "Unsaved {resource name}", 액션 라벨은 "Save changes" 대신 짧은 동사 "Save"/"Discard"를 쓰라고 한다. ([Contextual save bar](https://polaris.shopify.com/components/contextual-save-bar), 2026-10-14 기준 접속 가능, deprecated 표시)
- **Table (index-table 후신)**: "Table displays data clearly in rows and columns, helping users view, analyze, and compare structured information."
  - 화면 크기에 따라 list/table 레이아웃을 전환한다. 구조는 헤더 행(`s-table-header-row`) 다음 body, 필터 슬롯(`filters`)은 헤더 위에 검색창 등을 얹는 용도다. **50~100행 넘으면 페이지네이션 권장.**
  - 행의 기본(primary) 동작은 `clickDelegate`로 지정하되 **"It adds no keyboard or screen reader support, so the target must also be in the table"**라고 접근성 책임을 명시한다.
  - **스티키 헤더는 지원하지 않는다고 명시**("The component doesn't support sticky headers that remain visible during scrolling.")하며 대신 페이지네이션으로 헤더가 안 보일 만큼 길어지지 않게 하라고 한다.
  - 밀도·일괄 액션 가이드는 이 공식 페이지에 없다(일괄 액션이 web component 버전에 없다는 보고가 개발자 커뮤니티 포럼에 있으나 이는 2차 정황이며 공식 스펙은 아니다). ([Table](https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/table))

### 1.6 Salesforce Lightning Design System — 콘솔/워크스페이스 탭

전화 예약을 다수 동시에 다루는 counter 역할과 구조적으로 가장 비슷한 선례다. `lightningdesignsystem.com` 자체는("Lightning Design System 2"로 재구축 중인) 클라이언트 렌더링 사이트라 이 세션에서는 정적 뼈대만 나왔다. 대신 Salesforce의 1차 공식 문서인 `developer.salesforce.com`에서 같은 동작을 확인했다.

- **콘솔 내비게이션의 목적**: **"In Lightning console apps, records open as workspace tabs and their related records open as subtabs."** — 레코드는 워크스페이스 탭으로 열리고, 연관 레코드는 서브탭으로 열린다(목록 뷰를 고정해 둔 채 여러 레코드를 병렬로 다루는 것이 콘솔 앱의 핵심 전제). 이는 "예약 목록을 띄워 둔 채 콜 여러 건을 동시에 열어 처리"하는 counter의 실제 작업과 구조적으로 거의 동일하다.
- LWC용 API는 `lightning/platformWorkspaceApi`(API 59.0 이상)이며 `closeTab`/`focusTab`/`setTabHighlighted`/`setTabLabel`/`refreshTab`/`openSubtab`/`getAllTabInfo` 등 탭·서브탭을 코드로 제어하는 메서드를 제공한다.
- 어떤 객체가 어떤 객체의 서브탭으로 열릴지는 Lightning App Builder의 **"Navigation Rules"**에서 미리 정의한다(즉 탭↔서브탭 관계는 애드혹이 아니라 선언적으로 설정). ([Workspace API](https://developer.salesforce.com/docs/component-library/bundle/lightning:workspaceAPI/documentation), [Platform Workspace API](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-platform-workspace-api.html))

### 1.7 Atlassian Design System

- 구 `@atlassian/navigation-system`은 폐기(deprecated)됐고, 공개용 신규 패키지 `@atlaskit/navigation-system`이 **"the latest navigation system for Atlassian apps"**다. 구성 요소는 세 가지뿐: Layout(영역 정의), Side navigation menus(액션·링크의 일관된 모양/동작), Top navigation elements("predictable places for common features"). 이 README은 각 조각의 "쓰임"만 설명하고 "언제 어떤 것을 쓰나"는 설명하지 않는다 — atlassian.design의 상세 문서를 보라고 넘긴다. ([Navigation System README](https://cdn.jsdelivr.net/npm/@atlaskit/navigation-system@10.6.0/README.md))
- 구버전 **Side navigation**(중첩 뷰를 지원하는 구성 가능한 사이드 내비게이션 컴포넌트, 역시 deprecated)의 구조가 더 상세하다:
  - 컨테이너(`SideNavigation`)는 부모 높이/너비를 채우며 **"The minimum width of the container is `240px`."**
  - 헤더/바닥글(`NavigationHeader`/`NavigationFooter`), 콘텐츠 컨테이너(`NavigationContent`, 중첩 뷰가 필요하면 `NestableNavigationContent`), `Section`(그룹, `title`이 있으면 스크린리더가 자동으로 그룹으로 인식).
  - 항목 구분 기준: 동작이면 `ButtonItem`, 네이티브 브라우저 내비게이션이면 `LinkItem`, 커스텀 라우터면 `CustomItem`, 드릴다운이면 `NestingItem`(진입)/`GoBackItem`(복귀). 로딩 중에는 스켈레톤 아이템으로 체감 로딩시간을 줄이라고 한다. ([Side navigation](https://atlassian.design/components/side-navigation/examples))
- 신규 **Top navigation**은 Early Access(사내 전용)라 본문 가이드는 확보하지 못했다.
- 항목 개수 권장치나 "side nav vs top nav를 언제 쓰나"에 대한 공식 서술은 찾지 못했다. Atlassian 개발자 커뮤니티 포럼에서도 같은 질문에 Atlassian 직원이 "product 섹션에 아직 내비게이션 가이드라인이 없다"고 답했다(2차 정황 증거, 스펙 아님). 유일하게 확인한 실마리는 Tabs 문서를 인용한 한 줄이다: **"For navigating to different pages or areas with different content, use horizontal navigation guidelines instead."** ([Navigation guidelines thread](https://community.developer.atlassian.com/t/navigation-guidelines/1261))

### 1.8 GOV.UK Design System

가장 "업무 흐름 중심" 사고에 가까운 선례들이다.

- **Service navigation**: "The Service navigation helps users understand that they're using your service and lets them move around it. Together with the GOV.UK header... it shows that GOV.UK works as one website." 서비스 이름만 보여줄 수도("Service name only"), 내비게이션 링크 목록을 덧붙일 수도 있다("Service name and navigation links", 현재 페이지는 active로 표시). 커스텀 콘텐츠를 넣는 4개 슬롯(`start`/`end`/`navigationStart`/`navigationEnd`)이 있다. ([Service navigation](https://design-system.service.gov.uk/components/service-navigation/))
- **"Help users to navigate a service" 패턴**이 언제 내비게이션 링크를 보여줄지를 규정한다.
  - 서비스가 **①반복 사용되고 ②여러 과업을 포함하며 ③과업 간 뚜렷한 순서가 없을 때**는 내비게이션을 보여준다("suits services that... lack a clear end-to-end journey").
  - 반대로 **"a clear end-to-end journey"**가 있으면 내비게이션 없이 Task list를 쓰라고 명시한다.
  - 내비게이션은 사이트맵이 아니다: **"Navigation is not a site map and does not need to list every part of your service."** 링크는 "the most important top-level sections"로 한정하라고 한다. ([Navigate a service](https://design-system.service.gov.uk/patterns/navigate-a-service/))
- **Task list → 현재 명칭 "Complete multiple tasks"**(구 URL `patterns/task-list-pages`는 410 Gone, 개명·이전됨): 긴 트랜잭션에서 ①어떤 과업들이 있는지 ②어떤 순서로 하는지 ③각 과업을 언제 끝냈는지를 사용자가 이해하도록 돕는다.
  - **적용 조건**: "Only for longer transactions with several tasks that users may need to finish over more than one session... Try to simplify the transaction before you use a complete multiple tasks page."
  - **구조**: 관련 활동을 동사로 시작하는 이름의 과업으로 묶고, 과업이 많으면 "Check before you start" 같은 상위 단계로 더 묶으라고 한다.
  - **완료 상태값**: 최소한으로("Completed"/"Incomplete" 정도만 우선 쓰고 연구로 뒷받침될 때만 추가), **"Cannot start yet"**(의존 과업 미완료 시, 링크 비활성·회색), **"There is a problem"**(빨간 배경, 최후 수단, 가급적 인라인 에러 선호)을 규정한다.
  - **순서**: 가능한 한 사용자가 자유롭게 고르게 하고, 의존성이 있을 때만 "Cannot start yet"으로 강제한다: "where possible, users should be allowed to complete tasks in any order, so they can plan their time." ([Complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/))
- **Check answers**: 제출 전 확인 화면. "Builds confidence... Reduces errors."
  - 작은~중간 트랜잭션은 제출 직전에 한 번, 크고 섹션이 많은 트랜잭션은 섹션마다 체크 화면을 둘 수 있다("different people complete different sections"일 때 특히 유용).
  - 각 답변 옆에 숨은 텍스트가 붙은 "Change" 링크, 값을 바꿔도 나머지 질문을 반복하지 않고 바로 Check answers로 복귀시키며 변경 전 값은 미리 채워둔다. 건너뛴 선택 질문은 "Not provided"로 표시. ([Check answers](https://design-system.service.gov.uk/patterns/check-answers/))
- **Step by step navigation**: "an end to end journey in logical steps."
  - 특정 시작·끝점이 있고("a specific start and end point"), GOV.UK 내 여러 안내·트랜잭션을 아우르며, 과업 순서가 의미 있는 여정에만 쓴다. **트랜잭션 서비스 내부에는 쓰지 말라**("Inside a transactional service, where the Complete multiple tasks pattern should be used instead").
  - 또한 **"this pattern is for use in your prototype only"** — 팀이 직접 만들어 라이브 GOV.UK에 올릴 수 없고 GDS가 부처와 함께 구축한다.
  - 컴포넌트 동작은 기본 접힘(collapsed)으로 시작해 사용자가 펼치는 방식("User research suggested that each step should be collapsed by default so that users are not overwhelmed")이며, JS가 꺼지면 전체 펼침으로 대체된다. ([Step by step navigation](https://design-system.service.gov.uk/patterns/step-by-step-navigation))

---

## 2. 워크플로/태스크 중심 내비게이션 패턴 정리

| 패턴 | 출처가 말하는 목적 | 강점 | 한계 |
| --- | --- | --- | --- |
| **Task list / Complete multiple tasks** | 순서가 꼭 필요하진 않은 여러 과업의 완료 상태를 한 화면에서 보여줌(1.8) | 비선형 완료를 1급 시민으로 지원(의존성 있는 것만 잠금); 세션을 넘나드는 장기 과업에 적합하다고 GOV.UK가 명시 | 원안은 "사용자 1명·트랜잭션 1건" 전제 — 우리처럼 "콜 다수가 동시에 각자 다른 단계에 있는" 목록형 운영에는 그대로 맞지 않고, 목록(그리드) 위에 각 행의 단계 상태를 얹는 방식으로 변형이 필요 |
| **Hub-and-spoke**(NNG, 2차 자료) | "users have to first go back to the hub and then use one of the options listed there" — 한 세션에 한 갈래만 쓰는 과업형 앱에 적합(항공권 체크인, 폰 설정 변경 등 예시) | 세션당 한 갈래만 오가는 경우 효율적인 분배 지점 역할 | "relatively difficult and annoying if all navigation must go through the homepage"라고 NNG 스스로 인정; 허브 화면이 콘텐츠 공간을 내비게이션에 내줌 ([NNG Mobile navigation patterns](https://www.nngroup.com/articles/mobile-navigation-patterns/), 2차 자료) |
| **Console / workspace tabs**(Salesforce) | 목록을 고정해 둔 채 여러 레코드를 탭으로 열고 서브탭으로 연관 레코드를 연다(1.6) | 상담원이 여러 건을 동시에 열어두고 오가는 시나리오(= counter 역할)에 정확히 들어맞음; 탭·서브탭 관계를 선언적 규칙(Navigation Rules)으로 미리 정의 가능 | 탭이 쌓이면 화면이 복잡해지고, 터치 중심 태블릿/폰에는 적합도가 떨어짐(Salesforce 문서도 콘솔 자체를 데스크톱 "에이전트 콘솔" 맥락으로 설명) |
| **Command palette / 키보드 우선** | 이번 조사에서 공식 스펙을 확보하지 못했다 | — | **공백**: Atlassian, GOV.UK, Material, Apple, Carbon, NNG 모두에서 "command palette"라는 이름의 공식 패턴 페이지를 이 세션에서 찾지 못했다(시도한 URL 다수가 404). ARIA APG의 **combobox/listbox 패턴**이 "입력하면서 좁혀지는 목록에서 고르기"라는 상호작용 자체의 가장 가까운 접근성 1차 자료이지만, 이는 "명령 팔레트"를 이름 붙여 규정한 것은 아니다. 이 방향을 쓰려면 별도 검증이 더 필요하다 |
| **Contextual panel/drawer over 1차 작업면** = Material list-detail/supporting pane(1.1), Apple split view(1.2) | "divides the window into two side-by-side panes"(M3), "selecting an item in the primary pane displays the item's contents in the secondary pane"(Apple) | 목록(오늘의 콜/객실) 옆에 상세를 바로 띄우는 구조라 "탐색→상세 확인→복귀" 왕복이 잦은 counter/waiter 업무에 잘 맞음; 두 시스템 모두 브레이크포인트별 1pane↔2pane 전환 규칙을 수치로 명시해 PC/태블릿/폰 적응이 1차 자료로 뒷받침됨 | compact(폰) 폭에서는 결국 1 pane(목록 아니면 상세 중 하나)이라 동시 조망은 PC/태블릿에서만 유효 |
| **Bottom dock**(Material navigation bar 하단 배치, Apple iOS tab bar 하단 배치) | "positioned at the bottom of windows for convenient access"(M3), iOS tab bar는 하단 플로팅(1.1, 1.2) | 엄지 도달 범위 안이라 태블릿/폰 조작에 유리; M3가 3~5개 목적지라는 수치 상한을 1차 자료로 명시하고 있어(Apple은 수치 상한 없이 "적을수록 쉽다"고만 한다, 1.2절) "워크플로 단계 허브"를 여기에 얹기 좋음 | WCAG 2.4.11(3절)과 충돌 소지 — 고정 바가 포커스된 요소를 가리면 안 됨. 항목 수가 적어야 하므로 5단계 초과 워크플로는 이 자리에 다 못 올림(초과분은 M3 자체도 "모달 확장 레일이나 탭"으로 돌리라고 함) |

---

## 3. 접근성 제약 (WCAG 2.2 / WAI-ARIA APG)

사이드바 없는 셸(하단 독, 콘텍스추얼 패널, 탭 등)을 고를 때 특히 걸리는 조항만 추렸다. 조문은 요지만 인용했고 전문은 출처 링크에 있다.

| 기준 | 레벨 | 요지(규범) | 비사이드바 셸에 대한 함의 |
| --- | --- | --- | --- |
| **2.4.1 Bypass Blocks** | A | "A mechanism is available to bypass blocks of content that are repeated on multiple web pages." 충분 기법으로 스킵 링크(G1/G123/G124)와 ARIA 랜드마크(ARIA11)를 든다. ([출처](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html)) | 하단 독이나 상단 단계 전환바가 모든 화면에 반복되면, 그걸 건너뛰어 본문으로 바로 가는 수단(스킵 링크 또는 `nav`/`main` 랜드마크)이 있어야 한다 |
| **2.4.3 Focus Order** | A | "focusable components receive focus in an order that preserves meaning and operability." 여러 타당한 순서가 있을 수 있고(표를 행 순/열 순으로 읽는 것처럼) 그중 하나만 제공하면 된다. ([출처](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)) | 하단 독은 시각적으로 화면 맨 아래 있지만, DOM/탭 순서가 그와 다르게 "먼저" 와버리면 안 됨 — 시각 순서와 포커스 순서를 맞추거나 랜드마크로 점프 가능하게 할 것 |
| **2.4.11 Focus Not Obscured (Minimum)** — WCAG 2.2 신규 | AA | "the component is not entirely hidden due to author-created content." 스티키 헤더/푸터/비모달 다이얼로그가 대표 사례로 언급되며, 쿠키 배너 같은 스티키 알림은 모달로 만들거나 scroll-padding을 쓰거나 포커스를 잃으면 닫히게 하면 통과한다고 예시를 든다. ([출처](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)) | **하단 독은 포커스된 요소를 완전히 가리면 안 됨.** scroll-padding으로 독 높이만큼 여백을 주거나, 포커스가 들어오면 독이 그 요소를 가리지 않게 레이아웃해야 통과 |
| **2.5.8 Target Size (Minimum)** — 신규 | AA | "The size of the target for pointer inputs is at least 24 by 24 CSS pixels", 예외: 간격 확보형(24px 원이 겹치지 않으면 통과), 동등 기능이 다른 컨트롤로 중복 제공, 인라인 텍스트 내, 브라우저 기본 컨트롤, 필수적 표현(법적 요구 등). ([출처](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)) | 하단 독/탭 바의 터치 타깃은 최소 24×24px — 다만 Material은 자체 기본값을 48×48dp로 더 엄격하게 잡는다(1.1절 density 문서) |
| **3.2.3 Consistent Navigation** | AA | "Navigational mechanisms that are repeated on multiple web pages... occur in the same relative order each time they are repeated"(사용자가 직접 바꾼 경우는 예외). 서브 내비게이션·보조 블록은 계속 허용된다. ([출처](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html)) | 워크플로 단계 전환 독/탭의 항목 순서를 화면마다 바꾸면 안 됨 |
| **3.2.6 Consistent Help** — 신규 | A | 전화번호/이메일, 채팅/문의폼, FAQ/자가도움, 챗봇 — 이 네 유형의 "도움" 메커니즘이 여러 페이지에 반복되면 상대적 순서가 같아야 함(사용자가 초래한 레이아웃 변화는 예외). 인터페이스 수준의 맥락 도움말(폼 설명 등)은 적용 대상이 아니다. ([출처](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html)) | 앱 안에 문의/도움 진입점을 둔다면 그 위치를 화면마다 흔들지 말 것 |
| **1.4.10 Reflow** | AA | 세로 스크롤 콘텐츠는 320 CSS px 폭(1280px 뷰포트의 400% 확대와 동치)에서 2차원 스크롤 없이 동작해야 함. **데이터 테이블은 2차원 레이아웃이 필요한 예외로 명시**되지만, "surrounding content, such as introductory headings, search fields, and pagination, does not get the exception" — 표를 감싸는 요소는 예외가 아니다. ([출처](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)) | 정산 표 같은 밀도 높은 표는 폰 폭에서 가로 스크롤이 허용되지만, 그 표를 감싸는 필터/검색/페이지네이션 UI는 반드시 접히거나 재배치돼야 함 |

**WAI-ARIA APG**(상호작용 패턴의 키보드/역할 요건):

- **Tabs**: 컨테이너는 `role="tablist"`, 각 탭은 `role="tab"`+`aria-controls`로 패널 연결, 활성 탭만 `aria-selected="true"`(나머지는 `"false"`), 패널은 `role="tabpanel"`+`aria-labelledby`.
  - 좌우(가로) 또는 상하(세로, `aria-orientation="vertical"`) 방향키로 탭 간 이동하며 양끝에서 순환(wrap).
  - 자동 활성화는 "패널이 지연 없이 뜰 때만"(대개 사전 로드된 콘텐츠) 권장하고, 그렇지 않으면 수동 활성화(화살표로 포커스 이동 후 Space/Enter로 확정)를 쓰라고 한다. "roving tabindex"라는 용어 자체는 쓰지 않지만 동작은 동일하게 기술한다. ([Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/))
- **Dialog (Modal)**: "Windows under a modal dialog are inert" — 배경은 완전히 비활성화된다.
  - Tab/Shift+Tab이 다이얼로그 안에서만 순환하는 포커스 트랩이 필수이며, 모달은 닫지 않고는 포커스를 밖으로 뺄 방법이 없다(비모달과의 차이).
  - 열릴 때 포커스는 보통 첫 포커스 가능 요소로 가되, 되돌릴 수 없는 동작엔 가장 덜 파괴적인 버튼에, 안내성 다이얼로그엔 가장 가능성 높은 액션(OK 등)에 초기 포커스를 두라고 한다. Escape로 닫힘.
  - `role="dialog"`+`aria-modal="true"`+제목에 연결된 `aria-labelledby`(또는 `aria-label`) 필수. ([Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/))
- **Disclosure**: 토글 컨트롤은 `role="button"`+`aria-expanded`(콘텐츠가 보이면 true, 숨으면 false), `aria-controls`는 선택적으로 콘텐츠 요소를 참조한다. Enter 또는 Space로 토글. ([Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/))
- **Landmark regions**: "Screen readers exploit landmark roles to provide keyboard navigation to important sections of a page."
  - `banner`/`main`/`contentinfo`는 페이지당 **1개**만(각각 `header`/`main`/`footer` 요소가 body 직계일 때 자동 매핑).
  - `navigation`/`complementary`/`form`/`region`/`search`는 **여러 개 허용**하되 역할이 반복되면 각 인스턴스에 고유한 라벨을 달아야 한다(단, 완전히 동일한 콘텐츠·목적의 페이지네이션처럼 반복 쌍은 같은 라벨 가능).
  - 라벨에 역할명을 중복하지 말라("Site"가 맞고 "Site Navigation"은 틀림 — 스크린리더가 role을 이미 읽어주므로). 스킵 링크의 목적지로도 쓰인다. ([Landmark regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/))

---

## 4. 대형 디스플레이 / 키오스크 / TV 읽기전용 보드

벽걸이 TV(read_only_viewer, 30초 주기 새로고침)에 가장 가까운 1차 자료다.

### Apple tvOS

- 시청 거리: "Although people generally remain many feet away from their stationary TV — often 8 feet or more — they sometimes continue to interact with content as they move around the room." ([Designing for tvOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos))
- 상호작용 모델: 포인팅이 아니라 **포커스 시스템**이다 — "Embrace the tvOS focus system, letting it gently highlight and expand onscreen items as people move among them, helping them know what to do and where they are at all times." 콘텐츠는 "clear, legible, and captivating from across the room"이어야 한다.
- 글자·컨트롤 크기(플랫폼 비교표, 1차 자료로 거리-가독성을 수치로 뒷받침):
  - **tvOS 기본/최소 본문 크기는 29pt/23pt**로 iOS(17pt/11pt)의 약 1.7배다.
  - **컨트롤 최소 크기는 66×66pt/56×56pt로 전 플랫폼 중 가장 크다**(iOS 44×44/28×28, macOS 28×28/20×20) — 정밀한 포인팅이 아니라 포커스 엔진으로 선택하는 상호작용 모델을 그대로 반영한다. ([Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility))
- 세이프 에어리어·그리드: 상하 60pt, 좌우 80pt를 화면 가장자리에서 띄우라는 수치가 명시돼 있다(오버스캔 대응, "ensures your content is visible regardless of TV compatibility settings or overscan cropping"). 포커스 시 요소가 커지므로("an element gets bigger when it comes into focus") 포커스 가능 요소 사이에 적절한 패딩을 두라는 경고가 그리드 스펙과 함께 나온다. ([Layout — tvOS](https://developer.apple.com/design/human-interface-guidelines/layout))
- "상호작용 크롬 없는 수동 시청" 자체를 규정한 전용 페이지는 없다. 가장 가까운 1차 자료는 **Live-viewing apps** 문서로, **"Let people tap once — or not at all — to start playback... immediately disappears and playback begins, replacing your app's UI with a full-screen, immersive viewing experience"**라고 한다 — 미디어 재생용 가이드이지 ERP 보드용은 아니지만, "상호작용 크롬을 최소화하고 콘텐츠를 우선한다"는 사상은 참고할 수 있는 가장 가까운 1차 근거다. ([Live-viewing apps](https://developer.apple.com/design/human-interface-guidelines/live-viewing-apps))

### Android TV

- 시청 거리: **"the average distance between a TV and its viewers is 3 meters (10 feet)... Complex screens layouts and controls are not ideal for such leanback experiences. As such, it is important to make sure that text and other elements are large enough to be seen from a distance or limit the amount of text and reading on TV screens."** ([Design for TV](https://developer.android.com/design/ui/tv/guides/foundations/design-for-tv))
- 상호작용 모델: "Unlike touch devices most TVs rely on d-pad... to navigate the UI. TV UI must provide instant and distinct feedback" — Apple과 동일하게 포인팅이 아니라 방향키+포커스 모델이다.
- 공용 기기 전제: "TV is typically a shared device in the household... apps that show personal information should have privacy settings." — 벽걸이 TV 보드가 "누구나 보는 화면"이라는 전제와 맞닿는 유일한 공식 언급이다.
- 타이포그래피 문서는 **"interfaces that use larger typography are more legible and comfortable for users"**라고만 하고 **구체적인 sp/px 수치는 공식 문서에 없다**(일부 블로그에 떠도는 "12sp/18sp/44sp" 같은 수치는 developer.android.com 1차 자료가 아니므로 인용하지 않는다).
- 레이아웃 문서의 구체 수치: 오버스캔 안전 여백 **"5% margin of 48 dp on the left and right edges and 27 dp on the top and bottom edges."** 레이아웃은 항상 가로(landscape)로("TV screens always display in landscape mode"), 내비게이션 컨트롤은 화면 좌/우에 둬 세로 공간을 콘텐츠에 쓰라고 한다("Put on-screen navigation controls on the left or right side of the screen and save the vertical space for content"). 어두운 배경에 밝은 텍스트, 산세리프, 짧은 텍스트 덩어리로 끊어 쓰라는 가독성 규칙도 있다. ([Build TV layouts](https://developer.android.com/training/tv/playback/compose/layouts))
- "수동 시청에는 상호작용 크롬을 두지 말라"는 명시적 한 문장은 **찾지 못했다**(정직하게 공백으로 남김). 가장 가까운 것은 "limit the amount of text and reading on TV screens"다.

**시사점**: 두 플랫폼 모두 "①거리 때문에 글자를 키운다 ②포인팅이 아니라 방향 이동/포커스로 상호작용한다"는 1차 자료가 명확하다. 벽걸이 TV 보드가 **상호작용 자체가 없는**(읽기전용, 자동 새로고침) 경우라면 이 두 플랫폼의 "포커스 엔진" 규정은 적용 대상이 아니게 되고, 남는 것은 "거리에 맞는 큰 글자 + 오버스캔 안전 여백 + 가로 레이아웃 + 텍스트 최소화"뿐이다. 이는 둘 다 1차 자료로 뒷받침된다.

---

## 5. 데이터 밀도 높은 운영 테이블

| 시스템 | 밀도 | 스티키 헤더/열 | 행 액션 | 인라인 편집 |
| --- | --- | --- | --- | --- |
| **Carbon Data table** | 행 높이 5단계: 24/32/40(기본)/48/64px. 헤더·툴바·페이지네이션 높이를 행 높이에 맞추라는 규칙. 지브라 스트라이프 옵션 | 문서에 언급 없음(스티키 헤더 공식 가이드 미확인) | 3개 미만이면 인라인 아이콘 버튼, 그 이상이면 overflow 메뉴. 선택 시 상단에 batch action bar, 그동안 행별 단일 액션은 비활성화. 툴바 액션은 전역용 최대 5개 권장 | 문서에 언급 없음 |
| **Polaris Table (구 Index table)** | 화면 크기에 따라 list/table 전환. 밀도 옵션 자체는 언급 없음 | **"The component doesn't support sticky headers that remain visible during scrolling."**라고 명시 — 대신 페이지네이션으로 테이블 길이를 관리하라고 권고(50~100행 기준) | 행의 기본 동작은 `clickDelegate`로 지정하되 키보드/스크린리더 접근은 별도로 보장해야 한다고 명시. 일괄 액션은 web component 버전에 공식 지원이 없다는 커뮤니티 보고가 있음(2차, 개발자 포럼) | 언급 없음 |
| **Material 3** | 전용 Data table 컴포넌트 스펙이 404(1.1절 공백 참고). Density 문서가 "고밀도는 데이터 테이블/대시보드에 유용"이라고만 원론적으로 언급, 기본 48×48dp 미만 축소 금지 | 언급 없음(스펙 자체가 없음) | 선택(Selection) 패턴: 선택이 주 활동이면 체크박스 상시 노출, 보조 활동이면 hover 시 노출 | 언급 없음 |

**결론**: 세 시스템 모두 "스티키 헤더"를 적극 권장하는 1차 자료는 없다(Polaris는 오히려 명시적으로 미지원). 정산/월 마감처럼 열이 많고 스크롤이 긴 화면에서 스티키 헤더가 필요하다고 판단한다면, 그 결정은 이 세 시스템의 공식 가이드가 아니라 자체 설계 판단에 근거해야 한다는 뜻이다. 행 밀도·일괄 액션 패턴은 Carbon이 가장 구체적이다.

---

## 6. 이 앱에 주는 시사점

### 역할 × 기기 × 증거 매핑

| 역할 | 주 기기 | 업무 성격 | 가장 관련 있는 1차 근거 |
| --- | --- | --- | --- |
| **counter**(전화 예약) | PC(주), 태블릿(보조) | 여러 콜을 동시에 열어두고 오가며 처리 | Salesforce **console/workspace tabs**(1.6) — "목록 고정 + 다중 레코드 탭 + 서브탭" 구조가 "콜 여러 건 동시 처리"와 정확히 대응 |
| **waiter**(현장 객실 확인) | 태블릿 | 목록(객실/콜)을 보고 바로 상세를 확인·갱신, 반복 왕복 | Material **list-detail / supporting pane**(1.1), Apple **split view**(1.2) — 둘 다 브레이크포인트별 1↔2 pane 전환이 1차 자료로 뒷받침됨; 터치 타깃은 WCAG 2.5.8(24px) + Material 48dp 기본값(3절) |
| **settlement_manager**(정산/마감) | PC, 태블릿 | 긴 다단계 과업(지급 확인 → 재확인 → 월 마감), 세션을 넘나듦 | GOV.UK **Complete multiple tasks**(1.8) — "세션 넘나드는 긴 트랜잭션"이라는 적용 조건 자체가 월 마감과 들어맞음; 마감 직전 확인에는 **Check answers** 패턴(1.8) |
| **administrator** | PC | 전 기능 횡단 접근, 빈도 낮은 설정류 포함 | Carbon **UI Shell의 우측 패널**(시스템 수준 액션) 개념이 "자주 안 쓰지만 어디서나 접근해야 하는 기능"을 상설 내비게이션 밖에 두는 선례; **command palette**는 증거가 약함(2절 공백) |
| **read_only_viewer** | 폰(상태 열람), 벽걸이 TV(객실 보드) | 상호작용 없음, 주기적 자동 새로고침 | Apple tvOS + Android TV(4절) — 거리별 큰 글자·오버스캔 여백·가로 레이아웃. 폰은 Material compact 브레이크포인트(1 pane) 규칙 적용 |

### 후보 내비게이션 모델 (사이드바+상단바 제외, 2~4개, 순위는 참고용이며 최종 선택 아님)

**1순위 — "단계 허브 + 목록-상세" 혼합**

GOV.UK Complete multiple tasks 식으로 콜 하나(또는 하루치 업무)를 "예약 → 실제입장/객실확인 → 완료/수납 → 지급확인 → 마감"의 단계별 상태로 보여주고, 각 단계 화면 자체는 Material list-detail/supporting pane 또는 Apple split view로 "목록 + 상세"를 구성한다. 단계 간 전환은 PC/태블릿에서 Material navigation bar(하단, 3~5개 한도) 식의 독으로.
- 장점: 비선형 완료(여러 콜이 동시에 다른 단계에 있음)를 Task list 패턴이 1급으로 지원; list-detail의 브레이크포인트 적응이 PC/태블릿/폰 전체에 1차 자료로 수치까지 커버됨(1.1절 compact/medium/expanded 표).
- 단점: GOV.UK 원안은 "사용자 1명·트랜잭션 1건" 전제라, "콜 다수를 그리드로 보면서 각 행의 단계를 표시"하는 형태로 변형이 필요 — 그대로 들고 오면 안 맞는다.
- 주의: expanded 폭(넓은 데스크톱)에서 Material 권고대로 navigation bar를 navigation rail로 "업그레이드"하면 그 자체가 세로 레일 = 금지된 "사이드바"로 보일 수 있다. 이 모델을 쓴다면 넓은 화면에서도 하단 독 또는 상단 탭을 유지하도록 의도적으로 M3 기본 권고를 벗어나야 한다.

**2순위 — counter 역할 한정 콘솔/워크스페이스 탭**

Salesforce 패턴을 counter 역할의 PC 화면에 국한해 적용: 콜 목록을 고정하고, 열어본 콜은 탭으로 유지한 채 단계를 넘나든다(탭을 닫지 않고 예약→객실확인→수납을 오갈 수 있음).
- 장점: "콜 여러 건 동시 처리"라는 counter의 실제 행태에 가장 직접적인 선례; 콜 하나를 열어둔 채 여러 단계를 들락거려도 맥락이 안 끊김.
- 단점: 터치 중심 태블릿·폰에는 어울리지 않음(Salesforce 문서 자체가 데스크톱 에이전트 콘솔 맥락) — counter의 PC 화면에만 국한하고 다른 역할/기기에는 다른 모델을 써야 함, 즉 "앱 전체의 유일한 모델"은 될 수 없음.

**3순위 — 명령 팔레트를 보조 수단으로**

administrator처럼 전 기능을 넘나들되 상시 내비게이션 공간을 할애하기 아까운 역할에 한해, 위 1·2순위 모델 위에 검색형 진입점을 얹는 안.
- 장점: 자주 안 쓰는 기능에 상설 자리를 안 줘도 됨.
- 단점: 이번 조사에서 공식 스펙(접근성 패턴 포함)을 하나도 확보하지 못했다(2절 표 참고) — 채택 전에 ARIA APG combobox/listbox 패턴을 기준으로 한 별도 검증이 필요하다. **증거가 가장 약한 안이라 최하위에 둔다.**

### 공통으로 지켜야 할 접근성 제약 (어느 모델을 고르든)

- 상설 독/탭이 있다면 **2.4.1**(건너뛰기 수단) + **2.4.11**(고정 바가 포커스를 가리지 않게 scroll-padding 확보) + **3.2.3**(항목 순서 고정).
- 터치 타깃 **24×24px 이상**(WCAG 2.5.8), 가능하면 **48×48dp**(Material 기본값)까지.
- 정산 표처럼 열이 많은 화면은 **1.4.10**에 따라 표 자체는 가로 스크롤이 허용되지만 둘러싼 검색/필터/페이지네이션은 320px 폭에서도 접혀야 함.
- 모달(콜 상세 drawer 등)을 쓴다면 APG Dialog 패턴의 포커스 트랩/Escape/`aria-modal` 요건을 그대로 따를 것.
- 탭 형태 UI(콜 워크스페이스 탭이든 단계 탭이든)를 쓴다면 APG Tabs 패턴의 `tablist`/`aria-selected`/방향키 요건을 따를 것.

---

## 조사 중 확인한 공백(추측하지 않고 명시)

- Fluent 2의 side nav/pivot 등 Nav 외 내비게이션 계열 컴포넌트 공식 가이드 — 이 세션의 fetch로는 본문을 확보하지 못함(사이트가 SPA). Nav 컴포넌트 자체는 텍스트 추출 프록시로 확보함(1.4절).
- Carbon UI Shell의 "상단(헤더) 항목 권장 개수" — 문서에 수치 없음(좌측 패널의 ">5개 항목" 기준은 확보함, 1.3절).
- Atlassian의 "side nav vs top nav를 언제 쓰나" 공식 기준, 항목 개수 권장치 — 찾지 못함(커뮤니티 포럼도 "아직 없다"고 답변).
- "Command palette"라는 이름의 공식 디자인시스템 패턴 — 이번 조사 범위(Material/Apple/Carbon/Fluent/Polaris/Salesforce/Atlassian/GOV.UK/NNG)에서 하나도 찾지 못함.
- Carbon/Polaris/Material 모두 "스티키 헤더를 쓰라"는 적극 권고는 없음(Polaris는 반대로 미지원을 명시). "인라인 편집" 가이드도 세 시스템 다 없음.
- Android TV의 "상호작용 크롬을 없애라"는 문장 그대로의 공식 표현은 찾지 못함(가장 가까운 것은 "텍스트 분량을 제한하라").
- m3.material.io의 전용 "Data tables" 컴포넌트 페이지는 접속일 기준 404 — M2에는 있었으나 M3에는 없다(커뮤니티에서도 복원 여부를 묻는 이슈가 미해결 상태로 확인됨, 2차 정황).
