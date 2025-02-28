import { initVue } from './vue-app.js'
import { initDatabase } from './db.js'

async function init() {
  await initDatabase()
  initVue()
  // Your other initialization code
}

init()