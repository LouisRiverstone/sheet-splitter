"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const xlsx = require("xlsx");
const fs = require("fs");
const icon = path.join(__dirname, "../../resources/icon.png");
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.on("ping", () => console.log("pong"));
  electron.ipcMain.on(
    "process-file",
    async (event, {
      file,
      maxLines,
      headerRows
    }) => {
      if (!file) {
        event.reply("process-file", { message: "Arquivo não informado" });
        return;
      }
      const workbook = xlsx.read(file, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      const header = jsonData.slice(0, headerRows);
      const dataRows = jsonData.slice(headerRows);
      const blobs = [];
      for (let i = 0; i < dataRows.length; i += maxLines) {
        const chunk = dataRows.slice(i, i + maxLines);
        const newSheetData = [...header, ...chunk];
        const newWorksheet = xlsx.utils.aoa_to_sheet(newSheetData);
        const newWorkbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
        const wbout = xlsx.write(newWorkbook, { bookType: "xlsx", type: "array" });
        blobs.push(new Blob([wbout], { type: "application/octet-stream" }));
        event.reply("process-file", {
          message: `Processando ${i} de ${dataRows.length}`,
          percentage: (i / dataRows.length * 100).toFixed(2)
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      event.reply("process-file", {
        message: `Processamento concluído`,
        percentage: 100 .toFixed(2)
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      const {
        canceled,
        filePaths: [filePath]
      } = await electron.dialog.showOpenDialog({
        properties: ["openDirectory"]
      });
      if (!canceled && filePath) {
        const arrayBuffers = await Promise.all(blobs.map((blob) => blob.arrayBuffer()));
        arrayBuffers.forEach((arrayBuffer, index) => {
          const fileName = `${index + 1}.xlsx`;
          fs.writeFile(path.join(filePath, fileName), Buffer.from(arrayBuffer), (err) => {
            if (err) {
              console.error("Error saving file:", err);
            }
          });
        });
      }
    }
  );
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
