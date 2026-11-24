
const ALLOWED_LICENSES = [
  "creativecommons.org/publicdomain/zero",
  "creativecommons.org/licenses/by/",
  "creativecommons.org/licenses/by-sa/"
];

const RESTRICTED_LICENSES = [
  "creativecommons.org/licenses/by-nc",
  "creativecommons.org/licenses/by-nd",
  "creativecommons.org/licenses/by-nc-nd",
  "creativecommons.org/licenses/by-nc-sa"
];

export function checkArticleLicense(licenseUrl) {
  if (typeof licenseUrl !== "string" || !licenseUrl.trim()) {
    return {
      verified: false,
      allowed: false,
      reason: "مجوز مقاله مشخص نشده است."
    };
  }

  const normalized = licenseUrl.trim().toLowerCase();

  if (RESTRICTED_LICENSES.some(item => normalized.includes(item))) {
    return {
      verified: true,
      allowed: false,
      reason: "این مجوز برای استفاده تجاری یا ترجمه مناسب نیست."
    };
  }

  if (ALLOWED_LICENSES.some(item => normalized.includes(item))) {
    return {
      verified: true,
      allowed: true,
      reason: "مجوز اولیه با ترجمه و استفاده تجاری سازگار است؛ رعایت شرایط انتساب و مجوز الزامی است."
    };
  }

  return {
    verified: false,
    allowed: false,
    reason: "مجوز نیازمند بررسی حقوقی و تأیید دستی است."
  };
}
