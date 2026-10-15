// 원 단위 숫자를 한국식 천 단위 구분 기호와 원화 기호가 있는 문자열로 바꿉니다.
function formatWon(amount) {
  return `₩${new Intl.NumberFormat("ko-KR").format(amount)}`;
}

// HTML date 입력값("YYYY-MM-DD")을 사람이 읽기 쉬운 한국어 날짜로 바꿉니다.
function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

// 구독 데이터 한 건을 받아 목록에 넣을 카드 DOM 요소를 만듭니다.
// 데이터는 innerHTML 대신 textContent에 넣어 이름에 HTML 문자가 있어도 코드로 실행되지 않게 합니다.
function createSubscriptionCard(subscription, daysUntilPayment) {
  // 기존 계산 함수를 사용해 연간 구독도 월 기준 금액으로 표시합니다.
  const monthlyAmount = convertToMonthlyAmount(subscription);
  const card = document.createElement("article");
  card.className = "subscription-card";

  const main = document.createElement("div");
  main.className = "card-main";
  const topline = document.createElement("div");
  topline.className = "card-topline";

  // 아이콘에는 구독 이름의 첫 글자를 사용합니다. aria-hidden은 장식 글자를 스크린 리더에서 제외합니다.
  const mark = document.createElement("span");
  mark.className = "service-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = subscription.name.trim().charAt(0).toUpperCase();

  const name = document.createElement("strong");
  name.className = "service-name";
  name.textContent = subscription.name;

  const category = document.createElement("span");
  category.className = "category-tag";
  category.textContent = subscription.category;

  topline.append(mark, name, category);
  const meta = document.createElement("p");
  meta.className = "card-meta";
  // 카드/계좌 정보, 결제 날짜, 월간 또는 연간 주기를 한 줄로 안내합니다.
  meta.textContent = `${subscription.paymentMethod} · ${formatDate(subscription.nextPaymentDate)} 결제 예정 · ${subscription.cycle === "yearly" ? "연간" : "월간"}`;
  main.append(topline, meta);

  const side = document.createElement("div");
  side.className = "card-side";
  const price = document.createElement("strong");
  price.className = "card-price";
  price.textContent = `${formatWon(monthlyAmount)}/월`;
  // 연간 결제는 월 환산 금액과 실제 연간 청구 금액을 함께 보여줍니다.
  if (subscription.cycle === "yearly") {
    const cycleAmount = document.createElement("small");
    cycleAmount.textContent = `${formatWon(subscription.amount)}/년`;
    price.append(cycleAmount);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";
  // data-action과 data-id는 main.js가 목록 이벤트를 한 곳에서 처리할 때 사용합니다.
  const editButton = document.createElement("button");
  editButton.className = "text-action";
  editButton.type = "button";
  editButton.dataset.action = "edit";
  editButton.dataset.id = subscription.id;
  editButton.textContent = "수정";
  editButton.setAttribute("aria-label", `${subscription.name} 수정`);
  const deleteButton = document.createElement("button");
  deleteButton.className = "text-action delete";
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.dataset.id = subscription.id;
  deleteButton.textContent = "삭제";
  deleteButton.setAttribute("aria-label", `${subscription.name} 삭제`);
  actions.append(editButton, deleteButton);

  const days = document.createElement("span");
  days.className = `dday${daysUntilPayment === 0 ? " today" : ""}`;
  // 음수는 이미 지난 날짜, 0은 오늘, 양수는 결제일까지 남은 날을 뜻합니다.
  days.textContent = daysUntilPayment < 0 ? `결제일 ${Math.abs(daysUntilPayment)}일 지남` : daysUntilPayment === 0 ? "오늘 결제" : `D-${daysUntilPayment}`;
  side.append(price, actions);
  card.append(main, side);
  card.append(days);
  return card;
}

// 등록된 구독이 없을 때 목록 대신 보여줄 안내 요소를 만듭니다.
function createEmptyState() {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const icon = document.createElement("span");
  icon.className = "empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "+";
  const title = document.createElement("strong");
  title.textContent = "아직 등록된 구독이 없어요";
  const description = document.createElement("p");
  description.textContent = "첫 구독을 추가하고 지출을 정리해보세요.";
  empty.append(icon, title, description);
  return empty;
}

// 카테고리 한 종류의 월 합계와 전체 지출 중 차지하는 비율 막대를 만듭니다.
function createCategoryRow(category, amount, total, index) {
  const row = document.createElement("div");
  row.className = "category-row";
  row.style.setProperty("--row-index", index);

  const info = document.createElement("div");
  info.className = "category-info";
  const name = document.createElement("strong");
  name.textContent = category;
  const value = document.createElement("span");
  // 전체 합계가 0인 경우 0으로 나누지 않도록 비율을 0으로 처리합니다.
  const percentage = total === 0 ? 0 : Math.round((amount / total) * 100);
  value.textContent = `${formatWon(amount)} · ${percentage}%`;
  info.append(name, value);

  const track = document.createElement("div");
  track.className = "bar-track";
  // role과 aria-label은 시각 막대의 의미를 보조 기술에도 전달합니다.
  track.setAttribute("role", "img");
  track.setAttribute("aria-label", `${category} ${percentage}%`);
  const fill = document.createElement("div");
  fill.className = "bar-fill";
  fill.style.width = `${percentage}%`;
  track.append(fill);
  row.append(info, track);
  return row;
}