import { requestLoginCode, verifyLoginCode } from "./serverApi";
import { appendSessionToken, buildLocaleHref } from "./publicDeals";
import { persistSessionTokenCookie } from "./session";

export interface LoginCopy {
  codeLabel: string;
  emailLabel: string;
  loginCtaLabel: string;
  pageTitle: string;
  requestCodeCtaLabel: string;
  requestErrorMessage: string;
  requestSuccessMessage: string;
  verifyErrorMessage: string;
  verifySuccessMessage: string;
}

export interface SubmitRequestCodeFromFormInput {
  activeLocale: "en" | "zh";
  formData: FormData;
}

export interface SubmitVerifyCodeFromFormInput {
  activeLocale: "en" | "zh";
  formData: FormData;
}

export interface SubmitRequestCodeFromFormResult {
  email: string;
  message: string;
  status: "error" | "success";
}

export interface SubmitVerifyCodeFromFormResult {
  email: string;
  message: string;
  sessionToken?: string;
  status: "error" | "success";
}

export interface BuildLoginRequestCodeRedirectTargetInput {
  activeLocale: "en" | "zh";
  email: string;
  sessionToken?: string;
  status: "error" | "success";
}

export interface BuildLoginVerifyErrorRedirectTargetInput {
  activeLocale: "en" | "zh";
  email: string;
  sessionToken?: string;
}

export interface BuildLoginVerifySuccessRedirectTargetInput {
  activeLocale: "en" | "zh";
  sessionToken: string;
}

export function getLoginCopy(locale: "en" | "zh"): LoginCopy {
  if (locale === "zh") {
    return {
      pageTitle: "登录",
      emailLabel: "邮箱地址",
      codeLabel: "验证码",
      requestCodeCtaLabel: "发送验证码",
      loginCtaLabel: "验证并登录",
      requestSuccessMessage: "验证码已发送。",
      requestErrorMessage: "发送验证码失败。",
      verifySuccessMessage: "登录成功。",
      verifyErrorMessage: "验证码错误或已过期。",
    };
  }

  return {
    pageTitle: "Login",
    emailLabel: "Email address",
    codeLabel: "Verification code",
    requestCodeCtaLabel: "Send code",
    loginCtaLabel: "Verify code",
    requestSuccessMessage: "Verification code sent.",
    requestErrorMessage: "Unable to send verification code.",
    verifySuccessMessage: "Logged in successfully.",
    verifyErrorMessage: "Invalid or expired verification code.",
  };
}

function getNormalizedEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function getNormalizedCode(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function buildLoginRequestCodeRedirectTarget({
  activeLocale,
  email,
  sessionToken,
  status,
}: BuildLoginRequestCodeRedirectTargetInput) {
  const target = appendSessionToken(buildLocaleHref(activeLocale, "/login"), sessionToken);
  const url = new URL(target, "http://local.test");
  url.searchParams.set("status", `request_${status}`);
  url.searchParams.set("email", email);
  return `${url.pathname}${url.search}`;
}

export function buildLoginVerifyErrorRedirectTarget({
  activeLocale,
  email,
  sessionToken,
}: BuildLoginVerifyErrorRedirectTargetInput) {
  const target = appendSessionToken(buildLocaleHref(activeLocale, "/login"), sessionToken);
  const url = new URL(target, "http://local.test");
  url.searchParams.set("status", "verify_error");
  url.searchParams.set("email", email);
  return `${url.pathname}${url.search}`;
}

export function buildLoginVerifySuccessRedirectTarget({
  activeLocale,
}: BuildLoginVerifySuccessRedirectTargetInput) {
  return buildLocaleHref(activeLocale, "/favorites");
}

export async function submitRequestCodeFromForm({
  activeLocale,
  formData,
}: SubmitRequestCodeFromFormInput): Promise<SubmitRequestCodeFromFormResult> {
  const copy = getLoginCopy(activeLocale);
  const email = getNormalizedEmail(formData.get("email"));

  try {
    await requestLoginCode(email);
    return {
      status: "success",
      message: copy.requestSuccessMessage,
      email,
    };
  } catch {
    return {
      status: "error",
      message: copy.requestErrorMessage,
      email,
    };
  }
}

export async function submitVerifyCodeFromForm({
  activeLocale,
  formData,
}: SubmitVerifyCodeFromFormInput): Promise<SubmitVerifyCodeFromFormResult> {
  const copy = getLoginCopy(activeLocale);
  const email = getNormalizedEmail(formData.get("email"));
  const code = getNormalizedCode(formData.get("code"));

  try {
    const sessionToken = await verifyLoginCode(email, code);
    await persistSessionTokenCookie(sessionToken);
    return {
      status: "success",
      message: copy.verifySuccessMessage,
      sessionToken,
      email,
    };
  } catch {
    return {
      status: "error",
      message: copy.verifyErrorMessage,
      email,
    };
  }
}
