import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ComparisonPage from './components/ComparisonPage'
import LandingPage from './components/LandingPage'
import ScenarioPage from './components/ScenarioPage'
import './styles/main.css'

const pathname = window.location.pathname.replace(/\/$/, '') || '/'
const routes = {
  '/': LandingPage,
  '/map': App,
  '/comparison': ComparisonPage,
  '/scenario': ScenarioPage,
}
const RootComponent = routes[pathname] || LandingPage

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
)
