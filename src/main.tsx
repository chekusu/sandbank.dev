import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import Home from './pages/home'
import Cloud from './pages/cloud'
import { initLocale } from './i18n'
import './index.css'

initLocale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cloud" element={<Cloud />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
