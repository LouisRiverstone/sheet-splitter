<template>
  <section>
    <header class="flex flex-row">
      <h1>Spread Splitter</h1>
    </header>
    <div class="flex flex-col">
      <div class="flex flex-row">
        <input v-show="false" ref="fileInput" type="file" name="sheet" @change="handleFile" />

        <span>{{ file?.name }}</span>
        <button @click="openFileInput">Importar .xlsx</button>
      </div>
      <div class="flex flex-col">
        <label for="headerRows">Quantidade de linhas do Cabeçalho:</label>
        <input id="headersRows" v-model="headerRows" type="number" />
        <label for="headerRows">Quantidade de linhas Máxima por arquivo:</label>
        <input id="maxLines" v-model="maxLines" type="number" />

        <button @click="sheetSplit">Gerar</button>
        <span>{{ message }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const maxLines = ref<number>(0)
const headerRows = ref<number>(0)
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const message = ref<string>('')

const handleFile = (e: Event) => {
  const fileFromInput = (e.target as HTMLInputElement).files?.[0]

  if (!fileFromInput) {
    return
  }

  file.value = fileFromInput
}

const openFileInput = () => {
  if (!fileInput.value) {
    return
  }

  fileInput.value.click()
}

const sheetSplit = () => {
  if (!file.value) {
    alert('Selecione um arquivo')

    return
  }

  if (file.value.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    alert('Selecione um arquivo .xlsx')

    return
  }

  if (!maxLines.value || !headerRows.value) {
    alert('Preencha os campos')

    return
  }

  const reader = new FileReader()

  reader.onload = (e) => {
    const data = e.target?.result

    if (!data) {
      message.value = 'Erro ao processar arquivo'
      return
    }

    window.electron.ipcRenderer.send('process-file', {
      file: data,
      maxLines: maxLines.value,
      headerRows: headerRows.value
    })
  }

  reader.readAsArrayBuffer(file.value)
}

const mount = () => {
  window.electron.ipcRenderer.on(
    'process-file',
    (
      event,
      response: {
        message?: string
        blobs?: Blob[]
      }
    ) => {
      console.log({ event, response })
      if (response.message) {
        message.value = response.message
        return
      }

      if (response.blobs) {
        return
      }

      return
    }
  )
}

onMounted(() => {
  mount()
})
</script>

<style scoped>
.flex {
  display: flex;
}

.flex-row {
  flex-direction: row;
}

.flex-col {
  flex-direction: column;
}
</style>
