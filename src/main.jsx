import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import LandingPage from './components/LandingPage'
import './styles/main.css'

const params = new URLSearchParams(window.location.search)
const RootComponent = params.get('screen') === 'map' ? App : LandingPage

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
)
