import type { ClerkProviderProps } from '@clerk/clerk-react'
import { enUS, jaJP, zhCN } from '@clerk/localizations'
import type { Locale } from '@/i18n'

type Localization = NonNullable<ClerkProviderProps['localization']>

function mergeLocalization(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base }

  for (const [key, value] of Object.entries(overlay)) {
    const existing = result[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      result[key] = mergeLocalization(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      )
    } else {
      result[key] = value
    }
  }

  return result
}

const clerkOverrides = {
  en: {
    signIn: {
      start: {
        title: 'Sign in to Sandbank',
        titleCombined: 'Sign in to Sandbank',
        subtitle: 'Manage projects, API Keys, sandboxes, Relay maps, and billing.',
        subtitleCombined: 'Manage projects, API Keys, sandboxes, Relay maps, and billing.',
        actionText: 'New tenant?',
        actionLink: 'Create an account',
        actionLink__use_passkey: 'Use passkey',
      },
      alternativeMethods: {
        blockButton__passkey: 'Sign in with passkey',
      },
      passkey: {
        title: 'Use passkey',
        subtitle: 'Confirm this is you with your device passkey.',
      },
      emailCode: {
        title: 'Check your email',
        subtitle: 'Enter the code we sent to your email.',
        formTitle: 'Verification code',
        resendButton: 'Resend code',
      },
    },
    signUp: {
      start: {
        title: 'Create your Sandbank tenant',
        titleCombined: 'Create your Sandbank tenant',
        subtitle: 'Create projects, issue API Keys, and manage sandbox usage.',
        subtitleCombined: 'Create projects, issue API Keys, and manage sandbox usage.',
        actionText: 'Already have a tenant?',
        actionLink: 'Sign in',
      },
      legalConsent: {
        title: 'Terms',
        subtitle: 'Review and accept the terms to continue.',
      },
      emailCode: {
        title: 'Verify your email',
        subtitle: 'Enter the code we sent to your email.',
        formTitle: 'Verification code',
        formSubtitle: 'Use the verification code sent to your email.',
        resendButton: 'Resend code',
      },
    },
    dividerText: 'or',
    formButtonPrimary: 'Continue',
    socialButtonsBlockButton: 'Continue with {{provider|titleize}}',
    footerActionLink__useAnotherMethod: 'Use another method',
  },
  zh: {
    signIn: {
      start: {
        title: '登录 Sandbank',
        titleCombined: '登录 Sandbank',
        subtitle: '管理项目、API Key、沙盒、Relay 关系和账单。',
        subtitleCombined: '管理项目、API Key、沙盒、Relay 关系和账单。',
        actionText: '还没有租户？',
        actionLink: '创建账号',
        actionLink__use_passkey: '使用 Passkey',
      },
      alternativeMethods: {
        blockButton__passkey: '使用 Passkey 登录',
      },
      passkey: {
        title: '使用 Passkey',
        subtitle: '用此设备的 Passkey 确认身份。',
      },
      emailCode: {
        title: '查看邮箱',
        subtitle: '输入发送到你邮箱的验证码。',
        formTitle: '验证码',
        resendButton: '重新发送验证码',
      },
    },
    signUp: {
      start: {
        title: '创建 Sandbank 租户',
        titleCombined: '创建 Sandbank 租户',
        subtitle: '创建项目、发放 API Key，并管理沙盒用量。',
        subtitleCombined: '创建项目、发放 API Key，并管理沙盒用量。',
        actionText: '已有租户？',
        actionLink: '登录',
      },
      legalConsent: {
        title: '条款',
        subtitle: '请阅读并同意条款后继续。',
      },
      emailCode: {
        title: '验证邮箱',
        subtitle: '输入发送到你邮箱的验证码。',
        formTitle: '验证码',
        formSubtitle: '使用发送到你邮箱的验证码。',
        resendButton: '重新发送验证码',
      },
    },
    dividerText: '或',
    formButtonPrimary: '继续',
    socialButtonsBlockButton: '使用 {{provider|titleize}} 继续',
    footerActionLink__useAnotherMethod: '使用其他方式',
    formFieldLabel__emailAddress: '邮箱',
    formFieldInputPlaceholder__emailAddress: '输入你的邮箱',
    formFieldLabel__password: '密码',
    formFieldInputPlaceholder__password: '输入密码',
    formFieldLabel__phoneNumber: '手机号',
    formFieldInputPlaceholder__phoneNumber: '输入你的手机号',
  },
  ja: {
    signIn: {
      start: {
        title: 'Sandbank にログイン',
        titleCombined: 'Sandbank にログイン',
        subtitle: 'プロジェクト、API Key、サンドボックス、Relay 関係、請求を管理します。',
        subtitleCombined: 'プロジェクト、API Key、サンドボックス、Relay 関係、請求を管理します。',
        actionText: 'テナントをお持ちでないですか？',
        actionLink: 'アカウントを作成',
        actionLink__use_passkey: 'Passkey を使う',
      },
      alternativeMethods: {
        blockButton__passkey: 'Passkey でログイン',
      },
      passkey: {
        title: 'Passkey を使用',
        subtitle: 'このデバイスの Passkey で本人確認を行います。',
      },
      emailCode: {
        title: 'メールを確認',
        subtitle: 'メールに届いた確認コードを入力してください。',
        formTitle: '確認コード',
        resendButton: 'コードを再送',
      },
    },
    signUp: {
      start: {
        title: 'Sandbank テナントを作成',
        titleCombined: 'Sandbank テナントを作成',
        subtitle: 'プロジェクト作成、API Key 発行、サンドボックス利用量の管理を行えます。',
        subtitleCombined: 'プロジェクト作成、API Key 発行、サンドボックス利用量の管理を行えます。',
        actionText: 'すでにテナントをお持ちですか？',
        actionLink: 'ログイン',
      },
      legalConsent: {
        title: '規約',
        subtitle: '続行するには規約をご確認ください。',
      },
      emailCode: {
        title: 'メールを確認',
        subtitle: 'メールに届いた確認コードを入力してください。',
        formTitle: '確認コード',
        formSubtitle: 'メールに届いた確認コードを使用してください。',
        resendButton: 'コードを再送',
      },
    },
    dividerText: 'または',
    formButtonPrimary: '続行',
    socialButtonsBlockButton: '{{provider|titleize}} で続行',
    footerActionLink__useAnotherMethod: '別の方法を使う',
    formFieldLabel__emailAddress: 'メール',
    formFieldInputPlaceholder__emailAddress: 'メールアドレスを入力',
    formFieldLabel__password: 'パスワード',
    formFieldInputPlaceholder__password: 'パスワードを入力',
    formFieldLabel__phoneNumber: '電話番号',
    formFieldInputPlaceholder__phoneNumber: '電話番号を入力',
  },
} as const

const clerkLocales: Record<Locale, Localization> = {
  en: mergeLocalization(enUS, clerkOverrides.en) as Localization,
  zh: mergeLocalization(zhCN, clerkOverrides.zh) as Localization,
  ja: mergeLocalization(jaJP, clerkOverrides.ja) as Localization,
}

export function getClerkLocalization(locale: Locale): Localization {
  return clerkLocales[locale] ?? clerkLocales.en
}
