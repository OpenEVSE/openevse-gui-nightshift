import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initSafeArea } from './lib/safeArea.js'

initSafeArea()

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
