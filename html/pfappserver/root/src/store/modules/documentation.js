/**
* "documentation" store module
*/
import Vue from 'vue'
import store, { types } from '@/store'
import { documentationCall } from '@/utils/api'

const api = {
  getDocuments: () => {
    return documentationCall.get('index.js').then(response => {
      return response.data.items
    })
  },
  getDocument: (filename) => {
    return documentationCall.get(filename).then(response => {
      return response.data
    })
  }
}

const initialState = () => {
  return {
    cache: {},
    index: false,
    path: false,
    hash: false,
    fullscreen: false,
    showViewer: false,
    message: '',
    requestStatus: ''
  }
}

const getters = {
  isLoading: state => state.requestStatus === types.LOADING,
  index: state => state.index || [],
  path: state => state.path,
  hash: state => state.hash,
  fullscreen: state => state.fullscreen,
  showViewer: state => state.showViewer,
  title: state => {
    if (state.index && state.index.length > 0) {
      const document = state.index.find(document => document.name === state.path)
      if (document) {
        return document.text
      }
    }
    return ''
  }
}

const actions = {
  getIndex: ({ commit, state }) => {
    if (state.index) {
      return Promise.resolve(state.index)
    }
    commit('INDEX_REQUEST')
    return new Promise((resolve, reject) => {
      api.getDocuments().then(data => {
        commit('INDEX_SUCCESS', data)
        resolve(state.index)
      }).catch(err => {
        commit('INDEX_ERROR', err.response)
        reject(err)
      })
    })
  },
  getDocument: ({ commit, state }, filename) => {
    if (state.cache && filename in state.cache) {
      return Promise.resolve(state.cache[filename])
    }
    commit('DOCUMENT_REQUEST')
    return new Promise((resolve, reject) => {
      api.getDocument(filename).then(response => {
        commit('DOCUMENT_SUCCESS', { filename, response })
        resolve(state.cache[filename])
      }).catch(err => {
        commit('DOCUMENT_ERROR', err.response)
        reject(err)
      })
    })
  },
  openViewer: ({ commit, state }) => {
    if (!state.showViewer) {
      commit('VIEWER_OPEN')
    }
  },
  closeViewer: ({ commit, state }) => {
    if (state.showViewer) {
      commit('FULLSCREEN_OFF')
      commit('VIEWER_CLOSE')
    }
  },
  toggleViewer: ({ commit, state }) => {
    if (!state.showViewer) {
      commit('VIEWER_OPEN')
    } else {
      commit('FULLSCREEN_OFF')
      commit('VIEWER_CLOSE')
    }
  },
  toggleFullscreen: ({ commit, state }) => {
    if (!state.fullscreen) {
      commit('FULLSCREEN_ON')
    } else {
      commit('FULLSCREEN_OFF')
    }
  },
  setPath: ({ commit, state }, path) => {
    if (state.path !== path) {
      commit('SET_PATH', path)
      store.dispatch('analytics/trackEvent', ['Documentation Path', { path }])
    }
  },
  setHash: ({ commit, state }, hash) => {
    hash = (hash.charAt(0) === '#') ? hash.substr(1) : hash
    if (state.hash !== hash) {
      commit('SET_HASH', hash)
      store.dispatch('analytics/trackEvent', ['Documentation Hash', { path: state.path, hash }])
    }
  },
  showImage: ({ state }, src) => {
    const parsed = new URL(src)
    store.dispatch('analytics/trackEvent', ['Documentation Image', { path: state.path, hash: state.hash, src: parsed.pathname }])
  }
}

const mutations = {
  INDEX_REQUEST: (state) => {
    state.requestStatus = types.LOADING
    state.message = ''
  },
  INDEX_SUCCESS: (state, data) => {
    Vue.set(state, 'index', data.map(document => {
      return { ...document, ...{ text: document.name.replace(/\.html/g, '').replace(/_/g, ' ').replace(/^PacketFence /, '') } }
    }))
    state.requestStatus = types.SUCCESS
    state.message = ''
  },
  INDEX_ERROR: (state, data) => {
    state.requestStatus = types.ERROR
    const { response: { data: { message } = {} } = {} } = data
    if (message) {
      state.message = message
    }
  },
  DOCUMENT_REQUEST: (state) => {
    state.requestStatus = types.LOADING
    state.message = ''
  },
  DOCUMENT_SUCCESS: (state, data) => {
    Vue.set(state.cache, data.filename, data.response)
    state.requestStatus = types.SUCCESS
    state.message = ''
  },
  DOCUMENT_ERROR: (state, data) => {
    state.requestStatus = types.ERROR
    if (data) {
      const { response: { data: { message } = {} } = {} } = data
      if (message) {
        state.message = message
      }
    }
  },
  VIEWER_OPEN: (state) => {
    Vue.set(state, 'showViewer', true)
  },
  VIEWER_CLOSE: (state) => {
    Vue.set(state, 'showViewer', false)
  },
  FULLSCREEN_ON: (state) => {
    Vue.set(state, 'fullscreen', true)
  },
  FULLSCREEN_OFF: (state) => {
    Vue.set(state, 'fullscreen', false)
  },
  SET_PATH: (state, path) => {
    Vue.set(state, 'path', path)
    Vue.set(state, 'hash', false)
  },
  SET_HASH: (state, hash) => {
    Vue.set(state, 'hash', hash)
  },
  $RESET: (state) => {
    // eslint-disable-next-line no-unused-vars
    state = initialState()
  }
}

export default {
  namespaced: true,
  state: initialState(),
  getters,
  actions,
  mutations
}
