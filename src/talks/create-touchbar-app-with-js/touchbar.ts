import { app, BrowserWindow, TouchBar, globalShortcut } from 'electron'
import { buttons } from './Buttons'

const { TouchBarButton } = TouchBar

app.once('ready', () => {
  // Register a 'ControlOrControl+X' shortcut listener.
  const toggleShortcut = globalShortcut.register('Control+X', () => {
    window.isFocused() ? window.hide() : window.show()
  })

  if (!toggleShortcut) {
    console.log('registration failed')
  }

  const window = new BrowserWindow({
    frame: false,
    width: 1080,
    height: 800,
    backgroundColor: '#0000',
    transparent: true,
    movable: true,
  })

  const touchBar = new TouchBar({
    items: buttons.map(
      ({ label, backgroundColor, url }) =>
        new TouchBarButton({
          label,
          backgroundColor,
          click: () => {
            window.loadURL(url)
          },
        })
    ),
  })

  window.setTouchBar(touchBar)
})

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll()
})
