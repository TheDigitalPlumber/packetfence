/**
* "$_layer2_networks" store module
*/
import Vue from 'vue'
import { computed } from '@vue/composition-api'
import { types } from '@/store'
import api from './_api'
import { columns as columnsLayer2Network } from './config'

export const useStore = $store => {
  return {
    isLoading: computed(() => $store.getters['$_layer2_networks/isLoading']),
    getList: () => $store.dispatch('$_layer2_networks/all'),
    getListOptions: () => $store.dispatch('$_layer2_networks/options'),
    getItem: params => $store.dispatch('$_layer2_networks/getLayer2Network', params.id),
    getItemOptions: params => $store.dispatch('$_layer2_networks/options', params.id),
    updateItem: params => $store.dispatch('$_layer2_networks/updateLayer2Network', params),
  }
}

// Default values
const state = () => {
  return {
    cache: {},
    message: '',
    status: '',
    layer2Networks: []
  }
}

const getters = {
  isWaiting: state => [types.LOADING, types.DELETING].includes(state.status),
  isLoading: state => state.status === types.LOADING,
  layer2Networks: state => state.layer2Networks
}

const actions = {
  all: ({ commit }) => {
    const params = {
      sort: 'id',
      fields: columnsLayer2Network.map(r => r.key).join(','),
      limit: 1000
    }
    commit('LAYER2_NETWORK_REQUEST')
    return api.layer2Networks(params).then(response => {
      commit('LAYER2_NETWORK_SUCCESS')
      commit('LAYER2_NETWORKS_REPLACED', response.items)
      return response.items
    }).catch((err) => {
      commit('LAYER2_NETWORK_ERROR', err.response)
      throw err
    })
  },
  options: ({ commit }, id) => {
    commit('LAYER2_NETWORK_REQUEST')
    if (id) {
      return api.layer2NetworkOptions(id).then(response => {
        commit('LAYER2_NETWORK_SUCCESS')
        return response
      }).catch((err) => {
        commit('LAYER2_NETWORK_ERROR', err.response)
        throw err
      })
    } else {
      return api.layer2NetworksOptions().then(response => {
        commit('LAYER2_NETWORK_SUCCESS')
        return response
      }).catch((err) => {
        commit('LAYER2_NETWORK_ERROR', err.response)
        throw err
      })
    }
  },
  getLayer2Network: ({ state, commit }, id) => {
    if (state.cache[id]) {
      return Promise.resolve(state.cache[id])
    }
    commit('LAYER2_NETWORK_REQUEST')
    return api.layer2Network(id).then(item => {
      commit('LAYER2_NETWORK_REPLACED', { ...item, id })
      return state.cache[id]
    }).catch((err) => {
      commit('LAYER2_NETWORK_ERROR', err.response)
      throw err
    })
  },
  updateLayer2Network: ({ commit }, data) => {
    commit('LAYER2_NETWORK_REQUEST')
    return api.updateLayer2Network(data).then(response => {
      commit('LAYER2_NETWORK_REPLACED', data)
      return response
    }).catch(err => {
      commit('LAYER2_NETWORK_ERROR', err.response)
      throw err
    })
  }
}

const mutations = {
  LAYER2_NETWORKS_REPLACED: (state, layer2Networks) => {
    state.layer2Networks = layer2Networks
  },
  LAYER2_NETWORK_REQUEST: (state, type) => {
    state.status = type || types.LOADING
    state.message = ''
  },
  LAYER2_NETWORK_REPLACED: (state, data) => {
    state.status = types.SUCCESS
    Vue.set(state.cache, data.id, data)
  },
  LAYER2_NETWORK_DESTROYED: (state, id) => {
    state.status = types.SUCCESS
    Vue.set(state.cache, id, null)
  },
  LAYER2_NETWORK_ERROR: (state, response) => {
    state.status = types.ERROR
    if (response && response.data) {
      state.message = response.data.message
    }
  },
  LAYER2_NETWORK_SUCCESS: (state) => {
    state.status = types.SUCCESS
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
