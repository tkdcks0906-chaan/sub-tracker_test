// 이 파일은 화면과 데이터 흐름을 연결하는 앱의 시작점입니다.
// 즉시 실행 함수 안에 변수를 두어 전역 이름이 다른 스크립트와 충돌하지 않게 합니다.
(function () {
  "use strict";

  // 브라우저 저장소 안에서 이 앱의 구독 목록을 구분하는 이름입니다.
  const STORAGE_KEY = "subscription-tracker.subscriptions.v1";

  // HTML에서 자주 사용하는 요소를 시작할 때 찾아두면 이후 코드가 간결해집니다.
  const form = document.getElementById("subscription-form");
  const list = document.getElementById("subscription-list");
  const errorMessage = document.getElementById("form-error");
  const formSection = document.getElementById("form-section");

  // 페이지를 열자마자 브라우저에 저장된 데이터를 읽어 앱 상태로 사용합니다.
  let subscriptions = loadSubscriptions();

  // localStorage는 문자열만 저장하므로 JSON.parse로 객체 배열로 복원합니다.
  // 저장값이 없거나 손상됐을 때 앱이 멈추지 않도록 예외를 잡고 빈 목록을 반환합니다.
  function loadSubscriptions() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter(isValidSubscription) : [];
    } catch (error) {
      console.error("저장된 구독 데이터를 불러오지 못했습니다.", error);
      return [];
    }
  }

  // 저장된 데이터의 필수 필드와 타입을 확인합니다.
  // 이 검사는 잘못되었거나 오래된 데이터가 계산 함수에서 오류를 일으키는 일을 줄입니다.
  function isValidSubscription(subscription) {
    return subscription && typeof subscription.id === "string" &&
      typeof subscription.name === "string" && Number.isFinite(Number(subscription.amount)) &&
      (subscription.cycle === "monthly" || subscription.cycle === "yearly") &&
      typeof subscription.nextPaymentDate === "string" &&
      typeof subscription.category === "string" && typeof subscription.paymentMethod === "string";
  }

  // 현재 구독 배열을 JSON 문자열로 바꾸어 브라우저에 저장합니다.
  // 저장 공간이 차 있거나 브라우저 정책으로 막힌 경우 false를 반환합니다.
  function saveSubscriptions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
      return true;
    } catch (error) {
      showError("저장 공간에 기록하지 못했어요. 브라우저 저장 공간을 확인해주세요.");
      console.error("구독 데이터를 저장하지 못했습니다.", error);
      return false;
    }
  }

  // 날짜를 UTC 변환 없이 기기의 현지 연/월/일로 조합합니다.
  // 날짜 문자열만 비교하는 계산 함수에 오늘 날짜를 전달하기 위한 형식입니다.
  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // 폼 위에 오류 메시지를 노출합니다. textContent를 사용해 문자열을 HTML로 실행하지 않습니다.
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }

  // 다음 입력을 시작할 때 이전 검증 오류를 지웁니다.
  function clearError() {
    errorMessage.textContent = "";
    errorMessage.hidden = true;
  }

  // 현재 상태(subscriptions)를 바탕으로 화면의 숫자, 카드, 카테고리 막대를 모두 다시 그립니다.
  // 항목 추가/수정/삭제 뒤 이 함수를 호출하면 화면 각 부분의 값이 서로 일치합니다.
  function render() {
    const today = localDateString(new Date());

    // 계산 자체는 수정하지 않는 logic.js의 함수를 사용합니다.
    const monthlyTotal = getTotalMonthlyAmount(subscriptions);
    const dueThisWeek = getSubscriptionsDueWithinDays(subscriptions, today, 7);
    document.getElementById("today-label").textContent = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric", month: "long", day: "numeric", weekday: "long"
    }).format(new Date());
    document.getElementById("monthly-total").textContent = formatWon(monthlyTotal);
    document.getElementById("annual-total").textContent = formatWon(getTotalAnnualAmount(subscriptions));
    // 이 HTML 조각에는 앱이 직접 만든 숫자만 넣고, 구독 이름 같은 사용자 입력에는 사용하지 않습니다.
    document.getElementById("due-count").innerHTML = `${dueThisWeek.length}<span class="value-unit">건</span>`;
    document.getElementById("due-caption").textContent = dueThisWeek.length
      ? `${dueThisWeek.map((subscription) => subscription.name).join(", ")} 결제 예정`
      : "앞으로 7일 이내";
    document.getElementById("subscription-count").textContent = subscriptions.length;

    // 이전에 만든 카드 DOM을 비운 다음 최신 배열로 새로 생성합니다.
    list.replaceChildren();
    if (subscriptions.length === 0) {
      list.append(createEmptyState());
    } else {
      [...subscriptions]
        .sort((first, second) => first.nextPaymentDate.localeCompare(second.nextPaymentDate))
        .forEach((subscription) => {
          const days = getDaysUntilNextPayment(today, subscription.nextPaymentDate);
          list.append(createSubscriptionCard(subscription, days));
        });
    }

    // 계산 함수가 반환한 { 카테고리: 월합계 } 객체를 금액이 큰 순서로 정렬합니다.
    const categoryBreakdown = document.getElementById("category-breakdown");
    categoryBreakdown.replaceChildren();
    const categoryTotals = getMonthlyAmountByCategory(subscriptions);
    const categories = Object.entries(categoryTotals).sort((first, second) => second[1] - first[1]);
    if (categories.length === 0) {
      const empty = document.createElement("p");
      empty.className = "category-empty";
      empty.textContent = "구독을 추가하면 비중을 보여드려요.";
      categoryBreakdown.append(empty);
    } else {
      categories.forEach(([category, amount], index) => {
        categoryBreakdown.append(createCategoryRow(category, amount, monthlyTotal, index));
      });
    }
  }

  // 입력 폼을 새 구독 추가 상태로 되돌립니다. 수정 id와 취소 버튼도 함께 초기화합니다.
  function resetForm() {
    form.reset();
    document.getElementById("subscription-id").value = "";
    document.getElementById("form-title").textContent = "새 구독 추가";
    document.getElementById("submit-button").innerHTML = '구독 저장 <span aria-hidden="true">↗</span>';
    document.getElementById("cancel-edit-button").hidden = true;
    clearError();
  }

  // 카드의 수정 버튼을 눌렀을 때 선택한 데이터를 폼에 채우고 수정 상태로 바꿉니다.
  function beginEdit(id) {
    const subscription = subscriptions.find((item) => item.id === id);
    if (!subscription) return;
    document.getElementById("subscription-id").value = subscription.id;
    document.getElementById("name").value = subscription.name;
    document.getElementById("amount").value = subscription.amount;
    document.getElementById("cycle").value = subscription.cycle;
    document.getElementById("nextPaymentDate").value = subscription.nextPaymentDate;
    document.getElementById("category").value = subscription.category;
    document.getElementById("paymentMethod").value = subscription.paymentMethod;
    document.getElementById("form-title").textContent = "구독 수정";
    document.getElementById("submit-button").innerHTML = '변경 저장 <span aria-hidden="true">↗</span>';
    document.getElementById("cancel-edit-button").hidden = false;
    clearError();
    formSection.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("name").focus({ preventScroll: true });
  }

  // 상단의 추가 버튼은 폼을 초기화하고 입력 위치까지 스크롤한 뒤 이름 칸에 초점을 둡니다.
  document.getElementById("add-subscription-button").addEventListener("click", () => {
    resetForm();
    formSection.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("name").focus({ preventScroll: true });
  });

  // 수정 도중 취소하면 데이터는 건드리지 않고 폼만 새 입력 상태로 복구합니다.
  document.getElementById("cancel-edit-button").addEventListener("click", resetForm);

  // submit 이벤트는 저장 버튼 클릭과 키보드 Enter 제출을 모두 처리합니다.
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearError();
    const formData = new FormData(form);
    const amount = Number(formData.get("amount"));
    const nextPaymentDate = String(formData.get("nextPaymentDate"));

    // 금액은 양의 정수여야 합니다. 입력 속성의 제약과 별개로 코드에서도 다시 확인합니다.
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      showError("결제 금액은 1원 이상의 정수로 입력해주세요.");
      return;
    }

    // 브라우저 입력값의 기본 모양과 날짜 변환 가능 여부를 확인합니다.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextPaymentDate) || Number.isNaN(new Date(nextPaymentDate).getTime())) {
      showError("다음 결제일을 확인해주세요.");
      return;
    }

    // 폼의 문자열 값들을 저장할 데이터 객체로 만듭니다.
    // id가 있으면 기존 구독 수정, 없으면 새 id를 만들어 추가합니다.
    const id = String(formData.get("id") || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const subscription = {
      id,
      name: String(formData.get("name")).trim(),
      amount,
      cycle: String(formData.get("cycle")),
      nextPaymentDate,
      category: String(formData.get("category")).trim(),
      paymentMethod: String(formData.get("paymentMethod")).trim()
    };
    if (!subscription.name || !subscription.category || !subscription.paymentMethod) {
      showError("이름, 카테고리, 결제 수단을 입력해주세요.");
      return;
    }

    // 수정 id가 목록에 있으면 해당 위치를 교체하고, 새 항목이면 배열 끝에 추가합니다.
    const existingIndex = subscriptions.findIndex((item) => item.id === id);
    if (existingIndex === -1) subscriptions.push(subscription);
    else subscriptions[existingIndex] = subscription;
    if (!saveSubscriptions()) {
      if (existingIndex === -1) subscriptions.pop();
      else subscriptions[existingIndex] = loadSubscriptions().find((item) => item.id === id) || subscriptions[existingIndex];
      render();
      return;
    }

    // 저장에 성공했을 때만 폼을 비우고 화면을 다시 그립니다.
    resetForm();
    render();
  });

  // 목록 컨테이너 한 곳에서 모든 카드의 버튼을 처리합니다(event delegation).
  // 카드가 다시 그려져도 각 버튼마다 별도의 이벤트 등록을 반복할 필요가 없습니다.
  list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit") {
      beginEdit(button.dataset.id);
      return;
    }
    if (button.dataset.action === "delete") {
      const subscription = subscriptions.find((item) => item.id === button.dataset.id);
      // 실수로 지우는 일을 막기 위해 확인을 받은 뒤 배열과 저장소에서 제거합니다.
      if (!subscription || !window.confirm(`「${subscription.name}」 구독을 삭제할까요?`)) return;
      subscriptions = subscriptions.filter((item) => item.id !== button.dataset.id);
      saveSubscriptions();
      if (document.getElementById("subscription-id").value === button.dataset.id) resetForm();
      render();
    }
  });

  // 스크립트가 로드되면 저장 데이터를 기준으로 첫 화면을 표시합니다.
  render();
})();