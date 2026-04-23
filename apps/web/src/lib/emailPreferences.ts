import { updateDigestPreferences } from "./serverApi";

export interface SubmitDigestPreferencesFromFormInput {
  activeLocale: "en" | "zh";
  formData: FormData;
  sessionToken?: string;
}

export interface SubmitDigestPreferencesFromFormResult {
  message: string;
  status: "error" | "success";
}

export interface EmailPreferencesCopy {
  categoriesLegend: string;
  categoryDeals: string;
  categoryHistoricalLows: string;
  digestFrequencyLabel: string;
  digestLocaleLabel: string;
  frequencyDaily: string;
  frequencyWeekly: string;
  loadErrorMessage: string;
  pageTitle: string;
  saveCtaLabel: string;
  saveErrorMessage: string;
  saveSuccessMessage: string;
}

export function getEmailPreferencesCopy(locale: "en" | "zh"): EmailPreferencesCopy {
  if (locale === "zh") {
    return {
      pageTitle: "邮件偏好",
      digestLocaleLabel: "摘要语言",
      digestFrequencyLabel: "摘要频率",
      categoriesLegend: "订阅分类",
      categoryDeals: "优惠",
      categoryHistoricalLows: "历史低价",
      frequencyDaily: "每天",
      frequencyWeekly: "每周",
      saveCtaLabel: "保存偏好",
      loadErrorMessage: "加载偏好失败。",
      saveSuccessMessage: "偏好已保存。",
      saveErrorMessage: "保存偏好失败。",
    };
  }

  return {
    pageTitle: "Email preferences",
    digestLocaleLabel: "Digest locale",
    digestFrequencyLabel: "Digest frequency",
    categoriesLegend: "Digest categories",
    categoryDeals: "Deals",
    categoryHistoricalLows: "Historical lows",
    frequencyDaily: "Daily",
    frequencyWeekly: "Weekly",
    saveCtaLabel: "Save preferences",
    loadErrorMessage: "Unable to load preferences.",
    saveSuccessMessage: "Preferences updated.",
    saveErrorMessage: "Unable to update preferences.",
  };
}

function toDigestLocale(value: FormDataEntryValue | null): "en" | "zh" {
  return value === "zh" ? "zh" : "en";
}

function toDigestFrequency(value: FormDataEntryValue | null) {
  return value === "weekly" ? "weekly" : "daily";
}

function toDigestCategories(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("categories")
        .map((entry) => String(entry))
        .filter((entry) => entry === "deals" || entry === "historical-lows"),
    ),
  );
}

export async function submitDigestPreferencesFromForm({
  activeLocale,
  formData,
  sessionToken,
}: SubmitDigestPreferencesFromFormInput): Promise<SubmitDigestPreferencesFromFormResult> {
  const copy = getEmailPreferencesCopy(activeLocale);

  try {
    await updateDigestPreferences(sessionToken, {
      locale: toDigestLocale(formData.get("locale")),
      frequency: toDigestFrequency(formData.get("frequency")),
      categories: toDigestCategories(formData),
    });
    return {
      status: "success",
      message: copy.saveSuccessMessage,
    };
  } catch {
    return {
      status: "error",
      message: copy.saveErrorMessage,
    };
  }
}
