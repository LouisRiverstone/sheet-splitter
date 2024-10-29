import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { read, utils, write } from 'xlsx'
import { writeFile } from 'fs'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on(
    'process-file',
    async (
      event,
      {
        file,
        maxLines,
        headerRows
      }: {
        file: ArrayBuffer
        maxLines: number
        headerRows: number
      }
    ) => {
      if (!file) {
        event.reply('process-file', { message: 'Arquivo não informado' })
        return
      }

      const workbook = read(file, { type: 'array' })

      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = utils.sheet_to_json(worksheet, { header: 1 })

      const header = jsonData.slice(0, headerRows)
      const dataRows = jsonData.slice(headerRows)

      const blobs: Blob[] = []

      for (let i = 0; i < dataRows.length; i += maxLines) {
        const chunk = dataRows.slice(i, i + maxLines)
        const newSheetData = [...header, ...chunk] as unknown[][]
        const newWorksheet = utils.aoa_to_sheet(newSheetData)
        const newWorkbook = utils.book_new()
        utils.book_append_sheet(newWorkbook, newWorksheet, sheetName)

        const wbout = write(newWorkbook, { bookType: 'xlsx', type: 'array' })
        blobs.push(new Blob([wbout], { type: 'application/octet-stream' }))

        event.reply('process-file', {
          message: `Processando ${i} de ${dataRows.length}`,
          percentage: ((i / dataRows.length) * 100).toFixed(2)
        })
      }

      //wait 500 milisseconds
      await new Promise((resolve) => setTimeout(resolve, 500))

      event.reply('process-file', {
        message: `Processamento concluído`,
        percentage: (100).toFixed(2)
      })

      //wait 500 milisseconds
      await new Promise((resolve) => setTimeout(resolve, 500))

      const {
        canceled,
        filePaths: [filePath]
      } = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })

      if (!canceled && filePath) {
        const arrayBuffers = await Promise.all(blobs.map((blob) => blob.arrayBuffer()))

        arrayBuffers.forEach((arrayBuffer, index) => {
          const fileName = `${index + 1}.xlsx`
          writeFile(join(filePath, fileName), Buffer.from(arrayBuffer), (err) => {
            if (err) {
              console.error('Error saving file:', err)
            }
          })
        })
      }
    }
  )

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
