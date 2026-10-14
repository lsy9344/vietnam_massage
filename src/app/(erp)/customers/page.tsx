import { requireRouteAccess } from "@/lib/authorization";
import { getServerTranslator } from "@/lib/i18n/server";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import {
  listCustomerVisitHistory,
  listCustomers,
  searchCustomerVisitCandidates,
  type CustomerVisitSelection
} from "@/modules/calls/service-call-service";
import { CreateCustomerPanel } from "@/app/(erp)/customers/customer-forms";
import { CustomerScreen } from "@/app/(erp)/customers/customer-screen";

type CustomersPageSearchParams = {
  customerQuery?: string;
  visitCustomer?: string;
  visitMemo?: string;
};

/**
 * 고객 화면(명세 F08): 고객 검색, 고객 등록·정정, 전체 방문 이력.
 * 지금 콜 원장에 들어가는 관리자와 카운터에게만 연다. 다른 역할은 서버에서 자기 첫 화면으로 돌려보낸다.
 */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<CustomersPageSearchParams> }) {
  const account = await requireRouteAccess("/customers");
  const { locale, t } = await getServerTranslator();

  const params = await searchParams;
  const customerQuery = typeof params.customerQuery === "string" ? params.customerQuery.trim() : "";
  const visitCustomer = typeof params.visitCustomer === "string" && params.visitCustomer.trim() ? params.visitCustomer.trim() : null;
  const visitMemo = typeof params.visitMemo === "string" ? params.visitMemo : null;
  const selection: CustomerVisitSelection | null = visitCustomer
    ? { kind: "customer", customerId: visitCustomer }
    : visitMemo !== null
      ? { kind: "memo", customerMemo: visitMemo }
      : null;

  const [candidates, history, customers] = await Promise.all([
    customerQuery ? searchCustomerVisitCandidates({ query: customerQuery }) : Promise.resolve([]),
    selection ? listCustomerVisitHistory(selection) : Promise.resolve([]),
    selection?.kind === "customer" ? listCustomers() : Promise.resolve([])
  ]);
  const customer = visitCustomer ? (customers.find((item) => item.id === visitCustomer) ?? null) : null;
  // 없는 고객 id는 고르지 않은 것으로 본다.
  const openSelection = visitCustomer ? customer !== null : visitMemo !== null;

  return (
    <div className="screen">
      <ScreenToolbar account={account} action={<CreateCustomerPanel />} locale={locale} path="/customers" title={t("customers.title")} />
      <CustomerScreen
        candidates={candidates}
        customer={customer}
        history={openSelection ? history : []}
        query={customerQuery}
        visitMemo={visitCustomer ? null : visitMemo}
      />
    </div>
  );
}
