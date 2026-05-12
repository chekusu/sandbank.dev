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

const clerkAppearance: ClerkProviderProps['appearance'] = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#d8ad48',
    colorBackground: '#12110f',
    colorInputBackground: '#191815',
    colorInputText: '#f5f0e4',
    colorText: '#f5f0e4',
    colorTextSecondary: '#aaa394',
    borderRadius: '0px',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    cardBox: 'shadow-none',
    card: 'border border-[#d8ad48]/20 bg-[#12110f]',
    formButtonPrimary: 'shadow-none',
    footerActionLink: 'text-[#d8ad48]',
    identityPreviewEditButton: 'text-[#d8ad48]',
  },
}

function AppRoutes() {
  return (
    <BrowserRouter>
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
