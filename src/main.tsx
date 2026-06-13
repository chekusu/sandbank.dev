import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import { ClerkProvider, type ClerkProviderProps } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import Home from './pages/home'
import Cloud from './pages/cloud'
import Panel from './pages/panel'
import { initLocale } from './i18n'
import { useLocale } from './hooks/use-i18n'
import { getClerkLocalization } from './lib/clerk'
import './index.css'

initLocale()

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
const routerBasename = import.meta.env.BASE_URL === '/'
  ? undefined
  : import.meta.env.BASE_URL.replace(/\/$/, '')

const clerkAppearance: ClerkProviderProps['appearance'] = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#f26522',
    colorBackground: '#000000',
    colorInputBackground: '#111111',
    colorInputText: '#e8e8e8',
    colorText: '#e8e8e8',
    colorTextSecondary: '#999999',
    borderRadius: '16px',
    fontFamily: 'Space Grotesk, ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    cardBox: 'shadow-none',
    card: 'border border-[#222] bg-[#111]',
    formButtonPrimary: 'shadow-none',
    footerActionLink: 'text-[#f26522]',
    identityPreviewEditButton: 'text-[#f26522]',
  },
}

function AppRoutes() {
  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cloud" element={<Cloud />} />
        <Route path="/panel/*" element={<Panel />} />
      </Routes>
    </BrowserRouter>
  )
}

function AppRoot() {
  const locale = useLocale()

  if (!clerkPublishableKey) {
    return <AppRoutes />
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      localization={getClerkLocalization(locale)}
      appearance={clerkAppearance}
      signInFallbackRedirectUrl="/panel"
      signUpFallbackRedirectUrl="/panel"
      afterSignOutUrl="/panel"
    >
      <AppRoutes />
    </ClerkProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)
