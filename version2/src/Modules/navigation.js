
export const departments = [
  {
    id: "finance",
    title: "مالی",
    subtitle: "Finance",
    description: "بودجه، هزینه‌ها و گزارش‌های مالی"
  },
  {
    id: "admin",
    title: "اداری و منابع انسانی",
    subtitle: "Administration & HR",
    description: "مدیریت تیم و وظایف"
  },
  {
    id: "legal",
    title: "حقوقی",
    subtitle: "Legal Affairs",
    description: "قراردادها و اسناد حقوقی"
  },
  {
    id: "media",
    title: "رسانه و تحریریه",
    subtitle: "Media & Editorial",
    description: "اخبار، مقالات و انتشار محتوا"
  },
  {
    id: "research",
    title: "تحقیقات و هوش بازار",
    subtitle: "Research & Market Intelligence",
    description: "تحلیل بازار دارو و رقبا"
  },
  {
    id: "technology",
    title: "فناوری و هوش مصنوعی",
    subtitle: "Technology & AI",
    description: "توسعه نرم‌افزار و ابزارهای هوشمند"
  }
];

export function renderDepartments(container, onSelect) {
  if (!container) return;

  container.innerHTML = departments.map((department) => `
    <button
      class="department-card"
      type="button"
      data-department="${department.id}"
    >
      <span class="department-subtitle">${department.subtitle}</span>
      <h3>${department.title}</h3>
      <p>${department.description}</p>
      <span class="card-link">ورود به واحد ←</span>
    </button>
  `).join("");

  container.addEventListener("click", (event) => {
    const card = event.target.closest("[data-department]");
    if (!card) return;

    const selected = departments.find(
      (item) => item.id === card.dataset.department
    );

    if (selected && typeof onSelect === "function") {
      onSelect(selected);
    }
  });
}

export function showDepartment(container, department) {
  if (!container || !department) return;

  container.innerHTML = `
    <h2>${department.title}</h2>
    <p>${department.description}</p>
    <p>پنل تخصصی این واحد در حال توسعه است.</p>
  `;

  container.scrollIntoView({ behavior: "smooth" });
}
