
import "./styles.css";

const departments = [
  {
    id: "finance",
    title: "مالی",
    subtitle: "Finance",
    description: "مدیریت بودجه، هزینه‌ها و گزارش‌های مالی"
  },
  {
    id: "admin",
    title: "اداری و منابع انسانی",
    subtitle: "Administration & HR",
    description: "مدیریت تیم، وظایف و نیروی انسانی"
  },
  {
    id: "legal",
    title: "حقوقی",
    subtitle: "Legal Affairs",
    description: "مدیریت قراردادها و اسناد حقوقی"
  },
  {
    id: "media",
    title: "رسانه و تحریریه",
    subtitle: "Media & Editorial",
    description: "مدیریت اخبار، مقالات و انتشار محتوا"
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
    description: "توسعه نرم‌افزار و مدیریت ابزارهای هوشمند"
  }
];

const grid = document.getElementById("departmentGrid");

const app = document.getElementById("app");

function renderDepartments() {
  if (!grid) return;

  grid.innerHTML = departments.map((department) => `
    <button
      class="department-card"
      type="button"
      data-department="${department.id}"
    >
      <span class="department-subtitle">
        ${department.subtitle}
      </span>

      <h3>${department.title}</h3>

      <p>${department.description}</p>

      <span class="card-link">ورود به واحد ←</span>
    </button>
  `).join("");
}

function showMessage(title, message) {
  let panel = document.getElementById("appMessage");

  if (!panel) {
    panel = document.createElement("section");
    panel.id = "appMessage";
    panel.className = "app-message";

    const main = app?.querySelector("main");

    if (main) {
      main.prepend(panel);
    }
  }

  if (!panel) return;

  panel.innerHTML = "";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = message;

  panel.append(heading, paragraph);
  panel.scrollIntoView({ behavior: "smooth" });
}

grid?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-department]");

  if (!card) return;

  const department = departments.find(
    (item) => item.id === card.dataset.department
  );

  if (department) {
    showMessage(
      department.title,
      `واحد ${department.subtitle} انتخاب شد. پنل تخصصی این بخش در حال توسعه است.`
    );
  }
});

document.getElementById("adminButton")?.addEventListener(
  "click",
  () => {
    showMessage(
      "پنل مدیریت PHARMANEX",
      "بخش مدیریت کاربران، دسترسی‌ها و واحدهای سازمانی در حال توسعه است."
    );
  }
);

document.getElementById("aiButton")?.addEventListener(
  "click",
  () => {
    showMessage(
      "دستیار هوشمند PHARMANEX",
      "زیرساخت اتصال به مدل‌های هوش مصنوعی در حال آماده‌سازی است."
    );
  }
);

renderDepartments();

console.log("PHARMANEX Version 2 initialized.");
