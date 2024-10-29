<template>
  <section class="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
    <header class="flex flex-row justify-center mb-8">
      <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200">Spread Splitter</h1>
    </header>
    <div
      class="flex flex-col items-center gap-3 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"
    >
      <div class="flex md:flex-row items-center gap-3 flex-col">
        <input v-show="false" ref="fileInput" type="file" name="sheet" @change="handleFile" />
        <span class="mr-4 text-gray-700 dark:text-gray-300">{{ file?.name }}</span>
        <button
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          @click="openFileInput"
        >
          Importar .xlsx
        </button>
      </div>
      <div class="flex flex-col w-full">
        <label for="headerRows" class="mb-2 font-bold text-gray-700 dark:text-gray-300"
          >Quantidade de linhas do Cabeçalho*</label
        >
        <input
          id="headersRows"
          v-model="headerRows"
          type="number"
          class="mb-4 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <label for="maxLines" class="mb-2 font-bold text-gray-700 dark:text-gray-300"
          >Quantidade de linhas Máxima por arquivo*</label
        >
        <input
          id="maxLines"
          v-model="maxLines"
          type="number"
          class="mb-4 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <div class="w-full mb-4">
          <label for="progress" class="mb-2 text-gray-700 dark:text-gray-300">Progresso:</label>
          <div class="relative pt-1">
            <div class="flex mb-2 items-center justify-between">
              <div>
                <span
                  class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200 dark:text-blue-100 dark:bg-blue-700"
                >
                  {{ progress }}%
                </span>
              </div>
            </div>
            <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200 dark:bg-blue-700">
              <div
                :style="{ width: progress + '%' }"
                class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
              ></div>
            </div>
          </div>
        </div>

        <button
          :class="[
            'px-4 py-2 rounded text-white flex flex-row items-center justify-center',
            buttonDisabled ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
          ]"
          :disabled="buttonDisabled"
          @click="sheetSplit"
        >
          Gerar
          <svg
            v-if="loadingFile"
            class="animate-spin h-5 w-5 text-white ml-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </button>

        <div>
          <span class="mt-4 font-light text-blue-500 dark:text-blue-400">{{ message }}</span>
        </div>
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
const progress = ref<string>('0.00')
const buttonDisabled = ref<boolean>(false)
const loadingFile = ref<boolean>(false)

const handleFile = (e: Event) => {
  const fileFromInput = (e.target as HTMLInputElement).files?.[0]

  if (!fileFromInput) {
    return
  }

  if (fileFromInput.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    alert('Selecione um arquivo .xlsx')

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
  progress.value = '0.00'

  if (!file.value) {
    alert('Selecione um arquivo')

    return
  }

  if (file.value.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    alert('Selecione um arquivo .xlsx')

    return
  }

  if (!maxLines.value || !headerRows.value || maxLines.value <= 0 || headerRows.value <= 0) {
    alert('Preencha os campos')

    return
  }

  buttonDisabled.value = true
  loadingFile.value = true

  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result

        if (!data) {
          message.value = 'Erro ao processar arquivo'
          reject('Erro ao processar arquivo')
          return
        }

        message.value = 'Processando arquivo...'

        window.electron.ipcRenderer.send('process-file', {
          file: data,
          maxLines: maxLines.value,
          headerRows: headerRows.value
        })
      } catch (error) {
        console.error(error)
      }
    }

    if (file.value) {
      reader.readAsArrayBuffer(file.value)
      resolve('Arquivo carregado')
    } else {
      reject('Arquivo não encontrado')
    }
  })
}

const mount = () => {
  window.electron.ipcRenderer.on(
    'process-file',
    (
      event,
      response: {
        message?: string
        blobs?: Blob[]
        percentage?: string
      }
    ) => {
      console.log('Event called', event)

      if (response.percentage) {
        progress.value = response.percentage
      }

      if (response.percentage && response.percentage === '100.00') {
        buttonDisabled.value = false
        loadingFile.value = false
      }

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
